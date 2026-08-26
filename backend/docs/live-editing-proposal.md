# Proposal: Live-Editing über HTTP (Variante „Simpel")

Status: Entwurf zur Diskussion — noch nichts implementiert.

## Ziel und Rahmenbedingungen

- Mehrere Clients (Werkbaum-Web-App/PWA) arbeiten am selben Dokument:
  ca. **10 Beobachter**, davon **2–3 gelegentliche Editoren**, praktisch nie
  in derselben Sekunde.
- **Nur HTTP**, kein WebSocket. Wenige, sparsame Requests (Lehre aus den
  aggressiven Rate-Limits der Etherpad-Integration).
- **Kein Neuladen des Dokuments** im Normalbetrieb: Clients erhalten
  Zeilen-Diffs und wenden sie lokal an, damit Cursor/Scrollposition erhalten
  bleiben.
- Das Werkbaum-Format ist **zeilenorientiert**; Zeilen-IDs (`#id`) sind
  optional und identifizieren Knoten, nicht Zeilen. Das Protokoll arbeitet
  deshalb ausschließlich auf **physischen Zeilen** und braucht keine IDs.
- Bei echtem Gleichzeitig-Konflikt: Update ablehnen, **der Client
  entscheidet** (rebase, neu laden, verwerfen). Das Dokument darf nie
  kaputtgehen.

## Grundidee in einem Satz

Jede Dokumentänderung ist ein **zeilenbasiertes Diff gegen eine
Basisversion**; der Server akzeptiert es nur, wenn die Basisversion noch die
aktuelle ist (Optimistic Locking auf Dokumentebene), und verteilt akzeptierte
Diffs über **Long Polling** an alle Beobachter.

## Datenmodell: das Zeilen-Diff

Ein Diff ist eine Liste von Operationen relativ zur Basisversion. Zeilen
werden über ihren **Index in der Basisversion** adressiert (0-basiert);
Operationen sind nach Index aufsteigend sortiert und überlappen nicht.

```json
{
  "baseVersion": 41,
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
Basisversion vollständig (Historie speichert Snapshots). Version + Index ist
damit eindeutig — auch bei identischen Zeilen (Leerzeilen!). Ein optionales
`"checksum"`-Feld (Hash des Gesamtdokuments der Basisversion) dient nur als
Integritätsprüfung gegen Client-Bugs.

Werkbaum-Besonderheiten sind damit automatisch abgedeckt: Fortsetzungszeilen
(` \`), `"`-Beschreibungszeilen und der `---`-Beschreibungsteil sind schlicht
physische Zeilen. Halbfertige Zwischenzustände rendert Werkbaum mit Warnung
weiter — zeilenweise Updates sind hier risikoarm.

## API-Erweiterung (OpenAPI-Spec)

### 1. `PATCH /documents/{id}/content` — Änderung einreichen

Request: das Diff-Objekt oben.

- **200 OK**: akzeptiert. Antwort: `{ "version": 42 }` (neue Version).
  Der Server wendet das Diff an, inkrementiert die Dokumentversion, schreibt
  einen Historieneintrag (ChangeType `UPDATED`).
- **409 Conflict**: `baseVersion` ist nicht mehr aktuell. Antwort enthält
  alles, was der Client zum Weiterarbeiten braucht — **ohne Neuladen**:

  ```json
  {
    "currentVersion": 43,
    "opsSinceBase": [ ...Diff von baseVersion → currentVersion... ]
  }
  ```

  Der Client entscheidet:
  - **Rebase**: fremde Ops lokal anwenden; überlappen sie nicht mit den
    eigenen Änderungen, eigene Ops auf neue Indizes verschieben und erneut
    senden. Deckt den häufigsten Fall („jemand hat weiter oben editiert")
    ohne Nutzerinteraktion ab.
  - **Konflikt anzeigen**: bei Überlappung Nutzer fragen (übernehmen /
    verwerfen / manuell mergen).
- **404**: Dokument gelöscht (Restore-Hinweis in der Problem-Detail-Antwort).
- **422**: Diff nicht anwendbar (Index außerhalb, Checksum-Fehler) —
  deutet auf einen Client-Bug, Client sollte neu laden.

`PUT /documents/{id}` bleibt als „Ganzdokument ersetzen" bestehen
(Import, Reparatur), wertet aber künftig `expectedVersion` aus.

### 2. `GET /documents/{id}/changes?since={version}&wait={seconds}` — Änderungsfeed

Long Polling, der Kern der „Echtzeit ohne WebSocket"-Lösung:

- Gibt es bereits Änderungen nach `since`: **sofort 200** mit

  ```json
  {
    "fromVersion": 41,
    "currentVersion": 43,
    "ops": [ ...kumuliertes Diff 41 → 43... ],
    "events": [ { "version": 43, "changeType": "UPDATED" } ]
  }
  ```

- Sonst hält der Server die Anfrage bis zu `wait` Sekunden offen
  (Empfehlung: 25 s, unterhalb üblicher Proxy-Timeouts). Kommt in der Zeit
  eine Änderung, antwortet er sofort; sonst **204 No Content**, und der
  Client pollt erneut.
- Latenz: praktisch sofort. Kosten: **1 offene HTTP-Anfrage pro Beobachter**,
  ~2,4 Requests/Minute im Leerlauf — rate-limit-freundlich, PWA-tauglich,
  kein WebSocket nötig.
- `DELETED`/`RESTORED` erscheinen als Events im Feed, damit Beobachter auch
  Löschung/Wiederherstellung live mitbekommen.

Client-Schleife eines Beobachters:

```
loop:
  antwort = GET /changes?since=meineVersion&wait=25
  wenn 200: ops lokal anwenden, meineVersion = currentVersion,
            Cursor-Indizes um Verschiebungen oberhalb korrigieren
  wenn 204: weiter
```

### Warum Long Polling und nicht SSE?

Server-Sent Events wären die Alternative (eine dauerhafte Verbindung,
Push vom Server). Long Polling gewinnt hier, weil es (a) reines
Request/Response-HTTP ist — trivial mit unseren Cucumber-Tests testbar,
(b) keinerlei Sonderbehandlung in Proxies/PWA-Service-Workern braucht und
(c) bei 10 Beobachtern der Effizienzunterschied irrelevant ist. Ein
späterer Umstieg auf SSE oder WebSocket ändert nur den Feed-Endpunkt;
Diff-Format und Konfliktlogik bleiben identisch.

## Serverseitige Umsetzung

- **Diff anwenden**: Snapshot der Basisversion aus der Historie laden
  (bzw. aktueller Stand, wenn `baseVersion == currentVersion`, der
  Normalfall), Ops anwenden, als neue Version speichern.
- **Diff berechnen** (für 409-Antwort und Feed): Zeilen-Diff zwischen zwei
  Snapshots aus der Historie (Standard-Algorithmus, z. B. Myers über
  `java.util`-nahe Bibliothek oder eigene simple Implementierung).
  Alternativ können eingereichte Ops pro Version direkt mitgespeichert
  werden — Optimierung, kein Muss für v1.
- **Long Polling**: Spring MVC `DeferredResult` + ein In-Process-Notifier
  (pro Dokument eine Warteliste; `notifyAll` bei akzeptiertem Update).
  Kein zusätzliches Framework nötig.
- **Serialisierung**: Updates pro Dokument strikt sequenziell
  (Locking pro Dokument-UUID), damit Versionsprüfung + Anwenden atomar sind.
- **Historie**: unverändert Snapshots; das Keyframe/Kompressions-Schema aus
  der Speicher-Evaluation ist eine spätere, unabhängige Optimierung hinter
  dem `DocumentHistoryRepository`-Interface.

## Grenzen der simplen Variante (bewusst akzeptiert)

- Konflikterkennung auf **Dokumentebene**: Zwei Editoren, die gleichzeitig
  verschiedene Stellen ändern, erzeugen formal einen Konflikt — der
  Rebase-Mechanismus in der 409-Antwort löst das aber in der Praxis
  transparent. Erst wenn das nicht reicht, lohnt Konflikt­prüfung pro
  Zeilenbereich (die 409-Struktur bleibt dabei gleich).
- Kein Präsenz-Feature (wer ist online, fremde Cursor). Später über ein
  leichtgewichtiges `presence`-Feld im Feed nachrüstbar; das `!!!`-Fokusmark
  des Formats kann dafür genutzt werden.
- Clientseitige Verschlüsselung: Das Protokoll transportiert Zeilen als
  opake Strings und funktioniert unverändert mit Ciphertext pro Zeile —
  nur das serverseitige Diff-Berechnen entfiele dann (Clients müssten Ops
  immer selbst liefern; die Struktur erlaubt das bereits).

## Teststrategie

- **Cucumber**: „Client B sieht die Änderung von Client A im Feed",
  „Patch mit veralteter Basisversion liefert 409 mit opsSinceBase",
  „Feed meldet DELETED", „Rebase-Fall: nicht überlappende Änderung nach 409
  erneut einreichen".
- **Unit-Tests**: Diff-Anwendung (alle drei Ops, Randfälle: leeres Dokument,
  Anhängen, letzte Zeile), Diff-Berechnung, Index-Verschiebung.

## Vorschlag Umsetzungsreihenfolge

1. Diff-Modell + Anwenden/Berechnen als reine Kotlin-Funktionen (Unit-Tests)
2. `PATCH /content` inkl. 409-Antwort (Spec + Cucumber)
3. `GET /changes` mit Long Polling (Spec + Cucumber)
4. Client-Anpassung (Feed-Schleife, lokales Anwenden, Rebase)
