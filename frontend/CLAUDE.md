# Werkbaum · Frontend

Editor: Text links, Diagramm rechts, Toggles für transponierte Ansicht und
verworfene Elemente. Quelle sind ES-Module unter `src/`; `index.html` ist der
**Vite-Entry** (lädt im Dev-Server `src/app.js` als `<script type="module">`).

## Build & Entwicklung (D19)
- **Vite** ist Bündler + Testrunner (nur Dev-Abhängigkeiten, keine Laufzeit-
  Abhängigkeit — das Ergebnis ist framework-freies HTML/CSS/JS).
- `npm --prefix frontend run dev` — Dev-Server (Port 8137, `.claude/launch.json`).
  Direktes Öffnen von `frontend/index.html` per `file://` funktioniert **nicht**
  mehr (ES-`import` braucht http); stattdessen Dev-Server oder die gebaute Datei.
- `npm --prefix frontend run build` — `vite-plugin-singlefile` inlint JS + CSS +
  Favicon (als `data:`-URI, via `transformIndexHtml`-Plugin in `vite.config.js`)
  in **eine** self-contained `dist/index.html` — die bleibt `file://`-tauglich
  (D16) und ist die Deploy-Artefakt-Quelle (Pages-Workflow, siehe README).
- `npm --prefix frontend test` — Vitest (`tests/**/*.test.js`).
- `npm --prefix frontend run build:prod` — Produktions-Build **ohne** den
  Build-Hinweis hinter dem Titel (Vite-Modus `prod`, `.env.prod` setzt
  `VITE_BUILD_BADGE=none`). Nur die echte produktive Installation nutzt diesen
  Weg; Dev-Server (🔧) und Default-`build` (🚧, u. a. Pages-Deploy) zeigen den
  Hinweis. Logik: `mountBuildBadge()` in `app.js` (D16).
- `node_modules/` und `dist/` sind ge-`.gitignore`-t; `.env.prod` und
  `package-lock.json` sind eingecheckt (der Workflow nutzt `npm ci`).

## Konventionen
- Vanilla HTML/CSS/JS, ES-Module; keine Frameworks. Testwerkzeug: Vitest.
- Parser und Renderer müssen headless (ohne Editor-UI) nutzbar bleiben —
  Basis für SVG-Export und Mermaid-Plugin (docs/ROADMAP.md). `app.js` ist der
  DOM-/UI-Einstieg; reine Logik gehört in `parser.js`/`model.js`/`render.js`.
- Design: Farben/Typografie beibehalten (CSS-Variablen, IBM Plex);
  Statusfarben sind in SPEC §4 normiert. Marke nach ../brand/BRAND.md;
  Pastelltöne nie im Logo.
- IBM Plex ist **lokal eingebettet** (`src/fonts/*.woff2`, `@font-face` in
  `style.css`), **nicht** von Google Fonts geladen — kein externer Request,
  keine IP an Dritte (Datenschutz, D20). Keinen `googleapis`-`<link>` wieder
  einführen. Neue Schnitte: `woff2` per `npm pack @fontsource/…` beziehen (keine
  Projekt-Abhängigkeit, Dateien einchecken) und `@font-face` ergänzen.

## Stolperfallen
- Abzweig-Linien zielen auf die **Knotenmitte** (fester 23-px-Offset,
  `line-height: 1.3`), nicht auf die Mitte des Teilbaums — bei Layout-
  Änderungen alle drei Modi (horizontal/vertikal/kompakt) prüfen.
  **Seit D64 brechen lange Labels um** (`wrapLabel()` in render.js setzt `\n`,
  `white-space:pre-line` macht sie sichtbar): Bei mehrzeiligen Knoten trifft
  der 23-px-Abzweig die Mitte der **ersten Zeile**; der Optional-Kreis sitzt
  deshalb fest bei `top:18px` (= Abzweighöhe), nicht bei 50 % (Ausnahme:
  vertikal zentrierte all-of-Zwischenknoten). Nichts in den Knoten darf die
  Zeilenbox über die festen ~18,3 px heben — der Falt-Chip hat darum
  `line-height:14px` ohne vertikales Padding (mit 15 px wuchs der Knoten
  gemessen um 0,7 px). Der Export zeichnet je gerenderter Zeile ein `<text>`
  (`labelLines()`, misst zeichenweise per Range am Live-Knoten).
  Vertikal + kompakt teilen die transponierte Basis-CSS; nur vertikal
  bekommt den Rechts-Ausgang für „all of“, kompakt führt auch „all of“
  nach unten. Any-of ist in allen Modi grau: Linien gestrichelt grau und
  Alternative-Rahmen grau (Basis-CSS `ul.or`). Kein Petrol im Diagramm mehr;
  `var(--or)` nur noch für UI-Akzente/Logo (SPEC §9, D15).
- Extraktionsreihenfolge im Parser nicht umstellen: Kommentar → Zeichen/
  Status → URL → Größe → Tags → Knoten-ID → Abhängigkeiten → Fokusmarke
  (sonst kollidieren `@` und `#` in URLs).
- Fehlertoleranz (SPEC §4): der Parser erfasst die Statusbox als *beliebiges*
  Einzelzeichen `\[([^\]])\]` und validiert gegen `STATUS_BY_CODE`; unbekannte
  Codes → `parse().warnings` als `{type:'unknownStatus', line, code}`, Knoten
  neutral. `render()` in app.js führt Parser- und Renderer-Warnungen zusammen
  (nach Zeile sortiert) und zeigt sie via `formatWarning` (warnings.js). Neue
  Warnungstypen dort + i18n-Key in allen 9 Sprachen ergänzen.
- **Zwei Senken, ein `switch`:** `formatWarning()` liefert HTML (Warnungsbereich),
  `warningText()` Klartext (der `title` der Zeilennummer, D33-Nachtrag); beide
  bauen auf `build(w, t, esc)` auf. Einen neuen Typ **nur dort** eintragen —
  einen zweiten Formatierer danebenzustellen heißt, dass einer veraltet.
- Modulteilung (D19): `parser.js` (Text→Baum, headless), `model.js` (Baum-/
  Kostenlogik: `gateOf`, `needsBreakdown`, `visibleChildren(n, showDiscarded)`,
  `computeCheapSet`, `cheapCls`), `render.js` (HTML-String via
  `renderTreeHtml(roots, {t, showDiscarded, cheapPath, cheapSet})`, headless),
  `app.js` (DOM/Events/i18n/Persistenz/Export). Modell/Renderer bekommen UI-State
  (verworfene einblenden, Pfad an/aus) als **Parameter** — keine Globals; nur
  `cheapPathOn` lebt als UI-State in `app.js`. Tests: `tests/*.test.js`.
- **Was entscheidbar ist, gehört in ein eigenes Modul** — auch bei Features, die
  wie reine UI aussehen:
  `live.js` (Server-Dokumente: Adressen, Zeilen-Diff, Cursor-Rechnung, wann eine
  Feed-Antwort angewendet werden darf — D76),
  `warnings.js` (Warnung → Text), `snapshots.js` (frühere Stände: wann entsteht
  ein Stand, was fliegt bei Platzmangel raus, wie sieht der Speicherinhalt aus).
  Dort steht **was gilt**, in `app.js` bleibt **woher die Werte kommen und wohin
  sie gehen**; Speicher (`{setItem, removeItem}`) und Uhr (`Date.now()`) werden
  hereingereicht, damit der Test sie stellen kann. Anlass war ein Fehler, der bis
  in Produktion kam und den ein Test in einer Zeile gefunden hätte
  (D54-Nachtrag 3). Faustregel: Sobald du eine Regel im Browser „nachmisst",
  gehört sie in ein Modul.
- Günstigster Pfad: `computeCheapPlan()`/`cheapestCost()`/`cheapCls()` (in
  `model.js`) markieren
  die nötigen Knoten (Klassen `cheap`, `cheap-leaf`); `drawCheapPath()` (app.js)
  zeichnet nach jedem
  `render()` **und** nach `applyLayout()` zwei Overlay-SVGs in `#out` (hinten
  kräftige Linie, vorne abgetönte Kopie + Stationspunkte). Overlays erben den
  CSS-`zoom` von `#out`, Punkte in unskalierte `#out`-Koordinaten umrechnen
  (`/zoom`). `diagramToSvg()` zeichnet dieselbe Linie/Punkte nach (SPEC §9, D18).
  **Die Inversion `.cheap-on .node:not(.cheap)` hat vier Ausnahmen** — `.fresh`
  (D28), `.focusmark` (D32), `.current` (D25) und `.done` (D46-Nachtrag: `[x]`
  oder `[^]`, gesetzt in `render.js` per `isDone()`). Wer eine fünfte Aussage an
  einen Knoten hängt, prüft, ob sie ausgeblasst noch etwas sagt; die ersten drei
  sind je einzeln nachgereicht worden, nachdem sie unsichtbar waren. Der
  **Grafikexport** blasst ohnehin nie aus (er liest `backgroundColor`, nicht
  `opacity`) — er war damit schon immer die Ansicht ohne Inversion.
- Zerlegt eine any-of-Alternative selbst all-of, wird der Teilbaum **nur
  horizontal** schmal transponiert (`ul.or>li.has-and>ul.and`, siehe D18) —
  sonst schiebt der breite Fächer den Elternbaum nach rechts. Bei Layout-
  Umbauten dieses Nesting mitprüfen.
- „verworfen" ist per Default ausgeblendet; Filterlogik steckt in
  `visibleChildren()` und muss bei Renderer-Umbauten erhalten bleiben.
- Barrierefreiheit (SPEC §9): `render.js` baut je Knoten einen sprechenden
  `aria-label` (Label + Status + Aufwand + Zuständige + Link, lokalisiert via
  `t`); die visuellen Badges (Größe, Tags, ↗) sind `aria-hidden`. Neue
  Knoten-Eigenschaften dort in `nodeAria()` mitpflegen und dafür a11y-i18n-Keys
  (`a11y*`) in **allen 9 Sprachen** anlegen. Knoten sind `tabindex="0"`
  (Fokus = Lesereihenfolge), `#warn` ist eine Live-Region.
- **Server-Dokumente (`?live=`, D76):** `live.js` hält die entscheidbare Hälfte
  (Adressen, Zeilen-Diff, Rebasen, Cursor-Rechnung, Feed-Regel), `app.js` die
  Verdrahtung: `loadLive()` holt Text und Version und merkt beides als
  **Schattenkopie**, `scheduleLivePush()` schickt nach 0,6 s Ruhe das Diff
  (D79 — die Wartezeit IST die gefuehlte Verzoegerung),
  `runFeed()` hält einen Abruf offen (nur im sichtbaren Tab), `putOnServer()`
  legt das aktive Dokument an („Teilen" in der Editor-Titelzeile, D81). Die Basis-Adresse
  bestimmt `serverBase()` (live.js): `?server=` vor dem offenen Dokument vor
  der eigenen Herkunft — die Vorgabe stimmt damit ohne Konfiguration, weil das
  Backend produktiv hinter derselben Domain liegt. Zwei Fallen, beide
  im Live-Test gefunden (D76-Nachtrag 7): `clientId` **und** `seq` gehören in den
  `sessionStorage` (je Tab, überlebt Neuladen — sonst hält der Server die erste
  Änderung nach einem Reload für eine Wiederholung und tut nichts), und der
  **Konflikt entsteht beim Tippen**, nicht erst beim Senden — der Server kennt
  den ungesendeten Text nicht. Fremde Änderungen werden bewusst **nicht**
  undo-fähig eingespielt. **Frühere Stände sind bei Server-Dokumenten die
  SERVER-Meilensteine** (D86): `renderSnapMenu()` verzweigt bei `liveActive()`
  auf `renderServerHistory()`, die Kamera schickt `pushLive(true)` (leeres
  Diff erlaubt, `milestone:true`), Laden ist ein Server-Rollback
  (`POST /restore`, ROLLED_BACK für alle) — und `snapshotNow()` sammelt für
  `live:`-Dokumente KEINE lokalen Stände (sie enthielten fremde Arbeit und
  überschrieben sie beim Laden als eigenes Diff). Der Anzeigename
  (`ensureDisplayName()`, einmal gefragt, leer = anonym gemerkt) geht mit
  jedem Patch mit.
  **Der Feed liefert die EIGENE Änderung zurück** (D76-Nachtrag 9): Er
  beantwortet „was ist seit Version N geschehen", und wer mitgeschrieben hat,
  steht nicht in der Frage. Wacht er im Moment des eigenen Sendens auf, hielte
  der Client sich selbst für den anderen und fragte, wessen Fassung gelten soll.
  Deshalb `busy` an **zwei** Stellen: in `feedAction()` (Antwort auslassen) und
  in der `runFeed`-Schleife (gar nicht erst fragen — sonst dreht sie eine enge
  Runde übers Netz). `pushLive()` hält seine Basis **vor** dem `await` fest;
  hinterher aus `liveState` gelesen nähme sie an, dass sich währenddessen
  nichts ändert. Auf localhost liegen PATCH- und Feed-Antwort **7 ms**
  auseinander und die PATCH-Antwort gewinnt — wer das prüfen will, muss die
  PATCH-Antwort im Client verzögern, sonst meldet die Messung „geht doch".
- Zustand wird im `localStorage` gehalten (Server-Dokumente ausgenommen): `werkbaum-lang`
  (Sprache), `werkbaum-docs` (JSON-Array der Dokumente `[{id,name,text}]`),
  `werkbaum-active` (id des aktiven Dokuments), `werkbaum-src` (Spiegel des
  aktiven Texts), `werkbaum-ui` (JSON: Modus, verworfene,
  günstigster Pfad, Split-Zustand inkl. `--col`/`--drow`, Zoom, Vollbild). Neue
  GUI-Einstellungen in `saveUI()`/`restoreState()` mitführen; `saveUI` liefert
  während `restoring===true` nichts, damit das Wiederherstellen nicht sofort
  zurückschreibt.
  **Persistenz ist geteilt (D82) und je Dokument abgelegt (D83):** Das
  Schema liegt headless in `docstore.js` — `werkbaum-docs` ist nur der
  INDEX `[{id,name,source?}]`, der Text jedes Dokuments ein eigener
  Schlüssel `werkbaum-doc:<id>`. Der Tastendruck schreibt über
  `persistActiveText()`/`storeDocText()` NUR den aktiven Text (+ Spiegel
  `werkbaum-src` als Rollback-Fallback); den Voll-Flush macht
  `persistDocs()`/`storeDocs()` an Flush-Punkten (Wechseln/Anlegen/Löschen/
  Umbenennen, `pagehide`, verborgener Tab) — mit Vergleich vor jedem
  Schreiben und Abräumen verwaister Text-Schlüssel; nie wieder eine
  Voll-Serialisierung in einen Tastendruck-Pfad hängen. Die „Spiegel
  gewinnt"-Regel in `loadDocs` gilt NUR noch der einmaligen Migration aus
  dem Altformat (Texte im Array) und muss **vor** `seedShippedDocs()`
  laufen — danach drehte der ältere Spiegel eine frisch nachgezogene
  Fassung zurück und das Dokument gälte für immer als bearbeitet. Ein
  fehlender Text-Schlüssel ergibt ein leeres Dokument, nie den Verlust der
  Liste. Scheitert ein Write (Quota), meldet die persistente Warnung
  `storeFailed` (`noteStore()`, rendert nur an der Flanke) — nie wieder
  still schlucken.
- Dokumente (D22): mehrere umschaltbare Notationstexte. `loadDocs()` migriert bei
  fehlendem `werkbaum-docs` den bestehenden `werkbaum-src` (oder `INITIAL`) in
  **ein** Dokument; `initDocs()` (Aufruf **nach** `applyLang`) holt den aktiven
  Text in den Editor. `saveSrc()` schreibt den Editortext ins aktive Dokument.
  Der Wähler ist eine **Brotkrume im App-Kopf** (`#docTrigger`/`#docMenu`,
  „Werkbaum › Name", D81); das Menü gruppiert nach Dokumentart (`docKind()` in
  docurl.js, headless getestet) und trägt Umbenennen/Löschen als Symbole
  **je Zeile** — `renameDoc/deleteDoc` nehmen deshalb eine **id**, nicht das
  aktive Dokument, und Verwaltungs-Aktionen lassen das Menü offen.
  **Mitgelieferte Dokumente sind nicht umbenennbar** (D81-Nachtrag 3): kein
  Stift an ihrer Zeile, und `renameDoc()` prüft es selbst — ihr Name ist
  Auslieferungsstand (Restore stellt ihn wieder her), und ein umbenanntes,
  unverändertes Beispiel bekäme weiter still neue Fassungen (das Nachziehen
  hängt an id + Text-Fingerabdruck, nicht am Namen).
  Wiederherstellen gibt es im Menü bewusst **nicht** (D81-Nachtrag 2): Es
  läuft über den Neu-laden-Knopf der Titelzeile und wirkt nur auf das
  geöffnete Dokument — `restoreDoc()` prüft das selbst. Die Editor-Titelzeile heißt wieder „Text-Editor" und trägt die
  Stand-Knöpfe (`saveBtn`/`snapAddBtn`/`snapBtn`/`reloadBtn`/`shareBtn` in der
  `.standgroup`); ihren Zustand setzt `updateDocButtons()` — aufgerufen aus
  `updateDocName()` UND am `input`-Ereignis, denn die Abweichung vom
  Auslieferungsstand (Neu-laden-Knopf) entsteht beim Tippen. Auf Mobil löst
  sich die Marken-Gruppe per `display:contents` auf (Menü-Bezug ist die ganze
  Kopfzeile, wie beim Neuigkeiten-Popup) — wer dort Elemente ergänzt, misst
  die eine Marken-Zeile mit Neuigkeiten-Zähler UND Build-Badge nach
  (Worst Case 325 von 335 px). Jedes Dokument ist
  nur Text + Name (kein Strukturformat, D14) — vorwärtskompatibel zum Backend
  (D13). Ansichts-State (`werkbaum-ui`) bleibt global über alle Dokumente. Ein
  leerer Editortext bleibt leer.
- Beispiel-Dokument (D22): reservierte id `EXAMPLE_ID = 'example'`, fester
  englischer Name `EXAMPLE_NAME = 'Example'` (nicht lokalisiert). `loadDocs()`
  adoptiert einen Alt-Zustand (zufällige id, „Beispiel") nur, wenn dessen
  `text === INITIAL` (nie echte Nutzerinhalte). Eine neue INITIAL-Fassung wird
  wie beim Werkbaum-Dokument per Fingerabdruck nachgezogen
  (`werkbaum-seeded-example`, D27-Nachtrag) — nur bei unverändertem Text; der
  Reset setzt beide Merker. Bearbeitete mitgelieferte Dokumente holt der
  Nutzer über „Original wiederherstellen" im Dokumenten-Menü zurück
  (`restoreDoc()`, D22-Nachtrag) — sichtbar nur bei Abweichung vom
  Auslieferungsstand, stellt Text UND Name wieder her. `resetToDefaults()` setzt **nur**
  das Beispiel-Dokument (id `example`) auf `INITIAL`/„Example" zurück und verwirft
  `werkbaum-ui`/`werkbaum-lang`/Update-Flags — **andere Dokumente bleiben stehen**
  (nicht mehr pauschal alle `werkbaum-*` löschen!). Das letzte gelöschte Dokument
  wird als Beispiel neu gesät.
- Mitgeliefertes Dokument „Werkbaum" (D27): `app.js` importiert
  `../../docs/examples/werkbaum.werkbaum?raw` — die Beispieldatei ist
  damit **Build-Eingabe**, Umbenennen/Verschieben bricht den Build (Zugriff
  außerhalb des Roots erlaubt `server.fs.allow:['..']`). `seedShippedDocs()` legt
  es **einmalig** an (auch für Bestandsnutzer); ohne den Merker `werkbaum-seeded`
  käme ein gelöschtes Dokument bei jedem Laden zurück. Der Merker hält den
  **Fingerabdruck** der ausgelieferten Fassung: Ändert sich die Datei, wird der
  Text nur nachgezogen, wenn der Nutzer ihn **nicht** bearbeitet hat. Wer die
  Beispieldatei ändert, ändert damit das mitgelieferte Dokument mit.
  `resetToDefaults()` setzt beide mitgelieferten Dokumente **und** den Merker.
- Umbenennen ist **inline** (kein `window.prompt` — in manchen Browser-Kontexten
  unterdrückt): `renameDoc()` setzt `renamingId`, `renderDocMenu()` rendert dann
  ein `<input class="docrename">` (Enter = `commitRename`, Esc = `cancelRename`,
  Blur = commit). Doc-Namen sind Nutzerdaten und werden **nicht** übersetzt.
- `?sourceUrl=` (D23): `loadFromSourceUrl()` (Aufruf am Ende des Starts, async)
  holt eine externe Textdatei und führt sie als Dokument mit `id: 'url:<href>'`,
  `name`/`source` = URL. Nur `http(s)`, `credentials:'omit'`; bei jedem Laden wird
  neu geholt (URL = Quelle der Wahrheit, lokale Edits daran gehen verloren).
  Fehler landen als zeilenlose Warnung `{type:'sourceLoad', url, error}` in
  `sourceWarning` — ein **persistenter** Kanal, den `render()` jedem Warnungs-Satz
  voranstellt (überlebt Neu-Renderings, bis das Laden gelingt). Hauptstolperfalle
  ist **CORS**: fremde Hosts brauchen `Access-Control-Allow-Origin` (raw.github…
  ja, beliebiger Webserver oft nicht) — der Warntext nennt das ausdrücklich.
  `updateDocName()` setzt für solche Dokumente den vollen URL-Tooltip und muss
  deshalb **nach** dem `data-i18n-title`-Durchlauf in `applyLang()` laufen.
  Weder Endung noch `Content-Type` werden geprüft (`response.text()`); die
  Endung `.werkbaum` ist reine Konvention (D24, SPEC §12). Beispieldateien zum
  Ausprobieren: `docs/examples/*.werkbaum` (nacheinander geöffnet ergeben sie
  mehrere Dokumente im Wähler).
- **Etherpad ist ausgebaut (D78).** `?etherpad=` bleibt als **erkannter**
  Parameter stehen und ergibt die zeilenlose Warnung `padGone`, die auf `?live=`
  zeigt — ein geteilter Link soll nicht still ins Leere laufen. Geholt wird
  nichts. Mit gegangen sind `remote.js`, der Ansichts-Wähler samt Splitter
  (`--pcol`/`--prow`), der Neu-laden-Knopf, die Warnungen `sourceTimeout`/
  `padRateLimit` und **der Schreibschutz**: `src.readOnly` wurde nur von
  Pad-Dokumenten gesetzt, also sind die Wächter in Falten, Kurz-IDs,
  Autovervollständigung und Ständen weg (und mit ihnen `updateSnapBtn()`).
  Wer einen Lesemodus wieder einführt, braucht dafür eine eigene Entscheidung.
  Ebenfalls weg: `#srcArea` — es gab den Kasten nur, damit sich Pad-Rahmen und
  Spiegel einen Bereich teilen; `.editor-body` trägt jetzt direkt
  `srcWrap` · `hintGutter` · `agenda`.
- Fokusmarke `!!!` (D32, SPEC §1): Parser setzt `focus`, Renderer die Klasse
  `focusmark`, CSS gibt ihr einen **eigenen Strahlenkranz in Petrol** (Nachtrag zu
  D32; der geteilte Ring mit `.current` war zu leise). Schein in **hellem** Teal
  `#14B8A6`, Ring in dunklem `--or`: ein dunkler Schein auf Weiß liest sich als
  Schatten, ein heller als Licht. Wie bei `.fresh` braucht die Regel `z-index:2`,
  sonst schneidet ein später gemaltes Geschwister den Kranz ab (D28). Die
  Kombinationen `focusmark.current` und `fresh.focusmark` sind ausbuchstabiert;
  letztere steht bewusst **danach** (gleiche Spezifität). Erkannt **nur alleinstehend** — `(^|\s)!!!(?=\s|$)`, bewusst ohne
  Lookbehind (Safari erst ab 16.4), sonst verlöre `Achtung!!!` seine
  Ausrufezeichen. Extraktion **nach** den Tags; der Kommentar fällt vorher weg,
  eine Marke hinter `%%` wirkt also nicht. `revealFocusMark()` scrollt **nur bei
  Änderung** (Schlüssel = Label-Text, nicht Zeilennummer — Umsortieren soll
  nicht neu scrollen), sonst zöge jeder Neubau den Blick zurück. Die Regel braucht
  den `#out`-Präfix wie `.current` (`ul.or .node{box-shadow:none}` ist
  spezifischer) **und** die Ausnahme
  `.cheap-on .node:not(.cheap).focusmark{opacity:1;filter:none}` — sonst blasst die
  Pfad-Inversion genau den Knoten aus, auf den gezeigt wird (bei einer nicht
  gewählten Alternative gemessen: Deckkraft 0,32).
- Sprung Diagramm ↔ Text (D25): `render.js` schreibt die Parser-Zeilennummer als
  `data-line` an jeden Knoten (Geister-Knoten bekommen keine). `jumpToLine()` in
  `app.js` klappt bei Bedarf das Editor-Panel auf (`revealEditor()`), markiert die
  **ganze Zeile** und scrollt über einen Spiegel-`div` (`offsetTopInEditor()`) —
  Zeilenhöhe × n scheitert an weichen Umbrüchen. Ausgelöst per Alt+Klick,
  Alt+Enter und langem Druck; der Klick-Handler **muss `preventDefault()`** rufen,
  sonst lädt Alt+Klick auf einen Link-Knoten das Ziel herunter. Gegenrichtung:
  Welcher Knoten zu einer Zeile gehört, entscheidet **eine** Stelle:
  `nodeOfLine()` — erst `data-line`, sonst `data-desc-lines~=` (Cursor in einer
  Beschreibung wählt ihren Knoten, D40-Nachtrag 2). Beide Richtungen gehen
  darüber; wer eine neue Zeilensuche schreibt, nimmt sie ebenfalls.
  `syncCaret()` setzt die Klasse `current` auf den Knoten der Cursor-Zeile;
  `render()` stellt sie nach jedem Neubau wieder her (ohne zu scrollen). Die
  CSS-Regel braucht den `#out`-Präfix (`ul.or .node{box-shadow:none}` ist
  spezifischer) **und** — wie `.fresh`/`.focusmark` — die Ausnahme
  `.cheap-on .node:not(.cheap).current{opacity:1;filter:none}`; sie fehlte lange
  als einzige, obwohl der Fall der häufigste ist (Pfad-Umschalter default an,
  jeder `+`-Knoten und jede nicht gewählte Alternative betroffen).
  Zum Ring kommen **Schlagschatten + `scale(1.04)`** (D25-Nachtrag): Tiefe ist der
  einzige noch freie Kanal. Um die **Mitte** skalieren ist Bedingung — `alignStems()`
  und die Stationspunkte messen die Knotenmitte, die dadurch unverändert bleibt.
  **`diagramToSvg()` muss die Erhebung abschalten** (Klasse `exporting` an `#out`,
  am Ende wieder ab): Der Export zieht die Live-Geometrie per
  `getBoundingClientRect()` nach, anders als beim `box-shadow` schlägt die
  Vergrößerung dort durch. Der **Puls** (`pulse`, Hüpfer + Ring auf dem freien
  `.node::after`) wird nur bei geändertem `caretLine` gesetzt — sonst pulst es bei
  jedem Tastendruck — und braucht das Lesen von `offsetWidth` als Neustart-Trick,
  weil dieselbe Aufgabe die Klasse vorher entfernt. Nicht über `box-shadow`
  animieren: Das löschte für die Dauer des Pulses den gelben bzw. Petrol-Kranz der
  Kombinationen. Auffindbarkeit: `setAltMode()` setzt bei gedrückter Alt-Taste
  die Klasse `alt` an `#out` (Cursor + Ring am Knoten unter dem Zeiger) — der
  `blur`-Handler ist Pflicht, sonst bleibt der Modus nach Alt+Tab hängen; dazu
  `jumpHint` im Knoten-Tooltip und `hint_jump` als letzte Zeile der Legende.
- Alt+Klick **im Textfeld** (D25, Nachtrag): `focusNodeOfCaret()` zentriert den
  Knoten der Cursor-Zeile und gibt ihm den Fokus (`focus({preventScroll:true})`
  **vor** dem Scrollen — sonst scrollt der Browser zweimal). Die Hervorhebung ist
  **dieselbe wie beim Zeilenwechsel**, Puls eingeschlossen; den Unterschied trägt
  allein der zweite Parameter `highlightCurrentNode(moved, scroll)`:
  `'nearest'` beim gewöhnlichen Zeilenwechsel (`syncCaret()`), `'center'` hier,
  `false` beim Neubau aus `render()`. Nicht wieder `false` für den Puls
  mitgeben — dann kommt die ausdrückliche Geste stiller an als das Tippen. Beim Tastaturweg
  (Alt+Enter) ist `preventDefault()` Pflicht, sonst bekommt der Text einen
  Umbruch. Die Legenden-Zeile `hint_jump` nennt **beide** Richtungen — kein
  eigener i18n-Schlüssel.
- Zeilennummern (D33): `renderLineNos()` misst die Zeilenoberkanten am
  Spiegel-`div` (`lineTops()`) — **nicht** `Zeilenhöhe × n`, das läuft beim
  ersten weichen Umbruch davon. Der Streifen scrollt nicht selbst, sondern wird
  per `translateY(-src.scrollTop)` mitgezogen (`syncLineNoScroll()`); wer
  `src.scrollTop` **selbst** setzt, muss ihn gleich mitziehen — das
  `scroll`-Ereignis kommt erst im nächsten Bild (`scrollEditorToOffset()` tut es).
  Der Spiegel braucht `box-sizing:border-box`: `src.clientWidth` enthält die
  Innenabstände, ohne das ist er 32 px zu breit und bricht später um (betraf
  vorher auch schon das Scrollen beim Sprung, D25). Der Marker ist ein
  Inline-Kasten und sitzt in seiner Zeilenbox mittig — die Zahlen müssen um
  diesen Versatz (`drop`) nach oben, sonst stehen sie durchgehend zu tief.
  Aufgerufen wird aus `render()` (dort kommt auch die Warnungsmenge her) und aus
  einem `ResizeObserver` auf `#src` (Umbruch hängt an der Breite). Markup:
  `#srcWrap` umschließt Streifen + Textfeld. `caretLine` steht **oben** bei den
  übrigen Ansichts-Variablen — der Streifen liest sie und hängt an `render()`
  (temporale Todeszone).
- Touch-Langdruck (D25): Der Timer (500 ms) setzt **nur** die Klasse `armed`
  (Petrol-Ring); `jumpToLine()` läuft im `touchend`-Handler. Nicht zurück in den
  Timer verlegen — **`focus()` aus einem Timer gilt in mobilen Browsern nicht als
  Nutzergeste**, das Textfeld verliert den Fokus sofort wieder (Symptom: die
  Markierung flackert nur auf). Gegen die native Langdruck-Auswahl braucht es
  alle drei Schichten: `contextmenu`-`preventDefault` während des Drucks,
  `user-select:none` per `@media (hover:none) and (pointer:coarse)` und
  `-webkit-touch-callout:none` (nur iOS). Synthetische `TouchEvent`s prüfen
  davon **nichts** — nur die eigene Ereignis-Logik.
- Bildschirmtastatur (D25): `jumpToLine()` setzt vor dem Fokus `inputmode="none"`
  (`keyboardOnJump(true)`) — der Sprung ist „hinschauen". Der `pointerdown`-
  Handler am Textfeld hebt das wieder auf (läuft vor dem Fokus). Wer sonst
  irgendwo `src.focus()` ergänzt und dabei Tippen meint, muss vorher
  `keyboardOnJump(false)` rufen — so wie `newDoc()`.
- Legende (D26): **kein `<details>`** — Chrome legt Details-Inhalt in
  `::details-content`, dadurch war `.hint` kein Flex-Kind mehr und ließ sich nicht
  begrenzen (Inhalt geclippt statt scrollbar). Jetzt `div.agenda` +
  `button.agenda-summary`, Zustand an der Klasse `open` (`setAgendaOpen()` hält
  Klasse, `aria-expanded`, `#legendBtn` und die Sichtbarkeit des Splitters
  zusammen). Wer hier wieder ein natives Aufklapp-Element einsetzt, bricht das
  Scrollen. Der Splitter `#hintGutter` schreibt `--hcol` (nebeneinander) bzw.
  `--hrow` (gestapelt: `side` oder mobil) an `#app`; beide werden getrennt in
  `werkbaum-ui` gesichert. Die 85-%-Obergrenze steht **zusätzlich** als
  `max-width`/`max-height` im CSS — die gespeicherte px-Größe würde den Editor
  sonst erdrücken, wenn das Panel später schrumpft.
- „Was ist neu?" (D28): `freshProdSet(prevRoots, currRoots)` in `model.js` liefert
  die Knoten, die **neu `[^]`** sind (Identität = Label-Pfad, nicht Zeile).
  `render()` bildet die Menge **bei jedem Durchlauf neu** aus den gerade
  geparsten `roots` — eine vorab berechnete Menge stammte aus einem anderen
  Parse-Durchlauf und träfe per Objektidentität nie zu (genau dieser Fehler ist
  passiert: Zähler stimmte, nichts leuchtete). Vorgehalten wird nur
  `freshPrevRoots` (Basis, einmal geparst). Basis je Dokument in `werkbaum-seen`,
  fortgeschrieben **erst beim Bestätigen** über `#freshBtn`.
- Faltmarken `>`/`<` (SPEC §1/§9, D38): Parser setzt nur `fold` ('>'|'<'|null,
  Leerraum-Regel). **Stellung ist unmittelbar vor dem Label**, also hinter der
  Statusbox (`- [x] > …`, D34-Nachtrag 2); die alte Stellung **davor**
  (`- > [x] …`) wird weiter gelesen — daher zwei Marken-Gruppen im Zeilen-Regex,
  die erste gewinnt —, aber `setFoldMark()` schreibt immer die neue und löst
  eine alte dabei auf. Wer die Gruppen anfasst: Der Rest der Zeile ist `m[6]`,
  nicht `m[5]`. Den wirksamen Anfangszustand rechnet `initialCollapsed()`
  in model.js — `<` (und die Fokusmarke) wandert die Faltung die Pfad-Ebenen
  **hinunter** statt Vorfahren bloß zu öffnen. `render()` überlagert ihn mit
  `foldOverrides` (Schlüssel = Label-Pfad via `nodeKeys()`, Sitzung, beim
  Dokumentwechsel geleert) und übergibt `collapsedSet` an den Renderer; der
  lässt eingeklappte Kinder **weg** (nicht CSS-verstecken — Export, Messungen
  und Pfadlinie bleiben so von selbst konsistent), meldet deren Warnungen aber
  weiter (`walkFolded`, zählt zugleich fürs „▸ n").
  **Auf dem günstigsten Pfad vertritt ein eingeklappter Knoten seinen
  Teilbaum** (D38-Nachtrag): `cheapCls(n, cheapSet, collapsed)` überspringt für
  ihn die Blatt-Prüfung und fragt `hidesCheap()` — sonst umginge die Pfad-Linie
  den ganzen Zweig, als wäre dort nichts zu tun. Gilt auch ohne eigene
  Pfad-Mitgliedschaft (ein per `:#…` gezogenes Ziel unter einem `+`-Knoten):
  Dann ist er der einzige sichtbare Griff darauf und zählt als `cheap`.
  `extraCls()` muss dieselbe Eingeklappt-Bedingung bilden wie `itemHtml`
  (nur mit sichtbaren Kindern). **Eine einzelne Station ist ein gültiger Pfad**
  (D38-Nachtrag 3): `drawCheapPath()` steigt nur bei **null** Stationen aus,
  die Zwei-Punkte-Schranke gilt allein der Linie (`catmullRom`) — im Export
  ebenso. Sonst verschwindet der Pfad beim eingeklappten Wurzelknoten ganz.
  **Die vorderen Overlay-Ebenen brauchen einen `z-index`** (D25-Nachtrag 3):
  `.cheap-front{z-index:5}`, `.dep-front{z-index:4}` — sonst deckt jeder
  Knoten mit eigener Stapelposition (`current` 3, `fresh`/`focusmark` 2) den
  Stationspunkt und die hervorgehobenen Dep-Kanten zu. Die **hinteren** Ebenen
  bleiben ohne, dort trägt die DOM-Reihenfolge.
  **Umklappen schreibt in den TEXT zurück** (`writeFoldToText`, D38-Nachtrag 2):
  Die Ableitung Text → Zustand ist nicht umkehrbar (mehrere Markensätze ergeben
  denselben Zustand; `<` faltet Knoten ohne eigene Marke), deshalb **minimal
  patchen und nachrechnen** — `setFoldMark()` auf die eine Zeile, dann
  `initialCollapsed()` auf dem Kandidaten gegen den Soll vergleichen; erst bei
  Abweichung alle Marken neu setzen; passt auch das nicht (z. B. `!!!` holt den
  Knoten immer hervor), gar nicht schreiben. Nie eine eigene Umkehrfunktion
  bauen — `initialCollapsed()` bleibt die einzige Stelle, die die Marken
  versteht. Geschrieben wird mit `execCommand('insertText')`: `value =` und
  `setRangeText` zerstören die Undo-Historie (gemessen). Zwei Fallen: Ein
  Textfeld mit `display:none`-Vorfahr nimmt **kein** `execCommand` an (Klasse
  `writing-fold` schaltet es kurz sichtbar), und der nötige Fokus zieht auf
  Mobil die Tastatur hoch (`keyboardOnJump(true)`). Die Überlagerungen werden
  nach erfolgreichem Schreiben geleert, sonst maskieren sie den Text. Der **Umschalter** im Diagramm-Kopf (`applyFoldPreset`, D44)
  geht denselben Weg: Überlagerungen für ALLE faltbaren Knoten setzen
  (`atMostM(n)` bzw. `false`), dann `writeAllFoldMarks()` — der aus
  `writeFoldToText()` herausgelöste Voll-Rewrite; einen minimalen Patch gibt es
  hier nicht. Ein Knoten **ohne** Größe zählt nicht als „bis M" (anders als
  bei den Pfadkosten, D18). Sein `aria-pressed` wird **in `render()` am Baum
  abgelesen**, nicht gemerkt und nicht persistiert — sonst behauptete er nach
  einem einzelnen Umklappen etwas Falsches.
  **`replaceTextUndoable()` meldet bei unveränderten Text
  `false`** (D38-Nachtrag 3): Ohne Textänderung feuert kein `input`, also läuft
  kein `render()` — der Aufrufer muss dann selbst zeichnen. Sonst bleibt das
  Bild stehen (aufgefallen beim Aufklappen eines nur per Überlagerung
  gefalteten Knotens: der Klick tat sichtbar nichts mehr). Umklappen: Klick aufs
  `.fold`-Zeichen (preventDefault — es sitzt bei Link-Knoten im `<a>`) oder
  ←/→ am fokussierten Knoten; nach `render()` den Fokus per `data-line`
  wiederherstellen. Export/Druck: „▸ n" bleibt, das ▾ offener Knoten fällt weg
  (`stripFold` in `diagramToSvg`, Print-Regel `.node:not(.folded) .fold`).
- Knoten-IDs `#name` (SPEC §1/D36): nur **alleinstehend angesetzt** und nur
  der **erste** Treffer der Zeile (kein `/g`!) — weitere `#`-Token bleiben im
  Label (reservierte Ticket-Referenzen), und `:#a,#b` (künftige Abhängigkeiten)
  darf nicht gefressen werden. Zeichenmenge wie `@name`. Doppelte ID →
  `{type:'duplicateId', line, id, firstLine}`; die spätere gilt trotzdem.
  Keine eigene Darstellung — nur Tooltip (erste Position) und `a11yId`.
  **Übliche Schreibweise ist `#id: Titel`** (D36-Nachtrag): Der trennende
  Doppelpunkt ist optional, gehört weder zur ID noch zum Label und fällt beim
  Parsen weg — sonst wären `#auth` und `#auth:` zwei Adressen. Geschluckt nur
  mit folgendem **Leerraum oder Zeilenende**, sonst bliebe von `#auth:#db` die
  Abhängigkeit nicht übrig. Die ID-Erkennung selbst NICHT verschärfen: ein
  verlangtes `(?=\s|$)` hinter der ID deutet bestehende Zeilen um (der Ausdruck
  wandert bei Fehlschlag weiter und erklärt ein späteres `#`-Token zur ID).
  Der Block-Kopf im Beschreibungsteil nimmt den Doppelpunkt ebenfalls an.
- Abhängigkeiten `:#a,#b` (SPEC §1/D37): EIN zusammenhängendes Token ohne
  Leerraum, nur **alleinstehend angesetzt** — `(:#a,#b)` bleibt Label
  (Zitier-Konvention wie `(#auth)`). `node.deps` sind **ID-Strings**, keine
  Knoten-Referenzen; der Parser prüft nur Existenz (`unknownDep`), Zyklen
  werden bewusst nicht einmal erkannt (zulässig, „gemeinsam fertig"). Keine
  Diagramm-Darstellung — nur Tooltip (`→ #a, #b`) und `a11yDeps`.
- Querverbindungen (SPEC §9, D41): `drawDepLinks()` zeichnet die
  Abhängigkeits-Kanten als Overlay-SVGs (wie `drawCheapPath`, `/zoom`
  umrechnen) aus den Renderer-Attributen `data-id`/`data-deps` — gekrümmt
  und GEPUNKTET (doppelt unterschieden von den orthogonalen Baumlinien,
  D41-Nachtrag), blassgrau hinter den Knoten, Pfeil aufs Gebrauchte; Hervorhebung (Fokus bzw. Cursor-Zeile,
  `activeDepNode()`) in Tinte auf der vorderen Ebene. Aufgerufen aus
  `highlightCurrentNode()` (läuft in jedem `render()`), `applyLayout()` und
  den focusin/focusout-Handlern — NICHT doppelt in `render()` einhängen.
  Export zeichnet nur die Basis-Kanten (Schritt 1a).
- Effektiver Status (SPEC §4/§9, D39): `effectiveStatus(roots)` in model.js
  liefert NUR die Diskrepanzen (Map Knoten → effektiver Status-Key; Minimum
  des Fortschritts-Rangs über die Abhängigkeits-Hülle, Fixpunkt — Zyklen
  teilen ihr Minimum, erste ID-Vergabe gewinnt). Der Renderer färbt dann
  `st-<effKey>` statt des intrinsischen und hängt die Marke
  `.chip.ownst.st-<ownKey>` (eigene Statusbox, eigene Farben) unten links an —
  im Export via `drawBadge`, aus dem Label-Klon entfernen (`.ownst`). XOR-
  „realisiert" (Parser) und „Was ist neu?" (`[^]` im Text) bleiben bewusst
  **intrinsisch**.
- XOR-Gruppen `=` (SPEC §3/D35): Der Parser setzt `type:'xor'` (nur mit
  folgendem Leerraum — `=SUMME(…)` bleibt Label); der Renderer gibt
  `<ul class="or xor">` aus, damit die **gesamte** any-of-Geometrie (alle drei
  Modi, D18-Sonderfälle, Export-Routing) automatisch gilt — `.xor` ergänzt nur
  die „1"-Plakette (`ul.xor::after`, im Export `xorMarks`). Disjunktiv-Abfragen
  auf `gateOf` prüfen `!== 'and'`, nie `=== 'or'`. Die `xorConflict`-Warnung
  (mehr als eine realisierte Alternative: `[~]`/`[/]`/`[x]`/`[^]`) entsteht im
  **Parser** (Post-Pass), nicht im Renderer.
- Optionale Knoten `+` (D29): Der Parser setzt **`optional:true` und lässt
  `type:'and'`** — `+` gehört zum Knoten, nicht zur Gruppe. Deshalb bleiben
  `gateOf()` und die `mixedGate`-Warnung unverändert richtig (sie meldet nur
  `|` neben `-`/`+`). Aus dem günstigsten Pfad fallen optionale Knoten über
  **`pathChildren()`** heraus — die eine Stelle, die `cheapestCost()` und
  `markCheapest()` gemeinsam nutzen; deshalb wirkt sie samt Teilbaum. Der hohle
  Kreis ist `.node.opt::before`: **Grundfall links/50 %** (gestapelt), Ausnahme
  **oben/50 %** im horizontalen Fächer, Rück-Ausnahme wieder links für
  `ul.or>li.has-and>ul.and>li` (D18). Im SVG-Export muss er **nach** den Knoten
  gezeichnet werden (`optMarks`, Schritt 3a) — er liegt halb außerhalb der Box
  und würde sonst vom Knoten-Rechteck überdeckt. Der **Abzweig** ist zusätzlich
  gestrichelt (Tinte); dafür trägt auch das **`<li>`** die Klasse `opt`, denn den
  Abzweig zeichnen dessen Pseudoelemente. Gestrichelt wird nur die Kante zum
  Knoten, nie die Sammelleiste — im Fächer `border-left`/`-right`, gestapelt
  `border-top`.
- Treppe optionaler Endknoten (D29, Nachtrag 3): `applyOptStairs()` gruppiert
  **in app.js**, nicht im Renderer — die DOM-Ebene `li.opt-group > ul.opt-stair`
  gibt es semantisch nicht und müsste in den drei übrigen Anordnungen wieder
  neutralisiert werden. Deshalb: nur im Fächer bauen, beim Moduswechsel
  auflösen (die Funktion räumt immer zuerst auf, `applyLayout` arbeitet auf dem
  bereits gruppierten Baum). Reihenfolge: `applyOptStairs()` **vor**
  `alignStems()`/`drawCheapPath()`, es verschiebt Knoten. Bedingung ist „`<li>`
  hat genau ein Element-Kind, und das ist der Knoten" — also kein Teilbaum und
  kein Geister-Knoten, weil die Stufengeometrie Zellenhöhe == Knotenhöhe
  voraussetzt. Der SVG-Export hängt nur die **erste** Stufe an die Leiste und
  zieht die übrigen als Winkelkette nach; flach eingereiht lief die Linie zur
  dritten Stufe hinter der zweiten hindurch.
- `--stem-x` (D29, Nachtrag 2): Im horizontalen Fächer sitzt der Stiel bei 50 %
  des `<li>`. Das ist nur dann die Knotenmitte, wenn der Knoten in der Zelle
  zentriert steht — `li.has-or` ist aber linksbündig und die Zelle so breit wie
  der any-of-Teilbaum. `alignStems()` misst deshalb nach jedem `render()` (und
  in `applyLayout`) die Knotenmitte und setzt `--stem-x`; Fallback im CSS ist
  `50%`. Messwerte durch `zoom` zurückrechnen, sonst stimmt es nur bei 100 %.
  **Beim einzigen Kind trägt keine Sammelleiste** (`:only-child` schaltet sie
  ab): Der Stiel aus dem Elternknoten sitzt bei 50 % der Gruppe, der zum Kind
  bei `--stem-x` — fallen die auseinander, riss die Linie ab (D29-Nachtrag 4).
  Die `:only-child`-Regeln ziehen deshalb ein Leiterstück zwischen beide und
  müssen **hinter** den first/last-Regeln stehen: Ein einziges Kind ist auch
  das letzte, und bei gleicher Spezifität gewinnt die spätere Regel — genau
  daran war `:only-child::after` jahrelang wirkungslos.
- `--vrail-ext` (D65): Im **vertikalen** Modus dockt der Eltern-Stub bei 50 %
  der Gruppenhöhe an, die Sammelleiste endet aber am 23-px-Abzweig des letzten
  Kindes — trägt das einen großen Teilbaum, liegt die Gruppenmitte darunter
  und der Stub hinge in der Luft. `alignVRails()` (läuft an denselben drei
  Stellen wie `alignStems()`) misst das und verlängert die Leiste per
  `--vrail-ext`; das **einzige** Kind löst CSS allein
  (`:only-child::after{top:23px;height:calc(50% - 23px)}` — dort ist
  Gruppenhöhe == Kindhöhe). Kein `border:0` mehr am nicht-has-and-Einzelkind:
  Genau das war die Lücke („kurze vertikale Linien fehlen"). has-and-Kinder
  brauchen beides nie (Abzweig bei 50 % der Zelle). Wer an den
  vertikalen first/last/only-Regeln dreht, prüft mit dem Geometrie-Scanner
  (Pseudo-Element-Rects: Leisten-Segmente vs. Stub-Höhe) statt mit dem Auge.
- Kleiner Bildschirm: `body.mobile` (per `matchMedia`, ≤ 640 px) zeigt **genau
  einen** Bereich — `body.pane-diagram` bzw. `body.pane-text`, umgeschaltet über
  je einen festen Knopf pro Titelzeile (`#paneToText`/`#paneToDiagram`,
  `setMobilePane()`); kein Splitter, keine Fenster-Buttons (D17-Nachtrag).
  **Nur der Umschalter darf den Bereich wechseln** — im alten Splitter-Modell
  kostete ein Tipp auf die Diagramm-Titelzeile (49-px-Streifen über dem Text)
  den Editor; genau das war der gemeldete Fehler (D17-Nachtrag 3). `#paneToDiagram`
  ruft `focusNodeOfCaret()`, wenn die Cursor-Zeile einen Knoten hat: Das ist die
  **einzige** Touch-Navigation Text → Diagramm (Alt gibt es dort nicht). Keinen
  langen Druck ins Textfeld legen — der gehört dem OS (Wortauswahl,
  Auswahlgriffe), anders als im Diagramm, wo D25 ihn sich nehmen konnte.
  **Die Titelzeile muss einzeilig bleiben** (`body.mobile .panel-head`:
  `gap:8px`, `padding-inline:10px`, `flex-wrap:nowrap` — D17-Nachtrag 5). Beim
  Prüfen eines neuen Kopf-Knopfes den **`#freshBtn` einblenden**: Er ist
  serienmäßig `hidden` und erscheint nur bei fremden Dokumenten mit Neuem —
  genau er brachte die Zeile zum Umbrechen, und ohne ihn sieht die Messung
  heil aus. Nicht die Knöpfe verkleinern (29 px sind Fingergröße), sondern die
  Lücken; bis 320 px reicht es gemessen.
- `--app-height` (`setAppHeight()`, D17-Nachtrag 4): `body{height:var(--app-height)}`
  kommt aus `visualViewport.height` — nötig gegen überlagernde Browserleisten
  (Brave). **Die Bildschirmtastatur verkleinert denselben Wert** und quetschte
  damit den Editor zusammen, sobald der Cursor ins Textfeld kam (Textfeldhöhe =
  `--app-height` − ~206 px feste Aufbauten; bei 260 px Viewport bleiben 54 px).
  Deshalb die Fokus-Sperre `editingNow()`: Solange ein editierbares Feld den
  Fokus hat, bleibt die letzte tastaturfreie Höhe stehen. Tastatur und
  Browserleiste sind an den **Zahlen** nicht zu unterscheiden (beide: `vv.height`
  fällt, `innerHeight` bleibt) — nur am Fokus. `orientationchange` ruft
  `setAppHeight(true)` und durchbricht die Sperre; der `focusout`-Timer muss
  `() => setAppHeight()` sein, sonst reicht er ein wahres `force` durch.
  **Nur auf echten Geräten sichtbar** — in der Emulation gibt es keine Tastatur.
  **Der verborgene Bereich ist `display:none` und misst sich damit zu null** —
  `setMobilePane()` MUSS neu zeichnen: zum Diagramm hin dieselben vier Schritte
  wie `applyLayout` (`applyOptStairs`/`alignStems`/`drawCheapPath`/
  `drawDepLinks`), zum Text hin `renderLineNos()`. Ohne das ist nach dem Tippen
  im Textbereich die Pfad-Linie weg (gemessen). Die Sprünge (D25) schalten den
  Bereich selbst um: `revealEditor()` auf Text, `focusNodeOfCaret()` aufs
  Diagramm — **vor** dem Zentrieren. Zustand in `werkbaum-ui` (`mobilePane`),
  Variable oben deklariert (saveUI liest sie).
  `applyLayout` ruft auf Mobil **kein** `applySplit`.
  **Inhalte ~25 % kleiner** (D17-Nachtrag 2): `MOBILE_ZOOM = 0.75` als **Faktor**
  auf den Nutzer-Zoom — `effZoom()` ist die Wahrheit, die `applyZoom()` setzt und
  die die drei Messstellen (`alignStems`, `drawCheapPath`, `drawDepLinks`)
  zurückrechnen; wer dort wieder `zoom` einsetzt, verschiebt Linien und
  Stationspunkte. `applyMobile()` ruft `applyZoom()` in **beiden** Zweigen, sonst
  bliebe der Faktor beim Wechsel auf Desktop stehen. Der **Text** bekommt kein
  `zoom`, sondern `font-size` (Streifen und Textfeld gemeinsam) — Spiegel und
  `ch`-Breite hängen an der Schriftgröße (D33). **`diagramToSvg()` stellt den
  Zoom für die Messung auf 1**: Die Schriftgrößen im Ausgabe-SVG sind feste
  Zahlen, die Kästen gemessen — bei Zoom ≠ 1 passt sonst beides nicht zusammen
  (galt schon vorher, wurde durch den Mobil-Faktor nur zum Regelfall).
  Dazu eigener Legenden-Umschalter
  (`#legendBtn`), schlanke Sprachwahl, Download-Overlay; Default Vollbild +
  Diagramm maximiert. Layout-CSS hängt an `body.mobile`, nicht an einer eigenen
  `@media`-Regel — beide Seiten müssen denselben 640-px-Schwellwert nutzen
  (SPEC §9, D17).
- **Update-Prüfung (D45):** verglichen wird der Commit aus dem
  Footer-Versionslink der **laufenden** Seite (`runningBuildId()`, DOM) gegen
  den aus der abgerufenen HTML (`buildIdFromHtml()`). Kein localStorage
  dazwischen — `werkbaum-update-available`/`werkbaum-html-hash` werden **nicht
  mehr geschrieben** (der Reset räumt sie nur noch weg). Wer hier etwas
  „merken" will: Genau das war der Fehler — ein gemerktes „Update verfügbar"
  überlebt das Neuladen, das es einspielt, und meldet dieselbe Fassung endlos
  weiter. Beim Laden wird deshalb **nichts** gemeldet; die Prüfung nach zwei
  Sekunden holt es nach. Zum Testen: Auf dem Dev-Server steht im Footer der
  Platzhalter `…/commit/main` (keine Commit-Kennung) — dort läuft der
  Hash-Rückfall, der Marker-Pfad ist nur zu prüfen, wenn man einen echten
  `commit/<sha>` in `index.html` einspritzt (danach zurücknehmen!) und
  `window.fetch` überschreibt.
- **PWA (D73):** `public/sw.js` fasst NUR die Navigation zur App-Wurzel an
  und beantwortet sie **network-first** — der Cache ist reiner
  Offline-Rückfall. Wer daraus cache-first macht, bricht die Update-Prüfung
  (D45): deren `fetch()` läuft nur deshalb ans echte Netz, und „Jetzt laden"
  bekommt nur deshalb die frische Fassung. Keine Registrierung im Dev-Server
  (`!import.meta.env.DEV` — sonst cacht der Worker die HMR-Seite). Manifest,
  Icons und `sw.js` sind public/-Assets neben der einen Datei; **jedes neue
  public/-Asset muss in BEIDE Deploy-Wege** (pages.yml und deploy-prod.sh
  stellen die Site je von Hand zusammen) und ggf. in `scripts/prod.htaccess`
  (Apache kennt `.webmanifest` nicht, D43-Falle). Der `launchQueue`-Empfänger
  (Dateidoppelklick der installierten App) reicht Handles an `adoptFile()`
  (D72) weiter — Installieren/Doppelklick sind nur auf echter Hardware
  prüfbar.
- **Neuigkeiten (D58):** `NEWS` kommt aus dem virtuellen Modul
  `virtual:werkbaum-news` (Vite-Plugin in `vite.config.js`), gefüllt zur
  **Bauzeit** aus `docs/CHANGELOG.md` (die Notizen) und der git-Historie des
  mitgelieferten Plans (die Knoten je Tag). Die Regeln stehen in
  `scripts/news.mjs` und sind getestet; `app.js` verdrahtet nur. Drei Dinge, die
  beim Anfassen auffallen: Der **Dev-Server liest einmal beim Start** — neue
  Changelog-Zeilen erscheinen erst nach einem Neustart, nicht per HMR. Ein
  vorgeführter Tag muss **nach** `switchDoc()` gesetzt werden, denn das räumt
  ihn ausdrücklich weg. Und die Backtick-Ersetzung läuft **nach** `esc()`, damit
  aus einer Changelog-Zeile kein Markup werden kann. Ein Feature ohne Zeile in
  `docs/CHANGELOG.md` geschieht für den Benutzer unsichtbar (Regel in der
  Wurzel-CLAUDE.md).
- **Titelzeilen tragen die Aufklapp-Menüs — kein `overflow` daran (D50):**
  `.dlmenu` und das Snapshot-Menü hängen als absolut positionierte Kinder im
  `.panel-head` (`#docMenu` seit D81 im App-Kopf — dort gilt dasselbe). Ein
  `overflow` dort macht ihn zum Scroll-Container und klippt
  sie; `overflow-x` hebt dabei das `visible` der **anderen** Achse auf `auto`,
  geklippt wird also nach unten — genau dorthin, wo die Menüs aufklappen. Ein
  Scroll-Container klippt unabhängig davon, ob er überläuft, der Fehler trifft
  also jede Breite. Er ist rein geometrisch **nicht** zu sehen: Kopfhöhe und
  Knopfpositionen bleiben korrekt. Prüfen heißt hier: Menü öffnen und mit
  `elementFromPoint` nachsehen, ob man es trifft.
- **Diagramm-Kopfzeile auf Mobil (D17-Nachtrag 5, D47, D50):** Die Zeile ist
  voll — bei 375 px bleiben mit neun Bedienelementen noch 14 px Luft, bei
  320 px passt es arithmetisch nicht mehr und die Zeile **bricht um**
  (`@media (max-width:360px)`, zwei Reihen zu 78 px). Wer ein zehntes Element
  hinzufügt, misst nach (`scrollWidth - clientWidth` am `.panel-head`) und
  rechnet damit, dass auf 375 px etwas weichen muss.
  Nicht anfassen: die 29 px Knopfgröße (Fingerziel) und `flex:0 0 auto` an den
  Kindern — ohne das schrumpft bei Platzmangel ausgerechnet der Modus-Wähler
  (das einzige Element ohne feste Größe) auf einen 2-px-Strich, während sein
  Icon darüber hinausragt. Das sieht aus wie ein Trennstrich und ist
  unbenutzbar.
- **Die drei Touch-Gesten am Knoten (D25, D38, D52)** teilen sich `touchstart`/
  `touchend` und werden am vorhandenen Zustand unterschieden: `armedEl` gesetzt
  (500 ms um) ⇒ Sprung, Timer läuft noch ⇒ kurzer Tipp ⇒ Knoten-Fenster, beides
  weg (jedes `touchmove` räumt auf) ⇒ es wurde gescrollt ⇒ nichts. Kein eigenes
  Merkerfeld nötig. Wer hier eine vierte Geste einhängt, denkt an das
  **Falt-Zeichen**: Es ist ausgenommen, weil das Fenster `preventDefault()`
  braucht (sonst öffnet ein Link-Knoten zusätzlich seine URL) — und das
  verschluckt den Klick, mit dem gefaltet wird.
- **Das Knoten-Fenster liegt auf `<body>`, nicht in `#out` (D52):** In `#out`
  erbte es dessen CSS-`zoom` und würde von dessen `overflow` beschnitten (D50).
  Es schließt bei allem, was seine Aussage hinfällig macht — Tipp daneben,
  zweiter Tipp, Esc, ×, Diagramm-Scroll, Bereichswechsel, Sprung in den Text,
  `render()`. Die letzten drei sind beim Bauen zuerst vergessen worden.
- **Das Knoten-Fenster öffnet auf Klick, nie auf Hover (D92):** Der einfache
  Klick toggelt es überall (auch auf Link-Knoten — die URL ist der ↗-Knopf im
  Fenster; Enter kommt als Klick mit `e.detail === 0` und wird durchgelassen).
  Zwei Fallen: `focusin` öffnet nur bei `:focus-visible` — der Mausklick
  fokussiert den Knoten ebenfalls, und ohne die Weiche schlösse der
  Klick-Toggle das vom focusin geöffnete Fenster sofort wieder. Und
  `focusout` schließt nicht, wenn `relatedTarget` im Fenster liegt — die
  Knöpfe darin sind trotz `tabindex="-1"` klick-fokussierbar, sonst stirbt
  der Knopf-Klick zwischen mousedown und mouseup.
- **Taiga-Ticket-Anlage (D91):** Die entscheidbaren Regeln liegen headless in
  `taiga.js` (`ticketRefOf` = Idempotenz-Marker, `taskCandidates` =
  Dialog-Vorbelegung, `storyAncestor` = der nächste Vorfahr mit Story-Ref,
  `appendToken` = Token vor `%%` und vor der Fortsetzungsmarke ` \`); die
  `taiga.*`-Vererbung rechnet `taigaSlugs()` in model.js. app.js verdrahtet:
  `refreshTaiga()` fragt je Basis EINMAL `GET /info` (`taiga`-Flag; Aufruf
  aus Boot und `followActiveDoc`), `appendTaigaActions()` hängt die Knöpfe
  ins Knoten-Fenster (nur ohne vorhandene Ref): `taigaCreate()` = Login →
  Projekt-Dialog samt Häkchen → Anlegen → Ref-Rückschreiben; `taigaTask()`
  (D91-Nachtrag 9) legt unter einem Story-Vorfahren dialogfrei eine Task an
  — nur wenn der geerbte Slug am Knoten der des Vorfahren ist, sonst löste
  die Ref später gegen das falsche Projekt auf; `taigaLink()`
  (D91-Nachtrag 11) verknüpft ein BESTEHENDES Ticket — `parseTicketInput`
  (URL/Ref/nackte Nummer) und `foreignTaigaUrl` (fremde Instanz) headless,
  die nackte Nummer wird per Probe Story-dann-Task aufgelöst, der Betreff
  steht im Dialog, bevor Ok freigibt. Geschrieben wird über
  `replaceTextUndoable` (Fokus/Undo/Schreibmarke, D53) — nie `src.value =`.
  Das Token liegt als `werkbaum-taiga` im localStorage (nur Token, nie ein
  Passwort); ein 401 löscht es und fragt neu. Fehler erscheinen IM Dialog,
  nicht als `window.alert` (in manchen Kontexten unterdrückt, D22-Lehre).
- **Ticket-Stand lesen (D91-Nachtrag 6):** `ticketApiPath()` baut den
  Proxy-Pfad (getrennte by_ref-Endpunkte je Typ, Slug kodiert),
  `mapTaigaStatus()` bildet Taigas Statusnamen auf `STATUS_BY_CODE` ab —
  beides headless in `taiga.js`, denn die Statuscodes sind Notation und das
  Backend parst sie nicht (D14); ein unbekannter Name bleibt **null**.
  In app.js: `ticketBox()`/`paintTicket()`/`loadTicket()` samt Cache
  `taigaTickets` (je Ticket EIN Abruf je Sitzung, ↻ holt neu) und
  `TICKET_DELAY` (400 ms Verweilen, bevor überhaupt gefragt wird — das
  Fenster öffnet beim Überfahren und beim Tabben). **Ohne Sitzung wird nichts
  automatisch geholt**, der Knopf meldet erst an. `tipTicket`/`ticketTimer`
  stehen oben bei `tipNode`, weil `closeNodeTip()` sie mit wegräumt (das
  läuft schon beim Aufbau — sonst temporale Todeszone). Der
  `pointerdown`-Wächter lässt `.tabmodal-overlay` durch: Der Anmelde-Dialog
  gehört zu einer Aktion AUS dem Fenster und darf es nicht zumachen.
- **Abweichungs-Marken im Diagramm (D91-Nachtrag 10):** `collectTicketRefs`,
  `bulkPath` (dedupliziert, Deckel 200), `ticketDiverges` und
  `refVisibleInLabel` liegen headless in taiga.js. app.js: `scheduleTaigaBulk`
  holt je Slug EINMAL je Sitzung (nur mit Sitzung; Hintergrund-Fehler still),
  füllt den `taigaTickets`-Cache vor und rendert — außer ein Knoten-Fenster
  ist offen (der Neubau schlösse es), dann nur `markTicketDiffs`
  (Klassen-Marken, räumt erst ab). Wo die Ref die **Knoten-ID** ist, steht
  sie nicht im Label — der **Renderer** hängt dann ein `tref-badge` an
  (`tdiffRefs`-Option, die D40-Bauform der ”-Marke: vor dem Messen, die
  Geometrie stimmt). Nicht im Export (`excludeSel` + Label-Farbe kommt vom
  Knoten), nicht im Druck, nicht im `aria-label` (benannte Grenze: der
  Screenreader-Weg ist das Knoten-Fenster).
- **Status zurückschreiben (D91-Nachtrag 7/8):** Weicht der Ticket-Status von
  der Statusbox ab, zeigt `paintDiff()` beides und bietet **zwei** Knöpfe —
  von selbst geschieht in keine Richtung etwas. `pushStatus()` sucht die
  Spalte des Projekts (`statusListPath` → `pickStatus`, je Sitzung gecacht;
  Taiga schreibt nach **Id**, nicht nach Namen) und patcht mit der zuletzt
  GELESENEN `version` — Taigas optimistische Sperre; ein Konflikt kommt als
  Fehlerzeile ins Fenster, überschrieben wird nie. `pullStatus()` schreibt
  die Box über `setStatusBox()` (parser.js, Text→Text neben `setFoldMark`)
  und `writeLine()`/`replaceTextUndoable` in die Zeile — der Neubau schließt
  danach das Fenster. Schreibbar sind nur die fünf abgebildeten Zustände
  (`taigaStatusName`); `[?]`, `[!]`, `[-]` und der neutrale Knoten bekommen
  keinen Knopf, sondern die Begründung.
- **Ein gerades `"` in einem i18n-Text zerlegt den Bundle** — und `npm test`
  merkt es NICHT: Die Testsuite importiert `app.js` nie (sie prüft die
  Module), gesehen hat es erst der Dev-Server (500er, weißes Bild). Deutsche
  Anführungszeichen also typografisch schreiben (`„…“`) und die Datei nach
  einer i18n-Runde einmal mit `npx esbuild src/app.js --outfile=/tmp/x.js`
  prüfen — die schnellste ehrliche Syntaxprobe für eine Datei ohne Test.
- **Nie `src.value = …` während des Bearbeitens (D53).** Es löscht die
  Undo-Historie des Textfelds **komplett** — nicht nur den eigenen Schritt,
  sondern alles davor Getippte. Gemessen: nach so einem Schreiben ändert das
  erste `undo` nichts und das zweite liefert `false`. Jede Änderung am Text des
  **aktuellen** Dokuments geht deshalb über `execCommand('insertText')`
  (`replaceTextUndoable()` für ganze Texte, `writeAt()` für Bereiche).
  `src.value =` ist nur beim **Laden eines anderen** Dokuments richtig
  (`loadActiveIntoEditor`, Dokumentwechsel, URL-Abruf) — dorthin gibt es nichts
  zurückzunehmen.
- **ID-Vorschläge `:#` (D63):** Die Regeln stehen headless in `autocomplete.js`
  (`depFragment`/`collectIds`/`matchIds`, Tests); app.js verdrahtet nur Popup,
  Tasten, Einfügen (`writeAt`, undo-fähig). Daneben liegen `depIdAt`/`idLine`
  (D67): Strg/Cmd+Klick bzw. Strg+Enter im Textfeld springt von einer
  Abhängigkeits-ID zur Zeile ihrer ersten Vergabe — die Schreibmarke ist der
  Treffer (`selectionStart`), kein eigenes Hit-Testing. Ein synthetischer
  Strg+Enter der Automatisierung kommt mit `e.key === ""` an (Werkzeuggrenze
  wie beim synthetischen Strg+Z) — mit korrekt gebautem `KeyboardEvent`
  prüfen. Der Tasten-Handler hängt an
  `document` in der **Capture-Phase** — die Textfeld-Handler (Tab rückt ein,
  Esc löst die Tab-Falle, D53) sind früher registriert und kämen sonst zuerst;
  `stopPropagation` hält sie nur bei **offener** Liste heraus. `acSuppress`
  hält denselben Kontext nach Übernahme/Esc geschlossen — ohne das öffnet ihn
  das nächste keyup sofort wieder. Popup auf `<body>` mit `position:fixed`
  (Klipp-Falle D50, wie das Knoten-Fenster).
- **Undo lässt sich hier nicht per Tastendruck prüfen.** Ein synthetisches
  `ctrl+z` aus der Automatisierung löst **kein** natives Undo aus (gemessen:
  Text unverändert), während `document.execCommand('undo')` im selben Moment
  greift. Wer Undo prüft, nimmt `execCommand('undo')` — sonst hält man eine
  Werkzeuggrenze für einen Befund. Dieselbe Lehre wie D25 und D17-Nachtrag 4.
