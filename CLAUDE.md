# Werkbaum

Monorepo für Werkbaum: eine textuelle WBS-Notation mit Und/Oder-Zerlegung
(„all of" nebeneinander, „any of" untereinander) samt Editor und geplantem
Integrations-Backend.

## Struktur
- `frontend/` — Editor (Vanilla HTML/CSS/JS). Eigene Regeln: frontend/CLAUDE.md
- `backend/` — Kotlin/Spring-Boot-Anwendung (Taiga-Integration, Persistenz).
  Eigene Regeln: backend/CLAUDE.md
- `docs/` — Projektdokumente · `brand/` — Marke (brand/BRAND.md)

## Verbindliche Referenzen
- Sprachdefinition: @docs/SPEC.md — die Notation ist der gemeinsame Vertrag
  von Frontend und Backend. Syntaxänderungen: SPEC **zuerst**, dann Code.
- Entscheidungen: @docs/DECISIONS.md — respektieren; Abweichungen als neuen
  Eintrag begründen, alte Einträge nie löschen. Besonders D13 (Backend-Stack)
  und D14 (Parser-Hoheit) beachten.
- Ziele: docs/ROADMAP.md · Offene Arbeit: docs/TASKS.md (Checkboxen pflegen).

## Querschnitts-Konventionen
- Doku auf Deutsch. Die Editor-UI ist mehrsprachig (DE/EN/ES/FR direkt,
  PL/RU/HI hinter dem „…“-Aufklapper des Umschalters oben rechts);
  **Deutsch ist die Quellsprache** — neue UI-Texte zuerst auf Deutsch im
  `I18N`-Objekt (frontend/index.html) anlegen, dann in alle Sprachen
  übersetzen.
- Keine neuen Laufzeit-Abhängigkeiten ohne Rückfrage (gilt in beiden Teilen).
- Der Notationstext ist das führende Datenformat; kein Teil erfindet ein
  eigenes Speicherformat für die Struktur.
