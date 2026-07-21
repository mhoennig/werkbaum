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
  Änderungen beide Modi (normal + „schmal (vertikal)") prüfen.
- Extraktionsreihenfolge im Parser nicht umstellen: Kommentar → Zeichen/
  Status → URL → Größe → Tags (sonst kollidiert `@` in URLs).
- „verworfen" ist per Default ausgeblendet; Filterlogik steckt in
  `visibleChildren()` und muss bei Renderer-Umbauten erhalten bleiben.
