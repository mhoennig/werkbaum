import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { computeCheapPlan, computeCheapSet } from '../src/model.js';

const roots = txt => parse(txt).roots;
const cheapLabels = txt => [...computeCheapSet(roots(txt))].map(n => n.label).sort();

/* Günstigster Pfad auf der Dependency Closure (SPEC §9, D42). */
describe('Closure — Abhängigkeiten ziehen ihr Ziel in die nötige Menge', () => {
  it('zieht das Ziel samt seiner Realisierung nach', () => {
    expect(cheapLabels(`[ ] W (XS)
  - [ ] A (S) :#db
[ ] DB #db (S)
  - [ ] Schema (XS)`))
      .toEqual(['A', 'DB', 'Schema', 'W']);
  });

  it('zieht auch optionale und nicht gewählte Ziele — gebraucht ist gebraucht', () => {
    const labels = cheapLabels(`[ ] W (XS)
  - [ ] A (S) :#opt,#alt
  + [ ] Extra #opt (S)
  - [ ] Wahl (XS)
    | [ ] Billig (XS)
    | [ ] Teuer (XL)
      - [ ] Teil #alt (XS)`);
    expect(labels).toContain('Extra');
    expect(labels).toContain('Teil');       /* das Ziel selbst … */
    expect(labels).not.toContain('Teuer');  /* … aber nicht sein Vorfahr */
    expect(labels).toContain('Billig');
  });

  it('zieht verworfene Ziele nie', () => {
    expect(cheapLabels(`[ ] W (XS)\n  - [ ] A (S) :#weg\n  - [-] Weg #weg (XL)`))
      .toEqual(['A', 'W']);
  });
});

describe('Closure — gemeinsam Gebrauchtes zählt nur einmal', () => {
  /* Das D34-Beispiel: A (S) :#db gegen B (M). Für sich verliert A, sobald
     #db mehr als den Unterschied kostet — wird #db aber ohnehin gebraucht,
     ist es bezahlt, und A gewinnt. */
  /* DB liegt unter einer Zugabe — von sich aus ist sie also NICHT nötig,
     sondern nur, wenn jemand per :#db darauf zeigt. */
  const PLAN = braucht => `[ ] W (XS)
  - [ ] Basis (XS)${braucht ? ' :#db' : ''}
  - [ ] Wahl (XS)
    | [ ] A (S) :#db
    | [ ] B (M)
  + [ ] Fundus (XS)
    - [ ] DB #db (L)`;

  it('wählt lokal, wenn niemand sonst die Abhängigkeit bezahlt', () => {
    expect(cheapLabels(PLAN(false))).not.toContain('A');
  });

  it('wählt die Alternative mit der schon bezahlten Abhängigkeit', () => {
    const labels = cheapLabels(PLAN(true));
    expect(labels).toContain('A');
    expect(labels).not.toContain('B');
  });

  it('koppelt auch zwei Gruppen über eine geteilte Abhängigkeit', () => {
    /* Beide A-Alternativen teilen sich DB: A1+A2+DB = 2+2+2 = 6, B1+B2 =
       3+3 = 6 — Gleichstand, und bei Gleichstand gewinnt die lexikografisch
       erste Belegung (§9): beide Gruppen wählen A. Lokal (je Gruppe für sich:
       S+S(db)=4 > M=3) hätte zweimal B gewonnen. */
    const labels = cheapLabels(`[ ] W (XS)
  - [ ] G1 (XS)
    | [ ] A1 (S) :#db
    | [ ] B1 (M)
  - [ ] G2 (XS)
    | [ ] A2 (S) :#db
    | [ ] B2 (M)
[ ] DB #db (S)`);
    expect(labels).toEqual(expect.arrayContaining(['A1', 'A2', 'DB']));
    expect(labels).not.toContain('B1');
    expect(labels).not.toContain('B2');
  });
});

describe('Verfahren — exakt bis zum Limit, dann gierig und benannt', () => {
  it('bleibt ohne Abhängigkeiten exakt mit genau dem alten Ergebnis', () => {
    const plan = computeCheapPlan(roots(`[ ] W (XS)\n  | [ ] A (L)\n  | [ ] B (S)`));
    expect(plan.exact).toBe(true);
    expect([...plan.set].map(n => n.label).sort()).toEqual(['B', 'W']);
  });

  it('meldet die gierige Schätzung, wenn zu viele Gruppen koppeln', () => {
    /* 15 gekoppelte Zweiergruppen: 2^15 = 32768 > 20000. */
    let txt = `[ ] Ziel #z (S)\n`;
    for(let g = 0; g < 15; g++){
      txt += `[ ] G${g} (XS)\n  | [ ] A${g} (S) :#z\n  | [ ] B${g} (S)\n`;
    }
    const plan = computeCheapPlan(roots(txt));
    expect(plan.exact).toBe(false);
    expect(plan.set.size).toBeGreaterThan(0);
  });
});
