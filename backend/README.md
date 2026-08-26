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

## Live-Editing: der Änderungsfeed

`GET /api/v1/documents/{uuid}/changes?since={version}&wait={sekunden}` liefert
alles, was seit `since` geschehen ist. Gibt es nichts, hält der Server die
Anfrage offen und antwortet **sofort**, sobald eine Änderung eintrifft; sonst
**204**, und der Client fragt erneut. Kosten im Leerlauf: eine offene Anfrage
je Beobachter, rund 2,4 Requests pro Minute.

- **Der Feed arbeitet auf der Historie, nicht am Dokument.** Ein gelöschtes
  Dokument muss sein `DELETED` noch zustellen können — **404** gibt es deshalb
  nur bei gänzlich unbekannter UUID.
- **Ist `since` verdichtet** (oder `0`, also Erstkontakt), kommt statt `ops`
  der **Volltext**; `fromVersion` fehlt dann. Ein Roundtrip und ein
  Sonderzustand weniger als ein eigener Fehlerpfad — und über hunderte
  Versionen hinweg wäre der Cursor ohnehin nicht zu retten.
- **Ereignisse:** `CREATED`, `UPDATED`, `DELETED`, `RESTORED`, `ROLLED_BACK`,
  je mit `clientId` und `displayName` des Absenders. (`RENAMED` kommt mit
  `PATCH /title`; solange es das nicht gibt, wäre der Typ eine Zusage ohne
  Deckung.)
- **`Cache-Control: no-store`** ist Pflicht: Ein Proxy dürfte sonst eine 204
  zwischenspeichern, und der Feed stünde still.
- `wait` wird serverseitig geklemmt (`werkbaum.live-editing.max-wait`, 25 s).

Umgesetzt **blockierend auf virtuellen Threads** (`spring.threads.virtual`),
nicht mit `DeferredResult`: So behält der Endpunkt die aus der Spezifikation
generierte Signatur, und ein Wartender kostet trotzdem fast nichts.
Geweckt wird **nach dem Commit** — davor läse ein Beobachter einen Stand, der
noch nicht steht. Voraussetzung ist eine **Einzelinstanz**; hinter einem Load
Balancer erführe ein Beobachter auf der zweiten Instanz nichts. Begründung:
D76-Nachtrag 5.

## Master-Passwort für die Dokumentenliste

`GET /api/v1/documents` listet **alle** Dokumente und machte damit jede UUID
auffindbar — das Zugriffsmodell „unerratbarer Link" wäre hinfällig. Dieser eine
Endpunkt verlangt deshalb HTTP Basic mit dem Benutzer `werkbaum`:

```bash
export WERKBAUM_MASTER_PASSWORD_HASH="{bcrypt}$(htpasswd -nBC 12 '' | tr -d ':\n')"
```

**Ohne `-b`, also mit Eingabeaufforderung.** Ein Passwort auf der Kommandozeile
landet in der Shell-History — und schlimmer: Die Shell fasst es vorher an.
`ge$heim` wird zu `ge`, `ge heim` zu `geheim`. Gehasht wird dann etwas anderes
als das, was man später eintippt, und der Server antwortet mit 401, obwohl
alles richtig aussieht.

- **Ohne gesetzten Hash ist die Liste gesperrt** (401), nicht offen. Ein
  vergessener Konfigurationsschritt darf nichts preisgeben; beim Start warnt
  das Log.
- Der Hash trägt sein Verfahren als Präfix (`{bcrypt}…`) — so steht in der
  Konfiguration, womit gehasht wurde.
- **Nach `max-attempts` Fehlversuchen** (5) ist der Endpunkt für `lockout`
  (15 min) gesperrt: **429** mit `Retry-After`. Die Sperre ist **global**, nicht
  je Adresse — es gibt genau ein Passwort, und hinter einem Reverse Proxy sähe
  der Server ohnehin für alle dieselbe Adresse. Der Preis: Wer falsch rät,
  sperrt die Liste für alle; die Dokumente selbst bleiben über ihre UUID
  erreichbar.
- Die API ist zustandslos: keine Sitzung, kein CSRF-Token (der schützte hier
  nichts und bräche jeden Client).

## Vorbereitete Erweiterungen

**Autorisierung**
- Geschützt ist bisher **genau ein** Endpunkt, siehe unten. Alles andere ist
  über die unerratbare UUID erreichbar — das ist das Zugriffsmodell, nicht
  eine Lücke.
- `bearerAuth` (JWT) ist in der OpenAPI-Spec als Security Scheme definiert,
  aber noch auf keine Operation angewendet. Später kommt echte
  Authentifizierung als Schicht davor; am Protokoll ändert sich dadurch
  nichts.

**Live-Editing** (Konzept: `docs/live-editing-proposal.md`, Entscheidung: D76)
- **Offen:** Umbenennen per `PATCH /title` (und damit das Ereignis
  `RENAMED`) sowie die Client-Anpassung im Frontend.
- `DocumentUpdateRequest.expectedVersion` ist im Vertrag vorgesehen, wird aber
  noch nicht ausgewertet.

**Clientseitige Verschlüsselung**
- `content` ist ein opaker String, den der Server nie interpretiert. Der
  Wechsel auf Ciphertext erfordert keine API-Änderung; ggf. kommen später
  Metadaten-Felder (z. B. Schlüssel-ID, Nonce) als eigene Properties hinzu.

## Persistenz

- **H2 im File-Modus** (`${werkbaum.data-dir:./data}/editor.mv.db`) – läuft im
  Server-Prozess, keine Datenbank-Installation nötig. Dokumente und Historie
  überleben einen Neustart.
- **Bewusst ohne `MODE=PostgreSQL`**, obwohl es naheliegt: In dem Modus legt H2
  unquotierte Bezeichner klein an, Liquibase sucht seine Verwaltungstabellen
  aber groß — findet nichts, legt sie an, und H2 antwortet „Table
  databasechangelog already exists". Der erste Start ging, **jeder weitere
  stürzte ab**. Gemessen und in D77 begründet.
- Die JDBC-URL hat **einen** Regler: `werkbaum.data-dir`. Der Regressionstest
  überschreibt nur den, damit alles Übrige an der ausgelieferten URL unter
  Test steht.
- **Schema per Liquibase im formatierten SQL-Format**
  (`src/main/resources/db/changelog/db.changelog-master.sql`, kein XML).
  Neue Änderungen werden als weitere `--changeset`-Blöcke angehängt;
  Hibernate validiert nur (`ddl-auto: validate`).
- **Umstieg auf echtes PostgreSQL:** im Wesentlichen JDBC-URL/Credentials in
  der `application.yaml` tauschen und den Postgres-Treiber als Dependency
  ergänzen – Schema-Migrationen und Code bleiben unverändert. (Der
  H2-PostgreSQL-Modus war ein Nachbau davon und ist es nicht wert, siehe oben.)
- Tests laufen gegen H2 in-memory. Die Testkonfiguration heißt
  `application-test.yaml` und ist eine **Profil-Überlagerung**: Gleichnamig
  (`application.yaml`) verdeckte sie die Hauptkonfiguration vollständig, und
  die Tests prüften eine Konfiguration, die in Produktion nie läuft.
- Service-Methoden sind `@Transactional`: Dokument-Änderung und
  Historieneintrag werden atomar geschrieben.

## Läuft er? `GET /api/v1/info`

```json
{"name":"editor-backend","version":"0.1.0-SNAPSHOT","builtAt":"2026-08-26T16:59:40.341Z"}
```

Offen, ohne Nebenwirkung, und sagt zugleich, **welcher Stand** läuft. Vorher
war die Lebendprobe eine Anfrage nach einem nicht existierenden Dokument mit
der Erwartung **404** — ein erwarteter *Fehler* ist eine schlechte
Zusicherung, weil ihn auch ein falsch konfigurierter Proxy liefert.

Die Angaben kommen aus `META-INF/build-info.properties`
(`springBoot { buildInfo() }`, Teil des Boot-Plugins). Fehlt die Datei — etwa
beim Start aus der IDE —, steht dort `unbekannt` statt eines Fehlers.

## Betrieb auf der stabilen Instanz

`scripts/deploy-backend.sh` (im Repo-Wurzelordner) baut das Fat-Jar, legt es
samt systemd-User-Unit ins Home des Servers und startet den Dienst neu;
`scripts/install-jdk.sh` bringt einmalig ein JDK 21 dorthin. Der Dienst lauscht
nur auf `127.0.0.1` — von außen kommt man über die Proxy-Regel in
`scripts/prod.htaccess`, die der Frontend-Deploy mitspiegelt.

- **Speicher:** `-Xmx192m -Xms48m` plus Freiraum-Verhältnisse; gemessen rund
  174 MB RSS gegen 291 MB ohne Angaben. Nach einem GC leben ~45 MB. Zu wenig
  Luft? `BACKEND_XMX` in `.env`.
- **Master-Passwort:** `scripts/reset-password.sh` fragt es verdeckt ab, hasht
  es auf dem Server und prüft selbst nach, ob Hash und Passwort zueinander
  passen. Gespeichert wird nur der Hash (`<BACKEND_DIR>/env`, Modus 600); ohne
  ihn bleibt `GET /documents` gesperrt.
- **Datenbank:** H2 im Dateimodus unter `<BACKEND_DIR>/data/`. Ein Deploy
  fasst das Verzeichnis nicht an (kein `--delete`). Umstieg auf das dort
  laufende PostgreSQL: JDBC-URL in der `application.yaml` tauschen und den
  Treiber ergänzen — Schema und Code bleiben.
- **Nachsehen:** `systemctl --user status werkbaum-backend`,
  `tail -f <BACKEND_DIR>/backend.log`.

Begründungen: docs/DECISIONS.md D77 (und D76-Nachträge 1–3 zur Vermessung der
Zielumgebung).

## Hinweise

- Versionsnummern in `build.gradle.kts` (Spring Boot, OpenAPI Generator,
  Cucumber, MockK) beim ersten Build ggf. auf den aktuellen Patch-Stand heben.
