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

**Umbenennen inline, nicht per `window.prompt`.** Das Umbenennen ersetzt den
Namen des aktiven Dokuments im Menü durch ein Textfeld (Enter bestätigt, Esc
bricht ab, Fokusverlust bestätigt). Grund: `window.prompt` ist in manchen
Browser-Kontexten unterdrückt/deaktiviert — dort „funktionierte Umbenennen
nicht". Das Inline-Feld hängt an keiner nativen Dialog-API und ist zudem die
rundere UX.

**Vereinbarkeit mit D14 (Text ist das führende Format):** Jedes Dokument ist nur
ein Notationstext plus `name` (Metadatum) — **kein** erfundenes Strukturformat.
Damit ist das Modell vorwärtskompatibel zum geplanten Persistenz-/Taiga-Backend
(D13/D14: „Text als Ganzes + explizite Metadaten"): „mehrere Dokumente" bildet
1:1 auf „mehrere gespeicherte Notationstexte mit Name/id" ab; der localStorage-
Array ist der client-seitige Platzhalter, bis das Backend existiert.

**Beispiel-Dokument mit reservierter id + festem englischem Namen.** Das
Beispiel trägt die reservierte id `example` und heißt fest **„Example"** —
**unabhängig von der UI-Sprache** (nicht lokalisiert), passend dazu, dass der
Beispieltext selbst nur noch englisch ist (breiteres Publikum). Die reservierte
id macht den Reset **zielgenau** (siehe unten). Alt-Zustände aus der ersten
Fassung (zufällige id, lokalisierter Name „Beispiel"/…) werden beim Laden
**adoptiert**: Ein noch **unverändertes** erstes Dokument (`text === INITIAL`)
bekommt nachträglich `id: example` und den Namen „Example"; echte, bereits
bearbeitete Inhalte werden nie adoptiert.

**Migration:** Fehlt `werkbaum-docs`, wird der bestehende Einzeltext (oder
`INITIAL`) verlustfrei in **ein** Beispiel-Dokument gepackt. Wird das letzte
Dokument gelöscht, entsteht wieder das Beispiel-Dokument (INITIAL).

**Reset ist auf das Beispiel begrenzt.** Der Reset (Debug-Knopf, nur außerhalb
des Prod-Builds) setzt **nur das Beispiel-Dokument** auf `INITIAL`/„Example"
zurück und verwirft die Ansichts-/Metadaten-Schlüssel (`werkbaum-ui`,
`werkbaum-lang`, Update-Flags) — **alle anderen Dokumente bleiben unangetastet**.
Zuvor löschte er pauschal **alle** `werkbaum-*`-Schlüssel und damit auch fremde
Dokumente; das war zu grob, sobald man mehrere Dokumente pflegt.

Die GUI-Ansichts-Einstellungen (Modus, Zoom, Aufteilung; `werkbaum-ui`) bleiben
bewusst **global** über alle Dokumente — pro-Dokument-Ansichtszustand wäre eine
spätere Erweiterung.

## D23 — Notationstext per `?sourceUrl=` von einer URL laden
Der Editor kann den Notationstext aus einer **externen Textdatei** beziehen:
`…/index.html?sourceUrl=https://example.org/plan.txt`. Damit lässt sich ein
Diagramm teilen/verlinken, ohne den Text in die URL zu packen, und die Quelle
kann anderswo (Git, Wiki, Server) gepflegt werden.

**Die URL ist der Titel.** Das geladene Dokument wird als eigenes Dokument im
Sinne von D22 geführt; sein **Name ist die URL**. Die **id leitet sich aus der
URL ab** (`url:<href>`), damit derselbe Link dieses eine Dokument *aktualisiert*,
statt bei jedem Aufruf ein neues anzulegen. Eigene Dokumente des Nutzers bleiben
unberührt. Da der Name in der Titelzeile mit Ellipse abgeschnitten wird, steht
die vollständige URL zusätzlich im Tooltip.

**Die URL ist die Quelle der Wahrheit:** Ist der Parameter gesetzt, wird bei
**jedem** Laden neu geholt und der Dokumenttext überschrieben. Lokale Änderungen
an einem URL-Dokument überleben ein Neuladen also nicht — bewusst, weil
`sourceUrl` eine *Ansicht auf eine entfernte Datei* ist, nicht deren Kopie. (Eine
konfliktbewusste Variante — lokale Änderungen erkennen und behalten — wäre eine
mögliche Erweiterung.)

**CORS ist die eigentliche Einschränkung.** Der Browser lädt fremde Hosts nur,
wenn die Zielseite `Access-Control-Allow-Origin` sendet. Das tun u. a.
`raw.githubusercontent.com` und GitLab-Raw-Links; ein beliebiger Webserver
oft **nicht**. Scheitert das Laden (CORS, 404, Netz), bleibt der bisherige Stand
stehen und es erscheint eine **Warnung** im Warnbereich (Typ `sourceLoad`,
zeilenlos ⇒ zuoberst), die CORS ausdrücklich als wahrscheinliche Ursache nennt.
Bewusst kein Proxy-Dienst als Ausweg: das würde fremde Inhalte über einen
Dritt-Host leiten und dem Datenschutz-Anspruch aus D20 widersprechen.

**Verhältnis zu D20 („keine externen Requests"):** Der Grundsatz bleibt — die App
lädt von sich aus **nichts** nach (Schriften inline, kein CDN). Der Request
entsteht **nur**, wenn der Nutzer selbst eine URL angibt, und geht **nur** an
genau diesen Host; `credentials:'omit'` verhindert das Mitsenden von Cookies.
Erlaubt sind nur `http:`/`https:` (relative Angaben werden gegen die Seite
aufgelöst); andere Schemata (`file:`, `data:`, `javascript:`) werden abgewiesen.
Fremder Text ist ungefährlich: Labels werden escaped, und der Parser erkennt als
Knoten-Link ohnehin nur `https?://…` (SPEC §1/§6) — kein `javascript:`-Vektor.

Nebenbefund: `checkForUpdates()` hängte den Cache-Buster als `location.href +
'?t=…'` an, was mit vorhandenem Query-String ein zweites `?` erzeugt hätte; es
baut die URL nun über `URL`/`searchParams`.

## D24 — Eigene Dateiendung `.werkbaum`
Notationstexte tragen die Endung **`.werkbaum`** (UTF-8, LF). Bislang lag das
einzige Beispiel als `.txt` — eine Endung, die nichts über den Inhalt sagt und
in einem Verzeichnis mit Notizen, Logs und Exporten untergeht.

**Begründung:** Die Endung macht Dateien maschinell und für Menschen
zuordenbar — Voraussetzung für spätere Editor-Zuordnung (Öffnen mit Werkbaum),
Syntax-Highlighting (VS Code/Vim-Modus, `*.werkbaum`) und ein künftiges
Öffnen/Speichern im Editor (dann als `accept`-Filter und Download-Endung).
Ausgeschrieben statt kurz, weil kurze Endungen belegt/mehrdeutig sind: `.wbs`
wird von diversen Projektplanungswerkzeugen und generisch für „Work Breakdown
Structure" benutzt, `.wb` ist ebenfalls mehrfach vergeben, `.tree` sagt nichts
über die Notation. Die Länge stört nicht: die Dateien werden selten getippt und
meist als URL geteilt.

**Kein registrierter MIME-Typ nötig.** Server liefern unbekannte Endungen als
`application/octet-stream` oder `text/plain` aus; für das Laden per
`?sourceUrl=` (D23) ist das gleichgültig, weil der Loader den `Content-Type`
**nicht** auswertet, sondern `response.text()` liest. Empfehlung für eigene
Server dennoch `text/plain; charset=utf-8`, damit die Datei im Browser lesbar
statt als Download erscheint. `raw.githubusercontent.com` liefert `.werkbaum`
als `text/plain; charset=utf-8` mit `Access-Control-Allow-Origin: *`.

**`.txt` bleibt zulässig** — die Endung ist Konvention, kein Vertrag. Der
Parser sieht ohnehin nur Text (SPEC §1), und `?sourceUrl=` lädt jede per
http(s) erreichbare Textdatei unabhängig von Endung und Content-Type. Es gibt
also keinen Bruch für bestehende Links.

**Beispieldateien liegen unter `docs/examples/`** (`example-plan-0…3.werkbaum`,
`example-werkbaum.werkbaum`) statt einzeln in `docs/`. Mehrere Beispiele, weil
sich das Umschalten zwischen Dokumenten (D22) erst mit mehreren *geladenen*
Dokumenten zeigen lässt: jeder `?sourceUrl=`-Link legt ein eigenes Dokument an
(id aus der URL, D23), nacheinander geöffnet stehen sie danach alle im Wähler.
`example-werkbaum.werkbaum` beschreibt Werkbaum selbst (Bestand + mögliche
Weiterentwicklung, destilliert aus ROADMAP/TASKS/DECISIONS) — zugleich
Beispiel und lebende Projektübersicht; bei größeren Änderungen mitpflegen.

## D25 — Sprung Diagramm ↔ Text per Alt+Klick, Gegenrichtung per Cursor-Zeile
Ein Knoten im Diagramm und „seine" Zeile im Texteditor sind nun verknüpft. Der
Parser hängte die Zeilennummer ohnehin schon an jeden Knoten (`{…, line}`,
bislang nur für Warnungen genutzt); der Renderer gibt sie als `data-line` aus.

**Alt+Klick statt einfachem Klick.** Ein Knoten mit URL ist als `<a>` gerendert
und belegt mit dem einfachen Klick bereits den ganzen Kasten (SPEC §6, D6).
Erwogen und verworfen:

- **↗ wird der Link, Knotenfläche springt** — klarste Regel, alles per
  einfachem Klick; ändert aber SPEC §6 und schrumpft die Link-Trefferfläche auf
  ein Symbol.
- **Klick springt, Strg-Klick öffnet** — behält die große Trefferfläche, macht
  das Öffnen aber zur unsichtbaren Geste und ändert §6 ebenfalls.
- **Gewählt: Alt+Klick springt** — das Verlinkungs-Verhalten bleibt exakt wie
  bisher, SPEC §6 unverändert. Preis ist die geringe Auffindbarkeit; dagegen
  steht der **Tooltip an jedem Knoten** („Alt+Klick: zur Zeile im Text",
  i18n-Key `jumpHint`, in allen 9 Sprachen), der bisher nur den Statusnamen
  zeigte.

Wichtig: Der Klick-Handler **muss `preventDefault()`** rufen — Alt+Klick auf
einen Link lädt sonst in Chrome/Firefox das Ziel herunter. Tastatur-Pendant ist
**Alt+Enter** am fokussierten Knoten (Enter allein bleibt dem Link). Auf Touch
gibt es kein Alt: dort **langer Druck** (500 ms), Wischen bricht ab; der
folgende Klick und das Kontextmenü werden unterdrückt (`-webkit-touch-callout`
aus), sonst öffnete ein Link-Knoten zusätzlich seine URL.

**Ganze Zeile markieren statt nur Cursor setzen.** Ein `<textarea>` kennt keine
Zeilen-Hervorhebung (kein Rich-Text-Markup); die native Auswahl ist die einzige
Betonung, die es gibt — und sie verschwindet beim ersten Tippen von selbst.

**Scrollen über einen Spiegel-`div`, nicht über Zeilenhöhe × n.** Lange Zeilen
brechen weich um und belegen mehrere Bildzeilen; die naive Rechnung lag im Test
bei 60 Zeilen um bis zu 525 px daneben. Gemessen wird deshalb an einem
unsichtbaren `div` mit gleicher Typografie und Breite plus Marker-Span
(`offsetTop`). Gescrollt wird nur, wenn die Zeile nicht ohnehin sichtbar ist.

**Gegenrichtung (Cursor-Zeile → Knoten)** ist bei großen Bäumen die nützlichere
Hälfte: `example-werkbaum.werkbaum` hat 75 sichtbare Knoten, ohne Markierung
verliert man beim Tippen die Orientierung. Der Knoten der Cursor-Zeile bekommt
die Klasse `current`; ins Bild gescrollt wird **nur beim Zeilenwechsel**, sonst
ruckelte das Diagramm bei jedem Tastendruck. Vor der ersten Cursor-Bewegung ist
`caretLine === null` — sonst wäre direkt nach dem Laden ungefragt die Wurzel
markiert.

**Darstellung: weißer Halo + Ring in Tinte** (`box-shadow`, kein Rahmen). Hebt
sich von allen Pastell-Status *und* vom dunklen Wurzelknoten ab, ist vom
petrolfarbenen Fokusring (`:focus-visible`) unterscheidbar und rührt die
Knoten-Ecken nicht an (die sind laut D18 schon dicht). Die Regel braucht den
`#out`-Präfix: `ul.or .node{box-shadow:none}` ist spezifischer als
`.node.current` und schluckte den Ring sonst überall unterhalb einer
any-of-Gruppe (im Test zuerst passiert). Rein visuelle Editierhilfe — im Druck
abgeschaltet; im Grafikexport erscheint sie ohnehin nicht, weil `diagramToSvg()`
nur Hintergrund, Rahmen, Farbe und Textdekoration ausliest, nie `box-shadow`.

**Auffindbarkeit (Nachtrag).** Eine Modifier-Geste, die niemand kennt, ist
keine Funktion. Gegenmaßnahmen, absteigend nach Wirkung:

- **Alt-Modus sichtbar machen:** Solange Alt gedrückt ist, trägt `#out` die
  Klasse `alt`; alle Knoten bekommen `cursor:alias` und der Knoten unter dem
  Zeiger einen Petrol-Ring. Das wirkt auch auf **verlinkten** Knoten, wo der
  einfache Klick dem Link gehört und es sonst gar keine Rückmeldung gäbe. Der
  Modus muss zusätzlich am `blur` des Fensters zurückgesetzt werden — bei
  Alt+Tab kommt kein `keyup` mehr an und er bliebe hängen.
- **Tooltip an jedem Knoten** (siehe oben, `jumpHint`).
- **Legende:** Die aufklappbare Legende endet mit einer abgesetzten
  Bedienungs-Zeile (`hint_jump`, `.hint-op` mit gestricheltem Trenner), damit
  sie ihre Rolle als *Notations*-Legende behält.

Erwogen und **verworfen: der einfache Klick springt** (auf Knoten ohne URL, wo
nichts kollidiert — das wären ~97 % der Knoten der Beispieldateien). Hätte die
Geste beiläufig auffindbar gemacht und auf Mobil den langen Druck erspart,
bedeutet aber, dass derselbe Klick je nach Knoten Verschiedenes tut. Ebenfalls
verworfen: ein **einmaliger Hinweis** nach dem ersten Sprung (localStorage-Flag)
— zusätzlicher i18n-Text in 9 Sprachen für einen Effekt, den Cursor und Legende
bereits abdecken.

**Touch: der Sprung passiert beim Loslassen, nicht nach 500 ms (Nachtrag).**
Erste Fassung führte den Sprung im 500-ms-Timer aus. Auf echten Touch-Geräten
flackerte die Markierung im Editor dann nur kurz auf und der Fokus fiel sofort
wieder heraus: **`focus()` aus einem Timer-Callback gilt in mobilen Browsern
nicht als Nutzergeste**, das Textfeld darf sich so nicht selbst fokussieren
(sonst könnte jede Seite ungefragt die Bildschirmtastatur aufziehen).
`touchend` **ist** eine Nutzergeste — dort bleibt der Fokus. Der Timer macht
seither nur noch die Rückmeldung („scharf": Petrol-Ring am Zielknoten, dieselbe
Sprache wie unter dem Alt-Zeiger), der eigentliche Sprung hängt am Loslassen.

Zweiter Beitrag zum selben Symptom: Die **native Textauswahl bzw. das
Link-Callout** des Browsers startet bei etwa derselben Druckdauer und riss die
Auswahl an sich. Dagegen drei Schichten, weil keine allein überall wirkt:
`preventDefault()` auf `contextmenu` während des Drucks (überall),
`user-select:none` an `.node` für grobe Zeiger (`@media (hover:none) and
(pointer:coarse)`) und `-webkit-touch-callout:none` (nur iOS/Safari; Chrome
kennt die Eigenschaft nicht mehr). Auf Touch lässt sich Knotentext damit nicht
mehr markieren — bewusst in Kauf genommen, die Geste ist dort vergeben.

Lehre für die Prüfung: Synthetische `TouchEvent`s beweisen nur die eigene
Ereignis-Logik. Weder die Nutzergesten-Regel noch die nativen Langdruck-Gesten
lassen sich so auslösen — beides fiel erst auf echter Hardware auf.

**Der Sprung holt keine Bildschirmtastatur (Nachtrag).** Auf Touch-Geräten
erschien nach dem Sprung sofort die virtuelle Tastatur und nahm den halben
Bildschirm — auch bei angeschlossener Bluetooth-Tastatur. Das ist kein Fehler
der App: Eine Webseite erfährt nichts über verbundene Tastaturen; sie fordert
nur **Fokus** an, alles Weitere entscheidet das Betriebssystem (Android hat
dafür den Schalter „Bildschirmtastatur anzeigen" unter *Physische Tastatur*,
auf vielen Geräten voreingestellt an; iPadOS unterdrückt sie von selbst).

Entscheidung: Der Sprung **fordert sie erst gar nicht an**. `jumpToLine()` setzt
vor dem Fokussieren `inputmode="none"` am Textfeld — das unterdrückt nur die
**virtuelle** Tastatur, Hardware-Tastaturen tippen unverändert. Die Sperre fällt,
sobald der Nutzer das Textfeld **selbst antippt** (`pointerdown`, läuft vor dem
Fokus). Damit ist der Sprung „hinschauen" und der erste Tipp ins Textfeld
„bearbeiten". `newDoc()` hebt die Sperre ausdrücklich auf — bei einem neuen,
leeren Dokument ist Tippen gemeint.

Verworfen: die Tastatur zuzulassen und auf die OS-Einstellung zu verweisen (löst
es nur auf einem Gerät), sowie ein eigener Umschalter dafür (weiteres
Bedienelement in einer engen Kopfzeile plus i18n in 9 Sprachen, für ein
Verhalten, das kaum jemand umstellen will).

## D26 — Legende scrollbar: eigener Container statt `<details>`, plus Splitter
Die Legende („Agenda") im Editor-Panel war zu hoch für ihren Platz und wurde
**abgeschnitten** statt scrollbar zu sein — obwohl `.hint` seit jeher
`flex:1 1 auto; min-height:0; overflow:auto` trug.

**Ursache:** Chrome legt den Inhalt eines `<details>` seit einiger Zeit in das
Pseudo-Element **`::details-content`**. Damit ist `.hint` **kein Flex-Kind** von
`.agenda` mehr; die Flex-Begrenzung greift nicht, `.hint` wächst auf seine
Inhaltshöhe (gemessen 585 px in einem 282 px hohen Container) und wird vom
`overflow:hidden` der Agenda geclippt. Ein Gegenmittel wäre
`.agenda::details-content{display:flex;…}` (im Test wirksam: 585 → 248 px,
scrollbar), aber das Pseudo-Element ist Chrome-eigen — Firefox und Safari kennen
es nicht, dort hinge dieselbe Layout-Kette an einem anderen anonymen Kasten.

**Entscheidung: kein `<details>` mehr.** Die Legende ist ein gewöhnliches
`<div class="agenda">` mit `<button class="agenda-summary">`; der Auf-/Zu-Zustand
hängt an der Klasse `open` (`aria-expanded` am Button). Damit ist `.hint` wieder
ein echtes Flex-Kind und die Begrenzung in **allen** Browsern dieselbe. Die
native Aufklapp-Mechanik war ohnehin nur halb genutzt — mobil steuert seit D17
der `#legendBtn` im Kopf, das `toggle`-Ereignis diente nur der Synchronisierung.

**Splitter Editor|Legende.** Die Aufteilung ist nun frei ziehbar, im selben
Idiom wie der große Splitter (`pointerdown`/`pointermove`/Pointer-Capture,
Doppelklick setzt zurück). Die Ausrichtung folgt derselben Fallunterscheidung
wie dort: horizontal nebeneinander → Legendenbreite `--hcol`, gestapelt (`side`
oder mobil) → Legendenhöhe `--hrow`. **Beide Werte werden getrennt gehalten und
persistiert** (`werkbaum-ui`), sodass ein Moduswechsel die jeweils andere
Aufteilung nicht zerstört; der Auf-/Zu-Zustand der Legende wird mitgesichert.
Grenzen: mindestens 90 px, höchstens 85 % — die Obergrenze steht **zusätzlich
als `max-width`/`max-height` im CSS**, weil die gespeicherte Größe ein fester
px-Wert ist: schrumpft das Panel später (Zug am großen Splitter, Drehung,
Bildschirmtastatur), würde der Editor sonst auf 0 gedrückt.

## D27 — „Werkbaum": der eigene Plan als mitgeliefertes Dokument
Neben dem Beispiel (D22) liegt ein zweites mitgeliefertes Dokument im Wähler:
**„Werkbaum"** — Werkbaum selbst, mit Werkbaum geplant (Bestand + mögliche
Weiterentwicklung). Damit ist der interessanteste Beispielbaum ohne Umweg über
einen `?sourceUrl=`-Link erreichbar; zugleich dient er als lebende
Projektübersicht.

**Eine Quelle, keine Kopie.** Der Text wird per `?raw`-Import aus
`docs/examples/example-werkbaum.werkbaum` gezogen — derselben Datei, die auch
der `?sourceUrl=`-Link lädt. Vite bettet sie beim Build in die eine Ausgabedatei
ein (D19), es wird nichts nachgeladen (D20). Eine zweite, abgetippte Fassung im
Quelltext würde unweigerlich auseinanderlaufen. (Nebenwirkung: die Beispieldatei
ist damit **Build-Eingabe** — Umbenennen bricht den Build. `vite.config.js`
erlaubt den Zugriff außerhalb des Roots bereits über `server.fs.allow: ['..']`,
eingeführt für das Favicon.)

**Genau einmal angelegt.** `seedShippedDocs()` fügt das Dokument auch
Bestandsnutzern hinzu, die schon eine Dokumentenliste haben, und merkt sich das
in `werkbaum-seeded`. Ohne diesen Merker gäbe es nur schlechte Alternativen:
entweder bekämen bestehende Nutzer es nie, oder ein bewusst gelöschtes Dokument
kehrte bei **jedem** Laden zurück. Das aktive Dokument bleibt beim Anlegen
unverändert — niemand wird aus seinem Text gerissen.

**Fester Name, nicht lokalisiert** — wie „Example" (D22): Dokumentnamen sind
Nutzerdaten. (Die erste Fassung hieß durch einen Tippfehler „Werkbank";
`loadDocs()` zieht den Namen nach — aber **nur**, solange er unverändert der
ausgelieferte ist, damit eine eigene Umbenennung stehen bleibt.) Der Reset (D22) setzt jetzt **beide** mitgelieferten Dokumente auf
ihren Auslieferungsstand zurück; eigene Dokumente bleiben weiterhin unangetastet.

**Nachziehen bei neuer Fassung (nachgereicht).** Zuerst wurde der Text nur
einmalig angelegt — eine spätere Ergänzung des Plans erreichte niemanden mehr.
Das fiel sofort auf, als der Plan um den Abschnitt „gemeinsam arbeiten"
(ROADMAP) wuchs. `werkbaum-seeded` hält deshalb nicht mehr '1', sondern den
**Fingerabdruck** (FNV-1a) der zuletzt ausgelieferten Fassung. Beim Laden gilt:

- kein Merker → Dokument einmalig anlegen (auch für Bestandsnutzer);
- Merker ≠ aktueller Fingerabdruck **und** der Text des Nutzers hat noch genau
  den gemerkten Fingerabdruck → Text nachziehen;
- Text **verändert** → nie anfassen (dieselbe Adoptions-Regel wie beim Beispiel
  in D22: nur Unverändertes wird adoptiert);
- Dokument gelöscht → bleibt gelöscht.

Der Altwert `'1'` aus der ersten Fassung sagt nichts über den Textstand; dort
wird bewusst nichts überschrieben, nur der Merker ersetzt. Wer aus dieser kurzen
Zwischenfassung kommt, holt den aktuellen Stand über den Reset.

## D28 — „Was ist neu?": neu in Produktion, gelber Strahlenkranz
Dokumente von außen (mitgeliefert, D27; per `?sourceUrl=`, D23) ändern sich,
ohne dass der Betrachter es merkt. Sie zeigen deshalb, was sich seit seinem
letzten Besuch getan hat.

**„Neu" heißt: neu in Produktion.** Nicht „Zeile hinzugefügt". Ein Zeilendiff
meldet vor allem Rauschen — jede neu notierte Idee, jede Umformulierung. Die
Nachricht, die einen Plan-Leser wirklich angeht, ist: *was ist tatsächlich
live gegangen*. Also gilt ein Knoten als neu, wenn er **jetzt `[^]`** trägt und
es in der zuletzt gesehenen Fassung **nicht** tat (weil er anders stand oder
noch fehlte). Das macht die Hervorhebung zugleich sparsam: In einem großen Plan
leuchten typischerweise eine Handvoll Knoten, nicht dreißig.

**Basis ist die zuletzt GESEHENE Fassung, nicht die letzte Auslieferung.**
`werkbaum-seen` hält je Dokument-id den Text, den der Betrachter zuletzt
bestätigt hat. Wer drei Fassungen übersprungen hat, sieht alles seither. Die
Basis wird **erst beim Bestätigen** fortgeschrieben — schriebe man sie beim
Laden fort, wäre die Meldung nach einem Neuladen verschwunden, bevor sie jemand
bemerkt hat. Beim **Erstkontakt** leuchtet nichts (sonst strahlte beim ersten
Ansehen der gesamte fertige Teil des Plans auf); es wird nur die Basis gesetzt.

**Knoten-Identität ist der Label-Pfad**, nicht die Zeilennummer: Umeinrücken und
Umsortieren erzeugen so keine Falschmeldungen. Gleichnamige Geschwister werden
über einen Index unterschieden; ein umbenanntes Label gilt als neuer Knoten —
gewollt, der Text ist der Vertrag (D14).

**Darstellung: gelber Strahlenkranz nach außen.** Bewusst **kein Blinken** (vom
Nutzer erwogen): WCAG 2.2.2 verlangt, dass blinkende Inhalte abschaltbar sind,
2.3.1 begrenzt Flackern wegen des Anfallsrisikos — und vor allem zöge Blinken
*dauerhaft* den Blick, statt einmal zu melden. Der Schein liegt **außen**, weil
die Knotenfüllung dem Status gehört (SPEC §4) und lesbar bleiben muss. Ein
Knoten, der zugleich die Cursor-Zeile ist (D25), bekommt beides: Tinte innen,
Gelb außen. Im **Druck und im Grafikexport erscheint der Kranz nicht** — er
hängt an *deinem* letzten Besuch, ein Export damit hieße für jeden Betrachter
etwas anderes.

Ein **Knopf im Diagramm-Kopf** erscheint nur, wenn es etwas gibt, nennt die
Anzahl und bestätigt per Klick („gesehen"). Kein Dauer-Umschalter: Die Meldung
soll verschwinden, wenn sie ihren Zweck erfüllt hat.

**Zurückhaltung bei bearbeitetem Text.** Hat der Nutzer das mitgelieferte
Dokument geändert, wird es nicht mehr nachgezogen (D27) — dann gibt es keine
saubere Vergleichsbasis, und es wird nichts hervorgehoben.

**Zwei Nachbesserungen nach dem ersten Blick auf die deployte Seite.** Gemeldet
war „nur die linke Hälfte gelb, kein Rahmen drum herum":

- **`z-index:2` am neuen Knoten.** Der Schein liegt *außerhalb* der Knotenbox.
  Ohne eigene Stapelordnung malt jedes **später kommende Geschwister** seinen
  undurchsichtigen Hintergrund darüber und schneidet den Kranz einseitig ab —
  übrig bleibt eine gelbe Kante, die wie ein halber Hintergrund aussieht statt
  wie ein Rahmen. Die Abstände (24–25 px) liegen nur knapp über der Reichweite
  des Scheins (Blur 16 + Spread 5 = 21 px); in engeren Layouts, bei Zoom oder
  längeren Labels reicht das nicht.
- **Die Pfad-Inversion darf „neu" nicht wegdimmen.**
  `.cheap-on .node:not(.cheap)` setzt `opacity:.32; filter:saturate(.4)` — das
  trifft auch den gelben Kranz und macht ihn praktisch unsichtbar. Gerade bei
  einer *nicht gewählten* Alternative ist „das ist jetzt live" aber die
  interessantere Nachricht. Deshalb `.cheap-on .node:not(.cheap).fresh
  {opacity:1;filter:none}`.

**Stolperfalle (beim Bauen hineingelaufen):** Die Menge der neuen Knoten muss aus
**denselben Knotenobjekten** gebildet werden, die gerade gerendert werden. Zuerst
wurde sie beim Laden aus einem eigenen Parse-Durchlauf berechnet — der Zähler
stimmte, aber kein einziger Knoten leuchtete, weil `Set.has()` auf
Objektidentität prüft und die gerenderten Knoten aus einem anderen Parse kamen.
`render()` bildet die Menge daher bei jedem Durchlauf neu; vorgehalten wird nur
der **geparste Basisbaum**.

## D29 — `+` für optionale Knoten: Zugaben sind weder Pflicht noch Alternative
Die Notation kannte bisher nur zwei Beziehungen zwischen Geschwistern:
erforderlich (`-`) und wählbar (`|`). Für ein einzelnes zusätzliches Feature,
das weder nötig ist noch eine Alternative zu etwas anderem, passte keine von
beiden. Man schrieb es als normales `-`-Kind — und log damit.

**Die Lücke hat einen Namen.** Feature-Modelle (FODA) unterscheiden seit den
90ern *mandatory*, *optional* und *alternative*. Werkbaum hatte die erste und
die dritte; `+` ergänzt die zweite. Mnemonik in der Reihe: `-` Teilpaket,
`+` Zugabe, `|` Alternative. Deckt sich mit MoSCoW (Must / Could / Auswahl).

**Der eigentliche Anlass ist der günstigste Pfad (D18), nicht die Optik.**
`markCheapest()` lief bei all-of über *alle* Kinder — jede Zugabe steckte damit
im errechneten Minimum. Das Ergebnis war systematisch zu groß, und zwar umso
mehr, je ehrlicher der Plan auch Kür notierte. `pathChildren()` filtert
optionale Knoten jetzt mit heraus; da beide Nutzer (`cheapestCost`,
`markCheapest`) über diese eine Funktion gehen, gilt das samt Teilbaum. Sichtbar
wird es beim Vergleich von Alternativen: eine Alternative mit teurer Zugabe
verlor vorher gegen eine schlichtere, obwohl die Zugabe gar nicht dazugehört.

**`+` gehört zum Knoten, nicht zur Gruppe** — anders als `-` und `|`. Der Parser
setzt deshalb `optional:true` und lässt `type:'and'` stehen. Zwei Dinge fallen
dadurch von selbst richtig aus: `gateOf()` bleibt unverändert, und die
`mixedGate`-Warnung schlägt weiterhin genau dann an, wenn `|` mit `-`/`+`
gemischt wird — `-` neben `+` ist erlaubt und still. Genau so soll es sein:
„diese drei sind nötig, das hier wäre schön" ist der Normalfall, nicht der
Fehlerfall. Die Regel dahinter: eine Gruppe ist entweder **konjunktiv**
(`-`/`+` frei gemischt) oder **disjunktiv** (`|`).

**Darstellung: hohler Kreis am Abzweig, kein dritter Linienstil.** Erwogen und
verworfen war eine **gepunktete** Abzweiglinie. Sie wäre pro Kind trivial zu
setzen gewesen (den Abzweig zeichnet ohnehin ein `li`-Pseudoelement), kollidiert
aber mit D15: Im **kompakten** Modus laufen beide Gates nach unten und werden
*allein* über den Linienstil unterschieden. Ein dritter Stil müsste sich dort
gegen „gestrichelt grau" behaupten — zu wenig Abstand für ein Merkmal, das man
auf einen Blick lesen können muss. Der Kreis dagegen ist **orthogonal** zum
Linienstil und lässt D15 unangetastet; er ist zudem die etablierte
FODA-Konvention (gefüllter Punkt = erforderlich, hohler = optional).

Er sitzt **mittig auf der Knotenkante**, wo der Abzweig auftrifft, und
unterbricht die Linie dort sichtbar. Grundfall im CSS ist die **gestapelte**
Anordnung (links auf halber Höhe) — sie deckt vertikal, kompakt und die
any-of-Gruppen ab; die **eine** Ausnahme ist der horizontale Fächer (oben
mittig), die **eine** Rück-Ausnahme davon der gestapelte all-of-Teilbaum unter
einer any-of-Gruppe (D18). Umgekehrt herum aufgezogen wären es vier Ausnahmen
statt zwei. `.node::before`/`::after` waren beide frei; die `li`-Pseudoelemente
sind von Abzweig und Sammelleiste belegt.

**Im Export** wird der Kreis **nach** den Knoten gezeichnet. Er liegt zur Hälfte
außerhalb der Knotenbox — in der Zeichenreihenfolge der Linien (Schritt 1)
hätte das Knoten-Rechteck ihn später halb überdeckt. Die Auftreffpunkte werden
beim Linienzeichnen gesammelt und in einem eigenen Schritt 3a ausgegeben.

**Bekannte Schwäche:** Bei aktivem Günstigster-Pfad-Umschalter (Default an) wird
der optionale Knoten ausgeblasst (`opacity:.32`) — und mit ihm sein Kreis, der
die Erklärung *dafür* wäre. Undoen lässt sich das nicht: `opacity` am Elternteil
schlägt auf jedes Kind durch, auch auf ein Pseudoelement. Bewusst in Kauf
genommen, weil das Zurücktreten hier die *Hauptaussage* ist (dieselbe Logik wie
bei nicht gewählten Alternativen) und Tooltip, `aria-label` und Legende die
Begründung nachliefern. Bei ausgeschaltetem Umschalter steht der Kreis in voller
Stärke.

**Verworfene Alternativen:**
- **Den Status `[?]` (Idee) dafür nehmen** — falsche Achse. Status ist
  Fortschritt, `+` ist Notwendigkeit; eine Zugabe kann längst `[^]` sein (genau
  der Fall, der die Frage ausgelöst hat). SPEC §3 hält beide Achsen getrennt.
- **`@optional` als Personen-Tag** — missbraucht §7 für etwas Strukturelles.
- **`#optional` als Schlagwort** (§11 reserviert) — hätte keine Syntaxänderung
  gekostet, bringt aber weder Darstellung noch die Korrektur am Kostenmodell,
  also gerade das nicht, wofür sich der Aufwand lohnt.
- **`*` statt `+`** — in Regex „null oder mehr" und damit nah an der Begründung
  von D1. Verworfen, weil `*` in Markdown zugleich Betonung auszeichnet und
  eher wie eine Fußnote gelesen wird; `+` liest sich als „Zugabe".

**Verhaltensänderung:** Ein `+` am Zeilenanfang ist jetzt ein Zeichen und
gehört nicht mehr zum Label (`+ 5 % Puffer` ergibt das Label „5 % Puffer").
Test-abgedeckt, damit es niemanden unbemerkt trifft.

**Nachtrag 1 — der Abzweig wird doch gestrichelt.** Der hohle Kreis allein war
zu leise; „ein gestrichelter Ast wäre deutlicher" (Nutzer). Der oben notierte
Einwand gegen einen dritten Linienstil bleibt richtig, greift hier aber nicht
so weit wie gedacht: Gestrichelt wird **nur der Abzweig zum Knoten**, nicht die
Sammelleiste, und zwar in **Tinte** — die any-of-Linien sind gestrichelt in
**Grau**. Entscheidend ist, dass beide sich in einer Gruppe nie begegnen können:
`|` darf nach §3 nicht mit `-`/`+` gemischt werden, ein gestrichelt-grauer und
ein gestrichelt-blauer Ast hängen also nie am selben Verteiler. Der Kreis bleibt
zusätzlich — er sagt, **welcher** Knoten gemeint ist, und trägt die Kennzeichnung
auch dort, wo der Strich im Gedränge untergeht.

Umgesetzt an den vorhandenen Pseudoelementen, ohne neue Zeichenebene: Im Fächer
ist der Abzweig der senkrechte Stiel (`border-left` von `::after`, beim letzten
Kind `border-right` von `::before`), in den gestapelten Anordnungen der
waagerechte Ast (`border-top` von `::before`) — die jeweils andere Kante ist die
Leiste und bleibt durchgezogen. Dafür braucht auch das **`<li>`** die Klasse
`opt` (den Abzweig zeichnet es, nicht der Knoten).

**Nachtrag 2 — Stiel trifft die Knotenmitte auch waagerecht (`--stem-x`).**
Beim Prüfen fiel ein älterer Fehler auf: Im horizontalen Fächer lief der Stiel
zu einem Knoten mit any-of-Kindern **neben dem Knoten vorbei** (gemessen 13,4 px).
Ursache ist dieselbe Verwechslung, die D10 schon senkrecht behoben hat, nur in
der anderen Achse: Der Stiel saß bei 50 % der **Zelle**, und das ist nur dann
die Knotenmitte, wenn der Knoten in der Zelle zentriert steht. `li.has-or` ist
aber `align-items:flex-start` — der Knoten steht links, damit die
any-of-Sammelleiste unter ihm aufsetzt —, und die Zelle ist so breit wie der
Teilbaum.

Rein in CSS ist das nicht lösbar: Die nötige Größe ist die **Knotenbreite**, und
kein Selektor kann sie einer Elternregel zugänglich machen (Anchor Positioning
ist Chrome-only). Deshalb misst `alignStems()` nach jedem Rendern die Knotenmitte
der betroffenen Zellen und setzt sie als `--stem-x`; die Pseudoelemente rechnen
über `left:var(--stem-x, 50%)` / `right:calc(100% - var(--stem-x, 50%))`. Der
Rückfallwert 50 % hält alle übrigen Zellen ohne Messung richtig, und die
transponierten Modi setzen `left`/`right` ohnehin fest und bleiben unberührt.
Gemessen wird — wie in `drawCheapPath()` — durch `zoom` zurückgerechnet, sodass
der Wert beim Zoomen gültig bleibt.

**Nachtrag 3 — Treppe für mehrere optionale Endknoten.** Im horizontalen Fächer
kostet jedes optionale Geschwister eine eigene Spalte — Breite für gerade das,
was am entbehrlichsten ist. Aufeinanderfolgende optionale Endknoten werden
deshalb als **Kaskade** gestapelt (Nutzerwunsch: „mehrere optionale Knoten in
einer diagonalen Linie an eine Anschlussstelle").

Verworfen wurde die naheliegendere **senkrechte Spalte** unter einem
Anschlusspunkt: Sie wäre schmaler und in einem Bruchteil der Zeit gebaut, sähe
aber fast genau aus wie eine **any-of-Gruppe** (gestapelte Spalte an
gestrichelter Leiste), unterschieden nur durch Tinte statt Grau. Genau diese
Verwechslung zu vermeiden ist der Zweck von Kreis und Farbgebung. Die Treppe
kauft Eindeutigkeit für etwas Breite — schon die Form ist eine andere.

Ebenfalls verworfen: eine **echte** Diagonale. Rahmenkanten sind achsenparallel;
sie bräuchte die SVG-Ebene (die es für den Pfad-Spline gibt) und wäre damit eine
**zweite Zeichenebene** neben allen anderen Linien, nachzuführen bei jedem
Rendern, Moduswechsel und Zoom. Der gestufte Anschluss aus rechten Winkeln gibt
denselben Kaskaden-Eindruck im vorhandenen Mechanismus.

**Nur Endknoten.** Der Platzgewinn entsteht gerade daraus, dass kein Teilbaum
mitgestapelt werden muss — ein optionaler Knoten *mit* Kindern spart in der
Treppe nichts und behält seine Spalte. Technisch kommt dasselbe heraus: Die
Stufengeometrie rechnet mit einem festen Abstand von Knotenunterkante zur
nächsten Stufe und setzt deshalb voraus, dass die Zelle so hoch ist wie ihr
Knoten (kein Teilbaum, kein Geister-Knoten). Geprüft wird genau das: das `<li>`
hat exakt ein Element-Kind, und das ist der Knoten.

**Gruppiert wird in app.js, nicht im Renderer.** Die Gruppierung
(`li.opt-group > ul.opt-stair`, Stufennummer als `--i`) ist reine Darstellung.
Im Renderer hätte sie eine DOM-Ebene erzeugt, die es semantisch nicht gibt —
und die in den **drei übrigen Anordnungen** (vertikal, kompakt, all-of unter
any-of) wieder hätte neutralisiert werden müssen, jede mit hand-getunter
Geometrie. `display:contents` löst das nicht: Es richtet die Boxen, aber die
`>`-Selektoren jener Regeln greifen weiter auf dem DOM und passen dann nicht
mehr. `applyOptStairs()` baut die Gruppe deshalb nur im Fächer und löst sie beim
Moduswechsel wieder auf — dieselbe Kategorie wie `alignStems()` und
`drawCheapPath()`, und SPEC §9 („der Modus ändert nur die Anordnung") bleibt für
den **Renderer** wörtlich wahr. Lese- und Fokusreihenfolge bleiben unberührt,
weil nur umgehängt und nichts umsortiert wird.

**Der Export folgt der Kaskade.** Erste Fassung reihte alle Stufen flach als
Kinder ein und ließ den Export selbst routen (er zieht Linien ohnehin unabhängig
vom Darstellungsmodus neu). Ergebnis: Die Linie zur dritten Stufe lief **hinter
der zweiten hindurch** und las sich wie eine Eltern-Kind-Beziehung — keine
Schönheitsfrage, sondern eine falsche Aussage über die Struktur. Jetzt hängt nur
die **erste** Stufe an der Sammelleiste, die übrigen bekommen denselben Winkel
wie am Bildschirm.

**Nicht durch Tests gedeckt:** `applyOptStairs()` arbeitet auf dem DOM, und für
`app.js` gibt es keine Testumgebung (die Vitest-Suite prüft die headless-Module).
Geprüft wurde im Browser — auch der Moduswechsel hin und zurück, mehrfach: Die
Gruppe entsteht und löst sich rückstandsfrei auf, Knotenzahl und Dokumentordnung
bleiben in allen drei Modi gleich.

## D30 — `[x]` → `[^]` per Beförderungs-Commit vor dem Deploy
Der mitgelieferte Werkbaum-Plan (D27) behauptete `[^]` („in Produktion") für
Funktionen, die nur auf der automatisch deployten Pages-Instanz lagen, nicht auf
der stabilen Installation `werkbaum.javagil.de` (manueller Deploy, D16). Damit
war ausgerechnet das Dokument ungenau, das den Stand beschreiben soll — und die
„Was ist neu?"-Anzeige (D28) meldete Dinge als live, die es dort nicht waren.

**Die Unterscheidung gibt es längst.** SPEC §4 trennt `[x]` fertig
(abgeschlossen) von `[^]` in Produktion (deployed/live). Der Plan hat diese
Trennung ausgerechnet für sich selbst nie benutzt und sprang direkt auf `[^]`.
Die Konvention lautet daher ab jetzt: **beim Mergen `[x]`**, und der Deploy
befördert. Nur der Deploy weiß, wann die Aussage wahr wird.

**Umgesetzt als Commit, nicht als Rewrite beim Bauen.** `scripts/promote-shipped.sh`
schreibt die Statusboxen am Zeilenanfang von `[x]` auf `[^]` und hält das in
einem eigenen Commit fest; `scripts/deploy-prod.sh` ruft es als Schritt 0 auf
(abschaltbar mit `--no-promote`). Gründe:

- Ein Rewrite beim Bauen macht **genau eine** Installation ehrlich. Pages
  untertriebe dauerhaft, und die Neu-Anzeige wäre dort **für immer stumm** —
  das Feature ließe sich nur noch künstlich prüfen. Der Commit dagegen wird von
  **beiden** Pipelines gesehen: Pages baut ihn beim Push, prod beim nächsten
  rsync.
- Das Deployment-Artefakt bleibt **inhaltsgleich mit dem Repo**. Die
  vorhandenen `sed`-Regeln (D16) fassen nur Pfade und die Versionsnummer an —
  Infrastruktur. Ein Status-Rewrite wäre der erste Schritt, der ändert, was das
  Dokument *aussagt*; die per `?sourceUrl=` geladene Rohdatei wäre dann eine
  dritte, wieder abweichende Fassung.
- Es folgt dem Präzedenzfall aus D16: Die Version wird per **bewusstem
  Bump-Commit** gepflegt, „vollständig aus dem Repo reproduzierbar". Ein Deploy
  ist ein bewusster Akt; ihn in der Historie festzuhalten passt dazu — und der
  Plan bekommt nebenbei eine Chronik, wann was live ging.

**Verworfen:** Rewrite nur im Prod-Deploy (siehe oben) und Rewrite in **beiden**
Pipelines. Letzteres wäre testbar, aber `[^]` hieße auf Pages faktisch nur
„gemerged", und das kollidiert damit, dass D16 die Pages-Instanz bewusst als
nicht-produktiven Build markiert (🚧-Badge).

**Bekannter Preis:** Zwischen Beförderungs-Commit und rsync sagt Pages `[^]` für
etwas, das auf prod noch nicht liegt. Das Fenster ist kurz und liegt in der Hand
dessen, der deployt — gegenüber einer *dauerhaften* Ungenauigkeit bei der
Build-Rewrite-Variante der bessere Tausch.

**Einmalige Nachholung.** Welche Knoten zu früh `[^]` trugen, ließ sich exakt
bestimmen statt zu schätzen: Der Footer der stabilen Instanz verlinkt den
deployten Commit (`4061362`), und alles danach ist dort nicht enthalten. Es
waren **genau zwei** Knoten — „Optional nodes" (D29) und „Show what is new since
your last visit" (D28) —, nicht das Dutzend, das vorher grob geschätzt worden
war. Beide stehen jetzt auf `[x]` und leuchten beim nächsten Prod-Deploy als neu
auf, was genau der Wahrheit entspricht.

**Umfang: genau eine Datei, bewusst kein Muster.** Befördert wird nur
`docs/examples/example-werkbaum.werkbaum` — allein der Werkbaum-eigene Plan sagt
etwas über das Deployment aus. `[x]` steht im Repo an mehreren Stellen, wo eine
Beförderung falsch bis unsinnig wäre:

- Die **Legende („Agenda")** zeigt `[x] fertig` als *Anschauungsmaterial* für die
  Notation (`frontend/index.html`, `chip('fertig','[x]')` in `app.js`). Daraus
  würde `[^] fertig` — Unsinn, den beim Durchsehen eines Diffs niemand bemerkt.
- Das mitgelieferte **„Example"-Dokument** (`INITIAL` in `app.js`) und die
  übrigen `docs/examples/*.werkbaum` sind erfunden.
- **SPEC §10** (kanonisches Beispiel, zugleich Test-Fixture) und die Checkboxen
  in `docs/TASKS.md`.

Weil eine spätere „Verallgemeinerung" auf ein Glob naheliegt und der Schaden
still wäre, bleibt es nicht bei der Zusage: Der Lauf vergleicht `git status` vor
und nach dem Schreiben und **bricht ab**, sobald mehr als die Plandatei neu
geändert ist — die Datei wird zurückgesetzt, nichts wird committet. Geprüft mit
einem absichtlich ausgeweiteten `sed` in einem Wegwerf-Worktree.

**Nicht gepusht.** Das Skript committet, pusht aber nicht — Veröffentlichen
bleibt eine bewusste Handlung. `deploy-prod.sh` warnt stattdessen, wenn HEAD
noch nicht auf `origin` liegt: der Footer-Versionslink zeigt sonst auf einen
Commit, den GitHub nicht kennt.

## D31 — Echtzeit-Zusammenarbeit über ein Etherpad, eigener Parameter `?etherpad=`
Werkbaum hat kein Backend (D13 ist Plan, nicht Bestand), und der Plan setzt
Zusammenarbeit als `[?] Live editing, several people at once (XL)` an — mit
`[!] Merging simultaneous edits (L)` als der eigentlichen Arbeit. Genau diese
Arbeit ist in Etherpad seit Jahren getan. Also wird sie geliehen statt
nachgebaut: **Das Pad ist die Schreibfläche, Werkbaum die Ansicht.**

**Das Fundament war schon da.** Etherpad liefert pro Pad einen Klartext-Export
(`/p/<pad>/export/txt`), und `?sourceUrl=` (D23) lädt jede Textdatei über
http(s), ohne Endung oder `Content-Type` zu prüfen (D24). Nachgemessen an
`pad.hostsharing.net`:

- `Access-Control-Allow-Origin: *` und `Content-Type: text/plain; charset=utf-8`
  — die eigentliche Hürde aus D23 (CORS) fällt also weg;
- das kanonische Beispiel aus SPEC §10 kommt **byte-identisch** zurück
  (führende Leerzeichen, `-`/`+`/`|`, Statusboxen, `%%`, UTF-8);
- der HTML-Export zeigt **kein** Listen-Markup: Etherpad speichert die
  Einrückung als echte Leerzeichen und deutet das `-` nicht zur Aufzählung um.
  Das war das Risiko, das die Idee hätte erledigen können.

Das war zunächst nur Import → Speicher → Export, also **nicht** das Tippen — und
genau das war der offene Punkt (Tab-Einrückung, mögliches Auto-Bullet), im Geist
der Lehre aus D25: synthetische Ereignisse beweisen nur die eigene Logik.
**Nachgeholt an echter Eingabe:** Der Nutzer hat im Pad `    - [ ] Layout`
eingerückt eingetippt und eine Kommentarzeile geändert; der Export gibt beides
zeichengenau zurück (`>     - [ ] Layout$` — vier echte Leerzeichen, kein Tab,
kein Listen-Markup). Der Etherpad-Editor fasst die Notation beim Tippen also
nicht an.

**Eigener Parameter statt `?sourceUrl=`.** Drei Gründe, der erste ist der
schwächste:

1. Die URL, die ein Mensch in der Hand hat, ist die **Pad**-URL — die aus der
   Adresszeile. `/export/txt` ist eine Implementierungseinzelheit und gehört
   nicht in die Schnittstelle; Werkbaum hängt sie selbst an.
2. Der Parameter **lizenziert anderes Verhalten**. `sourceUrl` heißt „statische
   Datei, einmal pro Laden geholt" — das ist D23 wörtlich und bleibt
   unangetastet. `etherpad` heißt „lebendes Pad", und daran hängen der
   Schreibschutz, der „im Pad bearbeiten"-Knopf und der Neu-laden-Knopf. Ohne
   die Trennung müsste D23 seine Semantik ändern und bestehende Links bekämen
   Verhalten, um das niemand gebeten hat.
3. Die **Pad**-URL ist mehr wert als die Export-URL: nur mit ihr sind der
   „im Pad bearbeiten"-Knopf und ein späteres Einbetten (siehe unten) ohne
   weiteren Parameter erreichbar, und Identität/Name des Dokuments werden aus
   ihr gebildet — derselbe Pad ergibt so genau **ein** Dokument, auch wenn
   jemand versehentlich die Export-URL einträgt (sie wird normalisiert).

**Der Dokumentname ist die vollständige Pad-URL**, nicht der bloße Pad-Name.
Kurz wäre schöner (`mein-plan` statt 45 Zeichen in einer schmalen Titelzeile),
aber Pad-Namen sind nur **pro Instanz** eindeutig, nicht global: zwei Hosts mit
je einem Pad `plan` ergäben zwei gleichnamige Dokumente im Wähler, ohne
Möglichkeit sie zu unterscheiden. Damit gilt dieselbe Regel wie in D23 — und der
Ellipsen-Schnitt in der Titelzeile samt vollständiger URL im Tooltip ist dafür
schon eingerichtet.

Der Name `?etherpad=` statt des neutraleren `?pad=`: Das Anhängen von
`/export/txt` **ist** produktspezifisch. Das ehrlich zu benennen ist besser, als
Allgemeinheit vorzutäuschen, die beim nächsten Werkzeug (HedgeDoc, CryptPad —
andere Export-Pfade) doch einen Typ-Diskriminator bräuchte.

**Das Textfeld ist schreibgeschützt.** Ohne das verschwände getippter Text beim
nächsten Abruf — Datenverlust, und zwar überraschend, weil nichts darauf
hindeutet. Der Schutz ist zugleich die ehrliche Aussage: Werkbaum kann
gleichzeitige Änderungen nicht zusammenführen, das Pad kann es. Deshalb
erscheint in der Editor-Titelzeile ein Knopf, der das Pad im neuen Tab öffnet
(nur bei solchen Dokumenten sichtbar).

**Geholt wird auf Knopfdruck, nicht selbsttätig — Etherpad drosselt.** Die erste
Fassung holte alle 2,5 s im Hintergrund, mit einem Stabilitätstakt (erst
übernehmen, wenn zwei Abrufe denselben Text liefern) gegen das Mitlesen halb
getippter Zeilen. In der Praxis kam damit fast nichts an: im Netzwerk-Mitschnitt
stapelten sich Anfragen und wurden abgebrochen („cancelled").

Die Ursache ist nicht Langsamkeit, sondern ein **Rate Limit**:
`importExportRateLimiting` ist in Etherpad serienmäßig an und lässt **10 Abrufe
je 90 s und IP** zu — der Takt wollte 36. Danach antwortet die Gegenseite nicht
mit `429`, sondern **hält die Verbindung offen** (keine Kopfzeilen, keine
Antwort), bis der eigene Abbruch sie abreißt. Nachgemessen:

```
12:48:12  Abbruch nach 25 s (0 Bytes)
          Abbruch nach 25 s (0 Bytes)
12:50:23  HTTP 200 nach 0,436 s   <- nach ~40 s Pause
```

Zwei Minuten totgestellt, dann sofort in 0,4 s da. Gegen eine Drosselung kann ein
Takt nicht gewinnen — er *erzeugt* sie. Also: **ein Knopf**. Damit entfallen
Stabilitätstakt, Sichtbarkeits-Wächter, Anti-Stapel-Riegel und Wiederanlauf; was
bleibt, ist ein Abruf, wenn jemand ihn will. Das ist auch die ehrlichere Haltung
gegenüber fremder Infrastruktur, und es greift gut mit „Was ist neu?" (D28)
zusammen: drücken, und was seither in Produktion ging, leuchtet auf.

Zwei Dinge, die der Knopf braucht und ein stiller Takt nicht:

- **Rückmeldung während des Abrufs** (das Symbol dreht). Bei gedrosselter
  Gegenseite sind das bis zu 20 s; ohne Zeichen wirkt der Knopf kaputt.
- **Eine Antwort im Fehlerfall.** Ein Hintergrund-Takt durfte stumm scheitern,
  eine bewusste Handlung nicht. Der Abbruch bekommt dafür einen **eigenen**
  Warnungstyp `sourceTimeout`: Die `sourceLoad`-Meldung zeigt auf CORS und
  schickte hier auf die falsche Fährte — richtig ist „warte einen Moment".

**Der erste Abruf darf scheitern, ohne alles zu verlieren.** In der ersten Fassung
standen `padSource` und der Takt *hinter* dem `await` des ersten Abrufs: Ein
einziger Fehlschlag — bei dieser Gegenseite der Normalfall — ließ das Dokument
tot liegen, ohne Knopf und ohne Wiederversuch, bis zum Neuladen der Seite.
Jetzt wird `padSource` **vor** dem Abruf gesetzt; der Knopf erscheint auch, wenn
es das Dokument noch nicht gibt, und legt es beim ersten Erfolg an.

**Wer das Pad-Dokument löscht, meint es.** `deleteDoc()` beendet die Pad-Quelle.
Ohne das hätte der (damalige) Takt es wieder angelegt — und beim Anlegen auch
gleich aktiviert, den Nutzer also aus dem Dokument gerissen, in das er gewechselt
war.

**Verhältnis zu D20 („keine externen Requests").** Unverändert wie bei D23: Die
App lädt von sich aus nichts; der Request entsteht nur, weil der Nutzer eine
URL angibt, und geht nur an genau diesen Host (`credentials:'omit'`, nur
`http`/`https`). Neu und ausdrücklich zu benennen ist die andere Richtung:
**Der Plantext liegt jetzt auf fremder Infrastruktur**, und ein Pad ist für
jeden lesbar, der die Adresse kennt. Das ist bei einem Projektplan etwas
anderes als bei einer Schriftart. Es bleibt die Entscheidung dessen, der den
Link baut — Werkbaum legt von sich aus kein Pad an.

**Verworfene und aufgeschobene Alternativen:**
- **`?sourceUrl=` um wiederholtes Abrufen erweitern** — hätte bestehenden Links
  ungefragt Requests verpasst und D23 seine klare Semantik gekostet.
- **Das Pad einbetten** — nicht verworfen, sondern gebaut; siehe Nachtrag unten.
- **Echter Etherpad-Client** (socket.io + Easysync-Changesets): Rettet D25 und
  erlaubt Schreiben aus Werkbaum heraus, kostet aber zwei **Laufzeit**-
  Abhängigkeiten und damit „eine self-contained Datei ohne
  Laufzeit-Abhängigkeiten" (D11/D19/D20) — und die Diff-Hälfte müsste man
  selbst schreiben. Das ist der XL-Knoten aus dem Plan, nur mit fremdem
  Protokoll statt fremdem CRDT. Wenn, dann zusammen mit dem eigenen Backend
  (D13) und dann besser mit einem Text-CRDT, wie der Plan es vorsieht.
- **Etherpads HTTP-API** (`/api/1/getText?apikey=…`) — der API-Schlüssel ist ein
  Administrationsschlüssel für **alle** Pads der Instanz und hat in einer
  Client-Anwendung nichts zu suchen. Der Export-Endpunkt braucht ihn nicht.

**Nachtrag — das Pad wird eingebettet, der Textspiegel bleibt daneben.**
Ob der Server das Einbetten zulässt, war die erste Frage. Nachgemessen:
`pad.hostsharing.net` sendet **kein** `X-Frame-Options` und keine CSP mit
`frame-ancestors`, und im Versuch hat das Pad in einem fremdstämmigen Rahmen
seine inneren Editorframes aufgebaut (`contentWindow.length === 2`, das sind
`ace_outer`/`ace_inner`) — samt Werkzeugleiste, heiler Einrückung und lebender
Socket-Verbindung (der Anwesenden-Zähler sprang auf 2). Technisch geht es also.

**Aber Einbetten heißt nicht Ersetzen.** Der naheliegende Schritt wäre, das
Textfeld durch den Rahmen zu ersetzen. Das kostete **beide** Richtungen von D25
— kein Alt+Klick → Zeile, keine Cursor-Zeile → Knoten —, weil in einen
cross-origin-iframe kein DOM-Zugriff führt. Bei 75 Knoten ist das die
Orientierung. Deshalb **drei Ansichten** statt einer Entscheidung, reihum über
einen Wähler in der Editor-Titelzeile:

- **Pad und Text**, geteilt durch einen eigenen Splitter (Idiom und Mechanik wie
  beim Legenden-Splitter aus D26: von der Spiegelseite gezogen, Doppelklick
  setzt zurück, `--pcol`/`--prow` getrennt gehalten und persistiert). Der Spiegel
  darf schmal werden — er trägt weiter die Sprünge, denn die arbeiten auf
  **unserem** `<textarea>`.
- **nur Pad** — der Spiegel ist ausgeblendet. Ein Sprung aus dem Diagramm holt
  ihn selbst zurück, so wie `revealEditor()` ein zugeklapptes Panel aufklappt
  (D25). Ohne das zeigte der Sprung ins Nichts.
- **nur Text** — wie bisher, kein Rahmen.

**Ein Wähler statt dreier Knöpfe:** Die Editor-Titelzeile trägt schon Dokument,
Pad, Neu laden, Kopieren, Legende und die Fensterknöpfe; auf kleinem Bildschirm
(D17) ist sie dreifach eng. Derselbe Reihum-Griff wie beim Modus-Wähler dort. Der
Zustand steckt im Symbol (geteilter Rahmen / links gefüllt / rechts gefüllt), der
Tooltip nennt ihn im Klartext.

**Der Rahmen wird nur geladen, wenn er sichtbar ist** (`about:blank` sonst). Das
ist kein Geiz um Bytes: Ein geladenes Pad verbindet sich per Socket und macht
dich in dessen Anwesenden-Liste sichtbar. „Nur Text" ist damit die Ansicht, die
nichts von dir verrät — und die Voreinstellung „beide" ist eine bewusste
Entscheidung, weil wer `?etherpad=` aufruft, das Pad auch will.

**Der Preis, der bleibt: `Set-Cookie: token=…; SameSite=Lax`.** Dieses Cookie ist
Etherpads Autoren-Identität und wird in einem fremdstämmigen Rahmen **nicht
mitgesendet** (Safari blockt Dritt-Cookies grundsätzlich, Chrome je nach
Einstellung). Bearbeiten geht, aber man ist bei jedem Laden ein neuer Autor —
Name und Farbe halten nicht. Reparieren lässt sich das nur **serverseitig**
(`cookie.sameSite: "None"` in Etherpads `settings.json`), nicht in Werkbaum.

Auf kleinem Bildschirm wurde „beide" nachgemessen statt geschätzt: bei 375 × 812
bleiben Pad 317 px und Spiegel 180 px, per Splitter verschiebbar — knapp, aber
brauchbar. Eine Sonderregel für Mobil braucht es deshalb nicht.
