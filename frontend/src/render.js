/* Werkbaum-Renderer — erzeugt den HTML-String des Diagrammbaums (die <li>-Liste
   für #out). Headless: keine DOM-Zugriffe, kein globaler UI-State. Alles kommt
   über `opts` herein. Der Darstellungsmodus (horizontal/vertikal/kompakt) ist
   rein CSS (Klasse am Container, von app.js gesetzt) und ändert diesen String
   NICHT. Vgl. docs/SPEC.md §4–§9, D18.

   opts = {
     t,             // i18n-Funktion (key, vars?) -> String
     showDiscarded, // verworfene einblenden?
     cheapPath,     // günstigster Pfad aktiv? (steuert das implizite M-Badge)
     cheapSet,      // Set der nötigen Knoten (leer, wenn Pfad aus)
     freshSet,      // optional: Knoten, die neu in Produktion sind (D28)
   } */

import { gateOf, needsBreakdown, visibleChildren, cheapCls } from './model.js';

/* Zusatzklassen eines Knotens: günstigster Pfad (D18), „neu in Produktion"
   gegenüber der zuletzt gesehenen Fassung (D28, `freshSet` optional) und
   optionale Knoten (`+`, SPEC §3/D29 — trägt den hohlen Kreis am Abzweig). */
function extraCls(n, opts){
  const cheap = cheapCls(n, opts.cheapSet);
  const fresh = opts.freshSet && opts.freshSet.has(n) ? 'fresh' : '';
  return [cheap, fresh, n.optional ? 'opt' : ''].filter(Boolean).join(' ');
}

export function esc(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
/* Escaping für Attributwerte (zusätzlich " -> &quot;). */
function attr(s){ return esc(String(s)).replace(/"/g,'&quot;'); }

/* Barrierefreier Name eines Knotens: Label + Status + Aufwand + Zuständige +
   Link. Die visuellen Badges (Größe, Tags, ↗) sind aria-hidden — ihre
   Information steckt hier, sonst würde der Screenreader Kryptisches („M",
   „anna", „↗") vorlesen. */
function nodeAria(n, opts){
  const { t, cheapPath } = opts;
  const parts = [n.label];
  if(n.status) parts.push(t('a11yStatus', {status: t('st_' + n.status.key)}));
  if(n.size) parts.push(t('a11ySize', {size: n.size}));
  else if(cheapPath) parts.push(t('a11ySizeImplicit'));
  if(n.tags && n.tags.length) parts.push(t('a11yTags', {names: n.tags.join(', ')}));
  if(n.optional) parts.push(t('a11yOptional'));
  if(n.url) parts.push(t('a11yLink'));
  return parts.join(', ');
}

function nodeHtml(n, extra, opts){
  const { t, cheapPath } = opts;
  const need = needsBreakdown(n);
  const cls = ['node', extra || '', n.status ? 'st-' + n.status.key : '']
    .filter(Boolean).join(' ');
  /* Zeilennummer am Knoten (D25): Grundlage für den Sprung ins Textfeld und
     für die Gegenrichtung (Cursor-Zeile -> Knoten hervorheben). Der Hinweis im
     Tooltip macht die sonst unsichtbare Alt-Klick-Geste auffindbar. */
  const lineAttr = n.line ? ` data-line="${n.line}"` : '';
  const tip = [n.status ? t('st_' + n.status.key) : '',
               n.optional ? t('a11yOptional') : '', t('jumpHint')]
    .filter(Boolean).join(' · ');
  const title = ` title="${attr(tip)}"`;
  const tagsHtml = n.tags && n.tags.length
    ? `<span class="tags" aria-hidden="true">${n.tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</span>`
    : '';
  const implicitTip = attr(t('implicitSizeTooltip'));
  const sizeBadge = n.size
    ? `<span class="size" aria-hidden="true">${n.size}</span>`
    : (cheapPath ? `<span class="size implicit" aria-hidden="true" title="${implicitTip}">M</span>` : '');
  /* High-Risk: Warndreieck (⚠, Textpräsentation via VS15) an der oberen linken
     Ecke. aria-hidden — die Information steckt bereits im Status des aria-label. */
  const riskMark = n.status && n.status.key === 'highrisk'
    ? `<span class="risk" aria-hidden="true" title="${attr(t('riskTooltip'))}">⚠︎</span>`
    : '';
  const inner = esc(n.label) +
                (n.url ? '<span class="ext" aria-hidden="true">↗</span>' : '') +
                riskMark +
                sizeBadge +
                tagsHtml;
  const aria = ` aria-label="${attr(nodeAria(n, opts))}"`;
  const html = n.url
    ? `<a class="${cls}" href="${attr(n.url)}" target="_blank" rel="noopener"${lineAttr}${aria}${title}>${inner}</a>`
    : `<div class="${cls}" tabindex="0"${lineAttr}${aria}${title}>${inner}</div>`;
  const ghostTip = attr(t('ghostTooltip'));
  const ghost = `<div class="ghost-node" aria-label="${ghostTip}" title="${ghostTip}">${esc(t('ghost'))}</div>`;
  return html + (need ? ghost : '');
}

function renderChildren(node, warnings, opts){
  const kids = visibleChildren(node, opts.showDiscarded);
  if(!kids.length) return '';
  /* Gemischte Gates (SPEC §3): Da `+` nur `optional` setzt und `type:'and'`
     behält, schlägt das hier weiterhin genau dann an, wenn `|` mit `-`/`+`
     gemischt wird — `-` neben `+` ist erlaubt und still. */
  const types = new Set(kids.map(k => k.type));
  if(types.size > 1){
    /* strukturierte Warnung (Typ + Zeile); Formatierung in warnings.js */
    warnings.push({type: 'mixedGate', line: kids[0].line, label: node.label});
  }
  const gate = gateOf(kids);
  const items = kids.map(k => {
    const vk = visibleChildren(k, opts.showDiscarded);
    const liCls = vk.length ? (gateOf(vk) === 'or' ? ' class="has-or"' : ' class="has-and"') : '';
    return `<li${liCls}>` +
           nodeHtml(k, extraCls(k, opts), opts) +
           renderChildren(k, warnings, opts) +
           `</li>`;
  }).join('');
  return `<ul class="${gate}">${items}</ul>`;
}

/* Baut den inneren HTML-String für #out aus (bereits gefilterten) Wurzeln und
   sammelt strukturierte Warnungen ({type, line, ...}, siehe warnings.js).
   Leere Wurzelliste ⇒ leerer String. */
export function renderTreeHtml(roots, opts){
  const warnings = [];
  const html = roots.map(root => {
    const vk = visibleChildren(root, opts.showDiscarded);
    const liCls = vk.length ? (gateOf(vk) === 'or' ? ' class="has-or"' : ' class="has-and"') : '';
    return `<li${liCls}>` +
           nodeHtml(root, ('root-node ' + extraCls(root, opts)).trim(), opts) +
           renderChildren(root, warnings, opts) +
           `</li>`;
  }).join('');
  return { html, warnings };
}
