import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { cheapestCost, computeCheapSet, computeCheapPlan } from '../src/model.js';

/* Die Größe bepreist den ganzen Teilbaum (SPEC §9, D69): Der Preis eines
   Knotens ist seine angegebene (oder nach D66 geschätzte) Größe — die
   Teilpakete kommen nicht noch einmal obendrauf. Ob sie hineinpassen, prüft
   der Größen-Konflikt (§5/D62); die Pfadrechnung zweifelt die Bewertung
   nicht an. */

const roots = txt => parse(txt).roots;
const cheapLabels = txt => {
  const r = roots(txt);
  return [...computeCheapSet(r)].map(n => n.label).sort();
};

describe('Die Größe bepreist den Teilbaum (D69)', () => {
  it('der gemeldete Fall: die zerlegte S-Alternative schlägt das L', () => {
    /* Vorher: Manuell = S(2) + XS(1) + S(2) = 5 > Failover L(4) — die
       sorgfältige Zerlegung wurde bestraft. Jetzt zählt die Bewertung:
       S(2) < L(4). */
    const txt = `- kc
  - Verfügbarkeit
    | Manuell mit Downtime (S)
        - Maintainance Mode (XS)
        - Recovery Plan (S)
        + Seite Wartungsarbeiten (S)
    | Failover (L)
    | HA (XXL)`;
    const labels = cheapLabels(txt);
    expect(labels).toContain('Manuell mit Downtime');
    expect(labels).not.toContain('Failover');
  });

  it('der Preis eines bewerteten Knotens ist seine Größe, Kinder egal', () => {
    const [n] = roots(`- [ ] Paket (S)
  - [ ] A (XS)
  - [ ] B (S)`);
    expect(cheapestCost(n)).toBe(2);
  });

  it('die Bewertung gilt auch, wenn die Kinder zu groß sind (D62 warnt dann)', () => {
    /* Vier S unter einem S sind ein sizeConflict — der Fehlermarker meldet
       es, aber der Knoten bleibt bewertet, wie er bewertet wurde. */
    const txt = `- [ ] Wahl (XS)
  | [ ] A (S)
    - [ ] a1 (S)
    - [ ] a2 (S)
    - [ ] a3 (S)
    - [ ] a4 (S)
  | [ ] B (M)`;
    expect(parse(txt).warnings.some(w => w.type === 'sizeConflict')).toBe(true);
    const labels = cheapLabels(txt);
    expect(labels).toContain('A');
    expect(labels).not.toContain('B');
  });

  it('ohne Größe vertritt die D66-Schätzung die Bewertung', () => {
    /* Alternative ohne Größe mit einem L-Kind wird als L geschätzt und
       verliert gegen das bewertete M. */
    const labels = cheapLabels(`- [ ] Wahl (XS)
  | [ ] Unbewertet
    - [ ] Kind (L)
  | [ ] Bewertet (M)`);
    expect(labels).toContain('Bewertet');
    expect(labels).not.toContain('Unbewertet');
  });

  it('das Vereinigungs-Maß bestraft Zerlegungstiefe nicht (D42/D69)', () => {
    /* Beide Alternativen ziehen je ein M-schweres Ziel: A ein zerlegtes
       (M mit zwei S-Kindern), B ein grobes (L). Über die Marginal-Summe
       wiegen beide 4 — Gleichstand, die erste Alternative (A) gewinnt.
       Die frühere Knoten-Summe zählte das zerlegte Ziel mit 3+2+2 = 7 und
       ließe B gewinnen. */
    const txt = `- [ ] Wurzel (XS)
  - [ ] Wahl (XS)
    | [ ] A (S) :#t1
    | [ ] B (S) :#t2
  + [ ] Extras (XS)
    - [ ] #t1: Zerlegt (M)
      - [ ] t1a (S)
      - [ ] t1b (S)
    - [ ] #t2: Grob (L)`;
    const { set, exact } = computeCheapPlan(roots(txt));
    const labels = [...set].map(n => n.label);
    expect(exact).toBe(true);
    expect(labels).toContain('A');
    expect(labels).not.toContain('B');
  });
});
