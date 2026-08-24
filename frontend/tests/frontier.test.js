import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import {
  isDone, ownCost, cheapestCost, cheapCls, computeCheapSet,
} from '../src/model.js';
import { renderTreeHtml } from '../src/render.js';

/* Status-bewusster günstigster Pfad (SPEC §9, D46): Erledigtes kostet nichts
   mehr und ist keine Station; hervorgehoben wird der günstigste noch OFFENE
   Rest — die aktuelle Front. */

const roots = txt => parse(txt).roots;
const cheapLabels = txt => [...computeCheapSet(roots(txt))].map(n => n.label).sort();
/* Stationen = Knoten mit 'cheap-leaf' (die Pfadlinie fädelt durch sie). Der
   Baum wird EINMAL geparst und beides daraus abgeleitet — `Set.has()` prüft
   auf Objektidentität, ein zweiter Parse-Durchlauf träfe nie (Falle aus D28). */
function plan(txt){
  const rs = roots(txt);
  const set = computeCheapSet(rs);
  const st = [];
  (function walk(ns){
    for(const n of ns){
      if(cheapCls(n, set, false).includes('cheap-leaf')) st.push(n.label);
      walk(n.children);
    }
  })(rs);
  return { rs, set, stationen: st.sort(), aufPfad: [...set].map(n => n.label).sort() };
}

describe('isDone — die Schwelle liegt bei „fertig"', () => {
  it('erkennt [x] und [^], sonst nichts', () => {
    const rs = roots(`[?] a
[ ] b
[!] c
[~] d
[/] e
[x] f
[^] g
[-] h
i`);
    expect(rs.map(isDone)).toEqual([false, false, false, false, false, true, true, false, false]);
  });
});

describe('Kosten — Erledigtes zählt nicht mehr', () => {
  it('kostet 0, unabhängig von der Größe', () => {
    const [a, b, c] = roots(`[x] Fertig (XXL)
[^] Prod (XL)
[~] Arbeit (XS)`);
    expect(ownCost(a)).toBe(0);
    expect(ownCost(b)).toBe(0);
    expect(ownCost(c)).toBeGreaterThan(0);
  });

  it('Angefangenes ([~], [/]) zählt weiterhin voll', () => {
    const [a, b] = roots(`[~] A (L)
[ ] B (L)`);
    expect(ownCost(a)).toBe(ownCost(b));
  });

  it('zählt den intrinsischen Status — Abhängigkeiten halten ihn nicht auf', () => {
    /* Effektiv ist A erst „geplant" (D39), investiert ist trotzdem investiert. */
    const [a] = roots(`[x] A (XL) :#b
[ ] B #b (XS)`);
    expect(ownCost(a)).toBe(0);
  });

  it('zieht nur die eigenen Kosten ab, nicht den Teilbaum', () => {
    const [n] = roots(`[x] Eltern (L)
  - [ ] Kind (S)`);
    expect(cheapestCost(n)).toBe(cheapestCost(roots('[ ] Kind (S)')[0]));
  });
});

describe('Auswahl — die getroffene Wahl gewinnt', () => {
  it('eine realisierte Alternative schlägt die nominell billigere', () => {
    /* Ohne Status-Bewusstsein gewönne „Billig" (XS gegen L). */
    expect(cheapLabels(`[ ] Wahl (XS)
  | [x] Gemacht (L)
  | [ ] Billig (XS)`)).toEqual(['Gemacht', 'Wahl']);
  });

  it('eine erst angefangene Alternative gewinnt dadurch NICHT', () => {
    expect(cheapLabels(`[ ] Wahl (XS)
  | [~] Angefangen (L)
  | [ ] Billig (XS)`)).toEqual(['Billig', 'Wahl']);
  });

  it('gilt auch in einer XOR-Gruppe', () => {
    expect(cheapLabels(`[ ] Wahl (XS)
  = [ ] Billig (XS)
  = [^] Live (XL)`)).toEqual(['Live', 'Wahl']);
  });
});

describe('Stationen — die Linie zeigt den offenen Rest', () => {
  it('erledigte Blätter tragen keinen Punkt', () => {
    const p = plan(`[ ] W (XS)
  - [x] Fertig (S)
  - [ ] Offen (S)`);
    expect(p.aufPfad).toEqual(['Fertig', 'Offen', 'W']);   /* beide bleiben auf dem Pfad */
    expect(p.stationen).toEqual(['Offen']);
  });

  it('ein offener Knoten mit lauter erledigten Kindern wird selbst zur Station', () => {
    /* Die Restarbeit ist dann die des Elternknotens — sonst hätte der Zweig
       gar keine Station, obwohl dort noch etwas offen ist. */
    const p = plan(`[~] Eltern (M)
  - [x] A (S)
  - [^] B (S)`);
    expect(p.stationen).toEqual(['Eltern']);
  });

  it('ein erledigter Knoten mit offenem Kind bleibt Durchgang', () => {
    const p = plan(`[x] Eltern (M)
  - [ ] Kind (S)`);
    expect(p.stationen).toEqual(['Kind']);
  });

  it('ein durchweg erledigter Baum hat keine Station mehr', () => {
    const p = plan(`[^] W (L)
  - [x] A (S)
  - [x] B (S)`);
    expect(p.stationen).toEqual([]);
    expect(p.aufPfad).toEqual(['A', 'B', 'W']);   /* der Pfad selbst bleibt */
  });
});

describe('Eingeklappt — der Knoten vertritt offene Arbeit, nicht erledigte', () => {
  it('vertritt einen Teilbaum mit offener Pfadarbeit als Station (D38)', () => {
    const rs = roots(`[ ] W (XS)
  - [ ] Zweig (M)
    - [ ] Tief (S)`);
    const set = computeCheapSet(rs);
    const zweig = rs[0].children[0];
    expect(cheapCls(zweig, set, true)).toBe('cheap cheap-leaf');
  });

  it('bleibt ohne Punkt, wenn darunter alles erledigt ist', () => {
    const rs = roots(`[ ] W (XS)
  - [x] Zweig (M)
    - [x] Tief (S)`);
    const set = computeCheapSet(rs);
    const zweig = rs[0].children[0];
    expect(cheapCls(zweig, set, true)).toBe('cheap');   /* auf dem Pfad, aber nichts zu tun */
  });
});

/* Die Klasse `done` trägt allein die Ausnahme von der Pfad-Inversion
   (D46-Nachtrag): Erledigtes wird nie ausgeblasst, auch wenn es nicht auf
   dem Pfad liegt. Sie folgt dem INTRINSISCHEN Status. */
describe('Klasse `done` — Erledigtes tritt nie zurück', () => {
  const html = txt => {
    const rs = roots(txt);
    return renderTreeHtml(rs, {t: k => k, showDiscarded: false,
                               cheapPath: true, cheapSet: computeCheapSet(rs)}).html;
  };

  it('setzt sie an [x] und [^], nicht an offenen Knoten', () => {
    const h = html(`[ ] W (XS)
  - [x] Fertig (S)
  - [^] Live (S)
  - [~] Offen (S)`);
    expect(h).toContain('class="node cheap done st-fertig"');
    expect(h).toContain('class="node cheap done st-prod"');
    expect(h).toContain('class="node cheap cheap-leaf st-arbeit"');
  });

  it('setzt sie auch am fertigen OPTIONALEN Knoten, der nie auf dem Pfad liegt', () => {
    const rs = roots(`[ ] W (XS)
  - [ ] Pflicht (S)
  + [^] Zugabe (S)`);
    const set = computeCheapSet(rs);
    const zugabe = rs[0].children[1];
    expect(set.has(zugabe)).toBe(false);            /* `+` ist nie auf dem Pfad (D29) */
    const h = renderTreeHtml(rs, {t: k => k, showDiscarded: false,
                                  cheapPath: true, cheapSet: set}).html;
    expect(h).toContain('class="node opt done st-prod"');
  });

  it('setzt sie an der fertigen, nicht gewählten Alternative', () => {
    const h = html(`[ ] W (XS)
  | [^] Alt A (XS)
  | [^] Alt B (XS)`);
    expect(h.match(/class="node[^"]*done[^"]*st-prod"/g)).toHaveLength(2);
  });

  it('setzt sie nicht am verworfenen Knoten', () => {
    const h = html(`[ ] W (XS)
  - [ ] A (S)
  - [-] Weg (S)`);
    expect(h).not.toContain('done st-verworfen');
  });
});
