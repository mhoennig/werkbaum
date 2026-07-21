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

**Versionsnummer:** `Major.Minor` steht in der Datei `VERSION` und wird per
bewusstem **Bump-Commit** gepflegt; die **Micro-Stelle** leitet der Build aus
der Anzahl der Commits seit dem letzten VERSION-Bump ab
(`git rev-list --count <VERSION-Commit>..HEAD`) und ersetzt sie per `sed` nur
auf der Site-Kopie im Footer. Bewusst aus der Commit-Historie statt aus der
Run-Nummer (Vorentscheidung, verworfen): vollständig aus dem Repo
reproduzierbar, monoton, ohne zurückgeschriebenen Commit/Tag und ohne
selbstauslösenden Deploy-Zyklus. Die Micro-Stelle beginnt nach jedem Bump wieder
bei 0 (SemVer-artig). Nötig ist ein vollständiger Klon (`fetch-depth: 0`), sonst
zählt der flache CI-Klon nur einen Commit. `1.0` bleibt die Version beim lokalen
Öffnen (Platzhalter im Quelltext). Im Footer sind Name und Nummer **getrennte
Links**: „Werkbaum" → Repo-Startseite, die Versionsnummer (`<a class="ver">`) →
exakt der deployte Commit (`…/commit/<sha>`, im Build via `git rev-parse HEAD`).

(Nummerierung: D15 war bereits für den kompakten Modus vergeben, daher D16.)

## D17 — Kleiner Bildschirm: ein Bereich, kompakte Legende & Sprachwahl
Auf schmalen Viewports (≤ 640 px) ist für beide Bereiche kein Platz. Daher ist
immer nur **ein** Bereich groß (Diagramm oder Editor); der andere schrumpft auf
seine Titelzeile und dient als Umschalter (Antippen bringt ihn nach vorn); die
Fenster-Buttons entfallen, der **Splitter bleibt** (Teilen per Ziehen möglich).
Die Legende wird von der Bereichs-
Umschaltung **entkoppelt** und über einen eigenen Umschalter im Editor-Kopf
gesteuert — das dauerhafte „AGENDA“-Band kostet sonst zu viel Höhe. Die
Sprachleiste zeigt eingeklappt nur die **aktive** Sprache; ein Tipp klappt die
volle Leiste als **Overlay über die Kopfzeile** auf (rechtsbündig, `z-index`,
verdeckt die übrigen Elemente statt die Zeile umzubrechen), nach der Auswahl —
oder einem Tipp daneben — klappt sie wieder ein. So bleibt die Kopfzeile schmal
und die vollständige Sprachliste dennoch erreichbar (frühere Lösung
„EN + aktive + …“ ersetzt). Voreinstellung ist **Vollbild** (maximale Fläche). Umgesetzt über die Klasse `body.mobile` (per
`matchMedia`), damit CSS und JS denselben Schwellwert teilen; die Vollbild-
Voreinstellung greift nur, wenn noch **keine** gespeicherte Nutzerwahl vorliegt
(eine bewusste Abschaltung bleibt so erhalten, siehe localStorage-Persistenz).

## D18 — Günstigsten Pfad per Inversion zeigen, fehlende Größe = M
Der kostengünstigste Weg durch den Baum wird hervorgehoben (Umschalter im
Diagramm-Kopf, Default an, Zustand persistiert). Nötig sind bei **all of** alle
Kinder, bei **any of** nur die günstigste Alternative (kleinste rekursive
Kosten; Gleichstand ⇒ erste).

**Darstellung per Inversion, nicht per Betonung:** Getestet wurde zuerst ein
doppelt dicker Rand an den nötigen Knoten. Da der Baum aber fast überall all-of
ist, war damit *fast alles* dick umrandet — das Signal lag ohnehin nur in der
*Abwesenheit* des Rands bei den ausgeschlossenen Alternativen. Deshalb wird
invertiert: die **nicht benötigten** Knoten (nicht-gewählte any-of-Alternativen
samt Teilbaum) treten zurück (blass, entsättigt), der Pfad hebt sich von selbst
ab. Kein Zusatzrahmen, weil die Knoten-Ecken (Größe, Tags, ↗) schon dicht sind.

**Fehlende T-Shirt-Größe wird für die Kostenschätzung als `M` gewertet** — die
kleinste Größe mit Untergliederungspflicht (§5/D8), also die konservative
Annahme „mindestens M". Damit sind auch ungrößte Alternativen vergleichbar.
Wo `M` nur implizit angenommen ist, zeigt der Knoten ein **invertiertes**
Größen-Badge (weiß mit Petrol-Rand statt gefüllt) samt Tooltip, damit die
Annahme sichtbar und von einer echten `(M)`-Angabe unterscheidbar bleibt. Die
Größen-Semantik in SPEC §5 bleibt unberührt (die Wertung gilt nur der
Pfad-Kostenrechnung).

**Pfad-Linie + Stationspunkte (U-Bahn-Plan):** Zusätzlich zur Inversion fädelt
eine gestrichelte, geschwungene Petrol-Linie durch die **Endknoten** des Pfads.
Sie liegt **hinter** den Knoten (kräftig in den Lücken), mit einer **abgetönten
Kopie davor** (deutet den Verlauf beim Durchschreiten eines Knotens nur an —
Alternative zum harten „über allem"). Problem dabei: läuft die Linie durch
Fremd-/Zwischenknoten, ist nicht unterscheidbar, ob diese dazugehören
(besonders im kompakten Modus). Lösung: ein **blasser, großer Stationspunkt**
nur an den echten Blättern — durchquerte Knoten bleiben punktlos. Blass+groß
statt klein+satt, damit der Knotentext lesbar bleibt. Alles auch im
Grafikexport (hinten/vorne-Schichtung nachgezeichnet).

**Layout: all-of unter any-of (horizontal).** Zerlegt eine any-of-Alternative
selbst wieder all-of (z. B. „Web+Nativ" → Web + Android + iOS), würde der
breite horizontale Fächer den Alternativknoten zentrieren und samt Elternbaum
weit nach rechts schieben. Deshalb wird dieser Teilbaum **nur horizontal**
schmal **transponiert** gestapelt (Kinder untereinander, linker solider
Verteiler — wie im kompakten Modus), passend zur gestapelten any-of-Spalte
darüber. Vertikal/kompakt haben ihre eigene `ul.and`-Behandlung und bleiben
unberührt.
