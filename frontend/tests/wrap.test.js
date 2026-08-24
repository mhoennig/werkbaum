// Umbruch langer Labels (SPEC §9/D64): höchstens ~40 Zeichen je Zeile und
// gleichmäßig verteilt — nicht gierig (volle Zeile plus einsames Wort).
import { describe, it, expect } from 'vitest';
import { wrapLabel, renderTreeHtml } from '../src/render.js';
import { parse } from '../src/parser.js';

const t = key => key;

describe('wrapLabel: balanciert statt gierig', () => {
  it('bis 40 Zeichen bleibt es eine Zeile, unverändert', () => {
    const s = 'Ein gewöhnlicher Knotentitel (39 Zeich.)';
    expect(s.length).toBe(40);
    expect(wrapLabel(s)).toEqual([s]);
  });

  it('44 Zeichen werden zwei etwa gleiche Zeilen — nicht 40 plus Rest', () => {
    const s = 'Update the agents version of the spec please';
    expect(s.length).toBe(44);
    const lines = wrapLabel(s);
    expect(lines.length).toBe(2);
    for(const l of lines){
      expect(l.length).toBeGreaterThanOrEqual(15);
      expect(l.length).toBeLessThanOrEqual(29);
    }
  });

  it('verliert kein Zeichen: die Zeilen ergeben zusammengefügt das Label', () => {
    const s = 'Offering the status codes, the sizes and the known tags while typing';
    expect(wrapLabel(s).join(' ')).toBe(s);
  });

  it('keine Zeile über 40 Zeichen, solange die Wörter es hergeben', () => {
    const s = 'A dependency needs its target id and nobody remembers a hundred and eighty of them by heart';
    for(const l of wrapLabel(s)) expect(l.length).toBeLessThanOrEqual(40);
  });

  it('rund 100 Zeichen ergeben drei gleichmäßige Zeilen', () => {
    const s = 'The list at the caret offers the document ids filtered by what is typed with the node title as ctx';
    expect(s.length).toBe(98);
    const lines = wrapLabel(s);
    expect(lines.length).toBe(3);
    for(const l of lines){
      expect(l.length).toBeGreaterThanOrEqual(25);
      expect(l.length).toBeLessThanOrEqual(40);
    }
  });

  it('ein einzelnes Wort über der Grenze bleibt eine Zeile (CSS fängt es ab)', () => {
    const w = 'x'.repeat(55);
    expect(wrapLabel(w)).toEqual([w]);
    expect(wrapLabel('kurz ' + w)).toEqual(['kurz', w]);
  });

  it('bricht nie mitten im Wort', () => {
    const s = 'einige ziemlich lange zusammengesetzte Bandwurmwortgebilde nebeneinander aufgereiht';
    const words = s.split(' ');
    for(const l of wrapLabel(s)){
      for(const w of l.split(' ')) expect(words).toContain(w);
    }
  });
});

describe('Renderer: die Umbrüche stehen als \\n im Knotentext', () => {
  it('ein langer Titel bekommt sein \\n, ein kurzer nicht', () => {
    const { roots } = parse(
      '- Kurzer Titel\n' +
      '- Ein wirklich sehr langer Titel, der die vierzig Zeichen deutlich reisst');
    const { html } = renderTreeHtml(roots, {t, showDiscarded: false, cheapPath: false,
                                            cheapSet: new Set()});
    expect(html).toContain('Kurzer Titel');
    expect(html).not.toContain('Kurzer\nTitel');
    expect(html).toMatch(/Ein wirklich sehr langer Titel,[^<]*\n[^<]*reisst/);
  });
});
