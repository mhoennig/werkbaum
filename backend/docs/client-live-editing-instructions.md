# Aufgabe: Live-Editing-Client für den Werkbaum-Editor implementieren

Du arbeitest im Repository der Werkbaum-Web-App (PWA). Implementiere die
Client-Seite des Live-Editing-Protokolls gegen das Editor-Backend. Das
Protokoll ist HTTP-only (kein WebSocket): Änderungen werden als
zeilenbasierte Diffs per PATCH eingereicht, andere Clients erhalten sie über
einen Long-Polling-Feed.

**Wichtiger Kontext:** Die beiden Live-Editing-Endpunkte (`PATCH …/content`
und `GET …/changes`) sind im Backend spezifiziert, aber ggf. noch nicht
deployt. Implementiere gegen den hier definierten Vertrag und baue einen
Mock-Server (oder MSW-Handler) für die Tests. Die CRUD-Endpunkte existieren
bereits.

---

## 1. Backend-Vertrag

Basis-URL: konfigurierbar (`VITE_BACKEND_URL` o. Ä.), Pfad-Präfix `/api/v1`.
Alle Bodies sind JSON. Fehler kommen als RFC-9457 `application/problem+json`.

### 1.1 Bestehende Endpunkte (bereits verfügbar)

- `GET /documents/{uuid}` →
  `{ id, title, content, version, createdAt, updatedAt }`
  - `content`: das komplette Werkbaum-Dokument als ein String, LF-getrennt.
  - `version`: Long, wird serverseitig bei jeder Änderung inkrementiert.
- `GET /documents/{uuid}/history` → Historie (hier nicht benötigt).
- `POST /documents/{uuid}/restore` → gelöschtes Dokument wiederherstellen.

### 1.2 `PATCH /documents/{uuid}/content` — Änderung einreichen

Request:

```json
{
  "baseVersion": 41,
  "ops": [
    { "op": "replace", "index": 12, "count": 1, "lines": ["  - [~] Backend (L) @ben"] },
    { "op": "insert",  "index": 20, "lines": ["  + [?] Dark mode (S)"] },
    { "op": "delete",  "index": 25, "count": 2 }
  ]
}
```

Antworten:

| Status | Bedeutung | Body |
|---|---|---|
| 200 | akzeptiert | `{ "version": 42 }` |
| 409 | `baseVersion` veraltet | `{ "currentVersion": 43, "opsSinceBase": [ …Ops… ] }` |
| 404 | Dokument gelöscht | problem+json |
| 422 | Diff nicht anwendbar (Client-Bug) | problem+json |

Nach 200: lokale Version auf `version` setzen. Nach 409: siehe Rebase (§4).
Nach 422: Dokument einmalig komplett neu laden (GET) und Zustand ersetzen —
das ist der einzige zulässige Vollreload-Pfad.

### 1.3 `GET /documents/{uuid}/changes?since={version}&wait=25` — Feed

- 200: `{ "fromVersion": 41, "currentVersion": 43, "ops": [ … ], "events": [ { "version": 43, "changeType": "UPDATED" } ] }`
  - `ops` ist das **kumulierte** Diff `fromVersion → currentVersion`,
    direkt anwendbar auf den lokalen Stand, wenn `since == fromVersion`.
  - `changeType` ∈ `CREATED | UPDATED | DELETED | RESTORED`.
- 204: Timeout ohne Änderungen → sofort erneut pollen.
- Netzwerkfehler/Timeout des Browsers: mit Exponential Backoff
  (1 s, 2 s, 4 s … max 30 s) erneut versuchen; bei Erfolg Backoff zurücksetzen.
- Bei `changeType == "DELETED"`: Editieren sperren, Banner „Dokument wurde
  gelöscht" mit Restore-Button (`POST /restore`) anzeigen. Bei `RESTORED`
  Sperre aufheben.

---

## 2. Diff-Format: exakte Semantik

Das Dokument ist eine Liste von Zeilen: `content.split("\n")`.
Alle Indizes sind **0-basiert und beziehen sich auf die Basisversion**
(nicht auf Zwischenstände!). Ops sind nach `index` aufsteigend sortiert und
überlappen nicht.

- `replace`: ersetzt `count` Zeilen ab `index` durch `lines`
  (`lines.length` darf von `count` abweichen).
- `insert`: fügt `lines` **vor** `index` ein; `index == zeilen.length`
  bedeutet anhängen.
- `delete`: entfernt `count` Zeilen ab `index`.

**Anwenden:** entweder rückwärts iterieren (höchster Index zuerst), dann
bleiben die Basis-Indizes gültig — oder vorwärts mit mitlaufendem Offset.
Implementiere `applyOps(lines: string[], ops: Op[]): string[]` als pure
Funktion, rückwärts iterierend (einfacher zu beweisen).

**Erzeugen:** implementiere `computeOps(before: string[], after: string[]): Op[]`
mit einem Standard-Zeilen-Diff (Myers; eine kleine Bibliothek wie `diff`
[jsdiff] mit `diffArrays` ist ok, dann Hunks in unsere drei Op-Typen
übersetzen). Aufeinanderfolgende delete+insert am selben Index zu `replace`
zusammenfassen.

**Invarianten (als Tests absichern):**
- `applyOps(before, computeOps(before, after)) ≡ after` (Property-Test mit
  zufälligen Zeilen-Arrays, unbedingt mit Duplikaten und Leerzeilen).
- Leeres Diff (`ops: []`) wird gar nicht erst gesendet.

**Zeilenenden:** beim Laden und vor jedem `computeOps` normalisieren:
`content.replace(/\r\n?/g, "\n")`. Kein trailing-newline-Sonderfall:
`split("\n")` auf beiden Seiten konsistent verwenden.

---

## 3. Sync-Engine (Kernmodul)

Lege ein UI-unabhängiges Modul `syncEngine.ts` an mit diesem Zustand:

```ts
interface SyncState {
  documentId: string;
  serverVersion: number;     // letzte bestätigte Server-Version
  serverLines: string[];     // Stand der Server-Version (Schattenkopie)
  localLines: string[];      // aktueller Editor-Inhalt
  pending: Op[] | null;      // gerade unterwegs befindlicher Patch
  status: "idle" | "sending" | "conflict" | "deleted" | "offline";
}
```

Abläufe:

1. **Init:** `GET /documents/{id}` → `serverVersion`, `serverLines`,
   `localLines` initialisieren; Feed-Schleife starten.
2. **Lokale Eingabe:** Editor schreibt nur `localLines`. Ein Debounce
   (Empfehlung: 1500 ms nach letztem Tastendruck, zusätzlich sofort bei
   Blur/Fenster-Verlassen via `visibilitychange`) triggert `flush()`.
3. **`flush()`:** wenn `pending` leer und `localLines ≠ serverLines`:
   `ops = computeOps(serverLines, localLines)`, PATCH senden,
   `pending = ops`, `status = "sending"`.
   - 200 → `serverVersion = antwort.version`,
     `serverLines = applyOps(serverLines, pending)`, `pending = null`.
     Falls sich `localLines` inzwischen weiter geändert hat: erneut flushen.
   - 409 → Rebase (§4).
4. **Feed-Ereignis (200):** Remote-Ops einarbeiten (§5). Niemals während
   `status == "sending"` anwenden — Feed-Antworten bis zur PATCH-Antwort
   puffern (Queue), sonst entstehen Races zwischen eigener und fremder
   Änderung.

Nur **eine** Feed-Anfrage gleichzeitig; `AbortController` benutzen und beim
Dokumentwechsel/Unmount abbrechen.

## 4. Rebase nach 409

Gegeben: eigene ungesicherte Änderung (`localLines` vs. `serverLines`) und
`opsSinceBase` (fremd). Vorgehen:

1. `theirs = opsSinceBase`, `mine = computeOps(serverLines, localLines)`.
2. **Überlappungsprüfung:** berechne für jede Op ihren betroffenen
   Zeilenbereich in Basis-Koordinaten (`[index, index + count)` bzw. für
   insert `[index, index]`). Überschneidet sich ein Bereich aus `mine` mit
   einem aus `theirs` → **echter Konflikt**: `status = "conflict"`, UI zeigt
   Dialog („Fremde Änderung übernehmen und meine verwerfen" / „Meine
   erzwingen" — letzteres = fremde Ops anwenden, eigene Zeilen darüber
   schreiben, als neuen Patch senden). Keine automatische Silent-Merge-Magie
   bei Überlappung.
3. **Kein Überlappen (Normalfall):**
   - `serverLines = applyOps(serverLines, theirs)`,
     `serverVersion = currentVersion`.
   - `localLines`: ebenfalls `theirs` anwenden, aber mit Index-Verschiebung
     durch die eigenen, noch nicht gesendeten Edits. Einfachste korrekte
     Variante: `mine` gegen `theirs` verschieben (für jede eigene Op:
     Summe der Zeilendelta aller fremden Ops mit kleinerem Index addieren),
     dann `localLines = applyOps(serverLines, mineShifted)`.
   - Danach normal `flush()`.

## 5. Remote-Ops anwenden ohne Cursor-Verlust

Beim Einarbeiten von Feed-Ops in den Editor:

- **CodeMirror 6 / Monaco:** Ops in eine einzige Änderungs-Transaktion des
  Editors übersetzen (CM6: `dispatch({changes: […]})` mit
  from/to-Offsets; Monaco: `applyEdits`). Der Editor verschiebt Cursor,
  Selektion und Scrollposition dann selbst korrekt. **Das ist der bevorzugte
  Weg — niemals `setValue()` mit dem Gesamttext aufrufen**, das ist genau
  der verbotene „Cursor springt an den Anfang"-Fall.
- **Rohe Textarea (Fallback):** Cursor via `selectionStart` in
  `(zeile, spalte)` umrechnen. Pro Op: Bereich komplett unterhalb der
  Cursor-Zeile → nichts; komplett oberhalb → Cursor-Zeile um das
  Zeilendelta der Op verschieben; Op trifft die Cursor-Zeile → Zeile
  beibehalten (ggf. auf neue Zeilenanzahl klemmen), Spalte auf neue
  Zeilenlänge klemmen. Danach zurückrechnen und `setSelectionRange` setzen,
  Scrollposition vorher sichern und wiederherstellen.
- **IME:** während einer aktiven Composition (`compositionstart` bis
  `compositionend`) keine Remote-Ops in den Editor schreiben — in einer
  Queue puffern und danach anwenden.

## 6. Was NICHT tun

- Kein WebSocket, kein SSE, kein setInterval-Kurztakt-Polling — nur die
  Long-Poll-Schleife (Rate-Limit-Disziplin ist eine harte Anforderung).
- Kein Vollreload des Dokuments außer im 422-Fall.
- Keine Ops auf Zwischenständen aufsetzen: `computeOps` immer gegen
  `serverLines` der bestätigten `serverVersion`.
- Keine Auto-Merges bei überlappenden Änderungen — der Nutzer entscheidet.

## 7. Tests (mindestens)

Unit (pure Funktionen, kein DOM):
- `applyOps`: jede Op-Art; Anhängen; letzte Zeile löschen; leeres Dokument;
  mehrere Ops in einem Diff; Property-Test Roundtrip mit `computeOps`.
- Überlappungsprüfung und Index-Verschiebung (Rebase) mit Tabellenfällen.
- Cursor-Korrektur: Änderung oberhalb / unterhalb / auf der Cursor-Zeile;
  „300-Zeilen-Dokument, Edit in Zeile 5, Cursor in Zeile 200 bleibt
  inhaltlich an derselben Stelle".

Integration (Mock-Server/MSW):
- Feed liefert Ops → Editorinhalt aktualisiert, Cursor stabil.
- PATCH → 409 mit nicht überlappenden `opsSinceBase` → automatischer
  Rebase + erneuter PATCH → 200.
- PATCH → 409 mit überlappenden Ops → Konfliktdialog erscheint.
- Feed meldet `DELETED` → Editor gesperrt, Restore-Flow funktioniert.
- Long-Poll 204 → nahtloses Re-Polling; Netzwerkfehler → Backoff.

## 8. Reihenfolge

1. `diff.ts`: `applyOps`, `computeOps`, Bereichs-/Shift-Helfer + Unit-Tests
2. `syncEngine.ts`: Zustand, flush, Feed-Schleife, Rebase + Tests gegen Mock
3. Editor-Anbindung (Transaktions-Anwendung, Cursor, IME)
4. UI: Konfliktdialog, Deleted-Banner, Offline-Indikator
