/* Werkbaum — Ablageschema der Dokumente im localStorage (D83, v3 nach RFC 002,
   headless).

   Bis D82 lagen alle Dokumente als EIN JSON-Array unter einem Schlüssel —
   mit zwei strukturellen Folgen: Bei voller Quota scheiterte jeder Flush
   ganz, und ein einziger kaputter Schlüssel kostete die Sicht auf ALLE
   Dokumente. D83 teilte auf (Index + Text je Dokument) — behielt aber den
   Voll-Flush, der den Index aus der EIGENEN Liste schrieb und jeden
   fremden Text-Schlüssel entfernte. Zwei Fenster löschten sich damit
   gegenseitig Dokumente und Stände weg (RFC 002, Befund 2 und 3). Schema
   v3 zieht die Konsequenz — **kein Fenster schreibt je den Schlüssel eines
   anderen**:

   - `werkbaum-doc:<id>`    — der Text je Dokument (wie D83).
   - `werkbaum-meta:<id>`   — `{name, source?, born}` je Dokument (NEU):
                              Name und Quelle ohne den Index; `born` ordnet
                              Dokumente, die der Index nicht kennt.
   - `werkbaum-snaps:<id>`  — frühere Stände je Dokument (snapshots.js).
   - `werkbaum-gone:<id>`   — Tombstone der Löschung, Zeitstempel, Verfall
                              nach GONE_TTL (§6.2). „Gelöscht" ist damit von
                              „nie gesehen" zu unterscheiden.
   - `werkbaum-docs`        — der INDEX bleibt als **Reihenfolge-Hinweis**
                              und Rollback-Brücke; er löscht NIE mehr und
                              wird nur aus `Speicher-ids ∪ eigene Liste`
                              geschrieben.
   - `werkbaum-src`         — Spiegel des aktiven Texts (Rollback-Fallback).

   Hausregel (D54-Nachtrag 3): Der Storage wird als {getItem, setItem,
   removeItem} hereingereicht, damit die Tests ihn stellen können. Schlüssel-
   Aufzählungen (Union-Lesen, Tombstone-Verfall) bekommen die Schlüsselliste
   als Argument — im Browser `Object.keys(localStorage)`. */

export const LS_DOCS = 'werkbaum-docs';
export const LS_ACTIVE = 'werkbaum-active';
export const LS_SRC = 'werkbaum-src';
export const DOC_TEXT_PREFIX = 'werkbaum-doc:';
export const DOC_META_PREFIX = 'werkbaum-meta:';
export const DOC_GONE_PREFIX = 'werkbaum-gone:';
export const DOC_SNAPS_PREFIX = 'werkbaum-snaps:';
/* Der alte Sammel-Schlüssel der Stände (D54–D83) — nur noch Migration. */
export const LEGACY_SNAPS = 'werkbaum-snaps';

/* Tombstones verfallen nach sieben Tagen (RFC 002 §6.2). */
export const GONE_TTL = 7 * 24 * 60 * 60 * 1000;

export function docTextKey(id){ return DOC_TEXT_PREFIX + id; }
export function docMetaKey(id){ return DOC_META_PREFIX + id; }
export function docGoneKey(id){ return DOC_GONE_PREFIX + id; }

/* Meta eines Dokuments lesen — null, wenn kein brauchbares Objekt liegt. */
export function readMeta(storage, id){
  let o = null;
  try{ o = JSON.parse(storage.getItem(docMetaKey(id)) || 'null'); }catch(_){ return null; }
  if(!o || typeof o !== 'object' || Array.isArray(o)) return null;
  return o;
}

export function hasTombstone(storage, id){
  return storage.getItem(docGoneKey(id)) != null;
}

/* Dokumentenliste lesen (v3). Rückgabe {docs, legacy} — `legacy` heißt: Das
   Altformat (Texte im Index-Array) lag vor, der Spiegel-Vergleich des
   Aufrufers entscheidet noch über das aktive Dokument. `null`, wenn nichts
   Brauchbares da ist — dann greift der Beispiel-/Migrations-Pfad des
   Aufrufers.

   Menge der Dokumente = ids mit Meta- oder Text-Schlüssel, vereinigt mit dem
   Index, minus ids mit Tombstone. Name aus Meta, sonst Index, sonst die id.
   Reihenfolge: Index zuerst, danach Nachzügler nach `born`. Ein Index-Eintrag
   ohne Text und ohne Meta ist ein Rest und wird ignoriert (§6.1).

   Ein fehlender Text-Schlüssel ergibt einen LEEREN Text, kein Verwerfen des
   Dokuments: Der Schaden bleibt auf das eine Dokument begrenzt — genau der
   Punkt der Aufteilung. */
export function readDocs(storage, allKeys){
  const keys = Array.isArray(allKeys) ? allKeys : [];
  /* Tombstones zuerst: gelöschte Dokumente tauchen nicht wieder auf. */
  const weg = new Set();
  for(const k of keys){
    if(typeof k === 'string' && k.startsWith(DOC_GONE_PREFIX)) weg.add(k.slice(DOC_GONE_PREFIX.length));
  }
  /* Der Index ist nur noch ein Hinweis — beschädigt oder leer heißt nicht
     „nichts da", die Dokumente stehen an ihren eigenen Schlüsseln. */
  let index = null;
  try{ index = JSON.parse(storage.getItem(LS_DOCS) || 'null'); }catch(_){}
  const eintraege = Array.isArray(index)
    ? index.filter(d => d && typeof d.id === 'string' && !weg.has(d.id))
    : [];
  const legacy = eintraege.some(d => typeof d.text === 'string');
  const ids = [];
  const gesehen = new Set();
  for(const e of eintraege){
    /* Rest: weder Text noch Meta — ein Eintrag, der nichts mehr sagt. */
    if(storage.getItem(docTextKey(e.id)) == null && typeof e.text !== 'string'
       && storage.getItem(docMetaKey(e.id)) == null) continue;
    if(!gesehen.has(e.id)){ gesehen.add(e.id); ids.push(e.id); }
  }
  for(const k of keys){
    if(typeof k !== 'string') continue;
    let id = null;
    if(k.startsWith(DOC_META_PREFIX)) id = k.slice(DOC_META_PREFIX.length);
    else if(k.startsWith(DOC_TEXT_PREFIX)) id = k.slice(DOC_TEXT_PREFIX.length);
    if(id && !gesehen.has(id) && !weg.has(id)){ gesehen.add(id); ids.push(id); }
  }
  if(!ids.length) return null;
  const pos = new Map(eintraege.map((e, i) => [e.id, i]));
  const metaFuer = new Map(ids.map(id => [id, readMeta(storage, id)]));
  ids.sort((a, b) => {
    const rang = id => {
      if(pos.has(id)) return [0, pos.get(id), ''];
      const meta = metaFuer.get(id);
      return [1, meta && typeof meta.born === 'number' ? meta.born : Number.MAX_SAFE_INTEGER, id];
    };
    const ra = rang(a), rb = rang(b);
    return ra[0] - rb[0] || ra[1] - rb[1] || (ra[2] < rb[2] ? -1 : ra[2] > rb[2] ? 1 : 0);
  });
  const indexNachId = new Map(eintraege.map(e => [e.id, e]));
  const docs = ids.map(id => {
    const e = indexNachId.get(id), meta = metaFuer.get(id);
    const out = { id };
    out.name = (meta && typeof meta.name === 'string' && meta.name)
      || (e && typeof e.name === 'string' && e.name) || id;
    const source = (meta && typeof meta.source === 'string' && meta.source)
      || (e && typeof e.source === 'string' && e.source) || null;
    if(source) out.source = source;
    if(e && typeof e.text === 'string'){
      out.text = e.text;                       /* Altformat: Text im Array */
    } else {
      const t = storage.getItem(docTextKey(id));
      out.text = t == null ? '' : String(t);
    }
    return out;
  });
  return {docs, legacy};
}

/* Ein EINZELNES Dokument schreiben: Meta + Text, je unter eigenem Schlüssel.
   Steht ein Tombstone, wird NICHTS geschrieben — außer `typed`: Der
   Benutzer hat ausdrücklich getippt, der Tombstone fällt und das Dokument
   wird neu angelegt (§6.2/§6.5). `born` bleibt erhalten: die bestehende Meta
   gewinnt, beim ersten Anlegen zählt die Uhr.

   Quota-Fehler werden NICHT gefangen — der Aufrufer meldet sie (D82). */
export function writeDoc(storage, doc, opts){
  if(!doc || typeof doc.id !== 'string' || !doc.id) return false;
  const {typed = false, now = Date.now()} = opts || {};
  const gk = docGoneKey(doc.id);
  if(storage.getItem(gk) != null){
    if(!typed) return false;       /* gelöscht bleibt gelöscht (§6.2) */
    storage.removeItem(gk);
  }
  const alt = readMeta(storage, doc.id) || {};
  const meta = {name: typeof doc.name === 'string' ? doc.name : doc.id};
  if(doc.source) meta.source = doc.source;
  meta.born = typeof alt.born === 'number' ? alt.born
            : typeof doc.born === 'number' ? doc.born : now;
  const mk = docMetaKey(doc.id), metaJson = JSON.stringify(meta);
  if(storage.getItem(mk) !== metaJson) storage.setItem(mk, metaJson);
  const tk = docTextKey(doc.id);
  if(storage.getItem(tk) !== doc.text) storage.setItem(tk, doc.text);
  return true;
}

/* Der Index-Hinweis: Reihenfolge fürs Menü und Rollback-Brücke für ältere
   Builds. Er wird NIE aus einer eigenen In-Memory-Liste „aufgeräumt" —
   schreiben, was da ist, entfernen, was nicht (§6.1). */
export function writeIndexHint(storage, eintraege){
  const index = JSON.stringify((eintraege || []).map(e => {
    const out = {id: e.id, name: e.name};
    if(e.source) out.source = e.source;
    return out;
  }));
  if(storage.getItem(LS_DOCS) !== index) storage.setItem(LS_DOCS, index);
}

/* Löschen (und Verlassen): Text, Meta und Stände der id gehen, der Tombstone
   kommt (§6.2). Er schützt die Sitzung des anderen Fensters vor dem stillen
   Wiederanlegen; verfallen tut er nach GONE_TTL. */
export function removeDoc(storage, id, now){
  storage.removeItem(docTextKey(id));
  storage.removeItem(docMetaKey(id));
  storage.removeItem(DOC_SNAPS_PREFIX + id);
  storage.setItem(docGoneKey(id), String(now));
}

/* Tombstones altern lassen (beim Laden abgeräumt, §6.2): abgelaufene — und
   defekte — fallen weg, junge bleiben. */
export function expireTombstones(storage, allKeys, now){
  for(const k of (allKeys || [])){
    if(typeof k !== 'string' || !k.startsWith(DOC_GONE_PREFIX)) continue;
    const ts = Number(storage.getItem(k));
    if(!(ts > 0) || now - ts > GONE_TTL) storage.removeItem(k);
  }
}

/* Migration (einmalig beim Laden, idempotent, §6.1):
   1. `werkbaum-snaps` (Sammel-Schlüssel, D54–D83) auf `werkbaum-snaps:<id>`
      verteilen und entfernen — sonst wirft der Flush des einen Fensters die
      Stände des anderen weg (Befund 3).
   2. Für Dokumente, die der Index kennt, aber keine Meta haben, die Meta aus
      dem Index schreiben. Ein Rest ohne Text bleibt ohne Meta.
   3. Altformat: Texte, die nur noch im Index-Array stehen, auf eigene
      Schlüssel (der nächste flushDocs schreibt den Index ohne Texte).
   Zwei Fenster, die das gleichzeitig tun, schreiben identische Werte —
   harmlos. */
export function migrateV3(storage, now){
  const alt = storage.getItem(LEGACY_SNAPS);
  if(alt != null){
    let o = null;
    try{ o = JSON.parse(alt); }catch(_){ o = null; }
    if(o && typeof o === 'object' && !Array.isArray(o)){
      for(const id of Object.keys(o)){
        const liste = Array.isArray(o[id])
          ? o[id].filter(s => s && typeof s.text === 'string' && typeof s.t === 'number')
          : [];
        const k = DOC_SNAPS_PREFIX + id;
        if(liste.length && storage.getItem(k) == null) storage.setItem(k, JSON.stringify(liste));
      }
    }
    storage.removeItem(LEGACY_SNAPS);
  }
  let index = null;
  try{ index = JSON.parse(storage.getItem(LS_DOCS) || 'null'); }catch(_){}
  if(!Array.isArray(index)) return;
  for(const e of index){
    if(!e || typeof e.id !== 'string' || !e.id) continue;
    const hatText = storage.getItem(docTextKey(e.id)) != null || typeof e.text === 'string';
    if(!hatText) continue;                    /* Rest ohne Text ignorieren */
    if(storage.getItem(docMetaKey(e.id)) == null){
      const meta = {name: typeof e.name === 'string' ? e.name : e.id, born: now};
      if(typeof e.source === 'string') meta.source = e.source;
      storage.setItem(docMetaKey(e.id), JSON.stringify(meta));
    }
    if(typeof e.text === 'string' && storage.getItem(docTextKey(e.id)) == null){
      storage.setItem(docTextKey(e.id), e.text);
    }
  }
}

/* Gehört ein localStorage-Schlüssel zur Dokument-Ablage? Das storage-Ereignis
   anderer Fenster nennt den Schlüssel — nur diese gehören zur Synchronisation
   (docsync.js); die übrigen (Ansicht, Sprache, Merker) sind harmlos. */
export function isDocKey(k){
  const s = String(k == null ? '' : k);
  return s === LS_DOCS || s === LS_ACTIVE || s === LS_SRC || s === LEGACY_SNAPS
    || s.startsWith(DOC_TEXT_PREFIX) || s.startsWith(DOC_META_PREFIX)
    || s.startsWith(DOC_GONE_PREFIX) || s.startsWith(DOC_SNAPS_PREFIX);
}

/* Die Tastendruck-Hälfte: nur der Text EINES Dokuments plus der Spiegel.
   Tippen ist Absicht (D55-Linie): Steht ein Tombstone, hebt dieser
   Tastendruck ihn auf — das Dokument wird wieder angelegt (§6.5); die Meta
   schreibt der Dirty-Flush des Aufrufers. */
export function storeDocText(storage, id, text){
  const gk = docGoneKey(id);
  if(storage.getItem(gk) != null) storage.removeItem(gk);
  const k = docTextKey(id);
  if(storage.getItem(k) !== text) storage.setItem(k, text);
  if(storage.getItem(LS_SRC) !== text) storage.setItem(LS_SRC, text);
}
