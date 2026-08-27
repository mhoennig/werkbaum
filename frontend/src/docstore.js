/* Werkbaum — Ablageschema der Dokumente im localStorage (D83, headless).

   Bis D82 lagen alle Dokumente als EIN JSON-Array unter einem Schlüssel —
   mit zwei strukturellen Folgen: Bei voller Quota scheiterte jeder Flush
   ganz (auch die Änderung an einem winzigen Dokument muss das Ganze
   mitschreiben), und ein einziger kaputter Schlüssel kostete die Sicht auf
   ALLE Dokumente. Deshalb die Aufteilung:

   - `werkbaum-docs`        — der INDEX: [{id, name, source?}], ohne Text.
   - `werkbaum-doc:<id>`    — der Text je Dokument, ein eigener Schlüssel.
   - `werkbaum-src`         — Spiegel des aktiven Texts (Rollback-Fallback:
                              ein älterer Build fällt auf ihn zurück).

   Das ALTFORMAT (Texte im Array) wird beim Lesen erkannt und einmalig
   aufgeteilt — der nächste Voll-Flush schreibt den Index ohne Texte.
   Hausregel (D54-Nachtrag 3): Der Storage wird als {getItem, setItem,
   removeItem} hereingereicht, damit die Tests ihn stellen können. */

export const LS_DOCS = 'werkbaum-docs';
export const LS_ACTIVE = 'werkbaum-active';
export const LS_SRC = 'werkbaum-src';
export const DOC_TEXT_PREFIX = 'werkbaum-doc:';

export function docTextKey(id){ return DOC_TEXT_PREFIX + id; }

/* Dokumentenliste lesen. Rückgabe {docs, legacy} — `legacy` heißt: Das
   Altformat lag (ganz oder teilweise) vor, der nächste Voll-Flush schließt
   die Migration ab. `null`, wenn nichts Brauchbares da ist — dann greift der
   Beispiel-/Migrations-Pfad des Aufrufers.

   Ein fehlender Text-Schlüssel ergibt einen LEEREN Text, kein Verwerfen des
   Dokuments: Der Schaden bleibt auf das eine Dokument begrenzt — genau der
   Punkt der Aufteilung. */
export function readDocs(storage){
  let arr = null;
  try{ arr = JSON.parse(storage.getItem(LS_DOCS) || 'null'); }catch(_){ return null; }
  if(!Array.isArray(arr) || !arr.length) return null;
  if(!arr.every(d => d && typeof d.id === 'string')) return null;
  const legacy = arr.some(d => typeof d.text === 'string');
  const docs = arr.map(d => {
    const out = { id: d.id, name: typeof d.name === 'string' ? d.name : d.id };
    if(typeof d.source === 'string') out.source = d.source;
    if(typeof d.text === 'string'){
      out.text = d.text;                       /* Altformat: Text im Array */
    } else {
      const t = storage.getItem(docTextKey(d.id));
      out.text = t == null ? '' : String(t);
    }
    return out;
  });
  return {docs, legacy};
}

/* Voll-Flush: Index + Texte + verwaiste Text-Schlüssel entfernen.

   Vor jedem Schreiben wird verglichen — unveränderte Schlüssel werden nicht
   angefasst (sonst wäre die Write-Amplification des Ein-Schlüssel-Designs
   nur verteilt statt behoben). `allKeys` sind die vorhandenen Schlüssel des
   Storage (der Aufrufer reicht `Object.keys(localStorage)`): Texte
   gelöschter Dokumente werden darüber abgeräumt, fremde Schlüssel bleiben.
   Quota-Fehler werden NICHT gefangen — der Aufrufer meldet sie (D82). */
export function storeDocs(storage, docs, allKeys){
  const index = JSON.stringify(docs.map(d => {
    const e = { id: d.id, name: d.name };
    if(d.source) e.source = d.source;
    return e;
  }));
  if(storage.getItem(LS_DOCS) !== index) storage.setItem(LS_DOCS, index);
  for(const d of docs){
    const k = docTextKey(d.id);
    if(storage.getItem(k) !== d.text) storage.setItem(k, d.text);
  }
  const bleibt = new Set(docs.map(d => docTextKey(d.id)));
  for(const k of (allKeys || [])){
    if(k.startsWith(DOC_TEXT_PREFIX) && !bleibt.has(k)) storage.removeItem(k);
  }
}

/* Die Tastendruck-Hälfte: nur der Text EINES Dokuments plus der Spiegel.
   Anders als bis D82 schreibt der Tastendruck damit direkt in die echte
   Ablage — eine „Spiegel gewinnt"-Regel beim Laden braucht das neue Schema
   nur noch für die einmalige Migration aus dem Altformat. */
export function storeDocText(storage, id, text){
  const k = docTextKey(id);
  if(storage.getItem(k) !== text) storage.setItem(k, text);
  if(storage.getItem(LS_SRC) !== text) storage.setItem(LS_SRC, text);
}
