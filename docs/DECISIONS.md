# Entscheidungen (ADR-Kurzform)

Festgehaltene Design-Entscheidungen samt Begründung. Bei Änderungen: Eintrag
ergänzen, nicht löschen.

## D1 — `|` für Oder-Zerlegung, `-` für Und-Zerlegung
`|` bedeutet in Regex und BNF-Grammatiken bereits „oder“ und ist damit
selbsterklärend. `-` ist das gewohnte Markdown-Listenzeichen für „normale“
Teilpakete. Das Gate steckt im Aufzählungszeichen der Kinder, nicht in einer
Annotation am Parent — lokal lesbar, trivial parsebar.

## D2 — Status als erweiterte Markdown-Task-Checkbox
GitHub-Markdown kennt `[ ]`/`[x]`; die Erweiterung auf `[?] [~] [/] [^] [-]`
wirkt sofort vertraut. Mnemonik: `?` vage, leeres Kästchen = todo, `~` gängige
In-progress-Konvention, `/` = halbes `x`, `x` = erledigt, `^` = „nach oben
deployed“, `-` = durchgestrichen.

## D3 — Begriff „Durchstich“ für den Zwischenstatus
Zustand zwischen „in Arbeit“ und „fertig“: durchgängig funktionsfähig und
vorführbar, Feinarbeiten offen. „Durchstich“ ist als Fachbegriff (Tunnelbau,
End-to-End-Slice in der Softwarearchitektur) etabliert. Verworfene
Alternativen: „Feinschliff“, „Richtfest“, „vorführbereit“, „Beta“.

## D4 — Begriff „verworfen“ statt „gestrichen“
Beschreibt die bewusste Entscheidung gegen eine Option — besonders passend
für Any-of-Alternativen. Default ausgeblendet, Toggle „verworfene einblenden“.

## D5 — Farb-Logik folgt dem Risiko, nicht dem Fortschritt
Rosé = Kosten investiert, Risiko hoch (in Arbeit). Pastellgelb = läuft,
Restrisiko klein (Durchstich). Flieder = geplant (Absicht, nichts investiert,
zwischen Grau der Idee und Rosé der Arbeit). Ergebnis-Skala:
grau → flieder → rosé → gelb → grün → blau.

## D6 — Größe in Klammern, URL nackt, Personen mit `@`
`(M)` liest sich wie ein Kleidungsetikett. URLs werden ohne Link-Syntax
erkannt (einfach einfügbar); die URL wird **vor** den `@`-Tags extrahiert,
damit `https://user@host/…` nicht kollidiert. `@` ist die universelle
Mention-Konvention (GitHub, Slack, Jira).

## D7 — `%%` als Kommentarzeichen
Mermaid-Konvention; hält den Weg zum Mermaid-Plugin frei. `//` scheidet wegen
URLs aus, `#` bleibt für Referenzen/Tags reserviert, `<!-- -->` ist zu sperrig.

## D8 — Untergliederungspflicht ab M sichtbar machen
Fehlende Zerlegung wird nicht nur gemeldet, sondern **gezeigt**: Geister-Knoten
„Untergliederung fehlt“ hängt genau dort, wo der Ast weitergehen müsste.
Verworfene Elemente sind ausgenommen. Werden alle Kinder eines M+-Elements
verworfen und ausgeblendet, erscheint der Platzhalter wieder (es braucht eine
neue Zerlegung) — gewollt.

## D9 — Transponierte Darstellung mit unterschiedlichen Austrittsseiten
Im vertikalen Modus tritt all of **rechts** aus dem Parent aus (LR-Baum),
any of **unten links**. Austrittsseite + Linienstil (durchgezogen/gestrichelt)
codieren das Gate doppelt; Beschriftungen werden nie rotiert.

## D10 — Abzweige zielen auf Knotenmitte, nicht Teilbaummitte
Feste Knoten-Zeilenhöhe macht die Anschlusshöhe deterministisch (23 px).
Behebt „ins Leere laufende“ Linien bei eingerückten Unterbäumen.

## D11 — Technologie: Vanilla HTML/CSS/JS, eine Datei als Prototyp
Keine Frameworks, kein Build-Zwang. Parser ~30 Zeilen, Renderer erzeugt
verschachtelte `ul.and`/`ul.or`; Linien via CSS-Pseudo-Elemente. Modularisierung
(Parser/Renderer/UI getrennt + Tests) ist der geplante nächste Schritt.

## D12 — Name „Werkbaum" und Marke aus der Notation
Name: „Werk" + „Baum" = wörtlich der WBS-Baum; funktioniert als npm-Paket,
CLI-Befehl und Mermaid-Schlüsselwort (`werkbaum`, kleingeschrieben in
Code-Kontexten). Verworfene Kandidaten: Astrein, undoder, Aufriss, Gabelung.
Marke: Miniatur des Diagramms (K2) in zwei Orientierungen analog zu den
Darstellungsmodi — Hochformat als Primärzeichen, transponiert als
Sekundärzeichen. Nur Tinte + Petrol; durchgezogen = und, gestrichelt = oder;
Pastelltöne bleiben Statusfarben. Details: brand/BRAND.md.

## D13 — Backend in Kotlin/Spring Boot, Monorepo-Struktur
Backend als Kotlin/Spring-Boot-Anwendung (Gradle Kotlin DSL, JDK 21),
entwickelt in IntelliJ IDEA Ultimate. Monorepo mit `frontend/` und `backend/`;
CLAUDE.md dreistufig: Wurzel für Querschnitt, je eine pro Teilprojekt
(wird von Claude Code pfadbezogen geladen). Kein Node- oder Python-Backend.

## D14 — Parser-Hoheit liegt beim Frontend, SPEC ist normativ
Der Notationstext ist das führende Datenformat. Das Backend parst die
Notation nicht; es speichert den Text als Ganzes und bedient Integrationen
über explizite Metadaten. Wird Backend-Parsen später doch erforderlich,
gilt: docs/SPEC.md ist normativ, beide Parser testen gegen dieselben
Fixtures (SPEC §10) — es darf keine zweite, abweichende Grammatik entstehen.

## D15 — Kompakter Modus + graue Any-of-Linien in allen Modi
Der vertikale Modus (D9) lässt „all of“ rechts austreten — formal sauber,
aber breit. Der zusätzliche Modus **kompakt** führt beide Gates nach unten
(minimale Breite) und unterscheidet sie nur noch über den Linienstil:
durchgezogen = und, gestrichelt = oder. Auswahl dreistufig
„horizontal/vertikal/kompakt“ statt Toggle, da es nun drei sich
ausschließende Darstellungen sind.

Zugleich wird das **Petrol im Diagramm ganz aufgegeben**: die any-of-Linien
(Sammelleiste *und* Abzweige) und auch der **Rahmen der Alternative-Knoten**
sind in **allen** Modi **gestrichelt bzw. gerahmt in Grau** (`#6B7A8C`). Die
frühere durchgezogene Petrol-Sammelleiste und der petrolfarbene Knotenrahmen
entfallen. Begründung: Das Gate ist bereits durch den Linienstil (gestrichelt)
und die Anordnung codiert; die zusätzliche Signalfarbe wirkte laut und ließ die
durchgezogene Hauptlinie optisch mit „all of“ konkurrieren. Grau tritt zurück,
die gestrichelte Führung bleibt eindeutig. D12/BRAND — „durchgezogen = und,
gestrichelt = oder“ — gilt für das **Markenzeichen** unverändert (Logo behält
Petrol); im **Diagramm** trägt allein der Linienstil die Gate-Codierung.

## D16 — Deployment über GitHub Pages via Actions-Workflow
Der Editor ist eine einzelne statische Datei (D11) — GitHub Pages genügt, kein
eigener Server nötig. Veröffentlicht wird über den offiziellen Actions-Weg
(`actions/upload-pages-artifact` + `actions/deploy-pages`, `permissions:
pages/​id-token`, `concurrency: pages`) statt über den `gh-pages`-Branch: kein
Zusatz­branch, OIDC statt Deploy-Key, Trigger bei Push auf `main` und manuell.
Der Test-Step (Vitest, Phase 1) ist als Platzhalter auskommentiert vorbereitet.

**Pfad-Entscheidung:** `frontend/index.html` referenziert Favicon und
MIT-Lizenz relativ mit `../` (`../docs/brand/favicon.svg`, `../LICENSE`) — von
der Wurzel-URL aus zeigten diese über die Site hinaus. Statt die Quelldatei zu
ändern (D14/CLAUDE: „Editor nicht refaktorieren“) zieht der Workflow die
`../`-Pfade **nur auf der Site-Kopie** gerade (`sed`) und legt die referenzierten
Dateien passend ab: `index.html` an die Wurzel, `docs/brand/` und `LICENSE`
daneben. So bleibt die Quelle unverändert (lokal weiter per `file://` und
Dev-Server nutzbar), und veröffentlicht wird nur das Nötige — `backend/` und die
übrigen `docs/` bleiben außen vor.

(Nummerierung: D15 war bereits für den kompakten Modus vergeben, daher D16.)
