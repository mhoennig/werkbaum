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
   } */

import { gateOf, needsBreakdown, visibleChildren, cheapCls } from './model.js';

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
  if(n.url) parts.push(t('a11yLink'));
  return parts.join(', ');
}

function nodeHtml(n, extra, opts){
  const { t, cheapPath } = opts;
  const need = needsBreakdown(n);
  const cls = ['node', extra || '', n.status ? 'st-' + n.status.key : '']
    .filter(Boolean).join(' ');
  const title = n.status ? ` title="${attr(t('st_' + n.status.key))}"` : '';
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
    ? `<a class="${cls}" href="${attr(n.url)}" target="_blank" rel="noopener"${aria}${title}>${inner}</a>`
    : `<div class="${cls}" tabindex="0"${aria}${title}>${inner}</div>`;
  const ghostTip = attr(t('ghostTooltip'));
  const ghost = `<div class="ghost-node" aria-label="${ghostTip}" title="${ghostTip}">${esc(t('ghost'))}</div>`;
  return html + (need ? ghost : '');
}

function renderChildren(node, warnings, opts){
  const kids = visibleChildren(node, opts.showDiscarded);
  if(!kids.length) return '';
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
           nodeHtml(k, cheapCls(k, opts.cheapSet), opts) +
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
           nodeHtml(root, ('root-node ' + cheapCls(root, opts.cheapSet)).trim(), opts) +
           renderChildren(root, warnings, opts) +
           `</li>`;
  }).join('');
  return { html, warnings };
}
