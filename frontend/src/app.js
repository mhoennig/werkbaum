import './style.css';
import { parse } from './parser.js';
import { computeCheapSet } from './model.js';
import { esc, renderTreeHtml } from './render.js';
import { formatWarning } from './warnings.js';

const INITIAL = `%% Project structure – Sprint 14
[~] Website relaunch (XL) https://wiki.example.com/relaunch
  - [x] Concept (M)
    - [x] Audience analysis (S)
    - [x] Sitemap (XS)
  - [~] Implementation (XL)
    - [~] Frontend (M) https://git.example.com/frontend @anna
      | [ ] PWA (S)
      | [ ] Web+Nativ
        - [/] Web (S)
        - [ ] Android (M)
        - [ ] iOS (M)
    - [ ] Backend (L) @ben @carla
    - [ ] CMS integration (M)
      | [ ] WordPress
      | [?] Headless CMS
      | [-] Custom build  %% too much effort
  - [?] Hosting (M)
    | Cooperative Community Cloud https://hostsharing.net
    | On-premise`;

const src  = document.getElementById('src');
const out  = document.getElementById('out');
const warnBox = document.getElementById('warn');

/* Baum-/Kostenlogik (gateOf, needsBreakdown, visibleChildren, günstigster
   Pfad) lebt headless in model.js, das HTML-Erzeugen in render.js. Hier bleibt
   nur der UI-State des Günstigster-Pfad-Toggles (persistiert). */
let cheapPathOn = true;

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
     Gates) zusammenführen, nach Zeile sortiert anzeigen. */
  let warnings = parsed.warnings;

  if(!roots.length){
    out.innerHTML = `<div class="empty">${esc(t('empty'))}</div>`;
  } else {
    const cheapSet = cheapPathOn ? computeCheapSet(roots) : new Set();
    out.classList.toggle('cheap-on', cheapPathOn);
    const r = renderTreeHtml(roots, {t, showDiscarded, cheapPath: cheapPathOn, cheapSet});
    out.innerHTML = r.html;
    warnings = warnings.concat(r.warnings);
  }

  warnings = warnings.slice().sort((a, b) => (a.line || 0) - (b.line || 0));
  warnBox.innerHTML = warnings.map(w => `<div>⚠ ${formatWarning(w, t)}</div>`).join('');
  drawCheapPath();
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
function drawCheapPath(){
  out.querySelectorAll('svg.cheap-overlay').forEach(e => e.remove());
  if(!cheapPathOn) return;
  const leaves = [...out.querySelectorAll('.node.cheap-leaf')];   /* Dokument-Reihenfolge = Lese-Reihenfolge */
  if(leaves.length < 2) return;
  const outRect = out.getBoundingClientRect();
  const z = zoom || 1;
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

/* ---------- Diagramm als Grafik (SVG → PNG) ---------- */
/* Das gerenderte Diagramm wird aus der Live-Geometrie in ein eigenständiges
   SVG (nur Formen + Text, keine externen Ressourcen) nachgezeichnet und als
   PNG in die Zwischenablage gelegt. Knotenfarben, Größen-Badges, Tags und
   der Geister-Knoten werden übernommen; Verbindungslinien werden je Gate
   (und = durchgezogen Tinte, oder = gestrichelt Grau) neu gezogen und treffen
   so garantiert die Knoten — unabhängig vom Darstellungsmodus. */
function diagramToSvg(){
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
  nodes.forEach(parentEl => {
    const li = parentEl.closest('li');
    const childUl = li && [...li.children].find(c => c.tagName === 'UL');
    if(!childUl) return;
    const gate = childUl.classList.contains('or') ? 'or' : 'and';
    const stroke = gate === 'or' ? '#6B7A8C' : '#41556E';
    const dash = gate === 'or';
    const kids = [...childUl.children]
      .map(cli => cli.querySelector(':scope > .node, :scope > a.node')).filter(Boolean).map(R);
    if(!kids.length) return;
    const p = R(parentEl);
    const avgdx = kids.reduce((s,k)=>s+(k.cx-p.cx),0)/kids.length;
    const avgdy = kids.reduce((s,k)=>s+(k.cy-p.cy),0)/kids.length;
    if(Math.abs(avgdx) >= Math.abs(avgdy)){                    /* links→rechts */
      const toRight = avgdx >= 0;
      const px = toRight ? p.r : p.x;
      const busX = toRight ? Math.min(...kids.map(k=>k.x))-14 : Math.max(...kids.map(k=>k.r))+14;
      const ys = kids.map(k=>k.cy).concat(p.cy);
      parts.push(seg(px, p.cy, busX, p.cy, stroke, dash));
      parts.push(seg(busX, Math.min(...ys), busX, Math.max(...ys), stroke, dash));
      kids.forEach(k => parts.push(seg(busX, k.cy, toRight?k.x:k.r, k.cy, stroke, dash)));
    } else {                                                   /* oben→unten */
      const toDown = avgdy >= 0;
      const py = toDown ? p.b : p.y;
      const busY = toDown ? Math.min(...kids.map(k=>k.y))-14 : Math.max(...kids.map(k=>k.b))+14;
      const xs = kids.map(k=>k.cx).concat(p.cx);
      parts.push(seg(p.cx, py, p.cx, busY, stroke, dash));
      parts.push(seg(Math.min(...xs), busY, Math.max(...xs), busY, stroke, dash));
      kids.forEach(k => parts.push(seg(k.cx, busY, k.cx, toDown?k.y:k.b, stroke, dash)));
    }
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
    clone.querySelectorAll('.size,.tags,.ext').forEach(e => e.remove());
    const label = clone.textContent.replace(/\s+/g,' ').trim();
    const deco = cs.textDecorationLine.includes('line-through') ? ' text-decoration="line-through"' : '';
    parts.push(`<text x="${b.cx.toFixed(1)}" y="${(b.cy+5).toFixed(1)}" text-anchor="middle" fill="${cs.color}" font-size="14" font-weight="${cs.fontWeight}"${deco}>${esc(label)}</text>`);
    const sizeEl = node.querySelector('.size');
    if(sizeEl) drawBadge(sizeEl, '#0F766E', '#ffffff');
    node.querySelectorAll('.tag').forEach(tg => {
      const t = getComputedStyle(tg);
      drawBadge(tg, t.backgroundColor, t.color, t.borderTopColor);
    });
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

const app = document.getElementById('app');
function applyLayout(mode){
  out.classList.toggle('vertical', mode === 'vertikal');
  out.classList.toggle('kompakt', mode === 'kompakt');
  app.classList.toggle('side', mode !== 'horizontal');
  if(!isMobile()) applySplit();   /* Desktop: Preset neu setzen. Mobil: freie --drow-Aufteilung behalten */
  drawCheapPath();    /* Blatt-Positionen ändern sich mit dem Modus */
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

/* ---------- Mobil: freie Aufteilung (kontinuierlich, kein Snap/Collapse) ----------
   Beide Titelzeilen bleiben stehen: die Grid-Zeilen-Minima --pmin-d/--pmin-e
   entsprechen den (gemessenen) Kopfzeilenhöhen. --drow steuert die Diagramm-
   Höhe; das Tippen auf eine Titelzeile setzt sie auf ein Extrem. */
function headPx(sel){ return Math.ceil(document.querySelector(sel).getBoundingClientRect().height); }
function syncPanelMins(){
  app.style.setProperty('--pmin-d', headPx('.panel.right .panel-head') + 'px');
  app.style.setProperty('--pmin-e', headPx('.panel.editor .panel-head') + 'px');
}
function cssPx(name, fallback){ return parseFloat(getComputedStyle(app).getPropertyValue(name)) || fallback; }
function mobileMinDrow(){ return cssPx('--pmin-d', 49); }
function mobileMaxDrow(){ return app.getBoundingClientRect().height - 14 - cssPx('--pmin-e', 44); }
function setMobileDrow(px, save){
  const v = Math.max(mobileMinDrow(), Math.min(px, mobileMaxDrow()));
  splitState = 'custom';
  app.style.setProperty('--drow', v + 'px');
  if(save) saveUI();
}
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
    if(isMobile()){
      /* Tippen auf eine Titelzeile klappt DIESES Panel ganz aus (das andere
         schrumpft auf seine Titelzeile) — funktioniert in jeder Aufteilung. */
      clearCollapse();
      setMobileDrow(panel === diagramPanel ? mobileMaxDrow() : 0, true);
      return;
    }
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
  if(isMobile()){
    /* Frei ziehen; die Grid-Minima (--pmin) halten beide Titelzeilen sichtbar.
       Kein Snap/Collapse — so bleibt der Splitter jederzeit beweglich. */
    setMobileDrow(e.clientY - rect.top, false);
    return;
  }
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
/* Doppelklick auf den Splitter stellt die normale Aufteilung wieder her
   (auf Mobil: Diagramm maximiert). */
gutter.addEventListener('dblclick', () => {
  if(isMobile()){ clearCollapse(); setMobileDrow(mobileMaxDrow(), true); return; }
  splitState = 'normal'; applySplit();
});

/* ---------- Zoom für das Diagramm ---------- */
/* CSS-`zoom` skaliert die Layout-Box, dadurch greifen die Scrollbalken
   des Diagramm-Containers korrekt (anders als transform: scale). */
const ZMIN = 0.3, ZMAX = 3, ZSTEP = 0.1;
const ZOOM_COLLAPSE_DELAY = 3000;  /* 3 Sekunden */
let zoom = 1;
let zoomCollapseTimeout;

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
  out.style.zoom = zoom;
  document.getElementById('zoomReset').textContent = Math.round(zoom * 100) + ' %';
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
    ghostTooltip:"Ab Größe M sollte ein Element weiter untergliedert werden.",
    discardedTooltip:"Verworfene Knoten samt Teilbaum ein-/ausblenden",
    cheapTooltip:"Günstigsten Pfad hervorheben – nicht benötigte Alternativen treten zurück",
    implicitSizeTooltip:"Keine Größe angegeben – für die Kostenschätzung als M angenommen",
    fullscreenTooltip:"Vollbild – Panels nutzen die ganze Fensterbreite",
    brandTooltip:"„Werkbaum“ bedeutet so viel wie ‚Werk-Baum‘ — der Baum des Projektstrukturplans (WBS).",
    editorTitle:"Struktur (Text)", diagramTitle:"Diagramm",
    copy:"kopieren", copyDone:"kopiert ✓", copyTooltip:"Text in die Zwischenablage kopieren",
    copyDiagramTooltip:"Diagramm als PNG-Bild in die Zwischenablage kopieren",
    downloadDiagramTooltip:"Diagramm als SVG-Datei herunterladen (z. B. für LibreOffice: Einfügen → Bild)",
    downloadPngTooltip:"Diagramm als PNG-Datei herunterladen (Rasterbild, überall einfügbar)",
    downloadMenu:"Diagramm herunterladen (SVG/PNG)",
    minimize:"minimieren", normal:"normal", maximize:"maximieren",
    agenda:"Agenda", discarded:"verworfene",
    modeHorizontal:"Horizontal – Organigramm, Diagramm über dem Editor",
    modeKompakt:"Kompakt – alles nach unten, platzsparend",
    modeVertikal:"Vertikal – Baum nach rechts, Diagramm neben dem Editor",
    zoomOut:"verkleinern", zoomReset:"zurücksetzen", zoomIn:"vergrößern",
    zoomAria:"Zoom (Strg/Cmd + Mausrad)", langMore:"weitere Sprachen",
    empty:"Noch keine Struktur — einfach lostippen.", ghost:"…",
    mixedWarn:"Zeile {line}: Unter „{label}“ sind - und | gemischt — dargestellt nach dem ersten Kind.",
    st_idee:"Idee", st_geplant:"geplant", st_arbeit:"in Arbeit", st_durchstich:"Durchstich",
    st_fertig:"fertig", st_prod:"in Produktion", st_highrisk:"High Risk", st_verworfen:"verworfen",
    unknownStatusWarn:"Zeile {line}: unbekanntes Statuszeichen „{code}“ — als neutral dargestellt.",
    a11yStatus:"Status: {status}", a11ySize:"Aufwand: {size}", a11ySizeImplicit:"Aufwand: M (angenommen)", a11yTags:"Zuständig: {names}", a11yLink:"verlinkt",
    hint_indent:"Einrückung (2 Leerzeichen oder Tab) definiert die Hierarchie.",
    hint_all:"Teilpaket, alle erforderlich", hint_any:"Alternative, eine wählen",
    hint_root:"Zeile ohne Zeichen = Wurzelknoten. Geschwister sollten dasselbe Zeichen tragen.",
    hint_status:"Status als Kästchen nach dem Zeichen, z. B.",
    hint_size:"Aufwand als T-Shirt-Größe in Klammern, Link einfach als URL anhängen:",
    hint_break:"Ab (M) gilt: weiter untergliedern — fehlt die Untergliederung, erscheint ein Platzhalter im Diagramm.",
    hint_comment:"Kommentare mit %% — als ganze Zeile oder am Zeilenende.",
    hint_people:"Personen mit @name — erscheinen unten rechts am Knoten."
  },
  en: {
    subtitle:"Werkbaum – Work Breakdown Structure / Lean Pathfinding · Project structure editor (also feature-tree & requirements)",
    subtitleShort:"WBS editor with Lean Pathfinding",
    imprint:"Imprint (Impressum)",
    privacy:"Privacy",
    legendTooltip:"Show/hide legend",
    ghostTooltip:"From size M upward, an item should be broken down further.",
    discardedTooltip:"Show/hide discarded nodes and their subtree",
    cheapTooltip:"Highlight the cheapest path – unneeded alternatives recede",
    implicitSizeTooltip:"No size given – assumed as M for the cost estimate",
    fullscreenTooltip:"Full screen – panels use the full window width",
    brandTooltip:"“Werkbaum” means roughly ‘work tree’ — the tree of the work breakdown structure (WBS).",
    editorTitle:"Structure (text)", diagramTitle:"Diagram",
    copy:"copy", copyDone:"copied ✓", copyTooltip:"Copy text to clipboard",
    copyDiagramTooltip:"Copy diagram as a PNG image to the clipboard",
    downloadDiagramTooltip:"Download diagram as an SVG file (e.g. for LibreOffice: Insert → Image)",
    downloadPngTooltip:"Download diagram as a PNG file (raster image, insertable anywhere)",
    downloadMenu:"Download diagram (SVG/PNG)",
    minimize:"minimize", normal:"normal", maximize:"maximize",
    agenda:"Legend", discarded:"discarded",
    modeHorizontal:"Horizontal – org chart, diagram above the editor",
    modeKompakt:"Compact – everything downward, space-saving",
    modeVertikal:"Vertical – tree to the right, diagram beside the editor",
    zoomOut:"zoom out", zoomReset:"reset", zoomIn:"zoom in",
    zoomAria:"Zoom (Ctrl/Cmd + mouse wheel)", langMore:"more languages",
    empty:"No structure yet — just start typing.", ghost:"…",
    mixedWarn:"Line {line}: under “{label}”, - and | are mixed — rendered by the first child.",
    st_idee:"idea", st_geplant:"planned", st_arbeit:"in progress", st_durchstich:"walking skeleton",
    st_fertig:"done", st_prod:"in production", st_highrisk:"high risk", st_verworfen:"discarded",
    unknownStatusWarn:"Line {line}: unknown status code “{code}” — shown as neutral.",
    a11yStatus:"Status: {status}", a11ySize:"Effort: {size}", a11ySizeImplicit:"Effort: M (assumed)", a11yTags:"Assigned: {names}", a11yLink:"has link",
    hint_indent:"Indentation (2 spaces or a tab) defines the hierarchy.",
    hint_all:"sub-task, all required", hint_any:"alternative, choose one",
    hint_root:"Line without a marker = root node. Siblings should share the same marker.",
    hint_status:"Status as a checkbox after the marker, e.g.",
    hint_size:"Effort as a T-shirt size in parentheses; add a link simply as a URL:",
    hint_break:"From (M) on: break it down further — if the breakdown is missing, a placeholder appears in the diagram.",
    hint_comment:"Comments with %% — whole line or at the end of a line.",
    hint_people:"People with @name — shown at the bottom-right of the node."
  },
  es: {
    subtitle:"Werkbaum – EDT / Lean Pathfinding · Editor de estructura de proyectos (también árboles de características y requisitos)",
    subtitleShort:"Editor EDT con Lean Pathfinding",
    imprint:"Aviso legal (Impressum)",
    privacy:"Privacidad",
    legendTooltip:"Mostrar u ocultar la leyenda",
    ghostTooltip:"A partir de la talla M, un elemento debería desglosarse más.",
    discardedTooltip:"Mostrar u ocultar los nodos descartados y su subárbol",
    cheapTooltip:"Resaltar la ruta más económica: las alternativas no necesarias se atenúan",
    implicitSizeTooltip:"Sin tamaño indicado: se asume M para el cálculo de costes",
    fullscreenTooltip:"Pantalla completa – los paneles usan todo el ancho de la ventana",
    brandTooltip:"«Werkbaum» significa algo así como ‘árbol de trabajo’ — el árbol de la estructura de desglose del trabajo (EDT).",
    editorTitle:"Estructura (texto)", diagramTitle:"Diagrama",
    copy:"copiar", copyDone:"copiado ✓", copyTooltip:"Copiar el texto al portapapeles",
    copyDiagramTooltip:"Copiar el diagrama como imagen PNG al portapapeles",
    downloadDiagramTooltip:"Descargar el diagrama como archivo SVG (p. ej. para LibreOffice: Insertar → Imagen)",
    downloadPngTooltip:"Descargar el diagrama como archivo PNG (imagen de trama, insertable en cualquier lugar)",
    downloadMenu:"Descargar el diagrama (SVG/PNG)",
    minimize:"minimizar", normal:"normal", maximize:"maximizar",
    agenda:"Leyenda", discarded:"descartados",
    modeHorizontal:"Horizontal – organigrama, diagrama sobre el editor",
    modeKompakt:"Compacto – todo hacia abajo, ahorra espacio",
    modeVertikal:"Vertical – árbol hacia la derecha, diagrama junto al editor",
    zoomOut:"alejar", zoomReset:"restablecer", zoomIn:"acercar",
    zoomAria:"Zoom (Ctrl/Cmd + rueda del ratón)", langMore:"más idiomas",
    empty:"Aún no hay estructura — simplemente empieza a escribir.", ghost:"…",
    mixedWarn:"Línea {line}: bajo «{label}» se mezclan - y | — se representa según el primer hijo.",
    st_idee:"idea", st_geplant:"planificado", st_arbeit:"en curso", st_durchstich:"prototipo funcional",
    st_fertig:"terminado", st_prod:"en producción", st_highrisk:"alto riesgo", st_verworfen:"descartado",
    unknownStatusWarn:"Línea {line}: código de estado desconocido «{code}» — mostrado como neutral.",
    a11yStatus:"Estado: {status}", a11ySize:"Esfuerzo: {size}", a11ySizeImplicit:"Esfuerzo: M (asumido)", a11yTags:"Responsable: {names}", a11yLink:"con enlace",
    hint_indent:"La sangría (2 espacios o un tabulador) define la jerarquía.",
    hint_all:"subtarea, todas obligatorias", hint_any:"alternativa, elige una",
    hint_root:"Línea sin marcador = nodo raíz. Los hermanos deberían llevar el mismo marcador.",
    hint_status:"Estado como casilla tras el marcador, p. ej.",
    hint_size:"Esfuerzo como talla de camiseta entre paréntesis; añade un enlace simplemente como URL:",
    hint_break:"A partir de (M): sigue desglosando — si falta el desglose, aparece un marcador de posición en el diagrama.",
    hint_comment:"Comentarios con %% — línea completa o al final de la línea.",
    hint_people:"Personas con @nombre — aparecen abajo a la derecha del nodo."
  },
  fr: {
    subtitle:"Werkbaum – WBS / Lean Pathfinding · Éditeur de structure de projet (aussi pour arbres de fonctionnalités et d'exigences)",
    subtitleShort:"Éditeur WBS avec Lean Pathfinding",
    imprint:"Mentions légales (Impressum)",
    privacy:"Confidentialité",
    legendTooltip:"Afficher/masquer la légende",
    ghostTooltip:"À partir de la taille M, un élément devrait être décomposé davantage.",
    discardedTooltip:"Afficher/masquer les nœuds abandonnés et leur sous-arbre",
    cheapTooltip:"Mettre en évidence le chemin le moins coûteux – les alternatives inutiles s'estompent",
    implicitSizeTooltip:"Aucune taille indiquée – considérée comme M pour l'estimation des coûts",
    fullscreenTooltip:"Plein écran – les panneaux occupent toute la largeur de la fenêtre",
    brandTooltip:"« Werkbaum » signifie à peu près « arbre de travail » — l’arbre de l’organigramme des tâches (WBS).",
    editorTitle:"Structure (texte)", diagramTitle:"Diagramme",
    copy:"copier", copyDone:"copié ✓", copyTooltip:"Copier le texte dans le presse-papiers",
    copyDiagramTooltip:"Copier le diagramme comme image PNG dans le presse-papiers",
    downloadDiagramTooltip:"Télécharger le diagramme en fichier SVG (p. ex. pour LibreOffice : Insertion → Image)",
    downloadPngTooltip:"Télécharger le diagramme en fichier PNG (image matricielle, insérable partout)",
    downloadMenu:"Télécharger le diagramme (SVG/PNG)",
    minimize:"réduire", normal:"normal", maximize:"agrandir",
    agenda:"Légende", discarded:"abandonnés",
    modeHorizontal:"Horizontal – organigramme, diagramme au-dessus de l'éditeur",
    modeKompakt:"Compact – tout vers le bas, gain de place",
    modeVertikal:"Vertical – arbre vers la droite, diagramme à côté de l'éditeur",
    zoomOut:"dézoomer", zoomReset:"réinitialiser", zoomIn:"zoomer",
    zoomAria:"Zoom (Ctrl/Cmd + molette)", langMore:"plus de langues",
    empty:"Pas encore de structure — commencez à taper.", ghost:"…",
    mixedWarn:"Ligne {line} : sous « {label} », - et | sont mélangés — rendu selon le premier enfant.",
    st_idee:"idée", st_geplant:"planifié", st_arbeit:"en cours", st_durchstich:"squelette fonctionnel",
    st_fertig:"terminé", st_prod:"en production", st_highrisk:"risque élevé", st_verworfen:"abandonné",
    unknownStatusWarn:"Ligne {line} : code de statut inconnu « {code} » — affiché comme neutre.",
    a11yStatus:"Statut : {status}", a11ySize:"Effort : {size}", a11ySizeImplicit:"Effort : M (supposé)", a11yTags:"Responsable : {names}", a11yLink:"avec lien",
    hint_indent:"L'indentation (2 espaces ou une tabulation) définit la hiérarchie.",
    hint_all:"sous-tâche, toutes requises", hint_any:"alternative, en choisir une",
    hint_root:"Ligne sans marqueur = nœud racine. Les frères devraient porter le même marqueur.",
    hint_status:"Statut sous forme de case après le marqueur, p. ex.",
    hint_size:"Effort en taille de T-shirt entre parenthèses ; ajoutez un lien simplement comme URL :",
    hint_break:"À partir de (M) : décomposer davantage — si la décomposition manque, un espace réservé apparaît dans le diagramme.",
    hint_comment:"Commentaires avec %% — ligne entière ou en fin de ligne.",
    hint_people:"Personnes avec @nom — affichées en bas à droite du nœud."
  },
  pl: {
    subtitle:"Werkbaum – WBS / Lean Pathfinding · Edytor struktury projektów (również dla drzew funkcji i wymagań)",
    subtitleShort:"Edytor WBS z Lean Pathfinding",
    imprint:"Nota prawna (Impressum)",
    privacy:"Prywatność",
    legendTooltip:"Pokaż/ukryj legendę",
    ghostTooltip:"Od rozmiaru M element powinien być dalej podzielony.",
    discardedTooltip:"Pokaż/ukryj odrzucone węzły wraz z poddrzewem",
    cheapTooltip:"Wyróżnij najtańszą ścieżkę – niepotrzebne alternatywy są przygaszone",
    implicitSizeTooltip:"Nie podano rozmiaru – przyjęto M do szacowania kosztów",
    fullscreenTooltip:"Pełny ekran – panele wykorzystują całą szerokość okna",
    brandTooltip:"„Werkbaum” znaczy mniej więcej ‚drzewo pracy’ — drzewo struktury podziału pracy (WBS).",
    editorTitle:"Struktura (tekst)", diagramTitle:"Diagram",
    copy:"kopiuj", copyDone:"skopiowano ✓", copyTooltip:"Kopiuj tekst do schowka",
    copyDiagramTooltip:"Kopiuj diagram jako obraz PNG do schowka",
    downloadDiagramTooltip:"Pobierz diagram jako plik SVG (np. dla LibreOffice: Wstaw → Obraz)",
    downloadPngTooltip:"Pobierz diagram jako plik PNG (obraz rastrowy, wszędzie do wstawienia)",
    downloadMenu:"Pobierz diagram (SVG/PNG)",
    minimize:"minimalizuj", normal:"normalny", maximize:"maksymalizuj",
    agenda:"Legenda", discarded:"odrzucone",
    modeHorizontal:"Poziomo – schemat organizacyjny, diagram nad edytorem",
    modeKompakt:"Kompaktowo – wszystko w dół, oszczędza miejsce",
    modeVertikal:"Pionowo – drzewo w prawo, diagram obok edytora",
    zoomOut:"pomniejsz", zoomReset:"resetuj", zoomIn:"powiększ",
    zoomAria:"Powiększenie (Ctrl/Cmd + kółko myszy)", langMore:"więcej języków",
    empty:"Brak struktury — zacznij pisać.", ghost:"…",
    mixedWarn:"Wiersz {line}: pod „{label}” mieszają się - i | — renderowane według pierwszego dziecka.",
    st_idee:"pomysł", st_geplant:"zaplanowane", st_arbeit:"w toku", st_durchstich:"działający szkielet",
    st_fertig:"gotowe", st_prod:"w produkcji", st_highrisk:"wysokie ryzyko", st_verworfen:"odrzucone",
    unknownStatusWarn:"Wiersz {line}: nieznany znak statusu „{code}” — pokazany jako neutralny.",
    a11yStatus:"Status: {status}", a11ySize:"Nakład: {size}", a11ySizeImplicit:"Nakład: M (założony)", a11yTags:"Przypisano: {names}", a11yLink:"z linkiem",
    hint_indent:"Wcięcie (2 spacje lub tabulator) definiuje hierarchię.",
    hint_all:"podzadanie, wszystkie wymagane", hint_any:"alternatywa, wybierz jedną",
    hint_root:"Wiersz bez znacznika = węzeł główny. Rodzeństwo powinno mieć ten sam znacznik.",
    hint_status:"Status jako pole wyboru po znaczniku, np.",
    hint_size:"Nakład jako rozmiar koszulki w nawiasach; link dodaj po prostu jako URL:",
    hint_break:"Od (M): dziel dalej — gdy brakuje podziału, w diagramie pojawia się symbol zastępczy.",
    hint_comment:"Komentarze z %% — cały wiersz lub na końcu wiersza.",
    hint_people:"Osoby z @nazwa — pokazywane w prawym dolnym rogu węzła."
  },
  ru: {
    subtitle:"Werkbaum – СДР / Lean Pathfinding · Редактор структуры проектов (также для деревьев функций и требований)",
    subtitleShort:"Редактор СДР с Lean Pathfinding",
    imprint:"Выходные данные (Impressum)",
    privacy:"Конфиденциальность",
    legendTooltip:"Показать/скрыть легенду",
    ghostTooltip:"Начиная с размера M элемент следует далее декомпозировать.",
    discardedTooltip:"Показать/скрыть отклонённые узлы вместе с поддеревом",
    cheapTooltip:"Выделить самый дешёвый путь — ненужные альтернативы приглушаются",
    implicitSizeTooltip:"Размер не указан — для оценки затрат принят как M",
    fullscreenTooltip:"Полный экран – панели занимают всю ширину окна",
    brandTooltip:"«Werkbaum» примерно означает ‚дерево работ’ — дерево структуры декомпозиции работ (СДР).",
    editorTitle:"Структура (текст)", diagramTitle:"Диаграмма",
    copy:"копировать", copyDone:"скопировано ✓", copyTooltip:"Скопировать текст в буфер обмена",
    copyDiagramTooltip:"Скопировать диаграмму как изображение PNG в буфер обмена",
    downloadDiagramTooltip:"Скачать диаграмму как файл SVG (напр. для LibreOffice: Вставка → Изображение)",
    downloadPngTooltip:"Скачать диаграмму как файл PNG (растровое изображение, вставляется везде)",
    downloadMenu:"Скачать диаграмму (SVG/PNG)",
    minimize:"свернуть", normal:"обычный", maximize:"развернуть",
    agenda:"Легенда", discarded:"отклонённые",
    modeHorizontal:"Горизонтально – оргсхема, диаграмма над редактором",
    modeKompakt:"Компактно – всё вниз, экономит место",
    modeVertikal:"Вертикально – дерево вправо, диаграмма рядом с редактором",
    zoomOut:"уменьшить", zoomReset:"сбросить", zoomIn:"увеличить",
    zoomAria:"Масштаб (Ctrl/Cmd + колесо мыши)", langMore:"ещё языки",
    empty:"Пока нет структуры — просто начните печатать.", ghost:"…",
    mixedWarn:"Строка {line}: под «{label}» смешаны - и | — отображается по первому потомку.",
    st_idee:"идея", st_geplant:"запланировано", st_arbeit:"в работе", st_durchstich:"сквозной прототип",
    st_fertig:"готово", st_prod:"в эксплуатации", st_highrisk:"высокий риск", st_verworfen:"отклонено",
    unknownStatusWarn:"Строка {line}: неизвестный код статуса «{code}» — показан как нейтральный.",
    a11yStatus:"Статус: {status}", a11ySize:"Оценка: {size}", a11ySizeImplicit:"Оценка: M (предполагается)", a11yTags:"Ответственные: {names}", a11yLink:"со ссылкой",
    hint_indent:"Отступ (2 пробела или табуляция) задаёт иерархию.",
    hint_all:"подзадача, все обязательны", hint_any:"альтернатива, выберите одну",
    hint_root:"Строка без маркера = корневой узел. У соседних узлов должен быть одинаковый маркер.",
    hint_status:"Статус в виде флажка после маркера, напр.",
    hint_size:"Трудоёмкость как размер футболки в скобках; ссылку добавьте просто как URL:",
    hint_break:"С (M): дробите дальше — если декомпозиции нет, в диаграмме появляется заполнитель.",
    hint_comment:"Комментарии через %% — вся строка или в конце строки.",
    hint_people:"Люди через @имя — показываются справа внизу узла."
  },
  hi: {
    subtitle:"Werkbaum – WBS / Lean Pathfinding · परियोजना संरचना संपादक (फ़ीचर और रिक्वायरमेंट ट्री के लिए भी)",
    subtitleShort:"WBS संपादक Lean Pathfinding के साथ",
    imprint:"प्रकाशन विवरण (Impressum)",
    privacy:"गोपनीयता",
    legendTooltip:"लेजेंड दिखाएँ/छिपाएँ",
    ghostTooltip:"आकार M से ऊपर किसी तत्व को और अधिक उप-विभाजित करना चाहिए।",
    discardedTooltip:"अस्वीकृत नोड्स और उनके उप-वृक्ष दिखाएँ/छिपाएँ",
    cheapTooltip:"सबसे किफ़ायती पथ को उजागर करें – अनावश्यक विकल्प मंद हो जाते हैं",
    implicitSizeTooltip:"कोई आकार नहीं दिया गया – लागत अनुमान के लिए M माना गया",
    fullscreenTooltip:"पूर्ण स्क्रीन – पैनल पूरी विंडो चौड़ाई का उपयोग करते हैं",
    brandTooltip:"„Werkbaum“ का अर्थ लगभग ‚कार्य-वृक्ष‘ है — कार्य विभाजन संरचना (WBS) का वृक्ष।",
    editorTitle:"संरचना (टेक्स्ट)", diagramTitle:"आरेख",
    copy:"कॉपी करें", copyDone:"कॉपी हो गया ✓", copyTooltip:"टेक्स्ट को क्लिपबोर्ड पर कॉपी करें",
    copyDiagramTooltip:"आरेख को PNG छवि के रूप में क्लिपबोर्ड पर कॉपी करें",
    downloadDiagramTooltip:"आरेख को SVG फ़ाइल के रूप में डाउनलोड करें (जैसे LibreOffice: सम्मिलित करें → छवि)",
    downloadPngTooltip:"आरेख को PNG फ़ाइल के रूप में डाउनलोड करें (रास्टर छवि, कहीं भी सम्मिलित करने योग्य)",
    downloadMenu:"आरेख डाउनलोड करें (SVG/PNG)",
    minimize:"छोटा करें", normal:"सामान्य", maximize:"बड़ा करें",
    agenda:"लेजेंड", discarded:"अस्वीकृत",
    modeHorizontal:"क्षैतिज – संगठन-चार्ट, संपादक के ऊपर आरेख",
    modeKompakt:"सघन – सब नीचे की ओर, जगह बचाता है",
    modeVertikal:"लंबवत – पेड़ दाईं ओर, संपादक के बगल में आरेख",
    zoomOut:"ज़ूम आउट", zoomReset:"रीसेट करें", zoomIn:"ज़ूम इन",
    zoomAria:"ज़ूम (Ctrl/Cmd + माउस-व्हील)", langMore:"और भाषाएँ",
    empty:"अभी कोई संरचना नहीं — बस टाइप करना शुरू करें।", ghost:"…",
    mixedWarn:"पंक्ति {line}: „{label}“ के अंतर्गत - और | मिश्रित हैं — पहले चाइल्ड के अनुसार दिखाया गया।",
    st_idee:"विचार", st_geplant:"नियोजित", st_arbeit:"प्रगति पर", st_durchstich:"कार्यशील ढाँचा",
    st_fertig:"पूर्ण", st_prod:"उत्पादन में", st_highrisk:"उच्च जोखिम", st_verworfen:"अस्वीकृत",
    unknownStatusWarn:"पंक्ति {line}: अज्ञात स्थिति कोड „{code}“ — तटस्थ रूप में दिखाया गया।",
    a11yStatus:"स्थिति: {status}", a11ySize:"आकार: {size}", a11ySizeImplicit:"आकार: M (अनुमानित)", a11yTags:"जिम्मेदार: {names}", a11yLink:"लिंक सहित",
    hint_indent:"इंडेंट (2 स्पेस या टैब) पदानुक्रम तय करता है।",
    hint_all:"उप-कार्य, सभी आवश्यक", hint_any:"विकल्प, एक चुनें",
    hint_root:"बिना मार्कर वाली पंक्ति = मूल नोड। सहोदर नोड्स का मार्कर समान होना चाहिए।",
    hint_status:"मार्कर के बाद चेकबॉक्स के रूप में स्थिति, जैसे",
    hint_size:"प्रयास कोष्ठक में टी-शर्ट आकार के रूप में; लिंक बस URL के रूप में जोड़ें:",
    hint_break:"(M) से आगे: और विभाजित करें — विभाजन न होने पर आरेख में प्लेसहोल्डर दिखता है।",
    hint_comment:"%% से टिप्पणियाँ — पूरी पंक्ति या पंक्ति के अंत में।",
    hint_people:"@नाम से व्यक्ति — नोड के नीचे-दाएँ दिखते हैं।"
  },
  zh: {
    subtitle:"Werkbaum – WBS / Lean Pathfinding · 项目结构编辑器（也支持功能树和需求树）",
    subtitleShort:"WBS 编辑器和 Lean Pathfinding",
    imprint:"法律声明（Impressum）",
    privacy:"隐私",
    legendTooltip:"显示/隐藏图例",
    brandTooltip:"「Werkbaum」大致意为‘工作之树’——即工作分解结构（WBS）之树。",
    fullscreenTooltip:"全屏——面板占据整个窗口宽度",
    discardedTooltip:"显示/隐藏已放弃的节点及其子树",
    cheapTooltip:"突出显示成本最低的路径——不需要的备选项将淡化",
    implicitSizeTooltip:"未指定尺寸——成本估算时按 M 计",
    ghostTooltip:"从 M 号起，元素应进一步细分。",
    editorTitle:"结构（文本）", diagramTitle:"图表",
    copy:"复制", copyDone:"已复制 ✓", copyTooltip:"将文本复制到剪贴板",
    copyDiagramTooltip:"将图表作为 PNG 图片复制到剪贴板",
    downloadDiagramTooltip:"将图表下载为 SVG 文件（例如用于 LibreOffice：插入 → 图像）",
    downloadPngTooltip:"将图表下载为 PNG 文件（位图，可在任何地方插入）",
    downloadMenu:"下载图表（SVG/PNG）",
    minimize:"最小化", normal:"正常", maximize:"最大化",
    agenda:"图例", discarded:"已放弃",
    modeHorizontal:"横向——组织结构图，图表在编辑器上方",
    modeKompakt:"紧凑——全部向下，节省空间",
    modeVertikal:"纵向——树向右展开，图表在编辑器旁边",
    zoomOut:"缩小", zoomReset:"重置", zoomIn:"放大",
    zoomAria:"缩放（Ctrl/Cmd + 鼠标滚轮）", langMore:"更多语言",
    empty:"还没有结构——直接开始输入吧。", ghost:"…",
    mixedWarn:"第 {line} 行：在「{label}」下 - 与 | 混用——按第一个子项渲染。",
    st_idee:"想法", st_geplant:"已计划", st_arbeit:"进行中", st_durchstich:"可运行骨架",
    st_fertig:"已完成", st_prod:"已上线", st_highrisk:"高风险", st_verworfen:"已放弃",
    unknownStatusWarn:"第 {line} 行：未知状态代码“{code}”——显示为中性。",
    a11yStatus:"状态：{status}", a11ySize:"工作量：{size}", a11ySizeImplicit:"工作量：M（假定）", a11yTags:"负责人：{names}", a11yLink:"含链接",
    hint_indent:"缩进（2 个空格或制表符）定义层级。",
    hint_all:"子任务，全部必需", hint_any:"备选项，择其一",
    hint_root:"无标记的行 = 根节点。同级应使用相同的标记。",
    hint_status:"在标记后用方框表示状态，例如",
    hint_size:"用括号中的 T 恤尺码表示工作量；链接直接作为 URL 附加：",
    hint_break:"从 (M) 起：继续细分——若缺少细分，图表中会出现占位符。",
    hint_comment:"用 %% 注释——整行或行尾。",
    hint_people:"用 @姓名 表示人员——显示在节点右下角。"
  },
  ja: {
    subtitle:"Werkbaum – WBS / Lean Pathfinding · プロジェクト構造エディター（フィーチャーツリーと要件ツリーにも対応）",
    subtitleShort:"WBS エディター & Lean Pathfinding",
    imprint:"運営者情報（Impressum）",
    privacy:"プライバシー",
    legendTooltip:"凡例を表示/非表示",
    brandTooltip:"「Werkbaum」はおおよそ『作業の木』の意味 — 作業分解構成図（WBS）のツリーです。",
    fullscreenTooltip:"全画面 — パネルがウィンドウ幅いっぱいを使用",
    discardedTooltip:"破棄したノードとその下位ツリーを表示/非表示",
    cheapTooltip:"最も低コストの経路を強調 – 不要な選択肢は控えめに表示",
    implicitSizeTooltip:"サイズ未指定 – コスト見積もりのため M として扱う",
    ghostTooltip:"サイズ M 以上の要素はさらに分解すべきです。",
    editorTitle:"構造（テキスト）", diagramTitle:"ダイアグラム",
    copy:"コピー", copyDone:"コピーしました ✓", copyTooltip:"テキストをクリップボードにコピー",
    copyDiagramTooltip:"ダイアグラムを PNG 画像としてクリップボードにコピー",
    downloadDiagramTooltip:"ダイアグラムを SVG ファイルとしてダウンロード（例：LibreOffice の 挿入 → 画像）",
    downloadPngTooltip:"ダイアグラムを PNG ファイルとしてダウンロード（ラスター画像、どこにでも挿入可能）",
    downloadMenu:"ダイアグラムをダウンロード（SVG/PNG）",
    minimize:"最小化", normal:"標準", maximize:"最大化",
    agenda:"凡例", discarded:"破棄",
    modeHorizontal:"横 — 組織図、ダイアグラムはエディターの上",
    modeKompakt:"コンパクト — すべて下方向、省スペース",
    modeVertikal:"縦 — ツリーを右へ、ダイアグラムはエディターの横",
    zoomOut:"縮小", zoomReset:"リセット", zoomIn:"拡大",
    zoomAria:"ズーム（Ctrl/Cmd + マウスホイール）", langMore:"その他の言語",
    empty:"まだ構造がありません — 入力を始めてください。", ghost:"…",
    mixedWarn:"{line} 行目：「{label}」の下で - と | が混在 — 最初の子に従って表示。",
    st_idee:"アイデア", st_geplant:"計画済み", st_arbeit:"作業中", st_durchstich:"ウォーキングスケルトン",
    st_fertig:"完了", st_prod:"本番稼働", st_highrisk:"高リスク", st_verworfen:"破棄",
    unknownStatusWarn:"{line} 行目: 不明なステータス記号「{code}」— 中立として表示。",
    a11yStatus:"ステータス: {status}", a11ySize:"規模: {size}", a11ySizeImplicit:"規模: M（想定）", a11yTags:"担当: {names}", a11yLink:"リンクあり",
    hint_indent:"インデント（スペース2つまたはタブ）で階層を定義します。",
    hint_all:"サブタスク、すべて必須", hint_any:"選択肢、1つを選ぶ",
    hint_root:"マーカーのない行 = ルートノード。兄弟は同じマーカーを使うべきです。",
    hint_status:"マーカーの後にチェックボックスで状態、例：",
    hint_size:"工数は括弧内の T シャツサイズで；リンクは URL としてそのまま追加：",
    hint_break:"(M) 以上：さらに分解 — 分解がないと図にプレースホルダーが表示されます。",
    hint_comment:"%% でコメント — 行全体または行末。",
    hint_people:"@名前 で担当者 — ノードの右下に表示されます。"
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
    <code class="or-code">|</code>&nbsp; ${esc(t('hint_any'))} <em>(any of)</em><br>
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
    ${esc(t('hint_people'))}`;
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
let restoring = false;   /* unterdrückt Speichern während des Wiederherstellens */
let hadStoredUI = false;  /* gab es beim Laden schon gespeicherte GUI-Einstellungen? */
function saveSrc(){
  if(restoring) return;
  try{ localStorage.setItem(LS_SRC, src.value); }catch(_){}
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
      zoom: zoom,
      fullscreen: document.body.classList.contains('fullscreen')
    }));
  }catch(_){}
}
function restoreState(){
  restoring = true;
  let savedSrc = null, ui = null;
  try{ savedSrc = localStorage.getItem(LS_SRC); }catch(_){}
  try{ ui = JSON.parse(localStorage.getItem(LS_UI) || 'null'); }catch(_){}
  hadStoredUI = !!ui;
  src.value = (savedSrc !== null) ? savedSrc : INITIAL;   /* leerer String bleibt leer */
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
  applyZoom();
  restoring = false;
}

/* ---------- Kleiner Bildschirm: nur ein Panel, schlanke Sprachwahl, Vollbild ---------- */
const mqMobile = window.matchMedia('(max-width:640px)');
function isMobile(){ return mqMobile.matches; }

/* Exakte sichtbare Höhe (--app-height) aus window.visualViewport ableiten.
   Nötig, weil manche Browser (z. B. Brave) ihre untere Leiste als Overlay
   zeichnen: 100dvh meldet dann weiterhin die volle Höhe, und Footer/Editor-
   Titelzeile verschwinden dahinter. visualViewport.height liefert die wirklich
   sichtbare Fläche. Fällt es weg, greift die CSS-Kaskade (dvh/vh). */
function setAppHeight(){
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-height', Math.round(h) + 'px');
}
setAppHeight();
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', setAppHeight);
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', setAppHeight);
}
const legendBtn = document.getElementById('legendBtn');
const agenda = document.querySelector('.agenda');
legendBtn.addEventListener('click', () => {
  agenda.open = !agenda.open;
  legendBtn.classList.toggle('active', agenda.open);
});
agenda.addEventListener('toggle', () => legendBtn.classList.toggle('active', agenda.open));
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
  if(!m) return;
  /* Freie Aufteilung (kontinuierlich): kein Desktop-Collapse. Ist noch keine
     Aufteilung gesetzt (frisch oder Alt-Preset), Diagramm maximieren (Editor
     bleibt als Titelzeile); eine gespeicherte --drow bleibt erhalten. */
  clearCollapse();
  syncPanelMins();   /* Grid-Minima = aktuelle Kopfzeilenhöhen */
  if(app.style.getPropertyValue('--drow')) splitState = 'custom';
  else setMobileDrow(mobileMaxDrow(), true);
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
let startLang = 'de';
try{ startLang = localStorage.getItem('werkbaum-lang') || 'de'; }catch(_){}
applyLang(I18N[startLang] ? startLang : 'de');   /* setzt Texte + rendert */
applyMobile();   /* Mobil-Verhalten (nach Sprache/Restore) anwenden */

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
async function checkForUpdates(){
  try {
    /* Cache-Busting: HEAD-Request zuerst, um Last-Modified/ETag zu prüfen */
    const headResp = await fetch(location.href, { method: 'HEAD', cache: 'no-store' });
    if(!headResp.ok) throw new Error(`HTTP ${headResp.status}`);

    const lastModified = headResp.headers.get('last-modified');
    const etag = headResp.headers.get('etag');
    const storedETag = localStorage.getItem('werkbaum-etag');
    const storedModified = localStorage.getItem('werkbaum-last-modified');

    /* Wenn ETag/Last-Modified gleich, ist nichts geändert */
    if((etag && etag === storedETag) || (lastModified && lastModified === storedModified)){
      logUpdate('✓ Alles aktuell');
      return;
    }

    /* Neue Version: Vollständiges HTML fetchen */
    const resp = await fetch(location.href, { cache: 'no-store' });
    if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();

    /* Prüfe auf echte Änderung via Content-Hash */
    const stored = localStorage.getItem('werkbaum-html-hash');
    const hash = html.substring(0, 300) + html.substring(html.length - 300);

    if(stored && stored !== hash){
      localStorage.setItem('werkbaum-update-available', 'true');
      logUpdate('✅ NEUE VERSION ERKANNT!');
      if(!document.hidden) checkAndShowUpdateNotification();
    } else if(!stored) {
      logUpdate('✓ Erste Prüfung – Hash gespeichert');
    } else {
      logUpdate('✓ Headers änderten sich, aber Content gleich');
    }

    localStorage.setItem('werkbaum-html-hash', hash);
    if(etag) localStorage.setItem('werkbaum-etag', etag);
    if(lastModified) localStorage.setItem('werkbaum-last-modified', lastModified);
  } catch(err) {
    logUpdate('⚠ ' + (err.message || 'Unbekannter Fehler'));
  }
}

function logUpdate(msg){
  const now = new Date().toLocaleTimeString('de-DE');
  const log = (localStorage.getItem('werkbaum-update-log') || '').split('\n').slice(-9);
  log.push(`[${now}] ${msg}`);
  localStorage.setItem('werkbaum-update-log', log.join('\n'));
}

/* Debug-Panel anzeigen (nur wenn localStorage Update-Log da ist) */
function showUpdateDebug(){
  let panel = document.getElementById('updateDebugPanel');
  if(!panel){
    panel = document.createElement('div');
    panel.id = 'updateDebugPanel';
    panel.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0,0,0,0.8);
      color: #0F766E;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
      max-width: 200px;
      max-height: 100px;
      overflow-y: auto;
      z-index: 999;
      border: 1px solid #0F766E;
      cursor: pointer;
    `;
    panel.title = 'Update Debug Panel – Klick zum Schließen';
    document.body.appendChild(panel);
    panel.addEventListener('click', () => panel.remove());
  }
  const log = localStorage.getItem('werkbaum-update-log') || '';
  panel.textContent = log ? log.split('\n').slice(-6).join('\n') : 'Keine Einträge';
}

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
