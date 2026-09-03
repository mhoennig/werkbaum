import { describe, it, expect } from 'vitest';
import { readDocs, writeDoc, writeIndexHint, removeDoc, expireTombstones,
         migrateV3, storeDocText, readMeta, hasTombstone, docTextKey, docMetaKey,
         docGoneKey, isDocKey, GONE_TTL,
         LS_DOCS, LS_SRC, DOC_TEXT_PREFIX, DOC_META_PREFIX, DOC_GONE_PREFIX,
         DOC_SNAPS_PREFIX, LEGACY_SNAPS } from '../src/docstore.js';

/* Storage-Attrappe mit ZÄHLERN JE SCHLÜSSEL — die Hausregel des Schemas v3
   („kein Fenster schreibt je den Schlüssel eines anderen", RFC 002 §6.1) ist
   nur über die Zahl der Zugriffe je Schlüssel zu beweisen. Fiele der alte
   Orphan-Sweep des D83-Voll-Flushes zurück, fiele GENAU dieser Test. */
function mem(init){
  const m = new Map(Object.entries(init || {}));
  const schreib = new Map(), loesch = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { schreib.set(k, (schreib.get(k) || 0) + 1); m.set(k, String(v)); },
    removeItem: k => { schreib.set(k, (schreib.get(k) || 0) - 1); m.delete(k); },
    keys: () => [...m.keys()],
    schreibFuer: k => schreib.get(k) || 0,
    schreibGesamt: () => [...schreib.values()].reduce((a, b) => a + Math.abs(b), 0),
    map: m,
  };
}

const A = {id: 'example', name: 'Example', text: '- a'};
const B = {id: 'k1', name: 'Sprint 15', text: '- b', source: 'https://x.example/p'};
const JETZT = 1750000000000;

function schreiben(s, doc, opts){ return writeDoc(s, doc, {now: JETZT, ...opts}); }
function dokumente(s, keys){ return readDocs(s, keys ?? s.keys()); }

describe('docstore v3 — Union-Lesen (§6.1)', () => {
  it('Rundreise: writeDoc schreibt, readDocs liest dasselbe zurück', () => {
    const s = mem();
    schreiben(s, A);
    schreiben(s, B);
    expect(dokumente(s)).toEqual({docs: [A, B], legacy: false});
  });

  it('Meta trägt Name, Quelle und born — der Text liegt je Dokument unter eigenem Schlüssel', () => {
    const s = mem();
    schreiben(s, B);
    expect(readMeta(s, B.id)).toEqual({name: B.name, source: B.source, born: JETZT});
    expect(s.getItem(LS_DOCS)).toBe(null);
    expect(s.getItem(docTextKey(B.id))).toBe('- b');
  });

  it('Altformat (Texte im Index-Array) wird gelesen und als legacy gemeldet', () => {
    const s = mem({[LS_DOCS]: JSON.stringify([A, B])});
    const r = dokumente(s);
    expect(r.legacy).toBe(true);
    expect(r.docs).toEqual([A, B]);
  });

  it('Union: ein Dokument mit Text-Schlüssel, aber ohne Meta und ohne Index, wird gefunden', () => {
    const s = mem();
    schreiben(s, A);
    s.setItem(DOC_TEXT_PREFIX + 'fremd', '- ein Nachzügler');
    const r = dokumente(s);
    expect(r.docs.map(d => d.id)).toEqual(['example', 'fremd']);
    expect(r.docs[1].name).toBe('fremd');
  });

  it('Reihenfolge: Index zuerst, Nachzügler nach born', () => {
    const s = mem();
    schreiben(s, {...A, born: 100}, {now: 100});
    schreiben(s, B, {now: 50});
    writeIndexHint(s, [{id: 'k1', name: B.name}]);
    const r = dokumente(s);
    expect(r.docs.map(d => d.id)).toEqual(['k1', 'example']);   /* Index ('k1') vor dem Nachzügler */
  });

  it('Name aus Meta gewinnt vor dem Index-Hinweis', () => {
    const s = mem();
    schreiben(s, {...A, name: 'Neuer Name'});
    writeIndexHint(s, [{id: A.id, name: 'Alter Indexname'}]);
    expect(dokumente(s).docs[0].name).toBe('Neuer Name');
  });

  it('ein Index-Eintrag ohne Text und ohne Meta ist ein Rest und wird ignoriert', () => {
    const s = mem({[LS_DOCS]: JSON.stringify([{id: 'ghost', name: 'Gespenst'}, {id: 'd1', name: 'Da'}])});
    s.setItem(docTextKey('d1'), '- x');
    expect(dokumente(s).docs.map(d => d.id)).toEqual(['d1']);
  });

  it('ein fehlender Text-Schlüssel kostet nur diesen einen Text, nicht die Liste', () => {
    const s = mem();
    schreiben(s, A);
    schreiben(s, B);
    s.removeItem(docTextKey(B.id));
    const r = dokumente(s);
    expect(r.docs.map(d => d.id)).toEqual(['example', 'k1']);
    expect(r.docs[1].text).toBe('');
  });

  it('kaputter oder fehlender Index ist nur ein Hinweis — die eigenen Schlüssel zählen weiter', () => {
    const s = mem({[LS_DOCS]: '{kaputt'});
    schreiben(s, A);
    expect(dokumente(s).docs.map(d => d.id)).toEqual(['example']);
    expect(dokumente(mem())).toBe(null);
  });

  it('ids mit Doppelpunkten und URLs (live:/url:) tragen als Schlüssel', () => {
    const live = {id: 'live:https://w.example/api/v1/documents/abc', name: 'Plan', text: '- x'};
    const s = mem();
    schreiben(s, live);
    expect(dokumente(s).docs).toEqual([live]);
    expect(s.getItem(DOC_TEXT_PREFIX + live.id)).toBe('- x');
  });
});

describe('docstore v3 — Tombstones (§6.2)', () => {
  it('gelöscht bleibt gelöscht: der Tombstone nimmt die id aus dem Lesen', () => {
    const s = mem();
    schreiben(s, A);
    removeDoc(s, A.id, JETZT);
    expect(hasTombstone(s, A.id)).toBe(true);
    expect(s.getItem(docTextKey(A.id))).toBe(null);
    expect(s.getItem(docMetaKey(A.id))).toBe(null);
    expect(s.getItem(DOC_SNAPS_PREFIX + A.id)).toBe(null);
    expect(dokumente(s)).toBe(null);
  });

  it('ein Tombstone blockiert das stille Wiederanlegen — Tippen hebt ihn auf', () => {
    const s = mem();
    schreiben(s, A);
    removeDoc(s, A.id, JETZT);
    expect(writeDoc(s, {...A, text: '- neu'}, {now: JETZT})).toBe(false);   /* Flush schreibt nicht */
    expect(hasTombstone(s, A.id)).toBe(true);
    expect(writeDoc(s, {...A, text: '- neu'}, {now: JETZT, typed: true})).toBe(true);  /* Tippen ist Absicht */
    expect(hasTombstone(s, A.id)).toBe(false);
    expect(s.getItem(docTextKey(A.id))).toBe('- neu');
  });

  it('storeDocText (der Tastendruck) hebt den Tombstone selbst', () => {
    const s = mem();
    removeDoc(s, A.id, JETZT);
    storeDocText(s, A.id, '- getippt');
    expect(hasTombstone(s, A.id)).toBe(false);
    expect(s.getItem(docTextKey(A.id))).toBe('- getippt');
  });

  it('Tombstones verfallen nach 7 Tagen — junge bleiben, alte und defekte fallen', () => {
    const s = mem();
    s.setItem(docGoneKey('alt'), String(JETZT - GONE_TTL - 1));
    s.setItem(docGoneKey('jung'), String(JETZT - GONE_TTL + 1));
    s.setItem(docGoneKey('kaputt'), 'gar kein Datum');
    expireTombstones(s, s.keys(), JETZT);
    expect(hasTombstone(s, 'alt')).toBe(false);
    expect(hasTombstone(s, 'jung')).toBe(true);
    expect(hasTombstone(s, 'kaputt')).toBe(false);
  });
});

describe('docstore v3 — die Flush-Grenze: fremde Schlüssel werden nie angefasst', () => {
  /* DIE Gegenprobe des RFC (§10, Mutation): Baut jemand den Orphan-Sweep des
     D83-Voll-Flushes zurück, fällt genau dieser Test — der Schaden von damals
     (Befund 2: B's Dokument samt Text weg) ist hier als Zähler beweisbar. */
  it('persistDocs (writeDoc + writeIndexHint) schreibt nur EIGENE Schlüssel, entfernt KEINEN', () => {
    const s = mem();
    schreiben(s, A);
    /* Der Zustand, der Befund 2 war: das andere Fenster hat ein Dokument
       angelegt, das diese Liste nicht kennt. */
    const fremd = {id: 'fremdes-plan', name: 'Plan aus Fenster B', text: '- b'};
    schreiben(s, fremd);
    /* Der Flush dieses Fensters kennt nur A: Dirty-Flush + Index-Hinweis. */
    writeDoc(s, A);
    writeIndexHint(s, [{id: A.id, name: A.name}]);
    expect(s.getItem(docTextKey('fremdes-plan'))).toBe('- b');   /* unberührt … */
    expect(s.getItem(docMetaKey('fremdes-plan'))).not.toBe(null);   /* … und nicht entfernt */
    /* und nichts von B ist verloren: */
    expect(dokumente(s).docs.map(d => d.id).sort()).toEqual(['example', 'fremdes-plan']);
  });

  it('writeDoc schreibt nur Meta und Text des einen Dokuments — Zähler je Schlüssel', () => {
    const s = mem();
    schreiben(s, A);
    const zugriffe = k => s.schreibFuer(k);
    const vorA = zugriffe('werkbaum-meta:example') + zugriffe('werkbaum-doc:example');
    schreiben(s, A);                     /* dieselben Inhalte — Vergleich greift */
    expect(zugriffe('werkbaum-meta:example') + zugriffe('werkbaum-doc:example')).toBe(vorA);
    expect(zugriffe(DOC_META_PREFIX + 'k1')).toBe(0);
    expect(zugriffe(DOC_TEXT_PREFIX + 'k1')).toBe(0);
  });

  it('born bleibt erhalten: Umbenennen dreht die Ablage-Reihenfolge nicht um', () => {
    const s = mem();
    schreiben(s, {...A, born: 5}, {now: JETZT});
    writeDoc(s, {...A, name: 'Umbenannt'}, {now: JETZT + 1000});   /* ohne born im Objekt */
    expect(readMeta(s, A.id).born).toBe(5);
  });

  it('writeIndexHint schreibt den Hinweis — und löscht nichts', () => {
    const s = mem({[LS_DOCS]: JSON.stringify([{id: 'a', name: 'x'}])});
    writeIndexHint(s, []);
    expect(s.getItem(LS_DOCS)).toBe('[]');
  });
});

describe('docstore v3 — Migration (§6.1, idempotent)', () => {
  it('teilt den alten Stände-Sammel-Schlüssel auf und entfernt ihn', () => {
    const s = mem({
      [LEGACY_SNAPS]: JSON.stringify({a: [{t: 1, text: 'x'}], b: [{t: 2, text: 'y'}, {t: 'kaputt'}]}),
      [DOC_TEXT_PREFIX + 'a']: '- a',
    });
    migrateV3(s, JETZT);
    expect(s.getItem(LEGACY_SNAPS)).toBe(null);
    expect(s.getItem(DOC_SNAPS_PREFIX + 'a')).toBe(JSON.stringify([{t: 1, text: 'x'}]));
    /* b's Liste bleibt — nur die defekten Einträge fallen. */
    expect(s.getItem(DOC_SNAPS_PREFIX + 'b')).toBe(JSON.stringify([{t: 2, text: 'y'}]));
    /* Ohne Index gibt es keine Meta-Quelle — 'a' bleibt ein Nachzügler. */
    expect(readMeta(s, 'a')).toBe(null);
  });

  it('zweimal laufen = einmal laufen (gleicher Inhalt, keine zusätzlichen Schreibvorgänge)', () => {
    const s = mem({
      [LEGACY_SNAPS]: JSON.stringify({a: [{t: 1, text: 'x'}]}),
      [LS_DOCS]: JSON.stringify([{id: 'a', name: 'A'}]),
    });
    migrateV3(s, JETZT);
    const snapshot = new Map(s.map);
    const n = s.schreibGesamt();
    migrateV3(s, JETZT + 1000);            /* zweimal: schreibt nichts mehr */
    expect(s.schreibGesamt()).toBe(n);
    expect([...s.map.entries()]).toEqual([...snapshot.entries()]);
  });

  it('schreibt Meta nur für Dokumente MIT Text — Reste ohne Text bleiben ohne Meta', () => {
    const s = mem({[LS_DOCS]: JSON.stringify([{id: 'da', name: 'Da', text: '- x'}, {id: 'rest', name: 'Rest'}])});
    migrateV3(s, JETZT);
    expect(readMeta(s, 'da')).toEqual({name: 'Da', born: JETZT});
    expect(s.getItem(DOC_TEXT_PREFIX + 'da')).toBe('- x');
    expect(readMeta(s, 'rest')).toBe(null);
    expect(s.getItem(DOC_TEXT_PREFIX + 'rest')).toBe(null);
  });

  it('bestehende Meta bleibt stehen (born kommt nicht unter die Migration)', () => {
    const s = mem({
      [LS_DOCS]: JSON.stringify([{id: 'a', name: 'Alt'}]),
      [docMetaKey('a')]: JSON.stringify({name: 'Eigenname', born: 1}),
      [DOC_TEXT_PREFIX + 'a']: '- x',
    });
    migrateV3(s, JETZT);
    expect(readMeta(s, 'a')).toEqual({name: 'Eigenname', born: 1});
  });
});

describe('storeDocText — Tastendruck-Hälfte (unverändert, plus Tombstone)', () => {
  it('schreibt Text-Schlüssel UND Spiegel — und nur bei Änderung', () => {
    const s = mem();
    storeDocText(s, 'example', '- neu');
    expect(s.getItem(docTextKey('example'))).toBe('- neu');
    expect(s.getItem(LS_SRC)).toBe('- neu');
    const vorher = s.schreibGesamt();
    storeDocText(s, 'example', '- neu');
    expect(s.schreibGesamt()).toBe(vorher);
  });

  it('Quota-Fehler laufen zum Aufrufer', () => {
    const voll = {getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => {}};
    expect(() => writeDoc(voll, A)).toThrow();
  });
});

describe('isDocKey — die Schlüssel der Synchronisation (D84, RFC 002 §6.3)', () => {
  it('erkennt Index, aktives Dokument, Spiegel, alte Stände und alle per-Dokument-Schlüssel', () => {
    expect(isDocKey(LS_DOCS)).toBe(true);
    expect(isDocKey('werkbaum-active')).toBe(true);
    expect(isDocKey(LS_SRC)).toBe(true);
    expect(isDocKey(LEGACY_SNAPS)).toBe(true);
    expect(isDocKey(DOC_TEXT_PREFIX + 'live:https://x/api/v1/documents/a')).toBe(true);
    expect(isDocKey(DOC_META_PREFIX + 'example')).toBe(true);
    expect(isDocKey(DOC_GONE_PREFIX + 'example')).toBe(true);
    expect(isDocKey(DOC_SNAPS_PREFIX + 'example')).toBe(true);
  });

  it('fremde Schlüssel und Ansicht-Zustand sind keine Dokument-Schlüssel', () => {
    expect(isDocKey('werkbaum-ui')).toBe(false);
    expect(isDocKey('werkbaum-lang')).toBe(false);
    expect(isDocKey('werkbaum-seeded')).toBe(false);
    expect(isDocKey(null)).toBe(false);
  });
});
