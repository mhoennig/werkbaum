# Editor Backend – Grundgerippe

CRUD mit **Spring Boot 4**, **Kotlin** und **API First** (OpenAPI 3, YAML) für
die Ressource `Document` (GET, POST, PUT, DELETE), dazu Historie,
Wiederherstellung und das Einreichen von Zeilen-Diffs fürs Live-Editing
(`PATCH …/content`) – bewusst noch **ohne Autorisierung**, aber mit
vorbereiteten Erweiterungspunkten dafür und für clientseitige
Verschlüsselung.

## Voraussetzungen

- JDK 21
- Gradle 9 (einmalig `gradle wrapper --gradle-version 9.1` ausführen, danach `./gradlew`)

## Wichtige Kommandos

| Kommando                     | Zweck                                                                        |
|------------------------------|------------------------------------------------------------------------------|
| `./gradlew openApiGenerate`  | Generiert API-Interfaces + Modelle aus `src/main/resources/openapi/api.yaml` |
| `./gradlew build`            | Generierung, Kompilierung, alle Tests, Coverage-Prüfung                      |
| `./gradlew test`             | Unit- und Behavior-Tests (Cucumber)                                          |
| `./gradlew jacocoTestReport` | Coverage-Report unter `build/reports/jacoco/test/html`                       |
| `./gradlew bootRun`          | Startet das Backend auf Port 8080                                            |

## API First – Ablauf

1. Vertrag ändern: `src/main/resources/openapi/api.yaml`
2. `./gradlew openApiGenerate` → erzeugt `DocumentsApi` (Interface) und Modelle
   nach `build/generated/openapi` (Pakete `de.werkbaum.generated.*`)
3. `DocumentsController` implementiert das Interface mit
   `skipDefaultInterface=true`: Weicht die Implementierung vom Vertrag ab,
   **bricht der Build** – Spezifikation und Code können nicht auseinanderlaufen.

Generierter Code wird nicht eingecheckt und zählt nicht zur Code Coverage.

## Teststrategie

- **Behavior-Tests (Cucumber, `src/test/resources/features/`)** testen die API
  von außen gegen die laufende Anwendung (`RANDOM_PORT`):
  Statuscodes, Payloads, Fehlerpfade. Die Szenarien sind auf Deutsch
  (`# language: de`) und dienen als lebende Dokumentation.
- **Unit-Tests (JUnit 5 + MockK)** decken die Geschäftslogik isoliert ab:
  `DocumentService` (Versionierung, Zeitstempel per festem `Clock`,
  Meilenstein-Regeln), `LiveEditingService` (Rebasen, Konflikt, Idempotenz,
  Grenzen) und `LineDiff` (Anwenden, Berechnen, Überschneidung, Prüfsumme).
- **Gegenprobe statt Zählerei:** Zu jeder Regel wird geprüft, dass ihre
  Mutation genau die nach ihr benannten Zusicherungen fallen lässt. Ein Test,
  von dem man das nicht geprüft hat, ist nur eine Behauptung.
- **Coverage**: JaCoCo, Verifikation mit mind. 80 % Line Coverage
  (`jacocoTestCoverageVerification`, hängt an `check`).

## Architektur

```
api/         DocumentsController (implementiert generiertes Interface),
             GlobalExceptionHandler (RFC 9457 ProblemDetail), Diff-Mapper
service/     DocumentService (Geschäftslogik, Versionierung),
             LiveEditingService (Diffs einreichen), PatchLog, Clock-Bean
diff/        Zeilen-Diff: anwenden, berechnen, rebasen, Prüfsumme (Spring-frei)
repository/  DocumentRepository + DocumentHistoryRepository (Interfaces)
persistence/ JPA-Entities, Spring-Data-Repositories und Adapter (H2/Liquibase)
domain/      Document, ContentPatch (interne Modelle, getrennt vom API-Modell)
```

Das interne Domänenmodell ist bewusst vom generierten API-Modell getrennt –
so können API-Vertrag und Persistenz unabhängig voneinander weiterentwickelt
werden.

## Historie & Wiederherstellung

- Jede Änderung wird als Snapshot in einer vom Dokument getrennten Historie
  protokolliert – sie **überlebt ein DELETE**.
- **Zwei Ebenen** (D76): **Meilensteine** sind die nutzersichtbare Historie und
  bleiben; **Sync-Versionen** tragen die Diffs des Live-Editings, sind
  kurzlebig und werden verdichtet. Ohne die Trennung würde die Historie beim
  getakteten Schreiben zum Transaktionslog – hunderte Volltext-Snapshots eines
  40-kB-Dokuments je Sitzung.
  - Meilenstein wird ein Stand bei einer strukturellen Änderung (Anlegen,
    Löschen, Wiederherstellen, Rückfall), beim Vollersatz per `PUT` und
    **nach einer Schreibpause**. Letzteres ohne Zeitgeber: Die nächste
    Änderung stellt fest, dass eine Pause war, und befördert die Version
    davor nachträglich. Auf Knopfdruck setzt `PATCH /content` denselben
    Schalter (`milestone: true`).
  - Stellschrauben: `werkbaum.live-editing.milestone-pause` (30 s) und
    `sync-retention` (1 h).
- `GET /api/v1/documents/{uuid}/history` liefert die Meilensteine (älteste
  zuerst) und immer den jüngsten Stand; Identifier ist die UUID, wie bei GET
  (der Titel ist nicht eindeutig).
- `POST /api/v1/documents/{uuid}/restore` stellt ein gelöschtes Dokument unter
  derselben UUID wieder her (`RESTORED`, letzter Stand aus dem Tombstone). Mit
  optionalem Body `{"version": n}` wird eine bestimmte Version übernommen – bei
  einem noch lebenden Dokument ist das ein Rückfall (`ROLLED_BACK`), kein
  Wiederherstellen: Der Client hatte nie eine Sperre. Ohne Zielversion
  antwortet der Server bei existierendem Dokument mit 409, eine bereits
  verdichtete Zielversion mit 404.

## Live-Editing: Änderungen als Zeilen-Diff

`PATCH /api/v1/documents/{uuid}/content` nimmt eine Änderung als Diff gegen
eine Basisversion entgegen — Zeilen sind opake Strings, das Backend parst die
Notation nicht (D14).

```json
{ "baseVersion": 41, "checksum": "sha256:9f2b…",
  "clientId": "c-8a41…", "seq": 17,
  "ops": [ { "op": "replace", "index": 12, "count": 1,
             "lines": ["  - [~] Backend (L) @ben"] } ] }
```

- **Der Server rebased selbst.** Ist die Basis veraltet, überschneiden sich die
  Operationen aber nicht mit den zwischenzeitlichen, verschiebt er sie und
  antwortet mit 200; die fremden Operationen stehen in `opsSinceBase`, damit
  der Client seine Schattenkopie nachzieht. Reines Ablehnen führte zu
  Starvation — ein Client mit hoher Latenz käme bei fleißigen Mitschreibern
  womöglich nie durch.
- **409** nur bei echter Überschneidung, mit `currentVersion` und dem Diff von
  der eingereichten Basis dorthin — der Client entscheidet, ohne neu zu laden.
  Eine Einfügung ist dabei ein Punkt **zwischen** den Zeilen: an den Rändern
  eines fremden Blocks kein Konflikt, in seinem Inneren schon.
- **`checksum` ist Pflicht.** Die Versionsnummer bestätigt nur, dass die Basis
  dieselbe *Version* ist, nicht dass beide Seiten sie *gleich lesen*. Passt sie
  nicht: **422**, Client lädt einmal neu. Ebenso bei Index außerhalb, bereits
  verdichteter Basis und veralteter `seq`.
- **`clientId` + `seq` machen den Aufruf wiederholbar.** Geht die Antwort
  unterwegs verloren, liefert eine Wiederholung das Ergebnis von damals, statt
  die Änderung ein zweites Mal anzuwenden.
- **400** bei Grenzüberschreitung (`max-ops`, `max-content-length`) und bei
  `delete`/`replace` ohne `count` — als 0 gelesen täte die Operation
  stillschweigend nichts.
- Ohne `milestone: true` entsteht eine **Sync-Version** (siehe Historie oben);
  der Knopfdruck setzt das Feld.

Die Änderung eines Dokuments läuft strikt sequenziell (Sperre je UUID,
**außerhalb** der Transaktion — innen gäbe der Proxy sie vor dem Commit frei).

## Vorbereitete Erweiterungen

**Autorisierung**
- `bearerAuth` (JWT) ist in der OpenAPI-Spec als Security Scheme definiert,
  aber noch auf keine Operation angewendet.
- Später: `spring-boot-starter-security` + `security: [bearerAuth]` in der
  Spec; die Behavior-Tests erhalten dann einen Auth-Schritt
  („Angenommen ich bin als … angemeldet").

**Live-Editing** (Konzept: `docs/live-editing-proposal.md`, Entscheidung: D76)
- **Offen:** der Änderungsfeed per Long Polling (`GET /changes`),
  Master-Passwort für `GET /documents`, Client-Anpassung.
- `DocumentUpdateRequest.expectedVersion` ist im Vertrag vorgesehen, wird aber
  noch nicht ausgewertet.

**Clientseitige Verschlüsselung**
- `content` ist ein opaker String, den der Server nie interpretiert. Der
  Wechsel auf Ciphertext erfordert keine API-Änderung; ggf. kommen später
  Metadaten-Felder (z. B. Schlüssel-ID, Nonce) als eigene Properties hinzu.

## Persistenz

- **H2 im File-Modus** (`./data/editor.mv.db`) mit `MODE=PostgreSQL` –
  läuft im Server-Prozess, keine Datenbank-Installation nötig. Dokumente und
  Historie überleben einen Neustart.
- **Schema per Liquibase im formatierten SQL-Format**
  (`src/main/resources/db/changelog/db.changelog-master.sql`, kein XML).
  Neue Änderungen werden als weitere `--changeset`-Blöcke angehängt;
  Hibernate validiert nur (`ddl-auto: validate`).
- **Umstieg auf echtes PostgreSQL:** im Wesentlichen JDBC-URL/Credentials in
  der `application.yaml` tauschen und den Postgres-Treiber als Dependency
  ergänzen – Schema-Migrationen und Code bleiben unverändert.
- Tests laufen gegen H2 in-memory (`src/test/resources/application.yaml`),
  mit demselben Liquibase-Schema.
- Service-Methoden sind `@Transactional`: Dokument-Änderung und
  Historieneintrag werden atomar geschrieben.

## Hinweise

- Versionsnummern in `build.gradle.kts` (Spring Boot, OpenAPI Generator,
  Cucumber, MockK) beim ersten Build ggf. auf den aktuellen Patch-Stand heben.
