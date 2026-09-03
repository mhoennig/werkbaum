/* Frühere Stände (D54) — die entscheidbare Hälfte, ohne DOM und ohne Speicher.

   Herausgezogen, nachdem ein Fehler durch alle Prüfungen kam, den ein Test in
   einer Zeile gefunden hätte: Der Knopf „von Hand sichern" legte nichts weg,
   solange am Dokument noch nichts geändert war (D54-Nachtrag 2). Die Regel
   dafür ist reine Logik — sie hing nur an `localStorage`, `Date.now()` und
   dem `<textarea>` fest und war deshalb nicht prüfbar.

   Seit RFC 002 (Schema v3) liegen die Stände je Dokument unter einem eigenen
   Schlüssel `werkbaum-snaps:<id>` — der alte Sammel-Schlüssel ließ jeden
   Voll-Flush die Stände des anderen Fensters wegwerfen, die Rettungs-
   Sicherungen eingeschlossen (Befund 3). Nur der Quota-Notfall fasst noch
   einen fremden Schlüssel an (§6.8, bewusst so belassen: Dokumente gehen
   vor Ständen, D54).

   Aufteilung wie bei den übrigen Modulen: Hier steht, WAS gilt; in
   app.js bleibt, WOHER die Werte kommen (aktives Dokument, Schreibschutz,
   Menü) und WOHIN sie gehen (`localStorage`). Der Speicher wird als
   `{getItem, setItem, removeItem}` hereingereicht, die Schlüsselliste dazu
   (im Browser `Object.keys(localStorage)`) — beides lässt sich im Test
   stellen.

   Datenform: je Schlüssel eine Liste `[{t, text}, …]`, ältester Stand zuerst. */

import { DOC_SNAPS_PREFIX } from './docstore.js';

export const SNAP_EVERY = 10 * 60 * 1000;
export const SNAP_KEEP = 20;

export function snapKey(id){ return DOC_SNAPS_PREFIX + id; }

/* Was aus dem Speicher kommt, ist fremder Text: Es kann von einer älteren
   Fassung stammen, von Hand bearbeitet oder halb geschrieben sein. Alles, was
   nicht die erwartete Form hat, fällt weg statt später beim Lesen zu
   stolpern — Stände sind ein Sicherheitsnetz, sie dürfen die App nicht
   umbringen. */
export function parseSnaps(raw){
  let o;
  try{ o = JSON.parse(raw || 'null'); }
  catch(_){ return []; }
  if(!Array.isArray(o)) return [];
  return o.filter(s => s && typeof s.text === 'string' && typeof s.t === 'number');
}

/* Die Stände EINES Dokuments aus dem Speicher lesen. */
export function readSnapList(storage, id){
  return parseSnaps(storage.getItem(snapKey(id)));
}

/* Alle Stände des Speichers lesen — beim Laden, aus den Schlüsseln. Ein
   Schlüssel ohne brauchbare Liste fällt still weg. */
export function readAllSnaps(storage, allKeys){
  const out = {};
  for(const k of (allKeys || [])){
    if(typeof k !== 'string' || !k.startsWith(DOC_SNAPS_PREFIX)) continue;
    const liste = parseSnaps(storage.getItem(k));
    if(liste.length) out[k.slice(DOC_SNAPS_PREFIX.length)] = liste;
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
   noch einer da war — im GEDÄCHTNIS; den Speicher pflegt persistSnaps.
   Über alle, nicht nur im aktiven Dokument: Wenn der Platz knapp wird, ist
   das Älteste das Entbehrlichste, gleich zu welchem Dokument es gehört. */
export function dropOldestSnap(snaps){
  let id = null, t = Infinity;
  for(const k in snaps){
    const l = snaps[k];
    if(l && l.length && l[0].t < t){ t = l[0].t; id = k; }
  }
  if(id === null) return null;
  snaps[id].shift();
  if(!snaps[id].length) delete snaps[id];
  return id;
}

/* Die Stände eines Dokuments schreiben. Der Platz im Speicher ist geteilt —
   läuft er über, sollen die **Dokumente** überleben, nicht ihre Stände (D54):
   Der älteste Stand geht zuerst, dokumentübergreifend. Dabei wird ein fremder
   Schlüssel nur im Notfall angefasst — und dann lesend geändert, nie aus dem
   eigenen Gedächtnis überschrieben (§6.8). Gibt zurück, ob etwas gespeichert
   wurde. */
export function persistSnaps(storage, snaps, id, allKeys){
  for(;;){
    try{ storage.setItem(snapKey(id), JSON.stringify(snaps[id] || [])); return true; }
    catch(_){
      const opfer = dropOldestSnap(snaps);
      if(opfer === null){
        /* Nichts mehr da — den eigenen Schlüssel frei geben. */
        delete snaps[id];
        try{ storage.removeItem(snapKey(id)); }catch(_){}
        return false;
      }
      if(opfer !== id){
        /* Der älteste Stand lag bei einem fremden Dokument — dessen Schlüssel
           im Speicher nachziehen (lesen, kürzen, schreiben), den Cache hier
           verwerfen; beim nächsten Öffnen des Menüs frisch gelesen. */
        const fremd = parseSnaps(storage.getItem(snapKey(opfer)));
        fremd.shift();
        try{
          if(fremd.length) storage.setItem(snapKey(opfer), JSON.stringify(fremd));
          else storage.removeItem(snapKey(opfer));
        }catch(__){
          try{ storage.removeItem(snapKey(opfer)); }catch(___){}
        }
        delete snaps[opfer];
      }
      /* Eigener Verlust: die Liste schrumpfte im Gedächtnis mit — der nächste
         Versuch schreibt weniger. */
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
