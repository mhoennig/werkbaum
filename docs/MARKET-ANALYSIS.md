# Marktanalyse

## Vergleichtabelle

| Feature                          |  **WB**  | **CM** | **FI** | **OP** | **TJ** | **PL** | **IS** |
|----------------------------------|:--------:|:------:|:------:|:------:|:------:|:------:|:------:|
| Hierarchische Struktur           |    ✓    |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |
| AND / OR / optional              |    ✓    |   ✓   |   ✓   |   –    |   –    |   –    |   ◐    |
| XOR / exactly-one                |   (✓)   |   ✓   |   ✓   |   –    |   –    |   –    |   ◐    |
| Cross-Dependencies / Constraints |   (✓)   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |   ✓   |
| Aufwand / Kosten                 |    ✓    |   ✓   |   ◐    |   ✓   |   ✓   |   ✓   |   ◐    |
| Fortschrittsstatus               |    ✓    |   –    |   –    |   ✓   |   ✓   |   ✓   |   –    |
| Kostenoptimierung                |    ✓    |   ✓   |   ◐    |   –    |   –    |   –    |   –    |
| **Lean Pathfinding**             |  **✓**  |   –    |   –    |   –    |   –    |   –    |   –    |
| **Lean Pathfinding + DC**        | **(✓)** |   –    |   –    |   –    |   –    |   –    |   –    |
| Diagramm in GUI editierbar       |    –     |   ◐    |   ✓   |   ✓   |   –    |   ✓   |   ✓   |
| Text → Diagramm                  |    ✓    |   ◐    |   ✓   |   –    |   ✓   |   –    |   –    |
| **Browser-App**                  |  **✓**  |   ✓   |   –    |   ✓   |   –    |   –    |   ✓   |

**Legende**

✓   : vorhanden
(✓) : für Werkbaum geplant
◐    : teilweise / über Erweiterungen
–    : nicht vorhanden

CM: ClaferMoo
FI: FeatureIDE
OP: OpenProject
TJ: TaskJuggler
PL: ProjectLibre
IS: piStar/iStar

DC: Dependecy Closure 

## Quellen zu den verglichenen Open-Source-Werkzeugen

### FeatureIDE

- [FeatureIDE – Official Website](https://featureide.github.io/)
    - Feature Modeling
    - grafischer und textueller Editor
    - Mandatory / Optional / OR / Alternative (XOR)
    - Cross-Tree Constraints
    - Folding und Layout großer Feature-Modelle

### ClaferMoo

- [ClaferMoo Standalone – GitHub](https://github.com/gsdlab/claferMooStandalone)
    - Multi-Objective Optimizer für attributed feature models
    - Kosten-/Qualitätsattribute
    - Optimierung mehrerer Ziele
    - MIT License

### TaskJuggler

- [TaskJuggler – Official Documentation](https://taskjuggler.org/documentation.html)
- [TaskJuggler Manual – Introduction](https://taskjuggler.org/tj3/manual/Intro.html)
- [TaskJuggler Tutorial](https://github.com/taskjuggler/TaskJuggler/blob/master/manual/Tutorial)
    - textbasierte Projektbeschreibung
    - hierarchische Tasks
    - Aufwand, Kosten und Fortschritt
    - klassische Task-Dependencies
    - Scheduling und Reporting

### OpenProject

- [OpenProject – Official Website](https://www.openproject.org/)
- [OpenProject – Gantt Charts](https://www.openproject.org/docs/user-guide/gantt-chart/)
- [OpenProject – Work Package Relations and Hierarchies](https://www.openproject.org/docs/user-guide/work-packages/work-package-relations-hierarchies/)
    - browserbasierte Open-Source-Projektplanung
    - Work-Package-Hierarchien
    - Fortschritt und Aufwand
    - Gantt-Diagramme
    - Dependencies zwischen Work Packages

### ProjectLibre Desktop

- [ProjectLibre Desktop – Official Website](https://projectlibre.com/projectlibre-desktop/)
- [ProjectLibre – SourceForge](https://sourceforge.net/projects/projectlibre/)
    - Open-Source-Desktop-Projektplanung
    - Work Breakdown Structure
    - Gantt Charts
    - Network Diagrams
    - Dependencies
    - Critical Path Analysis

### piStar / iStar

- [piStar – GitHub](https://github.com/jhcp/piStar)
- [piStar Requirements](https://github.com/jhcp/piStar/blob/master/docs/REQUIREMENTS.md)
    - Open-Source Goal Modeling
    - iStar 2.0
    - vollständig browserbasiert
    - grafischer Modell-Editor
    - Goals, Tasks und Dependencies
