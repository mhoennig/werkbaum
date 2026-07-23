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

**Build-Hinweis (Vorschau / „latest build"):** Nicht-produktive Builds tragen
hinter dem Titel ein kleines Symbol samt Tooltip, damit klar ist, dass es nicht
die *eigentliche* (stabile) Instanz ist. Drei Zustände, gesteuert per Vite-Env
`VITE_BUILD_BADGE` (Auswertung in `app.js`, `mountBuildBadge`):

- **Dev-Server** (`import.meta.env.DEV`) → 🔧 „Vorschau – lokaler Entwicklungsstand".
- **Default-Build** `npm run build` (Env ungesetzt) → 🚧 „latest build …". Der
  GitHub-Pages-Deploy nutzt genau diesen Default und trägt den Hinweis dadurch
  automatisch — **keine** `sed`-Injektion mehr nötig.
- **Produktions-Build** `npm run build:prod` (Vite-Modus `prod`, `frontend/.env.prod`
  setzt `VITE_BUILD_BADGE=none`) → **kein** Badge; esbuild eliminiert den Zweig
  als toten Code, das Symbol steht dann nicht einmal mehr im Ausgabe-Quelltext.

Damit trägt einzig die echte produktive Installation keinen Hinweis. **Warum in
die App-Quelle statt per Workflow-`sed` (frühere Lösung):** Nur so sieht der
Dev-Server den Hinweis ebenfalls — ein Post-Build-`sed` erreicht den Dev-Server
nicht, der die Quelle direkt ausliefert. Die Umkehrung „Hinweis ist der
Normalfall, Prod schaltet ab" passt zudem zur Anforderung (nur Prod bleibt sauber)
und macht den Default sicher: wer den Prod-Schritt vergisst, veröffentlicht einen
sichtbar als Entwicklungsstand markierten Build, nicht versehentlich einen als
stabil wirkenden. Bewusst **kein** i18n-UI-Text im `I18N`-Objekt (kein
Produkt-Feature, sondern Build-Metainformation; D14) — der `title` ist knapp
zweisprachig (DE · EN).

**Self-hosted Deploy (`scripts/deploy-prod.sh`):** Für eine eigene produktive
Installation (nicht GitHub Pages) baut das Skript per `npm run build:prod`
(badge-frei), stellt lokal dasselbe zusammen wie der Pages-Workflow (LICENSE
danebenlegen + `../LICENSE`-Link geradeziehen, Footer-Version + Commit-Link) und
spiegelt es per `rsync --delete` über SSH ins Zielverzeichnis (nichts Altes bleibt
stehen). Die Zusammenstell-Schritte (dieselben drei `sed`-Regeln) liegen bewusst
in **beiden** — Workflow und Skript —, weil GitHub Pages die `dist/` selbst baut
und der SSH-Weg keinen Pages-Runner hat; bei Änderungen an den `sed`-Regeln beide
Stellen nachziehen (Anker `<a class="ver">` / `../LICENSE`).

(Nummerierung: D15 war bereits für den kompakten Modus vergeben, daher D16.)

## D17 — Kleiner Bildschirm: ein Bereich, kompakte Legende & Sprachwahl
Auf schmalen Viewports (≤ 640 px) ist für beide Bereiche kein Platz. Diagramm
und Editor werden gestapelt und über den **Splitter stufenlos** geteilt (frei
ziehbar, jederzeit erneut verstellbar); die beiden **Titelzeilen bleiben immer
stehen** (Grid-Zeilen-Minima = gemessene Kopfhöhen), ein **Tipp auf eine
Titelzeile klappt dieses Panel ganz aus**. Das frühere diskrete Modell (Snap in
Minimier-Zustände 'a'/'b') führte auf dem Smartphone zu zwei Fehlern: nach dem
ersten Ziehen rastete der Splitter in eine feste Aufteilung und war nicht mehr
zu bewegen (die Titelzeile im Snap-Rand fing jeden weiteren Zug ab), und der
Titelzeilen-Tap funktionierte nur im `collapsed`-Zustand — nach einem freien Zug
also gar nicht. Deshalb auf Mobil ein **kontinuierliches** Modell ohne Snap/
Collapse (`--drow` frei geklemmt, Tap setzt sie aufs Extrem); Desktop behält das
diskrete Modell samt Fenster-Buttons.
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
darüber. Kompakt führt all-of ohnehin nach unten (Knoten bleibt oben,
Abzweig bei 23 px passt).

**Vertikal** dagegen behält den zentrierten Rechts-Fächer: `li.has-and` legt
den Alternativknoten `align-items:center` **vertikal mittig** zu seiner
Kindergruppe. Dann sitzt aber auch der **einkommende** any-of-Abzweig nicht mehr
bei 23 px, sondern muss auf die **Knotenmitte (50 %)** zeigen — sonst ist der
Knoten von seiner Linie von oben abgetrennt. Fix: `ul.or>li.has-and` bekommt
vertikal **symmetrisches** Padding (Mitte bleibt bei 50 %), der Abzweig
(`::before`) und die Rail-Endkante (`:last-child::after`) werden auf 50 %
gesetzt — analog zu den bereits zentrierten all-of-Zwischenknoten.

## D19 — Modularisierung mit Vite-Bündelung zu einer self-contained Datei
Das Nahziel „tragfähige Codebasis" (ROADMAP) verlangt, den Single-HTML-
Prototyp in headless nutzbare Module (`parser`, `model`, `render`, `app`) zu
zerlegen und gegen SPEC zu testen. Die Zwickmühle: **modulare Einzeldateien**,
**`file://`-Tauglichkeit** (D16) und **kein Build** (D11) sind nicht gleichzeitig
erfüllbar — ES-`import` über `file://` blockt der Browser (CORS).

**Entscheidung: Vite als Bündler/Testrunner.** `frontend/src/*.js` sind echte
ES-Module und die Quelle der Wahrheit; `frontend/index.html` lädt im Dev-Server
per `<script type="module">`. `npm run build` (Vite + `vite-plugin-singlefile`)
inlint **alle** Module, das CSS und das Favicon (als `data:`-URI) in **eine**
`dist/index.html` — damit bleibt das `file://`-Versprechen aus D16 erhalten
(die gebaute Datei ist standalone), und der Deploy lädt nichts extern nach.

Damit wird **D11 („kein Build-Zwang") bewusst aufgeweicht**: Zum *Weiter­ent­
wickeln/Testen* braucht es nun Node + Vite (Dev-Abhängigkeiten, keine
Laufzeit-Abhängigkeiten — das Ergebnis ist reines HTML/CSS/JS ohne Framework).
Das *Ergebnis* bleibt im Geist von D11: eine einzelne, framework-freie Datei,
die überall ohne Server läuft. Verworfene Alternativen:
- **ES-Module ohne Build:** bräche `file://` (Dev-Server-Zwang lokal) — verwarf
  der Nutzer, weil das lokale Öffnen erhalten bleiben soll.
- **Klassische `<script>`+Globals:** hielte `file://` ohne Build, ist aber kein
  echtes ESM und erschwert headless-Tests/Tree-Shaking.

**Deploy (D16-Fortschreibung):** Der Pages-Workflow richtet Node ein, führt
`npm ci` + `npm test` (Vitest) + `npm run build` aus und nimmt
`frontend/dist/index.html`. Die frühere `sed`-Kur der `../docs/brand/`-Pfade
entfällt (Favicon inline); nur der Laufzeit-Link `../LICENSE` und die
Footer-Version werden weiter auf der Site-Kopie gesetzt. Schlägt der Testlauf
fehl, wird nicht deployt (der frühere auskommentierte Platzhalter ist nun
aktiv).

(Favicon-Inlining: ein kleiner `transformIndexHtml`-Plugin in `vite.config.js`
liest `../docs/brand/favicon.svg` und ersetzt den `<link rel="icon">` durch eine
`data:`-URI — so bleibt die Brand-Quelle unverändert und die Ausgabe eine
einzige Datei.)

## D20 — Schriften lokal einbetten statt von Google Fonts laden
Die Seite lud IBM Plex Sans/Mono über einen `<link>` von `fonts.googleapis.com`
(zzgl. Font-Dateien von `fonts.gstatic.com`). Das überträgt bei **jedem**
Seitenaufruf die **IP-Adresse des Besuchers an Google (USA)** — ohne
Einwilligung und ohne Notwendigkeit (vgl. LG München I, 3 O 17493/20). Das
widerspricht einer datensparsamen Datenschutzerklärung ohne Drittanbieter-
Einbindung und zugleich dem Selbstverständnis aus D19/SPEC §9 („keine externen
Ressourcen").

**Entscheidung: Schriften self-hosten.** Die tatsächlich genutzten Schnitte
(Sans 400/500/600, Mono 400/500) liegen als `woff2` unter
`frontend/src/fonts/`, eingebunden per `@font-face` in `style.css` mit
`font-display:swap`. Bezogen aus den OFL-lizenzierten `@fontsource`-Paketen
(nur per `npm pack` gezogen — **keine** neue Projekt-Abhängigkeit; die Dateien
sind eingecheckte Assets), Lizenztext in `fonts/OFL.txt`. Subsets **latin +
latin-ext** mit den `unicode-range`-Werten von fontsource decken DE/EN/ES/FR/PL;
nicht-lateinische UI-Sprachen (RU/HI/ZH/JA) fielen schon vorher auf `system-ui`
zurück (IBM Plex latin enthält diese Schriftsysteme nicht), also keine
Regression. Der Dev-Server liefert die `woff2` lokal aus; `vite build` inlint
sie als `data:font/woff2`-URIs in die eine `dist/index.html` (D19) — der
deployte Stand macht damit **keinen** externen Request mehr (verifiziert: 0
Treffer `googleapis`/`gstatic`, 10 inline-`woff2`). Kostet ~204 KB Fonts
(dist 89 → 320 KB, gzip ~208 KB) — bewusst in Kauf genommen für Datenschutz und
Standalone-Tauglichkeit (`file://`).

Verworfene Alternative: Google-Link ersatzlos streichen und nur die System-
Schrift (`system-ui`) nutzen — spart die 204 KB, gibt aber die einheitliche
Markentypografie (IBM Plex, BRAND) auf.

## D21 — UI-Default-Sprache aus der Browsersprache, Fallback Deutsch
Ohne gespeicherte Nutzerwahl (`werkbaum-lang`) richtet sich die Anzeige­sprache
nach der **Browsersprache**: die erste aus `navigator.languages`, für die eine
Übersetzung existiert (nur der Primär-Subtag zählt, `de-AT`→`de`,
`zh-Hans-CN`→`zh`); trifft keine zu, bleibt **Deutsch** der Fallback
(`detectLang()` in `app.js`). Zuvor war der Default fest `'de'`, unabhängig vom
Browser.

Begründung: Ein spanisch- oder englischsprachiger Erstbesucher sah bislang ohne
Not eine deutsche Oberfläche. Die Erkennung greift auch **nach dem Reset**
(löscht `werkbaum-lang`, lädt neu → selber Pfad). **Deutsch bleibt Quellsprache**
(CLAUDE: neue UI-Texte zuerst auf Deutsch) — das betrifft die Autoren-/Pflege­
seite und ist unabhängig vom Anzeige-Default für Besucher. Eine bewusste
Sprachwahl überschreibt die Erkennung dauerhaft (Persistenz in `werkbaum-lang`).

## D22 — Mehrere Dokumente client-seitig, Wähler in der Editor-Titelzeile
Der Editor kann mehrere Notationstexte halten, zwischen denen umgeschaltet wird
(z. B. verschiedene Projekte/Bäume). Umgesetzt **ohne Backend** (noch keins,
D13): die Dokumente liegen als `[{id, name, text}]` im localStorage
(`werkbaum-docs`), das aktive per `id` in `werkbaum-active`. Der aktive Text
wird zusätzlich in `werkbaum-src` gespiegelt (Abwärtskompatibilität + Migration).

**Platzierung: Dropdown in der Editor-Titelzeile.** Der Name des aktiven
Dokuments **ersetzt** die statische Beschriftung „Struktur (Text)" und ist
zugleich der Auslöser eines Dropdowns zum Wechseln, Anlegen (`＋ Neu`),
Umbenennen und Löschen. Begründung: Der Wähler bestimmt, *welchen Text* man
bearbeitet — er gehört auf das Textpanel, nicht ins Diagramm. Verworfen:
**Kopfzeile oben** (schon eng, besonders mobil) und **Tab-Leiste** (kostet eine
ganze Zeile Höhe, D17, und skaliert nicht über ~5 Dokumente). Ein Dropdown
skaliert und passt zum bereits etablierten Overlay-Idiom (Sprache/Download, D17).
Auf kleinem Bildschirm öffnet dasselbe Menü als absolut positioniertes Overlay
unter der Titelzeile.

**Vereinbarkeit mit D14 (Text ist das führende Format):** Jedes Dokument ist nur
ein Notationstext plus `name` (Metadatum) — **kein** erfundenes Strukturformat.
Damit ist das Modell vorwärtskompatibel zum geplanten Persistenz-/Taiga-Backend
(D13/D14: „Text als Ganzes + explizite Metadaten"): „mehrere Dokumente" bildet
1:1 auf „mehrere gespeicherte Notationstexte mit Name/id" ab; der localStorage-
Array ist der client-seitige Platzhalter, bis das Backend existiert.

**Migration & Reset:** Fehlt `werkbaum-docs`, wird der bestehende Einzeltext
(oder `INITIAL`) verlustfrei in **ein** Dokument gepackt (Name in der erkannten
UI-Sprache, `docDefaultName`). Der Reset löscht wie bisher alle `werkbaum-*`-
Schlüssel → beim nächsten Laden greift dieselbe Migration. Wird das letzte
Dokument gelöscht, entsteht wieder das Beispiel-Dokument (INITIAL). Die
GUI-Ansichts-Einstellungen (Modus, Zoom, Aufteilung; `werkbaum-ui`) bleiben
bewusst **global** über alle Dokumente — pro-Dokument-Ansichtszustand wäre eine
spätere Erweiterung.
