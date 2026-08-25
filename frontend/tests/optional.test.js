import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { computeCheapSet, cheapestCost, cheapCls, visibleChildren } from '../src/model.js';
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

describe('Günstigster Pfad — unangetastete Zugaben sind nicht nötig', () => {
  const BAUM = `[ ] Wurzel (S)
  - [ ] Pflicht (S)
  + [ ] Zugabe (XXL)
    - [ ] Unterpunkt (S)`;

  it('lässt den optionalen Knoten samt Teilbaum aus dem Pfad', () => {
    expect(cheapLabels(BAUM)).toEqual(['Pflicht', 'Wurzel']);
  });

  it('die bewertete Wurzel bepreist ihren Teilbaum — die Zugabe erst recht nicht', () => {
    /* Seit D69 ist der Preis die eigene Größe: Wurzel (S) = 2, unabhängig
       von Pflicht und XXL-Zugabe. Dass Zugaben auch die GESCHÄTZTE Größe
       eines größenlosen Knotens nicht erhöhen, sichern die D66-Tests. */
    expect(cheapestCost(roots(BAUM)[0])).toBe(2);
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

/* Die Ausnahme (D61): Wird an der Zugabe gearbeitet, ist sie offene Arbeit —
   und der Pfad zeigt seit D46 die offene Front. Erledigte bleiben draußen. */
describe('Günstigster Pfad — an einer angefangenen Zugabe wird gearbeitet', () => {
  it('nimmt eine `[~]`-Zugabe auf den Pfad', () => {
    expect(cheapLabels(`[ ] Wurzel (S)\n  - [ ] Pflicht (S)\n  + [~] Zugabe (S)`))
      .toEqual(['Pflicht', 'Wurzel', 'Zugabe']);
  });

  it('nimmt eine `[/]`-Zugabe ebenso', () => {
    expect(cheapLabels(`[ ] Wurzel (S)\n  + [/] Zugabe (S)`))
      .toEqual(['Wurzel', 'Zugabe']);
  });

  it('lässt `[?]`, `[ ]`, `[!]` und ohne Status weiterhin draußen', () => {
    expect(cheapLabels(`[ ] Wurzel (S)
  + [?] Idee (S)
  + [ ] Geplant (S)
  + [!] Riskant (S)
  + Neutral (S)`)).toEqual(['Wurzel']);
  });

  /* Genau der Punkt, an dem die Empfehlung korrigiert wurde: Fertiges gehört
     nicht auf die offene Front — und was darunter offen blieb, ist mit der
     Zugabe zusammen entbehrlich (§3). */
  it('lässt eine erledigte Zugabe samt offenem Rest draußen', () => {
    expect(cheapLabels(`[ ] Wurzel (S)
  + [x] Fertige Zugabe (S)
    - [ ] Rest (M)
  + [^] Live (S)`)).toEqual(['Wurzel']);
  });

  it('nimmt den Teilbaum der angefangenen Zugabe mit', () => {
    expect(cheapLabels(`[ ] Wurzel (S)\n  + [~] Zugabe (S)\n    - [ ] Teil (S)`))
      .toEqual(['Teil', 'Wurzel', 'Zugabe']);
  });

  it('die angefangene Zugabe behält ihren eigenen Preis auf dem Pfad', () => {
    /* Seit D69 bepreist die Wurzel nur sich selbst (S = 2); die angefangene
       Zugabe liegt mit ihrem eigenen Preis daneben auf dem Pfad. */
    const [wurzel] = roots(`[ ] Wurzel (S)\n  + [~] Zugabe (S)`);
    expect(cheapestCost(wurzel)).toBe(2);
    expect(cheapestCost(wurzel.children[0])).toBe(2);
  });

  it('macht sie zur Station statt des Elternknotens', () => {
    const [wurzel] = roots(`[ ] Wurzel (S)\n  + [~] Zugabe (S)`);
    const set = computeCheapSet([wurzel]);
    expect(cheapCls(wurzel, set, false)).toBe('cheap');
    expect(cheapCls(wurzel.children[0], set, false)).toBe('cheap cheap-leaf');
  });

  it('lässt eine verworfene Zugabe auch angefangen draußen', () => {
    expect(cheapLabels(`[ ] Wurzel (S)\n  + [-] Abgebrochen (S)`)).toEqual(['Wurzel']);
  });
});

describe('Renderer — Kennzeichnung und Gemischt-Warnung', () => {
  it('gibt dem optionalen Knoten die Klasse `opt`', () => {
    const {html} = render(`[ ] Wurzel\n  - [ ] Pflicht\n  + [ ] Zugabe`);
    expect((html.match(/class="node opt[ "]/g) || []).length).toBe(1);
    expect(html).toContain('>Zugabe<');
  });

  /* Der Abzweig wird von den <li>-Pseudoelementen gezeichnet — für den
     gestrichelten Ast braucht das <li> die Klasse ebenfalls (D29). */
  it('gibt auch dem <li> die Klasse `opt`, neben dem Gate der eigenen Kinder', () => {
    const {html} = render(`[ ] Wurzel\n  + [ ] Zugabe\n    | [ ] A\n    | [ ] B`);
    expect(html).toContain('<li class="has-or opt">');
  });

  it('lässt das <li> ohne Attribut, wenn weder Kinder noch optional', () => {
    const {html} = render(`[ ] Wurzel\n  - [ ] Pflicht`);
    expect(html).toContain('<li>');
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
