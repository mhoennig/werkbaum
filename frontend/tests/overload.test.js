import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { computeCheapSet, assigneeLoads, overloadedAssignee } from '../src/model.js';
import { renderTreeHtml } from '../src/render.js';
import { formatWarning } from '../src/warnings.js';

/* Zuständigen-Engpass (SPEC §7/§9, D71): Trägt eine Person mehr als die Hälfte
   der offenen Arbeit des günstigsten Pfads (Marginalkosten-Maß, D69) und gibt
   es mindestens zwei Personen mit Last auf der offenen Front, wird gewarnt.
   Knoten ohne Tags erben für die Rechnung vom nächsten getaggten Vorfahren;
   mehrere Tags teilen sich den Beitrag. Kostenskala: XS=1 S=2 M=3 L=4 XL=5. */

const roots = txt => parse(txt).roots;
const plan = txt => { const r = roots(txt); return { r, set: computeCheapSet(r) }; };
const t = (key, vars) => {
  let s = key;
  if(vars) for(const k in vars) s += ':' + vars[k];
  return s;
};

describe('overloadedAssignee — die Engpass-Entscheidung', () => {
  it('eine Person über der Hälfte, eine zweite auf der Front: Warnung', () => {
    const { r, set } = plan(`[ ] Plan
  - [ ] A (L) @anna
  - [ ] B (XS) @ben`);
    /* anna 4, ben 1, Wurzel geschätzt L mit Marge 0 ⇒ total 5, anna 80 % */
    expect(overloadedAssignee(r, set)).toEqual(
      {tag: 'anna', share: 80, stations: 1, totalStations: 2});
  });

  it('ein Solo-Plan warnt nie — auch bei 100 %', () => {
    const { r, set } = plan(`[ ] Plan
  - [ ] A (L) @anna
  - [ ] B (S) @anna`);
    expect(overloadedAssignee(r, set)).toBeNull();
  });

  it('genau die Hälfte reicht nicht — die Schwelle ist strikt', () => {
    const { r, set } = plan(`[ ] Plan
  - [ ] A (L) @anna
  - [ ] B (L) @ben`);
    expect(overloadedAssignee(r, set)).toBeNull();
  });

  it('Knoten ohne Tags erben vom nächsten Vorfahren mit Tags', () => {
    const { r, set } = plan(`[ ] Plan
  - [ ] Paket (L) @anna
    - [ ] Teil (M)
  - [ ] B (S) @ben`);
    /* Teil (3) gehört per Vererbung anna; dazu Paket-Marge 1 ⇒ anna 4 von 6.
       Ohne Vererbung wäre anna nur die Marge 1 und niemand über der Hälfte. */
    const o = overloadedAssignee(r, set);
    expect(o && o.tag).toBe('anna');
    expect(o.share).toBe(67);
  });

  it('mehrere Tags einer Zeile teilen sich den Beitrag', () => {
    const { r, set } = plan(`[ ] Plan
  - [ ] A (L) @anna @ben
  - [ ] C (S) @carla`);
    /* A: je 2 für anna und ben; voll doppelt gezählt läge anna bei 4 von 6
       und würde fälschlich gemeldet. */
    expect(overloadedAssignee(r, set)).toBeNull();
  });

  it('Erledigtes trägt keine Last — die offene Front zählt', () => {
    const { r, set } = plan(`[ ] Plan
  - [x] Big (XL) @ben
  - [ ] A (S) @anna
  - [ ] B (XS) @ben`);
    /* bens großer Brocken ist fertig (0); offen sind anna 2 und ben 1 */
    const o = overloadedAssignee(r, set);
    expect(o && o.tag).toBe('anna');
  });

  it('nicht zugewiesene Arbeit verwässert die Anteile, warnt aber nicht', () => {
    const { r, set } = plan(`[ ] Plan (XXL)
  - [ ] A (S) @anna
  - [ ] B (XS) @ben`);
    /* Wurzel-Marge 3 gehört niemandem ⇒ anna 2 von 6, unter der Hälfte */
    expect(overloadedAssignee(r, set)).toBeNull();
  });

  it('leere Pfadmenge (Pfad aus): keine Aussage', () => {
    const r = roots(`[ ] Plan
  - [ ] A (L) @anna
  - [ ] B (XS) @ben`);
    expect(overloadedAssignee(r, new Set())).toBeNull();
  });
});

describe('assigneeLoads — das Maß dahinter', () => {
  it('Marginalkosten je Person, Summe ist der Pfadpreis', () => {
    const { r, set } = plan(`[ ] Plan
  - [ ] A (L) @anna
  - [ ] B (XS) @ben`);
    const { loads, total } = assigneeLoads(r, set);
    expect(loads.get('anna')).toBe(4);
    expect(loads.get('ben')).toBe(1);
    expect(total).toBe(5);
  });

  it('Stationen zählen nur offene Blätter des Pfads', () => {
    const { r, set } = plan(`[ ] Plan
  - [x] Fertig (S) @anna
  - [ ] Offen (S) @anna
  - [ ] B (XS) @ben`);
    const { stations, totalStations } = assigneeLoads(r, set);
    expect(stations.get('anna')).toBe(1);
    expect(totalStations).toBe(2);
  });
});

describe('Darstellung', () => {
  it('die Pille der überlasteten Person wird an offenen Pfad-Knoten markiert', () => {
    const { r, set } = plan(`[ ] Plan
  - [ ] A (L) @anna
  - [x] Done (S) @anna
  - [ ] B (XS) @ben`);
    const { html } = renderTreeHtml(r, {t, showDiscarded: false, cheapPath: true,
                                        cheapSet: set, overloadTag: 'anna'});
    /* genau eine markierte Pille: am offenen A — nicht am erledigten Done,
       nicht an bens Pille */
    expect(html.match(/tag overload/g)).toHaveLength(1);
    expect(html).toContain('<span class="tag overload">anna</span>');
    expect(html).toContain('<span class="tag">ben</span>');
  });

  it('ohne overloadTag bleibt alles wie bisher', () => {
    const { r, set } = plan(`[ ] Plan
  - [ ] A (L) @anna
  - [ ] B (XS) @ben`);
    const { html } = renderTreeHtml(r, {t, showDiscarded: false, cheapPath: true,
                                        cheapSet: set, overloadTag: null});
    expect(html).not.toContain('overload');
  });

  it('die Warnung nennt Person, Anteil und Stationen', () => {
    const msg = formatWarning(
      {type: 'assigneeOverload', tag: 'anna', share: 80, stations: 1, totalStations: 2}, t);
    expect(msg).toBe('assigneeOverloadWarn:anna:80:1:2');
  });
});
