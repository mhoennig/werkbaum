# Werkbaum · Backend

Kotlin/Spring-Boot-Anwendung. Aufgaben: Persistenz der Notationstexte,
Live-Editing (D76), Taiga-Integration (REST-API, `#ref`-Auflösung,
Status-Sync), später Tenzu-Adapter.

**Stand:** Gerüst steht — Dokumenten-CRUD mit Historie und Wiederherstellung,
API-First aus `src/main/resources/openapi/api.yaml`, H2 mit Liquibase.
Kommandos in README.md hier. Live-Editing (D76,
`docs/live-editing-proposal.md`) ist in Arbeit: Schritte 1–4 der Reihenfolge
dort sind gebaut (Zeilen-Diff in `de.werkbaum.diff`, Historie in zwei Ebenen,
`PATCH /content` und der Änderungsfeed im `LiveEditingService`); offen sind
`PATCH /title`, das Master-Passwort und der Client.

## Konventionen
- Kotlin, **Spring Boot 4**, Gradle (Kotlin DSL), JDK 21.
- Paketwurzel `de.werkbaum`; Schichten: `api` (Controller), `domain`,
  `service`, `repository` (Interfaces), `persistence` (JPA), später
  `integration.taiga` (Client, Mapping).
- **API First:** Interfaces und Modelle werden aus der OpenAPI-Spezifikation
  generiert; der Controller implementiert sie. Ändert sich die Spec, schlägt
  der Compile fehl — genau so ist es gewollt.
- Tests mit JUnit 5 als Runner + **Kotest-Assertions** (`shouldBe`,
  `shouldContain`, `shouldThrow`) und MockK; Verhalten per Cucumber gegen die
  laufende Anwendung (`RestTestClient`, nicht TestRestTemplate — das ist in
  Boot 4 Auslaufmodell). Taiga-Client gegen aufgezeichnete Antworten
  (WireMock), nie gegen Live-Instanzen.
- Konfiguration über `application.yaml` + Umgebungsvariablen;
  keine Zugangsdaten im Repository.
- Keine neuen **Laufzeit**-Abhängigkeiten ohne Rückfrage (Wurzel-CLAUDE.md);
  Test-Abhängigkeiten sind unkritisch, sie landen in keinem Artefakt.

## Spring Boot 4 — drei Fallen (D13-Nachtrag)
Vieles ist aus dem Kern in eigene Module gewandert. Was uns getroffen hat:

- `spring-boot-starter-test` bringt **kein** `TestRestTemplate`/`RestTestClient`
  mit — dafür `spring-boot-resttestclient`.
- `@SpringBootTest` stellt die Test-Client-Bean **nicht** mehr von selbst
  bereit: `@AutoConfigureRestTestClient` gehört an die Testkonfiguration.
- `org.liquibase:liquibase-core` allein bringt die Autokonfiguration nicht
  mehr mit; ohne `spring-boot-starter-liquibase` läuft keine Migration, und
  der Fehler zeigt sich erst spät als „Schema validation: missing table".

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
