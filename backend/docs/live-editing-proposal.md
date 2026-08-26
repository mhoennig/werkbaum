# Live-Editing über HTTP (Variante „Simpel")

Status: **Konzept entschieden** (D76), noch nichts implementiert. Die offenen
Punkte des ersten Entwurfs sind beantwortet; die Begründungen stehen in
`docs/DECISIONS.md` unter D76 und werden hier nicht wiederholt, sondern nur
verwiesen.

## Ziel und Rahmenbedingungen

- Mehrere Clients (Werkbaum-Web-App/PWA) arbeiten am selben Dokument:
  ca. **10 Beobachter**, davon **2–3 gelegentliche Editoren**, praktisch nie
  in derselben Sekunde.
- **Nur HTTP**, kein WebSocket. Wenige, sparsame Requests (Lehre aus den
  aggressiven Rate-Limits der Etherpad-Integration, D31).
- **Kein Neuladen des Dokuments** im Normalbetrieb: Clients erhalten
  Zeilen-Diffs und wenden sie lokal an, damit Cursor/Scrollposition erhalten
  bleiben. Ausnahmen sind benannt (Prüfsummenfehler, zu alter Stand).
- Das Werkbaum-Format ist **zeilenorientiert**; Zeilen-IDs (`#id`) sind
  optional und identifizieren Knoten, nicht Zeilen. Das Protokoll arbeitet
  deshalb ausschließlich auf **physischen Zeilen** und braucht keine IDs.
- Bei echtem Gleichzeitig-Konflikt: Update ablehnen, **der Client
  entscheidet** (rebase, neu laden, verwerfen). Das Dokument darf nie
  kaputtgehen.

### Zugriff und Identität

- **Zugriff über die unerratbare Dokument-UUID**, wie ein Pad-Link: kein
  Login, kein Rechtemodell. Echte Authentifizierung kommt später als Schicht
  davor; das Protokoll bleibt davon unberührt.
- **`GET /documents` verlangt ein Master-Passwort** (Hash serverseitig in
  einer Umgebungsvariable, geprüft über Spring Security). Ohne diesen Schutz
  wäre jede UUID auflistbar und das Modell hinfällig. Der Endpunkt braucht
  eine **Sperre nach Fehlversuchen**, und die Übertragung setzt HTTPS voraus.
- **Identität ist pseudonym**: Jeder Client führt eine zufällige `clientId`
  und einen selbstgewählten Anzeigenamen (Etherpad-Modell). Ohne Anmeldung
  ist der Name eine Behauptung und darf in der Oberfläche nicht wie ein
  Nachweis aussehen. Er trägt: Wiedererkennung beim Retry, „geändert von" in
  der Historie, die Reihenfolge bei gleichzeitigen Einfügungen und spätere
  Präsenz.

## Grundidee in einem Satz

Jede Dokumentänderung ist ein **zeilenbasiertes Diff gegen eine
Basisversion**; der Server wendet es an — notfalls auf eine neuere Version
verschoben — und verteilt das Ergebnis über **Long Polling** an alle
Beobachter.

## Datenmodell: das Zeilen-Diff

Ein Diff ist eine Liste von Operationen relativ zur Basisversion. Zeilen
werden über ihren **Index in der Basisversion** adressiert (0-basiert);
Operationen sind nach Index aufsteigend sortiert und überlappen nicht.

```json
{
  "baseVersion": 41,
  "checksum": "sha256:9f2b…",
  "clientId": "c-8a41…",
  "seq": 17,
  "ops": [
    { "op": "replace", "index": 12, "count": 1,
      "lines": ["  - [~] Backend (L) @ben"] },
    { "op": "insert",  "index": 20,
      "lines": ["  + [?] Dark mode (S)"] },
    { "op": "delete",  "index": 25, "count": 2 }
  ]
}
```

- `replace`: `count` Zeilen ab `index` werden durch `lines` ersetzt.
- `insert`: `lines` werden **vor** `index` eingefügt
  (`index == Zeilenanzahl` = anhängen).
- `delete`: `count` Zeilen ab `index` entfallen.

Warum Indizes statt Inhalts-Hashes reichen: Der Server kennt die
Basisversion vollständig. Version + Index ist damit eindeutig — auch bei
identischen Zeilen (Leerzeilen!).

**`checksum` ist Pflicht** (Hash des gesamten Basistexts). Die Versionsnummer
bestätigt nur, dass die Basis dieselbe *Version* ist, nicht dass beide Seiten
sie *gleich lesen*; ein Index-Versatz zerstörte Text sonst unbemerkt. Passt
die Prüfsumme nicht, antwortet der Server mit **422**, und der Client lädt
einmalig komplett neu. Siehe D76, Begründung im Geist von D59 („lieber der
laute Fehler").

**`clientId` und `seq` machen den PATCH wiederholbar.** Geht die Antwort
unterwegs verloren — im Mobilnetz der Normalfall —, weiß der Client nicht, ob
seine Änderung ankam. Der Server merkt sich je Dokument die zuletzt
verarbeitete `seq` pro `clientId` und beantwortet eine Wiederholung mit dem
Ergebnis von damals, statt sie erneut anzuwenden.

**Zeilenenden:** Der **Server** normalisiert beim Speichern autoritativ auf
LF (SPEC §12); der Client normalisiert beim Laden ebenfalls. Nur so hashen
beide Seiten denselben Text.

Werkbaum-Besonderheiten sind mit dem Zeilenmodell automatisch abgedeckt:
Fortsetzungszeilen (` \`), `"`-Beschreibungszeilen und der
`---`-Beschreibungsteil sind schlicht physische Zeilen. Halbfertige
Zwischenzustände rendert Werkbaum mit Warnung weiter — zeilenweise Updates
sind hier risikoarm.

**Faltmarken sind gewöhnliche Zeileninhalte.** Klappt jemand im Diagramm
einen Teilbaum um, schreibt Werkbaum das als `>`/`<` in den Text zurück
(D38-Nachtrag 2); unter Live-Editing wird daraus ein ganz normaler PATCH,
den alle Beobachter sehen. Das ist bewusst so entschieden (D76): Der Text
bleibt die eine Quelle der Wahrheit (D14). Auch der Falt-Durchschalter (D75)
bekommt keine Sonderbehandlung, obwohl ein Druck den ganzen Baum umbaut.

## API-Erweiterung (OpenAPI-Spec)

### 1. `PATCH /documents/{id}/content` — Änderung einreichen

Request: das Diff-Objekt oben.

- **200 OK**: akzeptiert. Antwort:

  ```json
  { "version": 42, "opsSinceBase": [ … ] }
  ```

  `opsSinceBase` ist leer, wenn die Basis noch aktuell war. War sie es nicht
  und ließen sich die Ops verschieben (siehe unten), stehen hier die fremden
  Ops, damit der Client seine Schattenkopie nachzieht.

- **Der Server rebased selbst.** Ist `baseVersion` veraltet, überschneiden
  sich die eingereichten Ops aber **nicht** mit den zwischenzeitlichen,
  verschiebt der Server sie auf die aktuelle Version und akzeptiert. Grund:
  Reines Ablehnen führt zu **Starvation** — ein Client mit höherer Latenz
  kommt bei fleißigen Mitschreibern womöglich nie durch, weil jeder Versuch
  beim Eintreffen wieder veraltet ist. Genau deshalb hat CodeMirror sein
  `rebaseUpdates` nachgerüstet. Nebengewinn: Der Client braucht seine
  Rebase-Logik nur noch für echte Konflikte.

- **409 Conflict**: nur bei **echter Überlappung**. Antwort enthält alles,
  was der Client zum Weiterarbeiten braucht — ohne Neuladen:

  ```json
  {
    "currentVersion": 43,
    "opsSinceBase": [ ...Diff von baseVersion → currentVersion... ]
  }
  ```

  Der Client zeigt dann zwei Knöpfe: **fremde Fassung übernehmen** oder
  **eigene durchsetzen** — jeweils nur für die überlappenden Zeilen, alles
  übrige ist bereits rebased. An dieser Stelle gewinnt einer vollständig,
  aber nichts geht endgültig verloren: Jede Version steht in der Historie.

- **404**: Dokument gelöscht (Restore-Hinweis in der Problem-Detail-Antwort).
- **422**: Diff nicht anwendbar (Index außerhalb, **Prüfsummenfehler**) —
  deutet auf einen Client-Bug, Client lädt einmalig neu.

**Überlappung, genau definiert.** Der betroffene Bereich einer Op ist
`[index, index+count)` für `replace` und `delete`. Für `insert` ist er ein
**Punkt** bei `index` — nicht ein leeres Intervall, sonst überschnitte er
sich mit nichts und Einfüge-Konflikte blieben unerkannt. Daraus folgt:

- Zwei Einfügungen an derselben Stelle sind **kein** Konflikt. Beide Zeilen
  bleiben; die bereits bestätigte fremde steht oben.
- Eine Einfügung in einen Bereich, den ein anderer **löscht**, ist einer —
  die neue Zeile landete sonst in einem Abschnitt, den es nicht mehr gibt.

**Titel:** `PATCH /documents/{id}/title` (mit `expectedVersion`) ändert den
Titel; er ist ein Metadatum, kein Zeileninhalt. `PUT /documents/{id}` bleibt
als „Ganzdokument ersetzen" bestehen (Import, Reparatur) und wertet künftig
`expectedVersion` aus.

**Grenzen:** Dokumentgröße und Op-Anzahl je Request sind serverseitig
begrenzt (sonst ist ein einzelner Request ein Ausfall-Vektor, auch
versehentlich durch einen Client-Bug).

### 2. `GET /documents/{id}/changes?since={version}&wait={seconds}` — Änderungsfeed

Long Polling, der Kern der „Echtzeit ohne WebSocket"-Lösung.

**Der Feed arbeitet auf der Historie, nicht am Dokument.** `delete()` entfernt
das Dokument und lässt nur den Tombstone stehen — ein Feed am Dokument müsste
danach 404 liefern, ausgerechnet für das `DELETED`-Ereignis, das er zustellen
soll. Solange es Historieneinträge zur UUID gibt, antwortet der Feed also;
**404 nur bei gänzlich unbekannter UUID** (dieselbe Regel, die `history()`
schon anwendet). Wartende Long-Polls müssen beim Löschen **zugestellt
bekommen**, bevor die Warteliste verworfen wird.

- Gibt es Änderungen nach `since`: **sofort 200** mit

  ```json
  {
    "fromVersion": 41,
    "currentVersion": 43,
    "ops": [ ...kumuliertes Diff 41 → 43... ],
    "events": [
      { "version": 43, "changeType": "UPDATED",
        "clientId": "c-8a41…", "displayName": "Anna" }
    ]
  }
  ```

- **Ist `since` bereits verdichtet** (siehe „Zwei Ebenen" unten), kann der
  Server kein exaktes Diff mehr liefern. Dann enthält die Antwort statt `ops`
  den **Volltext**:

  ```json
  { "fromVersion": null, "currentVersion": 87, "content": "…", "events": [ … ] }
  ```

  Der Client ersetzt seinen Stand. Ein Roundtrip und ein Sonderzustand
  weniger als ein eigener Fehlerpfad — und der Cursor-Erhalt ist über
  hunderte Versionen hinweg ohnehin nicht zu retten. Deckt zugleich den
  PWA-Fall nach längerer Offline-Zeit ab.

- Sonst hält der Server die Anfrage bis zu `wait` Sekunden offen. Kommt in
  der Zeit eine Änderung, antwortet er sofort; sonst **204 No Content**, und
  der Client pollt erneut. Der `wait`-Wert wird **serverseitig geklemmt** —
  ein Client darf keine beliebig lange Verbindung binden. Die Obergrenze
  steht erst fest, wenn die Zielumgebung vermessen ist (siehe „Betrieb").
- Die Antwort trägt **`Cache-Control: no-store`**; ein Proxy dürfte sonst
  eine 204 zwischenspeichern und der Feed stünde still.
- Latenz: praktisch sofort. Kosten: **1 offene HTTP-Anfrage pro Beobachter**,
  ~2,4 Requests/Minute im Leerlauf — rate-limit-freundlich, PWA-tauglich,
  kein WebSocket nötig.

**Änderungstypen im Feed:** `UPDATED`, `DELETED`, `RESTORED`, `ROLLED_BACK`
und `RENAMED` (dieses mit dem neuen Titel im Klartext).

- **`RESTORED` heißt ausschließlich: ein gelöschtes Dokument ist wieder da** —
  der Client hebt seine Sperre auf.
- **`ROLLED_BACK`** ist der Rückfall eines *lebenden* Dokuments auf eine alte
  Version (`restore` mit `targetVersion`). Für den Client ist das ein
  gewöhnlicher Inhaltswechsel; er hatte nie eine Sperre. Bisher trugen beide
  Fälle denselben Typ — ein Typ, der zwei Dinge bedeutet, ist die Unschärfe,
  aus der später Fehler werden.

Client-Schleife eines Beobachters:

```
loop:
  antwort = GET /changes?since=meineVersion&wait=25
  wenn 200 mit ops:     ops lokal anwenden, meineVersion = currentVersion
  wenn 200 mit content: Stand ersetzen, meineVersion = currentVersion
  wenn 204:             weiter
```

**Wichtig für den Client:** Eine gepufferte Feed-Antwort darf **nur**
angewendet werden, wenn ihr `fromVersion` zur aktuellen Schattenkopie passt.
Sonst wendet er dieselben Ops doppelt an — der Fall tritt ein, wenn Feed und
409-Antwort beide dasselbe fremde Diff liefern.

### Warum Long Polling und nicht SSE?

Server-Sent Events wären die Alternative (eine dauerhafte Verbindung,
Push vom Server). Long Polling gewinnt hier, weil es (a) reines
Request/Response-HTTP ist — testbar mit unseren Cucumber-Tests,
(b) keinerlei Sonderbehandlung in Proxies/PWA-Service-Workern braucht und
(c) bei 10 Beobachtern der Effizienzunterschied irrelevant ist. Ein
späterer Umstieg auf SSE oder WebSocket ändert nur den Feed-Endpunkt;
Diff-Format und Konfliktlogik bleiben identisch.

## Serverseitige Umsetzung

- **Diff anwenden**: Snapshot der Basisversion laden (bzw. aktueller Stand,
  wenn `baseVersion == currentVersion`, der Normalfall), Prüfsumme
  vergleichen, Ops anwenden, als neue Version speichern.
- **Diff berechnen** (für 409-Antwort und Feed): Zeilen-Diff zwischen zwei
  Snapshots (Myers oder eine einfache LCS-Implementierung).
- **Rebase** (siehe PATCH): Ops einer veralteten Basis gegen die
  zwischenzeitlichen verschieben, sofern sie sich nicht überschneiden.
- **Long Polling**: Spring MVC `DeferredResult` + ein In-Process-Notifier
  (pro Dokument eine Warteliste; Zustellung bei akzeptiertem Update **und**
  beim Löschen). Kein zusätzliches Framework nötig. **Das setzt eine
  Einzelinstanz voraus** — hinter einem Load Balancer erführe ein Beobachter
  auf der zweiten Instanz nichts und liefe in den Timeout. Bewusste Annahme,
  für die genannte Last angemessen.
- **Serialisierung**: Updates pro Dokument strikt sequenziell
  (Locking pro Dokument-UUID), damit Prüfung, Rebase und Anwenden atomar sind.

### Historie in zwei Ebenen

Mit 1,5 s Debounce wird die Historie sonst zum Transaktionslog: hunderte
Volltext-Snapshots eines 40-kB-Dokuments je Sitzung. Getrennt werden deshalb:

- **Sync-Versionen** — tragen das Protokoll (Diffs zwischen beliebigen
  Versionen), kurzlebig, werden nach einer Weile verdichtet. Danach
  beantwortet der Feed betroffene `since`-Werte mit Volltext (oben).
- **Meilensteine** — die nutzersichtbare Historie. Sie entstehen **nach einer
  Schreibpause und auf Knopfdruck**; dasselbe Muster wie die „Früheren
  Stände" im Editor (D54), erprobt und den Nutzern vertraut.

`DocumentHistoryRepository` braucht dafür **gezielten Zugriff auf eine
einzelne Version** statt wie heute stets alle Einträge zu laden
(`findByDocumentId` liefert alles, `restore`/`history` filtern in Kotlin
darüber — bei hunderten Versionen je Dokument untragbar).

## Betrieb — Zielumgebung vermessen (2026-08-26)

Gemessen auf `mih00.hostsharing.net`, wo die stabile Instanz
`werkbaum.javagil.de` liegt (D43):

| Befund | Wert | Bedeutung für Long Polling |
|---|---|---|
| Apache | 2.4.68 (Debian 12) | — |
| MPM | **event** | Kein Prozess je Verbindung; die Sorge aus dem ersten Entwurf entfällt |
| MaxRequestWorkers | **1024** (ServerLimit 64 × 32) | 10 offene Polls sind unkritisch |
| `Timeout` | **300 s** | `wait=25` liegt weit darunter |
| `ProxyTimeout` | nicht gesetzt → 300 s | dito |
| mod_proxy_http, mod_rewrite | geladen | Reverse Proxy technisch möglich |
| HTTP/2 | **nicht angeboten** | siehe unten |
| Java | **nur 17** | Backend verlangt 21 |
| systemd `Linger` | **yes** | Ein eigener Dienst darf dauerhaft laufen |
| PostgreSQL | lauscht auf 5432 | Der in `application.yaml` angedachte Umstieg wäre möglich |

**Long Polling trägt dort.** Die Zeitgrenzen sind großzügig, und der
Worker-Pool ist groß genug. **Pufferung ist bei Long Polling ohnehin kein
Thema** — anders als bei SSE kommt genau eine Antwort am Ende des Wartens,
kein Strom von Teilstücken.

**Der einzige echte Einwand ist das fehlende HTTP/2.** Damit gilt im Browser
das Limit von sechs Verbindungen je Herkunft. Ein Long-Poll belegt eine
davon; hat jemand denselben Plan in drei Tabs offen, sind drei Verbindungen
dauerhaft gebunden und die übrigen Requests drängen sich in den Rest. Zu
beheben wäre es serverseitig (HTTP/2 aktivieren) oder clientseitig, indem
sich mehrere Tabs über einen SharedWorker **eine** Feed-Verbindung teilen.

**Zwei offene Punkte vor einem Deployment dorthin:**

1. **Java 17 statt 21.** `build.gradle.kts` verlangt `JavaLanguageVersion.of(21)`.
   Entweder die Toolchain auf 17 senken (dann fallen Sprachfeatures weg) oder
   ein eigenes JDK 21 ins Home legen — beim Selfhosting problemlos, aber es
   muss jemand tun.
2. **Der Weg vom Apache zum Backend ist ungeklärt.** `ProxyPass` ist in
   `.htaccess` nicht zulässig, und `~/doms/<domain>/etc/` ist leer, sodass
   unklar bleibt, ob dort eigene vhost-Direktiven abgelegt werden können.
   Möglich wären `RewriteRule … [P]` (mod_rewrite ist aktiv, das P-Flag
   sperren manche Hoster jedoch) oder eine Rückfrage bei Hostsharing. **Nicht
   getestet**, weil dafür eine Proxy-Regel in der Produktionsumgebung
   einzurichten wäre.

Die Lehre aus D17-Nachtrag 4 bleibt: Was die Umgebung stellt, stellt der
Emulator nicht — die Zahlen oben sind gemessen, der Proxy-Pfad ist es nicht.

## Grenzen der simplen Variante (bewusst akzeptiert)

- Konflikterkennung auf **Dokumentebene** mit serverseitigem Rebase: Zwei
  Editoren an verschiedenen Stellen stören einander nicht mehr; ein 409 gibt
  es nur bei echter Überlappung derselben Zeilen.
- Kein Präsenz-Feature (wer ist online, fremde Cursor). Später über ein
  leichtgewichtiges `presence`-Feld im Feed nachrüstbar — `clientId` und
  Anzeigename gibt es dafür schon; das `!!!`-Fokusmark des Formats kann
  ergänzend genutzt werden.
- Clientseitige Verschlüsselung: Das Protokoll transportiert Zeilen als
  opake Strings und funktioniert unverändert mit Ciphertext pro Zeile —
  nur das serverseitige Diff-Berechnen und Rebasen entfiele dann (Clients
  müssten Ops immer selbst liefern; die Struktur erlaubt das bereits).

## Teststrategie

- **Cucumber**: „Client B sieht die Änderung von Client A im Feed",
  „veraltete Basis ohne Überlappung wird serverseitig rebased und akzeptiert",
  „veraltete Basis mit Überlappung liefert 409 mit opsSinceBase",
  „derselbe PATCH zweimal gesendet ändert das Dokument nur einmal",
  „falsche Prüfsumme liefert 422", „Feed meldet DELETED und danach RESTORED",
  „zu altes since liefert Volltext", „Umbenennen erscheint als RENAMED".
  Long Polling braucht dafür **Nebenläufigkeit im Test** (zwei Threads oder
  asynchrones MockMvc) und einen klein konfigurierbaren `wait`-Wert — der
  heutige synchrone `TestRestTemplate`-Stil allein reicht nicht.
- **Unit-Tests**: Diff-Anwendung (alle drei Ops, Randfälle: leeres Dokument,
  Anhängen, letzte Zeile), Diff-Berechnung, Index-Verschiebung, die
  Überlappungsregeln für `insert` (untereinander verträglich, mit `delete`
  nicht), Prüfsummenbildung samt Zeilenenden-Normalisierung.

## Umsetzungsreihenfolge

1. Diff-Modell + Anwenden/Berechnen/Rebasen als reine Kotlin-Funktionen
   (Unit-Tests)
2. Historie in zwei Ebenen + gezielter Repository-Zugriff
3. `PATCH /content` inkl. Rebase, Idempotenz, Prüfsumme und 409 (Spec +
   Cucumber)
4. `GET /changes` mit Long Polling, Volltext-Fall und Ereignistypen
   (Spec + Cucumber)
5. Master-Passwort für `GET /documents` (Spring Security)
6. Client-Anpassung (Feed-Schleife, lokales Anwenden, Konfliktdialog)

**Vor Schritt 4** steht die Vermessung der Zielumgebung (siehe „Betrieb") —
sie bestimmt den `wait`-Wert und im Extremfall, ob Long Polling dort
überhaupt trägt.
