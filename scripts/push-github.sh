#!/usr/bin/env bash
#
# Werkbaum — main nach GitHub spiegeln.
#
# Zuhause des Repos ist seit D95 Gitea (`origin`, https://git.javagil.de/mi/werkbaum);
# GitHub bleibt ein Klon unter `github`. Dieser Lauf schiebt genau EINEN Branch
# dorthin: `main`. Feature-Branches und Tags bleiben in Gitea — was auf GitHub
# steht, ist der veröffentlichte Stand.
#
# Der Klon ist kein Selbstzweck. An ihm hängen zwei Dinge, die nicht umziehen
# können:
#   * der GitHub-Pages-Workflow (`.github/workflows/pages.yml`), also die
#     „latest build"-Instanz mhoennig.github.io/werkbaum;
#   * die Beispiel-Links der READMEs, die per `?sourceUrl=` von
#     raw.githubusercontent.com laden — Gitea sendet auf `raw`-Dateien KEIN
#     `Access-Control-Allow-Origin`, der Browser blockte sie also (D23, D95).
#
# Verwendung:
#   scripts/push-github.sh [-n] [-y]
#
#   -n, --dry-run   nur zeigen, was gepusht würde
#   -y, --yes       ohne Rückfrage pushen
#
# Aufgerufen wird von Hand. `scripts/deploy-prod.sh` spiegelt NICHT selbst — es
# erinnert nur, wenn der deployte Commit noch nicht auf GitHub liegt (D95).
#
# Es wird nie erzwungen: Liegt github/main nicht in der Historie von main,
# bricht der Lauf ab und sagt, was er gefunden hat. Ein Force-Push auf einen
# Klon, den andere geklont haben, ist eine bewusste Handlung und keine Zeile in
# einem Hilfsskript.

set -euo pipefail

DRY=0
YES=0
for arg in "$@"; do
  case "$arg" in
    -n|--dry-run) DRY=1 ;;
    -y|--yes) YES=1 ;;
    -h|--help)
      awk 'NR>2 { if ($0 ~ /^#/) { sub(/^# ?/, ""); print } else exit }' "$0"
      exit 0 ;;
    *) echo "Unbekannte Option: $arg" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REMOTE="${GITHUB_REMOTE:-github}"

git remote get-url "$REMOTE" >/dev/null 2>&1 || {
  echo "Kein Remote '$REMOTE'. Einmalig anlegen:" >&2
  echo "  git remote add $REMOTE git@github.com:mhoennig/werkbaum.git" >&2
  exit 2
}

echo "==> Hole $REMOTE"
git fetch --quiet "$REMOTE" || {
  echo "Konnte $REMOTE nicht holen." >&2; exit 1
}

LOCAL="$(git rev-parse main)"
REMOTE_SHA="$(git rev-parse "$REMOTE/main" 2>/dev/null || echo "")"

if [ "$LOCAL" = "$REMOTE_SHA" ]; then
  echo "==> $REMOTE/main ist bereits auf $(git rev-parse --short main) — nichts zu tun."
  exit 0
fi

# Nur vorwärts. Ist der Fernstand kein Vorfahr, hat dort jemand etwas liegen,
# das ein Push wegwürfe — dann lieber abbrechen als überschreiben.
if [ -n "$REMOTE_SHA" ] && ! git merge-base --is-ancestor "$REMOTE_SHA" "$LOCAL"; then
  echo "ABBRUCH: $REMOTE/main ($(git rev-parse --short "$REMOTE/main")) liegt nicht in der" >&2
  echo "Historie von main ($(git rev-parse --short main)) — ein Push würde dort Commits" >&2
  echo "verlieren. Erst ansehen:" >&2
  echo "  git log --oneline main..$REMOTE/main" >&2
  exit 1
fi

if [ -n "$REMOTE_SHA" ]; then RANGE="$REMOTE_SHA..main"; else RANGE="main"; fi
echo "==> $(git rev-list --count "$RANGE") Commit(s) nach $REMOTE/main zu spiegeln:"
git --no-pager log --oneline "$RANGE" | head -20

if [ "$DRY" = "1" ]; then
  echo "==> --dry-run: nichts gepusht."
  exit 0
fi

if [ "$YES" != "1" ]; then
  read -r -p "main nach $REMOTE pushen? [j/N] " a
  case "$a" in j|J|y|Y) ;; *) echo "Abgebrochen."; exit 0 ;; esac
fi

git push "$REMOTE" main:main
echo "==> main auf $REMOTE ist jetzt $(git rev-parse --short main)."
echo "    Der Pages-Workflow baut daraufhin von selbst."
