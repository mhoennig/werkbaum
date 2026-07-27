import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { computeCheapSet, cheapestCost, visibleChildren } from '../src/model.js';
import { renderTreeHtml } from '../src/render.js';

const t = key => key;
const roots = txt => parse(txt).roots;
const render = txt => renderTreeHtml(roots(txt),
  {t, showDiscarded: false, cheapPath: false, cheapSet: new Set()});
const cheapLabels = txt => [...computeCheapSet(roots(txt))].map(n => n.label).sort();

/* Optionale Knoten: `+` (SPEC §3, D29). Eigenschaft des einzelnen Knotens,
   nicht der Gruppe — deshalb bleibt `type` 'and'. */
describe('Parser — `+` setzt optional, nicht das Gate', () => {
  it('erkennt `+` als optionalen Knoten innerhalb einer Und-Gruppe', () => {
    const [wurzel] = roots(`[ ] Wurzel\n  - [ ] Pflicht\n  + [ ] Zugabe`);
    expect(wurzel.children.map(k => [k.label, k.type, k.optional]))
      .toEqual([['Pflicht', 'and', false], ['Zugabe', 'and', true]]);
  });

  it('lässt `-` und Zeilen ohne Zeichen nicht-optional', () => {
    const [wurzel] = roots(`Wurzel\n  - Kind`);
    expect(wurzel.optional).toBe(false);
    expect(wurzel.children[0].optional).toBe(false);
  });

  it('parst Status, Größe, Tags und URL am `+`-Knoten wie sonst auch', () => {
    const [wurzel] = roots(`[ ] Wurzel\n  + [^] Zugabe (S) https://example.org/x @ana`);
    const k = wurzel.children[0];
    expect([k.label, k.status.key, k.size, k.tags, k.url])
      .toEqual(['Zugabe', 'prod', 'S', ['ana'], 'https://example.org/x']);
  });

  /* Bewusste Verhaltensänderung: `+` am Zeilenanfang ist jetzt ein Zeichen.
     Vorher wäre es Teil des Labels gewesen. */
  it('verbraucht ein führendes `+` als Zeichen, nicht als Label-Text', () => {
    expect(roots(`+ 5 % Puffer`)[0].label).toBe('5 % Puffer');
  });
});

describe('Günstigster Pfad — optionale Knoten sind nie nötig', () => {
  const BAUM = `[ ] Wurzel (S)
  - [ ] Pflicht (S)
  + [ ] Zugabe (XXL)
    - [ ] Unterpunkt (S)`;

  it('lässt den optionalen Knoten samt Teilbaum aus dem Pfad', () => {
    expect(cheapLabels(BAUM)).toEqual(['Pflicht', 'Wurzel']);
  });

  it('rechnet die Zugabe nicht in die Kosten des Elternknotens', () => {
    /* Wurzel (S=2) + Pflicht (S=2) = 4; mit der XXL-Zugabe wären es 10. */
    expect(cheapestCost(roots(BAUM)[0])).toBe(4);
  });

  it('vergleicht Alternativen ohne deren Zugaben', () => {
    /* Ohne die Ausnahme kostete A 2+6=8 und B (3) gewänne. */
    const BAUM = `[ ] Wahl (XS)
  | [ ] A (S)
    + [ ] Extra (XXL)
  | [ ] B (M)`;
    expect(cheapLabels(BAUM)).toEqual(['A', 'Wahl']);
  });

  it('blendet optionale Knoten aber nicht aus dem Diagramm aus', () => {
    const [wurzel] = roots(BAUM);
    expect(visibleChildren(wurzel, false).map(k => k.label))
      .toEqual(['Pflicht', 'Zugabe']);
  });
});

describe('Renderer — Kennzeichnung und Gemischt-Warnung', () => {
  it('gibt dem optionalen Knoten die Klasse `opt`', () => {
    const {html} = render(`[ ] Wurzel\n  - [ ] Pflicht\n  + [ ] Zugabe`);
    expect((html.match(/class="node opt[ "]/g) || []).length).toBe(1);
    expect(html).toContain('>Zugabe<');
  });

  it('warnt NICHT, wenn `-` und `+` nebeneinander stehen', () => {
    const {warnings} = render(`[ ] Wurzel\n  - [ ] Pflicht\n  + [ ] Zugabe`);
    expect(warnings).toEqual([]);
  });

  it('warnt weiterhin, wenn `|` mit `+` gemischt wird', () => {
    const {warnings} = render(`[ ] Wurzel\n  | [ ] Alternative\n  + [ ] Zugabe`);
    expect(warnings).toEqual([{type: 'mixedGate', line: 2, label: 'Wurzel'}]);
  });

  it('nennt „optional" im aria-label des Knotens', () => {
    const {html} = render(`[ ] Wurzel\n  + [ ] Zugabe`);
    expect(html).toContain('aria-label="Zugabe, a11yStatus, a11yOptional"');
  });
});
