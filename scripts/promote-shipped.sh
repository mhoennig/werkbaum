#!/usr/bin/env bash
#
# Werkbaum — „fertig" auf „in Produktion" befördern.
#
# Der mitgelieferte Plan docs/examples/example-werkbaum.werkbaum beschreibt
# Werkbaum selbst. SPEC §4 unterscheidet `[x]` fertig (abgeschlossen) von `[^]`
# in Produktion (deployed/live) — und die zweite Aussage kann erst der Deploy
# wahr machen. Konvention deshalb: beim Mergen `[x]`, unmittelbar VOR dem
# Deploy dieser Lauf, der daraus `[^]` macht und das als Commit festhält.
#
# Warum ein Commit und kein Rewrite beim Bauen: siehe docs/DECISIONS.md D30.
# Kurz — der Commit wird von BEIDEN Pipelines gesehen (GitHub Pages baut ihn
# beim Push, prod beim nächsten rsync), das Deployment-Artefakt bleibt
# inhaltsgleich mit dem Repo, und die „Was ist neu?"-Anzeige (D28) bleibt auf
# der Pages-Instanz erlebbar statt dort für immer stumm zu sein.
#
# Verwendung:
#   scripts/promote-shipped.sh [-n] [-y]
#
#   -n, --dry-run   nur zeigen, was befördert würde
#   -y, --yes       ohne Rückfrage befördern und committen
#
# Ohne zu befördernde Knoten endet der Lauf mit 0 und ändert nichts.
# Gepusht wird NICHT — das bleibt eine bewusste Handlung.

set -euo pipefail

DRY=0
YES=0
for arg in "$@"; do
  case "$arg" in
    -n|--dry-run) DRY=1 ;;
    -y|--yes)     YES=1 ;;
    -h|--help)
      awk 'NR>2 { if ($0 ~ /^#/) { sub(/^# ?/, ""); print } else exit }' "$0"
      exit 0 ;;
    *) echo "Unbekannte Option: $arg" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PLAN="docs/examples/example-werkbaum.werkbaum"
[ -f "$PLAN" ] || { echo "Plan nicht gefunden: $PLAN" >&2; exit 1; }

# Nur Statusboxen am Zeilenanfang (nach optionalem Zeichen -/+/|), damit ein
# „[x]" mitten im Label unangetastet bleibt. `x` auch als `X` (SPEC §4).
MATCH='^([[:space:]]*([-+|][[:space:]]*)?)\[[xX]\]'

mapfile -t HITS < <(grep -nE "$MATCH" "$PLAN" || true)

if [ "${#HITS[@]}" -eq 0 ]; then
  echo "==> Nichts zu befördern — kein [x] im Plan."
  exit 0
fi

echo "==> ${#HITS[@]} Knoten würden auf [^] befördert:"
printf '    %s\n' "${HITS[@]}"

[ "$DRY" -eq 1 ] && exit 0

# Der Commit fasst genau diese eine Datei an. Ist sie schon geändert, lässt sich
# die Beförderung nicht sauber von der Änderung trennen — dann lieber abbrechen.
if git rev-parse HEAD >/dev/null 2>&1 && [ -n "$(git status --porcelain -- "$PLAN")" ]; then
  echo "   ! $PLAN hat uncommittete Änderungen — erst committen, dann befördern." >&2
  exit 1
fi

if [ "$YES" -ne 1 ]; then
  printf '==> Befördern und committen? [y/N] '
  read -r ANS
  case "$ANS" in y|Y|j|J) : ;; *) echo "Abgebrochen."; exit 1 ;; esac
fi

# Labels für den Commit-Text sammeln (ohne Zeichen, Statusbox und Größe).
mapfile -t LABELS < <(printf '%s\n' "${HITS[@]}" \
  | sed -E 's/^[0-9]+:[[:space:]]*([-+|][[:space:]]*)?\[[xX]\][[:space:]]*//' \
  | sed -E 's/[[:space:]]*\((XS|S|M|L|XL|XXL)\)[[:space:]]*$//')

sed -i -E "s/$MATCH/\1[^]/" "$PLAN"

if ! git rev-parse HEAD >/dev/null 2>&1; then
  echo "==> Kein Git-Repo — Datei geändert, nicht committet."
  exit 0
fi

{
  echo "docs: Werkbaum-Plan — ${#HITS[@]} Knoten in Produktion"
  echo
  echo "Beim Deploy der stabilen Instanz gehen diese Knoten live; SPEC §4"
  echo "unterscheidet [x] fertig von [^] in Produktion (D30):"
  echo
  printf -- '- %s\n' "${LABELS[@]}"
} | git commit -q -F - -- "$PLAN"

echo "==> Committet: $(git log --oneline -1)"
echo "   Hinweis: nicht gepusht. Ohne Push zeigt der Footer-Versionslink des"
echo "   Deploys auf einen Commit, den GitHub noch nicht kennt."
