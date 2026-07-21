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
- [ ] Parser extrahieren; Verhalten exakt wie in `docs/SPEC.md` §1–§8.
- [ ] Unit-Tests für den Parser (Vitest): kanonisches Beispiel aus SPEC §10
      als Fixture; Randfälle: gemischte Gates, Tabs/ungleichmäßige Einrückung,
      URL mit `@`, mehrere Wurzeln, leere Labels, `%%` am Zeilenanfang/-ende.
- [ ] Renderer extrahieren (HTML-String-Erzeugung), Snapshot-Tests für
      Normal- und Vertikalmodus sowie „Untergliederung fehlt“.
- [ ] Warnungs-Modell vereinheitlichen (Zeilennummern, Typen).

## Phase 2 — Qualität
- [ ] Barrierefreiheit: Fokusreihenfolge, aria-Labels für Status/Größe/Tags.
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
