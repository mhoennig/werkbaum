import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { renderTreeHtml } from '../src/render.js';

const t = key => key;
const roots = txt => parse(txt).roots;
const render = txt => renderTreeHtml(roots(txt),
  {t, showDiscarded: false, cheapPath: false, cheapSet: new Set()});

/* Knoten-IDs `#name` (SPEC §1, D36): Adresse für Abhängigkeiten und
   Beschreibungsblöcke; eindeutig im ganzen Dokument. */
describe('Parser — `#name` als Knoten-ID', () => {
  it('extrahiert die ID und nimmt sie aus dem Label', () => {
    const [wurzel] = roots(`[ ] Auth-Modul #auth (M)\n  - [ ] Login`);
    expect([wurzel.label, wurzel.id, wurzel.size]).toEqual(['Auth-Modul', 'auth', 'M']);
    expect(wurzel.children[0].id).toBe(null);
  });

  it('erkennt IDs nur alleinstehend angesetzt — „C#" bleibt Label', () => {
    const [wurzel] = roots(`[ ] C# Kurs`);
    expect([wurzel.label, wurzel.id]).toEqual(['C# Kurs', null]);
  });

  it('macht aus `:#a,#b` (Abhängigkeiten, D37) keine Knoten-ID', () => {
    const [wurzel] = roots(`[ ] Deploy :#auth,#api`);
    expect([wurzel.label, wurzel.id, wurzel.deps])
      .toEqual(['Deploy', null, ['auth', 'api']]);
  });

  it('nimmt nur das ERSTE Token — weitere `#` bleiben im Label (Tickets)', () => {
    const [wurzel] = roots(`[ ] Auth #auth siehe #123`);
    expect([wurzel.label, wurzel.id]).toEqual(['Auth siehe #123', 'auth']);
  });

  it('lässt `#` in URLs unberührt (URL wird vorher extrahiert)', () => {
    const [wurzel] = roots(`[ ] Doku https://example.org/seite#abschnitt`);
    expect([wurzel.id, wurzel.url]).toEqual([null, 'https://example.org/seite#abschnitt']);
  });

  it('erlaubt numerische und Unicode-IDs', () => {
    const nodes = roots(`[ ] Ticket #123\n[ ] Umlaut #größe-1`);
    expect(nodes.map(n => n.id)).toEqual(['123', 'größe-1']);
  });

  it('ignoriert eine Zeile, die nur aus einer ID besteht — die ID bleibt frei', () => {
    const {roots: r, warnings} = parse(`- #auth\n- [ ] Echt #auth`);
    expect(r.map(n => [n.label, n.id])).toEqual([['Echt', 'auth']]);
    expect(warnings).toEqual([]);
  });
});

/* Übliche Schreibweise: ID vor dem Titel, abgetrennt durch einen Doppelpunkt.
   Der Doppelpunkt ist optional, gehört weder zur ID noch zum Label. */
describe('ID vor dem Titel, `#id: Titel`', () => {
  it('schluckt den trennenden Doppelpunkt', () => {
    const [n] = roots(`[ ] #auth: Auth-Modul (M)`);
    expect([n.id, n.label, n.size]).toEqual(['auth', 'Auth-Modul', 'M']);
  });

  it('kommt ohne Doppelpunkt zum selben Ergebnis', () => {
    const mit = roots(`[ ] #auth: Auth-Modul (M)`)[0];
    const ohne = roots(`[ ] #auth Auth-Modul (M)`)[0];
    expect([mit.id, mit.label]).toEqual([ohne.id, ohne.label]);
  });

  it('lässt den Doppelpunkt auch am Zeilenende weg', () => {
    const [n] = roots(`[ ] Titel danach #auth:`);
    expect([n.id, n.label]).toEqual(['auth', 'Titel danach']);
  });

  it('vertägt sich mit Abhängigkeiten in derselben Zeile', () => {
    const {roots: r, warnings} = parse(`[ ] #api: API\n[ ] #ui: Oberfläche :#api`);
    expect(r.map(n => [n.id, n.label, n.deps])).toEqual([
      ['api', 'API', []], ['ui', 'Oberfläche', ['api']],
    ]);
    expect(warnings).toEqual([]);
  });

  it('lässt einen Doppelpunkt IM Label unberührt', () => {
    const [n] = roots(`[ ] #auth: Regel: nur mit Token`);
    expect([n.id, n.label]).toEqual(['auth', 'Regel: nur mit Token']);
  });

  it('schluckt nur einen Doppelpunkt mit folgendem Leerraum — `#auth:#db` bleibt Abhängigkeit', () => {
    const {roots: r} = parse(`[ ] #db: Datenbank\n[ ] #auth:#db Login`);
    expect(r[1].id).toBe('auth');
    expect(r[1].deps).toEqual(['db']);
    expect(r[1].label).toBe('Login');
  });

  it('nimmt den Doppelpunkt auch im Beschreibungsteil an', () => {
    const {roots: r, warnings} = parse(`[ ] #auth: Auth\n---\n#auth:\n  Erklärung.`);
    expect(r[0].desc).toBe('Erklärung.');
    expect(warnings).toEqual([]);
  });
});

describe('Doppelte IDs — Warnung an der späteren Zeile', () => {
  it('meldet die spätere Zeile und nennt die erste', () => {
    const {warnings} = parse(`[ ] A #auth\n[ ] B\n[ ] C #auth`);
    expect(warnings).toEqual([{type: 'duplicateId', line: 3, id: 'auth', firstLine: 1}]);
  });

  it('lässt die spätere ID trotzdem am Knoten stehen (fehlertolerant)', () => {
    const nodes = roots(`[ ] A #x\n[ ] B #x`);
    expect(nodes.map(n => n.id)).toEqual(['x', 'x']);
  });

  it('meldet jede weitere Doppelvergabe einzeln', () => {
    const {warnings} = parse(`[ ] A #x\n[ ] B #x\n[ ] C #x`);
    expect(warnings.map(w => w.line)).toEqual([2, 3]);
  });
});

describe('Darstellung — Tooltip und aria, kein Badge', () => {
  it('zeigt die ID im Tooltip und im aria-label', () => {
    const {html} = render(`[ ] Auth #auth`);
    expect(html).toContain('title="#auth · st_geplant · jumpHint"');
    expect(html).toContain('aria-label="Auth, a11yStatus, a11yId"');
  });

  it('ändert Knoten ohne ID nicht', () => {
    const {html} = render(`[ ] Ohne`);
    expect(html).not.toContain('a11yId');
    expect(html).toContain('title="st_geplant · jumpHint"');
  });
});
