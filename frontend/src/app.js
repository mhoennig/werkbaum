import './style.css';
import { parse, setFoldMark } from './parser.js';
import { computeCheapPlan, freshProdSet, initialCollapsed, nodeKeys, effectiveStatus } from './model.js';
import { esc, renderTreeHtml } from './render.js';
import { formatWarning } from './warnings.js';
import { padUrls } from './remote.js';
/* Werkbaum, mit Werkbaum geplant — als mitgeliefertes Dokument „Werkbank" (D27).
   Dieselbe Datei, die auch per ?sourceUrl= geladen werden kann; `?raw` bettet
   sie beim Build in die eine Ausgabedatei ein (D19), es wird nichts nachgeladen
   (D20). Quelle bleibt docs/examples/ — keine Kopie, die auseinanderläuft. */
import WERKBAUM_DOC from '../../docs/examples/werkbaum.werkbaum?raw';

const INITIAL = `%% Project structure – Sprint 14
[~] Website relaunch (XL) https://wiki.example.com/relaunch
  " Folded chapters are done — click the ▸ to peek inside.
  - > [x] Concept (M)
    - [x] Audience analysis (S)
    - [x] Sitemap (XS)
  - [~] Implementation (XL)
    - [~] Frontend (M) https://git.example.com/frontend @anna
      | [ ] PWA (S)
      | [ ] Web+Native
        - [/] Web (S)
        - [ ] Android (M)
        - [ ] iOS (M)
    - [!] Backend (L) @ben @carla
    - [ ] #cms: CMS integration (M)
      | [ ] WordPress
      | [?] Headless CMS
      | [-] Custom build  %% too much effort
    - [x] Landing page (S) :#cms  %% done, but effectively waiting for the CMS
    + [?] Dark mode (S)  %% nice to have, never on the cheapest path
  - [?] Hosting (M)  %% exactly one of these, hence =
    = [ ] Cooperative Community Cloud https://hostsharing.net
    = [?] On-premise

---
#cms
  The articles live in the CMS, so everything that shows content
  depends on it — the dotted arrows point at what is needed.`;

const src  = document.getElementById('src');
const out  = document.getElementById('out');
const warnBox = document.getElementById('warn');
/* Zeilennummern-Streifen (D33) — hier oben geholt, weil render() ihn füllt. */
const srcWrap = document.getElementById('srcWrap');
const lineNoBox = document.getElementById('lineNos');
const lineNoInner = lineNoBox.firstElementChild;

/* Baum-/Kostenlogik (gateOf, needsBreakdown, visibleChildren, günstigster
   Pfad) lebt headless in model.js, das HTML-Erzeugen in render.js. Hier bleibt
   nur der UI-State des Günstigster-Pfad-Toggles (persistiert). */
let cheapPathOn = true;
/* Ansicht bei einem Pad-Dokument (D31): beide | nur Pad | nur Spiegel. Hier oben
   deklariert, weil saveUI() sie liest und schon aus applySplit() heraus laufen
   kann — weiter unten stünde sie dann noch in der temporalen Todeszone. */
const PAD_VIEWS = ['both', 'pad', 'text'];
let padView = 'both';
/* Sichtbarer Bereich auf kleinem Bildschirm (D17-Nachtrag): dort ist immer
   genau einer zu sehen. Aus demselben Grund hier oben deklariert wie `padView`
   — saveUI() liest ihn und läuft schon aus applySplit() heraus. */
let mobilePane = 'diagram';
/* Cursor-Zeile (D25) — bleibt `null`, bis der Cursor das erste Mal bewegt wurde,
   sonst wäre nach dem Laden ungefragt die Wurzel markiert. Hier oben deklariert
   wie `padView`: der Zeilennummern-Streifen (D33) liest sie, und der hängt an
   render(). */
let caretLine = null, currentNodeEl = null;
/* Warnung des ?sourceUrl-Ladens (D23) — zeilenlos und persistent, siehe render(). */
let sourceWarning = null;
/* „Was ist neu?" (D28): Knoten, die gegenüber der zuletzt GESEHENEN Fassung neu
   in Produktion sind. Gilt immer für genau ein Dokument (`freshDocId`) — nur
   Dokumente von außen (mitgeliefert oder ?sourceUrl=) haben eine
   Vergleichsfassung. `freshBaseline` ist der Text, gegen den verglichen wurde;
   er wird erst beim Bestätigen fortgeschrieben. */
let freshSet = new Set(), freshDocId = null, freshBaseline = null, freshPrevRoots = null;
/* Faltung (SPEC §9, D38): `foldOverrides` sind die interaktiven Eingriffe des
   Nutzers (Schlüssel = Label-Pfad wie bei D28, damit sie das Neu-Parsen bei
   jedem Tastendruck überleben); sie überlagern den Anfangszustand aus den
   Textmarken, gelten nur für die Sitzung und fallen beim Dokumentwechsel weg.
   `foldByLine` ist der Zustand des letzten Renders für Klick/Tastatur. */
let foldOverrides = new Map(), foldByLine = new Map();

/* ---------- Renderer (Anbindung an den DOM) ----------
   parse -> Wurzeln filtern (verworfene) -> günstigen Pfad markieren ->
   render.js baut den HTML-String -> in #out schreiben -> Pfadlinie zeichnen. */
function render(){
  const parsed = parse(src.value);
  let roots = parsed.roots;
  const showDiscarded = discardedShown();
  if(!showDiscarded){
    roots = roots.filter(r => !r.status || r.status.key !== 'verworfen');
  }

  /* Warnungen aus Parser (unbekannte Statuszeichen) + Renderer (gemischte
     Gates) zusammenführen, nach Zeile sortiert anzeigen. `sourceWarning`
     (?sourceUrl nicht ladbar, D23) gehört keiner Zeile und bleibt über
     Neu-Renderings bestehen, bis das Laden gelingt. */
  let warnings = sourceWarning ? [sourceWarning].concat(parsed.warnings) : parsed.warnings;

  if(!roots.length){
    out.innerHTML = `<div class="empty">${esc(t('empty'))}</div>`;
    freshSet = new Set();
    foldByLine = new Map();
  } else {
    /* Günstigster Pfad auf der Dependency Closure (D42): scheitert die exakte
       Suche an zu vielen gekoppelten Gruppen, wird die gierige Schätzung
       BENANNT statt stillschweigend geliefert (zeilenlose Warnung). */
    let cheapSet = new Set();
    if(cheapPathOn){
      const plan = computeCheapPlan(roots);
      cheapSet = plan.set;
      if(!plan.exact) warnings = warnings.concat([{type: 'cheapApprox'}]);
    }
    out.classList.toggle('cheap-on', cheapPathOn);
    /* Die Menge MUSS aus denselben Knotenobjekten gebildet werden, die gerade
       gerendert werden — `freshProdSet` liefert Knoten aus `roots`. Eine früher
       berechnete Menge stammte aus einem anderen Parse-Durchlauf und träfe per
       Objektidentität nie zu (D28). */
    freshSet = (freshDocId === activeId && freshPrevRoots)
      ? freshProdSet(freshPrevRoots, roots) : new Set();
    /* Faltung (D38): Anfangszustand aus den Textmarken (`!!!` holt sich mit
       hervor), überlagert von den Sitzungs-Eingriffen des Nutzers. Wie bei
       `freshSet` muss die Menge aus den gerade geparsten Knoten bestehen. */
    const initFold = initialCollapsed(roots, true);
    const keys = nodeKeys(roots);
    const collapsedSet = new Set();
    foldByLine = new Map();
    keys.forEach((key, n) => {
      const ov = foldOverrides.get(key);
      const collapsed = (ov !== undefined ? ov : initFold.has(n)) && n.children.length > 0;
      if(collapsed) collapsedSet.add(n);
      foldByLine.set(n.line, {key, collapsed, canFold: n.children.length > 0});
    });
    const r = renderTreeHtml(roots, {t, showDiscarded, cheapPath: cheapPathOn, cheapSet,
                                     freshSet, collapsedSet,
                                     effStatus: effectiveStatus(roots)});
    out.innerHTML = r.html;
    warnings = warnings.concat(r.warnings);
  }

  warnings = warnings.slice().sort((a, b) => (a.line || 0) - (b.line || 0));
  warnBox.innerHTML = warnings.map(w => `<div>⚠ ${formatWarning(w, t)}</div>`).join('');
  /* Der Zeilennummern-Streifen zeigt genau die Zeilen an, die hier genannt
     werden — deshalb hängt er an derselben Warnungsliste (D33). */
  lineNoWarn = new Set(warnings.map(w => w.line).filter(Boolean));
  renderLineNos();
  applyOptStairs();   /* muss vor dem Messen laufen — es verschiebt Knoten */
  alignStems();
  drawCheapPath();
  /* Querverbindungen (D41) zeichnet highlightCurrentNode() unten mit —
     es kennt die zweite Hälfte der Auswahl (Cursor-Zeile). */
  /* Der Baum ist neu gebaut — die Markierung der Cursor-Zeile neu setzen (D25).
     Ohne Scrollen: beim Tippen soll das Diagramm stehen bleiben. */
  highlightCurrentNode(false);
  revealFocusMark();  /* `!!!` ins Bild holen, wenn die Marke neu ist (SPEC §1) */
  updateFreshBtn();   /* Zähler folgt der gerade gerenderten Menge (D28) */
}

/* Fokusmarke `!!!` (SPEC §1): Der erste markierte Knoten wird ins Bild geholt —
   aber nur, wenn sich die Marke **geändert** hat. Sonst zöge jeder Neubau des
   Baums den Blick zurück und man käme nicht weg. Verglichen wird das Label des
   Knotens, nicht die Zeilennummer: Umsortieren im Pad soll nicht als neue Marke
   gelten. Die Hervorhebung selbst macht die Klasse `focusmark` aus dem Renderer,
   hier geht es nur ums Scrollen. */
let lastFocusMark = null;
function revealFocusMark(){
  const el = out.querySelector('.node.focusmark');
  const key = el ? el.textContent : null;
  if(key && key !== lastFocusMark){
    el.scrollIntoView({block:'center', inline:'center', behavior:'smooth'});
  }
  lastFocusMark = key;
}

/* ---------- Günstigster-Pfad-Linie ----------
   Eine gestrichelte, geschwungene Petrol-Linie fädelt durch die Endknoten
   (Blätter) des günstigen Pfads. Das Overlay-SVG liegt in #out und erbt damit
   dessen CSS-`zoom`; die Punkte werden in unskalierte #out-Koordinaten
   umgerechnet (getBoundingClientRect / zoom). Neu gezeichnet nach jedem
   render() und nach Moduswechsel (applyLayout ruft nicht render). */
const SVGNS = 'http://www.w3.org/2000/svg';
function catmullRom(p){
  if(p.length < 2) return '';
  if(p.length === 2) return `M${p[0].x.toFixed(1)},${p[0].y.toFixed(1)} L${p[1].x.toFixed(1)},${p[1].y.toFixed(1)}`;
  let d = `M${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}`;
  for(let i = 0; i < p.length - 1; i++){
    const p0 = p[i-1] || p[i], p1 = p[i], p2 = p[i+1], p3 = p[i+2] || p2;
    const c1x = p1.x + (p2.x - p0.x)/6, c1y = p1.y + (p2.y - p0.y)/6;
    const c2x = p2.x - (p3.x - p1.x)/6, c2y = p2.y - (p3.y - p1.y)/6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}
function svgEl(name, attrs){
  const e = document.createElementNS(SVGNS, name);
  for(const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function overlaySvg(cls, w, h){
  return svgEl('svg', {class:'cheap-overlay ' + cls, width:w, height:h,
    viewBox:`0 0 ${w.toFixed(1)} ${h.toFixed(1)}`});
}
/* ---------- Treppe für optionale Endknoten (D29, Nachtrag 3) ----------
   Im horizontalen Fächer kostet jedes optionale Geschwister eine eigene Spalte
   — Breite für gerade das, was am wenigsten wichtig ist. Aufeinanderfolgende
   optionale Endknoten werden deshalb zu einer Kaskade gestapelt, die an einem
   Punkt hängt.

   Warum hier und nicht im Renderer: Die Gruppierung ist reine Darstellung. So
   bleiben der Renderer-String (SPEC §9: der Modus ändert nur die Anordnung) und
   die hand-getunte Geometrie der drei übrigen Anordnungen unberührt — dort gibt
   es das Platzproblem gar nicht, die Kinder stehen ohnehin untereinander.

   Nur ENDknoten: Der Platzgewinn entsteht gerade daraus, dass kein Teilbaum
   mitgestapelt werden muss; außerdem setzt die Stufengeometrie voraus, dass die
   Zelle so hoch ist wie ihr Knoten (kein Teilbaum, kein Geister-Knoten). */
const STAIR_MIN = 2;
function applyOptStairs(){
  /* Erst auflösen: applyLayout() arbeitet auf einem bereits gruppierten Baum. */
  out.querySelectorAll('li.opt-group').forEach(group => {
    const stair = group.firstElementChild;
    while(stair.firstElementChild){
      const li = stair.firstElementChild;
      li.style.removeProperty('--i');
      group.parentNode.insertBefore(li, group);
    }
    group.remove();
  });
  if(out.classList.contains('vertical') || out.classList.contains('kompakt')) return;
  out.querySelectorAll('ul.and').forEach(ul => {
    let run = [];
    const flush = () => {
      if(run.length >= STAIR_MIN){
        const group = document.createElement('li');
        group.className = 'opt-group';
        const stair = document.createElement('ul');
        stair.className = 'opt-stair';
        ul.insertBefore(group, run[0]);
        group.appendChild(stair);
        run.forEach((li, i) => { li.style.setProperty('--i', i); stair.appendChild(li); });
      }
      run = [];
    };
    for(const li of [...ul.children]){
      const leaf = li.classList.contains('opt') && li.children.length === 1
                   && li.firstElementChild.classList.contains('node');
      if(leaf) run.push(li); else flush();
    }
    flush();
  });
}

/* Stielposition der all-of-Abzweige im horizontalen Fächer (siehe style.css).
   Nur `li.has-or` braucht die Messung: dort steht der Knoten linksbündig, das
   <li> ist aber so breit wie sein any-of-Teilbaum — der Stiel bei 50 % liefe am
   Knoten vorbei. Die transponierten Modi setzen left/right ohnehin fest und
   bleiben deshalb unberührt. Messwerte sind durch `zoom` skaliert und werden
   wie in drawCheapPath() zurückgerechnet. */
function alignStems(){
  out.querySelectorAll('ul.and>li').forEach(li => li.style.removeProperty('--stem-x'));
  if(out.classList.contains('vertical') || out.classList.contains('kompakt')) return;
  const z = effZoom() || 1;
  /* `li.opt-group` (Treppe) hat keinen eigenen Knoten — der Stiel zielt auf den
     ERSTEN Knoten der Kaskade. */
  out.querySelectorAll('ul.and>li.has-or, ul.and>li.opt-group').forEach(li => {
    const node = li.querySelector(':scope > .node') || li.querySelector('.node');
    if(!node) return;
    const lr = li.getBoundingClientRect(), nr = node.getBoundingClientRect();
    if(!lr.width) return;                                  /* Panel eingeklappt */
    li.style.setProperty('--stem-x', ((nr.left - lr.left + nr.width/2)/z).toFixed(1) + 'px');
  });
}

function drawCheapPath(){
  out.querySelectorAll('svg.cheap-overlay').forEach(e => e.remove());
  if(!cheapPathOn) return;
  const leaves = [...out.querySelectorAll('.node.cheap-leaf')];   /* Dokument-Reihenfolge = Lese-Reihenfolge */
  if(leaves.length < 2) return;
  const outRect = out.getBoundingClientRect();
  const z = effZoom() || 1;
  if(!outRect.width || !outRect.height) return;                   /* Panel eingeklappt */
  const pts = leaves.map(el => {
    const r = el.getBoundingClientRect();
    return {x:(r.left + r.width/2 - outRect.left)/z, y:(r.top + r.height/2 - outRect.top)/z};
  });
  const w = outRect.width/z, h = outRect.height/z;
  const d = catmullRom(pts);

  /* kräftige Linie HINTER die Knoten (als erstes Kind → hinterste Paint-Ebene) */
  const back = overlaySvg('cheap-back', w, h);
  back.appendChild(svgEl('path', {class:'cheap-path', d}));
  out.insertBefore(back, out.firstChild);

  /* davor: abgetönte Kopie (deutet den Verlauf über Knoten an) + Stationspunkte */
  const front = overlaySvg('cheap-front', w, h);
  front.appendChild(svgEl('path', {class:'cheap-path faint', d}));
  pts.forEach(p => front.appendChild(
    svgEl('circle', {class:'cheap-dot', cx:p.x.toFixed(1), cy:p.y.toFixed(1), r:10})));
  out.appendChild(front);
}

/* ---------- Querverbindungen der Abhängigkeiten (SPEC §9, D41) ----------
   Die erste Linienart, die nicht der Zerlegung folgt — deshalb eine eigene
   Zeichenebene wie beim Pfad-Spline. Basis-Kanten dünn, blassgrau und
   GEKRÜMMT (die Krümmung unterscheidet sie von den orthogonalen Baumlinien),
   hinter den Knoten, mit Pfeilspitze auf das Gebrauchte. Die Kanten des
   fokussierten Knotens bzw. der Cursor-Zeile liegen hervorgehoben in Tinte
   auf einer vorderen Ebene. */
function depEdges(){
  const byId = new Map();
  out.querySelectorAll('.node[data-id]').forEach(el => {
    if(!byId.has(el.dataset.id)) byId.set(el.dataset.id, el);   /* erste Vergabe gewinnt (D36) */
  });
  const edges = [];
  out.querySelectorAll('.node[data-deps]').forEach(el => {
    for(const d of el.dataset.deps.split(' ')){
      const target = byId.get(d);
      /* verborgene (eingeklappte/ausgeblendete) oder unbekannte Ziele: keine Kante */
      if(target && target !== el) edges.push([el, target]);
    }
  });
  return edges;
}
/* Gekrümmte Kante zwischen zwei Knotenkästen: Endpunkte auf den Kanten
   (Strahl von Mitte zu Mitte, am Rechteck geklippt), Kontrollpunkt senkrecht
   zur Verbindung versetzt. */
function depCurve(a, b){
  const dx = b.cx - a.cx, dy = b.cy - a.cy;
  const len = Math.hypot(dx, dy) || 1;
  const clip = (r, tx, ty) => {
    const ex = tx - r.cx, ey = ty - r.cy;
    const sx = ex ? (r.w/2) / Math.abs(ex) : Infinity;
    const sy = ey ? (r.h/2) / Math.abs(ey) : Infinity;
    const s = Math.min(sx, sy, 1);
    return {x: r.cx + ex*s, y: r.cy + ey*s};
  };
  const p1 = clip(a, b.cx, b.cy), p2 = clip(b, a.cx, a.cy);
  const bow = Math.min(40, len/4);
  const ctrl = {x:(p1.x + p2.x)/2 - dy/len*bow, y:(p1.y + p2.y)/2 + dx/len*bow};
  return {d:`M${p1.x.toFixed(1)},${p1.y.toFixed(1)} Q${ctrl.x.toFixed(1)},${ctrl.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
          end:p2, ctrl};
}
/* Offene Pfeilspitze (Winkel aus zwei Strichen, D41-Nachtrag): ein gefülltes
   Dreieck stach als einziger satter Fleck aus der gepunkteten Linie heraus. */
function depArrow(end, from){
  const dx = end.x - from.x, dy = end.y - from.y;
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx/l, uy = dy/l, s = 5;
  const a = {x: end.x - ux*s*1.8 - uy*s, y: end.y - uy*s*1.8 + ux*s};
  const b = {x: end.x - ux*s*1.8 + uy*s, y: end.y - uy*s*1.8 - ux*s};
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${end.x.toFixed(1)},${end.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}
/* „Ausgewählt" heißt: Tastaturfokus im Diagramm, sonst der Knoten der
   Cursor-Zeile (D25) — beide Lesarten von „ich schaue auf diesen Knoten". */
function activeDepNode(){
  const f = document.activeElement;
  if(f && out.contains(f) && f.closest) {
    const n = f.closest('.node[data-line]');
    if(n) return n;
  }
  return currentNodeEl;
}
function drawDepLinks(){
  out.querySelectorAll('svg.dep-overlay').forEach(e => e.remove());
  const edges = depEdges();
  if(!edges.length) return;
  const outRect = out.getBoundingClientRect();
  if(!outRect.width || !outRect.height) return;   /* Panel eingeklappt */
  const z = effZoom() || 1;
  const rect = el => { const r = el.getBoundingClientRect();
    return {x:(r.left - outRect.left)/z, y:(r.top - outRect.top)/z,
            w:r.width/z, h:r.height/z,
            cx:(r.left - outRect.left + r.width/2)/z,
            cy:(r.top - outRect.top + r.height/2)/z}; };
  const w = outRect.width/z, h = outRect.height/z;
  const back = overlaySvg('dep-overlay dep-back', w, h);
  const front = overlaySvg('dep-overlay dep-front', w, h);
  const hi = activeDepNode();
  for(const [from, to] of edges){
    const hl = hi && (from === hi || to === hi);
    const c = depCurve(rect(from), rect(to));
    const layer = hl ? front : back;
    layer.appendChild(svgEl('path', {class:'dep-edge' + (hl ? ' hl' : ''), d:c.d}));
    layer.appendChild(svgEl('path', {class:'dep-arrow' + (hl ? ' hl' : ''), d:depArrow(c.end, c.ctrl)}));
  }
  out.insertBefore(back, out.firstChild);
  if(front.childNodes.length) out.appendChild(front);
}
/* Hervorhebung folgt dem Fokus; die Basis-Kanten selbst ändern sich nicht. */
out.addEventListener('focusin', drawDepLinks);
out.addEventListener('focusout', () => setTimeout(drawDepLinks, 0));

/* ---------- Diagramm als Grafik (SVG → PNG) ---------- */
/* Das gerenderte Diagramm wird aus der Live-Geometrie in ein eigenständiges
   SVG (nur Formen + Text, keine externen Ressourcen) nachgezeichnet und als
   PNG in die Zwischenablage gelegt. Knotenfarben, Größen-Badges, Tags und
   der Geister-Knoten werden übernommen; Verbindungslinien werden je Gate
   (und = durchgezogen Tinte, oder = gestrichelt Grau) neu gezogen und treffen
   so garantiert die Knoten — unabhängig vom Darstellungsmodus. */
function diagramToSvg(){
  /* Der Export misst die **Live-Geometrie**. Den Ring der Cursor-Zeile liest er
     nie aus (`box-shadow` steht nicht in der Liste), ihre Erhebung
     (D25-Nachtrag) schlüge aber über `getBoundingClientRect()` durch und
     exportierte genau einen Knoten 4 % zu groß. Neutralisiert wird sie per
     Klasse statt durch Abnehmen von `.current`/`.pulse` — so reißt der Export
     keine laufende Puls-Animation ab und startet sie hinterher nicht neu. */
  out.classList.add('exporting');
  /* Zoom für die Messung auf 1 stellen. Die Schriftgrößen im Ausgabe-SVG sind
     feste Zahlen (14 für Labels, 9–11 für Badges), die Kästen kommen dagegen
     aus der Messung — bei jedem Zoom ≠ 1 passten Text und Kasten also nicht
     zueinander. Das fiel bisher kaum auf, weil 100 % der Normalfall war; mit
     der Mobil-Verkleinerung (D17-Nachtrag 2) wäre es der Regelfall geworden.
     Derselbe Griff wie bei `exporting`: kurz neutralisieren, hinterher zurück —
     die Funktion läuft synchron, es wird nichts davon gezeichnet. */
  const zoomBefore = out.style.zoom;
  out.style.zoom = 1;
  const treeRect = out.getBoundingClientRect();
  const PAD = 24;
  const W = Math.ceil(treeRect.width) + PAD*2;
  const H = Math.ceil(treeRect.height) + PAD*2;
  const ox = -treeRect.left + PAD, oy = -treeRect.top + PAD;
  const R = el => { const r = el.getBoundingClientRect();
    return {x:r.left+ox, y:r.top+oy, w:r.width, h:r.height,
            cx:r.left+ox+r.width/2, cy:r.top+oy+r.height/2, r:r.right+ox, b:r.bottom+oy}; };
  const parts = [`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`];
  const nodes = [...out.querySelectorAll('.node')];
  const cheapPts = cheapPathOn
    ? [...out.querySelectorAll('.node.cheap-leaf')].map(el => { const b = R(el); return {x:b.cx, y:b.cy}; })
    : [];
  const cheapLine = op =>
    `<path d="${catmullRom(cheapPts)}" fill="none" stroke="#0F766E" stroke-width="2.5" stroke-dasharray="8 6" stroke-linecap="round" opacity="${op}"/>`;

  /* 1) Verbindungslinien (hinter den Knoten) */
  const seg = (x1,y1,x2,y2,stroke,dash) =>
    `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="2"${dash?' stroke-dasharray="5 4"':''} stroke-linecap="round"/>`;
  /* Auftreffpunkte der Abzweige an optionalen Knoten (`+`, SPEC §3/D29).
     Gesammelt beim Linienzeichnen, gezeichnet erst NACH den Knoten — der Kreis
     sitzt mittig auf der Kante, das Knoten-Rechteck würde ihn sonst halb
     überdecken. */
  const optMarks = [];
  /* „1"-Plaketten der XOR-Gruppen (`=`, SPEC §9/D35) — wie die Optional-Kreise
     erst NACH den Knoten gezeichnet, sitzen aber auf der Leitung, nie auf
     einer Knotenkante. */
  const xorMarks = [];
  nodes.forEach(parentEl => {
    const li = parentEl.closest('li');
    const childUl = li && [...li.children].find(c => c.tagName === 'UL');
    if(!childUl) return;
    const gate = childUl.classList.contains('or') ? 'or' : 'and';
    const isXor = childUl.classList.contains('xor');
    const stroke = gate === 'or' ? '#6B7A8C' : '#41556E';
    const dash = gate === 'or';
    /* Die Treppe (D29) ist eine Anordnung, keine Ebene: alle Stufen sind Kinder
       DIESES Elternknotens. An die Sammelleiste kommt nur die erste Stufe; die
       übrigen hängen an der Kaskade und werden unten nachgezogen. Zöge man jede
       Stufe einzeln an die Leiste, liefe die Linie zur dritten Stufe hinter der
       zweiten hindurch — und läse sich wie eine Eltern-Kind-Beziehung. */
    const kidEls = [], stairs = [];
    for(const cli of childUl.children){
      if(cli.classList.contains('opt-group')){
        const st = [...cli.querySelectorAll(':scope > ul.opt-stair > li > .node')];
        if(!st.length) continue;
        kidEls.push(st[0]);
        if(st.length > 1) stairs.push(st);
      } else {
        const n = cli.querySelector(':scope > .node');
        if(n) kidEls.push(n);
      }
    }
    const kids = kidEls.map(R);
    if(!kids.length) return;
    const isOpt = i => kidEls[i].classList.contains('opt');
    const p = R(parentEl);
    const avgdx = kids.reduce((s,k)=>s+(k.cx-p.cx),0)/kids.length;
    const avgdy = kids.reduce((s,k)=>s+(k.cy-p.cy),0)/kids.length;
    if(Math.abs(avgdx) >= Math.abs(avgdy)){                    /* links→rechts */
      const toRight = avgdx >= 0;
      const px = toRight ? p.r : p.x;
      const busX = toRight ? Math.min(...kids.map(k=>k.x))-14 : Math.max(...kids.map(k=>k.r))+14;
      const ys = kids.map(k=>k.cy).concat(p.cy);
      parts.push(seg(px, p.cy, busX, p.cy, stroke, dash));
      if(isXor) xorMarks.push({x:(px+busX)/2, y:p.cy});
      parts.push(seg(busX, Math.min(...ys), busX, Math.max(...ys), stroke, dash));
      kids.forEach((k, i) => {
        const x = toRight ? k.x : k.r, o = isOpt(i);
        parts.push(seg(busX, k.cy, x, k.cy, stroke, dash || o));
        if(o) optMarks.push({x, y: k.cy});
      });
    } else {                                                   /* oben→unten */
      const toDown = avgdy >= 0;
      const py = toDown ? p.b : p.y;
      const busY = toDown ? Math.min(...kids.map(k=>k.y))-14 : Math.max(...kids.map(k=>k.b))+14;
      const xs = kids.map(k=>k.cx).concat(p.cx);
      parts.push(seg(p.cx, py, p.cx, busY, stroke, dash));
      if(isXor) xorMarks.push({x:p.cx, y:(py+busY)/2});
      parts.push(seg(Math.min(...xs), busY, Math.max(...xs), busY, stroke, dash));
      kids.forEach((k, i) => {
        const y = toDown ? k.y : k.b, o = isOpt(i);
        parts.push(seg(k.cx, busY, k.cx, y, stroke, dash || o));
        if(o) optMarks.push({x: k.cx, y});
      });
    }
    /* Kaskade ab der zweiten Stufe: an der linken Kante der vorigen Stufe
       herab, dann waagerecht in die eigene — dieselbe Führung wie am Bildschirm. */
    stairs.forEach(st => {
      for(let j = 1; j < st.length; j++){
        const a = R(st[j-1]), b = R(st[j]);
        parts.push(seg(a.x, a.b, a.x, b.cy, stroke, true));
        parts.push(seg(a.x, b.cy, b.x, b.cy, stroke, true));
        optMarks.push({x: b.x, y: b.cy});
      }
    });
  });

  /* 1a) Querverbindungen der Abhängigkeiten (D41) — Basis-Kanten hinter den
     Knoten; die Fokus-Hervorhebung ist Interaktion und wird nicht exportiert. */
  depEdges().forEach(([from, to]) => {
    const c = depCurve(R(from), R(to));
    parts.push(`<path d="${c.d}" fill="none" stroke="#6B7A8C" stroke-width="1.5" opacity="0.4" stroke-linecap="round" stroke-dasharray="0.1 3"/>`);
    parts.push(`<path d="${depArrow(c.end, c.ctrl)}" fill="none" stroke="#6B7A8C" stroke-width="1.5" opacity="0.4" stroke-linecap="round" stroke-linejoin="round"/>`);
  });

  /* 1b) Günstigster-Pfad: kräftige Linie hinter den Knoten */
  if(cheapPts.length >= 2) parts.push(cheapLine('0.9'));

  /* 2) Badge/Pille (Größe, Tags) */
  const drawBadge = (el, fill, textColor, strokeColor) => {
    const b = R(el);
    parts.push(`<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" rx="${Math.min(b.h/2,9).toFixed(1)}" fill="${fill}"${strokeColor?` stroke="${strokeColor}" stroke-width="1.2"`:''}/>`);
    parts.push(`<text x="${b.cx.toFixed(1)}" y="${(b.cy+3.2).toFixed(1)}" text-anchor="middle" fill="${textColor}" font-size="9" font-family="'IBM Plex Mono',monospace">${esc(el.textContent.trim())}</text>`);
  };

  /* 3) Knoten */
  nodes.forEach(node => {
    const b = R(node), cs = getComputedStyle(node);
    const dashed = cs.borderTopStyle === 'dashed';
    parts.push(`<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" rx="8" fill="${cs.backgroundColor}" stroke="${cs.borderTopColor}" stroke-width="${parseFloat(cs.borderTopWidth)||1.5}"${dashed?' stroke-dasharray="4 3"':''}/>`);
    const clone = node.cloneNode(true);
    /* Das „▸ n"-Kennzeichen eingeklappter Knoten gehört in den Export (SPEC
       §9/D38 — das Bild darf keine Vollständigkeit behaupten); das ▾ offener
       Knoten ist Bedienelement und fällt weg. */
    const stripFold = node.classList.contains('folded') ? '' : ',.fold';
    clone.querySelectorAll('.size,.tags,.ext,.risk,.ownst,.desc-mark' + stripFold).forEach(e => e.remove());
    const label = clone.textContent.replace(/\s+/g,' ').trim();
    const deco = cs.textDecorationLine.includes('line-through') ? ' text-decoration="line-through"' : '';
    parts.push(`<text x="${b.cx.toFixed(1)}" y="${(b.cy+5).toFixed(1)}" text-anchor="middle" fill="${cs.color}" font-size="14" font-weight="${cs.fontWeight}"${deco}>${esc(label)}</text>`);
    const riskEl = node.querySelector('.risk');
    if(riskEl){
      const rb = R(riskEl);
      parts.push(`<circle cx="${rb.cx.toFixed(1)}" cy="${rb.cy.toFixed(1)}" r="${(Math.min(rb.w,rb.h)/2).toFixed(1)}" fill="#ffffff" stroke="#F97316" stroke-width="1.5"/>`);
      parts.push(`<text x="${rb.cx.toFixed(1)}" y="${(rb.cy+3.5).toFixed(1)}" text-anchor="middle" fill="#F97316" font-size="10">⚠︎</text>`);
    }
    const sizeEl = node.querySelector('.size');
    if(sizeEl) drawBadge(sizeEl, '#0F766E', '#ffffff');
    node.querySelectorAll('.tag').forEach(tg => {
      const t = getComputedStyle(tg);
      drawBadge(tg, t.backgroundColor, t.color, t.borderTopColor);
    });
    /* Diskrepanz-Marke des effektiven Status (D39) — Aussage über den Plan,
       gehört in den Export wie Größe und Tags. */
    node.querySelectorAll('.ownst').forEach(c => {
      const s = getComputedStyle(c);
      drawBadge(c, s.backgroundColor, s.color, s.borderTopColor);
    });
  });

  /* 3a) Optionale Knoten: hohler Kreis auf der Kante (nach den Knoten) */
  optMarks.forEach(m => parts.push(
    `<circle cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="4" fill="#ffffff" stroke="#41556E" stroke-width="2"/>`));

  /* 3a′) XOR-Gruppen: „1"-Plakette am Austritt der Sammelleiste (D35) */
  xorMarks.forEach(m => {
    parts.push(`<circle cx="${m.x.toFixed(1)}" cy="${m.y.toFixed(1)}" r="6.5" fill="#ffffff" stroke="#6B7A8C" stroke-width="1.5"/>`);
    parts.push(`<text x="${m.x.toFixed(1)}" y="${(m.y+3).toFixed(1)}" text-anchor="middle" fill="#6B7A8C" font-size="9" font-weight="600">1</text>`);
  });

  /* 3b) Günstigster-Pfad: abgetönte Kopie über den Knoten + Stationspunkte */
  if(cheapPts.length >= 2){
    parts.push(cheapLine('0.2'));
    cheapPts.forEach(p => parts.push(
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="10" fill="#0F766E" fill-opacity="0.2" stroke="#0F766E" stroke-opacity="0.35" stroke-width="1.5"/>`));
  }

  /* 4) Geister-Knoten „Untergliederung fehlt“ */
  out.querySelectorAll('.ghost-node').forEach(g => {
    const b = R(g);
    parts.push(seg(b.cx, b.y-14, b.cx, b.y, '#B45309', true));
    parts.push(`<rect x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" rx="8" fill="rgba(180,83,9,0.06)" stroke="#B45309" stroke-width="1.5" stroke-dasharray="4 3"/>`);
    parts.push(`<text x="${b.cx.toFixed(1)}" y="${(b.cy+4).toFixed(1)}" text-anchor="middle" fill="#B45309" font-size="11" font-style="italic">${esc(g.textContent.trim())}</text>`);
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'IBM Plex Sans',system-ui,sans-serif">${parts.join('')}</svg>`;
  out.style.zoom = zoomBefore;
  out.classList.remove('exporting');
  return {svg, W, H};
}
function svgToPng(svg, W, H, scale){
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(W*scale); c.height = Math.round(H*scale);
      const ctx = c.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      c.toBlob(b => resolve({blob:b, dataUrl:c.toDataURL('image/png')}), 'image/png');
    };
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
/* Kopiert das Diagramm als PNG-Bild. Zusätzlich wird eine text/html-Variante
   mit eingebettetem PNG mitgegeben — Office-Programme wie LibreOffice Writer
   bevorzugen den HTML-Flavor und betten das Bild dann korrekt ein. */
async function copyDiagramImage(){
  const {svg, W, H} = diagramToSvg();
  const png = await svgToPng(svg, W, H, 2);
  if(png && png.blob && navigator.clipboard && window.ClipboardItem){
    const html = new Blob(
      [`<img src="${png.dataUrl}" width="${W}" height="${H}" alt="Werkbaum-Diagramm">`],
      {type:'text/html'});
    try{
      await navigator.clipboard.write([new ClipboardItem({'image/png':png.blob, 'text/html':html})]);
      return;
    }catch(_){
      try{ await navigator.clipboard.write([new ClipboardItem({'image/png':png.blob})]); return; }catch(_){}
    }
  }
  await writeClipboard(svg);   /* Fallback: SVG-Quelltext (ebenfalls Grafik) */
}
/* Als Datei speichern (SVG, Vektor). Verlässlicher Weg z. B. für LibreOffice
   Writer: Einfügen → Bild → die Datei; das Bild-Clipboard aus dem Browser
   erkennt LibreOffice nicht zuverlässig. */
function saveBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadDiagramSvg(){
  const {svg} = diagramToSvg();
  saveBlob(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n` + svg], {type:'image/svg+xml'}),
           'werkbaum-diagramm.svg');
}
async function downloadDiagramPng(){
  const {svg, W, H} = diagramToSvg();
  const png = await svgToPng(svg, W, H, 2);
  if(png && png.blob) saveBlob(png.blob, 'werkbaum-diagramm.png');
}

/* Tab-Taste rückt ein statt den Fokus zu wechseln */
src.addEventListener('keydown', e => {
  if(e.key === 'Tab'){
    e.preventDefault();
    const {selectionStart:s, selectionEnd:eEnd, value} = src;
    src.value = value.slice(0, s) + '  ' + value.slice(eEnd);
    src.selectionStart = src.selectionEnd = s + 2;
    render();
    saveSrc();
  }
});

src.addEventListener('input', render);
src.addEventListener('input', saveSrc);

/* ---------- Sprung zwischen Diagramm und Text (D25) ----------
   Jeder Knoten trägt seine Zeilennummer als `data-line` (render.js).
   Diagramm -> Text: Alt+Klick (bzw. Alt+Enter am fokussierten Knoten, mobil
   langer Druck) markiert die Zeile im Textfeld. Text -> Diagramm: die Zeile
   des Cursors hebt den zugehörigen Knoten hervor. Alt statt einfachem Klick,
   weil ein Knoten mit URL als <a> den ganzen Kasten belegt (SPEC §6). */

/* Zeichenbereich einer 1-basierten Zeile; null, wenn es sie nicht (mehr) gibt. */
function lineRange(line){
  const lines = src.value.split('\n');
  if(!(line >= 1 && line <= lines.length)) return null;
  let start = 0;
  for(let i = 0; i < line - 1; i++) start += lines[i].length + 1;
  return {start, end: start + lines[line - 1].length};
}

/* Vertikale Position eines Zeichenoffsets im Textfeld. Zeilenhöhe × n scheitert
   an weichen Umbrüchen (lange Zeilen belegen mehrere Bildzeilen), deshalb ein
   unsichtbarer Spiegel mit gleicher Typografie und Breite plus Marker-Span. */
let mirrorEl = null;
function syncMirror(){
  if(!mirrorEl){
    mirrorEl = document.createElement('div');
    mirrorEl.setAttribute('aria-hidden', 'true');
    /* `box-sizing:border-box` ist Pflicht: `src.clientWidth` **enthält** die
       Innenabstände. Ohne das ist der Spiegel um genau diese 32 px breiter als
       das Textfeld und bricht später um — lange Zeilen landeten dadurch zu weit
       oben (fiel beim Bau der Zeilennummern auf, D33; betraf auch schon das
       Scrollen beim Sprung, D25). */
    mirrorEl.style.cssText = 'position:absolute;visibility:hidden;top:0;left:-9999px;' +
                             'box-sizing:border-box;' +
                             'white-space:pre-wrap;overflow-wrap:break-word;';
    document.body.appendChild(mirrorEl);
  }
  const cs = getComputedStyle(src);
  for(const p of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing',
                  'paddingTop','paddingLeft','paddingRight','borderTopWidth','tabSize']){
    mirrorEl.style[p] = cs[p];
  }
  mirrorEl.style.width = src.clientWidth + 'px';
  return mirrorEl;
}
const ZWSP = '​';
function offsetTopInEditor(offset){
  const m = syncMirror();
  m.textContent = src.value.slice(0, offset);
  const marker = document.createElement('span');
  marker.textContent = ZWSP;
  m.appendChild(marker);
  const top = marker.offsetTop;
  m.textContent = '';
  return top;
}

/* Oberkante jeder **logischen** Zeile, im selben Koordinatensystem wie
   `src.scrollTop` (die Innenabstände stecken schon drin). Ein Marker je Zeile
   im selben Spiegel: einmal schreiben, dann alle `offsetTop` in einem Durchgang
   lesen — sonst erzwingt jede Messung ein eigenes Neu-Layout. */
function lineTops(){
  const m = syncMirror();
  m.textContent = '';
  const marks = [];
  for(const line of src.value.split('\n')){
    const s = document.createElement('span');
    s.textContent = ZWSP;
    m.appendChild(s);
    marks.push(s);
    m.appendChild(document.createTextNode(line + '\n'));
  }
  const tops = marks.map(s => s.offsetTop);
  m.textContent = '';
  return tops;
}

/* ---------- Zeilennummern (D33) ----------
   Die Warnungen nennen Zeilennummern (SPEC §4); ohne Streifen muss man sie im
   Textfeld abzählen. Der Streifen ist ein eigener Kasten neben dem Textfeld —
   in den Textfluss lässt sich nichts einfügen, ein `<textarea>` kennt kein
   Markup. Gescrollt wird er nicht selbst, sondern gegen `src.scrollTop`
   verschoben; so kann er nie auseinanderlaufen. */
let lineNoWarn = new Set();
function renderLineNos(){
  const tops = lineTops();
  /* Der Marker ist ein Inline-Kasten und steht in seiner Zeilenbox mittig — sein
     `offsetTop` liegt also ein paar Pixel unter der Zeilen**oberkante**. Die Zahl
     bekommt eine eigene Zeilenbox gleicher Höhe und muss deshalb an der
     Oberkante ansetzen, sonst stünde sie durchgehend zu tief. Der Versatz ist an
     der ersten Zeile ablesbar: dort ist die Oberkante der obere Innenabstand. */
  const drop = tops.length ? tops[0] - (parseFloat(getComputedStyle(src).paddingTop) || 0) : 0;
  /* Breite nur schreiben, wenn sie sich ändert: sie ändert die Breite des
     Textfelds, das weckt den ResizeObserver — und der ruft wieder hierher. */
  const w = 'calc(' + String(tops.length).length + 'ch + 12px)';
  if(lineNoBox.style.width !== w) lineNoBox.style.width = w;
  /* Vorhandene Zahlen weiterverwenden: bei jedem Tastendruck N Elemente neu zu
     bauen wäre Müll für nichts — die Zahlen ändern sich fast nie, nur ihre Höhe. */
  const have = lineNoInner.children.length;
  for(let i = have; i < tops.length; i++){
    lineNoInner.appendChild(document.createElement('span'));
  }
  for(let i = have - 1; i >= tops.length; i--) lineNoInner.children[i].remove();
  for(let i = 0; i < tops.length; i++){
    const s = lineNoInner.children[i], n = i + 1;
    if(s.textContent !== String(n)) s.textContent = n;
    s.style.top = (tops[i] - drop) + 'px';
    s.classList.toggle('warn', lineNoWarn.has(n));
  }
  markCurrentLineNo();
  syncLineNoScroll();
}
function syncLineNoScroll(){
  lineNoInner.style.transform = 'translateY(' + (-src.scrollTop) + 'px)';
}
function markCurrentLineNo(){
  const cur = lineNoInner.querySelector('span.cur');
  if(cur) cur.classList.remove('cur');
  const s = caretLine == null ? null : lineNoInner.children[caretLine - 1];
  if(s) s.classList.add('cur');
}
src.addEventListener('scroll', syncLineNoScroll);
/* Der Umbruch hängt an der Breite: Splitter, Fenster, Drehung, Tastatur. Beim
   Ziehen am Splitter kämen sonst je Bild mehrere Messungen — einmal je Bild
   genügt. */
let lineNoPending = false;
if(window.ResizeObserver) new ResizeObserver(() => {
  if(lineNoPending) return;
  lineNoPending = true;
  requestAnimationFrame(() => { lineNoPending = false; renderLineNos(); });
}).observe(src);

/* Nur scrollen, wenn die Zeile nicht ohnehin bequem sichtbar ist. */
function scrollEditorToOffset(offset){
  const top = offsetTopInEditor(offset), h = src.clientHeight;
  if(top < src.scrollTop + 8 || top > src.scrollTop + h - 28){
    src.scrollTop = Math.max(0, top - h / 2);
    /* Das `scroll`-Ereignis kommt erst im nächsten Bild. Wer selbst scrollt,
       zieht die Zeilennummern deshalb gleich mit — sonst stünden sie bis dahin
       um eine ganze Bildhöhe daneben. */
    syncLineNoScroll();
  }
}

/* Ist das Editor-Panel zugeklappt, muss der Sprung es erst öffnen. */
function revealEditor(){
  /* In der Ansicht „nur Pad" (D31) ist der Spiegel ausgeblendet — dann gibt es
     keine Zeile zum Markieren. Der Sprung holt ihn deshalb zurück, genau wie er
     ein zugeklapptes Editor-Panel aufklappt (D25). */
  if(padView === 'pad' && padSource && activeId === padSource.id){
    padView = 'both';
    applyPadView();
    saveUI();
  }
  if(isMobile()){
    /* Auf Mobil ist der Text womöglich gar nicht vorn — dann holt der Sprung
       ihn nach vorn, so wie er auf dem Desktop ein zugeklapptes Panel aufklappt
       (D17-Nachtrag). */
    setMobilePane('text', true);
  } else if(splitState === 'b'){
    splitState = 'normal';
    applySplit();
  }
}

/* Der Sprung ist „hinschauen", nicht „bearbeiten": `inputmode="none"` hält die
   **virtuelle** Tastatur unten, die sonst beim Fokussieren den halben
   Bildschirm nimmt. Hardware-Tastaturen (BT) tippen unverändert weiter. Sobald
   der Nutzer das Textfeld selbst antippt, ist Bearbeiten gemeint — `pointerdown`
   läuft vor dem Fokus, die Sperre fällt also rechtzeitig. */
function keyboardOnJump(off){
  if(off) src.setAttribute('inputmode', 'none');
  else src.removeAttribute('inputmode');
}
src.addEventListener('pointerdown', () => keyboardOnJump(false));

/* Diagramm -> Text: ganze Zeile markieren (die native Auswahl ist die einzige
   Hervorhebung, die ein <textarea> kennt — und sie verschwindet beim Tippen). */
function jumpToLine(line){
  const r = lineRange(line);
  if(!r) return;
  revealEditor();
  keyboardOnJump(true);
  src.focus({preventScroll: true});
  src.setSelectionRange(r.start, r.end);
  scrollEditorToOffset(r.start);
  caretLine = line;
  highlightCurrentNode(true);
}

function nodeFromEvent(e){
  const el = e.target && e.target.closest ? e.target.closest('.node[data-line]') : null;
  return el && out.contains(el) ? el : null;
}

/* ---------- Faltung zurück in den Text (D38-Nachtrag 2) ----------
   Umklappen im Diagramm ändert den Notationstext. Der Text ist damit auch für
   die Faltung die eine Quelle der Wahrheit (D14) — die Sitzungs-Überlagerung
   `foldOverrides` bleibt nur für Dokumente, in die nicht geschrieben werden
   kann (Pad, schreibgeschützt nach D31). */

/* Der Sollzustand als Menge von Label-Pfad-Schlüsseln: heutiger Anfangszustand
   aus dem Text, überlagert von den Eingriffen — dieselbe Rechnung wie in
   render(), damit beide nie auseinanderlaufen. */
function desiredFoldKeys(roots){
  const initFold = initialCollapsed(roots, true);
  const keys = nodeKeys(roots);
  const want = new Set();
  keys.forEach((key, n) => {
    const ov = foldOverrides.get(key);
    if((ov !== undefined ? ov : initFold.has(n)) && n.children.length > 0) want.add(key);
  });
  return want;
}

/* Erzeugt ein Text ZWEIMAL denselben Faltzustand? Statt die Ableitung
   Text -> Zustand umzukehren (sie ist nicht eindeutig: mehrere Markensätze
   ergeben denselben Zustand), wird der Kandidat schlicht nachgerechnet.
   `initialCollapsed()` bleibt so die einzige Wahrheit über die Bedeutung der
   Marken — die Umkehrung muss sie nicht kennen, nur befragen. */
function foldStateMatches(txt, want){
  const r = parse(txt).roots;
  const keys = nodeKeys(r);
  const got = new Set();
  initialCollapsed(r, true).forEach(n => { if(n.children.length > 0) got.add(keys.get(n)); });
  if(got.size !== want.size) return false;
  for(const k of want) if(!got.has(k)) return false;
  return true;
}

/* Schreibt den Text undo-fähig. `execCommand` ist die EINZIGE Art, ein Textfeld
   programmatisch zu ändern, ohne dessen Rückgängig-Historie zu zerstören
   (nachgemessen: `value =` und `setRangeText` machen Strg+Z wirkungslos). Sie
   ersetzt die Auswahl — geändert wird deshalb nur das wirklich abweichende
   Stück zwischen gemeinsamem Anfang und Ende. */
function replaceTextUndoable(neu){
  const alt = src.value;
  if(alt === neu) return true;
  let s = 0;
  while(s < alt.length && s < neu.length && alt[s] === neu[s]) s++;
  let e = 0;
  while(e < alt.length - s && e < neu.length - s &&
        alt[alt.length-1-e] === neu[neu.length-1-e]) e++;
  const von = s, bis = alt.length - e, ein = neu.slice(s, neu.length - e);
  const cs = src.selectionStart, ce = src.selectionEnd, top = src.scrollTop;
  /* Der Fokus muss ins Textfeld — sonst greift execCommand nicht. Auf dem
     Telefon zöge das die Bildschirmtastatur hoch; `inputmode="none"` hält sie
     unten (derselbe Griff wie beim Sprung, D25), und der erste echte Tipp ins
     Feld hebt die Sperre wieder auf. */
  keyboardOnJump(true);
  src.focus({preventScroll: true});
  src.setSelectionRange(von, bis);
  let ok = false;
  try{ ok = document.execCommand('insertText', false, ein); }catch(_){}
  if(!ok){
    /* Rückfall: Der richtige Zustand geht vor der Undo-Historie (D14). */
    src.value = neu;
    src.dispatchEvent(new Event('input', {bubbles: true}));
  }
  /* Schreibmarke und Scrollstand zurück — sonst risse das Falten den Nutzer
     aus seiner Textstelle. Nur was HINTER der Änderung lag, verschiebt sich. */
  const d = ein.length - (bis - von);
  const fix = p => p >= bis ? p + d : Math.min(p, von + ein.length);
  src.setSelectionRange(fix(cs), fix(ce));
  src.scrollTop = top;
  return true;
}

/* Auf kleinem Bildschirm ist der Editor `display:none`, wenn das Diagramm vorn
   ist — und dann tut `execCommand` NICHTS (gemessen: liefert `false`, obwohl
   `activeElement` das Feld meldet). Für die Dauer des synchronen Schreibens
   wird er deshalb aus dem Fluss heraus sichtbar geschaltet; gezeichnet wird
   davon nichts, wie bei `exporting` im Grafikexport. */
function withEditorWritable(fn){
  const versteckt = editorPanel.offsetParent === null;
  if(versteckt) document.body.classList.add('writing-fold');
  try{ return fn(); }
  finally{ if(versteckt) document.body.classList.remove('writing-fold'); }
}

/* Schreibt den Faltzustand in den Text. Liefert false, wenn nicht geschrieben
   werden konnte — dann bleibt die Sitzungs-Überlagerung stehen. */
function writeFoldToText(line, collapsed){
  if(src.readOnly) return false;             /* Pad-Dokument (D31) */
  const roots = parse(src.value).roots;
  if(!roots.length) return false;
  const want = desiredFoldKeys(roots);
  const zeilen = src.value.split('\n');

  /* 1) Minimal: nur die umgeklappte Zeile anfassen. So bleiben von Hand
        gesetzte `<` stehen, solange sie den Zustand noch richtig beschreiben. */
  const klein = zeilen.slice();
  klein[line-1] = setFoldMark(klein[line-1], collapsed ? '>' : null);
  let neu = klein.join('\n');

  if(!foldStateMatches(neu, want)){
    /* 2) Vollständig: alle Marken neu setzen. Nötig, wenn ein `<` den Zustand
          nicht mehr trifft — dann wird es hier aufgelöst. */
    const keys = nodeKeys(roots);
    const ganz = zeilen.slice();
    keys.forEach((key, n) => {
      ganz[n.line-1] = setFoldMark(ganz[n.line-1], want.has(key) ? '>' : null);
    });
    neu = ganz.join('\n');
    /* 3) Nicht ausdrückbar — etwa weil ein `!!!` im Zweig seinen Knoten immer
          wieder hervorholt (SPEC §9). Dann NICHT schreiben: ein Text, der
          etwas anderes sagt als das Bild, wäre schlimmer als keine Marke. */
    if(!foldStateMatches(neu, want)) return false;
  }
  return withEditorWritable(() => replaceTextUndoable(neu));
}

/* Faltung umklappen (SPEC §9, D38). Gelingt das Zurückschreiben, ist der Text
   der Zustand — die Überlagerungen werden dann geleert, damit sie ihn nicht
   maskieren können. Nach dem Neubau bekommt derselbe Knoten den Fokus zurück,
   sonst risse die Tastaturbedienung ab (das alte Element ist weg). */
function toggleFold(el){
  const line = +el.dataset.line;
  const st = foldByLine.get(line);
  if(!st || !st.canFold) return;
  foldOverrides.set(st.key, !st.collapsed);
  /* Das Schreiben löst per `input`-Ereignis schon ein render() aus. */
  if(writeFoldToText(line, !st.collapsed)) foldOverrides.clear();
  else render();
  const again = out.querySelector('.node[data-line="' + line + '"]');
  if(again) again.focus({preventScroll: true});
}

/* Klick auf das Falt-Zeichen ▾/▸ klappt um. preventDefault, weil das Zeichen
   bei Link-Knoten IM <a> sitzt — sonst öffnete der Klick zusätzlich die URL. */
out.addEventListener('click', e => {
  const f = e.target && e.target.closest ? e.target.closest('.fold') : null;
  if(!f || !out.contains(f) || e.altKey) return;
  e.preventDefault();
  e.stopPropagation();
  const el = f.closest('.node[data-line]');
  if(el) toggleFold(el);
});

out.addEventListener('click', e => {
  if(!e.altKey) return;
  const el = nodeFromEvent(e);
  if(!el) return;
  /* Ohne preventDefault lädt der Browser bei Alt+Klick auf einen Link das Ziel
     herunter (Chrome/Firefox) — das ist hier ausdrücklich nicht gemeint. */
  e.preventDefault();
  e.stopPropagation();
  jumpToLine(+el.dataset.line);
});

/* Tastatur: Alt+Enter am fokussierten Knoten. Enter allein bleibt dem Link. */
out.addEventListener('keydown', e => {
  if(e.key !== 'Enter' || !e.altKey) return;
  const el = nodeFromEvent(e);
  if(!el) return;
  e.preventDefault();
  jumpToLine(+el.dataset.line);
});

/* Tastatur-Faltung (SPEC §9, D38): ← klappt zu, → klappt auf — das
   WAI-ARIA-Baum-Idiom. Nur ohne Modifier, damit nichts anderes kollidiert. */
out.addEventListener('keydown', e => {
  if(e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if(e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const el = nodeFromEvent(e);
  if(!el) return;
  const st = foldByLine.get(+el.dataset.line);
  if(!st || !st.canFold) return;
  e.preventDefault();
  const want = e.key === 'ArrowLeft';
  if(st.collapsed !== want) toggleFold(el);
});

/* Mobil gibt es kein Alt: langer Druck (500 ms) auf einen Knoten springt.
   Der Sprung passiert erst beim LOSLASSEN: `focus()` aus einem Timer heraus
   gilt in mobilen Browsern nicht als Nutzergeste — der Fokus fiel sofort wieder
   aus dem Textfeld (die Markierung flackerte nur kurz auf). `touchend` ist eine
   echte Geste, dort bleibt er. Nach 500 ms passiert deshalb nur die Rückmeldung:
   der Zielknoten bekommt den Petrol-Ring („scharf"). Der folgende Klick wird
   unterdrückt, sonst öffnete ein Link-Knoten zusätzlich seine URL; das
   Kontextmenü/Callout ebenso (die Geste ist hier vergeben). */
let pressTimer = null, armedEl = null;
function disarmPress(){
  if(pressTimer){ clearTimeout(pressTimer); pressTimer = null; }
  if(armedEl){ armedEl.classList.remove('armed'); armedEl = null; }
}
out.addEventListener('touchstart', e => {
  disarmPress();
  const el = nodeFromEvent(e);
  if(!el) return;
  pressTimer = setTimeout(() => {
    pressTimer = null;
    armedEl = el;
    el.classList.add('armed');
  }, 500);
}, {passive: true});
out.addEventListener('touchmove', disarmPress, {passive: true});
out.addEventListener('touchend', e => {
  const el = armedEl;
  disarmPress();
  if(!el) return;
  e.preventDefault();             /* unterdrückt den nachfolgenden Klick/Link */
  jumpToLine(+el.dataset.line);   /* echte Nutzergeste -> der Fokus bleibt */
}, {passive: false});
out.addEventListener('touchcancel', disarmPress);
out.addEventListener('contextmenu', e => { if(pressTimer || armedEl) e.preventDefault(); });

/* Welcher Knoten gehört zu einer Textzeile? Zuerst der Knoten, DER auf dieser
   Zeile steht; sonst der Knoten, dessen **Beschreibung** hier steht (SPEC §9):
   Eine `"`-Zeile und die Zeilen eines `---`-Blocks tragen keinen eigenen
   Knoten, gehören aber zu einem — und wer darin schreibt, arbeitet an genau
   diesem Knoten. `~=` trifft die Zeilennummer als Glied der Liste in
   `data-desc-lines` (vom Renderer, gefüllt aus `node.descLines`). */
function nodeOfLine(line){
  if(line == null) return null;
  return out.querySelector('.node[data-line="' + line + '"]')
      || out.querySelector('.node[data-desc-lines~="' + line + '"]');
}

/* Text -> Diagramm: Knoten der Cursor-Zeile hervorheben (`caretLine` steht oben). */
/* `scroll` sagt, WIE ins Bild geholt wird: 'nearest' beim gewöhnlichen
   Zeilenwechsel (nur so weit wie nötig — sonst ruckelte das Diagramm),
   'center' beim ausdrücklichen Alt+Klick, `false` gar nicht (Neubau). Die
   Hervorhebung selbst ist in allen Fällen dieselbe, Puls eingeschlossen. */
function highlightCurrentNode(moved, scroll = 'nearest'){
  markCurrentLineNo();   /* die eine Stelle, an der die Cursor-Zeile neu gesetzt wird */
  if(currentNodeEl) currentNodeEl.classList.remove('current', 'pulse');
  currentNodeEl = nodeOfLine(caretLine);
  if(!currentNodeEl){ drawDepLinks(); return; }
  currentNodeEl.classList.add('current');
  /* Die Cursor-Zeile ist die zweite Lesart von „ausgewählt" — ihre
     Abhängigkeits-Kanten hervorheben (D41). */
  drawDepLinks();
  /* Beides nur beim **Zeilenwechsel**: Scrollen ruckelte sonst bei jedem
     Tastendruck, und der Puls (D25-Nachtrag) flackerte beim Tippen. */
  if(!moved) return;
  /* Neustart der Animation erzwingen: Steht der Cursor wieder auf demselben
     Knoten (Zeile mit Knoten -> Zeile ohne -> zurück), wurde `pulse` oben in
     DERSELBEN Aufgabe entfernt — der Browser sieht dann keinen Klassenwechsel
     und startet nichts. Das Lesen von `offsetWidth` erzwingt den Zwischenstand. */
  currentNodeEl.classList.remove('pulse');
  void currentNodeEl.offsetWidth;
  currentNodeEl.classList.add('pulse');
  if(scroll) currentNodeEl.scrollIntoView({block:scroll, inline:scroll, behavior:'smooth'});
}
function caretLineOf(){
  return src.value.slice(0, src.selectionStart).split('\n').length;
}
function syncCaret(){
  const line = caretLineOf();
  const moved = line !== caretLine;
  caretLine = line;
  highlightCurrentNode(moved);
}
for(const ev of ['click','keyup','input','focus']) src.addEventListener(ev, syncCaret);

/* Gegenstück zum Alt+Klick am Knoten (D25, Nachtrag): Alt+Klick im Textfeld —
   Tastatur Alt+Enter — holt den Knoten der Cursor-Zeile in die **Mitte** des
   Diagramms und gibt ihm den Fokus. Der gewöhnliche Klick markiert ihn zwar
   ohnehin, scrollt aber absichtlich nur `nearest` und nur beim Zeilenwechsel
   (sonst ruckelte das Diagramm beim Tippen) — genau das reicht nicht, wenn man
   den Knoten wirklich **sehen** will. Derselbe Modifier in beide Richtungen:
   eine Geste, zwei Richtungen. */
function focusNodeOfCaret(){
  const line = caretLineOf();
  const el = nodeOfLine(line);
  if(!el) return;              /* Kommentar, Leerzeile, ausgeblendet Verworfenes */
  caretLine = line;
  /* Die Gegenrichtung zu revealEditor(): Auf Mobil steht der Text vorn, das
     Diagramm ist verborgen — dort zu zentrieren zeigte auf nichts. Muss VOR
     dem Scrollen laufen, sonst misst sich der Knoten noch zu null. */
  if(isMobile()) setMobilePane('diagram', true);
  /* Erst den Fokus (ohne eigenes Scrollen), dann hervorheben und zentrieren.
     Die Hervorhebung ist **dieselbe wie beim Zeilenwechsel** — Puls
     eingeschlossen; der Unterschied ist allein, dass hier bewusst zentriert
     wird statt nur so weit zu scrollen wie nötig. Deshalb `true` statt `false`:
     die erste Fassung unterdrückte den Puls, und der Knoten kam ausgerechnet
     bei der ausdrücklichen Geste stiller an als beim beiläufigen Tippen. */
  el.focus({preventScroll: true});
  highlightCurrentNode(true, 'center');
}
src.addEventListener('click', e => { if(e.altKey) focusNodeOfCaret(); });
src.addEventListener('keydown', e => {
  if(e.key !== 'Enter' || !e.altKey) return;
  e.preventDefault();          /* sonst bekäme der Text einen Umbruch */
  focusNodeOfCaret();
});

/* Alt-Modus sichtbar machen: solange Alt gedrückt ist, zeigt jeder Knoten den
   Sprung-Cursor und der Knoten unter dem Zeiger einen Petrol-Ring. Das ist die
   einzige Rückmeldung, die auch auf verlinkten Knoten funktioniert (dort gehört
   der einfache Klick weiterhin dem Link). `blur` ist nötig: bei Alt+Tab kommt
   kein keyup mehr an, der Modus bliebe sonst hängen. */
function setAltMode(on){ out.classList.toggle('alt', on); }
window.addEventListener('keydown', e => { if(e.key === 'Alt') setAltMode(true); });
window.addEventListener('keyup',   e => { if(e.key === 'Alt' || !e.altKey) setAltMode(false); });
window.addEventListener('blur',    () => setAltMode(false));

const app = document.getElementById('app');
function applyLayout(mode){
  out.classList.toggle('vertical', mode === 'vertikal');
  out.classList.toggle('kompakt', mode === 'kompakt');
  app.classList.toggle('side', mode !== 'horizontal');
  if(!isMobile()) applySplit();   /* Desktop: Preset neu setzen. Mobil: freie --drow-Aufteilung behalten */
  applyOptStairs();   /* Treppe gilt nur im Fächer — beim Moduswechsel bauen/auflösen */
  alignStems();       /* Stiel gilt nur im Fächer — beim Moduswechsel neu setzen/löschen */
  drawCheapPath();    /* Blatt-Positionen ändern sich mit dem Modus */
  drawDepLinks();     /* Knoten-Positionen ebenso (D41) */
}
document.querySelectorAll('input[name="layout"]').forEach(radio => {
  radio.addEventListener('change', () => { if(radio.checked) applyLayout(radio.value); });
});

/* ---------- Min/Normal/Max je Bereich (Fenster-Buttons) ---------- */
/* Zustand 'a' = Diagramm minimiert (Editor maximiert),
   'b' = Editor minimiert (Diagramm maximiert), 'normal' = beide sichtbar.
   Minimieren schrumpft ein Panel auf seine Titelzeile; Maximieren des einen
   entspricht dem Minimieren des anderen. */
let splitState = 'normal';
const editorPanel = document.querySelector('.panel.editor');
const diagramPanel = document.querySelector('.panel.right');
function clearCollapse(){
  app.classList.remove('collapse-editor','collapse-diagram');
  editorPanel.classList.remove('collapsed');
  diagramPanel.classList.remove('collapsed');
  document.querySelectorAll('.winbtn').forEach(b => b.classList.remove('active'));
}
function applySplit(){
  /* Preset-/Drag-Größen bei Preset-Wechsel zurücksetzen */
  app.style.removeProperty('--col');
  app.style.removeProperty('--drow');
  app.classList.toggle('collapse-diagram', splitState==='a');
  app.classList.toggle('collapse-editor',  splitState==='b');
  diagramPanel.classList.toggle('collapsed', splitState==='a');
  editorPanel.classList.toggle('collapsed', splitState==='b');
  document.querySelectorAll('.winbtn').forEach(b => b.classList.toggle('active', b.dataset.state===splitState));
  saveUI();
}
/* Setzt einen Minimier-Zustand während des Ziehens nur bei Änderung. */
function snapTo(state){ if(splitState!==state){ splitState = state; applySplit(); } }

/* ---------- Mobil: genau EIN Bereich, Umschalter oben links (D17-Nachtrag) ----------
   Auf kleinem Bildschirm gibt es nichts zu teilen — Diagramm ODER Text füllt
   die Fläche, ein Knopf im Kopf schaltet um. Der frühere Splitter samt --drow,
   Grid-Minima (--pmin-d/--pmin-e) und Titelzeilen-Tippen ist damit entfallen. */
function applyMobilePane(){
  document.body.classList.toggle('pane-diagram', mobilePane === 'diagram');
  document.body.classList.toggle('pane-text',    mobilePane === 'text');
}
function setMobilePane(pane, save){
  mobilePane = pane;
  applyMobilePane();
  /* Ein Panel mit `display:none` misst sich zu **null**. Alles, was aus der
     Live-Geometrie zeichnet, muss deshalb nach dem Sichtbarwerden neu laufen —
     im Diagramm dieselben vier Schritte wie beim Moduswechsel (applyLayout),
     im Editor der Zeilennummern-Streifen, der am Spiegel misst (D33). */
  if(pane === 'diagram'){ applyOptStairs(); alignStems(); drawCheapPath(); drawDepLinks(); }
  else renderLineNos();
  if(save) saveUI();
}
document.getElementById('paneToText')
  .addEventListener('click', () => setMobilePane('text', true));
/* Der Wechsel **ins Diagramm** ist zugleich die Navigation zum Knoten, an dem
   man gerade geschrieben hat. Für diese Richtung gibt es sonst nur Alt+Klick
   (D25) — und Alt gibt es auf dem Telefon nicht; die Gegenrichtung hat dort
   ihren langen Druck, diese hatte nichts. Ein eigener langer Druck im Textfeld
   verbietet sich: Dort gehört er dem Betriebssystem (Wort markieren,
   Auswahlgriffe) — das ist die Bedien-Grundlage zum Bearbeiten, die man einem
   Textfeld nicht wegnehmen darf. Der Umschalter trägt die Geste stattdessen
   umsonst: Er wird ohnehin gedrückt, wenn man nachsehen will. */
document.getElementById('paneToDiagram').addEventListener('click', () => {
  if(caretLine != null && nodeOfLine(caretLine)) focusNodeOfCaret();
  else setMobilePane('diagram', true);
});
document.querySelectorAll('.winbtn').forEach(b => {
  b.addEventListener('click', e => {
    /* Fenster-Buttons sind maßgeblich: nicht zum Titelzeilen-Restore durchreichen */
    e.stopPropagation();
    splitState = b.dataset.state; applySplit();
  });
});
/* Klick auf die Titelzeile eines minimierten Panels stellt es wieder her. */
[editorPanel, diagramPanel].forEach(panel => {
  panel.querySelector('.panel-head').addEventListener('click', e => {
    if(e.target.closest('button, label, input')) return;   /* Bedienelemente behalten ihre Funktion */
    /* Auf Mobil ist immer genau ein Panel zu sehen — es gibt keins, das per
       Titelzeile hervorzuholen wäre; das erledigt der Umschalter (D17-Nachtrag). */
    if(isMobile()) return;
    /* Desktop: nur ein minimiertes Panel per Titelzeile wiederherstellen. */
    if(!panel.classList.contains('collapsed')) return;
    splitState = 'normal';
    applySplit();
  });
});

/* ---------- Splitter: Bereiche per Drag verteilen ---------- */
const gutter = document.getElementById('gutter');
const diagramEl = document.querySelector('.diagram');
let dragging = false;
gutter.addEventListener('pointerdown', e => {
  dragging = true;
  gutter.classList.add('dragging');
  gutter.setPointerCapture(e.pointerId);
  document.body.style.userSelect = 'none';
  /* Freies Ziehen hebt Preset und Minimierung auf */
  splitState = 'custom';
  clearCollapse();
  e.preventDefault();
});
/* Näher als SNAP an einem Rand: in den minimierten Zustand einrasten,
   sonst frei skalieren. So sind beide Extreme per Splitter erreichbar. */
const SNAP = 72;
gutter.addEventListener('pointermove', e => {
  if(!dragging) return;
  const rect = app.getBoundingClientRect();
  if(app.classList.contains('side')){
    const w = e.clientX - rect.left, maxw = rect.width - 14;
    if(w <= SNAP)               snapTo('b');            /* Editor auf Titelzeile */
    else if(w >= maxw - SNAP)   snapTo('a');            /* Diagramm auf Titelzeile */
    else {
      if(splitState!=='custom'){ splitState='custom'; clearCollapse(); }
      app.style.setProperty('--col', w + 'px');
    }
  } else {
    const h = e.clientY - rect.top, maxh = rect.height - 14;
    if(h <= SNAP)               snapTo('a');            /* Diagramm (oben) auf Titelzeile */
    else if(h >= maxh - SNAP)   snapTo('b');            /* Editor (unten) auf Titelzeile */
    else {
      if(splitState!=='custom'){ splitState='custom'; clearCollapse(); }
      app.style.setProperty('--drow', h + 'px');
    }
  }
});
function endDrag(e){
  if(!dragging) return;
  dragging = false;
  gutter.classList.remove('dragging');
  document.body.style.userSelect = '';
  try{ gutter.releasePointerCapture(e.pointerId); }catch(_){}
  saveUI();   /* freie Drag-Groesse (--col/--drow) sichern */
}
gutter.addEventListener('pointerup', endDrag);
gutter.addEventListener('pointercancel', endDrag);
/* Doppelklick auf den Splitter stellt die normale Aufteilung wieder her.
   (Auf Mobil gibt es keinen Splitter mehr — D17-Nachtrag.) */
gutter.addEventListener('dblclick', () => {
  splitState = 'normal'; applySplit();
});

/* ---------- Zoom für das Diagramm ---------- */
/* CSS-`zoom` skaliert die Layout-Box, dadurch greifen die Scrollbalken
   des Diagramm-Containers korrekt (anders als transform: scale). */
const ZMIN = 0.3, ZMAX = 3, ZSTEP = 0.1;
const ZOOM_COLLAPSE_DELAY = 3000;  /* 3 Sekunden */
let zoom = 1;
let zoomCollapseTimeout;
/* Auf kleinem Bildschirm wird der Inhalt grundsätzlich verkleinert (~25 %),
   damit mehr Plan auf die Fläche passt (D17-Nachtrag 2). Das ist ein Faktor
   AUF den Nutzer-Zoom, kein neuer Anfangswert: Wer hineinzoomt, tut das
   weiterhin relativ hierzu. Der Text bekommt dieselbe Verkleinerung über die
   Schriftgröße (style.css) — CSS-`zoom` verbietet sich dort, weil der
   Zeilennummern-Streifen und der Spiegel am Textfeld messen (D33). */
const MOBILE_ZOOM = 0.75;
function effZoom(){ return zoom * (isMobile() ? MOBILE_ZOOM : 1); }

function resetZoomCollapseTimeout(){
  const zoomctl = document.querySelector('.zoomctl');
  if(!zoomctl) return;
  clearTimeout(zoomCollapseTimeout);
  zoomctl.classList.remove('collapsed');
  zoomCollapseTimeout = setTimeout(() => {
    zoomctl.classList.add('collapsed');
  }, ZOOM_COLLAPSE_DELAY);
}

function applyZoom(){
  zoom = Math.min(ZMAX, Math.max(ZMIN, Math.round(zoom * 100) / 100));
  out.style.zoom = effZoom();
  /* Angezeigt wird der EFFEKTIVE Wert — die Anzeige soll beschreiben, was man
     sieht. Auf Mobil steht dort also 75 %, und das erklärt die Verkleinerung,
     statt sie als „100 %" zu behaupten. */
  document.getElementById('zoomReset').textContent = Math.round(effZoom() * 100) + ' %';
  resetZoomCollapseTimeout();
  saveUI();
}
document.getElementById('zoomIn').addEventListener('click', () => { zoom += ZSTEP; applyZoom(); });
document.getElementById('zoomOut').addEventListener('click', () => { zoom -= ZSTEP; applyZoom(); });
document.getElementById('zoomReset').addEventListener('click', () => { zoom = 1; applyZoom(); });
document.querySelector('.zoomctl').addEventListener('click', (e) => {
  if(e.target.closest('#zoomToggle')) resetZoomCollapseTimeout();
});
diagramEl.addEventListener('wheel', e => {
  if(!(e.ctrlKey || e.metaKey)) return;   /* Strg/Cmd + Mausrad zoomt */
  e.preventDefault();
  zoom += (e.deltaY < 0 ? ZSTEP : -ZSTEP);
  applyZoom();
}, {passive:false});
resetZoomCollapseTimeout();  /* Initialer Timeout beim Laden */

const showc = document.getElementById('showc');
function discardedShown(){ return showc.getAttribute('aria-pressed') === 'true'; }
function setDiscarded(on){ showc.setAttribute('aria-pressed', on ? 'true' : 'false'); }
showc.addEventListener('click', () => { setDiscarded(!discardedShown()); render(); saveUI(); });

/* Günstigster-Pfad-Hervorhebung an/aus */
const cheapBtn = document.getElementById('cheapBtn');
cheapBtn.addEventListener('click', () => {
  cheapPathOn = !cheapPathOn;
  cheapBtn.setAttribute('aria-pressed', cheapPathOn ? 'true' : 'false');
  render();
  saveUI();
});

/* ---------- In die Zwischenablage kopieren ---------- */
async function writeClipboard(text){
  try{ await navigator.clipboard.writeText(text); return; }catch(_){}
  const ta = document.createElement('textarea');       /* Fallback ohne Clipboard-API */
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); }catch(_){}
  document.body.removeChild(ta);
}
function flashCopied(btn, restoreTitleKey){
  btn.classList.add('done');
  btn.title = t('copyDone');
  btn.setAttribute('aria-label', t('copyDone'));
  setTimeout(() => {
    btn.classList.remove('done');
    btn.title = t(restoreTitleKey);
    btn.setAttribute('aria-label', t(restoreTitleKey));
  }, 1500);
}
document.getElementById('copy').addEventListener('click', async () => {
  await writeClipboard(src.value);
  flashCopied(document.getElementById('copy'), 'copyTooltip');
});
document.getElementById('copyDiagram').addEventListener('click', async () => {
  await copyDiagramImage();
  flashCopied(document.getElementById('copyDiagram'), 'copyDiagramTooltip');
});
function flashBtn(btn){   /* kurzer Petrol-Blitz als Rückmeldung, Tooltip bleibt */
  btn.classList.add('done');
  setTimeout(() => btn.classList.remove('done'), 1500);
}
document.getElementById('dlDiagram').addEventListener('click', () => {
  downloadDiagramSvg();
  flashBtn(document.getElementById('dlDiagram'));
  closeDlMenu();
});
document.getElementById('dlDiagramPng').addEventListener('click', async () => {
  closeDlMenu();
  await downloadDiagramPng();
  flashBtn(document.getElementById('dlDiagramPng'));
});

/* Download-Menü (nur Mobil): Trigger klappt SVG/PNG als Overlay auf; Auswahl
   oder Tipp außerhalb schließt wieder. Auf Desktop ist der Trigger versteckt. */
const dlGroup = document.getElementById('dlGroup');
const dlTrigger = document.getElementById('dlTrigger');
function closeDlMenu(){
  dlGroup.classList.remove('open');
  dlTrigger.setAttribute('aria-expanded', 'false');
}
dlTrigger.addEventListener('click', () => {
  const open = dlGroup.classList.toggle('open');
  dlTrigger.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', e => {
  if(dlGroup.classList.contains('open') && !dlGroup.contains(e.target)) closeDlMenu();
});

/* ---------- Internationalisierung (DE/EN/ES/FR) ---------- */
const I18N = {
  de: {
    subtitle:"Werkbaum – PSP / Lean Pathfinding · Editor für Projektstrukturpläne (auch Feature-Tree- & Requirements-Editor)",
    subtitleShort:"PSP-Editor mit Lean Pathfinding",
    imprint:"Impressum",
    privacy:"Datenschutz",
    legendTooltip:"Legende ein-/ausblenden",
    paneToText:"Zum Text wechseln",
    paneToDiagram:"Zum Diagramm wechseln",
    ghostTooltip:"Ab Größe M sollte ein Element weiter untergliedert werden.",
    jumpHint:"Alt+Klick: zur Zeile im Text",
    padReadonly:"Wird im Pad bearbeitet — hier nur lesen.",
    padEdit:"Pad zum Bearbeiten öffnen",
    padRefresh:"Vom Pad neu laden",
    padWait:"Noch {seconds} s — Etherpad begrenzt die Abrufe",
    padRateLimitWarn:"Noch nicht neu geladen: Etherpad erlaubt nur wenige Abrufe je Zeitfenster (serienmäßig 10 pro 90 s), so häufiges Nachladen ist leider nicht möglich. In {seconds} s geht es wieder.",
    padViewTooltip:"Ansicht: {state} — klicken zum Wechseln",
    padView_both:"Pad und Text",
    padView_pad:"nur Pad",
    padView_text:"nur Text",
    padGutterAria:"Pad und Texteditor größenverändern",
    riskTooltip:"High Risk – Aufwand noch unklar.",
    discardedTooltip:"Verworfene Knoten samt Teilbaum ein-/ausblenden",
    cheapTooltip:"Günstigsten Pfad hervorheben – nicht benötigte Alternativen treten zurück",
    implicitSizeTooltip:"Keine Größe angegeben – für die Kostenschätzung als M angenommen",
    fullscreenTooltip:"Vollbild – Panels nutzen die ganze Fensterbreite",
    brandTooltip:"„Werkbaum“ bedeutet so viel wie ‚Werk-Baum‘ — der Baum des Projektstrukturplans (WBS).",
    editorTitle:"Struktur (Text)", diagramTitle:"Diagramm",
    docSwitchTooltip:"Dokument wählen oder verwalten", docMenuAria:"Dokumente",
    docNew:"Neues Dokument", docRename:"Umbenennen", docDelete:"Löschen",
    docNewName:"Unbenannt",
    docDeleteConfirm:"Dokument „{name}“ löschen?",
    docRestore:"Original wiederherstellen",
    docRestoreConfirm:"„{name}“ auf den mitgelieferten Stand zurücksetzen? Eigene Änderungen gehen verloren.",
    copy:"kopieren", copyDone:"kopiert ✓", copyTooltip:"Text in die Zwischenablage kopieren",
    copyDiagramTooltip:"Diagramm als PNG-Bild in die Zwischenablage kopieren",
    downloadDiagramTooltip:"Diagramm als SVG-Datei herunterladen (z. B. für LibreOffice: Einfügen → Bild)",
    downloadPngTooltip:"Diagramm als PNG-Datei herunterladen (Rasterbild, überall einfügbar)",
    downloadMenu:"Diagramm herunterladen (SVG/PNG)",
    minimize:"minimieren", normal:"normal", maximize:"maximieren",
    agenda:"Agenda", discarded:"verworfene",
    gutterTooltip:"Ziehen zum Verschieben, Doppelklick setzt zurück", gutterAria:"Bereiche größenverändern",
    hintGutterAria:"Editor und Legende größenverändern",
    freshTooltip:"Neu in Produktion seit dem letzten Ansehen: {n}. Klicken markiert sie als gesehen.",
    modeHorizontal:"Horizontal – Organigramm, Diagramm über dem Editor",
    modeKompakt:"Kompakt – alles nach unten, platzsparend",
    modeVertikal:"Vertikal – Baum nach rechts, Diagramm neben dem Editor",
    zoomOut:"verkleinern", zoomReset:"zurücksetzen", zoomIn:"vergrößern",
    zoomAria:"Zoom (Strg/Cmd + Mausrad)", langMore:"weitere Sprachen",
    empty:"Noch keine Struktur — einfach lostippen.", ghost:"…",
    mixedWarn:"Zeile {line}: Unter „{label}“ sind - und | gemischt — dargestellt nach dem ersten Kind.",
    xorConflictWarn:"Zeile {line}: „{label}“ ist eine weitere realisierte Alternative — eine =-Gruppe erlaubt genau eine.",
    duplicateIdWarn:"Zeile {line}: Die ID #{id} ist schon vergeben (Zeile {firstLine}).",
    unknownDepWarn:"Zeile {line}: Abhängigkeit #{id} — es gibt keinen Knoten mit dieser ID.",
    unknownDescWarn:"Zeile {line}: Beschreibung für #{id} — es gibt keinen Knoten mit dieser ID.",
    descStrayWarn:"Zeile {line}: Beschreibungszeile ohne Bezug — ihr fehlt der Knoten bzw. der #id-Block davor.",
    cheapApproxWarn:"Zu viele gekoppelte Alternativgruppen für die exakte Suche — der günstigste Pfad ist gierig geschätzt (je Gruppe lokal gewählt).",
    st_idee:"Idee", st_geplant:"geplant", st_arbeit:"in Arbeit", st_durchstich:"Durchstich",
    st_fertig:"fertig", st_prod:"in Produktion", st_highrisk:"High Risk", st_verworfen:"verworfen",
    unknownStatusWarn:"Zeile {line}: unbekanntes Statuszeichen „{code}“ — als neutral dargestellt.",
    sourceLoadWarn:"„{url}“ konnte nicht geladen werden ({error}). Die Datei muss per http(s) erreichbar sein und CORS erlauben (Access-Control-Allow-Origin).",
    sourceTimeoutWarn:"„{url}“ hat innerhalb von {seconds} s nicht geantwortet — der Abruf wurde abgebrochen. Etherpad begrenzt, wie oft der Export geholt werden darf (serienmäßig 10-mal pro 90 s); warte einen Moment und lade dann erneut.",
    a11yStatus:"Status: {status}", a11ySize:"Aufwand: {size}", a11ySizeImplicit:"Aufwand: M (angenommen)", a11yTags:"Zuständig: {names}", a11yId:"ID: #{id}", a11yDeps:"hängt ab von: {ids}", a11yFolded:"eingeklappt, {n} verborgen", a11yEffective:"effektiv: {status}", heldTooltip:"effektiv {eff} — selbst schon {own}, wartet auf Abhängigkeiten", a11yOptional:"optional", a11yFocusMark:"hierhin schauen", a11yLink:"verlinkt",
    hint_indent:"Einrückung (2 Leerzeichen oder Tab) definiert die Hierarchie.",
    hint_all:"Teilpaket, alle erforderlich", hint_any:"Alternative, eine wählen",
    hint_xor:"Alternative, genau eine",
    hint_opt:"Zugabe, nicht erforderlich",
    hint_focus:"hierhin schauen (gemeinsamer Zeigefinger)",
    hint_root:"Zeile ohne Zeichen = Wurzelknoten. |, = und - / + nicht mischen.",
    hint_status:"Status als Kästchen nach dem Zeichen, z. B.",
    hint_size:"Aufwand als T-Shirt-Größe in Klammern, Link einfach als URL anhängen:",
    hint_break:"Ab (M) gilt: weiter untergliedern — fehlt die Untergliederung, erscheint ein Platzhalter im Diagramm.",
    hint_comment:"Kommentare mit %% — als ganze Zeile oder am Zeilenende.",
    hint_people:"Personen mit @name — erscheinen unten rechts am Knoten.",
    hint_id:"Knoten-ID mit #name: vor dem Titel — erscheint im Tooltip des Knotens.",
    hint_deps:"Abhängigkeiten mit :#name,#name — erscheinen im Tooltip.",
    hint_eff:"Die Knotenfarbe zeigt den effektiven Status (mit Abhängigkeiten); ist der eigene weiter, steht er als Marke unten links.",
    hint_desc:"Beschreibungen: \" Zeile unter dem Knoten; Langtext hinter --- als eingerückter #id-Block — beides im Tooltip (”).",
    hint_fold:"Falten: - > [x] … startet eingeklappt, < holt hervor; ▾/▸ am Knoten klappt um (Tastatur: ←/→).",
    hint_jump:"Alt+Klick auf einen Knoten (mobil: langer Druck) springt zur zugehörigen Textzeile; Alt+Klick im Text holt den Knoten ins Bild."
  },
  en: {
    subtitle:"Werkbaum – Work Breakdown Structure / Lean Pathfinding · Project structure editor (also feature-tree & requirements)",
    subtitleShort:"WBS editor with Lean Pathfinding",
    imprint:"Imprint (Impressum)",
    privacy:"Privacy",
    legendTooltip:"Show/hide legend",
    paneToText:"Switch to the text",
    paneToDiagram:"Switch to the diagram",
    ghostTooltip:"From size M upward, an item should be broken down further.",
    jumpHint:"Alt+click: jump to the line in the text",
    padReadonly:"Edited in the pad — read-only here.",
    padEdit:"Open the pad to edit",
    padRefresh:"Reload from the pad",
    padWait:"{seconds} s to go — Etherpad limits how often we may fetch",
    padRateLimitWarn:"Not reloaded yet: Etherpad only allows a few fetches per time window (10 per 90 s by default), so syncing this often is unfortunately not possible. Try again in {seconds} s.",
    padViewTooltip:"View: {state} — click to switch",
    padView_both:"pad and text",
    padView_pad:"pad only",
    padView_text:"text only",
    padGutterAria:"Resize pad and text editor",
    riskTooltip:"High risk – effort still unclear.",
    discardedTooltip:"Show/hide discarded nodes and their subtree",
    cheapTooltip:"Highlight the cheapest path – unneeded alternatives recede",
    implicitSizeTooltip:"No size given – assumed as M for the cost estimate",
    fullscreenTooltip:"Full screen – panels use the full window width",
    brandTooltip:"“Werkbaum” means roughly ‘work tree’ — the tree of the work breakdown structure (WBS).",
    editorTitle:"Structure (text)", diagramTitle:"Diagram",
    docSwitchTooltip:"Choose or manage document", docMenuAria:"Documents",
    docNew:"New document", docRename:"Rename", docDelete:"Delete",
    docNewName:"Untitled",
    docDeleteConfirm:"Delete document “{name}”?",
    docRestore:"Restore original",
    docRestoreConfirm:"Reset “{name}” to the shipped version? Your changes will be lost.",
    copy:"copy", copyDone:"copied ✓", copyTooltip:"Copy text to clipboard",
    copyDiagramTooltip:"Copy diagram as a PNG image to the clipboard",
    downloadDiagramTooltip:"Download diagram as an SVG file (e.g. for LibreOffice: Insert → Image)",
    downloadPngTooltip:"Download diagram as a PNG file (raster image, insertable anywhere)",
    downloadMenu:"Download diagram (SVG/PNG)",
    minimize:"minimize", normal:"normal", maximize:"maximize",
    agenda:"Legend", discarded:"discarded",
    gutterTooltip:"Drag to resize, double-click resets", gutterAria:"Resize the areas",
    hintGutterAria:"Resize editor and legend",
    freshTooltip:"New in production since you last looked: {n}. Click to mark them as seen.",
    modeHorizontal:"Horizontal – org chart, diagram above the editor",
    modeKompakt:"Compact – everything downward, space-saving",
    modeVertikal:"Vertical – tree to the right, diagram beside the editor",
    zoomOut:"zoom out", zoomReset:"reset", zoomIn:"zoom in",
    zoomAria:"Zoom (Ctrl/Cmd + mouse wheel)", langMore:"more languages",
    empty:"No structure yet — just start typing.", ghost:"…",
    mixedWarn:"Line {line}: under “{label}”, - and | are mixed — rendered by the first child.",
    xorConflictWarn:"Line {line}: “{label}” is another realized alternative — an = group allows exactly one.",
    duplicateIdWarn:"Line {line}: ID #{id} is already taken (line {firstLine}).",
    unknownDepWarn:"Line {line}: dependency #{id} — no node has this ID.",
    unknownDescWarn:"Line {line}: description for #{id} — no node has this ID.",
    descStrayWarn:"Line {line}: description line with nothing to attach to — it needs a node or an #id block before it.",
    cheapApproxWarn:"Too many coupled alternative groups for the exact search — the cheapest path is a greedy estimate (chosen locally per group).",
    st_idee:"idea", st_geplant:"planned", st_arbeit:"in progress", st_durchstich:"walking skeleton",
    st_fertig:"done", st_prod:"in production", st_highrisk:"high risk", st_verworfen:"discarded",
    unknownStatusWarn:"Line {line}: unknown status code “{code}” — shown as neutral.",
    sourceLoadWarn:"Could not load “{url}” ({error}). The file must be reachable via http(s) and allow CORS (Access-Control-Allow-Origin).",
    sourceTimeoutWarn:"“{url}” did not answer within {seconds} s — the request was aborted. Etherpad limits how often the export may be fetched (10 times per 90 s by default); wait a moment, then reload.",
    a11yStatus:"Status: {status}", a11ySize:"Effort: {size}", a11ySizeImplicit:"Effort: M (assumed)", a11yTags:"Assigned: {names}", a11yId:"ID: #{id}", a11yDeps:"depends on: {ids}", a11yFolded:"collapsed, {n} hidden", a11yEffective:"effective: {status}", heldTooltip:"effectively {eff} — itself already {own}, waiting on dependencies", a11yOptional:"optional", a11yFocusMark:"look here", a11yLink:"has link",
    hint_indent:"Indentation (2 spaces or a tab) defines the hierarchy.",
    hint_all:"sub-task, all required", hint_any:"alternative, choose one",
    hint_xor:"alternative, exactly one",
    hint_opt:"extra, not required",
    hint_focus:"look here (a shared pointer)",
    hint_root:"Line without a marker = root node. Do not mix |, = and - / +.",
    hint_status:"Status as a checkbox after the marker, e.g.",
    hint_size:"Effort as a T-shirt size in parentheses; add a link simply as a URL:",
    hint_break:"From (M) on: break it down further — if the breakdown is missing, a placeholder appears in the diagram.",
    hint_comment:"Comments with %% — whole line or at the end of a line.",
    hint_people:"People with @name — shown at the bottom-right of the node.",
    hint_id:"Node ID with #name: before the title — shown in the node's tooltip.",
    hint_deps:"Dependencies with :#name,#name — shown in the tooltip.",
    hint_eff:"Node colour shows the effective status (with dependencies); if its own is further along, it appears as a mark at the bottom left.",
    hint_desc:"Descriptions: a \" line below the node; long text behind --- as an indented #id block — both in the tooltip (”).",
    hint_fold:"Folding: - > [x] … starts collapsed, < brings it back; ▾/▸ on a node toggles (keyboard: ←/→).",
    hint_jump:"Alt+click a node (long press on touch) jumps to its line in the text; Alt+click in the text brings the node into view."
  },
  es: {
    subtitle:"Werkbaum – EDT / Lean Pathfinding · Editor de estructura de proyectos (también árboles de características y requisitos)",
    subtitleShort:"Editor EDT con Lean Pathfinding",
    imprint:"Aviso legal (Impressum)",
    privacy:"Privacidad",
    legendTooltip:"Mostrar u ocultar la leyenda",
    paneToText:"Cambiar al texto",
    paneToDiagram:"Cambiar al diagrama",
    ghostTooltip:"A partir de la talla M, un elemento debería desglosarse más.",
    jumpHint:"Alt+clic: ir a la línea en el texto",
    padReadonly:"Se edita en el pad — aquí solo lectura.",
    padEdit:"Abrir el pad para editar",
    padRefresh:"Recargar desde el pad",
    padWait:"Faltan {seconds} s — Etherpad limita la frecuencia",
    padRateLimitWarn:"Aún no se ha recargado: Etherpad solo permite unas pocas descargas por ventana de tiempo (10 por 90 s de forma predeterminada), así que sincronizar tan a menudo no es posible. Vuelve a intentarlo en {seconds} s.",
    padViewTooltip:"Vista: {state} — clic para cambiar",
    padView_both:"pad y texto",
    padView_pad:"solo pad",
    padView_text:"solo texto",
    padGutterAria:"Redimensionar pad y editor de texto",
    riskTooltip:"Alto riesgo – esfuerzo aún incierto.",
    discardedTooltip:"Mostrar u ocultar los nodos descartados y su subárbol",
    cheapTooltip:"Resaltar la ruta más económica: las alternativas no necesarias se atenúan",
    implicitSizeTooltip:"Sin tamaño indicado: se asume M para el cálculo de costes",
    fullscreenTooltip:"Pantalla completa – los paneles usan todo el ancho de la ventana",
    brandTooltip:"«Werkbaum» significa algo así como ‘árbol de trabajo’ — el árbol de la estructura de desglose del trabajo (EDT).",
    editorTitle:"Estructura (texto)", diagramTitle:"Diagrama",
    docSwitchTooltip:"Elegir o gestionar documento", docMenuAria:"Documentos",
    docNew:"Nuevo documento", docRename:"Renombrar", docDelete:"Eliminar",
    docNewName:"Sin título",
    docDeleteConfirm:"¿Eliminar el documento «{name}»?",
    docRestore:"Restaurar original",
    docRestoreConfirm:"¿Restablecer «{name}» a la versión incluida? Tus cambios se perderán.",
    copy:"copiar", copyDone:"copiado ✓", copyTooltip:"Copiar el texto al portapapeles",
    copyDiagramTooltip:"Copiar el diagrama como imagen PNG al portapapeles",
    downloadDiagramTooltip:"Descargar el diagrama como archivo SVG (p. ej. para LibreOffice: Insertar → Imagen)",
    downloadPngTooltip:"Descargar el diagrama como archivo PNG (imagen de trama, insertable en cualquier lugar)",
    downloadMenu:"Descargar el diagrama (SVG/PNG)",
    minimize:"minimizar", normal:"normal", maximize:"maximizar",
    agenda:"Leyenda", discarded:"descartados",
    gutterTooltip:"Arrastra para redimensionar, doble clic restablece", gutterAria:"Redimensionar las áreas",
    hintGutterAria:"Redimensionar editor y leyenda",
    freshTooltip:"Nuevo en producción desde la última vez: {n}. Haz clic para marcarlo como visto.",
    modeHorizontal:"Horizontal – organigrama, diagrama sobre el editor",
    modeKompakt:"Compacto – todo hacia abajo, ahorra espacio",
    modeVertikal:"Vertical – árbol hacia la derecha, diagrama junto al editor",
    zoomOut:"alejar", zoomReset:"restablecer", zoomIn:"acercar",
    zoomAria:"Zoom (Ctrl/Cmd + rueda del ratón)", langMore:"más idiomas",
    empty:"Aún no hay estructura — simplemente empieza a escribir.", ghost:"…",
    mixedWarn:"Línea {line}: bajo «{label}» se mezclan - y | — se representa según el primer hijo.",
    xorConflictWarn:"Línea {line}: «{label}» es otra alternativa realizada — un grupo = permite exactamente una.",
    duplicateIdWarn:"Línea {line}: la ID #{id} ya está asignada (línea {firstLine}).",
    unknownDepWarn:"Línea {line}: dependencia #{id} — ningún nodo tiene esta ID.",
    unknownDescWarn:"Línea {line}: descripción para #{id} — ningún nodo tiene esta ID.",
    descStrayWarn:"Línea {line}: línea de descripción sin referencia — le falta un nodo o un bloque #id delante.",
    cheapApproxWarn:"Demasiados grupos de alternativas acoplados para la búsqueda exacta — el camino más barato es una estimación voraz (elección local por grupo).",
    st_idee:"idea", st_geplant:"planificado", st_arbeit:"en curso", st_durchstich:"prototipo funcional",
    st_fertig:"terminado", st_prod:"en producción", st_highrisk:"alto riesgo", st_verworfen:"descartado",
    unknownStatusWarn:"Línea {line}: código de estado desconocido «{code}» — mostrado como neutral.",
    sourceLoadWarn:"No se pudo cargar «{url}» ({error}). El archivo debe ser accesible por http(s) y permitir CORS (Access-Control-Allow-Origin).",
    sourceTimeoutWarn:"«{url}» no respondió en {seconds} s — se canceló la petición. Etherpad limita la frecuencia de descarga del export (10 veces por 90 s de forma predeterminada); espera un momento y vuelve a cargar.",
    a11yStatus:"Estado: {status}", a11ySize:"Esfuerzo: {size}", a11ySizeImplicit:"Esfuerzo: M (asumido)", a11yTags:"Responsable: {names}", a11yId:"ID: #{id}", a11yDeps:"depende de: {ids}", a11yFolded:"plegado, {n} ocultos", a11yEffective:"efectivo: {status}", heldTooltip:"efectivamente {eff} — por sí mismo ya {own}, espera dependencias", a11yOptional:"opcional", a11yFocusMark:"mirar aquí", a11yLink:"con enlace",
    hint_indent:"La sangría (2 espacios o un tabulador) define la jerarquía.",
    hint_all:"subtarea, todas obligatorias", hint_any:"alternativa, elige una",
    hint_xor:"alternativa, exactamente una",
    hint_opt:"extra, no obligatorio",
    hint_focus:"mirar aquí (un puntero compartido)",
    hint_root:"Línea sin marcador = nodo raíz. No mezcles |, = y - / +.",
    hint_status:"Estado como casilla tras el marcador, p. ej.",
    hint_size:"Esfuerzo como talla de camiseta entre paréntesis; añade un enlace simplemente como URL:",
    hint_break:"A partir de (M): sigue desglosando — si falta el desglose, aparece un marcador de posición en el diagrama.",
    hint_comment:"Comentarios con %% — línea completa o al final de la línea.",
    hint_people:"Personas con @nombre — aparecen abajo a la derecha del nodo.",
    hint_id:"ID de nodo con #nombre: delante del título — visible en el tooltip del nodo.",
    hint_deps:"Dependencias con :#nombre,#nombre — visibles en el tooltip.",
    hint_eff:"El color del nodo muestra el estado efectivo (con dependencias); si el propio va más adelante, aparece como marca abajo a la izquierda.",
    hint_desc:"Descripciones: línea \" bajo el nodo; texto largo tras --- como bloque #id sangrado — ambos en el tooltip (”).",
    hint_fold:"Plegado: - > [x] … empieza plegado, < lo recupera; ▾/▸ en el nodo alterna (teclado: ←/→).",
    hint_jump:"Alt+clic en un nodo (pulsación larga en táctil) salta a su línea en el texto; Alt+clic en el texto trae el nodo a la vista."
  },
  fr: {
    subtitle:"Werkbaum – WBS / Lean Pathfinding · Éditeur de structure de projet (aussi pour arbres de fonctionnalités et d'exigences)",
    subtitleShort:"Éditeur WBS avec Lean Pathfinding",
    imprint:"Mentions légales (Impressum)",
    privacy:"Confidentialité",
    legendTooltip:"Afficher/masquer la légende",
    paneToText:"Passer au texte",
    paneToDiagram:"Passer au diagramme",
    ghostTooltip:"À partir de la taille M, un élément devrait être décomposé davantage.",
    jumpHint:"Alt+clic : aller à la ligne dans le texte",
    padReadonly:"Modifié dans le pad — lecture seule ici.",
    padEdit:"Ouvrir le pad pour modifier",
    padRefresh:"Recharger depuis le pad",
    padWait:"Encore {seconds} s — Etherpad limite la fréquence",
    padRateLimitWarn:"Pas encore rechargé : Etherpad n’autorise que quelques récupérations par fenêtre de temps (10 par 90 s par défaut), une synchronisation aussi fréquente n’est donc pas possible. Réessaie dans {seconds} s.",
    padViewTooltip:"Vue : {state} — cliquer pour changer",
    padView_both:"pad et texte",
    padView_pad:"pad seul",
    padView_text:"texte seul",
    padGutterAria:"Redimensionner le pad et l’éditeur de texte",
    riskTooltip:"Risque élevé – effort encore incertain.",
    discardedTooltip:"Afficher/masquer les nœuds abandonnés et leur sous-arbre",
    cheapTooltip:"Mettre en évidence le chemin le moins coûteux – les alternatives inutiles s'estompent",
    implicitSizeTooltip:"Aucune taille indiquée – considérée comme M pour l'estimation des coûts",
    fullscreenTooltip:"Plein écran – les panneaux occupent toute la largeur de la fenêtre",
    brandTooltip:"« Werkbaum » signifie à peu près « arbre de travail » — l’arbre de l’organigramme des tâches (WBS).",
    editorTitle:"Structure (texte)", diagramTitle:"Diagramme",
    docSwitchTooltip:"Choisir ou gérer le document", docMenuAria:"Documents",
    docNew:"Nouveau document", docRename:"Renommer", docDelete:"Supprimer",
    docNewName:"Sans titre",
    docDeleteConfirm:"Supprimer le document « {name} » ?",
    docRestore:"Restaurer l’original",
    docRestoreConfirm:"Réinitialiser « {name} » à la version livrée ? Vos modifications seront perdues.",
    copy:"copier", copyDone:"copié ✓", copyTooltip:"Copier le texte dans le presse-papiers",
    copyDiagramTooltip:"Copier le diagramme comme image PNG dans le presse-papiers",
    downloadDiagramTooltip:"Télécharger le diagramme en fichier SVG (p. ex. pour LibreOffice : Insertion → Image)",
    downloadPngTooltip:"Télécharger le diagramme en fichier PNG (image matricielle, insérable partout)",
    downloadMenu:"Télécharger le diagramme (SVG/PNG)",
    minimize:"réduire", normal:"normal", maximize:"agrandir",
    agenda:"Légende", discarded:"abandonnés",
    gutterTooltip:"Glisser pour redimensionner, double-clic pour réinitialiser", gutterAria:"Redimensionner les zones",
    hintGutterAria:"Redimensionner l'éditeur et la légende",
    freshTooltip:"Nouveau en production depuis votre dernière visite : {n}. Cliquez pour marquer comme vu.",
    modeHorizontal:"Horizontal – organigramme, diagramme au-dessus de l'éditeur",
    modeKompakt:"Compact – tout vers le bas, gain de place",
    modeVertikal:"Vertical – arbre vers la droite, diagramme à côté de l'éditeur",
    zoomOut:"dézoomer", zoomReset:"réinitialiser", zoomIn:"zoomer",
    zoomAria:"Zoom (Ctrl/Cmd + molette)", langMore:"plus de langues",
    empty:"Pas encore de structure — commencez à taper.", ghost:"…",
    mixedWarn:"Ligne {line} : sous « {label} », - et | sont mélangés — rendu selon le premier enfant.",
    xorConflictWarn:"Ligne {line} : « {label} » est une alternative réalisée de plus — un groupe = n’en autorise qu’une seule.",
    duplicateIdWarn:"Ligne {line} : l’ID #{id} est déjà attribué (ligne {firstLine}).",
    unknownDepWarn:"Ligne {line} : dépendance #{id} — aucun nœud ne porte cet ID.",
    unknownDescWarn:"Ligne {line} : description pour #{id} — aucun nœud ne porte cet ID.",
    descStrayWarn:"Ligne {line} : ligne de description sans rattachement — il lui manque un nœud ou un bloc #id avant.",
    cheapApproxWarn:"Trop de groupes d’alternatives couplés pour la recherche exacte — le chemin le moins cher est une estimation gloutonne (choix local par groupe).",
    st_idee:"idée", st_geplant:"planifié", st_arbeit:"en cours", st_durchstich:"squelette fonctionnel",
    st_fertig:"terminé", st_prod:"en production", st_highrisk:"risque élevé", st_verworfen:"abandonné",
    unknownStatusWarn:"Ligne {line} : code de statut inconnu « {code} » — affiché comme neutre.",
    sourceLoadWarn:"Impossible de charger « {url} » ({error}). Le fichier doit être accessible en http(s) et autoriser CORS (Access-Control-Allow-Origin).",
    sourceTimeoutWarn:"« {url} » n’a pas répondu en {seconds} s — la requête a été interrompue. Etherpad limite la fréquence de récupération de l’export (10 fois par 90 s par défaut) ; attends un instant, puis recharge.",
    a11yStatus:"Statut : {status}", a11ySize:"Effort : {size}", a11ySizeImplicit:"Effort : M (supposé)", a11yTags:"Responsable : {names}", a11yId:"ID : #{id}", a11yDeps:"dépend de : {ids}", a11yFolded:"replié, {n} masqués", a11yEffective:"effectif : {status}", heldTooltip:"effectivement {eff} — lui-même déjà {own}, en attente de dépendances", a11yOptional:"facultatif", a11yFocusMark:"regarder ici", a11yLink:"avec lien",
    hint_indent:"L'indentation (2 espaces ou une tabulation) définit la hiérarchie.",
    hint_all:"sous-tâche, toutes requises", hint_any:"alternative, en choisir une",
    hint_xor:"alternative, exactement une",
    hint_opt:"supplément, non requis",
    hint_focus:"regarder ici (un pointeur partagé)",
    hint_root:"Ligne sans marqueur = nœud racine. Ne mélangez pas |, = et - / +.",
    hint_status:"Statut sous forme de case après le marqueur, p. ex.",
    hint_size:"Effort en taille de T-shirt entre parenthèses ; ajoutez un lien simplement comme URL :",
    hint_break:"À partir de (M) : décomposer davantage — si la décomposition manque, un espace réservé apparaît dans le diagramme.",
    hint_comment:"Commentaires avec %% — ligne entière ou en fin de ligne.",
    hint_people:"Personnes avec @nom — affichées en bas à droite du nœud.",
    hint_id:"ID de nœud avec #nom : devant le titre — visible dans l’infobulle du nœud.",
    hint_deps:"Dépendances avec :#nom,#nom — visibles dans l’infobulle.",
    hint_eff:"La couleur du nœud montre le statut effectif (avec dépendances) ; si le sien est plus avancé, il apparaît en marque en bas à gauche.",
    hint_desc:"Descriptions : ligne \" sous le nœud ; texte long après --- en bloc #id indenté — les deux dans l’infobulle (”).",
    hint_fold:"Pliage : - > [x] … démarre replié, < le fait ressortir ; ▾/▸ sur le nœud bascule (clavier : ←/→).",
    hint_jump:"Alt+clic sur un nœud (appui long sur tactile) saute à sa ligne dans le texte ; Alt+clic dans le texte amène le nœud à l’écran."
  },
  pl: {
    subtitle:"Werkbaum – WBS / Lean Pathfinding · Edytor struktury projektów (również dla drzew funkcji i wymagań)",
    subtitleShort:"Edytor WBS z Lean Pathfinding",
    imprint:"Nota prawna (Impressum)",
    privacy:"Prywatność",
    legendTooltip:"Pokaż/ukryj legendę",
    paneToText:"Przełącz na tekst",
    paneToDiagram:"Przełącz na diagram",
    ghostTooltip:"Od rozmiaru M element powinien być dalej podzielony.",
    jumpHint:"Alt+kliknięcie: przejdź do wiersza w tekście",
    padReadonly:"Edytowane w padzie — tu tylko do czytania.",
    padEdit:"Otwórz pad do edycji",
    padRefresh:"Wczytaj ponownie z padu",
    padWait:"Jeszcze {seconds} s — Etherpad ogranicza częstość",
    padRateLimitWarn:"Jeszcze nie wczytano ponownie: Etherpad dopuszcza tylko kilka pobrań w okresie (domyślnie 10 na 90 s), więc tak częsta synchronizacja nie jest możliwa. Spróbuj za {seconds} s.",
    padViewTooltip:"Widok: {state} — kliknij, aby zmienić",
    padView_both:"pad i tekst",
    padView_pad:"tylko pad",
    padView_text:"tylko tekst",
    padGutterAria:"Zmień rozmiar padu i edytora tekstu",
    riskTooltip:"Wysokie ryzyko – nakład jeszcze niejasny.",
    discardedTooltip:"Pokaż/ukryj odrzucone węzły wraz z poddrzewem",
    cheapTooltip:"Wyróżnij najtańszą ścieżkę – niepotrzebne alternatywy są przygaszone",
    implicitSizeTooltip:"Nie podano rozmiaru – przyjęto M do szacowania kosztów",
    fullscreenTooltip:"Pełny ekran – panele wykorzystują całą szerokość okna",
    brandTooltip:"„Werkbaum” znaczy mniej więcej ‚drzewo pracy’ — drzewo struktury podziału pracy (WBS).",
    editorTitle:"Struktura (tekst)", diagramTitle:"Diagram",
    docSwitchTooltip:"Wybierz lub zarządzaj dokumentem", docMenuAria:"Dokumenty",
    docNew:"Nowy dokument", docRename:"Zmień nazwę", docDelete:"Usuń",
    docNewName:"Bez nazwy",
    docDeleteConfirm:"Usunąć dokument „{name}”?",
    docRestore:"Przywróć oryginał",
    docRestoreConfirm:"Przywrócić „{name}” do dostarczonej wersji? Twoje zmiany zostaną utracone.",
    copy:"kopiuj", copyDone:"skopiowano ✓", copyTooltip:"Kopiuj tekst do schowka",
    copyDiagramTooltip:"Kopiuj diagram jako obraz PNG do schowka",
    downloadDiagramTooltip:"Pobierz diagram jako plik SVG (np. dla LibreOffice: Wstaw → Obraz)",
    downloadPngTooltip:"Pobierz diagram jako plik PNG (obraz rastrowy, wszędzie do wstawienia)",
    downloadMenu:"Pobierz diagram (SVG/PNG)",
    minimize:"minimalizuj", normal:"normalny", maximize:"maksymalizuj",
    agenda:"Legenda", discarded:"odrzucone",
    gutterTooltip:"Przeciągnij, aby zmienić rozmiar; dwuklik przywraca", gutterAria:"Zmień rozmiar obszarów",
    hintGutterAria:"Zmień rozmiar edytora i legendy",
    freshTooltip:"Nowe na produkcji od ostatniego razu: {n}. Kliknij, aby oznaczyć jako zobaczone.",
    modeHorizontal:"Poziomo – schemat organizacyjny, diagram nad edytorem",
    modeKompakt:"Kompaktowo – wszystko w dół, oszczędza miejsce",
    modeVertikal:"Pionowo – drzewo w prawo, diagram obok edytora",
    zoomOut:"pomniejsz", zoomReset:"resetuj", zoomIn:"powiększ",
    zoomAria:"Powiększenie (Ctrl/Cmd + kółko myszy)", langMore:"więcej języków",
    empty:"Brak struktury — zacznij pisać.", ghost:"…",
    mixedWarn:"Wiersz {line}: pod „{label}” mieszają się - i | — renderowane według pierwszego dziecka.",
    xorConflictWarn:"Wiersz {line}: „{label}” to kolejna zrealizowana alternatywa — grupa = dopuszcza dokładnie jedną.",
    duplicateIdWarn:"Wiersz {line}: ID #{id} jest już zajęte (wiersz {firstLine}).",
    unknownDepWarn:"Wiersz {line}: zależność #{id} — żaden węzeł nie ma tego ID.",
    unknownDescWarn:"Wiersz {line}: opis dla #{id} — żaden węzeł nie ma tego ID.",
    descStrayWarn:"Wiersz {line}: wiersz opisu bez odniesienia — brakuje węzła lub bloku #id przed nim.",
    cheapApproxWarn:"Zbyt wiele sprzężonych grup alternatyw dla dokładnego wyszukiwania — najtańsza ścieżka jest oszacowana zachłannie (wybór lokalny w każdej grupie).",
    st_idee:"pomysł", st_geplant:"zaplanowane", st_arbeit:"w toku", st_durchstich:"działający szkielet",
    st_fertig:"gotowe", st_prod:"w produkcji", st_highrisk:"wysokie ryzyko", st_verworfen:"odrzucone",
    unknownStatusWarn:"Wiersz {line}: nieznany znak statusu „{code}” — pokazany jako neutralny.",
    sourceLoadWarn:"Nie udało się wczytać „{url}” ({error}). Plik musi być dostępny przez http(s) i zezwalać na CORS (Access-Control-Allow-Origin).",
    sourceTimeoutWarn:"„{url}” nie odpowiedział w ciągu {seconds} s — żądanie przerwano. Etherpad ogranicza częstość pobierania eksportu (domyślnie 10 razy na 90 s); odczekaj chwilę i wczytaj ponownie.",
    a11yStatus:"Status: {status}", a11ySize:"Nakład: {size}", a11ySizeImplicit:"Nakład: M (założony)", a11yTags:"Przypisano: {names}", a11yId:"ID: #{id}", a11yDeps:"zależy od: {ids}", a11yFolded:"zwinięte, ukrytych: {n}", a11yEffective:"efektywnie: {status}", heldTooltip:"efektywnie {eff} — sam już {own}, czeka na zależności", a11yOptional:"opcjonalny", a11yFocusMark:"spójrz tutaj", a11yLink:"z linkiem",
    hint_indent:"Wcięcie (2 spacje lub tabulator) definiuje hierarchię.",
    hint_all:"podzadanie, wszystkie wymagane", hint_any:"alternatywa, wybierz jedną",
    hint_xor:"alternatywa, dokładnie jedna",
    hint_opt:"dodatek, niewymagany",
    hint_focus:"spójrz tutaj (wspólny wskaźnik)",
    hint_root:"Wiersz bez znacznika = węzeł główny. Nie mieszaj |, = i - / +.",
    hint_status:"Status jako pole wyboru po znaczniku, np.",
    hint_size:"Nakład jako rozmiar koszulki w nawiasach; link dodaj po prostu jako URL:",
    hint_break:"Od (M): dziel dalej — gdy brakuje podziału, w diagramie pojawia się symbol zastępczy.",
    hint_comment:"Komentarze z %% — cały wiersz lub na końcu wiersza.",
    hint_people:"Osoby z @nazwa — pokazywane w prawym dolnym rogu węzła.",
    hint_id:"ID węzła przez #nazwa: przed tytułem — widoczne w podpowiedzi węzła.",
    hint_deps:"Zależności przez :#nazwa,#nazwa — widoczne w podpowiedzi.",
    hint_eff:"Kolor węzła pokazuje status efektywny (z zależnościami); jeśli własny jest dalej, widnieje jako znacznik u dołu po lewej.",
    hint_desc:"Opisy: wiersz \" pod węzłem; dłuższy tekst za --- jako wcięty blok #id — oba w podpowiedzi (”).",
    hint_fold:"Zwijanie: - > [x] … zaczyna zwinięte, < przywraca; ▾/▸ na węźle przełącza (klawiatura: ←/→).",
    hint_jump:"Alt+kliknięcie węzła (długie naciśnięcie na dotyku) przechodzi do jego wiersza w tekście; Alt+kliknięcie w tekście pokazuje węzeł na diagramie."
  },
  ru: {
    subtitle:"Werkbaum – СДР / Lean Pathfinding · Редактор структуры проектов (также для деревьев функций и требований)",
    subtitleShort:"Редактор СДР с Lean Pathfinding",
    imprint:"Выходные данные (Impressum)",
    privacy:"Конфиденциальность",
    legendTooltip:"Показать/скрыть легенду",
    paneToText:"Перейти к тексту",
    paneToDiagram:"Перейти к диаграмме",
    ghostTooltip:"Начиная с размера M элемент следует далее декомпозировать.",
    jumpHint:"Alt+клик: перейти к строке в тексте",
    padReadonly:"Редактируется в паде — здесь только чтение.",
    padEdit:"Открыть пад для редактирования",
    padRefresh:"Обновить из пада",
    padWait:"Ещё {seconds} с — Etherpad ограничивает частоту",
    padRateLimitWarn:"Пока не обновлено: Etherpad разрешает лишь несколько загрузок за окно времени (по умолчанию 10 за 90 с), поэтому столь частая синхронизация невозможна. Повторите через {seconds} с.",
    padViewTooltip:"Вид: {state} — нажмите для переключения",
    padView_both:"пад и текст",
    padView_pad:"только пад",
    padView_text:"только текст",
    padGutterAria:"Изменить размер пада и текстового редактора",
    riskTooltip:"Высокий риск – оценка ещё не ясна.",
    discardedTooltip:"Показать/скрыть отклонённые узлы вместе с поддеревом",
    cheapTooltip:"Выделить самый дешёвый путь — ненужные альтернативы приглушаются",
    implicitSizeTooltip:"Размер не указан — для оценки затрат принят как M",
    fullscreenTooltip:"Полный экран – панели занимают всю ширину окна",
    brandTooltip:"«Werkbaum» примерно означает ‚дерево работ’ — дерево структуры декомпозиции работ (СДР).",
    editorTitle:"Структура (текст)", diagramTitle:"Диаграмма",
    docSwitchTooltip:"Выбрать документ или управлять им", docMenuAria:"Документы",
    docNew:"Новый документ", docRename:"Переименовать", docDelete:"Удалить",
    docNewName:"Без названия",
    docDeleteConfirm:"Удалить документ «{name}»?",
    docRestore:"Восстановить оригинал",
    docRestoreConfirm:"Вернуть «{name}» к поставляемой версии? Ваши изменения будут потеряны.",
    copy:"копировать", copyDone:"скопировано ✓", copyTooltip:"Скопировать текст в буфер обмена",
    copyDiagramTooltip:"Скопировать диаграмму как изображение PNG в буфер обмена",
    downloadDiagramTooltip:"Скачать диаграмму как файл SVG (напр. для LibreOffice: Вставка → Изображение)",
    downloadPngTooltip:"Скачать диаграмму как файл PNG (растровое изображение, вставляется везде)",
    downloadMenu:"Скачать диаграмму (SVG/PNG)",
    minimize:"свернуть", normal:"обычный", maximize:"развернуть",
    agenda:"Легенда", discarded:"отклонённые",
    gutterTooltip:"Потяните, чтобы изменить размер; двойной щелчок сбрасывает", gutterAria:"Изменить размер областей",
    hintGutterAria:"Изменить размер редактора и легенды",
    freshTooltip:"Новое в продакшене с прошлого раза: {n}. Нажмите, чтобы отметить как просмотренное.",
    modeHorizontal:"Горизонтально – оргсхема, диаграмма над редактором",
    modeKompakt:"Компактно – всё вниз, экономит место",
    modeVertikal:"Вертикально – дерево вправо, диаграмма рядом с редактором",
    zoomOut:"уменьшить", zoomReset:"сбросить", zoomIn:"увеличить",
    zoomAria:"Масштаб (Ctrl/Cmd + колесо мыши)", langMore:"ещё языки",
    empty:"Пока нет структуры — просто начните печатать.", ghost:"…",
    mixedWarn:"Строка {line}: под «{label}» смешаны - и | — отображается по первому потомку.",
    xorConflictWarn:"Строка {line}: «{label}» — ещё одна реализованная альтернатива, а группа = допускает ровно одну.",
    duplicateIdWarn:"Строка {line}: ID #{id} уже занят (строка {firstLine}).",
    unknownDepWarn:"Строка {line}: зависимость #{id} — узла с таким ID нет.",
    unknownDescWarn:"Строка {line}: описание для #{id} — узла с таким ID нет.",
    descStrayWarn:"Строка {line}: строка описания без привязки — перед ней нет узла или блока #id.",
    cheapApproxWarn:"Слишком много связанных групп альтернатив для точного поиска — самый дешёвый путь оценён жадно (локальный выбор в каждой группе).",
    st_idee:"идея", st_geplant:"запланировано", st_arbeit:"в работе", st_durchstich:"сквозной прототип",
    st_fertig:"готово", st_prod:"в эксплуатации", st_highrisk:"высокий риск", st_verworfen:"отклонено",
    unknownStatusWarn:"Строка {line}: неизвестный код статуса «{code}» — показан как нейтральный.",
    sourceLoadWarn:"Не удалось загрузить «{url}» ({error}). Файл должен быть доступен по http(s) и разрешать CORS (Access-Control-Allow-Origin).",
    sourceTimeoutWarn:"«{url}» не ответил за {seconds} с — запрос прерван. Etherpad ограничивает частоту загрузки экспорта (по умолчанию 10 раз за 90 с); подождите немного и обновите снова.",
    a11yStatus:"Статус: {status}", a11ySize:"Оценка: {size}", a11ySizeImplicit:"Оценка: M (предполагается)", a11yTags:"Ответственные: {names}", a11yId:"ID: #{id}", a11yDeps:"зависит от: {ids}", a11yFolded:"свёрнуто, скрыто: {n}", a11yEffective:"фактически: {status}", heldTooltip:"фактически {eff} — сам уже {own}, ждёт зависимости", a11yOptional:"необязательно", a11yFocusMark:"смотрите здесь", a11yLink:"со ссылкой",
    hint_indent:"Отступ (2 пробела или табуляция) задаёт иерархию.",
    hint_all:"подзадача, все обязательны", hint_any:"альтернатива, выберите одну",
    hint_xor:"альтернатива, ровно одна",
    hint_opt:"дополнение, не обязательно",
    hint_focus:"смотрите здесь (общая указка)",
    hint_root:"Строка без маркера = корневой узел. Не смешивайте |, = и - / +.",
    hint_status:"Статус в виде флажка после маркера, напр.",
    hint_size:"Трудоёмкость как размер футболки в скобках; ссылку добавьте просто как URL:",
    hint_break:"С (M): дробите дальше — если декомпозиции нет, в диаграмме появляется заполнитель.",
    hint_comment:"Комментарии через %% — вся строка или в конце строки.",
    hint_people:"Люди через @имя — показываются справа внизу узла.",
    hint_id:"ID узла через #имя: перед заголовком — виден во всплывающей подсказке узла.",
    hint_deps:"Зависимости через :#имя,#имя — видны в подсказке.",
    hint_eff:"Цвет узла показывает фактический статус (с учётом зависимостей); если собственный дальше, он показан меткой слева внизу.",
    hint_desc:"Описания: строка \" под узлом; длинный текст после --- как блок #id с отступом — оба в подсказке (”).",
    hint_fold:"Сворачивание: - > [x] … открывается свёрнутым, < возвращает; ▾/▸ на узле переключает (клавиши: ←/→).",
    hint_jump:"Alt+клик по узлу (долгое нажатие на сенсоре) переходит к его строке в тексте; Alt+клик в тексте показывает узел на диаграмме."
  },
  hi: {
    subtitle:"Werkbaum – WBS / Lean Pathfinding · परियोजना संरचना संपादक (फ़ीचर और रिक्वायरमेंट ट्री के लिए भी)",
    subtitleShort:"WBS संपादक Lean Pathfinding के साथ",
    imprint:"प्रकाशन विवरण (Impressum)",
    privacy:"गोपनीयता",
    legendTooltip:"लेजेंड दिखाएँ/छिपाएँ",
    paneToText:"टेक्स्ट पर जाएँ",
    paneToDiagram:"आरेख पर जाएँ",
    ghostTooltip:"आकार M से ऊपर किसी तत्व को और अधिक उप-विभाजित करना चाहिए।",
    jumpHint:"Alt+क्लिक: टेक्स्ट में उस पंक्ति पर जाएँ",
    padReadonly:"पैड में संपादित होता है — यहाँ केवल पढ़ें।",
    padEdit:"संपादित करने के लिए पैड खोलें",
    padRefresh:"पैड से फिर लोड करें",
    padWait:"{seconds} स॰ बाकी — Etherpad बार-बार लेने की सीमा रखता है",
    padRateLimitWarn:"अभी दोबारा लोड नहीं किया: Etherpad प्रति समय-खिड़की केवल कुछ ही बार लेने देता है (डिफ़ॉल्ट रूप से 90 स॰ में 10 बार), इसलिए इतनी बार सिंक करना संभव नहीं है। {seconds} स॰ में फिर कोशिश करें।",
    padViewTooltip:"दृश्य: {state} — बदलने के लिए क्लिक करें",
    padView_both:"पैड और टेक्स्ट",
    padView_pad:"केवल पैड",
    padView_text:"केवल टेक्स्ट",
    padGutterAria:"पैड और टेक्स्ट संपादक का आकार बदलें",
    riskTooltip:"उच्च जोखिम – प्रयास अभी अस्पष्ट।",
    discardedTooltip:"अस्वीकृत नोड्स और उनके उप-वृक्ष दिखाएँ/छिपाएँ",
    cheapTooltip:"सबसे किफ़ायती पथ को उजागर करें – अनावश्यक विकल्प मंद हो जाते हैं",
    implicitSizeTooltip:"कोई आकार नहीं दिया गया – लागत अनुमान के लिए M माना गया",
    fullscreenTooltip:"पूर्ण स्क्रीन – पैनल पूरी विंडो चौड़ाई का उपयोग करते हैं",
    brandTooltip:"„Werkbaum“ का अर्थ लगभग ‚कार्य-वृक्ष‘ है — कार्य विभाजन संरचना (WBS) का वृक्ष।",
    editorTitle:"संरचना (टेक्स्ट)", diagramTitle:"आरेख",
    docSwitchTooltip:"दस्तावेज़ चुनें या प्रबंधित करें", docMenuAria:"दस्तावेज़",
    docNew:"नया दस्तावेज़", docRename:"नाम बदलें", docDelete:"हटाएँ",
    docNewName:"बिना शीर्षक",
    docDeleteConfirm:"दस्तावेज़ „{name}“ हटाएँ?",
    docRestore:"मूल पुनर्स्थापित करें",
    docRestoreConfirm:"„{name}“ को मूल संस्करण पर लौटाएँ? आपके परिवर्तन खो जाएँगे।",
    copy:"कॉपी करें", copyDone:"कॉपी हो गया ✓", copyTooltip:"टेक्स्ट को क्लिपबोर्ड पर कॉपी करें",
    copyDiagramTooltip:"आरेख को PNG छवि के रूप में क्लिपबोर्ड पर कॉपी करें",
    downloadDiagramTooltip:"आरेख को SVG फ़ाइल के रूप में डाउनलोड करें (जैसे LibreOffice: सम्मिलित करें → छवि)",
    downloadPngTooltip:"आरेख को PNG फ़ाइल के रूप में डाउनलोड करें (रास्टर छवि, कहीं भी सम्मिलित करने योग्य)",
    downloadMenu:"आरेख डाउनलोड करें (SVG/PNG)",
    minimize:"छोटा करें", normal:"सामान्य", maximize:"बड़ा करें",
    agenda:"लेजेंड", discarded:"अस्वीकृत",
    gutterTooltip:"आकार बदलने के लिए खींचें, डबल-क्लिक रीसेट करता है", gutterAria:"क्षेत्रों का आकार बदलें",
    hintGutterAria:"संपादक और लेजेंड का आकार बदलें",
    freshTooltip:"पिछली बार से उत्पादन में नया: {n}. देखा गया चिह्नित करने के लिए क्लिक करें।",
    modeHorizontal:"क्षैतिज – संगठन-चार्ट, संपादक के ऊपर आरेख",
    modeKompakt:"सघन – सब नीचे की ओर, जगह बचाता है",
    modeVertikal:"लंबवत – पेड़ दाईं ओर, संपादक के बगल में आरेख",
    zoomOut:"ज़ूम आउट", zoomReset:"रीसेट करें", zoomIn:"ज़ूम इन",
    zoomAria:"ज़ूम (Ctrl/Cmd + माउस-व्हील)", langMore:"और भाषाएँ",
    empty:"अभी कोई संरचना नहीं — बस टाइप करना शुरू करें।", ghost:"…",
    mixedWarn:"पंक्ति {line}: „{label}“ के अंतर्गत - और | मिश्रित हैं — पहले चाइल्ड के अनुसार दिखाया गया।",
    xorConflictWarn:"पंक्ति {line}: „{label}“ एक और साकार विकल्प है — = समूह में केवल एक की अनुमति है।",
    duplicateIdWarn:"पंक्ति {line}: आईडी #{id} पहले से प्रयुक्त है (पंक्ति {firstLine})।",
    unknownDepWarn:"पंक्ति {line}: निर्भरता #{id} — इस आईडी वाला कोई नोड नहीं है।",
    unknownDescWarn:"पंक्ति {line}: #{id} के लिए विवरण — इस आईडी वाला कोई नोड नहीं है।",
    descStrayWarn:"पंक्ति {line}: विवरण पंक्ति बिना संदर्भ — इससे पहले कोई नोड या #id ब्लॉक नहीं है।",
    cheapApproxWarn:"सटीक खोज के लिए बहुत सारे युग्मित विकल्प-समूह — सबसे सस्ता पथ लालची अनुमान है (प्रति समूह स्थानीय चयन)।",
    st_idee:"विचार", st_geplant:"नियोजित", st_arbeit:"प्रगति पर", st_durchstich:"कार्यशील ढाँचा",
    st_fertig:"पूर्ण", st_prod:"उत्पादन में", st_highrisk:"उच्च जोखिम", st_verworfen:"अस्वीकृत",
    unknownStatusWarn:"पंक्ति {line}: अज्ञात स्थिति कोड „{code}“ — तटस्थ रूप में दिखाया गया।",
    sourceLoadWarn:"„{url}“ लोड नहीं हो सका ({error})। फ़ाइल http(s) से उपलब्ध होनी चाहिए और CORS की अनुमति देनी चाहिए (Access-Control-Allow-Origin)।",
    sourceTimeoutWarn:"„{url}“ ने {seconds} स॰ में उत्तर नहीं दिया — अनुरोध रद्द कर दिया गया। Etherpad सीमित करता है कि एक्सपोर्ट कितनी बार लिया जा सके (डिफ़ॉल्ट रूप से 90 स॰ में 10 बार); कुछ क्षण रुकें, फिर दोबारा लोड करें।",
    a11yStatus:"स्थिति: {status}", a11ySize:"आकार: {size}", a11ySizeImplicit:"आकार: M (अनुमानित)", a11yTags:"जिम्मेदार: {names}", a11yId:"आईडी: #{id}", a11yDeps:"निर्भर: {ids}", a11yFolded:"समेटा हुआ, {n} छिपे", a11yEffective:"प्रभावी: {status}", heldTooltip:"प्रभावी रूप से {eff} — स्वयं {own} है, निर्भरताओं की प्रतीक्षा में", a11yOptional:"वैकल्पिक", a11yFocusMark:"यहाँ देखें", a11yLink:"लिंक सहित",
    hint_indent:"इंडेंट (2 स्पेस या टैब) पदानुक्रम तय करता है।",
    hint_all:"उप-कार्य, सभी आवश्यक", hint_any:"विकल्प, एक चुनें",
    hint_xor:"विकल्प, ठीक एक",
    hint_opt:"अतिरिक्त, आवश्यक नहीं",
    hint_focus:"यहाँ देखें (साझा संकेतक)",
    hint_root:"बिना मार्कर वाली पंक्ति = मूल नोड। |, = और - / + को आपस में न मिलाएँ।",
    hint_status:"मार्कर के बाद चेकबॉक्स के रूप में स्थिति, जैसे",
    hint_size:"प्रयास कोष्ठक में टी-शर्ट आकार के रूप में; लिंक बस URL के रूप में जोड़ें:",
    hint_break:"(M) से आगे: और विभाजित करें — विभाजन न होने पर आरेख में प्लेसहोल्डर दिखता है।",
    hint_comment:"%% से टिप्पणियाँ — पूरी पंक्ति या पंक्ति के अंत में।",
    hint_people:"@नाम से व्यक्ति — नोड के नीचे-दाएँ दिखते हैं।",
    hint_id:"शीर्षक से पहले #नाम: के रूप में नोड आईडी — नोड के टूलटिप में दिखती है।",
    hint_deps:":#नाम,#नाम से निर्भरताएँ — टूलटिप में दिखती हैं।",
    hint_eff:"नोड का रंग प्रभावी स्थिति दिखाता है (निर्भरताओं सहित); यदि अपनी स्थिति आगे है, तो वह नीचे-बाएँ चिह्न के रूप में दिखती है।",
    hint_desc:"विवरण: नोड के नीचे \" पंक्ति; --- के बाद #id ब्लॉक में लंबा पाठ — दोनों टूलटिप में (”)।",
    hint_fold:"फ़ोल्डिंग: - > [x] … समेटा हुआ खुलता है, < वापस लाता है; नोड पर ▾/▸ टॉगल करता है (कीबोर्ड: ←/→)।",
    hint_jump:"किसी नोड पर Alt+क्लिक (टच पर लंबा दबाव) टेक्स्ट में उसकी पंक्ति पर ले जाता है; टेक्स्ट में Alt+क्लिक उस नोड को आरेख में दिखाता है।"
  },
  zh: {
    subtitle:"Werkbaum – WBS / Lean Pathfinding · 项目结构编辑器（也支持功能树和需求树）",
    subtitleShort:"WBS 编辑器和 Lean Pathfinding",
    imprint:"法律声明（Impressum）",
    privacy:"隐私",
    legendTooltip:"显示/隐藏图例",
    paneToText:"切换到文本",
    paneToDiagram:"切换到图表",
    brandTooltip:"「Werkbaum」大致意为‘工作之树’——即工作分解结构（WBS）之树。",
    fullscreenTooltip:"全屏——面板占据整个窗口宽度",
    discardedTooltip:"显示/隐藏已放弃的节点及其子树",
    cheapTooltip:"突出显示成本最低的路径——不需要的备选项将淡化",
    implicitSizeTooltip:"未指定尺寸——成本估算时按 M 计",
    ghostTooltip:"从 M 号起，元素应进一步细分。",
    jumpHint:"Alt+点击：跳转到文本中的该行",
    padReadonly:"在 Pad 中编辑 — 此处只读。",
    padEdit:"打开 Pad 进行编辑",
    padRefresh:"从 Pad 重新加载",
    padWait:"还需 {seconds} 秒 — Etherpad 限制获取频率",
    padRateLimitWarn:"尚未重新加载：Etherpad 每个时间窗口只允许少量获取（默认每 90 秒 10 次），因此无法如此频繁地同步。请在 {seconds} 秒后再试。",
    padViewTooltip:"视图：{state} — 点击切换",
    padView_both:"Pad 和文本",
    padView_pad:"仅 Pad",
    padView_text:"仅文本",
    padGutterAria:"调整 Pad 与文本编辑器大小",
    riskTooltip:"高风险 – 工作量尚不明确。",
    editorTitle:"结构（文本）", diagramTitle:"图表",
    docSwitchTooltip:"选择或管理文档", docMenuAria:"文档",
    docNew:"新建文档", docRename:"重命名", docDelete:"删除",
    docNewName:"未命名",
    docDeleteConfirm:"删除文档“{name}”？",
    docRestore:"恢复原始版本",
    docRestoreConfirm:"将“{name}”重置为随附版本？您的更改将丢失。",
    copy:"复制", copyDone:"已复制 ✓", copyTooltip:"将文本复制到剪贴板",
    copyDiagramTooltip:"将图表作为 PNG 图片复制到剪贴板",
    downloadDiagramTooltip:"将图表下载为 SVG 文件（例如用于 LibreOffice：插入 → 图像）",
    downloadPngTooltip:"将图表下载为 PNG 文件（位图，可在任何地方插入）",
    downloadMenu:"下载图表（SVG/PNG）",
    minimize:"最小化", normal:"正常", maximize:"最大化",
    agenda:"图例", discarded:"已放弃",
    gutterTooltip:"拖动可调整大小，双击可重置", gutterAria:"调整区域大小",
    hintGutterAria:"调整编辑器和图例大小",
    freshTooltip:"自上次查看以来新上线：{n}。点击标记为已查看。",
    modeHorizontal:"横向——组织结构图，图表在编辑器上方",
    modeKompakt:"紧凑——全部向下，节省空间",
    modeVertikal:"纵向——树向右展开，图表在编辑器旁边",
    zoomOut:"缩小", zoomReset:"重置", zoomIn:"放大",
    zoomAria:"缩放（Ctrl/Cmd + 鼠标滚轮）", langMore:"更多语言",
    empty:"还没有结构——直接开始输入吧。", ghost:"…",
    mixedWarn:"第 {line} 行：在「{label}」下 - 与 | 混用——按第一个子项渲染。",
    xorConflictWarn:"第 {line} 行：「{label}」是又一个已实现的备选项——= 组只允许恰好一个。",
    duplicateIdWarn:"第 {line} 行：ID #{id} 已被占用（第 {firstLine} 行）。",
    unknownDepWarn:"第 {line} 行：依赖 #{id}——没有节点使用此 ID。",
    unknownDescWarn:"第 {line} 行：#{id} 的描述——没有节点使用此 ID。",
    descStrayWarn:"第 {line} 行：描述行没有归属——前面缺少节点或 #id 块。",
    cheapApproxWarn:"耦合的备选组过多，无法精确搜索——最便宜路径为贪心估计（每组就地选择）。",
    st_idee:"想法", st_geplant:"已计划", st_arbeit:"进行中", st_durchstich:"可运行骨架",
    st_fertig:"已完成", st_prod:"已上线", st_highrisk:"高风险", st_verworfen:"已放弃",
    unknownStatusWarn:"第 {line} 行：未知状态代码“{code}”——显示为中性。",
    sourceLoadWarn:"无法加载“{url}”（{error}）。该文件必须可通过 http(s) 访问并允许 CORS（Access-Control-Allow-Origin）。",
    sourceTimeoutWarn:"“{url}” 在 {seconds} 秒内没有响应 — 请求已中止。Etherpad 会限制导出的获取频率（默认每 90 秒 10 次）；请稍候再重新加载。",
    a11yStatus:"状态：{status}", a11ySize:"工作量：{size}", a11ySizeImplicit:"工作量：M（假定）", a11yTags:"负责人：{names}", a11yId:"ID：#{id}", a11yDeps:"依赖：{ids}", a11yFolded:"已折叠，隐藏 {n} 项", a11yEffective:"实际：{status}", heldTooltip:"实际为 {eff}——自身已是 {own}，等待依赖完成", a11yOptional:"可选", a11yFocusMark:"看这里", a11yLink:"含链接",
    hint_indent:"缩进（2 个空格或制表符）定义层级。",
    hint_all:"子任务，全部必需", hint_any:"备选项，择其一",
    hint_xor:"备选项，恰好一个",
    hint_opt:"附加项，非必需",
    hint_focus:"看这里（共享的指针）",
    hint_root:"无标记的行 = 根节点。请勿混用 |、= 与 - / +。",
    hint_status:"在标记后用方框表示状态，例如",
    hint_size:"用括号中的 T 恤尺码表示工作量；链接直接作为 URL 附加：",
    hint_break:"从 (M) 起：继续细分——若缺少细分，图表中会出现占位符。",
    hint_comment:"用 %% 注释——整行或行尾。",
    hint_people:"用 @姓名 表示人员——显示在节点右下角。",
    hint_id:"用 #名称: 写在标题前指定节点 ID——显示在节点提示中。",
    hint_deps:"用 :#名称,#名称 表示依赖——显示在提示中。",
    hint_eff:"节点颜色显示实际状态（含依赖）；若自身状态更靠前，会以左下角标记显示。",
    hint_desc:"描述：节点下方的 \" 行；--- 之后的缩进 #id 块为长文本——均显示在提示中（”）。",
    hint_fold:"折叠：- > [x] … 打开时即折叠，< 将其展开；节点上的 ▾/▸ 切换（键盘：←/→）。",
    hint_jump:"Alt+点击节点（触摸屏为长按）可跳转到文本中对应的行；在文本中 Alt+点击则把该节点带入视野。"
  },
  ja: {
    subtitle:"Werkbaum – WBS / Lean Pathfinding · プロジェクト構造エディター（フィーチャーツリーと要件ツリーにも対応）",
    subtitleShort:"WBS エディター & Lean Pathfinding",
    imprint:"運営者情報（Impressum）",
    privacy:"プライバシー",
    legendTooltip:"凡例を表示/非表示",
    paneToText:"テキストに切り替え",
    paneToDiagram:"ダイアグラムに切り替え",
    brandTooltip:"「Werkbaum」はおおよそ『作業の木』の意味 — 作業分解構成図（WBS）のツリーです。",
    fullscreenTooltip:"全画面 — パネルがウィンドウ幅いっぱいを使用",
    discardedTooltip:"破棄したノードとその下位ツリーを表示/非表示",
    cheapTooltip:"最も低コストの経路を強調 – 不要な選択肢は控えめに表示",
    implicitSizeTooltip:"サイズ未指定 – コスト見積もりのため M として扱う",
    ghostTooltip:"サイズ M 以上の要素はさらに分解すべきです。",
    jumpHint:"Alt+クリック：テキストの該当行へ移動",
    padReadonly:"パッドで編集します — ここでは読み取り専用です。",
    padEdit:"編集するにはパッドを開く",
    padRefresh:"パッドから再読み込み",
    padWait:"あと {seconds} 秒 — Etherpad は取得頻度を制限します",
    padRateLimitWarn:"まだ再読み込みしていません: Etherpad は一定時間内の取得回数を制限します（既定で 90 秒あたり 10 回）。これほど頻繁な同期はできません。{seconds} 秒後にもう一度お試しください。",
    padViewTooltip:"表示: {state} — クリックで切り替え",
    padView_both:"パッドとテキスト",
    padView_pad:"パッドのみ",
    padView_text:"テキストのみ",
    padGutterAria:"パッドとテキストエディターのサイズを変更",
    riskTooltip:"高リスク – 規模はまだ不明。",
    editorTitle:"構造（テキスト）", diagramTitle:"ダイアグラム",
    docSwitchTooltip:"ドキュメントを選択・管理", docMenuAria:"ドキュメント",
    docNew:"新規ドキュメント", docRename:"名前を変更", docDelete:"削除",
    docNewName:"無題",
    docDeleteConfirm:"ドキュメント「{name}」を削除しますか？",
    docRestore:"オリジナルを復元",
    docRestoreConfirm:"「{name}」を同梱版に戻しますか？変更内容は失われます。",
    copy:"コピー", copyDone:"コピーしました ✓", copyTooltip:"テキストをクリップボードにコピー",
    copyDiagramTooltip:"ダイアグラムを PNG 画像としてクリップボードにコピー",
    downloadDiagramTooltip:"ダイアグラムを SVG ファイルとしてダウンロード（例：LibreOffice の 挿入 → 画像）",
    downloadPngTooltip:"ダイアグラムを PNG ファイルとしてダウンロード（ラスター画像、どこにでも挿入可能）",
    downloadMenu:"ダイアグラムをダウンロード（SVG/PNG）",
    minimize:"最小化", normal:"標準", maximize:"最大化",
    agenda:"凡例", discarded:"破棄",
    gutterTooltip:"ドラッグでサイズ変更、ダブルクリックでリセット", gutterAria:"領域のサイズを変更",
    hintGutterAria:"エディターと凡例のサイズを変更",
    freshTooltip:"前回以降に本番化されたもの：{n} 件。クリックで既読にします。",
    modeHorizontal:"横 — 組織図、ダイアグラムはエディターの上",
    modeKompakt:"コンパクト — すべて下方向、省スペース",
    modeVertikal:"縦 — ツリーを右へ、ダイアグラムはエディターの横",
    zoomOut:"縮小", zoomReset:"リセット", zoomIn:"拡大",
    zoomAria:"ズーム（Ctrl/Cmd + マウスホイール）", langMore:"その他の言語",
    empty:"まだ構造がありません — 入力を始めてください。", ghost:"…",
    mixedWarn:"{line} 行目：「{label}」の下で - と | が混在 — 最初の子に従って表示。",
    xorConflictWarn:"{line} 行目：「{label}」も実現済みの選択肢です — = グループで実現できるのは 1 つだけです。",
    duplicateIdWarn:"{line} 行目：ID #{id} は既に使われています（{firstLine} 行目）。",
    unknownDepWarn:"{line} 行目：依存 #{id} — この ID を持つノードはありません。",
    unknownDescWarn:"{line} 行目：#{id} の説明 — この ID を持つノードはありません。",
    descStrayWarn:"{line} 行目：説明行の帰属先がありません — 直前にノードまたは #id ブロックが必要です。",
    cheapApproxWarn:"結合された選択肢グループが多すぎるため厳密探索は不可 — 最安パスは貪欲法による推定です（グループごとに局所選択）。",
    st_idee:"アイデア", st_geplant:"計画済み", st_arbeit:"作業中", st_durchstich:"ウォーキングスケルトン",
    st_fertig:"完了", st_prod:"本番稼働", st_highrisk:"高リスク", st_verworfen:"破棄",
    unknownStatusWarn:"{line} 行目: 不明なステータス記号「{code}」— 中立として表示。",
    sourceLoadWarn:"「{url}」を読み込めませんでした（{error}）。ファイルは http(s) でアクセス可能で、CORS（Access-Control-Allow-Origin）を許可する必要があります。",
    sourceTimeoutWarn:"「{url}」が {seconds} 秒以内に応答しませんでした — 要求を中止しました。Etherpad はエクスポートの取得回数を制限します（既定で 90 秒あたり 10 回）。少し待ってから再読み込みしてください。",
    a11yStatus:"ステータス: {status}", a11ySize:"規模: {size}", a11ySizeImplicit:"規模: M（想定）", a11yTags:"担当: {names}", a11yId:"ID: #{id}", a11yDeps:"依存先: {ids}", a11yFolded:"折りたたみ中、{n} 件非表示", a11yEffective:"実効: {status}", heldTooltip:"実効では {eff} — 自身は既に {own}、依存待ち", a11yOptional:"任意", a11yFocusMark:"ここを見る", a11yLink:"リンクあり",
    hint_indent:"インデント（スペース2つまたはタブ）で階層を定義します。",
    hint_all:"サブタスク、すべて必須", hint_any:"選択肢、1つを選ぶ",
    hint_xor:"選択肢、ちょうど1つ",
    hint_opt:"追加、必須ではない",
    hint_focus:"ここを見る（共有の指さし）",
    hint_root:"マーカーのない行 = ルートノード。|・=・- / + を混在させないでください。",
    hint_status:"マーカーの後にチェックボックスで状態、例：",
    hint_size:"工数は括弧内の T シャツサイズで；リンクは URL としてそのまま追加：",
    hint_break:"(M) 以上：さらに分解 — 分解がないと図にプレースホルダーが表示されます。",
    hint_comment:"%% でコメント — 行全体または行末。",
    hint_people:"@名前 で担当者 — ノードの右下に表示されます。",
    hint_id:"タイトルの前に #名前: でノード ID — ノードのツールチップに表示されます。",
    hint_deps:":#名前,#名前 で依存関係 — ツールチップに表示されます。",
    hint_eff:"ノードの色は実効ステータス（依存関係込み）を示します。自身が先行している場合は左下のマークで表示されます。",
    hint_desc:"説明：ノード直下の \" 行。--- 以降は #id ブロック（字下げ）で長文 — どちらもツールチップに表示（”）。",
    hint_fold:"折りたたみ：- > [x] … は折りたたんだ状態で開き、< は呼び戻します。ノードの ▾/▸ で切替（キー：←/→）。",
    hint_jump:"ノードを Alt+クリック（タッチでは長押し）すると、テキストの該当行へ移動します。テキスト内で Alt+クリックすると、そのノードが図の中央に表示されます。"
  }
};
let lang = 'de';
function t(key, vars){
  let s = (I18N[lang] && I18N[lang][key]) ?? I18N.de[key] ?? key;
  if(vars) for(const k in vars) s = s.split('{'+k+'}').join(vars[k]);
  return s;
}
function buildHint(){
  const chip = (key, code) => `<span class="chip st-${key}">${code}&nbsp;${esc(t('st_'+key))}</span>`;
  return `${esc(t('hint_indent'))}<br>
    <code>-</code>&nbsp; ${esc(t('hint_all'))} <em>(all of)</em><br>
    <code>+</code>&nbsp; ${esc(t('hint_opt'))} <em>(optional)</em><br>
    <code class="or-code">|</code>&nbsp; ${esc(t('hint_any'))} <em>(any of)</em><br>
    <code class="or-code">=</code>&nbsp; ${esc(t('hint_xor'))} <em>(xor)</em><br>
    ${esc(t('hint_root'))}<br>
    ${esc(t('hint_status'))} <code>- [~] Frontend</code>:
    <div class="chips">
      ${chip('idee','[?]')}
      ${chip('geplant','[&nbsp;]')}
      ${chip('arbeit','[~]')}
      ${chip('durchstich','[/]')}
      ${chip('fertig','[x]')}
      ${chip('prod','[^]')}
      ${chip('verworfen','[-]')}
    </div>
    ${esc(t('hint_size'))}<br>
    <code>- [ ] Backend (L) https://…</code><br>
    ${esc(t('hint_break'))}<br>
    ${esc(t('hint_comment'))}
    ${esc(t('hint_people'))}
    ${esc(t('hint_id'))}
    ${esc(t('hint_deps'))}
    ${esc(t('hint_eff'))}
    ${esc(t('hint_desc'))}
    ${esc(t('hint_fold'))}
    <code>!!!</code>&nbsp; ${esc(t('hint_focus'))}
    <div class="hint-op">${esc(t('hint_jump'))}</div>`;
}
function applyLang(l){
  lang = l;
  document.documentElement.lang = l;
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = t(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-title]').forEach(el => el.title = t(el.dataset.i18nTitle));
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  document.getElementById('hint').innerHTML = buildHint();
  /* Datenschutzerklärung gibt es nur DE + EN: deutsche UI -> deutsche Fassung,
     alle anderen Sprachen -> englische Fassung (Art. 12 DSGVO: verständlich). */
  const privacyLink = document.getElementById('privacyLink');
  if(privacyLink) privacyLink.href = l==='de'
    ? 'https://michael.hoennig.de/datenschutzerklaerung.html'
    : 'https://michael.hoennig.de/privacy-policy.html';
  document.querySelectorAll('.langsel button[data-lang]').forEach(b => b.classList.toggle('active', b.dataset.lang===l));
  /* Ist eine aufklappbare Sprache aktiv, den erweiterten Bereich offen halten.
     Auf kleinem Bildschirm nicht — dort bleibt die Leiste schlank (EN + aktive
     Sprache reichen; die aktive wird per CSS auch als „extra“ eingeblendet). */
  if(LANG_EXTRA.includes(l) && !isMobile()){
    langsel.classList.add('expanded');
    langMore.setAttribute('aria-expanded', 'true');
  }
  render();
  updateDocName();   /* Titelzeilen-Tooltip nach dem data-i18n-title-Durchlauf setzen */
  try{ localStorage.setItem('werkbaum-lang', l); }catch(_){}
}
const langsel = document.querySelector('.langsel');
const langMore = document.getElementById('langMore');
const LANG_EXTRA = ['pl','ru','hi','zh','ja'];
langMore.addEventListener('click', () => {
  const exp = langsel.classList.toggle('expanded');
  langMore.setAttribute('aria-expanded', String(exp));
});
function collapseLangsel(){
  langsel.classList.remove('expanded');
  langMore.setAttribute('aria-expanded', 'false');
}
document.querySelectorAll('.langsel button[data-lang]').forEach(b => {
  b.addEventListener('click', () => {
    /* Mobil: eingeklappt ist nur die aktive Sprache sichtbar — ein Tipp klappt
       die volle Leiste als Overlay auf; erst im aufgeklappten Zustand wählt ein
       Tipp die Sprache und klappt wieder ein. */
    if(isMobile() && !langsel.classList.contains('expanded')){
      langsel.classList.add('expanded');
      langMore.setAttribute('aria-expanded', 'true');
      return;
    }
    applyLang(b.dataset.lang);
    if(isMobile()) collapseLangsel();
  });
});
/* Mobil: Tipp außerhalb der aufgeklappten Leiste schließt sie wieder. */
document.addEventListener('click', e => {
  if(isMobile() && langsel.classList.contains('expanded') && !langsel.contains(e.target)){
    collapseLangsel();
  }
});

/* ---------- Vollbild: Panels über die ganze Fensterbreite ---------- */
const fsBtn = document.getElementById('fsToggle');
fsBtn.addEventListener('click', () => {
  const on = document.body.classList.toggle('fullscreen');
  fsBtn.classList.toggle('active', on);
  fsBtn.setAttribute('aria-pressed', String(on));
  saveUI();
});

/* ---------- GUI-Zustand + Editortext im Browser sichern ----------
   Noch kein Backend: Einstellungen (Modus, verworfene, Aufteilung, Zoom,
   Vollbild) und der Editortext bleiben per localStorage über Neuladen
   erhalten. Sprache liegt weiterhin in 'werkbaum-lang'. */
const LS_UI = 'werkbaum-ui', LS_SRC = 'werkbaum-src';
const LS_DOCS = 'werkbaum-docs', LS_ACTIVE = 'werkbaum-active';
const LS_SEEDED = 'werkbaum-seeded';   /* mitgelieferte Dokumente schon angelegt? */
const LS_SEEDED_EXAMPLE = 'werkbaum-seeded-example';   /* Fingerabdruck der ausgelieferten INITIAL-Fassung (D27-Nachtrag) */
let restoring = false;   /* unterdrückt Speichern während des Wiederherstellens */
let hadStoredUI = false;  /* gab es beim Laden schon gespeicherte GUI-Einstellungen? */

/* ---------- Dokumente (mehrere umschaltbare Notationstexte) ----------
   Noch kein Backend: mehrere Dokumente liegen als [{id,name,text}] im
   localStorage (LS_DOCS), das aktive per id in LS_ACTIVE. Jedes Dokument ist
   nur ein Notationstext + Name (Metadatum) — kein eigenes Strukturformat (D14).
   Der aktive Text wird zusätzlich in LS_SRC gespiegelt (Abwärtskompatibilität
   + Migration bestehender Einzeltexte). */
/* Das Beispiel-Dokument trägt eine reservierte id und einen festen englischen
   Namen: So trifft der Reset genau dieses eine Dokument (D22) und der Name ist
   unabhängig von der UI-Sprache englisch — wie der Beispieltext selbst (breiteres
   Publikum). */
const EXAMPLE_ID = 'example', EXAMPLE_NAME = 'Example';
/* Zweites mitgeliefertes Dokument: Werkbaum selbst (D27). Fester Name wie beim
   Beispiel — Dokumentnamen sind Nutzerdaten und werden nicht übersetzt (D22). */
const WERKBAUM_ID = 'werkbaum', WERKBAUM_NAME = 'Werkbaum';
/* Die erste Fassung hieß versehentlich „Werkbank" (Tippfehler). */
const WERKBAUM_NAME_ALT = 'Werkbank';
let docs = [];          /* [{id, name, text}] */
let activeId = null;
function uid(){ return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function activeDoc(){ return docs.find(d => d.id === activeId) || null; }
function uniqueName(base){
  const taken = new Set(docs.map(d => d.name));
  if(!taken.has(base)) return base;
  let i = 2;
  while(taken.has(base + ' ' + i)) i++;
  return base + ' ' + i;
}
function persistDocs(){
  try{
    localStorage.setItem(LS_DOCS, JSON.stringify(docs));
    localStorage.setItem(LS_ACTIVE, activeId || '');
    const d = activeDoc();
    if(d) localStorage.setItem(LS_SRC, d.text);   /* Spiegel für Fallback/Migration */
  }catch(_){}
}
/* Kurzer, stabiler Fingerabdruck (FNV-1a) — dient nur dem Vergleich „ist das
   noch der ausgelieferte Text?"; keine kryptografische Anforderung. */
function fingerprint(s){
  let h = 0x811c9dc5;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/* Mitgeliefertes Dokument „Werkbaum" (D27) anlegen bzw. nachziehen. In
   `LS_SEEDED` steht der Fingerabdruck der zuletzt ausgelieferten Fassung:
   - kein Merker  -> Dokument einmalig anlegen (auch für Bestandsnutzer);
   - neue Fassung -> Text nur ersetzen, wenn der Nutzer ihn NICHT geändert hat
     (sein Fingerabdruck also noch dem gemerkten entspricht);
   - gelöscht     -> bleibt gelöscht (der Merker verhindert die Wiederkehr).
   Der Altwert '1' aus der ersten Fassung sagt nichts über den Textstand, dort
   wird bewusst nichts angefasst — nur der Merker wird ersetzt. */
function seedShippedDocs(){
  const fp = fingerprint(WERKBAUM_DOC);
  let seen = null;
  try{ seen = localStorage.getItem(LS_SEEDED); }catch(_){}
  const doc = docs.find(d => d.id === WERKBAUM_ID);
  if(!seen){
    if(!doc) docs.push({ id: WERKBAUM_ID, name: WERKBAUM_NAME, text: WERKBAUM_DOC });
  } else if(seen !== '1' && seen !== fp && doc && fingerprint(doc.text) === seen){
    doc.text = WERKBAUM_DOC;
  }
  try{ localStorage.setItem(LS_SEEDED, fp); }catch(_){}
  /* Dasselbe Nachziehen für das Beispiel-Dokument (D27-Nachtrag): Ohne den
     Merker erreichte eine neue Fassung von INITIAL Bestandsnutzer nie —
     ihr unverändertes Beispiel sähe nur wie „bearbeitet" aus. Nachgezogen
     wird nur, solange der Text exakt die zuletzt ausgelieferte Fassung ist;
     ein gelöschtes Beispiel wird hier nicht wiederbelebt. */
  const exFp = fingerprint(INITIAL);
  let exSeen = null;
  try{ exSeen = localStorage.getItem(LS_SEEDED_EXAMPLE); }catch(_){}
  const ex = docs.find(d => d.id === EXAMPLE_ID);
  if(exSeen && exSeen !== exFp && ex && fingerprint(ex.text) === exSeen){
    ex.text = INITIAL;
  }
  try{ localStorage.setItem(LS_SEEDED_EXAMPLE, exFp); }catch(_){}
  /* Nur vergleichen, solange der Text der ausgelieferte ist — hat der Nutzer ihn
     bearbeitet, gibt es keine saubere Vergleichsbasis (D28). */
  const shipped = docs.find(d => d.id === WERKBAUM_ID);
  if(shipped && shipped.text === WERKBAUM_DOC) computeFresh(WERKBAUM_ID, WERKBAUM_DOC);
}

/* Aus dem localStorage laden; bei fehlender Dokumentenliste den bestehenden
   Einzeltext (oder INITIAL) als erstes Dokument migrieren. */
function loadDocs(){
  let arr = null;
  try{ arr = JSON.parse(localStorage.getItem(LS_DOCS) || 'null'); }catch(_){}
  if(!Array.isArray(arr) || !arr.length ||
     !arr.every(d => d && typeof d.id === 'string' && typeof d.text === 'string')){
    let legacy = null;
    try{ legacy = localStorage.getItem(LS_SRC); }catch(_){}
    arr = [{ id: EXAMPLE_ID, name: EXAMPLE_NAME, text: (legacy !== null) ? legacy : INITIAL }];
  }
  docs = arr;
  let a = null;
  try{ a = localStorage.getItem(LS_ACTIVE); }catch(_){}
  /* Alt-Zustand (erste Version: zufällige id, lokalisierter Name): ein noch
     unverändertes Beispiel-Dokument bekommt nachträglich die reservierte id und
     den englischen Namen, damit Namensfix und Reset auch dort greifen. Nur bei
     unverändertem Text (=== INITIAL), um echte Nutzerinhalte nie zu adoptieren. */
  if(!docs.some(d => d.id === EXAMPLE_ID) && docs[0] && docs[0].text === INITIAL){
    if(a === docs[0].id) a = EXAMPLE_ID;
    docs[0].id = EXAMPLE_ID;
    docs[0].name = EXAMPLE_NAME;
  }
  seedShippedDocs();
  /* Namensfix für die kurzlebige Fassung mit dem Tippfehler — nur, solange der
     ausgelieferte Name unverändert ist; eine eigene Umbenennung bleibt stehen
     (Dokumentnamen sind Nutzerdaten, D22). */
  const wb = docs.find(d => d.id === WERKBAUM_ID);
  if(wb && wb.name === WERKBAUM_NAME_ALT) wb.name = WERKBAUM_NAME;
  activeId = docs.some(d => d.id === a) ? a : docs[0].id;
}
function saveSrc(){
  if(restoring) return;
  const d = activeDoc();
  if(d) d.text = src.value;
  persistDocs();
}
function saveUI(){
  if(restoring) return;
  try{
    const modeEl = document.querySelector('input[name="layout"]:checked');
    localStorage.setItem(LS_UI, JSON.stringify({
      mode: modeEl ? modeEl.value : 'horizontal',
      discarded: discardedShown(),
      cheapPath: cheapPathOn,
      split: splitState,
      col: app.style.getPropertyValue('--col') || null,
      drow: app.style.getPropertyValue('--drow') || null,
      /* Legende: auf/zu + Aufteilung Editor|Legende (D26). Bewusst per
         DOM-Abfrage statt über die `agenda`-Konstante — die wird erst weiter
         unten deklariert, und saveUI() läuft schon aus applySplit() heraus. */
      agenda: !!document.querySelector('.agenda.open'),
      hcol: app.style.getPropertyValue('--hcol') || null,
      hrow: app.style.getPropertyValue('--hrow') || null,
      /* Pad-Ansicht + Aufteilung Pad|Spiegel (D31). Global über alle Dokumente,
         wie der übrige Ansichts-Zustand (D22). */
      padView: padView,
      pcol: app.style.getPropertyValue('--pcol') || null,
      prow: app.style.getPropertyValue('--prow') || null,
      /* Sichtbarer Bereich auf kleinem Bildschirm (D17-Nachtrag) — ebenfalls
         global über alle Dokumente wie der übrige Ansichts-Zustand. */
      mobilePane: mobilePane,
      zoom: zoom,
      fullscreen: document.body.classList.contains('fullscreen')
    }));
  }catch(_){}
}
function restoreState(){
  restoring = true;
  let ui = null;
  try{ ui = JSON.parse(localStorage.getItem(LS_UI) || 'null'); }catch(_){}
  hadStoredUI = !!ui;
  /* Editortext gehört jetzt den Dokumenten (initDocs, nach applyLang), damit der
     Standard-Dokumentname in der erkannten UI-Sprache steht. */
  const mode = (ui && ui.mode) || 'horizontal';
  const modeEl = document.querySelector('input[name="layout"][value="' + mode + '"]');
  if(modeEl) modeEl.checked = true;
  if(ui){
    if(typeof ui.discarded === 'boolean') setDiscarded(ui.discarded);
    if(typeof ui.cheapPath === 'boolean'){
      cheapPathOn = ui.cheapPath;
      cheapBtn.setAttribute('aria-pressed', cheapPathOn ? 'true' : 'false');
    }
    if(typeof ui.zoom === 'number') zoom = ui.zoom;
    if(ui.split) splitState = ui.split;
    if(ui.fullscreen){
      document.body.classList.add('fullscreen');
      fsBtn.classList.add('active');
      fsBtn.setAttribute('aria-pressed', 'true');
    }
  }
  applyLayout(mode);                 /* setzt Ausrichtung + ruft applySplit() */
  if(splitState === 'custom'){        /* freie Drag-Größen nach applySplit wieder setzen */
    if(ui && ui.col)  app.style.setProperty('--col', ui.col);
    if(ui && ui.drow) app.style.setProperty('--drow', ui.drow);
  }
  /* Legende (D26): Aufteilung gilt unabhängig vom Preset des großen Splitters. */
  if(ui && ui.hcol) app.style.setProperty('--hcol', ui.hcol);
  if(ui && ui.hrow) app.style.setProperty('--hrow', ui.hrow);
  if(ui && (ui.mobilePane === 'diagram' || ui.mobilePane === 'text')) mobilePane = ui.mobilePane;
  if(ui && PAD_VIEWS.indexOf(ui.padView) >= 0) padView = ui.padView;
  if(ui && ui.pcol) app.style.setProperty('--pcol', ui.pcol);
  if(ui && ui.prow) app.style.setProperty('--prow', ui.prow);
  setAgendaOpen(!!(ui && ui.agenda));
  applyZoom();
  restoring = false;
}

/* ---------- Dokument-Wähler: UI (Dropdown in der Editor-Titelzeile) ---------- */
const docTrigger = document.getElementById('docTrigger');
const docMenu = document.getElementById('docMenu');
const docNameEl = document.getElementById('docName');
const docList = document.getElementById('docList');
function updateDocName(){
  const d = activeDoc();
  if(docNameEl) docNameEl.textContent = d ? d.name : '';
  /* Aus einer URL geladene Dokumente (D23): die vollständige Quelle in den
     Tooltip, da der Name in der Titelzeile mit Ellipse abgeschnitten wird.
     Muss nach applyLang erneut laufen — das setzt data-i18n-title zurück. */
  if(docTrigger && d){
    docTrigger.title = d.source
      ? d.source + '\n' + t('docSwitchTooltip')
      : t('docSwitchTooltip');
  }
  updatePadLink();   /* Schreibschutz + Pad-Knopf hängen am aktiven Dokument (D31) */
}
let renamingId = null;   /* id des gerade inline umbenannten Dokuments (oder null) */
function renderDocMenu(){
  docList.innerHTML = docs.map(d => {
    if(d.id === renamingId){
      /* Inline-Umbenennen direkt im Menü (kein window.prompt — das ist in
         manchen Browser-Kontexten unterdrückt). Wert/Handler unten in JS. */
      return `<div class="docitem editing"><span class="doccheck" aria-hidden="true"></span>` +
             `<input type="text" class="docrename"></div>`;
    }
    return `<button type="button" class="docitem" role="menuitemradio" data-id="${d.id}" ` +
      `aria-checked="${d.id === activeId ? 'true' : 'false'}">` +
      `<span class="doccheck" aria-hidden="true">✓</span>` +
      `<span class="docitem-name">${esc(d.name)}</span></button>`;
  }).join('');
  if(renamingId){
    const inp = docList.querySelector('.docrename');
    const d = docs.find(x => x.id === renamingId);
    if(inp && d){
      inp.setAttribute('aria-label', t('docRename'));
      inp.value = d.name;
      inp.focus(); inp.select();
      inp.addEventListener('keydown', e => {
        if(e.key === 'Enter'){ e.preventDefault(); commitRename(); }
        else if(e.key === 'Escape'){ e.preventDefault(); cancelRename(); }
      });
      inp.addEventListener('blur', commitRename);
    }
  }
}
/* „Original wiederherstellen" (D22-Nachtrag): nur für die mitgelieferten
   Dokumente, und nur wenn sie vom Auslieferungsstand abweichen — der einzige
   Weg auf der Prod-Instanz (ohne Debug-Reset), ein bearbeitetes Beispiel
   wieder frisch zu bekommen. Bewusste Handlung mit Rückfrage statt stillem
   Überschreiben beim Laden (D22/D27: bearbeitete Inhalte nie anfassen). */
function shippedStateOf(id){
  if(id === EXAMPLE_ID) return {name: EXAMPLE_NAME, text: INITIAL};
  if(id === WERKBAUM_ID) return {name: WERKBAUM_NAME, text: WERKBAUM_DOC};
  return null;
}
function updateRestoreBtn(){
  const d = activeDoc();
  const shipped = d && shippedStateOf(d.id);
  const btn = document.getElementById('docRestore');
  /* Immer zeigen, wenn ein MITGELIEFERTES Dokument aktiv ist — nur ausgegraut,
     solange es dem Auslieferungsstand entspricht. Ganz versteckt war der
     Eintrag nicht auffindbar (Nutzer: „ich sehe keinen Reset-Button"). */
  btn.hidden = !shipped;
  btn.disabled = !!shipped && d.text === shipped.text && d.name === shipped.name;
}
function restoreDoc(){
  const d = activeDoc();
  const shipped = d && shippedStateOf(d.id);
  if(!shipped) return;
  if(!window.confirm(t('docRestoreConfirm', {name: d.name}))) return;
  d.text = shipped.text;
  d.name = shipped.name;
  foldOverrides.clear();
  loadActiveIntoEditor();
  persistDocs();
  closeDocMenu();
}
function openDocMenu(){ renderDocMenu(); updateRestoreBtn(); docMenu.hidden = false; docTrigger.setAttribute('aria-expanded', 'true'); }
function closeDocMenu(){ renamingId = null; docMenu.hidden = true; docTrigger.setAttribute('aria-expanded', 'false'); }
function toggleDocMenu(){ docMenu.hidden ? openDocMenu() : closeDocMenu(); }
/* Beim Wechseln/Anlegen/Löschen zuerst den aktuellen Editortext ins aktive
   Dokument sichern, dann das Ziel laden und neu rendern. */
function flushActive(){ const d = activeDoc(); if(d) d.text = src.value; }

/* ---------- „Was ist neu?" (D28) ----------
   Verglichen wird gegen die zuletzt **gesehene** Fassung eines Dokuments von
   außen (mitgeliefert oder ?sourceUrl=), nicht gegen die letzte Auslieferung:
   Wer mehrere Fassungen übersprungen hat, sieht alles seither. Die Basis wird
   deshalb erst beim Bestätigen fortgeschrieben — sonst wäre die Meldung nach
   einem Neuladen verschwunden, bevor sie jemand bemerkt hat. */
const LS_SEEN = 'werkbaum-seen';
function readSeen(){
  try{ const o = JSON.parse(localStorage.getItem(LS_SEEN) || '{}'); return o && typeof o === 'object' ? o : {}; }
  catch(_){ return {}; }
}
function markSeen(id, text){
  const o = readSeen();
  o[id] = text;
  try{ localStorage.setItem(LS_SEEN, JSON.stringify(o)); }catch(_){}
}
/* Nach dem Laden eines Dokuments von außen aufrufen. Beim Erstkontakt wird nur
   die Basis gesetzt und nichts hervorgehoben — sonst leuchtete beim ersten
   Ansehen der gesamte fertige Teil des Plans auf. */
function computeFresh(id, text){
  const prev = readSeen()[id];
  freshDocId = id;
  freshBaseline = text;
  if(typeof prev !== 'string'){
    freshPrevRoots = null;      /* Erstkontakt: nur Basis setzen, nichts leuchtet */
    markSeen(id, text);
  } else {
    freshPrevRoots = parse(prev).roots;   /* einmal parsen, render() vergleicht dagegen */
  }
}
function acknowledgeFresh(){
  if(freshDocId && freshBaseline !== null) markSeen(freshDocId, freshBaseline);
  freshPrevRoots = null;
  render();                     /* render() bildet die Menge neu und meldet dem Knopf */
}
const freshBtn = document.getElementById('freshBtn');
const freshCount = document.getElementById('freshCount');
function updateFreshBtn(){
  const n = freshDocId === activeId ? freshSet.size : 0;
  if(!freshBtn) return;
  freshBtn.hidden = !n;
  if(!n) return;
  freshCount.textContent = String(n);
  const tip = t('freshTooltip', {n: n});
  freshBtn.title = tip;
  freshBtn.setAttribute('aria-label', tip);
}
freshBtn.addEventListener('click', acknowledgeFresh);

function loadActiveIntoEditor(){ const d = activeDoc(); src.value = d ? d.text : ''; render(); updateDocName(); updateFreshBtn(); }
function switchDoc(id){
  if(id === activeId) return;
  flushActive();
  activeId = id;
  foldOverrides.clear();   /* Falt-Eingriffe gelten je Dokument-Sitzung (D38) */
  loadActiveIntoEditor();
  persistDocs();
}
function newDoc(){
  flushActive();
  const d = { id: uid(), name: uniqueName(t('docNewName')), text: '' };
  docs.push(d);
  activeId = d.id;
  foldOverrides.clear();
  loadActiveIntoEditor();
  persistDocs();
  keyboardOnJump(false);   /* neues, leeres Dokument = tippen ist gemeint */
  src.focus();
}
function renameDoc(){
  if(!activeDoc()) return;
  renamingId = activeId;   /* aktives Dokument inline umbenennen */
  renderDocMenu();
}
function commitRename(){
  if(!renamingId) return;
  const inp = docList.querySelector('.docrename');
  const d = docs.find(x => x.id === renamingId);
  const val = inp ? inp.value.trim() : '';
  renamingId = null;
  if(d && val){ d.name = val; persistDocs(); updateDocName(); }
  renderDocMenu();
}
function cancelRename(){ renamingId = null; renderDocMenu(); }
function deleteDoc(){
  const d = activeDoc();
  if(!d) return;
  if(!window.confirm(t('docDeleteConfirm', {name: d.name}))) return;
  if(padSource && padSource.id === d.id) stopPad();   /* danach gibt es nichts mehr zu holen (D31) */
  docs = docs.filter(x => x.id !== d.id);
  if(!docs.length) docs = [{ id: EXAMPLE_ID, name: EXAMPLE_NAME, text: INITIAL }];
  activeId = docs[0].id;
  foldOverrides.clear();
  loadActiveIntoEditor();
  persistDocs();
  closeDocMenu();
}
/* Dokumente laden + aktiven Text in den Editor holen (nach applyLang). */
function initDocs(){
  restoring = true;
  loadDocs();
  const d = activeDoc();
  src.value = d ? d.text : '';
  restoring = false;
  persistDocs();   /* migrierte/geladene Liste festschreiben (stabil über Reload) */
  updateDocName();
  render();
}

/* ---------- Text von außen: ?sourceUrl= (D23) und ?etherpad= (D31) ----------
   Beide holen einen Notationstext über http(s) und führen ihn als eigenes
   Dokument. Die id leitet sich aus der URL ab: derselbe Link aktualisiert dieses
   Dokument, statt bei jedem Aufruf ein neues anzulegen. Eigene Dokumente des
   Nutzers bleiben unberührt. Scheitert das Laden (häufigster Fall: das Ziel
   sendet keinen CORS-Header), bleibt der bisherige Stand stehen und es
   erscheint eine Warnung.

   Unterschied: `sourceUrl` ist eine statische Datei, einmal pro Laden geholt
   (D23, unverändert). `etherpad` ist ein lebendes Pad — wiederholt geholt und
   hier schreibgeschützt, weil das Zusammenführen gleichzeitiger Änderungen
   Etherpads Aufgabe ist. Ein Fetch-Pfad, zwei Eingänge. */
const SOURCE_PARAM = 'sourceUrl';
const ETHERPAD_PARAM = 'etherpad';
function urlParam(name){
  try{ return new URLSearchParams(location.search).get(name); }catch(_){ return null; }
}
function sourceUrlParam(){ return urlParam(SOURCE_PARAM); }

/* Woher kommt der Text? null = kein Parameter, {bad,error} = unbrauchbare
   Angabe, sonst der Beschreiber für loadRemoteSource(). Die Normalisierung der
   Pad-Adresse steht headless in remote.js — dort auch ihre Begründung. */
function remoteSource(){
  const padRaw = urlParam(ETHERPAD_PARAM);
  if(padRaw){
    const p = padUrls(padRaw, location.href);
    if(!p) return {bad: padRaw, error: 'not an Etherpad URL'};
    return {fetchUrl: p.text, id: 'url:' + p.pad, name: p.pad, source: p.pad, live: true};
  }
  const raw = sourceUrlParam();
  if(!raw) return null;
  let url;
  /* Relative Angaben gegen die Seite auflösen; nur http(s) zulassen (kein
     file:/data:/javascript: — die Notation selbst erlaubt ohnehin nur http(s)). */
  /* Fehlerdetail bewusst technisch/englisch wie die Browser-Meldungen
     („Failed to fetch", „HTTP 404") — der Rahmentext ist lokalisiert. */
  try{ url = new URL(raw, location.href); }catch(_){ return {bad: raw, error: 'invalid URL'}; }
  if(url.protocol !== 'http:' && url.protocol !== 'https:') return {bad: url.href, error: url.protocol};
  return {fetchUrl: url.href, id: 'url:' + url.href, name: url.href, source: url.href, live: false};
}

/* `timeoutMs` nur beim Pad-Takt (D31): Hängt die Gegenseite, muss der Abruf
   abbrechen, sonst bliebe der Riegel `padBusy` für immer zu und es käme nie
   wieder etwas. Der erste Ladeversuch wartet unbegrenzt wie bisher (D23). */
async function fetchRemote(url, timeoutMs){
  const ctl = timeoutMs ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try{
    const resp = await fetch(url, {cache:'no-store', credentials:'omit',
                                   signal: ctl ? ctl.signal : undefined});
    if(!resp.ok) throw new Error('HTTP ' + resp.status);
    return await resp.text();
  } finally { if(timer) clearTimeout(timer); }
}
/* Geholten Text als Dokument übernehmen und aktivieren. Gemeinsam genutzt vom
   ersten Ladeversuch und vom Pad-Takt, wenn dieser einen gescheiterten ersten
   Versuch nachholt — sonst gäbe es zwei Fassungen derselben sechs Zeilen. */
function adoptRemote(s, text){
  flushActive();                       /* laufende Bearbeitung nicht verlieren */
  let d = docs.find(x => x.id === s.id);
  if(d){ d.text = text; d.name = s.name; }
  else { d = {id: s.id, name: s.name, text}; docs.push(d); }
  d.source = s.source;
  activeId = s.id;
  sourceWarning = null;
  computeFresh(s.id, text);   /* was ist seit dem letzten Ansehen in Produktion? (D28) */
  loadActiveIntoEditor();
  persistDocs();
}
async function loadRemoteSource(){
  const s = remoteSource();
  if(!s) return;
  if(s.bad !== undefined){
    sourceWarning = {type:'sourceLoad', url: s.bad, error: s.error};
    render();
    return;
  }
  /* `padSource` **vor** dem ersten Abruf setzen: Es trägt den Schreibschutz
     (muss also vor loadActiveIntoEditor() stehen) und macht den Neu-laden-Knopf
     erreichbar. Scheitert der erste Abruf — die Gegenseite fällt beobachtbar mal
     aus —, bleibt der Knopf also da und man kommt ohne Neuladen weiter. */
  if(s.live){ padSource = s; padBusy = true; setPadCooldown(PAD_MIN_GAP_MS); }
  try{
    adoptRemote(s, await fetchRemote(s.fetchUrl));
  }catch(err){
    /* CORS-Fehler melden sich als „TypeError: Failed to fetch" ohne Details —
       der Warntext nennt CORS daher ausdrücklich als wahrscheinliche Ursache.
       Bei einem Pad ist das nicht das Ende: der Knopf holt es nach und räumt die
       Warnung weg, sobald ein Abruf gelingt. */
    sourceWarning = {type:'sourceLoad', url: s.fetchUrl, error: (err && err.message) || String(err)};
    updatePadLink();   /* Knopf zeigen, obwohl kein Dokument entstanden ist */
    render();
  }finally{
    if(s.live) padBusy = false;
  }
}

/* ---------- Pad: auf Knopfdruck neu holen (D31) ----------
   Kein Hintergrund-Takt. Der erste Entwurf holte alle 2,5 s selbsttätig — und
   lief damit in Etherpads **Drosselung**: `importExportRateLimiting` ist
   serienmäßig an und lässt 10 Abrufe je 90 s und IP zu, der Takt wollte 36.
   Danach hält die Gegenseite die Verbindung einfach offen (kein `429`, keine
   Kopfzeilen), der Abbruch reißt sie ab — im Netzwerk-Mitschnitt „cancelled",
   und es kommt kaum je etwas an. Ein Knopf ist ohnehin ehrlicher gegenüber
   fremder Infrastruktur: geholt wird, wenn jemand es will. Zusammen mit
   „Was ist neu?" (D28) ergibt das die bessere Geschichte — Knopf drücken, und
   was seither in Produktion ging, leuchtet auf. */
const PAD_FETCH_TIMEOUT_MS = 20000;
/* Mindestabstand zwischen zwei Abrufen. 10 s ergibt höchstens **9** Abrufe je
   90 s und bleibt damit beweisbar unter Etherpads Voreinstellung (10 je 90 s) —
   die Drosselung wird also gar nicht erst ausgelöst. Nach einem Abbruch sind wir
   schon drüber: dann das ganze Fenster abwarten, statt weiter dagegen zu rennen. */
const PAD_MIN_GAP_MS = 10000;
const PAD_BACKOFF_MS = 90000;
let padSource = null;    /* Beschreiber der aktiven Pad-Quelle, oder null */
let padBusy = false;     /* ein Abruf unterwegs — schützt vor Doppelklick */
let padNextAllowed = 0;  /* Zeitpunkt (ms), ab dem wieder geholt werden darf */
let padCoolTimer = null;
/* Wer das Pad-Dokument löscht, meint es: danach gibt es nichts mehr zu holen. */
function stopPad(){ padSource = null; }
function padCoolLeft(){ return Math.max(0, padNextAllowed - Date.now()); }
function setPadCooldown(ms){ padNextAllowed = Date.now() + ms; tickPadCooldown(); }
/* Der Sekundenzähler läuft **nur** während der Sperre und hält sich selbst an. */
function tickPadCooldown(){
  if(padCoolTimer){ clearInterval(padCoolTimer); padCoolTimer = null; }
  updatePadRefreshLabel();
  if(padCoolLeft() <= 0) return;
  padCoolTimer = setInterval(() => {
    updatePadRefreshLabel();
    if(padCoolLeft() <= 0){ clearInterval(padCoolTimer); padCoolTimer = null; }
  }, 1000);
}
/* Sperre sichtbar machen, aber den Knopf **klickbar** lassen: Ein `disabled`
   erklärt nichts. So kann der Klick den Grund melden (Live-Region `#warn`). */
function updatePadRefreshLabel(){
  if(!padRefreshBtn || padRefreshBtn.hidden) return;
  const left = Math.ceil(padCoolLeft()/1000);
  padRefreshBtn.classList.toggle('cooling', left > 0);
  padRefreshBtn.setAttribute('aria-disabled', left > 0 ? 'true' : 'false');
  const tip = left > 0 ? t('padWait', {seconds: left}) : t('padRefresh');
  padRefreshBtn.title = tip;
  padRefreshBtn.setAttribute('aria-label', tip);
}
/* Rückmeldung während des Abrufs: Bei einer gedrosselten Gegenseite können das
   die vollen 20 s sein — ohne Zeichen wirkt der Knopf kaputt. */
function setPadBusy(on){
  if(!padRefreshBtn) return;
  padRefreshBtn.classList.toggle('busy', on);
  padRefreshBtn.setAttribute('aria-busy', on ? 'true' : 'false');
}
async function refreshPad(){
  const s = padSource;
  if(!s || padBusy) return;
  if(padCoolLeft() > 0){
    /* Nicht heimlich nichts tun: Der Grund ist eine fremde Grenze, und die
       gehört gesagt — sonst wirkt der Knopf kaputt. Die Meldung landet im
       Warnbereich, der eine Live-Region ist und deshalb angesagt wird. */
    sourceWarning = {type:'padRateLimit', seconds: Math.ceil(padCoolLeft()/1000)};
    render();
    return;
  }
  padBusy = true;
  setPadBusy(true);
  setPadCooldown(PAD_MIN_GAP_MS);
  let text;
  try{ text = await fetchRemote(s.fetchUrl, PAD_FETCH_TIMEOUT_MS); }
  catch(err){
    /* Anders als ein Hintergrund-Takt ist das eine bewusste Handlung — sie
       braucht eine Antwort, auch wenn sie schiefgeht. Ein Abbruch bekommt einen
       **eigenen** Warnungstyp: `sourceLoad` zeigt auf CORS, und bei einer
       Drosselung schickte das den Leser auf die falsche Fährte. */
    if(err && err.name === 'AbortError'){
      /* Abbruch heißt: Wir sind schon in der Drosselung. Weiterklicken hilft
         nicht, also das ganze Fenster abwarten — und das dem Nutzer sagen. */
      setPadCooldown(PAD_BACKOFF_MS);
      sourceWarning = {type:'sourceTimeout', url: s.fetchUrl,
                       seconds: Math.round(PAD_FETCH_TIMEOUT_MS/1000)};
    } else {
      sourceWarning = {type:'sourceLoad', url: s.fetchUrl, error: (err && err.message) || String(err)};
    }
    render();
    return;
  }
  finally{ padBusy = false; setPadBusy(false); }
  if(padRefreshBtn) flashBtn(padRefreshBtn);
  const d = docs.find(x => x.id === s.id);
  if(!d){
    /* Kein Dokument: der erste Ladeversuch ist gescheitert. Jetzt nachholen —
       anlegen und aktivieren wie beim Laden. */
    adoptRemote(s, text);
    return;
  }
  /* Ein geglückter Abruf räumt die Warnung des ersten Versuchs weg — sonst
     stünde „konnte nicht geladen werden", während der Text längst da ist. */
  const hadWarning = !!sourceWarning;
  sourceWarning = null;
  if(text === d.text){ if(hadWarning) render(); return; }
  d.text = text;
  persistDocs();
  if(activeId !== d.id) return;        /* im Hintergrund still aktualisiert */
  /* Auswahl und Scrollstand erhalten — der Sprung aus dem Diagramm (D25) und
     die Cursor-Zeile sollen einen Abruf überleben. */
  const top = src.scrollTop, a = src.selectionStart, b = src.selectionEnd;
  src.value = text;
  try{ src.setSelectionRange(a, b); }catch(_){}
  src.scrollTop = top;
  computeFresh(d.id, text);            /* Basis bleibt die zuletzt bestätigte Fassung */
  render();
  updateFreshBtn();
}

/* ---------- Ansicht bei einem Pad-Dokument: beide | nur Pad | nur Spiegel ----
   Das Pad lässt sich einbetten (nachgemessen: kein `X-Frame-Options`, keine CSP
   mit `frame-ancestors`), doch es ersetzt nicht einfach das Textfeld: Alt+Klick
   und die Cursor-Zeile (D25) arbeiten auf **unserem** `<textarea>`, und in einen
   fremdstämmigen Rahmen kommt kein DOM-Zugriff. Deshalb drei Ansichten statt
   einer Entscheidung — in „beide" bleibt der Spiegel schmal ziehbar und trägt
   weiter die Sprünge.

   Ein **Wähler** statt dreier Knöpfe: Die Editor-Titelzeile ist schon voll
   (Dokument, Pad, Neu laden, Kopieren, Legende, Fenster), und auf kleinem
   Bildschirm (D17) ist sie es dreifach. Derselbe Reihum-Griff wie beim
   Modus-Wähler dort.

   Der Rahmen wird **nur geladen, wenn er sichtbar ist** (`about:blank` sonst).
   Das ist kein Geiz: Ein geladenes Pad verbindet sich per Socket und macht dich
   in der Anwesenden-Liste sichtbar. „Nur Spiegel" ist damit die Ansicht, die
   nichts von dir verrät. */
const padFrame = document.getElementById('padFrame');
const srcArea = document.getElementById('srcArea');
const padGutter = document.getElementById('padGutter');
const padViewBtn = document.getElementById('padViewBtn');
function applyPadView(){
  const d = activeDoc();
  const isPad = !!(d && padSource && d.id === padSource.id);
  const show = isPad ? padView : 'text';
  if(srcArea) srcArea.className = 'src-area pv-' + show;
  if(padViewBtn){
    padViewBtn.hidden = !isPad;
    padViewBtn.dataset.view = show;
    const tip = t('padViewTooltip', {state: t('padView_' + show)});
    padViewBtn.title = tip;
    padViewBtn.setAttribute('aria-label', tip);
  }
  if(padGutter) padGutter.hidden = (show !== 'both');
  if(!padFrame) return;
  const wantFrame = isPad && show !== 'text';
  padFrame.hidden = !wantFrame;
  const wantSrc = wantFrame ? padViewUrl(padSource.source) : 'about:blank';
  if(padFrame.getAttribute('src') !== wantSrc) padFrame.setAttribute('src', wantSrc);
}
/* Zeilennummern und Monospace sind für diese Notation die richtige Darstellung;
   der Chat kostet in einem schmalen Rahmen nur Platz. */
function padViewUrl(padUrl){
  return padUrl + '?showChat=false&showLineNumbers=true&useMonospaceFont=true';
}
function cyclePadView(){
  padView = PAD_VIEWS[(PAD_VIEWS.indexOf(padView) + 1) % PAD_VIEWS.length];
  applyPadView();
  saveUI();
}
if(padViewBtn) padViewBtn.addEventListener('click', cyclePadView);

/* Ein Pad-Dokument wird im Pad bearbeitet, nicht hier (D31): Textfeld
   schreibgeschützt, Knopf in der Titelzeile öffnet das Pad im neuen Tab. Ohne
   den Schutz verschwände getippter Text beim nächsten Abruf. */
const padLink = document.getElementById('padLink');
const padRefreshBtn = document.getElementById('padRefresh');
function updatePadLink(){
  const d = activeDoc();
  const isPad = !!(d && padSource && d.id === padSource.id);
  src.readOnly = isPad;
  src.classList.toggle('readonly', isPad);
  if(srcWrap) srcWrap.classList.toggle('readonly', isPad);   /* Streifen mit abtönen */
  if(isPad) src.title = t('padReadonly'); else src.removeAttribute('title');
  if(padLink){
    padLink.hidden = !isPad;
    if(isPad){
      padLink.href = padSource.source;
      padLink.title = t('padEdit');
      padLink.setAttribute('aria-label', t('padEdit'));
    }
  }
  /* Der Neu-laden-Knopf erscheint auch, wenn es das Pad-Dokument noch **nicht**
     gibt: Dann ist der erste Abruf gescheitert, und genau dieser Knopf ist der
     Weg zurück — ohne ihn bliebe nur Neuladen der Seite. */
  if(padRefreshBtn){
    const pending = !!(padSource && !docs.some(x => x.id === padSource.id));
    padRefreshBtn.hidden = !(isPad || pending);
    updatePadRefreshLabel();   /* trägt auch den laufenden Sperr-Zähler */
  }
  applyPadView();
}
if(padRefreshBtn) padRefreshBtn.addEventListener('click', refreshPad);
docTrigger.addEventListener('click', e => {
  /* Desktop: ist der Editor minimiert, stellt ein Klick ihn wieder her
     (Bubbling zur Titelzeile) statt das Menü zu öffnen. */
  if(!isMobile() && editorPanel.classList.contains('collapsed')) return;
  e.stopPropagation();
  toggleDocMenu();
});
docTrigger.addEventListener('keydown', e => {
  if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleDocMenu(); }
  else if(e.key === 'Escape') closeDocMenu();
});
docList.addEventListener('click', e => {
  const btn = e.target.closest('.docitem');
  if(!btn) return;
  e.stopPropagation();
  switchDoc(btn.dataset.id);
  closeDocMenu();
});
document.getElementById('docNew').addEventListener('click', e => { e.stopPropagation(); newDoc(); renderDocMenu(); });
document.getElementById('docRename').addEventListener('click', e => { e.stopPropagation(); renameDoc(); });
document.getElementById('docDelete').addEventListener('click', e => { e.stopPropagation(); deleteDoc(); });
document.getElementById('docRestore').addEventListener('click', e => { e.stopPropagation(); restoreDoc(); });
/* Klick außerhalb schließt das Menü. */
document.addEventListener('click', e => {
  if(!docMenu.hidden && !docMenu.contains(e.target) && !docTrigger.contains(e.target)) closeDocMenu();
});

/* ---------- Kleiner Bildschirm: nur ein Panel, schlanke Sprachwahl, Vollbild ---------- */
const mqMobile = window.matchMedia('(max-width:640px)');
function isMobile(){ return mqMobile.matches; }

/* Exakte sichtbare Höhe (--app-height) aus window.visualViewport ableiten.
   Nötig, weil manche Browser (z. B. Brave) ihre untere Leiste als Overlay
   zeichnen: 100dvh meldet dann weiterhin die volle Höhe, und Footer/Editor-
   Titelzeile verschwinden dahinter. visualViewport.height liefert die wirklich
   sichtbare Fläche. Fällt es weg, greift die CSS-Kaskade (dvh/vh). */
/* ABER: Die **Bildschirmtastatur** verkleinert genau diesen Wert — dafür ist
   `visualViewport` gemacht. Ungefiltert übernommen quetscht sie den Editor
   zusammen, sobald man den Cursor ins Textfeld setzt: Die Textfeldhöhe ist
   `--app-height` minus rund 206 px feste Aufbauten (Kopfzeile, Titelzeile,
   Fußzeile), aus 812 px werden also mit offener Tastatur schnell 260 px und
   damit ein Textfeld von 54 px. Genau das war die Fehlermeldung — und sie
   zeigt sich **nur auf echten Geräten**, weil es in der Emulation keine
   Tastatur gibt.
   Unterschieden wird am **Fokus**: Die Tastatur steht nur, wenn ein
   editierbares Feld den Fokus hat. Solange das so ist, bleibt die zuletzt
   tastaturfreie Höhe stehen — die Seite behält ihre Größe und der Browser
   schiebt den sichtbaren Ausschnitt zur Schreibmarke, wie in jeder anderen
   App. Die Brave-Leiste (der eigentliche Anlass) wird davon nicht berührt,
   sie erscheint ohne Fokus im Textfeld. */
function editingNow(){
  const el = document.activeElement;
  if(!el) return false;
  return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable;
}
function setAppHeight(force){
  if(!force && editingNow()) return;
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-height', Math.round(h) + 'px');
}
setAppHeight(true);
window.addEventListener('resize', () => setAppHeight());
/* Drehen MUSS auch beim Tippen greifen — sonst behielte die Seite die Höhe des
   alten Hochformats. */
window.addEventListener('orientationchange', () => setAppHeight(true));
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', () => setAppHeight());
}
/* Nach dem Verlassen des Textfelds nachziehen: Die meisten Browser melden das
   Schließen der Tastatur ohnehin als `resize`, aber dann steht der Fokus schon
   woanders — und falls die Meldung ausbleibt, holt es dieser Weg nach. */
window.addEventListener('focusout', () => setTimeout(() => setAppHeight(), 250));
/* ---------- Legende: auf/zu + Splitter zum Editor (D26) ----------
   Die Legende ist ein gewöhnlicher Container (kein <details> mehr, siehe
   style.css/D26); der Auf-/Zu-Zustand hängt an der Klasse `open`. */
const legendBtn = document.getElementById('legendBtn');
const agenda = document.getElementById('agenda');
const agendaToggle = document.getElementById('agendaToggle');
const hintGutter = document.getElementById('hintGutter');
const editorBody = document.querySelector('.editor-body');
function agendaOpen(){ return agenda.classList.contains('open'); }
function setAgendaOpen(on){
  agenda.classList.toggle('open', on);
  agendaToggle.setAttribute('aria-expanded', on ? 'true' : 'false');
  legendBtn.classList.toggle('active', on);
  hintGutter.hidden = !on;   /* ohne offene Legende gibt es nichts zu teilen */
  saveUI();
}
legendBtn.addEventListener('click', () => setAgendaOpen(!agendaOpen()));
agendaToggle.addEventListener('click', () => setAgendaOpen(!agendaOpen()));

/* Splitter Editor|Legende. Im horizontalen Modus liegen sie nebeneinander
   (Legendenbreite `--hcol`), in den gestapelten Modi untereinander
   (Legendenhöhe `--hrow`) — dieselbe Fallunterscheidung wie beim großen
   Splitter. Gezogen wird von der Editorseite aus, die Legende behält also
   den Abstand zum jeweils gegenüberliegenden Rand. */
const HINT_MIN = 90;          /* Titelzeile + ein paar Zeilen bleiben immer da */
const HINT_MAX_SHARE = 0.85;
function editorStacked(){ return isMobile() || app.classList.contains('side'); }
let hintDragging = false;
hintGutter.addEventListener('pointerdown', e => {
  hintDragging = true;
  hintGutter.classList.add('dragging');
  hintGutter.setPointerCapture(e.pointerId);
  document.body.style.userSelect = 'none';
  e.preventDefault();
});
hintGutter.addEventListener('pointermove', e => {
  if(!hintDragging) return;
  const b = editorBody.getBoundingClientRect();
  if(editorStacked()){
    const h = Math.min(Math.max(b.bottom - e.clientY, HINT_MIN), b.height * HINT_MAX_SHARE);
    app.style.setProperty('--hrow', Math.round(h) + 'px');
  } else {
    const w = Math.min(Math.max(b.right - e.clientX, HINT_MIN), b.width * HINT_MAX_SHARE);
    app.style.setProperty('--hcol', Math.round(w) + 'px');
  }
});
function endHintDrag(e){
  if(!hintDragging) return;
  hintDragging = false;
  hintGutter.classList.remove('dragging');
  document.body.style.userSelect = '';
  try{ hintGutter.releasePointerCapture(e.pointerId); }catch(_){}
  saveUI();
}
hintGutter.addEventListener('pointerup', endHintDrag);
hintGutter.addEventListener('pointercancel', endHintDrag);
/* Doppelklick stellt die Vorgabegröße wieder her (CSS-Default greift dann). */
hintGutter.addEventListener('dblclick', () => {
  app.style.removeProperty('--hcol');
  app.style.removeProperty('--hrow');
  saveUI();
});
/* Splitter Pad|Spiegel (D31) — dieselbe Mechanik wie beim Legenden-Splitter
   (D26): gezogen wird von der Spiegelseite aus, Doppelklick setzt zurück,
   Ausrichtung folgt der Panel-Anordnung. Beide Werte werden getrennt gehalten,
   damit ein Moduswechsel die jeweils andere Aufteilung nicht zerstört. */
const PAD_MIN = 120;          /* schmal darf er werden — aber lesbar bleiben */
const PAD_MAX_SHARE = 0.85;
let padDragging = false;
padGutter.addEventListener('pointerdown', e => {
  padDragging = true;
  padGutter.classList.add('dragging');
  padGutter.setPointerCapture(e.pointerId);
  document.body.style.userSelect = 'none';
  e.preventDefault();
});
padGutter.addEventListener('pointermove', e => {
  if(!padDragging) return;
  const b = srcArea.getBoundingClientRect();
  if(editorStacked()){
    const h = Math.min(Math.max(b.bottom - e.clientY, PAD_MIN), b.height * PAD_MAX_SHARE);
    app.style.setProperty('--prow', Math.round(h) + 'px');
  } else {
    const w = Math.min(Math.max(b.right - e.clientX, PAD_MIN), b.width * PAD_MAX_SHARE);
    app.style.setProperty('--pcol', Math.round(w) + 'px');
  }
});
function endPadDrag(e){
  if(!padDragging) return;
  padDragging = false;
  padGutter.classList.remove('dragging');
  document.body.style.userSelect = '';
  try{ padGutter.releasePointerCapture(e.pointerId); }catch(_){}
  saveUI();
}
padGutter.addEventListener('pointerup', endPadDrag);
padGutter.addEventListener('pointercancel', endPadDrag);
padGutter.addEventListener('dblclick', () => {
  app.style.removeProperty('--pcol');
  app.style.removeProperty('--prow');
  saveUI();
});

/* Modus-Wähler auf kleinem Bildschirm: es ist nur das aktive Icon sichtbar,
   Tippen schaltet zum nächsten Modus (reihum). Auf normaler Größe bleibt es
   der Dreier-Umschalter — dort kehrt der Handler sofort zurück. */
const seg = document.querySelector('.seg');
const LAYOUT_MODES = ['horizontal','kompakt','vertikal'];
seg.addEventListener('click', e => {
  if(!isMobile()) return;
  e.preventDefault();
  e.stopPropagation();   /* nicht zum Titelzeilen-Maximieren durchreichen */
  const cur = document.querySelector('input[name="layout"]:checked').value;
  const next = LAYOUT_MODES[(LAYOUT_MODES.indexOf(cur) + 1) % LAYOUT_MODES.length];
  const r = document.querySelector('input[name="layout"][value="' + next + '"]');
  r.checked = true;
  r.dispatchEvent(new Event('change', {bubbles:true}));
});
function applyMobile(){
  const m = isMobile();
  document.body.classList.toggle('mobile', m);
  if(m) collapseLangsel();   /* Sprachleiste eingeklappt starten (Overlay-Logik) */
  if(!m){
    /* Zurück auf Desktop: die Pane-Klassen abräumen, sonst bliebe ein Panel
       ausgeblendet — die Regeln hängen zwar an `body.mobile`, aber ein
       stehengebliebener Zustand ist beim nächsten Verkleinern verwirrend. */
    document.body.classList.remove('pane-diagram', 'pane-text');
    applyZoom();   /* Mobil-Faktor wieder herausrechnen (D17-Nachtrag 2) */
    return;
  }
  /* Genau ein Bereich (D17-Nachtrag): kein Desktop-Collapse, keine Aufteilung.
     Die frühere freie --drow-Größe wird abgeräumt — sie hat hier keine
     Bedeutung mehr und störte die Grid-Zeile. */
  clearCollapse();
  app.style.removeProperty('--drow');
  applyMobilePane();
  applyZoom();   /* Mobil-Faktor an-/abschalten (D17-Nachtrag 2) */
  /* Default Vollbild auf kleinem Bildschirm — nur ohne gespeicherte Wahl. */
  if(!hadStoredUI && !document.body.classList.contains('fullscreen')){
    document.body.classList.add('fullscreen');
    fsBtn.classList.add('active');
    fsBtn.setAttribute('aria-pressed', 'true');
    saveUI();
  }
}
mqMobile.addEventListener('change', applyMobile);

restoreState();   /* Editortext + GUI-Zustand aus dem Browser wiederherstellen */

/* Default-Sprache: gespeicherte Wahl, sonst die erste vom Browser gemeldete
   Sprache (navigator.languages), die wir übersetzt haben — sonst Deutsch.
   Nur der Primär-Subtag zählt (z. B. "de-AT" -> "de", "zh-Hans" -> "zh"). */
function detectLang(){
  const cands = (navigator.languages && navigator.languages.length)
    ? navigator.languages : [navigator.language];
  for(const c of cands){
    const primary = (c || '').toLowerCase().split('-')[0];
    if(I18N[primary]) return primary;
  }
  return 'de';
}
let startLang = 'de';
try{ startLang = localStorage.getItem('werkbaum-lang') || detectLang(); }catch(_){ startLang = detectLang(); }
applyLang(I18N[startLang] ? startLang : 'de');   /* setzt Texte + rendert */
initDocs();      /* Dokumente laden + aktiven Text in den Editor (nach Sprache) */
applyMobile();   /* Mobil-Verhalten (nach Sprache/Restore) anwenden */
loadRemoteSource();    /* ?sourceUrl= / ?etherpad= nachladen (asynchron, D23/D31) */

/* ---------- Build-Hinweis (Vorschau/Dev + „latest build") ----------
   Kennzeichnet einen nicht-produktiven Build mit einem kleinen Symbol samt
   Tooltip hinter dem Titel. Gesteuert per Vite-Env `VITE_BUILD_BADGE`; ohne
   Vorgabe entscheidet der Modus:
     Dev-Server (`npm run dev`)      -> import.meta.env.DEV -> 'dev' (🔧 Vorschau)
     Default-Build (`npm run build`) -> Voreinstellung        -> 'latest' (🚧)
     `npm run build:prod`            -> .env.prod: none        -> KEIN Badge
   So trägt einzig die echte Produktions-Installation keinen Hinweis. Bewusst
   kein I18N-Text (Deploy-Metainfo, nicht Produkt-Feature; D14/D16) — der
   Tooltip ist knapp zweisprachig (DE · EN). */
function mountBuildBadge(){
  const kind = import.meta.env.VITE_BUILD_BADGE
    || (import.meta.env.DEV ? 'dev' : 'latest');
  if(kind === 'none') return;
  const BADGES = {
    dev:    {icon:'🔧', label:'Preview build (local dev)',
             title:'Vorschau – lokaler Entwicklungsstand · Preview (local dev build)'},
    latest: {icon:'🚧', label:'Latest build – may be buggy',
             title:'Aktueller Entwicklungsstand (latest build) – kann noch Fehler enthalten · Latest development build – may still be buggy'},
  };
  const b = BADGES[kind];
  const h1 = document.querySelector('header h1');
  if(!b || !h1) return;
  const el = document.createElement('span');
  el.className = 'build-badge';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', b.label);
  el.title = b.title;
  el.textContent = b.icon;
  h1.appendChild(el);
}
mountBuildBadge();

/* ---------- Editor-Panel: Copy & Agenda Buttons nur sichtbar wenn Panel offen genug ---------- */
(function() {
  const editorPanelEl = document.querySelector('.panel.editor');
  const editorHeadEl = editorPanelEl?.querySelector('.panel-head');
  const editorBodyEl = editorPanelEl?.querySelector('.editor-body');
  const copyBtnEl = document.getElementById('copy');
  const legendBtnEl = document.getElementById('legendBtn');

  if(editorBodyEl && editorHeadEl && copyBtnEl && legendBtnEl){
    const updateButtonVisibility = () => {
      const headHeight = editorHeadEl.offsetHeight;
      const bodyHeight = editorBodyEl.offsetHeight;
      /* Buttons nur sichtbar wenn mindestens Titelzeilenhöhe sichtbar ist */
      const shouldShow = bodyHeight >= headHeight;
      copyBtnEl.style.display = shouldShow ? 'block' : 'none';
      legendBtnEl.style.display = shouldShow ? 'block' : 'none';
    };

    const resizeObserver = new ResizeObserver(updateButtonVisibility);
    resizeObserver.observe(editorBodyEl);
    updateButtonVisibility(); /* Initial call */
  }
})();

/* ---------- Update-Detection (Client-seitig, einfach & zuverlässig) ---------- */
/* Test-Hilfen (Debug-Panel + Reset-Button) nur AUSSERHALB des Prod-Builds:
   im Prod-Build (`build:prod` -> VITE_BUILD_BADGE==='none') eliminiert esbuild
   den Zweig als toten Code — analog zum Build-Badge (D16). Dev-Server (🔧) und
   Default-/Pages-Build (🚧) behalten sie. Der Update-Check + Banner bleibt in
   ALLEN Builds aktiv. */
const isProdBuild = import.meta.env.VITE_BUILD_BADGE === 'none';

/* Kompakter, deterministischer Hash (cyrb53) über den GESAMTEN HTML-Text.
   Wichtig: Der frühere Ansatz „erste 300 + letzte 300 Zeichen" verfehlte JEDE
   Änderung — die Seite ist eine self-contained Datei (D19), der komplette
   App-Code UND die Footer-Version liegen als inline-Bundle in der MITTE, also
   außerhalb des abgetasteten Fensters. Anfang/Ende sind Build-übergreifend
   identisch. Nur ein Hash über den vollen Text erkennt neue Deployments. */
function hashContent(str){
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for(let i = 0; i < str.length; i++){
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
  h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1>>>0)).toString(36);
}

async function checkForUpdates(){
  try {
    /* Fetch HTML mit Cache-Busting via Timestamp. Über URL/searchParams gebaut,
       damit ein bereits vorhandener Query-String (z. B. ?sourceUrl=…, D23) nicht
       durch ein angehängtes zweites „?" zerstört wird. */
    const bust = new URL(location.href);
    bust.searchParams.set('t', String(new Date().getTime()));
    const resp = await fetch(bust.href, { cache: 'no-store' });
    if(!resp.ok) throw new Error(`HTTP ${resp.status}`);

    /* Voller Content-Hash ist die alleinige Wahrheit. ETag/Last-Modified werden
       bewusst NICHT mehr herangezogen: GitHub Pages liefert je Cache-Knoten
       unterschiedliche ETags für identischen Inhalt und löste damit die
       irreführende Meldung „Metadaten geändert, aber Inhalt gleich" aus. */
    const html = await resp.text();
    const hash = hashContent(html);
    const stored = localStorage.getItem('werkbaum-html-hash');

    if(!stored){
      logUpdate('✓ Erste Prüfung – Hash gespeichert');
    } else if(hash === stored){
      logUpdate('✓ Alles aktuell');
    } else {
      localStorage.setItem('werkbaum-update-available', 'true');
      logUpdate('✅ NEUE VERSION ERKANNT!');
      if(!document.hidden) checkAndShowUpdateNotification();
    }

    localStorage.setItem('werkbaum-html-hash', hash);
  } catch(err) {
    const msg = err.message || err.toString();
    if(msg.includes('Failed to fetch')) {
      logUpdate('⚠ Netzwerk offline / CORS-Block');
    } else {
      logUpdate('⚠ ' + msg.substring(0, 30));
    }
  }
}

function logUpdate(msg){
  const now = new Date().toLocaleTimeString('de-DE');
  const log = (localStorage.getItem('werkbaum-update-log') || '').split('\n').slice(-9);
  log.push(`[${now}] ${msg}`);
  localStorage.setItem('werkbaum-update-log', log.join('\n'));
}

/* Debug-Panel anzeigen (Test-Hilfe; im Prod-Build unterdrückt).
   Ein Klick **minimiert** es auf ein Icon unten rechts, ein weiterer holt es
   zurück. Vorher entfernte der Klick es ganz — das half nichts, weil der
   15-Sekunden-Takt es gleich wieder aufbaute; auf dem Telefon verdeckte es so
   dauerhaft die untere rechte Ecke. Der Zustand liegt im localStorage, nicht am
   Element: Das Panel wird bei jedem Takt neu bespielt und überlebt so auch ein
   Neuladen. */
const LS_DEBUG_MIN = 'werkbaum-update-debug-min';
function paintUpdateDebug(panel){
  const min = localStorage.getItem(LS_DEBUG_MIN) === '1';
  panel.style.cssText =
    'position:fixed;bottom:10px;right:10px;z-index:999;' +
    'background:rgba(0,0,0,0.9);color:#0F766E;border:1px solid #0F766E;' +
    'font-family:monospace;cursor:pointer;' +
    (min
      ? 'width:26px;height:26px;padding:0;border-radius:50%;font-size:14px;' +
        'display:flex;align-items:center;justify-content:center;overflow:hidden;'
      : 'padding:12px;border-radius:4px;font-size:11px;max-width:240px;' +
        'max-height:120px;overflow-y:auto;white-space:pre-wrap;');
  panel.title = 'Update Debug Panel – Klick zum ' + (min ? 'Aufklappen' : 'Minimieren');
  const log = localStorage.getItem('werkbaum-update-log') || '';
  panel.textContent = min ? '⟳'
    : (log ? log.split('\n').slice(-6).join('\n') : 'Keine Einträge');
}
function showUpdateDebug(){
  if(isProdBuild) return;
  let panel = document.getElementById('updateDebugPanel');
  if(!panel){
    panel = document.createElement('div');
    panel.id = 'updateDebugPanel';
    document.body.appendChild(panel);
    panel.addEventListener('click', () => {
      const min = localStorage.getItem(LS_DEBUG_MIN) !== '1';
      try{ localStorage.setItem(LS_DEBUG_MIN, min ? '1' : '0'); }catch(_){}
      paintUpdateDebug(panel);
    });
  }
  paintUpdateDebug(panel);
}

/* Reset-Button im Header neben Fullscreen (Test-Hilfe; im Prod-Build weggelassen) */
if(!isProdBuild) document.addEventListener('DOMContentLoaded', () => {
  const fsToggle = document.getElementById('fsToggle');
  if(!fsToggle) return;

  const resetBtn = document.createElement('button');
  resetBtn.textContent = '🔄';
  resetBtn.className = 'fsbtn';
  resetBtn.title = 'App auf Defaults zurücksetzen (für Testing)';
  resetBtn.setAttribute('aria-label', 'App zurücksetzen');
  resetBtn.addEventListener('click', resetToDefaults);

  fsToggle.parentNode.insertBefore(resetBtn, fsToggle.nextSibling);
});

/* Erste Prüfung nach 2 Sekunden */
setTimeout(() => {
  checkForUpdates();
  showUpdateDebug();
}, 2000);

/* Periodisch prüfen (alle 15 Sekunden während Tests, produktiv dann auf 60s ändern) */
setInterval(() => {
  checkForUpdates();
  showUpdateDebug();
}, 15000);

/* Prüfe wenn User zur App zurückkommt */
document.addEventListener('visibilitychange', () => {
  if(!document.hidden){
    checkForUpdates();
    showUpdateDebug();
    if(localStorage.getItem('werkbaum-update-available')){
      checkAndShowUpdateNotification();
    }
  }
});

/* Prüfe beim Laden, falls Update bereits verfügbar */
if(!document.hidden && localStorage.getItem('werkbaum-update-available')){
  checkAndShowUpdateNotification();
}

function checkAndShowUpdateNotification(){
  const existingNotif = document.getElementById('updateNotification');
  if(existingNotif) return; /* Schon angezeigt */

  const notif = document.createElement('div');
  notif.id = 'updateNotification';
  notif.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: var(--or, #0F766E);
    color: white;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    z-index: 1000;
    font-size: 14px;
    font-family: 'IBM Plex Sans', system-ui, sans-serif;
  `;

  notif.innerHTML = `
    <span>📦 Neue Version verfügbar</span>
    <div style="display: flex; gap: 8px;">
      <button class="dismissBtn" style="
        background: transparent;
        color: white;
        border: 1px solid white;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      ">Später</button>
      <button class="updateBtn" style="
        background: white;
        color: var(--or, #0F766E);
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        font-size: 12px;
      ">Jetzt laden</button>
    </div>
  `;

  document.body.insertBefore(notif, document.body.firstChild);

  notif.querySelector('.updateBtn').addEventListener('click', () => {
    localStorage.removeItem('werkbaum-update-available');
    window.location.reload();
  });

  notif.querySelector('.dismissBtn').addEventListener('click', () => {
    notif.remove();
  });
}

/* ---------- Reset-Funktion für Testing ---------- */
function resetToDefaults(){
  const confirmed = confirm(
    'Beispiel-Dokument und Einstellungen zurücksetzen?\n\n' +
    'Das Beispiel-Dokument wird auf den Ausgangstext zurückgesetzt, die\n' +
    'Ansichts-Einstellungen (Modus, Zoom, Aufteilung, Sprache) verworfen.\n' +
    'Alle anderen Dokumente bleiben unangetastet.'
  );

  if(!confirmed) return;

  /* Nicht-Dokument-Zustand auf Defaults (UI, Sprache, Update-Flags) — die
     Dokumentenliste (werkbaum-docs) bleibt erhalten (D22). */
  ['werkbaum-ui','werkbaum-lang','werkbaum-html-hash','werkbaum-update-available','werkbaum-update-log']
    .forEach(k => { try{ localStorage.removeItem(k); }catch(_){} });

  /* Nur die MITGELIEFERTEN Dokumente auf ihren Ausgangstext zurücksetzen;
     existiert eines nicht (mehr), wird es neu angelegt. Eigene Dokumente des
     Nutzers bleiben unberührt (D22/D27). */
  const reseed = (id, name, text, vorn) => {
    const d = docs.find(x => x.id === id);
    if(d){ d.text = text; d.name = name; }
    else if(vorn) docs.unshift({ id, name, text });
    else docs.push({ id, name, text });
  };
  reseed(EXAMPLE_ID, EXAMPLE_NAME, INITIAL, true);
  reseed(WERKBAUM_ID, WERKBAUM_NAME, WERKBAUM_DOC, false);
  /* Merker auf den jetzt ausgelieferten Stand setzen (D27) — sonst hielte ein
     Altwert die spätere Nachzieh-Logik davon ab, den Text je zu aktualisieren. */
  try{ localStorage.setItem(LS_SEEDED, fingerprint(WERKBAUM_DOC)); }catch(_){}
  try{ localStorage.setItem(LS_SEEDED_EXAMPLE, fingerprint(INITIAL)); }catch(_){}
  activeId = EXAMPLE_ID;
  persistDocs();
  logUpdate('🔄 Mitgelieferte Dokumente und Einstellungen zurückgesetzt');

  /* Kurze Verzögerung, damit Logging sichtbar wird, dann reload */
  setTimeout(() => {
    window.location.reload();
  }, 500);
}

/* Update-Benachrichtigung-Symbol im Footer (rechts neben Version) */
function updateFooterUpdateIcon(){
  let icon = document.getElementById('footerUpdateIcon');
  const hasUpdate = localStorage.getItem('werkbaum-update-available');

  if(hasUpdate && !icon){
    const footer = document.querySelector('.site-footer');
    if(!footer) return;

    icon = document.createElement('button');
    icon.id = 'footerUpdateIcon';
    icon.textContent = '📦';
    icon.title = 'Neue Version verfügbar — klick um Benachrichtigung zu zeigen';
    icon.style.cssText = `
      background: none;
      border: none;
      color: var(--or, #0F766E);
      cursor: pointer;
      font-size: 16px;
      padding: 0 4px;
      vertical-align: middle;
      transition: transform 0.2s ease;
    `;
    icon.addEventListener('mouseenter', () => {
      icon.style.transform = 'scale(1.2)';
    });
    icon.addEventListener('mouseleave', () => {
      icon.style.transform = 'scale(1)';
    });
    icon.addEventListener('click', checkAndShowUpdateNotification);

    const verLink = footer.querySelector('.ver');
    if(verLink && verLink.nextSibling) {
      verLink.parentNode.insertBefore(icon, verLink.nextSibling);
    }
  } else if(!hasUpdate && icon){
    icon.remove();
  }
}

/* Icon beim Laden und bei Update-Erkennung aktualisieren */
document.addEventListener('DOMContentLoaded', updateFooterUpdateIcon);
const originalCheckAndShowUpdateNotification = checkAndShowUpdateNotification;
checkAndShowUpdateNotification = function(){
  originalCheckAndShowUpdateNotification.call(this);
  updateFooterUpdateIcon();
};
