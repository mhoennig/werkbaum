# Werkbaum · Frontend

Editor: `index.html` ist der funktionierende Prototyp (Text links,
Diagramm rechts, Toggles für transponierte Ansicht und verworfene Elemente).

## Konventionen
- Vanilla HTML/CSS/JS, ES-Module; keine Frameworks. Testwerkzeug (Vitest) ok.
- Parser und Renderer müssen headless (ohne Editor-UI) nutzbar bleiben —
  Basis für SVG-Export und Mermaid-Plugin (docs/ROADMAP.md).
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
- „verworfen" ist per Default ausgeblendet; Filterlogik steckt in
  `visibleChildren()` und muss bei Renderer-Umbauten erhalten bleiben.
- Zustand wird im `localStorage` gehalten (noch kein Backend): `werkbaum-lang`
  (Sprache), `werkbaum-src` (Editortext), `werkbaum-ui` (JSON: Modus,
  verworfene, Split-Zustand inkl. `--col`/`--drow`, Zoom, Vollbild). Neue
  GUI-Einstellungen in `saveUI()`/`restoreState()` mitführen; `saveUI` liefert
  während `restoring===true` nichts, damit das Wiederherstellen nicht sofort
  zurückschreibt. Fehlender `werkbaum-src` fällt auf `INITIAL` zurück, ein
  leerer String bleibt jedoch leer.
- Kleiner Bildschirm: `body.mobile` (per `matchMedia`, ≤ 640 px) schaltet auf
  Ein-Bereich-Ansicht (Diagramm **oder** Editor, Umschalten per Titelzeile),
  eigenen Legenden-Umschalter (`#legendBtn`) und schlanke Sprachwahl; Default
  Vollbild. Layout-CSS hängt an `body.mobile`, nicht an einer eigenen
  `@media`-Regel — beide Seiten müssen denselben 640-px-Schwellwert nutzen
  (SPEC §9, D17).
