import './style.css';
import { parse, setFoldMark, expandShortIds, shortIdClosed } from './parser.js';
import { computeCheapPlan, overloadedAssignee, assigneeLoads, freshProdSet, initialCollapsed, nodeKeys, effectiveStatus, presetFoldSet, personFoldSet, allTags, lineTargets } from './model.js';
import { esc, renderTreeHtml, TIP_RULE } from './render.js';
import { formatWarning, warningText } from './warnings.js';
import * as live from './live.js';
import { depFragment, collectIds, matchIds, depIdAt, idLine } from './autocomplete.js';
import { LS_SNAPS, SNAP_EVERY, parseSnaps, addSnapshot, persistSnaps, snapLabel }
  from './snapshots.js';
import { FILE_ACCEPT, FILE_TYPES, saveFileName } from './localfile.js';
import { LIVE_PARAM, SOURCE_PARAM, ETHERPAD_PARAM, docSearch, docKind } from './docurl.js';
import { readDocs, storeDocs, storeDocText, isDocKey, LS_DOCS, LS_ACTIVE, LS_SRC } from './docstore.js';
/* Neuigkeiten (D58): die git-Historie, zur BAUZEIT eingelesen (Vite-Plugin in
   vite.config.js). Zur Laufzeit gibt es kein git — und keinen Server, der
   nachliefern könnte (D11/D19). Leer, wo git nicht erreichbar war. */
import NEWS from 'virtual:werkbaum-news';
/* Werkbaum, mit Werkbaum geplant — als mitgeliefertes Dokument „Werkbank" (D27).
   Dieselbe Datei, die auch per ?sourceUrl= geladen werden kann; `?raw` bettet
   sie beim Build in die eine Ausgabedatei ein (D19), es wird nichts nachgeladen
   (D20). Quelle bleibt docs/examples/ — keine Kopie, die auseinanderläuft. */
import WERKBAUM_DOC from '../../docs/examples/werkbaum.werkbaum?raw';

const INITIAL = `%% Project structure – Sprint 14
[~] Website relaunch (XL) https://wiki.example.com/relaunch
  " Folded chapters are done — click the ▸ to peek inside.
  - [x] > Concept (M)
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
const peopleBar = document.getElementById('peopleBar');
/* Zeilennummern-Streifen (D33) — hier oben geholt, weil render() ihn füllt. */
const srcWrap = document.getElementById('srcWrap');
const lineNoBox = document.getElementById('lineNos');
const lineNoInner = lineNoBox.firstElementChild;

/* Baum-/Kostenlogik (gateOf, needsBreakdown, visibleChildren, günstigster
   Pfad) lebt headless in model.js, das HTML-Erzeugen in render.js. Hier bleibt
   nur der UI-State des Günstigster-Pfad-Toggles (persistiert). */
let cheapPathOn = true;
let depLinksOn = true; /* Querverbindungen der Abhängigkeiten anzeigen (D75) */
let showIds = false;   /* Knoten-IDs im Diagramm einblenden (D56) */
/* Falt-Durchschalter (SPEC §9/D75): vier Voreinstellungen, reihum. `Next` ist
   der Schritt, den der nächste Druck ausführt (Icon + Tooltip zeigen IHN),
   `Applied` der zuletzt hergestellte — render() prüft ihn gegen den Baum und
   setzt die Position zurück, sobald er nicht mehr stimmt. Nicht persistiert:
   Der Faltzustand steht im Text (D38), die Position ist nur der Zeiger darin. */
const FOLD_CYCLE = ['small', 'path', 'closed', 'open'];
let foldCycleNext = 0, foldCycleApplied = -1;
/* Sichtbarer Bereich auf kleinem Bildschirm (D17-Nachtrag): dort ist immer
   genau einer zu sehen. Hier oben deklariert, weil saveUI() ihn liest und schon
   aus applySplit() heraus laufen kann — weiter unten stünde er dann noch in der
   temporalen Todeszone. */
let mobilePane = 'diagram';
/* Cursor-Zeile (D25) — bleibt `null`, bis der Cursor das erste Mal bewegt wurde,
   sonst wäre nach dem Laden ungefragt die Wurzel markiert. Aus demselben Grund
   hier oben: der Zeilennummern-Streifen (D33) liest sie, und der hängt an
   render(). */
let caretLine = null, currentNodeEl = null;
/* Warnung des ?sourceUrl-Ladens (D23) — zeilenlos und persistent, siehe render(). */
let sourceWarning = null;
/* Scheitert das Speichern im Browser (Quota voll), wird das GEMELDET statt
   geschluckt (D82) — vorher lief der Editor scheinbar normal weiter, und der
   Verlust fiel erst beim Neuladen auf. Persistent, bis ein Schreiben wieder
   gelingt; zeilenlos und zuoberst. */
let storeWarning = null;
/* Ein ANDERER Tab schreibt in dieselbe Dokument-Ablage (D84): Das
   storage-Ereignis feuert nur in fremden Tabs desselben Ursprungs — genau
   das richtige Signal. Kein Sync (der letzte Flush gewinnt weiterhin, wie
   immer), aber kein STILLER Verlust mehr: Die Warnung bleibt stehen,
   solange dieser Tab lebt — die Lage ändert sich ja nicht dadurch, dass
   der andere Tab gerade nichts schreibt. */
let tabWarning = null;
window.addEventListener('storage', e => {
  if(tabWarning || !e.key || !isDocKey(e.key)) return;
  tabWarning = {type: 'tabConflict'};
  render();
});
/* Zwei lebende Fenster sind mehr als eine Fußnote (D89): Die zeilenlose
   Warnung oben meldet nur, dass ein anderer Tab GESCHRIEBEN hat — ein
   zweites offenes Fenster bekommt zusätzlich einen MODALEN Dialog, in beiden
   Fenstern, bis das Problem behoben ist. Herzschlag über BroadcastChannel:
   jedes Fenster meldet sich sekündlich; verstummt das andere (Abmeldung beim
   Schließen, sonst 3 s Stille), schließt der Dialog sich von selbst — die
   App läuft ohne weiteren Klick weiter. „Trotzdem fortfahren" ist die
   Notluke und gilt nur, solange DIESES zweite Fenster lebt. */
/* Wachhund-Warnung (D89): Ungesendete Live-Änderungen bzw. tote Sitzung.
   Gesetzt vom 5-s-Takt im Live-Abschnitt, gelesen von render(). */
let liveWarning = null;
const WIN_ID = Math.random().toString(36).slice(2);
/* 75 s statt weniger Sekunden: Chrome drosselt die Timer verborgener Fenster
   nach fünf Minuten auf einen Tick je MINUTE (dieselbe Umgebungsgrenze wie in
   D79 gemessen) — ein kürzerer Timeout ließe den Dialog im sichtbaren Fenster
   flackern, weil das verborgene nur noch minütlich schlägt. Das saubere
   Schließen meldet sich ohnehin sofort ab (bye bei pagehide); der Timeout
   fängt nur hart gestorbene Fenster. */
const FOREIGN_DEAD_MS = 75000;
let presenceChannel = null, tabModalEl = null;
const foreignBeats = new Map();       /* fremde Fenster-Id -> letzter Herzschlag */
const tabModalDismissed = new Set();  /* Notluke gilt je fremder Id, nicht je Sitzung:
                                         ein NEUES zweites Fenster bekommt wieder den Dialog */
try{ presenceChannel = new BroadcastChannel('werkbaum-presence'); }catch(_){}
if(presenceChannel){
  presenceChannel.onmessage = e => {
    const m = e.data || {};
    if(!m.id || m.id === WIN_ID) return;
    if(m.type === 'hello') presenceChannel.postMessage({type: 'beat', id: WIN_ID});
    if(m.type === 'hello' || m.type === 'beat') foreignBeats.set(m.id, Date.now());
    if(m.type === 'bye'){ foreignBeats.delete(m.id); tabModalDismissed.delete(m.id); }
    updateTabModal();
  };
  presenceChannel.postMessage({type: 'hello', id: WIN_ID});
  setInterval(() => {
    presenceChannel.postMessage({type: 'beat', id: WIN_ID});
    for(const [id, wann] of foreignBeats)
      if(Date.now() - wann > FOREIGN_DEAD_MS){ foreignBeats.delete(id); tabModalDismissed.delete(id); }
    updateTabModal();
  }, 1000);
  addEventListener('pagehide', () => { try{ presenceChannel.postMessage({type: 'bye', id: WIN_ID}); }catch(_){} });
}
function updateTabModal(){
  const offen = [...foreignBeats.keys()].some(id => !tabModalDismissed.has(id));
  if(offen && !tabModalEl){
    const ov = document.createElement('div');
    ov.className = 'tabmodal-overlay';
    ov.innerHTML = '<div class="tabmodal" role="alertdialog" aria-modal="true">' +
      '<h2></h2><p></p><button type="button" class="tabmodal-force"></button></div>';
    ov.querySelector('h2').textContent = t('tabModalTitle');
    ov.querySelector('p').textContent = t('tabModalText');
    const force = ov.querySelector('.tabmodal-force');
    force.textContent = t('tabModalForce');
    force.addEventListener('click', () => {
      for(const id of foreignBeats.keys()) tabModalDismissed.add(id);
      updateTabModal();
    });
    document.body.appendChild(ov);
    tabModalEl = ov;
  }
  if(!offen && tabModalEl){ tabModalEl.remove(); tabModalEl = null; }
}
function noteStore(ok){
  const neu = ok ? null : {type: 'storeFailed'};
  const wechsel = (!!storeWarning) !== (!!neu);
  storeWarning = neu;
  if(wechsel) render();   /* nur an der Flanke — nicht bei jedem Tastendruck */
}
/* Steht die App? Erst danach folgt die Adresszeile dem aktiven Dokument (D80)
   und wird eine Live-Sitzung beim Umschalten übernommen. Während des Starts
   dürfen beide nicht laufen: `loadRemoteSource()`/`loadLive()` lesen ihre
   Parameter erst nach dem Wiederherstellen des zuletzt aktiven Dokuments —
   ein vorschnelles Aufräumen der Adresszeile nähme ihnen die Vorlage. Hier
   oben deklariert, weil `loadActiveIntoEditor()` schon beim Start läuft. */
let bootDone = false;
/* „Was ist neu?" (D28): Knoten, die gegenüber der zuletzt GESEHENEN Fassung neu
   in Produktion sind. Gilt immer für genau ein Dokument (`freshDocId`) — nur
   Dokumente von außen (mitgeliefert oder ?sourceUrl=) haben eine
   Vergleichsfassung. `freshBaseline` ist der Text, gegen den verglichen wurde;
   er wird erst beim Bestätigen fortgeschrieben. */
let freshSet = new Set(), freshDocId = null, freshBaseline = null, freshPrevRoots = null;
/* Führt das Neuigkeiten-Popup gerade einen Tag vor (D58)? Dann tritt dessen
   Knotenmenge an die Stelle des Besuchsvergleichs — `newsDay` ist das Datum
   (auch die Marke im Popup), `newsKeySet` die Label-Pfade. Sitzungssache: Der
   Faltzustand steht im Text (D38), der Besuchsstand im localStorage — eine
   vorgeführte Chronik ist weder das eine noch das andere. */
let newsDay = null, newsKeySet = null;
/* Faltung (SPEC §9, D38): `foldOverrides` sind die interaktiven Eingriffe des
   Nutzers (Schlüssel = Label-Pfad wie bei D28, damit sie das Neu-Parsen bei
   jedem Tastendruck überleben); sie überlagern den Anfangszustand aus den
   Textmarken, gelten nur für die Sitzung und fallen beim Dokumentwechsel weg.
   `foldByLine` ist der Zustand des letzten Renders für Klick/Tastatur. */
let foldOverrides = new Map(), foldByLine = new Map();
/* Personen-Linse (SPEC §9, D87): `lens` ist null (aus) oder `{tag}` — der
   Personen-Tag bzw. `tag: null` für „ohne Zuständigen". REIN Ansicht und
   Sitzungssache: Sie überlagert den Faltzustand nur für die Darstellung,
   in den Text wird nichts geschrieben — in einem geteilten Dokument ginge
   der persönliche Filter sonst als Textänderung an alle (D76/D38).
   `lensOverrides` sind Hand-Faltungen WÄHREND der Linse (Label-Pfad-Schlüssel
   wie `foldOverrides`); Ausschalten stellt den textdefinierten Zustand
   wieder her. */
let lens = null, lensOverrides = new Map();
function clearLens(){ lens = null; lensOverrides.clear(); }
/* Zeile -> Zeile des sichtbaren Vertreters (D38-Nachtrag 4): Für Zeilen in
   eingeklappten Teilbäumen zeigt sie auf den nächsten sichtbaren Vorfahren;
   `nodeOfLine()` greift darauf zurück, wenn die Zeile keinen DOM-Knoten hat. */
let lineTargetMap = new Map();

/* Der zuletzt geparste Baum, UNGEFILTERT — die ID-Vorschläge (D63) lesen
   daraus die vergebenen IDs, und eine Abhängigkeit darf auch auf Verworfenes
   zeigen. */
let acRoots = [];

/* ---------- Renderer (Anbindung an den DOM) ----------
   parse -> Wurzeln filtern (verworfene) -> günstigen Pfad markieren ->
   render.js baut den HTML-String -> in #out schreiben -> Pfadlinie zeichnen. */
function render(){
  /* Das Knoten-Fenster (D52) hängt an einem Element, das der Neubau ersetzt —
     und seine Position ist ohnehin gemessen, also gleich hinfällig. */
  closeNodeTip();
  const parsed = parse(src.value);
  acRoots = parsed.roots;
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
  if(tabWarning) warnings = [tabWarning].concat(warnings);       /* fremder Tab schreibt mit (D84) */
  if(liveWarning) warnings = [liveWarning].concat(warnings);     /* Ungesendetes / tote Sitzung (D89) */
  if(storeWarning) warnings = [storeWarning].concat(warnings);   /* Datenverlust droht — zuoberst (D82) */

  /* Personen-Linse (D87): erlischt, sobald es die Person (oder überhaupt
     Tags) im Dokument nicht mehr gibt — sonst zeigte sie auf nichts. */
  const docTags = allTags(roots);
  if(lens && (!docTags.length || (lens.tag !== null && !docTags.includes(lens.tag)))) clearLens();

  if(!roots.length){
    out.innerHTML = `<div class="empty">${esc(t('empty'))}</div>`;
    freshSet = new Set();
    foldByLine = new Map();
    lineTargetMap = new Map();
    peopleBar.hidden = true;
  } else {
    /* Günstigster Pfad auf der Dependency Closure (D42): scheitert die exakte
       Suche an zu vielen gekoppelten Gruppen, wird die gierige Schätzung
       BENANNT statt stillschweigend geliefert (zeilenlose Warnung). */
    let cheapSet = new Set(), overload = null;
    if(cheapPathOn){
      const plan = computeCheapPlan(roots);
      cheapSet = plan.set;
      if(!plan.exact) warnings = warnings.concat([{type: 'cheapApprox'}]);
      /* Zuständigen-Engpass (SPEC §9/D71): Trägt eine Person mehr als die
         Hälfte der offenen Pfad-Arbeit, wird das zeilenlos gemeldet und ihre
         Pillen an offenen Pfad-Knoten warnfarben (overloadTag unten). */
      overload = overloadedAssignee(roots, cheapSet);
      if(overload) warnings = warnings.concat([{type: 'assigneeOverload', ...overload}]);
    }
    out.classList.toggle('cheap-on', cheapPathOn);
    /* Faltung (D38): Anfangszustand aus den Textmarken (`!!!` holt sich mit
       hervor), überlagert von den Sitzungs-Eingriffen des Nutzers. Wie bei
       `freshSet` muss die Menge aus den gerade geparsten Knoten bestehen. */
    const initFold = initialCollapsed(roots, true);
    const keys = nodeKeys(roots);
    /* Die Menge MUSS aus denselben Knotenobjekten gebildet werden, die gerade
       gerendert werden — `freshProdSet` liefert Knoten aus `roots`. Eine früher
       berechnete Menge stammte aus einem anderen Parse-Durchlauf und träfe per
       Objektidentität nie zu (D28).
       Führt das Neuigkeiten-Popup gerade einen Tag vor (D58), gilt dessen
       Knotenmenge STATT des Vergleichs mit dem letzten Besuch: Es ist dieselbe
       Ansicht, nur mit einer anderen Frage — „was geschah am 24.08." statt
       „was ist seit deinem letzten Besuch live gegangen". */
    if(newsKeySet){
      freshSet = new Set();
      keys.forEach((key, n) => { if(newsKeySet.has(key)) freshSet.add(n); });
    } else {
      freshSet = (freshDocId === activeId && freshPrevRoots)
        ? freshProdSet(freshPrevRoots, roots) : new Set();
    }
    const collapsedSet = new Set();
    foldByLine = new Map();
    /* Reihum-Position des Falt-Durchschalters (SPEC §9/D75): nicht gemerkt,
       sondern am Baum GEPRÜFT — die D44-Linie, nur dass der Knopf jetzt vier
       Voreinstellungen durchläuft. Beschreibt der Baum nicht mehr den zuletzt
       hergestellten Schritt (Hand-Faltung, Textänderung, Dokumentwechsel),
       beginnt der nächste Druck wieder vorn. Der 'path'-Schritt braucht den
       günstigsten Pfad auch bei ausgeschaltetem Pfad-Umschalter — dann wird
       er hier eigens für die Prüfung gerechnet (dieselbe Rechnung, die sonst
       ohnehin je Tastendruck läuft). */
    let presetSet = null, presetMatch = true;
    /* Bei aktiver Linse (D87) ruht die Prüfung: Die Faltung ist dann
       Linsen-Sache, der Text unverändert — die Reihum-Position bleibt. */
    if(foldCycleApplied >= 0 && !lens){
      const mode = FOLD_CYCLE[foldCycleApplied];
      const cs = (mode === 'path' && !cheapPathOn) ? computeCheapPlan(roots).set : cheapSet;
      presetSet = presetFoldSet(roots, mode, cs);
    }
    /* Personen-Linse (D87): Ihr Faltzustand ERSETZT den textdefinierten für
       die Darstellung — überlagert nur von Hand-Faltungen während der Linse. */
    const lensSet = lens ? personFoldSet(roots, lens.tag) : null;
    keys.forEach((key, n) => {
      const ov = lensSet ? lensOverrides.get(key) : foldOverrides.get(key);
      const base = lensSet ? lensSet.has(n) : initFold.has(n);
      const collapsed = (ov !== undefined ? ov : base) && n.children.length > 0;
      if(collapsed) collapsedSet.add(n);
      foldByLine.set(n.line, {key, collapsed, canFold: n.children.length > 0});
      if(presetSet && n.children.length > 0 && collapsed !== presetSet.has(n)) presetMatch = false;
    });
    if(presetSet && !presetMatch){ foldCycleApplied = -1; foldCycleNext = 0; }
    /* Aus DENSELBEN Mengen wie das Rendern — die Map muss dieselbe Faltung
       beschreiben, die gleich im DOM steht (dieselbe Regel wie bei freshSet). */
    lineTargetMap = lineTargets(roots, collapsedSet, showDiscarded);
    const r = renderTreeHtml(roots, {t, showDiscarded, cheapPath: cheapPathOn, cheapSet, showIds,
                                     freshSet, collapsedSet,
                                     effStatus: effectiveStatus(roots),
                                     overloadTag: overload ? overload.tag : null,
                                     lensTag: lens ? lens.tag : null});
    out.innerHTML = r.html;
    warnings = warnings.concat(r.warnings);
    /* Personen-Leiste (D87): Belastung je Person aus der offenen Pfad-Arbeit
       (dasselbe Maß wie die D71-Warnung). Bei ausgeschaltetem Pfad-Umschalter
       wird der Pfad eigens gerechnet — die Leiste fragt nach dem Pfad, nicht
       nach seiner Anzeige (die D75-Linie des 'path'-Presets). Die
       Bernstein-Färbung des Engpasses bleibt dagegen am SICHTBAREN Pfad. */
    if(docTags.length){
      const loadSet = cheapPathOn ? cheapSet : computeCheapPlan(roots).set;
      renderPeopleBar(roots, docTags, loadSet, overload);
    } else {
      peopleBar.hidden = true;
    }
  }

  warnings = warnings.slice().sort((a, b) => (a.line || 0) - (b.line || 0));
  warnBox.innerHTML = warnings.map(w => `<div>⚠ ${formatWarning(w, t)}</div>`).join('');
  /* Der Zeilennummern-Streifen zeigt genau die Zeilen an, die hier genannt
     werden — deshalb hängt er an derselben Warnungsliste (D33). Der Text
     wandert gleich mit in den `title` der Zahl (D33-Nachtrag); mehrere
     Warnungen einer Zeile stehen dort untereinander. */
  lineNoWarn = new Map();
  for(const w of warnings){
    if(!w.line) continue;
    const vorher = lineNoWarn.get(w.line);
    const text = warningText(w, t);
    lineNoWarn.set(w.line, vorher ? vorher + '\n' + text : text);
  }
  renderLineNos();
  applyOptStairs();   /* muss vor dem Messen laufen — es verschiebt Knoten */
  alignStems();
  alignVRails();
  drawCheapPath();
  /* Querverbindungen (D41) zeichnet highlightCurrentNode() unten mit —
     es kennt die zweite Hälfte der Auswahl (Cursor-Zeile). */
  /* Der Baum ist neu gebaut — die Markierung der Cursor-Zeile neu setzen (D25).
     Ohne Scrollen: beim Tippen soll das Diagramm stehen bleiben. */
  highlightCurrentNode(false);
  revealFocusMark();  /* `!!!` ins Bild holen, wenn die Marke neu ist (SPEC §1) */
  updateFreshBtn();   /* Zähler folgt der gerade gerenderten Menge (D28) */
  updateLeanBtn();    /* Stationen des Pfads haben sich geändert (D47) */
  updateFoldBtn();    /* Icon + Tooltip = nächster Schritt des Durchschalters (D75) */
}

/* ---------- Personen-Leiste (SPEC §9, D87) ----------
   Je Person eine Pille mit Belastungs-Balken; ein Tipp schaltet die Linse
   (nur ihre Knoten, alles andere gefaltet), der zweite hebt sie auf, ein
   Tipp auf eine andere wechselt. Angezeigt werden ANTEILE, keine absoluten
   Zahlen — die Größen sind ordinal, jede Summe ist eine Näherung (D46).
   Der Rest ohne Zuständigen bekommt einen eigenen Eintrag, damit die Balken
   ehrlich auf 100 % summieren; sein Klick zeigt, wofür noch niemand
   eingeteilt ist. Sortiert nach Last, bei Gleichstand Dokumentreihenfolge. */
function renderPeopleBar(roots, docTags, loadSet, overload){
  const {loads, total} = assigneeLoads(roots, loadSet);
  const share = l => total > 0 ? Math.round(l / total * 100) : 0;
  const entries = docTags.map(tg => ({tag: tg, pct: share(loads.get(tg) || 0)}))
    .sort((a, b) => b.pct - a.pct || docTags.indexOf(a.tag) - docTags.indexOf(b.tag));
  let assigned = 0;
  loads.forEach(l => { assigned += l; });
  const rest = total - assigned;
  if(rest > 0) entries.push({tag: null, pct: share(rest)});
  peopleBar.innerHTML = entries.map(e => {
    const active = !!lens && lens.tag === e.tag;
    const label = e.tag === null ? t('peopleUnassigned') : e.tag;
    const tip = t('peopleShare', {share: e.pct}) + ' · ' +
                t(active ? 'peopleLensOff' : 'peopleLensOn');
    const warm = overload && e.tag !== null && overload.tag === e.tag;
    return `<button type="button" class="pbperson" aria-pressed="${active}"` +
      (e.tag === null ? ' data-nobody' : ` data-tag="${esc(e.tag)}"`) +
      ` title="${esc(label)}: ${esc(tip)}" aria-label="${esc(label)}: ${esc(tip)}">` +
      `<span class="tag${warm ? ' overload' : ''}${e.tag === null ? ' nobody' : ''}" aria-hidden="true">${esc(label)}</span>` +
      `<span class="pbbar" aria-hidden="true"><span class="pbfill" style="width:${e.pct}%"></span></span>` +
      `<span class="pbpct" aria-hidden="true">${e.pct}%</span></button>`;
  }).join('');
  peopleBar.hidden = false;
}

peopleBar.addEventListener('click', e => {
  const b = e.target && e.target.closest ? e.target.closest('.pbperson') : null;
  if(!b) return;
  const tag = ('nobody' in b.dataset) ? null : b.dataset.tag;
  const same = !!lens && lens.tag === tag;
  clearLens();
  if(!same) lens = {tag};
  render();
});

/* Fokusmarke `!!!` (SPEC §1): Der erste markierte Knoten wird ins Bild geholt —
   aber nur, wenn sich die Marke **geändert** hat. Sonst zöge jeder Neubau des
   Baums den Blick zurück und man käme nicht weg. Verglichen wird das Label des
   Knotens, nicht die Zeilennummer: Umsortieren soll nicht als neue Marke
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

/* Sammelleisten-Verlängerung im vertikalen Modus (D65). Der Eltern-Stub dockt
   bei 50 % der Gruppenhöhe an, die Leiste endet aber am 23-px-Abzweig des
   letzten Kindes — trägt das einen großen Teilbaum, liegt die Gruppenmitte
   TIEFER und der Stub hinge in der Luft (gemessen: 4,5 bis 98 px Lücke). CSS
   kann die Gruppenmitte relativ zum letzten <li> nicht ausdrücken; wie bei
   `alignStems()` misst deshalb JS und setzt `--vrail-ext` (unskalierte px,
   durch effZoom() zurückgerechnet). Nur nicht-has-and-Letztkinder: Bei
   has-and liegt der Abzweig bei 50 % der Zelle, und die Gruppenmitte liegt
   beweisbar nie darunter. Nach oben kann die Mitte nie aus der Leiste fallen
   (der erste Abzweig liegt höchstens 23 px unter dem Gruppenanfang). */
function alignVRails(){
  out.querySelectorAll('ul.and>li').forEach(li => li.style.removeProperty('--vrail-ext'));
  if(!out.classList.contains('vertical')) return;
  const z = effZoom() || 1;
  out.querySelectorAll('li.has-and>ul.and').forEach(ul => {
    const kids = [...ul.children].filter(e => e.tagName === 'LI');
    if(kids.length < 2) return;                      /* :only-child löst CSS allein (50 %) */
    const last = kids[kids.length - 1];
    if(last.classList.contains('has-and')) return;
    const ur = ul.getBoundingClientRect(), lr = last.getBoundingClientRect();
    if(!ur.height) return;                           /* Panel eingeklappt */
    const ext = (ur.top + ur.height/2 - lr.top)/z;
    if(ext > 23.5) last.style.setProperty('--vrail-ext', ext.toFixed(1) + 'px');
  });
}

function drawCheapPath(){
  out.querySelectorAll('svg.cheap-overlay').forEach(e => e.remove());
  if(!cheapPathOn) return;
  const leaves = [...out.querySelectorAll('.node.cheap-leaf')];   /* Dokument-Reihenfolge = Lese-Reihenfolge */
  /* EINE Station ist ein gültiger Pfad: Ein eingeklappter Knoten vertritt
     seinen ganzen Teilbaum (D38-Nachtrag), oben im Baum bleibt davon leicht
     nur eine einzige sichtbare Station übrig. Die Linie entfällt dann (durch
     einen Punkt führt keine), der Stationspunkt darf es nicht — sonst
     verschwände der Pfad genau dort ganz, wo er am dichtesten gefaltet ist. */
  if(!leaves.length) return;
  const outRect = out.getBoundingClientRect();
  const z = effZoom() || 1;
  if(!outRect.width || !outRect.height) return;                   /* Panel eingeklappt */
  const pts = leaves.map(el => {
    const r = el.getBoundingClientRect();
    return {x:(r.left + r.width/2 - outRect.left)/z, y:(r.top + r.height/2 - outRect.top)/z};
  });
  const w = outRect.width/z, h = outRect.height/z;
  const d = pts.length > 1 ? catmullRom(pts) : null;

  /* kräftige Linie HINTER die Knoten (als erstes Kind → hinterste Paint-Ebene) */
  if(d){
    const back = overlaySvg('cheap-back', w, h);
    back.appendChild(svgEl('path', {class:'cheap-path', d}));
    out.insertBefore(back, out.firstChild);
  }

  /* davor: abgetönte Kopie (deutet den Verlauf über Knoten an) + Stationspunkte */
  const front = overlaySvg('cheap-front', w, h);
  if(d) front.appendChild(svgEl('path', {class:'cheap-path faint', d}));
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
  /* Eingeklappte Knoten vertreten ihre Teilbäume (SPEC §9/D75): Der Renderer
     hängt IDs und Abhängigkeiten der verborgenen Knoten als `data-sub-ids`/
     `data-sub-deps` an den eingeklappten Vertreter — Quelle wie Ziel enden
     damit am nächsten sichtbaren Vorfahren. querySelectorAll liefert
     Dokumentreihenfolge, und die Sub-IDs stehen (DFS) ebenso darin: „erste
     Vergabe gewinnt" (D36) gilt so auch über die Faltgrenze hinweg. */
  const byId = new Map();
  out.querySelectorAll('.node[data-id], .node[data-sub-ids]').forEach(el => {
    if(el.dataset.id && !byId.has(el.dataset.id)) byId.set(el.dataset.id, el);
    if(el.dataset.subIds) for(const id of el.dataset.subIds.split(' '))
      if(!byId.has(id)) byId.set(id, el);
  });
  const edges = [], seen = new Set();
  out.querySelectorAll('.node[data-deps], .node[data-sub-deps]').forEach(el => {
    const deps = ((el.dataset.deps || '') + ' ' + (el.dataset.subDeps || ''))
      .split(' ').filter(Boolean);
    for(const d of deps){
      const target = byId.get(d);
      /* ausgeblendete (verworfene) oder unbekannte Ziele: keine Kante; beide
         Endpunkte im selben sichtbaren Knoten zusammengefallen: ebenso —
         und mehrere zusammengefallene Kanten desselben Paars werden EINE. */
      if(!target || target === el) continue;
      const key = el.dataset.line + '>' + target.dataset.line;
      if(seen.has(key)) continue;
      seen.add(key);
      edges.push([el, target]);
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
  if(!depLinksOn) return;      /* Umschalter (SPEC §9/D75), Voreinstellung an */
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
  /* EINE Ebene, und die liegt hinter den Knoten (D41-Nachtrag 2): Die Kanten
     laufen durch fremde Knoten hindurch, statt über sie hinweg. Die
     hervorgehobenen werden zuletzt eingehängt — damit liegen sie über den
     übrigen Kanten, aber weiterhin unter jedem Knoten. */
  const back = overlaySvg('dep-overlay dep-back', w, h);
  const hi = activeDepNode();
  const hoch = [];
  for(const [from, to] of edges){
    const hl = hi && (from === hi || to === hi);
    const c = depCurve(rect(from), rect(to));
    const kante = svgEl('path', {class:'dep-edge' + (hl ? ' hl' : ''), d:c.d});
    const spitze = svgEl('path', {class:'dep-arrow' + (hl ? ' hl' : ''), d:depArrow(c.end, c.ctrl)});
    if(hl) hoch.push(kante, spitze);
    else { back.appendChild(kante); back.appendChild(spitze); }
  }
  for(const p of hoch) back.appendChild(p);
  out.insertBefore(back, out.firstChild);
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
/* Die gerenderten Textzeilen eines Knotens, gemessen am LIVE-Element: je
   Zeile der (whitespace-normalisierte) Text und die Box in Viewport-Pixeln.
   Zeichenweise per Range — eine neue Zeilen-Oberkante beginnt eine neue Zeile;
   das deckt auch den Umbruch INNERHALB eines langen Worts (overflow-wrap) ab,
   den eine Nachbildung der Wort-Umbruchlogik verfehlte. Kollabierter Leerraum
   (etwa das Leerzeichen, an dem umbrochen wurde) hat eine Null-Box und fällt
   heraus. `excludeSel` sind die Elemente, die der Export nicht ins Label
   nimmt (Badges, ↗, ”-Marke, je nach Faltzustand das Falt-Zeichen). */
function labelLines(node, excludeSel){
  const range = document.createRange();
  const lines = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
    acceptNode: tn => tn.parentElement.closest(excludeSel)
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  for(let tn = walker.nextNode(); tn; tn = walker.nextNode()){
    const s = tn.nodeValue;
    for(let i = 0; i < s.length; i++){
      range.setStart(tn, i); range.setEnd(tn, i + 1);
      const r = range.getBoundingClientRect();
      if(!r.width && !r.height) continue;
      const last = lines[lines.length - 1];
      if(last && Math.abs(r.top - last.top) < 2){
        last.text += s[i];
        last.left = Math.min(last.left, r.left);
        last.right = Math.max(last.right, r.right);
        last.bottom = Math.max(last.bottom, r.bottom);
      } else {
        lines.push({text: s[i], top: r.top, bottom: r.bottom, left: r.left, right: r.right});
      }
    }
  }
  for(const l of lines) l.text = l.text.replace(/\s+/g, ' ').trim();
  return lines.filter(l => l.text);
}

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
     Knoten; die Fokus-Hervorhebung ist Interaktion und wird nicht exportiert.
     Der Export folgt dem Umschalter (D75) wie den übrigen Ansichts-Filtern. */
  (depLinksOn ? depEdges() : []).forEach(([from, to]) => {
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
    /* Das „▸ n"-Kennzeichen eingeklappter Knoten gehört in den Export (SPEC
       §9/D38 — das Bild darf keine Vollständigkeit behaupten); das ▾ offener
       Knoten ist Bedienelement und fällt weg. */
    const stripFold = node.classList.contains('folded') ? '' : ',.fold';
    const deco = cs.textDecorationLine.includes('line-through') ? ' text-decoration="line-through"' : '';
    /* Seit Knoten umbrechen (D64), belegt ein Label mehrere Zeilenboxen — ein
       SVG-<text> bricht nicht von selbst; je gemessene Zeile ein Element. */
    for(const ln of labelLines(node, '.size,.tags,.ext,.risk,.ownst,.desc-mark' + stripFold)){
      const cx = (ln.left + ln.right) / 2 + ox, cy = (ln.top + ln.bottom) / 2 + oy;
      parts.push(`<text x="${cx.toFixed(1)}" y="${(cy+5).toFixed(1)}" text-anchor="middle" fill="${cs.color}" font-size="14" font-weight="${cs.fontWeight}"${deco}>${esc(ln.text)}</text>`);
    }
    const riskEl = node.querySelector('.risk');
    if(riskEl){
      const rb = R(riskEl);
      parts.push(`<circle cx="${rb.cx.toFixed(1)}" cy="${rb.cy.toFixed(1)}" r="${(Math.min(rb.w,rb.h)/2).toFixed(1)}" fill="#ffffff" stroke="#F97316" stroke-width="1.5"/>`);
      parts.push(`<text x="${rb.cx.toFixed(1)}" y="${(rb.cy+3.5).toFixed(1)}" text-anchor="middle" fill="#F97316" font-size="10">⚠︎</text>`);
    }
    /* Gemessene Farben statt festem Petrol: Das invertierte implizite M (D18)
       und das warnfarbene Konflikt-Badge (SPEC §5/D62) kämen sonst als
       gewöhnliches gefülltes Badge ins Bild — beim impliziten M war genau das
       seit jeher der Fall (Nebenbefund D62). */
    const sizeEl = node.querySelector('.size');
    if(sizeEl){
      const s = getComputedStyle(sizeEl);
      /* Der Rand gehört mit: beim invertierten Badge ist er die einzige Kontur
         (weiße Füllung auf weißer Karte). */
      drawBadge(sizeEl, s.backgroundColor, s.color, s.borderTopColor);
    }
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

  /* 3b) Günstigster-Pfad: abgetönte Kopie über den Knoten + Stationspunkte.
     Die Linie braucht zwei Punkte, die Stationen nicht — bei stark gefaltetem
     Baum bleibt leicht nur eine sichtbare Station übrig (siehe
     `drawCheapPath`). */
  if(cheapPts.length >= 2) parts.push(cheapLine('0.2'));
  cheapPts.forEach(p => parts.push(
    `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="10" fill="#0F766E" fill-opacity="0.2" stroke="#0F766E" stroke-opacity="0.35" stroke-width="1.5"/>`));

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

/* ---------- Tab rückt ein (D53) ----------
   Einrückung IST hier die Hierarchie (SPEC §2), Tab also die häufigste Taste
   nach den Buchstaben. Zwei Regeln:

   - **Ohne Auswahl** zwei Leerzeichen an der Schreibmarke (Tab zählt in dieser
     Notation als zwei, SPEC §2); Shift+Tab nimmt sie der Zeile wieder weg.
   - **Mit Auswahl** wird jede berührte ZEILE ein-/ausgerückt, nie die Auswahl
     ersetzt. In einem Notationstext ist Einrücken praktisch immer gemeint, und
     diese Regel kann nichts löschen. Danach ist der ganze Zeilenblock
     ausgewählt, sodass wiederholtes Tab weiter einrückt.

   Geschrieben wird über `execCommand('insertText')` — die einzige Art, ein
   Textfeld zu ändern, ohne die Rückgängig-Historie zu zerstören (D38-Nachtrag
   2, hier erneut gemessen). Das alte `src.value = …` hat sie bei JEDEM
   Tastendruck gelöscht, also auch das davor Getippte. */
const IND = '  ';
function outdentLine(l){
  if(l.startsWith(IND)) return l.slice(IND.length);
  if(l.startsWith('\t') || l.startsWith(' ')) return l.slice(1);
  return l;
}
function indentSelection(out){
  const v = src.value, s = src.selectionStart, e = src.selectionEnd;
  const von = v.lastIndexOf('\n', s - 1) + 1;
  if(s === e){
    if(!out) return writeAt(s, e, IND, s + IND.length, s + IND.length);
    /* Ausrücken ohne Auswahl: der Zeile den Einzug nehmen, die Schreibmarke um
       dasselbe Stück mitziehen — sie soll am selben Zeichen stehen bleiben. */
    let bisZ = v.indexOf('\n', s);
    if(bisZ === -1) bisZ = v.length;
    const zeile = v.slice(von, bisZ), kurz = outdentLine(zeile);
    if(kurz === zeile) return false;
    const weg = zeile.length - kurz.length;
    const p = Math.max(von, s - weg);
    return writeAt(von, bisZ, kurz, p, p);
  }
  /* Endet die Auswahl genau auf einem Zeilenanfang, gehört diese Zeile nicht
     mehr dazu — sonst rückte ein Zug bis zum nächsten Zeilenbeginn eine Zeile
     zu viel ein. */
  const eAdj = e > s && e > von && v[e-1] === '\n' ? e - 1 : e;
  let bis = v.indexOf('\n', eAdj);
  if(bis === -1) bis = v.length;
  const alt = v.slice(von, bis);
  const neu = alt.split('\n')
    .map(l => out ? outdentLine(l) : (l ? IND + l : l))   /* Leerzeilen bleiben leer */
    .join('\n');
  if(neu === alt) return false;
  return writeAt(von, bis, neu, von, von + neu.length);
}
/* Ersetzt [von,bis) durch `ein` und setzt danach die Auswahl — undo-fähig.
   `input` feuert dabei von selbst, render() und saveSrc() hängen daran. */
function writeAt(von, bis, ein, selA, selB){
  src.setSelectionRange(von, bis);
  let ok = false;
  try{ ok = document.execCommand('insertText', false, ein); }catch(_){}
  if(!ok){
    /* Rückfall: der richtige Text geht vor der Historie (wie D38-Nachtrag 2). */
    src.value = src.value.slice(0, von) + ein + src.value.slice(bis);
    src.dispatchEvent(new Event('input', {bubbles: true}));
  }
  src.setSelectionRange(selA, selB);
  return true;
}

/* Tab im Textfeld ist eine Tastenfalle (WCAG 2.1.2): Wer nur die Tastatur
   benutzt, käme sonst nicht mehr heraus. Esc hebt sie für den NÄCHSTEN
   Tastendruck auf — der übliche Ausweg. */
let tabEscapes = false;
src.addEventListener('keydown', e => {
  if(e.key === 'Escape'){ tabEscapes = true; return; }
  if(e.key !== 'Tab'){ tabEscapes = false; return; }
  if(tabEscapes){ tabEscapes = false; return; }      /* Fokus darf weiterwandern */
  e.preventDefault();
  indentSelection(e.shiftKey);
});

src.addEventListener('input', render);
src.addEventListener('input', saveSrc);
src.addEventListener('input', scheduleLivePush);   /* Server-Dokument: Diff nach 1,5 s Ruhe (D76) */
/* Der Neu-laden-Knopf (D81) hängt bei mitgelieferten Dokumenten an der
   Abweichung vom Auslieferungsstand — und die entsteht beim TIPPEN, nicht
   erst beim Dokumentwechsel. Der Vergleich ist ein String-Vergleich mit
   frühem Ausstieg, je Tastendruck unbedenklich. */
src.addEventListener('input', () => updateDocButtons());

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

/* Vertikale Position eines Zeichenoffsets im Textfeld: ein unsichtbarer Spiegel
   mit gleicher Typografie plus Marker-Span.

   Seit `wrap="off"` (D49) bricht das Textfeld nicht mehr um — der Spiegel
   deshalb ebenfalls `white-space:pre` und **ohne** vorgegebene Breite. Beides
   gehört zusammen: Eine feste Breite bei `pre-wrap` bräche im Spiegel Zeilen um,
   die im Textfeld ungebrochen stehen, und alles darunter läge zu tief.
   Gemessen wird trotzdem weiter, statt `Zeilenhöhe × n` zu rechnen — die
   Schriftgröße unterscheidet sich zwischen Telefon und Schreibtisch (D17), und
   die Messung stimmt in beiden Fällen von selbst. */
let mirrorEl = null;
function syncMirror(){
  if(!mirrorEl){
    mirrorEl = document.createElement('div');
    mirrorEl.setAttribute('aria-hidden', 'true');
    mirrorEl.style.cssText = 'position:absolute;visibility:hidden;top:0;left:-9999px;' +
                             'box-sizing:border-box;white-space:pre;';
    document.body.appendChild(mirrorEl);
  }
  const cs = getComputedStyle(src);
  for(const p of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing',
                  'paddingTop','paddingLeft','paddingRight','borderTopWidth','tabSize']){
    mirrorEl.style[p] = cs[p];
  }
  return mirrorEl;
}
const ZWSP = '​';
/* Position eines Zeichenoffsets im Spiegel — `top` im Koordinatensystem von
   `src.scrollTop`, `left` in dem von `src.scrollLeft` (Innenabstände stecken
   je drin). Das `left` braucht nur die Vorschlagsliste (D63). */
function caretPosInEditor(offset){
  const m = syncMirror();
  m.textContent = src.value.slice(0, offset);
  const marker = document.createElement('span');
  marker.textContent = ZWSP;
  m.appendChild(marker);
  const pos = {top: marker.offsetTop, left: marker.offsetLeft};
  m.textContent = '';
  return pos;
}
function offsetTopInEditor(offset){
  return caretPosInEditor(offset).top;
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
let lineNoWarn = new Map();   /* Zeile -> Warnungstext(e), siehe render() */
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
    /* Die Warnung steht auch im Warnungsbereich unter dem Diagramm — der
       Tooltip erspart nur den Weg dorthin und das Suchen der Zeilennummer.
       Kein Ersatz: Der Streifen ist `aria-hidden`, für Screenreader bleibt die
       Live-Region die Quelle (D33-Nachtrag). */
    const warn = lineNoWarn.get(n);
    s.classList.toggle('warn', !!warn);
    if(warn){ if(s.title !== warn) s.title = warn; }
    else if(s.title) s.removeAttribute('title');
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
/* Seit D49 hängen die Zeilenhöhen nicht mehr an der Breite (es wird nicht mehr
   umbrochen), wohl aber an der Schriftgröße — und die wechselt beim Übergang
   zwischen Telefon und Schreibtisch (D17), den der Beobachter als
   Größenänderung mitbekommt. Beim Ziehen am Splitter kämen sonst je Bild
   mehrere Messungen; einmal je Bild genügt. */
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
  closeNodeTip();          /* der Sprung führt weg vom Knoten (D52) */
  revealEditor();
  keyboardOnJump(true);
  src.focus({preventScroll: true});
  src.setSelectionRange(r.start, r.end);
  scrollEditorToOffset(r.start);
  /* Ohne Umbruch (D49) scrollt der Browser beim Markieren einer langen Zeile
     bis an ihr **Ende** — man landete am rechten Rand und sähe den Anfang der
     Zeile nicht, also gerade Einrückung, Zeichen und Statusbox. Der Sprung
     zeigt auf eine Zeile, nicht auf ihr Ende. */
  src.scrollLeft = 0;
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
   kann. */

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
  /* Nichts zu schreiben heißt: kein `input`-Ereignis, also auch kein render().
     Deshalb false — der Aufrufer zeichnet dann selbst neu. Sonst bliebe das
     Bild stehen, wie es war: Der Fall tritt auf, wenn die Marken den
     gewünschten Zustand schon beschreiben (etwa beim Aufklappen eines Knotens,
     dessen Faltung nur in der Sitzungs-Überlagerung stand). */
  if(alt === neu) return false;
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
  const roots = parse(src.value).roots;
  if(!roots.length) return false;
  const want = desiredFoldKeys(roots);
  const zeilen = src.value.split('\n');

  /* 1) Minimal: nur die umgeklappte Zeile anfassen. So bleiben von Hand
        gesetzte `<` stehen, solange sie den Zustand noch richtig beschreiben. */
  const klein = zeilen.slice();
  klein[line-1] = setFoldMark(klein[line-1], collapsed ? '>' : null);
  let neu = klein.join('\n');

  if(!foldStateMatches(neu, want)) return writeAllFoldMarks(roots, want);
  return withEditorWritable(() => replaceTextUndoable(neu));
}

/* Alle Marken neu setzen — der Weg, wenn ein `<` den Zustand nicht mehr trifft
   (dann wird es hier aufgelöst) und zugleich der einzige sinnvolle für die
   Voreinstellungen, die ohnehin den ganzen Baum anfassen. Liefert false, wenn
   der Zustand in Marken NICHT ausdrückbar ist — etwa weil ein `!!!` im Zweig
   seinen Knoten immer wieder hervorholt (SPEC §9). Dann wird nicht
   geschrieben: ein Text, der etwas anderes sagt als das Bild, wäre schlimmer
   als keine Marke. */
function writeAllFoldMarks(roots, want){
  const keys = nodeKeys(roots);
  const zeilen = src.value.split('\n');
  keys.forEach((key, n) => {
    zeilen[n.line-1] = setFoldMark(zeilen[n.line-1], want.has(key) ? '>' : null);
  });
  const neu = zeilen.join('\n');
  if(!foldStateMatches(neu, want)) return false;
  return withEditorWritable(() => replaceTextUndoable(neu));
}

/* Voreinstellungen aus dem Diagramm-Kopf (SPEC §9, D44/D75): den ganzen Baum
   auf einmal in einen der vier Durchschalter-Zustände stellen. Gesetzt wird
   über dieselben Sitzungs-Überlagerungen wie beim einzelnen Umklappen und
   danach in den Text geschrieben — es ist derselbe Vorgang, nur für viele
   Knoten. Deshalb auch EIN Undo-Schritt: `replaceTextUndoable` schreibt genau
   einmal. Der 'path'-Modus rechnet den günstigsten Pfad selbst — er gilt auch
   bei ausgeschaltetem Pfad-Umschalter (die Voreinstellung fragt nach dem
   Pfad, nicht nach seiner Anzeige). */
function applyFoldPreset(mode){
  /* Der Durchschalter arbeitet auf dem TEXT-Faltzustand — eine aktive
     Personen-Linse (D87) endet damit; sonst schriebe er Marken, die man
     unter der Linse gar nicht sieht. */
  clearLens();
  const roots = parse(src.value).roots;
  if(!roots.length) return;
  const cs = mode === 'path' ? computeCheapPlan(roots).set : null;
  const want = presetFoldSet(roots, mode, cs);
  nodeKeys(roots).forEach((key, n) => {
    if(!n.children.length) return;           /* nur faltbare Knoten */
    foldOverrides.set(key, want.has(n));
  });
  if(writeAllFoldMarks(roots, desiredFoldKeys(roots))) foldOverrides.clear();
  else render();                             /* nicht ausdrückbar: Überlagerung trägt */
}

/* Faltung umklappen (SPEC §9, D38). Gelingt das Zurückschreiben, ist der Text
   der Zustand — die Überlagerungen werden dann geleert, damit sie ihn nicht
   maskieren können. Nach dem Neubau bekommt derselbe Knoten den Fokus zurück,
   sonst risse die Tastaturbedienung ab (das alte Element ist weg). */
function toggleFold(el){
  const line = +el.dataset.line;
  const st = foldByLine.get(line);
  if(!st || !st.canFold) return;
  /* Bei aktiver Personen-Linse (D87) bleibt die Hand-Faltung in deren
     Sitzungs-Überlagerung — in den Text geschrieben würde sonst der
     persönliche Filter, in geteilten Dokumenten für alle. */
  if(lens){
    lensOverrides.set(st.key, !st.collapsed);
    render();
    const again2 = out.querySelector('.node[data-line="' + line + '"]');
    if(again2) again2.focus({preventScroll: true});
    return;
  }
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
let pressTimer = null, armedEl = null, pressNode = null;
function disarmPress(){
  if(pressTimer){ clearTimeout(pressTimer); pressTimer = null; }
  if(armedEl){ armedEl.classList.remove('armed'); armedEl = null; }
  pressNode = null;
}
out.addEventListener('touchstart', e => {
  disarmPress();
  const el = nodeFromEvent(e);
  if(!el) return;
  /* Ein Tipp auf das Falt-Zeichen klappt um (D38) — das darf der kurze Tipp
     nicht abfangen, sonst wäre Falten auf Touch nicht mehr zu bedienen. */
  if(e.target && e.target.closest && e.target.closest('.fold')) return;
  pressNode = el;
  pressTimer = setTimeout(() => {
    pressTimer = null;
    armedEl = el;
    el.classList.add('armed');
  }, 500);
}, {passive: true});
out.addEventListener('touchmove', disarmPress, {passive: true});
out.addEventListener('touchend', e => {
  const el = armedEl;
  /* Kurzer Tipp: der Timer läuft noch (nach 500 ms wäre `armedEl` gesetzt) und
     es wurde nicht gewischt (jedes `touchmove` räumt den Timer weg). Der
     Zustand unterscheidet die drei Gesten also ohne eigenes Merkerfeld. */
  const tap = !el && pressTimer && pressNode;
  const tapped = pressNode;
  disarmPress();
  if(el){
    e.preventDefault();             /* unterdrückt den nachfolgenden Klick/Link */
    jumpToLine(+el.dataset.line);   /* echte Nutzergeste -> der Fokus bleibt */
    return;
  }
  if(!tap) return;
  /* Der einfache Tipp zeigt den Tooltip als Fenster (SPEC §6/§9, D52). Ohne
     `preventDefault()` öffnete ein Link-Knoten zusätzlich seine URL — auf Touch
     ist der Link stattdessen ein Knopf IM Fenster. */
  e.preventDefault();
  toggleNodeTip(tapped);
}, {passive: false});
out.addEventListener('touchcancel', disarmPress);
out.addEventListener('contextmenu', e => { if(pressTimer || armedEl) e.preventDefault(); });

/* ---------- Knoten-Fenster auf Touch (SPEC §6/§9, D52) ----------
   Ein `title` braucht einen Zeiger; ohne Zeiger wäre die Beschreibung (D40) gar
   nicht zu sehen. Das Fenster zeigt denselben Inhalt, zerlegt am Trennstrich
   des Tooltips (TIP_RULE) in Beschreibung und Kurz-Fakten — dort, wo der
   Tooltip 24 `─` malen musste, steht hier eine echte Linie. Kein zweites
   data-Attribut mit derselben Beschreibung: Das verdoppelte im Werkbaum-Plan
   rund 20 kB DOM-Text für nichts. */
const nodeTip = document.getElementById('nodeTip');
const nodeTipBody = document.getElementById('nodeTipBody');
let tipNode = null;

function closeNodeTip(){
  if(!tipNode) return;
  tipNode.classList.remove('tipped');
  tipNode = null;
  nodeTip.hidden = true;
}

function toggleNodeTip(el){
  if(tipNode === el){ closeNodeTip(); return; }   /* zweiter Tipp schließt */
  showNodeTip(el, true);
}

/* `touch` unterscheidet die beiden Anlässe: Am Zeiger ist der ganze Knoten der
   Link (§6), ein ↗-Knopf wäre dort ein zweiter Weg zum selben Ziel; und der
   Sprung-Hinweis nennt Alt+Klick, den es auf dem Telefon nicht gibt. */
function showNodeTip(el, touch){
  closeNodeTip();
  const title = el.getAttribute('data-tip') || '';
  const sep = '\n\n' + TIP_RULE + '\n';
  const i = title.indexOf(sep);
  const desc = i >= 0 ? title.slice(0, i) : '';
  const roh = i >= 0 ? title.slice(i + sep.length) : title;
  const facts = touch ? roh.replace(t('jumpHint'), t('jumpHintTouch')) : roh;
  const href = touch && el.tagName === 'A' ? el.getAttribute('href') : null;
  /* Absätze: Leerzeilen trennen (SPEC §1), einzelne Zeilenumbrüche sind bloß
     der Umbruch der Quelldatei und werden zu Leerzeichen. Der `title` kann das
     nicht — er zeigt die harten Umbrüche und sah im schmalen Fenster
     ausgefranst aus (im Werkbaum-Plan bricht jede Beschreibung bei ~76
     Zeichen). Hier wird umgebrochen, wie es das Fenster braucht. */
  const paras = desc.split(/\n{2,}/)
    .map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  nodeTipBody.innerHTML =
    (paras.length ? `<div class="nodetip-desc">${paras.map(p => `<p>${esc(p)}</p>`).join('')}</div>` : '') +
    (facts ? `<div class="nodetip-facts">${esc(facts)}</div>` : '') +
    (href ? `<a class="nodetip-link" tabindex="-1" href="${esc(href)}" target="_blank" rel="noopener">↗ ${esc(t('tipOpenLink'))}</a>` : '');
  tipNode = el;
  el.classList.add('tipped');
  nodeTip.hidden = false;
  placeNodeTip(el);
}

/* Setzt das Fenster unter den Knoten, bei Platzmangel darüber; waagerecht auf
   die Knotenmitte, geklemmt an den Fensterrand. Die Spitze bleibt über
   `--tipx` am Knoten, auch wenn das Fenster geklemmt wurde. */
function placeNodeTip(el){
  const b = el.getBoundingClientRect();
  const gap = 10, pad = 8;
  nodeTip.classList.remove('above');
  nodeTip.style.left = '0px';                  /* erst messen, dann setzen */
  nodeTip.style.top = '0px';
  const w = nodeTip.offsetWidth, h = nodeTip.offsetHeight;
  const above = b.bottom + gap + h > window.innerHeight && b.top - gap - h > 0;
  if(above) nodeTip.classList.add('above');
  const anchorX = b.left + b.width / 2;
  const left = Math.max(pad, Math.min(anchorX - w / 2, window.innerWidth - w - pad));
  nodeTip.style.left = left + 'px';
  nodeTip.style.top = (above ? b.top - gap - h : b.bottom + gap) + 'px';
  /* Spitze relativ zum Fenster, aber innerhalb seiner Rundungen gehalten. */
  nodeTip.style.setProperty('--tipx',
    Math.max(12, Math.min(anchorX - left, w - 12)).toFixed(1) + 'px');
}

/* ---------- Dasselbe Fenster am Zeiger und an der Tastatur (D57) ----------
   Es löst den nativen `title` ab: Der konnte weder Absätze noch eine Linie
   (der Trennstrich war aus 24 `─` gemalt, D40-Nachtrag) und erschien nie beim
   Tastaturfokus. Beides kann das Fenster ohnehin schon — es wurde nur für
   Touch gebaut (D52).

   Die Verzögerung ist Absicht-Erkennung: Über einen dichten Baum fährt man
   hinweg, ohne etwas wissen zu wollen. Beim Wechsel von Knoten zu Knoten
   zeigt es sofort weiter — wer schon liest, wartet nicht noch einmal. */
const TIP_DELAY = 350;
let tipTimer = null, tipLeave = null;
const finePointer = () => window.matchMedia('(hover:hover) and (pointer:fine)').matches;
function cancelTipTimers(){
  clearTimeout(tipTimer); clearTimeout(tipLeave);
  tipTimer = tipLeave = null;
}
out.addEventListener('pointerover', e => {
  if(e.pointerType === 'touch' || !finePointer()) return;
  const el = e.target.closest && e.target.closest('.node');
  if(!el || el === tipNode) return;
  cancelTipTimers();
  /* Steht schon eines offen, ist die Absicht erwiesen — dann ohne Warten. */
  tipTimer = setTimeout(() => showNodeTip(el, false), tipNode ? 0 : TIP_DELAY);
});
out.addEventListener('pointerout', e => {
  if(e.pointerType === 'touch' || !finePointer()) return;
  clearTimeout(tipTimer);
  /* Nicht sofort zumachen: Der Weg ins Fenster führt über den Zwischenraum,
     und dort ist der Zeiger kurz über keinem von beiden. */
  clearTimeout(tipLeave);
  tipLeave = setTimeout(() => {
    if(!nodeTip.matches(':hover')) closeNodeTip();
  }, 120);
});
nodeTip.addEventListener('pointerenter', cancelTipTimers);
nodeTip.addEventListener('pointerleave', () => { closeNodeTip(); });
/* Tastaturfokus: ohne Verzögerung — er ist bereits die ausdrückliche Absicht,
   und ein `title` hat hier noch nie etwas gezeigt. */
out.addEventListener('focusin', e => {
  const el = e.target.closest && e.target.closest('.node');
  if(el && el !== tipNode) showNodeTip(el, false);
});
out.addEventListener('focusout', e => {
  const el = e.target.closest && e.target.closest('.node');
  if(el && el === tipNode) closeNodeTip();
});

document.getElementById('nodeTipClose').addEventListener('click', closeNodeTip);
/* Tipp/Klick daneben schließt — der Link-Knopf im Fenster aber nicht. */
document.addEventListener('pointerdown', e => {
  if(!tipNode || nodeTip.contains(e.target)) return;
  if(e.target && e.target.closest && e.target.closest('.node') === tipNode) return;
  closeNodeTip();
}, true);
document.addEventListener('keydown', e => { if(e.key === 'Escape'){ closeNodeTip(); closeNewsMenu(); } });
/* Beim Scrollen des Diagramms wandert der Knoten, das `position:fixed`-Fenster
   nicht — es zeigte dann auf etwas anderes. Also zumachen. */
document.querySelector('.diagram').addEventListener('scroll', closeNodeTip, {passive: true});

/* Welcher Knoten gehört zu einer Textzeile? Zuerst der Knoten, DER auf dieser
   Zeile steht; sonst der Knoten, dessen **Beschreibung** hier steht (SPEC §9):
   Eine `"`-Zeile und die Zeilen eines `---`-Blocks tragen keinen eigenen
   Knoten, gehören aber zu einem — und wer darin schreibt, arbeitet an genau
   diesem Knoten. `~=` trifft die Zeilennummer als Glied der Liste in
   `data-desc-lines` (vom Renderer, gefüllt aus `node.descLines`). */
function nodeOfLine(line){
  if(line == null) return null;
  const el = out.querySelector('.node[data-line="' + line + '"]')
      || out.querySelector('.node[data-desc-lines~="' + line + '"]');
  if(el) return el;
  /* Kein DOM-Knoten: Die Zeile liegt in einem eingeklappten Teilbaum — dann
     vertritt der nächste sichtbare Vorfahr sie (SPEC §9, D38-Nachtrag 4),
     für die Cursor-Hervorhebung wie für den Alt+Klick. Ausgeblendete
     verworfene Elemente stehen nicht in der Map und heben weiter nichts
     hervor. */
  const target = lineTargetMap.get(line);
  return target != null && target !== line
    ? out.querySelector('.node[data-line="' + target + '"]')
    : null;
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
  if(moved) resolveShortId(caretLine);
  caretLine = caretLineOf();   /* neu lesen: das Auflösen kann den Text ändern */
  highlightCurrentNode(moved);
  updateAc();                  /* ID-Vorschläge folgen der Schreibmarke (D63) */
}
for(const ev of ['click','keyup','input','focus']) src.addEventListener(ev, syncCaret);

/* Kurzschreibweise der ID auflösen (D55): `#.kc` wird zu `#prod-stage.kc`.
   Eingabehilfe, keine Notation — in der Datei steht danach die volle ID, sie
   bleibt also durchsuchbar und überlebt das Umsortieren.

   **Wann:** sobald die ID abgeschlossen ist, also sobald ihr ein Doppelpunkt
   folgt (`#.kc:`) — beim Tippen des Doppelpunkts ebenso wie beim nächsten
   Tastendruck in einer Zeile, die ihn schon trägt. Sonst beim **Verlassen der
   Zeile**, spätestens dann ist sie fertig (D55-Nachtrag).

   Angefasst wird nur die **eine** Zeile, in der auch getippt wurde. Beides ist
   nötig: `#.foo` ist schon heute eine gültige ID, und wer ein fremdes Dokument
   bloß durchklickt, darf es nicht umgeschrieben bekommen (und damit aus dem
   Nachziehen mitgelieferter Fassungen fallen, D27). Geschrieben wird
   undo-fähig — ein Griff daneben kostet ein Strg+Z (D53). */
let touchedLine = null;
src.addEventListener('input', () => {
  touchedLine = caretLineOf();
  /* Der Vorfilter fragt nur die Zeile unter der Schreibmarke — ob wirklich
     etwas aufzulösen ist, entscheidet `expandShortIds()`. Scheitert es (noch
     kein Vorfahr mit ID), bleibt `touchedLine` stehen: Der nächste Tastendruck
     versucht es erneut, und das Verlassen der Zeile fängt es ohnehin auf. */
  if(shortIdClosed(caretLineText())) writeShortId(touchedLine);
});
/* Die Zeile unter der Schreibmarke, ohne den ganzen Text zu zerlegen — das
   liefe bei jedem Tastendruck über alle Zeilen. */
function caretLineText(){
  const v = src.value, p = src.selectionStart;
  const s = v.lastIndexOf('\n', p - 1) + 1;
  const e = v.indexOf('\n', p);
  return e === -1 ? v.slice(s) : v.slice(s, e);
}
function resolveShortId(line){
  if(line == null || line !== touchedLine) return;
  touchedLine = null;
  writeShortId(line);
}
function writeShortId(line){
  if(line == null) return;
  /* **Nicht** sofort schreiben: Beide Wege hierher hängen am
     `input`-Ereignis — der Doppelpunkt unmittelbar, der Zeilenwechsel über die
     Enter-Taste —, und `execCommand` verweigert den Dienst, wenn es
     re-entrant darin aufgerufen wird. `replaceTextUndoable` fiele dann
     auf `src.value =` zurück — und das löscht die Undo-Historie (D38-Nachtrag
     2). Gemessen: erstes Rückgängig ohne Wirkung, jedes weitere `false`.
     Deshalb ein Zug später, wenn das Ereignis zugestellt ist.

     Nur mit Fokus im Textfeld: Wer die Zeile per Klick ins Diagramm verlässt,
     soll nicht zurückgerissen werden (`replaceTextUndoable` fokussiert selbst).
     Die Kurzform bleibt dann stehen — sie ist eine gültige ID, es geht nichts
     verloren, und beim nächsten Bearbeiten der Zeile wird sie aufgelöst. */
  setTimeout(() => {
    if(document.activeElement !== src) return;
    const lines = src.value.split('\n');
    const neu = expandShortIds(src.value).split('\n');
    if(line > lines.length || neu[line-1] === lines[line-1]) return;
    lines[line-1] = neu[line-1];
    replaceTextUndoable(lines.join('\n'));
  }, 0);
}

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

/* Strg+Klick (macOS auch Cmd) auf eine Abhängigkeits-ID — `:#ziel`, jede ID
   der Liste, auch die Kopf-Form `#auth:#ziel` — springt zur Zeile, die die ID
   vergibt (D67): derselbe Sprung wie aus dem Diagramm, nur innerhalb des
   Textes. Alt+Klick behält daneben seine Richtung ins Diagramm. Der Klick hat
   die Schreibmarke schon gesetzt, `depIdAt` liest also einfach dort; bei
   doppelter ID gewinnt die erste Vergabe (D36/D39), eine unbekannte tut still
   nichts (`unknownDep` warnt schon). */
function jumpToDepTarget(){
  const id = depIdAt(src.value, src.selectionStart);
  if(!id) return false;
  const line = idLine(parse(src.value).roots, id);
  if(line) jumpToLine(line);
  return true;
}
src.addEventListener('click', e => {
  if(e.altKey || !(e.ctrlKey || e.metaKey)) return;
  jumpToDepTarget();
});
src.addEventListener('keydown', e => {
  if(e.key !== 'Enter' || !(e.ctrlKey || e.metaKey) || e.altKey) return;
  if(jumpToDepTarget()) e.preventDefault();
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

/* ---------- ID-Vorschläge beim Tippen von Abhängigkeiten (D63) ----------
   Wer `:#` tippt, bekommt die vergebenen IDs als Liste an der Schreibmarke.
   Die Regeln (wann ein Kontext vorliegt, welche IDs passen) stehen headless
   in autocomplete.js; hier hängen nur Popup, Tasten und das Einfügen. Eine
   Eingabehilfe wie die ID-Kurzform (D55): Der Parser sieht nie etwas davon,
   und wer die Liste ignoriert, tippt einfach weiter. */
let acEl = null, acLiveEl = null, acItems = [], acIndex = 0, acCtx = null;
/* Nach Übernahme oder Esc bleibt DERSELBE Kontext zu — sonst öffnete ihn das
   nächste keyup sofort wieder. Weitertippen ändert das Fragment und löst ihn. */
let acSuppress = null;
function acBox(){
  if(!acEl){
    acEl = document.createElement('div');
    acEl.className = 'aclist';
    /* aria-hidden wie das Knoten-Fenster (D57): Das saubere Combobox-Muster
       passt nicht auf ein <textarea>; die Live-Region unten sagt, was es gibt,
       und normales Tippen bleibt von der Liste unberührt. */
    acEl.setAttribute('aria-hidden', 'true');
    acEl.hidden = true;
    /* pointerdown statt click: läuft VOR dem Fokuswechsel, und preventDefault
       lässt den Fokus im Textfeld — auch auf Touch. */
    acEl.addEventListener('pointerdown', e => {
      const it = e.target.closest('.acitem');
      if(!it) return;
      e.preventDefault();
      acIndex = Number(it.dataset.i);
      acAccept();
    });
    document.body.appendChild(acEl);
    acLiveEl = document.createElement('div');
    acLiveEl.className = 'vh';
    acLiveEl.setAttribute('role', 'status');
    document.body.appendChild(acLiveEl);
  }
  return acEl;
}
function acIsOpen(){ return !!acEl && !acEl.hidden; }
function closeAc(){
  if(acEl) acEl.hidden = true;
  if(acLiveEl) acLiveEl.textContent = '';
  acCtx = null;
}
function updateAc(){
  if(document.activeElement !== src ||
     src.selectionStart !== src.selectionEnd){ closeAc(); return; }
  const ctx = depFragment(src.value, src.selectionStart);
  if(!ctx){ acSuppress = null; closeAc(); return; }
  if(acSuppress && acSuppress.start === ctx.start && acSuppress.fragment === ctx.fragment){
    closeAc(); return;
  }
  acSuppress = null;
  /* Pfeiltasten ändern nur die Auswahl, nicht den Kontext — Liste und
     gewählter Eintrag bleiben dann stehen. */
  if(acIsOpen() && acCtx && acCtx.start === ctx.start && acCtx.fragment === ctx.fragment) return;
  const cands = matchIds(collectIds(acRoots), ctx.fragment, ctx.exclude);
  /* Nichts zu zeigen — oder der eine exakte Treffer wäre nur ein Echo dessen,
     was schon vollständig dasteht. */
  if(!cands.length ||
     (cands.length === 1 && cands[0].id === ctx.fragment && ctx.end === src.selectionStart)){
    closeAc(); return;
  }
  acCtx = ctx; acItems = cands; acIndex = 0;
  renderAc();
  acLiveEl.textContent = t('acHint', {n: acItems.length});
}
function renderAc(){
  const box = acBox();
  box.innerHTML = acItems.map((c, i) =>
    `<div class="acitem${i === acIndex ? ' sel' : ''}" data-i="${i}">` +
    `<span class="acid">#${esc(c.id)}</span>` +
    (c.label ? `<span class="aclabel">${esc(c.label)}</span>` : '') +
    `</div>`).join('');
  box.hidden = false;
  placeAc();
  const sel = box.children[acIndex];
  if(sel) sel.scrollIntoView({block: 'nearest'});
}
/* Unter dem `#` des Fragments; nach oben ausweichend, wenn unten kein Platz
   ist. Wie das Knoten-Fenster (D52) `position:fixed` auf <body> — in einem
   Vorfahren mit `overflow` würde die Liste geklippt (D50). */
function placeAc(){
  const rect = src.getBoundingClientRect();
  const pos = caretPosInEditor(Math.max(0, acCtx.start - 1));
  const lh = parseFloat(getComputedStyle(src).lineHeight) || 18;
  let x = rect.left + pos.left - src.scrollLeft;
  let y = rect.top + pos.top - src.scrollTop + lh;
  x = Math.max(8, Math.min(x, window.innerWidth - acEl.offsetWidth - 8));
  if(y + acEl.offsetHeight > window.innerHeight - 8){
    y = Math.max(8, rect.top + pos.top - src.scrollTop - acEl.offsetHeight - 4);
  }
  acEl.style.left = x + 'px';
  acEl.style.top = y + 'px';
}
function acMove(d){
  acIndex = (acIndex + d + acItems.length) % acItems.length;
  renderAc();
  acLiveEl.textContent = '#' + acItems[acIndex].id;   /* der gewählte Eintrag */
}
function acAccept(){
  const c = acItems[acIndex], ctx = acCtx;
  closeAc();
  if(!c || !ctx) return;
  acSuppress = {start: ctx.start, fragment: c.id};
  const p = ctx.start + c.id.length;
  /* writeAt (D53) ersetzt undo-fähig — hier läuft es aus keydown/pointerdown,
     nicht re-entrant aus `input`, execCommand greift also (anders als D55). */
  writeAt(ctx.start, ctx.end, c.id, p, p);
}
/* Auf `document` in der Capture-Phase: Die Handler am Textfeld (Tab rückt ein,
   Esc löst die Tab-Falle, D53) sind früher registriert und kämen sonst zuerst.
   stopPropagation hält sie heraus, solange die Liste offen ist. */
document.addEventListener('keydown', e => {
  if(!acIsOpen() || e.target !== src) return;
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    e.preventDefault();
    acMove(e.key === 'ArrowDown' ? 1 : -1);
  } else if(e.key === 'Enter' || e.key === 'Tab'){
    e.preventDefault();
    e.stopPropagation();
    acAccept();
  } else if(e.key === 'Escape'){
    e.stopPropagation();
    acSuppress = {start: acCtx.start, fragment: acCtx.fragment};
    closeAc();
  }
}, true);
/* Zu, wenn die Position nicht mehr stimmt oder niemand mehr tippt. */
src.addEventListener('blur', closeAc);
src.addEventListener('scroll', closeAc);
window.addEventListener('resize', closeAc);

const app = document.getElementById('app');
function applyLayout(mode){
  out.classList.toggle('vertical', mode === 'vertikal');
  out.classList.toggle('kompakt', mode === 'kompakt');
  app.classList.toggle('side', mode !== 'horizontal');
  if(!isMobile()) applySplit();   /* Desktop: Preset neu setzen. Mobil: freie --drow-Aufteilung behalten */
  applyOptStairs();   /* Treppe gilt nur im Fächer — beim Moduswechsel bauen/auflösen */
  alignStems();       /* Stiel gilt nur im Fächer — beim Moduswechsel neu setzen/löschen */
  alignVRails();      /* Leisten-Verlängerung gilt nur vertikal — ebenso (D65) */
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
  /* Das Knoten-Fenster (D52) zeigt auf einen Knoten im Diagramm — wechselt der
     Bereich, ist das Ziel weg (`display:none`). */
  closeNodeTip();
  mobilePane = pane;
  applyMobilePane();
  /* Ein Panel mit `display:none` misst sich zu **null**. Alles, was aus der
     Live-Geometrie zeichnet, muss deshalb nach dem Sichtbarwerden neu laufen —
     im Diagramm dieselben vier Schritte wie beim Moduswechsel (applyLayout),
     im Editor der Zeilennummern-Streifen, der am Spiegel misst (D33). */
  if(pane === 'diagram'){ applyOptStairs(); alignStems(); alignVRails(); drawCheapPath(); drawDepLinks(); }
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

/* Faltung für den ganzen Baum (SPEC §9, D44/D75): ein DURCHSCHALTER — jeder
   Druck stellt die nächste von vier Voreinstellungen her (ab M abwärts zu →
   alles abseits des Pfads zu → alles zu → alles offen → wieder vorn). Icon
   und Tooltip zeigen den NÄCHSTEN Schritt, also was Drücken tun wird — den
   Zustand hat man vor sich (dieselbe Logik wie beim Bereichs-Umschalter,
   D17). Die Position wird nicht persistiert; render() prüft sie gegen den
   Baum und setzt sie zurück, sobald jemand von Hand umklappt (D44-Linie). */
const foldBtn = document.getElementById('foldBtn');
foldBtn.addEventListener('click', () => {
  const mode = FOLD_CYCLE[foldCycleNext];
  foldCycleApplied = foldCycleNext;
  foldCycleNext = (foldCycleNext + 1) % FOLD_CYCLE.length;
  applyFoldPreset(mode);   /* rendert; render() prüft und aktualisiert den Knopf */
});
function updateFoldBtn(){
  const mode = FOLD_CYCLE[foldCycleNext];
  foldBtn.dataset.next = mode;
  const tip = t('foldCycle_' + mode);
  foldBtn.title = tip;
  foldBtn.setAttribute('aria-label', tip);
}

/* Günstigster-Pfad-Hervorhebung an/aus */
const cheapBtn = document.getElementById('cheapBtn');
cheapBtn.addEventListener('click', () => {
  cheapPathOn = !cheapPathOn;
  cheapBtn.setAttribute('aria-pressed', cheapPathOn ? 'true' : 'false');
  render();
  saveUI();
});

/* Querverbindungen der Abhängigkeiten an/aus (SPEC §9/D75): ein Umschalter
   wie der Pfad daneben; Grafikexport und Druck folgen ihm. Nur die Overlays
   werden neu gezeichnet — am Baum ändert sich nichts, ein render() wäre
   umsonst gearbeitet. */
const depBtn = document.getElementById('depBtn');
depBtn.addEventListener('click', () => {
  depLinksOn = !depLinksOn;
  depBtn.setAttribute('aria-pressed', depLinksOn ? 'true' : 'false');
  drawDepLinks();
  saveUI();
});

/* Knoten-IDs im Diagramm an/aus (D56). Wie die Nachbarn ein Umschalter mit
   `aria-pressed`; der Zustand gehört zur Ansicht und wird wie Modus, Zoom und
   Aufteilung global gemerkt (D22). Neu gerendert statt per CSS versteckt —
   dann folgt der Grafikexport von selbst. */
const idsBtn = document.getElementById('idsBtn');
idsBtn.addEventListener('click', () => {
  showIds = !showIds;
  idsBtn.setAttribute('aria-pressed', showIds ? 'true' : 'false');
  render();
  saveUI();
});

/* ---------- Von Station zu Station (SPEC §9, D47) ----------
   Kein Umschalter, sondern eine Bewegung: Jeder Druck holt die nächste noch
   offene Station des günstigsten Pfads in die Mitte — beim ersten Druck die
   erste, danach der Reihe nach weiter, nach der letzten wieder von vorn.
   Gegangen wird die DOM-Reihenfolge, also dieselbe, in der die Pfadlinie durch
   die Stationen fädelt (D18/D46).

   Ohne eigenen Zustand: Fortgesetzt wird an dem Knoten, der GERADE
   hervorgehoben ist (`currentNodeEl`, D25). Steht der auf einer Station, geht
   es bei der nächsten weiter; steht er woanders — etwa weil zwischendurch im
   Text getippt wurde —, beginnt der Gang wieder vorn, also bei dem, was als
   Nächstes dran ist. Ein gemerkter Index wäre schlechter: Beim Tippen wird der
   Baum neu gebaut und die Liste ändert sich unter ihm. */
function jumpToLeanStation(){
  const st = [...out.querySelectorAll('.node.cheap-leaf')];
  if(!st.length) return;
  const el = st[(st.indexOf(currentNodeEl) + 1) % st.length];   /* -1 ⇒ die erste */
  /* Auf Mobil ist das Diagramm womöglich gar nicht vorn — erst holen, sonst
     misst sich der Zielknoten zu null (D17-Nachtrag 1). */
  if(isMobile()) setMobilePane('diagram', true);
  /* Genau die Behandlung des ausdrücklichen Alt+Klicks (D25): Fokus ohne
     eigenes Scrollen, dann hervorheben, pulsen, zentrieren — und die
     Abhängigkeits-Kanten des Knotens nehmen es mit (D41). */
  el.focus({preventScroll: true});
  caretLine = +el.dataset.line || null;
  highlightCurrentNode(true, 'center');
}
const leanNextBtn = document.getElementById('leanNextBtn');
leanNextBtn.addEventListener('click', jumpToLeanStation);
/* Verborgen, solange es nichts anzuspringen gibt — bei ausgeschaltetem Pfad
   ebenso wie bei einem durchweg erledigten Plan (D46). Dieselbe Zurückhaltung
   wie beim „Was ist neu?"-Knopf: ein Knopf, der nichts tut, ist Rauschen. */
function updateLeanBtn(){
  const n = out.querySelectorAll('.node.cheap-leaf').length;
  leanNextBtn.hidden = !n;
  if(!n) return;
  const tip = t('leanNextTooltip', {n});
  leanNextBtn.title = tip;
  leanNextBtn.setAttribute('aria-label', tip);
}

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
    imprint:"Impressum",
    privacy:"Datenschutz",
    legendTooltip:"Legende ein-/ausblenden",
    paneToText:"Zum Text wechseln",
    paneToDiagram:"Zum Diagramm wechseln",
    ghostTooltip:"Ab Größe M sollte ein Element weiter untergliedert werden.",
    jumpHint:"Alt+Klick: zur Zeile im Text",
    /* Auf Touch nennt das Knoten-Fenster (D52) den langen Druck — Alt gibt es dort nicht. */
    jumpHintTouch:"Langer Druck: zur Zeile im Text",
    acHint:"{n} ID-Vorschläge – ↑/↓ wählt, Enter übernimmt",
    tipClose:"Schließen",
    tipOpenLink:"Link öffnen",
    liveLoadWarn:"Server-Dokument nicht geladen: {url} ({error}). Läuft das Backend, und ist die Adresse eine Dokument-Adresse (…/documents/&lt;uuid&gt;)?",
    liveStaleWarn:"Deine Änderung war nicht mehr anwendbar ({error}) — der Stand wurde einmal frisch geholt.",
    liveConflictText:"Jemand hat dieselben Zeilen geändert. Wessen Fassung soll gelten?",
    liveConflictTheirs:"Fremde übernehmen",
    liveConflictMine:"Eigene durchsetzen",
    riskTooltip:"High Risk – Aufwand noch unklar.",
    discardedTooltip:"Verworfene Knoten samt Teilbaum ein-/ausblenden",
    cheapTooltip:"Günstigsten Pfad hervorheben – nicht benötigte Alternativen treten zurück",
    leanNextTooltip:"Zur nächsten Station des günstigsten Pfads springen – was als Nächstes dran ist ({n} offen)",
    depsTooltip:"Querverbindungen der Abhängigkeiten anzeigen",
    foldCycle_small:"Knoten der Größe M und kleiner zuklappen",
    foldCycle_path:"Alles abseits des günstigsten Pfads zuklappen",
    foldCycle_closed:"Alle Knoten zuklappen",
    foldCycle_open:"Alle Knoten aufklappen",
    implicitSizeTooltip:"Keine Größe angegeben – für die Kostenschätzung mindestens {size} angenommen",
    fullscreenTooltip:"Vollbild – Panels nutzen die ganze Fensterbreite",
    brandTooltip:"„Werkbaum“ bedeutet so viel wie ‚Werk-Baum‘ — der Baum des Projektstrukturplans (WBS).",
    editorTitle:"Text-Editor", diagramTitle:"Diagramm",
    docSwitchTooltip:"Dokument wählen oder verwalten", docMenuAria:"Dokumente",
    /* Frühere Stände (D54) — alle 10 Minuten, nur bei Änderung. */
    snapTooltip:"Frühere Stände dieses Dokuments", snapMenuAria:"Frühere Stände",
    snapNone:"Noch keine früheren Stände – gesichert wird auf Knopfdruck und alle 10 Minuten, sobald sich etwas geändert hat.",
    snapAddTooltip:"Aktuellen Stand jetzt sichern",
    liveNameAsk:"Dein Name für die anderen (erscheint in der Historie des geteilten Dokuments; leer = anonym):",
    snapNoneLive:"Noch keine früheren Stände auf dem Server — Meilensteine entstehen nach Schreibpausen und mit dem Kamera-Knopf.",
    snapRollbackConfirm:"Auf den Stand von {when} zurücksetzen? Das gilt für alle, die dieses Dokument bearbeiten — als neue Version, nichts geht verloren.",
    idsTooltip:"Knoten-IDs vor dem Titel einblenden",
    snapLines:"{n} Zeilen",
    docNew:"Neues Dokument", docRename:"Umbenennen", docDelete:"Löschen",
    docNewName:"Unbenannt",
    docDeleteConfirm:"Dokument „{name}“ löschen?",
    docDeleteLastConfirm:"Dokument „{name}“ löschen? Es ist das letzte — danach steht wieder das mitgelieferte Beispiel da.",
    docLeave:"Verlassen – nur aus der eigenen Liste entfernen",
    docLeaveConfirm:"„{name}“ verlassen? Es wird nur aus deiner Liste entfernt — auf dem Server bleibt es bestehen, und sein Link liegt danach in der Zwischenablage.",
    docRestore:"Original wiederherstellen",
    docRestoreConfirm:"„{name}“ auf den mitgelieferten Stand zurücksetzen? Eigene Änderungen gehen verloren.",
    docOpenFile:"Datei öffnen…", docSaveFile:"Als Datei speichern (Strg+S)",
    docToServer:"Teilen – auf einen Werkbaum-Server legen und gemeinsam bearbeiten",
    docReload:"Aus der Quelle neu laden – lokale Änderungen gehen verloren",
    docReloadConfirm:"„{name}“ aus der Quelle neu laden? Lokale Änderungen gehen verloren.",
    docGroupShipped:"Mitgeliefert", docGroupOwn:"Lokal", docGroupSources:"Geteilt",
    docToServerAsk:"Adresse des Werkbaum-Servers (z. B. https://werkbaum.example):",
    docToServerDone:"Auf dem Server — der Link steht in der Adresszeile und in der Zwischenablage.",
    docToServerFailed:"Nicht auf den Server gelegt: {error}",
    fsNotice:"Dieser Browser kann lokale Dateien nicht direkt beschreiben: Eine geöffnete Datei wird als Kopie geladen, und Speichern legt eine neue Datei in den Downloads ab. Browser mit der File-System-Access-Schnittstelle (z. B. Chrome oder Edge) schreiben direkt in die geöffnete Datei zurück.", fsNoticeOk:"Verstanden", fsNoticeBrave:"In Brave lässt sich die Schnittstelle von Hand einschalten:",
    copy:"kopieren", copyDone:"kopiert ✓", copyTooltip:"Text in die Zwischenablage kopieren",
    copyDiagramTooltip:"Diagramm als PNG-Bild in die Zwischenablage kopieren",
    downloadDiagramTooltip:"Diagramm als SVG-Datei herunterladen (z. B. für LibreOffice: Einfügen → Bild)",
    downloadPngTooltip:"Diagramm als PNG-Datei herunterladen (Rasterbild, überall einfügbar)",
    downloadMenu:"Diagramm herunterladen (SVG/PNG)",
    minimize:"minimieren", normal:"normal", maximize:"maximieren",
    agenda:"Agenda", discarded:"verworfene",
    gutterTooltip:"Ziehen zum Verschieben, Doppelklick setzt zurück", gutterAria:"Bereiche größenverändern",
    hintGutterAria:"Editor und Legende größenverändern",
    freshTooltip:"Neu in Produktion seit dem letzten Ansehen: {n}.",
    newsTooltip:"Neuigkeiten",
    newsTitle:"Neuigkeiten",
    newsEnglish:"Diese Übersicht wird leider nur auf Englisch gepflegt.",
    newsEmpty:"Keine Einträge.",
    newsUnseen:"Neuigkeiten aus {n} Tagen, die du noch nicht angesehen hast.",
    newsSince:"Seit deinem letzten Besuch: {n} neu in Produktion.",
    newsSeen:"gesehen",
    newsShow:"{n} Knoten im Diagramm zeigen",
    newsShowOff:"Hervorhebung aufheben",
    newsShowing:"Neuigkeiten vom {d} werden im Diagramm gezeigt.",
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
    sizeConflictWarn:"Zeile {line}: Die Teilpakete übersteigen zusammen die angegebene Größe ({size}) — selbst in der günstigsten Lesart.",
    sizeConflictTooltip:"Die Teilpakete übersteigen zusammen die angegebene Größe",
    cheapApproxWarn:"Zu viele gekoppelte Alternativgruppen für die exakte Suche — der günstigste Pfad ist gierig geschätzt (je Gruppe lokal gewählt).",
    assigneeOverloadWarn:"@{tag} trägt {share} % der offenen Arbeit auf dem günstigsten Pfad ({stations} von {total} Stationen) — mögliche Engstelle.",
    peopleBarLabel:"Zuständige",
    peopleUnassigned:"ohne Zuständigen",
    peopleShare:"{share} % der offenen Arbeit auf dem günstigsten Pfad",
    peopleLensOn:"Klick: nur diese Knoten zeigen, alles andere zuklappen",
    peopleLensOff:"Klick: Filter aufheben",
    st_idee:"Idee", st_geplant:"geplant", st_arbeit:"in Arbeit", st_durchstich:"Durchstich",
    st_fertig:"fertig", st_prod:"in Produktion", st_highrisk:"High Risk", st_verworfen:"verworfen",
    unknownStatusWarn:"Zeile {line}: unbekanntes Statuszeichen „{code}“ — als neutral dargestellt.",
    sourceLoadWarn:"„{url}“ konnte nicht geladen werden ({error}). Die Datei muss per http(s) erreichbar sein und CORS erlauben (Access-Control-Allow-Origin).",
    padGoneWarn:"Dieser Link zeigt auf ein Etherpad-Pad. Die Etherpad-Anbindung gibt es nicht mehr — gemeinsames Arbeiten läuft jetzt über ein Werkbaum-Backend (?live=…). Der Text des Pads lässt sich dort einmal einfügen und dann zu zweit bearbeiten.",
    storeFailedWarn:"Speichern im Browser fehlgeschlagen — vermutlich ist der Speicher voll. Änderungen können beim Neuladen verloren gehen; Platz schaffen: nicht mehr gebrauchte Dokumente oder frühere Stände löschen.",
    tabConflictWarn:"Werkbaum ist in einem weiteren Browser-Tab geöffnet — beide schreiben in dieselbe Dokumentenliste, und der zuletzt speichernde gewinnt. Am besten nur in einem Tab arbeiten.",
    liveUnsentWarn:"Deine Änderungen sind seit {min} Minuten NICHT auf dem Server angekommen — sie existieren nur in diesem Fenster. Vor dem Schließen sichern (Strg+S oder Kamera-Knopf).",
    liveEndedWarn:"Die Live-Verbindung zu diesem Server-Dokument ist beendet — Änderungen werden nicht mehr geteilt. Neu laden stellt die Verbindung wieder her.",
    tabModalTitle:"Werkbaum ist mehrfach geöffnet",
    tabModalText:"Diese App ist gerade in einem weiteren Fenster oder Tab geöffnet. Beide schreiben in dieselbe Dokument-Ablage — der zuletzt speichernde überschreibt den anderen. Bitte das andere Fenster schließen; dieser Hinweis verschwindet dann von selbst.",
    tabModalForce:"Trotzdem fortfahren (nicht empfohlen)",
    snapLocalHead:"Lokale Sicherungen (dieses Fenster)",
    a11yStatus:"Status: {status}", a11ySize:"Aufwand: {size}", a11ySizeImplicit:"Aufwand: mindestens {size} (angenommen)", a11yTags:"Zuständig: {names}", a11yId:"ID: #{id}", a11yDeps:"hängt ab von: {ids}", a11yFolded:"eingeklappt, {n} verborgen", a11yEffective:"effektiv: {status}", heldTooltip:"effektiv {eff} — selbst schon {own}, wartet auf Abhängigkeiten", a11yOptional:"optional", a11yFocusMark:"hierhin schauen", a11yLink:"verlinkt",
    hint_indent:"Einrückung (2 Leerzeichen oder Tab) definiert die Hierarchie.",
    hint_all:"Teilpaket, alle erforderlich", hint_any:"Alternative, eine wählen",
    hint_xor:"Alternative, genau eine",
    hint_opt:"Zugabe, nicht erforderlich",
    hint_focus:"hierhin schauen (gemeinsamer Zeigefinger)",
    hint_root:"Zeile ohne Zeichen = Wurzelknoten. |, = und - / + nicht mischen.",
    hint_status:"Status als Kästchen nach dem Zeichen, z. B.",
    hint_size:"Aufwand als T-Shirt-Größe in Klammern, Link einfach als URL anhängen:",
    hint_break:"Ab (M) gilt: weiter untergliedern — fehlt die Untergliederung, erscheint ein Platzhalter im Diagramm. Übersteigen die Teilpakete die angegebene Größe, warnt das Badge.",
    hint_comment:"Kommentare mit %% — als ganze Zeile oder am Zeilenende.",
    hint_cont:"Leerzeichen und \\ am Zeilenende — die nächste Zeile gehört noch dazu.",
    hint_people:"Personen mit @name — erscheinen unten rechts am Knoten.",
    hint_id:"Knoten-ID mit #name: vor dem Titel — erscheint im Tooltip des Knotens.",
    hint_deps:"Abhängigkeiten mit :#name,#name — erscheinen im Tooltip.",
    hint_eff:"Die Knotenfarbe zeigt den effektiven Status (mit Abhängigkeiten); ist der eigene weiter, steht er als Marke unten links.",
    hint_desc:"Beschreibungen: \" Zeile unter dem Knoten; Langtext hinter --- als eingerückter #id-Block — beides im Tooltip (”).",
    hint_fold:"Falten: - [x] > … startet eingeklappt, < holt hervor; ▾/▸ am Knoten klappt um (Tastatur: ←/→).",
    hint_jump:"Alt+Klick auf einen Knoten (mobil: langer Druck) springt zur zugehörigen Textzeile; Alt+Klick im Text holt den Knoten ins Bild; Strg+Klick auf eine Abhängigkeit :#id springt zur Zeile dieser ID.",
    hint_save:"Strg+S speichert das Dokument als Datei — mit gemerkter Datei (z. B. Chrome/Edge) direkt an Ort und Stelle."
  },
  en: {
    subtitle:"Werkbaum – Work Breakdown Structure / Lean Pathfinding · Project structure editor (also feature-tree & requirements)",
    imprint:"Imprint (Impressum)",
    privacy:"Privacy",
    legendTooltip:"Show/hide legend",
    paneToText:"Switch to the text",
    paneToDiagram:"Switch to the diagram",
    ghostTooltip:"From size M upward, an item should be broken down further.",
    jumpHint:"Alt+click: jump to the line in the text",
    jumpHintTouch:"Long press: jump to the line in the text",
    acHint:"{n} id suggestions – ↑/↓ to choose, Enter to insert",
    tipClose:"Close",
    tipOpenLink:"Open link",
    liveLoadWarn:"Server document not loaded: {url} ({error}). Is the backend running, and is the address a document address (…/documents/&lt;uuid&gt;)?",
    liveStaleWarn:"Your change no longer applied ({error}) — the document was fetched afresh once.",
    liveConflictText:"Someone changed the same lines. Whose version should win?",
    liveConflictTheirs:"Take theirs",
    liveConflictMine:"Keep mine",
    riskTooltip:"High risk – effort still unclear.",
    discardedTooltip:"Show/hide discarded nodes and their subtree",
    cheapTooltip:"Highlight the cheapest path – unneeded alternatives recede",
    leanNextTooltip:"Jump to the next station on the cheapest path – what to tackle next ({n} open)",
    depsTooltip:"Show dependency cross-links",
    foldCycle_small:"Collapse nodes of size M and smaller",
    foldCycle_path:"Collapse everything off the cheapest path",
    foldCycle_closed:"Collapse all nodes",
    foldCycle_open:"Expand all nodes",
    implicitSizeTooltip:"No size given – assumed at least {size} for the cost estimate",
    fullscreenTooltip:"Full screen – panels use the full window width",
    brandTooltip:"“Werkbaum” means roughly ‘work tree’ — the tree of the work breakdown structure (WBS).",
    editorTitle:"Text editor", diagramTitle:"Diagram",
    docSwitchTooltip:"Choose or manage document", docMenuAria:"Documents",
    snapTooltip:"Earlier states of this document", snapMenuAria:"Earlier states",
    snapNone:"No earlier states yet – one is kept on demand and every 10 minutes, once something has changed.",
    snapAddTooltip:"Save the current state now",
    liveNameAsk:"Your name for the others (shown in the shared document's history; empty = anonymous):",
    snapNoneLive:"No earlier states on the server yet — milestones appear after writing pauses and with the camera button.",
    snapRollbackConfirm:"Roll back to the state of {when}? This applies to everyone editing this document — as a new version, nothing is lost.",
    idsTooltip:"Show node ids before the title",
    snapLines:"{n} lines",
    docNew:"New document", docRename:"Rename", docDelete:"Delete",
    docNewName:"Untitled",
    docDeleteConfirm:"Delete document “{name}”?",
    docDeleteLastConfirm:"Delete document “{name}”? It is the last one — the shipped example will take its place.",
    docLeave:"Leave – removes it from your list only",
    docLeaveConfirm:"Leave “{name}”? It is only removed from your list — it stays on the server, and its link is placed on your clipboard.",
    docRestore:"Restore original",
    docRestoreConfirm:"Reset “{name}” to the shipped version? Your changes will be lost.",
    docOpenFile:"Open file…", docSaveFile:"Save as file (Ctrl+S)",
    docToServer:"Share – put on a Werkbaum server and edit together",
    docReload:"Reload from the source – local changes are lost",
    docReloadConfirm:"Reload “{name}” from its source? Local changes are lost.",
    docGroupShipped:"Included", docGroupOwn:"Local", docGroupSources:"Shared",
    docToServerAsk:"Address of the Werkbaum server (e.g. https://werkbaum.example):",
    docToServerDone:"On the server — the link is in the address bar and on the clipboard.",
    docToServerFailed:"Not put on the server: {error}",
    fsNotice:"This browser cannot write to local files directly: an opened file is loaded as a copy, and saving puts a new file into your downloads. Browsers with the File System Access API (such as Chrome or Edge) write straight back into the opened file.", fsNoticeOk:"Got it", fsNoticeBrave:"In Brave you can enable the API yourself:",
    copy:"copy", copyDone:"copied ✓", copyTooltip:"Copy text to clipboard",
    copyDiagramTooltip:"Copy diagram as a PNG image to the clipboard",
    downloadDiagramTooltip:"Download diagram as an SVG file (e.g. for LibreOffice: Insert → Image)",
    downloadPngTooltip:"Download diagram as a PNG file (raster image, insertable anywhere)",
    downloadMenu:"Download diagram (SVG/PNG)",
    minimize:"minimize", normal:"normal", maximize:"maximize",
    agenda:"Legend", discarded:"discarded",
    gutterTooltip:"Drag to resize, double-click resets", gutterAria:"Resize the areas",
    hintGutterAria:"Resize editor and legend",
    freshTooltip:"New in production since you last looked: {n}.",
    newsTooltip:"What's new",
    newsTitle:"What's new",
    newsEnglish:"This overview is only maintained in English.",
    newsEmpty:"Nothing recorded.",
    newsUnseen:"News from {n} days you haven't looked at yet.",
    newsSince:"Since your last visit: {n} new in production.",
    newsSeen:"seen",
    newsShow:"Show {n} nodes in the diagram",
    newsShowOff:"Clear the highlight",
    newsShowing:"Showing the changes of {d} in the diagram.",
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
    sizeConflictWarn:"Line {line}: the sub-packages together exceed the given size ({size}) — even in the most optimistic reading.",
    sizeConflictTooltip:"The sub-packages together exceed the given size",
    cheapApproxWarn:"Too many coupled alternative groups for the exact search — the cheapest path is a greedy estimate (chosen locally per group).",
    assigneeOverloadWarn:"@{tag} carries {share}% of the open work on the cheapest path ({stations} of {total} stations) — a possible bottleneck.",
    peopleBarLabel:"Assignees",
    peopleUnassigned:"unassigned",
    peopleShare:"{share}% of the open work on the cheapest path",
    peopleLensOn:"Click: show only these nodes, fold everything else",
    peopleLensOff:"Click: remove the filter",
    st_idee:"idea", st_geplant:"planned", st_arbeit:"in progress", st_durchstich:"walking skeleton",
    st_fertig:"done", st_prod:"in production", st_highrisk:"high risk", st_verworfen:"discarded",
    unknownStatusWarn:"Line {line}: unknown status code “{code}” — shown as neutral.",
    sourceLoadWarn:"Could not load “{url}” ({error}). The file must be reachable via http(s) and allow CORS (Access-Control-Allow-Origin).",
    padGoneWarn:"This link points at an Etherpad pad. The Etherpad connection is gone — collaboration now runs through a Werkbaum backend (?live=…). Paste the pad’s text there once, then edit it together.",
    storeFailedWarn:"Saving in the browser failed — its storage is probably full. Changes may be lost on reload; free space by deleting unused documents or earlier states.",
    tabConflictWarn:"Werkbaum is open in another browser tab — both write to the same document list, and the last one to save wins. Best work in a single tab.",
    liveUnsentWarn:"Your changes have NOT reached the server for {min} minutes — they exist only in this window. Save before closing (Ctrl+S or the camera button).",
    liveEndedWarn:"The live connection to this server document has ended — changes are no longer shared. Reload to reconnect.",
    tabModalTitle:"Werkbaum is open more than once",
    tabModalText:"This app is currently open in another window or tab. Both write to the same document storage — whichever saves last overwrites the other. Please close the other window; this notice then disappears by itself.",
    tabModalForce:"Continue anyway (not recommended)",
    snapLocalHead:"Local backups (this window)",
    a11yStatus:"Status: {status}", a11ySize:"Effort: {size}", a11ySizeImplicit:"Effort: at least {size} (assumed)", a11yTags:"Assigned: {names}", a11yId:"ID: #{id}", a11yDeps:"depends on: {ids}", a11yFolded:"collapsed, {n} hidden", a11yEffective:"effective: {status}", heldTooltip:"effectively {eff} — itself already {own}, waiting on dependencies", a11yOptional:"optional", a11yFocusMark:"look here", a11yLink:"has link",
    hint_indent:"Indentation (2 spaces or a tab) defines the hierarchy.",
    hint_all:"sub-task, all required", hint_any:"alternative, choose one",
    hint_xor:"alternative, exactly one",
    hint_opt:"extra, not required",
    hint_focus:"look here (a shared pointer)",
    hint_root:"Line without a marker = root node. Do not mix |, = and - / +.",
    hint_status:"Status as a checkbox after the marker, e.g.",
    hint_size:"Effort as a T-shirt size in parentheses; add a link simply as a URL:",
    hint_break:"From (M) on: break it down further — if the breakdown is missing, a placeholder appears in the diagram. If the sub-tasks exceed the given size, the badge warns.",
    hint_comment:"Comments with %% — whole line or at the end of a line.",
    hint_cont:"A space and \\ at the end of a line — the next line still belongs to it.",
    hint_people:"People with @name — shown at the bottom-right of the node.",
    hint_id:"Node ID with #name: before the title — shown in the node's tooltip.",
    hint_deps:"Dependencies with :#name,#name — shown in the tooltip.",
    hint_eff:"Node colour shows the effective status (with dependencies); if its own is further along, it appears as a mark at the bottom left.",
    hint_desc:"Descriptions: a \" line below the node; long text behind --- as an indented #id block — both in the tooltip (”).",
    hint_fold:"Folding: - [x] > … starts collapsed, < brings it back; ▾/▸ on a node toggles (keyboard: ←/→).",
    hint_jump:"Alt+click a node (long press on touch) jumps to its line in the text; Alt+click in the text brings the node into view; Ctrl+click a dependency :#id jumps to that ID's line.",
    hint_save:"Ctrl+S saves the document as a file — with a remembered file (e.g. Chrome/Edge) right back in place."
  },
  es: {
    subtitle:"Werkbaum – EDT / Lean Pathfinding · Editor de estructura de proyectos (también árboles de características y requisitos)",
    imprint:"Aviso legal (Impressum)",
    privacy:"Privacidad",
    legendTooltip:"Mostrar u ocultar la leyenda",
    paneToText:"Cambiar al texto",
    paneToDiagram:"Cambiar al diagrama",
    ghostTooltip:"A partir de la talla M, un elemento debería desglosarse más.",
    jumpHint:"Alt+clic: ir a la línea en el texto",
    jumpHintTouch:"Pulsación larga: ir a la línea en el texto",
    acHint:"{n} sugerencias de ID – ↑/↓ elige, Intro inserta",
    tipClose:"Cerrar",
    tipOpenLink:"Abrir enlace",
    liveLoadWarn:"Documento del servidor no cargado: {url} ({error}). ¿Está el backend en marcha y es la dirección la de un documento (…/documents/&lt;uuid&gt;)?",
    liveStaleWarn:"Tu cambio ya no era aplicable ({error}): se volvió a cargar el estado una vez.",
    liveConflictText:"Alguien cambió las mismas líneas. ¿Qué versión debe prevalecer?",
    liveConflictTheirs:"Tomar la ajena",
    liveConflictMine:"Mantener la mía",
    riskTooltip:"Alto riesgo – esfuerzo aún incierto.",
    discardedTooltip:"Mostrar u ocultar los nodos descartados y su subárbol",
    cheapTooltip:"Resaltar la ruta más económica: las alternativas no necesarias se atenúan",
    leanNextTooltip:"Ir a la siguiente estación de la ruta más económica: lo próximo que toca ({n} pendientes)",
    depsTooltip:"Mostrar los enlaces de dependencias",
    foldCycle_small:"Plegar los nodos de talla M o menor",
    foldCycle_path:"Plegar todo lo que queda fuera de la ruta más económica",
    foldCycle_closed:"Plegar todos los nodos",
    foldCycle_open:"Desplegar todos los nodos",
    implicitSizeTooltip:"Sin tamaño indicado: se asume al menos {size} para el cálculo de costes",
    fullscreenTooltip:"Pantalla completa – los paneles usan todo el ancho de la ventana",
    brandTooltip:"«Werkbaum» significa algo así como ‘árbol de trabajo’ — el árbol de la estructura de desglose del trabajo (EDT).",
    editorTitle:"Editor de texto", diagramTitle:"Diagrama",
    docSwitchTooltip:"Elegir o gestionar documento", docMenuAria:"Documentos",
    snapTooltip:"Estados anteriores de este documento", snapMenuAria:"Estados anteriores",
    snapNone:"Aún no hay estados anteriores: se guarda uno al pulsar el botón y cada 10 minutos, cuando algo ha cambiado.",
    snapAddTooltip:"Guardar ahora el estado actual",
    liveNameAsk:"Tu nombre para los demás (aparece en el historial del documento compartido; vacío = anónimo):",
    snapNoneLive:"Aún no hay estados anteriores en el servidor: los hitos surgen tras pausas de escritura y con el botón de cámara.",
    snapRollbackConfirm:"¿Volver al estado de {when}? Vale para todos los que editan este documento: como versión nueva, nada se pierde.",
    idsTooltip:"Mostrar los id de nodo antes del título",
    snapLines:"{n} líneas",
    docNew:"Nuevo documento", docRename:"Renombrar", docDelete:"Eliminar",
    docNewName:"Sin título",
    docDeleteConfirm:"¿Eliminar el documento «{name}»?",
    docDeleteLastConfirm:"¿Eliminar el documento «{name}»? Es el último: el ejemplo incluido volverá a ocupar su lugar.",
    docLeave:"Salir – solo se quita de tu lista",
    docLeaveConfirm:"¿Salir de «{name}»? Solo se quita de tu lista: sigue en el servidor y su enlace queda en el portapapeles.",
    docRestore:"Restaurar original",
    docRestoreConfirm:"¿Restablecer «{name}» a la versión incluida? Tus cambios se perderán.",
    docOpenFile:"Abrir archivo…", docSaveFile:"Guardar como archivo (Ctrl+S)",
    docToServer:"Compartir – poner en un servidor Werkbaum y editar en conjunto",
    docReload:"Recargar desde la fuente – los cambios locales se pierden",
    docReloadConfirm:"¿Recargar «{name}» desde su fuente? Los cambios locales se pierden.",
    docGroupShipped:"Incluidos", docGroupOwn:"Locales", docGroupSources:"Compartidos",
    docToServerAsk:"Dirección del servidor Werkbaum (p. ej. https://werkbaum.example):",
    docToServerDone:"En el servidor: el enlace está en la barra de direcciones y en el portapapeles.",
    docToServerFailed:"No se pudo poner en el servidor: {error}",
    fsNotice:"Este navegador no puede escribir directamente en archivos locales: un archivo abierto se carga como copia, y al guardar se crea un archivo nuevo en las descargas. Los navegadores con la API File System Access (como Chrome o Edge) escriben directamente en el archivo abierto.", fsNoticeOk:"Entendido", fsNoticeBrave:"En Brave puedes activar la API manualmente:",
    copy:"copiar", copyDone:"copiado ✓", copyTooltip:"Copiar el texto al portapapeles",
    copyDiagramTooltip:"Copiar el diagrama como imagen PNG al portapapeles",
    downloadDiagramTooltip:"Descargar el diagrama como archivo SVG (p. ej. para LibreOffice: Insertar → Imagen)",
    downloadPngTooltip:"Descargar el diagrama como archivo PNG (imagen de trama, insertable en cualquier lugar)",
    downloadMenu:"Descargar el diagrama (SVG/PNG)",
    minimize:"minimizar", normal:"normal", maximize:"maximizar",
    agenda:"Leyenda", discarded:"descartados",
    gutterTooltip:"Arrastra para redimensionar, doble clic restablece", gutterAria:"Redimensionar las áreas",
    hintGutterAria:"Redimensionar editor y leyenda",
    freshTooltip:"Nuevo en producción desde la última vez: {n}.",
    newsTooltip:"Novedades",
    newsTitle:"Novedades",
    newsEnglish:"Lamentablemente, este resumen solo se mantiene en inglés.",
    newsEmpty:"Sin entradas.",
    newsUnseen:"Novedades de {n} días que aún no has visto.",
    newsSince:"Desde tu última visita: {n} nuevo en producción.",
    newsSeen:"visto",
    newsShow:"Mostrar {n} nodos en el diagrama",
    newsShowOff:"Quitar el resaltado",
    newsShowing:"Se muestran en el diagrama los cambios del {d}.",
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
    sizeConflictWarn:"Línea {line}: los subpaquetes juntos superan el tamaño indicado ({size}), incluso en la lectura más optimista.",
    sizeConflictTooltip:"Los subpaquetes juntos superan el tamaño indicado",
    cheapApproxWarn:"Demasiados grupos de alternativas acoplados para la búsqueda exacta — el camino más barato es una estimación voraz (elección local por grupo).",
    assigneeOverloadWarn:"@{tag} lleva el {share} % del trabajo pendiente en el camino más barato ({stations} de {total} estaciones) — posible cuello de botella.",
    peopleBarLabel:"Responsables",
    peopleUnassigned:"sin responsable",
    peopleShare:"{share} % del trabajo pendiente en el camino más barato",
    peopleLensOn:"Clic: mostrar solo estos nodos y plegar el resto",
    peopleLensOff:"Clic: quitar el filtro",
    st_idee:"idea", st_geplant:"planificado", st_arbeit:"en curso", st_durchstich:"prototipo funcional",
    st_fertig:"terminado", st_prod:"en producción", st_highrisk:"alto riesgo", st_verworfen:"descartado",
    unknownStatusWarn:"Línea {line}: código de estado desconocido «{code}» — mostrado como neutral.",
    sourceLoadWarn:"No se pudo cargar «{url}» ({error}). El archivo debe ser accesible por http(s) y permitir CORS (Access-Control-Allow-Origin).",
    padGoneWarn:"Este enlace apunta a un pad de Etherpad. La conexión con Etherpad ya no existe: ahora se colabora a través de un backend de Werkbaum (?live=…). Pega allí el texto del pad una vez y editadlo juntos.",
    storeFailedWarn:"No se pudo guardar en el navegador: su almacenamiento probablemente está lleno. Los cambios pueden perderse al recargar; libera espacio borrando documentos sin uso o estados anteriores.",
    tabConflictWarn:"Werkbaum está abierto en otra pestaña — ambas escriben en la misma lista de documentos y gana la última en guardar. Mejor trabaja en una sola pestaña.",
    liveUnsentWarn:"Tus cambios NO han llegado al servidor desde hace {min} minutos — solo existen en esta ventana. Guarda antes de cerrar (Ctrl+S o el botón de cámara).",
    liveEndedWarn:"La conexión en vivo con este documento del servidor ha terminado — los cambios ya no se comparten. Recarga para reconectar.",
    tabModalTitle:"Werkbaum está abierto más de una vez",
    tabModalText:"Esta aplicación está abierta en otra ventana o pestaña. Ambas escriben en el mismo almacén de documentos — la última en guardar sobrescribe a la otra. Cierra la otra ventana; este aviso desaparecerá solo.",
    tabModalForce:"Continuar de todos modos (no recomendado)",
    snapLocalHead:"Copias locales (esta ventana)",
    a11yStatus:"Estado: {status}", a11ySize:"Esfuerzo: {size}", a11ySizeImplicit:"Esfuerzo: al menos {size} (asumido)", a11yTags:"Responsable: {names}", a11yId:"ID: #{id}", a11yDeps:"depende de: {ids}", a11yFolded:"plegado, {n} ocultos", a11yEffective:"efectivo: {status}", heldTooltip:"efectivamente {eff} — por sí mismo ya {own}, espera dependencias", a11yOptional:"opcional", a11yFocusMark:"mirar aquí", a11yLink:"con enlace",
    hint_indent:"La sangría (2 espacios o un tabulador) define la jerarquía.",
    hint_all:"subtarea, todas obligatorias", hint_any:"alternativa, elige una",
    hint_xor:"alternativa, exactamente una",
    hint_opt:"extra, no obligatorio",
    hint_focus:"mirar aquí (un puntero compartido)",
    hint_root:"Línea sin marcador = nodo raíz. No mezcles |, = y - / +.",
    hint_status:"Estado como casilla tras el marcador, p. ej.",
    hint_size:"Esfuerzo como talla de camiseta entre paréntesis; añade un enlace simplemente como URL:",
    hint_break:"A partir de (M): sigue desglosando — si falta el desglose, aparece un marcador de posición en el diagrama. Si las subtareas exceden el tamaño indicado, la insignia avisa.",
    hint_comment:"Comentarios con %% — línea completa o al final de la línea.",
    hint_cont:"Un espacio y \\ al final de una línea — la línea siguiente sigue perteneciendo a ella.",
    hint_people:"Personas con @nombre — aparecen abajo a la derecha del nodo.",
    hint_id:"ID de nodo con #nombre: delante del título — visible en el tooltip del nodo.",
    hint_deps:"Dependencias con :#nombre,#nombre — visibles en el tooltip.",
    hint_eff:"El color del nodo muestra el estado efectivo (con dependencias); si el propio va más adelante, aparece como marca abajo a la izquierda.",
    hint_desc:"Descripciones: línea \" bajo el nodo; texto largo tras --- como bloque #id sangrado — ambos en el tooltip (”).",
    hint_fold:"Plegado: - [x] > … empieza plegado, < lo recupera; ▾/▸ en el nodo alterna (teclado: ←/→).",
    hint_jump:"Alt+clic en un nodo (pulsación larga en táctil) salta a su línea en el texto; Alt+clic en el texto trae el nodo a la vista; Ctrl+clic en una dependencia :#id salta a la línea de esa ID.",
    hint_save:"Ctrl+S guarda el documento como archivo — con un archivo recordado (p. ej. Chrome/Edge), directamente en el mismo lugar."
  },
  fr: {
    subtitle:"Werkbaum – WBS / Lean Pathfinding · Éditeur de structure de projet (aussi pour arbres de fonctionnalités et d'exigences)",
    imprint:"Mentions légales (Impressum)",
    privacy:"Confidentialité",
    legendTooltip:"Afficher/masquer la légende",
    paneToText:"Passer au texte",
    paneToDiagram:"Passer au diagramme",
    ghostTooltip:"À partir de la taille M, un élément devrait être décomposé davantage.",
    jumpHint:"Alt+clic : aller à la ligne dans le texte",
    jumpHintTouch:"Appui long : aller à la ligne dans le texte",
    acHint:"{n} suggestions d'ID – ↑/↓ pour choisir, Entrée pour insérer",
    tipClose:"Fermer",
    tipOpenLink:"Ouvrir le lien",
    liveLoadWarn:"Document du serveur non chargé : {url} ({error}). Le backend tourne-t-il, et l'adresse est-elle celle d'un document (…/documents/&lt;uuid&gt;) ?",
    liveStaleWarn:"Ta modification n'était plus applicable ({error}) — l'état a été rechargé une fois.",
    liveConflictText:"Quelqu'un a modifié les mêmes lignes. Quelle version doit l'emporter ?",
    liveConflictTheirs:"Prendre la sienne",
    liveConflictMine:"Garder la mienne",
    riskTooltip:"Risque élevé – effort encore incertain.",
    discardedTooltip:"Afficher/masquer les nœuds abandonnés et leur sous-arbre",
    cheapTooltip:"Mettre en évidence le chemin le moins coûteux – les alternatives inutiles s'estompent",
    leanNextTooltip:"Aller à la station suivante du chemin le moins coûteux – la prochaine chose à faire ({n} en attente)",
    depsTooltip:"Afficher les liens de dépendances",
    foldCycle_small:"Replier les nœuds de taille M et moins",
    foldCycle_path:"Replier tout ce qui est hors du chemin le moins coûteux",
    foldCycle_closed:"Replier tous les nœuds",
    foldCycle_open:"Déplier tous les nœuds",
    implicitSizeTooltip:"Aucune taille indiquée – au moins {size} supposé pour l'estimation des coûts",
    fullscreenTooltip:"Plein écran – les panneaux occupent toute la largeur de la fenêtre",
    brandTooltip:"« Werkbaum » signifie à peu près « arbre de travail » — l’arbre de l’organigramme des tâches (WBS).",
    editorTitle:"Éditeur de texte", diagramTitle:"Diagramme",
    docSwitchTooltip:"Choisir ou gérer le document", docMenuAria:"Documents",
    snapTooltip:"États antérieurs de ce document", snapMenuAria:"États antérieurs",
    snapNone:"Pas encore d’état antérieur : un état est conservé sur demande et toutes les 10 minutes, dès que quelque chose a changé.",
    snapAddTooltip:"Enregistrer l’état actuel maintenant",
    liveNameAsk:"Votre nom pour les autres (visible dans l'historique du document partagé ; vide = anonyme) :",
    snapNoneLive:"Pas encore d'états antérieurs sur le serveur — les jalons naissent après une pause d'écriture et avec le bouton appareil photo.",
    snapRollbackConfirm:"Revenir à l'état de {when} ? Cela vaut pour tous ceux qui éditent ce document — en nouvelle version, rien n'est perdu.",
    idsTooltip:"Afficher les identifiants de nœud avant le titre",
    snapLines:"{n} lignes",
    docNew:"Nouveau document", docRename:"Renommer", docDelete:"Supprimer",
    docNewName:"Sans titre",
    docDeleteConfirm:"Supprimer le document « {name} » ?",
    docDeleteLastConfirm:"Supprimer le document « {name} » ? C'est le dernier — l'exemple fourni reprendra sa place.",
    docLeave:"Quitter – ne le retire que de votre liste",
    docLeaveConfirm:"Quitter « {name} » ? Il n'est retiré que de votre liste — il reste sur le serveur et son lien est copié dans le presse-papiers.",
    docRestore:"Restaurer l’original",
    docRestoreConfirm:"Réinitialiser « {name} » à la version livrée ? Vos modifications seront perdues.",
    docOpenFile:"Ouvrir un fichier…", docSaveFile:"Enregistrer comme fichier (Ctrl+S)",
    docToServer:"Partager – déposer sur un serveur Werkbaum et éditer à plusieurs",
    docReload:"Recharger depuis la source – les modifications locales sont perdues",
    docReloadConfirm:"Recharger « {name} » depuis sa source ? Les modifications locales seront perdues.",
    docGroupShipped:"Fournis", docGroupOwn:"Locaux", docGroupSources:"Partagés",
    docToServerAsk:"Adresse du serveur Werkbaum (p. ex. https://werkbaum.example) :",
    docToServerDone:"Sur le serveur — le lien est dans la barre d'adresse et dans le presse-papiers.",
    docToServerFailed:"Non déposé sur le serveur : {error}",
    fsNotice:"Ce navigateur ne peut pas écrire directement dans les fichiers locaux : un fichier ouvert est chargé comme copie, et l’enregistrement dépose un nouveau fichier dans les téléchargements. Les navigateurs dotés de l’API File System Access (comme Chrome ou Edge) réécrivent directement dans le fichier ouvert.", fsNoticeOk:"Compris", fsNoticeBrave:"Dans Brave, l’API peut être activée manuellement :",
    copy:"copier", copyDone:"copié ✓", copyTooltip:"Copier le texte dans le presse-papiers",
    copyDiagramTooltip:"Copier le diagramme comme image PNG dans le presse-papiers",
    downloadDiagramTooltip:"Télécharger le diagramme en fichier SVG (p. ex. pour LibreOffice : Insertion → Image)",
    downloadPngTooltip:"Télécharger le diagramme en fichier PNG (image matricielle, insérable partout)",
    downloadMenu:"Télécharger le diagramme (SVG/PNG)",
    minimize:"réduire", normal:"normal", maximize:"agrandir",
    agenda:"Légende", discarded:"abandonnés",
    gutterTooltip:"Glisser pour redimensionner, double-clic pour réinitialiser", gutterAria:"Redimensionner les zones",
    hintGutterAria:"Redimensionner l'éditeur et la légende",
    freshTooltip:"Nouveau en production depuis votre dernière visite : {n}.",
    newsTooltip:"Nouveautés",
    newsTitle:"Nouveautés",
    newsEnglish:"Cet aperçu n'est malheureusement tenu à jour qu'en anglais.",
    newsEmpty:"Aucune entrée.",
    newsUnseen:"Nouveautés de {n} jours que vous n'avez pas encore consultées.",
    newsSince:"Depuis votre dernière visite : {n} nouveau en production.",
    newsSeen:"vu",
    newsShow:"Afficher {n} nœuds dans le diagramme",
    newsShowOff:"Retirer la mise en évidence",
    newsShowing:"Les changements du {d} sont affichés dans le diagramme.",
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
    sizeConflictWarn:"Ligne {line} : les sous-lots dépassent ensemble la taille indiquée ({size}), même dans la lecture la plus optimiste.",
    sizeConflictTooltip:"Les sous-lots dépassent ensemble la taille indiquée",
    cheapApproxWarn:"Trop de groupes d’alternatives couplés pour la recherche exacte — le chemin le moins cher est une estimation gloutonne (choix local par groupe).",
    assigneeOverloadWarn:"@{tag} porte {share} % du travail restant sur le chemin le moins cher ({stations} stations sur {total}) — goulot d’étranglement possible.",
    peopleBarLabel:"Responsables",
    peopleUnassigned:"sans responsable",
    peopleShare:"{share} % du travail restant sur le chemin le moins cher",
    peopleLensOn:"Clic : n’afficher que ces nœuds, replier le reste",
    peopleLensOff:"Clic : retirer le filtre",
    st_idee:"idée", st_geplant:"planifié", st_arbeit:"en cours", st_durchstich:"squelette fonctionnel",
    st_fertig:"terminé", st_prod:"en production", st_highrisk:"risque élevé", st_verworfen:"abandonné",
    unknownStatusWarn:"Ligne {line} : code de statut inconnu « {code} » — affiché comme neutre.",
    sourceLoadWarn:"Impossible de charger « {url} » ({error}). Le fichier doit être accessible en http(s) et autoriser CORS (Access-Control-Allow-Origin).",
    padGoneWarn:"Ce lien pointe vers un pad Etherpad. La connexion Etherpad n’existe plus — la collaboration passe désormais par un backend Werkbaum (?live=…). Collez-y une fois le texte du pad, puis modifiez-le à plusieurs.",
    storeFailedWarn:"L'enregistrement dans le navigateur a échoué — son stockage est probablement plein. Les modifications peuvent être perdues au rechargement ; libérez de l'espace en supprimant des documents inutilisés ou des états antérieurs.",
    tabConflictWarn:"Werkbaum est ouvert dans un autre onglet — les deux écrivent dans la même liste de documents et le dernier à enregistrer l'emporte. Mieux vaut travailler dans un seul onglet.",
    liveUnsentWarn:"Tes modifications ne sont PAS arrivées au serveur depuis {min} minutes — elles n'existent que dans cette fenêtre. Enregistre avant de fermer (Ctrl+S ou le bouton appareil photo).",
    liveEndedWarn:"La connexion en direct à ce document serveur est terminée — les modifications ne sont plus partagées. Recharge pour te reconnecter.",
    tabModalTitle:"Werkbaum est ouvert plusieurs fois",
    tabModalText:"Cette application est ouverte dans une autre fenêtre ou un autre onglet. Les deux écrivent dans le même stockage de documents — le dernier à enregistrer écrase l'autre. Ferme l'autre fenêtre ; cet avis disparaîtra de lui-même.",
    tabModalForce:"Continuer quand même (déconseillé)",
    snapLocalHead:"Sauvegardes locales (cette fenêtre)",
    a11yStatus:"Statut : {status}", a11ySize:"Effort : {size}", a11ySizeImplicit:"Effort : au moins {size} (supposé)", a11yTags:"Responsable : {names}", a11yId:"ID : #{id}", a11yDeps:"dépend de : {ids}", a11yFolded:"replié, {n} masqués", a11yEffective:"effectif : {status}", heldTooltip:"effectivement {eff} — lui-même déjà {own}, en attente de dépendances", a11yOptional:"facultatif", a11yFocusMark:"regarder ici", a11yLink:"avec lien",
    hint_indent:"L'indentation (2 espaces ou une tabulation) définit la hiérarchie.",
    hint_all:"sous-tâche, toutes requises", hint_any:"alternative, en choisir une",
    hint_xor:"alternative, exactement une",
    hint_opt:"supplément, non requis",
    hint_focus:"regarder ici (un pointeur partagé)",
    hint_root:"Ligne sans marqueur = nœud racine. Ne mélangez pas |, = et - / +.",
    hint_status:"Statut sous forme de case après le marqueur, p. ex.",
    hint_size:"Effort en taille de T-shirt entre parenthèses ; ajoutez un lien simplement comme URL :",
    hint_break:"À partir de (M) : décomposer davantage — si la décomposition manque, un espace réservé apparaît dans le diagramme. Si les sous-tâches dépassent la taille indiquée, le badge avertit.",
    hint_comment:"Commentaires avec %% — ligne entière ou en fin de ligne.",
    hint_cont:"Une espace et \\ en fin de ligne — la ligne suivante en fait encore partie.",
    hint_people:"Personnes avec @nom — affichées en bas à droite du nœud.",
    hint_id:"ID de nœud avec #nom : devant le titre — visible dans l’infobulle du nœud.",
    hint_deps:"Dépendances avec :#nom,#nom — visibles dans l’infobulle.",
    hint_eff:"La couleur du nœud montre le statut effectif (avec dépendances) ; si le sien est plus avancé, il apparaît en marque en bas à gauche.",
    hint_desc:"Descriptions : ligne \" sous le nœud ; texte long après --- en bloc #id indenté — les deux dans l’infobulle (”).",
    hint_fold:"Pliage : - [x] > … démarre replié, < le fait ressortir ; ▾/▸ sur le nœud bascule (clavier : ←/→).",
    hint_jump:"Alt+clic sur un nœud (appui long sur tactile) saute à sa ligne dans le texte ; Alt+clic dans le texte amène le nœud à l’écran ; Ctrl+clic sur une dépendance :#id saute à la ligne de cet ID.",
    hint_save:"Ctrl+S enregistre le document comme fichier — avec un fichier mémorisé (p. ex. Chrome/Edge), directement sur place."
  },
  pl: {
    subtitle:"Werkbaum – WBS / Lean Pathfinding · Edytor struktury projektów (również dla drzew funkcji i wymagań)",
    imprint:"Nota prawna (Impressum)",
    privacy:"Prywatność",
    legendTooltip:"Pokaż/ukryj legendę",
    paneToText:"Przełącz na tekst",
    paneToDiagram:"Przełącz na diagram",
    ghostTooltip:"Od rozmiaru M element powinien być dalej podzielony.",
    jumpHint:"Alt+kliknięcie: przejdź do wiersza w tekście",
    jumpHintTouch:"Długie przytrzymanie: przejdź do wiersza w tekście",
    acHint:"{n} podpowiedzi ID – ↑/↓ wybiera, Enter wstawia",
    tipClose:"Zamknij",
    tipOpenLink:"Otwórz link",
    liveLoadWarn:"Nie wczytano dokumentu z serwera: {url} ({error}). Czy backend działa i czy adres wskazuje dokument (…/documents/&lt;uuid&gt;)?",
    liveStaleWarn:"Twoja zmiana nie dała się już zastosować ({error}) — stan pobrano raz od nowa.",
    liveConflictText:"Ktoś zmienił te same wiersze. Która wersja ma obowiązywać?",
    liveConflictTheirs:"Przyjmij cudzą",
    liveConflictMine:"Zachowaj własną",
    riskTooltip:"Wysokie ryzyko – nakład jeszcze niejasny.",
    discardedTooltip:"Pokaż/ukryj odrzucone węzły wraz z poddrzewem",
    cheapTooltip:"Wyróżnij najtańszą ścieżkę – niepotrzebne alternatywy są przygaszone",
    leanNextTooltip:"Przejdź do następnej stacji najtańszej ścieżki – co dalej ({n} otwartych)",
    depsTooltip:"Pokaż powiązania zależności",
    foldCycle_small:"Zwiń węzły o rozmiarze M i mniejsze",
    foldCycle_path:"Zwiń wszystko poza najtańszą ścieżką",
    foldCycle_closed:"Zwiń wszystkie węzły",
    foldCycle_open:"Rozwiń wszystkie węzły",
    implicitSizeTooltip:"Nie podano rozmiaru – do szacowania kosztów przyjęto co najmniej {size}",
    fullscreenTooltip:"Pełny ekran – panele wykorzystują całą szerokość okna",
    brandTooltip:"„Werkbaum” znaczy mniej więcej ‚drzewo pracy’ — drzewo struktury podziału pracy (WBS).",
    editorTitle:"Edytor tekstu", diagramTitle:"Diagram",
    docSwitchTooltip:"Wybierz lub zarządzaj dokumentem", docMenuAria:"Dokumenty",
    snapTooltip:"Wcześniejsze stany tego dokumentu", snapMenuAria:"Wcześniejsze stany",
    snapNone:"Brak wcześniejszych stanów – zapisywany jest na żądanie i co 10 minut, gdy coś się zmieni.",
    snapAddTooltip:"Zapisz bieżący stan teraz",
    liveNameAsk:"Twoje imię dla innych (widoczne w historii udostępnionego dokumentu; puste = anonimowo):",
    snapNoneLive:"Na serwerze nie ma jeszcze wcześniejszych stanów — kamienie milowe powstają po przerwach w pisaniu i przyciskiem aparatu.",
    snapRollbackConfirm:"Wrócić do stanu z {when}? Dotyczy wszystkich edytujących ten dokument — jako nowa wersja, nic nie przepada.",
    idsTooltip:"Pokaż identyfikatory węzłów przed tytułem",
    snapLines:"wierszy: {n}",
    docNew:"Nowy dokument", docRename:"Zmień nazwę", docDelete:"Usuń",
    docNewName:"Bez nazwy",
    docDeleteConfirm:"Usunąć dokument „{name}”?",
    docDeleteLastConfirm:"Usunąć dokument „{name}”? To ostatni — jego miejsce zajmie dołączony przykład.",
    docLeave:"Opuść – usuwa tylko z twojej listy",
    docLeaveConfirm:"Opuścić „{name}”? Zniknie tylko z twojej listy — na serwerze pozostaje, a jego link trafi do schowka.",
    docRestore:"Przywróć oryginał",
    docRestoreConfirm:"Przywrócić „{name}” do dostarczonej wersji? Twoje zmiany zostaną utracone.",
    docOpenFile:"Otwórz plik…", docSaveFile:"Zapisz jako plik (Ctrl+S)",
    docToServer:"Udostępnij – umieść na serwerze Werkbaum i edytujcie wspólnie",
    docReload:"Wczytaj ponownie ze źródła – lokalne zmiany przepadną",
    docReloadConfirm:"Wczytać „{name}” ponownie ze źródła? Lokalne zmiany przepadną.",
    docGroupShipped:"Dołączone", docGroupOwn:"Lokalne", docGroupSources:"Udostępnione",
    docToServerAsk:"Adres serwera Werkbaum (np. https://werkbaum.example):",
    docToServerDone:"Na serwerze — link jest w pasku adresu i w schowku.",
    docToServerFailed:"Nie umieszczono na serwerze: {error}",
    fsNotice:"Ta przeglądarka nie może bezpośrednio zapisywać plików lokalnych: otwarty plik jest wczytywany jako kopia, a zapis tworzy nowy plik w pobranych. Przeglądarki z interfejsem File System Access (np. Chrome lub Edge) zapisują bezpośrednio do otwartego pliku.", fsNoticeOk:"Rozumiem", fsNoticeBrave:"W Brave interfejs można włączyć ręcznie:",
    copy:"kopiuj", copyDone:"skopiowano ✓", copyTooltip:"Kopiuj tekst do schowka",
    copyDiagramTooltip:"Kopiuj diagram jako obraz PNG do schowka",
    downloadDiagramTooltip:"Pobierz diagram jako plik SVG (np. dla LibreOffice: Wstaw → Obraz)",
    downloadPngTooltip:"Pobierz diagram jako plik PNG (obraz rastrowy, wszędzie do wstawienia)",
    downloadMenu:"Pobierz diagram (SVG/PNG)",
    minimize:"minimalizuj", normal:"normalny", maximize:"maksymalizuj",
    agenda:"Legenda", discarded:"odrzucone",
    gutterTooltip:"Przeciągnij, aby zmienić rozmiar; dwuklik przywraca", gutterAria:"Zmień rozmiar obszarów",
    hintGutterAria:"Zmień rozmiar edytora i legendy",
    freshTooltip:"Nowe na produkcji od ostatniego razu: {n}.",
    newsTooltip:"Nowości",
    newsTitle:"Nowości",
    newsEnglish:"Niestety to zestawienie jest prowadzone tylko po angielsku.",
    newsEmpty:"Brak wpisów.",
    newsUnseen:"Nowości z {n} dni, których jeszcze nie oglądałeś.",
    newsSince:"Od twojej ostatniej wizyty: {n} nowe na produkcji.",
    newsSeen:"zobaczone",
    newsShow:"Pokaż {n} węzłów na diagramie",
    newsShowOff:"Usuń podświetlenie",
    newsShowing:"Na diagramie pokazane są zmiany z {d}.",
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
    sizeConflictWarn:"Wiersz {line}: podzadania razem przekraczają podany rozmiar ({size}) — nawet w najkorzystniejszym odczycie.",
    sizeConflictTooltip:"Podzadania razem przekraczają podany rozmiar",
    cheapApproxWarn:"Zbyt wiele sprzężonych grup alternatyw dla dokładnego wyszukiwania — najtańsza ścieżka jest oszacowana zachłannie (wybór lokalny w każdej grupie).",
    assigneeOverloadWarn:"@{tag} niesie {share} % otwartej pracy na najtańszej ścieżce ({stations} z {total} stacji) — możliwe wąskie gardło.",
    peopleBarLabel:"Odpowiedzialni",
    peopleUnassigned:"bez odpowiedzialnego",
    peopleShare:"{share} % otwartej pracy na najtańszej ścieżce",
    peopleLensOn:"Klik: pokaż tylko te węzły, resztę zwiń",
    peopleLensOff:"Klik: usuń filtr",
    st_idee:"pomysł", st_geplant:"zaplanowane", st_arbeit:"w toku", st_durchstich:"działający szkielet",
    st_fertig:"gotowe", st_prod:"w produkcji", st_highrisk:"wysokie ryzyko", st_verworfen:"odrzucone",
    unknownStatusWarn:"Wiersz {line}: nieznany znak statusu „{code}” — pokazany jako neutralny.",
    sourceLoadWarn:"Nie udało się wczytać „{url}” ({error}). Plik musi być dostępny przez http(s) i zezwalać na CORS (Access-Control-Allow-Origin).",
    padGoneWarn:"Ten link prowadzi do pada Etherpad. Połączenia z Etherpadem już nie ma — wspólna praca odbywa się teraz przez backend Werkbaum (?live=…). Wklej tam raz tekst pada i edytujcie go razem.",
    storeFailedWarn:"Zapis w przeglądarce nie powiódł się — jego pamięć jest zapewne pełna. Zmiany mogą przepaść przy przeładowaniu; zwolnij miejsce, usuwając nieużywane dokumenty lub wcześniejsze stany.",
    tabConflictWarn:"Werkbaum jest otwarty w innej karcie — obie zapisują tę samą listę dokumentów i wygrywa ta, która zapisze ostatnia. Najlepiej pracować w jednej karcie.",
    liveUnsentWarn:"Twoje zmiany NIE dotarły na serwer od {min} minut — istnieją tylko w tym oknie. Zapisz przed zamknięciem (Ctrl+S lub przycisk aparatu).",
    liveEndedWarn:"Połączenie na żywo z tym dokumentem serwera zostało zakończone — zmiany nie są już udostępniane. Przeładuj, aby połączyć się ponownie.",
    tabModalTitle:"Werkbaum jest otwarty więcej niż raz",
    tabModalText:"Ta aplikacja jest otwarta w innym oknie lub karcie. Obie zapisują do tego samego magazynu dokumentów — ostatni zapis nadpisuje drugi. Zamknij drugie okno; ten komunikat zniknie sam.",
    tabModalForce:"Kontynuuj mimo to (niezalecane)",
    snapLocalHead:"Lokalne kopie (to okno)",
    a11yStatus:"Status: {status}", a11ySize:"Nakład: {size}", a11ySizeImplicit:"Nakład: co najmniej {size} (założony)", a11yTags:"Przypisano: {names}", a11yId:"ID: #{id}", a11yDeps:"zależy od: {ids}", a11yFolded:"zwinięte, ukrytych: {n}", a11yEffective:"efektywnie: {status}", heldTooltip:"efektywnie {eff} — sam już {own}, czeka na zależności", a11yOptional:"opcjonalny", a11yFocusMark:"spójrz tutaj", a11yLink:"z linkiem",
    hint_indent:"Wcięcie (2 spacje lub tabulator) definiuje hierarchię.",
    hint_all:"podzadanie, wszystkie wymagane", hint_any:"alternatywa, wybierz jedną",
    hint_xor:"alternatywa, dokładnie jedna",
    hint_opt:"dodatek, niewymagany",
    hint_focus:"spójrz tutaj (wspólny wskaźnik)",
    hint_root:"Wiersz bez znacznika = węzeł główny. Nie mieszaj |, = i - / +.",
    hint_status:"Status jako pole wyboru po znaczniku, np.",
    hint_size:"Nakład jako rozmiar koszulki w nawiasach; link dodaj po prostu jako URL:",
    hint_break:"Od (M): dziel dalej — gdy brakuje podziału, w diagramie pojawia się symbol zastępczy. Gdy podzadania przekraczają podany rozmiar, plakietka ostrzega.",
    hint_comment:"Komentarze z %% — cały wiersz lub na końcu wiersza.",
    hint_cont:"Spacja i \\ na końcu wiersza — następny wiersz nadal do niego należy.",
    hint_people:"Osoby z @nazwa — pokazywane w prawym dolnym rogu węzła.",
    hint_id:"ID węzła przez #nazwa: przed tytułem — widoczne w podpowiedzi węzła.",
    hint_deps:"Zależności przez :#nazwa,#nazwa — widoczne w podpowiedzi.",
    hint_eff:"Kolor węzła pokazuje status efektywny (z zależnościami); jeśli własny jest dalej, widnieje jako znacznik u dołu po lewej.",
    hint_desc:"Opisy: wiersz \" pod węzłem; dłuższy tekst za --- jako wcięty blok #id — oba w podpowiedzi (”).",
    hint_fold:"Zwijanie: - [x] > … zaczyna zwinięte, < przywraca; ▾/▸ na węźle przełącza (klawiatura: ←/→).",
    hint_jump:"Alt+kliknięcie węzła (długie naciśnięcie na dotyku) przechodzi do jego wiersza w tekście; Alt+kliknięcie w tekście pokazuje węzeł na diagramie; Ctrl+kliknięcie zależności :#id przechodzi do wiersza tego ID.",
    hint_save:"Ctrl+S zapisuje dokument jako plik — przy zapamiętanym pliku (np. Chrome/Edge) bezpośrednio w tym samym miejscu."
  },
  ru: {
    subtitle:"Werkbaum – СДР / Lean Pathfinding · Редактор структуры проектов (также для деревьев функций и требований)",
    imprint:"Выходные данные (Impressum)",
    privacy:"Конфиденциальность",
    legendTooltip:"Показать/скрыть легенду",
    paneToText:"Перейти к тексту",
    paneToDiagram:"Перейти к диаграмме",
    ghostTooltip:"Начиная с размера M элемент следует далее декомпозировать.",
    jumpHint:"Alt+клик: перейти к строке в тексте",
    jumpHintTouch:"Долгое нажатие: перейти к строке в тексте",
    acHint:"{n} подсказок ID – ↑/↓ выбирает, Enter вставляет",
    tipClose:"Закрыть",
    tipOpenLink:"Открыть ссылку",
    liveLoadWarn:"Документ с сервера не загружен: {url} ({error}). Запущен ли бэкенд и является ли адрес адресом документа (…/documents/&lt;uuid&gt;)?",
    liveStaleWarn:"Ваше изменение больше не применялось ({error}) — состояние загружено заново.",
    liveConflictText:"Кто-то изменил те же строки. Чья версия должна остаться?",
    liveConflictTheirs:"Принять чужую",
    liveConflictMine:"Оставить свою",
    riskTooltip:"Высокий риск – оценка ещё не ясна.",
    discardedTooltip:"Показать/скрыть отклонённые узлы вместе с поддеревом",
    cheapTooltip:"Выделить самый дешёвый путь — ненужные альтернативы приглушаются",
    leanNextTooltip:"Перейти к следующей станции самого дешёвого пути — что делать дальше ({n} открыто)",
    depsTooltip:"Показать связи зависимостей",
    foldCycle_small:"Свернуть узлы размера M и меньше",
    foldCycle_path:"Свернуть всё вне самого дешёвого пути",
    foldCycle_closed:"Свернуть все узлы",
    foldCycle_open:"Развернуть все узлы",
    implicitSizeTooltip:"Размер не указан — для оценки затрат принят не меньше {size}",
    fullscreenTooltip:"Полный экран – панели занимают всю ширину окна",
    brandTooltip:"«Werkbaum» примерно означает ‚дерево работ’ — дерево структуры декомпозиции работ (СДР).",
    editorTitle:"Текстовый редактор", diagramTitle:"Диаграмма",
    docSwitchTooltip:"Выбрать документ или управлять им", docMenuAria:"Документы",
    snapTooltip:"Прежние состояния этого документа", snapMenuAria:"Прежние состояния",
    snapNone:"Прежних состояний пока нет — они сохраняются по нажатию кнопки и каждые 10 минут, если что-то изменилось.",
    snapAddTooltip:"Сохранить текущее состояние сейчас",
    liveNameAsk:"Ваше имя для остальных (видно в истории общего документа; пусто = анонимно):",
    snapNoneLive:"На сервере пока нет прежних состояний — вехи возникают после пауз в наборе и по кнопке камеры.",
    snapRollbackConfirm:"Вернуться к состоянию от {when}? Это касается всех, кто редактирует документ — новой версией, ничего не теряется.",
    idsTooltip:"Показывать идентификаторы узлов перед заголовком",
    snapLines:"строк: {n}",
    docNew:"Новый документ", docRename:"Переименовать", docDelete:"Удалить",
    docNewName:"Без названия",
    docDeleteConfirm:"Удалить документ «{name}»?",
    docDeleteLastConfirm:"Удалить документ «{name}»? Он последний — его место снова займёт встроенный пример.",
    docLeave:"Покинуть – удаляется только из вашего списка",
    docLeaveConfirm:"Покинуть «{name}»? Он исчезнет только из вашего списка — на сервере он останется, а его ссылка будет в буфере обмена.",
    docRestore:"Восстановить оригинал",
    docRestoreConfirm:"Вернуть «{name}» к поставляемой версии? Ваши изменения будут потеряны.",
    docOpenFile:"Открыть файл…", docSaveFile:"Сохранить как файл (Ctrl+S)",
    docToServer:"Поделиться – положить на сервер Werkbaum и редактировать вместе",
    docReload:"Перезагрузить из источника – локальные изменения будут потеряны",
    docReloadConfirm:"Перезагрузить «{name}» из источника? Локальные изменения будут потеряны.",
    docGroupShipped:"Встроенные", docGroupOwn:"Локальные", docGroupSources:"Общие",
    docToServerAsk:"Адрес сервера Werkbaum (например, https://werkbaum.example):",
    docToServerDone:"На сервере — ссылка в адресной строке и в буфере обмена.",
    docToServerFailed:"Не удалось положить на сервер: {error}",
    fsNotice:"Этот браузер не может напрямую записывать локальные файлы: открытый файл загружается как копия, а сохранение создаёт новый файл в загрузках. Браузеры с API File System Access (например, Chrome или Edge) записывают прямо в открытый файл.", fsNoticeOk:"Понятно", fsNoticeBrave:"В Brave интерфейс можно включить вручную:",
    copy:"копировать", copyDone:"скопировано ✓", copyTooltip:"Скопировать текст в буфер обмена",
    copyDiagramTooltip:"Скопировать диаграмму как изображение PNG в буфер обмена",
    downloadDiagramTooltip:"Скачать диаграмму как файл SVG (напр. для LibreOffice: Вставка → Изображение)",
    downloadPngTooltip:"Скачать диаграмму как файл PNG (растровое изображение, вставляется везде)",
    downloadMenu:"Скачать диаграмму (SVG/PNG)",
    minimize:"свернуть", normal:"обычный", maximize:"развернуть",
    agenda:"Легенда", discarded:"отклонённые",
    gutterTooltip:"Потяните, чтобы изменить размер; двойной щелчок сбрасывает", gutterAria:"Изменить размер областей",
    hintGutterAria:"Изменить размер редактора и легенды",
    freshTooltip:"Новое в продакшене с прошлого раза: {n}.",
    newsTooltip:"Новости",
    newsTitle:"Новости",
    newsEnglish:"К сожалению, этот обзор ведётся только на английском языке.",
    newsEmpty:"Записей нет.",
    newsUnseen:"Новости за {n} дней, которые вы ещё не просматривали.",
    newsSince:"С вашего последнего визита: {n} новых в продакшене.",
    newsSeen:"просмотрено",
    newsShow:"Показать {n} узлов на диаграмме",
    newsShowOff:"Снять выделение",
    newsShowing:"На диаграмме показаны изменения от {d}.",
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
    sizeConflictWarn:"Строка {line}: подзадачи вместе превышают указанный размер ({size}) — даже при самой оптимистичной оценке.",
    sizeConflictTooltip:"Подзадачи вместе превышают указанный размер",
    cheapApproxWarn:"Слишком много связанных групп альтернатив для точного поиска — самый дешёвый путь оценён жадно (локальный выбор в каждой группе).",
    assigneeOverloadWarn:"@{tag} несёт {share} % открытой работы на самом дешёвом пути ({stations} из {total} станций) — возможное узкое место.",
    peopleBarLabel:"Ответственные",
    peopleUnassigned:"без ответственного",
    peopleShare:"{share} % открытой работы на самом дешёвом пути",
    peopleLensOn:"Клик: показать только эти узлы, остальное свернуть",
    peopleLensOff:"Клик: снять фильтр",
    st_idee:"идея", st_geplant:"запланировано", st_arbeit:"в работе", st_durchstich:"сквозной прототип",
    st_fertig:"готово", st_prod:"в эксплуатации", st_highrisk:"высокий риск", st_verworfen:"отклонено",
    unknownStatusWarn:"Строка {line}: неизвестный код статуса «{code}» — показан как нейтральный.",
    sourceLoadWarn:"Не удалось загрузить «{url}» ({error}). Файл должен быть доступен по http(s) и разрешать CORS (Access-Control-Allow-Origin).",
    padGoneWarn:"Эта ссылка ведёт на пад Etherpad. Подключения к Etherpad больше нет — совместная работа теперь идёт через бэкенд Werkbaum (?live=…). Вставьте туда текст пада один раз и редактируйте вместе.",
    storeFailedWarn:"Не удалось сохранить в браузере — его хранилище, вероятно, заполнено. Изменения могут потеряться при перезагрузке; освободите место, удалив ненужные документы или прежние состояния.",
    tabConflictWarn:"Werkbaum открыт в другой вкладке — обе пишут в один список документов, и побеждает та, что сохранит последней. Лучше работать в одной вкладке.",
    liveUnsentWarn:"Ваши изменения НЕ доходят до сервера уже {min} мин — они существуют только в этом окне. Сохраните перед закрытием (Ctrl+S или кнопка камеры).",
    liveEndedWarn:"Живое соединение с этим серверным документом завершено — изменения больше не передаются. Перезагрузите, чтобы переподключиться.",
    tabModalTitle:"Werkbaum открыт несколько раз",
    tabModalText:"Приложение открыто в другом окне или вкладке. Оба пишут в одно хранилище документов — последний сохранивший перезаписывает другого. Закройте другое окно; это сообщение исчезнет само.",
    tabModalForce:"Продолжить всё равно (не рекомендуется)",
    snapLocalHead:"Локальные копии (это окно)",
    a11yStatus:"Статус: {status}", a11ySize:"Оценка: {size}", a11ySizeImplicit:"Оценка: не меньше {size} (предполагается)", a11yTags:"Ответственные: {names}", a11yId:"ID: #{id}", a11yDeps:"зависит от: {ids}", a11yFolded:"свёрнуто, скрыто: {n}", a11yEffective:"фактически: {status}", heldTooltip:"фактически {eff} — сам уже {own}, ждёт зависимости", a11yOptional:"необязательно", a11yFocusMark:"смотрите здесь", a11yLink:"со ссылкой",
    hint_indent:"Отступ (2 пробела или табуляция) задаёт иерархию.",
    hint_all:"подзадача, все обязательны", hint_any:"альтернатива, выберите одну",
    hint_xor:"альтернатива, ровно одна",
    hint_opt:"дополнение, не обязательно",
    hint_focus:"смотрите здесь (общая указка)",
    hint_root:"Строка без маркера = корневой узел. Не смешивайте |, = и - / +.",
    hint_status:"Статус в виде флажка после маркера, напр.",
    hint_size:"Трудоёмкость как размер футболки в скобках; ссылку добавьте просто как URL:",
    hint_break:"С (M): дробите дальше — если декомпозиции нет, в диаграмме появляется заполнитель. Если подзадачи превышают указанный размер, значок предупреждает.",
    hint_comment:"Комментарии через %% — вся строка или в конце строки.",
    hint_cont:"Пробел и \\ в конце строки — следующая строка всё ещё относится к ней.",
    hint_people:"Люди через @имя — показываются справа внизу узла.",
    hint_id:"ID узла через #имя: перед заголовком — виден во всплывающей подсказке узла.",
    hint_deps:"Зависимости через :#имя,#имя — видны в подсказке.",
    hint_eff:"Цвет узла показывает фактический статус (с учётом зависимостей); если собственный дальше, он показан меткой слева внизу.",
    hint_desc:"Описания: строка \" под узлом; длинный текст после --- как блок #id с отступом — оба в подсказке (”).",
    hint_fold:"Сворачивание: - [x] > … открывается свёрнутым, < возвращает; ▾/▸ на узле переключает (клавиши: ←/→).",
    hint_jump:"Alt+клик по узлу (долгое нажатие на сенсоре) переходит к его строке в тексте; Alt+клик в тексте показывает узел на диаграмме; Ctrl+клик по зависимости :#id переходит к строке этого ID.",
    hint_save:"Ctrl+S сохраняет документ как файл — с запомненным файлом (напр. Chrome/Edge) прямо на месте."
  },
  hi: {
    subtitle:"Werkbaum – WBS / Lean Pathfinding · परियोजना संरचना संपादक (फ़ीचर और रिक्वायरमेंट ट्री के लिए भी)",
    imprint:"प्रकाशन विवरण (Impressum)",
    privacy:"गोपनीयता",
    legendTooltip:"लेजेंड दिखाएँ/छिपाएँ",
    paneToText:"टेक्स्ट पर जाएँ",
    paneToDiagram:"आरेख पर जाएँ",
    ghostTooltip:"आकार M से ऊपर किसी तत्व को और अधिक उप-विभाजित करना चाहिए।",
    jumpHint:"Alt+क्लिक: टेक्स्ट में उस पंक्ति पर जाएँ",
    jumpHintTouch:"देर तक दबाएँ: टेक्स्ट में उस पंक्ति पर जाएँ",
    acHint:"{n} आईडी सुझाव – ↑/↓ से चुनें, Enter से डालें",
    tipClose:"बंद करें",
    tipOpenLink:"लिंक खोलें",
    liveLoadWarn:"सर्वर दस्तावेज़ लोड नहीं हुआ: {url} ({error})। क्या बैकएंड चल रहा है और क्या पता दस्तावेज़ का पता है (…/documents/&lt;uuid&gt;)?",
    liveStaleWarn:"आपका बदलाव अब लागू नहीं हो सका ({error}) — स्थिति एक बार नए सिरे से ली गई।",
    liveConflictText:"किसी और ने वही पंक्तियाँ बदली हैं। किसका संस्करण रहे?",
    liveConflictTheirs:"दूसरे का लें",
    liveConflictMine:"अपना रखें",
    riskTooltip:"उच्च जोखिम – प्रयास अभी अस्पष्ट।",
    discardedTooltip:"अस्वीकृत नोड्स और उनके उप-वृक्ष दिखाएँ/छिपाएँ",
    cheapTooltip:"सबसे किफ़ायती पथ को उजागर करें – अनावश्यक विकल्प मंद हो जाते हैं",
    leanNextTooltip:"सबसे किफ़ायती पथ के अगले पड़ाव पर जाएँ – अगला काम ({n} शेष)",
    depsTooltip:"निर्भरता के आड़े संबंध दिखाएँ",
    foldCycle_small:"आकार M और उससे छोटे नोड समेटें",
    foldCycle_path:"सबसे किफ़ायती पथ से बाहर सब कुछ समेटें",
    foldCycle_closed:"सभी नोड समेटें",
    foldCycle_open:"सभी नोड खोलें",
    implicitSizeTooltip:"कोई आकार नहीं दिया गया – लागत अनुमान के लिए कम से कम {size} माना गया",
    fullscreenTooltip:"पूर्ण स्क्रीन – पैनल पूरी विंडो चौड़ाई का उपयोग करते हैं",
    brandTooltip:"„Werkbaum“ का अर्थ लगभग ‚कार्य-वृक्ष‘ है — कार्य विभाजन संरचना (WBS) का वृक्ष।",
    editorTitle:"टेक्स्ट संपादक", diagramTitle:"आरेख",
    docSwitchTooltip:"दस्तावेज़ चुनें या प्रबंधित करें", docMenuAria:"दस्तावेज़",
    snapTooltip:"इस दस्तावेज़ की पिछली स्थितियाँ", snapMenuAria:"पिछली स्थितियाँ",
    snapNone:"अभी कोई पिछली स्थिति नहीं — बटन दबाने पर और कुछ बदलने पर हर 10 मिनट में एक सहेजी जाती है।",
    snapAddTooltip:"मौजूदा स्थिति अभी सहेजें",
    liveNameAsk:"दूसरों के लिए आपका नाम (साझा दस्तावेज़ के इतिहास में दिखता है; खाली = अनाम):",
    snapNoneLive:"सर्वर पर अभी कोई पिछली स्थिति नहीं — पड़ाव लिखने के विराम के बाद और कैमरा बटन से बनते हैं।",
    snapRollbackConfirm:"{when} की स्थिति पर लौटें? यह इस दस्तावेज़ को संपादित करने वाले सभी पर लागू होगा — नई वर्शन के रूप में, कुछ नहीं खोता।",
    idsTooltip:"शीर्षक से पहले नोड आईडी दिखाएँ",
    snapLines:"{n} पंक्तियाँ",
    docNew:"नया दस्तावेज़", docRename:"नाम बदलें", docDelete:"हटाएँ",
    docNewName:"बिना शीर्षक",
    docDeleteConfirm:"दस्तावेज़ „{name}“ हटाएँ?",
    docDeleteLastConfirm:"दस्तावेज़ „{name}“ हटाएँ? यह आख़िरी है — इसकी जगह फिर से साथ आया उदाहरण आ जाएगा।",
    docLeave:"छोड़ें – केवल आपकी सूची से हटता है",
    docLeaveConfirm:"„{name}“ छोड़ें? यह केवल आपकी सूची से हटेगा — सर्वर पर बना रहेगा, और इसका लिंक क्लिपबोर्ड में रख दिया जाएगा।",
    docRestore:"मूल पुनर्स्थापित करें",
    docRestoreConfirm:"„{name}“ को मूल संस्करण पर लौटाएँ? आपके परिवर्तन खो जाएँगे।",
    docOpenFile:"फ़ाइल खोलें…", docSaveFile:"फ़ाइल के रूप में सहेजें (Ctrl+S)",
    docToServer:"साझा करें – Werkbaum सर्वर पर रखें और साथ मिलकर संपादित करें",
    docReload:"स्रोत से फिर लोड करें – स्थानीय बदलाव खो जाएँगे",
    docReloadConfirm:"“{name}” को स्रोत से फिर लोड करें? स्थानीय बदलाव खो जाएँगे।",
    docGroupShipped:"साथ आए", docGroupOwn:"स्थानीय", docGroupSources:"साझा",
    docToServerAsk:"Werkbaum सर्वर का पता (जैसे https://werkbaum.example):",
    docToServerDone:"सर्वर पर है — लिंक पता-पट्टी में और क्लिपबोर्ड में है।",
    docToServerFailed:"सर्वर पर नहीं रखा जा सका: {error}",
    fsNotice:"यह ब्राउज़र स्थानीय फ़ाइलों में सीधे नहीं लिख सकता: खोली गई फ़ाइल एक प्रति के रूप में लोड होती है, और सहेजने पर डाउनलोड में एक नई फ़ाइल बनती है। File System Access API वाले ब्राउज़र (जैसे Chrome या Edge) सीधे खोली गई फ़ाइल में लिखते हैं।", fsNoticeOk:"समझ गया", fsNoticeBrave:"Brave में आप API को स्वयं चालू कर सकते हैं:",
    copy:"कॉपी करें", copyDone:"कॉपी हो गया ✓", copyTooltip:"टेक्स्ट को क्लिपबोर्ड पर कॉपी करें",
    copyDiagramTooltip:"आरेख को PNG छवि के रूप में क्लिपबोर्ड पर कॉपी करें",
    downloadDiagramTooltip:"आरेख को SVG फ़ाइल के रूप में डाउनलोड करें (जैसे LibreOffice: सम्मिलित करें → छवि)",
    downloadPngTooltip:"आरेख को PNG फ़ाइल के रूप में डाउनलोड करें (रास्टर छवि, कहीं भी सम्मिलित करने योग्य)",
    downloadMenu:"आरेख डाउनलोड करें (SVG/PNG)",
    minimize:"छोटा करें", normal:"सामान्य", maximize:"बड़ा करें",
    agenda:"लेजेंड", discarded:"अस्वीकृत",
    gutterTooltip:"आकार बदलने के लिए खींचें, डबल-क्लिक रीसेट करता है", gutterAria:"क्षेत्रों का आकार बदलें",
    hintGutterAria:"संपादक और लेजेंड का आकार बदलें",
    freshTooltip:"पिछली बार से उत्पादन में नया: {n}।",
    newsTooltip:"नया क्या है",
    newsTitle:"नया क्या है",
    newsEnglish:"खेद है, यह विवरण केवल अंग्रेज़ी में ही रखा जाता है।",
    newsEmpty:"कोई प्रविष्टि नहीं।",
    newsUnseen:"{n} दिनों की खबरें, जो आपने अभी तक नहीं देखीं।",
    newsSince:"आपकी पिछली यात्रा से: {n} उत्पादन में नए।",
    newsSeen:"देखा गया",
    newsShow:"आरेख में {n} नोड दिखाएँ",
    newsShowOff:"हाइलाइट हटाएँ",
    newsShowing:"आरेख में {d} के बदलाव दिखाए जा रहे हैं।",
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
    sizeConflictWarn:"पंक्ति {line}: उप-पैकेज मिलकर दिए गए आकार ({size}) से बड़े हैं — सबसे आशावादी आकलन में भी।",
    sizeConflictTooltip:"उप-पैकेज मिलकर दिए गए आकार से बड़े हैं",
    cheapApproxWarn:"सटीक खोज के लिए बहुत सारे युग्मित विकल्प-समूह — सबसे सस्ता पथ लालची अनुमान है (प्रति समूह स्थानीय चयन)।",
    assigneeOverloadWarn:"@{tag} सबसे सस्ते पथ पर खुले काम का {share}% उठाए हुए है ({total} में से {stations} स्टेशन) — संभावित अड़चन।",
    peopleBarLabel:"ज़िम्मेदार",
    peopleUnassigned:"बिना ज़िम्मेदार",
    peopleShare:"सबसे सस्ते पथ पर खुले काम का {share}%",
    peopleLensOn:"क्लिक: केवल ये नोड दिखाएँ, बाकी सब समेटें",
    peopleLensOff:"क्लिक: फ़िल्टर हटाएँ",
    st_idee:"विचार", st_geplant:"नियोजित", st_arbeit:"प्रगति पर", st_durchstich:"कार्यशील ढाँचा",
    st_fertig:"पूर्ण", st_prod:"उत्पादन में", st_highrisk:"उच्च जोखिम", st_verworfen:"अस्वीकृत",
    unknownStatusWarn:"पंक्ति {line}: अज्ञात स्थिति कोड „{code}“ — तटस्थ रूप में दिखाया गया।",
    sourceLoadWarn:"„{url}“ लोड नहीं हो सका ({error})। फ़ाइल http(s) से उपलब्ध होनी चाहिए और CORS की अनुमति देनी चाहिए (Access-Control-Allow-Origin)।",
    padGoneWarn:"यह लिंक एक Etherpad पैड की ओर इशारा करता है। Etherpad कनेक्शन अब नहीं है — साझा काम अब Werkbaum बैकएंड (?live=…) से होता है। पैड का टेक्स्ट वहाँ एक बार चिपकाएँ और मिलकर संपादित करें।",
    storeFailedWarn:"ब्राउज़र में सहेजना विफल रहा — संभवतः उसका संग्रहण भर गया है। पुनः लोड करने पर बदलाव खो सकते हैं; अनुपयोगी दस्तावेज़ या पिछली स्थितियाँ हटाकर जगह बनाएँ।",
    tabConflictWarn:"Werkbaum एक और ब्राउज़र टैब में खुला है — दोनों एक ही दस्तावेज़ सूची में लिखते हैं, और आख़िर में सहेजने वाला जीतता है। बेहतर है कि एक ही टैब में काम करें।",
    liveUnsentWarn:"आपके बदलाव {min} मिनट से सर्वर तक नहीं पहुँचे — वे केवल इस विंडो में मौजूद हैं। बंद करने से पहले सहेजें (Ctrl+S या कैमरा बटन)।",
    liveEndedWarn:"इस सर्वर दस्तावेज़ से लाइव कनेक्शन समाप्त हो गया है — बदलाव अब साझा नहीं होते। दोबारा जोड़ने के लिए पुनः लोड करें।",
    tabModalTitle:"Werkbaum एक से अधिक बार खुला है",
    tabModalText:"यह ऐप किसी और विंडो या टैब में भी खुला है। दोनों एक ही दस्तावेज़ भंडार में लिखते हैं — आख़िर में सहेजने वाला दूसरे को मिटा देता है। कृपया दूसरी विंडो बंद करें; यह सूचना अपने आप हट जाएगी।",
    tabModalForce:"फिर भी जारी रखें (अनुशंसित नहीं)",
    snapLocalHead:"स्थानीय प्रतियाँ (यह विंडो)",
    a11yStatus:"स्थिति: {status}", a11ySize:"आकार: {size}", a11ySizeImplicit:"आकार: कम से कम {size} (अनुमानित)", a11yTags:"जिम्मेदार: {names}", a11yId:"आईडी: #{id}", a11yDeps:"निर्भर: {ids}", a11yFolded:"समेटा हुआ, {n} छिपे", a11yEffective:"प्रभावी: {status}", heldTooltip:"प्रभावी रूप से {eff} — स्वयं {own} है, निर्भरताओं की प्रतीक्षा में", a11yOptional:"वैकल्पिक", a11yFocusMark:"यहाँ देखें", a11yLink:"लिंक सहित",
    hint_indent:"इंडेंट (2 स्पेस या टैब) पदानुक्रम तय करता है।",
    hint_all:"उप-कार्य, सभी आवश्यक", hint_any:"विकल्प, एक चुनें",
    hint_xor:"विकल्प, ठीक एक",
    hint_opt:"अतिरिक्त, आवश्यक नहीं",
    hint_focus:"यहाँ देखें (साझा संकेतक)",
    hint_root:"बिना मार्कर वाली पंक्ति = मूल नोड। |, = और - / + को आपस में न मिलाएँ।",
    hint_status:"मार्कर के बाद चेकबॉक्स के रूप में स्थिति, जैसे",
    hint_size:"प्रयास कोष्ठक में टी-शर्ट आकार के रूप में; लिंक बस URL के रूप में जोड़ें:",
    hint_break:"(M) से आगे: और विभाजित करें — विभाजन न होने पर आरेख में प्लेसहोल्डर दिखता है। यदि उप-कार्य दी गई साइज़ से बड़े हों, तो बैज चेतावनी देता है।",
    hint_comment:"%% से टिप्पणियाँ — पूरी पंक्ति या पंक्ति के अंत में।",
    hint_cont:"पंक्ति के अंत में स्पेस और \\ — अगली पंक्ति उसी की बनी रहती है।",
    hint_people:"@नाम से व्यक्ति — नोड के नीचे-दाएँ दिखते हैं।",
    hint_id:"शीर्षक से पहले #नाम: के रूप में नोड आईडी — नोड के टूलटिप में दिखती है।",
    hint_deps:":#नाम,#नाम से निर्भरताएँ — टूलटिप में दिखती हैं।",
    hint_eff:"नोड का रंग प्रभावी स्थिति दिखाता है (निर्भरताओं सहित); यदि अपनी स्थिति आगे है, तो वह नीचे-बाएँ चिह्न के रूप में दिखती है।",
    hint_desc:"विवरण: नोड के नीचे \" पंक्ति; --- के बाद #id ब्लॉक में लंबा पाठ — दोनों टूलटिप में (”)।",
    hint_fold:"फ़ोल्डिंग: - [x] > … समेटा हुआ खुलता है, < वापस लाता है; नोड पर ▾/▸ टॉगल करता है (कीबोर्ड: ←/→)।",
    hint_jump:"किसी नोड पर Alt+क्लिक (टच पर लंबा दबाव) टेक्स्ट में उसकी पंक्ति पर ले जाता है; टेक्स्ट में Alt+क्लिक उस नोड को आरेख में दिखाता है; :#id निर्भरता पर Ctrl+क्लिक उस ID की पंक्ति पर ले जाता है।",
    hint_save:"Ctrl+S दस्तावेज़ को फ़ाइल के रूप में सहेजता है — याद रखी गई फ़ाइल (जैसे Chrome/Edge) में सीधे उसी जगह।"
  },
  zh: {
    subtitle:"Werkbaum – WBS / Lean Pathfinding · 项目结构编辑器（也支持功能树和需求树）",
    imprint:"法律声明（Impressum）",
    privacy:"隐私",
    legendTooltip:"显示/隐藏图例",
    paneToText:"切换到文本",
    paneToDiagram:"切换到图表",
    brandTooltip:"「Werkbaum」大致意为‘工作之树’——即工作分解结构（WBS）之树。",
    fullscreenTooltip:"全屏——面板占据整个窗口宽度",
    discardedTooltip:"显示/隐藏已放弃的节点及其子树",
    cheapTooltip:"突出显示成本最低的路径——不需要的备选项将淡化",
    leanNextTooltip:"跳到成本最低路径的下一站——接下来该做的事（还有 {n} 项）",
    depsTooltip:"显示依赖关系连线",
    foldCycle_small:"折叠尺寸 M 及更小的节点",
    foldCycle_path:"折叠最低成本路径之外的所有节点",
    foldCycle_closed:"折叠所有节点",
    foldCycle_open:"展开所有节点",
    implicitSizeTooltip:"未指定尺寸——成本估算时按至少 {size} 计",
    ghostTooltip:"从 M 号起，元素应进一步细分。",
    jumpHint:"Alt+点击：跳转到文本中的该行",
    jumpHintTouch:"长按：跳转到文本中的该行",
    acHint:"{n} 个 ID 建议 – ↑/↓ 选择，Enter 插入",
    tipClose:"关闭",
    tipOpenLink:"打开链接",
    liveLoadWarn:"未能加载服务器文档：{url}（{error}）。后端在运行吗？该地址是文档地址（…/documents/&lt;uuid&gt;）吗？",
    liveStaleWarn:"你的更改已无法应用（{error}）——已重新获取一次当前状态。",
    liveConflictText:"有人改动了同样的行。以谁的版本为准？",
    liveConflictTheirs:"采用对方的",
    liveConflictMine:"保留我的",
    riskTooltip:"高风险 – 工作量尚不明确。",
    editorTitle:"文本编辑器", diagramTitle:"图表",
    docSwitchTooltip:"选择或管理文档", docMenuAria:"文档",
    snapTooltip:"此文档的早期状态", snapMenuAria:"早期状态",
    snapNone:"暂无早期状态——可随时手动保存；内容有变动时，也会每 10 分钟保存一次。",
    snapAddTooltip:"立即保存当前状态",
    liveNameAsk:"你展示给其他人的名字（显示在共享文档的历史中；留空 = 匿名）：",
    snapNoneLive:"服务器上还没有以前的状态——里程碑在写作停顿后以及通过相机按钮产生。",
    snapRollbackConfirm:"回退到 {when} 的状态？这对所有编辑此文档的人生效——作为新版本，不会丢失任何内容。",
    idsTooltip:"在标题前显示节点 ID",
    snapLines:"{n} 行",
    docNew:"新建文档", docRename:"重命名", docDelete:"删除",
    docNewName:"未命名",
    docDeleteConfirm:"删除文档“{name}”？",
    docDeleteLastConfirm:"删除文档“{name}”？这是最后一个——自带示例将重新取代它。",
    docLeave:"离开——仅从你的列表中移除",
    docLeaveConfirm:"离开“{name}”？它只会从你的列表中移除——仍保留在服务器上，其链接会放入剪贴板。",
    docRestore:"恢复原始版本",
    docRestoreConfirm:"将“{name}”重置为随附版本？您的更改将丢失。",
    docOpenFile:"打开文件…", docSaveFile:"另存为文件（Ctrl+S）",
    docToServer:"共享——放到 Werkbaum 服务器上共同编辑",
    docReload:"从来源重新加载——本地更改将丢失",
    docReloadConfirm:"从来源重新加载“{name}”？本地更改将丢失。",
    docGroupShipped:"自带", docGroupOwn:"本地", docGroupSources:"共享",
    docToServerAsk:"Werkbaum 服务器地址（例如 https://werkbaum.example）：",
    docToServerDone:"已在服务器上——链接在地址栏和剪贴板中。",
    docToServerFailed:"未能放到服务器上：{error}",
    fsNotice:"此浏览器无法直接写入本地文件：打开的文件会作为副本载入，保存时会在下载目录生成一个新文件。支持 File System Access API 的浏览器（如 Chrome、Edge）则会直接写回打开的文件。", fsNoticeOk:"知道了", fsNoticeBrave:"在 Brave 中可以手动启用该接口：",
    copy:"复制", copyDone:"已复制 ✓", copyTooltip:"将文本复制到剪贴板",
    copyDiagramTooltip:"将图表作为 PNG 图片复制到剪贴板",
    downloadDiagramTooltip:"将图表下载为 SVG 文件（例如用于 LibreOffice：插入 → 图像）",
    downloadPngTooltip:"将图表下载为 PNG 文件（位图，可在任何地方插入）",
    downloadMenu:"下载图表（SVG/PNG）",
    minimize:"最小化", normal:"正常", maximize:"最大化",
    agenda:"图例", discarded:"已放弃",
    gutterTooltip:"拖动可调整大小，双击可重置", gutterAria:"调整区域大小",
    hintGutterAria:"调整编辑器和图例大小",
    freshTooltip:"自上次查看以来新上线：{n}。",
    newsTooltip:"最新动态",
    newsTitle:"最新动态",
    newsEnglish:"很抱歉，此更新列表仅以英文维护。",
    newsEmpty:"暂无记录。",
    newsUnseen:"有 {n} 天的动态你还没有看过。",
    newsSince:"自你上次访问以来：{n} 项新上线。",
    newsSeen:"已查看",
    newsShow:"在图中显示 {n} 个节点",
    newsShowOff:"取消高亮",
    newsShowing:"正在图中显示 {d} 的变更。",
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
    sizeConflictWarn:"第 {line} 行：子项合计超出所标注的尺寸（{size}）——即使按最乐观的估算也是如此。",
    sizeConflictTooltip:"子项合计超出所标注的尺寸",
    cheapApproxWarn:"耦合的备选组过多，无法精确搜索——最便宜路径为贪心估计（每组就地选择）。",
    assigneeOverloadWarn:"@{tag} 承担最便宜路径上 {share}% 的未完成工作（{total} 个站点中的 {stations} 个）——可能的瓶颈。",
    peopleBarLabel:"负责人",
    peopleUnassigned:"未分配",
    peopleShare:"最便宜路径上未完成工作的 {share}%",
    peopleLensOn:"点击：只显示这些节点，折叠其余部分",
    peopleLensOff:"点击：取消筛选",
    st_idee:"想法", st_geplant:"已计划", st_arbeit:"进行中", st_durchstich:"可运行骨架",
    st_fertig:"已完成", st_prod:"已上线", st_highrisk:"高风险", st_verworfen:"已放弃",
    unknownStatusWarn:"第 {line} 行：未知状态代码“{code}”——显示为中性。",
    sourceLoadWarn:"无法加载“{url}”（{error}）。该文件必须可通过 http(s) 访问并允许 CORS（Access-Control-Allow-Origin）。",
    padGoneWarn:"此链接指向一个 Etherpad pad。Etherpad 连接已移除——协作现在通过 Werkbaum 后端（?live=…）进行。把 pad 的文本粘贴过去一次，然后一起编辑。",
    storeFailedWarn:"无法保存到浏览器——其存储空间可能已满。重新加载时更改可能丢失；请删除不再使用的文档或以前的状态以腾出空间。",
    tabConflictWarn:"Werkbaum 已在另一个浏览器标签页中打开——两者写入同一份文档列表，最后保存者生效。最好只在一个标签页中工作。",
    liveUnsentWarn:"你的更改已有 {min} 分钟未到达服务器——它们只存在于此窗口中。关闭前请先保存（Ctrl+S 或相机按钮）。",
    liveEndedWarn:"与此服务器文档的实时连接已结束——更改不再共享。重新加载以重新连接。",
    tabModalTitle:"Werkbaum 已多处打开",
    tabModalText:"此应用正同时在另一个窗口或标签页中打开。两者写入同一份文档存储——后保存者会覆盖对方。请关闭另一个窗口；此提示会自行消失。",
    tabModalForce:"仍要继续（不推荐）",
    snapLocalHead:"本地备份（此窗口）",
    a11yStatus:"状态：{status}", a11ySize:"工作量：{size}", a11ySizeImplicit:"工作量：至少 {size}（假定）", a11yTags:"负责人：{names}", a11yId:"ID：#{id}", a11yDeps:"依赖：{ids}", a11yFolded:"已折叠，隐藏 {n} 项", a11yEffective:"实际：{status}", heldTooltip:"实际为 {eff}——自身已是 {own}，等待依赖完成", a11yOptional:"可选", a11yFocusMark:"看这里", a11yLink:"含链接",
    hint_indent:"缩进（2 个空格或制表符）定义层级。",
    hint_all:"子任务，全部必需", hint_any:"备选项，择其一",
    hint_xor:"备选项，恰好一个",
    hint_opt:"附加项，非必需",
    hint_focus:"看这里（共享的指针）",
    hint_root:"无标记的行 = 根节点。请勿混用 |、= 与 - / +。",
    hint_status:"在标记后用方框表示状态，例如",
    hint_size:"用括号中的 T 恤尺码表示工作量；链接直接作为 URL 附加：",
    hint_break:"从 (M) 起：继续细分——若缺少细分，图表中会出现占位符。若子任务超出所标注的大小，徽章会发出警告。",
    hint_comment:"用 %% 注释——整行或行尾。",
    hint_cont:"行尾的空格加 \\ —— 下一行仍属于这一行。",
    hint_people:"用 @姓名 表示人员——显示在节点右下角。",
    hint_id:"用 #名称: 写在标题前指定节点 ID——显示在节点提示中。",
    hint_deps:"用 :#名称,#名称 表示依赖——显示在提示中。",
    hint_eff:"节点颜色显示实际状态（含依赖）；若自身状态更靠前，会以左下角标记显示。",
    hint_desc:"描述：节点下方的 \" 行；--- 之后的缩进 #id 块为长文本——均显示在提示中（”）。",
    hint_fold:"折叠：- [x] > … 打开时即折叠，< 将其展开；节点上的 ▾/▸ 切换（键盘：←/→）。",
    hint_jump:"Alt+点击节点（触摸屏为长按）可跳转到文本中对应的行；在文本中 Alt+点击则把该节点带入视野；在依赖 :#id 上 Ctrl+点击可跳转到该 ID 所在的行。",
    hint_save:"Ctrl+S 将文档保存为文件——若已记住文件（如 Chrome/Edge），则直接就地写回。"
  },
  ja: {
    subtitle:"Werkbaum – WBS / Lean Pathfinding · プロジェクト構造エディター（フィーチャーツリーと要件ツリーにも対応）",
    imprint:"運営者情報（Impressum）",
    privacy:"プライバシー",
    legendTooltip:"凡例を表示/非表示",
    paneToText:"テキストに切り替え",
    paneToDiagram:"ダイアグラムに切り替え",
    brandTooltip:"「Werkbaum」はおおよそ『作業の木』の意味 — 作業分解構成図（WBS）のツリーです。",
    fullscreenTooltip:"全画面 — パネルがウィンドウ幅いっぱいを使用",
    discardedTooltip:"破棄したノードとその下位ツリーを表示/非表示",
    cheapTooltip:"最も低コストの経路を強調 – 不要な選択肢は控えめに表示",
    leanNextTooltip:"最も低コストの経路の次の駅へ移動 – 次にやること（残り {n} 件）",
    depsTooltip:"依存関係のリンクを表示",
    foldCycle_small:"サイズ M 以下のノードを折りたたむ",
    foldCycle_path:"最も低コストの経路以外をすべて折りたたむ",
    foldCycle_closed:"すべてのノードを折りたたむ",
    foldCycle_open:"すべてのノードを展開",
    implicitSizeTooltip:"サイズ未指定 – コスト見積もりのため少なくとも {size} として扱う",
    ghostTooltip:"サイズ M 以上の要素はさらに分解すべきです。",
    jumpHint:"Alt+クリック：テキストの該当行へ移動",
    jumpHintTouch:"長押し：テキストの該当行へ移動",
    acHint:"ID候補 {n} 件 – ↑/↓で選択、Enterで挿入",
    tipClose:"閉じる",
    tipOpenLink:"リンクを開く",
    liveLoadWarn:"サーバー文書を読み込めませんでした: {url}（{error}）。バックエンドは動いていますか。アドレスは文書のアドレス（…/documents/&lt;uuid&gt;）ですか。",
    liveStaleWarn:"あなたの変更はもう適用できませんでした（{error}）。状態を一度取り直しました。",
    liveConflictText:"同じ行が他の人にも変更されました。どちらの版を採りますか。",
    liveConflictTheirs:"相手の版",
    liveConflictMine:"自分の版",
    riskTooltip:"高リスク – 規模はまだ不明。",
    editorTitle:"テキストエディター", diagramTitle:"ダイアグラム",
    docSwitchTooltip:"ドキュメントを選択・管理", docMenuAria:"ドキュメント",
    snapTooltip:"このドキュメントの以前の状態", snapMenuAria:"以前の状態",
    snapNone:"以前の状態はまだありません — ボタンを押したとき、および変更があれば 10 分ごとに保存されます。",
    snapAddTooltip:"現在の状態を今すぐ保存",
    liveNameAsk:"他の人に表示される名前（共有ドキュメントの履歴に表示。空欄 = 匿名）：",
    snapNoneLive:"サーバーにはまだ以前の状態がありません — マイルストーンは書き込みの合間とカメラボタンで生まれます。",
    snapRollbackConfirm:"{when} の状態に戻しますか？このドキュメントを編集する全員に適用されます — 新しいバージョンとして、何も失われません。",
    idsTooltip:"タイトルの前にノード ID を表示",
    snapLines:"{n} 行",
    docNew:"新規ドキュメント", docRename:"名前を変更", docDelete:"削除",
    docNewName:"無題",
    docDeleteConfirm:"ドキュメント「{name}」を削除しますか？",
    docDeleteLastConfirm:"ドキュメント「{name}」を削除しますか？これが最後です — 同梱のサンプルが再び置かれます。",
    docLeave:"退出 – 自分のリストから外すだけ",
    docLeaveConfirm:"「{name}」から退出しますか？自分のリストから外れるだけで、サーバーには残ります。リンクはクリップボードに入ります。",
    docRestore:"オリジナルを復元",
    docRestoreConfirm:"「{name}」を同梱版に戻しますか？変更内容は失われます。",
    docOpenFile:"ファイルを開く…", docSaveFile:"ファイルとして保存 (Ctrl+S)",
    docToServer:"共有 – Werkbaum サーバーに置いて共同編集",
    docReload:"ソースから再読み込み – ローカルの変更は失われます",
    docReloadConfirm:"「{name}」をソースから再読み込みしますか？ローカルの変更は失われます。",
    docGroupShipped:"同梱", docGroupOwn:"ローカル", docGroupSources:"共有",
    docToServerAsk:"Werkbaum サーバーのアドレス（例: https://werkbaum.example）:",
    docToServerDone:"サーバーにあります — リンクはアドレス欄とクリップボードにあります。",
    docToServerFailed:"サーバーに置けませんでした: {error}",
    fsNotice:"このブラウザーはローカルファイルへ直接書き込めません。開いたファイルはコピーとして読み込まれ、保存するとダウンロードに新しいファイルが作られます。File System Access API に対応したブラウザー（Chrome や Edge など）は、開いたファイルへ直接書き戻します。", fsNoticeOk:"わかりました", fsNoticeBrave:"Brave では、この API を手動で有効にできます：",
    copy:"コピー", copyDone:"コピーしました ✓", copyTooltip:"テキストをクリップボードにコピー",
    copyDiagramTooltip:"ダイアグラムを PNG 画像としてクリップボードにコピー",
    downloadDiagramTooltip:"ダイアグラムを SVG ファイルとしてダウンロード（例：LibreOffice の 挿入 → 画像）",
    downloadPngTooltip:"ダイアグラムを PNG ファイルとしてダウンロード（ラスター画像、どこにでも挿入可能）",
    downloadMenu:"ダイアグラムをダウンロード（SVG/PNG）",
    minimize:"最小化", normal:"標準", maximize:"最大化",
    agenda:"凡例", discarded:"破棄",
    gutterTooltip:"ドラッグでサイズ変更、ダブルクリックでリセット", gutterAria:"領域のサイズを変更",
    hintGutterAria:"エディターと凡例のサイズを変更",
    freshTooltip:"前回以降に本番化されたもの：{n} 件。",
    newsTooltip:"更新情報",
    newsTitle:"更新情報",
    newsEnglish:"申し訳ありませんが、この一覧は英語でのみ更新されます。",
    newsEmpty:"項目はありません。",
    newsUnseen:"まだ見ていない {n} 日分の更新があります。",
    newsSince:"前回の訪問以降：{n} 件が本番化されました。",
    newsSeen:"確認済み",
    newsShow:"図に {n} 件のノードを表示",
    newsShowOff:"ハイライトを解除",
    newsShowing:"図に {d} の変更を表示しています。",
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
    sizeConflictWarn:"{line} 行目：サブパッケージの合計が指定サイズ（{size}）を超えています — 最も楽観的な見積もりでも。",
    sizeConflictTooltip:"サブパッケージの合計が指定サイズを超えています",
    cheapApproxWarn:"結合された選択肢グループが多すぎるため厳密探索は不可 — 最安パスは貪欲法による推定です（グループごとに局所選択）。",
    assigneeOverloadWarn:"@{tag} が最安パスの未完了作業の {share}% を担っています（全 {total} 駅中 {stations} 駅）— ボトルネックの可能性。",
    peopleBarLabel:"担当者",
    peopleUnassigned:"担当者なし",
    peopleShare:"最安パスの未完了作業の {share}%",
    peopleLensOn:"クリック：このノードだけを表示し、他を折りたたむ",
    peopleLensOff:"クリック：フィルターを解除",
    st_idee:"アイデア", st_geplant:"計画済み", st_arbeit:"作業中", st_durchstich:"ウォーキングスケルトン",
    st_fertig:"完了", st_prod:"本番稼働", st_highrisk:"高リスク", st_verworfen:"破棄",
    unknownStatusWarn:"{line} 行目: 不明なステータス記号「{code}」— 中立として表示。",
    sourceLoadWarn:"「{url}」を読み込めませんでした（{error}）。ファイルは http(s) でアクセス可能で、CORS（Access-Control-Allow-Origin）を許可する必要があります。",
    padGoneWarn:"このリンクは Etherpad のパッドを指しています。Etherpad 連携は廃止されました。共同編集は Werkbaum バックエンド（?live=…）で行います。パッドの本文を一度貼り付ければ、複数人で編集できます。",
    storeFailedWarn:"ブラウザーへの保存に失敗しました — ストレージが満杯の可能性があります。再読み込みで変更が失われることがあります。不要なドキュメントや以前の状態を削除して空きを作ってください。",
    tabConflictWarn:"Werkbaum が別のタブでも開いています — 両方が同じドキュメント一覧に書き込み、最後に保存した方が勝ちます。1 つのタブでの作業をおすすめします。",
    liveUnsentWarn:"変更が {min} 分間サーバーに届いていません — この変更はこのウィンドウにしか存在しません。閉じる前に保存してください（Ctrl+S またはカメラボタン）。",
    liveEndedWarn:"このサーバー文書とのライブ接続は終了しました — 変更は共有されなくなっています。再読み込みで再接続します。",
    tabModalTitle:"Werkbaum が複数開かれています",
    tabModalText:"このアプリは別のウィンドウまたはタブでも開かれています。両方が同じ文書ストレージに書き込むため、最後に保存した側が他方を上書きします。もう一方のウィンドウを閉じてください。この通知は自動的に消えます。",
    tabModalForce:"それでも続行（非推奨）",
    snapLocalHead:"ローカルの控え（このウィンドウ）",
    a11yStatus:"ステータス: {status}", a11ySize:"規模: {size}", a11ySizeImplicit:"規模: 少なくとも {size}（想定）", a11yTags:"担当: {names}", a11yId:"ID: #{id}", a11yDeps:"依存先: {ids}", a11yFolded:"折りたたみ中、{n} 件非表示", a11yEffective:"実効: {status}", heldTooltip:"実効では {eff} — 自身は既に {own}、依存待ち", a11yOptional:"任意", a11yFocusMark:"ここを見る", a11yLink:"リンクあり",
    hint_indent:"インデント（スペース2つまたはタブ）で階層を定義します。",
    hint_all:"サブタスク、すべて必須", hint_any:"選択肢、1つを選ぶ",
    hint_xor:"選択肢、ちょうど1つ",
    hint_opt:"追加、必須ではない",
    hint_focus:"ここを見る（共有の指さし）",
    hint_root:"マーカーのない行 = ルートノード。|・=・- / + を混在させないでください。",
    hint_status:"マーカーの後にチェックボックスで状態、例：",
    hint_size:"工数は括弧内の T シャツサイズで；リンクは URL としてそのまま追加：",
    hint_break:"(M) 以上：さらに分解 — 分解がないと図にプレースホルダーが表示されます。サブタスクが指定サイズを超えるとバッジが警告します。",
    hint_comment:"%% でコメント — 行全体または行末。",
    hint_cont:"行末の空白と \\ — 次の行も同じ行に属します。",
    hint_people:"@名前 で担当者 — ノードの右下に表示されます。",
    hint_id:"タイトルの前に #名前: でノード ID — ノードのツールチップに表示されます。",
    hint_deps:":#名前,#名前 で依存関係 — ツールチップに表示されます。",
    hint_eff:"ノードの色は実効ステータス（依存関係込み）を示します。自身が先行している場合は左下のマークで表示されます。",
    hint_desc:"説明：ノード直下の \" 行。--- 以降は #id ブロック（字下げ）で長文 — どちらもツールチップに表示（”）。",
    hint_fold:"折りたたみ：- [x] > … は折りたたんだ状態で開き、< は呼び戻します。ノードの ▾/▸ で切替（キー：←/→）。",
    hint_jump:"ノードを Alt+クリック（タッチでは長押し）すると、テキストの該当行へ移動します。テキスト内で Alt+クリックすると、そのノードが図の中央に表示されます。依存関係 :#id を Ctrl+クリックすると、その ID の行へ移動します。",
    hint_save:"Ctrl+S は文書をファイルとして保存します。記憶されたファイル（Chrome/Edge など）には、そのまま直接書き戻します。"
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
      ${chip('highrisk','[!]')}
    </div>
    ${esc(t('hint_size'))}<br>
    <code>- [ ] Backend (L) https://…</code><br>
    ${esc(t('hint_break'))}<br>
    ${esc(t('hint_comment'))}
    ${esc(t('hint_cont'))}
    ${esc(t('hint_people'))}
    ${esc(t('hint_id'))}
    ${esc(t('hint_deps'))}
    ${esc(t('hint_eff'))}
    ${esc(t('hint_desc'))}
    ${esc(t('hint_fold'))}
    <code>!!!</code>&nbsp; ${esc(t('hint_focus'))}
    <div class="hint-op">${esc(t('hint_jump'))}<br>${esc(t('hint_save'))}</div>`;
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
  /* Das Neuigkeiten-Popup wird bei jedem Öffnen gebaut — steht es gerade
     offen, muss es die neue Sprache jetzt bekommen (auch die Datumsangaben,
     die `toLocaleDateString` liefert). */
  if(newsMenu && !newsMenu.hidden) renderNewsMenu();
  /* Dasselbe fürs Dokumenten-Menü (D81): Gruppen-Überschriften und
     Aktions-Tooltips kommen aus renderDocMenu. */
  if(docMenu && !docMenu.hidden) renderDocMenu();
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
const LS_UI = 'werkbaum-ui';
/* LS_DOCS / LS_ACTIVE / LS_SRC kommen aus docstore.js (D83) — dort liegt das
   Ablageschema: Index ohne Texte, Text je Dokument unter eigenem Schlüssel. */
const LS_SEEDED = 'werkbaum-seeded';   /* mitgelieferte Dokumente schon angelegt? */
const LS_SEEDED_EXAMPLE = 'werkbaum-seeded-example';   /* Fingerabdruck der ausgelieferten INITIAL-Fassung (D27-Nachtrag) */
let restoring = false;   /* unterdrückt Speichern während des Wiederherstellens */
let hadStoredUI = false;  /* gab es beim Laden schon gespeicherte GUI-Einstellungen? */

/* ---------- Dokumente (mehrere umschaltbare Notationstexte) ----------
   Noch kein Backend: Der INDEX [{id,name,source?}] liegt unter LS_DOCS, der
   Text je Dokument unter einem eigenen Schlüssel (Schema: docstore.js, D83) —
   so trifft eine volle Quota nur das eine zu große Dokument und ein kaputter
   Schlüssel nur eines statt aller. Das aktive Dokument steht per id in
   LS_ACTIVE; sein Text wird zusätzlich in LS_SRC gespiegelt (Rollback- und
   Migrations-Fallback). Jedes Dokument ist nur ein Notationstext + Name
   (Metadatum) — kein eigenes Strukturformat (D14). */
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
/* Die volle Persistenz (Flush-Punkte: Wechseln/Anlegen/Löschen/Umbenennen,
   Verlassen der Seite — nicht der Tastendruck, D82): Index + Texte über das
   Ablageschema (docstore.js, D83). Unveränderte Schlüssel werden dort nicht
   angefasst; ein Fehlschlag (Quota voll) wird gemeldet statt geschluckt. */
function persistDocs(){
  try{
    storeDocs(localStorage, docs, Object.keys(localStorage));
    localStorage.setItem(LS_ACTIVE, activeId || '');
    const d = activeDoc();
    if(d) localStorage.setItem(LS_SRC, d.text);   /* Spiegel: Rollback-Fallback */
    noteStore(true);
  }catch(_){ noteStore(false); }
}
/* Die Tastendruck-Hälfte (D82/D83): der Text des AKTIVEN Dokuments unter
   seinem eigenen Schlüssel plus der Spiegel — der Tastendruck schreibt damit
   direkt in die echte Ablage, nicht mehr in eine Zwischenstation. */
function persistActiveText(){
  try{
    const d = activeDoc();
    if(d) storeDocText(localStorage, d.id, d.text);
    noteStore(true);
  }catch(_){ noteStore(false); }
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

/* Aus dem localStorage laden (Schema: docstore.js, D83); bei fehlender oder
   unbrauchbarer Dokumentenliste den bestehenden Einzeltext (oder INITIAL)
   als erstes Dokument migrieren. */
function loadDocs(){
  let gelesen = null;
  try{ gelesen = readDocs(localStorage); }catch(_){}
  if(gelesen){
    docs = gelesen.docs;
  } else {
    let legacy = null;
    try{ legacy = localStorage.getItem(LS_SRC); }catch(_){}
    docs = [{ id: EXAMPLE_ID, name: EXAMPLE_NAME, text: (legacy !== null) ? legacy : INITIAL }];
  }
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
  activeId = docs.some(d => d.id === a) ? a : docs[0].id;
  /* „Der Spiegel gewinnt" gilt nur noch der EINMALIGEN Migration aus dem
     Altformat (D82→D83): Dort schrieb der Tastendruck nur den Spiegel, das
     Array erst an Flush-Punkten — für das aktive Dokument ist der Spiegel
     also mindestens so neu. Im neuen Schema schreibt der Tastendruck den
     Text-Schlüssel selbst; eine Vorrang-Regel bräuchte dort nur etwas, das
     es lügen lassen könnte. Zwingend VOR seedShippedDocs(): Danach kann das
     Array die frisch nachgezogene Fassung tragen, und der (dann ältere)
     Spiegel würde sie zurückdrehen — das Dokument gälte fortan als
     „bearbeitet" und bekäme nie wieder eine neue Fassung. */
  if(gelesen && gelesen.legacy){
    try{
      const spiegel = localStorage.getItem(LS_SRC);
      const d = docs.find(x => x.id === activeId);
      if(d && spiegel !== null && spiegel !== d.text) d.text = spiegel;
    }catch(_){}
  }
  seedShippedDocs();
  /* Namensfix für die kurzlebige Fassung mit dem Tippfehler — nur, solange der
     ausgelieferte Name unverändert ist; eine eigene Umbenennung bleibt stehen
     (Dokumentnamen sind Nutzerdaten, D22). */
  const wb = docs.find(d => d.id === WERKBAUM_ID);
  if(wb && wb.name === WERKBAUM_NAME_ALT) wb.name = WERKBAUM_NAME;
}
function saveSrc(){
  if(restoring) return;
  const d = activeDoc();
  if(d) d.text = src.value;
  persistActiveText();   /* nicht persistDocs: das serialisierte ALLE Dokumente je Tastendruck (D82) */
}
function saveUI(){
  if(restoring) return;
  try{
    const modeEl = document.querySelector('input[name="layout"]:checked');
    localStorage.setItem(LS_UI, JSON.stringify({
      mode: modeEl ? modeEl.value : 'horizontal',
      discarded: discardedShown(),
      cheapPath: cheapPathOn,
      depLinks: depLinksOn,
      showIds,
      split: splitState,
      col: app.style.getPropertyValue('--col') || null,
      drow: app.style.getPropertyValue('--drow') || null,
      /* Legende: auf/zu + Aufteilung Editor|Legende (D26). Bewusst per
         DOM-Abfrage statt über die `agenda`-Konstante — die wird erst weiter
         unten deklariert, und saveUI() läuft schon aus applySplit() heraus. */
      agenda: !!document.querySelector('.agenda.open'),
      hcol: app.style.getPropertyValue('--hcol') || null,
      hrow: app.style.getPropertyValue('--hrow') || null,
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
    if(typeof ui.depLinks === 'boolean'){
      depLinksOn = ui.depLinks;
      depBtn.setAttribute('aria-pressed', depLinksOn ? 'true' : 'false');
    }
    if(typeof ui.showIds === 'boolean'){
      showIds = ui.showIds;
      idsBtn.setAttribute('aria-pressed', showIds ? 'true' : 'false');
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
  setAgendaOpen(!!(ui && ui.agenda));
  applyZoom();
  restoring = false;
}

/* ---------- Dokument-Wähler: Brotkrume im App-Kopf (D81) ----------
   „Werkbaum › name" — der Chip öffnet das Menü, das nach Dokumentart gruppiert
   (docKind, docurl.js) und je Zeile Umbenennen/Löschen/Wiederherstellen trägt.
   Die Stand-Funktionen des aktiven Dokuments (Speichern, Stände, Neu laden,
   Teilen) stehen als Knöpfe in der Editor-Titelzeile. */
const docTrigger = document.getElementById('docTrigger');
const docMenu = document.getElementById('docMenu');
const docNameEl = document.getElementById('docName');
const docList = document.getElementById('docList');
function updateDocName(){
  const d = activeDoc();
  if(docNameEl) docNameEl.textContent = d ? d.name : '';
  /* Dokumentart hinter dem Chip (D90): dieselben Begriffe wie die
     Menü-Abschnitte — vor allem gegen die Verwechslung „lokale Kopie statt
     geteiltem Dokument" (der D89-Vorfall). Bei Server-Dokumenten mit Host,
     wie in der Menüzeile. */
  const kindEl = document.getElementById('docKindLabel');
  if(kindEl){
    if(d){
      const art = docKind(d.id, SHIPPED_IDS);
      const label = {shipped: 'docGroupShipped', own: 'docGroupOwn',
                     server: 'docGroupSources', url: 'docGroupSources'}[art];
      const host = serverHostOf(d.id);
      kindEl.textContent = t(label) + (host ? ' · ' + host : '');
    } else kindEl.textContent = '';
  }
  /* Aus einer URL geladene Dokumente (D23): die vollständige Quelle in den
     Tooltip, da der Name in der Titelzeile mit Ellipse abgeschnitten wird.
     Muss nach applyLang erneut laufen — das setzt data-i18n-title zurück. */
  if(docTrigger && d){
    docTrigger.title = d.source
      ? d.source + '\n' + t('docSwitchTooltip')
      : t('docSwitchTooltip');
  }
  updateDocButtons();   /* die Stand-Knöpfe der Titelzeile folgen mit (D81) */
}
let renamingId = null;   /* id des gerade inline umbenannten Dokuments (oder null) */
/* Kam das Umbenennen von einem frisch angelegten Dokument? Dann geht es danach
   im Textfeld weiter — Anlegen heißt schreiben wollen (D51). */
let renameIsNew = false;
/* Host eines Server-Dokuments (`live:<url>`), sonst null. */
function serverHostOf(id){
  const roh = String(id || '');
  if(!roh.startsWith('live:')) return null;
  try{ return new URL(roh.slice(5)).host; }catch(_){ return null; }
}
/* Kleine Zeilen-Icons (Feather-Stil wie überall): Stift, Papierkorb, Tür mit
   Pfeil (Verlassen). Als Konstanten, damit der Renderer lesbar bleibt. */
const IC_RENAME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
const IC_DELETE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
const IC_LEAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>';
/* Eine Menüzeile: Wählen-Knopf + Zeilen-Aktionen als GESCHWISTER — ein Knopf
   im Knopf wäre ungültiges HTML. Die Aktionen sind immer sichtbar (Touch
   kennt kein Hover): Löschen überall, Umbenennen nur bei NICHT
   mitgelieferten Dokumenten (D81-Nachtrag 3) — der Name gehört dort zum
   Auslieferungsstand, und ein umbenanntes, aber unverändertes Beispiel
   bekäme weiter still neue Fassungen nachgezogen (das Nachziehen hängt an id
   und Text-Fingerabdruck, D27). Wiederherstellen gibt es hier ebenfalls
   NICHT (D81-Nachtrag 2): Es wirkt über den Neu-laden-Knopf der
   Editor-Titelzeile nur auf das geöffnete Dokument — ein ungeöffnetes
   zurückzusetzen, ohne zu sehen, was man verwirft, ergäbe keinen Sinn. */
function docRowHtml(d){
  if(d.id === renamingId){
    /* Inline-Umbenennen direkt im Menü (kein window.prompt — das ist in
       manchen Browser-Kontexten unterdrückt). Wert/Handler unten in JS. */
    return `<div class="docitem editing"><span class="doccheck" aria-hidden="true"></span>` +
           `<input type="text" class="docrename"></div>`;
  }
  /* Bei einem Server-Dokument steht der Host daneben. Ein hochgeladenes
     Dokument trägt denselben Namen wie das lokale, aus dem es entstand —
     ohne den Zusatz stünden zwei gleiche Einträge da, und nur der Tooltip
     verriete den Unterschied. */
  const host = serverHostOf(d.id);
  const zusatz = host ? `<span class="docitem-where">${esc(host)}</span>` : '';
  const iconBtn = (act, label, svg, extra) =>
    `<button type="button" class="dociconbtn${extra || ''}" data-act="${act}" ` +
    `title="${esc(label)}" aria-label="${esc(label)}">${svg}</button>`;
  return `<div class="docitem" data-id="${esc(d.id)}">` +
    `<button type="button" class="docpick" role="menuitemradio" ` +
    `aria-checked="${d.id === activeId ? 'true' : 'false'}" title="${esc(d.source || '')}">` +
    `<span class="doccheck" aria-hidden="true">✓</span>` +
    `<span class="docitem-name">${esc(d.name)}</span>${zusatz}</button>` +
    `<span class="docacts">` +
    /* Umbenennen: bei Mitgelieferten nicht (der Name ist Auslieferungsstand,
       D81-Nachtrag 3), bei URL-Dokumenten nicht (der Name IST die URL, D23 —
       ein lokaler Name würde beim nächsten Laden überschrieben, D85). Bei
       Server-Dokumenten wirkt es über PATCH /title für ALLE (D85). */
    (['shipped', 'url'].includes(docKind(d.id, SHIPPED_IDS))
      ? '' : iconBtn('rename', t('docRename'), IC_RENAME)) +
    /* Geteilte (Server- wie URL-Dokumente) werden VERLASSEN, nicht gelöscht
       (D81-Nachtrag 5): Die Aktion tut lokal dasselbe, ist für den Benutzer
       aber eine andere — dem Dokument selbst geschieht nichts, man gibt nur
       seinen Listeneintrag auf. Eigenes Wort, eigenes Icon (Tür mit Pfeil),
       eigene Rückfrage — und bewusst NICHT die rote Gefahr-Färbung. */
    (['server', 'url'].includes(docKind(d.id, SHIPPED_IDS))
      ? iconBtn('leave', t('docLeave'), IC_LEAVE)
      : iconBtn('delete', t('docDelete'), IC_DELETE, ' docdelbtn')) +
    `</span></div>`;
}
function renderDocMenu(){
  /* Gruppen nach Dokumentart (D81): mitgeliefert · eigene · Quellen (Server
     und URL). Leere Gruppen erscheinen nicht; die Reihenfolge ist fest. */
  const GRUPPEN = [
    {kinds: ['shipped'],       label: t('docGroupShipped')},
    {kinds: ['own'],           label: t('docGroupOwn')},
    {kinds: ['server', 'url'], label: t('docGroupSources')},
  ];
  docList.innerHTML = GRUPPEN.map(g => {
    const liste = docs.filter(d => g.kinds.includes(docKind(d.id, SHIPPED_IDS)));
    if(!liste.length) return '';
    return `<div class="docsec" aria-hidden="true">${esc(g.label)}</div>` +
           liste.map(docRowHtml).join('');
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
const SHIPPED_IDS = [EXAMPLE_ID, WERKBAUM_ID];   /* für docKind (Menü-Gruppen, D81) */
/* Die Stand-Knöpfe der Editor-Titelzeile folgen dem aktiven Dokument (D81):
   „Teilen" entfällt, wo es schon auf einem Server liegt (sonst entstünde ein
   zweites, gleichnamiges Dokument dort — erkennbar an der id `live:…`, nicht
   am laufenden liveState). „Neu laden" erscheint nur, wo es eine Quelle gibt:
   mitgeliefert (Original wiederherstellen), URL oder gemerkte Datei. Der
   Speichern-Tooltip nennt die Zieldatei des gemerkten Handles (D72, Stufe 2)
   — Dateinamen sind Daten, kein i18n. */
function updateDocButtons(){
  const d = activeDoc();
  const teilen = document.getElementById('shareBtn');
  if(teilen) teilen.hidden = !d || String(d.id).startsWith('live:');
  const neu = document.getElementById('reloadBtn');
  if(neu){
    const shipped = d && shippedStateOf(d.id);
    if(shipped){
      neu.hidden = false;
      neu.disabled = d.text === shipped.text && d.name === shipped.name;
      neu.title = t('docRestore');
      neu.setAttribute('aria-label', t('docRestore'));
    /* NICHT für Server-Dokumente: adoptLive() setzt zwar `source`, aber dort
       hält der Feed den Stand aktuell — und ein fetchRemote auf die
       Dokument-Adresse lüde die JSON-Antwort der API als Text (D84). */
    } else if(d && !String(d.id).startsWith('live:')
              && (d.source || fileHandles.has(d.id))){
      neu.hidden = false; neu.disabled = false;
      neu.title = t('docReload');
      neu.setAttribute('aria-label', t('docReload'));
    } else {
      neu.hidden = true;
    }
  }
  const speichern = document.getElementById('saveBtn');
  if(speichern && d){
    const h = fileHandles.get(d.id);
    speichern.title = t('docSaveFile') + (h ? '\n' + h.name : '');
  }
}
/* Original wiederherstellen — erreichbar über den Neu-laden-Knopf der
   Editor-Titelzeile und damit nur für das GEÖFFNETE mitgelieferte Dokument
   (D81-Nachtrag 2): Ein ungeöffnetes zurückzusetzen, ohne zu sehen, was man
   verwirft, ergäbe keinen Sinn. */
function restoreDoc(id){
  const d = docs.find(x => x.id === id);
  const shipped = d && shippedStateOf(d.id);
  if(!shipped || d.id !== activeId) return;
  if(!window.confirm(t('docRestoreConfirm', {name: d.name}))) return;
  d.text = shipped.text;
  d.name = shipped.name;
  foldOverrides.clear();
  loadActiveIntoEditor();
  persistDocs();
  if(!docMenu.hidden) renderDocMenu();   /* der Name kann sich zurückgeändert haben */
}
/* Aus der Quelle neu laden (D81): mitgeliefert → Original wiederherstellen;
   URL-Dokument → frisch holen (die URL ist die Quelle der Wahrheit, D23);
   Datei mit gemerktem Handle → neu aus der Datei lesen (Chromium). Scheitert
   das Datei-Lesen (Berechtigung verweigert, Datei weg), bleibt der Stand
   stehen — der verweigerte Dialog IST die Antwort. */
async function reloadDoc(){
  const d = activeDoc();
  if(!d || String(d.id).startsWith('live:')) return;   /* Server-Dokumente hält der Feed aktuell (D84) */
  if(shippedStateOf(d.id)){ restoreDoc(d.id); return; }
  if(d.source){
    /* KEINE Rückfrage (D84): Die URL ist die Quelle der Wahrheit (D23) —
       jedes Neuladen der Seite verwirft lokale Änderungen ohnehin still.
       Eine Rückfrage nur am Knopf versprach einen Schutz, den es nicht gibt. */
    try{
      d.text = await fetchRemote(d.source);
      sourceWarning = null;
      loadActiveIntoEditor();
      persistDocs();
    }catch(err){
      sourceWarning = {type:'sourceLoad', url: d.source, error: (err && err.message) || String(err)};
      render();
    }
    return;
  }
  const h = fileHandles.get(d.id);
  if(!h) return;
  if(!window.confirm(t('docReloadConfirm', {name: d.name}))) return;
  try{
    let perm = await h.queryPermission({mode: 'read'});
    if(perm === 'prompt') perm = await h.requestPermission({mode: 'read'});
    if(perm !== 'granted') return;
    d.text = await (await h.getFile()).text();
    loadActiveIntoEditor();
    persistDocs();
  }catch(_){}
}
function openDocMenu(){
  renderDocMenu();
  docMenu.hidden = false; docTrigger.setAttribute('aria-expanded', 'true');
}
function closeDocMenu(){ renamingId = null; renameIsNew = false; docMenu.hidden = true; docTrigger.setAttribute('aria-expanded', 'false'); }
function toggleDocMenu(){ docMenu.hidden ? openDocMenu() : closeDocMenu(); }
/* Beim Wechseln/Anlegen/Löschen zuerst den aktuellen Editortext ins aktive
   Dokument sichern, dann das Ziel laden und neu rendern. */
function flushActive(){ const d = activeDoc(); if(d) d.text = src.value; }

/* ---------- Frühere Stände (Snapshots, D54) ----------
   Alle zehn Minuten wird der Text des aktiven Dokuments weggelegt — aber nur,
   wenn er sich seit dem letzten Stand geändert hat. Aufgehoben werden die
   letzten 20 je Dokument (rund 3½ Stunden Arbeit bei gleichmäßigen Abständen).
   Es ist ein Sicherheitsnetz gegen Versehen, kein Versionsverwaltungssystem —
   wer weiter zurück will, hat Git.

   Die Regeln stehen in snapshots.js und sind dort getestet; hier bleibt nur,
   was DOM oder Speicher berührt: welches Dokument aktiv ist und das
   Nachzeichnen des Menüs. */
let snaps = {};        /* {docId: [{t, text}, …]} — ältester zuerst */
let snapBase = '';     /* Text bei Dokumentwechsel; Vergleich, solange es keinen Stand gibt */

function loadSnaps(){ snaps = parseSnaps(localStorage.getItem(LS_SNAPS)); }

function snapshotNow(manuell){
  const d = activeDoc();
  if(!d) return false;
  /* Auch für Server-Dokumente (D89, kehrt D86 teilweise um): Die Historie
     führt weiterhin der Server, aber die lokalen Stände sind das
     Sicherheitsnetz für alles, was ihn NICHT erreicht — genau der Verlust,
     den D86 möglich gemacht hat. Im Uhr-Menü stehen sie als eigener
     Abschnitt „Lokale Sicherungen" unter den Server-Meilensteinen. */
  const text = src.value;
  if(!addSnapshot(snaps, d.id, text, Date.now(), {base: snapBase, manual: manuell})) return false;
  snapBase = text;
  persistSnaps(snaps, localStorage);
  if(!snapMenu.hidden) renderSnapMenu();
  return true;
}
/* `() => snapshotNow()`, nicht `snapshotNow` direkt: Ein durchgereichtes
   Argument wäre wahr und hebelte die `snapBase`-Sperre des Takts aus —
   dieselbe Falle wie bei `setAppHeight` (D17-Nachtrag 4). */
setInterval(() => snapshotNow(), SNAP_EVERY);

const snapBtn = document.getElementById('snapBtn');
const snapAddBtn = document.getElementById('snapAddBtn');
const snapMenu = document.getElementById('snapMenu');

function renderSnapMenu(){
  if(liveActive()){ renderServerHistory(); return; }
  const d = activeDoc();
  const list = d ? (snaps[d.id] || []) : [];
  snapMenu.innerHTML = '';
  if(!list.length){
    const p = document.createElement('div');
    p.className = 'snapempty';
    p.textContent = t('snapNone');
    snapMenu.appendChild(p);
    return;
  }
  /* Neueste zuoberst — danach sucht man zuerst. */
  list.slice().reverse().forEach(s => snapMenu.appendChild(snapItemBtn(s)));
}
function snapItemBtn(s){
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'snapitem';
  b.setAttribute('role', 'menuitem');
  b.innerHTML = '<span></span><span class="snapsize"></span>';
  b.firstChild.textContent = snapLabel(s.t, lang, Date.now());
  b.lastChild.textContent = t('snapLines', {n: s.text.split('\n').length});
  b.addEventListener('click', e => { e.stopPropagation(); loadSnapshot(s); });
  return b;
}
/* Lokale Sicherungen unter den Server-Meilensteinen (D89): das, was der
   Server NICHT hat — Rettungs-Stände und der 10-Minuten-Takt. Sichtbar
   beschriftet, damit klar bleibt, dass sie nur dieses Fenster kennt. */
function appendLocalSnaps(){
  const d = activeDoc();
  const list = d ? (snaps[d.id] || []) : [];
  if(!list.length) return;
  const h = document.createElement('div');
  h.className = 'snaphead';
  h.textContent = t('snapLocalHead');
  snapMenu.appendChild(h);
  list.slice().reverse().forEach(s => snapMenu.appendChild(snapItemBtn(s)));
}
/* Zurückgeholt wird **undo-fähig** (D53): Ein Griff daneben kostet ein Strg+Z,
   keine Rückfrage. Der aktuelle Stand wird vorher weggelegt, falls er noch
   nicht drin ist — sonst wäre er das Einzige, was der Griff verlöre. */
function loadSnapshot(s){
  snapshotNow(true);   /* bewusstes Wegleg-Ereignis wie der Knopf, nicht der Takt */
  closeSnapMenu();
  if(!replaceTextUndoable(s.text)) render();
  snapBase = src.value;
}
function openSnapMenu(){
  renderSnapMenu();
  snapMenu.hidden = false;
  snapBtn.setAttribute('aria-expanded', 'true');
}
function closeSnapMenu(){
  snapMenu.hidden = true;
  snapBtn.setAttribute('aria-expanded', 'false');
}
/* Frühere Stände eines GETEILTEN Dokuments: die Meilenstein-Historie des
   Servers (D76 sah das vor, D86 baut es). Gezeigt werden die Stände VOR dem
   aktuellen — „Frühere Stände" eben; das „geändert von" ist der
   selbstgewählte Anzeigename und damit eine Behauptung, kein Nachweis. */
async function renderServerHistory(){
  const sitzung = liveState;
  snapMenu.innerHTML = '';
  const lade = document.createElement('div');
  lade.className = 'snapempty';
  lade.textContent = '…';
  snapMenu.appendChild(lade);
  let eintraege;
  try{ eintraege = await fetchJson(sitzung.urls.doc + '/history'); }
  catch(err){
    lade.textContent = (err && err.message) || String(err);
    appendLocalSnaps();   /* gerade wenn der Server nicht antwortet, zählen die lokalen (D89) */
    return;
  }
  if(liveState !== sitzung || snapMenu.hidden) return;   /* inzwischen zu oder umgeschaltet */
  snapMenu.innerHTML = '';
  const max = Math.max(0, ...eintraege.map(x => x.version));
  const fruehere = eintraege.filter(x => x.version !== max).reverse();   /* neueste zuoberst */
  if(!fruehere.length){
    const p = document.createElement('div');
    p.className = 'snapempty';
    p.textContent = t('snapNoneLive');
    snapMenu.appendChild(p);
    appendLocalSnaps();
    return;
  }
  fruehere.forEach(x => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'snapitem';
    b.setAttribute('role', 'menuitem');
    b.innerHTML = '<span></span><span class="snapsize"></span>';
    b.firstChild.textContent = snapLabel(Date.parse(x.timestamp), lang, Date.now());
    b.lastChild.textContent = x.displayName || '';
    b.addEventListener('click', e => { e.stopPropagation(); rollbackToVersion(x); });
    snapMenu.appendChild(b);
  });
  appendLocalSnaps();
}
/* Rücksprung als SERVER-Rollback (ROLLED_BACK, D76/D86): Er geschieht für
   alle nachvollziehbar auf dem Server — als neue Version, nichts geht
   verloren — statt als riesiges eigenes Diff dieses Clients. Deshalb mit
   Rückfrage: Er trifft alle Mitschreiber. */
async function rollbackToVersion(eintrag){
  const sitzung = liveState;
  closeSnapMenu();
  const wann = snapLabel(Date.parse(eintrag.timestamp), lang, Date.now());
  if(!window.confirm(t('snapRollbackConfirm', {when: wann}))) return;
  try{
    const doc = await fetchJson(sitzung.urls.doc + '/restore', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({version: eintrag.version}),
    });
    if(liveState === sitzung) adoptLive(doc);
  }catch(err){
    sourceWarning = {type: 'liveLoad', url: sitzung.urls.doc + '/restore',
                     error: (err && err.message) || String(err)};
    render();
  }
}
snapBtn.addEventListener('click', e => {
  e.stopPropagation();
  snapMenu.hidden ? openSnapMenu() : closeSnapMenu();
});
/* Von Hand sichern — der Fall „gleich ändere ich viel“, für den zehn Minuten
   zu lang sind. Die Rückmeldung kommt **immer**, auch wenn `snapshotNow()`
   nichts angelegt hat: Der Knopf verspricht „dein Stand ist gesichert“, nicht
   „ein Eintrag wurde erzeugt“ — bei unverändertem Text steht er schon oben in
   der Liste. Einen doppelten Eintrag zu erzwingen kostete nur einen der 20
   Plätze (D54-Nachtrag). Ein offenes Menü bleibt offen und zeichnet neu, dort
   sieht man den neuen Eintrag entstehen. */
snapAddBtn.addEventListener('click', async e => {
  e.stopPropagation();
  if(liveActive()){
    /* Geteilt: als SERVER-Meilenstein (D86) — eine lokale Momentaufnahme
       wäre dort irreführend, sie enthielte fremde Änderungen (D76). Ein
       wartendes Debounce-Diff geht dabei gleich mit. */
    if(liveState.pushTimer){ clearTimeout(liveState.pushTimer); liveState.pushTimer = null; }
    await pushLive(true);
  } else {
    snapshotNow(true);
  }
  flashBtn(snapAddBtn);
});
document.addEventListener('click', e => {
  if(!snapMenu.hidden && !snapMenu.contains(e.target) && !snapBtn.contains(e.target)) closeSnapMenu();
});

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
/* ---------- Neuigkeiten (D58) ----------
   Der Stern aus dem Diagramm-Kopf steht jetzt permanent in der Kopfzeile und
   trägt zwei Aussagen, die zusammengehören: die **Chronik** aus der
   git-Historie (`NEWS`, zur Bauzeit eingelesen) und den persönlichen
   Besuchsvergleich des aktiven Dokuments (D28). Bernstein heißt „ungesehen" —
   für beides. */
const LS_NEWS_SEEN = 'werkbaum-news-seen';
const newsBtn = document.getElementById('newsBtn');
const newsMenu = document.getElementById('newsMenu');
const freshCount = document.getElementById('freshCount');

function newsSeenDate(){
  try{ return localStorage.getItem(LS_NEWS_SEEN) || ''; }catch(_){ return ''; }
}
function unseenDays(){
  const seen = newsSeenDate();
  return NEWS.filter(e => e.date > seen).length;
}
/* Datum in der Sprache der Oberfläche. `T00:00` ist Pflicht: Ein blankes
   `new Date('2026-08-24')` liest der Browser als UTC-Mitternacht und zeigt
   westlich davon den Vortag. */
function newsDateLabel(iso){
  const d = new Date(iso + 'T00:00');
  try{ return d.toLocaleDateString(lang, {day: 'numeric', month: 'long', year: 'numeric'}); }
  catch(_){ return iso; }
}
/* Welche Schlüssel gibt es im mitgelieferten Plan überhaupt noch? Ein Label
   kann seit damals umbenannt worden sein — dann trifft sein Schlüssel nichts
   mehr, und der Link verspräche etwas, das er nicht halten kann. Einmal je
   Aufklappen, nicht einmal je Tag: Der Plan hat 900 Zeilen. */
function planKeySet(){
  const doc = docs.find(d => d.id === WERKBAUM_ID);
  return doc ? new Set(nodeKeys(parse(doc.text).roots).values()) : new Set();
}

function updateFreshBtn(){
  if(!newsBtn) return;
  const n = (!newsKeySet && freshDocId === activeId) ? freshSet.size : 0;
  const offen = unseenDays();
  freshCount.hidden = !n;
  if(n) freshCount.textContent = String(n);
  newsBtn.classList.toggle('unseen', !!(n || offen));
  newsBtn.classList.toggle('active', !!newsDay);
  const tip = newsDay ? t('newsShowing', {d: newsDateLabel(newsDay)})
    : n ? t('freshTooltip', {n: n})
    : offen ? t('newsUnseen', {n: offen})
    : t('newsTooltip');
  newsBtn.title = tip;
  newsBtn.setAttribute('aria-label', tip);
}

function renderNewsMenu(){
  /* Die Notizen sind englisch (D58) — wer die Oberfläche auf Japanisch stehen
     hat, soll wissen, dass das Absicht ist und kein Fehler. Nicht für
     englische Oberflächen: Dort wäre es eine Auskunft über nichts. Und optisch
     zurückgenommen — es ist eine Fußnote zum Inhalt, nicht der Inhalt. */
  const hinweis = (lang !== 'en' && NEWS.length)
    ? `<div class="newsnote">${esc(t('newsEnglish'))}</div>` : '';
  const seit = (!newsKeySet && freshDocId === activeId && freshSet.size)
    ? `<div class="newssince"><span>${esc(t('newsSince', {n: freshSet.size}))}</span>`
      + `<button type="button" class="newsseen" id="newsSeenBtn">${esc(t('newsSeen'))}</button></div>`
    : '';
  const vorhanden = NEWS.some(e => e.keys.length) ? planKeySet() : new Set();
  const tage = NEWS.map(e => {
    const treffer = e.keys.filter(k => vorhanden.has(k)).length;
    const an = newsDay === e.date;
    /* `\`#auth\`` im Changelog wird zu einem Code-Stück — die Notizen nennen
       Notation, und nackte Backticks läsen sich wie ein Tippfehler. Ersetzt
       wird NACH dem Escapen, damit der Weg zu eigenem Markup verschlossen
       bleibt: Was hier eintrifft, ist bereits harmloser Text. */
    const notiz = l => esc(l).replace(/`([^`]+)`/g, '<code>$1</code>');
    const lines = e.lines.length
      ? `<ul class="newslines">${e.lines.map(l => `<li>${notiz(l)}</li>`).join('')}</ul>` : '';
    const knopf = treffer
      ? `<button type="button" class="newsshow" data-news-day="${esc(e.date)}"`
        + ` aria-pressed="${an ? 'true' : 'false'}">`
        + `${esc(an ? t('newsShowOff') : t('newsShow', {n: treffer}))}</button>` : '';
    return `<div class="newsday"><div class="newsdate">${esc(newsDateLabel(e.date))}</div>`
      + lines + knopf + '</div>';
  }).join('');
  newsMenu.innerHTML = `<div class="newshead"><span>${esc(t('newsTitle'))}</span>`
    + `<button type="button" class="newsclose" id="newsCloseBtn"`
    + ` title="${esc(t('tipClose'))}" aria-label="${esc(t('tipClose'))}">×</button></div>`
    + hinweis + seit + (tage || `<div class="newsempty">${esc(t('newsEmpty'))}</div>`);
}
function openNewsMenu(){
  renderNewsMenu();
  newsMenu.hidden = false;
  newsBtn.setAttribute('aria-expanded', 'true');
  /* Aufgeschlagen heißt gelesen: Der Deckel wandert auf den neuesten Tag der
     Liste, nicht auf „heute" — sonst hinge er an der Uhr des Betrachters. */
  if(NEWS.length){ try{ localStorage.setItem(LS_NEWS_SEEN, NEWS[0].date); }catch(_){} }
  updateFreshBtn();
}
function closeNewsMenu(){
  if(!newsMenu || newsMenu.hidden) return;
  newsMenu.hidden = true;
  newsBtn.setAttribute('aria-expanded', 'false');
}
/* Einen Tag im Diagramm vorführen. Die Schlüssel sind Label-Pfade des
   MITGELIEFERTEN Plans — steht ein anderes Dokument vorn, wird gewechselt;
   ohne das zeigte die Ansicht auf nichts. */
function showNewsDay(date){
  const e = NEWS.find(x => x.date === date);
  if(!e) return;
  /* Erst wechseln, dann setzen: `switchDoc()` räumt einen vorgeführten Tag
     ausdrücklich weg — in der anderen Reihenfolge löschte es gerade den, den
     wir zeigen wollen. */
  if(activeId !== WERKBAUM_ID && docs.some(d => d.id === WERKBAUM_ID)) switchDoc(WERKBAUM_ID);
  newsDay = date;
  newsKeySet = new Set(e.keys);
  render();
  closeNewsMenu();
  const erster = out.querySelector('.node.fresh');
  if(erster) erster.scrollIntoView({block: 'center', inline: 'center'});
}
function clearNewsDay(){
  if(!newsDay) return;
  newsDay = null; newsKeySet = null;
  render();
}
newsBtn.addEventListener('click', () => {
  if(newsMenu.hidden) openNewsMenu(); else closeNewsMenu();
});
newsMenu.addEventListener('click', e => {
  const tag = e.target.closest('[data-news-day]');
  if(tag){ const d = tag.getAttribute('data-news-day');
    if(newsDay === d){ clearNewsDay(); renderNewsMenu(); } else showNewsDay(d);
    return; }
  if(e.target.closest('#newsSeenBtn')){ acknowledgeFresh(); renderNewsMenu(); return; }
  if(e.target.closest('#newsCloseBtn')) closeNewsMenu();
});
document.addEventListener('pointerdown', e => {
  if(!newsMenu || newsMenu.hidden) return;
  if(!e.target.closest('#newsMenu') && !e.target.closest('#newsBtn')) closeNewsMenu();
});

function loadActiveIntoEditor(){ const d = activeDoc(); src.value = d ? d.text : '';
  clearLens();   /* die Personen-Linse (D87) gilt je Dokument-Sitzung */
  /* Vergleichsstand für den nächsten Snapshot (D54): Ohne ihn legte der
     erste Takt nach dem Öffnen auch ein unverändertes Dokument weg. */
  snapBase = src.value; closeSnapMenu();
  render(); updateDocName(); updateFreshBtn();
  /* Ein Dokumentwechsel ist mehr als neuer Text im Feld: Adresszeile und
     Live-Sitzung gehören dem, was man vor sich hat (D80). Hier, weil jeder
     Weg zu einem anderen aktiven Dokument durch diese eine Stelle führt —
     Umschalten, Anlegen, Löschen, Datei öffnen, Server-Dokument laden. */
  followActiveDoc(); }

/* Die Adresszeile beschreibt das aktive Dokument (D80). Geschrieben wird nur,
   wenn sich wirklich etwas ändert — sonst stünde in der Historie des Browsers
   bei jedem Rendern ein Eintrag mehr. */
function syncDocUrl(){
  let u;
  try{ u = new URL(location.href); }catch(_){ return; }
  const neu = docSearch(u.search, activeId);
  if(neu === u.search) return;
  try{ history.replaceState(null, '', u.origin + u.pathname + neu + u.hash); }catch(_){}
}

/* Die Live-Sitzung gehört dem sichtbaren Dokument (D80). Ohne das liefe der
   Feed eines Server-Dokuments weiter, während ein anderes vorn steht — und
   `setLiveText()` schriebe die fremde Änderung in **dessen** Text. */
function followActiveDoc(){
  if(!bootDone) return;
  syncDocUrl();
  if(liveState && liveState.id !== activeId) stopLive();
  const d = activeDoc();
  if(!liveState && d && String(d.id).startsWith('live:')) startLive(d.id.slice(5));
}

function switchDoc(id){
  if(id === activeId) return;
  /* Was noch im Debounce steckt, ist getippt und gemeint: erst loswerden,
     solange das Textfeld noch den Text dieses Dokuments zeigt (D80). */
  if(liveActive() && liveState.pushTimer){
    clearTimeout(liveState.pushTimer);
    liveState.pushTimer = null;
    pushLive();          /* liest src.value synchron; das Ergebnis braucht niemand mehr */
  }
  flushActive();
  activeId = id;
  foldOverrides.clear();   /* Falt-Eingriffe gelten je Dokument-Sitzung (D38) */
  /* Ein vorgeführter Neuigkeiten-Tag (D58) gehört dem mitgelieferten Plan —
     in einem anderen Dokument zeigten seine Schlüssel ins Leere. Kein
     `clearNewsDay()`: `loadActiveIntoEditor()` zeichnet gleich selbst. */
  newsDay = null; newsKeySet = null;
  loadActiveIntoEditor();
  persistDocs();
}
/* Ein neues Dokument beginnt mit seinem Namen (D51): Statt es unter „Neues
   Dokument" abzulegen und den Cursor ins leere Textfeld zu setzen, öffnet sich
   sofort das Inline-Umbenennen mit **ausgewähltem** Vorschlag — tippen ersetzt
   ihn, Enter bestätigt. Wer nichts eingibt, behält den Vorschlag; das Dokument
   ist bereits angelegt, ein Abbruch verwirft es nicht. */
function newDoc(){
  flushActive();
  const d = { id: uid(), name: uniqueName(t('docNewName')), text: '' };
  docs.push(d);
  activeId = d.id;
  foldOverrides.clear();
  loadActiveIntoEditor();
  persistDocs();
  keyboardOnJump(false);   /* neues, leeres Dokument = tippen ist gemeint */
  renamingId = d.id;
  renameIsNew = true;
  renderDocMenu();         /* setzt den Fokus ins Eingabefeld und markiert es */
}
/* Nach dem Benennen eines frisch angelegten Dokuments geht es im Textfeld
   weiter — die zweite Hälfte derselben Geste. Gilt auch für Esc: Der Vorschlag
   bleibt dann stehen, das Dokument existiert ohnehin. */
function finishNewDoc(){
  if(!renameIsNew) return;
  renameIsNew = false;
  closeDocMenu();
  src.focus();
}
function renameDoc(id){
  if(!docs.some(x => x.id === id)) return;
  /* Mitgelieferte nicht (D81-Nachtrag 3) und URL-Dokumente nicht (D85) —
     die Prüfung liegt hier, nicht nur am ausgeblendeten Stift. */
  if(['shipped', 'url'].includes(docKind(id, SHIPPED_IDS))) return;
  renamingId = id;   /* Zeilen-Aktion (D81): jedes Dokument, nicht nur das aktive */
  renameIsNew = false;
  renderDocMenu();
}
function commitRename(){
  if(!renamingId) return;
  const inp = docList.querySelector('.docrename');
  const d = docs.find(x => x.id === renamingId);
  const val = inp ? inp.value.trim() : '';
  renamingId = null;
  if(d && val){
    /* Server-Dokumente: Der Titel gehört dem Server — alle sehen denselben
       (D76). Der Weg dorthin ist PATCH /title (D85), nicht der lokale Name. */
    if(String(d.id).startsWith('live:')) renameOnServer(d, val);
    else { d.name = val; persistDocs(); updateDocName(); }
  }
  renderDocMenu();
  finishNewDoc();
}
function cancelRename(){ renamingId = null; renderDocMenu(); finishNewDoc(); }
/* Umbenennen eines Server-Dokuments (D85): optimistisch sofort anzeigen;
   scheitert der PATCH, kommt der alte Name zurück und die Warnung sagt
   warum. Bei 409 — jemand war zwischen Abruf und PATCH schneller — einmal
   mit frischer Version erneut. Die Version bumpt ohne Inhaltsänderung, die
   Schattenkopie bleibt also gültig; die übrigen Mitschreiber bekommen die
   Umbenennung als RENAMED-Ereignis über ihren Feed. */
async function renameOnServer(d, titel){
  const url = String(d.id).slice(5);
  const alt = d.name;
  const zeige = () => { persistDocs(); updateDocName(); if(!docMenu.hidden) renderDocMenu(); };
  d.name = titel; zeige();
  const patch = async () => {
    const doc = await fetchJson(url);
    return fetchJson(url + '/title', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({title: titel, expectedVersion: doc.version}),
    });
  };
  try{
    let neu;
    try{ neu = await patch(); }
    catch(err){ if(err && err.status === 409) neu = await patch(); else throw err; }
    d.name = neu.title;
    if(liveState && liveState.id === d.id) liveState.version = neu.version;
    zeige();
  }catch(err){
    d.name = alt;
    sourceWarning = {type: 'liveLoad', url: url + '/title',
                     error: (err && err.message) || String(err)};
    zeige();
    render();
  }
}
/* Der gemeinsame Kern von Löschen und Verlassen: den Eintrag samt lokaler
   Anhängsel entfernen. Die beiden Aktionen unterscheiden sich für den
   Benutzer (Wort, Icon, Rückfrage — D81-Nachtrag 5), lokal tun sie dasselbe. */
function removeDocLocally(d){
  if(liveState && liveState.id === d.id) stopLive();  /* dito fürs Server-Dokument (D76) */
  if(fileHandles.has(d.id)){ fileHandles.delete(d.id); idbDeleteHandle(d.id); }   /* mit dem Dokument geht sein Datei-Handle (D72) */
  docs = docs.filter(x => x.id !== d.id);
  if(snaps[d.id]){ delete snaps[d.id]; persistSnaps(snaps, localStorage); }   /* mit dem Dokument gehen seine Stände (D54) */
  if(!docs.length) docs = [{ id: EXAMPLE_ID, name: EXAMPLE_NAME, text: INITIAL }];
  /* Zeilen-Aktion (D81): Nur wenn das AKTIVE Dokument geht, wechselt der
     Editor; das Menü bleibt offen — wer aufräumt, räumt meist weiter. */
  if(d.id === activeId){
    activeId = docs[0].id;
    foldOverrides.clear();
    loadActiveIntoEditor();
  }
  persistDocs();
  if(!docMenu.hidden) renderDocMenu();
}
function deleteDoc(id){
  const d = docs.find(x => x.id === id);
  if(!d) return;
  /* Beim LETZTEN Dokument sagt die Rückfrage, was danach dasteht (D84):
     Der Editor steht nie leer, es entsteht ein frisches Beispiel — vorher
     hieß es nur „löschen?", und dann erschien still etwas Neues. */
  const letztes = docs.length === 1;
  if(!window.confirm(t(letztes ? 'docDeleteLastConfirm' : 'docDeleteConfirm', {name: d.name}))) return;
  removeDocLocally(d);
}
/* Verlassen (D81-Nachtrag 5): für Geteilte — dem Dokument auf dem Server
   bzw. hinter der URL geschieht NICHTS, nur der eigene Listeneintrag geht.
   Der Eintrag ist zugleich das Lesezeichen: Der Link wandert deshalb in die
   Zwischenablage (die Rückfrage sagt es an) — wer ihn nirgends sonst hat,
   verlöre sonst den Rückweg. */
async function leaveDoc(id){
  const d = docs.find(x => x.id === id);
  if(!d || !['server', 'url'].includes(docKind(d.id, SHIPPED_IDS))) return;
  if(!window.confirm(t('docLeaveConfirm', {name: d.name}))) return;
  const link = location.origin + location.pathname + docSearch('', d.id);
  try{ await navigator.clipboard.writeText(link); }catch(_){}
  removeDocLocally(d);
}
/* ---------- Lokale Dateien öffnen und speichern (D72, Stufe 1) ----------
   Der klassische Weg, der in jedem Browser läuft: Datei-Input zum Öffnen,
   Blob-Download zum Speichern. Geöffnet wird als NEUES Dokument (D22) — eine
   Identität „gleicher Dateiname = gleiches Dokument" wäre eine Vermutung, und
   zwei verschiedene Dateien gleichen Namens überschrieben sich still. Der
   Dateiname wird der Dokumentname; beim Speichern entsteht er daraus zurück
   (saveFileName, localfile.js). */
const fileOpenInput = document.createElement('input');
fileOpenInput.type = 'file';
fileOpenInput.accept = FILE_ACCEPT;
fileOpenInput.hidden = true;
document.body.appendChild(fileOpenInput);
fileOpenInput.addEventListener('change', async () => {
  const f = fileOpenInput.files && fileOpenInput.files[0];
  fileOpenInput.value = '';   /* dieselbe Datei soll erneut wählbar sein */
  if(!f) return;
  let text;
  try{ text = await f.text(); }catch(_){ return; }
  adoptFile(null, f.name, text);
});
/* ---------- Stufe 2 (D72-Nachtrag): File System Access API ----------
   Wo die Picker existieren (Chromium), liefert das Öffnen ein
   FileSystemFileHandle: Speichern schreibt in DIESELBE Datei zurück, und
   dieselbe Datei öffnet wieder in dasselbe Dokument (isSameEntry) — die
   Datei-Identität, die Stufe 1 nicht hatte. Firefox/Safari behalten den
   Stufe-1-Weg; die Bedienung ist in beiden Fällen dieselbe. */
const hasFsAccess = typeof window.showOpenFilePicker === 'function';
const fileHandles = new Map();   /* docId → FileSystemFileHandle */
/* Beim Start werden die gemerkten Handles asynchron zurückgeholt; wer die
   Map fürs isSameEntry-Abgleichen braucht (adoptFile), wartet auf dieses
   Promise — sonst legt ein Doppelklick unmittelbar nach dem App-Start ein
   Duplikat an statt dasselbe Dokument zu aktualisieren (D74). */
let handlesReady = Promise.resolve();
/* Handles überleben den Neustart nur in IndexedDB (localStorage kann sie
   nicht halten — sie sind nicht JSON-serialisierbar). Alles hier ist Komfort,
   keine Pflicht: Scheitert IndexedDB, funktioniert Speichern weiter über den
   Dialog — deshalb schlucken die Helfer ihre Fehler. */
const IDB_STORE = 'fileHandles';
function idbOpen(){
  return new Promise((res, rej) => {
    const rq = indexedDB.open('werkbaum', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(IDB_STORE);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
async function idbHandleOp(mode, fn){
  try{
    const db = await idbOpen();
    const out = await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, mode);
      const r = fn(tx.objectStore(IDB_STORE));
      tx.oncomplete = () => res(r);
      tx.onerror = () => rej(tx.error);
    });
    db.close();
    return out;
  }catch(_){ return null; }
}
function idbPutHandle(docId, handle){ return idbHandleOp('readwrite', s => { s.put(handle, docId); }); }
function idbDeleteHandle(docId){ return idbHandleOp('readwrite', s => { s.delete(docId); }); }
/* Beim Start die gemerkten Handles zurückholen — nur für Dokumente, die es
   noch gibt (verwaiste Einträge räumen sich dabei weg), und nur, was sich wie
   ein Handle verhält (defensiv gegen fremden Speicherinhalt). */
async function idbLoadHandles(){
  const pair = await idbHandleOp('readonly', s => [s.getAllKeys(), s.getAll()]);
  if(!pair) return;
  const keys = pair[0].result || [], vals = pair[1].result || [];
  keys.forEach((k, i) => {
    const h = vals[i];
    if(h && typeof h.createWritable === 'function' && docs.some(d => d.id === k)){
      fileHandles.set(k, h);
    } else {
      idbDeleteHandle(k);
    }
  });
}
/* Text übernehmen: dieselbe Datei (Handle-Identität) aktualisiert ihr
   Dokument, sonst entsteht ein neues — dieselbe Zweiteilung wie adoptRemote(). */
async function adoptFile(handle, name, text){
  flushActive();
  let targetId = null;
  if(handle){
    await handlesReady;   /* gemerkte Handles müssen da sein (D74) */
    for(const [id, h] of fileHandles){
      try{ if(await handle.isSameEntry(h) && docs.some(d => d.id === id)){ targetId = id; break; } }
      catch(_){}
    }
  }
  if(targetId){
    docs.find(d => d.id === targetId).text = text;
    activeId = targetId;
  } else {
    const d = { id: uid(), name: uniqueName(name), text };
    docs.push(d);
    activeId = d.id;
  }
  if(handle){ fileHandles.set(activeId, handle); idbPutHandle(activeId, handle); }
  foldOverrides.clear();
  loadActiveIntoEditor();
  persistDocs();
  closeDocMenu();
}
async function openWithPicker(){
  let handle;
  /* id: Chromium merkt sich je Picker-id den zuletzt benutzten Ordner —
     Öffnen und handle-loses Speichern teilen sich eine, damit beide Dialoge
     im Plan-Ordner aufgehen statt in Downloads (D74-Nachtrag). */
  try{ [handle] = await window.showOpenFilePicker({types: FILE_TYPES, id: 'werkbaum-files'}); }
  catch(_){ return; }   /* Abbruch des Dialogs */
  let text;
  try{ text = await (await handle.getFile()).text(); }catch(_){ return; }
  await adoptFile(handle, handle.name, text);
}
/* Einmaliger Hinweis für Browser ohne File System Access (D72-Nachtrag 2):
   Ohne die API wird eine geöffnete Datei als Kopie geladen, und Speichern
   legt eine neue Datei in den Downloads ab — wer das nicht weiß, hält es
   für ein Fehlverhalten der App. Gezeigt beim ersten Öffnen/Speichern,
   nicht beim App-Start: Wer die Datei-Funktionen nie benutzt, braucht ihn
   nie. „Verstanden" merkt sich der localStorage; der Reset räumt ihn mit. */
const LS_FS_NOTICE = 'werkbaum-fs-notice';
function maybeShowFsNotice(){
  if(hasFsAccess) return;
  try{ if(localStorage.getItem(LS_FS_NOTICE)) return; }catch(_){}
  if(document.getElementById('fsNotice')) return;
  const n = document.createElement('div');
  n.id = 'fsNotice';
  n.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#243447;color:#fff;'
    + 'padding:12px 16px;display:flex;align-items:center;justify-content:space-between;'
    + "gap:16px;z-index:1000;font-size:14px;font-family:'IBM Plex Sans',system-ui,sans-serif;";
  const txt = document.createElement('div');
  const main = document.createElement('div');
  main.textContent = t('fsNotice');
  txt.appendChild(main);
  /* Brave ist Chromium OHNE die API (D72-Nachtrag 3) — dort ist sie per
     Flag von Hand einschaltbar. Das sagt nur Brave-Nutzern etwas, also nur
     dort: navigator.brave existiert ausschließlich in Brave. Eine
     brave://-Adresse lässt sich aus einer Seite nicht verlinken (interne
     Schemata sind gesperrt) — sie steht als kopierbarer Code-Text da. */
  if(navigator.brave && typeof navigator.brave.isBrave === 'function'){
    const br = document.createElement('div');
    br.style.marginTop = '5px';
    const code = document.createElement('code');
    code.textContent = 'brave://flags/#file-system-access-api';
    code.style.cssText = "font-family:'IBM Plex Mono',monospace;font-size:12px;"
      + 'background:rgba(255,255,255,.16);padding:1px 6px;border-radius:4px;';
    br.append(document.createTextNode(t('fsNoticeBrave') + ' '), code);
    txt.appendChild(br);
  }
  const btn = document.createElement('button');
  btn.textContent = t('fsNoticeOk');
  btn.style.cssText = 'background:#fff;color:#243447;border:none;padding:4px 10px;'
    + 'border-radius:4px;cursor:pointer;font-weight:500;font-size:12px;flex:0 0 auto;';
  btn.addEventListener('click', () => {
    try{ localStorage.setItem(LS_FS_NOTICE, '1'); }catch(_){}
    n.remove();
  });
  n.append(txt, btn);
  document.body.insertBefore(n, document.body.firstChild);
}
function openLocalFile(){
  maybeShowFsNotice();
  if(hasFsAccess) openWithPicker();
  else fileOpenInput.click();
}
async function writeToHandle(handle, text){
  const w = await handle.createWritable();
  await w.write(text);
  await w.close();
}
/* In das gemerkte Handle zurückschreiben. Nach einem Neustart steht die
   Berechtigung auf 'prompt' — requestPermission fragt einmal nach (der
   Menü-Klick ist die nötige Nutzergeste). false heißt: kein Handle oder
   nicht (mehr) beschreibbar — dann entscheidet der Dialog neu. */
async function saveToKnownFile(d){
  const h = fileHandles.get(d.id);
  if(!h) return false;
  try{
    let perm = await h.queryPermission({mode: 'readwrite'});
    if(perm === 'prompt') perm = await h.requestPermission({mode: 'readwrite'});
    if(perm !== 'granted') return false;
    await writeToHandle(h, d.text);
    return true;
  }catch(_){ return false; }
}
async function saveWithPicker(d){
  /* Der Dialog zeigt auf die ORIGINALDATEI, wenn wir eine kennen (Handle
     vorhanden, aber nicht beschreibbar — etwa nach verweigerter
     Berechtigung): startIn öffnet in ihrem Ordner, suggestedName ist ihr
     exakter Name. Ohne das schlägt Chromium im zuletzt benutzten Ordner
     einen „name (1)"-Nachbarn vor — wer den abbricht, bekommt den Dialog
     bei jedem Strg+S wieder, denn gemerkt wird ein Handle erst nach einem
     ABGESCHLOSSENEN Dialog. Wer die Originaldatei wählt und das Ersetzen
     bestätigt, hat ein beschreibbares Handle — jedes weitere Strg+S ist
     still. Ohne bekanntes Handle hilft die geteilte Picker-id (siehe
     openWithPicker). D74-Nachtrag. */
  const known = fileHandles.get(d.id);
  const opts = known
    ? {suggestedName: known.name, startIn: known, types: FILE_TYPES}
    : {suggestedName: saveFileName(d.name), types: FILE_TYPES, id: 'werkbaum-files'};
  let handle;
  try{
    handle = await window.showSaveFilePicker(opts);
  }catch(_){ return; }   /* Abbruch: bewusst kein Download hinterher */
  try{ await writeToHandle(handle, d.text); }catch(_){ return; }
  fileHandles.set(d.id, handle);
  idbPutHandle(d.id, handle);
}
/* Speichern: mit Handle in dieselbe Datei, sonst Dialog (Stufe 2) bzw.
   Blob-Download (Stufe 1). UTF-8, LF — das Textfeld normalisiert Zeilenenden
   ohnehin auf \n (D24). */
async function saveLocalFile(){
  maybeShowFsNotice();
  flushActive();
  const d = activeDoc();
  if(!d) return;
  let inPlace = false;
  if(hasFsAccess){
    inPlace = await saveToKnownFile(d);
    if(!inPlace) await saveWithPicker(d);
  } else {
    saveBlob(new Blob([d.text], {type:'text/plain;charset=utf-8'}), saveFileName(d.name));
  }
  updateDocButtons();   /* ein frisch gemerktes Handle gehört in den Tooltip */
  /* Stilles In-Place-Speichern braucht eine sichtbare Antwort — sonst wirkt
     die Geste tot. Haus-Idiom flashBtn (Petrol-Blitz samt Haken, D54), am
     Speichern-Knopf selbst: Er ist die Geste (auch für Strg+S, D74). Dialog
     und Download sind selbst sichtbar und brauchen keinen. */
  if(inPlace) flashBtn(document.getElementById('saveBtn'));
}
/* Strg+S / Cmd+S speichert als Datei (D74) — die Geste, die jeder zuerst
   versucht. Ohne preventDefault öffnet der Browser „Seite speichern": genau
   der Dialog, den niemand will. Ohne gemerktes Handle verhält sich die Geste
   wie der Menü-Eintrag (Dialog in Chromium, Download sonst) — ein
   Speichern-Dialog auf eine Speichern-Geste ist keine Überraschung. Der
   Tastendruck ist zugleich die Nutzergeste, die requestPermission braucht. */
document.addEventListener('keydown', e => {
  if((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey
     && (e.key === 's' || e.key === 'S')){
    e.preventDefault();
    if(!e.repeat) saveLocalFile();
  }
});
/* Dokumente laden + aktiven Text in den Editor holen (nach applyLang). */
function initDocs(){
  restoring = true;
  loadDocs();
  loadSnaps();
  const d = activeDoc();
  src.value = d ? d.text : '';
  snapBase = src.value;
  restoring = false;
  persistDocs();   /* migrierte/geladene Liste festschreiben (stabil über Reload) */
  updateDocName();
  render();
}

/* ---------- Text von außen: ?sourceUrl= (D23) ----------
   Holt einen Notationstext über http(s) und führt ihn als eigenes Dokument. Die
   id leitet sich aus der URL ab: derselbe Link aktualisiert dieses Dokument,
   statt bei jedem Aufruf ein neues anzulegen. Eigene Dokumente des Nutzers
   bleiben unberührt. Scheitert das Laden (häufigster Fall: das Ziel sendet
   keinen CORS-Header), bleibt der bisherige Stand stehen und es erscheint eine
   Warnung. Eine statische Datei, einmal pro Laden geholt.

   `?etherpad=` gab es hier einmal daneben (D31) und ist ausgebaut (D78) — ein
   alter Link meldet sich, statt still nichts zu tun. */
/* Die Parameternamen stehen in docurl.js — dort wird auch entschieden, welcher
   von ihnen zum aktiven Dokument gehört (D80). */
function urlParam(name){
  try{ return new URLSearchParams(location.search).get(name); }catch(_){ return null; }
}
function sourceUrlParam(){ return urlParam(SOURCE_PARAM); }

/* Woher kommt der Text? null = kein Parameter, {gone} = ausgebauter Eingang,
   {bad,error} = unbrauchbare Angabe, sonst der Beschreiber für
   loadRemoteSource(). */
function remoteSource(){
  /* Ein alter `?etherpad=`-Link soll nicht stillschweigend ein leeres
     Werkbaum zeigen: Wer ihn irgendwo stehen hat, erfährt hier, wohin die
     Zusammenarbeit gezogen ist (D78). */
  if(urlParam(ETHERPAD_PARAM)) return {gone: true};
  const raw = sourceUrlParam();
  if(!raw) return null;
  let url;
  /* Relative Angaben gegen die Seite auflösen; nur http(s) zulassen (kein
     file:/data:/javascript: — die Notation selbst erlaubt ohnehin nur http(s)). */
  /* Fehlerdetail bewusst technisch/englisch wie die Browser-Meldungen
     („Failed to fetch", „HTTP 404") — der Rahmentext ist lokalisiert. */
  try{ url = new URL(raw, location.href); }catch(_){ return {bad: raw, error: 'invalid URL'}; }
  if(url.protocol !== 'http:' && url.protocol !== 'https:') return {bad: url.href, error: url.protocol};
  return {fetchUrl: url.href, id: 'url:' + url.href, name: url.href, source: url.href};
}

async function fetchRemote(url){
  const resp = await fetch(url, {cache:'no-store', credentials:'omit'});
  if(!resp.ok) throw new Error('HTTP ' + resp.status);
  return await resp.text();
}
/* Geholten Text als Dokument übernehmen und aktivieren. */
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
  if(s.gone){
    sourceWarning = {type:'padGone'};
    render();
    return;
  }
  if(s.bad !== undefined){
    sourceWarning = {type:'sourceLoad', url: s.bad, error: s.error};
    render();
    return;
  }
  try{
    adoptRemote(s, await fetchRemote(s.fetchUrl));
  }catch(err){
    /* CORS-Fehler melden sich als „TypeError: Failed to fetch" ohne Details —
       der Warntext nennt CORS daher ausdrücklich als wahrscheinliche Ursache. */
    sourceWarning = {type:'sourceLoad', url: s.fetchUrl, error: (err && err.message) || String(err)};
    render();
  }
}

/* ---------- Gemeinsam am selben Dokument arbeiten: ?live= (D76) ----------
   Der dritte Eingang für Text von außen — und der einzige, in den auch
   zurückgeschrieben wird. Adressiert wird die Dokument-URL des Backends
   (`…/api/v1/documents/<uuid>`); Identität und Endpunkte leitet live.js daraus
   ab, dort steht auch die Begründung.

   Der Ablauf in drei Sätzen: Beim Laden holen wir Text und Version und merken
   uns beides als **Schattenkopie** — den Stand, den der Server kennt. Wer tippt,
   schickt nach 1,5 s Ruhe das **Diff** von der Schattenkopie zum jetzigen Text.
   Ein **Feed** hält die Gegenrichtung offen und wendet fremde Änderungen an,
   ohne das Dokument neu zu laden — dafür wandert die Schreibmarke mit
   (live.js, `mapLine`).

   Was hier NICHT passiert: Zusammenführen. Überschneiden sich zwei Änderungen
   wirklich, entscheidet der Mensch (Konflikt-Band unten). Alles andere
   verschiebt der Server selbst. */
const LIVE_DEBOUNCE_MS = 600;    /* Ruhe vor dem Senden; D76, D79 */
const LIVE_WAIT_S = 25;          /* Wartezeit des Feeds; der Server klemmt sie ohnehin */
const LIVE_RETRY_MS = 5000;      /* nach einem Netzfehler, bevor der Feed erneut fragt */

/* Zufällige, pseudonyme Kennung dieses Clients — samt laufender Nummer.
   Beide zusammen machen das Einreichen wiederholbar: Geht die Antwort
   unterwegs verloren, erkennt der Server die Wiederholung und wendet sie nicht
   ein zweites Mal an (D76).

   Beide liegen im **sessionStorage**, also je Tab:
   - Über den Tab hinaus geteilt wären sie falsch. Zwei Tabs desselben Browsers
     sind zwei Schreiber; mit gemeinsamer Nummer schickte der eine bald eine
     kleinere `seq` als der andere — für den Server eine veraltete Nummer (422).
   - Innerhalb des Tabs müssen sie das Neuladen überleben. Sonst finge die
     Nummer wieder bei 1 an, und der Server hielte die erste echte Änderung für
     die Wiederholung der letzten von vorhin und täte **nichts** — im Live-Test
     genau so passiert. */
const SS_CLIENT = 'werkbaum-client';
const SS_SEQ = 'werkbaum-seq';
function clientId(){
  let id = null;
  try{ id = sessionStorage.getItem(SS_CLIENT); }catch(_){}
  if(!id){
    id = 'c-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try{ sessionStorage.setItem(SS_CLIENT, id); }catch(_){}
  }
  return id;
}
function nextSeq(){
  let n = 0;
  try{ n = parseInt(sessionStorage.getItem(SS_SEQ) || '0', 10) || 0; }catch(_){}
  n++;
  try{ sessionStorage.setItem(SS_SEQ, String(n)); }catch(_){}
  return n;
}

let liveState = null;      /* {urls, id, version, shadow, seq, pushTimer, feedAbort, busy} */
let liveConflict = null;   /* offener Konflikt: bis der Mensch entscheidet, ruht alles */

function liveActive(){ return !!liveState && activeId === liveState.id; }

/* Wer das Live-Dokument löscht, meint es (wie beim Pad, D31). */
function stopLive(){
  if(!liveState) return;
  if(liveState.pushTimer) clearTimeout(liveState.pushTimer);
  if(liveState.feedAbort) liveState.feedAbort.abort();
  liveState = null;
  liveConflict = null;
  hideConflictBanner();
}

function loadLive(){ startLive(urlParam(LIVE_PARAM)); }

/* Eine Sitzung für dieses Server-Dokument aufnehmen: Stand holen, Feed öffnen.
   Zwei Wege hierher — der `?live=`-Parameter beim Laden und das Umschalten auf
   ein Server-Dokument im Wähler (D80). */
async function startLive(raw){
  if(!raw) return;
  ensureDisplayName();   /* wer mitschreibt, darf sagen, wer er ist (D86) */
  const urls = live.liveUrls(raw, location.href);
  if(!urls){
    sourceWarning = {type:'liveLoad', url: raw, error: 'not a Werkbaum document URL'};
    render();
    return;
  }
  liveState = {urls, id: 'live:' + urls.doc, version: 0, shadow: [''],
               pushTimer: null, feedAbort: null, busy: false};
  try{
    const doc = await fetchJson(urls.doc);
    adoptLive(doc);
    runFeed();
  }catch(err){
    /* liveState NICHT halb initialisiert stehen lassen (D89): Mit Version 0,
       leerer Schattenkopie und ohne Feed wäre jede weitere Eingabe eine
       stumme Sackgasse. Ohne Sitzung meldet der Wachhund die Lage. */
    liveState = null;
    sourceWarning = {type:'liveLoad', url: urls.doc, error: (err && err.message) || String(err)};
    render();
  }
}

async function fetchJson(url, options){
  const resp = await fetch(url, Object.assign({cache:'no-store', credentials:'omit'}, options));
  if(resp.status === 204) return null;
  if(!resp.ok){
    const err = new Error('HTTP ' + resp.status);
    err.status = resp.status;
    try{ err.body = await resp.json(); }catch(_){}
    throw err;
  }
  return await resp.json();
}

/* Server-Stand übernehmen: Text ins Dokument, Schattenkopie und Version merken.
   Der Name ist der **Titel des Servers**, nicht die URL wie bei ?sourceUrl= und
   ?etherpad= — anders als eine Datei oder ein Pad hat ein Server-Dokument einen
   Namen, und alle sehen denselben. Die volle Adresse steht im Tooltip
   (D76-Nachtrag 7). */
function adoptLive(doc){
  const content = live.normalize(doc.content || '');
  liveState.version = doc.version;
  liveState.shadow = live.lines(content);
  flushActive();
  let d = docs.find(x => x.id === liveState.id);
  /* Weicht der lokal gehaltene Text vom Server ab, wandert er VOR dem
     Überschreiben in die lokalen Sicherungen (D89) — genau an dieser Stelle
     ging beim Vorfall der ungesendete Vormittag verloren. */
  if(d && d.text !== content) rescueSnapshot(d.id, d.text);
  if(d){ d.text = content; d.name = doc.title || liveState.urls.doc; }
  else { d = {id: liveState.id, name: doc.title || liveState.urls.doc, text: content}; docs.push(d); }
  d.source = liveState.urls.doc;
  activeId = liveState.id;
  sourceWarning = null;
  computeFresh(liveState.id, content);
  loadActiveIntoEditor();
  persistDocs();
}

/* ---------- Hinschicken ---------- */

/* Nach jeder Eingabe neu gestartet: Gesendet wird erst, wenn es 600 ms ruhig
   ist. Ohne den Takt entstünde je Tastendruck eine Version — die Historie wäre
   ein Transaktionslog, und das Netz hätte zu tun.

   Die Wartezeit **ist** die gefühlte Verzögerung: Gemessen braucht der Weg vom
   Tastendruck bis zum Text des anderen 1,73 s, davon 1,67 s hier — der Server
   weckt den wartenden Feed 39 ms nach dem PATCH (D79). Sie bleibt ein
   Debounce, kein Takt: Wer durchtippt, erzeugt weiterhin keine Version. */
function scheduleLivePush(){
  if(!liveActive() || liveConflict) return;
  if(liveState.pushTimer) clearTimeout(liveState.pushTimer);
  liveState.pushTimer = setTimeout(() => { liveState.pushTimer = null; pushLive(); },
                                   LIVE_DEBOUNCE_MS);
}

/* ---------- Ungesendetes darf nicht stumm bleiben (D89) ----------
   Der Vorfall dahinter: Zwei Stunden Tippen erreichten den Server nicht —
   ohne Warnung, und beim nächsten Neuladen war der Text weg. Drei Netze:
   ein Wachhund, der stehende Unterschiede zwischen Editor und Schattenkopie
   nach 30 s laut meldet (egal aus welchem Grund — offenes Konflikt-Band,
   tote Sitzung, Netz); eine Rettungs-Sicherung, bevor irgendetwas
   ungesendeten Text überschreibt; und eine Nachfrage beim Verlassen. */

function livePendingChanges(){
  if(liveConflict) return true;
  if(!liveActive() || !liveState.version) return false;   /* Sitzung nie angekommen: nichts zu vergleichen */
  return live.text(liveState.shadow) !== live.normalize(src.value);
}

/* Ungesendeten Text in die lokalen Sicherungen legen — die Zusage „verloren
   geht nichts" muss auch gelten, wenn niemand mehr fragt. Dedupliziert gegen
   den letzten Stand (addSnapshot), gedeckelt wie alle Stände (D54). */
function rescueSnapshot(docId, text){
  if(!text || !text.trim()) return;
  if(addSnapshot(snaps, docId, text, Date.now(), {base: null, manual: true}))
    persistSnaps(snaps, localStorage);
}

let unsyncedSince = 0;
setInterval(() => {
  const d = activeDoc();
  const tot = !!(d && String(d.id).startsWith('live:') && !liveState);
  const offen = !tot && livePendingChanges();
  if(offen){ if(!unsyncedSince) unsyncedSince = Date.now(); }
  else unsyncedSince = 0;
  let neu = null;
  if(tot) neu = {type: 'liveEnded'};
  else if(unsyncedSince && Date.now() - unsyncedSince > 30000)
    neu = {type: 'liveUnsent', min: Math.max(1, Math.floor((Date.now() - unsyncedSince) / 60000))};
  if(JSON.stringify(neu) !== JSON.stringify(liveWarning)){
    liveWarning = neu;
    render();
  }
}, 5000);

/* Nachfrage beim Schließen/Neuladen mit ungesendeten Änderungen — und als
   Gürtel zum Hosenträger legt pagehide den Text zusätzlich in die lokalen
   Sicherungen: auch wer die Nachfrage wegklickt, verliert nichts mehr. */
addEventListener('beforeunload', e => {
  if(livePendingChanges()){ e.preventDefault(); e.returnValue = ''; }
});
addEventListener('pagehide', () => {
  if(liveState && livePendingChanges()) rescueSnapshot(liveState.id, live.normalize(src.value));
});

/* [meilenstein]: Der Kamera-Knopf hält den Stand als SERVER-Meilenstein fest
   (D86) — dann darf das Diff auch leer sein: Die leere Änderung bumpt die
   Version und markiert sie als Meilenstein, genau das ist „Stand jetzt
   sichern" auf einem geteilten Dokument. */
async function pushLive(meilenstein){
  if(!liveActive() || liveConflict || liveState.busy) return;
  const now = live.lines(live.normalize(src.value));
  const ops = live.computeOps(liveState.shadow, now);
  if(!ops.length && !meilenstein) return;

  /* Die Sitzung selbst festhalten, nicht nur ihre Felder: Wer während des
     Sendens auf ein anderes Dokument umschaltet, beendet sie (D80) — die
     Fortsetzung unten dürfte danach weder schreiben noch in ein `null`
     greifen. Der PATCH ist dann trotzdem draußen, und das ist gewollt. */
  const sitzung = liveState;
  sitzung.busy = true;
  const seq = nextSeq();
  /* Die Basis, gegen die `ops` gerechnet sind — VOR dem Warten festgehalten.
     Sie hinterher aus `liveState` zu lesen hieße anzunehmen, dass sich
     dazwischen nichts ändert; genau diese Annahme ist gebrochen, sobald der
     Feed dazwischenfunkt (D76-Nachtrag 9). Der Feed lässt sich jetzt aus,
     solange wir senden — aber eine Rechnung, die nur wegen einer Sperre
     anderswo stimmt, schreibt man nicht auf. */
  const basis = sitzung.shadow;
  try{
    const body = {
      baseVersion: sitzung.version,
      checksum: await live.checksum(live.text(sitzung.shadow)),
      clientId: clientId(),
      displayName: displayName(),
      seq,
      ops,
      milestone: meilenstein || undefined,
    };
    const result = await fetchJson(sitzung.urls.content, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    if(liveState !== sitzung) return;   /* inzwischen umgeschaltet (D80) */
    /* Angenommen. Hat der Server verschoben, stehen die fremden Operationen in
       `opsSinceBase`: Die Schattenkopie zieht erst darüber nach, dann kommt
       unsere eigene Änderung darauf — verschoben um die fremde. Genau diese
       Rechnung hat der Server auch gemacht; wir kommen deshalb auf denselben
       Text, ohne ihn abholen zu müssen. */
    const foreign = (result.opsSinceBase || []);
    const meine = foreign.length ? live.rebaseOps(ops, foreign) : ops;
    if(meine == null){ await reloadLive(); return; }   /* kann nicht sein - dann lieber neu */
    sitzung.shadow = live.applyOps(
      foreign.length ? live.applyOps(basis, foreign) : basis, meine);
    sitzung.version = result.version;
    /* Ein gelungener Abgleich räumt eine liegengebliebene Live-Warnung mit
       weg — „nicht geladen" neben funktionierendem Senden wäre eine Lüge. */
    if(sourceWarning && (sourceWarning.type === 'liveLoad' || sourceWarning.type === 'liveStale')){
      sourceWarning = null;
      render();
    }
    if(foreign.length) applyForeign(basis, foreign, sitzung.shadow, sitzung.version);
  }catch(err){
    if(liveState === sitzung) handlePushError(err);
  }finally{
    sitzung.busy = false;
  }
}

function handlePushError(err){
  if(err && err.status === 409 && err.body){
    /* Der andere Weg in denselben Zustand: Unser Senden hat das Rennen gegen
       den Feed gewonnen, und der Server hat die Überschneidung gesehen. */
    let serverLines;
    try{ serverLines = live.applyOps(liveState.shadow, err.body.opsSinceBase || []); }
    catch(_){ reloadLive(); return; }
    openConflict(err.body.currentVersion, serverLines);
    return;
  }
  if(err && (err.status === 422 || err.status === 404)){
    /* Nicht anwendbar oder weg: einmal neu laden ist der vereinbarte Ausweg. */
    sourceWarning = {type:'liveStale', error: (err.body && err.body.detail) || err.message};
    render();
    reloadLive();
    return;
  }
  sourceWarning = {type:'liveLoad', url: liveState.urls.doc,
                   error: (err && err.message) || String(err)};
  render();
}

async function reloadLive(){
  if(!liveState) return;
  try{ adoptLive(await fetchJson(liveState.urls.doc)); }catch(_){ /* der Feed versucht es weiter */ }
}

/* ---------- Herbekommen: der Feed ---------- */

/* Eine offene Anfrage, die der Server beantwortet, sobald sich etwas tut.
   Läuft **nur im sichtbaren Tab** (D76-Nachtrag 1): Ein Hintergrund-Tab braucht
   keinen Live-Feed, niemand schaut hin, und ohne HTTP/2 belegt jeder Tab eine
   der sechs Verbindungen zur Herkunft. Beim Zurückkommen holt ein einziger
   Abruf den Rückstand. */
async function runFeed(){
  while(liveState){
    /* `busy` gehört hierher UND in `feedAction`, und zwar gegen zwei
       verschiedene Fälle: Hier wird gar nicht erst gefragt, solange ein
       eigenes Diff unterwegs ist — sonst antwortete der Server sofort mit
       unserer eigenen Änderung, die Antwort würde ausgelassen, und die
       Schleife fragte in einer engen Runde erneut. Dort greift der Fall, dass
       das Senden BEGINNT, während die Anfrage schon offen steht. */
    if(document.hidden || liveConflict || liveState.busy){ await sleep(500); continue; }
    const ctl = new AbortController();
    liveState.feedAbort = ctl;
    try{
      const url = liveState.urls.changes +
        '?since=' + liveState.version + '&wait=' + LIVE_WAIT_S;
      const feed = await fetchJson(url, {signal: ctl.signal});
      if(feed) applyFeed(feed);
    }catch(err){
      if(!liveState) return;
      if(err && err.name === 'AbortError') continue;
      if(err && err.status === 404){ stopLive(); return; }
      await sleep(LIVE_RETRY_MS);
    }finally{
      if(liveState) liveState.feedAbort = null;
    }
  }
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

/* Beim Wegschalten die offene Verbindung **schließen**, nicht bloß die Antwort
   ignorieren: Ohne HTTP/2 belegt jeder Tab eine der sechs Verbindungen zur
   Herkunft, und ein Hintergrund-Tab braucht keinen Feed (D76-Nachtrag 1). Beim
   Zurückkommen holt der nächste Durchlauf den Rückstand in einem Zug. */
document.addEventListener('visibilitychange', () => {
  if(document.hidden && liveState && liveState.feedAbort) liveState.feedAbort.abort();
});

function applyFeed(feed){
  const what = live.feedAction(feed, liveState.version, liveState.busy);
  if(what === 'skip') return;
  applyRenameEvents(feed);   /* Umbenennung durch andere (RENAMED, D85) */
  if(what === 'replace'){
    /* Volltext: die Basis ist verdichtet, ein Diff gibt es nicht mehr.
       Auch hier weicht der eigene Stand — vorher sichern (D89). */
    const eigen = live.normalize(src.value);
    const neu = live.normalize(feed.content);
    if(eigen !== neu) rescueSnapshot(liveState.id, eigen);
    liveState.version = feed.currentVersion;
    liveState.shadow = live.lines(neu);
    setLiveText(live.text(liveState.shadow), null);
    return;
  }
  const alt = liveState.shadow;
  liveState.shadow = live.applyOps(alt, feed.ops);
  liveState.version = feed.currentVersion;
  applyForeign(alt, feed.ops, liveState.shadow, liveState.version);
}

/* Hat jemand umbenannt, trägt der Feed den neuen Titel im Klartext (D85) —
   der letzte gewinnt. Der Name ist Index-Metadatum: persistieren ist ein
   Flush-Ereignis, und Umbenennen ist selten. */
function applyRenameEvents(feed){
  const ev = (feed.events || []).filter(e => e && e.changeType === 'RENAMED' && e.title).pop();
  if(!ev) return;
  const d = docs.find(x => x.id === liveState.id);
  if(!d || d.name === ev.title) return;
  d.name = ev.title;
  persistDocs();
  updateDocName();
  if(!docMenu.hidden) renderDocMenu();
}

/* Fremde Operationen auf den **sichtbaren** Text anwenden.
   Hat der Nutzer inzwischen selbst getippt, ist sein Text nicht mehr die alte
   Schattenkopie: Dann wird die fremde Änderung auf seinen Stand angewendet und
   sein eigenes Diff beim nächsten Senden neu gebildet. Passt das nicht (die
   Zeilen sind unter ihm weggezogen), bleibt sein Text stehen — das nächste
   Senden klärt es, notfalls über einen Konflikt. */
function applyForeign(oldShadow, ops, serverLines, version){
  const editor = live.lines(live.normalize(src.value));
  /* Was der Server noch nicht kennt: alles, was seit der Schattenkopie
     getippt wurde. Die fremden Operationen zählen gegen die Schattenkopie -
     um sie auf den getippten Text anzuwenden, müssen sie daran vorbei. */
  const ungesendet = live.computeOps(oldShadow, editor);
  const verschoben = live.rebaseOps(ops, ungesendet);
  if(verschoben == null){
    /* Überschneidung mit dem, was gerade getippt wird — **hier** entsteht der
       Konflikt, nicht erst beim Senden. Ohne diese Stelle bliebe er praktisch
       aus: Der Feed zieht die Schattenkopie nach, das nächste Senden hätte
       eine aktuelle Basis, und die fremde Zeile wäre stillschweigend
       überschrieben. Der Server kann das nicht sehen — er kennt den
       ungesendeten Text nicht. */
    openConflict(version, serverLines);
    return;
  }
  let after;
  try{ after = live.applyOps(editor, verschoben); }catch(_){ return; }
  const caret = live.caretToLineCol(src.value, src.selectionStart);
  const line = live.mapLine(caret.line, verschoben);
  setLiveText(live.text(after), live.lineColToCaret(after, line, caret.col));
}

/* Text setzen, ohne die eigene Änderungslogik erneut auszulösen.
   Bewusst **nicht** undo-fähig geschrieben: Eine fremde Änderung ist nicht
   meine Eingabe, und ein Strg+Z, das den Beitrag eines anderen zurücknimmt,
   wäre eine Lüge über die Herkunft. */
function setLiveText(text, caret){
  src.value = text;
  if(caret != null){ src.selectionStart = src.selectionEnd = caret; }
  const d = activeDoc();
  if(d) d.text = text;
  persistActiveText();   /* fremde Feed-Änderungen kommen im Sekundentakt — kein Voll-Write (D82) */
  render();
}

/* ---------- Konflikt ---------- */

/* Echte Überschneidung: Der Server hat abgelehnt, und jetzt entscheidet der
   Mensch. Bis dahin ruhen Senden und Feed — sonst zöge der Stand unter der
   Frage weg, die gerade gestellt ist. */
function openConflict(version, serverLines){
  if(liveConflict) return;            /* eine Frage zur Zeit */
  liveConflict = {version, serverLines};
  showConflictBanner();
}

/* Fremde Fassung übernehmen: Der eigene Text weicht. Verloren ist er nicht —
   er steht in den früheren Ständen (D54), und jede Version steht in der
   Historie des Servers. */
function takeTheirs(){
  const c = liveConflict;
  liveConflict = null;
  hideConflictBanner();
  /* Der eigene Text weicht — aber nicht mehr spurlos (D89): Er wandert in die
     lokalen Sicherungen. Der Kommentar „er steht in den früheren Ständen"
     stimmte seit D86 nicht mehr; jetzt stimmt er wieder. */
  const eigen = live.normalize(src.value);
  if(eigen !== live.text(c.serverLines)) rescueSnapshot(liveState.id, eigen);
  liveState.version = c.version;
  liveState.shadow = c.serverLines;
  setLiveText(live.text(c.serverLines), null);
}

/* Eigene durchsetzen: Die Schattenkopie zieht auf den Server-Stand nach, der
   eigene Text bleibt stehen. Das nächste Senden bildet das Diff dagegen — es
   überschneidet sich dann per Konstruktion nicht mehr. */
function keepMine(){
  const c = liveConflict;
  liveConflict = null;
  hideConflictBanner();
  liveState.version = c.version;
  liveState.shadow = c.serverLines;
  pushLive();
}

function showConflictBanner(){
  hideConflictBanner();
  const bar = document.createElement('div');
  bar.id = 'liveConflict';
  bar.className = 'live-conflict';
  bar.setAttribute('role', 'alertdialog');
  bar.innerHTML = '<span></span>' +
    '<div class="live-conflict-actions">' +
    '<button type="button" class="theirs"></button>' +
    '<button type="button" class="mine"></button></div>';
  bar.querySelector('span').textContent = t('liveConflictText');
  const theirs = bar.querySelector('.theirs');
  const mine = bar.querySelector('.mine');
  theirs.textContent = t('liveConflictTheirs');
  mine.textContent = t('liveConflictMine');
  theirs.addEventListener('click', takeTheirs);
  mine.addEventListener('click', keepMine);
  document.body.appendChild(bar);
  theirs.focus();
}

function hideConflictBanner(){
  const el = document.getElementById('liveConflict');
  if(el) el.remove();
}

/* Anzeigename: ohne Anmeldung eine Behauptung (D76) — die Oberfläche darf ihn
   nicht wie einen Nachweis aussehen lassen. Vorerst der gemerkte Name oder
   nichts; ein Eingabefeld dafür kommt mit der Präsenz-Anzeige. */
const LS_NAME = 'werkbaum-name';
function displayName(){
  try{ return localStorage.getItem(LS_NAME) || undefined; }catch(_){ return undefined; }
}
/* Der Anzeigename (D86): selbstgewählt, im Browser gemerkt, geht mit jedem
   Patch mit und füllt das „geändert von" der Server-Historie. Einmal gefragt —
   auch die leere Antwort wird gemerkt (anonym bleiben ist eine Antwort,
   Nachfragen bei jedem Öffnen wäre Gängelung); Abbruch fragt beim nächsten
   Mal erneut. Ohne Anmeldung bleibt der Name eine Behauptung (D76). */
function ensureDisplayName(){
  try{
    if(localStorage.getItem(LS_NAME) !== null) return;
    const eingabe = window.prompt(t('liveNameAsk'), '');
    if(eingabe === null) return;
    localStorage.setItem(LS_NAME, eingabe.trim());
  }catch(_){}
}

/* ---------- Ein Dokument auf den Server legen (D76) ----------
   Der Weg vom lokalen Dokument zum gemeinsam bearbeitbaren: anlegen, dorthin
   umschalten, Link in die Adresszeile und in die Zwischenablage.

   Das lokale Dokument bleibt bestehen. Es zu löschen wäre die aufgeräumtere
   Geste und die riskantere: Wer sein einziges Exemplar einem Server anvertraut,
   soll es nicht dabei verlieren. Der Server-Stand ist ein neues Dokument im
   Wähler, erkennbar am Namen und an der Adresse im Tooltip. */
const SERVER_PARAM = 'server';
const LS_SERVER = 'werkbaum-server';

/* Antwortet unter dieser Basis wirklich ein Werkbaum-Backend? Die Lebendprobe
   `/api/v1/info` (D77), bevor blind gePOSTet wird. */
async function probeServer(basis){
  try{
    const info = await fetchJson(live.infoUrl(basis));
    return !!(info && info.name);
  }catch(_){ return false; }
}

/* Wohin? Reihenfolge und Begründung stehen in live.js. Was dort nicht
   hingehört, ist der letzte Ausweg: fragen und die Antwort merken — ein
   Dialog ist keine entscheidbare Regel.

   Die Vorgabe „eigene Herkunft" stimmt nur, wo das Backend wirklich dahinter
   liegt (produktive Installation, D77) — auf GitHub Pages oder einer anderen
   statischen Instanz gibt es keins, und der POST endete dort mit einem
   kryptischen 405 (D81-Nachtrag). Deshalb wird die Vorgabe erst per
   Lebendprobe geprüft und sonst GEFRAGT; gemerkt wird nur eine Adresse, die
   die Probe besteht — ein Tippfehler klemmt sich so nicht fest. Eine
   eingegebene Adresse, die nicht antwortet, wird trotzdem versucht: Der
   POST-Fehlerpfad nennt dann ehrlich, was nicht erreichbar war. */
async function serverBaseOrAsk(){
  const offen = liveState ? liveState.urls.doc : null;
  let gemerkt = null;
  try{ gemerkt = localStorage.getItem(LS_SERVER); }catch(_){}
  const basis = live.serverBase(urlParam(SERVER_PARAM) || gemerkt, offen, location.href);
  if(basis && await probeServer(basis)) return basis;

  const eingabe = window.prompt(t('docToServerAsk'), 'https://');
  if(!eingabe) return null;
  const geprueft = live.serverBase(eingabe, null, location.href);
  if(geprueft && await probeServer(geprueft)){
    try{ localStorage.setItem(LS_SERVER, geprueft); }catch(_){}
  }
  return geprueft;
}

async function putOnServer(){
  const d = activeDoc();
  if(!d) return;
  ensureDisplayName();   /* D86 */
  const basis = await serverBaseOrAsk();
  if(!basis) return;

  try{
    const doc = await fetchJson(live.documentsUrl(basis), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({title: d.name, content: live.normalize(src.value)}),
    });
    const urls = live.liveUrls(basis + '/api/v1/documents/' + doc.id, location.href);
    if(!urls) throw new Error('unerwartete Antwort des Servers');

    stopLive();
    liveState = {urls, id: 'live:' + urls.doc, version: 0, shadow: [''],
                 pushTimer: null, feedAbort: null, busy: false};
    adoptLive(doc);
    runFeed();

    /* Die Adresszeile IST der Link — dort sucht man ihn, und ein Neuladen
       führt zurück ins selbe Dokument. Gesetzt hat sie `adoptLive()` schon
       (D80); in die Zwischenablage geht der Link ohne fremde Parameter, denn
       ein `?server=` geht den Empfänger nichts an. */
    const teilen = location.origin + location.pathname + '?' + LIVE_PARAM + '=' + urls.doc;
    try{ await navigator.clipboard.writeText(teilen); }catch(_){}
    flashBtn(document.getElementById('docTrigger'));
    sourceWarning = null;
    render();
  }catch(err){
    sourceWarning = {type: 'liveLoad', url: live.documentsUrl(basis),
                     error: (err && err.message) || String(err)};
    render();
  }
}

docTrigger.addEventListener('click', e => {
  e.stopPropagation();
  toggleDocMenu();
});
docTrigger.addEventListener('keydown', e => {
  if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleDocMenu(); }
  else if(e.key === 'Escape') closeDocMenu();
});
/* Esc IM Menü schließt es und gibt den Fokus an den Chip zurück. */
docMenu.addEventListener('keydown', e => {
  if(e.key === 'Escape' && !renamingId){ closeDocMenu(); docTrigger.focus(); }
});
/* Eine Delegation für beides: Zeilen-Aktion (data-act am Icon-Knopf) oder
   Wählen (.docpick). Nach einer Aktion bleibt das Menü offen — wer verwaltet,
   verwaltet meist weiter; Wählen schließt. */
docList.addEventListener('click', e => {
  const akt = e.target.closest('[data-act]');
  if(akt){
    e.stopPropagation();
    const zeile = akt.closest('.docitem');
    const id = zeile && zeile.dataset.id;
    if(!id) return;
    if(akt.dataset.act === 'rename') renameDoc(id);
    else if(akt.dataset.act === 'delete') deleteDoc(id);
    else if(akt.dataset.act === 'leave') leaveDoc(id);
    return;
  }
  const btn = e.target.closest('.docpick');
  if(!btn) return;
  e.stopPropagation();
  switchDoc(btn.closest('.docitem').dataset.id);
  closeDocMenu();
});
/* `newDoc()` zeichnet das Menü selbst neu — es geht direkt ins Umbenennen
   (D51), und ein zweiter Durchlauf baute das Eingabefeld nur noch einmal auf. */
document.getElementById('docNew').addEventListener('click', e => { e.stopPropagation(); newDoc(); });
document.getElementById('docOpenFile').addEventListener('click', e => { e.stopPropagation(); openLocalFile(); });
/* Die Stand-Knöpfe der Editor-Titelzeile (D81). */
document.getElementById('saveBtn').addEventListener('click', saveLocalFile);
document.getElementById('shareBtn').addEventListener('click', putOnServer);
document.getElementById('reloadBtn').addEventListener('click', reloadDoc);
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
/* Flush-Punkte beim Verlassen (D82): Das Dokument-Array wird beim Tippen
   nicht mehr geschrieben (nur der Spiegel) — hier holt es den Stand nach.
   `pagehide` statt `beforeunload` (greift auch beim bfcache), dazu der
   verborgene Tab: Auf Mobil räumt der Browser Tabs oft ohne pagehide ab. */
addEventListener('pagehide', () => persistDocs());
document.addEventListener('visibilitychange', () => { if(document.hidden) persistDocs(); });
if(hasFsAccess) handlesReady = idbLoadHandles();   /* gemerkte Datei-Handles zurückholen (D72, Stufe 2) */
/* Erst mit den Handles wissen Speichern-Tooltip und Neu-laden-Knopf, ob das
   aktive Dokument eine gemerkte Datei hat (D81). */
handlesReady.then(() => updateDocButtons());

/* PWA-Dateihandling (D73): Die installierte App registriert sich über das
   Manifest (`file_handlers`) für .werkbaum/.txt; ein Doppelklick im
   Dateimanager reicht die Datei als Handle über die launchQueue herein.
   `adoptFile()` (D72) übernimmt — dieselbe Datei landet im selben Dokument,
   und das Handle macht „Als Datei speichern" dialogfrei. Außerhalb einer
   installierten Chromium-App gibt es die launchQueue nicht: dann ist der
   Block ein No-op. */
if('launchQueue' in window){
  window.launchQueue.setConsumer(async params => {
    for(const h of (params && params.files) || []){
      try{
        const text = await (await h.getFile()).text();
        await adoptFile(h, h.name, text);
      }catch(_){ /* nicht lesbar — still, wie beim Picker-Abbruch (D72) */ }
    }
  });
}
applyMobile();   /* Mobil-Verhalten (nach Sprache/Restore) anwenden */
loadRemoteSource();    /* ?sourceUrl= / ?etherpad= nachladen (asynchron, D23/D31) */
loadLive();            /* ?live= — Server-Dokument samt Feed (asynchron, D76) */
/* Beide haben ihren Parameter jetzt gelesen (synchron, vor dem ersten
   `await`). Ab hier folgt die Adresszeile dem aktiven Dokument (D80). */
bootDone = true;

/* ---------- PWA: Service Worker (D73) ----------
   Ein reiner Offline-Mantel (public/sw.js): Navigationen network-first, der
   Cache hält nur die zuletzt gesehene Fassung — die Update-Prüfung (D45)
   bleibt dadurch unverändert wahr. NICHT im Dev-Server registrieren: dort
   würde der Worker die HMR-Seite cachen; der Zweig fällt im Dev als toter
   Code weg. Relativer Pfad, damit der Scope dem Auslieferungsort folgt
   (Pages unter /werkbaum/, prod an der Wurzel). Auf file:// und http gibt es
   keinen (nutzbaren) serviceWorker — das Scheitern ist geschluckt, die App
   läuft ohne. */
if(!import.meta.env.DEV && 'serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

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

/* Beides bewusst NUR im Speicher, nicht im localStorage (D45): Ein gemerktes
   „Update verfügbar" überlebte das Neuladen, das es gerade eingespielt hat —
   und meldete dieselbe Fassung wieder und wieder. Nach dem Laden ist nichts
   bekannt; was noch gilt, findet die nächste Prüfung zwei Sekunden später. */
let updateAvailable = false;
let baselineHash = null;

/* Verglichen wird gegen den LAUFENDEN Build, nicht gegen einen gemerkten Abruf.
   Beide Deploy-Wege spritzen den Commit in den Footer-Versionslink (D16); die
   laufende Seite trägt ihn also selbst, und die abgerufene Seite auch. Zwei
   Werte, die im selben Moment vorliegen — kein localStorage dazwischen, damit
   nichts hängenbleiben und nichts zwischen Tabs durcheinandergeraten kann.
   Siehe D45. */
function buildIdFromHtml(html){
  const m = html.match(/<a class="ver"[^>]*href="[^"]*\/commit\/([0-9a-f]{7,40})/);
  return m ? m[1] : null;
}
let runningBuild;
function runningBuildId(){
  if(runningBuild === undefined){
    const el = document.querySelector('.site-footer .ver');
    const m = el && (el.getAttribute('href') || '').match(/\/commit\/([0-9a-f]{7,40})\b/);
    runningBuild = m ? m[1] : null;   /* Platzhalter „…/commit/main" ⇒ null */
  }
  return runningBuild;
}

/* Rückfall für Builds ohne eingespritzten Commit (Dev-Server, `file://`):
   Kompakter, deterministischer Hash (cyrb53) über den GESAMTEN HTML-Text.
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

    /* ETag/Last-Modified werden bewusst NICHT herangezogen: GitHub Pages liefert
       je Cache-Knoten unterschiedliche ETags für identischen Inhalt und löste
       damit die irreführende Meldung „Metadaten geändert, aber Inhalt gleich" aus. */
    const html = await resp.text();
    const laufend = runningBuildId(), geliefert = buildIdFromHtml(html);
    let neu;

    if(laufend && geliefert){
      neu = geliefert !== laufend;
      logUpdate(neu ? '✅ Neuer Build ' + geliefert.slice(0, 7) : '✓ Alles aktuell');
    } else {
      /* Ohne Marker bleibt nur der Inhalts-Hash. Vergleichsstand ist der ERSTE
         Abruf dieser Seiten-Sitzung und bleibt es — er im localStorage
         nachgeführt hieße: ein einzelner Abruf gegen einen veralteten
         CDN-Knoten setzt den Stand um, und der nächste meldet fälschlich neu. */
      const hash = hashContent(html);
      if(baselineHash === null){
        baselineHash = hash;
        neu = false;
        logUpdate('✓ Erste Prüfung – Vergleichsstand gesetzt');
      } else {
        neu = hash !== baselineHash;
        logUpdate(neu ? '✅ NEUE VERSION ERKANNT!' : '✓ Alles aktuell');
      }
    }

    if(neu && !updateAvailable){
      updateAvailable = true;
      if(!document.hidden) checkAndShowUpdateNotification();
      else updateFooterUpdateIcon();
    } else if(!neu && updateAvailable){
      /* Zurückgenommen (Rollback, oder der Abruf lief vorher gegen einen
         veralteten Knoten): Meldung wieder einsammeln, statt sie stehenzulassen. */
      updateAvailable = false;
      const notif = document.getElementById('updateNotification');
      if(notif) notif.remove();
      updateFooterUpdateIcon();
    }
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
    if(updateAvailable) checkAndShowUpdateNotification();
  }
});

/* Beim Laden wird NICHT gemeldet: Was die Seite gerade geladen hat, IST der
   aktuelle Stand, bis eine Prüfung etwas anderes zeigt (D45). */

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

  /* Nicht-Dokument-Zustand auf Defaults (UI, Sprache, Update-Log) — die
     Dokumentenliste (werkbaum-docs) bleibt erhalten (D22). Die beiden
     Update-Schlüssel schreibt niemand mehr (D45); sie werden nur noch
     aufgeräumt, falls sie aus einer früheren Fassung herumliegen. */
  ['werkbaum-ui','werkbaum-lang','werkbaum-html-hash','werkbaum-update-available','werkbaum-update-log','werkbaum-fs-notice']
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
  const hasUpdate = updateAvailable;

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

/* Icon bei Update-Erkennung aktualisieren. Beim Laden gibt es nichts zu zeigen —
   der Zustand lebt nur in dieser Seiten-Sitzung (D45). */
const originalCheckAndShowUpdateNotification = checkAndShowUpdateNotification;
checkAndShowUpdateNotification = function(){
  originalCheckAndShowUpdateNotification.call(this);
  updateFooterUpdateIcon();
};
