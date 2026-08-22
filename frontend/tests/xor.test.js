import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { gateOf, computeCheapSet } from '../src/model.js';
import { renderTreeHtml } from '../src/render.js';

const t = key => key;
const roots = txt => parse(txt).roots;
const render = txt => renderTreeHtml(roots(txt),
  {t, showDiscarded: false, cheapPath: false, cheapSet: new Set()});
const cheapLabels = txt => [...computeCheapSet(roots(txt))].map(n => n.label).sort();

/* XOR-Gruppen: `=` (SPEC §3, D34/D35). Disjunktiv wie `|`, aber genau EINE
   Alternative darf realisiert werden. */
describe('Parser — `=` als XOR-Gate mit Leerraum-Regel', () => {
  it('erkennt `=` mit folgendem Leerraum als Gate', () => {
    const [wurzel] = roots(`[ ] Wahl\n  = [ ] A\n  = [ ] B`);
    expect(wurzel.children.map(k => [k.label, k.type]))
      .toEqual([['A', 'xor'], ['B', 'xor']]);
  });

  it('lässt `=` ohne folgenden Leerraum im Label (Leerraum-Regel)', () => {
    const [wurzel] = roots(`[ ] Wurzel\n  - =SUMME(A1:B2)`);
    expect(wurzel.children.map(k => [k.label, k.type]))
      .toEqual([['=SUMME(A1:B2)', 'and']]);
  });

  it('parst Status, Größe, Tags und URL am `=`-Knoten wie sonst auch', () => {
    const [wurzel] = roots(`[ ] Wahl\n  = [~] A (M) https://example.org/a @ana`);
    const k = wurzel.children[0];
    expect([k.label, k.type, k.status.key, k.size, k.tags, k.url])
      .toEqual(['A', 'xor', 'arbeit', 'M', ['ana'], 'https://example.org/a']);
  });

  it('meldet gateOf für eine XOR-Gruppe als eigenen Wert', () => {
    const [wurzel] = roots(`[ ] Wahl\n  = [ ] A\n  = [ ] B`);
    expect(gateOf(wurzel.children)).toBe('xor');
  });
});

describe('XOR-Regel — genau eine Alternative darf realisiert sein', () => {
  it('warnt nicht bei null oder einer realisierten Alternative', () => {
    expect(parse(`[ ] Wahl\n  = [ ] A\n  = [ ] B`).warnings).toEqual([]);
    expect(parse(`[ ] Wahl\n  = [x] A\n  = [ ] B`).warnings).toEqual([]);
  });

  it('meldet jede WEITERE realisierte Alternative mit ihrer Zeile', () => {
    const {warnings} = parse(`[ ] Wahl\n  = [x] A\n  = [~] B\n  = [/] C`);
    expect(warnings).toEqual([
      {type: 'xorConflict', line: 3, label: 'B'},
      {type: 'xorConflict', line: 4, label: 'C'}
    ]);
  });

  it('zählt schon `[~]` als realisiert — Kosten sind investiert', () => {
    const {warnings} = parse(`[ ] Wahl\n  = [~] A\n  = [~] B`);
    expect(warnings).toEqual([{type: 'xorConflict', line: 3, label: 'B'}]);
  });

  it('zählt Absicht, Ablehnung und neutrale Knoten nicht als realisiert', () => {
    /* [?], [ ], [!], [-] und ohne Statusbox — keine davon ist realisiert. */
    const {warnings} = parse(
      `[ ] Wahl\n  = [^] A\n  = [?] B\n  = [ ] C\n  = [!] D\n  = [-] E\n  = F`);
    expect(warnings).toEqual([]);
  });

  it('prüft verschachtelte XOR-Gruppen unabhängig voneinander', () => {
    const {warnings} = parse(`[ ] Wurzel
  - [ ] Teil
    = [x] A
    = [x] B
  - [ ] Anderes
    = [ ] C
    = [x] D`);
    expect(warnings).toEqual([{type: 'xorConflict', line: 4, label: 'B'}]);
  });
});

describe('Mischregel — `=` ist disjunktiv, jede Mischung warnt', () => {
  it('warnt, wenn `=` mit `|` gemischt wird', () => {
    const {warnings} = render(`[ ] Wahl\n  = [ ] A\n  | [ ] B`);
    expect(warnings).toEqual([{type: 'mixedGate', line: 2, label: 'Wahl'}]);
  });

  it('warnt, wenn `=` mit `-` oder `+` gemischt wird', () => {
    const {warnings} = render(`[ ] Wahl\n  = [ ] A\n  + [ ] B`);
    expect(warnings).toEqual([{type: 'mixedGate', line: 2, label: 'Wahl'}]);
  });
});

describe('Darstellung und günstigster Pfad', () => {
  it('rendert die XOR-Gruppe als `ul.or.xor` (any-of-Geometrie + Plakette)', () => {
    const {html} = render(`[ ] Wahl\n  = [ ] A\n  = [ ] B`);
    expect(html).toContain('<ul class="or xor">');
    expect(html).toContain('<li class="has-or">');
  });

  it('wählt im günstigsten Pfad die günstigste XOR-Alternative', () => {
    expect(cheapLabels(`[ ] Wahl (XS)\n  = [ ] A (L)\n  = [ ] B (S)`))
      .toEqual(['B', 'Wahl']);
  });
});
