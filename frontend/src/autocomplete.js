/* ID-Vorschläge beim Tippen von Abhängigkeiten (D63) und der Sprung entlang
   einer Abhängigkeit (Strg+Klick auf `:#ziel`, D67).

   Eingabehilfen wie die ID-Kurzform (D55), keine Notation: Der Parser sieht
   nie etwas davon, SPEC und llms.md bleiben unberührt. Hier steht, WAS
   gilt — wann ein `:#…`-Kontext vorliegt, welche IDs dazu passen und welche
   ID unter der Schreibmarke steht; app.js verdrahtet nur (Popup, Tasten,
   Einfügen, Sprung). Frontend-Hausregel: Was entscheidbar ist, gehört in ein
   Modul (D54-Nachtrag 3). */

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

/* Welche Abhängigkeits-ID steht an dieser Stelle des Textes? (D67, für den
   Sprung per Strg+Klick.) null, oder die ID (ohne `#`), auf der die
   Schreibmarke in einem `:#a,#b`-Token steht. Erkannt wird dieselbe Form wie
   oben (alleinstehend angesetzt oder Kopf-Form `#auth:#db`) — nur vollständig
   statt bis zur Schreibmarke, denn geklickt wird auf fertige Token. Kein
   Treffer im Kommentar, im Beschreibungsteil hinter `---` und in einer URL
   (die Extraktion §1 nimmt die URL zuerst — ein `:#` darin ist keins). */
const URL_RE = /https?:\/\/\S+/i;
const DEP_TOKEN_G = new RegExp(':#' + ID_CHARS + '+(?:,#' + ID_CHARS + '+)*', 'gu');

export function depIdAt(text, caret){
  const sol = text.lastIndexOf('\n', caret - 1) + 1;
  let eol = text.indexOf('\n', caret);
  if(eol === -1) eol = text.length;
  const line = text.slice(sol, eol);
  const col = caret - sol;
  for(const l of text.slice(0, sol).split('\n')){
    if(/^\s*-{3,}\s*$/.test(l)) return null;
  }
  const k = line.indexOf('%%');
  if(k !== -1 && col >= k) return null;
  const head = k === -1 ? line : line.slice(0, k);
  const u = URL_RE.exec(head);
  if(u && col > u.index && col < u.index + u[0].length) return null;
  /* Kopf-Form: unmittelbar hinter der Knoten-ID der Zeile (dem ersten
     alleinstehenden `#`-Token, Extraktion Schritt 6) darf das Token ansetzen. */
  const own = OWN_ID_RE.exec(head);
  const idEnd = own ? own.index + own[0].length : -1;
  DEP_TOKEN_G.lastIndex = 0;
  let m;
  while((m = DEP_TOKEN_G.exec(head))){
    const p = m.index;
    /* Alleinstehend angesetzt — `(:#a,#b)` bleibt damit Zitat (§1/D37). */
    if(p !== idEnd && p > 0 && !/[ \t]/.test(head[p - 1])) continue;
    const end = p + m[0].length;
    if(col < p || col > end) continue;
    let s = p + 1;                              /* hinter dem `:` */
    for(const part of m[0].slice(1).split(',')){
      const e = s + part.length;
      if(col <= e) return part.slice(1);        /* ohne `#` */
      s = e + 1;                                /* hinter dem `,` */
    }
    return null;
  }
  return null;
}

/* Die Zeile, die eine ID vergibt — bei doppelter ID die ERSTE Vergabe, wie
   überall bei der Auflösung (D36/D39). null für unbekannte IDs. */
export function idLine(roots, id){
  for(const n of roots){
    if(n.id === id) return n.line;
    const hit = idLine(n.children, id);
    if(hit) return hit;
  }
  return null;
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
