/* Frühere Stände (D54) — die entscheidbare Hälfte, ohne DOM und ohne Speicher.

   Herausgezogen, nachdem ein Fehler durch alle Prüfungen kam, den ein Test in
   einer Zeile gefunden hätte: Der Knopf „von Hand sichern" legte nichts weg,
   solange am Dokument noch nichts geändert war (D54-Nachtrag 2). Die Regel
   dafür ist reine Logik — sie hing nur an `localStorage`, `Date.now()` und
   dem `<textarea>` fest und war deshalb nicht prüfbar.

   Aufteilung wie bei den übrigen Modulen: Hier steht, WAS gilt; in
   app.js bleibt, WOHER die Werte kommen (aktives Dokument, Schreibschutz,
   Menü) und WOHIN sie gehen (`localStorage`). Der Speicher wird als
   `{setItem, removeItem}` hereingereicht, die Uhr als Zahl — beides lässt sich
   im Test stellen.

   Datenform: `{docId: [{t, text}, …]}`, ältester Stand zuerst. */

export const LS_SNAPS = 'werkbaum-snaps';
export const SNAP_EVERY = 10 * 60 * 1000;
export const SNAP_KEEP = 20;

/* Was aus dem Speicher kommt, ist fremder Text: Es kann von einer älteren
   Fassung stammen, von Hand bearbeitet oder halb geschrieben sein. Alles, was
   nicht die erwartete Form hat, fällt weg statt später beim Lesen zu
   stolpern — Stände sind ein Sicherheitsnetz, sie dürfen die App nicht
   umbringen. */
export function parseSnaps(raw){
  let o;
  try{ o = JSON.parse(raw || '{}'); }
  catch(_){ return {}; }
  if(!o || typeof o !== 'object' || Array.isArray(o)) return {};
  const out = {};
  for(const id of Object.keys(o)){
    const list = o[id];
    if(!Array.isArray(list)) continue;
    const rein = list.filter(s => s && typeof s.text === 'string' && typeof s.t === 'number');
    if(rein.length) out[id] = rein;
  }
  return out;
}

/* Legt den Text als neuen Stand ab, wenn er neu ist; gibt zurück, ob das
   geschehen ist. `snaps` wird dabei verändert (wie schon vorher in app.js).

   `manual` schaltet die `base`-Sperre ab — und das ist der ganze Unterschied
   zwischen Takt und Knopf. `base` ist der Text beim Öffnen des Dokuments;
   solange nichts daran geändert wurde, soll der **Takt** nichts sammeln, sonst
   legte jedes bloße Ansehen einen Stand an. Für den Knopf wäre dieselbe Sperre
   falsch: „vor der großen Änderung sichern" heißt gerade, dass noch nichts
   geändert ist — und bei leerer Liste wäre der Text dann nirgends gesichert.
   Für ihn zählt allein der **letzte Eintrag**: Der Doppelte bleibt vermieden,
   und die Zusage „dein Stand ist gesichert" wird in jedem Fall wahr. */
export function addSnapshot(snaps, id, text, now, opts){
  const {base = null, manual = false} = opts || {};
  const list = snaps[id] || (snaps[id] = []);
  const letzter = list.length ? list[list.length - 1].text : (manual ? null : base);
  if(text === letzter) return false;
  list.push({t: now, text});
  while(list.length > SNAP_KEEP) list.shift();
  return true;
}

/* Wirft den ältesten Stand **über alle Dokumente hinweg** weg und sagt, ob
   noch einer da war. Über alle, nicht nur im aktiven Dokument: Wenn der Platz
   knapp wird, ist das Älteste das Entbehrlichste, gleich zu welchem Dokument
   es gehört. */
export function dropOldestSnap(snaps){
  let id = null, t = Infinity;
  for(const k in snaps){
    const l = snaps[k];
    if(l && l.length && l[0].t < t){ t = l[0].t; id = k; }
  }
  if(id === null) return false;
  snaps[id].shift();
  if(!snaps[id].length) delete snaps[id];
  return true;
}

/* Der Platz im Speicher ist geteilt. Läuft er über, sollen die **Dokumente**
   überleben, nicht ihre Stände — deshalb wirft der Fehlerfall Stände weg, bis
   es passt, notfalls alle. Gibt zurück, ob am Ende etwas gespeichert wurde. */
export function persistSnaps(snaps, store){
  for(;;){
    try{ store.setItem(LS_SNAPS, JSON.stringify(snaps)); return true; }
    catch(_){
      if(!dropOldestSnap(snaps)){
        try{ store.removeItem(LS_SNAPS); }catch(_){}
        return false;
      }
    }
  }
}

/* Beschriftung eines Eintrags: heute nur die Uhrzeit, sonst mit Datum davor —
   die Zeit trägt die Unterscheidung, das Datum nur, wo sie nicht reicht.
   `now` wird hereingereicht, damit „heute" prüfbar ist. Der Rückfall greift,
   wenn die Laufzeit die Sprache nicht kennt. */
export function snapLabel(ms, lang, now){
  const d = new Date(ms);
  const heute = d.toDateString() === new Date(now).toDateString();
  try{
    return heute
      ? d.toLocaleTimeString(lang, {hour: '2-digit', minute: '2-digit'})
      : d.toLocaleString(lang, {day: '2-digit', month: '2-digit',
                                hour: '2-digit', minute: '2-digit'});
  }catch(_){ return d.toISOString().slice(0, 16).replace('T', ' '); }
}
