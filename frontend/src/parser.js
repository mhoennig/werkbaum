/* Werkbaum-Parser — headless, ohne DOM/UI nutzbar.
   Setzt docs/SPEC.md §1–§8 um: Zeilenformat, Hierarchie (Einrückung),
   Zerlegungsart (Gate), Status, Größe, Links, Personen-Tags, Kommentare.
   Verhalten ist normativ gegen SPEC — Änderungen zuerst dort dokumentieren. */

/* T-Shirt-Größen (SPEC §5), aufsteigend geordnet. */
export const SIZE_RANK = { XS: 0, S: 1, M: 2, L: 3, XL: 4, XXL: 5 };

/* Status-Vokabular (SPEC §4): Checkbox-Code -> {code, key, name}.
   `name` ist der deutsche Anzeigename (Quellsprache); `code` das kanonische
   Box-Zeichen (für die Diskrepanz-Marke des effektiven Status, D39). */
export const STATUS_BY_CODE = {
  '?': {code:'?', key:'idee',       name:'Idee'},
  ' ': {code:' ', key:'geplant',    name:'geplant'},
  '~': {code:'~', key:'arbeit',     name:'in Arbeit'},
  '/': {code:'/', key:'durchstich', name:'Durchstich – funktionsbereit, Feinarbeiten offen'},
  'x': {code:'x', key:'fertig',     name:'fertig'},
  '^': {code:'^', key:'prod',       name:'in Produktion'},
  '-': {code:'-', key:'verworfen',  name:'verworfen'},
  '!': {code:'!', key:'highrisk',   name:'High Risk – Aufwand unklar'}
};

/* Setzt (`'>'`) oder entfernt (`null`) die Faltmarke einer Zeile — die Umkehrung
   der Extraktion aus §1, gebraucht fürs Zurückschreiben aus dem Diagramm
   (D38-Nachtrag). Angefasst wird NUR die Marke samt ihrem Leerraum: Einrückung,
   Zerlegungszeichen, Statusbox und Label bleiben zeichengenau stehen, auch bei
   ungewöhnlicher Spaltung wie `-   [x] X`. Wurzelzeilen (ohne Zeichen) bekommen
   die Marke am Zeilenanfang, wie SPEC §1 es verlangt. */
export function setFoldMark(line, mark){
  const m = line.match(/^([ \t]*(?:[-|+]|=(?=[ \t]))?[ \t]*)((?:[><](?=[ \t])[ \t]*)?)/);
  const head = m[1], alt = m[2];
  return head + (mark ? mark + ' ' : '') + line.slice(head.length + alt.length);
}

/* Status, die als „realisiert" zählen (XOR-Regel, SPEC §3/D35): Kosten sind
   investiert oder mehr. Absicht (`[?]`, `[ ]`, `[!]`), Ablehnung (`[-]`) und
   neutrale Knoten zählen nicht. */
const REALIZED = new Set(['arbeit', 'durchstich', 'fertig', 'prod']);

/* Parst den Notationstext zu { roots, warnings }.
   Jeder Knoten: {label, type:'and'|'or'|'xor', optional, fold, status, url,
   size, tags, id, deps, desc, focus, children, line}.
   `desc` (SPEC §11/D40) ist der Beschreibungstext: `"`-Zeilen unter dem
   Knoten (Kurzform) und ID-Blöcke aus dem `---`-Beschreibungsteil (Langform),
   in Dokumentreihenfolge mit Zeilenumbrüchen zusammengefügt; null ohne.
   `descLines` sind die ZEILENNUMMERN dieser Beschreibung (SPEC §9): Steht der
   Cursor dort, gilt dieser Knoten als ausgewählt.
   `fold` ('>'|'<'|null, SPEC §1/D38) ist nur der ANFANGSZUSTAND der Faltung —
   den wirksamen Zustand rechnet `initialCollapsed()` in model.js.
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
  const idNodes = new Map();   /* Knoten-ID -> Knoten der ersten Vergabe */
  /* Beschreibungen (SPEC §11, D40): gesammelt je Knoten, am Ende zu `desc`
     zusammengefügt. `lastNode` trägt die Kurzform-Zuordnung („vorangehender
     Knoten"), `descTarget` den offenen Block des Beschreibungsteils; SKIP
     schluckt Blocktext unter einer unbekannten ID, ohne je Zeile zu warnen. */
  const descLines = new Map();
  /* Welche ZEILEN zu welchem Knoten gehören (SPEC §9): Steht der Cursor in
     einer Beschreibung, gilt ihr Knoten als ausgewählt — die Zeile trägt
     keinen eigenen Knoten, gehört aber zu einem. Getrennt von `descLines`
     gehalten, weil dort Absatztrenner zusammenfallen und Blocktext unter
     unbekannter ID gar nicht erst ankommt. */
  const descOwner = new Map();
  const SKIP = {};
  let lastNode = null, inDesc = false, descTarget = null;
  const ownLine = (node, i) => {
    if(!node || node === SKIP) return;
    let arr = descOwner.get(node);
    if(!arr) descOwner.set(node, arr = []);
    arr.push(i + 1);
  };
  const addDesc = (node, text) => {
    let arr = descLines.get(node);
    if(!arr) descLines.set(node, arr = []);
    if(text === '' && (!arr.length || arr[arr.length-1] === '')) return;
    arr.push(text);
  };

  text.split('\n').forEach((raw, i) => {
    raw = raw.replace(/%%.*$/, '');   /* %%-Kommentare entfernen (Mermaid-Konvention) */
    /* Trenner `---` (SPEC §11, D40): drei oder mehr Bindestriche, umgebender
       Leerraum erlaubt — ab hier gilt der Beschreibungsteil. Es gibt keinen
       Schlusszaun; weitere Trennzeilen darin haben keine Bedeutung. */
    if(/^[ \t]*-{3,}[ \t]*$/.test(raw)){ inDesc = true; return; }
    if(inDesc){
      if(!raw.trim()){
        if(descTarget && descTarget !== SKIP){
          addDesc(descTarget, '');   /* Absatztrenner */
          ownLine(descTarget, i);    /* die Leerzeile gehört noch zum Block */
        }
        return;
      }
      if(/^[ \t]/.test(raw)){                       /* eingerückt: Blocktext */
        if(descTarget == null){ warnings.push({type:'descStray', line:i+1}); return; }
        if(descTarget !== SKIP){ addDesc(descTarget, raw.trim()); ownLine(descTarget, i); }
        return;
      }
      /* Der trennende Doppelpunkt (siehe Knoten-ID unten) ist auch hier
         zugelassen — ein Block-Kopf hat zwar keinen Titel dahinter, aber wer
         die Schreibweise `#auth:` gewohnt ist, soll nicht darüber stolpern. */
      const idm = raw.match(/^#([\p{L}\p{N}._-]+):?\s*$/u);
      if(!idm){
        /* Uneingerückt, keine ID-Zeile — bei einem versehentlichen Trenner
           mitten im Plan melden sich die verschluckten Knotenzeilen so
           zeilengenau selbst (SPEC §11). */
        warnings.push({type:'descStray', line:i+1});
        descTarget = null;
        return;
      }
      const target = idNodes.get(idm[1]);
      if(!target){ warnings.push({type:'unknownDesc', line:i+1, id:idm[1]}); descTarget = SKIP; }
      else { descTarget = target; ownLine(target, i); }   /* der Block-Kopf nennt den Knoten */
      return;
    }
    if(!raw.trim()) return;
    /* Kurzform `"` (SPEC §11, D40): Beschreibung des VORANGEHENDEN Knotens,
       nur mit folgendem Leerraum (Leerraum-Regel) und nur auf Zeilen ohne
       Zerlegungszeichen — `"Zitat"` und `- " Zitat" …` bleiben Labels.
       Die Einrückung der Zeile hat keine Bedeutung. */
    const ts = raw.replace(/^[ \t]*/, '');
    if(ts[0] === '"' && /[ \t]/.test(ts[1] || '')){
      if(lastNode){ addDesc(lastNode, ts.slice(2).trim()); ownLine(lastNode, i); }
      else warnings.push({type:'descStray', line:i+1});
      return;
    }
    /* Statusbox tolerant erfassen: irgendein einzelnes Zeichen in [ ] an der
       Statusposition. Gültige Codes -> Status; unbekannte -> Warnung + neutral
       (fehlertolerant: die Zeile geht nicht verloren). */
    /* `=` (XOR, SPEC §3) nur mit folgendem Leerraum — die Leerraum-Regel hält
       Labels wie `=SUMME(A1:B2)` heraus; `-`/`+`/`|` bleiben wie bisher.
       Die Faltmarke `>`/`<` (SPEC §1, D38) steht zwischen Zeichen und
       Statusbox (bei Wurzeln am Zeilenanfang), ebenfalls nur mit folgendem
       Leerraum — `- >Achtung` bleibt ein Label. */
    const m = raw.match(/^([ \t]*)([-|+]|=(?=[ \t]))?\s*(?:([><])(?=[ \t])\s*)?(?:\[([^\]])\]\s*)?(.*)$/);
    const width = m[1].replace(/\t/g,'  ').length;
    const type  = m[2] === '|' ? 'or' : m[2] === '=' ? 'xor' : 'and';
    const optional = m[2] === '+';
    const fold = m[3] || null;
    const boxChar = m[4];   // undefined, wenn keine Statusbox

    let rest = m[5], url = null, size = null;
    const tags = [];
    rest = rest.replace(/https?:\/\/\S+/i, s => { url = s; return ''; });
    rest = rest.replace(/\((XXL|XS|XL|S|M|L)\)/i, (s, g) => { size = g.toUpperCase(); return ''; });
    rest = rest.replace(/@([\p{L}\p{N}._-]+)/gu, (s, g) => { tags.push(g); return ''; });
    /* Knoten-ID `#name` (SPEC §1, D36): nur ALLEINSTEHEND ANGESETZT — „C#"
       bleibt Label, und das reservierte `:#a,#b` (§11) wird nicht gefressen.
       Nur der ERSTE Treffer (kein /g): weitere `#`-Token bleiben im Label
       stehen, dort wohnt die reservierte Ticket-Referenz. Zeichenmenge wie bei
       `@name`; kein Lookbehind (Safari erst ab 16.4).
       Übliche Schreibweise ist die ID **vor** dem Titel, abgetrennt durch einen
       Doppelpunkt: `#auth: Backend`. Der Doppelpunkt ist optional, gehört weder
       zur ID noch zum Label und verschwindet hier. Er wird nur geschluckt, wenn
       **Leerraum oder Zeilenende** folgt — sonst bliebe von `#auth:#db` nicht
       die Abhängigkeit `:#db` übrig. Die ID-Erkennung selbst bleibt unberührt
       (die Doppelpunkt-Gruppe ist optional, verlangt also nichts). */
    let id = null;
    rest = rest.replace(/(^|\s)#([\p{L}\p{N}._-]+)(?::(?=\s|$))?/u, (s, pre, g) => { id = g; return pre; });
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

    const node = {label, type, optional, fold, status, url, size, tags, id, deps, desc:null, descLines:null, focus, children:[], line:i+1};
    parent.children.push(node);
    stack.push({node, width});
    lastNode = node;
    if(id != null && !idNodes.has(id)) idNodes.set(id, node);
  });

  /* Beschreibungen zusammensetzen: Zeilen in Dokumentreihenfolge, Leerzeilen
     bleiben als Absatztrenner, Ränder getrimmt (SPEC §11, D40). */
  descLines.forEach((lines, node) => {
    while(lines.length && lines[lines.length-1] === '') lines.pop();
    while(lines.length && lines[0] === '') lines.shift();
    if(lines.length) node.desc = lines.join('\n');
  });
  /* Zeilenzuordnung der Beschreibungen (SPEC §9): unabhängig vom Text — auch
     ein Block, dessen Zeilen sich zu nichts zusammenfügen, gehört dem Knoten. */
  descOwner.forEach((lines, node) => { node.descLines = lines; });

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
