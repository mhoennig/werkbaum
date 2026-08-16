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

## Features für vollständiges Lean-Pathfinding

- **Ein-/Ausklappbare Teilbäume**  
  Teilbäume können im Text mit einer kompakten Zeichensyntax als initial eingeklappt markiert werden. `>` steht dabei für „ab hier einklappen“, `<` kann innerhalb eines eingeklappten Bereichs gezielt wieder sichtbare Teilbäume hervorholen. Im Diagramm kann anschließend unabhängig vom Text interaktiv ein- und ausgeklappt werden.

- **Knoten-IDs**  
  Knoten können über eine kompakte ID wie `#auth` eindeutig adressiert werden. IDs bestehen aus einem whitespace-freien Bezeichner und dienen insbesondere als Ziel für Querverweise und Abhängigkeiten.

- **Abhängigkeiten zwischen Knoten**  
  Mit einer Syntax wie `:#auth,#api` kann ein Knoten von anderen Knoten außerhalb seines eigenen Teilbaums abhängig gemacht werden. Dependencies beeinflussen nicht, wann Arbeiten beginnen dürfen, sondern den **effektiven Status** eines Knotens.

- **Intrinsischer und effektiver Status**  
  Der intrinsische Status beschreibt den tatsächlichen Bearbeitungsstand eines Knotens. Der effektive Status berücksichtigt zusätzlich seine Abhängigkeiten. Ein intrinsisch fertiger Knoten kann daher effektiv noch nicht vollständig fertig sein, solange Dependencies nicht erfüllt sind.

- **Dependency-aware Lean Pathfinding**  
  Das Lean Pathfinding berücksichtigt künftig nicht nur den Restaufwand innerhalb des gewählten Teilbaums, sondern die gesamte notwendige **Dependency Closure**. Gemeinsam benötigte Dependencies werden dabei nur einmal berechnet. Zyklen sind zulässig und entsprechen gemeinsam fertigzustellenden Gruppen.

- **Visualisierung von Dependencies**  
  Abhängigkeiten werden als optisch sekundäre Querverbindungen im Diagramm dargestellt, etwa dünn oder gestrichelt. Bei Auswahl eines Knotens können dessen ein- und ausgehende Dependencies hervorgehoben werden.

- **XOR / exklusives Oder**  
  Zusätzlich zu `all-of`, `any-of` und optionalen Knoten soll eine echte XOR-Gruppe unterstützt werden: Genau eine Alternative darf realisiert werden. Als kompakte Syntax bietet sich beispielsweise `x` an.

- **Knotenbeschreibungen / Detailtexte**  
  Knoten können zusätzliche Erläuterungstexte erhalten, die im Diagramm als Tooltip oder Pop-up angezeigt werden. Vorgesehen sind kurze, direkt beim Knoten eingerückte Texte sowie längere, über die Knoten-ID referenzierte Beschreibungsblöcke am Ende des Dokuments.
