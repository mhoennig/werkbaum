import { describe, it, expect } from 'vitest';
import { parse, STATUS_BY_CODE, SIZE_RANK } from '../src/parser.js';

/* Kanonisches Beispiel aus docs/SPEC.md §10 — die verbindliche Fixture.
   Bei Syntaxänderungen: SPEC zuerst, dann diese Fixture + Assertions. */
const SPEC_EXAMPLE = `%% Projektstruktur – Stand Sprint 14
[~] Website-Relaunch (XL) https://wiki.example.de/relaunch
  - [x] Konzeption (M)
    - [x] Zielgruppenanalyse (S)
    - [x] Sitemap (XS)
  - [~] Umsetzung (XL)
    - [/] Frontend (S) https://git.example.de/frontend @anna
    - [ ] Backend (L) @ben @carla
    - [ ] CMS-Anbindung (M)
      | [ ] WordPress
      | [?] Headless CMS
      | [-] Eigenentwicklung  %% Aufwand zu hoch
  - [?] Hosting (M)
    | Cloud
    | On-Premise`;

describe('parse — kanonisches SPEC-§10-Beispiel', () => {
  const { roots, warnings } = parse(SPEC_EXAMPLE);

  it('erzeugt genau eine Wurzel mit allen Bestandteilen', () => {
    expect(roots).toHaveLength(1);
    const r = roots[0];
    expect(r.label).toBe('Website-Relaunch');
    expect(r.status.key).toBe('arbeit');
    expect(r.size).toBe('XL');
    expect(r.url).toBe('https://wiki.example.de/relaunch');
    expect(r.type).toBe('and');       // kein Gate-Zeichen -> and
    expect(r.tags).toEqual([]);
    expect(r.line).toBe(2);           // Zeile 1 ist der %%-Kommentar
  });

  it('bildet die Hierarchie über die Einrückung ab', () => {
    const r = roots[0];
    expect(r.children.map(c => c.label)).toEqual(['Konzeption', 'Umsetzung', 'Hosting']);
    const [konz, ums, host] = r.children;
    expect(konz.children.map(c => c.label)).toEqual(['Zielgruppenanalyse', 'Sitemap']);
    expect(ums.children.map(c => c.label)).toEqual(['Frontend', 'Backend', 'CMS-Anbindung']);
    expect(host.children.map(c => c.label)).toEqual(['Cloud', 'On-Premise']);
  });

  it('extrahiert Status, Größe, URL und Tags korrekt', () => {
    const ums = roots[0].children[1];
    const [fe, be, cms] = ums.children;
    expect(fe.status.key).toBe('durchstich');
    expect(fe.size).toBe('S');
    expect(fe.url).toBe('https://git.example.de/frontend');
    expect(fe.tags).toEqual(['anna']);
    expect(be.status.key).toBe('geplant');
    expect(be.size).toBe('L');
    expect(be.tags).toEqual(['ben', 'carla']);
    expect(cms.size).toBe('M');
  });

  it('setzt das Gate je Kind (any-of unter CMS-Anbindung)', () => {
    const cms = roots[0].children[1].children[2];
    expect(cms.children.map(c => c.type)).toEqual(['or', 'or', 'or']);
    expect(cms.children.map(c => c.status.key))
      .toEqual(['geplant', 'idee', 'verworfen']);
    // Kommentar hinter „Eigenentwicklung" ist entfernt
    expect(cms.children[2].label).toBe('Eigenentwicklung');
  });

  it('Hosting-Alternativen ohne Status bleiben neutral', () => {
    const host = roots[0].children[2];
    expect(host.status.key).toBe('idee');
    expect(host.children.every(c => c.status === null)).toBe(true);
    expect(host.children.every(c => c.type === 'or')).toBe(true);
  });

  it('liefert (noch) keine Warnungen', () => {
    expect(warnings).toEqual([]);
  });
});

describe('parse — Randfälle', () => {
  it('URL mit @ kollidiert nicht mit Personen-Tags', () => {
    const { roots } = parse('- Deploy https://user@host.example.com/path @ben');
    expect(roots[0].url).toBe('https://user@host.example.com/path');
    expect(roots[0].tags).toEqual(['ben']);
    expect(roots[0].label).toBe('Deploy');
  });

  it('%% am Zeilenanfang und am Zeilenende', () => {
    const { roots } = parse('%% ganze Zeile Kommentar\n- Aufgabe %% Rest weg');
    expect(roots).toHaveLength(1);
    expect(roots[0].label).toBe('Aufgabe');
  });

  it('leere Labels (nur Zeichen/Status) werden ignoriert', () => {
    const { roots } = parse('- [x]\n- Echt');
    expect(roots.map(r => r.label)).toEqual(['Echt']);
  });

  it('mehrere Wurzeln stehen nebeneinander', () => {
    const { roots } = parse('Baum A\nBaum B\n  - Kind von B');
    expect(roots.map(r => r.label)).toEqual(['Baum A', 'Baum B']);
    expect(roots[1].children.map(c => c.label)).toEqual(['Kind von B']);
  });

  it('Tab zählt als zwei Leerzeichen (gleiche Ebene)', () => {
    const { roots } = parse('- P\n\t- Tab-Kind\n  - Space-Kind');
    expect(roots).toHaveLength(1);
    expect(roots[0].children.map(c => c.label)).toEqual(['Tab-Kind', 'Space-Kind']);
  });

  it('ungleichmäßige Einrückung: Elternknoten ist die nächste kleinere Breite', () => {
    const { roots } = parse('- P\n     - tief eingerückt\n       - noch tiefer');
    const p = roots[0];
    expect(p.children.map(c => c.label)).toEqual(['tief eingerückt']);
    expect(p.children[0].children.map(c => c.label)).toEqual(['noch tiefer']);
  });

  it('gemischte Gates werden je Zeile treu übernommen', () => {
    const { roots } = parse('- P\n  - und-Kind\n  | oder-Kind');
    expect(roots[0].children.map(c => c.type)).toEqual(['and', 'or']);
  });

  it('Status akzeptiert x und X; Größe ist case-insensitive', () => {
    const { roots } = parse('- [X] Fertig groß (xxl)\n- [x] Fertig klein (m)');
    expect(roots[0].status.key).toBe('fertig');
    expect(roots[0].size).toBe('XXL');
    expect(roots[1].status.key).toBe('fertig');
    expect(roots[1].size).toBe('M');
  });

  it('ohne Angaben: status/url/size null, tags leer', () => {
    const { roots } = parse('- Nackt');
    expect(roots[0]).toMatchObject({ status: null, url: null, size: null, tags: [] });
  });

  it('leerer/Whitespace-Text ergibt keine Wurzeln', () => {
    expect(parse('').roots).toEqual([]);
    expect(parse('   \n\t\n  ').roots).toEqual([]);
  });
});

describe('Vokabular-Exporte', () => {
  it('SIZE_RANK ist aufsteigend geordnet (SPEC §5)', () => {
    expect(SIZE_RANK).toEqual({ XS: 0, S: 1, M: 2, L: 3, XL: 4, XXL: 5 });
  });

  it('STATUS_BY_CODE deckt alle sieben Codes ab (SPEC §4)', () => {
    expect(Object.keys(STATUS_BY_CODE).sort())
      .toEqual([' ', '-', '/', '?', '^', 'x', '~'].sort());
    expect(STATUS_BY_CODE['-'].key).toBe('verworfen');
  });
});
