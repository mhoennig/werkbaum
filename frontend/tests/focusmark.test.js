import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { renderTreeHtml } from '../src/render.js';

const t = (key, vars) => {
  const dict = {
    a11yStatus: 'Status: ' + (vars && vars.status),
    a11yFocusMark: 'hierhin schauen',
    a11yOptional: 'optional',
    st_geplant: 'geplant'
  };
  return dict[key] !== undefined ? dict[key] : key;
};
/* renderTreeHtml liefert {html, warnings} — hier interessiert nur der HTML-String. */
const html = text => renderTreeHtml(parse(text).roots,
  {t, showDiscarded: false, cheapPath: false, cheapSet: new Set()}).html;

describe('Fokusmarke `!!!` — Parser (SPEC §1)', () => {
  it('erkennt die Marke am Zeilenende und hält sie aus dem Label', () => {
    const [n] = parse('Backend !!!').roots;
    expect(n.focus).toBe(true);
    expect(n.label).toBe('Backend');
  });

  it('erkennt sie am Zeilenanfang und in der Mitte', () => {
    expect(parse('!!! Backend').roots[0]).toMatchObject({focus: true, label: 'Backend'});
    expect(parse('Backend !!! fertig').roots[0]).toMatchObject({focus: true, label: 'Backend fertig'});
  });

  /* Der Kern der Regel: nur ALLEINSTEHEND. Sonst verlöre jedes „Achtung!!!"
     seine Ausrufezeichen und niemand fände den Grund. */
  it('lässt angehängte Ausrufezeichen in Ruhe', () => {
    expect(parse('Achtung!!!').roots[0]).toMatchObject({focus: false, label: 'Achtung!!!'});
    expect(parse('!!!wichtig').roots[0]).toMatchObject({focus: false, label: '!!!wichtig'});
    expect(parse('a!!!b').roots[0]).toMatchObject({focus: false, label: 'a!!!b'});
  });

  it('zählt zwei oder vier Ausrufezeichen nicht als Marke', () => {
    expect(parse('Backend !!').roots[0]).toMatchObject({focus: false, label: 'Backend !!'});
    expect(parse('Backend !!!!').roots[0]).toMatchObject({focus: false, label: 'Backend !!!!'});
  });

  it('lässt `!!!` innerhalb einer URL unberührt', () => {
    const [n] = parse('Doku https://example.org/a!!!b').roots;
    expect(n.focus).toBe(false);
    expect(n.url).toBe('https://example.org/a!!!b');
  });

  /* Reihenfolge der Extraktion (SPEC §1): Kommentar, Zeichen/Status, URL, Größe,
     Tags, Marke, Label — die Marke darf keinen der anderen Teile verschlucken. */
  it('verträgt sich mit Status, Größe, URL, Tags und Kommentar', () => {
    const [n] = parse('  - [~] Backend (L) https://git.example/x @ben !!! %% Kommentar').roots;
    expect(n).toMatchObject({focus: true, label: 'Backend', size: 'L', tags: ['ben']});
    expect(n.status.key).toBe('arbeit');
    expect(n.url).toBe('https://git.example/x');
  });

  it('eine Marke im Kommentar wirkt nicht — der Kommentar fällt zuerst weg', () => {
    expect(parse('Backend %% später !!!').roots[0].focus).toBe(false);
  });

  it('mehrere Marken sind erlaubt und markieren jeden betroffenen Knoten', () => {
    const roots = parse('A !!!\nB\nC !!!').roots;
    expect(roots.map(n => n.focus)).toEqual([true, false, true]);
  });

  it('eine Zeile aus nur einer Marke hat kein Label und fällt weg', () => {
    expect(parse('!!!').roots).toHaveLength(0);
  });

  it('ohne Marke ist focus false, nicht undefined', () => {
    expect(parse('Backend').roots[0].focus).toBe(false);
  });

  /* Die Marke ist eine dritte, unabhängige Achse (SPEC §1): weder Fortschritt
     (§4) noch Notwendigkeit (§3) dürfen sich daran ändern. */
  it('lässt Status und Optionalität unberührt', () => {
    const [root] = parse('Wurzel\n  + [^] Zugabe !!!').roots;
    const kid = root.children[0];
    expect(kid).toMatchObject({focus: true, optional: true, type: 'and'});
    expect(kid.status.key).toBe('prod');
  });
});

describe('Fokusmarke — Renderer', () => {
  it('setzt die Klasse `focusmark` am Knoten', () => {
    expect(html('Backend !!!')).toMatch(/class="node root-node focusmark"/);
    /* auch an einem Kind, nicht nur an der Wurzel */
    expect(html('Wurzel\n  - Kind !!!')).toMatch(/class="node focusmark"[^>]*>Kind/);
  });

  it('setzt sie nicht ohne Marke', () => {
    expect(html('Backend')).not.toMatch(/focusmark/);
  });

  /* Sichtbar ist die Marke nur als box-shadow — ohne diese Ansage wüsste ein
     Screenreader nichts davon (SPEC §9). */
  it('nennt die Marke im aria-label', () => {
    expect(html('[ ] Backend !!!')).toContain('hierhin schauen');
  });

  it('das Ausrufezeichen steht nicht im sichtbaren Label', () => {
    const out = html('Backend !!!');
    expect(out).toContain('>Backend<');
    expect(out).not.toContain('!!!');
  });
});
