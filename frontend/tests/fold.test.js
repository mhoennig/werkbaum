import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { initialCollapsed, computeCheapSet } from '../src/model.js';
import { renderTreeHtml } from '../src/render.js';

const t = key => key;
const roots = txt => parse(txt).roots;
const render = (txt, collapsedSet) => renderTreeHtml(roots(txt),
  {t, showDiscarded: false, cheapPath: false, cheapSet: new Set(),
   collapsedSet: collapsedSet || new Set()});
/* Rendert mit dem Anfangszustand aus den Textmarken (wie app.js, ohne Overrides). */
const renderFolded = txt => {
  const r = roots(txt);
  return renderTreeHtml(r, {t, showDiscarded: false, cheapPath: false,
    cheapSet: new Set(), collapsedSet: initialCollapsed(r, true)});
};
const collapsedLabels = (txt, rescueFocus = true) =>
  [...initialCollapsed(roots(txt), rescueFocus)].map(n => n.label).sort();

/* Faltmarken `>`/`<` (SPEC §1/§9, D38): Anfangszustand der Faltung im Text. */
describe('Parser — Faltmarke zwischen Zeichen und Statusbox', () => {
  it('erkennt `>` und `<` und nimmt sie aus dem Label', () => {
    const [wurzel] = roots(`[ ] Wurzel\n  - > [x] Zu (M)\n  - < [ ] Auf`);
    expect(wurzel.children.map(k => [k.label, k.fold, k.status?.key]))
      .toEqual([['Zu', '>', 'fertig'], ['Auf', '<', 'geplant']]);
    expect(wurzel.fold).toBe(null);
  });

  it('erkennt die Marke am Wurzelknoten (ohne Zeichen) am Zeilenanfang', () => {
    const [wurzel] = roots(`> [~] Kapitel\n  - [ ] Kind`);
    expect([wurzel.fold, wurzel.label]).toEqual(['>', 'Kapitel']);
  });

  it('verlangt folgenden Leerraum — `- >Achtung` bleibt ein Label', () => {
    const [wurzel] = roots(`[ ] Wurzel\n  - >Achtung`);
    expect(wurzel.children.map(k => [k.label, k.fold]))
      .toEqual([['>Achtung', null]]);
  });

  it('lässt ein `>` mitten im Label unberührt', () => {
    const [wurzel] = roots(`[ ] a > b`);
    expect([wurzel.label, wurzel.fold]).toEqual(['a > b', null]);
  });
});

describe('initialCollapsed — `>` klappt ein, `<` wandert die Faltung hinunter', () => {
  it('klappt `>`-Knoten ein', () => {
    expect(collapsedLabels(`[ ] W\n  - > [ ] A\n    - [ ] A1\n  - [ ] B`))
      .toEqual(['A']);
  });

  it('holt einen `<`-Teilbaum hervor: Vorfahr öffnet, Geschwister klappen ein', () => {
    const txt = `> [ ] W
  - [ ] A
    - [ ] A1
  - [ ] B
    - < [ ] B1
      - [ ] B1a
  - [ ] C`;
    /* W öffnet sich (Pfad zu B1), A klappt stattdessen ein; B öffnet den Weg,
       B1 samt Teilbaum ist sichtbar. C ist Blatt und braucht keine Faltung. */
    expect(collapsedLabels(txt)).toEqual(['A']);
  });

  it('respektiert ein `>` innerhalb des hervorgeholten Teilbaums', () => {
    const txt = `> [ ] W
  - < [ ] B
    - > [ ] B1
      - [ ] B1a`;
    expect(collapsedLabels(txt)).toEqual(['B1']);
  });

  it('holt auch einen `!!!`-markierten Knoten hervor', () => {
    const txt = `> [ ] W\n  - [ ] A\n    - [ ] A1\n  - [ ] B !!!\n    - [ ] B1`;
    expect(collapsedLabels(txt)).toEqual(['A']);
    /* … aber nur mit rescueFocus — headless-Aufrufer können es abschalten. */
    expect(collapsedLabels(txt, false)).toEqual(['W']);
  });

  it('lässt Bäume ohne Marken vollständig offen', () => {
    expect(collapsedLabels(`[ ] W\n  - [ ] A\n    - [ ] B`)).toEqual([]);
  });
});

describe('Renderer — eingeklappte Teilbäume', () => {
  const TXT = `[ ] W\n  - > [~] A (M)\n    - [ ] A1\n    - [ ] A2\n      - [ ] A2a\n  - [ ] B`;

  it('lässt die Kinder eines eingeklappten Knotens weg', () => {
    const {html} = renderFolded(TXT);
    expect(html).not.toContain('A1');
    expect(html).toContain('>B<');
  });

  it('kennzeichnet mit Klasse `folded` und „▸ n" (n = alle verborgenen Knoten)', () => {
    const {html} = renderFolded(TXT);
    expect(html).toContain('folded');
    expect(html).toContain('<span class="fold" aria-hidden="true">▸ 3</span>');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('a11yFolded');
  });

  it('gibt offenen Eltern das ▾, Blättern gar kein Falt-Zeichen', () => {
    const {html} = render(`[ ] W\n  - [ ] Blatt`);
    expect((html.match(/class="fold"/g) || []).length).toBe(1);
    expect(html).toContain('>▾</span>');
    expect(html).toContain('aria-expanded="true"');
  });

  it('macht das eingeklappte <li> zum Blatt (kein has-*-Layout)', () => {
    /* Nur W verzweigt sichtbar; das eingeklappte A steht als klassenloses <li>. */
    const {html} = renderFolded(TXT);
    expect((html.match(/has-and|has-or/g) || []).length).toBe(1);
    expect(html).toContain('<li><div class="node folded st-arbeit"');
  });

  it('meldet Warnungen aus dem verborgenen Teilbaum weiter', () => {
    const txt = `[ ] W\n  - > [ ] A\n    | [ ] X\n    - [ ] Y`;
    const {html, warnings} = renderFolded(txt);
    expect(html).not.toContain('>X<');
    expect(warnings).toEqual([{type: 'mixedGate', line: 3, label: 'A'}]);
  });

  it('lässt den günstigsten Pfad unberührt — Faltung ist reine Ansicht', () => {
    const r = roots(`[ ] W (XS)\n  - > [ ] A (S)\n    | [ ] A1 (XL)\n    | [ ] A2 (S)`);
    expect([...computeCheapSet(r)].map(n => n.label).sort())
      .toEqual(['A', 'A2', 'W']);
  });
});
