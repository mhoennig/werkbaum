#!/usr/bin/env bash
#
# Werkbaum — Produktions-Deploy via rsync/SSH.
#
# Baut das badge-freie Prod-Bundle (`npm run build:prod`, ohne den
# Entwicklungs-Hinweis hinter dem Titel), stellt es lokal genauso zusammen wie
# der GitHub-Pages-Workflow (LICENSE-Link geradeziehen + Footer-Version/Commit)
# und spiegelt es per rsync in ein Zielverzeichnis. `--delete`: am Ziel bleibt
# nichts Altes stehen.
#
# Verwendung:
#   scripts/deploy-prod.sh [-y] <rsync-ziel>
#
#   -y   ohne Rückfrage spiegeln (sonst erst Vorschau via --dry-run + Nachfrage)
#
# Beispiel (Hostsharing, Subdomain werkbank.javagil.de unter der Domain
# javagil.de — deshalb `subs-ssl/`; wäre die Domain direkt aufgeschaltet, läge
# das Web-Verzeichnis in `htdocs-ssl/`):
#
#   scripts/deploy-prod.sh mih00@mih00.hostsharing.net:~/doms/javagil.de/subs-ssl/werkbaum/
#
# ACHTUNG: Das Zielverzeichnis wird als exklusiv für Werkbaum angenommen —
# `--delete` entfernt dort ALLES, was nicht zum Bundle gehört.
#
# Siehe README (Abschnitt Deployment) und docs/DECISIONS.md D16/D19.

set -euo pipefail

# ---- Argumente ----
YES=0
TARGET=""
for arg in "$@"; do
  case "$arg" in
    -y|--yes) YES=1 ;;
    -h|--help)
      awk 'NR>2 { if ($0 ~ /^#/) { sub(/^# ?/, ""); print } else exit }' "$0"
      exit 0 ;;
    -*)
      echo "Unbekannte Option: $arg" >&2; exit 2 ;;
    *)
      if [ -n "$TARGET" ]; then echo "Zu viele Argumente." >&2; exit 2; fi
      TARGET="$arg" ;;
  esac
done

if [ -z "$TARGET" ]; then
  echo "Usage: $0 [-y] <rsync-ziel>" >&2
  echo "  z.B. $0 mih00@mih00.hostsharing.net:~/doms/javagil.de/subs-ssl/werkbaum/" >&2
  exit 2
fi

# ---- Repo-Wurzel (Skript ist unter scripts/) ----
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ---- 1) Prod-Build (ohne Build-Hinweis) ----
if [ ! -d frontend/node_modules ]; then
  echo "==> node_modules fehlt — npm ci"
  npm ci --prefix frontend
fi
echo "==> npm run build:prod"
npm run build:prod --prefix frontend

# ---- 2) Staging zusammenstellen (wie der Pages-Workflow, aber lokal) ----
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

# Footer-Version: Major.Minor aus VERSION, Micro = Commits seit dem letzten
# VERSION-Bump; Versionslink zeigt auf den exakt deployten Commit. Best effort —
# ohne Git bleibt der Quelltext-Platzhalter stehen.
SED_ARGS=(-e 's#\.\./LICENSE#LICENSE#g')
if git -C "$ROOT" rev-parse HEAD >/dev/null 2>&1; then
  if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
    echo "   ! Arbeitsbaum ist nicht sauber — der Versions-Commit-Link zeigt auf HEAD," >&2
    echo "     der deployte Inhalt kann davon abweichen." >&2
  fi
  MAJORMINOR="$(tr -d '[:space:]' < VERSION)"
  BASE="$(git -C "$ROOT" log -1 --format=%H -- VERSION || true)"
  [ -z "$BASE" ] && BASE="$(git -C "$ROOT" rev-list --max-parents=0 HEAD | tail -1)"
  MICRO="$(git -C "$ROOT" rev-list --count "${BASE}..HEAD")"
  BUILD_VERSION="${MAJORMINOR}.${MICRO}"
  COMMIT_URL="https://github.com/mhoennig/werkbaum/commit/$(git -C "$ROOT" rev-parse HEAD)"
  echo "==> Footer-Version ${BUILD_VERSION} -> ${COMMIT_URL}"
  SED_ARGS+=(-e "s#\(<a class=\"ver\" href=\"\)[^\"]*#\1${COMMIT_URL}#")
  SED_ARGS+=(-e "s#\(<a class=\"ver\"[^>]*>\)[0-9.]\+</a>#\1${BUILD_VERSION}</a>#")
else
  echo "   ! kein Git-Repo — Footer behält den Versions-Platzhalter" >&2
fi

sed "${SED_ARGS[@]}" frontend/dist/index.html > "$STAGE/index.html"
cp LICENSE "$STAGE/LICENSE"

# ---- 3) Spiegeln (--delete: nichts Altes bleibt am Ziel) ----
# --chmod=D755,F644 erzwingt web-taugliche Rechte am Ziel, unabhängig von den
# lokalen Rechten: `mktemp -d` legt $STAGE mit 0700 an, und `rsync -a` würde
# diesen Modus sonst auf das Ziel-Verzeichnis übertragen — dann kann der
# Webserver es nicht betreten (Apache 403 „unable to read htaccess file“).
RSYNC_OPTS=(-avz --delete --chmod=D755,F644)
if [ "$YES" -ne 1 ]; then
  echo "==> Vorschau (rsync --dry-run --delete) nach ${TARGET}:"
  rsync "${RSYNC_OPTS[@]}" --dry-run "$STAGE"/ "$TARGET"
  printf '==> Wirklich spiegeln? --delete löscht am Ziel alles Fremde. [y/N] '
  read -r ANS
  case "$ANS" in
    y|Y|j|J) : ;;
    *) echo "Abgebrochen."; exit 1 ;;
  esac
fi

echo "==> rsync -> ${TARGET}"
rsync "${RSYNC_OPTS[@]}" "$STAGE"/ "$TARGET"
echo "==> Fertig."
