import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { taigaSlugs } from '../src/model.js';

/* Schlagworte `&tag` (SPEC §1, D91): Extraktion im Parser und die
   `taiga.*`-Vererbung in model.js — der erste Konsument der reservierten
   freien Schlagworte (Projekt-Vorbelegung der Ticket-Anlage). */

describe('parse — Schlagworte &tag (SPEC §1, D91)', () => {
  it('extrahiert alleinstehende &-Token aus dem Label', () => {
    const { roots, warnings } = parse('- Backend &taiga.intern &infra (M)');
    expect(roots[0].label).toBe('Backend');
    expect(roots[0].marks).toEqual(['taiga.intern', 'infra']);
    expect(roots[0].size).toBe('M');
    expect(warnings).toEqual([]);
  });

  it('Zeichenmenge wie @name: Punkt, Unterstrich, Bindestrich, Unicode', () => {
    const { roots } = parse('- X &über_a.b-c');
    expect(roots[0].marks).toEqual(['über_a.b-c']);
  });

  it('nur alleinstehend angesetzt: R&D und Drag & Drop bleiben Labels', () => {
    const { roots } = parse('- R&D für Drag & Drop');
    expect(roots[0].marks).toEqual([]);
    expect(roots[0].label).toBe('R&D für Drag & Drop');
  });

  it('Zitier-Konvention: (&taiga.slug) bleibt Label', () => {
    const { roots } = parse('- (&taiga.slug) benennt das Projekt');
    expect(roots[0].marks).toEqual([]);
    expect(roots[0].label).toBe('(&taiga.slug) benennt das Projekt');
  });

  it('ein & in einer URL bleibt Teil der URL (URL wird zuerst extrahiert)', () => {
    const { roots } = parse('- Suche https://example.org/?a=1&b=2');
    expect(roots[0].url).toBe('https://example.org/?a=1&b=2');
    expect(roots[0].marks).toEqual([]);
  });

  it('ein Schlagwort hinter %% wirkt nicht (Kommentar fällt zuerst weg)', () => {
    const { roots } = parse('- Backend %% &taiga.intern');
    expect(roots[0].marks).toEqual([]);
  });

  it('ändert weder Status noch Notwendigkeit noch Kosten-Felder', () => {
    const { roots } = parse('+ [x] Zugabe &taiga.intern (S)');
    const n = roots[0];
    expect(n.optional).toBe(true);
    expect(n.status.key).toBe('fertig');
    expect(n.size).toBe('S');
  });
});

describe('taigaSlugs — Projekt-Vererbung (SPEC §1, D91-Nachtrag 3)', () => {
  const tree = text => parse(text).roots;

  it('eigenes taiga.*-Schlagwort setzt den Slug, Nachkommen erben ihn', () => {
    const roots = tree('- Wurzel &taiga.intern\n  - Kind\n    - Enkel');
    const map = taigaSlugs(roots);
    expect(map.get(roots[0])).toBe('intern');
    expect(map.get(roots[0].children[0])).toBe('intern');
    expect(map.get(roots[0].children[0].children[0])).toBe('intern');
  });

  it('ein eigenes Schlagwort am Knoten übersteuert das geerbte', () => {
    const r = tree('- Wurzel &taiga.a\n  - Kind &taiga.b\n    - Enkel\n  - Bruder');
    const m = taigaSlugs(r);
    expect(m.get(r[0])).toBe('a');
    expect(m.get(r[0].children[0])).toBe('b');
    expect(m.get(r[0].children[0].children[0])).toBe('b');
    expect(m.get(r[0].children[1])).toBe('a');
  });

  it('ohne taiga.*-Vorfahren gibt es keinen Eintrag', () => {
    const r = tree('- Wurzel &infra\n  - Kind');
    const m = taigaSlugs(r);
    expect(m.has(r[0])).toBe(false);
    expect(m.has(r[0].children[0])).toBe(false);
  });

  it('mehrere taiga.*-Schlagworte auf einer Zeile: das erste gilt', () => {
    const r = tree('- Wurzel &taiga.a &taiga.b');
    expect(taigaSlugs(r).get(r[0])).toBe('a');
  });

  it('das nackte &taiga. ohne Slug zählt nicht', () => {
    const r = tree('- Wurzel &taiga.');
    expect(taigaSlugs(r).has(r[0])).toBe(false);
  });
});
