import { describe, it, expect } from 'vitest';
import { LS_SNAPS, SNAP_KEEP, parseSnaps, addSnapshot, dropOldestSnap,
         persistSnaps, snapLabel } from '../src/snapshots.js';

/* Frühere Stände (D54). Herausgezogen aus app.js, damit genau das prüfbar
   wird, was dort dreimal daneben lag: die Regel, wann ein Stand entsteht. */

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

describe('dropOldestSnap — das Älteste geht zuerst, dokumentübergreifend', () => {
  it('trifft das älteste über alle Dokumente hinweg', () => {
    const snaps = {a: [{t: 50, text: 'a1'}], b: [{t: 10, text: 'b1'}, {t: 60, text: 'b2'}]};
    expect(dropOldestSnap(snaps)).toBe(true);
    expect(snaps.b.map(s => s.text)).toEqual(['b2']);
    expect(snaps.a).toHaveLength(1);
  });

  it('räumt ein leer gewordenes Dokument ganz weg', () => {
    const snaps = {a: [{t: 50, text: 'a1'}]};
    dropOldestSnap(snaps);
    expect(snaps).toEqual({});
  });

  it('meldet false, wenn nichts mehr da ist', () => {
    expect(dropOldestSnap({})).toBe(false);
    expect(dropOldestSnap({a: []})).toBe(false);
  });
});

/* Der Speicher ist mit den Dokumenten geteilt. Läuft er über, sollen die
   Dokumente überleben — Stände sind das Nachgeben-Bare. */
describe('persistSnaps — Dokumente gehen vor Ständen', () => {
  function speicher(limit){
    const s = {daten: null, entfernt: false, versuche: 0};
    return Object.assign(s, {
      setItem(k, v){
        s.versuche++;
        if(v.length > limit) throw new Error('QuotaExceededError');
        s.daten = v;
      },
      removeItem(){ s.entfernt = true; }
    });
  }

  it('speichert, wenn es passt', () => {
    const store = speicher(1e6), snaps = {a: [{t: 1, text: 'kurz'}]};
    expect(persistSnaps(snaps, store)).toBe(true);
    expect(JSON.parse(store.daten)).toEqual(snaps);
    expect(store.versuche).toBe(1);
  });

  it('wirft die ältesten Stände weg, bis es passt', () => {
    const snaps = {a: [{t: 1, text: 'x'.repeat(200)}, {t: 3, text: 'y'.repeat(200)}],
                   b: [{t: 2, text: 'z'.repeat(200)}]};
    const store = speicher(300);
    expect(persistSnaps(snaps, store)).toBe(true);
    /* Übrig bleibt der jüngste — t:1 und t:2 fielen in dieser Reihenfolge. */
    expect(Object.keys(snaps)).toEqual(['a']);
    expect(snaps.a.map(s => s.t)).toEqual([3]);
  });

  it('gibt auf und räumt den Schlüssel weg, wenn selbst leer nicht passt', () => {
    const snaps = {a: [{t: 1, text: 'x'}]};
    const store = speicher(1);            /* nicht einmal "{}" passt */
    expect(persistSnaps(snaps, store)).toBe(false);
    expect(store.entfernt).toBe(true);
    expect(snaps).toEqual({});
  });

  it('speichert unter dem vereinbarten Schlüssel', () => {
    let key = null;
    persistSnaps({}, {setItem(k){ key = k; }, removeItem(){}});
    expect(key).toBe(LS_SNAPS);
  });
});

/* Was aus dem Speicher kommt, ist fremder Text: alte Fassung, von Hand
   bearbeitet, halb geschrieben. Ein Sicherheitsnetz darf daran nicht die App
   aufhängen. */
describe('parseSnaps — beschädigter Speicher bringt die App nicht um', () => {
  it('liest die erwartete Form', () => {
    const o = {a: [{t: 1, text: 'x'}]};
    expect(parseSnaps(JSON.stringify(o))).toEqual(o);
  });

  it.each([
    ['leer',              null],
    ['leerer String',     ''],
    ['kaputtes JSON',     '{nicht json'],
    ['kein Objekt',       '"text"'],
    ['Array statt Objekt', '[1,2,3]'],
    ['null',              'null'],
  ])('gibt bei %s ein leeres Objekt zurück', (_name, raw) => {
    expect(parseSnaps(raw)).toEqual({});
  });

  it('wirft Einträge weg, die nicht die erwartete Form haben', () => {
    const raw = JSON.stringify({
      a: [{t: 1, text: 'gut'}, {t: 'späth', text: 'x'}, {t: 2}, null, {text: 'ohne t'}],
      b: 'keine Liste',
      c: []
    });
    expect(parseSnaps(raw)).toEqual({a: [{t: 1, text: 'gut'}]});
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
