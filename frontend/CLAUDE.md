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
  Vertikal + kompakt teilen die transponierte Basis-CSS; nur vertikal
  bekommt den Rechts-Ausgang für „all of“, kompakt führt auch „all of“
  nach unten. Any-of ist in allen Modi grau: Linien gestrichelt grau und
  Alternative-Rahmen grau (Basis-CSS `ul.or`). Kein Petrol im Diagramm mehr;
  `var(--or)` nur noch für UI-Akzente/Logo (SPEC §9, D15).
- Extraktionsreihenfolge im Parser nicht umstellen: Kommentar → Zeichen/
  Status → URL → Größe → Tags (sonst kollidiert `@` in URLs).
- Fehlertoleranz (SPEC §4): der Parser erfasst die Statusbox als *beliebiges*
  Einzelzeichen `\[([^\]])\]` und validiert gegen `STATUS_BY_CODE`; unbekannte
  Codes → `parse().warnings` als `{type:'unknownStatus', line, code}`, Knoten
  neutral. `render()` in app.js führt Parser- und Renderer-Warnungen zusammen
  (nach Zeile sortiert) und zeigt sie via `formatWarning` (warnings.js). Neue
  Warnungstypen dort + i18n-Key in allen 9 Sprachen ergänzen.
- Modulteilung (D19): `parser.js` (Text→Baum, headless), `model.js` (Baum-/
  Kostenlogik: `gateOf`, `needsBreakdown`, `visibleChildren(n, showDiscarded)`,
  `computeCheapSet`, `cheapCls`), `render.js` (HTML-String via
  `renderTreeHtml(roots, {t, showDiscarded, cheapPath, cheapSet})`, headless),
  `app.js` (DOM/Events/i18n/Persistenz/Export). Modell/Renderer bekommen UI-State
  (verworfene einblenden, Pfad an/aus) als **Parameter** — keine Globals; nur
  `cheapPathOn` lebt als UI-State in `app.js`. Tests: `tests/*.test.js`.
- Günstigster Pfad: `markCheapest()`/`cheapestCost()` (in `model.js`) markieren
  die nötigen Knoten (Klassen `cheap`, `cheap-leaf`); `drawCheapPath()` (app.js)
  zeichnet nach jedem
  `render()` **und** nach `applyLayout()` zwei Overlay-SVGs in `#out` (hinten
  kräftige Linie, vorne abgetönte Kopie + Stationspunkte). Overlays erben den
  CSS-`zoom` von `#out`, Punkte in unskalierte `#out`-Koordinaten umrechnen
  (`/zoom`). `diagramToSvg()` zeichnet dieselbe Linie/Punkte nach (SPEC §9, D18).
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
- Zustand wird im `localStorage` gehalten (noch kein Backend): `werkbaum-lang`
  (Sprache), `werkbaum-docs` (JSON-Array der Dokumente `[{id,name,text}]`),
  `werkbaum-active` (id des aktiven Dokuments), `werkbaum-src` (Spiegel des
  aktiven Texts, Abwärtskompatibilität), `werkbaum-ui` (JSON: Modus, verworfene,
  günstigster Pfad, Split-Zustand inkl. `--col`/`--drow`, Zoom, Vollbild). Neue
  GUI-Einstellungen in `saveUI()`/`restoreState()` mitführen; `saveUI` liefert
  während `restoring===true` nichts, damit das Wiederherstellen nicht sofort
  zurückschreibt.
- Dokumente (D22): mehrere umschaltbare Notationstexte. `loadDocs()` migriert bei
  fehlendem `werkbaum-docs` den bestehenden `werkbaum-src` (oder `INITIAL`) in
  **ein** Dokument; `initDocs()` (Aufruf **nach** `applyLang`) holt den aktiven
  Text in den Editor. `saveSrc()` schreibt den Editortext ins aktive Dokument.
  Der Wähler ist ein Dropdown in der Editor-Titelzeile (`#docTrigger`/`#docMenu`,
  ersetzt die frühere feste „Struktur (Text)"-Beschriftung); Wechseln/Neu/
  Umbenennen/Löschen in `switchDoc/newDoc/renameDoc/deleteDoc`. Jedes Dokument ist
  nur Text + Name (kein Strukturformat, D14) — vorwärtskompatibel zum Backend
  (D13). Ansichts-State (`werkbaum-ui`) bleibt global über alle Dokumente. Ein
  leerer Editortext bleibt leer.
- Beispiel-Dokument (D22): reservierte id `EXAMPLE_ID = 'example'`, fester
  englischer Name `EXAMPLE_NAME = 'Example'` (nicht lokalisiert). `loadDocs()`
  adoptiert einen Alt-Zustand (zufällige id, „Beispiel") nur, wenn dessen
  `text === INITIAL` (nie echte Nutzerinhalte). `resetToDefaults()` setzt **nur**
  das Beispiel-Dokument (id `example`) auf `INITIAL`/„Example" zurück und verwirft
  `werkbaum-ui`/`werkbaum-lang`/Update-Flags — **andere Dokumente bleiben stehen**
  (nicht mehr pauschal alle `werkbaum-*` löschen!). Das letzte gelöschte Dokument
  wird als Beispiel neu gesät.
- Umbenennen ist **inline** (kein `window.prompt` — in manchen Browser-Kontexten
  unterdrückt): `renameDoc()` setzt `renamingId`, `renderDocMenu()` rendert dann
  ein `<input class="docrename">` (Enter = `commitRename`, Esc = `cancelRename`,
  Blur = commit). Doc-Namen sind Nutzerdaten und werden **nicht** übersetzt.
- Kleiner Bildschirm: `body.mobile` (per `matchMedia`, ≤ 640 px) stapelt
  Diagramm/Editor mit **stufenlosem** Splitter (kein Snap/Collapse wie auf
  Desktop): der Gutter-Drag ruft `setMobileDrow()` (klemmt `--drow` zwischen den
  Kopfhöhen `--pmin-d`/`--pmin-e`, per `syncPanelMins()` gemessen), ein Tipp auf
  eine Titelzeile maximiert das Panel. `applyLayout` ruft auf Mobil **kein**
  `applySplit` (das würde `--drow` löschen). Dazu eigener Legenden-Umschalter
  (`#legendBtn`), schlanke Sprachwahl, Download-Overlay; Default Vollbild +
  Diagramm maximiert. Layout-CSS hängt an `body.mobile`, nicht an einer eigenen
  `@media`-Regel — beide Seiten müssen denselben 640-px-Schwellwert nutzen
  (SPEC §9, D17).
