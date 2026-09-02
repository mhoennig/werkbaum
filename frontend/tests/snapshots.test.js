import { describe, it, expect } from 'vitest';
import { SNAP_EVERY, SNAP_KEEP, parseSnaps, addSnapshot, dropOldestSnap,
         persistSnaps, readSnapList, readAllSnaps, snapLabel, snapKey } from '../src/snapshots.js';
import { DOC_SNAPS_PREFIX } from '../src/docstore.js';

/* Frühere Stände (D54). Herausgezogen aus app.js, damit genau das prüfbar
   wird, was dort dreimal daneben lag: die Regel, wann ein Stand entsteht.
   Seit RFC 002 liegt JEDES Dokument unter eigenem Schlüssel — der alte
   Sammel-Schlüssel ließ den Flush des einen Fensters die Stände des anderen
   wegwerfen, die Rettungs-Sicherungen eingeschlossen (Befund 3). */

describe('addSnapshot — Takt und Knopf unterscheiden sich in einer Sache', () => {
  /* DER gemeldete Fehler (D54-Nachtrag 2): Dokument geöffnet, nichts geändert,
     Knopf gedrückt — und nichts wurde gesichert, obwohl der Knopf bestätigte.
     Diese eine Zusicherung hätte ihn vor dem Ausliefern gefunden. */
  it('Knopf sichert auch, wenn seit dem Öffnen nichts geändert wurde', () => {
    const snaps = {};
    expect(addSnapshot(snaps, 'a', 'Plan', 1000, {base: 'Plan', manual: true})).toBe(true);
    expect(snaps.a).toEqual([{t: 1000, text: 'Plan'}]);
  });

  it('Takt sammelt ein bloß angesehenes Dokument nicht', () => {
    const snaps = {};
    expect(addSnapshot(snaps, 'a', 'Plan', 1000, {base: 'Plan'})).toBe(false);
    expect(snaps.a).toEqual([]);
  });

  it('Takt sichert, sobald sich etwas geändert hat', () => {
    const snaps = {};
    expect(addSnapshot(snaps, 'a', 'Plan neu', 1000, {base: 'Plan'})).toBe(true);
    expect(snaps.a).toHaveLength(1);
  });

  /* Sobald es einen Eintrag gibt, zählt für beide dasselbe: der letzte. Der
     Knopf soll keinen doppelten Eintrag erzeugen — er verspricht „dein Stand
     ist gesichert", nicht „ein Eintrag wurde erzeugt". */
  it.each([['Knopf', true], ['Takt', false]])(
    '%s legt keinen Doppelten an, wenn der Text schon oben in der Liste steht',
    (_name, manual) => {
      const snaps = {a: [{t: 1, text: 'Plan'}]};
      expect(addSnapshot(snaps, 'a', 'Plan', 2000, {base: 'ganz was anderes', manual})).toBe(false);
      expect(snaps.a).toHaveLength(1);
    });

  it('sichert wieder, sobald sich der Text vom letzten Eintrag unterscheidet', () => {
    const snaps = {a: [{t: 1, text: 'Plan'}]};
    expect(addSnapshot(snaps, 'a', 'Plan+', 2000, {base: 'Plan', manual: true})).toBe(true);
    expect(snaps.a.map(s => s.text)).toEqual(['Plan', 'Plan+']);
  });

  it('unterscheidet die Dokumente', () => {
    const snaps = {};
    addSnapshot(snaps, 'a', 'A', 1000, {manual: true});
    addSnapshot(snaps, 'b', 'B', 1001, {manual: true});
    expect(Object.keys(snaps)).toEqual(['a', 'b']);
    expect(snaps.b).toEqual([{t: 1001, text: 'B'}]);
  });

  /* Ohne `base` (kein Dokument geöffnet, frischer Zustand) darf auch der Takt
     sichern — verglichen wird dann gegen nichts. */
  it('ohne Optionen wird gesichert', () => {
    const snaps = {};
    expect(addSnapshot(snaps, 'a', 'Plan', 1000)).toBe(true);
  });
});

describe('addSnapshot — es bleiben die letzten 20', () => {
  it('deckelt bei SNAP_KEEP und wirft den ältesten weg', () => {
    const snaps = {};
    for(let i = 0; i < SNAP_KEEP + 9; i++) addSnapshot(snaps, 'a', 'T' + i, i, {manual: true});
    expect(snaps.a).toHaveLength(SNAP_KEEP);
    expect(snaps.a[0].text).toBe('T9');                       /* T0…T8 sind weg */
    expect(snaps.a[SNAP_KEEP - 1].text).toBe('T' + (SNAP_KEEP + 8));
    expect(snaps.a.map(s => s.t)).toEqual([...snaps.a.map(s => s.t)].sort((x, y) => x - y));
  });
});

describe('dropOldestSnap — das Älteste geht zuerst, dokumentübergreifend (im Gedächtnis)', () => {
  it('trifft das älteste über alle Dokumente hinweg und sagt, welches es war', () => {
    const snaps = {a: [{t: 50, text: 'a1'}], b: [{t: 10, text: 'b1'}, {t: 60, text: 'b2'}]};
    expect(dropOldestSnap(snaps)).toBe('b');
    expect(snaps.b.map(s => s.text)).toEqual(['b2']);
    expect(snaps.a).toHaveLength(1);
  });

  it('räumt ein leer gewordenes Dokument ganz weg', () => {
    const snaps = {a: [{t: 50, text: 'a1'}]};
    dropOldestSnap(snaps);
    expect(snaps).toEqual({});
  });

  it('meldet null, wenn nichts mehr da ist', () => {
    expect(dropOldestSnap({})).toBe(null);
    expect(dropOldestSnap({a: []})).toBe(null);
  });
});

/* Der Speicher ist mit den Dokumenten geteilt. Läuft er über, sollen die
   Dokumente überleben — Stände sind das Nachgeben-Bare. */
describe('persistSnaps — je Dokument geschrieben, Verdrängung über die Schlüssel', () => {
  function speicher(limit){
    const m = new Map();
    return {
      getItem: k => (m.has(k) ? m.get(k) : null),
      setItem(k, v){
        if(String(v).length > limit) throw new Error('QuotaExceededError');
        m.set(k, String(v));
      },
      removeItem: k => m.delete(k),
      keys: () => [...m.keys()],
      map: m,
    };
  }

  it('speichert unter dem Schlüssel des Dokuments, wenn es passt', () => {
    const store = speicher(1e6), snaps = {a: [{t: 1, text: 'kurz'}]};
    expect(persistSnaps(store, snaps, 'a', store.keys())).toBe(true);
    expect(JSON.parse(store.getItem(snapKey('a')))).toEqual(snaps.a);
  });

  it('wirft den ältesten Stand des EIGENEN Dokuments weg, bis der eigene Schlüssel passt', () => {
    const snaps = {a: [{t: 1, text: 'x'.repeat(200)}, {t: 3, text: 'y'.repeat(200)}]};
    const store = speicher(220);          /* eine Liste (217 Zeichen) passt, beide nicht */
    expect(persistSnaps(store, snaps, 'a', store.keys())).toBe(true);
    expect(snaps.a.map(s => s.t)).toEqual([3]);
  });

  it('greift im Notfall auf den ältesten Stand EINES FREMDEN Dokuments zurück — lesend, §6.8', () => {
    const snaps = {a: [{t: 9, text: 'x'.repeat(200)}, {t: 20, text: 'y'.repeat(200)}],
                   b: [{t: 1, text: 'p'.repeat(100)}, {t: 4, text: 'q'.repeat(100)}]};
    const store = speicher(220);
    store.map.set(snapKey('b'), JSON.stringify(snaps.b));   /* der Zustand des anderen Fensters */
    expect(persistSnaps(store, snaps, 'a', store.keys())).toBe(true);
    /* Der älteste Stand (t:1) war b's — sein Schlüssel im Speicher wurde
       gekürzt, nicht aus dem Gedächtnis überschrieben; dann räumte der
       eigene älteste, bis a passte. */
    expect(snaps.a.map(s => s.t)).toEqual([20]);
    expect(JSON.parse(store.getItem(snapKey('b'))).map(s => s.t)).toEqual([4]);
    expect(snaps.b).toBeUndefined();   /* Cache verworfen — beim nächsten Öffnen frisch gelesen */
  });

  it('entfernt den fremden Schlüssel ganz, wenn sein letzter Stand gefallen ist', () => {
    const snaps = {a: [{t: 9, text: 'x'.repeat(200)}, {t: 20, text: 'y'.repeat(200)}],
                   b: [{t: 1, text: 'p'.repeat(100)}]};
    const store = speicher(220);
    store.map.set(snapKey('b'), JSON.stringify(snaps.b));
    expect(persistSnaps(store, snaps, 'a', store.keys())).toBe(true);
    expect(store.getItem(snapKey('b'))).toBe(null);   /* sein letzter Stand ging */
  });

  it('gibt auf und räumt den eigenen Schlüssel weg, wenn selbst leer nicht passt', () => {
    const snaps = {a: [{t: 1, text: 'x'}]};
    const store = speicher(1);            /* nicht einmal "[]" passt */
    expect(persistSnaps(store, snaps, 'a', store.keys())).toBe(false);
    expect(store.getItem(snapKey('a'))).toBe(null);
    expect(snaps).toEqual({});
  });
});

/* Beim Laden werden die Schlüssel gelesen — ein Schlüssel ohne brauchbare
   Liste fällt still weg. */
describe('readAllSnaps / readSnapList — die Stände liegen je Dokument', () => {
  const store = {
    getItem: k => ({[snapKey('a')]: '[{"t":1,"text":"x"}]',
                    [snapKey('b')]: '{kaputt',
                    [snapKey('c')]: '[]'}[k] ?? null),
  };
  const keys = [snapKey('a'), snapKey('b'), snapKey('c'), 'werkbaum-ui'];

  it('readAllSnaps liest alle Dokumente aus den Schlüsseln', () => {
    expect(readAllSnaps(store, Object.keys({})).a).toBeUndefined();   /* ohne Schlüsselliste: nichts */
    expect(Object.keys(readAllSnaps(store, [snapKey('a'), snapKey('b'), snapKey('c'), 'werkbaum-ui'])))
      .toEqual(['a']);
  });

  it('readSnapList liest eine Liste, beschädigter Inhalt wird eine leere Liste', () => {
    expect(readSnapList(store, 'a')).toEqual([{t: 1, text: 'x'}]);
    expect(readSnapList(store, 'b')).toEqual([]);
    expect(readSnapList(store, 'gibtsnicht')).toEqual([]);
  });

  it('parseSnaps wirft Einträge weg, die nicht die erwartete Form haben', () => {
    const raw = JSON.stringify([{t: 1, text: 'gut'}, {t: 'später', text: 'x'}, {t: 2}, null, {text: 'ohne t'}]);
    expect(parseSnaps(raw)).toEqual([{t: 1, text: 'gut'}]);
  });

  it.each([
    ['leer',              null],
    ['leerer String',     ''],
    ['kaputtes JSON',     '{nicht json'],
    ['keine Liste',       '"text"'],
    ['Objekt statt Liste', '{"a":1}'],
    ['null',              'null'],
  ])('gibt bei %s eine leere Liste zurück', (_name, raw) => {
    expect(parseSnaps(raw)).toEqual([]);
  });
});

describe('snapKey — der Schlüssel trägt das Präfix des Ablageschemas', () => {
  it('werkbaum-snaps:<id>', () => {
    expect(snapKey('example')).toBe(DOC_SNAPS_PREFIX + 'example');
    expect(snapKey('live:https://x/api/v1/documents/a')).toBe(DOC_SNAPS_PREFIX + 'live:https://x/api/v1/documents/a');
  });
});

describe('snapLabel — heute die Uhrzeit, sonst mit Datum', () => {
  const ts = Date.UTC(2026, 2, 5, 14, 37);            /* 5. März 2026, 14:37 UTC */

  it('nennt am selben Tag nur die Uhrzeit', () => {
    const label = snapLabel(ts, 'de-DE', ts + 60 * 1000);
    expect(label).toMatch(/\d{2}:\d{2}/);
    expect(label).not.toMatch(/05|03\./);              /* kein Tag, kein Monat */
  });

  it('nennt an einem anderen Tag auch das Datum', () => {
    const label = snapLabel(ts, 'de-DE', ts + 36 * 60 * 60 * 1000);
    expect(label).toMatch(/05/);
    expect(label.length).toBeGreaterThan(snapLabel(ts, 'de-DE', ts).length);
  });

  /* Die Grenze ist der Kalendertag, nicht „vor 24 Stunden“. */
  it('zählt den Kalendertag, nicht die verstrichene Zeit', () => {
    const kurzNachMitternacht = Date.UTC(2026, 2, 6, 0, 30);
    expect(snapLabel(ts, 'de-DE', kurzNachMitternacht)).toMatch(/05/);
  });

  it('fällt auf eine lesbare Form zurück, wenn die Sprache unbekannt ist', () => {
    expect(snapLabel(ts, 'xx-!', ts)).toBe('2026-03-05 14:37');
  });
});

