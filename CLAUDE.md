# Werkbaum

Monorepo für Werkbaum: eine textuelle WBS-Notation mit Und/Oder-Zerlegung
(„all of" nebeneinander, „any of" untereinander) samt Editor und geplantem
Integrations-Backend.

## Struktur
- `frontend/` — Editor (Vanilla HTML/CSS/JS). Eigene Regeln: frontend/CLAUDE.md
- `backend/` — Kotlin/Spring-Boot-Anwendung (Taiga-Integration, Persistenz).
  Eigene Regeln: backend/CLAUDE.md
- `docs/` — Projektdokumente · `brand/` — Marke (brand/BRAND.md)
- `tools/remote` — alles, was auf dem Server passiert, als Ziel und Aktion
  (`remote backend deploy`, `remote frontend preview`, …; `remote --help`).
  Die Arbeit machen weiterhin die Skripte unter `scripts/` — `remote` ist die
  Vordertür davor. Braucht ein Skript einen neuen Schalter, kommt der **ins
  Skript**, nicht ins Werkzeug (D77-Nachtrag).

## Verbindliche Referenzen
- Sprachdefinition: @docs/SPEC.md — die Notation ist der gemeinsame Vertrag
  von Frontend und Backend. Syntaxänderungen: SPEC **zuerst**, dann Code,
  dann die Agenten-Fassung `frontend/public/llms.md` nachziehen
  (SPEC §13, D43).
- Entscheidungen: @docs/DECISIONS.md — respektieren; Abweichungen als neuen
  Eintrag begründen, alte Einträge nie löschen. Besonders D13 (Backend-Stack)
  und D14 (Parser-Hoheit) beachten.
- Ziele: docs/ROADMAP.md · Offene Arbeit: docs/TASKS.md (Checkboxen pflegen).
- Pull Requests: jeder PR bekommt ein Dokument unter `docs/prs/` — Konvention
  in docs/prs/README.md.
- Änderungen: @docs/CHANGELOG.md — **jedes Feature und jeder behobene Fehler
  bekommt dort eine Zeile**, englisch, ein Satz, unter der Überschrift des
  Tages (`## JJJJ-MM-TT`). Die Datei speist das Neuigkeiten-Popup im Editor
  (D58); ohne die Zeile geschieht die Änderung für den Benutzer unsichtbar.

## Querschnitts-Konventionen
- Doku auf Deutsch. Die Editor-UI ist mehrsprachig (DE/EN/ES/FR direkt,
  PL/RU/HI/ZH/JA hinter dem „…“-Aufklapper des Umschalters oben rechts);
  **Deutsch ist die Quellsprache** — neue UI-Texte zuerst auf Deutsch im
  `I18N`-Objekt (frontend/index.html) anlegen, dann in alle Sprachen
  übersetzen.
- Keine neuen Laufzeit-Abhängigkeiten ohne Rückfrage (gilt in beiden Teilen).
- **Eine neue Technologie ist eine Dimension schwerer als eine neue
  Abhängigkeit** — Node.js als *Laufzeit* (auf dem Server oder als eigenes
  Paket; bisher ist es nur Build-Werkzeug), eine weitere Sprache, ein
  weiteres Laufzeitsystem. Das wird dem Entwickler **deutlich gemacht** und
  seine **Zustimmung eingeholt**, als eigene benannte Entscheidung mit den
  Alternativen innerhalb der vorhandenen Technologien (JVM, Vanilla JS im
  Browser) — nie als Nebensatz eines Vorschlags (D93-Nachtrag).
- Der Notationstext ist das führende Datenformat; kein Teil erfindet ein
  eigenes Speicherformat für die Struktur.
- Im mitgelieferten Plan `docs/examples/werkbaum.werkbaum` bekommt **jeder**
  Knoten eine ID nach dem Muster `#bereich.task` (dritte Stufe nur, wo es
  sonst kryptisch würde) und einen Beschreibungsblock hinter dem
  `---`-Trenner, englisch, ein bis zwei Sätze — siehe D48. Neue Knoten also
  immer zu zweit anlegen: Zeile im Baum **und** Block unten.
- Im mitgelieferten Plan `docs/examples/werkbaum.werkbaum` bekommt eine
  fertige Funktion beim Mergen **`[x]`**, nicht `[^]`. Auf „in Produktion"
  befördert erst der Deploy der stabilen Instanz
  (`scripts/promote-shipped.sh`, von `deploy-prod.sh` aufgerufen) — nur er macht
  die Aussage wahr. Siehe D30; SPEC §4 trennt beide Zustände ohnehin.
