import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { assumedSize, ownCost, cheapestCost } from '../src/model.js';
import { renderTreeHtml } from '../src/render.js';

/* Geschätzte Größe bei fehlender Angabe (SPEC §9, D66): statt pauschal M wird
   aus den Teilpaketen geschätzt — mindestens die größte Größe der zählenden
   Kinder, ab drei Kindern dieser Größe eine Stufe mehr (Deckel XXL). Es zählen
   dieselben Kinder wie beim Größen-Konflikt (§5/D62), nur dass fehlende
   Kindgrößen rekursiv mitgeschätzt werden. */

const roots = txt => parse(txt).roots;
const t = (key, vars) => {
  let s = key;
  if(vars) for(const k in vars) s += ':' + vars[k];
  return s;
};
const opts = () => ({ t, showDiscarded: false, cheapPath: true, cheapSet: new Set() });

describe('assumedSize — Schätzung aus den Teilpaketen (D66)', () => {
  it('Blatt ohne Größe bleibt M (der alte D18-Rückfall)', () => {
    expect(assumedSize(roots('[ ] Blatt')[0])).toBe('M');
  });

  it('explizite Größe gewinnt immer', () => {
    const [n] = roots(`[ ] Eltern (S)
  - [ ] Kind (XL)`);
    expect(assumedSize(n)).toBe('S');
  });

  it('mindestens die größte Kindgröße', () => {
    const [n] = roots(`[ ] Eltern
  - [ ] A (L)
  - [ ] B (S)`);
    expect(assumedSize(n)).toBe('L');
  });

  it('zwei Kinder der größten Größe: noch keine Stufe mehr', () => {
    const [n] = roots(`[ ] Eltern
  - [ ] A (S)
  - [ ] B (S)`);
    expect(assumedSize(n)).toBe('S');
  });

  it('drei Kinder der größten Größe: eine Stufe mehr', () => {
    const [n] = roots(`[ ] Eltern
  - [ ] A (S)
  - [ ] B (S)
  - [ ] C (S)
  - [ ] D (XS)`);
    expect(assumedSize(n)).toBe('M');
  });

  it('Deckel XXL: drei XXL-Kinder bleiben XXL', () => {
    const [n] = roots(`[ ] Eltern
  - [ ] A (XXL)
  - [ ] B (XXL)
  - [ ] C (XXL)`);
    expect(assumedSize(n)).toBe('XXL');
  });

  it('Kinder ohne Größe werden rekursiv mitgeschätzt', () => {
    /* Das Kind hat selbst 3×M-Kinder ⇒ geschätzt L; der Elternknoten erbt L. */
    const [n] = roots(`[ ] Eltern
  - [ ] Kind
    - [ ] a (M)
    - [ ] b (M)
    - [ ] c (M)`);
    expect(assumedSize(n.children[0])).toBe('L');
    expect(assumedSize(n)).toBe('L');
  });

  it('drei größenlose Blätter zählen als 3×M ⇒ L', () => {
    const [n] = roots(`[ ] Eltern
  - [ ] a
  - [ ] b
  - [ ] c`);
    expect(assumedSize(n)).toBe('L');
  });

  it('optionale und verworfene Kinder zählen nicht', () => {
    const [n] = roots(`[ ] Eltern
  - [ ] A (S)
  + [ ] Zugabe (XXL)
  - [-] Weg (XXL)`);
    expect(assumedSize(n)).toBe('S');
  });

  it('nur optionale Kinder ⇒ M-Rückfall', () => {
    const [n] = roots(`[ ] Eltern
  + [ ] Zugabe (XL)`);
    expect(assumedSize(n)).toBe('M');
  });

  it('disjunktive Gruppe: die kleinste Alternative ist der Boden', () => {
    const [n] = roots(`[ ] Eltern
  | [ ] A (XL)
  | [ ] B (S)`);
    expect(assumedSize(n)).toBe('S');
  });

  it('disjunktiv mit getroffener Wahl (D61): die kleinste der realisierten', () => {
    const [n] = roots(`[ ] Eltern
  = [~] A (XL)
  = [ ] B (S)`);
    expect(assumedSize(n)).toBe('XL');
  });

  it('drei gleich große Alternativen bleiben ohne Stufe mehr — nur eine wird realisiert', () => {
    const [n] = roots(`[ ] Eltern
  | [ ] A (L)
  | [ ] B (L)
  | [ ] C (L)`);
    expect(assumedSize(n)).toBe('L');
  });
});

describe('ownCost und Pfad rechnen mit der Schätzung', () => {
  it('ownCost eines größenlosen Elternknotens folgt der Schätzung', () => {
    const [n] = roots(`[ ] Eltern
  - [ ] Kind (XL)`);
    expect(ownCost(n)).toBe(ownCost(roots('[ ] X (XL)')[0]));
  });

  it('cheapestCost steigt gegenüber der alten M-Annahme', () => {
    const derived = cheapestCost(roots(`[ ] Eltern
  - [ ] Kind (XL)`)[0]);
    const stated = cheapestCost(roots(`[ ] Eltern (M)
  - [ ] Kind (XL)`)[0]);
    expect(derived).toBeGreaterThan(stated);
  });

  it('am erledigten Knoten wird weiterhin nichts angenommen (Kosten 0)', () => {
    const [n] = roots(`[x] Eltern
  - [x] Kind (XL)`);
    expect(ownCost(n)).toBe(0);
  });
});

describe('Badge zeigt die geschätzte Größe', () => {
  it('das invertierte Badge trägt die abgeleitete Größe statt M', () => {
    const { html } = renderTreeHtml(roots(`[ ] Eltern
  - [ ] Kind (XL)`), opts());
    expect(html).toContain('<span class="size implicit" aria-hidden="true">XL</span>');
  });

  it('Tooltip und aria-label nennen die geschätzte Größe', () => {
    const { html } = renderTreeHtml(roots(`[ ] Eltern
  - [ ] Kind (L)`), opts());
    expect(html).toContain('implicitSizeTooltip:L');
    expect(html).toContain('a11ySizeImplicit:L');
  });

  it('Blatt ohne Größe zeigt weiterhin M', () => {
    const { html } = renderTreeHtml(roots('[ ] Blatt'), opts());
    expect(html).toContain('<span class="size implicit" aria-hidden="true">M</span>');
  });
});
