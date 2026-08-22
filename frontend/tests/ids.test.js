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

  it('frisst das reservierte `:#a,#b` (Abhängigkeiten, §11) nicht', () => {
    const [wurzel] = roots(`[ ] Deploy :#auth,#api`);
    expect([wurzel.label, wurzel.id]).toEqual(['Deploy :#auth,#api', null]);
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
