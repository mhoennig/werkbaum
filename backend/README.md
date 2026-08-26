# Editor Backend – Grundgerippe

CRUD-Skelett mit **Spring Boot 4**, **Kotlin** und **API First** (OpenAPI 3, YAML).
Die vier HTTP-Befehle (GET, POST, PUT, DELETE) sind für die Ressource `Document`
umgesetzt – bewusst noch **ohne Autorisierung**, aber mit vorbereiteten
Erweiterungspunkten für Live-Editing, Autorisierung und clientseitige
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
   nach `build/generated/openapi` (Pakete `com.example.editor.generated.*`)
3. `DocumentsController` implementiert das Interface mit
   `skipDefaultInterface=true`: Weicht die Implementierung vom Vertrag ab,
   **bricht der Build** – Spezifikation und Code können nicht auseinanderlaufen.

Generierter Code wird nicht eingecheckt und zählt nicht zur Code Coverage.

## Teststrategie

- **Behavior-Tests (Cucumber, `src/test/resources/features/dokumente.feature`)**
  testen die API von außen gegen die laufende Anwendung (`RANDOM_PORT`):
  Statuscodes, Payloads, Fehlerpfade. Die Szenarien sind auf Deutsch
  (`# language: de`) und dienen als lebende Dokumentation.
- **Unit-Tests (JUnit 5 + MockK)** decken die Geschäftslogik im
  `DocumentService` isoliert ab (Versionierung, Zeitstempel per festem `Clock`,
  Fehlerfälle).
- **Coverage**: JaCoCo, Verifikation mit mind. 80 % Line Coverage
  (`jacocoTestCoverageVerification`, hängt an `check`).

## Architektur

```
api/         DocumentsController (implementiert generiertes Interface),
             GlobalExceptionHandler (RFC 9457 ProblemDetail)
service/     DocumentService (Geschäftslogik, Versionierung), Clock-Bean
repository/  DocumentRepository + DocumentHistoryRepository (Interfaces)
persistence/ JPA-Entities, Spring-Data-Repositories und Adapter (H2/Liquibase)
domain/      Document (internes Modell, getrennt vom API-Modell)
```

Das interne Domänenmodell ist bewusst vom generierten API-Modell getrennt –
so können API-Vertrag und Persistenz unabhängig voneinander weiterentwickelt
werden.

## Historie & Wiederherstellung

- Jede Änderung (CREATED, UPDATED, DELETED, RESTORED) wird als Snapshot in
  einer vom Dokument getrennten Historie protokolliert – sie **überlebt ein
  DELETE**.
- `GET /api/v1/documents/{uuid}/history` liefert alle Einträge (älteste
  zuerst); Identifier ist die UUID, wie bei GET (der Titel ist nicht eindeutig).
- `POST /api/v1/documents/{uuid}/restore` stellt ein gelöschtes Dokument unter
  derselben UUID wieder her (letzter Stand vor dem Löschen). Mit optionalem
  Body `{"version": n}` wird eine bestimmte Version wiederhergestellt – das
  funktioniert auch als Rollback für noch existierende Dokumente; ohne
  Zielversion antwortet der Server bei existierendem Dokument mit 409.

## Vorbereitete Erweiterungen

**Autorisierung**
- `bearerAuth` (JWT) ist in der OpenAPI-Spec als Security Scheme definiert,
  aber noch auf keine Operation angewendet.
- Später: `spring-boot-starter-security` + `security: [bearerAuth]` in der
  Spec; die Behavior-Tests erhalten dann einen Auth-Schritt
  („Angenommen ich bin als … angemeldet").

**Live-Editing**
- Jedes Dokument trägt eine `version`, die bei jedem Update inkrementiert
  wird – Basis für Optimistic Locking (HTTP 409 ist in der Spec bereits
  reserviert) und für Delta-Synchronisation über WebSocket/STOMP.
- `DocumentUpdateRequest.expectedVersion` ist bereits im Vertrag vorgesehen,
  wird aber noch nicht ausgewertet.

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
