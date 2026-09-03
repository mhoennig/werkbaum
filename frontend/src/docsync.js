/* docsync — Nachziehen im laufenden Fenster (RFC 002 §6.3, headless).

   Zwei Fenster teilen sich einen Ursprung und damit den Speicher; das
   `storage`-Ereignis feuert nur in den FREMDEN Fenstern und nennt Schlüssel,
   alten und neuen Wert — für Liste, Namen und Tombstones die vollständige
   Information. Diese Funktion entscheidet rein, was ein Ereignis bedeutet;
   app.js wendet das Ergebnis an (Menü zeichnen, Chip, Warnung).

   Heikel sind die Fälle am AKTIVEN Dokument (§5.3):
   - anderswo umbenannt  → übernehmen, der Chip folgt (Text unberührt);
   - anderswo gelöscht   → behalten, bis getippt wird — Tippen ist Absicht
     (D55-Linie); sofortiges Wegschalten zöge Text unter der Schreibmarke weg;
   - anderswo Text geschrieben → nicht nachziehen (es überschriebe das
     Getippte), sondern warnen (§6.6) — der Restfall „dasselbe nicht geteilte
     Dokument in beiden Fenstern". Bei `live:` ist der Feed die Quelle:
     nichts tun.

   headless (D54-Nachtrag 3): keine DOM-, keine Speicher-Zugriffe — das
   Ereignis kommt als Datenobjekt herein, die Liste als Datenarray. */

import { LS_DOCS, DOC_TEXT_PREFIX, DOC_META_PREFIX, DOC_GONE_PREFIX,
         DOC_SNAPS_PREFIX, GONE_TTL } from './docstore.js';

export { GONE_TTL };

/* Geteilte Dokumente (`live:`) werden NIE gesperrt: Zwei Fenster sind zwei
   Live-Clients mit eigener Kennung, der Server führt zusammen (D76) — genau
   der Fall, den der alte D89-Dialog verbot, obwohl er funktioniert. Nicht
   „lokal", sondern „nicht `live:`" ist das Kriterium (§5.4): URL- und
   Datei-Dokumente sind ebenso im Browser wahr. */
export function lockDecision(id){
  return !String(id == null ? '' : id).startsWith('live:');
}

/* Der Name der Sperre je Dokument (§6.4). */
export function lockName(id){ return 'werkbaum-doc:' + String(id); }

/* Ist ein Tombstone verfallen? Ohne brauchbaren Zeitstempel gilt er als
   verfallen — ein Sicherheitsnetz darf nicht zum Datenfriedhof werden. */
export function tombstoneExpired(ts, now){
  return !(typeof ts === 'number' && ts > 0) || (now - ts) > GONE_TTL;
}

/* Dirty-Menge (§6.1): was DIESSES Fenster angelegt, umbenannt, getippt hat.
   Die Flush-Punkte schreiben nur diese Dokumente plus den Index-Hinweis —
   kein Voll-Flush mehr, der fremde Schlüssel anfassen könnte. */
export function createDirtySet(){
  const s = new Set();
  return {
    add(id){ if(id) s.add(String(id)); },
    has(id){ return s.has(String(id)); },
    entries(){ return [...s]; },
    clear(){ s.clear(); },
  };
}

/* Ein storage-Ereignis auf die Dokumentenliste anwenden.
   Rückgabe `{docs, action, id}`: `docs` ist DASSELBE Array, wenn nichts an
   der Liste geändert hat (Mutationen am Eintrag — Umbenennen — laufen auf dem
   übergebenen Objekt), sonst ein neues. `action` sagt, was am AKTIVEN
   Dokument zu tun ist:

   - 'created'      — meta neu: Dokument hängt in der Liste, Text vom
                      Aufrufer lazy aus dem Speicher lesen
   - 'renamed'      — Name/Quelle des aktiven Dokuments übernommen (Chip)
   - 'deleted'      — aktives Dokument wurde anderswo gelöscht: BEHALTEN,
                      warnfarben markieren (§6.5), bis getippt wird
   - 'foreignWrite' — das aktive nicht-`live:`-Dokument wurde anderswo
                      geschrieben: der Restfall, Warnung (§6.6)
   - 'snaps'        — Stände-Cache der id verwerfen (§6.3)
   - 'order'        — Reihenfolge-Hinweis übernommen
   - null           — nichts am aktiven Dokument */
export function applyStorageEvent(docs, activeId, ev){
  const key = String((ev && ev.key) || '');
  const neu = ev ? ev.newValue : null;
  if(key.startsWith(DOC_META_PREFIX)){
    const id = key.slice(DOC_META_PREFIX.length);
    if(!id || neu == null) return {docs, action: null, id: null};
    let meta = null;
    try{ meta = JSON.parse(neu); }catch(_){ meta = null; }
    if(!meta || typeof meta !== 'object' || Array.isArray(meta)) return {docs, action: null, id};
    const d = docs.find(x => x.id === id);
    if(!d){
      const aus = {id, name: typeof meta.name === 'string' && meta.name ? meta.name : id, text: ''};
      if(typeof meta.source === 'string' && meta.source) aus.source = meta.source;
      return {docs: docs.concat([aus]), action: 'created', id};
    }
    let geaendert = false;
    if(typeof meta.name === 'string' && meta.name && d.name !== meta.name){ d.name = meta.name; geaendert = true; }
    if(typeof meta.source === 'string' && meta.source && d.source !== meta.source){ d.source = meta.source; geaendert = true; }
    return {docs, action: geaendert && id === activeId ? 'renamed' : null, id};
  }
  if(key.startsWith(DOC_GONE_PREFIX)){
    const id = key.slice(DOC_GONE_PREFIX.length);
    if(!id || neu == null) return {docs, action: null, id};   /* Tombstone aufgehoben — das meta-Ereignis folgt */
    if(!docs.some(x => x.id === id)) return {docs, action: null, id};
    if(id === activeId) return {docs, action: 'deleted', id};  /* behalten, warnfarben (§6.5) */
    return {docs: docs.filter(x => x.id !== id), action: null, id};
  }
  if(key.startsWith(DOC_TEXT_PREFIX)){
    const id = key.slice(DOC_TEXT_PREFIX.length);
    if(!id || neu == null) return {docs, action: null, id};   /* Entfernen kommt als gone-Ereignis */
    const d = docs.find(x => x.id === id);
    if(!d) return {docs, action: null, id};                   /* das meta-Ereignis legt ihn an */
    if(id === activeId){
      return lockDecision(id) ? {docs, action: 'foreignWrite', id}
                              : {docs, action: null, id};      /* der Feed ist die Quelle */
    }
    d.text = neu;                                             /* Vorschau nachziehen */
    return {docs, action: null, id};
  }
  if(key.startsWith(DOC_SNAPS_PREFIX)){
    return {docs, action: 'snaps', id: key.slice(DOC_SNAPS_PREFIX.length)};
  }
  if(key === LS_DOCS){
    /* Reihenfolge-Hinweis (§6.1): übernehmen, wo er etwas sagt. Bekannte ids
       rücken in seine Reihenfolge, unbekannte bleiben hinten — in ihrer
       bisherigen Ordnung. */
    let arr = null;
    try{ arr = JSON.parse(neu || 'null'); }catch(_){ arr = null; }
    if(!Array.isArray(arr)) return {docs, action: null, id: null};
    const pos = new Map();
    arr.forEach((e, i) => { if(e && typeof e.id === 'string') pos.set(e.id, i); });
    if(!pos.size) return {docs, action: null, id: null};
    const geordnet = docs.slice().sort((a, b) => {
      const ra = pos.has(a.id) ? pos.get(a.id) : arr.length + docs.indexOf(a);
      const rb = pos.has(b.id) ? pos.get(b.id) : arr.length + docs.indexOf(b);
      return ra - rb;
    });
    const gleich = geordnet.every((d, i) => d === docs[i]);
    return {docs: gleich ? docs : geordnet, action: gleich ? null : 'order', id: null};
  }
  /* werkbaum-active, werkbaum-src, Ansicht, Merker — letzter Schreiber
     gewinnt, harmlos (§3). */
  return {docs, action: null, id: null};
}
