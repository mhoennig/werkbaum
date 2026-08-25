import { describe, it, expect } from 'vitest';
import { parse, setFoldMark } from '../src/parser.js';
import { initialCollapsed, computeCheapSet, atMostM, presetFoldSet } from '../src/model.js';
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
describe('Parser — Faltmarke unmittelbar vor dem Label', () => {
  it('erkennt `>` und `<` hinter der Statusbox und nimmt sie aus dem Label', () => {
    const [wurzel] = roots(`[ ] Wurzel\n  - [x] > Zu (M)\n  - [ ] < Auf`);
    expect(wurzel.children.map(k => [k.label, k.fold, k.status?.key]))
      .toEqual([['Zu', '>', 'fertig'], ['Auf', '<', 'geplant']]);
    expect(wurzel.fold).toBe(null);
  });

  it('liest die alte Stellung (vor der Box) weiter — D34-Nachtrag 2', () => {
    const [wurzel] = roots(`[ ] Wurzel\n  - > [x] Zu (M)\n  - < [ ] Auf`);
    expect(wurzel.children.map(k => [k.label, k.fold, k.status?.key]))
      .toEqual([['Zu', '>', 'fertig'], ['Auf', '<', 'geplant']]);
  });

  it('erkennt die Marke ohne Statusbox direkt hinter dem Zeichen', () => {
    const [wurzel] = roots(`> [~] Kapitel\n  - > Kind ohne Box`);
    expect([wurzel.fold, wurzel.label]).toEqual(['>', 'Kapitel']);
    expect(wurzel.children.map(k => [k.label, k.fold]))
      .toEqual([['Kind ohne Box', '>']]);
  });

  it('verlangt folgenden Leerraum — `[x] >Achtung` bleibt ein Label', () => {
    const [wurzel] = roots(`[ ] Wurzel\n  - >Achtung\n  - [x] >Achtung`);
    expect(wurzel.children.map(k => [k.label, k.fold]))
      .toEqual([['>Achtung', null], ['>Achtung', null]]);
  });

  it('lässt ein `>` mitten im Label unberührt', () => {
    const [wurzel] = roots(`[ ] a > b`);
    expect([wurzel.label, wurzel.fold]).toEqual(['a > b', null]);
  });
});

/* Umkehrung der Marken-Extraktion fürs Zurückschreiben aus dem Diagramm
   (SPEC §1, D38-Nachtrag 2): Angefasst wird nur die Marke samt Leerraum. */
describe('setFoldMark — Faltmarke setzen und entfernen', () => {
  it('setzt `>` hinter die Statusbox, unmittelbar vor das Label', () => {
    expect(setFoldMark('  - [x] Concept (M)', '>')).toBe('  - [x] > Concept (M)');
  });

  it('entfernt eine vorhandene Marke', () => {
    expect(setFoldMark('  - [x] > Concept (M)', null)).toBe('  - [x] Concept (M)');
  });

  it('ersetzt `<` durch `>`', () => {
    expect(setFoldMark('    - [ ] < B1', '>')).toBe('    - [ ] > B1');
  });

  it('löst die alte Stellung (vor der Box) in die neue auf', () => {
    /* Gelesen wird sie weiter (D34-Nachtrag 2), geschrieben nie. */
    expect(setFoldMark('  - > [x] Concept (M)', '>')).toBe('  - [x] > Concept (M)');
    expect(setFoldMark('  - < [x] Concept (M)', '>')).toBe('  - [x] > Concept (M)');
    expect(setFoldMark('  - > [x] Concept (M)', null)).toBe('  - [x] Concept (M)');
  });

  it('setzt die Marke ohne Statusbox direkt hinter das Zeichen', () => {
    expect(setFoldMark('  - Konzeption', '>')).toBe('  - > Konzeption');
    expect(setFoldMark('[~] Wurzel', '>')).toBe('[~] > Wurzel');
    expect(setFoldMark('[~] > Wurzel', null)).toBe('[~] Wurzel');
    expect(setFoldMark('Wurzel ohne Box', '>')).toBe('> Wurzel ohne Box');
  });

  it('lässt ungewöhnliche Spaltung stehen', () => {
    expect(setFoldMark('  -   [x] X', '>')).toBe('  -   [x] > X');
    expect(setFoldMark('\t= [ ] Cloud', '>')).toBe('\t= [ ] > Cloud');
  });

  it('fasst ein `>` im Label nicht an (Leerraum-Regel)', () => {
    /* `[x] >Achtung` ist ein Label, keine Marke — die neue Marke kommt davor. */
    expect(setFoldMark('  - [x] >Achtung', '>')).toBe('  - [x] > >Achtung');
    expect(setFoldMark('  - [x] >Achtung', null)).toBe('  - [x] >Achtung');
  });

  it('hält die Statusbox-Spalte über die Ebenen hinweg bündig', () => {
    /* Der Grund für die Stellung (D34-Nachtrag 2): Vor der Box geschrieben,
       rückte die Box der gefalteten Zeile um genau eine Einrückungsstufe ein
       und stand dann in der Spalte der Boxen ihrer eigenen Kinder. */
    const eltern = setFoldMark('  - [ ] erster Schritt', '>');
    const kind   = '    - [ ] Schritt 1a';
    expect(eltern.indexOf('[')).toBe(4);
    expect(kind.indexOf('[')).toBe(6);
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

/* Voreinstellung „unter Größe M zuklappen" im Diagramm-Kopf (SPEC §9, D44).
   Das Falten selbst liegt in app.js (kein headless-Testziel); geprüft wird
   das Prädikat, das entscheidet, WELCHE Knoten es trifft. */
describe('atMostM — Auswahl für „Größe M und kleiner zuklappen"', () => {
  const groessen = txt => roots(txt).map(n => [n.label, atMostM(n)]);

  it('trifft XS, S und M — offen bleiben nur L, XL, XXL', () => {
    expect(groessen('[ ] a (XS)\n[ ] b (S)\n[ ] c (M)\n[ ] d (L)\n[ ] e (XL)\n[ ] f (XXL)'))
      .toEqual([['a', true], ['b', true], ['c', true], ['d', false],
                ['e', false], ['f', false]]);
  });

  it('trifft Knoten OHNE Größenangabe nicht', () => {
    /* Der günstigste Pfad rechnet fehlende Größen als M (D18) — das ist eine
       Kostenannahme, keine Aussage des Autors, und faltet hier nichts zu. */
    expect(groessen('[ ] ohne')).toEqual([['ohne', false]]);
  });

  it('ist von Status und Optionalität unabhängig', () => {
    expect(groessen('[x] a (S)\n[-] b (S)\n[ ] c (L)').map(([, b]) => b))
      .toEqual([true, true, false]);
  });

  it('gilt auch für Knoten tief im Baum', () => {
    const [w] = roots('[ ] W (XL)\n  - [ ] A (M)\n    - [ ] A1 (XS)\n  - [ ] B (L)');
    expect([atMostM(w), ...w.children.map(atMostM)]).toEqual([false, true, false]);
    expect(atMostM(w.children[0].children[0])).toBe(true);
  });
});

/* Zeile -> sichtbarer Vertreter (SPEC §9, D38-Nachtrag 4): Liegt der Knoten
   der Cursor-Zeile in einem eingeklappten Teilbaum, vertritt ihn der nächste
   sichtbare Vorfahr — für die Hervorhebung wie für den Alt+Klick. */
import { lineTargets } from '../src/model.js';

describe('lineTargets — der eingeklappte Knoten vertritt seine Zeilen', () => {
  const byLabel = (ns, label) => {
    for(const n of ns){
      if(n.label === label) return n;
      const hit = byLabel(n.children, label);
      if(hit) return hit;
    }
    return null;
  };
  const txt = 'A\n  - B\n    - C\n      - D\n  - [-] E\n    - F';

  it('sichtbare Knoten zeigen auf sich selbst', () => {
    const r = roots(txt);
    const map = lineTargets(r, new Set(), true);
    expect(map.get(1)).toBe(1);
    expect(map.get(3)).toBe(3);
  });

  it('Zeilen unter einem eingeklappten Knoten zeigen auf ihn', () => {
    const r = roots(txt);
    const map = lineTargets(r, new Set([byLabel(r, 'B')]), true);
    expect(map.get(2)).toBe(2);   /* der eingeklappte selbst ist sichtbar */
    expect(map.get(3)).toBe(2);
    expect(map.get(4)).toBe(2);
  });

  it('bei verschachtelter Faltung gilt der ÄUSSERSTE eingeklappte Vorfahr', () => {
    const r = roots(txt);
    const map = lineTargets(r, new Set([byLabel(r, 'B'), byLabel(r, 'C')]), true);
    expect(map.get(4)).toBe(2);
  });

  it('Beschreibungs- und Fortsetzungszeilen wandern mit ihrem Knoten', () => {
    const t2 = 'A\n  - B mit einem \\\n    langen Titel\n    " Notiz';
    const r = roots(t2);
    const map = lineTargets(r, new Set([byLabel(r, 'A')]), true);
    expect(map.get(3)).toBe(1);   /* Fortsetzung */
    expect(map.get(4)).toBe(1);   /* "-Zeile */
  });

  it('ausgeblendete verworfene Elemente fehlen — sie heben weiter nichts hervor', () => {
    const r = roots(txt);
    expect(lineTargets(r, new Set(), false).has(6)).toBe(false);
    expect(lineTargets(r, new Set(), true).get(6)).toBe(6);
  });
});

/* Falt-Voreinstellungen des Durchschalters (SPEC §9, D75): je Modus ein
   VOLLSTÄNDIGER Faltzustand als Menge der zuzuklappenden Knoten. */
describe('presetFoldSet — die vier Voreinstellungen', () => {
  const PLAN = `[ ] #w: Wurzel
  - [ ] #a: Gross (L)
    - [ ] #a1: Mittel (M)
      - [ ] #a1a: Blatt (S)
    - [ ] #a2: Ohne Groesse
      - [ ] Blatt 2
  + [?] #b: Zugabe (M)
    - [?] #b1: Blatt 3`;
  const collapsed = (mode, cheapSet) => {
    const r = roots(PLAN);
    return [...presetFoldSet(r, mode, cheapSet ?? computeCheapSet(r))]
      .map(n => n.label).sort();
  };

  it("'small' klappt jeden faltbaren Knoten mit angegebener Groesse <= M zu", () => {
    /* `Mittel` (M) und `Zugabe` (M); `Ohne Groesse` bleibt offen — keine
       Autoren-Aussage (D44) — und `Gross` (L) sowieso. */
    expect(collapsed('small')).toEqual(['Mittel', 'Zugabe']);
  });

  it("'path' klappt jeden Knoten zu, durch dessen Teilbaum der Pfad nicht laeuft", () => {
    /* Die unangetastete Zugabe liegt nie auf dem Pfad (D29/D61) — sie ist der
       einzige faltbare Knoten ohne Pfad im Teilbaum. */
    expect(collapsed('path')).toEqual(['Zugabe']);
  });

  it("'path' laesst einen Knoten offen, sobald ein UNTERKNOTEN auf dem Pfad liegt", () => {
    const r = roots(`[ ] Wurzel\n  + [?] Zweig\n    - [ ] #ziel: Gebraucht (S)\n  - [ ] Braucht was (S) :#ziel`);
    /* `#ziel` wird per Abhaengigkeit gezogen (D42) — der Zweig darueber traegt
       Pfad im Teilbaum und bleibt offen, obwohl er selbst nicht gebraucht wird. */
    expect([...presetFoldSet(r, 'path', computeCheapSet(r))].map(n => n.label))
      .toEqual([]);
  });

  it("'closed' klappt alle faltbaren Knoten zu, 'open' keinen", () => {
    expect(collapsed('closed'))
      .toEqual(['Gross', 'Mittel', 'Ohne Groesse', 'Wurzel', 'Zugabe']);
    expect(collapsed('open')).toEqual([]);
  });
});

/* Der eingeklappte Knoten vertritt seinen Teilbaum auch für die
   Querverbindungen (SPEC §9, D75): IDs und Abhaengigkeiten der verborgenen
   Knoten haengen als data-sub-ids/data-sub-deps am Vertreter. */
describe('Renderer — data-sub-ids/data-sub-deps am eingeklappten Knoten', () => {
  const PLAN = `[ ] Wurzel
  - [ ] #box: Zweig
    - [ ] #box.a: Drin :#ziel
    - [ ] #box.b: Auch drin :#ziel,#box.a
  - [ ] #ziel: Draussen`;

  it('sammelt IDs (Dokumentreihenfolge) und Abhaengigkeiten (dedupliziert)', () => {
    const r = roots(PLAN);
    const zweig = r[0].children[0];
    const html = renderTreeHtml(r, {t, showDiscarded: false, cheapPath: false,
      cheapSet: new Set(), collapsedSet: new Set([zweig])}).html;
    expect(html).toContain('data-sub-ids="box.a box.b"');
    /* #ziel und #box.a je einmal, obwohl #ziel zweimal gebraucht wird. */
    expect(html).toContain('data-sub-deps="ziel box.a"');
  });

  it('haengt an offene Knoten keine sub-Attribute', () => {
    const html = render(PLAN).html;
    expect(html).not.toContain('data-sub-ids');
    expect(html).not.toContain('data-sub-deps');
  });

  it('sammelt ausgeblendete verworfene Knoten NICHT mit — deren Kanten entfallen weiter', () => {
    const r = roots(`[ ] Wurzel\n  - [ ] #box: Zweig\n    - [-] #weg: Verworfen :#ziel\n  - [ ] #ziel: Draussen`);
    const zweig = r[0].children[0];
    const html = renderTreeHtml(r, {t, showDiscarded: false, cheapPath: false,
      cheapSet: new Set(), collapsedSet: new Set([zweig])}).html;
    expect(html).not.toContain('data-sub-ids');
    expect(html).not.toContain('data-sub-deps');
  });
});
