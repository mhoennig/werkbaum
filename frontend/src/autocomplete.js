/* ID-Vorschläge beim Tippen von Abhängigkeiten (D63).

   Eine Eingabehilfe wie die ID-Kurzform (D55), keine Notation: Der Parser
   sieht nie etwas davon, SPEC und llms.md bleiben unberührt. Hier steht, WAS
   gilt — wann ein `:#…`-Kontext vorliegt und welche IDs dazu passen; app.js
   verdrahtet nur (Popup, Tasten, Einfügen). Frontend-Hausregel: Was
   entscheidbar ist, gehört in ein Modul (D54-Nachtrag 3). */

const ID_CHARS = '[\\p{L}\\p{N}._-]';

/* Der Abhängigkeits-Kontext an der Schreibmarke: null, oder
   {start, end, fragment, exclude}. `start`..caret ist das angefangene
   ID-Fragment hinter dem letzten `#`; `end` reicht über die Schreibmarke
   hinaus bis ans Ende der ID-Zeichen (wer mitten im Wort ersetzt, soll kein
   `#authth` bekommen). `exclude` sind die IDs, die eine Auswahl nicht mehr
   anbieten soll: die schon gelisteten des Tokens und die eigene ID der Zeile
   (die Selbst-Abhängigkeit ist zulässig, aber nie das, was man tippen will).

   Erkannt wird dieselbe Form, die der Parser liest (SPEC §1): das Token
   alleinstehend angesetzt — `(^|\s):#…` — oder unmittelbar hinter der
   Knoten-ID (`#auth:#db`, D36). `(:#a` bleibt damit Zitat, `Regel: #x`
   bleibt Label. Kein Kontext im Kommentar (hinter `%%`) und nicht im
   Beschreibungsteil hinter `---` — dort ist alles Freitext. */
const TOKEN_RE = new RegExp(
  '(?:^|[ \\t])(?:#(' + ID_CHARS + '+))?:(#' + ID_CHARS + '*(?:,#' + ID_CHARS + '*)*)$', 'u');
const OWN_ID_RE = new RegExp('(?:^|\\s)#(' + ID_CHARS + '+)', 'u');
const TAIL_RE = new RegExp('^' + ID_CHARS + '*', 'u');

export function depFragment(text, caret){
  const before = text.slice(0, caret);
  const lines = before.split('\n');
  const cur = lines[lines.length - 1];
  /* Beschreibungsteil (§1): alles hinter dem ersten `---`-Trenner ist Freitext. */
  for(let i = 0; i < lines.length - 1; i++){
    if(/^\s*-{3,}\s*$/.test(lines[i])) return null;
  }
  if(cur.includes('%%')) return null;   /* die Schreibmarke steht im Kommentar */
  const m = TOKEN_RE.exec(cur);
  if(!m) return null;
  const token = m[2];                              /* "#a,#b…" bis zur Schreibmarke */
  const parts = token.slice(1).split(',#');
  const fragment = parts[parts.length - 1];
  const exclude = parts.slice(0, -1);
  if(m[1]) exclude.push(m[1]);                     /* Kopf-Form `#auth:#…` */
  else {
    /* Eigene ID der Zeile, wenn sie weiter vorn steht (`#auth: … :#…`) —
       erster alleinstehender `#`-Treffer, wie in der Extraktion (Schritt 6).
       Der Zeilenrest vor dem Token genügt: Die IDs im Token selbst sind nie
       alleinstehend (`:`/`,` davor). */
    const own = OWN_ID_RE.exec(cur.slice(0, m.index + 1));
    if(own) exclude.push(own[1]);
  }
  const end = caret + TAIL_RE.exec(text.slice(caret))[0].length;
  return {start: caret - fragment.length, end, fragment, exclude};
}

/* Alle vergebenen IDs in Dokumentreihenfolge, mit Titel als Kontext.
   Bewusst ALLE Knoten — auch verworfene und eingeklappte: Eine Abhängigkeit
   darf überallhin zeigen, und die Faltung ist nur Ansicht (D38). */
export function collectIds(roots){
  const out = [];
  const walk = ns => {
    for(const n of ns){
      if(n.id) out.push({id: n.id, label: n.labelFromId ? '' : n.label});
      walk(n.children);
    }
  };
  walk(roots);
  return out;
}

/* Passende Kandidaten: erst Präfix-Treffer, dann Teilstring-Treffer, je in
   Dokumentreihenfolge; Groß-/Kleinschreibung egal (die IDs selbst bleiben,
   wie sie geschrieben sind). Leeres Fragment (direkt nach `:#`) zeigt alle. */
export function matchIds(ids, fragment, exclude = []){
  const ex = new Set(exclude);
  const pool = ids.filter(c => !ex.has(c.id));
  if(!fragment) return pool;
  const f = fragment.toLowerCase();
  const pre = [], sub = [];
  for(const c of pool){
    const lo = c.id.toLowerCase();
    if(lo.startsWith(f)) pre.push(c);
    else if(lo.includes(f)) sub.push(c);
  }
  return pre.concat(sub);
}
