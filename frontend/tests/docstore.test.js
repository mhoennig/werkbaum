import { describe, it, expect } from 'vitest';
import { readDocs, storeDocs, storeDocText, docTextKey,
         LS_DOCS, LS_SRC, DOC_TEXT_PREFIX } from '../src/docstore.js';

/* Storage-Attrappe mit Zähler — die Vergleich-vor-Schreiben-Regel ist nur
   über die Zahl der setItem-Aufrufe zu beweisen. */
function mem(init){
  const m = new Map(Object.entries(init || {}));
  let writes = 0;
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { writes++; m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    keys: () => [...m.keys()],
    writes: () => writes,
  };
}

const A = {id: 'example', name: 'Example', text: '- a'};
const B = {id: 'k1', name: 'Sprint 15', text: '- b', source: 'https://x.example/p'};

describe('docstore — Index + Text je Dokument (D83)', () => {
  it('Rundreise: storeDocs schreibt, readDocs liest dasselbe zurück', () => {
    const s = mem();
    storeDocs(s, [A, B], s.keys());
    expect(readDocs(s)).toEqual({docs: [A, B], legacy: false});
  });

  it('der Index trägt KEINEN Text — der liegt je Dokument unter eigenem Schlüssel', () => {
    const s = mem();
    storeDocs(s, [A], s.keys());
    expect(s.getItem(LS_DOCS)).not.toContain('- a');
    expect(s.getItem(docTextKey('example'))).toBe('- a');
  });

  it('Altformat (Texte im Array) wird gelesen und als legacy gemeldet', () => {
    const s = mem({[LS_DOCS]: JSON.stringify([A, B])});
    const r = readDocs(s);
    expect(r.legacy).toBe(true);
    expect(r.docs).toEqual([A, B]);
  });

  it('ein fehlender Text-Schlüssel kostet nur diesen einen Text, nicht die Liste', () => {
    const s = mem();
    storeDocs(s, [A, B], s.keys());
    s.removeItem(docTextKey('k1'));
    const r = readDocs(s);
    expect(r.docs.map(d => d.id)).toEqual(['example', 'k1']);
    expect(r.docs[1].text).toBe('');
    expect(r.docs[0].text).toBe('- a');
  });

  it('kaputter oder unbrauchbarer Index -> null (Beispiel-Pfad des Aufrufers)', () => {
    expect(readDocs(mem({[LS_DOCS]: '{kaputt'}))).toBe(null);
    expect(readDocs(mem({[LS_DOCS]: '"kein Array"'}))).toBe(null);
    expect(readDocs(mem({[LS_DOCS]: '[]'}))).toBe(null);
    expect(readDocs(mem({[LS_DOCS]: JSON.stringify([{name: 'ohne id'}])}))).toBe(null);
    expect(readDocs(mem())).toBe(null);
  });

  it('unveränderte Schlüssel werden nicht neu geschrieben', () => {
    const s = mem();
    storeDocs(s, [A, B], s.keys());
    const vorher = s.writes();
    storeDocs(s, [A, B], s.keys());          /* nichts geändert */
    expect(s.writes()).toBe(vorher);
    storeDocs(s, [A, {...B, text: '- b2'}], s.keys());   /* ein Text geändert */
    expect(s.writes()).toBe(vorher + 1);
  });

  it('Texte gelöschter Dokumente werden abgeräumt, fremde Schlüssel bleiben', () => {
    const s = mem({'werkbaum-ui': '{}'});
    storeDocs(s, [A, B], s.keys());
    storeDocs(s, [A], s.keys());             /* B gelöscht */
    expect(s.getItem(docTextKey('k1'))).toBe(null);
    expect(s.getItem('werkbaum-ui')).toBe('{}');
  });

  it('storeDocText schreibt Text-Schlüssel UND Spiegel — und nur bei Änderung', () => {
    const s = mem();
    storeDocText(s, 'example', '- neu');
    expect(s.getItem(docTextKey('example'))).toBe('- neu');
    expect(s.getItem(LS_SRC)).toBe('- neu');
    const vorher = s.writes();
    storeDocText(s, 'example', '- neu');
    expect(s.writes()).toBe(vorher);
  });

  it('ids mit Doppelpunkten und URLs (live:/url:) tragen als Schlüssel', () => {
    const live = {id: 'live:https://w.example/api/v1/documents/abc', name: 'Plan', text: '- x'};
    const s = mem();
    storeDocs(s, [live], s.keys());
    expect(readDocs(s).docs).toEqual([live]);
    expect(s.getItem(DOC_TEXT_PREFIX + live.id)).toBe('- x');
  });

  it('fehlender Name fällt auf die id zurück, Quota-Fehler laufen zum Aufrufer', () => {
    const s = mem({[LS_DOCS]: JSON.stringify([{id: 'x'}])});
    expect(readDocs(s).docs[0].name).toBe('x');
    const voll = {getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); }, removeItem: () => {}};
    expect(() => storeDocs(voll, [A], [])).toThrow();
  });
});
