import { describe, it, expect } from 'vitest';
import { parse, sizeMin, sizeMax } from '../src/parser.js';

/* Größen-Konflikt (SPEC §5/D62): Die angegebene Größe muss zu den direkten
   Kindern passen. Jede Größe zählt als Bereich (Untergrenze 2^Rang, Obergrenze
   die nächste Untergrenze, XXL offen); Konflikt erst, wenn selbst die
   günstigste Lesart der Kinder die großzügigste des Elternknotens erreicht.
   Nichts wird automatisch korrigiert. */

const conflicts = txt => parse(txt).warnings.filter(w => w.type === 'sizeConflict');
const node = (txt, label) => {
  const find = ns => {
    for(const n of ns){
      if(n.label === label) return n;
      const hit = find(n.children);
      if(hit) return hit;
    }
    return null;
  };
  return find(parse(txt).roots);
};

describe('Bereichs-Skala', () => {
  it('Untergrenzen verdoppeln sich, Obergrenze ist die nächste Untergrenze', () => {
    expect(['XS','S','M','L','XL'].map(sizeMin)).toEqual([1,2,4,8,16]);
    expect(['XS','S','M','L','XL'].map(sizeMax)).toEqual([2,4,8,16,32]);
  });
  it('XXL ist nach oben offen', () => {
    expect(sizeMin('XXL')).toBe(32);
    expect(sizeMax('XXL')).toBe(Infinity);
  });
});

describe('Konflikt-Regel (konjunktiv: Summe der Untergrenzen)', () => {
  it('vier S unter einem M sind ein Konflikt (8 >= 8), drei nicht', () => {
    const vier = 'A (M)\n  - B (S)\n  - C (S)\n  - D (S)\n  - E (S)';
    expect(conflicts(vier)).toEqual([{type:'sizeConflict', line:1, size:'M'}]);
    expect(node(vier, 'A').sizeConflict).toBe(true);
    expect(conflicts('A (M)\n  - B (S)\n  - C (S)\n  - D (S)')).toEqual([]);
  });
  it('ein einzelnes Kind derselben Größe passt, ein größeres nie', () => {
    expect(conflicts('A (M)\n  - B (M)')).toEqual([]);
    expect(conflicts('A (M)\n  - B (L)'))
      .toEqual([{type:'sizeConflict', line:1, size:'M'}]);
  });
  it('das kanonische Beispiel bleibt sauber: XL = XL-Kind + 2×M', () => {
    expect(conflicts('A (XL)\n  - B (M)\n  - C (XL)\n  - D (M)')).toEqual([]);
  });
  it('zwei M unter einem M sind ein Konflikt (4+4 >= 8)', () => {
    expect(conflicts('A (M)\n  - B (M)\n  - C (M)').length).toBe(1);
  });
  it('ein XXL-Elternknoten warnt nie', () => {
    const txt = 'A (XXL)\n' + Array.from({length: 40}, (_, i) => `  - K${i} (XL)`).join('\n');
    expect(conflicts(txt)).toEqual([]);
  });
  it('geprüft wird je Ebene, die Warnung zeigt auf die Elternzeile', () => {
    const txt = 'A (XXL)\n  - B (S)\n    - C (S)\n    - D (S)';
    expect(conflicts(txt)).toEqual([{type:'sizeConflict', line:2, size:'S'}]);
  });
});

describe('Was nicht zählt', () => {
  it('ein Elternknoten ohne Größe macht keine Aussage', () => {
    expect(conflicts('A\n  - B (XXL)\n  - C (XXL)')).toEqual([]);
  });
  it('Kinder ohne Größe zählen nicht — hier wird kein M angenommen', () => {
    expect(conflicts('A (XS)\n  - B\n  - C\n  - D')).toEqual([]);
    /* die größenlosen bleiben auch neben gezählten außen vor */
    expect(conflicts('A (M)\n  - B (S)\n  - C\n  - D')).toEqual([]);
  });
  it('verworfene Kinder zählen nicht', () => {
    expect(conflicts('A (M)\n  - [-] B (XL)\n  - C (S)')).toEqual([]);
  });
  it('optionale Kinder (`+`) zählen nicht', () => {
    expect(conflicts('A (M)\n  - B (S)\n  + C (XL)')).toEqual([]);
  });
  it('die Gegenrichtung warnt nicht: Eltern größer als die Kindersumme', () => {
    expect(conflicts('A (XXL)\n  - B (XS)')).toEqual([]);
  });
});

describe('Disjunktive Gruppen: nur die kleinste Alternative zählt', () => {
  it('| mit einer passenden Alternative ist kein Konflikt', () => {
    expect(conflicts('A (M)\n  | B (L)\n  | C (S)')).toEqual([]);
  });
  it('| warnt erst, wenn selbst die kleinste Alternative sprengt', () => {
    expect(conflicts('A (M)\n  | B (L)\n  | C (L)').length).toBe(1);
  });
  it('= verhält sich wie |', () => {
    expect(conflicts('A (M)\n  = B (L)\n  = C (S)')).toEqual([]);
    expect(conflicts('A (M)\n  = B (L)\n  = C (L)').length).toBe(1);
  });
});
