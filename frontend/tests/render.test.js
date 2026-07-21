import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { computeCheapSet } from '../src/model.js';
import { renderTreeHtml } from '../src/render.js';

/* Deterministischer i18n-Stub: gibt den Key zurück (bzw. interpoliert
   mixedWarn), damit die Snapshots sprachunabhängig und stabil sind. */
const t = (key, vars) =>
  key === 'mixedWarn' ? `mixedWarn(line=${vars.line}, label=${vars.label})` : key;

const SPEC_EXAMPLE = `%% Projektstruktur – Stand Sprint 14
[~] Website-Relaunch (XL) https://wiki.example.de/relaunch
  - [x] Konzeption (M)
    - [x] Zielgruppenanalyse (S)
    - [x] Sitemap (XS)
  - [~] Umsetzung (XL)
    - [/] Frontend (S) https://git.example.de/frontend @anna
    - [ ] Backend (L) @ben @carla
    - [ ] CMS-Anbindung (M)
      | [ ] WordPress
      | [?] Headless CMS
      | [-] Eigenentwicklung  %% Aufwand zu hoch
  - [?] Hosting (M)
    | Cloud
    | On-Premise`;

/* Rendert die (wie in app.js) vorab gefilterten Wurzeln. */
function renderExample({showDiscarded = false, cheapPath = false} = {}){
  let {roots} = parse(SPEC_EXAMPLE);
  if(!showDiscarded){
    roots = roots.filter(r => !r.status || r.status.key !== 'verworfen');
  }
  const cheapSet = cheapPath ? computeCheapSet(roots) : new Set();
  return renderTreeHtml(roots, {t, showDiscarded, cheapPath, cheapSet});
}

const count = (html, needle) => html.split(needle).length - 1;

describe('renderTreeHtml — kanonisches Beispiel', () => {
  it('Grundzustand (Pfad aus, verworfene aus): Struktur-Snapshot', () => {
    const {html, warnings} = renderExample();
    expect(count(html, 'class="node')).toBe(13);      // Eigenentwicklung ausgeblendet
    expect(count(html, 'cheap-leaf')).toBe(0);
    expect(count(html, 'size implicit')).toBe(0);
    expect(count(html, 'ghost-node')).toBe(1);         // Backend (L) ist ein M+-Blatt
    expect(count(html, '<ul class="or">')).toBe(2);   // CMS-Anbindung, Hosting
    expect(warnings).toEqual([]);
    expect(html).toMatchSnapshot();
  });

  it('günstigster Pfad an: cheap/cheap-leaf + implizite M-Badges', () => {
    const {html} = renderExample({cheapPath: true});
    expect(count(html, 'cheap-leaf')).toBeGreaterThan(0);
    expect(count(html, 'size implicit')).toBeGreaterThan(0);   // Cloud/On-Premise ohne Größe
    expect(html).toMatchSnapshot();
  });

  it('verworfene einblenden: Eigenentwicklung erscheint (durchgestrichen)', () => {
    const {html} = renderExample({showDiscarded: true});
    expect(count(html, 'class="node')).toBe(14);
    expect(html).toContain('st-verworfen');
    expect(html).toMatchSnapshot();
  });
});

describe('renderTreeHtml — „Untergliederung fehlt" (Geister-Knoten, SPEC §5)', () => {
  it('M+ ohne Kinder erzeugt genau einen Geister-Knoten', () => {
    let {roots} = parse('- [ ] Großes Paket (L)');
    const {html} = renderTreeHtml(roots, {t, showDiscarded: false, cheapPath: false, cheapSet: new Set()});
    expect(count(html, 'ghost-node')).toBe(1);
    expect(html).toContain('title="ghostTooltip"');
    expect(html).toMatchInlineSnapshot(`"<li><div class="node root-node st-geplant" title="st_geplant">Großes Paket<span class="size">L</span></div><div class="ghost-node" title="ghostTooltip">ghost</div></li>"`);
  });

  it('verworfenes M+ löst die Regel nicht aus', () => {
    let {roots} = parse('- [-] Verworfen groß (XL)');
    const {html} = renderTreeHtml(roots, {t, showDiscarded: true, cheapPath: false, cheapSet: new Set()});
    expect(count(html, 'ghost-node')).toBe(0);
  });
});

describe('renderTreeHtml — strukturierte Warnungen', () => {
  it('gemischte Gates ergeben eine {type:mixedGate, line, label}-Warnung', () => {
    let {roots} = parse('- Eltern\n  - und-Kind\n  | oder-Kind');
    const {warnings} = renderTreeHtml(roots, {t, showDiscarded: false, cheapPath: false, cheapSet: new Set()});
    expect(warnings).toEqual([{type: 'mixedGate', line: 2, label: 'Eltern'}]);
  });

  it('einheitliche Gates ergeben keine Warnung', () => {
    let {roots} = parse('- Eltern\n  - a\n  - b');
    const {warnings} = renderTreeHtml(roots, {t, showDiscarded: false, cheapPath: false, cheapSet: new Set()});
    expect(warnings).toEqual([]);
  });
});

describe('renderTreeHtml — Moduswechsel ist CSS, nicht Renderer', () => {
  it('erzeugt nie eine Modus-Klasse (vertical/kompakt) — die setzt app.js am Container', () => {
    const {html} = renderExample();
    expect(html).not.toMatch(/\bvertical\b/);
    expect(html).not.toMatch(/\bkompakt\b/);
    // Also gilt derselbe Renderer-Snapshot für alle drei Modi (horizontal,
    // vertikal, kompakt) — sie unterscheiden sich nur in der Container-Klasse.
  });
});
