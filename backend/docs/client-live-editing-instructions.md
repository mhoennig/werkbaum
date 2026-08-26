# Aufgabe: Live-Editing-Client für den Werkbaum-Editor implementieren

Du arbeitest im **Werkbaum-Monorepo**, Teilprojekt `frontend/`. Implementiere
die Client-Seite des Live-Editing-Protokolls gegen das Editor-Backend
(`backend/`). Das Protokoll ist HTTP-only (kein WebSocket): Änderungen werden
als zeilenbasierte Diffs per PATCH eingereicht, andere Clients erhalten sie
über einen Long-Polling-Feed.

**Wichtiger Kontext:** Die Live-Editing-Endpunkte sind spezifiziert
(`backend/docs/live-editing-proposal.md`, Entscheidungen in
`docs/DECISIONS.md` D76), aber noch nicht implementiert. Baue gegen den hier
definierten Vertrag; die CRUD-Endpunkte existieren bereits.

## 0. Randbedingungen des Projekts — bitte zuerst lesen

Diese Punkte sind nicht verhandelbar und bestimmen jede
Implementierungsentscheidung unten:

- **Keine Laufzeit-Abhängigkeiten.** `frontend/package.json` hat ein leeres
  `dependencies`; alles unter `devDependencies` (Vite, Vitest, jsdom)
  verschwindet beim Bauen. D11/D19/D20 und CLAUDE.md: neue
  Laufzeit-Abhängigkeiten nur nach Rückfrage. Also **kein jsdiff**, **kein
  CodeMirror**, **kein MSW** — Diff und Test-Doubles werden selbst gebaut.
- **Vanilla JavaScript**, keine TypeScript-Dateien. Module liegen als
  `frontend/src/*.js` (siehe `parser.js`, `model.js`, `render.js`,
  `snapshots.js`, `autocomplete.js`).
- **Der Editor ist eine rohe `<textarea wrap="off">`** (`index.html`, D49).
  Ein Editor-Framework ist bewusst nicht im Spiel (D76: CodeMirror wäre eine
  eigene Entscheidung mit eigenem Nutzen, nicht die Nebenwirkung dieses
  Features). Cursor-Erhalt beim Einspielen fremder Änderungen ist deshalb
  **deine Aufgabe**, nicht die eines Frameworks.
- **Testbare Logik gehört in ein eigenes Modul.** Die Hausregel aus
  D54-Nachtrag 3: Was entscheidbar ist, wandert headless nach `src/*.js` und
  bekommt Vitest-Tests; in `app.js` bleibt nur die Verdrahtung mit DOM und
  Netz.
- **Deutsch ist die Quellsprache** für neue UI-Texte (`I18N` in
  `frontend/index.html`), danach in alle neun Sprachen übersetzen.

---

## 1. Backend-Vertrag

Basis-URL: konfigurierbar, Pfad-Präfix `/api/v1`. Alle Bodies sind JSON.
Fehler kommen als RFC-9457 `application/problem+json`.

### 1.1 Bestehende Endpunkte

- `GET /documents/{uuid}` →
  `{ id, title, content, version, createdAt, updatedAt }`
  - `content`: das komplette Werkbaum-Dokument als ein String, LF-getrennt.
  - `version`: Long, wird serverseitig bei jeder Änderung inkrementiert.
- `GET /documents/{uuid}/history` → Meilensteine (siehe §7).
- `POST /documents/{uuid}/restore` → gelöschtes Dokument wiederherstellen.

`GET /documents` (Liste) verlangt ein Master-Passwort und ist für den Editor
**nicht** vorgesehen — er kennt seine Dokumente über ihre URL (§6).

### 1.2 `PATCH /documents/{uuid}/content` — Änderung einreichen

Request:

```json
{
  "baseVersion": 41,
  "checksum": "sha256:9f2b…",
  "clientId": "c-8a41…",
  "seq": 17,
  "ops": [
    { "op": "replace", "index": 12, "count": 1, "lines": ["  - [~] Backend (L) @ben"] },
    { "op": "insert",  "index": 20, "lines": ["  + [?] Dark mode (S)"] },
    { "op": "delete",  "index": 25, "count": 2 }
  ]
}
```

- `checksum` ist **Pflicht**: Hash des vollständigen Basistexts. Er fängt
  Client-Bugs und abweichende Zeilenenden, bevor Ops an falschen Indizes
  landen.
- `clientId` ist eine zufällige, im `localStorage` gehaltene Kennung; `seq`
  eine je Client aufsteigende Nummer. Beides zusammen macht den Request
  **wiederholbar** (§3.5).

Antworten:

| Status | Bedeutung | Body |
|---|---|---|
| 200 | akzeptiert | `{ "version": 42, "opsSinceBase": [ … ] }` |
| 409 | echte Überlappung | `{ "currentVersion": 43, "opsSinceBase": [ … ] }` |
| 404 | Dokument gelöscht | problem+json |
| 422 | Diff nicht anwendbar oder Prüfsumme falsch | problem+json |

**Der Server rebased selbst.** War `baseVersion` veraltet, überschneiden sich
die Ops aber nicht mit den zwischenzeitlichen, verschiebt der Server sie und
antwortet mit **200**; `opsSinceBase` enthält dann die fremden Ops, damit du
deine Schattenkopie nachziehst. Ein **409 kommt nur bei echter Überlappung**
derselben Zeilen — nur dafür brauchst du den Konfliktdialog (§4).

Nach 200: `serverVersion = version`, dann erst `opsSinceBase`, dann die
eigenen Ops auf die Schattenkopie anwenden. Nach 422: Dokument einmalig
komplett neu laden (GET) und Zustand ersetzen — das ist neben dem
Volltext-Feed (§1.3) der einzige Vollreload-Pfad.

**Titel:** `PATCH /documents/{uuid}/title` mit `{ title, expectedVersion }`.
Der Titel ist ein Metadatum und läuft nicht durch das Zeilen-Diff.

### 1.3 `GET /documents/{uuid}/changes?since={version}&wait=25` — Feed

- **200 mit `ops`**:
  `{ "fromVersion": 41, "currentVersion": 43, "ops": [ … ], "events": [ … ] }`
  - `ops` ist das **kumulierte** Diff `fromVersion → currentVersion`.
- **200 mit `content`**:
  `{ "fromVersion": null, "currentVersion": 87, "content": "…", "events": [ … ] }`
  - Kommt, wenn `since` bereits verdichtet ist (langes Offline, alter Tab).
    Ersetze den Stand vollständig. Kein Fehler, kein Sonderzustand.
- **204**: Timeout ohne Änderungen → sofort erneut pollen.
- Netzwerkfehler/Timeout des Browsers: mit Exponential Backoff
  (1 s, 2 s, 4 s … max 30 s) erneut versuchen; bei Erfolg Backoff zurücksetzen.

`events` trägt je Eintrag `{ version, changeType, clientId, displayName }`,
`changeType` ∈ `UPDATED | DELETED | RESTORED | ROLLED_BACK | RENAMED`:

- **`DELETED`**: Editieren sperren, Banner „Dokument wurde gelöscht" mit
  Restore-Knopf (`POST /restore`).
- **`RESTORED`**: Ein gelöschtes Dokument ist wieder da — Sperre aufheben.
- **`ROLLED_BACK`**: Ein *lebendes* Dokument wurde auf eine alte Version
  zurückgesetzt. Es gab keine Sperre; behandle es wie ein gewöhnliches
  Inhaltsupdate. (Die beiden Fälle trugen früher denselben Typ — deshalb die
  Trennung.)
- **`RENAMED`**: Das Ereignis führt den neuen Titel mit; übernimm ihn in den
  Dokumentnamen.

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

**Anwenden:** `applyOps(lines, ops)` als pure Funktion, **rückwärts
iterierend** (höchster Index zuerst) — dann bleiben die Basis-Indizes gültig
und die Korrektheit ist leicht zu sehen.

**Erzeugen:** `computeOps(before, after)` **selbst implementieren** — ein
zeilenbasiertes Diff über die längste gemeinsame Teilfolge, rund hundert
Zeilen (dieselbe Größenordnung wie der Zeilenumbruch aus D64). Zeilen für den
Vergleich als Ganzes behandeln; aufeinanderfolgende delete+insert am selben
Index zu `replace` zusammenfassen. **Keine Bibliothek** (§0).

**Überlappung** (für den Konfliktfall, §4): Der betroffene Bereich ist
`[index, index+count)` für `replace` und `delete`, für `insert` ein **Punkt**
bei `index`. Daraus folgt — und das ist Absicht:

- Zwei Einfügungen an derselben Stelle sind **kein** Konflikt; beide Zeilen
  bleiben, die bereits bestätigte fremde steht oben.
- Eine Einfügung in einen Bereich, den ein anderer **löscht**, ist einer.

**Invarianten (als Tests absichern):**
- `applyOps(before, computeOps(before, after)) ≡ after` — Property-Test mit
  zufälligen Zeilen-Arrays, unbedingt mit Duplikaten und Leerzeilen.
- Leeres Diff (`ops: []`) wird gar nicht erst gesendet.

**Zeilenenden:** beim Laden und vor jedem `computeOps` normalisieren:
`content.replace(/\r\n?/g, "\n")`. Der Server normalisiert beim Speichern
ebenfalls auf LF — nur so hashen beide Seiten denselben Text (Prüfsumme!).
Kein trailing-newline-Sonderfall: `split("\n")` auf beiden Seiten konsistent.

---

## 3. Sync-Engine (Kernmodul)

Lege ein UI-unabhängiges Modul `frontend/src/sync.js` an mit diesem Zustand:

```js
// {
//   documentId,          // UUID
//   serverVersion,       // letzte bestätigte Server-Version
//   serverLines,         // Stand der Server-Version (Schattenkopie)
//   localLines,          // aktueller Editor-Inhalt
//   pending,             // gerade unterwegs befindlicher Patch (oder null)
//   seq,                 // laufende Nummer des nächsten Patches
//   status,              // 'idle' | 'sending' | 'conflict' | 'deleted' | 'offline'
// }
```

Die reinen Funktionen (Diff, Überlappung, Verschiebung, Cursor-Korrektur)
gehören nach `frontend/src/diff.js` und bekommen Vitest-Tests; `sync.js`
hält den Ablauf, `app.js` nur die Verdrahtung.

1. **Init:** `GET /documents/{id}` → `serverVersion`, `serverLines`,
   `localLines` initialisieren; Feed-Schleife starten.
2. **Lokale Eingabe:** Der Editor schreibt nur `localLines`. Ein Debounce von
   **1500 ms** nach dem letzten Tastendruck, zusätzlich sofort bei Blur und
   `visibilitychange`, triggert `flush()`. Der Wert bleibt bewusst kurz: Die
   Rate-Limit-Disziplin galt einem fremden Etherpad-Server, am eigenen
   Backend gelten eigene Grenzen (D76).
3. **`flush()`:** wenn kein `pending` und `localLines ≠ serverLines`:
   `ops = computeOps(serverLines, localLines)`, Prüfsumme über
   `serverLines.join("\n")` bilden, PATCH senden, `pending = ops`,
   `status = 'sending'`.
   - **200** → `serverVersion = antwort.version`; erst
     `serverLines = applyOps(serverLines, antwort.opsSinceBase)` (falls
     vorhanden), dann `applyOps(…, pending)`; `pending = null`, `seq++`.
     Hat sich `localLines` inzwischen weiter geändert: erneut flushen.
   - **409** → Konflikt (§4).
   - **422** → einmalig neu laden.
4. **Feed-Ereignis:** Remote-Ops einarbeiten (§5). Während
   `status === 'sending'` **nicht** anwenden, sondern puffern — sonst entsteht
   ein Race zwischen eigener und fremder Änderung.
5. **Die gepufferte Antwort nur anwenden, wenn ihr `fromVersion` zur
   aktuellen `serverVersion` passt**, sonst verwerfen. Ohne diese Prüfung
   wendest du dieselben Ops doppelt an: Feed und die Antwort auf deinen PATCH
   können dasselbe fremde Diff enthalten.
6. **Wiederholung nach Netzwerkfehler:** Denselben Patch mit **derselben
   `seq`** erneut senden. Der Server erkennt ihn und wendet ihn nicht zweimal
   an. `seq` erst nach einer bestätigten Antwort erhöhen — genau darin liegt
   der Schutz.

Nur **eine** Feed-Anfrage gleichzeitig; `AbortController` benutzen und beim
Dokumentwechsel/Unmount abbrechen. `status = 'offline'` gilt, sobald ein
Request am Netz scheitert, und endet mit der nächsten erfolgreichen Antwort;
lokale Änderungen bleiben dabei erhalten und werden danach normal geflusht.

## 4. Konflikt nach 409

Ein 409 heißt: Eure Änderungen betreffen **dieselben Zeilen**. Alles andere
hat der Server bereits rebased.

1. `serverLines = applyOps(serverLines, opsSinceBase)`,
   `serverVersion = currentVersion`.
2. `status = 'conflict'`, Editieren weiter erlauben, aber nicht senden.
3. Dialog mit genau zwei Möglichkeiten, jeweils **nur für die überlappenden
   Zeilen** — alles Übrige ist bereits sauber übernommen:
   - **Fremde Fassung übernehmen**: die eigenen überlappenden Ops verwerfen.
   - **Eigene Fassung durchsetzen**: die überlappenden Zeilen des neuen
     Serverstands durch die eigenen ersetzen und als neuen Patch senden.
   Dort gewinnt einer vollständig — das ist bewusst so, und nichts geht
   endgültig verloren: Jede Version steht in der Server-Historie.
4. Keine automatische Zusammenführung bei Überlappung, keine Konfliktmarker
   im Text.

## 5. Remote-Ops anwenden ohne Cursor-Verlust

Der Editor ist eine `<textarea>` — die Umrechnung ist deine Aufgabe, und sie
gehört als **pure Funktion** nach `diff.js`:

- Cursor (`selectionStart`/`selectionEnd`) in `(zeile, spalte)` umrechnen.
- Pro Op: Bereich vollständig **unterhalb** der Cursor-Zeile → nichts;
  vollständig **oberhalb** → Cursor-Zeile um das Zeilendelta der Op
  verschieben; Op **trifft** die Cursor-Zeile → Zeile beibehalten (auf die
  neue Zeilenanzahl klemmen), Spalte auf die neue Zeilenlänge klemmen.
- Zurückrechnen, `setSelectionRange` setzen; Scrollposition **vorher sichern
  und wiederherstellen** (auch `scrollLeft` — das Textfeld bricht nicht um,
  D49).
- Der Zeilennummern-Streifen und der Spiegel (D33) müssen danach neu
  gemessen werden, ebenso das Diagramm.
- **IME:** Während einer aktiven Composition (`compositionstart` bis
  `compositionend`) keine Remote-Ops schreiben — puffern und danach anwenden.
- **Niemals** den Gesamttext neu setzen. Das ist genau der verbotene
  „Cursor springt an den Anfang"-Fall.

**Faltmarken sind gewöhnlicher Text.** Klappt jemand im Diagramm um, schreibt
Werkbaum `>`/`<` in den Text zurück (D38-Nachtrag 2) — das ist eine ganz
normale lokale Änderung und geht als PATCH hinaus wie jede andere. Das ist
entschieden (D76) und braucht keine Sonderbehandlung, auch nicht für den
Falt-Durchschalter (D75).

## 6. Einbettung in den Editor

- **Adressierung über einen URL-Parameter**, im Muster von `?sourceUrl=`
  (D23) und `?etherpad=` (D31): Die Dokument-Identität leitet sich aus der
  URL ab, derselbe Link führt immer in dasselbe Dokument, der Name ist die
  URL (vollständig im Tooltip). Ein Menüeintrag **„Auf den Server legen"**
  legt ein lokales Dokument neu an — analog zu „Als Datei speichern" (D72).
- **Der Verlaufs-Knopf zeigt bei Server-Dokumenten die Server-Meilensteine**
  statt der lokalen Stände (D54): gleiche Bedienung, bessere Quelle. Lokale
  Stände wären hier irreführend, weil „mein Stand von vorhin" fremde
  Änderungen enthält, die man nie gesehen hat.
- Textfeld **nicht** schreibgeschützt (anders als bei Pad-Dokumenten, D31) —
  hier ist unser Textfeld die Schreibfläche.

## 7. Was NICHT tun

- Kein WebSocket, kein SSE, kein setInterval-Kurztakt-Polling — nur die
  Long-Poll-Schleife.
- Keine neue Laufzeit-Abhängigkeit (§0) — insbesondere kein jsdiff und kein
  Editor-Framework.
- Kein Vollreload außer bei 422 und beim Volltext-Feed.
- Keine Ops auf Zwischenständen: `computeOps` immer gegen `serverLines` der
  bestätigten `serverVersion`.
- Keine Auto-Merges bei überlappenden Änderungen — der Nutzer entscheidet.
- `seq` nicht erhöhen, bevor eine Antwort da ist.

## 8. Tests (mindestens)

Unit (pure Funktionen, kein DOM, Vitest wie die übrigen Module):
- `applyOps`: jede Op-Art; Anhängen; letzte Zeile löschen; leeres Dokument;
  mehrere Ops in einem Diff; Property-Test Roundtrip mit `computeOps`.
- Überlappungsprüfung: `insert` gegen `insert` am selben Index (kein
  Konflikt), `insert` in einen `delete`-Bereich (Konflikt), Ränder.
- Index-Verschiebung mit Tabellenfällen.
- Cursor-Korrektur: Änderung oberhalb / unterhalb / auf der Cursor-Zeile;
  „300-Zeilen-Dokument, Edit in Zeile 5, Cursor in Zeile 200 bleibt
  inhaltlich an derselben Stelle".
- Prüfsummenbildung inklusive Zeilenenden-Normalisierung.

Integration (mit selbstgebauten `fetch`-Doubles, **kein MSW**):
- Feed liefert Ops → Editorinhalt aktualisiert, Cursor stabil.
- PATCH mit veralteter Basis ohne Überlappung → 200 mit `opsSinceBase` →
  Schattenkopie stimmt danach mit dem Server überein.
- PATCH → 409 mit überlappenden Ops → Konfliktdialog erscheint, beide Wege
  führen zu einem konsistenten Zustand.
- Derselbe Patch zweimal gesendet (simulierter Antwortverlust) → Dokument
  ändert sich nur einmal.
- Feed liefert `content` statt `ops` → Stand wird ersetzt.
- Feed meldet `DELETED` → gesperrt; `RESTORED` → entsperrt; `ROLLED_BACK` →
  Inhalt gewechselt, keine Sperre; `RENAMED` → Name übernommen.
- Gepufferte Feed-Antwort mit veraltetem `fromVersion` → verworfen, keine
  doppelte Anwendung.
- Long-Poll 204 → nahtloses Re-Polling; Netzwerkfehler → Backoff.

## 9. Reihenfolge

1. `frontend/src/diff.js`: `applyOps`, `computeOps`, Überlappungs- und
   Verschiebungs-Helfer, Cursor-Korrektur + Unit-Tests
2. `frontend/src/sync.js`: Zustand, `flush`, Feed-Schleife, Idempotenz +
   Tests gegen `fetch`-Doubles
3. Editor-Anbindung (Anwenden ohne Cursor-Verlust, Zeilennummern und
   Diagramm nachziehen, IME)
4. Einbettung: URL-Parameter, „Auf den Server legen", Verlauf vom Server
5. UI: Konfliktdialog, Deleted-Banner, Offline-Anzeige — Texte zuerst auf
   Deutsch, dann in alle neun Sprachen
