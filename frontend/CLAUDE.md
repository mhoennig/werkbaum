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
- `node_modules/` und `dist/` sind ge-`.gitignore`-t; `package-lock.json` ist
  eingecheckt (der Workflow nutzt `npm ci`).

## Konventionen
- Vanilla HTML/CSS/JS, ES-Module; keine Frameworks. Testwerkzeug: Vitest.
- Parser und Renderer müssen headless (ohne Editor-UI) nutzbar bleiben —
  Basis für SVG-Export und Mermaid-Plugin (docs/ROADMAP.md). `app.js` ist der
  DOM-/UI-Einstieg; reine Logik gehört in `parser.js`/`model.js`/`render.js`.
- Design: Farben/Typografie beibehalten (CSS-Variablen, IBM Plex);
  Statusfarben sind in SPEC §4 normiert. Marke nach ../brand/BRAND.md;
  Pastelltöne nie im Logo.

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
- Günstigster Pfad: `markCheapest()`/`cheapestCost()` markieren die nötigen
  Knoten (Klassen `cheap`, `cheap-leaf`); `drawCheapPath()` zeichnet nach jedem
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
- Zustand wird im `localStorage` gehalten (noch kein Backend): `werkbaum-lang`
  (Sprache), `werkbaum-src` (Editortext), `werkbaum-ui` (JSON: Modus,
  verworfene, günstigster Pfad, Split-Zustand inkl. `--col`/`--drow`, Zoom,
  Vollbild). Neue
  GUI-Einstellungen in `saveUI()`/`restoreState()` mitführen; `saveUI` liefert
  während `restoring===true` nichts, damit das Wiederherstellen nicht sofort
  zurückschreibt. Fehlender `werkbaum-src` fällt auf `INITIAL` zurück, ein
  leerer String bleibt jedoch leer.
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
