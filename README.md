<p align="left">
  <img src="docs/brand/logo.svg" width="72" alt="Werkbaum-Logo">
</p>

# Werkbaum

Eine textuelle, Markdown-artige Notation für Projektstrukturpläne
(Work Breakdown Structure) mit Und/Oder-Zerlegung — und ein Live-Editor,
der sie als Diagramm rendert.

```
[~] Werkbaum (XL) https://wiki.example.de/relaunch
  - [~] Dokumentenspeicher
    | [x] Textdatei mit Copy+Paste im Frontend (S)
        - [x] Parser
        - [x] Texteingabefeld im Frontend
    | [ ] Backend
  - [~] Darstellung/Rendern (XL)
    - [/] H (S) @anna
    - [ ] CMS-Anbindung (M)
      | [ ] WordPress
      | [?] Headless CMS
```

`-` = Pflicht-Teilpaket (all of, im Diagramm nebeneinander) ·
`|` = Alternative (any of, untereinander) · `[…]` = Status ·
`(M)` = T-Shirt-Aufwand · `@name` = Zuständigkeit · `%%` = Kommentar.

## Nutzung

`frontend/index.html` im Browser öffnen — links Text bearbeiten, rechts entsteht das
Diagramm live. Toggles: transponierte (schmale) Darstellung, verworfene
Elemente einblenden.

## Projektdokumente

- `frontend/` — Editor · `backend/` — Kotlin/Spring (Gerüst folgt, siehe backend/README.md)
- `docs/SPEC.md` — verbindliche Sprachdefinition
- `docs/DECISIONS.md` — Design-Entscheidungen mit Begründung
- `docs/ROADMAP.md` — Mermaid-Plugin, Taiga-Integration, Tenzu
- `docs/TASKS.md` — offene Aufgaben (Checkboxen)
- `docs/brand/BRAND.md` — Logo, Wortbild, Anwendungsregeln
- `docs/design/` — Design-Herleitung der Marke
- `CLAUDE.md` — Projektkontext für Claude Code

## Lizenz

MIT — siehe [LICENSE](LICENSE). © 2026 Michael Hönnig.
