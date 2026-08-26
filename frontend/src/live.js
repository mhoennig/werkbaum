/* Werkbaum — gemeinsam am selben Dokument arbeiten (D76, headless).

   Hier steht die entscheidbare Hälfte des Clients (Hausregel, D54-Nachtrag 3):
   Adressen, das Zeilen-Diff, die Cursor-Rechnung und die Regel, wann eine
   Feed-Antwort überhaupt angewendet werden darf. Das Holen selbst, der Takt
   und der ganze DOM-Kram bleiben in app.js.

   Das Diff-Modell ist dasselbe wie im Backend (`de.werkbaum.diff.LineDiff`):
   Operationen gegen eine Basisversion, 0-basierte Zeilenindizes, aufsteigend
   sortiert und überschneidungsfrei. Beide Seiten müssen Text **gleich in
   Zeilen zerlegen**, sonst zeigen die Indizes auseinander — deshalb liegt
   `lines()`/`text()` hier und nicht verstreut in app.js. */

/* ------------------------------------------------------------------ Adressen */

/* Adresse eines Server-Dokuments normalisieren (?live=…). Eingabe ist die
   Dokument-URL, so wie sie jemand weitergibt:
   `https://host/api/v1/documents/<uuid>`. Query, Fragment und Schrägstriche am
   Ende fallen weg, damit derselbe Link genau ein Dokument ergibt — dieselbe
   Regel wie bei ?etherpad= (D31).

   Verlangt wird `/documents/<uuid>` am Ende; das ist die Prüfung, ob überhaupt
   eine Dokument-Adresse vorliegt. Erlaubt sind nur http(s), wie bei
   ?sourceUrl= (D23).

   Rückgabe {doc, content, changes, id} oder null. `doc` ist zugleich Name und
   Identität des Dokuments — die vollständige URL. */
export function liveUrls(raw, base){
  let u;
  try{ u = base ? new URL(raw, base) : new URL(raw); }catch(_){ return null; }
  if(u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const path = u.pathname.replace(/\/+$/, '');
  const m = /\/documents\/([0-9a-fA-F-]{36})$/.exec(path);
  if(!m) return null;
  u.pathname = path; u.search = ''; u.hash = '';
  const doc = u.href;
  return {doc, content: doc + '/content', changes: doc + '/changes', id: m[1].toLowerCase()};
}

/* ------------------------------------------------------------------ Zeilen */

/* Zeilenenden auf LF (SPEC §12). Der Server normalisiert beim Speichern
   autoritativ, der Client beim Laden — nur so hashen beide denselben Text. */
export function normalize(text){
  return String(text == null ? '' : text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/* Es gilt `text(lines(t)) === normalize(t)`: ein abschließendes LF ergibt eine
   leere letzte Zeile, der leere Text ist genau eine leere Zeile. Identisch zur
   Server-Seite. */
export function lines(text){ return normalize(text).split('\n'); }
export function text(ls){ return ls.join('\n'); }

/* Prüfsumme des Basistexts, `sha256:<hex>` — Pflichtfeld jedes Patches: Die
   Versionsnummer bestätigt nur, dass die Basis dieselbe *Version* ist, nicht
   dass beide Seiten sie *gleich lesen*.

   Braucht `crypto.subtle`, und das gibt es nur im sicheren Kontext (https oder
   localhost). Auf `file://` schlägt es fehl — dort ist Live-Editing ohnehin
   keine Frage, aber der Fehler soll benannt sein statt still. */
export async function checksum(t){
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if(!subtle) throw new Error('crypto.subtle nicht verfügbar (kein sicherer Kontext)');
  const bytes = new TextEncoder().encode(normalize(t));
  const digest = await subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return 'sha256:' + hex;
}

/* ------------------------------------------------------- Diff berechnen */

/* Obergrenze für die LCS-Tabelle; darüber wird der abweichende Abschnitt zu
   einem einzigen `replace`. Bei einem so großen Unterschied ist das ohnehin
   die ehrliche Beschreibung. Gleicher Wert wie im Backend. */
const LCS_LIMIT = 1000000;

/* Zeilen-Diff zwischen zwei Ständen; es gilt `applyOps(from, computeOps(from,
   to)) == to`. Gemeinsamer Anfang und gemeinsames Ende fallen zuerst weg — der
   übliche Fall (ein paar Zeichen in einer Zeile) kostet danach fast nichts. */
export function computeOps(from, to){
  let head = 0;
  const shortest = Math.min(from.length, to.length);
  while(head < shortest && from[head] === to[head]) head++;
  let tail = 0;
  while(tail < shortest - head && from[from.length - 1 - tail] === to[to.length - 1 - tail]) tail++;

  const a = from.slice(head, from.length - tail);
  const b = to.slice(head, to.length - tail);

  if(!a.length && !b.length) return [];
  if(!a.length) return [{op: 'insert', index: head, lines: b}];
  if(!b.length) return [{op: 'delete', index: head, count: a.length}];
  if(a.length * b.length > LCS_LIMIT) return [{op: 'replace', index: head, count: a.length, lines: b}];
  return lcsOps(a, b, head);
}

function lcsOps(a, b, offset){
  const n = a.length, m = b.length;
  /* lcs[i][j] = Länge der längsten gemeinsamen Teilfolge von a[i..] und b[j..] */
  const lcs = Array.from({length: n + 1}, () => new Int32Array(m + 1));
  for(let i = n - 1; i >= 0; i--){
    for(let j = m - 1; j >= 0; j--){
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0, j = 0;
  while(i < n || j < m){
    if(i < n && j < m && a[i] === b[j]){ i++; j++; continue; }
    const removedFrom = i;
    const inserted = [];
    while(i < n || j < m){
      if(i < n && j < m && a[i] === b[j]) break;
      if(j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])){ inserted.push(b[j]); j++; }
      else i++;
    }
    const removed = i - removedFrom;
    if(removed > 0 && inserted.length) ops.push({op: 'replace', index: offset + removedFrom, count: removed, lines: inserted});
    else if(removed > 0) ops.push({op: 'delete', index: offset + removedFrom, count: removed});
    else ops.push({op: 'insert', index: offset + removedFrom, lines: inserted});
  }
  return ops;
}

/* ---------------------------------------------------------- Diff anwenden */

function removedCount(op){ return op.op === 'insert' ? 0 : (op.count || 0); }
function insertedLines(op){ return op.op === 'delete' ? [] : (op.lines || []); }

/* Wendet Operationen auf Zeilen an. Wirft, wenn sie nicht passen — ein
   halb angewendetes Diff wäre schlimmer als ein Neuladen. */
export function applyOps(base, ops){
  const out = [];
  let cursor = 0;
  for(const op of ops){
    const end = op.index + removedCount(op);
    if(op.index < cursor || op.index < 0 || end > base.length){
      throw new Error('Diff passt nicht auf diesen Stand');
    }
    out.push(...base.slice(cursor, op.index), ...insertedLines(op));
    cursor = end;
  }
  out.push(...base.slice(cursor));
  return out;
}

/* ------------------------------------------------------------ Cursor */

/* Wohin wandert eine Zeile, wenn fremde Operationen angewendet werden?
   Ohne diese Rechnung spränge die Schreibmarke bei jeder fremden Änderung
   weiter oben im Dokument — genau das, was „kein Neuladen" verhindern soll.

   Zeilen **innerhalb** eines ersetzten oder gelöschten Bereichs haben kein
   Gegenüber; sie landen am Anfang des Bereichs. Das ist die verlässlichste
   Antwort: dort, wo die fremde Änderung eingegriffen hat. */
export function mapLine(lineIndex, ops){
  let delta = 0;
  for(const op of ops){
    const start = op.index;
    const end = start + removedCount(op);
    if(end <= lineIndex) delta += insertedLines(op).length - removedCount(op);
    else if(start <= lineIndex) return start + delta;   /* mitten im Eingriff */
    else break;                                          /* Ops sind sortiert */
  }
  return lineIndex + delta;
}

/* Zeichenposition → {line, col}; die Umkehrung braucht die neuen Zeilen. */
export function caretToLineCol(t, offset){
  const before = normalize(t).slice(0, Math.max(0, offset));
  const line = before.split('\n').length - 1;
  const col = before.length - (before.lastIndexOf('\n') + 1);
  return {line, col};
}

export function lineColToCaret(ls, line, col){
  const clampedLine = Math.max(0, Math.min(line, ls.length - 1));
  let offset = 0;
  for(let i = 0; i < clampedLine; i++) offset += ls[i].length + 1;
  return offset + Math.max(0, Math.min(col, ls[clampedLine].length));
}

/* --------------------------------------------------------------- Feed */

/* Darf diese Feed-Antwort angewendet werden?

   Eine gepufferte Antwort darf **nur** angewendet werden, wenn ihr
   `fromVersion` zur aktuellen Schattenkopie passt (D76). Sonst wendet der
   Client dieselben Operationen doppelt an — der Fall tritt ein, wenn Feed und
   409-Antwort beide dasselbe fremde Diff liefern.

   'apply'   – Operationen anwenden
   'replace' – Volltext übernehmen (Basis verdichtet oder Erstkontakt)
   'skip'    – nichts tun (schon gesehen oder passt nicht auf unseren Stand) */
export function feedAction(feed, shadowVersion){
  if(!feed || typeof feed.currentVersion !== 'number') return 'skip';
  if(feed.currentVersion <= shadowVersion) return 'skip';
  if(typeof feed.content === 'string' && feed.fromVersion == null) return 'replace';
  if(Array.isArray(feed.ops) && feed.fromVersion === shadowVersion) return 'apply';
  return 'skip';
}
