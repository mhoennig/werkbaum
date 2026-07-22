# Lean Pathfinding – Features für Werkbaum

## Überblick

**Lean Pathfinding** ist eine Workshop-Methodik zur Visualisierung komplexer Features und Identifikation des kostengünstigsten Implementierungspfads. Werkbaum hat bereits die Kern-Infrastruktur (And/Or Gates, visuelle Bäume, Größen, günstigster Pfad). Diese Roadmap transformiert den Editor in ein dediziertes Lean-Pathfinding-Werkzeug.

**Impact:** Teams, die diesen Ansatz konsequent nutzen, liefern in 2–3 Wochen, was ursprünglich 6 Monate kosten sollte.

---

## Phase 1: Foundation – Quick Wins
*Basis-Features für echte Pfad-Optimierung. Priorität: Höchst.*

- [ ] **Abhängigkeits-Marker** — Features können explizit auf andere Features verweisen (`→ andere Feature`). Gestrichelte rote Linien im Diagramm zeigen Blockierungen; Warnungen wenn Abhängigkeiten zirkulär oder nicht erfüllbar sind.

- [ ] **Team-Velocity-basiertes Kostenmodell** — T-Shirt-Größen werden in Story-Points übersetzt (konfigurierbar pro Team). Automatische Timeline-Berechnung: T-Shirt + Team-Velocity → Wochen, mit eingebautem Overhead-Faktor (Meetings 1.2×) und Risk Buffer (1.15×). Warnung: "Feature > 2 Sprints, sollte zerlegt werden".

---

## Phase 2: Optimization – Neue Capabilities
*Unterstützung für MVP-Entscheidungen und Abhängigkeits-Management.*

- [ ] **Critical Path Visualization** — Mit Abhängigkeits-Daten berechnet der Editor die längsten Abhängigkeitsketten (rote/orange Linie). Tooltip zeigt: "Kritischer Pfad: 8 Wochen – diesen Pfad musst du zuerst abarbeiten, sonst läuft der Plan".

- [ ] **Path Optimizer** — Interaktiver Dialog: User aktiviert/deaktiviert Features als Checkboxen (z.B. "Nur Core + Reporting, ohne Analytics"). Werkbaum berechnet automatisch **Minimal Cost** für diese Auswahl: "Für diesen Scope brauchst du mindestens 3.2 Sprints; kritischer Pfad 2.5 Wochen".

- [ ] **Project Health Dashboard** — Single-Page Übersicht mit: Total Scope & Completed Points, Burndown-Kurve, Slice-Status-Verteilung (✓/~/[]/[?]), Team-Auslastung pro Person, At-Risk Items (Abhängigkeits-Blockaden). Snapshot für Statusmeetings.

---

## Phase 3: Adoption – Neue User onboarden
*Workshop-Support und Migrations-Hilfe für bestehende Projekte.*

- [ ] **Discovery Workshop Guide** — Step-by-Step-Anleitung im Editor (Sidebar oder Modal): 1) Ziel schreiben (Epic), 2) Bereiche identifizieren (And/Or Gates setzen), 3) Untergliedern (Rekursion), 4) Größen schätzen, 5) Günstigsten Weg wählen. Mit Tooltips und Best-Practice-Beispielen.

- [ ] **Risk Flagging** — Automatische Erkennung von Problemen: Abhängig von externem Service (Google, GitHub) → Risiko; Größe > Velocity → überschreitet einen Sprint; "Noch nie gemacht" (Knowledge Gap Tag/Zuständiger) → Schulungsbedarf; Definition of Done fehlt (kein Link/Kommentar zur DoD) → Flag. Gelbe Warnungen im Diagramm.

- [ ] **Horizontal→Vertical Slice Converter** — Tool zum Umstrukturieren: Alte Zerlegung (alle UI, alle Backend, alle Testing) wird interaktiv in vertikale Slices konvertiert (jede Slice ist ein kompletter Funktionsbaustein UI+Backend+DB). Hilft bestehenden Projekten, Lean Pathfinding zu adoptieren.

---

## Phase 4: Power User – Integrationen & Analytics
*Erweiterte Funktionen für Profis und Ecosystem-Integration.*

- [ ] **Gantt-Export** — Export des Dependency-Baums als Gantt-Diagramm (Mermaid Gantt oder MS Project CSV mit Abhängigkeitspfeilen). Zeigt: Welche Slices können parallel laufen, wo sind Bottlenecks. Für traditionelle Stakeholder, die Gantt-Diagramme lesen.

- [ ] **Live Collaboration Mode** — Real-time Multi-User Editing mit WebSocket (oder CRDT wie Yjs). Mehrere Team-Mitglieder sehen sich gegenseitig beim Aufbau des Discovery Trees in Echtzeit; Cursor-Verfolgung; Conflict-free Edits.

- [ ] **Jira/Azure DevOps Adapter** — One-Click Export: And/Or-Struktur wird zu Epics/Features/Stories; Größen werden zu Story Points; Tags → Assignee; Status-Mapping (Werkbaum `[~]` → Jira `In Progress`). Umgekehrt: Können Jira-Epics importiert werden?

- [ ] **AI-gestützte Auto-Sizing** — Machine-Learning-Modell trainiert auf Team-Historie (Größe geschätzt vs. tatsächlich). Wenn User "M" schätzt, sagt die KI: "Basierend auf euren letzten 20 Features ist realistisch 13 Punkte (eher L)". Kontinuierliche Verbesserung der Estimates.

- [ ] **Burndown & Velocity Tracking** — Dashboard zeigt: Planned vs. Actual Burndown über Zeit; durchschnittliche Velocity pro Sprint; Trendlinie. Hilft, zukünftige Timelines realistischer zu schätzen. Export als CSV für externe Analytics.

- [ ] **Waste Analysis Report** — Automatische Erkennung von Lean-Verschwendungen: Overproduction (zu viele `[?]`-Features ohne Commitment), Waiting (Blockagen durch Dependencies), Extra Processing (Features, die oft umgearbeitet werden, hohe Volatilität), Non-Utilized Talent (Team-Mitglieder ohne aktive Aufgaben in diesem Sprint). Textbericht mit Optimierungs-Tipps.

- [ ] **Slice-Suggestion Engine** — KI-gestützte Vorschläge für vertikale Slices. User gibt Epic ein, die Engine schlägt vor: "Diesen großen Bereich würde ich so zerlegen: 1) CRUD-Basis (Slice A), 2) Validierung + Error Handling (Slice B), 3) Integration mit Service XYZ (Slice C)". Basierend auf Best Practices und der SPEC.

---

## Implementation Strategy

### MVP (Phase 1 + Teile von Phase 2)
**Ziel:** Abhängigkeits-Tracking + Velocity-basierte Kostenschätzung als Basis.

1. Data Model: Abhängigkeits-Notation in SPEC erweitern (z.B. `→ Feature-Id`)
2. Parser: `→`-Syntax extrahieren, Dependency Graph validieren
3. UI: Dependency-Linien im Diagramm zeichnen; kritische Pfade hervorheben
4. Timeline-Rechner: T-Shirt + Velocity + Team-Config → Wochen
5. Tests: Zirkuläre Abhängigkeiten, Kostenberechnung, kritische Pfade

### Next (Phase 2)
- Path Optimizer: Interaktive Subset-Selection + Kostenberechnung
- Health Dashboard: Aggregierte Metriken, Snapshot-UI

### Später (Phase 3 & 4)
- Workshop Guide: UX für neue User
- AI Features: Risk Flagging, Auto-Sizing, Suggestions (mit Backend-Integration)
- Integrationen: Jira Adapter, Gantt-Export, Collaboration

---

## Verwandte Konzepte

| Konzept                            | Verhältnis zu Lean Pathfinding                                                                   |
|------------------------------------|--------------------------------------------------------------------------------------------------|
| **Lean Thinking**                  | Fundament: Customer Value, Muda-Elimination, Respect for People                                  |
| **Value Stream Mapping**           | Optimiert *bestehende* Prozesse; Lean Pathfinding *zergliedert neue* Anforderungen               |
| **Vertical Slice Architecture**    | Technische Manifestation von Lean Pathfinding: UI + Backend + DB pro Slice                       |
| **Work Breakdown Structure (WBS)** | Klassische WBS ist top-down, statisch; Lean Pathfinding kollaborativ, iterativ, value-fokussiert |
| **Agile / Scrum**                  | Scrum sagt "kurze Zyklen", Lean Pathfinding sagt "so zerlegen, dass Zyklen möglich sind"         |
| **Minimum Viable Product**         | MVP ist das Ziel; Discovery Tree zeigt alles, Lean Pathfinding findet die minimale Kombination   |

---

## Quellen & Weiterführend

- [TeamFluencer – Lean Pathfinding](https://teamflowencer.de/lean-pathfinding/)
- [TeamFluencer – Big Picture Method](https://teamflowencer.de/big-picture-method/)
- [Vertical Slice Architecture – Milan Jovanović](https://milanjovanovic.tech/blog/vertical-slice-architecture)
- [User Story Splitting – Visual Paradigm](https://www.visual-paradigm.com/scrum/user-story-splitting-vertical-slice-vs-horizontal-slice/)
- [Feature Slicing in SAFe](https://agileseekers.com/blog/feature-slicing-in-safe-techniques-that-work)
- [Lean Value Tree Workshop – Avanscoperta](https://www.avanscoperta.it/en/training/lean-value-tree-workshop/)

---

## Status

- **Geschrieben:** 2026-07-22
- **Phase 1 Features:** Entwurf
- **Phase 2+ Features:** Konzeptuell; priorisierung offenbar
