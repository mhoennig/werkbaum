import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { personFoldSet, allTags } from '../src/model.js';

/* Personen-Linse (SPEC §9, D87): personFoldSet liefert einen VOLLSTÄNDIGEN
   Faltzustand — offen bleiben nur die Vorfahren der getaggten Knoten, die
   getaggten selbst klappen zu; tag === null ist die Unzugewiesen-Linse. */

const PLAN = `Projekt
  - Backend @anna
    - Auth (S)
    - API (M) @ben
  - Frontend @ben
    - Views (S)
      - Detail (XS)
  - Infra
    - CI (S) @anna
    - Deploy (S)
  - Doku (S)
`;

function byLabel(roots){
  const map = new Map();
  const walk = ns => { for(const n of ns){ map.set(n.label, n); walk(n.children); } };
  walk(roots);
  return map;
}
function labels(set){ return [...set].map(n => n.label).sort(); }

describe('personFoldSet — Personen-Linse (D87)', () => {
  const roots = parse(PLAN).roots;
  const N = byLabel(roots);

  it('getaggte Knoten klappen zu, ihre Vorfahren bleiben offen', () => {
    const set = personFoldSet(roots, 'anna');
    expect(set.has(N.get('Backend'))).toBe(true);       /* @anna, zu — ▸ vertritt das Paket */
    expect(set.has(N.get('Projekt'))).toBe(false);      /* Vorfahr von annas Knoten */
    expect(set.has(N.get('Infra'))).toBe(false);        /* Vorfahr von annas CI */
  });

  it('Teilbäume ohne den Tag klappen an ihrer Wurzel zu', () => {
    const set = personFoldSet(roots, 'anna');
    expect(set.has(N.get('Frontend'))).toBe(true);      /* @ben — nichts von anna darin */
    expect(labels(set)).toContain('Views');             /* auch tiefer: vollständiger Zustand */
  });

  it('ein getaggtes Blatt ist nicht in der Menge — es gibt nichts zu falten', () => {
    const set = personFoldSet(roots, 'anna');
    expect(set.has(N.get('CI'))).toBe(false);
  });

  it('Vorfahr mit fremdem Tag bleibt offen, wenn der gesuchte Tag darunter liegt', () => {
    const set = personFoldSet(roots, 'ben');
    expect(set.has(N.get('Backend'))).toBe(false);      /* enthält bens API */
    expect(set.has(N.get('Frontend'))).toBe(true);      /* @ben selbst — zu */
    expect(set.has(N.get('Infra'))).toBe(true);         /* nichts von ben */
  });

  it('Unzugewiesen-Linse: jeder Knoten mit eigenen Tags klappt zu', () => {
    const set = personFoldSet(roots, null);
    expect(labels(set)).toEqual(['Backend', 'Frontend']);  /* CI ist Blatt, Infra untagged */
  });
});

describe('allTags — Einträge der Personen-Leiste (D87)', () => {
  it('liefert die Tags in Dokumentreihenfolge, ohne Doppelte', () => {
    expect(allTags(parse(PLAN).roots)).toEqual(['anna', 'ben']);
  });
  it('leer ohne Tags', () => {
    expect(allTags(parse('- A\n  - B').roots)).toEqual([]);
  });
});
