#!/usr/bin/env bash
#
# Werkbaum — Master-Passwort der Dokumentenliste setzen (D77).
#
# Fragt das Passwort **verdeckt ab** und hasht es auf dem Server. Bewusst so
# und nicht `htpasswd -b … PASSWORT`: Ein Passwort auf der Kommandozeile landet
# in der Shell-History, und schlimmer — die Shell fasst es vorher an. `ge$heim`
# wird zu `ge`, `ge heim` zu `geheim`. Gehasht wird dann etwas anderes als das,
# was man später eintippt, und der Server antwortet mit 401, obwohl alles
# richtig aussieht (genau so passiert, D76-Nachtrag 6).
#
# Verwendung:
#   scripts/reset-password.sh [ssh-ziel] [--no-restart]
#
#   ssh-ziel      ohne Angabe BACKEND_SSH aus .env (Vorlage: .env.example)
#   --no-restart  Hash schreiben, Dienst nicht neu starten
#
# Das Passwort verlässt diesen Rechner nur über die SSH-Verbindung und wird
# **nur als Hash** gespeichert (`<BACKEND_DIR>/env`, Modus 600). Danach prüft
# das Skript selbst, ob Hash und Passwort zueinander passen — der Fehler oben
# sieht sonst aus wie ein Konfigurationsfehler.
#
# Siehe docs/DECISIONS.md D77 und backend/README.md.

set -euo pipefail

SSH_TARGET=""
RESTART=1
for arg in "$@"; do
  case "$arg" in
    --no-restart) RESTART=0 ;;
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
DIR="$(env_value BACKEND_DIR)"; DIR="${DIR:-opt/werkbaum}"
case "$DIR" in /*) DIR_SH="$DIR" ;; *) DIR_SH="\$HOME/$DIR" ;; esac

echo "==> Master-Passwort für ${SSH_TARGET}"
echo "    (die Dokumentenliste; alles andere ist über die Dokument-UUID erreichbar)"

# Verdeckt einlesen, zweimal. `read -s` gibt es in bash überall; auf ein
# Terminal angewiesen ist es nicht, deshalb der Hinweis bei Rohr-Eingabe.
if [ ! -t 0 ]; then
  echo "Kein Terminal — dieses Skript fragt nach und braucht eines." >&2
  exit 2
fi
printf '    Neues Passwort: '
read -rs PASSWORT
printf '\n    Wiederholen:    '
read -rs PASSWORT2
printf '\n'

if [ "$PASSWORT" != "$PASSWORT2" ]; then
  echo "Die beiden Eingaben sind verschieden — nichts geändert." >&2
  exit 1
fi
if [ -z "$PASSWORT" ]; then
  echo "Leeres Passwort — nichts geändert." >&2
  exit 1
fi
if [ "${#PASSWORT}" -lt 8 ]; then
  # Keine Regeln über Sonderzeichen; die Länge ist das, was zählt, und dieses
  # eine Passwort schützt eine Liste, die alle Dokument-Adressen preisgäbe.
  echo "Kürzer als 8 Zeichen — bitte länger wählen." >&2
  exit 1
fi

# Das Passwort geht über **stdin** an den Server, nie als Argument: Argumente
# stehen in der Prozessliste, die auf einem geteilten Host jeder lesen kann.
echo "==> hashen und speichern"
printf '%s' "$PASSWORT" | ssh "$SSH_TARGET" DIR="$DIR_SH" RESTART="$RESTART" 'bash -s' <<'REMOTE'
set -euo pipefail
DIR="$(eval echo "$DIR")"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

PASSWORT="$(cat)"
[ -n "$PASSWORT" ] || { echo "Kein Passwort angekommen." >&2; exit 1; }

command -v htpasswd >/dev/null || {
  echo "htpasswd fehlt auf dem Server (Paket apache2-utils)." >&2; exit 1; }

# htpasswd -i liest das Passwort von stdin - es steht also weder in der
# Prozessliste noch in einer History.
HASH="$(printf '%s' "$PASSWORT" | htpasswd -niBC 12 '' | tr -d ':\n')"
case "$HASH" in
  \$2*) : ;;
  *) echo "htpasswd hat keinen bcrypt-Hash geliefert." >&2; exit 1 ;;
esac

mkdir -p "$DIR"
umask 077
printf 'WERKBAUM_MASTER_PASSWORD_HASH={bcrypt}%s\n' "$HASH" > "$DIR/env.neu"
mv "$DIR/env.neu" "$DIR/env"
chmod 600 "$DIR/env"
echo "    gespeichert in $DIR/env (Modus 600)"

# Gegenprobe, bevor irgendjemand sich wundert: Passen Hash und Passwort?
CHK="$(mktemp)"
trap 'rm -f "$CHK"' EXIT
printf 'werkbaum:%s\n' "$HASH" > "$CHK"
if printf '%s' "$PASSWORT" | htpasswd -vi "$CHK" werkbaum >/dev/null 2>&1; then
  echo "    Gegenprobe: Hash und Passwort passen zueinander."
else
  echo "    ! Gegenprobe FEHLGESCHLAGEN - der Hash passt nicht zum Passwort." >&2
  exit 1
fi

if [ "$RESTART" = "1" ]; then
  if systemctl --user is-enabled werkbaum-backend.service >/dev/null 2>&1; then
    systemctl --user restart werkbaum-backend.service
    echo "    Dienst neu gestartet."
  else
    echo "    ! Dienst noch nicht eingerichtet - scripts/deploy-backend.sh ausführen."
  fi
fi
REMOTE

unset PASSWORT PASSWORT2

echo "==> Fertig. Probe:"
echo "    curl -su werkbaum:<passwort> https://werkbaum.javagil.de/api/v1/documents"
