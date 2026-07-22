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
