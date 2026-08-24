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
     collapsedSet,  // optional: eingeklappte Knoten (Faltung, SPEC §9/D38)
     effStatus,     // optional: Map Knoten -> effektiver Status-Key, nur
                    // Diskrepanzen (effectiveStatus() in model.js, D39)
   } */

import { gateOf, needsBreakdown, visibleChildren, cheapCls, isDone } from './model.js';

/* Zusatzklassen eines Knotens: günstigster Pfad (D18), „neu in Produktion"
   gegenüber der zuletzt gesehenen Fassung (D28, `freshSet` optional) und
   optionale Knoten (`+`, SPEC §3/D29 — trägt den hohlen Kreis am Abzweig). */
function extraCls(n, opts){
  /* Dieselbe Bedingung wie in `itemHtml`: eingeklappt ist ein Knoten nur, wenn
     er überhaupt sichtbare Kinder hat. Der Pfad braucht sie hier, weil ein
     eingeklappter Knoten seine verborgenen Pfad-Knoten vertritt (D38). */
  const collapsed = !!(opts.collapsedSet && opts.collapsedSet.has(n))
                 && visibleChildren(n, opts.showDiscarded).length > 0;
  const cheap = cheapCls(n, opts.cheapSet, collapsed);
  const fresh = opts.freshSet && opts.freshSet.has(n) ? 'fresh' : '';
  return [cheap, fresh, n.optional ? 'opt' : '', n.focus ? 'focusmark' : ''].filter(Boolean).join(' ');
}

/* Klassen des <li>: Gate der eigenen Kinder (steuert die Anordnung) plus
   `opt`, wenn der Knoten selbst optional ist (steuert den Strich des
   Abzweigs). Leere Liste ⇒ gar kein Attribut. */
function liClass(visibleKids, opts, optional){
  const cls = [
    visibleKids.length ? (gateOf(visibleKids) !== 'and' ? 'has-or' : 'has-and') : '',
    optional ? 'opt' : ''
  ].filter(Boolean);
  return cls.length ? ` class="${cls.join(' ')}"` : '';
}

export function esc(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
/* Escaping für Attributwerte (zusätzlich " -> &quot;). */
function attr(s){ return esc(String(s)).replace(/"/g,'&quot;'); }
/* Trennstrich im Knoten-Tooltip zwischen Beschreibung und Kurz-Fakten (D40).
   Box-Drawing-Zeichen statt Bindestrichen: `─` stößt gapless aneinander und
   liest sich als Linie, `---` als Text. */
const TIP_RULE = '─'.repeat(24);

/* Barrierefreier Name eines Knotens: Label + Status + Aufwand + Zuständige +
   Link. Die visuellen Badges (Größe, Tags, ↗) sind aria-hidden — ihre
   Information steckt hier, sonst würde der Screenreader Kryptisches („M",
   „anna", „↗") vorlesen. */
function nodeAria(n, opts, fold){
  const { t, cheapPath } = opts;
  const parts = [n.label];
  /* Eingeklappt (SPEC §9/D38): das ▾/▸-Zeichen ist aria-hidden — ohne diese
     Ansage wüsste ein Screenreader nicht, dass hier etwas verborgen ist. */
  if(fold && fold.collapsed) parts.push(t('a11yFolded', {n: fold.count}));
  if(n.status) parts.push(t('a11yStatus', {status: t('st_' + n.status.key)}));
  /* Diskrepanz (D39): die Farbe zeigt den effektiven Status — der Screenreader
     bekommt beide, wie der Tooltip. */
  const effKey = opts.effStatus ? opts.effStatus.get(n) : undefined;
  if(effKey) parts.push(t('a11yEffective', {status: t('st_' + effKey)}));
  if(n.size) parts.push(t('a11ySize', {size: n.size}));
  else if(cheapPath && !isDone(n)) parts.push(t('a11ySizeImplicit'));
  if(n.tags && n.tags.length) parts.push(t('a11yTags', {names: n.tags.join(', ')}));
  /* Knoten-ID und Abhängigkeiten (SPEC §1, D36/D37): keine eigene Darstellung
     im Diagramm — sichtbar nur im Tooltip und hier. */
  if(n.id) parts.push(t('a11yId', {id: n.id}));
  if(n.deps && n.deps.length)
    parts.push(t('a11yDeps', {ids: n.deps.map(d => '#' + d).join(', ')}));
  if(n.optional) parts.push(t('a11yOptional'));
  /* Die Fokusmarke ist rein als box-shadow sichtbar — ohne diese Ansage wüsste
     ein Screenreader nichts davon. Zugleich der einzige Ort, an dem sie sich von
     der eigenen Cursor-Zeile unterscheidet (SPEC §9). */
  if(n.focus) parts.push(t('a11yFocusMark'));
  if(n.url) parts.push(t('a11yLink'));
  /* Beschreibung (SPEC §11/D40): der Text selbst — die ”-Marke ist aria-hidden. */
  if(n.desc) parts.push(n.desc.replace(/\s+/g, ' '));
  return parts.join(', ');
}

function nodeHtml(n, extra, opts, fold){
  const { t, cheapPath } = opts;
  const need = needsBreakdown(n);
  /* Die Knotenfarbe zeigt den EFFEKTIVEN Status (SPEC §9/D39); bei Diskrepanz
     trägt die Marke unten links die eigene Statusbox in den eigenen Farben. */
  const effKey = opts.effStatus ? opts.effStatus.get(n) : undefined;
  /* `done` = erledigt laut eigener Statusbox (`[x]`/`[^]`). Trägt allein die
     Ausnahme von der Pfad-Inversion (D46-Nachtrag): Was getan ist, wird nie
     ausgeblasst — auch als optionaler Knoten oder nicht gewählte Alternative.
     Der INTRINSISCHE Status entscheidet, wie überall dort, wo es um geleistete
     Arbeit geht (D35/D28/D46); die Farbe bleibt die des effektiven (D39). */
  const cls = ['node', extra || '', fold && fold.collapsed ? 'folded' : '',
               effKey ? 'held' : '', isDone(n) ? 'done' : '',
               n.status ? 'st-' + (effKey || n.status.key) : '']
    .filter(Boolean).join(' ');
  /* Zeilennummer am Knoten (D25): Grundlage für den Sprung ins Textfeld und
     für die Gegenrichtung (Cursor-Zeile -> Knoten hervorheben). Der Hinweis im
     Tooltip macht die sonst unsichtbare Alt-Klick-Geste auffindbar. */
  const lineAttr = n.line ? ` data-line="${n.line}"` : '';
  /* ID und Abhängigkeiten als data-Attribute (D41): Grundlage für die
     Querverbindungs-Ebene und den Export — beide arbeiten auf dem DOM. */
  const idAttr = n.id ? ` data-id="${attr(n.id)}"` : '';
  const depsAttr = n.deps && n.deps.length ? ` data-deps="${attr(n.deps.join(' '))}"` : '';
  /* Zeilen der Beschreibung (SPEC §9): Steht der Cursor dort, gilt dieser
     Knoten als ausgewählt — die Zeile hat keinen eigenen. Als Liste, damit
     der Attribut-Selektor `~=` sie einzeln trifft. */
  const descLinesAttr = n.descLines && n.descLines.length
    ? ` data-desc-lines="${attr(n.descLines.join(' '))}"` : '';
  /* Tooltip: erst die Beschreibung (mehrzeilig, D40), dann die Kurz-Fakten.
     Die Fakten hängen NICHT mit ` · ` an den Fließtext an — sie sind eine
     andere Art von Aussage, und in der einen Zeile ging der Übergang unter
     („hinten drangeklatscht"). Deshalb Leerzeile plus Trennstrich dazwischen.
     Ein `title` kann nur Text, keine Linie — der Strich ist deshalb aus
     `─` gebaut. Er steht nur, wenn es wirklich etwas zu trennen gibt, und
     bleibt schmaler als die Fakten-Zeile (die den Sprung-Hinweis enthält),
     verbreitert den Tooltip also nicht. Der `aria-label` bekommt ihn NICHT:
     ein Screenreader läse die Striche einzeln vor (nodeAria oben). */
  const facts = [n.id ? '#' + n.id : '',
                 n.deps && n.deps.length ? '→ ' + n.deps.map(d => '#' + d).join(', ') : '',
                 effKey
                   ? t('heldTooltip', {eff: t('st_' + effKey), own: t('st_' + n.status.key)})
                   : (n.status ? t('st_' + n.status.key) : ''),
                 n.optional ? t('a11yOptional') : '', t('jumpHint')]
    .filter(Boolean).join(' · ');
  const tip = n.desc && facts ? n.desc + '\n\n' + TIP_RULE + '\n' + facts
            : (n.desc || facts);
  const title = ` title="${attr(tip)}"`;
  const tagsHtml = n.tags && n.tags.length
    ? `<span class="tags" aria-hidden="true">${n.tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join('')}</span>`
    : '';
  /* Das implizite M-Badge macht eine KOSTENANNAHME sichtbar (D18). An einem
     erledigten Knoten wird keine getroffen — er kostet nichts mehr (D46) —,
     dort bleibt es deshalb weg. */
  const implicitTip = attr(t('implicitSizeTooltip'));
  const sizeBadge = n.size
    ? `<span class="size" aria-hidden="true">${n.size}</span>`
    : (cheapPath && !isDone(n) ? `<span class="size implicit" aria-hidden="true" title="${implicitTip}">M</span>` : '');
  /* High-Risk: Warndreieck (⚠, Textpräsentation via VS15) an der oberen linken
     Ecke. aria-hidden — die Information steckt bereits im Status des aria-label. */
  const riskMark = n.status && n.status.key === 'highrisk'
    ? `<span class="risk" aria-hidden="true" title="${attr(t('riskTooltip'))}">⚠︎</span>`
    : '';
  /* Falt-Zeichen (SPEC §9/D38): ▾ offen, „▸ n" eingeklappt — das Klickziel
     fürs Umklappen (der einfache Klick auf den Knoten bleibt der Link, §6).
     aria-hidden: die Information steht im aria-label (a11yFolded). */
  const foldHtml = fold
    ? `<span class="fold" aria-hidden="true">${fold.collapsed ? '▸ ' + fold.count : '▾'}</span>`
    : '';
  const expanded = fold ? ` aria-expanded="${!fold.collapsed}"` : '';
  /* Diskrepanz-Marke: die eigene Statusbox in den eigenen §4-Farben —
     „selbst schon [x], wartet auf Abhängigkeiten" (D39). */
  const ownChip = effKey
    ? `<span class="chip ownst st-${n.status.key}" aria-hidden="true">[${n.status.code}]</span>`
    : '';
  const inner = foldHtml +
                esc(n.label) +
                /* ”-Marke (D40): macht die sonst unsichtbare Beschreibung
                   auffindbar (Lehre aus D25) — spiegelt das "-Zeichen der
                   Notation. Nicht im Export: Der Text selbst kann dort nicht
                   erscheinen, eine Marke ohne Ziel wäre Rauschen. */
                (n.desc ? '<span class="desc-mark" aria-hidden="true">”</span>' : '') +
                (n.url ? '<span class="ext" aria-hidden="true">↗</span>' : '') +
                riskMark +
                sizeBadge +
                tagsHtml +
                ownChip;
  const aria = ` aria-label="${attr(nodeAria(n, opts, fold))}"`;
  const html = n.url
    ? `<a class="${cls}" href="${attr(n.url)}" target="_blank" rel="noopener"${lineAttr}${idAttr}${depsAttr}${descLinesAttr}${aria}${expanded}${title}>${inner}</a>`
    : `<div class="${cls}" tabindex="0"${lineAttr}${idAttr}${depsAttr}${descLinesAttr}${aria}${expanded}${title}>${inner}</div>`;
  const ghostTip = attr(t('ghostTooltip'));
  const ghost = `<div class="ghost-node" aria-label="${ghostTip}" title="${ghostTip}">${esc(t('ghost'))}</div>`;
  return html + (need ? ghost : '');
}

/* Eingeklappter Teilbaum (SPEC §9/D38): Das HTML entfällt, aber die
   Warnungen des verborgenen Teils werden trotzdem gemeldet — sie sind eine
   Aussage über den TEXT, nicht über die Ansicht. Derselbe Lauf zählt die
   verborgenen Knoten für das „▸ n"-Kennzeichen. */
function walkFolded(node, warnings, opts){
  const kids = visibleChildren(node, opts.showDiscarded);
  if(!kids.length) return 0;
  const types = new Set(kids.map(k => k.type));
  if(types.size > 1){
    warnings.push({type: 'mixedGate', line: kids[0].line, label: node.label});
  }
  let count = kids.length;
  for(const k of kids) count += walkFolded(k, warnings, opts);
  return count;
}

/* Ein Knoten samt <li> und (sofern nicht eingeklappt) seiner Kinder. */
function itemHtml(n, extra, warnings, opts){
  const vk = visibleChildren(n, opts.showDiscarded);
  const canFold = vk.length > 0;
  const collapsed = canFold && !!(opts.collapsedSet && opts.collapsedSet.has(n));
  const fold = canFold
    ? {collapsed, count: collapsed ? walkFolded(n, warnings, opts) : 0}
    : null;
  /* `opt` auch am <li>: den Abzweig zeichnen dessen Pseudoelemente, er wird
     für optionale Knoten gestrichelt (D29). Eingeklappt ist der Knoten ein
     Blatt — kein has-*-Layout, keine Kinderliste. */
  const liCls = liClass(collapsed ? [] : vk, opts, n.optional);
  return `<li${liCls}>` +
         nodeHtml(n, extra, opts, fold) +
         (collapsed ? '' : renderChildren(n, warnings, opts)) +
         `</li>`;
}

function renderChildren(node, warnings, opts){
  const kids = visibleChildren(node, opts.showDiscarded);
  if(!kids.length) return '';
  /* Gemischte Gates (SPEC §3): Da `+` nur `optional` setzt und `type:'and'`
     behält, schlägt das hier genau dann an, wenn `|` oder `=` mit `-`/`+`
     (oder untereinander) gemischt wird — `-` neben `+` ist erlaubt und still. */
  const types = new Set(kids.map(k => k.type));
  if(types.size > 1){
    /* strukturierte Warnung (Typ + Zeile); Formatierung in warnings.js */
    warnings.push({type: 'mixedGate', line: kids[0].line, label: node.label});
  }
  const gate = gateOf(kids);
  /* XOR-Gruppen (`=`, SPEC §3/§9) erben die komplette any-of-Geometrie über
     die Klasse `or` (alle Modi, Export-Routing); `xor` ergänzt nur die
     „1"-Plakette an der Sammelleiste (D35). */
  const ulCls = gate === 'xor' ? 'or xor' : gate;
  const items = kids.map(k => itemHtml(k, extraCls(k, opts), warnings, opts)).join('');
  return `<ul class="${ulCls}">${items}</ul>`;
}

/* Baut den inneren HTML-String für #out aus (bereits gefilterten) Wurzeln und
   sammelt strukturierte Warnungen ({type, line, ...}, siehe warnings.js).
   Leere Wurzelliste ⇒ leerer String. */
export function renderTreeHtml(roots, opts){
  const warnings = [];
  const html = roots.map(root =>
    itemHtml(root, ('root-node ' + extraCls(root, opts)).trim(), warnings, opts)
  ).join('');
  return { html, warnings };
}
