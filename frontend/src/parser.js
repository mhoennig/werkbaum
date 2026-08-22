/* Werkbaum-Parser — headless, ohne DOM/UI nutzbar.
   Setzt docs/SPEC.md §1–§8 um: Zeilenformat, Hierarchie (Einrückung),
   Zerlegungsart (Gate), Status, Größe, Links, Personen-Tags, Kommentare.
   Verhalten ist normativ gegen SPEC — Änderungen zuerst dort dokumentieren. */

/* T-Shirt-Größen (SPEC §5), aufsteigend geordnet. */
export const SIZE_RANK = { XS: 0, S: 1, M: 2, L: 3, XL: 4, XXL: 5 };

/* Status-Vokabular (SPEC §4): Checkbox-Code -> {key, name}.
   `name` ist der deutsche Anzeigename (Quellsprache). */
export const STATUS_BY_CODE = {
  '?': {key:'idee',       name:'Idee'},
  ' ': {key:'geplant',    name:'geplant'},
  '~': {key:'arbeit',     name:'in Arbeit'},
  '/': {key:'durchstich', name:'Durchstich – funktionsbereit, Feinarbeiten offen'},
  'x': {key:'fertig',     name:'fertig'},
  '^': {key:'prod',       name:'in Produktion'},
  '-': {key:'verworfen', name:'verworfen'},
  '!': {key:'highrisk',   name:'High Risk – Aufwand unklar'}
};

/* Status, die als „realisiert" zählen (XOR-Regel, SPEC §3/D35): Kosten sind
   investiert oder mehr. Absicht (`[?]`, `[ ]`, `[!]`), Ablehnung (`[-]`) und
   neutrale Knoten zählen nicht. */
const REALIZED = new Set(['arbeit', 'durchstich', 'fertig', 'prod']);

/* Parst den Notationstext zu { roots, warnings }.
   Jeder Knoten: {label, type:'and'|'or'|'xor', optional, status, url, size,
   tags, id, deps, focus, children, line}.
   `deps` sind ID-Strings, keine Knoten-Referenzen — aufgelöst wird erst beim
   Konsumenten (D37); der Parser prüft nur die Existenz (`unknownDep`).
   `type` ist das Gate der Geschwistergruppe, `optional` (Zeichen `+`, SPEC §3)
   eine Eigenschaft des einzelnen Knotens: er hängt an derselben Und-Zerlegung
   (`type:'and'`), ist darin aber entbehrlich. Dadurch bleibt die
   Gemischt-Warnung unverändert richtig — sie schlägt an, wenn `|` oder `=`
   mit `-`/`+` (oder untereinander) gemischt wird.
   Extraktionsreihenfolge (SPEC §1): Kommentar -> Zeichen/Status -> URL -> Größe
   -> Tags -> Knoten-ID -> Abhängigkeiten -> Fokusmarke -> Label. Hierarchie
   über Einrückungsbreite (Tab = 2 Leerzeichen);
   Elternknoten ist die nächste vorangehende Zeile mit kleinerer Breite. */
export function parse(text){
  const virtualRoot = {label:'', type:'and', children:[]};
  const stack = [{node:virtualRoot, width:-1}];
  const warnings = [];
  const idLines = new Map();   /* Knoten-ID -> Zeile der ersten Vergabe (D36) */

  text.split('\n').forEach((raw, i) => {
    raw = raw.replace(/%%.*$/, '');   /* %%-Kommentare entfernen (Mermaid-Konvention) */
    if(!raw.trim()) return;
    /* Statusbox tolerant erfassen: irgendein einzelnes Zeichen in [ ] an der
       Statusposition. Gültige Codes -> Status; unbekannte -> Warnung + neutral
       (fehlertolerant: die Zeile geht nicht verloren). */
    /* `=` (XOR, SPEC §3) nur mit folgendem Leerraum — die Leerraum-Regel hält
       Labels wie `=SUMME(A1:B2)` heraus; `-`/`+`/`|` bleiben wie bisher. */
    const m = raw.match(/^([ \t]*)([-|+]|=(?=[ \t]))?\s*(?:\[([^\]])\]\s*)?(.*)$/);
    const width = m[1].replace(/\t/g,'  ').length;
    const type  = m[2] === '|' ? 'or' : m[2] === '=' ? 'xor' : 'and';
    const optional = m[2] === '+';
    const boxChar = m[3];   // undefined, wenn keine Statusbox

    let rest = m[4], url = null, size = null;
    const tags = [];
    rest = rest.replace(/https?:\/\/\S+/i, s => { url = s; return ''; });
    rest = rest.replace(/\((XXL|XS|XL|S|M|L)\)/i, (s, g) => { size = g.toUpperCase(); return ''; });
    rest = rest.replace(/@([\p{L}\p{N}._-]+)/gu, (s, g) => { tags.push(g); return ''; });
    /* Knoten-ID `#name` (SPEC §1, D36): nur ALLEINSTEHEND ANGESETZT — „C#"
       bleibt Label, und das reservierte `:#a,#b` (§11) wird nicht gefressen.
       Nur der ERSTE Treffer (kein /g): weitere `#`-Token bleiben im Label
       stehen, dort wohnt die reservierte Ticket-Referenz. Zeichenmenge wie bei
       `@name`; kein Lookbehind (Safari erst ab 16.4). */
    let id = null;
    rest = rest.replace(/(^|\s)#([\p{L}\p{N}._-]+)/u, (s, pre, g) => { id = g; return pre; });
    /* Abhängigkeiten `:#a,#b` (SPEC §1, D37): EIN zusammenhängendes Token ohne
       Leerraum, nur ALLEINSTEHEND ANGESETZT — eingeklammerte Erwähnungen wie
       `(:#auth,#api)` bleiben damit Label (dieselbe Zitier-Konvention wie bei
       der ID). Mehrere Token je Zeile werden zusammengeführt. */
    const deps = [];
    rest = rest.replace(/(^|\s):#([\p{L}\p{N}._-]+(?:,#[\p{L}\p{N}._-]+)*)/gu,
      (s, pre, list) => { for(const p of list.split(',')) deps.push(p.replace(/^#/, '')); return pre; });
    /* Fokusmarke `!!!` (SPEC §1) — nur ALLEINSTEHEND, damit „Achtung!!!" ein
       gewöhnliches Label bleibt. Kein Lookbehind (Safari kennt es erst ab 16.4):
       der führende Leerraum wird mitgefangen und wieder eingesetzt. */
    let focus = false;
    rest = rest.replace(/(^|\s)!!!(?=\s|$)/g, (s, pre) => { focus = true; return pre; });
    const label = rest.replace(/\s+/g, ' ').trim();
    if(!label) return;

    let status = null;
    if(boxChar != null){
      status = STATUS_BY_CODE[boxChar.toLowerCase()] || null;
      if(!status) warnings.push({type:'unknownStatus', line:i+1, code:boxChar});
    }

    /* Doppelte ID (SPEC §1): Warnung an der späteren Zeile, mit Nennung der
       ersten; die spätere ID gilt trotzdem am Knoten (fehlertolerant). Erst
       hier — eine Zeile ohne Label ist schon zurückgekehrt und belegt nichts. */
    if(id != null){
      if(idLines.has(id)) warnings.push({type:'duplicateId', line:i+1, id, firstLine:idLines.get(id)});
      else idLines.set(id, i+1);
    }

    while(stack.length > 1 && stack[stack.length-1].width >= width) stack.pop();
    const parent = stack[stack.length-1].node;

    const node = {label, type, optional, status, url, size, tags, id, deps, focus, children:[], line:i+1};
    parent.children.push(node);
    stack.push({node, width});
  });

  /* Unbekannte Abhängigkeits-IDs (SPEC §1): erst nach dem Einlesen prüfbar —
     Vorwärts-Referenzen sind normal. Zyklen (auch auf sich selbst) werden
     bewusst NICHT einmal erkannt: Sie sind zulässig und bedeuten „wird
     gemeinsam fertig" (D34/D37) — eine Prüfung hätte keinen Abnehmer. */
  (function checkDeps(nodes){
    for(const n of nodes){
      for(const d of n.deps)
        if(!idLines.has(d)) warnings.push({type:'unknownDep', line:n.line, id:d});
      checkDeps(n.children);
    }
  })(virtualRoot.children);

  /* XOR-Regel (SPEC §3): In einer `=`-Gruppe darf genau EINE Alternative
     realisiert sein. Jede weitere wird einzeln gemeldet — die Warnung zeigt so
     auf die Zeile, die man ansehen muss, statt pauschal auf die Gruppe (D35).
     Gruppen-Gate nach dem ersten Kind, wie in der Darstellung (§3). */
  (function checkXor(node){
    const kids = node.children;
    if(kids.length && kids[0].type === 'xor'){
      let realized = 0;
      for(const k of kids){
        if(k.status && REALIZED.has(k.status.key)){
          realized++;
          if(realized > 1) warnings.push({type:'xorConflict', line:k.line, label:k.label});
        }
      }
    }
    kids.forEach(checkXor);
  })(virtualRoot);

  return {roots: virtualRoot.children, warnings};
}
