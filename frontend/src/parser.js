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
  '-': {key:'verworfen', name:'verworfen'}
};

/* Parst den Notationstext zu { roots, warnings }.
   Jeder Knoten: {label, type:'and'|'or', status, url, size, tags, children, line}.
   Extraktionsreihenfolge (SPEC §1): Kommentar -> Zeichen/Status -> URL -> Größe
   -> Tags -> Label. Hierarchie über Einrückungsbreite (Tab = 2 Leerzeichen);
   Elternknoten ist die nächste vorangehende Zeile mit kleinerer Breite. */
export function parse(text){
  const virtualRoot = {label:'', type:'and', children:[]};
  const stack = [{node:virtualRoot, width:-1}];
  const warnings = [];

  text.split('\n').forEach((raw, i) => {
    raw = raw.replace(/%%.*$/, '');   /* %%-Kommentare entfernen (Mermaid-Konvention) */
    if(!raw.trim()) return;
    /* Statusbox tolerant erfassen: irgendein einzelnes Zeichen in [ ] an der
       Statusposition. Gültige Codes -> Status; unbekannte -> Warnung + neutral
       (fehlertolerant: die Zeile geht nicht verloren). */
    const m = raw.match(/^([ \t]*)([-|])?\s*(?:\[([^\]])\]\s*)?(.*)$/);
    const width = m[1].replace(/\t/g,'  ').length;
    const type  = m[2] === '|' ? 'or' : 'and';
    const boxChar = m[3];   // undefined, wenn keine Statusbox

    let rest = m[4], url = null, size = null;
    const tags = [];
    rest = rest.replace(/https?:\/\/\S+/i, s => { url = s; return ''; });
    rest = rest.replace(/\((XXL|XS|XL|S|M|L)\)/i, (s, g) => { size = g.toUpperCase(); return ''; });
    rest = rest.replace(/@([\p{L}\p{N}._-]+)/gu, (s, g) => { tags.push(g); return ''; });
    const label = rest.replace(/\s+/g, ' ').trim();
    if(!label) return;

    let status = null;
    if(boxChar != null){
      status = STATUS_BY_CODE[boxChar.toLowerCase()] || null;
      if(!status) warnings.push({type:'unknownStatus', line:i+1, code:boxChar});
    }

    while(stack.length > 1 && stack[stack.length-1].width >= width) stack.pop();
    const parent = stack[stack.length-1].node;

    const node = {label, type, status, url, size, tags, children:[], line:i+1};
    parent.children.push(node);
    stack.push({node, width});
  });

  return {roots: virtualRoot.children, warnings};
}
