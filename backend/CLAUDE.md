# Werkbaum · Backend

Kotlin/Spring-Boot-Anwendung. Aufgaben: Persistenz der Notationstexte,
Live-Editing (D76), Taiga-Integration (REST-API, `#ref`-Auflösung,
Status-Sync), später Tenzu-Adapter.

**Stand:** Gerüst steht — Dokumenten-CRUD mit Historie und Wiederherstellung,
API-First aus `src/main/resources/openapi/api.yaml`, H2 mit Liquibase.
Kommandos in README.md hier. Live-Editing (D76,
`docs/live-editing-proposal.md`) ist in Arbeit: Schritte 1–5 der Reihenfolge
dort sind gebaut (Zeilen-Diff in `de.werkbaum.diff`, Historie in zwei Ebenen,
`PATCH /content` und der Änderungsfeed im `LiveEditingService`,
Master-Passwort für die Dokumentenliste, `PATCH /title` samt RENAMED-Ereignis
im Feed — D85), der Client im Frontend ist verdrahtet (D76-Nachtrag 7).
Verwaltungs-Aktionen (Umbenennen, künftig Löschen) perspektivisch an das
geplante Owner-Passwort binden (`#col.live.owner` im Plan) — Endpunkte so
schneiden, dass die Berechtigungsprüfung dazukommen kann, ohne die Signatur
zu brechen.

**Taiga-Proxy (D91):** schmale, benannte Endpunkte unter `/api/v1/taiga/*`
(auth, projects, userstories, tasks — je POST zum Anlegen und GET
`…/{ref}?slug=` zum **Lesen**, D91-Nachtrag 6) in `de.werkbaum.integration.taiga`
(`TaigaClient` + `TaigaProperties`), Controller in `api`. Die Basis-URL der
Taiga-**API** ist Server-Konfiguration (`werkbaum.taiga.api-url` bzw.
`WERKBAUM_TAIGA_API_URL`), **nie** Request-Parameter — die SSRF-Falle
naiver Proxies. Das Token kommt je Aufruf im Header `X-Taiga-Token`
(eigener Name: `Authorization` müssen OpenAPI-Werkzeuge als Header-Parameter
ignorieren, und er kollidierte mit dem Master-Passwort) und geht als
`Authorization: Bearer …` hinaus; der Server speichert nichts und **loggt
keine Request-Bodies** — der Auth-Endpunkt sieht das Passwort nur im
Durchflug. Unkonfiguriert: 503, und `GET /info` meldet `taiga: false`.

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
  Boot 4 Auslaufmodell). Taiga-Client gegen aufgezeichnete Antworten,
  nie gegen Live-Instanzen — umgesetzt mit dem JDK-eigenen `HttpServer`
  als Stub (`TaigaClientTest`/`TaigaApiTest`) statt WireMock: keine neue
  Test-Abhängigkeit, dieselbe Zusicherung.
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
- **Abgebildet wird im Frontend, nicht hier** (D91-Nachtrag 6): Der Proxy
  reicht Taigas Status-**Namen** durch (`status_extra_info.name`), die
  Statuscodes sind Notations-Vokabular und das Backend parst die Notation
  nicht (D14). Die Tabelle steht headless in `frontend/src/taiga.js`
  (`mapTaigaStatus`); konfigurierbar ist sie noch nicht.
- **Eine Ref ist nur je Projekt eindeutig:** Die Lese-Endpunkte nehmen
  deshalb den `slug` (aus `&taiga.<slug>`, SPEC §1) und fragen erst
  `/projects/by_slug`, dann `by_ref` — der Slug kommt vom Client und wird
  **kodiert** angehängt, sonst hängte ein `&` darin einen weiteren Filter an.
- **Schreiben (D91-Nachtrag 8):** `PATCH /taiga/{userstories|tasks}/{ref}/status`
  nimmt die Status-**Id** (aus `GET /taiga/{userstory|task}-statuses?slug=`)
  und die zuletzt gelesene `version` — Taigas optimistische Sperre; ein
  Konflikt wird durchgereicht, nie überschrieben. Die Zielspalte wählt der
  Editor: Namen sind je Projekt frei, die Abbildung ist Notation (D14). Der
  Test-Stub muss **chunked** Bodies lesen (der JDK-HttpClient sendet ohne
  `Content-Length`) — sonst meldet er einen Versionskonflikt, den es nicht gibt.
