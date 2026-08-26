#!/usr/bin/env bash
#
# Werkbaum — JDK 21 ins Home der Zielumgebung legen (D77).
#
# Auf dem gemessenen Zielserver ist nur Java 17 installiert, das Backend
# verlangt 21 (build.gradle.kts, Toolchain). Statt die Toolchain zu senken
# kommt ein eigenes JDK ins Home: Entwicklung und Produktion laufen dann auf
# derselben Version, und es braucht kein root — `Linger=yes` erlaubt den
# dauerhaften Dienst ohnehin (D76-Nachtrag 1/2).
#
# Verwendung:
#   scripts/install-jdk.sh [ssh-ziel] [--force]
#
#   ssh-ziel   z. B. mih00@mih00.hostsharing.net; ohne Angabe wird
#              BACKEND_SSH aus .env genommen (Vorlage: .env.example).
#   --force    auch dann installieren, wenn dort schon ein JDK 21 liegt.
#
# Das Archiv wird auf dem Server geholt und **gegen die Prüfsumme der
# Adoptium-API geprüft**, bevor irgendetwas ausgepackt wird. Ohne diese Prüfung
# wäre es „lade ein Archiv aus dem Netz und führe es aus"; mit ihr ist es eine
# nachvollziehbare Installation.
#
# Siehe docs/DECISIONS.md D77.

set -euo pipefail

FORCE=0
SSH_TARGET=""
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -h|--help)
      awk 'NR>2 { if ($0 ~ /^#/) { sub(/^# ?/, ""); print } else exit }' "$0"
      exit 0 ;;
    -*) echo "Unbekannte Option: $arg" >&2; exit 2 ;;
    *)
      if [ -n "$SSH_TARGET" ]; then echo "Zu viele Argumente." >&2; exit 2; fi
      SSH_TARGET="$arg" ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=/dev/null
. "$ROOT/scripts/lib-env.sh"

[ -n "$SSH_TARGET" ] || SSH_TARGET="$(env_value BACKEND_SSH)"
if [ -z "$SSH_TARGET" ]; then
  echo "Usage: $0 <ssh-ziel>   (oder BACKEND_SSH in .env)" >&2
  exit 2
fi

JDK_DIR="$(env_value BACKEND_JDK_DIR)"; JDK_DIR="${JDK_DIR:-opt/jdk21}"
# Relativ zum Home des Servers, sofern nicht absolut angegeben.
case "$JDK_DIR" in /*) : ;; *) JDK_DIR="\$HOME/$JDK_DIR" ;; esac

echo "==> JDK 21 nach ${SSH_TARGET}:${JDK_DIR}"

# Alles Weitere läuft auf dem Server. Bewusst als ein einziges Skript über
# stdin: So ist der Ablauf hier vollständig nachlesbar, statt sich über ein
# Dutzend ssh-Aufrufe zu verteilen.
ssh "$SSH_TARGET" FORCE="$FORCE" JDK_DIR="$JDK_DIR" 'bash -s' <<'REMOTE'
set -euo pipefail
JDK_DIR="$(eval echo "$JDK_DIR")"

if [ -x "$JDK_DIR/bin/java" ] && [ "$FORCE" != "1" ]; then
  echo "    schon da: $("$JDK_DIR/bin/java" -version 2>&1 | head -1)"
  echo "    (--force überschreibt)"
  exit 0
fi

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) A=x64 ;;
  aarch64) A=aarch64 ;;
  *) echo "Unbekannte Architektur: $ARCH" >&2; exit 1 ;;
esac

API="https://api.adoptium.net/v3/assets/latest/21/hotspot?os=linux&architecture=${A}&image_type=jdk"
echo "    frage Adoptium nach dem aktuellen JDK 21 ($A) ..."
META="$(curl -fsSL "$API")"

# Ohne jq auskommen: Der Server ist ein Managed Webspace, dort ist wenig
# installiert. Python3 ist da (mit ihm laufen auch die Hoster-Werkzeuge).
read -r URL SUM NAME <<EOF
$(printf '%s' "$META" | python3 -c '
import json,sys
a = json.load(sys.stdin)
if not a: sys.exit("Adoptium liefert kein Release fuer diese Plattform")
p = a[0]["binary"]["package"]
print(p["link"], p["checksum"], p["name"])
')
EOF

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "    lade $NAME"
curl -fsSL -o "$TMP/jdk.tar.gz" "$URL"

echo "    prüfe Prüfsumme"
echo "${SUM}  ${TMP}/jdk.tar.gz" | sha256sum -c - >/dev/null || {
  echo "PRÜFSUMME PASST NICHT — nichts installiert." >&2; exit 1; }

echo "    packe aus"
rm -rf "$TMP/x" && mkdir "$TMP/x"
tar -xzf "$TMP/jdk.tar.gz" -C "$TMP/x" --strip-components=1

mkdir -p "$(dirname "$JDK_DIR")"
rm -rf "$JDK_DIR.neu"
mv "$TMP/x" "$JDK_DIR.neu"
# Erst tauschen, wenn alles heil ist: Ein abgebrochener Download darf kein
# halbes JDK hinterlassen, das der Dienst beim Neustart vorfindet.
rm -rf "$JDK_DIR.alt"
[ -d "$JDK_DIR" ] && mv "$JDK_DIR" "$JDK_DIR.alt"
mv "$JDK_DIR.neu" "$JDK_DIR"
rm -rf "$JDK_DIR.alt"

echo "    fertig: $("$JDK_DIR/bin/java" -version 2>&1 | head -1)"
REMOTE

echo "==> Fertig."
