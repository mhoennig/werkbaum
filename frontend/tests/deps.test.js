import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { renderTreeHtml } from '../src/render.js';

const t = key => key;
const roots = txt => parse(txt).roots;
const render = txt => renderTreeHtml(roots(txt),
  {t, showDiscarded: false, cheapPath: false, cheapSet: new Set()});

/* Abhängigkeiten `:#a,#b` (SPEC §1, D37): der Knoten hängt von den Knoten mit
   diesen IDs ab — auch außerhalb seines eigenen Teilbaums. */
describe('Parser — `:#a,#b` als Abhängigkeits-Token', () => {
  it('extrahiert die ID-Liste und nimmt sie aus dem Label', () => {
    const [a, b] = roots(`[ ] Auth #auth\n[ ] Deploy :#auth (M)`);
    expect([b.label, b.deps, b.size]).toEqual(['Deploy', ['auth'], 'M']);
    expect(a.deps).toEqual([]);
  });

  it('liest mehrere IDs aus einem Token', () => {
    const [wurzel] = roots(`[ ] A #a\n[ ] B #b\n[ ] C :#a,#b`);
    expect(roots(`[ ] A #a\n[ ] B #b\n[ ] C :#a,#b`)[2].deps).toEqual(['a', 'b']);
  });

  it('führt mehrere Token je Zeile zusammen', () => {
    const {roots: r, warnings} = parse(`[ ] A #a\n[ ] B #b\n[ ] C :#a später :#b`);
    expect(r[2].deps).toEqual(['a', 'b']);
    expect(r[2].label).toBe('C später');
    expect(warnings).toEqual([]);
  });

  it('erkennt das Token nur alleinstehend — eingeklammerte Erwähnung bleibt Label', () => {
    const [wurzel] = roots(`[ ] Dependencies across the tree, (:#auth,#api) (M)`);
    expect([wurzel.label, wurzel.deps]).toEqual(
      ['Dependencies across the tree, (:#auth,#api)', []]);
  });

  it('lässt einen gewöhnlichen Doppelpunkt im Label stehen', () => {
    const [wurzel] = roots(`[ ] Merke: wichtig`);
    expect([wurzel.label, wurzel.deps]).toEqual(['Merke: wichtig', []]);
  });

  it('endet am Leerraum: `:#a, #b` liest nur #a — das #b wird Knoten-ID', () => {
    /* Der dokumentierte Stolperstein (SPEC §1): die Liste ist EIN Token. */
    const [a, b] = roots(`[ ] A #a\n[ ] B :#a, #b`);
    expect([b.deps, b.id, b.label]).toEqual([['a'], 'b', 'B ,']);
  });

  it('verträgt sich mit der eigenen Knoten-ID auf derselben Zeile', () => {
    const nodes = roots(`[ ] A #a\n[ ] B #b :#a`);
    expect([nodes[1].id, nodes[1].deps]).toEqual(['b', ['a']]);
  });
});

describe('Unbekannte IDs warnen — Zyklen nie', () => {
  it('meldet eine Abhängigkeit ohne Zielknoten mit Zeilennummer', () => {
    const {warnings} = parse(`[ ] A #a\n[ ] B :#a,#fehlt`);
    expect(warnings).toEqual([{type: 'unknownDep', line: 2, id: 'fehlt'}]);
  });

  it('erlaubt Vorwärts-Referenzen (Ziel steht weiter unten)', () => {
    expect(parse(`[ ] A :#b\n[ ] B #b`).warnings).toEqual([]);
  });

  it('warnt nicht bei Zyklen — auch nicht bei Selbst-Abhängigkeit', () => {
    expect(parse(`[ ] A #a :#b\n[ ] B #b :#a`).warnings).toEqual([]);
    expect(parse(`[ ] A #a :#a`).warnings).toEqual([]);
  });
});

describe('Darstellung — Tooltip und aria, kein eigenes Zeichen', () => {
  it('zeigt die Abhängigkeiten als → im Tooltip und als a11yDeps', () => {
    const {html} = render(`[ ] A #a\n[ ] B #b\n[ ] C :#a,#b`);
    expect(html).toContain('title="→ #a, #b · st_geplant · jumpHint"');
    expect(html).toContain('aria-label="C, a11yStatus, a11yDeps"');
  });

  it('ändert Knoten ohne Abhängigkeiten nicht', () => {
    const {html} = render(`[ ] Ohne`);
    expect(html).not.toContain('a11yDeps');
    expect(html).not.toContain('→');
  });
});
