# Werkbaum · Backend

Kotlin/Spring-Boot-Anwendung. Aufgaben: Persistenz der Notationstexte,
Taiga-Integration (REST-API, `#ref`-Auflösung, Status-Sync), später
Tenzu-Adapter. Noch nicht bootstrapped — siehe README.md hier.

## Konventionen
- Kotlin, Spring Boot, Gradle (Kotlin DSL), JDK 21.
- Paketwurzel `de.werkbaum`; Schichten: `api` (Controller/DTOs),
  `domain`, `integration.taiga` (Client, Mapping), `persistence`.
- Tests mit JUnit 5 + Kotest-Assertions; Taiga-Client gegen
  aufgezeichnete Antworten (WireMock), nie gegen Live-Instanzen.
- Konfiguration über `application.yml` + Umgebungsvariablen;
  keine Zugangsdaten im Repository.

## Wichtig (D14 — Parser-Hoheit)
Das Backend parst die Notation **nicht**. Es speichert den Text als Ganzes
und arbeitet mit expliziten Metadaten. Sollte Backend-Parsen doch nötig
werden: zuerst DECISIONS ergänzen, dann gegen die gemeinsamen Fixtures aus
docs/SPEC.md §10 testen — niemals eine zweite, abweichende Grammatik pflegen.

## Taiga-Mapping (Vorgabe aus docs/ROADMAP.md)
- `#123` referenziert Epic/User Story/Task/Issue; Auflösung liefert Titel,
  URL, Status. Status-Mapping Taiga-Workflow → Notation konfigurierbar
  (Default: „New"→`[ ]`, „In progress"→`[~]`, „Ready for test"→`[/]`,
  „Done"→`[x]`, „Archived"→`[^]`).
