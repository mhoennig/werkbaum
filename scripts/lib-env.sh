# Werkbaum — Werte aus der git-ignorierten .env lesen (von den Deploy-Skripten
# eingebunden, nicht selbst ausführbar).
#
# Bewusst NICHT via `source`: bash würde bei `host:~/pfad` das `~` nach dem `:`
# LOKAL expandieren, und das Ziel zeigte danach auf das eigene Home. Stattdessen
# roh auslesen (letzte Definition gewinnt), umgebende Anführungszeichen und
# nachlaufenden Leerraum abstreifen — das `~` bleibt so für die Remote-Seite
# erhalten.
#
# Zwei Skripte lasen das früher je selbst; eine Kopie dieser Feinheit ist eine
# Kopie zu viel.

ENV_FILE="${ENV_FILE:-$ROOT/.env}"

env_value(){
  local name="$1" value=""
  [ -f "$ENV_FILE" ] || { printf '%s' ""; return 0; }
  value="$(sed -n -E "s/^[[:space:]]*${name}[[:space:]]*=[[:space:]]*//p" "$ENV_FILE" \
           | tail -1 | sed -E 's/[[:space:]]+$//')"
  value="${value#\"}"; value="${value%\"}"
  value="${value#\'}"; value="${value%\'}"
  printf '%s' "$value"
}
