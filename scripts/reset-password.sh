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

# Ein Zeilenumbruch im Passwort ginge unten beim `read` verloren — lieber hier
# ablehnen als dort still abschneiden.
# `$'\n'` und nicht `"$(printf '\n')"`: Die Kommandosubstitution schneidet
# Zeilenumbrüche am Ende ab, das Muster wäre also leer — und `*""*` passt auf
# jede Zeichenkette. Die erste Fassung lehnte damit jedes Passwort ab.
if [[ "$PASSWORT" == *$'\n'* ]]; then
  echo "Zeilenumbruch im Passwort — nicht unterstützt." >&2
  exit 1
fi

# Der Fernteil als Text, NICHT als Heredoc am ssh-Aufruf. Der Grund ist eine
# Falle, die lautlos zuschlägt: Kommt das Skript über stdin (`bash -s` mit
# Heredoc), dann frisst ein `cat`/`read` DARIN den Rest des eigenen Skripts.
# Die erste Fassung endete so nach drei Zeilen — ohne etwas zu schreiben und
# ohne Fehlermeldung.
#
# Deshalb geht beides über **einen** Strom: erst die Passwortzeile, dann das
# Skript. Die äußere Kommandozeile liest die erste Zeile weg und reicht sie
# als Umgebungsvariable weiter; `bash -s` bekommt den Rest als Skript.
# Das Passwort steht damit nie in `argv` (das liest auf einem geteilten Host
# jeder); in der Umgebung des kurzlebigen Prozesses steht es — dort kommt nur
# derselbe Benutzer heran, und `htpasswd` bekommt es über eine Pipe.
FERN=$(cat <<'REMOTE'
set -euo pipefail
DIR="$(eval echo "$DIR")"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

[ -n "${WERKBAUM_PW:-}" ] || { echo "Kein Passwort angekommen." >&2; exit 1; }
command -v htpasswd >/dev/null || {
  echo "htpasswd fehlt auf dem Server (Paket apache2-utils)." >&2; exit 1; }

HASH="$(printf '%s' "$WERKBAUM_PW" | htpasswd -niBC 12 '' | tr -d ':\n')"
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

# Gegenprobe, bevor sich jemand wundert: Passen Hash und Passwort zueinander?
CHK="$(mktemp)"
trap 'rm -f "$CHK"' EXIT
printf 'werkbaum:%s\n' "$HASH" > "$CHK"
if printf '%s' "$WERKBAUM_PW" | htpasswd -vi "$CHK" werkbaum >/dev/null 2>&1; then
  echo "    Gegenprobe: Hash und Passwort passen zueinander."
else
  echo "    ! Gegenprobe FEHLGESCHLAGEN — der Hash passt nicht zum Passwort." >&2
  exit 1
fi

if [ "$RESTART" = "1" ]; then
  if systemctl --user is-enabled werkbaum-backend.service >/dev/null 2>&1; then
    systemctl --user restart werkbaum-backend.service
    echo "    Dienst neu gestartet."
  else
    echo "    ! Dienst noch nicht eingerichtet — scripts/deploy-backend.sh ausführen."
  fi
fi
REMOTE
)

echo "==> hashen und speichern"
{ printf '%s\n' "$PASSWORT"; printf '%s\n' "$FERN"; } \
  | ssh "$SSH_TARGET" "DIR='$DIR_SH'; RESTART='$RESTART'; \
      IFS= read -r WERKBAUM_PW; export WERKBAUM_PW DIR RESTART; bash -s"
# Semikolons, keine Zuweisungen als Kommando-Präfix: `DIR=… read …` setzt DIR
# nur für das `read` und danach ist es wieder weg — das `export` exportierte
# eine leere Variable, und der Fernteil brach mit „unbound variable" ab.

unset PASSWORT PASSWORT2

# Die oeffentliche Adresse steht nicht in der Backend-Konfiguration, wohl aber
# im rsync-Ziel des Frontends (`.../doms/<domain>/htdocs-ssl`). Wenn sie sich
# daraus ablesen laesst, wird aus dem Hinweis ein Befehl zum Kopieren.
BASIS="$(env_value DEPLOY_TARGET | sed -n 's|.*/doms/\([^/]*\)/.*|https://\1|p')"
BASIS="${BASIS:-https://<deine-adresse>}"

echo "==> Fertig. So probierst du es aus:"
echo
echo "      curl -su werkbaum ${BASIS}/api/v1/documents"
echo
echo "    curl fragt dann nach dem Passwort. Erwartet wird [] - eine leere Liste."
echo
echo "    Schreib das Passwort nicht mit in den Befehl: Die Shell kann es"
echo "    veraendern, bevor curl es sieht (aus ge\$heim wird ge), und du"
echo "    bekommst ein 401, obwohl alles richtig gesetzt ist."
