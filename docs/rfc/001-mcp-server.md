# RFC 001 — MCP-Server: Werkbaum für KI-Agenten außerhalb des Editors

| | |
|---|---|
| Status | **Abgestimmt** (2026-09-02, Entscheidungen in §11 und D93) — nichts gebaut |
| Plan-Knoten | `#ai.mcp` in `docs/examples/werkbaum.werkbaum` |
| Entscheidung | D93 in `docs/DECISIONS.md` (Verweis auf dieses RFC) |
| Berührt | `frontend/src/*` (headless-Module, lesend), neues Paket `mcp/`, `tools/pull-doc` (Aufrufer), README, `.mcp.json` |
| Berührt nicht | Notation (SPEC), `llms.md`, Backend-Code, Deploy-Skripte |

## 1. Zusammenfassung

Werkbaum bekommt einen **MCP-Server** (Model Context Protocol): ein kleines
Node-Paket, das KI-Agenten außerhalb des Editors — Claude Code, IDE-Agenten,
Desktop-Assistenten — einen Werkbaum-Plan als **Ressource** (Text) und als
**Werkzeuge** (Baum, Warnungen, günstigster Pfad, Schreiben) anbietet.

Der Server **parst nicht selbst**: Er importiert die headless-Module des
Frontends (`parser.js`, `model.js`, `live.js`) unverändert. Damit bleibt D14
gewahrt — es gibt weiterhin genau einen Parser — und ein Agent bekommt
wörtlich dieselben Warnungen, effektiven Status und Stationen, die das
Diagramm zeigt.

Geschrieben wird über denselben Weg wie aus dem Editor: als **Zeilen-Diff
gegen eine Basisversion mit Prüfsumme** (D76). Fremde Änderungen werden nie
überschrieben, ein Konflikt kommt als Fehler zurück, und in jedem offenen
Editor steht „geändert von: *Claude Code*“. Zwei Leitplanken gelten auf
jedem Schreibvorgang: **keine beschädigte Notation** (Struktur-Warnungen
blockieren, inhaltliche werden gemeldet), **kein `[^]` von einem Agenten**.

Der Server arbeitet bevorzugt auf dem **geteilten Dokument** — dort sitzen
die Menschen —, und derselbe Plan kann zugleich **unter Git-Kontrolle**
stehen: Nach jedem Agenten-Schreibvorgang committet der Server den
Serverstand über das vorhandene `tools/pull-doc --git-commit` (D88) in eine
Spiegel-Datei. Der Server ist die Quelle, Git das Archiv (§5.7).

Das ist die **Gegenrichtung** zu `#ai.dialog`: Dort käme ein Modell in den
Editor, hier geht der Plan zu Agenten, die schon irgendwo laufen. Beides
teilt sich den Boden (`llms.md`, D43) und die Module; keines ersetzt das
andere.

## 2. Motivation

Heute kann ein Agent mit einem Werkbaum-Plan dreierlei tun — und alles
davon nur halb:

1. **Eine `.werkbaum`-Datei lesen und schreiben.** Das geht mit Claude Code
   bereits, `llms.md` erklärt die Notation (D43). Aber der Agent muss die
   **Semantik** selbst nachrechnen: Ist der Plan warnungsfrei? Welcher
   Knoten ist effektiv wie weit (§4)? Was ist die nächste Station auf dem
   günstigsten Pfad (§9)? Für all das gibt es im Frontend geprüfte
   Funktionen — der Agent bekommt sie nicht zu sehen und rät stattdessen.
   Beim Größen-Konflikt (D62) oder der Closure-Rechnung (D42) ist Raten
   nachweislich falsch.
2. **Ein Server-Dokument (`?live=`) anfassen.** Nur per `curl` gegen die
   REST-API — mit Volltext-`PUT`, also ohne das Zeilen-Diff-Protokoll (D76).
   Ein Agent, der so schreibt, überschreibt, was ein Mensch in der
   Zwischenzeit getippt hat; genau der Verlust, gegen den D89 vier Netze
   gespannt hat.
3. **Den Plan im Editor ändern lassen** — `#ai.dialog` ist eine Idee ohne
   Entwurf.

MCP ist inzwischen die Verkehrssprache dafür: Claude Code, Claude Desktop,
Cursor, IntelliJ-Agenten und die Anthropic-API selbst (MCP-Connector)
sprechen es. Ein Server, der Werkbaum darüber anbietet, macht Punkt 1 und 2
auf einen Schlag richtig — und zwar für **alle** diese Hosts, nicht nur für
einen.

## 3. Ziele und Nicht-Ziele

**Ziele**

- Ein Agent kann einen Plan **lesen** (Datei oder Server-Dokument) und den
  Notationsleitfaden dazu bekommen.
- Ein Agent kann den Plan **befragen**, ohne die SPEC nachzuimplementieren:
  Baum mit allem, was das Diagramm weiß; Warnungen; günstigster Pfad samt
  Stationen und Personen-Last.
- Ein Agent kann den Plan **ändern**, ohne fremde Arbeit zu überschreiben,
  und jede Änderung ist im Editor als Agenten-Änderung erkennbar.
- Kein zweiter Parser, keine zweite Semantik (D14).
- Kein Geheimnis läuft durch den Server, das er nicht braucht.

**Nicht-Ziele (Abgrenzung — wird nicht gebaut, siehe §9)**

- **Kein LLM im Server.** Der Server ruft kein Modell auf und kennt keinen
  API-Schlüssel. Das Modell sitzt im Host; `#ai.key` bleibt ein eigener
  Knoten.
- **Keine neue Notation.** Nichts an SPEC oder `llms.md` ändert sich.
- **Kein Backend-Umbau.** Die vorhandene REST-API genügt (§7.3).
- **Kein Taiga über MCP** in der ersten Fassung (§9).
- **Keine Rechteverwaltung** — der Server erbt das Zugriffsmodell des
  Backends (unerratbare UUID, D76) und erfindet keines dazu.
- **Kein Ersatz für `#ai.dialog`** und kein Chat im Editor.

## 4. Begriffe (soweit hier nötig)

MCP trennt **Hosts** (die Anwendung mit dem Modell: Claude Code, Desktop,
IDE) von **Servern** (Prozesse, die Fähigkeiten anbieten). Ein Server
bietet drei Dinge an:

- **Resources** — lesbare Inhalte mit URI, vom Host in den Kontext geholt
  („zeig mir den Plan“).
- **Tools** — aufrufbare Funktionen mit JSON-Schema, die das Modell selbst
  wählt („prüfe den Plan“, „setze den Status“).
- **Prompts** — vorgefertigte Anweisungen, die der Nutzer auswählt
  („zerlege diesen Knoten“).

Transporte: **stdio** (der Host startet den Server als Kindprozess — der
Normalfall für lokale Werkzeuge) und **Streamable HTTP** (ein
Netzwerk-Endpunkt; hat 2025 das ältere SSE-Verfahren abgelöst). Die
Protokollrevision wird vom SDK getragen; dieses RFC legt keine fest.

## 5. Vorschlag

### 5.1 Architektur

```
 Host (Claude Code, IDE, Desktop)          Werkbaum
 ┌──────────────┐   stdio / JSON-RPC   ┌──────────────────────────────┐
 │  Modell      │◄────────────────────►│ mcp/server.js                │
 │  + Werkzeuge │                      │  ├─ resources  (Text, Guide) │
 └──────────────┘                      │  ├─ tools      (inspect,     │
                                       │  │              write)       │
                                       │  └─ stores                   │
                                       │       ├─ file   (fs)         │
                                       │       └─ live   (REST, D76)  │
                                       │  importiert unverändert:     │
                                       │  frontend/src/parser.js      │
                                       │  frontend/src/model.js       │
                                       │  frontend/src/live.js        │
                                       └──────────────┬───────────────┘
                                                      │ HTTP
                                       ┌──────────────▼───────────────┐
                                       │ Backend  /api/v1/documents/… │
                                       └──────────────────────────────┘
```

Ein Paket `mcp/` neben `frontend/` und `backend/`, eigenes `package.json`,
ES-Module. Es hat **keine** Kopie von Werkbaum-Logik; alles Entscheidbare
kommt aus `frontend/src`. Was das Paket selbst beisteuert, ist Verdrahtung:
MCP-Rahmen, zwei Ablagen, JSON-Serialisierung des Baums und die
Leitplanken.

### 5.2 Ablagen

Ein Plan wird über eine **Quelle** adressiert — dieselben drei, die ein
Mensch hat, minus `?sourceUrl=` (nur lesend, kommt bei Bedarf dazu):

| Quelle | Adressform | Lesen | Schreiben |
|---|---|---|---|
| Datei | absoluter Pfad oder relativ zum Arbeitsverzeichnis | `fs` | atomar (Temp-Datei + `rename`); **nur, wenn die Datei seit dem Lesen unverändert ist** (Prüfsumme) |
| Server-Dokument | `https://…/api/v1/documents/<uuid>` oder der geteilte `?live=`-Link (ausgepackt wie bei `pull-doc`, D88) | `GET` | `PATCH /content` mit Zeilen-Diff, `baseVersion`, `checksum` (D76) |
| Leitfaden | `werkbaum://guide` | `frontend/public/llms.md` | — |

Der Dateizugriff ist auf **erlaubte Wurzeln** begrenzt (Startparameter
`--root`, Voreinstellung: das Arbeitsverzeichnis des Hosts). Ein Agent, der
einen Pfad außerhalb nennt, bekommt einen Fehler — nicht, weil ihm misstraut
wird, sondern weil der Plan-Text Fremddaten ist (§8).

### 5.3 Resources

| URI | Inhalt | MIME |
|---|---|---|
| `werkbaum://guide` | `llms.md` — der Notationsleitfaden (D43) | `text/markdown` |
| `werkbaum://file/<pfad>` | Notationstext der Datei | `text/plain` |
| `werkbaum://doc/<url-encoded dokument-url>` | Notationstext des Server-Dokuments, mit `version` als Metadatum | `text/plain` |

Resources sind bewusst **nur der Text**: Er ist das führende Format (D14),
und ein Agent, der ihn im Kontext hat, kann mit `llms.md` schon alles
lesen. Die Semantik kommt aus den Tools.

### 5.4 Tools

Wenige Verben, sprechend benannt, alle mit `source` als erstem Parameter
(Pfad oder URL):

| Tool | Eingabe | Ausgabe | Nutzt |
|---|---|---|---|
| `werkbaum_read` | `source` | Text, `version`/Prüfsumme, Zeilenzahl | Ablage |
| `werkbaum_inspect` | `source`, optional `id` (Teilbaum), `include: [tree, warnings, path]` | JSON: Baum je Knoten mit `id`, `label`, `line`, `gate`, `optional`, `status`, `effectiveStatus`, `size`, `assumedSize`, `tags`, `deps`, `desc`, `taigaSlug`, `ticketRef`; Warnungen als `{type, line, …}` **plus** englischer Klartext; Pfad als Liste der nötigen Knoten, Stationen in Dokumentreihenfolge, `assigneeLoads`, `overloadedAssignee`, `exact` (D42) | `parse`, `effectiveStatus`, `computeCheapPlan`, `assigneeLoads`, `taigaSlugs`, `warningText` |
| `werkbaum_set_status` | `source`, `id`, `status` (Code der §4-Tabelle), `base` | neuer Stand (Version, Prüfsumme), Warnungs-Delta | `setStatusBox` (parser.js), Ablage |
| `werkbaum_apply_ops` | `source`, `base`, `ops[]` (`insert`/`replace`/`delete` mit `index`, `count`, `lines` — **dasselbe Schema wie `LineOperation` der API**) | wie oben | `applyOps` (live.js), Ablage |
| `werkbaum_write` | `source`, `base`, `text` (Volltext) | wie oben | `computeOps` (live.js) → Diff → Ablage |
| `werkbaum_add_node` | `source`, `base`, `parent` (ID), `line` (die Knotenzeile ohne Einrückung, z. B. `- [ ] #auth.token: Token prüfen (S)`), optional `after` (ID eines Geschwisters) | wie oben | `addNodeLine` (edit.js) |
| `werkbaum_move_node` | `source`, `base`, `id`, `parent` (neue Eltern-ID), optional `after` | wie oben; der Teilbaum samt Beschreibungs- und Fortsetzungszeilen wandert mit, Einrückung wird angepasst | `moveSubtree` (edit.js) |
| `werkbaum_set_size` | `source`, `base`, `id`, `size` (`XS`…`XXL` oder `null` zum Entfernen) | wie oben | `setSizeToken` (edit.js) |
| `werkbaum_remove_node` | `source`, `base`, `id`, `discard: true\|false` | wie oben — `discard` setzt `[-]` (die Notation für „bewusst nicht“, §4), `false` löscht den Teilbaum samt seinen Blöcken | `setStatusBox` bzw. `removeSubtree` (edit.js) |

Die **Knoten-Verben** (Nutzer-Entscheidung, §11) sind Bequemlichkeit für
das Modell: `apply_ops` könnte jedes davon ausdrücken, aber ein Agent, der
Zeilenindizes ausrechnen muss, verrechnet sich — ein Verb mit ID ist die
robustere Schnittstelle. Damit dabei **keine zweite Stelle mit
Zeilenformat-Wissen** entsteht, liegen die Text→Text-Regeln als
`frontend/src/edit.js` neben `setStatusBox`/`setFoldMark` (parser.js) und
`appendToken` (taiga.js) — headless, getestet, und später auch für
`#ai.dialog` da (§7.1). Das MCP-Paket verdrahtet sie nur.

**`base` ist Pflicht bei jedem Schreiben** — `{version, checksum}` vom
letzten Lesen. Ohne `base` wird nicht geschrieben. Das ist die
Idempotenz- und Konfliktregel aus D76, unverändert übernommen.

**Warnungen tragen Typ und Text.** Der Typ (`sizeConflict`, `unknownDep`,
…) ist für den Agenten das Verlässliche; der englische Text kommt dazu,
weil das Modell ihn ohne Nachschlagen versteht. Die Texte sind die
**Editor-Texte** (`warningText`, D33-Nachtrag) in Englisch — nicht
nacherzählt (§7.1).

### 5.5 Schreib-Leitplanken

Auf jedem der drei Schreib-Tools, vor dem Schreiben:

1. **Keine beschädigte Notation.** Der Ergebnis-Text wird geparst; trägt
   er **Struktur-Warnungen**, die der Ausgangstext nicht hatte —
   `mixedGate`, `unknownStatus`, `descStray`, `duplicateId` —, wird
   **nicht geschrieben**, und die Antwort nennt sie. Das sind die
   Warnungen, bei denen der Text als Notation kaputt ist: eine Zeile, die
   der Parser anders liest, als sie gemeint war. Schalter
   `allowWarnings: true` je Aufruf erlaubt es ausdrücklich. **Inhaltliche
   Widersprüche** — `sizeConflict`, `assigneeOverload`, `xorConflict`,
   `unknownDep`, `unknownDesc` — werden **geschrieben und gemeldet**: Ein
   Agent arbeitet in Zwischenschritten (das Ziel einer Abhängigkeit
   entsteht oft erst im nächsten Zug), und im Diagramm sieht ein Mensch sie
   als bernsteinfarbene Marke, genau wie bei einer eigenen Änderung
   (Nutzer-Entscheidung, §11; die strengere Fassung „jede neue Warnung
   blockiert“ war der Vorschlag). Verschwindende Warnungen sind immer
   erlaubt, und jede Antwort trägt das vollständige Warnungs-Delta.
2. **Kein `[^]` von einem Agenten.** `in Produktion` ist die Aussage eines
   Deploys (D30), nicht die eines Modells. `set_status` lehnt `prod` ab,
   `apply_ops`/`write` lehnen ein Ergebnis ab, in dem ein Knoten neu `[^]`
   trägt. Schalter `allowProd: true` je Aufruf — mit derselben Begründung:
   ausdrücklich, nie still.
3. **Konflikt ist ein Fehler, keine Entscheidung.** Bei `409` (Server) oder
   geänderter Datei kommt der **aktuelle** Text mit zurück; der Agent — und
   im Zweifel der Mensch hinter ihm — entscheidet. Der Server rebased nichts
   selbst über das hinaus, was das Backend ohnehin tut (D76: nicht
   überlappende Ops verschiebt der Server; das bleibt).

Alle drei sind reine Verdrahtung um vorhandene Regeln; der Parser selbst
bleibt fehlertolerant, wie SPEC §4 es verlangt.

### 5.6 Identität und Sichtbarkeit

Jeder Schreibvorgang an ein Server-Dokument geht mit `clientId`
`mcp-<zufall>` (je Serverprozess, sessionStorage-Äquivalent: je Prozess
eine laufende `seq`, D76-Nachtrag 7) und einem `displayName`, der den
**Host nennt**: den Namen, den der Host im MCP-Handshake mitschickt
(`clientInfo.name`, etwa „Claude Code“), mit Rückfall **„Agent“**, wenn er
keinen nennt; `--name` übersteuert beides (Nutzer-Entscheidung, §11). In
jedem offenen Editor steht damit in der Historie „geändert von: Claude
Code“ (D86) — der Mensch sieht, welches Werkzeug es war, und kann es über
die Meilensteine zurückholen. Der Name bleibt eine Behauptung, kein
Nachweis — dieselbe Einordnung wie beim Anzeigenamen eines Menschen (D86).

### 5.7 Geteiltes Dokument **und** Git — beides zugleich

Die Frage, an der die Ablage-Wahl hängt: Ein Agent soll auf dem
**geteilten** Dokument arbeiten (dort sitzen die Menschen, dort greift das
Konfliktprotokoll), und derselbe Plan soll **unter Git-Kontrolle** stehen
(Diff, Blame, Review, ein Netz außerhalb des Servers — D89). Das sind zwei
Wahrheiten für einen Text, und die Antwort ist nicht „eine davon“, sondern
eine **Richtung**: Der Server ist die Quelle, Git ist das Archiv.

**Der Weg dafür existiert schon:** `tools/pull-doc --git-commit` (D88,
`#col.git.pull`) holt ein Server-Dokument in ein Worktree und committet es
datiert, nur bei Änderung, mit Titel und Server-Version in der Nachricht.
Aus dem Cron heraus archiviert sich ein Plan damit selbst. Der MCP-Server
setzt genau darauf auf:

- **Spiegel-Datei (`--mirror <datei>`):** Ist für ein Dokument eine
  Spiegel-Datei konfiguriert, ruft der Server nach **jedem erfolgreichen
  Agenten-Schreibvorgang** `pull-doc --git-commit` dafür auf. Die
  Commit-Nachricht nennt zusätzlich den Urheber („via Agent: Claude Code“)
  — die Git-Historie kann Agenten-Änderungen dann so auseinanderhalten, wie
  es die Server-Historie über `displayName` tut (D86). Menschliche
  Änderungen dazwischen fängt weiterhin der Cron; wer keinen hat, bekommt
  sie spätestens mit dem nächsten Agenten-Zug ins Git, denn `pull-doc`
  committet den **ganzen** Serverstand, nicht nur die Agenten-Zeilen.
- **Die Spiegel-Datei ist für den Agenten lesbar, aber nicht der
  Schreibweg.** Ein Agent in Claude Code sieht die Datei im Repo und könnte
  sie direkt editieren — beim nächsten `pull-doc` wäre das überschrieben.
  Deshalb: `werkbaum_write`/`apply_ops`/`set_status` auf eine Datei, die
  als Spiegel eines Dokuments konfiguriert ist, werden **umgeleitet** an
  das Dokument (der Server kennt die Zuordnung) und die Antwort sagt es.
  Ein Agent, der die Datei mit seinen eigenen Werkzeugen (Editor, `sed`)
  anfasst, ist außerhalb des MCP-Servers — dagegen hilft nur die
  D88-Regel, die schon da ist: Eine schmutzige Spiegel-Datei wird beim
  nächsten Commit **trotzdem** vom Serverstand überschrieben, und der
  Commit macht die Abweichung im Diff sichtbar statt sie zu verstecken.
- **Nicht gebaut wird die Umkehrung** — Git als Quelle und der Server als
  Spiegel (`#col.git.pr` für Pläne, die sich wöchentlich ändern, oder
  `#col.git.auto`, bei dem das Backend selbst committet). Beides sind
  eigene Knoten mit eigenen Fragen (Konfliktmarker mitten in der Notation,
  ROADMAP „Gemeinsam an einem Diagramm arbeiten“); der MCP-Server soll sie
  weder vorwegnehmen noch ausschließen. Kommt `#col.git.auto`, wird
  `--mirror` schlicht überflüssig — die Schnittstelle des Servers ändert
  sich dadurch nicht.

Im Plan steht das als `#ai.mcp.mirror` mit Abhängigkeit auf
`#col.git.pull`.

### 5.8 Prompts (optional, Phase 6)

Zwei vorgefertigte Anweisungen, die ein Host dem Nutzer anbietet:

- `werkbaum/review` — „Prüfe diesen Plan: Warnungen, Größen, fehlende
  Zerlegung ab M, unklare Zuständigkeiten“ (nutzt `inspect`, schreibt
  nichts).
- `werkbaum/decompose` — „Zerlege Knoten `#id` in Teilpakete mit Größen“
  (endet in `apply_ops`, mit den Leitplanken).

Beides sind Texte, keine Logik; sie leben im Paket und nicht in `llms.md`
(das bleibt Notation, D43).

### 5.9 Konfiguration und Start

```
node mcp/server.js [--root <dir>]… [--server <backend-basis>] [--name <anzeige>]
                   [--mirror <dokument-url>=<datei>]…
```

- `--root`: erlaubte Dateiwurzeln (mehrfach). Ohne Angabe: `cwd`.
- `--server`: Voreinstellung für relative Dokument-Angaben (`<uuid>` statt
  voller URL). Ohne Angabe muss die URL vollständig sein.
- `--name`: `displayName` für Server-Schreibvorgänge.
- `--mirror`: Spiegel-Datei je Dokument (§5.7); die Datei muss in einem
  git-Worktree unter einer erlaubten Wurzel liegen — `pull-doc` prüft das
  ohnehin.

Für Claude Code:

```bash
claude mcp add werkbaum -- node /pfad/zu/werkbaum/mcp/server.js --root .
```

Im Repository selbst liegt eine `.mcp.json`, damit Claude Code hier den
Server von selbst hat — der Plan `docs/examples/werkbaum.werkbaum` ist damit
das erste Dokument, an dem der Server benutzt wird (Dogfooding, dieselbe
Logik wie D27).

## 6. Alternativen

### A — Server im Kotlin-Backend (Spring AI MCP)

*Pro:* ein Deployment, Streamable HTTP frei Haus, sitzt direkt an den
Dokumenten.
*Contra:* Jedes nützliche Tool braucht den Parser. Entweder entsteht ein
Kotlin-Parser — **genau die zweite Grammatik, die D14 verbietet** — oder
der Server bietet nur Dokument-CRUD an, und das kann ein Agent per REST
schon heute. Dazu die erste Spring-AI-Abhängigkeit im Backend.
**Verworfen** (`#ai.mcp.kotlin` als `[-]` im Plan).

### B — Node-Paket, das die Frontend-Module importiert (Vorschlag)

*Pro:* ein Parser, eine Semantik; die Module sind headless und getestet
(D54-Nachtrag 3 ist die Hausregel dafür); stdio ist der Transport, den alle
lokalen Hosts können; kein Backend-Umbau.
*Contra:* ein zweites Node-Paket im Repo; die Dependency-Frage (§7.4);
Remote-Zugriff erst mit Phase 6.
**Gewählt.**

### C — Nichts bauen: Agenten lesen `llms.md` und editieren Dateien

*Pro:* funktioniert heute mit Claude Code.
*Contra:* keine Semantik (der Agent rät Warnungen, Pfad, effektiven
Status), keine Server-Dokumente außer per `curl`, Schreiben an geteilte
Dokumente ohne Konfliktschutz. Das ist der Ausgangszustand aus §2.
**Bleibt als Rückfall bestehen** — der Server ersetzt `llms.md` nicht.

### D — OpenAPI der REST-API den Agenten geben

*Pro:* null neuer Code, die Spec existiert.
*Contra:* dieselbe Semantik-Lücke wie C, und die API spricht Volltext-`PUT`
oder Zeilen-Ops mit Prüfsumme — ein Modell, das die Prüfsumme selbst
rechnen soll, ist eine Fehlerquelle mit Ansage.
**Verworfen.**

### E — `#ai.dialog` zuerst (Modell im Editor)

*Pro:* der Nutzer bleibt im Werkzeug.
*Contra:* andere Frage (welches Modell, wessen Schlüssel, welche UI); bringt
den Plan nicht zu den Agenten, die Menschen heute schon benutzen.
**Nicht konkurrierend** — B liefert die Module, die E später auch braucht
(JSON-Baum, Leitplanken).

## 7. Impact auf den bestehenden Code

Grundsatz: **Das Frontend wird gelesen, nicht umgebaut.** Wo doch etwas zu
ändern ist, ist es eine Verschiebung ohne Verhaltensänderung.

### 7.1 `frontend/src/` — Änderungen

| Datei | Was | Warum |
|---|---|---|
| `app.js` → neu `i18n.js` | Das `I18N`-Objekt (ab `app.js:3287`) in ein headless-Modul verschieben; `app.js` importiert es. | Der Server braucht `warningText(w, t)` mit **englischem** `t`. Die Texte leben heute im UI-Modul, das DOM voraussetzt. Eine Kopie im MCP-Paket wäre die Drift, vor der D33-Nachtrag warnt. Reine Verschiebung; der Vite-Bundle bleibt gleich. |
| `warnings.js` | unverändert | importiert nur `esc` aus `render.js`; `render.js` ist headless bis zum Aufruf. |
| `parser.js` | unverändert | `parse`, `setStatusBox`, `STATUS_BY_CODE`, `SIZE_RANK` sind exportiert. |
| `model.js` | unverändert | `effectiveStatus`, `computeCheapPlan`, `assigneeLoads`, `overloadedAssignee`, `taigaSlugs`, `assumedSize` sind exportiert. |
| `live.js` | `checksum()` läuft in Node unverändert (`globalThis.crypto.subtle` gibt es ab Node 20). Prüfen, sonst Rückfall auf `node:crypto` **im MCP-Paket**, nicht in `live.js`. | Die Prüfsumme ist Pflichtfeld des Patches (D76). |
| `taiga.js` | `ticketRefOf`, `collectTicketRefs` nur lesend für `inspect` (`ticketRef`, `taigaSlug` je Knoten); `appendToken` für `set_size` | kein Taiga-Zugriff, nur die Auskunft, was im Text steht. |
| **neu** `edit.js` | Text→Text-Regeln der Knoten-Verben: `addNodeLine(text, parentId, line, afterId)`, `moveSubtree(text, id, parentId, afterId)`, `setSizeToken(text, id, size)`, `removeSubtree(text, id)`. Zeilenweise, zeichengenau, mit Tests wie `setFoldMark`/`expandShortIds`. Kennt Einrückung (§2), Fortsetzungs- und Beschreibungszeilen (§1: die wandern mit ihrem Knoten) und lässt Kommentare stehen. | Die eine Stelle für „Zeile eines Knotens umbauen“; `app.js` benutzt sie zunächst nicht, `#ai.dialog` später schon. Bewusst **nicht** in `parser.js`: Der wird sonst zum Sammelbecken. |

Was **nicht** ins Frontend zurückfließt: die JSON-Serialisierung des Baums
(`mcp/inspect.js`) — sie ist eine Sicht für Agenten, keine Editor-Logik
(Nutzer-Entscheidung, §11). Sollte `#ai.dialog` sie später brauchen,
wandert sie dann.

### 7.2 Neues Paket `mcp/`

```
mcp/
  package.json          name: werkbaum-mcp, type: module, bin: server.js
  server.js             MCP-Rahmen: Resources, Tools, Prompts registrieren; stdio
  stores/file.js        lesen, Prüfsumme, atomar schreiben, Wurzel-Prüfung
  stores/live.js        GET / PATCH gegen /api/v1/documents (D76), clientId/seq
  inspect.js            Baum → JSON, Warnungen → {type, line, text}, Pfad → Stationen
  guard.js              Leitplanken (§5.5): Struktur-Warnungen, [^]-Sperre
  verbs.js              Knoten-Verben → Aufrufe von frontend/src/edit.js, dann Ablage
  tests/*.test.js       Vitest gegen einen In-Memory-Transport des SDK; Fixtures = SPEC §10 und der mitgelieferte Plan
```

Die Regeln in `inspect.js` und `guard.js` sind Text→JSON bzw. Text→Text und
damit headless testbar — die Hausregel aus D54-Nachtrag 3 gilt auch hier;
`server.js` verdrahtet nur.

### 7.3 Backend

**Keine Änderung nötig.** Genutzt werden `GET /documents/{id}`,
`PATCH /documents/{id}/content` und `GET /info` — alle vorhanden. Zwei
Dinge sind zu **prüfen**, nicht zu bauen:

- Der Server sendet `displayName` — steht in der Historie (D86), gemessen
  gegen ein lokales Backend.
- `clientId`-Präfix `mcp-`: Das Backend behandelt es wie jeden Client; ein
  späterer Filter („nur menschliche Änderungen zeigen“) wäre ein eigener
  Wunsch.

Perspektivisch berührt: `#col.live.owner`. Sobald Verwaltungs-Aktionen an
ein Owner-Passwort gebunden sind, braucht der MCP-Server einen Weg, es zu
übergeben — **nie** als Tool-Parameter (Prozessliste, Transkript), sondern
als Umgebungsvariable des Serverprozesses. Das ist heute keine Arbeit, nur
eine Vormerkung.

### 7.4 Abhängigkeit: `@modelcontextprotocol/sdk`

CLAUDE.md: keine neuen Laufzeit-Abhängigkeiten ohne Rückfrage. Das ist eine.

- **Für:** Das offizielle SDK trägt Protokollrevision, Capability-Handshake,
  Schema-Validierung und beide Transporte; eine Handschrift des JSON-RPC
  wäre ~200 Zeilen, die bei jeder Revision nachgezogen werden müssten.
- **Dagegen:** Es ist die erste Laufzeit-Abhängigkeit im Repo überhaupt.
- **Einordnung:** Sie liegt im **MCP-Paket**, nicht im Frontend — der
  gebündelte Editor bleibt abhängigkeitsfrei (D11/D19/D20). Dieselbe
  Grenze, die D76 für Spring Security gezogen hat: die Abhängigkeit dort,
  wo sie den Kern nicht berührt.

**Entschieden (Nutzer, §11): SDK** — als bewusste Ausnahme in D93
festgehalten. Version wird beim Bauen gepinnt (`package-lock.json`
eingecheckt, wie im Frontend).

### 7.5 Übriges

| Ort | Änderung |
|---|---|
| `.mcp.json` (Repo-Wurzel) | Server-Eintrag für Claude Code (Dogfooding) |
| `README.md` / `README.de.md` | Abschnitt „Für KI-Agenten: der MCP-Server“ — Installation, die drei Quellen, die Leitplanken |
| `docs/CHANGELOG.md` | je Phase eine Zeile |
| `.github/workflows/*` | `npm --prefix mcp test` neben dem Frontend-Test; kein Deploy (lokales Werkzeug) |
| `tools/pull-doc` | **unverändert im Verhalten**; ein neuer Schalter `--author <text>` für den Urheber in der Commit-Nachricht (§5.7) — der Schalter kommt ins Skript, nicht in den Aufrufer (D77-Nachtrag) |
| `scripts/deploy-*.sh`, `tools/remote` | **unverändert** — nichts davon läuft auf dem Server |
| `frontend/public/llms.md` | **unverändert** (Notation, D43); ein Verweis auf den Server gehört in `llms.txt` (Wegweiser, D43-Nachtrag 2) |

## 8. Sicherheit

- **Plan-Text ist Fremddaten.** Beschreibungen (`---`-Teil) können
  Anweisungen enthalten („ignoriere die Leitplanken“). Der Server führt
  nichts aus, was im Text steht; Resources sind als Inhalt, nie als
  Anweisung deklariert. Der Host trägt die Prompt-Injection-Frage — der
  Server macht sie nur nicht schlimmer: keine Shell, kein Netz außer den
  zwei konfigurierten Zielen (Dateiwurzeln, Backend).
- **Kein Geheimnis im Transkript.** Master-Passwort (D76-Nachtrag 6) geht
  **nie** über MCP — `GET /documents` (die Liste) wird deshalb nicht
  angeboten; der Agent bekommt Dokument-URLs vom Menschen. Ein späteres
  Owner-Passwort kommt als Umgebungsvariable (§7.3). Taiga-Token ebenso
  (§9).
- **Dateizugriff nur unter erlaubten Wurzeln**; Pfade werden aufgelöst
  (`realpath`) und gegen die Wurzeln geprüft — Symlinks nach draußen
  zählen als draußen.
- **Schreiben nur mit `base`**; kein Volltext-`PUT`. Was der Editor an
  Netzen hat (Konflikt-Band, Rettungs-Sicherung, D89), hat der Agent in
  Form des zurückgelieferten aktuellen Textes — er verliert nichts, er
  muss neu ansetzen.

## 9. Abgrenzung — was ausdrücklich nicht gebaut wird

| Nicht gebaut | Warum | Wo es hingehört |
|---|---|---|
| Modellaufrufe, API-Schlüssel, Provider-Wahl | Der Host hat das Modell; ein Server mit eigenem Schlüssel wäre `#ai.key` unter falschem Namen | `#ai.key`, `#ai.dialog` |
| Taiga-Tools (Ticket anlegen, Status schreiben) | Braucht das Taiga-Token — das lebt im Browser (D91) und dürfte nicht durch ein Transkript; außerdem eine eigene Entscheidung, ob ein Modell Tickets anlegen darf | eigener Nachtrag, wenn gewünscht: über den vorhandenen Proxy, Token aus der Umgebung |
| Dokumentenliste (`GET /documents`) | Master-Passwort | — (der Mensch nennt die URL) |
| Anlegen/Löschen/Umbenennen von Server-Dokumenten | Verwaltung; wartet auf `#col.live.owner` | nach dem Owner-Passwort |
| Falten (`fold`/`unfold`) als Verb | Faltmarken sind Darstellung für Menschen (§9); ein Agent liest den ganzen Text ohnehin | — |
| Änderungsfeed / Long Polling | Ein Agent arbeitet in Zügen, nicht live; `read` vor jedem Schreiben genügt | — |
| Git als **Quelle** (Server folgt dem Repo) | Umkehrung von §5.7; Konfliktmarker mitten in der Notation, eigene Fragen | `#col.git.pr`, `#col.git.auto` |
| `?sourceUrl=`-Quellen | nur lesend; der Agent kann die URL selbst holen | Nachtrag bei Bedarf |
| Streamable HTTP | Phase 6, hängt an der Authentifizierungsfrage | `#ai.mcp.http` |
| Ein Kotlin-Server | D14 | `#ai.mcp.kotlin` (`[-]`) |

## 10. Umsetzungsreihenfolge

Jede Phase ist für sich abgeschlossen und bekommt ihre CHANGELOG-Zeile;
Plan-Knoten gehen beim Mergen auf `[x]`.

1. **Lesen** (`#ai.mcp.node`, `#ai.mcp.read`): Paket, stdio, Resources
   für Guide und Datei, `werkbaum_read`. Nachweis: Claude Code liest den
   mitgelieferten Plan über die `.mcp.json`. Vorher: SDK-Entscheidung
   (§7.4).
2. **Befragen** (`#ai.mcp.inspect`): `i18n.js`-Verschiebung im Frontend,
   `werkbaum_inspect` mit Baum, Warnungen, Pfad. Nachweis: Für den
   mitgelieferten Plan liefert das Tool dieselbe Stationszahl und dieselben
   Warnungen wie der Editor (Vergleich gegen die Zahlen, die die
   DECISIONS-Einträge ohnehin nennen).
3. **Schreiben** (`#ai.mcp.write`, `#ai.mcp.guard`): Server-Ablage mit
   `PATCH /content`, Datei-Ablage atomar, die drei Basis-Schreib-Tools, die
   Leitplanken. Nachweis gegen ein lokales Backend: Agenten-Änderung
   erscheint im offenen Editor mit „Claude Code“ in der Historie; ein
   Konflikt (Mensch tippt dieselbe Zeile) kommt als Fehler mit aktuellem
   Text zurück, nichts wird überschrieben; ein `[^]` wird abgelehnt; ein
   `mixedGate` wird abgelehnt, ein `sizeConflict` geschrieben und gemeldet.
4. **Knoten-Verben** (`#ai.mcp.verbs`): `frontend/src/edit.js` mit Tests
   (Gegenprobe per Mutation wie bei `setFoldMark`), dann die vier Verben
   im Paket. Nachweis: Ein `move_node` nimmt Beschreibungsblock und
   Fortsetzungszeilen mit und lässt den Rest des Texts zeichengenau stehen
   (Vergleich der übrigen Zeilen vorher/nachher).
5. **Spiegel ins Git** (`#ai.mcp.mirror`): `--mirror`, Aufruf von
   `pull-doc --git-commit` nach jedem Agenten-Schreibvorgang, Umleitung
   von Schreibzugriffen auf die Spiegel-Datei. Nachweis in einem
   Wegwerf-Worktree: ein Agenten-Zug ergibt genau einen Commit mit
   Serverstand und Urheber; ein unveränderter Zug keinen; eine von Hand
   verschmutzte Spiegel-Datei wird vom nächsten Commit überschrieben und
   die Abweichung steht im Diff.
6. **Prompts und HTTP** (`#ai.mcp.http`, optional): die zwei Prompts;
   Streamable HTTP erst nach `#col.live.owner`.

## 11. Entscheidungen (Multiple-Choice-Runde, 2026-09-02)

| Frage | Entschieden | Anmerkung |
|---|---|---|
| SDK-Abhängigkeit `@modelcontextprotocol/sdk` (§7.4) | **Ja, SDK** | erste Laufzeit-Abhängigkeit, isoliert im MCP-Paket; D93 |
| Strenge der Warnungs-Leitplanke (§5.5) | **Nur Struktur-Warnungen blockieren** | `mixedGate`, `unknownStatus`, `descStray`, `duplicateId`; alles Inhaltliche wird geschrieben und gemeldet. Vorgeschlagen war die strenge Fassung — der Nutzer hat die Zwischenschritte eines Agenten höher gewichtet |
| `displayName` (§5.6) | **Host-Name aus dem Handshake** | Rückfall „Agent“, `--name` übersteuert |
| Geteiltes Dokument und Git (§5.7) | **Server committet je Agenten-Zug** | über `pull-doc --git-commit`; Cron für menschliche Änderungen dazwischen |
| Ort der Baum-Serialisierung (§7.1) | **Im MCP-Paket** | wandert, wenn `#ai.dialog` sie braucht |
| Schreib-Tools (§5.4) | **Zusätzlich Knoten-Verben** | `add_node`, `move_node`, `set_size`, `remove_node`; Regeln in `frontend/src/edit.js`, nicht im Paket |
| Verteilung | **Nur aus dem Repo** | `.mcp.json`; npm erst auf Nachfrage von außen |

**Weiterhin offen** (stellt sich erst beim Bauen oder danach):

1. **Streamable HTTP** — wartet auf `#col.live.owner`; bis dahin stdio.
2. **`--author`-Schalter in `pull-doc`** — Form der Urheber-Angabe in der
   Commit-Nachricht (Trailer `Co-Authored-By:` oder Freitext im Betreff);
   entscheidet sich beim Bauen von Phase 5.
3. **Prompts** (§5.8) — ob zwei genügen und wie sie heißen; Phase 6.
