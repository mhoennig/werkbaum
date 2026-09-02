# RFC 001 — MCP-Server: Werkbaum für KI-Agenten außerhalb des Editors

| | |
|---|---|
| Status | **Abgestimmt** (drei Runden am 2026-09-02, Entscheidungen in §11 und D93) — nichts gebaut |
| Plan-Knoten | `#ai.mcp` in `docs/examples/werkbaum.werkbaum` |
| Entscheidung | D93 in `docs/DECISIONS.md` |
| Berührt | Backend (`de.werkbaum.integration.mcp`, Security, Build), `frontend/src/*` (headless-Module: eine Verschiebung, drei neue Dateien), `tools/pull-doc`, README, `.mcp.json` |
| Berührt nicht | Notation (SPEC), `llms.md`, `frontend/src/app.js` im Verhalten, Deploy-Skripte außer einer Umgebungszeile |
| Neue Technologie | **keine** — die JVM bleibt die einzige Laufzeit (§6, Runde 3) |

## 1. Zusammenfassung

Werkbaum bekommt einen **MCP-Server** (Model Context Protocol) **im
Backend**: Unter `/api/v1/mcp` bietet die Spring-Boot-Anwendung KI-Agenten
außerhalb des Editors — Claude Code, OpenCode, Codex, IDE-Agenten,
gehostete Agenten — einen Werkbaum-Plan als **Ressource** (Text) und als
**Werkzeuge** (Baum, Warnungen, günstigster Pfad, Knoten-Verben,
Schreiben) an, über Streamable HTTP mit einem Bearer-Token.

Das Backend **parst nicht selbst**: Es führt die headless-Module des
Frontends (`parser.js`, `model.js`, `live.js` und drei neue) **unverändert
in der JVM aus** — per GraalJS, gebündelt beim Bauen. Damit bleibt D14
gewahrt (genau ein Parser), und ein Agent bekommt wörtlich dieselben
Warnungen, effektiven Status und Stationen, die das Diagramm zeigt.

Zwei Arten von Plänen, ein Satz Werkzeuge: **Server-Dokumente** bearbeiten
die Tools direkt — als Zeilen-Diff gegen Basisversion und Prüfsumme (D76),
Konflikte werden abgelehnt, jede Änderung steht in der Historie mit dem
Namen des Agenten. **Lokale `.werkbaum`-Dateien** liest und schreibt der
Agent mit seinen eigenen Werkzeugen und reicht den **Text** an dieselben
Tools — zur Analyse, zur Prüfung und für die Knoten-Verben, die dann Text
zurückgeben. Es gibt **keinen lokalen Prozess** und **keine neue
Laufzeit**: kein Node-Paket, nichts zu installieren beim Entwickler, nur
eine URL und ein Token in der Host-Konfiguration.

Zwei Leitplanken: **keine beschädigte Notation** und **kein `[^]` von einem
Agenten** — auf Server-Dokumenten als Sperre, auf Text als Prüfergebnis.
Der Git-Spiegel eines geteilten Plans ist das vorhandene
`tools/pull-doc --git-commit` (D88), das künftig nennt, wer welche Version
geändert hat — vom Cron oder vom Agenten selbst aufgerufen.

Das ist die **Gegenrichtung** zu `#ai.dialog`: Dort käme ein Modell in den
Editor, hier geht der Plan zu Agenten, die schon irgendwo laufen. Beides
teilt sich den Boden (`llms.md`, D43) und dieselben Module — die drei
neuen Dateien in `frontend/src` sind genau die, die `#ai.dialog` später
auch braucht.

## 2. Motivation

Die Beweggründe, wie sie in Runde 3 benannt wurden (§11): Ein oder mehrere
**Entwickler arbeiten parallel an geteilten Werkbaum-Plänen** und setzen
dabei **agentische KI** ein — vor allem, um einen Plan **im Dialog zu
erstellen** und den **Feature-Fortschritt zu tracken**. Der Agent läuft
meist lokal beim Entwickler (OpenCode, Claude Code, Codex); später soll
ein Agent auch in das Werkbaum-Frontend kommen (`#ai.dialog`). Die Pläne
liegen **beides**: als Datei neben dem Code und als geteiltes
Server-Dokument.

Heute kann ein Agent damit dreierlei tun — und alles davon nur halb:

1. **Eine `.werkbaum`-Datei lesen und schreiben.** Das geht mit Claude
   Code bereits, `llms.md` erklärt die Notation (D43). Aber der Agent muss
   die **Semantik** selbst nachrechnen: Ist der Plan warnungsfrei? Welcher
   Knoten ist effektiv wie weit (§4)? Was ist die nächste Station auf dem
   günstigsten Pfad (§9)? Für all das gibt es im Frontend geprüfte
   Funktionen — der Agent bekommt sie nicht zu sehen und rät. Beim
   Größen-Konflikt (D62) oder der Closure-Rechnung (D42) ist Raten
   nachweislich falsch.
2. **Ein Server-Dokument (`?live=`) anfassen.** Nur per `curl` gegen die
   REST-API — mit Volltext-`PUT`, also ohne das Zeilen-Diff-Protokoll
   (D76). Ein Agent, der so schreibt, überschreibt, was ein Mensch in der
   Zwischenzeit getippt hat; genau der Verlust, gegen den D89 vier Netze
   gespannt hat.
3. **Den Plan im Editor ändern lassen** — `#ai.dialog` ist eine Idee ohne
   Entwurf.

MCP ist inzwischen die Verkehrssprache dafür: Claude Code, OpenCode,
Codex, Claude Desktop, IDE-Agenten und die Anthropic-API selbst
(MCP-Connector) sprechen es. Ein Server, der Werkbaum darüber anbietet,
macht Punkt 1 und 2 richtig — für **alle** diese Hosts, nicht nur für
einen.

## 3. Ziele und Nicht-Ziele

**Ziele**

- Ein Agent kann einen Plan **lesen** (Server-Dokument per Ressource; eine
  Datei liest er selbst) und den Notationsleitfaden dazu bekommen.
- Ein Agent kann einen Plan **befragen**, ohne die SPEC nachzuimplementieren:
  Baum mit allem, was das Diagramm weiß; Warnungen; günstigster Pfad samt
  Stationen und Personen-Last — für einen Text wie für ein Dokument.
- Ein Agent kann einen Plan **ändern**, ohne fremde Arbeit zu
  überschreiben; jede Änderung an einem Dokument ist als Agenten-Änderung
  erkennbar.
- Kein zweiter Parser, keine zweite Semantik (D14). **Keine neue
  Laufzeit** (D93-Nachtrag, CLAUDE.md).
- Kein Geheimnis läuft durch den Server, das er nicht braucht.

**Nicht-Ziele (Abgrenzung — wird nicht gebaut, siehe §9)**

- **Kein LLM im Server.** Der Server ruft kein Modell auf und kennt keinen
  API-Schlüssel. Das Modell sitzt im Host; `#ai.key` bleibt ein eigener
  Knoten.
- **Keine neue Notation.** Nichts an SPEC oder `llms.md` ändert sich.
- **Kein lokaler Prozess.** Kein Node-Paket, kein stdio-Server, kein
  Jar-Aufruf beim Entwickler (§6).
- **Kein Taiga über MCP** in der ersten Fassung (§9).
- **Keine Rechteverwaltung** — ein Token je Installation; das
  Dokument-Zugriffsmodell (unerratbare UUID, D76) bleibt.
- **Kein Ersatz für `#ai.dialog`** und kein Chat im Editor.

## 4. Begriffe (soweit hier nötig)

MCP trennt **Hosts** (die Anwendung mit dem Modell) von **Servern**
(Prozesse oder Endpunkte, die Fähigkeiten anbieten). Ein Server bietet
drei Dinge an:

- **Resources** — lesbare Inhalte mit URI, vom Host in den Kontext geholt
  („zeig mir den Plan“).
- **Tools** — aufrufbare Funktionen mit JSON-Schema, die das Modell selbst
  wählt („prüfe den Plan“, „setze den Status“).
- **Prompts** — vorgefertigte Anweisungen, die der Nutzer auswählt
  („zerlege diesen Knoten“).

Transporte: **stdio** (der Host startet den Server als Kindprozess) und
**Streamable HTTP** (ein Netzwerk-Endpunkt; hat 2025 das ältere
SSE-Verfahren abgelöst). MCP verlangt **keine bestimmte Sprache** — es
gibt offizielle SDKs für TypeScript, Python, Kotlin, Java, C#; Werkbaum
nimmt den Spring-AI-Starter für Java (§11). Die Protokollrevision trägt
das SDK; dieses RFC legt keine fest.

## 5. Vorschlag

### 5.1 Architektur

```
 Host beim Entwickler                          Werkbaum-Backend (Spring Boot, JDK 21)
 (Claude Code, OpenCode, Codex, …)             ┌───────────────────────────────────────┐
 ┌──────────────┐  Streamable HTTP + Bearer    │ /api/v1/mcp                           │
 │  Modell      │◄────────────────────────────►│  de.werkbaum.integration.mcp          │
 │  + Werkzeuge │  (Apache reicht /api/ durch) │   ├─ resources  (Guide, Dokumente)    │
 │  + eigene    │                              │   ├─ tools      (inspect, check,      │
 │    Datei-    │                              │   │              write, verbs)        │
 │    Zugriffe  │                              │   └─ WerkbaumCore: GraalJS-Kontext    │
 └──────────────┘                              │        führt werkbaum-core.mjs aus —  │
        │ liest/schreibt                       │        das Bündel aus frontend/src:   │
        ▼ .werkbaum-Dateien selbst             │        parser · model · live ·        │
   Repo des Entwicklers                        │        inspect · guard · edit         │
   (Git-Spiegel: tools/pull-doc)               │  DocumentService / LiveEditingService │
                                               └───────────────────────────────────────┘
```

Es gibt **einen** Dienst und **ein** Artefakt: das Backend-Jar. Neu darin
sind ein Paket, ein Bearer-Filter und ein gebündeltes JS-Modul als
Ressource. Alles Entscheidbare kommt aus `frontend/src`; Kotlin ist
Transport, Zugang, Ablage und die Brücke in die JVM.

### 5.2 Zwei Formen je Werkzeug: Text und Dokument

Weil es keinen lokalen Prozess gibt, unterscheidet der Server nicht nach
Ablage, sondern nach **Eingabeform**. Jedes Werkzeug nimmt **entweder**
`text` (der Agent hat die Datei selbst gelesen) **oder** `document` (die
UUID eines Dokuments **dieses** Backends):

| Form | Lesen | Ergebnis eines Schreib-Werkzeugs | Leitplanken (§5.5) |
|---|---|---|---|
| `text` | der Agent liefert den Text mit | der **neue Text** samt Prüfergebnis — der Agent schreibt ihn selbst in die Datei | **Prüfergebnis**: `findings` mit `blocking: true/false`; der Text wird trotzdem zurückgegeben |
| `document` | `DocumentService` | der neue Stand (`version`, `checksum`) — geschrieben per `PATCH /content`-Weg (D76) | **Sperre**: blockierende Befunde ⇒ nicht geschrieben |

`document` ist eine **UUID, keine URL**: Der Server fasst nur seine eigenen
Dokumente an. Fremde Backends gibt es für ihn nicht — das nimmt die
SSRF-Frage aus dem Entwurf, bevor sie gestellt ist, und ein Agent, der
mit zwei Werkbaum-Servern arbeitet, konfiguriert zwei MCP-Server.

Der `?live=`-Link, den Menschen weitergeben, enthält die UUID; ein Agent
bekommt sie vom Menschen oder aus der Ressourcen-Liste (§5.3).

### 5.3 Resources

| URI | Inhalt | MIME |
|---|---|---|
| `werkbaum://guide` | `llms.md` — der Notationsleitfaden (D43) | `text/markdown` |
| `werkbaum://doc/<uuid>` | Notationstext des Dokuments; `version` und `checksum` als Metadaten | `text/plain` |

Die Ressourcen-**Liste** nennt die Dokumente dieses Backends mit Titel
und UUID — für den Agenten, der fragt „welche Pläne gibt es hier?“. Das
ist dieselbe Auskunft wie `GET /documents`, die heute hinter dem
Master-Passwort steht (D76-Nachtrag 6), und sie steht hier hinter dem
Bearer-Token (§5.6): Wer das Token hat, ist Entwickler dieser
Installation, nicht ein Fremder mit einer erratenen Adresse. Das
Master-Passwort selbst geht **nie** über MCP.

Resources sind bewusst **nur der Text**: Er ist das führende Format (D14),
und ein Agent, der ihn im Kontext hat, kann mit `llms.md` schon alles
lesen. Die Semantik kommt aus den Tools.

### 5.4 Tools

Wenige Verben, sprechend benannt; jedes nimmt `text` **oder** `document`
(§5.2), die Dokument-Form beim Schreiben zusätzlich `base`
(`{version, checksum}` vom letzten Lesen — Pflicht):

| Tool | Eingabe | Ausgabe | Nutzt |
|---|---|---|---|
| `werkbaum_read` | `document` | Text, `version`, `checksum`, Zeilenzahl | `DocumentService` |
| `werkbaum_inspect` | `text`\|`document`, optional `id` (Teilbaum), `include: [tree, warnings, path]` | JSON: Baum je Knoten mit `id`, `label`, `line`, `gate`, `optional`, `status`, `effectiveStatus`, `size`, `assumedSize`, `tags`, `deps`, `desc`, `taigaSlug`, `ticketRef`; Warnungen als `{type, line, …}` **plus** englischer Klartext; Pfad als nötige Knoten, Stationen in Dokumentreihenfolge, `assigneeLoads`, `overloadedAssignee`, `exact` (D42) | `parse`, `effectiveStatus`, `computeCheapPlan`, `assigneeLoads`, `taigaSlugs`, `warningText`; `inspect.js` |
| `werkbaum_check` | `text`\|`document`, optional `against` (Vorher-Text) | `findings`: Warnungs-Delta und Leitplanken-Befunde mit `blocking` — das, was ein Schreib-Werkzeug prüfen würde, als Auskunft. Für Agenten, die eine Datei gleich selbst schreiben | `guard.js` |
| `werkbaum_set_status` | …, `id`, `status` (Code der §4-Tabelle) | Text-Form: neuer Text + `findings`; Dokument-Form: neuer Stand + `findings` | `setStatusBox` (parser.js) |
| `werkbaum_apply_ops` | …, `ops[]` (`insert`/`replace`/`delete` mit `index`, `count`, `lines` — **dasselbe Schema wie `LineOperation` der API**) | wie oben | `applyOps` (live.js) |
| `werkbaum_write` | …, `newText` (Volltext) | wie oben; Dokument-Form: Diff per `computeOps` | `computeOps` (live.js) |
| `werkbaum_add_node` | …, `parent` (ID), `line` (Knotenzeile ohne Einrückung), optional `after` (Geschwister-ID) | wie oben | `addNodeLine` (edit.js) |
| `werkbaum_move_node` | …, `id`, `parent`, optional `after` | wie oben; Teilbaum samt Beschreibungs- und Fortsetzungszeilen wandert mit, Einrückung wird angepasst | `moveSubtree` (edit.js) |
| `werkbaum_set_size` | …, `id`, `size` (`XS`…`XXL` oder `null`) | wie oben | `setSizeToken` (edit.js) |
| `werkbaum_remove_node` | …, `id`, `discard: true\|false` | wie oben — `discard` setzt `[-]` (§4), `false` löscht den Teilbaum samt Blöcken | `setStatusBox` bzw. `removeSubtree` (edit.js) |

Die **Knoten-Verben** (Runde 1, §11) sind Bequemlichkeit für das Modell:
`apply_ops` könnte jedes davon ausdrücken, aber ein Agent, der
Zeilenindizes ausrechnet, verrechnet sich — ein Verb mit ID ist die
robustere Schnittstelle. Damit dabei **keine zweite Stelle mit
Zeilenformat-Wissen** entsteht, liegen die Text→Text-Regeln als
`frontend/src/edit.js` neben `setStatusBox`/`setFoldMark` (parser.js) und
`appendToken` (taiga.js) — headless, getestet, und für `#ai.dialog` schon
da (§7.1). Kotlin verdrahtet sie nur.

**Warnungen tragen Typ und Text.** Der Typ (`sizeConflict`, `unknownDep`,
…) ist für den Agenten das Verlässliche; der englische Text kommt dazu,
weil das Modell ihn ohne Nachschlagen versteht. Die Texte sind die
**Editor-Texte** (`warningText`, D33-Nachtrag) in Englisch — nicht
nacherzählt (§7.1).

### 5.5 Leitplanken

Auf jedem Schreib-Werkzeug, vor dem Schreiben (Dokument) bzw. als Befund
(Text):

1. **Keine beschädigte Notation.** Der Ergebnis-Text wird geparst; trägt
   er **Struktur-Warnungen**, die der Ausgangstext nicht hatte —
   `mixedGate`, `unknownStatus`, `descStray`, `duplicateId` —, ist das
   **blockierend**: Ein Dokument wird nicht geschrieben, die Antwort nennt
   sie; ein Text kommt mit `blocking: true` zurück. Das sind die Warnungen,
   bei denen der Parser eine Zeile anders liest, als sie gemeint war.
   Schalter `allowWarnings: true` je Aufruf erlaubt es ausdrücklich.
   **Inhaltliche Widersprüche** — `sizeConflict`, `assigneeOverload`,
   `xorConflict`, `unknownDep`, `unknownDesc` — werden **geschrieben und
   gemeldet**: Ein Agent arbeitet in Zwischenschritten (das Ziel einer
   Abhängigkeit entsteht oft erst im nächsten Zug), und im Diagramm sieht
   ein Mensch sie als bernsteinfarbene Marke — wie bei einer eigenen
   Änderung (Runde 1; die strengere Fassung war der Vorschlag).
   Verschwindende Warnungen sind immer erlaubt, jede Antwort trägt das
   Warnungs-Delta.
2. **Kein `[^]` von einem Agenten.** `in Produktion` ist die Aussage eines
   Deploys (D30), nicht die eines Modells. Blockierend wie oben; Schalter
   `allowProd: true` je Aufruf — ausdrücklich, nie still.
3. **Konflikt ist ein Fehler, keine Entscheidung.** Bei veralteter `base`
   (Dokument) kommt der **aktuelle** Text mit zurück; der Agent — und im
   Zweifel der Mensch hinter ihm — entscheidet. Der Server rebased nichts
   über das hinaus, was der `LiveEditingService` ohnehin tut (D76: nicht
   überlappende Ops verschiebt er; das bleibt). Für Dateien gilt dasselbe
   auf der Seite des Agenten: Er hat den Text gelesen und schreibt ihn
   selbst — `werkbaum_check` mit `against` sagt ihm vorher, ob sein
   Ergebnis Befunde hat.

Der Preis der Text-Form ist benannt und war Teil der Entscheidung
(Runde 3): Bei Dateien ist die Leitplanke **Auskunft**, keine Sperre. Ein
Agent, der `blocking: true` ignoriert und die Datei trotzdem schreibt,
hat den Fehler dann wenigstens im Transkript stehen — und der nächste
`inspect` meldet ihn wieder.

### 5.6 Zugang und Identität

**Zugang: ein statisches Bearer-Token je Installation**
(`WERKBAUM_MCP_TOKEN`, in der Umgebungsdatei des Dienstes wie das
Master-Passwort, D77), geprüft von einem Spring-Security-Filter für
`/api/v1/mcp/**`; ohne Token 401. Hosts geben es als Header mit
(Claude Code: `claude mcp add --transport http werkbaum <url> --header
"Authorization: Bearer …"`; der API-MCP-Connector: `authorization_token`).
Das Token reist über HTTPS in der Host-Konfiguration, nie im Transkript.
**OAuth 2.1**, das die MCP-Spezifikation für HTTP vorsieht, kommt, sobald
es einen Identity Provider gibt — die Taiga-Instanz wechselt auf OIDC
(D91-Nachtrag 1), das wäre der naheliegende Anker; ohne einen
Authorization Server wäre OAuth ein Bau weit über den Anlass hinaus
(Runde 2). Ohne konfiguriertes Token ist der Endpunkt **gesperrt, nicht
offen** — dieselbe Voreinstellung wie beim Master-Passwort
(D76-Nachtrag 6), und `GET /info` meldet `mcp: false`.

**Identität:** Jeder Schreibvorgang an ein Dokument geht mit `clientId`
`mcp-<sitzung>` (laufende `seq` je Sitzung, D76-Nachtrag 7) und einem
`displayName`, der den **Host nennt** — den Namen aus dem MCP-Handshake
(`clientInfo.name`, etwa „Claude Code“), Rückfall „Agent“ (Runde 1). In
jedem offenen Editor steht damit „geändert von: Claude Code“ (D86); der
Name bleibt eine Behauptung, kein Nachweis — wie beim Anzeigenamen eines
Menschen. Das Token ist zugleich die Schicht, über die später das
**Owner-Passwort** (`#col.live.owner`) kommt: je Dokument eine Zuordnung
in der Umgebung des Dienstes, **nie** als Tool-Parameter.

### 5.7 Geteiltes Dokument **und** Git — beides zugleich

Ein Agent soll auf dem **geteilten** Dokument arbeiten (dort sitzen die
Menschen, dort greift das Konfliktprotokoll), und derselbe Plan soll
**unter Git-Kontrolle** stehen (Diff, Blame, Review, ein Netz außerhalb
des Servers — D89). Die Antwort ist eine **Richtung**: Der Server ist die
Quelle, Git ist das Archiv.

**Der Weg dafür existiert:** `tools/pull-doc --git-commit` (D88,
`#col.git.pull`) holt ein Server-Dokument in ein Worktree und committet es
datiert, nur bei Änderung. Zwei Aufrufer:

- **Der Cron** auf dem Server-Host oder beim Entwickler — archiviert alle
  Änderungen, egal von wem.
- **Der Agent selbst**, nach seinem Schreibvorgang: Er läuft lokal beim
  Entwickler und hat eine Shell; `pull-doc --git-commit --with-history
  <uuid> <datei>` ist ein Befehl wie jeder andere. Ohne lokalen
  MCP-Prozess (Runde 3) ist das der Weg, den Spiegel **sofort** nach der
  eigenen Änderung zu ziehen; der Cron fängt den Rest. Das Prompt
  `werkbaum/decompose` (§5.8) endet mit genau diesem Hinweis.

**Wer steht im Commit?** Ein Spiegel-Commit enthält den **ganzen**
Serverstand — die Zeilen des Agenten und alles, was Menschen seit dem
letzten Commit geändert haben. Die Form der Urheber-Angabe entscheidet,
ob `git blame` später lügt:

| Form | Aussage | Preis |
|---|---|---|
| a) `git commit --author="Claude Code <…>"` | Der Agent ist Git-**Autor** — `blame` schreibt ihm **jede** Zeile darin zu, auch die, die Anna getippt hat | Falsche Blame-Auskunft; Git verlangt eine E-Mail-Adresse, die es nicht gibt |
| b) `Co-Authored-By:`-Trailer | Die Repo-Konvention für Claude-Commits: „hat beigetragen“, ohne Autor zu sein | Braucht ebenfalls `Name <email>`; für Menschen aus der Server-Historie gibt es nur den Anzeigenamen |
| c) Freitext im Betreff (`… (Version 8, via Claude Code)`) | Lesbar im `git log --oneline` | Nicht maschinenlesbar; nennt nur den Auslöser |
| **d) Historie im Rumpf + eigene Trailer** | Der Rumpf listet aus `GET /history`, **wer welche Version** seit dem letzten Spiegel-Commit geändert hat („v7 Anna · v8 Claude Code“); je Beteiligtem `Werkbaum-Changed-By: <Anzeigename>`, dazu `Werkbaum-Version: 8` | Ein zweiter `GET` je Commit; eigene Trailer statt der GitHub-Konvention |

**Entschieden (Runde 2): d, mit c im Betreff.** Git-Autor bleibt, wer den
Prozess betreibt (buchstäblich richtig — er hat committet), die
Beteiligten stehen mit Namen im Rumpf, maschinenlesbar per
`git interpret-trailers`, und `Werkbaum-Version:` gibt `pull-doc` beim
nächsten Lauf die Untergrenze für „seit dem letzten Commit“. Der
Cron-Commit wird damit im selben Zug ehrlicher. Der Schalter
(`--with-history`) kommt ins Skript (D77-Nachtrag). Die Anzeigenamen
bleiben Behauptungen (D86) — deshalb „Changed-By“, nicht „Author“.

### 5.8 Prompts (optional, Phase 5)

Zwei vorgefertigte Anweisungen, die ein Host dem Nutzer anbietet:

- `werkbaum/review` — „Prüfe diesen Plan: Warnungen, Größen, fehlende
  Zerlegung ab M, unklare Zuständigkeiten“ (nutzt `inspect`, schreibt
  nichts).
- `werkbaum/decompose` — „Zerlege Knoten `#id` in Teilpakete mit Größen“
  (endet in den Verben, mit den Leitplanken; bei einem Dokument mit dem
  Hinweis auf `pull-doc`).

Beides sind Texte, keine Logik; sie leben im Backend-Paket und nicht in
`llms.md` (das bleibt Notation, D43).

### 5.9 Konfiguration

Serverseitig (Umgebungsdatei des Dienstes, D77):

- `WERKBAUM_MCP_TOKEN` — das Bearer-Token; fehlt es, ist der Endpunkt
  gesperrt.
- Kein weiterer Schalter: Es gibt keine Dateiwurzeln (kein Dateizugriff),
  keinen Spiegel (§5.7 läuft beim Aufrufer), keine Fremdserver (§5.2).

Beim Entwickler: die URL und das Token in der Host-Konfiguration. Im
Repository liegt eine `.mcp.json`, die auf `${WERKBAUM_MCP_URL}` und
`${WERKBAUM_MCP_TOKEN}` aus der Umgebung zeigt — damit Claude Code hier
den Server von selbst hat, gegen die stabile Instanz oder gegen ein
lokal gestartetes Backend (`./gradlew bootRun`; der Entwickler-Rechner
hat das JDK ohnehin). Der Plan `docs/examples/werkbaum.werkbaum` ist damit
das erste Dokument, an dem der Server benutzt wird (Dogfooding, D27).

### 5.10 Die JVM führt die JS-Module aus

Der Kern der Entscheidung (Runden 2 und 3): Das Backend braucht die
Werkbaum-Logik, darf sie nicht nachbauen (D14) und soll keine zweite
Laufzeit neben sich haben. Also führt es die Module **selbst** aus —
dieselbe Technik, die der Plan für das IDE-Plugin vorsieht
(`#idea.drift.js`: „den einen JS-Parser im IDE laufen lassen“).

- **GraalJS** (`org.graalvm.polyglot:polyglot` + `js-community`) läuft auf
  dem Stock-OpenJDK 21 der Zielumgebung (D77) im Interpreter-Modus — ohne
  Graal-Compiler langsamer, aber ein Plan hat Dutzende Kilobyte, keine
  Megabyte; zu messen, nicht anzunehmen.
- **Gebündelt beim Bauen:** Gradle ruft das vorhandene Frontend-Tooling
  (esbuild, das Vite mitbringt) und bündelt `frontend/src/inspect.js`
  samt allem, was es importiert, zu **einem** ES-Modul
  `werkbaum-core.mjs` in den Jar-Ressourcen. So braucht GraalJS keine
  Import-Auflösung und kein virtuelles Dateisystem; Node bleibt, was es
  ist — Build-Werkzeug, nie Laufzeit. Der Build bricht, wenn das Bündel
  fehlt: dieselbe Zusage wie bei der OpenAPI-Generierung.
- **Was in der JVM anders ist:** `crypto.subtle` (die Prüfsumme in
  `live.js`) gibt es in GraalJS nicht — die Prüfsumme rechnet Kotlin
  (`MessageDigest`), `checksum()` wird dort nicht aufgerufen; alles
  übrige (`TextEncoder`, `Map`, `Set`, Unicode-Regex) ist ECMAScript und
  vorhanden. Ein Polyglot-`Context` ist **nicht nebenläufig**: ein kleiner
  Pool von Kontexten mit gecachter `Source`, je Aufruf einer — die
  Kosten je Kontext (Speicher, Aufbauzeit) sind Teil des Spikes.
- **Der Spike vor Phase 1** misst: Laufen `parser.js`, `model.js`,
  `live.js`, `inspect.js`, `guard.js`, `edit.js` als Bündel in GraalJS
  und liefern für den mitgelieferten Plan dieselben Zahlen wie Vitest
  (231 Knoten, 0 Warnungen, Stationen)? Was kostet ein Kontext an RSS auf
  der Zielumgebung (D76-Nachtrag 3: rund 300 MB frei)? Reicht der Apache
  den SSE-Strom langer Werkzeugaufrufe ungepuffert durch (Long Polling ist
  gemessen, D76-Nachtrag 2 — ein Strom nicht)? Die Ergebnisse gehören als
  Nachtrag zu D93. **Fällt der Spike durch**, ist die Antwort nicht Node,
  sondern eine neue Frage an den Entwickler (CLAUDE.md-Regel).

## 6. Alternativen

### A — Kotlin-Server mit eigenem Parser

*Pro:* keine JS-Ausführung in der JVM.
*Contra:* **genau die zweite Grammatik, die D14 verbietet** — und die
Drift-Frage, die `#idea.drift` für das IDE-Plugin schon stellt.
**Verworfen** (`#ai.mcp.kotlin` als `[-]`).

### B — Node-Paket, das die Frontend-Module importiert (Entwurf der Runden 1–2)

*Pro:* ein Parser; stdio ist der Transport, den alle lokalen Hosts
können; Dateien und Git-Spiegel direkt am Prozess.
*Contra:* **Node.js würde Laufzeit** — beim Entwickler als Paket, auf dem
Server als zweiter Dienst. Bisher ist Node im Repo Build-Werkzeug. Runde 3
hat das als das erkannt, was es ist: die Einführung einer Technologie,
eine Dimension schwerer als eine Abhängigkeit (CLAUDE.md, D93-Nachtrag).
Und die Beweggründe brauchten es nicht: Der Text darf zum eigenen Server.
**Verworfen** (`#ai.mcp.node` als `[-]`); die Tool-Schicht, die dafür
geplant war, wandert unverändert nach `frontend/src`.

### C — Das Backend-Jar als lokaler stdio-Server (`java -jar … --mcp-stdio`)

*Pro:* keine neue Laufzeit, Dateien und Spiegel lokal.
*Contra:* verlangt ein JDK beim Entwickler und startet in Sekunden; und
sobald der Text ohnehin zum Server darf, ist der lokale Prozess ohne
Anlass. **Nicht gewählt**, bleibt als Rückfall benannt, falls die
Text-Form sich als unpraktisch erweist — sie kostete dann keinen
Technologie-Wechsel.

### D — Nur im Backend, Text-Form für Dateien (gewählt)

*Pro:* eine Laufzeit, ein Artefakt, ein Deployment; die vorhandene
Zugangsschicht; nichts zu installieren beim Entwickler; die Module bleiben
einmal vorhanden.
*Contra:* Netz auch für lokale Dateien; die Leitplanken sind dort Auskunft
statt Sperre; der GraalJS-Spike steht vor allem anderen.
**Gewählt** (Runde 3).

### E — Nichts bauen: Agenten lesen `llms.md` und editieren Dateien

*Pro:* funktioniert heute mit Claude Code.
*Contra:* keine Semantik, keine Server-Dokumente außer per `curl`,
Schreiben ohne Konfliktschutz — der Ausgangszustand aus §2.
**Bleibt als Rückfall bestehen** — der Server ersetzt `llms.md` nicht.

### F — OpenAPI der REST-API den Agenten geben

*Contra:* dieselbe Semantik-Lücke wie E, und die Prüfsumme müsste das
Modell selbst rechnen. **Verworfen.**

### G — `#ai.dialog` zuerst (Modell im Editor)

**Nicht konkurrierend** — D liefert die Module, die G später braucht.

## 7. Impact auf den bestehenden Code

### 7.1 `frontend/src/` — eine Verschiebung, drei neue Dateien

| Datei | Was | Warum |
|---|---|---|
| `app.js` → neu `i18n.js` | Das `I18N`-Objekt (ab `app.js:3287`) in ein headless-Modul verschieben; `app.js` importiert es. | Der Server braucht `warningText(w, t)` mit **englischem** `t`. Eine Kopie im Backend wäre die Drift, vor der D33-Nachtrag warnt. Reine Verschiebung; der Vite-Bundle bleibt gleich. |
| **neu** `inspect.js` | Baum → JSON (`id`, `label`, `line`, `status`, `effectiveStatus`, `assumedSize`, …), Warnungen → `{type, line, text}`, Pfad → Stationen und Lasten. Das Einstiegsmodul des Bündels. | Die Sicht für Agenten — und für `#ai.dialog`. Headless, Vitest-getestet gegen SPEC §10 und den mitgelieferten Plan. |
| **neu** `guard.js` | Leitplanken (§5.5): Warnungs-Delta nach Klasse (strukturell/inhaltlich), `[^]`-Befund; Text → `findings`. | Eine Stelle, die weiß, was blockiert. |
| **neu** `edit.js` | Text→Text-Regeln der Knoten-Verben: `addNodeLine`, `moveSubtree`, `setSizeToken`, `removeSubtree` — zeilenweise, zeichengenau, mit Fortsetzungs- und Beschreibungszeilen (§1), Kommentare bleiben stehen. | Die eine Stelle für „Zeile eines Knotens umbauen“; bewusst nicht in `parser.js` (Sammelbecken). |
| `parser.js`, `model.js`, `live.js`, `taiga.js`, `warnings.js`, `render.js` | **unverändert** | Alles Nötige ist exportiert; `render.js` ist headless bis zum Aufruf (`esc`). |

Die drei neuen Dateien sind reine ES-Module ohne Browser- und ohne
Node-APIs — die Bedingung dafür, dass sie in GraalJS laufen, und ohnehin
die Hausregel (D54-Nachtrag 3).

### 7.2 Backend

| Ort | Was |
|---|---|
| `build.gradle.kts` | Abhängigkeiten `spring-ai-starter-mcp-server-webmvc` und `org.graalvm.polyglot:polyglot` + `js-community` (Runde 3, Rückfrage gestellt und beantwortet — die Boot-4-Verträglichkeit des Starters ist beim Bauen zu prüfen; fällt sie durch, das MCP-Java-SDK direkt mit seinem WebMVC-Transport). Eine Gradle-Task `bundleWerkbaumCore`, die per `npx esbuild --bundle --format=esm` aus `frontend/src/inspect.js` die Ressource `werkbaum-core.mjs` erzeugt; `processResources` hängt davon ab. |
| **neu** `de.werkbaum.integration.mcp` | `WerkbaumCore` (GraalJS-Kontext-Pool, gecachte `Source`, Aufrufe `inspect/check/edit` als Kotlin-Funktionen mit JSON hinein und heraus), `McpServerConfiguration` (Resources, Tools, Prompts am Starter registriert), `McpTools` (die Verben aus §5.4, je mit Text- und Dokument-Form; Dokument-Form über `DocumentService`/`LiveEditingService` — derselbe Weg wie `PATCH /content`, mit Prüfsumme aus `MessageDigest`). |
| `api/SecurityConfiguration.kt` | Bearer-Filter für `/api/v1/mcp/**` gegen `werkbaum.mcp.token`; ohne Wert `denyAll` (D76-Nachtrag 6). |
| `api/DocumentsController.kt` (`getInfo`) | `mcp: true/false` |
| `openapi/api.yaml` | `ServiceInfo.mcp`; der MCP-Endpunkt selbst steht **nicht** in der OpenAPI — er spricht JSON-RPC, nicht REST, und der Starter trägt seinen Vertrag selbst (dieselbe Grenze wie beim Long-Polling-Endpunkt, D76-Nachtrag 5: was der Generator nicht ausdrücken kann, bleibt draußen — hier ohne Verlust, denn die Tool-Schemata prüft das SDK) |
| `application.yaml` | `werkbaum.mcp.token: ${WERKBAUM_MCP_TOKEN:}` |
| `scripts/deploy-backend.sh` | zieht `WERKBAUM_MCP_TOKEN` aus der `.env` idempotent in die Server-Umgebung — dieselbe Zeile wie für `TAIGA_API_URL` (D91-Nachtrag 4) |
| `scripts/prod.htaccess` | **unverändert** — `/api/` ist proxied; der SSE-Strom ist zu messen (§5.10) |
| Tests | `WerkbaumCoreTest` (Bündel läuft, dieselben Zahlen wie Vitest), Cucumber-Szenarien über einen MCP-Client gegen den laufenden Kontext (Token fehlt ⇒ 401; `set_status` auf Dokument mit veralteter `base` ⇒ Konflikt; `[^]` ⇒ abgelehnt; `sizeConflict` ⇒ geschrieben und gemeldet) |

Perspektivisch berührt: `#col.live.owner` — das Owner-Passwort kommt
über die Umgebung des Dienstes (§5.6), die Endpunkte sind so zu schneiden,
dass die Prüfung dazukommt, ohne die Signatur zu brechen (backend/CLAUDE.md).

### 7.3 Übriges

| Ort | Änderung |
|---|---|
| `tools/pull-doc` | `--with-history` (§5.7): holt `GET /history`, listet im Rumpf, wer welche Version seit dem letzten Spiegel-Commit geändert hat, setzt die Trailer `Werkbaum-Changed-By:` und `Werkbaum-Version:`; der Schalter kommt ins Skript, nicht in den Aufrufer (D77-Nachtrag) |
| `.mcp.json` (Repo-Wurzel) | HTTP-Server-Eintrag mit URL und Token aus der Umgebung (Dogfooding) |
| `README.md` / `README.de.md` | Abschnitt „Für KI-Agenten: der MCP-Server“ — URL, Token, die zwei Formen, die Leitplanken, `pull-doc` |
| `frontend/public/llms.txt` | ein Link auf den Endpunkt (Wegweiser, D43-Nachtrag 2); `llms.md` **unverändert** |
| `docs/CHANGELOG.md` | je Phase eine Zeile |
| `tools/remote` | **unverändert** — es ist derselbe Dienst |
| `frontend/package.json` | keine neue Abhängigkeit: esbuild bringt Vite mit |

## 8. Sicherheit

- **Plan-Text ist Fremddaten.** Beschreibungen (`---`-Teil) können
  Anweisungen enthalten („ignoriere die Leitplanken“). Der Server führt
  nichts aus, was im Text steht — GraalJS läuft **ohne** Host-Zugriff
  (kein `HostAccess`, kein Dateisystem, kein Netz im Kontext); der Text
  ist Eingabe einer reinen Funktion. Resources sind als Inhalt deklariert,
  nie als Anweisung. Der Host trägt die Prompt-Injection-Frage — der
  Server macht sie nur nicht schlimmer.
- **Kein Geheimnis im Transkript.** Master-Passwort und Taiga-Token gehen
  **nie** über MCP; das Bearer-Token steht in der Host-Konfiguration. Ein
  späteres Owner-Passwort kommt als Umgebungsvariable (§5.6).
- **Kein Dateizugriff, keine Fremdserver.** Der Server liest keine Pfade
  und ruft keine URLs — `document` ist eine UUID des eigenen Backends
  (§5.2). Die einzige Netzverbindung des MCP-Endpunkts ist der Aufrufer.
- **Rechenkosten gedeckelt:** Textgröße je Aufruf begrenzt (dasselbe
  Limit wie `PATCH /content`, D76), Kontext-Pool begrenzt, ein
  Werkzeugaufruf mit Timeout — ein hängender Kontext wird verworfen, nicht
  wiederverwendet.
- **Schreiben nur mit `base`** auf Dokumenten; kein Volltext-`PUT`. Was
  der Editor an Netzen hat (Konflikt-Band, Rettungs-Sicherung, D89), hat
  der Agent in Form des zurückgelieferten aktuellen Textes.

## 9. Abgrenzung — was ausdrücklich nicht gebaut wird

| Nicht gebaut | Warum | Wo es hingehört |
|---|---|---|
| Modellaufrufe, API-Schlüssel, Provider-Wahl | Der Host hat das Modell; ein Server mit eigenem Schlüssel wäre `#ai.key` unter falschem Namen | `#ai.key`, `#ai.dialog` |
| Ein lokaler MCP-Prozess (Node-Paket oder Jar-Modus) | Neue Laufzeit bzw. ohne Anlass, sobald der Text zum Server darf (Runde 3) | `#ai.mcp.node` (`[-]`); Jar-Modus als benannter Rückfall (§6 C) |
| Dateizugriff des Servers | kein Nutzer-Dateisystem am Dienst; ein Pfad über HTTP wäre die Einladung, die §8 verbietet | der Agent liest und schreibt selbst |
| Fremde Backends per URL | SSRF; ein Server, ein Dokumentenbestand | zwei MCP-Server konfigurieren |
| Taiga-Tools (Ticket anlegen, Status schreiben) | Braucht das Taiga-Token — das lebt im Browser (D91) und dürfte nicht durch ein Transkript; außerdem eine eigene Entscheidung, ob ein Modell Tickets anlegen darf | eigener Nachtrag: über den vorhandenen Proxy, Token aus der Umgebung |
| Anlegen/Löschen/Umbenennen von Dokumenten | Verwaltung; wartet auf `#col.live.owner` | nach dem Owner-Passwort |
| Falten (`fold`/`unfold`) als Verb | Faltmarken sind Darstellung für Menschen (§9); ein Agent liest den ganzen Text | — |
| Änderungsfeed / Long Polling über MCP | Ein Agent arbeitet in Zügen; `read` vor jedem Schreiben genügt | — |
| Git als **Quelle** (Server folgt dem Repo) | Umkehrung von §5.7; Konfliktmarker mitten in der Notation | `#col.git.pr`, `#col.git.auto` |
| OAuth 2.1 | kein Identity Provider; Bearer-Token bis dahin | `#ai.mcp.auth`, wenn ein IdP da ist |
| Ein Kotlin-Parser | D14 | `#ai.mcp.kotlin` (`[-]`) |

## 10. Umsetzungsreihenfolge

Jede Phase ist für sich abgeschlossen und bekommt ihre CHANGELOG-Zeile;
Plan-Knoten gehen beim Mergen auf `[x]`.

0. **Spike** (`#ai.mcp.spike`): GraalJS-Bündel läuft in der JVM, dieselben
   Zahlen wie Vitest für den mitgelieferten Plan; Speicher je Kontext auf
   der Zielumgebung gemessen (RSS vorher/nachher, wie in D77); SSE durch
   den Apache mit einem absichtlich langen Werkzeugaufruf gemessen (wie
   D76-Nachtrag 2). Ergebnis als D93-Nachtrag. **Erst danach wird gebaut.**
1. **Lesen und befragen** (`#ai.mcp.core`, `#ai.mcp.read`,
   `#ai.mcp.inspect`, `#ai.mcp.auth`): `i18n.js`, `inspect.js`, das
   Bündel im Jar, `WerkbaumCore`, Bearer-Filter, Resources, `read`,
   `inspect`, `check` in beiden Formen. Nachweis: Claude Code liest über
   die `.mcp.json` den mitgelieferten Plan und bekommt 231 Knoten,
   0 Warnungen, dieselben Stationen wie der Editor; ohne Token 401.
2. **Schreiben** (`#ai.mcp.write`, `#ai.mcp.guard`): `guard.js`, die drei
   Basis-Schreib-Werkzeuge in beiden Formen. Nachweis gegen das lokale
   Backend mit offenem Editor: Agenten-Änderung erscheint mit
   „Claude Code“ in der Historie; veraltete `base` ⇒ Fehler mit aktuellem
   Text, nichts überschrieben; `[^]` abgelehnt; `mixedGate` abgelehnt,
   `sizeConflict` geschrieben und gemeldet; Text-Form liefert
   `blocking: true` und trotzdem den Text.
3. **Knoten-Verben** (`#ai.mcp.verbs`): `edit.js` mit Tests (Gegenprobe
   per Mutation wie bei `setFoldMark`), dann die vier Verben. Nachweis:
   `move_node` nimmt Beschreibungsblock und Fortsetzungszeilen mit und
   lässt den Rest zeichengenau stehen.
4. **Spiegel** (`#ai.mcp.mirror`): `pull-doc --with-history`. Nachweis in
   einem Wegwerf-Worktree: ein Agenten-Zug ergibt genau einen Commit mit
   Serverstand, Beteiligten im Rumpf und beiden Trailern; ein
   unveränderter Zug keinen.
5. **Prompts** (§5.8).

## 11. Entscheidungen

Drei Multiple-Choice-Runden am 2026-09-02, jede Frage mit der Option
„zunächst offen halten“ — keine wurde gewählt.

**Runde 1**

| Frage | Entschieden | Anmerkung |
|---|---|---|
| Strenge der Warnungs-Leitplanke (§5.5) | **Nur Struktur-Warnungen blockieren** | Vorgeschlagen war die strenge Fassung; der Nutzer hat die Zwischenschritte eines Agenten höher gewichtet |
| `displayName` (§5.6) | **Host-Name aus dem Handshake** | Rückfall „Agent“ |
| Geteiltes Dokument und Git (§5.7) | **Beides**: Server ist Quelle, Git Archiv über `pull-doc` | Nutzer-Idee, mitten in der Ausarbeitung |
| Schreib-Tools (§5.4) | **Zusätzlich Knoten-Verben** | Regeln in `frontend/src/edit.js` |
| Verteilung | **Nur aus dem Repo** | `.mcp.json`; npm-Frage entfällt mit Runde 3 ohnehin |
| SDK-Abhängigkeit für das Node-Paket | Ja | **überholt** durch Runde 3 (kein Node-Paket) |
| Ort der Baum-Serialisierung | im MCP-Paket | **überholt**: es gibt kein Paket; sie liegt als `frontend/src/inspect.js` — dort, wo `#ai.dialog` sie braucht |

**Runde 2** (Nutzer: Architektur-Entscheidungen jetzt diskutieren)

| Frage | Entschieden | Anmerkung |
|---|---|---|
| Urheber im Spiegel-Commit (§5.7) | **Historie im Rumpf + Trailer** | `Werkbaum-Changed-By:`, `Werkbaum-Version:`; Git-Autor bleibt der Betreiber |
| HTTP: Ort | **Im Backend, das die JS-Module per GraalJS ausführt** | Die Frage „Kotlin kann das nicht?“ hat den Entwurf korrigiert: MCP braucht kein Node, nur der Parser erzwang es |
| HTTP: Zugang (§5.6) | **Statisches Bearer-Token** | OAuth 2.1 erst mit einem IdP |
| HTTP: Umfang | **Nur Dokumente** | kein Dateizugriff, kein Spiegel am Dienst |

**Runde 3** (Nutzer: neue Technologien sind eine Dimension schwerer als
Abhängigkeiten; erst die Beweggründe, dann die Entscheidung)

| Beweggrund | Antwort |
|---|---|
| Für wen? | Entwickler, die parallel an geteilten Plänen arbeiten und agentische KI einsetzen — Pläne im Dialog erstellen, Fortschritt tracken; der Agent läuft meist lokal (OpenCode, Claude Code, Codex); später ein Agent im Frontend |
| Welche Pläne? | **Beides**: `.werkbaum`-Dateien im Repo und geteilte Server-Dokumente |
| Darf der Text eines lokalen Plans zur Analyse an den eigenen Server? | **Ja** |
| Startzeit eines lokalen Prozesses? | Egal |

| Entscheidung | Entschieden | Anmerkung |
|---|---|---|
| Node als Laufzeit? | **Nein — nur im Backend**, Text-Form für Dateien (§5.2) | Alternative C (Jar als stdio) als Rückfall benannt |
| Backend-Abhängigkeiten | **GraalJS + Spring-AI-Starter** (`spring-ai-starter-mcp-server-webmvc`) | Boot-4-Verträglichkeit beim Spike prüfen; Rückfall das MCP-Java-SDK direkt |

**Weiterhin offen** — Messungen und Kleinigkeiten, die sich erst beim
Bauen stellen: der Spike (§5.10, Phase 0) mit seinen drei Messungen; die
Prompts (§5.8).

## 12. Revisionsgeschichte

- **Runde 1** — Node-Paket `mcp/` mit stdio, Dateien und Server-Dokumente
  als Ablagen; SDK, Leitplanken, Verben, Spiegel entschieden.
- **Runde 2** — Urheber im Commit; Streamable HTTP im Backend per GraalJS
  statt als zweiter Node-Dienst — der Entwurf hatte angenommen, MCP
  erzwinge Node.
- **Runde 3** — Der Nutzer benennt Node als **neue Technologie**, nicht
  als Abhängigkeit (CLAUDE.md-Regel, D93-Nachtrag). Aus den Beweggründen
  folgt: kein lokaler Prozess, alles im Backend, Text-Form für Dateien.
  Das Node-Paket ist verworfen; seine Tool-Schicht lebt als
  `frontend/src/inspect.js`, `guard.js`, `edit.js` weiter — unverändert
  im Zuschnitt, nur ohne eigenes Paket.
