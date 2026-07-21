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

function nodeHtml(n, extra, opts){
  const { t, cheapPath } = opts;
  const need = needsBreakdown(n);
  const cls = ['node', extra || '', n.status ? 'st-' + n.status.key : '']
    .filter(Boolean).join(' ');
  const title = n.status ? ` title="${esc(t('st_' + n.status.key)).replace(/"/g,'&quot;')}"` : '';
  const tagsHtml = n.tags && n.tags.length
    ? `<span class="tags">${n.tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</span>`
    : '';
  const implicitTip = esc(t('implicitSizeTooltip')).replace(/"/g,'&quot;');
  const sizeBadge = n.size
    ? `<span class="size">${n.size}</span>`
    : (cheapPath ? `<span class="size implicit" title="${implicitTip}">M</span>` : '');
  const inner = esc(n.label) +
                (n.url ? '<span class="ext">↗</span>' : '') +
                sizeBadge +
                tagsHtml;
  const html = n.url
    ? `<a class="${cls}" href="${esc(n.url).replace(/"/g,'&quot;')}" target="_blank" rel="noopener"${title}>${inner}</a>`
    : `<div class="${cls}"${title}>${inner}</div>`;
  const ghostTip = esc(t('ghostTooltip')).replace(/"/g,'&quot;');
  const ghost = `<div class="ghost-node" title="${ghostTip}">${esc(t('ghost'))}</div>`;
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
