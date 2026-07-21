# Aufgaben

Abhaken beim Erledigen; neue Aufgaben unten anfügen.

## Phase 1 — Modularisierung & Tests
- [x] Projektgerüst: `src/` (parser.js, model.js, render.js, app.js),
      `tests/`, `index.html` bindet Module ein; weiterhin ohne Build nutzbar
      (ES-Module) oder mit minimalem Setup (Vite) — Entscheidung dokumentieren.
      → **Vite** gewählt (D19): `src/` als ES-Module, `npm run build` bündelt zu
      einer self-contained `dist/index.html` (file://-tauglich). Gerüst steht
      (aktuell `src/app.js` + `src/style.css`); Parser/Renderer werden in den
      folgenden Checkboxen herausgelöst.
- [x] Parser extrahieren; Verhalten exakt wie in `docs/SPEC.md` §1–§8.
      → `src/parser.js` exportiert `parse`, `STATUS_BY_CODE`, `SIZE_RANK`
      (headless, kein DOM); `app.js` importiert sie.
- [x] Unit-Tests für den Parser (Vitest): kanonisches Beispiel aus SPEC §10
      als Fixture; Randfälle: gemischte Gates, Tabs/ungleichmäßige Einrückung,
      URL mit `@`, mehrere Wurzeln, leere Labels, `%%` am Zeilenanfang/-ende.
      → `tests/parser.test.js` (18 Tests).
- [x] Renderer extrahieren (HTML-String-Erzeugung), Snapshot-Tests für
      Normal- und Vertikalmodus sowie „Untergliederung fehlt“.
      → `src/model.js` (Baum-/Kostenlogik) + `src/render.js` (`renderTreeHtml`,
      headless); `app.js` reicht UI-State als Parameter herein.
      `tests/render.test.js` (6 Tests, Snapshots). Anm.: der Modus
      (horizontal/vertikal/kompakt) ist reine CSS-Container-Klasse und ändert
      den Renderer-String nicht — ein Snapshot deckt alle drei Modi ab.
- [x] Warnungs-Modell vereinheitlichen (Zeilennummern, Typen).
      → strukturierte Objekte `{type, line, ...}` (Renderer emittiert
      `mixedGate`); `src/warnings.js` `formatWarning(w, t)` macht daraus den
      lokalisierten, HTML-escapten Text an einer Stelle. Vorbereitet für
      Phase 2 (`unknownStatus`). `tests/warnings.test.js`.

## Phase 2 — Qualität
- [x] Barrierefreiheit: Fokusreihenfolge, aria-Labels für Status/Größe/Tags.
      → je Knoten ein sprechender `aria-label` (Label+Status+Aufwand+Zuständige+
      Link, lokalisiert, neue `a11y*`-Keys in allen 9 Sprachen); visuelle Badges
      `aria-hidden`; Knoten `tabindex="0"` (Fokus = Lesereihenfolge) mit
      `:focus-visible`-Rahmen; `#warn` als Live-Region (`role=status`,
      `aria-live=polite`). Snapshots aktualisiert.
- [ ] Druck-Stylesheet (Diagramm ohne Editor-Panel).
- [ ] Fehlertolerantes Parsen weiter ausbauen (unbekannte Statuszeichen melden).

## Deployment
- [x] GitHub-Pages-Workflow angelegt (`.github/workflows/pages.yml`,
      siehe docs/DECISIONS.md D16).

## Phase 3 — Integrationen (siehe docs/ROADMAP.md)
- [ ] Backend-Gerüst per Spring Initializr in `backend/` anlegen
      (Kotlin, Gradle Kotlin DSL, JDK 21; Konventionen: backend/CLAUDE.md).
- [ ] SVG-Renderer (Layout-Engine) als gemeinsame Basis für Export und
      Mermaid-Plugin.
- [ ] Mermaid-Plugin-Spike: Detektor + Registrierung, ein Minimalbaum.
- [ ] Taiga-Spike: `#ref`-Syntax parsen, Status via REST-API auflösen
      (read-only), Mapping konfigurierbar.
