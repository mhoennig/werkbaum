import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { effectiveStatus, progressRank } from '../src/model.js';
import { renderTreeHtml } from '../src/render.js';

const t = key => key;
const roots = txt => parse(txt).roots;
/* Map Label -> effektiver Status-Key (nur Diskrepanzen). */
const disc = txt => {
  const m = effectiveStatus(roots(txt));
  const out = {};
  m.forEach((key, n) => { out[n.label] = key; });
  return out;
};
const render = txt => {
  const r = roots(txt);
  return renderTreeHtml(r, {t, showDiscarded: false, cheapPath: false,
    cheapSet: new Set(), effStatus: effectiveStatus(r)});
};

/* Effektiver Status (SPEC §4/§9, D39): Minimum des Fortschritts-Rangs über
   die Abhängigkeits-Hülle; gemeldet werden nur Diskrepanzen. */
describe('effectiveStatus — Minimum über die Abhängigkeits-Hülle', () => {
  it('hält einen fertigen Knoten auf dem Rang seiner Abhängigkeit', () => {
    expect(disc(`[~] API #api\n[x] Deploy :#api`))
      .toEqual({Deploy: 'arbeit'});
  });

  it('reicht das Minimum über Ketten durch', () => {
    expect(disc(`[ ] C #c\n[/] B #b :#c\n[x] A :#b`))
      .toEqual({A: 'geplant', B: 'geplant'});
  });

  it('meldet nichts, wenn die Abhängigkeit gleichauf oder weiter ist', () => {
    expect(disc(`[x] API #api\n[x] Deploy :#api`)).toEqual({});
    expect(disc(`[^] API #api\n[x] Deploy :#api`)).toEqual({});
  });

  it('lässt Zyklen ihr Minimum teilen — „wird gemeinsam fertig"', () => {
    expect(disc(`[x] A #a :#b\n[x] B #b :#a`)).toEqual({});
    expect(disc(`[x] A #a :#b\n[~] B #b :#a`)).toEqual({A: 'arbeit'});
    expect(disc(`[x] A #a :#a`)).toEqual({});   /* Selbst-Abhängigkeit */
  });

  it('ignoriert unbekannte IDs (dafür gibt es die unknownDep-Warnung)', () => {
    expect(disc(`[x] A :#gibtsnicht`)).toEqual({});
  });

  it('zählt neutrale und verworfene Ziele als Rang 0, High Risk als 1', () => {
    expect(disc(`Neutral #n\n[x] A :#n`)).toEqual({A: 'idee'});
    expect(disc(`[-] Weg #w\n[x] A :#w`)).toEqual({A: 'idee'});
    expect(disc(`[!] Risiko #r\n[x] A :#r`)).toEqual({A: 'geplant'});
  });

  it('macht neutrale und verworfene Knoten selbst nie zur Diskrepanz', () => {
    expect(disc(`[?] Ziel #z\nNeutral :#z\n`)).toEqual({});
    expect(disc(`[?] Ziel #z\n[-] Weg :#z`)).toEqual({});
    expect(progressRank(roots(`[-] Weg`)[0])).toBe(0);
  });

  it('löst Verweise auf die ERSTE Vergabe einer doppelten ID auf (D36/D39)', () => {
    expect(disc(`[~] Erste #x\n[x] Zweite #x\n[x] A :#x`)).toEqual({A: 'arbeit'});
  });
});

describe('Darstellung — Farbe effektiv, Marke intrinsisch', () => {
  const TXT = `[~] API #api (M)\n[x] Deploy :#api`;

  it('färbt den Knoten mit dem effektiven Status und markiert ihn als held', () => {
    const {html} = render(TXT);
    expect(html).toContain('class="node root-node held st-arbeit" tabindex="0" data-line="2"');
    expect(html).not.toContain('st-fertig" tabindex="0" data-line="2"');
  });

  it('hängt die eigene Statusbox als Marke in den eigenen Farben an', () => {
    const {html} = render(TXT);
    expect(html).toContain('<span class="chip ownst st-fertig" aria-hidden="true">[x]</span>');
  });

  it('benennt beide Status in Tooltip und aria-label', () => {
    const {html} = render(TXT);
    expect(html).toContain('title="→ #api · heldTooltip · jumpHint"');
    expect(html).toContain('aria-label="Deploy, a11yStatus, a11yEffective, a11yDeps"');
  });

  it('ändert Knoten ohne Diskrepanz nicht', () => {
    const {html} = render(`[x] API #api\n[x] Deploy :#api`);
    expect(html).not.toContain('ownst');
    expect(html).not.toContain('held');
    expect((html.match(/st-fertig/g) || []).length).toBe(2);
  });
});
