import { describe, it, expect } from 'vitest';
import { parse, setFoldMark } from '../src/parser.js';
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

/* Umkehrung der Marken-Extraktion fürs Zurückschreiben aus dem Diagramm
   (SPEC §1, D38-Nachtrag 2): Angefasst wird nur die Marke samt Leerraum. */
describe('setFoldMark — Faltmarke setzen und entfernen', () => {
  it('setzt `>` hinter das Zerlegungszeichen', () => {
    expect(setFoldMark('  - [x] Concept (M)', '>')).toBe('  - > [x] Concept (M)');
  });

  it('entfernt eine vorhandene Marke', () => {
    expect(setFoldMark('  - > [x] Concept (M)', null)).toBe('  - [x] Concept (M)');
  });

  it('ersetzt `<` durch `>`', () => {
    expect(setFoldMark('    - < [ ] B1', '>')).toBe('    - > [ ] B1');
  });

  it('setzt die Marke bei Wurzelzeilen an den Zeilenanfang', () => {
    expect(setFoldMark('[~] Wurzel', '>')).toBe('> [~] Wurzel');
    expect(setFoldMark('> [~] Wurzel', null)).toBe('[~] Wurzel');
  });

  it('lässt ungewöhnliche Spaltung stehen', () => {
    expect(setFoldMark('  -   [x] X', '>')).toBe('  -   > [x] X');
    expect(setFoldMark('\t= [ ] Cloud', '>')).toBe('\t= > [ ] Cloud');
  });

  it('fasst ein `>` im Label nicht an (Leerraum-Regel)', () => {
    /* `- >Achtung` ist ein Label, keine Marke — die neue Marke kommt davor. */
    expect(setFoldMark('  - >Achtung', '>')).toBe('  - > >Achtung');
    expect(setFoldMark('  - >Achtung', null)).toBe('  - >Achtung');
  });

  it('ist verlustfrei umkehrbar', () => {
    for(const l of ['[ ] W', '  - [x] A (M) @anna', '  | [?] B', '    + [-] C']){
      expect(setFoldMark(setFoldMark(l, '>'), null)).toBe(l);
    }
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

/* Der eingeklappte Knoten vertritt seinen Teilbaum auch auf dem günstigsten
   Pfad (SPEC §9, D38-Nachtrag): Sonst überspränge die Pfad-Linie den ganzen
   Zweig, als wäre dort nichts zu tun. */
describe('Günstigster Pfad an eingeklappten Knoten', () => {
  /* Nimmt die BEREITS geparsten Wurzeln: `collapsedSet` und `cheapSet` prüfen
     auf Objektidentität — ein zweiter Parse-Durchlauf liefert andere Objekte
     und die Mengen träfen nie zu (dieselbe Falle wie in D28). */
  const cheapRender = (r, collapsedSet) =>
    renderTreeHtml(r, {t, showDiscarded: false, cheapPath: true,
      cheapSet: computeCheapSet(r), collapsedSet: collapsedSet || new Set()}).html;
  /* Labels der Stationen (`cheap-leaf`) in Dokumentreihenfolge — genau die
     Menge, durch die drawCheapPath() die Linie fädelt. Gelesen aus dem
     `aria-label` (erstes Glied = Label): Im Knoteninneren steht bei
     eingeklappten Knoten das Falt-Zeichen vor dem Text. */
  const stations = html =>
    [...html.matchAll(/class="node[^"]*cheap-leaf[^"]*"[^>]*aria-label="([^",]*)/g)]
      .map(m => m[1]);

  const TXT = `[ ] W (XS)\n  - [ ] A (S)\n    - [ ] A1 (S)\n    - [ ] A2 (S)\n  - [ ] B (S)`;

  it('macht den eingeklappten Knoten zur Station statt den Zweig zu überspringen', () => {
    const r = roots(TXT);
    const a = r[0].children[0];
    expect(stations(cheapRender(r))).toEqual(['A1', 'A2', 'B']);       /* offen */
    expect(stations(cheapRender(r, new Set([a])))).toEqual(['A', 'B']); /* zu */
  });

  it('gibt die Station beim Aufklappen wieder an die Kinder ab', () => {
    const r = roots(TXT);
    const a = r[0].children[0];
    const zu  = stations(cheapRender(r, new Set([a])));
    const auf = stations(cheapRender(r, new Set()));
    expect(zu).not.toContain('A1');
    expect(auf).toContain('A1');
    expect(auf).not.toContain('A');
  });

  it('vertritt auch einen Teilbaum, den der Knoten selbst nicht braucht', () => {
    /* `+ O` ist entbehrlich und nicht auf dem Pfad — sein Kind wird aber per
       Abhängigkeit gezogen (D42). Eingeklappt ist `O` der einzige sichtbare
       Griff darauf und darf deshalb weder fehlen noch ausgeblasst sein. */
    const txt = `[ ] W (XS)\n  - [ ] N (S) :#t\n  + [ ] O (S)\n    - [ ] #t: T (S)`;
    const r = roots(txt);
    const o = r[0].children[1];
    const set = computeCheapSet(r);
    expect([...set].map(n => n.label).sort()).toEqual(['N', 'T', 'W']);  /* O selbst nicht */
    const {html} = renderTreeHtml(r, {t, showDiscarded: false, cheapPath: true,
      cheapSet: set, collapsedSet: new Set([o])});
    expect(stations(html)).toContain('O');
  });

  it('macht einen eingeklappten Knoten ohne Pfad im Teilbaum NICHT zur Station', () => {
    const txt = `[ ] W (XS)\n  - [ ] N (S)\n  + [ ] O (S)\n    - [ ] P (S)`;
    const r = roots(txt);
    const o = r[0].children[1];
    const {html} = renderTreeHtml(r, {t, showDiscarded: false, cheapPath: true,
      cheapSet: computeCheapSet(r), collapsedSet: new Set([o])});
    expect(stations(html)).toEqual(['N']);
  });
});
