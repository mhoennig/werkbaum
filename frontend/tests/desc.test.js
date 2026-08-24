import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { renderTreeHtml } from '../src/render.js';

const t = key => key;
const roots = txt => parse(txt).roots;
const render = txt => renderTreeHtml(roots(txt),
  {t, showDiscarded: false, cheapPath: false, cheapSet: new Set()});

/* Knotenbeschreibungen (SPEC §1/§9, D40): `"`-Zeilen (Kurzform) und
   ID-Blöcke hinter `---` (Langform). */
describe('Kurzform — `"`-Zeile unter dem Knoten', () => {
  it('hängt die Zeile an den vorangehenden Knoten, ohne einen Knoten zu erzeugen', () => {
    const [wurzel] = roots(`[ ] Auth\n  " Kapselt Login und Tokens.`);
    expect(wurzel.desc).toBe('Kapselt Login und Tokens.');
    expect(wurzel.children).toEqual([]);
  });

  it('setzt mehrere `"`-Zeilen zur selben Beschreibung fort', () => {
    const [wurzel] = roots(`[ ] Auth\n  " Zeile eins.\n  " Zeile zwei.`);
    expect(wurzel.desc).toBe('Zeile eins.\nZeile zwei.');
  });

  it('verlangt folgenden Leerraum — `"Zitat"` bleibt ein Label', () => {
    const [wurzel] = roots(`"Zitat" als Label`);
    expect([wurzel.label, wurzel.desc]).toEqual(['"Zitat" als Label', null]);
  });

  it('gilt nicht auf Zeilen mit Zerlegungszeichen', () => {
    const [wurzel] = roots(`[ ] W\n  - " Zitat" als Label`);
    expect(wurzel.children[0].label).toBe('" Zitat" als Label');
  });

  it('warnt bei einer `"`-Zeile ohne vorangehenden Knoten', () => {
    const {warnings} = parse(`" verwaist`);
    expect(warnings).toEqual([{type: 'descStray', line: 1}]);
  });

  it('extrahiert im Freitext nichts — (M), @name und #id bleiben Text', () => {
    const [wurzel] = roots(`[ ] W\n  " Kostet (M), fragt @ana wegen #auth.`);
    expect(wurzel.desc).toBe('Kostet (M), fragt @ana wegen #auth.');
    expect([wurzel.size, wurzel.tags, wurzel.id]).toEqual([null, [], null]);
  });

  it('entfernt %%-Kommentare auch in Beschreibungszeilen', () => {
    const [wurzel] = roots(`[ ] W\n  " Sichtbar. %% unsichtbar`);
    expect(wurzel.desc).toBe('Sichtbar.');
  });
});

describe('Langform — ID-Blöcke hinter `---`', () => {
  const TXT = `[ ] Auth #auth
[ ] API #api

---
#auth
  Erster Absatz.

  Zweiter Absatz.
#api
  Kurz.`;

  it('ordnet Blöcke über die ID zu, mit Leerzeilen als Absatztrennern', () => {
    const [auth, api] = roots(TXT);
    expect(auth.desc).toBe('Erster Absatz.\n\nZweiter Absatz.');
    expect(api.desc).toBe('Kurz.');
  });

  it('erzeugt hinter dem Trenner keine Knoten mehr', () => {
    expect(roots(TXT).map(n => n.label)).toEqual(['Auth', 'API']);
  });

  it('akzeptiert auch längere Trenner und ignoriert weitere im Beschreibungsteil', () => {
    const [w] = roots(`[ ] W #w\n-----\n#w\n  Text.\n---\n#w\n  Mehr.`);
    expect(w.desc).toBe('Text.\nMehr.');
  });

  it('hängt Kurz- und Langform in Dokumentreihenfolge aneinander', () => {
    const [w] = roots(`[ ] W #w\n  " Kurz.\n---\n#w\n  Lang.`);
    expect(w.desc).toBe('Kurz.\nLang.');
  });

  it('warnt bei einer ID ohne Knoten — und schluckt deren Blocktext still', () => {
    const {roots: r, warnings} = parse(`[ ] W\n---\n#fehlt\n  Text dazu.\n  Noch mehr.`);
    expect(warnings).toEqual([{type: 'unknownDesc', line: 3, id: 'fehlt'}]);
    expect(r[0].desc).toBe(null);
  });

  it('meldet verwaiste Zeilen einzeln — der versehentliche Trenner wird laut', () => {
    const {warnings} = parse(`[ ] W\n---\n- [ ] Verschluckt\n  - [ ] Kind`);
    expect(warnings).toEqual([
      {type: 'descStray', line: 3},
      {type: 'descStray', line: 4}
    ]);
  });

  it('lässt `- --` als gewöhnlichen Knoten stehen', () => {
    expect(roots(`- --`)[0].label).toBe('--');
  });
});

describe('Darstellung — Tooltip, ”-Marke, aria', () => {
  it('stellt die Beschreibung an den Anfang des Tooltips und setzt die Marke', () => {
    const {html} = render(`[ ] Auth #auth\n  " Kapselt Login.`);
    expect(html).toContain('data-tip="Kapselt Login.\n\n' + '─'.repeat(24)
                           + '\n#auth · st_geplant · jumpHint"');
    expect(html).toContain('<span class="desc-mark" aria-hidden="true">”</span>');
    expect(html).toContain('aria-label="Auth, a11yStatus, a11yId, Kapselt Login."');
  });

  /* Die Kurz-Fakten hingen früher mit ` · ` am Fließtext — in einer Zeile ging
     der Übergang unter. Getrennt wird nur, wenn es etwas zu trennen gibt. */
  it('trennt Beschreibung und Kurz-Fakten durch Leerzeile und Strich', () => {
    const {html} = render(`[ ] Auth #auth\n  " Erste Zeile.\n  " Zweite Zeile.`);
    const tip = html.match(/data-tip="([^"]*)"/)[1];
    const [text, rest] = tip.split('\n\n');
    expect(text).toBe('Erste Zeile.\nZweite Zeile.');   /* Fließtext bleibt zusammen */
    expect(rest.split('\n')[0]).toMatch(/^─+$/);         /* Trennstrich als eigene Zeile */
    expect(rest.split('\n')[1]).toContain('#auth');      /* danach die Fakten */
  });

  it('setzt keinen Trennstrich, wenn es keine Beschreibung gibt', () => {
    const {html} = render(`[ ] Ohne #auth`);
    expect(html.match(/data-tip="([^"]*)"/)[1]).not.toContain('─');
  });
});

/* Der Cursor in einer Beschreibung wählt ihren Knoten aus (SPEC §9): Die Zeile
   trägt keinen eigenen Knoten, gehört aber zu einem. Grundlage ist
   `node.descLines`; app.js findet den Knoten darüber per `data-desc-lines~=`. */
describe('Zeilenzuordnung der Beschreibung (`descLines`)', () => {
  it('ordnet `"`-Zeilen dem vorangehenden Knoten zu', () => {
    const [a, b] = roots(`[ ] Erster\n  " Eine Zeile.\n  " Noch eine.\n[ ] Zweiter`);
    expect(a.descLines).toEqual([2, 3]);
    expect(b.descLines).toBe(null);
  });

  it('ordnet den `---`-Block samt Kopfzeile und Leerzeilen zu', () => {
    const [n] = roots(`[ ] Auth #auth\n---\n#auth\n  Erster Absatz.\n\n  Zweiter Absatz.`);
    expect(n.descLines).toEqual([3, 4, 5, 6]);
  });

  it('führt Kurz- und Langform am selben Knoten zusammen', () => {
    const [n] = roots(`[ ] Auth #auth\n  " Kurz.\n---\n#auth\n  Lang.`);
    expect(n.descLines).toEqual([2, 4, 5]);
  });

  it('ordnet nichts zu, wo es keinen Knoten gibt', () => {
    const {roots: r, warnings} = parse(`---\n#fehlt\n  Text.`);
    expect(r).toEqual([]);
    expect(warnings.map(w => w.type)).toEqual(['unknownDesc']);
  });

  it('gibt die Zeilen als `data-desc-lines` aus', () => {
    const {html} = render(`[ ] Auth\n  " Kapselt Login.`);
    expect(html).toContain('data-desc-lines="2"');
  });

  it('ändert Knoten ohne Beschreibung nicht', () => {
    const {html} = render(`[ ] Ohne`);
    expect(html).not.toContain('desc-mark');
  });
});
