#!/usr/bin/env bash
#
# Werkbaum — Backend auf die stabile Instanz bringen (D77).
#
# Baut das Fat-Jar, legt es neben ein systemd-User-Unit ins Home des Servers
# und startet den Dienst neu. Der Dienst lauscht nur auf 127.0.0.1; von außen
# kommt man über die Proxy-Regel in `scripts/prod.htaccess`, die
# `scripts/deploy-prod.sh` mitspiegelt (D76-Nachtrag 2).
#
# Verwendung:
#   scripts/deploy-backend.sh [-y] [--no-build] [--no-restart] [--unit-only] [ssh-ziel]
#
#   -y            ohne Rückfrage spiegeln und neu starten
#   --no-build    vorhandenes Jar nehmen (z. B. Wiederholung eines Deploys)
#   --no-restart  nur hochladen, Dienst nicht anfassen
#   --unit-only   nur die systemd-Unit aus der Vorlage neu schreiben und laden;
#                 kein Bauen, kein Jar. Für den Fall, dass sich Port, Speicher
#                 oder die Vorlage selbst geändert haben. Die Platzhalter kennt
#                 damit weiterhin genau eine Stelle — dieses Skript.
#
# Konfiguration aus der git-ignorierten `.env` (Vorlage: .env.example):
#   BACKEND_SSH       user@host — Pflicht (oder als Argument)
#   BACKEND_DIR       Zielverzeichnis, Vorgabe opt/werkbaum — relativ zum Home
#                     des Servers (oder absolut, wenn es mit / beginnt)
#   BACKEND_JDK_DIR   JDK, Vorgabe opt/jdk21 (scripts/install-jdk.sh legt es an)
#   BACKEND_PORT      Vorgabe 9080 — dieselbe Zahl setzt deploy-prod.sh in die
#                     .htaccess ein; sie ist die eine Vereinbarung zwischen
#                     Apache und Dienst
#   BACKEND_XMX       Vorgabe 192m — gemessen leben nach einem GC ~45 MB;
#                     siehe die Messreihe in der Unit-Vorlage
#
# Das Master-Passwort steht NICHT hier und nicht im Repository. Es gehört in
# `<BACKEND_DIR>/env` auf dem Server (Modus 600); dieses Skript legt die Datei
# beim ersten Mal mit leerem Hash an und sagt, was zu tun ist. Ohne Hash bleibt
# die Dokumentenliste gesperrt — das ist Absicht (D76-Nachtrag 6).
#
# Siehe docs/DECISIONS.md D77 und backend/README.md.

set -euo pipefail

YES=0
BUILD=1
RESTART=1
UNIT_ONLY=0
SSH_TARGET=""
for arg in "$@"; do
  case "$arg" in
    -y|--yes) YES=1 ;;
    --no-build) BUILD=0 ;;
    --no-restart) RESTART=0 ;;
    --unit-only) UNIT_ONLY=1; BUILD=0 ;;
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
cd "$ROOT"
# shellcheck source=/dev/null
. "$ROOT/scripts/lib-env.sh"

[ -n "$SSH_TARGET" ] || SSH_TARGET="$(env_value BACKEND_SSH)"
if [ -z "$SSH_TARGET" ]; then
  echo "Usage: $0 [-y] <ssh-ziel>   (oder BACKEND_SSH in .env)" >&2
  exit 2
fi

DIR="$(env_value BACKEND_DIR)";         DIR="${DIR:-opt/werkbaum}"
JDK_DIR="$(env_value BACKEND_JDK_DIR)"; JDK_DIR="${JDK_DIR:-opt/jdk21}"
PORT="$(env_value BACKEND_PORT)";       PORT="${PORT:-9080}"
XMX="$(env_value BACKEND_XMX)";         XMX="${XMX:-192m}"

# Derselbe Pfad in DREI Schreibweisen, weil ihn drei Werkzeuge lesen:
#
#   systemd  kennt `%h` und expandiert **keine** Shell-Variablen
#   die Shell kennt `$HOME` (in einem ssh-Aufruf läuft eine)
#   rsync    kennt `~`, aber **kein** `$HOME`: Seit 3.2.4 ist
#            `--protect-args` voreingestellt, der entfernte Pfad geht also
#            nicht mehr durch eine Shell. Ein `$HOME` bliebe wörtlich stehen —
#            gemessen: „change_dir /home/pacs/mih00/\$HOME/opt/werkbaum failed".
case "$DIR" in
  /*) DIR_UNIT="$DIR";    DIR_SH="$DIR";        DIR_RSYNC="$DIR" ;;
  *)  DIR_UNIT="%h/$DIR"; DIR_SH="\$HOME/$DIR"; DIR_RSYNC="~/$DIR" ;;
esac
case "$JDK_DIR" in
  /*) JAVA_UNIT="$JDK_DIR/bin/java" ;;
  *)  JAVA_UNIT="%h/$JDK_DIR/bin/java" ;;
esac

echo "==> Ziel ${SSH_TARGET}:~/${DIR#/}, Port ${PORT}, -Xmx${XMX}"

# ---- 1) Bauen ----
JAR=""
if [ "$UNIT_ONLY" -eq 1 ]; then
  echo "==> Nur die Unit (--unit-only)"
else
  if [ "$BUILD" -eq 1 ]; then
    echo "==> ./gradlew bootJar (mit Tests)"
    (cd backend && ./gradlew --quiet check bootJar)
  else
    echo "==> Build übersprungen (--no-build)"
  fi
  JAR="$(ls -1t backend/build/libs/*.jar 2>/dev/null | grep -v -- '-plain\.jar$' | head -1 || true)"
  if [ -z "$JAR" ]; then
    echo "Kein Fat-Jar in backend/build/libs — ohne --no-build versuchen." >&2
    exit 1
  fi
  echo "    ${JAR} ($(du -h "$JAR" | cut -f1))"
fi

# ---- 2) Unit-Datei aus der Vorlage ----
# Die Platzhalter werden hier ersetzt, nicht auf dem Server: So steht im
# Repository die Vorlage und am Ziel genau eine fertige Datei — nichts, was
# beide Seiten unterschiedlich interpretieren könnten.
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
sed -e "s#__JAVA__#${JAVA_UNIT}#g" \
    -e "s#__DIR__#${DIR_UNIT}#g" \
    -e "s#__XMX__#${XMX}#g" \
    -e "s#__PORT__#${PORT}#g" \
    scripts/werkbaum-backend.service > "$STAGE/werkbaum-backend.service"
[ "$UNIT_ONLY" -eq 1 ] || cp "$JAR" "$STAGE/werkbaum-backend.jar"

if [ "$YES" -ne 1 ]; then
  echo "==> Es werden übertragen:"
  [ "$UNIT_ONLY" -eq 1 ] || echo "    werkbaum-backend.jar  -> ${DIR}/"
  echo "    werkbaum-backend.service -> ~/.config/systemd/user/"
  [ "$RESTART" -eq 1 ] && echo "    und der Dienst neu gestartet."
  printf '==> Weiter? [y/N] '
  read -r ANS
  case "$ANS" in y|Y|j|J) : ;; *) echo "Abgebrochen."; exit 1 ;; esac
fi

# ---- 3) Übertragen und einrichten ----
# Bewusst OHNE --delete: Im Zielverzeichnis liegen die Datenbank (`data/`), das
# Log und die Datei mit dem Master-Passwort. Ein Deploy tauscht das Jar, er
# räumt nicht auf.
echo "==> Übertragen"
ssh "$SSH_TARGET" "mkdir -p \"$DIR_SH\" \"\$HOME/.config/systemd/user\""
[ "$UNIT_ONLY" -eq 1 ] || \
  rsync -az --chmod=F644 "$STAGE/werkbaum-backend.jar" "$SSH_TARGET:$DIR_RSYNC/werkbaum-backend.jar"
rsync -az --chmod=F644 "$STAGE/werkbaum-backend.service" \
      "$SSH_TARGET:~/.config/systemd/user/werkbaum-backend.service"

ssh "$SSH_TARGET" DIR="$DIR_SH" PORT="$PORT" RESTART="$RESTART" 'bash -s' <<'REMOTE'
set -euo pipefail
DIR="$(eval echo "$DIR")"

# Ohne XDG_RUNTIME_DIR findet `systemctl --user` seinen Manager nicht — über
# eine nicht-interaktive SSH-Sitzung ist die Variable oft nicht gesetzt. Das
# ist die klassische Falle bei User-Units aus einem Skript heraus.
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

# Umgebungsdatei: beim ersten Mal anlegen, danach nie anfassen — dort steht das
# Master-Passwort, und ein Deploy darf es weder überschreiben noch lesen.
if [ ! -f "$DIR/env" ]; then
  cat > "$DIR/env" <<'ENV'
# Werkbaum-Backend — Umgebung des Dienstes. Modus 600, nie im Repository.
#
# Hash MIT Verfahrens-Praefix. Erzeugen - INTERAKTIV, damit das Passwort weder
# in der Shell-History landet noch von der Shell veraendert wird:
#
#   umask 077
#   printf 'WERKBAUM_MASTER_PASSWORD_HASH={bcrypt}%s\n' \
#     "$(htpasswd -nBC 12 '' | tr -d ':\n')" > ~/opt/werkbaum/env
#
# Pruefen, ob Hash und Passwort zueinander passen:
#   printf 'werkbaum:%s\n' "$(sed 's/^[^=]*={bcrypt}//' ~/opt/werkbaum/env)" > /tmp/chk
#   htpasswd -v /tmp/chk werkbaum; rm -f /tmp/chk
#
# Solange der Hash leer ist, bleibt GET /api/v1/documents gesperrt
# (D76-Nachtrag 6).
WERKBAUM_MASTER_PASSWORD_HASH=
ENV
  chmod 600 "$DIR/env"
  echo "    ! $DIR/env angelegt — Master-Passwort-Hash dort eintragen,"
  echo "      sonst bleibt die Dokumentenliste gesperrt."
fi
chmod 600 "$DIR/env"

if ! loginctl show-user "$(id -un)" -p Linger 2>/dev/null | grep -q 'Linger=yes'; then
  echo "    ! Linger ist nicht gesetzt — der Dienst endet mit der Sitzung."
  echo "      Abhilfe: loginctl enable-linger $(id -un)"
fi

systemctl --user daemon-reload
if [ "$RESTART" = "1" ]; then
  systemctl --user enable --now werkbaum-backend.service >/dev/null 2>&1 || true
  systemctl --user restart werkbaum-backend.service
  echo "    Dienst neu gestartet."
else
  echo "    Dienst nicht angefasst (--no-restart)."
fi
REMOTE

# ---- 4) Nachsehen, ob er wirklich antwortet ----
if [ "$RESTART" -eq 1 ]; then
  echo "==> Warten, bis der Dienst antwortet"
  # `GET /api/v1/info` — offen, ohne Nebenwirkung, und sagt zugleich, welcher
  # Stand läuft. Vorher stand hier eine Anfrage nach einem nicht existierenden
  # Dokument mit der Erwartung 404; ein erwarteter **Fehler** ist eine schlechte
  # Zusicherung, weil ihn auch ein falsch konfigurierter Proxy liefert.
  PROBE="http://127.0.0.1:${PORT}/api/v1/info"
  if ssh "$SSH_TARGET" "for i in \$(seq 1 45); do
        body=\$(curl -s --max-time 3 '$PROBE' || true)
        case \"\$body\" in
          *'\"version\"'*) echo \"    oben nach \${i}s: \$body\"; exit 0 ;;
        esac
        sleep 1
      done
      echo '    ! antwortet nicht.'; exit 1"; then
    :
  else
    # Nicht `tail`: Am Ende eines Stacktrace steht die Rahmenliste, also
    # gerade das, was nichts erklärt. Gezeigt wird der **letzte Startversuch**
    # und daraus die Ursachenkette — die tiefste Zeile ist die Antwort.
    echo "==> Warum er nicht startet (letzter Versuch):" >&2
    ssh "$SSH_TARGET" "
      log=\"$DIR_SH/backend.log\"
      if [ -r \"\$log\" ]; then
        awk '/Starting EditorBackendApplication/ {n=NR} {z[NR]=\$0}
             END {for(i=n;i<=NR;i++) print z[i]}' \"\$log\" \
          | grep -E 'Caused by|ERROR' | cut -c1-200
      else
        export XDG_RUNTIME_DIR=\${XDG_RUNTIME_DIR:-/run/user/\$(id -u)}
        systemctl --user status werkbaum-backend --no-pager -l | tail -20
      fi" >&2
    echo >&2
    echo "   Steht dort \"Schema \\\"public\\\" not found\" oder \"databasechangelog already" >&2
    echo "   exists\", stammt die Datenbank aus der Zeit mit MODE=PostgreSQL und passt" >&2
    echo "   nicht mehr (D77). Sie muss einmal weg:" >&2
    echo "     ssh $SSH_TARGET 'rm -rf $DIR_SH/data'" >&2
    exit 1
  fi
fi

echo "==> Fertig."
echo "    Log:      ssh $SSH_TARGET tail -f $DIR_SH/backend.log"
echo "    Zustand:  ssh $SSH_TARGET systemctl --user status werkbaum-backend"
