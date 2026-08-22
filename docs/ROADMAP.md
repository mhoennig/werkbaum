# Roadmap

## Nahziel: tragfähige Codebasis
- Single-HTML-Prototyp (`index.html`) in Module zerlegen: `parser`, `model`,
  `render`, `app`. Parser und Renderer müssen headless (ohne DOM-Editor)
  nutzbar sein — Voraussetzung für alle Integrationen.
- Testsuite gegen `docs/SPEC.md` (kanonisches Beispiel als Fixture).

## Mermaid-Plugin
Ziel: ```wbs```-Blöcke in Mermaid-Umgebungen rendern.
- Offizieller Mechanismus: `mermaid.registerExternalDiagrams()` mit
  Detektor (Schlüsselwort `wbs`), Parser, DiagramDB, Renderer.
  Präzedenzfälle: ZenUML (extern), Mindmap (ursprünglich extern, ebenfalls
  einrückungsbasierte Syntax).
- Hauptaufwand: **SVG-Renderer** mit eigener Layout-Berechnung
  (Knotenmaße messen, Positionen, Verbinder als Pfade) inkl. Mischlayout
  und transponiertem Modus. Toggles werden zu Syntax-Optionen
  (z. B. `wbs LR`, Direktiven).
- Einschränkungen: wirkt nur in selbst initialisierten Mermaid-Instanzen
  (nicht GitHub/GitLab/Notion); Lazy-Loading externer Diagramme galt zuletzt
  als experimentell. Für universelle Verfügbarkeit: PR als eingebautes
  Diagramm (Vorbild Mindmap/Kanban).

## Taiga-Integration
Ziel: Knoten mit Taiga-Objekten verlinken, Status automatisch synchronisieren.
- Architektur nach **Seedtime-Vorbild**: Companion-Ansatz — der Editor
  (frontend/) plus ein Kotlin/Spring-Backend (backend/, D13) sprechen per
  REST-API mit Taiga; optional dünnes
  contrib-Frontend-Plugin (Menüpunkt im Projekt) und Backend-Paket
  (Speicherung in Taigas DB statt Wiki-Seite).
- Syntax-Erweiterung `#123`: Referenz auf Epic/User Story/Task/Issue;
  App löst Titel, Link und Status per API auf. Status-Mapping
  Taiga-Workflow → Notation (z. B. „In progress“ → `[~]`, „Done“ → `[x]`).
- Aktualisierung: API-Abfrage beim Öffnen; Push via Webhooks.
  Rückrichtung (Status im WBS ändern → Taiga) möglich.
- Einschränkungen: Plugins nur self-hosted (nicht taiga.io-Cloud);
  Taiga 6 im Wartungsmodus, Frontend AngularJS-Altbestand — daher
  Companion-App bevorzugen.

## Tenzu (Beobachten)
Nachfolger von „Taiga Next“; seit Ende Juli 2024 von der französischen
Genossenschaft Biru entwickelt (Kaleidos fokussiert Penpot). Open Source,
in laufender Entwicklung, Integrationsfähigkeit erklärtes Ziel — noch zu
jung als Plattform-Ziel. Companion-App so schneiden, dass ein späterer
Umzug Taiga → Tenzu nur den API-Adapter betrifft.

## Gemeinsam an einem Diagramm arbeiten
Ziel: mehrere Personen ändern denselben Plan. Drei Stufen, aufeinander
aufbauend — die dritte lohnt nur, wenn wirklich gleichzeitig gearbeitet wird.

**1. Lesen teilen — vorhanden.** `?sourceUrl=` (D23) zeigt eine entfernte
Textdatei an; die Quelle wird anderswo gepflegt. Einbahnstraße, aber ohne
jeden Server.

**2. Asynchron ändern über Git — heute schon möglich, ohne eine Zeile Code.**
Die `.werkbaum`-Datei (D24) liegt im Repository, wird per Pull Request geändert
und per `?sourceUrl=` angezeigt. Weil der Plan **Text** ist (D14), sind
`git diff` und `git blame` tatsächlich lesbar („wer hat *Payment provider* auf
`[!]` gesetzt?"). Für einen Plan, der sich pro Woche und nicht pro Sekunde
ändert, ist das oft die passendere Antwort — mit Review und Historie obendrauf.
Ausbau: Das Backend (D13) legt jede Änderung als Commit ab und bekommt
Historie, Wiederherstellung und Verzweigungen für Szenarien geschenkt.

*Git direkt aus dem Browser* ist technisch möglich (`isomorphic-git` spricht das
HTTP-Smart-Protokoll), taugt aber nicht als Live-Sync: Es synchronisiert auf
Zuruf statt fortlaufend, braucht wegen fehlender CORS-Header einen Proxy (SSH
scheidet im Browser ohnehin aus), und ein Konflikt landet als
`<<<<<<<`-Markierung mitten in der Notation — der Parser sähe kaputte Zeilen.

**3. Live gemeinsam tippen — offen.** Der **Transport** ist das kleinere
Problem (WebSocket; SSE + POST oder WebRTC als Alternativen). Die eigentliche
Frage ist, was passiert, wenn zwei Personen **dieselbe Zeile** ändern: Naives
„jede Änderung sofort in beide Richtungen" führt zu Textsprüngen unter dem
Cursor und verlorenen Zeichen. Erprobte Antworten sind **Operational
Transformation** (Google Docs) und **CRDTs**. Für Werkbaum fällt die Wahl
leicht, weil D14 das Format auf puren Text festgelegt hat: Ein Text-CRDT
(`Y.Text` in Yjs, oder Loro) passt ohne eigene Merge-Logik darauf; Cursor und
Anwesenheit fallen als Beigabe ab. **Eigene Merge-Algorithmen sind hier kein
Betätigungsfeld** — das Problem ist gelöst.

Offene Punkte vor einer Entscheidung: Yjs wäre die **erste
Laufzeit-Abhängigkeit** überhaupt (CLAUDE: nicht ohne Rückfrage); wie CRDT-
Zustand und Git-Historie zusammenspielen (Commit-Granularität — nicht jeder
Tastendruck ein Commit); und wer bei einem Backend eigentlich was darf
(Rechte, siehe „Accounts" im Werkbaum-Beispielplan).

## Kleinere Ideen
- Deterministische Pastellfarbe pro `@name` (Personen wiedererkennen).
- Sichtbare Anmerkungen am Knoten (eigene Syntax, getrennt von `%%`).
- Aufwands-Rollup: Größen der Kinder aggregieren und mit Parent vergleichen.
  (Größen sind ordinal, nicht additiv — `S+S ≠ M`; braucht erst eine
  Mapping-Konvention, z. B. Story-Point-Werte hinter den Größen.)
- Nutzen/Wert je Knoten (Gegenstück zur Kosten-Größe): eigenes Attribut für den
  erwarteten Nutzen; erlaubt Nutzen/Kosten-Priorisierung (WSJF-artig) statt
  reiner Kostenminimierung. Rollt analog zum Aufwands-Rollup hoch.
  (Syntax offen — SPEC-first; `(…)`/`@`/`#`/`%%` sind belegt, es braucht ein
  eigenes kollisionsfreies Zeichen.)
- Gestaffelter „günstigster Pfad" (Ausbaustufen): die Pfad-Rechnung (D18)
  status-bewusst machen — `fertig`/`prod` gelten als erledigt (Hintergrund),
  hervorgehoben wird nur der günstigste noch **offene** Rest (aktuelle Front).
  Ist eine Alternativen-Gruppe komplett realisiert, springt der Pfad zur
  nächsten, per Nutzen gewählten Ausbaustufe weiter (Regel: erst die Kette auf
  `fertig`, dann die nächste Stufe). Baut auf Nutzen + Aufwands-Rollup auf und
  erweitert D18 (heute rein statisch/kostenminimierend) um Nutzen- und
  Status-/Zeitachse.
- Attribut-Syntax für Termine/Meilensteine.
- Schlagworte `&tag` mit einer Filter-/Hervorheben-Linse im Diagramm: Der Baum
  ist genau eine Zerlegung — ein Tag benennt eine Menge von Knoten quer dazu
  (z. B. `&frontend` in feature-geschnittenen Slices). Schreibweise reserviert
  (SPEC §11, D34-Nachtrag); bewusst erst zusammen mit dem ersten Konsumenten
  bauen (Linse oder Taiga-Label-Sync) — ohne Auswerter sind Tags nur
  Kommentare mit Extra-Syntax. Die Inversions-Mechanik der Linse gibt es durch
  den günstigsten Pfad (D18) schon.

## Vollständiges Lean-Pathfinding

Werkbaum hat die Grundlagen — Und/Oder-Zerlegung, Größen, günstigster Pfad —,
aber der Pfad rechnet bisher nur innerhalb des gewählten Teilbaums. Was fehlt,
ist die Möglichkeit, Bezüge **quer** durch den Baum auszudrücken. Diese Stufe
holt das nach. Schreibweisen und offene Punkte stehen in **SPEC §11**,
Begründung und Folgen in **D34**; hier steht, was es dem Werkzeug bringt.

**Fünf Erweiterungen der Notation.** Sie hängen zusammen: ohne IDs keine
Abhängigkeiten, ohne Abhängigkeiten kein effektiver Status, ohne den kein
Pfad, der die Wahrheit sagt.

- **Knoten-IDs** (`#auth`) — ein whitespace-freier Bezeichner macht einen Knoten
  im ganzen Dokument adressierbar. Für sich genommen nutzlos; er ist das Ziel
  für alles Folgende.
- **Abhängigkeiten** (`:#auth,#api`) — ein Knoten hängt von Knoten außerhalb
  seines eigenen Teilbaums ab. Sie sagen nichts über Reihenfolge oder
  Startzeitpunkt, sondern etwas über den Status; Zyklen sind zulässig und
  bedeuten „wird gemeinsam fertig".
- **Intrinsischer und effektiver Status** — was in der Statusbox steht, ist der
  Bearbeitungsstand des Knotens selbst. Effektiv fertig ist er erst, wenn auch
  seine Abhängigkeiten es sind. Der effektive Status wird gerechnet, nie
  geschrieben.
- **XOR** (`=`) — neben „mindestens eine" (`|`) eine Gruppe, in der **genau
  eine** Alternative realisiert werden darf. Für die Pfadrechnung ändert das
  nichts (die wählt bei `|` ohnehin eine); es kommt eine Regel hinzu, die
  verletzt werden kann und dann gemeldet wird. **Umgesetzt** (SPEC §3, D35).
- **Knotenbeschreibungen** — Erläuterungstext zum Knoten, im Diagramm als
  Tooltip oder Pop-up: kurz direkt beim Knoten, lang als Block am Dokumentende
  über die ID zugeordnet. Die Arbeit steckt nicht im Anzeigen, sondern in der
  Schreibweise: Einrückung bedeutet hier bereits Hierarchie.

**Was daraus folgt.**

- **Dependency-aware Pathfinding.** Gerechnet wird nicht mehr der Teilbaum,
  sondern die **Dependency Closure** — alles, was zusätzlich nötig ist, damit
  der gewählte Knoten effektiv fertig werden kann. Gemeinsam benötigte
  Abhängigkeiten zählen **nur einmal**. Damit ist die Wahl zwischen
  Alternativen nicht mehr lokal entscheidbar: Was billig ist, hängt davon ab,
  was der Rest des Plans ohnehin einkauft (Beispiel und Konsequenz in D34).
  Das ist die eigentliche Erweiterung von D18, und die einzige Stelle, an der
  hier echte Algorithmik steckt.
- **Querverbindungen im Diagramm.** Abhängigkeiten als optisch sekundäre Linien
  (dünn oder gestrichelt), bei ausgewähltem Knoten seine ein- und ausgehenden
  hervorgehoben. Erste Linienart, die nicht der Zerlegung folgt — sie braucht
  eine eigene Zeichenebene (SVG, wie der Pfad-Spline), nicht die Rahmenkanten.
- **Ein- und ausklappbare Teilbäume** (`>` / `<`). Sobald Pläne quer verbunden
  sind, wächst das Diagramm über den Bildschirm hinaus; ohne Falten ist ein
  großer Plan nicht mehr zu lesen. Die Marken im Text bestimmen nur den
  Anfangszustand — im Diagramm wird danach unabhängig gefaltet. Schreibweise
  und Export-Verhalten sind entschieden (D34-Nachtrag): `- > [x] …`,
  Export/Druck folgen der sichtbaren Faltung mit Kennzeichnung.
  **Umgesetzt** (SPEC §1/§9, D38).

Der gestaffelte „günstigste Pfad" aus *Kleinere Ideen* (Status-Bewusstsein,
Ausbaustufen) baut hierauf auf: Er braucht denselben Umbau der Kostenrechnung
und ist danach im Wesentlichen eine Frage der Auswahl, nicht der Mechanik.

Breitere Feature-Wunschliste zum Thema: `docs/LEAN-PATHFINDING.md`
(Entwurf, kein Beschluss), Marktumfeld: `docs/MARKET-ANALYSIS.md`.
