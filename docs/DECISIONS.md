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

**Nachtrag — auf Mobil ist jetzt immer genau EIN Bereich zu sehen; der Splitter
entfällt dort ganz.** Die oben beschriebene stufenlose Aufteilung hat das
eigentliche Problem nur verwaltet, statt es zu lösen: Auf 375 px ist für zwei
Bereiche kein Platz. Jede Aufteilung war ein Kompromiss, in dem **beide**
Bereiche zu klein waren, und die praktisch einzigen sinnvollen Stellungen waren
ohnehin die Extreme — also genau das, was ein Umschalter direkt anbietet. Der
Splitter kostete außerdem dauerhaft eine zweite Titelzeile plus 14 px Griff für
etwas, das man auf dem Telefon nicht dosiert, sondern wechselt.

**Der Umschalter zeigt das Ziel, nicht den Zustand.** Damit weicht er bewusst
vom Modus-Wähler daneben ab, der das aktive Icon zeigt und reihum schaltet:
Der hat drei Zustände, die man ohne Anzeige nicht auseinanderhält; hier gibt es
zwei, und welcher gerade gilt, sieht man am ganzen Bildschirm. Ein Knopf, der
den Zustand anzeigt, den man ohnehin vor sich hat, sagt nichts — einer, der
das Ziel zeigt, sagt, was passiert. Umgesetzt als **zwei feste Knöpfe**, je
einer pro Titelzeile: Weil immer nur eine Zeile sichtbar ist, braucht keiner
sein Icon zu wechseln.

**Der Dokumenten-Wähler steht neben dem Umschalter** und damit nur im
Textbereich. Das ist keine Platzentscheidung, sondern die richtige Zuordnung:
Er bestimmt, *welchen Text* man bearbeitet (D22) — im Diagrammbereich wäre er
ein Fremdkörper. Die übrigen Aktions-Knöpfe bleiben, wo sie sind, und werden
dadurch von selbst mitgeschaltet; ihre komprimierte Mobil-Form (Modus-Wähler
als Reihum-Icon, Download als Overlay) bleibt unverändert.

**Die Falle beim Bauen: ein `display:none`-Panel misst sich zu null.** Der
verborgene Bereich wird wirklich ausgeblendet — nur so bekommt der sichtbare
die ganze Höhe. Alles, was aus der Live-Geometrie zeichnet, liefert dann aber
Unsinn, und `render()` läuft bei **jedem Tastendruck** im Textbereich.
Nachgemessen nach einer Eingabe bei verborgenem Diagramm: Pfad-Linie **weg**,
null Stationspunkte, kein `--stem-x`. Das Umschalten zeichnet deshalb neu —
zum Diagramm hin dieselben vier Schritte wie ein Moduswechsel
(`applyOptStairs`, `alignStems`, `drawCheapPath`, `drawDepLinks`), zum Text hin
der Zeilennummern-Streifen, der ebenso am Spiegel misst (D33). Danach wieder
48 px Pfadlänge, 5 Punkte, `--stem-x: 67,4px`.

Der sichtbare Bereich wird in `werkbaum-ui` gemerkt — global über alle
Dokumente wie der übrige Ansichts-Zustand (D22). Die Sprünge zwischen Diagramm
und Text (D25) holen den nötigen Bereich selbst nach vorn: `revealEditor()`
schaltet auf Text (wie es auf dem Desktop ein zugeklapptes Panel aufklappt),
`focusNodeOfCaret()` auf das Diagramm — und zwar **vor** dem Zentrieren, sonst
misst sich der Zielknoten noch zu null. Entfallen sind damit `--drow` auf
Mobil, die Grid-Minima `--pmin-d`/`--pmin-e`, `syncPanelMins()`,
`setMobileDrow()` und das Titelzeilen-Tippen; Desktop behält Splitter,
Presets und Fenster-Buttons unverändert.

**Nachtrag 2 — auf Mobil sind die Inhalte grundsätzlich ~25 % kleiner, und der
Debug-Kasten minimiert sich statt zu verschwinden.**

**Verkleinerung als Faktor, nicht als neuer Anfangswert.** `MOBILE_ZOOM = 0.75`
multipliziert den Nutzer-Zoom (`effZoom()`), statt ihn beim ersten Start auf
0,75 zu setzen. Der Unterschied zählt: Ein Anfangswert wäre nach dem ersten
Zoomen weg, und „Zurücksetzen" führte zurück auf eine Größe, die auf dem
Telefon zu groß ist. Als Faktor bleibt die Verkleinerung eine Eigenschaft des
Geräts, und der Regler arbeitet relativ dazu weiter. Die Anzeige nennt den
**effektiven** Wert (75 % statt 100 %) — sie soll beschreiben, was man sieht,
nicht was man eingestellt hat.

**Die drei Messstellen mussten mit.** `alignStems()`, `drawCheapPath()` und
`drawDepLinks()` rechnen gemessene Pixel durch den CSS-`zoom` zurück; sie lesen
jetzt `effZoom()` statt `zoom`. Nachgemessen bei 0,75: alle fünf
Stationspunkte liegen exakt (0 px Abweichung) auf ihren Blattknoten.

**Der Text kann kein `zoom` bekommen.** Zeilennummern-Streifen und Spiegel
messen am Textfeld (D33), und der Streifen rechnet seine Breite in `ch` — beide
folgen der **Schriftgröße**, nicht einem Zoom auf einem Vorfahren. Also
`font-size: .64rem` (= 0,85 × 0,75) an Textfeld **und** Streifen gemeinsam;
`line-height` ist einheitenlos und skaliert mit. Der Innenabstand des
Textfelds schrumpft im selben Verhältnis mit (14/16 → 10/12 px), sonst wäre der
Rand auf 375 px unverhältnismäßig breit. Ergebnis: 27 statt 19 Zeilen im Bild.

**Dabei aufgefallen: der Grafikexport war schon immer zoom-abhängig falsch.**
Die Schriftgrößen im Ausgabe-SVG sind feste Zahlen (14 für Labels, 9–11 für
Badges), die Kästen kommen aus der Live-Messung — bei jedem Zoom ≠ 1 passten
Text und Kasten nicht zueinander. Das fiel nie auf, weil 100 % der Normalfall
war; mit der Mobil-Verkleinerung wäre es der Regelfall geworden. `diagramToSvg()`
stellt den Zoom für die Messung deshalb kurz auf 1 und danach zurück —
derselbe Griff wie bei der `exporting`-Klasse (D25-Nachtrag), und die Funktion
läuft synchron, es wird nichts davon gezeichnet. Nachgemessen: Knoten auf dem
Schirm 143 px, im SVG 189,7 px — also die unskalierte Größe, passend zur festen
Schrift.

**Nachtrag 3 — der Umschalter trägt die Navigation zum Knoten; ein langer
Druck im Textfeld verbietet sich.** Gemeldet als Fehler: „Wenn man in der
Smartphone-Ansicht den Cursor in den Text setzt, klappt das Text-Edit-Fenster
zusammen." Nachgestellt auf der **deployten** Instanz (1.1.39, noch das alte
Splitter-Modell von D17): Ein Tipp auf die **Titelzeile des Diagramms** —
ein 49 px hoher Streifen unmittelbar über dem Text — schrumpfte den Editor von
594 px auf 44 px. Beim Zielen auf die oberen Textzeilen ist der leicht zu
treffen. Das Ein-Bereich-Modell aus Nachtrag 1 nimmt dem Fehler die Grundlage:
Es gibt keinen Splitter und kein Titelzeilen-Tippen mehr, den Bereich wechselt
**allein** der Umschalter. Im aktuellen Stand ließ sich der Fehler nicht mehr
auslösen (Maus-Klick, emulierter Touch und synthetische Touch-Folge, jeweils
ohne Bereichswechsel).

**Das war aber nur die halbe Wahrheit — siehe Nachtrag 4.** Der Nutzer meldete
denselben Fehler auf dem Pages-Build, der das Ein-Bereich-Modell bereits
enthielt. Die obige Diagnose war für die alte Fassung richtig und trotzdem
nicht die Ursache seiner Beobachtung; die eigentliche stand woanders und war
mit Emulation grundsätzlich nicht zu finden.

Der zweite Teil der Meldung deckte aber eine echte Lücke auf: Für die Richtung
**Text → Diagramm** gibt es nur Alt+Klick bzw. Alt+Enter (D25) — und Alt gibt
es auf dem Telefon nicht. Die Gegenrichtung hat dort ihren langen Druck, diese
hatte nichts.

**Vorgeschlagen war ein langer Druck im Textfeld — verworfen.** Dort gehört er
dem Betriebssystem: Wort markieren, Auswahlgriffe, Einfügen-Leiste. D25 konnte
sich diese Geste im Diagramm nehmen (`user-select:none`), weil es da nichts zu
markieren gibt; in einem **editierbaren** Feld ist sie die Bedien-Grundlage
zum Bearbeiten. Sie zu überschreiben löste ein Navigationsproblem auf Kosten
des Bearbeitens — in einer Meldung, deren Kern gerade lautet, dass Bearbeiten
nicht bestraft werden darf. Dazu kommt, dass sich das Zusammenspiel mit der
nativen Auswahl nach der D25-Lehre nur auf echter Hardware beurteilen ließe.

**Gewählt: der Umschalter tut es nebenbei.** Wer aus dem Text ins Diagramm
wechselt, will nachsehen — und zwar bei dem, woran er gerade geschrieben hat.
Der Knopf wird in genau diesem Moment ohnehin gedrückt; er zentriert deshalb
den Knoten der Cursor-Zeile und hebt ihn hervor (`focusNodeOfCaret()`, also
identisch zum Alt+Klick am Schreibtisch). Kostet kein Bedienelement, keine
Geste und kann nicht versehentlich auslösen. Steht der Cursor auf einer Zeile
ohne Knoten (Kommentar, Leerzeile), wird nur umgeschaltet — dieselbe stille
Regel wie überall sonst bei dieser Geste.

**Nachtrag 4 — die eigentliche Ursache: `--app-height` folgte der
Bildschirmtastatur.** Nach Nachtrag 3 blieb der Fehler auf dem Pages-Build
bestehen („dort klappt der Text komplett zusammen, sobald ich irgendwo den
Cursor reinsetze"). Gefunden über die einzige Frage, die nach zwei
fehlgeschlagenen Emulations-Versuchen noch trägt: **Was ist auf einem echten
Telefon anders?** Antwort: die Tastatur.

`setAppHeight()` schreibt `window.visualViewport.height` nach `--app-height`,
und `body{height:var(--app-height)}` macht daraus die Höhe der ganzen Seite.
Genau diesen Wert verkleinert die Bildschirmtastatur — dafür ist
`visualViewport` gemacht. Nachgemessen ist der Zusammenhang linear:
Textfeldhöhe = `--app-height` − rund 206 px feste Aufbauten (Kopfzeile 57,
Titelzeile 44, Fußzeile 36, Innenabstände). Bei 812 px bleiben 606 px Text,
bei 440 px noch 234, bei 260 px — realistisch für ein kleines Gerät mit
Tastatur und Browserleiste — nur **54 px**, also drei Zeilen. Das ist das
gemeldete „komplett zusammengeklappt", und es tritt **ausschließlich auf
echten Geräten** auf: In der Emulation gibt es keine Tastatur, deshalb liefen
alle drei Reproduktionsversuche aus Nachtrag 3 ins Leere.

**Unterschieden wird am Fokus, nicht an der Größe.** Die Tastatur und eine
überlagernde Browserleiste (Brave — der ursprüngliche Anlass des Mechanismus)
erzeugen dieselbe Signatur: `visualViewport.height` fällt, `innerHeight`
bleibt. An den Zahlen sind sie nicht zu trennen. Am Zustand schon: Die
Tastatur steht nur, wenn ein **editierbares** Feld den Fokus hat. Solange das
so ist, bleibt die zuletzt tastaturfreie Höhe stehen. Die Seite behält damit
ihre Größe, und der Browser schiebt den sichtbaren Ausschnitt zur
Schreibmarke — das Verhalten jeder anderen App. Nachgemessen mit
nachgebildetem `visualViewport`: mit Fokus im Textfeld 812/606 px (unverändert),
ohne Fokus 440/234 px (die Brave-Leiste wirkt also weiter).

**Drehen muss die Sperre durchbrechen** (`setAppHeight(true)` bei
`orientationchange`) — sonst behielte die Seite beim Drehen während des
Tippens die Höhe des alten Hochformats. Dazu ein `focusout`-Nachzug für
Browser, die das Schließen der Tastatur nicht als `resize` melden. Und der
Timer dort ruft `() => setAppHeight()`, nicht `setAppHeight` direkt: Ein
durchgereichtes Argument wäre wahr und hebelte die Fokus-Sperre aus.

**Lehre, schon zweimal bezahlt:** D25 hielt fest, dass synthetische
`TouchEvent`s nur die eigene Ereignis-Logik beweisen. Dieselbe Grenze gilt für
alles, was die **Geräteumgebung** stellt — Bildschirmtastatur, Browserleisten,
Nutzergesten-Regeln. Ein „lässt sich nicht reproduzieren" aus dem Emulator ist
bei solchen Meldungen kein Befund, sondern nur die Feststellung, dass das
Werkzeug die Ursache nicht enthält.

**Das Debug-Panel minimiert sich jetzt, statt sich zu schließen.** Ein Klick
entfernte es bisher ganz — was nichts half, weil der 15-Sekunden-Takt es sofort
wieder aufbaute; auf dem Telefon verdeckte es damit dauerhaft die untere rechte
Ecke. Jetzt schaltet der Klick zwischen Kasten und einem 26-px-Icon (⟳) unten
rechts um. Der Zustand liegt im **localStorage**, nicht am Element: Das Panel
wird bei jedem Takt neu bespielt, ein Zustand am DOM-Knoten wäre also beim
nächsten Tick weg. Nachgeprüft über einen echten Intervall-Durchlauf und über
den `visibilitychange`-Pfad — es bleibt minimiert. (Test-Hilfe, im Prod-Build
ohnehin unterdrückt; die Gelegenheit genutzt, dem aufgeklappten Kasten
`white-space: pre-wrap` zu geben — die mit `\n` gefügten Zeilen liefen bisher
zu einem Absatz zusammen.)

**Nachtrag 5 — die Titelzeile bricht nicht mehr um: die Lücken waren zu
breit, nicht die Knöpfe zu viele.** Gemeldet, als der Falt-Umschalter (D44)
den achten Knopf in den Diagramm-Kopf brachte: Die Zeile ging auf drei Reihen
und 86 statt 49 px — und fraß damit genau die Fläche, für die es den
Ein-Bereich-Modus (Nachtrag 1) überhaupt gibt.

Nachgemessen war die Diagnose eindeutig, und sie lag nicht bei den Knöpfen:
Deren Breiten summieren sich bei 375 px auf 243 px. Die **Abstände** brachten
den Rest — `gap:14px` mal sieben plus 2×16 px Innenabstand sind 130 px, also
mehr als ein Drittel des Bildschirms. Der Nutzer hat das richtig gesehen:
„eigentlich ist dort auch genug Platz für alle Buttons".

Auf Mobil deshalb `gap:8px` und `padding-inline:10px`, dazu `flex-wrap:nowrap`
als Riegel. Die **Knöpfe selbst bleiben unangetastet** — 29 px sind für einen
Finger ohnehin die Untergrenze; verkleinert wird der Zwischenraum, nicht das
Ziel. Nachgemessen mit allen acht Bedienelementen (der „Was ist neu?"-Knopf
ist der, der die Zeile kippen ließ, weil er nur bei fremden Dokumenten mit
Neuigkeiten erscheint): bei 375 px eine Reihe, 49 px, letztes Element bei
357 von 359; bei 320 px ebenfalls eine Reihe mit 10 px Luft. Dass es auch bei
320 px reicht, liegt am `margin-right:auto` des Bereichs-Umschalters — es
nimmt den Rest auf, wenn welcher da ist, und verschwindet, wenn keiner da ist.

**Warum `nowrap` und nicht einfach engere Lücken:** Ohne den Riegel wäre der
Umbruch nur weiter hinausgeschoben — der nächste Knopf oder eine längere
Sprache brächte ihn zurück, und zwar wieder unbemerkt. Mit `nowrap` wird aus
einem stillen Layout-Wechsel ein sichtbarer Überlauf; das ist der ehrlichere
Fehler, und die Messung oben zeigt, dass bis 320 px keiner auftritt. Der
Editor-Kopf trägt dieselbe Regel (er hat nur vier Elemente und war nie
gefährdet, aber die Zeile soll in beiden Bereichen gleich hoch bleiben);
Desktop bleibt bei 14 px, dort ist Platz.

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

**Nachtrag — „Original wiederherstellen“ ist jetzt ein Produkt-Feature im
Dokumenten-Menü.** Auslöser: Auf der Prod-Instanz gab es **keinen** Weg, ein
bearbeitetes mitgeliefertes Dokument wieder auf den Auslieferungsstand zu
bringen — der Reset ist ein Debug-Knopf außerhalb des Prod-Builds, und das
Fingerabdruck-Nachziehen (D27) fasst bearbeitete Texte grundsätzlich nicht an.
Wer im Beispiel herumprobiert hatte, sah neue Beispiel-Fassungen also nie.
Erwogen und **verworfen**: die Alternative, dass eine neue Fassung lokale
Änderungen still überschreibt — das wäre überraschender Datenverlust und
bräche die D22/D27-Linie („bearbeitete Inhalte nie anfassen“). Stattdessen ein
Menü-Eintrag, sichtbar nur für die **mitgelieferten** Dokumente und nur, wenn
Text oder Name vom Auslieferungsstand abweichen; mit Rückfrage, die den
Verlust benennt. Wiederhergestellt werden Text **und** Name (der Eintrag sagt
„Original“); Falt-Eingriffe werden mit verworfen. Der Debug-Reset bleibt
daneben bestehen — er setzt zusätzlich Einstellungen und Merker zurück.

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
`werkbaum.werkbaum`) statt einzeln in `docs/`. Mehrere Beispiele, weil
sich das Umschalten zwischen Dokumenten (D22) erst mit mehreren *geladenen*
Dokumenten zeigen lässt: jeder `?sourceUrl=`-Link legt ein eigenes Dokument an
(id aus der URL, D23), nacheinander geöffnet stehen sie danach alle im Wähler.
`werkbaum.werkbaum` beschreibt Werkbaum selbst (Bestand + mögliche
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
Hälfte: `werkbaum.werkbaum` hat 75 sichtbare Knoten, ohne Markierung
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

**Nachtrag — Alt+Klick gibt es jetzt auch im Textfeld.** Gemeldet als „das
Alt+Klick muss im Text-Editor wieder funktionieren, um den Knoten im Diagramm zu
fokussieren". Nachgesehen: Die Geste hat es dort nie gegeben — die Rückrichtung
lief bisher **allein** über die Cursor-Zeile. Das ist trotzdem kein
Missverständnis, sondern ein Befund: Die Rückrichtung fühlt sich schwächer an,
weil sie es ist.

Der Grund steckt in ihrer eigenen Auslegung. Die Cursor-Zeile scrollt bewusst
**nur beim Zeilenwechsel** und **nur `nearest`** — beides notwendig, sonst
ruckelte das Diagramm bei jedem Tastendruck. Genau das macht sie aber als *Zeig
mir das* untauglich: Wer denselben Knoten noch einmal sucht, bekommt nichts, und
wer ihn am Bildrand hat, bekommt ihn an den Bildrand. Es fehlte also nicht die
Verknüpfung, sondern eine **ausdrückliche** Geste daneben.

Deshalb: **Alt+Klick im Textfeld** (Tastatur **Alt+Enter**) zentriert den Knoten
der Cursor-Zeile und gibt ihm den **Tastaturfokus**. Derselbe Modifier wie in der
Gegenrichtung — eine Geste, zwei Richtungen, nichts Neues zu lernen; die
vorhandene Legenden-Zeile (`hint_jump`) nennt jetzt beide Richtungen, statt einen
zehnten i18n-Schlüssel in neun Sprachen aufzumachen.

**Der Fokus wandert wirklich mit** (`el.focus({preventScroll:true})`, dann
bewusst `scrollIntoView({block:'center'})`). Erwogen war, nur zu scrollen und den
Cursor im Text zu lassen — weniger störend beim Tippen. Dagegen sprechen zwei
Dinge: Die Gegenrichtung nimmt den Fokus ebenso mit (in den Text hinein), und ein
Screenreader erfährt vom Scrollen nichts. Mit Fokus wird daraus ein
vollständiger Hin- und Rückweg: Alt+Klick in den Baum, dort mit Tab/Pfeil
weiter, Alt+Enter zurück in die Zeile.

`preventDefault()` beim Tastaturweg ist Pflicht, sonst bekommt der Text einen
Umbruch. Auf einer Zeile ohne Knoten (Kommentar, Leerzeile, ausgeblendetes
Verworfenes) geschieht nichts — dieselbe stille Regel wie bei der Cursor-Zeile.

**Nachtrag — die Cursor-Zeile hebt sich jetzt aus der Ebene, und die fehlende
Ausnahme gegen die Pfad-Inversion.** Gemeldet als „müsste etwas deutlicher
sein". Beim Nachsehen kam zuerst etwas anderes heraus, das keine
Gestaltungsfrage ist:

**Auf einem guten Drittel der Knoten war der Ring gar nicht zu sehen.** Die
Pfad-Inversion (D18) setzt `.cheap-on .node:not(.cheap){opacity:.32;
filter:saturate(.4)}` — und das trifft den `box-shadow` mit. Genau diese Falle
haben D28 (gelber Kranz) und D32 (Fokusmarke) je für sich gefunden und mit
einer Ausnahmeregel behoben; `.current` hat seine nie bekommen. Gemessen im
mitgelieferten Beispiel mit dem Cursor auf `+ [?] Dark mode`: Deckkraft 0,32.
Der Fall ist zudem der häufigste der drei — der Pfad-Umschalter ist
voreingestellt an, und jeder optionale Knoten und jede nicht gewählte
Alternative fällt darunter (im Beispiel 7 von 18 Knoten). Anders als beim
optionalen Knoten (D29), wo das Zurücktreten die **Aussage** ist, wird hier
überhaupt keine Aussage über den Plan gemacht: Es ist eine Editierhilfe, und wo
der Cursor steht, muss sichtbar bleiben, egal wie der Pfad entschieden hat.

**Warum der Ring auch ungedimmt leise wirkt:** Er benutzt denselben Kanal, den
schon jeder Knoten belegt — **jeder Status hat einen Rahmen** (SPEC §4). Ein
weiterer Ring in einem Feld aus lauter gerahmten Kästchen ist ein Unterschied
im Grad, nicht in der Art. Die beiden Strahlenkränze entkommen dem, weil sie
einen Kanal benutzen, den sonst nichts hat (Leuchten nach außen); die
Cursor-Zeile war auf dem Rahmen-Kanal sitzen geblieben.

**Gewählt: Tiefe** — Ring behalten, dazu Schlagschatten und `scale(1.04)`. Der
Knoten hebt sich aus der Ebene. Das ist der einzige Kanal, den im Diagramm noch
gar nichts belegt (nichts anderes wirft Schatten oder bewegt sich), kollidiert
also mit **keiner** Farbcodierung und wirkt über allen acht Statusfarben
gleich. Zwei angenehme Eigenschaften, beide nachgemessen: `transform` ändert
kein Layout (die Linien bleiben stehen), und weil um die **Mitte** skaliert
wird, bleibt die Knotenmitte punktgenau erhalten (dx = dy = 0) — `alignStems()`
(D29) und die Stationspunkte des günstigsten Pfads (D18) messen genau die und
bleiben unberührt. Nur `drawDepLinks()` (D41) setzt auf Knoten**kanten** auf und
verschiebt sich für diesen einen Knoten um ~4 px; das ist flüchtig und fällt
nicht auf. Ein Spalt zur Anschlusslinie entsteht nicht — der Knoten wächst
darüber, statt sich zurückzuziehen.

*(Die Prüfung übersah eine Wirkung des `z-index`, die nicht die Geometrie
betrifft: Er hebt den Knoten auch über die vorderen Zeichenebenen. Korrigiert
in Nachtrag 3.)*

**Dazu ein einmaliger Puls beim Zeilenwechsel:** Man verliert den Knoten beim
**Bewegen**, nicht im Stillstand — also meldet er sich genau dann einmal, mit
einem kurzen Hüpfer und einem auslaufenden Ring. Kein WCAG-Problem: 2.2.2 zielt
auf Blinkendes, 2.3.1 auf Flackern über 3 Hz, ein einzelner Durchlauf ist
keines von beidem (dieselbe Prüfung wie in D28); `prefers-reduced-motion`
schaltet ihn ab. Ausgelöst wird er an derselben Bedingung, an der schon das
Scrollen hängt (`caretLine` hat sich geändert) — sonst pulste er bei jedem
Tastendruck. Bewusst **nicht** über `box-shadow` animiert: Die Kombinationen
mit `.fresh` und `.focusmark` haben je eigene Schatten-Listen, eine Animation
darauf ließe den gelben bzw. petrolfarbenen Kranz für die Dauer des Pulses
verschwinden. Stattdessen `transform` plus das freie `.node::after`
(`::before` gehört dem Optional-Kreis, D29).

**Der Export brauchte eine eigene Behandlung** — und das ist die Stelle, an der
die Erhebung anders liegt als der Ring. D25 konnte sich darauf verlassen, dass
`diagramToSvg()` nie `box-shadow` ausliest; die Vergrößerung schlägt aber über
`getBoundingClientRect()` durch, mit dem der Export die Live-Geometrie nachzieht
— genau ein Knoten stünde 4 % zu groß im Bild. Während des Messens trägt `#out`
deshalb die Klasse `exporting`, die Erhebung und Puls neutralisiert.
Nachgemessen: 155,6 statt 161,9 px, also die unskalierte Breite. Per Klasse
statt durch Abnehmen von `.current`/`.pulse`, damit der Export keine laufende
Animation abreißt und hinterher neu startet. Im Druck fällt beides ebenso weg.

**Verworfene Alternativen:** ein **dritter Strahlenkranz** (ein dunkles
Tinte-Leuchten liest sich auf hellem Grund als Schatten — die Lehre steht schon
im D32-Nachtrag —, und ein heller Schein bräuchte eine dritte Signalfarbe neben
Gelb und Teal); **Invertieren** des Knotens auf Tinte-Füllung mit weißer Schrift
(das stärkste Signal, kostet aber für die Cursor-Zeile die Statusfarbe — genau
die Regel, wegen der D28 und D32 ihre Kränze nach außen gelegt haben, und für
eine Editierhilfe wäre sie schlecht gebrochen); ein **Zeiger-Dreieck** links am
Knoten (`::after` wäre frei, bräuchte aber wie der Optional-Kreis eigene
Geometrie für alle drei Darstellungsmodi); und **die Umgebung zurücktreten
lassen** (flackerte bei jedem Pfeiltastendruck durch den ganzen Baum).

Nebenbefund beim Aufräumen: Der Kommentar über der Regel behauptete noch, die
Fokusmarke `!!!` trage „bewusst DIESELBE Hervorhebung" — überholt, seit der
D32-Nachtrag ihr den eigenen Petrol-Kranz gegeben hat. Ersetzt.

**Nachtrag 2 — Alt+Klick im Textfeld pulst jetzt auch.** Die erste Fassung des
Pulses hing an derselben Bedingung wie das Scrollen, und `focusNodeOfCaret()`
gab dort bewusst `false` weiter, um ein doppeltes Scrollen zu vermeiden
(erst `nearest`, dann `center`). Folge: Ausgerechnet die **ausdrückliche**
Geste — „ich will diesen Knoten jetzt sehen" — kam stiller an als das
beiläufige Tippen. Das ist verkehrt herum.

Getrennt sind die beiden Dinge jetzt sauber: `highlightCurrentNode(moved,
scroll)` nimmt zusätzlich, **wie** ins Bild geholt wird — `'nearest'` beim
gewöhnlichen Zeilenwechsel, `'center'` beim Alt+Klick, `false` beim Neubau.
Die Hervorhebung ist in allen Fällen dieselbe, Puls eingeschlossen; der
Unterschied liegt allein im Scroll-Modus. Der Fokus wandert weiter mit
(D25-Nachtrag 1, `focus({preventScroll:true})` **vor** dem Scrollen) — er
verändert das Bild nicht, weil `:focus-visible` nach einem Mausklick nicht
greift (nachgemessen: `false`).

Der Fall, den man beim Bauen leicht übersieht: Alt+Klick trifft oft den Knoten,
der **schon** die Cursor-Zeile ist. Dann ist es dasselbe DOM-Element, und der
Puls muss trotzdem neu anlaufen — genau dafür steht das Lesen von
`offsetWidth` zwischen Entfernen und Setzen der Klasse. Nachgemessen: vor dem
Klick keine laufende Animation, 80 ms danach beide bei `currentTime ≈ 67 ms`.

**Nachtrag 3 — „vorn" heißt vorn: die vorderen Zeichenebenen brauchen einen
eigenen `z-index`.** Gemeldet als „wenn der Knoten der aktive ist, fehlt der
blasse Kreis für den Lean Path". Die Ursache ist der `z-index:3`, den Nachtrag 1
dem Knoten gegeben hat — richtig begründet (ohne ihn beschneiden später gemalte
Geschwister den Schlagschatten), aber mit einer zweiten Wirkung, die dort nicht
mitgedacht wurde: Er hebt den Knoten nicht nur über seine Geschwister, sondern
über **jede** Ebene ohne eigene Stapelposition — und genau das waren die
Overlay-SVGs. `svg.cheap-front` trug nur `position:absolute`; die
Zeichenreihenfolge kam allein aus der DOM-Position. Damit lag ausgerechnet der
hervorgehobene Knoten über seinem eigenen Stationspunkt.

Der Fehler ist **nicht** auf die Cursor-Zeile beschränkt: Die Strahlenkränze
haben aus demselben Grund `z-index:2` (D28/D32), verdeckten den Punkt also
ebenso. Und `svg.dep-front` (D41) hing daran mit — die hervorgehobenen
Abhängigkeits-Kanten gehören per Definition zum ausgewählten Knoten und endeten
deshalb unter ihm, also genau dort, wo man hinsieht.

Behoben an der Ebene, nicht am Knoten: `.dep-front{z-index:4}` und
`.cheap-front{z-index:5}` — beide über der höchsten Knoten-Stufe. Die
**hinteren** Ebenen bleiben ohne `z-index`; sie sollen hinter den Knoten
liegen, und dort funktioniert die DOM-Reihenfolge. Den `z-index` am Knoten zu
senken wäre der falsche Griff gewesen: Er hat seinen Grund, und die
Overlay-Ebenen heißen nicht ohne Absicht „front".

Export und Druck waren nie betroffen — dort zeichnet `diagramToSvg()` die
Punkte nach den Knoten (Reihenfolge statt Stapelung), und die Cursor-Zeile
erscheint ohnehin nicht (D25 oben).

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
`examples/werkbaum.werkbaum` gezogen — derselben Datei, die auch
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

**Nachtrag — das Nachziehen gilt jetzt auch für das Beispiel-Dokument.** Als
das Beispiel die neuen Notations-Features (IDs, Abhängigkeiten, `=`, Falten,
Beschreibungen) vorführen sollte, stand es vor demselben Problem wie damals
der Werkbaum-Plan: Ohne Merker erreicht eine neue INITIAL-Fassung
Bestandsnutzer nie — ihr unverändertes Beispiel sieht nur wie „bearbeitet“
aus. Ein zweiter Fingerabdruck (`werkbaum-seeded-example`) überträgt die
D27-Regeln wörtlich: nachgezogen wird nur, solange der Text exakt die zuletzt
ausgelieferte Fassung ist; bearbeitete Texte werden nie angefasst; ein
gelöschtes Beispiel wird vom Nachziehen nicht wiederbelebt (das macht bei
Bedarf `deleteDoc`/Reset). Der Reset setzt beide Merker mit.

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

**Nachtrag 4 — beim einzigen Kind riss die Linie ab: `--stem-x` ohne
Sammelleiste.** Gemeldet als „die Linie zwischen `#fe` und `#fe.rel` ist
abgerissen" an einem Baum mit genau einem Zerlegungsknoten und einer Treppe
darunter. Nachgemessen sind es zwei Stiele an **verschiedenen** Stellen:

- `ul.and::before` — der Stiel aus dem Elternknoten — sitzt bei **50 % der
  Gruppe** (gemessen `left: 136,2px`);
- der Stiel zum Kind sitzt bei **`--stem-x`** (gemessen `127,7px`), also auf der
  Knotenmitte, die Nachtrag 2 eigens misst.

Dazwischen lag nichts: Für `li:only-child` wird die waagerechte Sammelleiste
ausdrücklich abgeschaltet (`border-top:none`) — richtig, solange beide Stiele
zusammenfallen, und das tun sie, solange der Knoten in seiner Zelle **zentriert**
steht. Genau diese Voraussetzung hebt Nachtrag 2 auf, und der `:only-child`-Fall
ist dabei übersehen worden: Er stammt aus der Zeit, als es `--stem-x` noch nicht
gab.

**Es ist nicht auf die Treppe beschränkt** — an einem `li.has-or` als einzigem
Kind (Knoten linksbündig, Zelle so breit wie der any-of-Teilbaum) sind es
gemessen **41,8 px** Versatz. Dass es bisher niemandem auffiel, liegt daran,
dass der Fall selten ist: Ein Elternknoten hat meist mehrere Kinder, und dann
trägt die Leiste. Aufgefallen ist er jetzt, weil eine angefangene Zugabe seit
D61 in voller Farbe dasteht statt blass.

**Behoben mit einem kurzen Leiterstück genau zwischen den beiden** —
`left:min(50%, var(--stem-x))` bis `right:calc(100% - max(50%, var(--stem-x)))`,
darunter der Abgang bei `--stem-x`. Also dieselbe L-Form, mit der ein äußeres
Kind einer größeren Gruppe angeschlossen ist; ohne `--stem-x` ist das Stück null
Pixel breit und damit unsichtbar (nachgemessen: `0.0`, gerade Linie wie bisher).

Erwogen und verworfen: **den Stiel des Elternknotens auf `--stem-x` zu ziehen.**
Eine Zeile weniger, aber er träte dann nicht mehr aus der Mitte des
Elternknotens aus — bei 8 px unauffällig, bei den gemessenen 42 px nicht mehr,
und bei einem schmalen Elternknoten käme er neben ihm heraus.

**Dabei aufgefallen: `ul.and>li:only-child::after{border-left:…}` war seit jeher
wirkungslos.** Die Regel stand **vor** `ul.and>li:last-child::after{border:0
none}`, und bei gleicher Spezifität gewinnt die spätere — ein einziges Kind ist
auch das letzte. Gezeichnet wurde der Abgang stattdessen von der
`border-right`-Kante des `::before` (aus `:last-child::before`), 16 px lang bei
14 px Innenabstand, also 2 px über den Knoten hinaus. Der ganze `:only-child`-
Block steht jetzt **hinter** den first/last-Regeln, und die Absicht der Zeile
gilt endlich.

**Der Grafikexport hatte den Fehler nie:** `diagramToSvg()` spannt die
Sammelleiste über `kids.map(cx).concat(p.cx)` — die Elternmitte ist immer
Teil der Strecke. Betroffen war allein das CSS. Nicht durch Tests gedeckt (wie
der Rest dieser Geometrie), geprüft im Browser an allen drei Fällen: einziges
Kind mit Versatz (Stück 41,8 px breit, Linie durchgehend), gewöhnliches
einziges Kind (0 px, gerade), zwei Kinder (unverändert).

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
`examples/werkbaum.werkbaum` — allein der Werkbaum-eigene Plan sagt
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

## D32 — `!!!` als Fokusmarke: ein geteilter Zeigefinger im Text
Beim gemeinsamen Arbeiten an einem Pad (D31) fehlt das Naheliegendste: „schau
mal hier". Etherpad zeigt die Cursor der anderen im **Pad**, aber Werkbaum
kommt nicht an sie heran — ein fremdstämmiger Rahmen gibt keinen DOM-Zugriff,
und der Klartext-Export überträgt ohnehin nur Text. Eine Marke **im Text** ist
damit nicht der Notbehelf, sondern der einzige Weg.

Sie hat sogar etwas, das ein Cursor nicht hat: **alle sehen dieselbe Stelle.**
Ein Cursor ist privat, `!!!` ist eine Aussage im gemeinsamen Dokument.

**Syntax `!!!`.** Vorgeschlagen und **verworfen** war `%%!` — eine
Kommentar-Variante (`- [ ] Backend %%! schau mal hier`). Deren Vorzug: Bleibt die
Marke liegen, ist sie harmlos, denn `%%` ist längst ein Kommentar (SPEC §8);
jedes andere Werkzeug und jeder Leser überliest sie, und der Resttext hätte die
Begründung tragen können. Der Nutzer hat `!!!` gewählt, „am einfachsten schnell
mal zu tippen" — und das ist das entscheidende Kriterium, weil der Moment des
Zeigens genau der Moment ist, in dem man **nicht** über Syntax nachdenken will.
Bewusst in Kauf genommen: Die Marke bleibt sichtbar im Plan stehen, bis jemand
sie löscht (Werkbaum kann sie nicht entfernen — auf das Pad gibt es keinen
Schreibzugriff), und in einer committeten Datei sieht sie nach einer Aussage über
den Knoten aus. Ebenfalls verworfen: `@@` als Pseudo-Tag — `@` bedeutet in dieser
Notation „zuständig" (SPEC §7), ein `@@` daneben lädt zur Verwechslung ein.

**Nur alleinstehend.** Erkannt wird `!!!` am Zeilenanfang/-ende oder von Leerraum
umgeben. Ohne diese Einschränkung verlöre jedes `Achtung!!!` seine
Ausrufezeichen — und niemand fände den Grund, weil die Zeile im Diagramm nur
stumm anders aussieht. `!!` und `!!!!` zählen nicht, `!!!` innerhalb einer URL
bleibt Teil der URL. Regex bewusst **ohne Lookbehind** (`(^|\s)!!!(?=\s|$)`,
führender Leerraum wird mitgefangen und wieder eingesetzt): Safari kennt
Lookbehind erst ab 16.4, und die Notation soll nicht an einer Browserversion
hängen.

Position in der Extraktionsreihenfolge (SPEC §1): **nach** den Tags, vor dem
Label. Kollisionsfrei, weil `!!!` weder `@` noch Klammern noch `:` enthält. Der
Kommentar fällt als Erstes weg — eine Marke **im** Kommentar wirkt deshalb nicht,
was richtig ist: Was hinter `%%` steht, ist Beiwerk.

**Darstellung: dieselbe wie die Cursor-Zeile** (weißer Halo + Ring in Tinte,
D25), plus Scrollen ins Bild. Erwogen war ein eigenes Aussehen (Petrol-Ring mit
Sprechblasen-Spitze); der Nutzer entschied für die vorhandene Hervorhebung. Das
ist die sparsamere Wahl: Es gibt nur **einen** Begriff „hier schauen", und neben
Fokusrahmen (Petrol), Strahlenkranz (gelb, D28) und Cursor-Ring wäre ein vierter
Ring ein Zeichen zu viel. **Preis:** Im Bild ist nicht zu unterscheiden, ob ein
Knoten wegen der eigenen Cursor-Zeile oder wegen einer fremden Marke leuchtet.
Für Screenreader wird der Unterschied benannt (`a11yFocusMark`, „hierhin
schauen"), weil ein `box-shadow` dort ohnehin nicht ankommt.

**Ins Bild geholt wird nur bei Änderung.** Schlüssel ist der **Label-Text** des
markierten Knotens, nicht die Zeilennummer: Umsortieren im Pad soll nicht als
neue Marke gelten. Ohne diese Bedingung zöge jeder Neubau des Baums den Blick
zurück — man könnte nicht wegscrollen, und bei einem Pad-Dokument wird oft neu
gebaut.

**Beim Hinsehen gefunden: die Pfad-Inversion verschluckte den Zeigefinger.**
`.cheap-on .node:not(.cheap)` setzt `opacity:.32; filter:saturate(.4)` — und die
erste markierte Alternative im Test war genau ein nicht gewählter any-of-Zweig
(„Headless CMS"). Gemessen: Deckkraft 0,32, der Ring praktisch unsichtbar. Der
Zeiger zeigte auf nichts. Dieselbe Ausnahme wie für „neu in Produktion" (D28)
behebt es, und hier ist sie noch zwingender: „Sollten wir diese verworfene
Alternative noch einmal ansehen?" ist einer der wahrscheinlichsten Gründe,
überhaupt zu zeigen. Anders als beim optionalen Knoten (D29), wo das
Zurücktreten die Aussage **ist** — dort bleibt die Schwäche bewusst stehen.

**Nicht im Druck, nicht im Grafikexport** — wie die Cursor-Zeile. Die Marke sagt
„schau jetzt hierhin", nicht „so ist der Plan"; ein Export wäre für jeden
Betrachter etwas anderes. Der Export erbt das ohnehin, weil `diagramToSvg()` nie
`box-shadow` ausliest (D25).

**Dritte, unabhängige Achse.** Die Marke sagt nichts über Fortschritt (§4) oder
Notwendigkeit (§3) — test-abgedeckt, damit niemand später Status oder `optional`
daran koppelt. **Nicht** in das kanonische Beispiel (SPEC §10) aufgenommen: Das
ist zugleich Test-Fixture, und ein dauerhafter Zeigefinger darin wäre eine
Aussage, die niemand gemacht hat.

**Nachtrag zu D31 — „der eingebettete Rahmen lässt sich nach einer Weile nicht
mehr bearbeiten".** Gemeldet vom Nutzer, mit dem Verdacht, es hänge am
Update-Poller. **Der ist es nicht**, und das ist belegbar statt vermutet:

- `checkForUpdates()` holt `location.href`, also den **Werkbaum**-Origin. Es kann
  die Drosselung des Pads (10 Abrufe je 90 s, siehe oben) gar nicht auslösen.
- Es lädt die Seite nicht neu, sondern zeigt nur ein Banner;
  `checkAndShowUpdateNotification()` und `showUpdateDebug()` hängen ausschließlich
  `position:fixed`-Elemente an `<body>` — kein Neuaufbau eines Containers, in dem
  der Rahmen steckt (das *würde* ihn neu laden, denn ein Umhängen im DOM lädt
  jeden `<iframe>` neu).
- Gemessen über ~6 Minuten mit sichtbarem Tab: Marker auf `window` überlebt
  (kein Seiten-Reload), ein `load`-Zähler am Rahmen bleibt bei **0** (kein
  Rahmen-Reload), Sichtbarkeit durchgehend `visible`.

**Reproduziert wurde der Fehler nicht.** Nach sechs Minuten war die Verbindung
noch lebendig — geprüft ohne Tippen, indem das Pad von außen geändert wurde: Der
Rahmen übernahm die Änderung sofort, seine Socket-Verbindung lief also. Etherpads
eigene Meldungen sind von außen nicht lesbar (fremdstämmiger Rahmen, eigener
Konsolen-Kontext), eine Instrumentierung von unserer Seite gibt es dafür nicht.

**Verdacht, ausdrücklich unbewiesen:** das `SameSite=Lax`-Cookie (siehe oben).
Die erste Verbindung gelingt, aber Etherpads Autoren-Token wird im
fremdstämmigen Rahmen nicht mitgesendet. Bricht die Socket-Verbindung später
einmal ab (Netzwechsel, Standby, Timer-Drosselung eines Hintergrund-Tabs), fehlt
beim Wiederaufbau die Identität — und ein Etherpad ohne gültige Sitzung ist genau
das: sichtbar, aber nicht mehr beschreibbar. Das passt zu „nach einer Weile" und
dazu, dass es im eigenen Tab (erstanbieter-Kontext, Cookie wird gesendet) nicht
auftritt.

**Der Test, der es entscheidet**, gehört in die Hand dessen, der es sieht: Wenn
es wieder klemmt, das Pad über den „im Pad bearbeiten"-Knopf im **eigenen Tab**
öffnen. Geht es dort, ist es der Dritt-Kontext (dann hilft nur serverseitig
`cookie.sameSite: "None"`). Klemmt es dort auch, liegt es am Pad selbst.

**Behelf, der schon eingebaut ist:** Den Ansichts-Wähler einmal durchschalten
lädt den Rahmen neu — „nur Text" setzt `src` auf `about:blank`, zurück auf „beide"
setzt die Pad-Adresse wieder ein, und das ist ein vollständiger Neuaufbau samt
Verbindung. Bewusst **nicht** in den Neu-laden-Knopf gelegt: Dessen Zweck ist,
nach dem Tippen im Pad Spiegel und Diagramm nachzuziehen — würde er dabei den
Rahmen neu laden, verlöre man bei jedem Diagramm-Update die Schreibmarke im Pad.

**Haltung daraus:** Der Rahmen ist zum **Mitlesen** gut; für längeres Schreiben
ist der eigene Tab die verlässliche Fläche, solange das Cookie nicht
serverseitig auf `SameSite=None` steht.

**Nachtrag zu D32 — eigener Strahlenkranz in Petrol statt geteilter Ring.**
Der geteilte Ring mit der Cursor-Zeile war zu leise: „Das erkennt man zu wenig"
(Nutzer). Damit fällt die oben als Preis notierte Zweideutigkeit weg — sie war
das Zugeständnis für die Sparsamkeit, und wenn die Sparsamkeit nicht funktioniert,
ist das Zugeständnis auch nicht mehr zu rechtfertigen.

Gebaut wie der gelbe Kranz aus D28 (Schein nach außen, Füllung bleibt dem Status,
kein Blinken, `z-index:2` gegen das Abschneiden durch später gemalte
Geschwister) — aber **in Petrol, nicht in Gelb**. Die Frage stand ausdrücklich im
Raum („oder würdest du dafür auch das gelbe Leuchten nehmen?"), und die Antwort
ist nein:

- Die beiden bedeuten Verschiedenes und treten **gleichzeitig** auf. Gelb ist eine
  stehende Tatsache über den Plan („seit deinem letzten Besuch live gegangen"),
  Petrol ein Zuruf („schau jetzt hierhin"). Im Pad-Betrieb ist die Kombination der
  Normalfall — man zeigt auf das, was sich geändert hat. Wären beide gelb, könnte
  ein Knoten nicht beides sagen, und bei einem gelben Knoten wüsste niemand mehr,
  welche der beiden Aussagen gemeint ist. Das wäre genau die Verwechslung, die
  dieser Nachtrag behebt, nur mit der anderen Farbe.
- Die Farblogik ist schon vergeben: Petrol ist im Diagramm die Farbe für
  Interaktion und Aufmerksamkeit (Fokusring, Alt-Ring, „scharf"-Ring, günstigster
  Pfad — D18), Gelb die für Status-Neuigkeit. D15 gab Petrol nur für die
  **Gate-Codierung** auf, nicht als Signalfarbe.

**Der Schein ist helles Teal (`#14B8A6`), der Ring dunkles Petrol (`--or`).**
Die erste Fassung nahm für beides `--or` und wirkte trotz identischer Geometrie
leiser als der gelbe Kranz. Der Grund ist nicht Geschmack: Ein **dunkler** Schein
auf weißem Grund liest sich als Schatten, ein **heller** als Licht. Reichweite
kommt daher vom hellen Teal, die Zuordnung zur Akzentfarbe vom dunklen Ring
(3 px, damit er gegen den helleren Schein besteht).

**Gegen die Stationspunkte geprüft, nicht angenommen.** Der günstigste Pfad legt
blasse Petrol-Punkte hinter die Endknoten (D18) — ein petrolfarbener Kranz hätte
damit verschwimmen können. Deshalb wurden zwei Marken gezielt auf Pfad-Endknoten
gesetzt (mit Punkt) und eine daneben (ohne): Der Kranz sitzt eng am Knoten und
hat einen harten Ring, der Stationspunkt ist ein großer blasser Fleck ohne Rand.
Sie sind auseinanderzuhalten.

Kombinationen sind ausbuchstabiert, weil sie real vorkommen: `focusmark.current`
(Tinte innen, Teal außen) und `fresh.focusmark` (Petrol-Ring innen, Gelb außen —
zwei Scheine nach außen gehen nicht, einer muss der Ring sein). Die Regel für
`fresh.focusmark` steht **nach** der für `focusmark.current`: gleiche Spezifität,
und wenn alles drei zutrifft, sollen Zuruf und Neuheit gewinnen, nicht die eigene
Cursor-Zeile.

**Nachtrag zu D31 — Recherche: Wie kann sich die Ansicht von selbst aktualisieren?**
Wunsch: automatisch, mit höchstens ~2 s Verzögerung, „dafür könnte man die
Websockets von Etherpad verwenden". Recherchiert und **gemessen** statt geschätzt;
die Zahlen stammen aus Etherpads `settings.json.template` und aus Versuchen gegen
`pad.hostsharing.net`:

| Befund | Messung |
|---|---|
| `importExportRateLimiting` | `{windowMs: 90000, max: 10}` — 10 Abrufe je 90 s **und IP** |
| `commitRateLimiting` | `{duration: 1, points: 10}` (betrifft Schreiben, nicht uns) |
| `cookie.sameSite` | Voreinstellung `"Lax"` — Ursache der Rahmen-Probleme |
| socket.io | Server v4; `/socket.io/?EIO=4` antwortet `0{"sid":…}`, `EIO=3` wird abgelehnt |
| Pad-**Seite** `/p/<pad>` | **kein** `Access-Control-Allow-Origin` |
| Pad-**Export** `/export/txt` | `Access-Control-Allow-Origin: *` |

Daraus folgt die Kernbeobachtung, die alles andere erklärt: **Der einzige
Endpunkt, den wir fremdstämmig lesen dürfen, ist genau der gedrosselte.**

**Zwei naheliegende Wege sind gemessen versperrt:**

- **Pad-HTML statt Export lesen.** Die Seite enthält den vollen Text in
  `clientVars` und unterliegt dem Export-Limit nicht — aber sie sendet keinen
  CORS-Header, der Browser blockt es. Sackgasse.
- **Eigener Socket zum Pad.** `wss://…/socket.io/?EIO=4&transport=websocket`
  scheitert mit Code 1006 **ohne** `open`. Gegenprobe gegen einen fremden
  Echo-Server aus derselben Seite: `OPEN`, saubere Schließung — die Umgebung kann
  also WebSockets, dieser Server nimmt uns nur nicht. Zugleich verbindet sich das
  **eingebettete** Pad problemlos (nachgewiesen: es übernahm eine von außen
  eingespielte Änderung sofort) — der Unterschied ist der Origin. Warum genau,
  sagt 1006 nicht (Origin-Prüfung, fehlendes Session-Cookie oder ein Proxy, der
  nur gleichstämmig upgradet); alle drei liegen serverseitig, die Folgerung hält
  also unabhängig davon. **Der vorgeschlagene Websocket-Weg scheitert damit nicht
  an unserer Bereitschaft, eine Abhängigkeit aufzunehmen, sondern an der
  Gegenseite** — und die Easysync-Frage (Changesets anwenden) stellt sich gar
  nicht mehr.

**Der Fund, den die Suche gebracht hat:** Es gibt Etherpad-Plugins, die per
`postMessage` mit der einbettenden Seite reden — `ep_iframeinsert` schickt
periodisch `{func:"none", context:"ep_iframeinsert", data:<ganzer Pad-Text>}` ans
Elternfenster (und nimmt umgekehrt `insert`-Befehle an, könnte also sogar
Schreiben aus Werkbaum heraus erlauben); `ep_resize` belegt dasselbe Muster für
Größenänderungen. Das ist der einzige Weg, der **live** ist, **kein** Polling
braucht, das Rate Limit nicht berührt und auf unserer Seite nur einen
`message`-Zuhörer mit Origin-Prüfung kostet — also **keine** neue
Laufzeit-Abhängigkeit. Preis: Das Plugin muss auf der Instanz installiert sein.

**Damit hängt alles an einer einzigen Frage: Kommt man an die Konfiguration der
Pad-Instanz?** Jede der wirksamen Möglichkeiten ist eine Server-Änderung —
Rate Limit höher, Plugin installieren, `cookie.sameSite: "None"`, oder eine
socket.io-CORS-Freigabe. Ohne Zugriff bleibt nur, innerhalb des Budgets zu
pollen: höchstens **einmal je 9 s** (10 je 90 s), und das teilen sich alle
Betrachter hinter derselben IP. Das ist ehrlich machbar, aber es sind nicht die
gewünschten 2 s — und es ist schlechter als der Knopf, sobald mehrere zuschauen.

Die Alternativen stehen als any-of-Gruppe im mitgelieferten Plan
(`examples/werkbaum.werkbaum`, unter „Update by itself"); die beiden
gemessenen Sackgassen als `[-]` mit dem Messergebnis im Kommentar, damit niemand
sie erneut aufmacht. Der günstigste Pfad wählt dort von selbst die
Rate-Limit-Anhebung — die billigste wirksame Änderung.

## D33 — Zeilennummern im Texteditor, gemessen statt gerechnet
Die Warnungen nennen Zeilennummern („Zeile 12: unbekannter Statuscode", SPEC §4)
— und das Textfeld zeigte keine. Man musste abzählen. Der Streifen links vom
Textfeld schließt diese Lücke; sie ist umso spürbarer, je größer der Plan ist
(der mitgelieferte hat 143 Zeilen).

**Ein eigener Kasten neben dem Textfeld, kein Markup im Text.** Ein `<textarea>`
kennt keine Auszeichnung — man kann in seinen Textfluss nichts einfügen. Also
ein zweiter Kasten, der nicht selbst scrollt, sondern gegen `src.scrollTop`
verschoben wird (`translateY`). So kann er nicht auseinanderlaufen: Es gibt nur
eine Scrollposition, nicht zwei.

**Die Zahlen stehen auf gemessenen Höhen, nicht auf „Zeilenhöhe × n".** Der Text
bricht weich um; eine lange Zeile belegt mehrere Bildzeilen, behält aber **eine**
Nummer. Gerechnet liefe der Streifen deshalb schon nach der ersten langen Zeile
davon — im Test bei 375 px Breite brechen 134 der 143 Zeilen um, meist vierfach.
Gemessen wird am **Spiegel-`div`**, das es für das Scrollen beim Sprung schon
gibt (D25): ein Marker je Zeile, einmal schreiben, dann alle `offsetTop` in einem
Durchgang lesen — sonst erzwingt jede einzelne Messung ein eigenes Neu-Layout.

**Dabei fiel ein Fehler im Spiegel auf, der schon D25 betraf.** Der Spiegel bekam
`width = src.clientWidth`, war aber `content-box`: `clientWidth` **enthält** die
Innenabstände, der Spiegel war also um genau 32 px breiter als das Textfeld und
brach später um. Mit `box-sizing:border-box` stimmen die Umbrüche jetzt
nachweislich überein — Zeilen im Spiegel und Bildzeilen im Textfeld ergeben
dieselbe Gesamthöhe (gemessen: 170 Zeilen beide). Vorher war der Sprung zu einer
langen Zeile um die Höhe der übersprungenen Umbrüche daneben.

**Zwei Zeilen heben sich ab: die Cursor-Zeile und Zeilen mit Warnung** (in
`--warn`). Genau die beiden Fälle, für die man in den Streifen sieht. Die
Warnungsmenge kommt aus **derselben** Liste, die im Warnungsbereich steht —
`render()` reicht sie weiter, statt sie ein zweites Mal zu ermitteln; sonst
liefen Text und Streifen irgendwann auseinander.

**Verworfen: `wrap="off"`.** Ohne weichen Umbruch wäre jede logische Zeile genau
eine Bildzeile, die Rechnung trivial und der Spiegel überflüssig. Preis wäre
waagerechtes Scrollen — im schmalen Spiegel neben einem eingebetteten Pad (D31)
oder auf dem Telefon (D17) wäre der Text damit unlesbar. Der Umbruch ist die
wichtigere Eigenschaft.

*(Diese Abwägung ist später umgekehrt worden: **D49** schaltet den Umbruch ab.
Übersehen war, was ein weicher Umbruch mit der **Einrückung** macht — und die
trägt hier die Hierarchie.)*

**Kein Umschalter.** Die Kopfzeile ist eng (D17), und ein Bedienelement kostet
i18n in neun Sprachen für etwas, das keinen Zustand hat, den jemand pflegen
will. Der Streifen ist so schmal wie die Ziffern es verlangen
(`calc(<Stellen>ch + 12px)`), auf dem Telefon sind das 36 px.

**Stolperfalle bei der Prüfung:** Ein programmatisch gesetztes `scrollTop` löst
`scroll` erst im nächsten Bild aus — in einem nicht gezeichneten Tab womöglich
gar nicht. `scrollEditorToOffset()` zieht die Zahlen deshalb selbst gleich mit,
statt sich auf das Ereignis zu verlassen.

**Nachtrag — die Warn-Zahl trägt ihre Meldung als Tooltip.** Der Streifen sagte
bisher nur *dass* eine Zeile eine Warnung hat; *welche*, stand allein unter dem
Diagramm. Das ist der halbe Weg: Man sieht die orange Zahl, sucht dann in der
Liste die passende Zeilennummer und liest dort. Der Tooltip schließt genau
diese Lücke, und er kostet nichts Neues — die Meldung existiert schon, sie wird
nur ein zweites Mal ausgegeben.

**Wörtlich dieselbe Meldung, aus derselben Quelle.** `formatWarning()` ist seit
jeher die eine Stelle, die die Warnungstypen kennt; sie bleibt es. Nur der
**Ausgang** ist ein anderer: Der Warnungsbereich ist HTML, ein `title` ist
Klartext. Deshalb gibt es jetzt `warningText()` daneben, gebaut aus demselben
`switch` mit einem anderen Escaper. Ohne die Trennung stünde im Tooltip
wörtlich `Drag &amp; Drop` — und Labels mit `&`, `<` oder `"` sind keine
Ausnahme, sondern der Alltag (der Prüf-Plan trug „Plan mit "Drag & Drop"“
genau deswegen). Ein zweiter, handgeschriebener Formatierer wäre die
naheliegende Alternative gewesen und die schlechtere: zwei Stellen, die
dieselben elf Typen kennen müssen, und die eine veraltet.

**Mehrere Warnungen einer Zeile stehen untereinander.** Sie sind ohnehin je
eine eigene Meldung (D35 begründet das für `xorConflict`: die Warnung zeigt auf
die Zeile, die man ansehen muss); im Tooltip getrennt durch `\n`, was ein
`title` als einzige Auszeichnung kann. Der Präfix „Zeile 12: “ bleibt darin
stehen, obwohl er neben der Zahl redundant ist: Ihn zu entfernen hieße, eine
lokalisierte Vorlage in neun Sprachen zu zerschneiden — für ein paar
gesparte Zeichen an einer Stelle, an der die Wortgleichheit mit dem
Warnungsbereich mehr wert ist.

**Der Kasten der Warn-Zahl reicht über die ganze Streifenbreite.** Die Zahlen
stehen `position:absolute; right:6px` und sind damit nur so breit wie ihre
Ziffern — auf dem Telefon rund 7 px. Ein Tooltip an einem so kleinen Ziel ist
praktisch nicht zu treffen. Warn-Zahlen bekommen deshalb `left:0;right:0` plus
`padding-right:6px`: Die **Ziffern bleiben punktgenau stehen** (nachgemessen:
rechte Kante 21,14 px, gleichauf mit einer gewöhnlichen Zahl), nur die
unsichtbare Fläche wächst. `cursor:help` sagt, dass es dort etwas zu lesen
gibt — die einzige Auffindbarkeit, die ein Tooltip haben kann (die Lehre aus
D25).

**Kein Ersatz für den Warnungsbereich, und kein Zweitweg für Screenreader.**
Der Streifen ist `aria-hidden` (D33: reine Lesehilfe) — ein `title` darin ist
für einen Screenreader ohnehin nicht da, und das soll so bleiben: Die
Live-Region meldet neue Warnungen von selbst (§9), ein zweiter Kanal läse sie
doppelt vor. Auf Touch gibt es keinen Tooltip; anders als bei den
Knotenbeschreibungen (D52) fehlt dort aber nichts, denn die vollständige
Meldung steht sichtbar unter dem Diagramm.

**Nachgemessen** an einem Plan mit vier Warnungen in drei Zeilen: Die drei
Zahlen tragen genau die vier Meldungen des Warnungsbereichs, Zeile 2 beide
untereinander, `&` und `"` unverfälscht; keine Zahl ohne Warnung trägt einen
`title`. Nach dem Beheben zweier Warnungen verschwinden Klasse **und** Titel
mit (Zeile 3 ganz, Zeile 2 von zwei Meldungen auf eine). Im mitgelieferten
Werkbaum-Plan (941 Zeilen, 155 Knoten, 0 Warnungen): 0 Tooltips.

**Nachtrag 2 — der Zeiger trägt ein Warndreieck, kein Fragezeichen.** Der
Nachtrag oben begründete `cursor:help` damit, es sage, „dass es hier etwas zu
lesen gibt" — richtig, aber zu unbestimmt: Das `?` des Systemzeigers heißt
„Hilfe", und Hilfe ist etwas anderes als eine Warnung. Über der orange
gefärbten Zahl einer fehlerhaften Zeile steht jetzt ⚠ — **dasselbe Zeichen,
das im Warnungsbereich vor jeder Meldung steht**. Der Zeiger sagt damit
dieselbe Sache wie das Ziel, auf das er zeigt, und niemand lernt ein neues
Symbol; dieselbe Sparsamkeit wie bei der Diskrepanz-Marke, die die Statusbox
der Notation spiegelt (D39), und bei der ”-Marke der Beschreibungen (D40).

**Der Pfeil bleibt.** Ein Zeiger, der nur aus einem Dreieck besteht, zeigt auf
nichts — man wüsste nicht mehr, welche Zeile getroffen ist, und das Ziel ist
hier keine 18 px hoch. Gebaut ist er deshalb wie der `help`-Zeiger selbst:
Pfeil plus Abzeichen, nur mit dem Dreieck statt dem `?`. Die Spitze liegt auf
dem Brennpunkt (`1 1`), der Pfeil trägt eine weiße Kontur — der Streifen ist
hell, das Diagramm dahinter nicht überall.

**Ein Bild-Zeiger, und `help` als Rückfall.** `cursor:url(…) 1 1, help` — wo
ein Browser das Bild ablehnt (Größenbeschränkungen, restriktive Umgebungen),
gilt wieder das Bisherige, ohne Sonderfall. Als `data:`-URI im Stylesheet, wie
alles andere auch: kein externer Request (D20), und der Build muss nichts
zusätzlich einbetten. 32 × 32 px, weil größere Zeiger auf manchen Plattformen
stillschweigend verworfen werden.

**Nachgemessen** am echten Selektor (`.lineno-inner span.warn` im laufenden
Streifen): Der berechnete Wert endet auf `1 1, help`, das Bild lädt als
32 × 32. Zur Beurteilung der Lesbarkeit auf ein 32-px-`canvas` gezeichnet und
erst **danach** hochskaliert — ein `<img>` mit SVG-Quelle rastert in seiner
Anzeigegröße, die erste Prüfung zeigte deshalb eine glatte Vorschau statt der
Wahrheit. Bei echter 32-px-Rasterung war das Ausrufezeichen zu dünn (1,8 px)
und ging unter; es steht jetzt auf 2,2 px.

## D34 — Abhängigkeiten, IDs, XOR, Falten, Beschreibungen: erst reserviert, dann gebaut
Fünf Erweiterungen auf einmal — Knoten-**IDs** (`#auth`), **Abhängigkeiten**
(`:#auth,#api`) samt effektivem Status, **XOR** (`x`), ein- und ausklappbare
**Teilbäume** (`>` / `<`) und **Knotenbeschreibungen**. Das ist der größte
Zuwachs an Notation, seit die Sprache steht, und er kommt aus dem Ziel, Lean
Pathfinding vollständig zu unterstützen (docs/LEAN-PATHFINDING.md).

**Entscheidung: alles zuerst nach SPEC §11, nichts vorab gebaut.** Das ist die
Hausregel (CLAUDE.md: „Syntaxänderungen: SPEC zuerst, dann Code"), hat hier aber
einen eigenen Grund: Vier der fünf Erweiterungen belegen Zeichen, und **drei
davon kollidieren mit etwas, das es schon gibt**. Wer eine davon baut, ohne die
Kollision vorher aufzulösen, entscheidet sie stillschweigend mit.

**Was entschieden ist:**

- **Abhängigkeiten sagen etwas über den Status, nicht über die Reihenfolge.**
  Sie legen nicht fest, wann jemand anfangen darf — das trennt Werkbaum von
  einem Netzplan und hält den Baum als Zerlegung lesbar.
- **Der effektive Status wird gerechnet, nie geschrieben.** Im Text steht der
  intrinsische; alles andere gäbe zwei Quellen der Wahrheit für dieselbe
  Aussage (D14: der Text ist das führende Format).
- **Zyklen sind zulässig**, keine Warnung: Sie bedeuten „wird gemeinsam fertig"
  und sind bei sich gegenseitig bedingenden Teilen die ehrliche Aussage. Ein
  Werkzeug, das sie verbietet, zwingt zum Lügen.
- **Faltmarken im Text sind der erste Darstellungs-Hinweis in der Notation.**
  Ansichtszustand (Modus, Zoom, Aufteilung) liegt bisher bewusst **außerhalb**
  des Textes, im localStorage und global über alle Dokumente (D22). `>` bricht
  damit — vertretbar, weil es etwas anderes sagt: nicht „so sehe *ich* das
  gerade", sondern „so wird dieses Dokument **eröffnet**". Das ist eine Aussage
  des Autors über das Dokument, gehört also hinein. Der Betrachter bleibt frei:
  im Diagramm wird danach unabhängig gefaltet.

**Was ausdrücklich offen bleibt** (jeweils in SPEC §11 notiert, damit es
niemand beim Bauen überliest):

- **`#` trägt drei Bedeutungen** — Ticket (`#123`), Schlagwort (`#tag`),
  Knoten-ID (`#auth`). Das Ticket ist numerisch und bleibt unterscheidbar; ID
  und Schlagwort sind formgleich. Solange die Trennregel fehlt, ist auch `#tag`
  blockiert — die ältere Reservierung ist die, die weichen oder sich fügen muss.
- **`x` für XOR** kollidiert nicht beim Parsen (das Zerlegungszeichen steht vor
  der Statusbox), aber `x [x] …` liest sich schlecht.
- **Kurze Beschreibungen können keine eingerückte Folgezeile sein.** Einrückung
  ist in dieser Notation Hierarchie (SPEC §2) — eine eingerückte Zeile *ist* ein
  Kindknoten. Hier liegt die eigentliche Arbeit dieser Erweiterung, nicht im
  Anzeigen eines Tooltips.

**Die Folge, die am weitesten reicht: D18 wird schwerer.** Der günstigste Pfad
rechnet heute rekursiv über den Baum — bei `any of` gewinnt die Alternative mit
den kleinsten Eigenkosten, Gleichstand entscheidet die erste. Mit
Abhängigkeiten zählt nicht mehr der Teilbaum, sondern die **Dependency
Closure**, und gemeinsam benötigte Abhängigkeiten zählen **nur einmal**. Damit
ist die Wahl nicht mehr lokal:

> Eine Gruppe hat die Alternativen `A (S) :#db` und `B (M)`. Für sich genommen
> gewinnt `B`, sobald `#db` mehr als `S` kostet. Wird `#db` aber ohnehin von
> einem erforderlichen Knoten anderswo im Baum gebraucht, ist es bezahlt — die
> **zusätzlichen** Kosten von `A` sind dann nur `S`, und `A` gewinnt.

Was billig ist, hängt also davon ab, was der Rest des Plans schon einkauft; bei
mehreren Alternativgruppen mit geteilten Abhängigkeiten hängen die Wahlen
zusätzlich voneinander ab. Das ist die Bauform eines Überdeckungsproblems und
im Allgemeinen nicht mehr gierig optimal zu lösen. Für die Baumgrößen, um die
es hier geht (ein Plan hat Dutzende, nicht Millionen Knoten), ist eine exakte
Suche machbar; wird sie zu langsam, bleibt die gierige Rechnung — dann aber
**benannt**, nicht stillschweigend. Genau darum steht es hier und nicht erst im
Code.

**Nebenbefund:** `docs/LEAN-PATHFINDING.md` hatte für Abhängigkeiten `→ Feature`
vorgeschlagen (Verweis auf den **Titel**, mit rot gestrichelten Linien). Das ist
mit `:#id` überholt — ein Verweis auf den Titel bricht beim Umbenennen, und Rot
ist in dieser Palette nicht vergeben (SPEC §4 nutzt Pastelltöne für Status,
`--warn` für Hinweise). Die Datei ist entsprechend korrigiert; die dortigen
Phasen bleiben, was sie sind: eine Wunschliste, kein Beschluss.

**Nachtrag — die `#`-Doppelrolle ist aufgelöst, durch Wegfall statt Trennregel.**
Entschieden: **Ticket-Referenzen haben auf `#` Vorrang** — `#123` ist die
etablierte Kurzschreibweise, und oft ist die Ticket-Nummer ohnehin die
natürliche Knoten-ID; die beiden Rollen vertragen sich (numerisch = Ticket als
Heuristik, notfalls Präfix-Konvention wie `#t123`). Knifflig bleibt allein das
heuristische Erzeugen von Taiga-Links — das ist benannt und liegt beim
Taiga-Spike.

**Freie Schlagworte verlassen `#` und gehen auf `&tag`** — als **niedrig
priorisierte Idee**, ausdrücklich ungebaut. Der Schritt zurück („wofür brauchen
wir überhaupt Tags?") ergab: Es gibt bisher keinen Konsumenten. Die
Reservierung stammt aus D7 als Beifang der Kommentarzeichen-Entscheidung; kein
geplantes Feature wertet Schlagworte aus. Ihr einziges echtes Argument ist,
dass der Baum genau **eine** Zerlegung ist — ein Tag benennt eine **Menge** von
Knoten quer dazu (die ID benennt einen, Abhängigkeiten verbinden Paare). Ohne
Auswerter (Filter-/Hervorheben-Linse im Diagramm, Taiga-Label-Sync) sind Tags
nur Kommentare mit Extra-Syntax; `%% frontend` sagt dem Leser heute dasselbe.
Gebaut werden sie deshalb erst **zusammen mit** dem ersten Konsumenten.

Zeichenwahl `&` nach den D32-Kriterien (schnell zu tippen, kollisionsfrei,
keine Markdown-Bedeutung): Shift-Taste auf DE- wie US-Layout, nie ein Dead-Key
— anders als `~`, das auf deutschen Macs hinter Alt+N klemmt und mit
Zirka-Angaben („~3 Wochen") kollidiert. „R&D" und „Drag & Drop" bleiben durch
die Alleinstehend-Regel (wie `!!!`) Labels. Der Einwand „`&` heißt und" trägt
nicht: Das Und der Notation ist `-` am Zeilenanfang — `&` ist gerade deshalb
frei. Verworfen: `$` (Preis-Kollision), `%` (ein Tippfehler vom
Auskommentieren), `:` (zu nah an `:#…`), `§` (fehlt auf US-Tastaturen), `*`
(Markdown, schon in D29 verworfen).

**Nachtrag — Ticket-Kennungen sind auch alphanumerisch; die
Numerik-Heuristik ist gestrichen.** Der ältere Nachtrag oben nahm an, als
Ticket-Link genüge heuristisch das rein numerische `#123`. Das trägt nicht:
Taiga schreibt `#US-123` für eine User Story, Jira `#ABC-123` — Kennungen
sind alphanumerisch (Nutzer-Hinweis). Statt die Form-Heuristik auszuweiten
(jedes `GROSS-123` als Ticket zu raten, kollidierte mit gewöhnlichen
Knoten-IDs), wird ein Token künftig am **Muster des angebundenen Trackers**
erkannt — konfigurierbar je Integration, z. B. `US-\d+` und `\d+` bei Taiga.
Die Zeichenmenge der Knoten-ID (§1: Buchstaben, Ziffern, `.`, `_`, `-`)
deckt solche Kennungen bereits ab; am Parser ändert sich nichts, die
Festlegung des Musters liegt beim Taiga-Spike. SPEC §11 ist entsprechend
umformuliert.

**Nachtrag — das XOR-Zeichen ist entschieden: `=`.** Das in §11 zunächst
vorgeschlagene `x` ist verworfen; ausschlaggebend war, **wann** seine
Glyph-Kollision auftritt: `x` teilt sich das Zeichen mit dem Statuscode für
*fertig*, und genau eine Alternative einer XOR-Gruppe **soll** fertig werden —
`x [x] …` wäre also der Endzustand jeder entschiedenen Gruppe und stünde
dauerhaft in jedem Plan. Dazu kam ein zweiter, bis dahin unbenannter Befund:
Das Zerlegungszeichen wird ohne erzwungenes Leerzeichen erkannt (`\s*` in der
Referenz-Regex darf leer sein); ein Buchstabe als Gate frisst damit
Label-Anfänge (`XSS-Schutz` → Gate `X`, Label „SS-Schutz“).

`=` ist der einzige Kandidat **ohne jede** Kollision: kein Statuscode, kein
reserviertes Zeichen, keine Markdown-Bedeutung an dieser Position, auf DE-
(Shift+0) wie US-Layout (eigene Taste) direkt tippbar, nirgends Dead-Key. Seine
beiden Schwächen sind benannt und akzeptiert:

- **Die Mnemonik trägt sich nicht selbst** („genau eine“ muss die Legende
  sagen) — aber das gilt für `|` („mindestens eine“) genauso; jedes Gate steht
  ohnehin in der Legende.
- **Optisch steht `=` neben der konjunktiven Familie** (ein doppeltes `-`),
  gehört aber semantisch zu `|`. Dagegen arbeiten zwei Mechanismen: Im Diagramm
  bleiben die Linien gestrichelt-grau wie bei any-of (das Bild korrigiert die
  Lesart sofort), und jede Mischung mit `=` in einer Gruppe gibt die
  `mixedGate`-Warnung.

Die **Leerraum-Regel** (Gate `=` nur mit folgendem Leerraum, §11) ist die
erste ihrer Art; sie hält Labels wie `=SUMME(A1:B2)` heraus und wäre bei jedem
der Kandidaten nötig gewesen.

**Verworfene Kandidaten**, je am entscheidenden Kriterium gescheitert:

- **`x`** — siehe oben; die XOR-Mnemonik (für Informatiker stark) wiegt die
  dauerhafte `x [x]`-Paarung nicht auf.
- **`^`** — XOR in C/Python, aber der Dead-Key schlechthin auf deutschen
  Tastaturen (nicht nur Mac); ihn zu nehmen widerspräche dem im
  `&tag`-Nachtrag festgehaltenen Kriterium. Zudem dieselbe Endzustands-
  Kollision wie `x`, nur mit `[^]`: Per D30 befördert der Deploy die gewählte
  Alternative auf `[^]` — `^ [^] …` stünde ausgerechnet im Vorzeigedokument.
- **`|1`** (Zweizeichen-Gate in der Pipe-Familie, „genau 1“) — semantisch die
  ehrlichste Form und kollisionsfrei, dem Nutzer aber schlicht nicht gefällig;
  Geschmack ist bei einem Zeichen, das man täglich tippt, ein zulässiges
  Kriterium.
- **`/`** — das Alltags-Entweder/Oder (ja/nein, m/w/d); teilt sich die Glyphe
  mit `[/]` *Durchstich* (immerhin nur ein Durchgangszustand) und mit
  Pfad-Labels (`/api/…`).
- **`⊕`** — das echte XOR-Symbol, aber ohne Zeichenpicker auf keiner Tastatur
  tippbar; der Moment des Tippens ist der Moment, in dem man nicht über Syntax
  nachdenken will (D32).
- **`°`** — fehlt auf US-Layouts, und der kleine Kreis kollidierte semantisch
  mit dem hohlen Kreis, der im Diagramm bereits *optional* bedeutet (D29).

**Nachtrag — die Faltmarken sind entschieden: hinter dem Gate, Export folgt
der Faltung.** Die beiden in §11 offenen Fragen zu `>` / `<`:

**Stellung: hinter dem Zerlegungszeichen, vor der Statusbox** —
`- > [x] Backend`, nicht `> - [x] Backend`. Der Grund ist visuell, nicht
technisch: Die **Spalte der Zerlegungszeichen** ist das, woran das Auge die
Hierarchie abliest. Stünde `>` davor, rückte das `-` der gefalteten Zeile
gegenüber seinen Geschwistern um zwei Zeichen ein — die Gate-Spalte zerfiele
genau an den Stellen, die man gerade aufgeräumt hat. Hinter dem Gate
verschiebt sich nur die Statusbox, und die trägt keine
Ausrichtungs-Information. Dazu kommt: `>` am Zeilenanfang ist die
Markdown-Blockquote-Konvention und würde falsch gelesen (dieselbe Sorte
Kollision, wegen der D29 `*` verwarf — Markdown-Betonung). Wurzelknoten haben
kein Gate — dort steht die Marke am Zeilenanfang; Wurzeln sind selten, und
die Regel „hinter dem Zeichen“ bleibt trotzdem einheitlich formulierbar.

*(Der Satz „die Statusbox trägt keine Ausrichtungs-Information“ ist falsch —
sie trägt sie sehr wohl. Korrigiert in Nachtrag 2 am Ende dieses Eintrags;
die Stellung ist jetzt hinter der Statusbox.)*

**Export und Druck folgen der sichtbar eingeklappten Struktur — mit
Kennzeichnung.** Der Präzedenzfall steht in §9: „Es wird genau die sichtbare
Struktur exportiert (der ‚verworfene einblenden‘-Filter wirkt auch hier).“
Dieselbe Regel für die Faltung ist konsistent und praktisch richtig: Wer für
eine Präsentation die Detailebenen zuklappt, will genau dieses Bild teilen.
Der geprüfte Einwand: Der interaktive Faltzustand ist *persönlicher*
Ansichtszustand, und Persönliches (Cursor-Ring, gelber Kranz, Fokusmarke —
D25/D28/D32) wird bewusst **nicht** exportiert. Der Unterschied: Jene Marken
sagen „schau hin“ bzw. „für dich neu“ — eine Aussage über den Betrachter.
Faltung sagt „diese Detailtiefe“ — eine Aussage über das Bild, das der
Exportierende zeigen will. Damit das Bild dabei nicht lügt, wird ein
eingeklappter Knoten sichtbar gekennzeichnet (etwa „▸“ oder die Anzahl der
verborgenen Kinder); die genaue Form entscheidet sich beim Bauen, die
SPEC-Aussage ist nur: sichtbare Struktur, Einklappung gekennzeichnet.

**Nachtrag — die Knotenbeschreibungen sind entschieden: `"`-Zeilen und ein
`---`-Beschreibungsteil.** Die letzte offene Schreibweise der fünf
Erweiterungen. Entschieden vom Nutzer in zwei Schritten:

**Kurzform: eine neue Zeile mit `"`.** Ein eigenes einleitendes Zeichen war
die einzige Möglichkeit — Einrückung bedeutet Hierarchie (§2), eine
eingerückte Folgezeile ist ein Kindknoten. `"` liest sich als Zitat („was der
Autor dazu sagt“), ist auf DE- (Shift+2) wie US-Layout direkt tippbar und an
dieser Position frei. Die Leerraum-Regel (wie `=`, `>`/`<`) hält gequotete
Labels (`"Zitat"`) heraus; auf Zeilen mit Zerlegungszeichen gilt das Zeichen
nicht, ein `- " Zitat" …`-Label bleibt also unberührt.

**Langform: hinter einem `---`-Trenner, nur mit Einrückung — ohne weitere
Zeichen.** Vorgeschlagen waren zeilenweise `"`-Präfixe (robust, aber lästig
beim Einfügen längerer Texte) und ein `"""`-Zaun (einfügefreundlich, aber ein
vergessener Schlusszaun verschluckte den Rest des Dokuments — der hässlichste
Fehlermodus in einem bis dahin zeilenlokalen Format). Der Nutzer wählte die
dritte, bessere Form: **ein `---`-Trenner nach YAML-/Frontmatter-Vorbild**
beendet den Baumteil; dahinter eröffnen ID-Zeilen (`#auth`) Blöcke, deren
eingerückte Zeilen der Text sind. Das nimmt dem Zaun beide Schwächen
zugleich: Es gibt **keinen Schlusszaun, den man vergessen könnte** (der
Beschreibungsteil läuft planmäßig bis zum Dateiende), und der Parser-Zustand
ist ein einziger Einweg-Schalter statt offen/zu. Die Wurzelknoten-Regel gilt
hinter dem Trenner nicht mehr — darum braucht dort keine Zeile ein Zeichen.

Der Fehlermodus „versehentlicher Trenner mitten im Plan“ ist bewusst laut
gemacht: Uneingerückte Nicht-ID-Zeilen und verwaiste eingerückte Zeilen im
Beschreibungsteil geben je eine Warnung mit Zeilennummer — verschluckte
Knotenzeilen melden sich also zeilengenau selbst, statt still zu
verschwinden (dieselbe Haltung wie bei `unknownStatus`, §4).

Zwei bewusste Verhaltensänderungen, beide dokumentiert (§11): `---` ergab
bisher einen Knoten mit Label `--`, und eine zeichenlose Zeile, die mit
`" ` beginnt, war bisher ein Wurzelknoten mit `"`-Label.

**Nachtrag 2 — die Faltmarke rückt hinter die Statusbox: `- [x] > Backend`.**
Der erste Nachtrag oben stellte sie zwischen Zeichen und Box und begründete
das damit, dass sich dabei „nur die Statusbox verschiebt, und die trägt keine
Ausrichtungs-Information“. **Dieser Satz ist falsch**, und der Fehler war im
Text nicht zu sehen, sondern erst im gefalteten Plan: Die Marke ist zwei
Zeichen breit — genau eine Einrückungsstufe. Die Box einer gefalteten Zeile
rückt dadurch exakt in die Spalte der Boxen ihrer **eigenen Kinder**:

```
  - > [ ] erster Schritt        %% Box bei Spalte 6
    - [ ] Schritt 1a            %% Box bei Spalte 6  ← dieselbe Spalte
```

Die Box-Spalte ist damit sehr wohl Ausrichtungs-Information: Sie ist die
zweite Spalte, an der das Auge die Ebene abliest, und der Fehler tritt
ausgerechnet dort auf, wo man ohnehin schon weniger sieht — an einem
eingeklappten Knoten, dessen Kinder gerade verborgen sind. Hinter der Box
steht die Marke dagegen vor dem **Label**, und Labels sind ohnehin ausgefranst
(unterschiedlich lange IDs, Größen, Tags) — dort kostet eine Verschiebung
nichts:

```
  - [ ] > erster Schritt
    - [ ] Schritt 1a
```

**Die Begründung des ersten Nachtrags bleibt im Übrigen gültig:** Die
Gate-Spalte ist der wichtigste Anker, `>` davor (`> - [x] …`) bliebe falsch,
und die Markdown-Blockquote-Kollision am Zeilenanfang ebenfalls. Die neue
Stellung greift keines der beiden an — sie verschiebt die Marke nur um eine
Position weiter nach rechts.

**Nebengewinn: Die Regel wird einfacher, nicht komplizierter.** Bisher hieß
sie „zwischen Zeichen und Statusbox, bei Wurzelknoten am Zeilenanfang“ — mit
einer Ausnahme für Wurzeln. Jetzt heißt sie **„unmittelbar vor dem Label“**,
und das gilt ohne Ausnahme: Fehlt die Statusbox, rückt die Marke von selbst an
deren Stelle; fehlen Box und Zeichen (Wurzelknoten), steht sie am
Zeilenanfang. Für Zeilen **ohne** Statusbox ändert sich dadurch gar nichts.

**Die alte Stellung wird weiter gelesen, aber nie mehr geschrieben.** Ein
harter Schnitt wäre vertretbar gewesen — die Faltmarken sind wenige Wochen alt
—, aber er träfe genau die Dokumente, die wir **nicht** migrieren können:
Pads (D31) und `?sourceUrl=`-Quellen (D23) liegen auf fremden Servern. Der
Parser hat deshalb zwei Marken-Gruppen (die erste gewinnt), `setFoldMark()`
schreibt immer die neue und löst eine alte dabei auf. Die Toleranz kostet eine
optionale Gruppe im Regex und eine Zeile in der SPEC; die Zeile *muss* dort
stehen, sonst ist die alte Schreibweise stillschweigend geduldete Magie statt
dokumentiertes Verhalten.

**Der Preis, benannt:** Die Marke steht jetzt direkt vor dem Label, also dort,
wo ein Label anfangen kann. Ein Label wie `> 100 Nutzer` wird zur Marke plus
`100 Nutzer`. Neu ist das nicht — für Zeilen ohne Statusbox galt es schon
immer —, aber es ist jetzt der Regelfall statt der Ausnahme. Der Ausweg ist
derselbe wie bei `=SUMME(A1:B2)` (D34): kein Leerzeichen, also `>100 Nutzer`.

Migriert sind die drei Marken in `docs/examples/werkbaum.werkbaum`, die eine
im `INITIAL`-Beispiel und das Beispiel in `llms.md`; die Legenden-Zeile
`hint_fold` nennt die neue Form in allen neun Sprachen.

## D35 — XOR (`=`) umgesetzt: „realisiert“ definiert, „1“-Plakette, keine neue Linienart
Das in D34 entschiedene XOR-Gate ist gebaut (SPEC §1/§3/§9); beim Bauen waren
drei Dinge zu entscheiden, die die SPEC bis dahin offen ließ:

**„Realisiert“ heißt: Kosten investiert oder mehr** — Status `[~]`, `[/]`,
`[x]`, `[^]`. Die XOR-Regel („genau eine Alternative darf realisiert werden“)
soll genau dann anschlagen, wenn der Plan tatsächlich doppelt einkauft — und
das beginnt mit `[~]`: Wer an zwei Alternativen zugleich **arbeitet**, verletzt
das „genau eine“ bereits, nicht erst beim zweiten `[x]`. `[?]`, `[ ]` und `[!]`
sind Absicht ohne Investition, `[-]` ist die Entscheidung dagegen, neutral sagt
nichts — alle fünf zählen nicht. Gemeldet wird **jede weitere** realisierte
Alternative einzeln (Warnung `xorConflict` mit ihrer Zeilennummer und ihrem
Label): Die Meldung zeigt so auf die Zeile, die man ansehen muss, statt
pauschal auf die Gruppe. Bewusst eine **Warnung, kein Fehler** — die Notation
bleibt fehlertolerant (§4), der Baum wird unverändert dargestellt.

**Kennzeichnung: „1“-Plakette am Austritt der Sammelleiste.** Der D34-Nachtrag
hielt fest, dass `=` optisch bei der konjunktiven Familie steht und das
Diagramm die Lesart korrigieren muss. Die Linien übernehmen das schon
(gestrichelt grau wie any-of); die Plakette — kleiner weißer Kreis, graue
Ziffer, auf dem Leitungsstück zwischen Elternknoten und erstem Abzweig — sagt
das „genau eine“, das der Linienstil allein nicht sagen kann. Grau statt
Petrol, weil sie zur Gate-Codierung gehört (D15: keine Signalfarbe im
Diagramm); an der Sammelleiste statt am Knoten, weil sie eine Aussage über die
**Gruppe** ist und die Knoten-Ecken belegt sind (D18). Sie erscheint auch im
Grafikexport (dort nach den Knoten gezeichnet, wie der Optional-Kreis aus D29).

**Keine neue Linienart, keine neue CSS-Familie:** Der Renderer gibt
XOR-Gruppen als `<ul class="or xor">` aus — die gesamte any-of-Geometrie
(alle drei Modi, D18-Sonderfälle, Export-Routing) gilt damit automatisch;
`.xor` ergänzt nur die Plakette. Die Alternative — ein eigener Gruppentyp mit
kopierten Regeln — hätte jede künftige Layoutänderung doppelt pflegen lassen.
Im Modell ist `'xor'` ein eigener Gate-Wert (`gateOf`), damit die
`mixedGate`-Warnung Mischungen mit `|` von selbst meldet; alle
Disjunktiv-Abfragen prüfen `!== 'and'`.

## D36 — Knoten-IDs (`#auth`) umgesetzt: eng gefasst, sichtbar nur im Tooltip
Der erste Baustein der Phase-4-Kette (ohne IDs keine Abhängigkeiten, ohne die
kein effektiver Status). Vier Festlegungen, die §11 offen ließ:

**Zeichenmenge wie `@name`, nicht „whitespace-frei“.** §11 sagte „ein
whitespace-freier Bezeichner“; umgesetzt ist die engere Menge aus §7
(Unicode-Buchstaben, Ziffern, `.`, `_`, `-`). Drei Gründe: Konsistenz mit den
beiden Nachbarn (`@name` heute, `&tag` reserviert mit derselben Menge, D34);
ein `#a/b` oder `#a:b` liefe sonst in dieselben Kollisionen, vor denen §11 bei
`:` und Pfaden gerade ausweicht; und enger → weiter ist später kompatibel
möglich, umgekehrt nicht.

**Nur alleinstehend angesetzt** (`(^|\s)#…`, wie beim reservierten `&tag`):
„C#“ bleibt ein Label, und — entscheidend für den nächsten Schritt — die
Abhängigkeits-Schreibweise `:#a,#b` wird **nicht** als ID gefressen, weil dort
`:` bzw. `,` vor dem `#` steht. Die ID-Extraktion muss beim Bau der
Abhängigkeiten also nicht angefasst werden.

**Das erste Token ist die ID, weitere bleiben im Label.** Die ID benennt genau
einen Knoten — mehr als eine pro Zeile ergibt keinen Sinn. Alles nach dem
ersten Treffer bleibt unangetastet stehen, denn dort wohnt die reservierte
Ticket-Referenz (`… #123 …`, §11): Sie soll sichtbar im Label bleiben, bis das
Taiga-Feature sie auflöst. Deshalb wurden auch die drei `#`-Vorkommen im
mitgelieferten Plan eingeklammert (`(#auth)`, `(#123)`) — als Erwähnungen sind
sie keine IDs, und `#123` wäre sonst doppelt vergeben gewesen (Zeile 25/162).

**Sichtbar im Tooltip und `aria-label`, sonst nirgends.** Die ID gehört nicht
zum Label (sonst änderte das spätere Entfernen die Knoten-Identität der
„Was ist neu?“-Anzeige, D28). Ganz unsichtbar wäre aber nutzerfeindlich —
getippter Text verschwände spurlos. Der Tooltip zeigt `#id` als erste Zeile,
der Screenreader bekommt `a11yId`; ein eigenes Badge bekommt sie erst, wenn
etwas darauf zeigt (Querverbindungen, §11) — die Knoten-Ecken sind belegt
(D18).

**Doppelte ID: Warnung an der späteren Zeile, mit Nennung der ersten.** Die
Meldung zeigt dorthin, wo man eingreifen muss, und `{firstLine}` erspart das
Suchen. Die spätere ID gilt trotzdem am Knoten (fehlertolerant wie §4);
welcher Knoten bei Verweisen „gewinnt“, entscheidet erst die
Abhängigkeits-Auflösung — dort ist die Warnung dann schon da. Eine Zeile, die
**nur** aus einer ID besteht, wird wie jede leere Zeile ignoriert und belegt
die ID nicht.

**Nachtrag — die übliche Stellung ist vor dem Titel, mit trennendem
Doppelpunkt: `#auth: Backend`.** Die Stellung war frei und blieb es auch; was
fehlte, war eine **Konvention**. In den Beispielen stand die ID mal hinten
(`Documents on the server #docs (L)`), mal irgendwo dazwischen — lesbar, aber
ohne feste Stelle, an der das Auge sie sucht. Vorn ist sie dort, wo sie
hingehört: Sie **benennt** den Knoten, und der Titel ist die Erläuterung dazu.
Damit liest sich eine Zeile wie ein Wörterbucheintrag, und Zeilen mit ID
richten sich untereinander aus.

**Der Doppelpunkt ist optional und reines Trennzeichen.** Ohne ihn stünden
zwei Bezeichner unmittelbar nebeneinander (`#auth Backend`) — das liest sich
wie ein zweiteiliger Name, nicht wie Adresse plus Titel. Er gehört weder zur
ID noch zum Label und wird nie gerendert; im Diagramm steht genau wie bisher
nur der Titel. Ein Werkzeug, das ihn als Teil der ID führte, machte aus
`#auth` und `#auth:` zwei verschiedene Adressen — deshalb fällt er beim Parsen
weg, nicht erst beim Anzeigen.

**Geschluckt wird er nur mit folgendem Leerraum oder Zeilenende** — dieselbe
Leerraum-Regel wie bei `=`, `>`/`<` und `"` (D34), hier aber mit einem
konkreten Grund: `#auth:#db` bliebe sonst nicht als ID plus Abhängigkeit
erhalten. Mit der Regel liest der Parser dort `#auth` als ID, lässt den
Doppelpunkt stehen, und die Abhängigkeits-Extraktion (§1, Schritt 7) findet
`:#db` — genau wie ohne die Neuerung. Ein Doppelpunkt **im Titel** bleibt
ebenfalls unangetastet: `#auth: Regel: nur mit Token` ergibt das Label
„Regel: nur mit Token“, weil nur der **unmittelbar** an die ID anschließende
Doppelpunkt gemeint ist.

**Die ID-Erkennung selbst ist unverändert geblieben** — die Doppelpunkt-Gruppe
im Regex ist optional und verlangt nichts. Ein zusätzlich verlangtes
`(?=\s|$)` **hinter der ID** wäre der naheliegende, aber falsche Weg gewesen:
Es hätte bestehende Zeilen umgedeutet, weil der Ausdruck bei einem Fehlschlag
weiterwandert und dann ein *späteres* `#`-Token zur ID erklärt hätte.

Im **Beschreibungsteil** (`---`, §1) ist ein angehängter Doppelpunkt ebenfalls
zugelassen (`#auth:` als Block-Kopf). Dort folgt kein Titel, die Konvention
greift also nicht — aber wer sie gewohnt ist, soll nicht über eine
`descStray`-Warnung stolpern. Die mitgelieferten Beispiele schreiben
Block-Köpfe weiterhin ohne Doppelpunkt.

Umgestellt sind alle mitgelieferten Beispiele (`docs/examples/`, das
`INITIAL`-Dokument und das Beispiel in `llms.md`); SPEC §10 hat keine IDs und
bleibt unberührt. Die Legenden-Zeile `hint_id` nennt die neue Form in allen
neun Sprachen.

## D37 — Abhängigkeiten (`:#a,#b`) geparst: ein Token, alleinstehend, IDs als Strings
Der zweite Baustein der Phase-4-Kette. Gebaut ist die **Schreibweise** (SPEC
§1); die Konsumenten — effektiver Status, Querverbindungen, Closure-Rechnung —
bleiben eigene Schritte (§11). Vier Festlegungen:

**Die Liste ist ein zusammenhängendes Token, ohne Leerraum.** `:#a,#b` — jede
ID mit `#`, kommagetrennt, kein Leerzeichen. Das ist die wörtliche Lesart von
§11 („Doppelpunkt mit unmittelbar folgendem `#`“) und macht das Zeilenformat
robust: Wo das Token endet, beginnt wieder gewöhnlicher Text. Der bekannte
Stolperstein steht in der SPEC: `:#a, #b` liest nur `#a`, und das ` #b`
dahinter ist ein alleinstehendes Token — also die Knoten-ID. Ein Rest wie ein
verwaistes `,b` bleibt sichtbar im Label stehen und verrät den Tippfehler,
statt verschluckt zu werden.

**Nur alleinstehend angesetzt** (`(^|\s):#…`) — **enger als §11**, das nur den
folgenden `#` verlangte. Der Ausschlag: die **Zitier-Konvention**. Bei den IDs
(D36) wurden Erwähnungen im mitgelieferten Plan eingeklammert (`(#auth)`), und
genau das muss auch für Abhängigkeiten funktionieren — `(:#auth,#api)` als
Erwähnung im Label wäre mit der reinen `:#`-Regel trotzdem geparst worden
(die Klammer steht ja vor dem `:`, nicht vor dem `#`). Mit der
Alleinstehend-Regel schützen Klammern einheitlich alles: `(#auth)`,
`(:#a,#b)`, künftig `(&tag)`. Nebeneffekt: Konstrukte wie `1:#2` im Label
bleiben Label.

**`deps` sind ID-Strings, keine Knoten-Referenzen.** Der Parser prüft nur
**Existenz** (`unknownDep` je fehlender ID, an der Zeile des abhängigen
Knotens); aufgelöst wird erst beim Konsumenten. So bleibt der Parse-Baum
serialisierbar und die Auflösungsfragen (doppelte IDs — die `duplicateId`-
Warnung steht dann schon da) liegen dort, wo sie beantwortet werden können.
**Zyklen werden bewusst nicht einmal erkannt**: Sie sind zulässig (§1/D34,
„wird gemeinsam fertig“), eine Zyklenprüfung hätte also keinen Abnehmer —
auch die Selbst-Abhängigkeit ist stumm.

**Sichtbar als `→ #a, #b` im Tooltip und als `a11yDeps` im `aria-label`** —
dieselbe Zurückhaltung wie bei den IDs (D36): keine eigene Diagramm-
Darstellung, bis die Querverbindungen (§11) gebaut sind; der Pfeil im Tooltip
sagt die Richtung („hängt ab von“), ohne ein neues Zeichen einzuführen.

## D38 — Faltmarken gebaut: `<` wandert die Faltung hinunter, Eingriffe sind flüchtig
Die in D34 entschiedene Schreibweise (`- [x] > …`, Export folgt der Faltung)
ist umgesetzt (SPEC §1/§9). Die Bau-Entscheidungen:

**`<` holt seinen Teilbaum hervor, indem die Faltung die Pfad-Ebenen
hinunterwandert.** Die naive Lesart — `<` öffnet einfach alle Vorfahren —
machte das `>` am Vorfahren wirkungslos: Öffnen zeigt **alle** Kinder samt
Teilbäumen, nicht den einen gemeinten. Die andere naheliegende Lesart — nur
den Pfad einblenden, alles andere desselben Vorfahren verbergen — bräuchte
Knoten, die ohne ihre sichtbaren Eltern gezeichnet werden, oder Kanten, die
Ebenen überspringen: Beides log über die Struktur (dieselbe Sorte Fehler, die
D29 beim Treppen-Export korrigiert hat). Das Hinunterwandern vermeidet beides:
Der eingeklappte Vorfahr öffnet sich, seine **übrigen** Kinder werden
stattdessen eingeklappt — sichtbar ist der Pfad samt Teilbaum, die Geschwister
stehen als je ein Knoten mit „▸ n“ da, und jede gezeichnete Kante ist eine
echte. Ein `>` innerhalb des hervorgeholten Teilbaums bleibt respektiert.
Ausdrückbar ist das alles in einem schlichten Je-Knoten-Zustand
(`initialCollapsed()` in model.js, headless getestet).

**Auch die Fokusmarke `!!!` holt sich hervor** — über denselben Mechanismus
(sie geht als zweite Rettungsmarke in `initialCollapsed()` ein). Ein
Zeigefinger auf etwas Unsichtbares zeigte ins Leere; und weil Nutzer-Eingriffe
den Anfangszustand **überlagern**, kann man den Bereich danach trotzdem wieder
zuklappen — die Marke reißt ihn nicht bei jedem Neubau wieder auf.

**Interaktive Eingriffe: je Knoten, Label-Pfad-Identität, nur für die
Sitzung.** Der Baum wird bei jedem Tastendruck neu geparst — ein Eingriff muss
Neu-Renderings überleben, also hängt er nicht am Knotenobjekt, sondern am
**Label-Pfad** (dieselbe Identität wie „Was ist neu?“, D28: Umsortieren
überlebt, Umbenennen gilt als neuer Knoten). **Nicht persistiert**: Die
dauerhafte Aussage über den Anfangszustand steht im Text (D34 — „so wird
dieses Dokument eröffnet“); der localStorage-Ansichtszustand ist zudem global
über alle Dokumente (D22), ein Je-Dokument-Faltzustand wäre dort ein
Fremdkörper. Dokumentwechsel setzt zurück.

**Bedienung: Falt-Zeichen ▾/„▸ n“ vor dem Label, Pfeiltasten ←/→.** Der
einfache Klick ist der Link (§6), Alt+Klick der Sprung (D25), der lange Druck
ebenso — für das Falten blieb nur ein eigenes Klickziel oder eine weitere
Modifier-Geste; das sichtbare Zeichen ist zugleich die Auffindbarkeit (die
Lehre aus D25: eine Geste, die niemand sieht, ist keine Funktion). ←/→ am
fokussierten Knoten ist das WAI-ARIA-Baum-Idiom; Enter bleibt dem Link,
Alt+Enter dem Sprung. Der Zähler nennt **alle** verborgenen Knoten (nicht nur
die direkten Kinder) — er sagt, wie viel Plan dort zusammengefaltet liegt.
Nach dem Umklappen wird der Fokus auf denselben Knoten zurückgesetzt (der
Neubau hätte ihn sonst verschluckt und die Tastaturbedienung abgerissen).

**Faltung ist reine Ansicht — mit zwei bewussten Konsequenzen.** Warnungen
aus eingeklappten Teilbäumen werden weiter gemeldet: `renderChildren()`
überspringt nur das HTML, ein eigener Lauf (`walkFolded`) sammelt Warnungen
und zählt zugleich die verborgenen Knoten — sonst verschwände eine
`mixedGate`-Meldung je nach Faltzustand, obwohl sie den **Text** betrifft.
Und der günstigste Pfad rechnet unverändert über den ganzen Baum; seine
Spline-Linie läuft ohnehin nur durch DOM-Knoten, führt also durch die
sichtbaren Endknoten. Ein eingeklappter Zweig kann Pfadknoten verbergen —
hinnehmbar, die Inversion an den sichtbaren Knoten bleibt richtig.
**Das war falsch — siehe den Nachtrag am Ende dieses Eintrags.**

**Export und Druck:** Verborgene Kinder stehen nicht im DOM — Export,
Stiel-Messung, Treppe und Pfadlinie sind damit ohne Zusatzcode konsistent
(derselbe Grund, aus dem der Renderer sie gar nicht erst erzeugt, statt sie
per CSS zu verstecken). Die Kennzeichnung „▸ n“ ist Teil des Knotentexts und
wandert von selbst in den SVG-Export; das ▾ offener Knoten wird dort und im
Druck entfernt — es ist Bedienelement, keine Aussage über den Plan.

**Nachtrag 2 — Umklappen im Diagramm schreibt jetzt in den Text.** Damit wird
die oben getroffene Festlegung („der Eingriff gilt für die Sitzung; er wird
nicht gespeichert — die dauerhafte Aussage steht im Text") **umgekehrt**, und
mit ihr die D34-Formulierung, die Marken bestimmten nur den Anfangszustand.
Anlass ist der Wunsch nach bidirektionaler Interaktion zwischen Diagramm und
Text; der Faltzustand ist dafür der richtige erste Fall: verlustfrei umkehrbar,
ohne inhaltliche Aussage, und die Notation dafür gibt es schon.

Die Entscheidungen im Einzelnen, alle vom Nutzer getroffen:

- **Bei jedem Umschalten**, nicht auf Ansage. Der direkteste Zusammenhang
  zwischen Bild und Text; der Preis (unten) wurde bewusst in Kauf genommen.
- **`<` bleibt erhalten, wo es noch stimmt.** Nicht auf reine `>`
  normalisieren: Handgeschriebene Marken sollen stehen bleiben.
- **Geschrieben wird, wo der Text beschreibbar ist** — auch bei `?sourceUrl=`,
  wo es wie jede lokale Änderung bis zum nächsten Laden hält (D23). Nur beim
  Pad bleibt es sitzungsweise, weil das Textfeld dort schreibgeschützt ist
  (D31).
- **Falten gilt als Änderung.** Ein mitgeliefertes Dokument wird dadurch als
  bearbeitet geführt, bekommt also keine neuen Fassungen mehr und zeigt
  „Original wiederherstellen" (D27). Bewusst keine Sonderregel: Wer faltet,
  ändert den Text, und der Text ist der Vertrag (D14).
- **Undo-fähig geschrieben.** Nachgemessen: `value =` **und** `setRangeText`
  machen Strg+Z wirkungslos — wer tippt und dann faltet, käme an sein
  Getipptes nicht mehr heran. Nur `document.execCommand('insertText')` erhält
  die Historie; die API gilt als veraltet, funktioniert aber überall. Falten
  ist damit ein eigener Undo-Schritt (geprüft: Strg+Z nimmt die Faltung
  zurück, ein zweites das Getippte).

**Das Verfahren: minimal patchen, dann nachrechnen.** Die Ableitung Text →
Zustand ist **nicht umkehrbar** — mehrere Markensätze ergeben denselben
Zustand, und `<` erzeugt Faltungen an Knoten, die gar keine Marke tragen
(oben). Statt sie zu invertieren, wird der Kandidat schlicht **befragt**:
`>` an der einen Zeile setzen oder entfernen, `initialCollapsed()` darauf
laufen lassen, mit dem Sollzustand vergleichen. Stimmt es, bleibt alles andere
unangetastet — das ist der `<`-Erhalt. Stimmt es nicht, werden alle Marken neu
gesetzt und erneut geprüft. Stimmt auch das nicht — etwa weil ein `!!!` seinen
Knoten immer wieder hervorholt und „eingeklappt" dort gar nicht ausdrückbar
ist —, wird **nicht geschrieben** und die Sitzungs-Überlagerung bleibt stehen.
So kann nie ein Text entstehen, der etwas anderes sagt als das Bild.
`initialCollapsed()` bleibt dadurch die einzige Stelle, die die Bedeutung der
Marken kennt.

**Zwei Fallen, beide gemessen statt vermutet.** Erstens: Auf kleinem
Bildschirm ist der Editor `display:none`, wenn das Diagramm vorn ist — und
`execCommand` tut dann **nichts**, es liefert `false`, obwohl `activeElement`
das Textfeld meldet. Für die Dauer des synchronen Schreibens wird der Editor
deshalb absolut positioniert aus dem Bild geschoben sichtbar geschaltet
(Klasse `writing-fold`, derselbe Griff wie `exporting` im Grafikexport);
gezeichnet wird davon nichts. Zweitens: `execCommand` braucht den Fokus im
Textfeld, und der zöge auf dem Telefon die Bildschirmtastatur hoch — dagegen
`inputmode="none"` wie beim Sprung (D25), das der erste echte Tipp ins Feld
wieder aufhebt. Anschließend geht der Fokus an den Knoten zurück.

Schreibmarke und Scrollstand werden gesichert und zurückgesetzt; verschoben
wird nur, was **hinter** der Änderung lag. Gelingt das Schreiben, werden die
Sitzungs-Überlagerungen geleert — sonst könnten sie den Text maskieren, der
jetzt die Wahrheit ist.

**Nachtrag — der eingeklappte Knoten vertritt seinen Teilbaum auch auf dem
günstigsten Pfad.** Oben steht, ein eingeklappter Zweig dürfe Pfadknoten
verbergen, „die Inversion an den sichtbaren Knoten bleibt richtig". Das war zu
kurz gedacht, und der Nutzer hat es benannt: Die **Linie** blieb eben nicht
richtig. Sie fädelt durch die `cheap-leaf`-Knoten im DOM; ein eingeklappter
Pfadknoten ist `cheap`, aber kein Blatt (seine Pfad-Kinder sind ja im Modell
vorhanden) — also bekam er keine Station, und die Linie **umging den ganzen
Zweig**. Im mitgelieferten Beispiel nachgemessen: „Concept" war
`node cheap folded`, verbarg zwei Pfadknoten und trug keinen Punkt; die Linie
begann erst bei „PWA". Das Bild behauptete damit, in diesem Zweig sei nichts
zu tun — und das ist eine Aussage über den Plan, keine über die Ansicht. Genau
die Grenze, die dieser Eintrag sonst zieht.

**Regel: Eingeklappt ist der Knoten die tiefste noch sichtbare Station.**
`cheapCls(n, cheapSet, collapsed)` überspringt für eingeklappte Knoten die
Blatt-Prüfung und fragt stattdessen den Teilbaum: Liegt darin etwas auf dem
Pfad (oder der Knoten selbst), ist er `cheap cheap-leaf`. Beim Aufklappen
geben die Kinder die Station zurück — nachgemessen 6 → 7 → 6 Stationen beim
Hin- und Herklappen, Punkte jeweils gleich.

**Auch ohne eigene Pfad-Mitgliedschaft.** Ein per `:#…` gezogenes Ziel kann in
einem Zweig liegen, dessen Wurzel selbst nicht gebraucht wird (D42, etwa unter
einem `+`-Knoten). Ist dieser Zweig eingeklappt, ist seine Wurzel der einzige
sichtbare Griff auf nötige Arbeit — sie wird deshalb Station **und** zählt als
`cheap`, tritt also nicht zurück. Das ist keine Ausnahme, sondern dieselbe
Regel: Der eingeklappte Knoten **steht für** seinen Teilbaum, und der enthält
Nötiges. Ihn auszublassen wäre die Lüge.

Der Preis ist benannt und klein: Ein eingeklappter Zweig zeigt **eine** Station
statt mehrerer. Das ist keine Ungenauigkeit, sondern die Aussage der Faltung —
„hier drin liegt noch Pfad", genauer geht es ohne Aufklappen nicht.

**Nachtrag 3 — eine einzelne Station ist ein gültiger Pfad.** Der Nachtrag
oben behob den Fall „eingeklappter Zweig wird übersprungen“ an der
Klassenvergabe (`cheapCls`) — und ließ dabei eine zweite, ältere Schranke
stehen: `drawCheapPath()` stieg bei weniger als **zwei** Stationen ganz aus.
Solange jeder eingeklappte Knoten nur *einen* Zweig vertrat, fiel das nicht
auf. Es fällt auf, sobald weit oben gefaltet wird: Klappt man den
**Wurzelknoten** des Werkbaum-Plans zu, bleibt genau eine sichtbare Station —
und damit verschwand nicht nur die Linie (richtig, durch einen Punkt führt
keine), sondern auch der **Stationspunkt** (falsch). Der Pfad war ausgerechnet
dort ganz weg, wo die Faltung ihn am nötigsten vertreten muss. Nachgemessen
vor der Korrektur: Knoten `root-node cheap cheap-leaf folded`, Stationspunkte
**0**; danach 1 Punkt, 0 Linien, im Grafikexport dasselbe (1 Kreis, keine
Pfadlinie).

Die Schranke gehört an die **Linie**, nicht an die Zeichenfunktion: `catmullRom`
braucht zwei Punkte, die Punkte brauchen einander nicht. Dieselbe Trennung im
Export (`cheapPts.length >= 2` nur noch für die Linie).

**Dabei gefunden: der zugeklappte Wurzelknoten ließ sich nicht wieder
aufklappen.** Ein eigener Fehler, nur über denselben Weg erreichbar. Im
Werkbaum-Plan ist „Wurzel eingeklappt“ **nicht in Marken ausdrückbar** — das
`<` in Zeile 160 holt seinen Teilbaum immer wieder hervor —, der Zustand liegt
also in der Sitzungs-Überlagerung (der dritte Fall aus Nachtrag 2). Beim
**Auf**klappen berechnete `writeFoldToText()` dann einen Text, der mit dem
vorhandenen identisch war: nichts zu schreiben. `replaceTextUndoable()` meldete
dafür Erfolg — aber ohne Textänderung feuert kein `input`-Ereignis, also lief
kein `render()`, und das Bild blieb stehen, wie es war. Jeder weitere Klick tat
dasselbe. Jetzt meldet die Funktion „nichts geschrieben“, und der Aufrufer
zeichnet selbst neu. Nachgemessen: 144 Knoten/69 Punkte → 1/1 → 144/69 → 1/1
über mehrere Klicks.

**Nachtrag 4 — der eingeklappte Knoten vertritt seine Zeilen auch für den
Cursor.** Gemeldet als Wunsch: Steht der Cursor im Text auf einer Zeile, deren
Knoten im Diagramm eingeklappt ist, soll der nächste sichtbare Elternknoten
fokussiert werden — auch beim Alt+Klick. Bisher hob so eine Zeile schlicht
**nichts** hervor: `nodeOfLine()` sucht per `data-line` im DOM, und der
Renderer lässt eingeklappte Kinder weg (oben) — die Zeile lief ins Leere,
ausgerechnet dort, wo man ohne Hervorhebung am wenigsten sieht.

Die Regel gibt es schon, sie galt nur noch nicht hier: **Der eingeklappte
Knoten vertritt seinen Teilbaum** — für die Pfad-Station (Nachtrag oben) wie
für den „▸ n"-Zähler. Jetzt auch für die Zeilenauflösung: Liegt die Zeile in
einem eingeklappten Teilbaum, ist ihr Vertreter der **nächste sichtbare
Vorfahr** (bei verschachtelter Faltung der äußerste eingeklappte — nur der
steht im DOM). Beschreibungs- und Fortsetzungszeilen wandern mit ihrem Knoten
mit (D40-Nachtrag 2/D59). Beide Richtungen bekommen es über die **eine**
Auflösungsstelle `nodeOfLine()` (D25-Regel: wer eine neue Zeilensuche
schreibt, nimmt sie) — Cursor-Mitlaufen, Alt+Klick, Alt+Enter und der
Mobil-Umschalter sind damit automatisch abgedeckt.

**Die Grenze bleibt gezogen: ausgeblendete verworfene Elemente heben weiter
nichts hervor.** SPEC §9 nennt sie ausdrücklich neben Kommentar und
Leerzeile — Faltung ist Ansicht („hier, aber zusammengelegt"), der
Verworfen-Filter ist Aussage („nicht Teil des Plans"). Umgesetzt fällt die
Unterscheidung von selbst: Die Zeilen-Map (`lineTargets()` in model.js,
headless getestet) läuft über `visibleChildren()` — ausgefilterte Teilbäume
stehen gar nicht erst darin. Die Map wird in `render()` aus **denselben**
Mengen gebildet wie das DOM (`collapsedSet`, `showDiscarded`) — dieselbe
Identitäts-Regel wie bei `freshSet` (D28).

**Nachgemessen** im Browser: Cursor auf einem verborgenen Kind → der
eingeklappte Elternknoten trägt Ring und Puls; Alt+Klick fokussiert ihn
(`document.activeElement` ist der „▸ 2"-Knoten); Cursor auf einer
ausgeblendeten verworfenen Zeile und ihrem Kind → weiterhin keine
Hervorhebung. 377 Tests, davon 5 neue in `tests/fold.test.js`.

## D39 — Effektiver Status: die Farbe sagt die Wahrheit, die Marke die Box
Mit den Abhängigkeiten (D37) gibt es zwei Aussagen je Knoten: was in der
Statusbox steht (intrinsisch) und wie weit er wirklich ist (effektiv, §4).
Erwogen waren drei Darstellungen — Diskrepanz-Kennzeichnung bei intrinsischer
Farbe (die ursprüngliche Empfehlung), ein Umschalter, oder Farbe = effektiv.
**Entschieden (Nutzer): Die Knotenfarbe zeigt den effektiven Status; wo der
eigene Status weiter ist, kommt eine Diskrepanz-Marke dazu.** Das ist die
stärkere Wahl: Das Diagramm beantwortet „wie weit ist das wirklich?“ — genau
die Frage, für die man auf einen Plan schaut. Ein grünes `[x]`, das auf ein
rosé `[~]` wartet, wäre die hübschere Lüge.

**Die Rechenregel ist ein Minimum über die Abhängigkeits-Hülle.** Jeder Status
bekommt einen Fortschritts-Rang entlang der Ergebnis-Skala (D5); effektiv ist
das Minimum des intrinsischen Rangs über den Knoten selbst und alles, was er
direkt oder mittelbar braucht. Diese Form hat zwei angenehme Folgen: **Zyklen
brauchen keine Sonderregel** — alle Knoten eines Zyklus teilen ihr Minimum,
und das ist wörtlich das „wird gemeinsam fertig“ aus D34; und die Rechnung ist
eine schlichte Fixpunkt-Iteration (Ränge sinken nur, Abbruch garantiert).
Außerhalb der Skala: neutral und `[-]` zählen als 0 — wer auf etwas
Verworfenes oder nie Begonnenes zeigt, ist effektiv am Anfang, und genau das
soll auffallen —, `[!]` als 1 (die Absicht-ohne-Investition-Gruppe aus D35).
Bei doppelter ID gilt die **erste** Vergabe — das löst das in D36 offen
gelassene „wer gewinnt bei Verweisen“ konsistent zur `duplicateId`-Warnung.

**Die Diskrepanz-Marke ist die eigene Statusbox in den eigenen Farben.**
Unten links (die letzte freie Knoten-Ecke: oben rechts Größe, unten rechts
Tags, oben links ⚠) sitzt ein kleines `[x]`-Etikett in den §4-Farben des
intrinsischen Status — die Notation kennzeichnet sich mit ihrem eigenen
Vokabular, niemand lernt ein neues Symbol, und die Farben tragen die ganze
Geschichte: Knoten rosé (effektiv in Arbeit), Etikett grün (selbst fertig).
Tooltip („effektiv … — selbst schon …, wartet auf Abhängigkeiten“) und
`a11yEffective` sagen es in Worten. Marke und Färbung gehören in Export und
Druck — sie sind eine Aussage über den Plan, nicht über den Betrachter.

**Was beim intrinsischen Status bleibt:** die XOR-Regel (§3) — „realisiert“
heißt Kosten investiert, und investiert ist investiert, auch wenn
Abhängigkeiten den Knoten zurückhalten; und „Was ist neu?“ (D28) — der gelbe
Kranz meldet das `[^]` im Text, also den Deploy des Knotens selbst. Beide
Prüfungen laufen im Parser bzw. auf dem Text und bleiben unberührt.

## D40 — Knotenbeschreibungen gebaut: Tooltip statt Pop-up, ”-Marke, laute Strays
Die in D34 entschiedene Schreibweise (`"`-Zeilen, `---`-Beschreibungsteil) ist
umgesetzt (SPEC §1/§9). Die Bau-Entscheidungen:

**Anzeige im Tooltip, kein eigenes Pop-up.** SPEC §11 ließ „Tooltip oder
Pop-up“ offen. Ein Pop-up bräuchte eine eigene Geste (Klick ist der Link,
Alt+Klick der Sprung, der lange Druck ebenso — es bliebe nur ein weiteres
Klickziel neben dem Falt-Zeichen), Positionierung, Schließen-Logik und
Mobil-Verhalten. Der Tooltip kostet nichts davon: Der Beschreibungstext steht
**zuerst** (mehrzeilig — `title` zeigt Zeilenumbrüche), danach die
Kurz-Fakten (ID, Abhängigkeiten, Status). Bekannte Grenze: Auf Touch-Geräten
gibt es keine Tooltips — dort bleibt der Text vorerst nur im `aria-label`;
ein Pop-up kann später ergänzt werden, die Syntax ändert sich dadurch nicht.

**Auffindbarkeit: die ”-Marke.** Eine Beschreibung, die nur im Tooltip lebt,
wäre unsichtbar (die D25-Lehre: was niemand sieht, ist keine Funktion). Ein
Knoten mit Beschreibung trägt deshalb ein kleines ” hinter dem Label — es
spiegelt das `"`-Zeichen der Notation, wie die `[x]`-Marke (D39) deren
Statusboxen spiegelt; kein neues Symbol zu lernen. **Nicht im Export**: Der
Text selbst kann im statischen Bild nicht erscheinen, eine Marke ohne Ziel
wäre Rauschen — anders als „▸ n“ (D38), das eine nachprüfbare Aussage über
verborgene Knoten trifft. Screenreader bekommen den Text im `aria-label`.

**Strays warnen einzeln, Blöcke unter unbekannter ID schlucken still.** Die
beiden Fehlerfälle sind verschieden: Eine verwaiste Zeile (uneingerückt und
keine ID-Zeile, oder eingerückt ohne offenen Block) ist wahrscheinlich ein
**verrutschter Knoten** — genau der Fall des versehentlichen Trenners mitten
im Plan — und meldet sich je Zeile (`descStray`), damit nichts still
verschwindet. Ein Block unter einer **unbekannten ID** dagegen ist als
Beschreibung erkennbar und schon mit `unknownDesc` gemeldet; seine Textzeilen
zusätzlich einzeln anzuprangern wäre nur Lärm (SKIP-Ziel im Parser).

**Freitext heißt Freitext:** In Beschreibungszeilen findet keine
§1-Extraktion statt — `(M)`, `@name`, `#id` oder URLs im Text bleiben Text.
Einzige Ausnahme ist `%%`: Der Kommentar fällt im ganzen Dokument als
Erstes weg (einheitliche Regel, §1) — so lassen sich auch Beschreibungen
kommentieren.

**Nachtrag — Beschreibung und Kurz-Fakten werden im Tooltip getrennt.** Die
erste Fassung hängte alles an dieselbe ` · `-Aufzählung: Auf die letzte Zeile
des Fließtexts folgte unmittelbar `· #cms · geplant · Alt+Klick: …`. Gemeldet
als „einfach hinten drangeklatscht“, und das trifft es — der Übergang war
nicht zu sehen, obwohl dort die Art der Aussage wechselt: vorn ein Satz, den
jemand geschrieben hat, hinten Metadaten, die das Werkzeug kennt. Jetzt trennt
eine **Leerzeile plus Trennstrich**.

Der Strich ist aus `─` (U+2500) gebaut, nicht aus Bindestrichen: Das
Box-Drawing-Zeichen stößt gapless aneinander und liest sich als Linie, `---`
liest sich als Text. Ein `title` kann nichts anderes — es gibt darin kein
Markup, und ein eigenes Pop-up wollten wir gerade nicht (siehe oben). Zwei
Randbedingungen sind bewusst gesetzt: Der Strich steht **nur**, wenn beide
Teile vorhanden sind (ohne Beschreibung bleibt der Tooltip wie er war), und er
ist mit 24 Zeichen schmaler als die Fakten-Zeile, die den Sprung-Hinweis
enthält — er verbreitert den Tooltip also nie.

**Nicht in den `aria-label`.** Dort bleibt es bei der Kommaliste mit
whitespace-normalisierter Beschreibung: Ein Screenreader läse vierundzwanzig
Striche einzeln vor, und die Trennung, die ein Auge braucht, braucht ein Ohr
nicht — die Aufzählung ist dort ohnehin schon gegliedert.

**Nachtrag 2 — der Cursor in einer Beschreibung wählt ihren Knoten aus.**
Bisher fiel die Hervorhebung (D25) weg, sobald der Cursor eine Zeile
weiterrückte: Die `"`-Zeile trägt keinen Knoten, also fand die Zeilensuche
nichts. Das ist die falsche Auskunft — die Zeile trägt keinen **eigenen**
Knoten, gehört aber zu einem, und wer in ihr schreibt, arbeitet an genau
diesem Knoten.

**Beide Formen, nicht nur die Kurzform.** Gefragt war nach der `"`-Zeile; die
Zuordnung entsteht aber an derselben Stelle im Parser, an der auch die
`---`-Blöcke landen, und dieselbe Begründung trägt dort sogar weiter: Der
Langtext steht am **Dateiende**, weit weg von seinem Knoten — die
Hervorhebung ist die einzige Anzeige, an welchem man gerade schreibt.
Zugeordnet werden die eingerückten Textzeilen, die **Kopfzeile** `#auth`
(sie nennt den Knoten) und Leerzeilen **innerhalb** eines Blocks; nicht der
`---`-Trenner selbst und nichts unter einer unbekannten ID (dort gibt es
keinen Knoten, und `unknownDesc` steht schon).

**Die Zeilennummern liegen am Knoten, nicht in einer Nebenrechnung.**
`node.descLines` entsteht im Parser (`ownLine()`), der Renderer gibt sie als
`data-desc-lines="3 4 5"` aus, app.js findet den Knoten per
`[data-desc-lines~="N"]` — der Attribut-Selektor trifft die Nummer als Glied
der Liste, es braucht keine eigene Datenstruktur im UI. Bewusst **getrennt**
von `descLines` (dem Text): Dort fallen aufeinanderfolgende Leerzeilen zu
einem Absatztrenner zusammen und Blocktext unter unbekannter ID kommt gar
nicht erst an — für die Zeilenzuordnung wäre beides falsch.

Beide Richtungen gehen jetzt über **eine** Auflösung (`nodeOfLine()`): das
Mitlaufen der Cursor-Zeile und der ausdrückliche Alt+Klick (D25-Nachtrag 1).
Sonst wäre die Geste aus einer Beschreibung heraus stumm geblieben — und das
ist genau der Ort, an dem man sie braucht.

## D41 — Querverbindungen: Krümmung statt Farbe, Pfeil auf das Gebrauchte
Die Abhängigkeits-Kanten (SPEC §9) sind die erste Linienart, die nicht der
Zerlegung folgt — §11 verlangte dafür eine eigene Zeichenebene. Gebaut wie der
Pfad-Spline (D18): Overlay-SVGs in `#out`, die den CSS-`zoom` erben, neu
gezeichnet nach Render und Moduswechsel. Die Bau-Entscheidungen:

**Das Unterscheidungsmerkmal ist die Krümmung, nicht eine neue Farbe.** Die
Palette ist vergeben: Tinte und Grau gehören den Baumlinien, Petrol der
Interaktion und dem günstigsten Pfad, `--warn` dem Geister-Knoten — und Rot
ist bewusst nicht vergeben (D34 zu LEAN-PATHFINDING). Also tragen die Kanten
dasselbe Blassgrau wie die any-of-Führung, aber **geschwungen** (quadratische
Kurve mit seitlichem Bauch): Alle Zerlegungslinien sind achsenparallel, jede
gekrümmte Linie ist damit auf einen Blick „keine Zerlegung“ — dasselbe Mittel,
mit dem sich der Pfad-Spline absetzt. Dünn (1,5 px) und blass (0,35), denn der
Baum trägt die Hauptaussage; die **Pfeilspitze zeigt auf das Gebrauchte**
(„braucht“-Richtung), Endpunkte auf den Knotenkanten statt -mitten, damit die
Spitze sichtbar bleibt.

**„Ausgewählt“ hat zwei Lesarten, beide gelten:** der Knoten mit
Tastaturfokus im Diagramm, sonst der Knoten der Cursor-Zeile (D25). Dessen
ein- und ausgehende Kanten wandern auf eine vordere Ebene in Tinte (2 px,
0,9) — vorn dürfen sie den Baum überlagern, denn die Hervorhebung ist
flüchtig und gerade angefragt. Kein Klick-Auswahlzustand: Der einfache Klick
ist der Link (§6), und Knoten fokussieren sich beim Klicken ohnehin.

**Kanten enden an sichtbaren Knoten oder gar nicht.** Ziel eingeklappt (D38)
oder als verworfen ausgeblendet → keine Kante; eine Kante zum eingeklappten
Vorfahren wäre eine falsche Aussage über das Ziel. Bei doppelter ID zielt die
Kante auf die erste Vergabe — dieselbe Auflösung wie beim effektiven Status
(D39). Die Basis-Kanten gehören in Export und Druck (Aussage über den Plan);
die Hervorhebung nicht (Interaktion). Selbst-Abhängigkeiten zeichnen keine
Kante — ein Kreis von einem Knoten zu sich selbst sagte nichts.

**Nicht durch Tests gedeckt:** `drawDepLinks()` arbeitet wie `alignStems()`
auf dem DOM; headless getestet sind die `data-id`/`data-deps`-Attribute des
Renderers, geprüft wurde im Browser (alle drei Modi, Fokus- und
Cursor-Hervorhebung, Export).

**Nachtrag — die Basis-Kanten sind jetzt gepunktet.** „Zurückhaltender“
(Nutzer): Die durchgezogene Kurve konkurrierte trotz Blässe noch mit dem
Baum. Punktiert (runde Punkte, `stroke-dasharray: .1 5`) tritt sie weiter
zurück und ist zugleich **dreifach** von den Baumlinien unterschieden —
Krümmung, Blässe, Punktierung; durchgezogen gehört „und“, gestrichelt „oder“.
Der D29-Einwand gegen einen dritten Linienstil greift hier nicht: Er galt den
**Baum-Abzweigen**, die sich im kompakten Modus allein über den Stil
unterscheiden müssen — die Querverbindungen liegen auf ihrer eigenen,
gekrümmten Ebene und begegnen den Rahmenkanten nie. Die **Hervorhebung**
(fokussierter Knoten) bleibt durchgezogen in Tinte: Sie ist ausdrücklich
angefordert und soll sich nach vorn drängen. Export identisch nachgezogen.

Zweiter Schritt derselben Rückmeldung: Auch die **Pfeilspitze** ist jetzt
**offen** (ein Winkel aus zwei dünnen grauen Strichen) statt eines gefüllten
Dreiecks — das Dreieck stach als einziger satter Fleck aus der gepunkteten
Linie heraus. Die Hervorhebung bekommt denselben Winkel in Tinte.

**Nachtrag 2 — auch die hervorgehobenen Kanten laufen hinter den Knoten
durch.** Gemeldet: „die Abhängigkeits-Pfeile sollen im Hintergrund durch andere
Knoten durchlaufen, derzeit werden die Pfeile drüber gemalt."

**Nachgemessen war es genau eine Hälfte.** Die **Basis**-Kanten lagen schon
richtig: In einem eigens gebauten Fall — eine Kante quer über drei breite
Knoten hinweg, zur Sichtbarkeit magenta und 6 px dick gefärbt — erschien sie
**nur in den Lücken** zwischen den Knoten, nie über deren Fläche. Sichtbar
„drüber" war allein die **Hervorhebung**: Steht der Cursor auf einer Zeile mit
`:#…`, wandern deren Kanten auf `svg.dep-front` (`z-index:4`) und laufen als
durchgezogene Tinte-Linie mitten durch die Beschriftung der Knoten dazwischen.

**Damit fällt die Begründung des Haupttextes** — „vorn dürfen sie den Baum
überlagern, denn die Hervorhebung ist flüchtig und gerade angefragt". Der
Einwand des Nutzers wiegt schwerer, und er ist derselbe, aus dem die
Basis-Kanten von Anfang an hinten liegen: Eine Linie quer über einen fremden
Knoten **durchstreicht dessen Titel**. Das trifft ausgerechnet die Knoten, die
mit der Sache nichts zu tun haben — die Kante sagt etwas über ihre beiden
Enden, nicht über das, was zufällig dazwischen steht. „Flüchtig" ist dabei kein
Freibrief, sondern eher das Gegenteil: Beim Tippen wechselt die Hervorhebung
mit jeder Zeile, der Schaden ist also nicht selten, sondern dauernd.

**Eine Ebene statt zweier.** `svg.dep-front` entfällt; hervorgehobene Kanten
werden **zuletzt** in dieselbe hintere Ebene gehängt und liegen dadurch über
den übrigen Kanten, aber unter jedem Knoten. Die Unterscheidung trägt weiterhin
das Aussehen (durchgezogen in Tinte gegen gepunktet in Blassgrau), und das ist
genug: Sie war nie an der Ebene festgemacht, sondern nur zusätzlich betont.

**Der Preis, benannt:** In einer dichten Reihe breiter Knoten bleibt von der
hervorgehobenen Kante wenig mehr als ein Stück in jeder Lücke. Zu **finden**
ist ihr Ziel trotzdem, denn die **Pfeilspitze sitzt auf der Knotenkante** und
liegt damit außerhalb jedes Kastens. Für den Fall, dass das eines Tages nicht
reicht, steht das Hausmittel bereit: eine **abgetönte Kopie davor**, wie sie
der günstigste Pfad seit D18 für genau dieses Problem hat („deutet den Verlauf
beim Durchschreiten eines Knotens nur schwach an"). Bewusst nicht vorab
gebaut — gefragt war, dass die Kanten hinten laufen, und eine zweite Ebene
zurückzuholen, um die erste zu erklären, ist der falsche Anfang.

**Was dadurch obsolet wird:** D25-Nachtrag 3 gab `.dep-front` seinen
`z-index:4`, weil die hervorgehobenen Kanten sonst unter dem hervorgehobenen
Knoten endeten („vorn heißt vorn"). Das war für eine vordere Ebene richtig und
ist mit ihr weggefallen; für `.cheap-front` (`z-index:5`) gilt es unverändert
weiter — der Stationspunkt gehört über den Knoten.

**Export und Druck waren nie betroffen:** `diagramToSvg()` zeichnet die
Basis-Kanten in Schritt 1a, also vor den Knoten, und die Hervorhebung gar nicht
(Interaktion, siehe oben). Das Bild auf dem Schirm zieht damit nach, statt dass
etwas Neues entsteht — derselbe Befund wie bei D46-Nachtrag.

**Nachgemessen** nach der Änderung, an demselben Fall: `svg.dep-front` gibt es
nicht mehr, alle Kanten hängen in `svg.dep-back` als erstem Kind von `#out`,
die hervorgehobene als letztes Element darin. Die Tinte-Linie ist in den Lücken
zu sehen und über den Knoten nicht mehr; die Pfeilspitze steht unverändert an
der Kante des gebrauchten Knotens.

## D42 — Closure-Pfad: erschöpfend über die gekoppelten Gruppen, gierig nur benannt
Die letzte Baustelle aus D34: Mit Abhängigkeiten zählt der günstigste Pfad
nicht mehr den gewählten Teilbaum, sondern die **Hülle** — jeder nötige Knoten
zieht seine Ziele samt Realisierung nach, gemeinsam Gebrauchtes zählt über die
Mengen-Vereinigung nur einmal. Damit ist die Wahl je Alternativgruppe nicht
mehr lokal optimal (das D34-Beispiel: `A (S) :#db` schlägt `B (M)`, sobald
`#db` ohnehin bezahlt wird). Die Entscheidungen:

**Verfahren: erschöpfende Suche — aber nur über die gekoppelten Gruppen.**
D34 stellte „exakt, die Bäume sind klein“ gegen „gierig, aber benannt“;
gebaut sind beide, mit einer Beobachtung dazwischen, die die exakte Suche
praktisch immer billig macht: **Nur Gruppen, in deren Teilbäumen
Abhängigkeiten stehen oder auf deren Knoten welche zeigen, koppeln
überhaupt.** Alle übrigen wählen weiterhin lokal (kleinste rekursive Kosten,
Gleichstand ⇒ erste) — ohne Abhängigkeiten gibt es null gekoppelte Gruppen
und genau eine Auswertung, also exakt das alte Verhalten zum alten Preis.
Über die gekoppelten Gruppen läuft ein lexikografischer Odometer (frühe
Gruppen wechseln zuletzt, strikt `<` gewinnt — bei Gleichstand bleibt so die
erste Alternative, §9). Übersteigt das Produkt der Gruppengrößen das
Suchlimit (20 000), fällt die Rechnung auf die gierige lokale Wahl zurück
und **sagt es**: zeilenlose Warnung `cheapApprox` — die in D34 verlangte
Benennung, statt stillschweigend Optimalität zu suggerieren.

**Abhängigkeiten ziehen, was sie brauchen — auch Optionales und nicht
Gewähltes.** `+` heißt „für das Ganze entbehrlich“, aber wer per `:#…` darauf
zeigt, braucht es eben doch; und ein Ziel in einer nicht gewählten
Alternative wird trotzdem realisiert, wenn etwas Nötiges davon abhängt. Im
Diagramm bleibt so ein einzelner heller Knoten im zurückgetretenen Zweig
stehen — sichtbar „das hier wird gebraucht, egal wie ihr wählt“. Nur
**verworfene** Ziele werden nie gezogen (§9: verworfen zählt nie): Sie werden
nicht realisiert, und dass der Abhängige deshalb nie fertig wird, sagt schon
der effektive Status (D39) — der Pfad muss die Lüge nicht einpreisen.
Gezogen wird das Ziel samt **Abwärts**-Realisierung, nicht seine Vorfahren:
Der Elternknoten braucht sein Kind, nicht umgekehrt.

**API: `computeCheapPlan(roots)` → `{set, exact}`.** `computeCheapSet` bleibt
als Hülle für Tests und Kompatibilität; `render()` liest `exact` für die
Warnung. `markCheapest` entfällt — die Menge entsteht jetzt in einem
Worklist-Durchlauf je Belegung (Zyklen enden über die Mengen-Prüfung von
selbst; erste ID-Vergabe gewinnt, D36/D39).

## D43 — `llms.txt`: die Notation für KI-Agenten, unter der Site-Wurzel
KI-Agenten sollen Werkbaum-Texte lesen **und schreiben** können, ohne die
deutsche SPEC durchzuarbeiten. Dafür liefert jede Instanz eine englische
Markdown-Kurzfassung der Notation unter `/llms.txt` aus
(`https://werkbaum.javagil.de/llms.txt`). Die Entscheidungen:

**Der Name folgt der llms.txt-Konvention** (llmstxt.org): eine Markdown-Datei
an der Site-Wurzel, die die Site für Sprachmodelle beschreibt — genau der
Zweck, und zunehmend der Ort, an dem Agenten und Werkzeuge von sich aus
nachsehen. Ein hübscherer Name (`notation.md`) wäre nicht auffindbar. Im
Footer steht der **Dateiname selbst als Link** — dadurch braucht er keine
Übersetzung in neun Sprachen; der Tooltip ist knapp zweisprachig (DE · EN),
wie beim Build-Hinweis (D16: Metainformation, kein Produkt-Feature-Text).

**Englisch, obwohl die Doku deutsch ist.** „Doku auf Deutsch" (CLAUDE.md)
gilt der Projekt­dokumentation; die Agenten-Fassung ist ein **ausgeliefertes
Produkt-Artefakt** mit weltweitem Publikum — dieselbe Logik, nach der das
Beispiel-Dokument englisch ist (D22).

**Quelle in `frontend/public/`** — damit erledigt Vite die halbe Arbeit: Der
Dev-Server liefert `/llms.txt` direkt aus, `vite build` kopiert es nach
`dist/`, und beide Deploy-Wege (Pages-Workflow und `deploy-prod.sh`, die die
Site je von Hand zusammenstellen, D16) kopieren es mit einer Zeile weiter.
Bewusst **nicht** in die eine `index.html` eingebettet: Agenten holen eine
URL, kein Bundle.

**Drift ist das Hauptrisiko** — dieselbe Sorge wie bei einem zweiten Parser
(D14). Gegenmittel: Die Datei erklärt selbst, dass die SPEC normativ ist, und
die Hausregel in CLAUDE.md lautet jetzt „SPEC zuerst, dann Code, **dann die
Agenten-Fassung nachziehen**" (SPEC §13 verweist zurück). Inhaltlich
beschreibt sie nur die **Notation samt Semantik** (Gates, Status, Ränge,
Extraktionsreihenfolge, Schreibregeln, ein vollständiges Beispiel) — keine
Editor-UI: Die braucht ein schreibender Agent nicht, und sie ändert sich
öfter.

**Nachtrag — `llms.md` statt `llms.txt`, Link neben der Versionsnummer.**
Entschieden vom Nutzer: Die Endung `.md` ist die zum Inhalt ehrliche (es IST
Markdown; die Konvention nutzt `.txt` nur als kleinsten gemeinsamen Nenner),
und der Footer-Link rückt zwischen Versionsnummer und Copyright — zur
Werkzeug-Ecke des Footers statt ans Ende hinter die Rechtstexte. Der
Dateiname bleibt als Linktext (übersetzungsfrei), die Wurzel-Lage bleibt.

**Nachtrag 2 — `llms.txt` ist ein Wegweiser, keine Referenz; er fehlte, und
die Auslieferung von `llms.md` war kaputt.** Anlass war die Frage, ob
`llms.md` überhaupt ein guter Name sei. Beim Nachsehen kamen zwei Dinge
heraus, und das erste ist eine **Richtigstellung dieses Eintrags**.

**Der Zweck der Konvention ist ein anderer, als D43 annahm.** Der Haupttext
oben beschreibt `llms.txt` als „eine Markdown-Datei an der Site-Wurzel, die
die Site für Sprachmodelle beschreibt — genau der Zweck“. Das ist zu weit
gefasst. llmstxt.org sagt über die eigene Datei wörtlich: *„a markdown file
that provides brief background information and guidance, along with **links to
markdown files providing more detailed information**“* — also ein **Index**,
kein Inhalt. Werkbaums 211-Zeilen-Leitfaden ist genau eine jener
„markdown files providing more detailed information“, auf die so ein Index
zeigt; als `llms.txt` wäre er zweckentfremdet gewesen.

**Damit ist `llms.md` nicht bloß geduldet, sondern richtig** — und der erste
Nachtrag hat aus dem falschen Grund das Richtige getan: Er begründete die
Endung mit Format-Ehrlichkeit und gab dafür die Auffindbarkeit auf, die den
Namen in D43 überhaupt begründet hatte. Tatsächlich musste die Kurzfassung
diesen Namen tragen; gefehlt hat nicht die richtige Endung, sondern der
Wegweiser davor. Der liegt jetzt als `frontend/public/llms.txt` daneben und
wird von beiden Deploy-Wegen mitkopiert.

**Zweiter Befund: `llms.md` kam auf der stabilen Instanz falsch kodiert an.**
Apache kennt die Endung nicht und sendet dann **gar keinen** `Content-Type` —
ohne Charset rät der Browser windows-1252. Gemessen am 24.08.2026 auf
`werkbaum.javagil.de`: `document.characterSet` = `windows-1252`, und aus
`# Werkbaum notation — guide for AI agents` wurde `… notation â€" guide …`;
31 Zeilen enthalten `–`, `—`, `…` oder `≥`. Dieselbe Datei von GitHub Pages:
`text/markdown; charset=utf-8`, fehlerfrei. Es ist also **kein** Argument
gegen die Endung, sondern ein Konfigurationsfehler auf genau einer Instanz —
und dieselbe Falle, die D24 für `.werkbaum` längst benannt hatte („wer selbst
ausliefert, nimmt `text/plain; charset=utf-8`“).

Behoben mit `scripts/prod.htaccess`, das `deploy-prod.sh` als `.htaccess` in
die Site-Wurzel spiegelt (`.md` → `text/markdown;charset=utf-8`, dazu `.txt`
und `.werkbaum` als `text/plain`). Bewusst **nicht** in `frontend/public/`:
Von dort landete es über `dist/` auch im Pages-Artefakt, wo es wirkungslos
wäre — Pages ist kein Apache und macht es ohnehin richtig. Der Rückweg steht
in der Datei selbst: Antwortet der Server nach einem Deploy mit 500, verbietet
seine `AllowOverride`-Einstellung `AddType`, und die drei Zeilen gehören in
die vhost-Konfiguration.

**Der Wegweiser ist rein ASCII** — er ist die eine Datei, die ein fremder
Agent ungefragt abruft, und er soll auch dann ankommen, wenn ein Server die
Kodierung verschweigt. Das ist keine Vorsichtsmaßnahme ins Blaue: Genau dieser
Fall ist oben gemessen. Aufbau nach der Konvention: `#`-Titel, Blockquote mit
einem Satz, ein Absatz Notation in Kurzform, dann `## Docs` mit den Links, die
man wirklich braucht, und `## Optional` für DECISIONS und Repo — die Konvention
erlaubt ausdrücklich, den Optional-Abschnitt wegzulassen, wenn der Kontext
knapp ist.

**Der Footer verlinkt weiterhin `llms.md`, nicht den Index.** Für einen
Menschen ist der Leitfaden das nützliche Dokument; der Wegweiser besteht aus
zehn Zeilen Links. Und Agenten finden ihn nicht über den Footer, sondern weil
er an der konventionellen Adresse liegt — wie `robots.txt`, das auch niemand
in eine Fußzeile schreibt. Falt-Umschalter: „ab M abwärts“ statt einer Tiefenzahl
Einzeln zu falten (D38) reicht für einen Plan mit 167 Knoten nicht — man will
den Baum am Stück auf eine Arbeitshöhe bringen. Der Diagramm-Kopf bekommt
dafür einen **Umschalter** neben „verworfene einblenden“ und „günstigster
Pfad“: gedrückt ist alles **ab Größe M abwärts** zugeklappt, nicht gedrückt
ist der ganze Baum offen.

**Das Kriterium ist die Größe, nicht die Tiefe.** Die naheliegende Alternative
wäre „bis Ebene n aufklappen“ gewesen. Die Ebene ist aber eine Eigenschaft der
Schreibweise, nicht der Sache: Wie tief etwas steht, hängt davon ab, wie fein
der Autor zerlegt hat, und ein sorgfältig aufgeschlüsselter Zweig verschwände
bei derselben Zahl früher als ein grob notierter. Die T-Shirt-Größe sagt
dagegen etwas über die **Arbeit** — und weil `M` die kleinste Größe ist, die
überhaupt eine Zerlegung verlangt (§5/D8), ist „M und kleiner“ genau die
Menge, deren Inneres Detail ist. Übrig bleibt der Plan auf der Höhe von `L`
aufwärts, also dort, wo die großen Brocken stehen.

*(Zuerst gebaut war die Schwelle **unter** M — offen blieb dann auch jedes
`M`. Der Nutzer hat sie auf `M` einschließlich korrigiert: Ein M-Paket ist
selbst noch die Einheit, die man als Ganzes plant; seine Zerlegung ist schon
das Innere.)*

**Ohne Größenangabe wird nicht zugeklappt.** Der günstigste Pfad wertet eine
fehlende Größe als `M` (D18) — das wäre hier der falsche Präzedenzfall: Dort
ist es eine bewusst konservative **Kostenannahme** („mindestens M“), hier wäre
es eine Aussage über den Willen des Autors. Wer keine Größe angegeben hat, hat
nichts gesagt; einen Zweig deswegen zu verbergen, behandelte eine Vermutung
wie eine Angabe. Ein Knoten ohne Größe bleibt also offen — und fällt dadurch
angenehmerweise auf.

**Ein Umschalter, kein Menü.** Zuerst gebaut war ein Aufklapp-Menü mit zwei
Einträgen („alle aufklappen“ / „zuklappen“); der Nutzer wollte einen
Umschalter. Das ist die bessere Form, und der Grund ist nicht nur Platz: Die
beiden Einträge waren nie unabhängige Befehle, sondern die **zwei Stellungen
einer Sache** — jeder beschreibt einen vollständigen Faltzustand, und
zusammen decken sie ihn ganz ab. Genau das ist ein Umschalter. Ein Menü
verlangte zwei Klicks für etwas, das einen braucht, und der Diagramm-Kopf hat
das Idiom längst zweimal (D18, D4).

**Der Zustand wird abgelesen, nicht gemerkt.** Ein gemerktes Flag würde lügen,
sobald jemand danach einen einzelnen Knoten umklappt. Stattdessen prüft
`render()` bei jedem Durchlauf, ob **jeder** faltbare Knoten so steht, wie die
Voreinstellung ihn stellen würde; nur dann ist der Knopf gedrückt. Er springt
damit von selbst heraus, wenn man von Hand etwas aufklappt, und von selbst
wieder hinein, wenn man es zurücknimmt (beides nachgemessen). Deshalb wird er
auch **nicht** in `werkbaum-ui` persistiert: Der Faltzustand steht im Text
(D38-Nachtrag 2), der Knopf liest ihn nur ab. Sonderfall: Gäbe es gar keinen
Knoten bis `M`, wären beide Stellungen derselbe Zustand — dann bleibt der
Knopf heraußen, statt gedrückt dazusitzen, ohne dass etwas zugeklappt ist.

**Beide Stellungen beschreiben einen vollständigen Zustand.** Zuklappen klappt
also alles **andere auf**. Sonst wäre die Wirkung vom Vorzustand abhängig und
zweimal Drücken ergäbe zweierlei — für einen Umschalter die falsche
Eigenschaft. Der Preis: Ein von Hand gesetztes `>` an einem großen Knoten wird
dabei aufgelöst. Vertretbar, weil der Nutzer gerade ausdrücklich eine
Gesamtansicht angefordert hat, und weil **Rückgängig** den ganzen Vorgang in
einem Schritt zurücknimmt (nachgemessen: `replaceTextUndoable` schreibt genau
einmal, Strg+Z stellt Text und Diagramm wieder her).

**Umgesetzt über denselben Weg wie das einzelne Umklappen** — die
Sitzungs-Überlagerungen setzen, dann in den Text schreiben (D38-Nachtrag 2).
Dafür wanderte der Voll-Rewrite aus `writeFoldToText()` in ein eigenes
`writeAllFoldMarks(roots, want)`: Für eine Voreinstellung gibt es keinen
minimalen Patch, sie fasst den ganzen Baum an. Damit gilt auch hier die
Rückfall-Kette unverändert — ist der Zustand in Marken **nicht ausdrückbar**,
wird nicht geschrieben und die Überlagerung trägt ihn für die Sitzung.

Genau der Fall tritt im mitgelieferten Werkbaum-Plan auf und ist beim Bauen
nachgemessen worden: In Zeile 103 steht eine Fokusmarke `!!!` unterhalb eines
Knotens, der zugeklappt werden soll — die holt ihren Knoten immer wieder
hervor, dieser Markensatz ist also nicht schreibbar. Das Bild stimmt trotzdem
(die Überlagerung gewinnt in `render()`), der Text bleibt unangetastet. In
einem Plan ohne `!!!` werden die Marken geschrieben: `- [ ] > Mittel (M)`,
`- [ ] > Klein (S)` und `- [ ] > Teil 3 (M)`, während `(L)`, `(XL)` und der
Knoten ohne Größe offen bleiben.

## D45 — Update-Prüfung vergleicht gegen den laufenden Build, nicht gegen einen gemerkten Abruf
Gemeldet: „Oft wird der Hinweis, dass eine neue Version vorliege, oben
angezeigt, obwohl genau die bereits geladen wurde“ — mit dem Verdacht auf eine
Race-Condition und der Vermutung, dass es in der Vorschau-Instanz deshalb
immer wieder auftritt. Beides trifft zu, und es sind **zwei** Fehler, die
dieselbe Wurzel haben: Die Prüfung verglich nie mit dem Stand, der gerade
läuft.

**Wurzel: ein Relais statt eines Vergleichs.** `checkForUpdates()` holte die
Seite und verglich ihren Inhalts-Hash mit `werkbaum-html-hash` — dem Hash des
**zuletzt abgerufenen** Stands. Über den läuft die Aussage „neu“ also
indirekt: Sie sagt „der Server liefert etwas anderes als beim letzten Abruf“,
nicht „der Server liefert etwas anderes als das, was du vor dir hast“. Das
sind verschiedene Aussagen, sobald etwas zwischen Laden und Abruf dazwischen
kommt — und genau das tut ein CDN. Der Kommentar im Code hielt schon fest,
dass GitHub Pages je Cache-Knoten abweichende ETags liefert; dasselbe gilt
zeitlich für den **Inhalt**: Während ein Deploy durchläuft, antworten Knoten
unterschiedlich, aufeinanderfolgende Abrufe wechseln zwischen alt und neu. Der
Hash im localStorage wurde dabei bei **jedem** Abruf nachgeführt, jeder Wechsel
schlug also erneut an — auch wenn der laufende Tab längst den neuen Stand
hatte. Dazu kommt, dass sich alle Tabs denselben Schlüssel teilen: Zwei
geöffnete Tabs schreiben abwechselnd ihren Stand hinein und melden einander
Updates.

**Zweiter Fehler, der eigentliche Dauerbrenner: das Flag blieb kleben.**
`werkbaum-update-available` wurde bei einem Fund gesetzt und **nur** vom Knopf
„Jetzt laden“ wieder entfernt. Wer statt dessen F5 drückte — oder „Später“, das
lediglich das Banner-Element entfernte —, behielt das Flag; und beim Laden
stand:

```js
if(!document.hidden && localStorage.getItem('werkbaum-update-available')){
  checkAndShowUpdateNotification();
}
```

Also erschien das Banner ausgerechnet auf der Fassung, die es gerade eingespielt
hatte, und danach bei **jedem** weiteren Laden, bis irgendwann jemand den
richtigen Knopf traf. Nachgestellt: Flag setzen, neu laden → Banner; „Später“ →
Flag steht weiter; neu laden → Banner. Endlos.

**Entscheidung: die laufende Seite ist der Vergleichsmaßstab, und sie kennt
sich selbst.** Beide Deploy-Wege spritzen den Commit in den
Footer-Versionslink (D16, `<a class="ver" href="…/commit/<sha>">`) — die
laufende Seite trägt ihre Identität also im DOM, die abgerufene im HTML-Text.
Zwei Werte, die im selben Moment vorliegen; dazwischen kein Speicher, der
altern könnte. Damit sind alle drei Ursachen weg: kein Relais (CDN-Flattern
meldet nichts mehr, solange der gelieferte Commit der laufende ist), keine
Kopplung zwischen Tabs, und nichts, was ein Neuladen überdauert. Nebengewinn:
Schon die **erste** Prüfung nach dem Laden ist aussagekräftig — der alte Weg
konnte beim ersten Mal grundsätzlich nichts sagen, weil er erst einen
Vergleichsstand anlegen musste.

**Der Zustand lebt nur noch im Speicher.** `werkbaum-update-available` und
`werkbaum-html-hash` werden nicht mehr geschrieben (der Reset räumt sie noch
weg, falls sie aus einer früheren Fassung herumliegen). Beim Laden wird
grundsätzlich **nichts** gemeldet: Was der Browser gerade geholt hat, *ist* der
aktuelle Stand, bis eine Prüfung etwas anderes zeigt — und die läuft zwei
Sekunden später ohnehin. Damit kann die Meldung nicht mehr klemmen: Gilt sie
noch, kommt sie sofort wieder; gilt sie nicht, bleibt sie weg. „Später“ darf
deshalb weiterhin nur das Element entfernen.

**Die Meldung wird auch wieder eingesammelt.** Sagt eine spätere Prüfung
„aktuell“, während das Banner steht, verschwinden Banner und Footer-Symbol.
Das deckt den Rollback ab und den Fall, dass ein einzelner Abruf doch einmal
gegen einen veralteten Knoten lief.

**Rückfall für Builds ohne Marker** (Dev-Server, `file://`, lokales
`npm run preview`): dort steht im Footer der Platzhalter `…/commit/main`, also
keine Commit-Kennung. Dann wird weiter der Inhalts-Hash verglichen — aber gegen
den **ersten Abruf dieser Seiten-Sitzung**, der als Vergleichsstand stehen
bleibt, statt gegen einen fortlaufend nachgeführten Wert im localStorage. Der
Preis ist ein blindes Fenster von zwei Sekunden zwischen Laden und Erstprüfung;
auf dem Dev-Server ist das gleichgültig, weil dort HMR arbeitet.

**Nachgemessen** (Dev-Server, Marker zum Prüfen von Hand eingespritzt):

| Fall | vorher | nachher |
|---|---|---|
| Altes Flag im localStorage, neu laden | Banner, bei jedem Laden erneut | kein Banner, drei Takte „✓ Alles aktuell“ |
| Gespeicherter Hash ≠ Auslieferung, Seite unverändert | „✅ NEUE VERSION ERKANNT!“ | „✓ Alles aktuell“ |
| Server liefert anderen Commit | — | „✅ Neuer Build 2222222“, Banner + Footer-Symbol |
| Danach wieder derselbe Commit | Banner blieb stehen | Banner und Symbol verschwinden |
| „Später“, dann F5 | Banner sofort wieder da | weg und bleibt weg |

## D46 — Der günstigste Pfad zeigt die offene Front: `[x]` kostet nichts mehr
Der Pfad (D18/D42) rechnete rein aus T-Shirt-Größen — `ownCost()` war
`SIZE_RANK[size] + 1`, der **Status kam in der Kostenrechnung überhaupt nicht
vor** (nur `[-]` flog heraus). Zwei Folgen, beide falsch für die Frage, für die
man auf den Pfad schaut:

- Längst Erledigtes wurde voll eingepreist und lag weiter hell auf dem Pfad. Im
  mitgelieferten Werkbaum-Plan zeichnete die Linie damit überwiegend **fertige
  Arbeit** nach: 69 Stationen, fast alle auf `[^]`-Knoten.
- In einer Alternativgruppe hatte eine **bereits realisierte** Alternative
  keinerlei Kostenvorteil. Steht in einer `=`-Gruppe eine auf `[x]` und daneben
  eine billigere auf `[?]`, empfahl der Pfad die billigere — obwohl die Wahl
  faktisch getroffen und bezahlt ist. Die `xorConflict`-Warnung (D35) meldete
  den Widerspruch bereits, die Pfadrechnung ignorierte ihn.

**Entschieden: Erledigtes kostet 0.** Der Pfad beantwortet damit „was ist als
Nächstes am günstigsten?" statt „was hätte der Plan von vorn gekostet?".

**Die Schwelle liegt bei `[x]` fertig** (Nutzer). Begründung: Die Beförderung
auf `[^]` ist keine Kostenfrage — sie sagt etwas über das Deployment, und das
tut per D30 ohnehin ein eigener Commit. Wer fertig ist, hat bezahlt.

**Angefangenes (`[~]`, `[/]`) zählt weiterhin voll.** Erwogen und verworfen
waren anteilige Restkosten (etwa 2/3 bzw. 1/3): Die Bruchteile wären erfunden —
die Größen sind **ordinal, nicht additiv** (ROADMAP, Aufwands-Rollup: `S+S ≠ M`),
eine Skala für „ein Drittel von L" gibt es nicht. Ebenfalls verworfen: alles ab
`[~]` als bezahlt zu werten („versunkene Kosten sind versunken"). Das zöge den
Pfad in jeden angefangenen Zweig, auch wenn dort noch fast alles offen ist —
und `[~]` heißt laut §4 gerade „Kosten investiert, **Risiko hoch**".

**Maßgeblich ist der intrinsische Status, nicht der effektive.** Ein `[x]`, das
von einer Abhängigkeit zurückgehalten wird, ist effektiv weiter unten (D39) —
die **Arbeit daran** ist trotzdem getan. Dieselbe Linie, die schon die XOR-Regel
(D35: „investiert ist investiert") und „Was ist neu?" (D28: `[^]` im Text ist
die Deploy-Aussage) ziehen. Nebenbei verhindert es doppeltes Zählen: Die
Abhängigkeit steht mit ihren eigenen Kosten ohnehin selbst auf dem Pfad.

**Abgezogen werden nur die eigenen Kosten, nicht der Teilbaum.** Ein `[x]`-Knoten
mit offenen Kindern bleibt also teuer — was stimmt, und was eine unstimmige
Stelle im Plan sichtbar lässt, statt sie zuzudecken.

**Darstellung: Farbe bleibt, nur Linie und Punkte lassen Erledigtes aus**
(Nutzer). Erledigte Knoten bleiben `cheap` und behalten ihre volle Statusfarbe —
grün bzw. blau sagt bereits „hier ist nichts mehr zu tun". Verworfen war,
sie wie nicht benötigte Knoten auszublassen: Das ist der Kanal für „gehört nicht
zum Plan" (D18), und ein fertiger Knoten sähe damit aus wie eine verworfene
Alternative. Ebenfalls verworfen: eine **zweite, schwächere** Abblendstufe — sie
müsste sich von der Pfad-Inversion unterscheiden lassen, und der Unterschied
zwischen 32 % und, sagen wir, 65 % Deckkraft ist kein Unterschied in der Art.
Drei Zustände sind so ohne neuen Farbkanal unterscheidbar: nicht nötig (blass),
nötig und erledigt (voll, ohne Punkt), nötig und offen (voll, mit Punkt und
Linie).

**Station ist der tiefste noch OFFENE Knoten eines Zweigs.** Die alte Regel
(„kein Kind liegt auf dem Pfad") reicht dafür nicht: Sind alle Kinder erledigt
und der Elternknoten nicht, hätte der Zweig gar keine Station, obwohl dort noch
Arbeit liegt — nämlich seine. `hidesOpenCheap()` fragt deshalb den **Teilbaum**
statt nur die direkten Kinder. Der eingeklappte Knoten (D38-Nachtrag) erbt
dieselbe Verschärfung: Er vertritt seinen Teilbaum nur noch, solange darin etwas
offen ist; ein fertig zusammengefalteter Zweig bekommt keinen Punkt mehr.

**Das implizite M-Badge entfällt an erledigten Knoten.** Es macht eine
**Kostenannahme** sichtbar (D18) — wo keine getroffen wird, gibt es nichts zu
zeigen. Gilt für Badge und `aria-label` gemeinsam.

**Kein neuer Umschalter** (Nutzer). Der vorhandene „günstigster Pfad" ändert
seine Bedeutung; erwogen war ein zweiter Knopf „offene Front ⇄ Gesamtplan", der
auch „was kostet der Plan insgesamt?" beantwortet hätte. Verworfen: ein neunter
Knopf im Diagramm-Kopf plus i18n in neun Sprachen für eine Frage, die man beim
Planen selten stellt — und die Kopfzeile wurde gerade erst entlastet
(D17-Nachtrag 5).

**Nachgemessen am mitgelieferten Werkbaum-Plan:** 110 Knoten auf dem Pfad
(unverändert), Stationen **69 → 24**. Die verbleibenden sind exakt die offene
Front — Ticket-Referenzen, Öffnen/Speichern, Backend-Gerüst samt REST und
Persistenz, Websocket-Transport, Text-CRDT, die Mermaid-Layout-Teile, das
IDEA-Plugin. Die Linie wird weiterhin gezogen (zwei Pfade: kräftig hinten,
abgetönt vorn). Grafikexport und Druck folgen ohne Zusatzcode — beide lesen
`.node.cheap-leaf` aus dem DOM. 236 Tests grün, davon 14 neue
(`tests/frontier.test.js`); der Snapshot des kanonischen Beispiels ändert sich
um genau zwei Knoten (`[x] Zielgruppenanalyse`, `[x] Sitemap` verlieren
`cheap-leaf`).

**Was das für den gestaffelten Pfad aus der ROADMAP bedeutet:** Dessen
Status-Hälfte ist damit gebaut. Offen bleibt die **Nutzen-Achse** (Ausbaustufen:
ist eine Gruppe komplett realisiert, zur nächsten per Nutzen gewählten Stufe
weiterspringen) — die braucht erst ein Nutzen-Attribut und den Aufwands-Rollup.

**Nachtrag — „erledigt tritt nicht zurück" galt nur auf dem Pfad; jetzt gilt es
überall.** Gemeldet als Frage: „Manche Knoten, die schon in Produktion sind,
werden blau dargestellt und manche grau." Beispiel `#ed.fresh` — grau, außer
wenn der Cursor darauf steht.

Die Ursache war nicht der Status, sondern die Pfad-Inversion: Der Knoten ist
eine **Zugabe** (`+`), und optionale Knoten liegen per D29 nie auf dem
günstigsten Pfad — `.cheap-on .node:not(.cheap)` blasste ihn also aus (Deckkraft
0,32, Sättigung 0,4; Pastellblau `#DBEAF8` liest sich so als Grau). Dass er beim
Anklicken blau wurde, war die Cursor-Ausnahme aus D25.

**Der Widerspruch liegt in diesem Eintrag selbst.** Oben steht „sie auszublassen
hieße, sie sähen aus wie eine verworfene Alternative" — die Regel griff aber nur
für erledigte Knoten **auf** dem Pfad, weil sie an `cheapCls()` hing. Durch das
Raster fielen die fertige Zugabe und die fertige, nicht gewählte Alternative:
`#ed.fresh` ist gebaut und deployed und sah aus wie etwas, das nie passieren
wird. Das Argument von oben trägt dort genauso weit; die Regel war zu eng
gefasst, nicht falsch begründet.

**Entschieden (Nutzer): Was `[x]` oder `[^]` trägt, wird nie ausgeblasst.**
Damit hat die Blässe genau **eine** Bedeutung: „hier ist nichts getan und wird
auch nichts getan". Vorher hieß sie manchmal auch „ist längst fertig" — und die
beiden Fälle sind das Gegenteil voneinander.

**Umgesetzt als eigene Klasse `done`, nicht über die Statusklassen.**
`.cheap-on .node:not(.cheap).st-fertig, …st-prod` hätte ohne neue Klasse
funktioniert, wäre aber **falsch**: `st-…` trägt den **effektiven** Status
(D39), und ein von Abhängigkeiten zurückgehaltenes `[x]` heißt dort z. B.
`st-arbeit`. Die Ausnahme muss dem **intrinsischen** Status folgen — dieselbe
Linie wie bei der XOR-Regel (D35), bei „Was ist neu?" (D28) und bei der
Kostenrechnung dieses Eintrags: Geleistete Arbeit ist geleistet. `render.js`
setzt die Klasse deshalb per `isDone(n)`, also aus derselben Funktion, die auch
die Kosten auf 0 zieht. Gefärbt wird unverändert nach dem effektiven Status —
ein zurückgehaltenes `[x]` steht jetzt in **voller** Stärke in seiner
effektiven Farbe, und die Diskrepanz-Marke (D39) erklärt den Unterschied.

Es ist die **vierte** Ausnahme von der Inversion, nach `.fresh` (D28),
`.focusmark` (D32) und `.current` (D25-Nachtrag) — und alle vier sind
nachgereicht worden, nachdem jemand einen unsichtbaren Knoten gemeldet hat. Das
ist inzwischen ein Muster und steht als Prüffrage in `frontend/CLAUDE.md`: Wer
eine neue Aussage an einen Knoten hängt, fragt zuerst, ob sie ausgeblasst noch
etwas sagt.

**Nebenbefund: Der Grafikexport hatte den Fehler nie.** `diagramToSvg()` liest
`backgroundColor`, nicht `opacity`/`filter` — im exportierten SVG standen diese
Knoten also immer schon in voller Farbe. Der Bildschirm zieht damit nach, statt
dass etwas Neues entsteht.

**Nachgemessen** am mitgelieferten Werkbaum-Plan (149 sichtbare Knoten, Pfad
an): Vorher blass und fertig waren genau **drei** Knoten — `#ed.fresh`,
`#ed.export.print` (beide `+`) und `#ed.closure.greedy` (die nicht gewählte
Alternative neben `#ed.closure.exact`, das als gewähltes schon voll stand).
Alle drei jetzt `opacity 1`, `filter none`, Füllung `rgb(219, 234, 248)` — also
identisch mit den fertigen Knoten auf dem Pfad. Weiterhin blass bleiben **31**
Knoten, darunter **kein einziger** fertiger. 240 Tests grün, davon 4 neue in
`tests/frontier.test.js`; drei Snapshots und eine Zusicherung in
`effective.test.js` (`node root-node held done st-arbeit` — genau der Fall
„intrinsisch fertig, effektiv zurückgehalten") sind um die Klasse ergänzt.

## D47 — Von Station zu Station: ein Knopf, der geht, statt zu schalten
Mit dem status-bewussten Pfad (D46) zeigt das Diagramm die offene Front — im
mitgelieferten Plan 24 Stationen, verteilt über einen Baum von über 20 000 px
Breite. Sie **zu sehen** ist damit gelöst, sie **abzugehen** nicht: Man müsste
jede von Hand suchen. Der Knopf im Diagramm-Kopf holt sie der Reihe nach in die
Mitte.

**Der einzige Knopf im Diagramm-Kopf, der kein Umschalter ist.** „Verworfene
einblenden" (D4), „günstigster Pfad" (D18) und die Falt-Voreinstellung (D44)
beschreiben je einen Zustand; dieser löst eine **Bewegung** aus. Deshalb kein
`aria-pressed` und keine gedrückte Optik — er sieht aus wie „kopieren" und
„herunterladen", die ebenfalls etwas *tun*.

**Der Sprung fasst nur das Diagramm an** (Nutzer): zentrieren, hervorheben,
Tastaturfokus — buchstäblich die Behandlung des ausdrücklichen Alt+Klicks
(D25-Nachtrag 1), inklusive Puls und der Hervorhebung der
Abhängigkeits-Kanten (D41). Erwogen war, zusätzlich die Schreibmarke auf die
Zeile zu setzen; das kostete aber den Fokus im Baum (der nächste Druck müsste
ihn zurückholen) und wäre auf dem Telefon bei jedem Sprung ein Bereichswechsel
weg vom Diagramm. Der Weg in den Text steht direkt daneben offen: **Alt+Enter**
am fokussierten Knoten, dieselbe Geste wie überall.

**Nach der letzten wieder die erste** (Nutzer). Ein Knopf, der am Ende
aufhört, wirkt kaputt und bräuchte eine eigene Rückstell-Geste; dass man wieder
oben ist, sieht man am Baum.

**Kein Zähler am Knopf** (Nutzer). Der „Was ist neu?"-Knopf trägt einen, hier
wäre er ein zehntes Element in einer Zeile, die schon knapp ist — die Zahl der
offenen Stationen steht stattdessen im **Tooltip** („… (24 offen)"), wo sie
nichts kostet.

**Kein eigener Zustand: fortgesetzt wird am hervorgehobenen Knoten.** Ein
gemerkter Index wäre die naheliegende Lösung und die schlechtere: Der Baum wird
bei **jedem Tastendruck** neu gebaut, die Stationsliste ändert sich unter dem
Index, und er zeigte danach auf etwas anderes. `currentNodeEl` (D25) überlebt
den Neubau dagegen von selbst, weil es aus der Cursor-Zeile neu abgeleitet
wird. Liegt der hervorgehobene Knoten nicht auf einer Station — etwa weil
jemand zwischendurch im Text getippt hat —, beginnt der Gang wieder vorn. Das
ist kein Notbehelf, sondern die richtige Antwort auf „zeig mir, was als
Nächstes dran ist".

**Verborgen, solange es nichts anzuspringen gibt** — bei ausgeschaltetem Pfad
(dann gibt es keine Stationen) ebenso wie bei einem durchweg erledigten Plan.
Dieselbe Zurückhaltung wie beim „Was ist neu?"-Knopf (D28).

**Die Kopfzeile hat das nicht mehr getragen — und das war kein Fehler des
Knopfes.** D17-Nachtrag 5 hatte die Zeile gerade erst auf acht Elemente
zurechtgemessen und dabei `flex-wrap:nowrap` als Riegel gesetzt, damit aus
einem stillen Umbruch ein sichtbarer Überlauf wird. Der neunte Knopf hat den
Riegel prompt ausgelöst — nachgemessen aber anders als erwartet:

- Bei **375 px** passte es weiterhin, nachdem die Lücke von 8 auf 6 px und der
  Innenabstand von 10 auf 8 px ging: 345 px Inhalt, 359 px Platz, **14 px
  Luft**, eine Reihe.
- Bei **320 px** ist es Arithmetik: 345 px Inhalt gegen 304 px Platz. Neun
  fingergroße Ziele passen dort nicht, und unter 29 px zu gehen hat
  D17-Nachtrag 5 ausdrücklich abgelehnt.

**Dabei ein älterer, stiller Fehler gefunden:** Bei Platzmangel schrumpfte
nicht etwa irgendetwas gleichmäßig — der **Modus-Wähler** ist das einzige
Element ohne feste Größe und wurde auf einen **2-px-Strich** zusammengedrückt,
während sein Icon 38 px breit darüber hinausragte. Das Bedienelement war
unbenutzbar und sah aus wie ein Trennstrich. `flex:0 0 auto` an allen Kindern
der Zeile stellt das ab: Niemand wird mehr zerdrückt.

**Darum schiebt die Zeile jetzt, statt zu zerdrücken oder abzuschneiden:**
`overflow-x:auto` auf dem Kopf (Scrollbalken ausgeblendet — auf Touch-Geräten
sind sie ohnehin Overlay). Bei 375 px ändert die Regel nichts, weil nichts
überläuft; bei 320 px bleiben alle neun Elemente in voller Größe erreichbar
(nachgemessen: 41 px Schiebeweg, Kopfhöhe unverändert 49 px, Modus-Wähler
wieder 40 px breit). Das ist die ehrliche Fortschreibung der D17-Regel: Der
Riegel sollte einen unbemerkten Layout-Wechsel verhindern, nicht ein
Bedienelement opfern.

*(Das `overflow-x:auto` war ein Fehler und ist zurückgenommen — es machte aus
der Kopfzeile einen Scroll-Container und klippte damit die beiden
Aufklapp-Menüs, die als absolut positionierte Kinder darin hängen. Was an
seine Stelle tritt und warum es niemandem auffiel: **D50**. `flex:0 0 auto`
gegen den zerdrückten Modus-Wähler bleibt.)*

## D48 — Der Werkbaum-Plan erklärt sich selbst: ID und Beschreibung an jedem Knoten
Der mitgelieferte Plan (D27) ist zugleich Vorzeigedokument und Projektübersicht
— und war für Fremde weitgehend stumm. Ein Knoten wie „Stay greedy, but say so"
oder „Cycles are legal" sagt jemandem, der die DECISIONS nicht gelesen hat,
nichts. Jetzt trägt **jeder** der 172 Knoten eine **ID** und einen
**Beschreibungsblock** hinter dem `---`-Trenner.

**Warum die Langform und nicht `"`-Zeilen:** Bei 172 Knoten verdreifachte die
Kurzform die Höhe des Baumteils und machte ihn unlesbar — gerade das, was der
Plan zeigen soll. Hinter dem Trenner bleibt der Baum so kompakt wie vorher;
die Erklärung findet man über die ID. Genau der Fall, für den die Langform
gebaut wurde (D40). Die eine vorhandene `"`-Zeile an „Collaborating" bleibt
stehen: Sie führt die Kurzform weiterhin vor, und beide Formen zum selben
Knoten hängen sich planmäßig aneinander (§1).

**ID-Schema `#bereich.task`, dritte Stufe nur wo nötig** (Nutzer). Acht
Bereiche mit kurzen Kürzeln — `not` Notation, `ed` Editor, `bld` Build,
`be` Backend, `col` Zusammenarbeit, `mmd` Mermaid, `idea` IDEA-Plugin,
`trk` Tracker; die Wurzel ist `#wb`. Wo ein Teilbaum sonst Kunstwörter
bräuchte, kommt eine dritte Stufe dazu (`#ed.closure.union`,
`#mmd.place.horiz`) — vier gibt es nirgends. Vier bereits vergebene IDs sind
ins Schema gewandert (`#closure` → `#ed.closure`, `#scaffold` →
`#be.scaffold`, `#docs` → `#be.docs`, `#resolve` → `#trk.resolve`), die fünf
`:#…`-Verweise darauf mit.

**Englisch wie der Plan** (Nutzer). „Doku auf Deutsch" (CLAUDE.md) gilt der
Projektdokumentation; der Plan ist ein ausgeliefertes Artefakt mit weltweitem
Publikum, und deutsche Blöcke unter einem englischen Baum läsen sich gebrochen
— dieselbe Logik wie beim Beispiel-Dokument (D22) und bei `llms.md` (D43).

**Ein bis zwei Sätze je Knoten** (Nutzer): was es ist und warum es im Plan
steht. Ein Satz ohne das Warum verlöre bei den interessanten Knoten gerade die
Hälfte, die man nicht erraten kann; ein Absatz je Knoten machte den Plan zu
einer zweiten, veraltenden Fassung von DECISIONS.

**Der Preis, gemessen:** Die Datei wächst von 189 auf 902 Zeilen, das Bundle
von 443 auf 506 kB (gzip 247 → 270 kB). Dafür beantwortet das Diagramm jetzt
im Tooltip, was ein Knoten bedeutet — und der Screenreader liest es mit
(`aria-label`).

**Nachgemessen:** 172 Knoten, 172 eindeutige IDs, kein Knoten ohne
Beschreibung, **0 Warnungen**, Pfad weiterhin exakt gerechnet mit 24
Stationen. Der Cursor in einem Beschreibungsblock wählt den beschriebenen
Knoten aus (D40-Nachtrag 2) — auf Kopf- wie Textzeile geprüft; der
`---`-Trenner selbst wählt nichts.

## D49 — Das Textfeld bricht nicht mehr um: `wrap="off"` plus waagerechter Balken
Gewünscht vom Nutzer, und damit die ausdrückliche Umkehrung der D33-Abwägung
(„Verworfen: `wrap=off` … der Umbruch ist die wichtigere Eigenschaft"). Der
dort notierte Preis bleibt richtig und wird in Kauf genommen; was dort **nicht**
bedacht war, ist die andere Seite:

**Ein weicher Umbruch zerstört die Einrückung — und die trägt hier die
Hierarchie.** In dieser Notation ist der linke Rand keine Formsache, sondern
die Ebene (§2). Bricht eine Zeile um, beginnt ihre Fortsetzung am linken Rand
und sieht damit aus wie ein Wurzelknoten; wer die Struktur überfliegt, liest
eine Ebene, die es nicht gibt. Das trifft genau die langen Zeilen, also die mit
ID, Größe und Kommentar — und seit D48 ist das praktisch jede Zeile des
mitgelieferten Plans. Waagerechtes Scrollen kostet Bequemlichkeit; der Umbruch
kostete Lesbarkeit der Struktur.

**Umgesetzt am Element, nicht in CSS:** `wrap="off"` am `<textarea>`. Es ist
die Eigenschaft des Feldes, nicht seiner Gestaltung, und es wirkt zuverlässig
in allen Engines; `overflow:auto` steht daneben im Stylesheet.

**Der Spiegel musste mit.** `syncMirror()` (D25/D33) maß mit `white-space:
pre-wrap` und **fester Breite** — genau die Kombination, die im Spiegel Zeilen
umbräche, die im Textfeld ungebrochen stehen. Jede Zeile darunter läge dann zu
tief, und die Zeilennummern wanderten weg. Der Spiegel ist deshalb jetzt `pre`
und ohne Breitenvorgabe.

**Gemessen wird trotzdem weiter.** Ohne Umbruch wäre `Zeilenhöhe × n` richtig
und der Spiegel überflüssig — so hat D33 den Fall beschrieben. Behalten wurde
die Messung dennoch: Die Schriftgröße unterscheidet sich zwischen Telefon und
Schreibtisch (D17-Nachtrag 2), und die Messung stimmt in beiden Fällen von
selbst, ohne eine zweite Stelle, die dieselbe Zahl kennen muss.

**Der Sprung setzt die waagerechte Verschiebung zurück.** `jumpToLine()`
markiert die **ganze** Zeile (D25) — der Browser scrollt dann von sich aus an
deren **Ende**, und man landete am rechten Rand, ohne Einrückung, Zeichen und
Statusbox zu sehen. Also `scrollLeft = 0` nach dem Markieren: Der Sprung zeigt
auf eine Zeile, nicht auf ihr Ende.

**Der Zeilennummern-Streifen bleibt stehen.** Er verschiebt sich weiterhin nur
gegen `src.scrollTop`; den waagerechten Balken macht er nicht mit. Das war
schon so gebaut und ist jetzt das gewünschte Verhalten statt eines
Nebenprodukts — nachgemessen: linke Kante unverändert, während der Text um
180 px verschoben ist.

**Nachgemessen** am mitgelieferten Plan (903 Zeilen, längste 122 Zeichen):

| | Schreibtisch | Telefon (375 px) |
|---|---|---|
| Bildzeilen zu logischen Zeilen | 903 : 903 | 903 : 903 |
| waagerechter Schiebeweg | 211 px | 432 px |
| sichtbare Zeichen | rund 110 | rund 53 |
| Abweichung der Zahlen am Dateiende | — | 2 px auf 903 Zeilen |

Die zwei Pixel stammen daher, dass `offsetTop` ganzzahlig rundet, die
Zeilenhöhe aber 17,408 px beträgt; sie sammeln sich nicht auf (jede Zahl wird
absolut gemessen, nicht fortgeschrieben).

**Der D33-Einwand bleibt bestehen, nur nicht mehr entscheidend:** Im schmalen
Spiegel neben einem eingebetteten Pad (D31) und auf dem Telefon sieht man jetzt
rund 53 Zeichen und muss schieben. Wer dort viel liest, zieht den Splitter auf
oder wechselt in die Textansicht. Ein Umschalter dafür wurde nicht gebaut — aus
demselben Grund wie in D33: ein Bedienelement plus neun Übersetzungen für einen
Zustand, den kaum jemand umstellen will.

## D50 — Kein `overflow` an der Titelzeile: sie trägt die Aufklapp-Menüs
Gemeldet: „Dokumente aufklappen/auswählen funktioniert in Mobilansicht nicht."
Eine Regression aus D47, einen Tag alt.

**Ursache.** D47 gab der Titelzeile auf Mobil `overflow-x:auto`, damit bei
320 px alle neun Bedienelemente erreichbar bleiben. Damit wird sie zum
**Scroll-Container** — und beide Aufklapp-Menüs hängen als absolut
positionierte Kinder genau darin: `#docMenu` (Dokumente) im Editor-Kopf,
`.dlmenu` (Download) im Diagramm-Kopf. Beide standen anschließend im
abgeschnittenen Bereich.

**Der Teil, der beim Bauen übersehen wurde, ist eine CSS-Regel:** `overflow-x`
auf etwas anderes als `visible` zu setzen hebt ein `visible` der **anderen
Achse** auf `auto`. Gemessen: `overflow-x:auto` ⇒ `overflow-y:auto`. Geklippt
wurde also nicht seitlich, wo man es beabsichtigt hatte, sondern **nach
unten** — dorthin, wo die Menüs aufklappen. Deshalb war der Fehler auch nicht
auf schmale Geräte beschränkt: Ein Scroll-Container klippt, ob er überläuft
oder nicht, also auf **jeder** Mobilbreite.

Nachgestellt bei 375 px: Das Dokumenten-Menü ist 153 px hoch und beginnt 156 px
unterhalb der Kopfunterkante (`clientHeight` 43, `scrollHeight` 200);
`elementFromPoint` an seiner Stelle liefert das Textfeld. Das Download-Menü
ebenso — dort kam der Diagramm-Hintergrund zurück. Aufklappen ging also nicht
bloß „nicht gut", das Menü war gar nicht da.

**Behoben durch Wegnahme, nicht durch einen Umweg.** Erwogen war, die Menüs per
`position:fixed` aus dem Container zu heben und beim Öffnen aus dem
Trigger-Rechteck zu positionieren — das hätte beides gerettet, aber JS-Geometrie
für etwas eingeführt, das CSS bisher allein konnte, samt Nachführen bei jeder
Größenänderung. Der Preis stand in keinem Verhältnis zum Gewinn: Das `overflow`
diente **ausschließlich** Breiten unter rund 360 px, kaputt waren die Menüs
**überall**.

**An seine Stelle tritt Umbrechen — aber nur dort, wo es rechnerisch nicht
passt.** Unter 360 px (`@media (max-width:360px)`) darf die Zeile umbrechen;
darüber bleibt `nowrap` als Riegel. Das nimmt D17-Nachtrag 5 nicht zurück: Der
Riegel sollte einen **unbemerkten** Layout-Wechsel verhindern, und ein Umbruch
bei einer Breite, bei der neun Fingerziele arithmetisch nicht nebeneinander
passen, ist keine Überraschung, sondern die einzige ehrliche Möglichkeit.
Nachgemessen: 375 px eine Reihe zu 49 px, alles innerhalb; 320 px zwei Reihen zu
78 px, alle neun Elemente vollständig sichtbar, Modus-Wähler weiterhin 40 px
breit (`flex:0 0 auto` aus D47 bleibt und ist unabhängig richtig).

**Geprüft ist jetzt die Bedienung, nicht die Geometrie.** Der D47-Nachweis
bestand aus Breiten und Höhen — und genau darin war der Fehler unsichtbar, weil
die Kopfzeile ja weiterhin 49 px hoch war und alle Knöpfe an ihrem Platz saßen.
Gemessen wird deshalb jetzt, ob das Menü nach dem Öffnen an seiner eigenen
Stelle auch **getroffen** wird (`elementFromPoint` landet auf `.docitem` bzw.
`.dlmenu`) und ob ein Klick darauf das Dokument wirklich wechselt (Werkbaum →
Example: Titel, `werkbaum-active` und der neu gebaute Baum). Beides bei 375 px
und bei 320 px.

**Lehre, im selben Geist wie D25 und D17-Nachtrag 4:** Wer einer Leiste
`overflow` gibt, entscheidet damit über alles, was aus ihr herausragen soll —
Menüs, Tooltips, Overlays. In `frontend/CLAUDE.md` steht das jetzt bei der
Kopfzeilen-Stolperfalle.

## D51 — Ein neues Dokument beginnt mit seinem Namen
Bisher legte „＋ Neu" das Dokument unter „Unbenannt" an und setzte den Cursor
ins leere Textfeld. Das Umbenennen war ein eigener, zweiter Gang durchs Menü —
und wurde entsprechend oft nicht gemacht: Wer drei Pläne führt, hat drei
„Unbenannt". Jetzt öffnet sich unmittelbar das Inline-Umbenennen (D22) mit
**ausgewähltem** Vorschlag; tippen ersetzt ihn, Enter bestätigt.

**Das Dokument existiert vorher.** Angelegt, gespeichert und aktiviert wird wie
bisher; nur der Fokus geht ins Namensfeld statt ins Textfeld. Ein **Abbruch
verwirft nichts** — Esc behält den Vorschlag „Unbenannt", so wie es vorher der
Normalfall war. Der Gegenentwurf (erst benennen, dann anlegen) hätte ein
Dokument im Schwebezustand gebraucht und die Frage aufgeworfen, was bei Esc
passiert; das ist mehr Mechanik für weniger Verlässlichkeit.

**Nach dem Benennen geht es im Textfeld weiter.** Anlegen heißt schreiben
wollen — den Namen zu vergeben ist die erste Hälfte der Geste, nicht ihr Zweck.
Der Merker `renameIsNew` unterscheidet diesen Fall vom gewöhnlichen Umbenennen
aus dem Menü, das unverändert bleibt (Menü bleibt offen, Fokus wandert nicht).
Er wird in `closeDocMenu()` mit zurückgesetzt, sonst trüge ein abgebrochener
Vorgang seine Sonderbehandlung in den nächsten hinein.

Für alle drei Wege aus dem Eingabefeld gilt dasselbe: **Enter**, **Esc** und
**Fokusverlust** benennen (bzw. behalten den Vorschlag), schließen das Menü und
setzen den Cursor in den Text. Auf dem Telefon ist das zugleich der Moment, in
dem die Bildschirmtastatur gebraucht wird — `keyboardOnJump(false)` steht schon
da, aus demselben Grund (D25: neues, leeres Dokument = tippen ist gemeint).

**Nachgemessen:** Nach „＋ Neu" trägt das Eingabefeld den Fokus, der Vorschlag
ist vollständig markiert (`selectionStart` 0 bis Länge). Enter mit „Sprint 15":
Titelzeile, `werkbaum-docs` und der Fokus im leeren Textfeld stimmen. Esc:
Vorschlag bleibt, Menü zu, Fokus im Text. Umbenennen eines bestehenden
Dokuments: Menü bleibt offen, Fokus bleibt, wo er war.

**Grenze der Prüfung, benannt:** Der Fokusverlust ließ sich nur als
**zugestelltes Ereignis** prüfen, nicht als echter Fokuswechsel — ein
synthetisches `.blur()` löst im Automaten keinen aus. Gegenprobe am
**unveränderten** Pfad (bestehendes Dokument umbenennen): dort passiert
ebenfalls nichts, es ist also die Werkzeuggrenze und keine Regression. Dieselbe
Lehre wie in D25 und D17-Nachtrag 4 — was die Geräteumgebung stellt, beweist
der Emulator nicht.

## D52 — Auf Touch öffnet der einfache Tipp das Knoten-Fenster, nicht den Link
Die Beschreibungen (D40) lebten im `title` — und ein `title` braucht einen
Zeiger. D40 hat das als bekannte Grenze notiert („auf Touch-Geräten gibt es
keine Tooltips — dort bleibt der Text vorerst nur im `aria-label`; ein Pop-up
kann später ergänzt werden"). Auf dem Telefon war die Beschreibung damit **gar
nicht** zu sehen, und seit D48 hängt an jedem der 172 Plan-Knoten eine.

**Die eine echte Frage war der Link.** Ein Knoten mit URL ist ein `<a>` und
belegt den einfachen Klick vollständig (§6, D6); ein Tipp kann nicht beides
tun. Entschieden (Nutzer): **Auf Touch öffnet der Tipp immer das Fenster, und
der Link steht darin als Knopf.** Damit hat die Geste dort **eine** Bedeutung —
„ansehen" —, und die Tooltips sind auf **allen** Knoten erreichbar. Preis:
SPEC §6 bekommt eine Touch-Ausnahme, und der Link kostet einen zweiten Tipp.

**Verworfen:**
- **Nur unverlinkte Knoten** — hätte §6 unangetastet gelassen, aber derselbe
  Tipp hätte je nach Knoten Verschiedenes getan. Genau das hat D25 für diese
  Geste ausdrücklich abgelehnt, und ausgerechnet die verlinkten Knoten (oft die
  interessanten) wären ohne Beschreibung geblieben.
- **Erster Tipp Fenster, zweiter Tipp Link** — spart den Knopf, führt aber eine
  unsichtbare Zusatzregel ein: Nichts zeigt an, dass ein zweiter Tipp etwas
  anderes tut.

**Es hängt an den Touch-Ereignissen, nicht an einer Media Query.** Damit
verhält sich ein Gerät mit **beidem** (Touch-Notebook) richtig, ohne
Sonderfall: Der Finger öffnet das Fenster, die Maus öffnet weiterhin den Link
und zeigt den Tooltip. Nachgemessen am Schreibtisch: Klick auf den verlinkten
Wurzelknoten öffnet den Link, das Fenster bleibt zu, der `title` steht
unverändert am Knoten.

**Die drei Touch-Gesten unterscheiden sich am vorhandenen Zustand, ohne neues
Merkerfeld.** Der lange Druck (D25) setzt nach 500 ms `armedEl`, und jedes
`touchmove` räumt den Timer weg. Bei `touchend` gilt also: `armedEl` gesetzt ⇒
Sprung; Timer läuft noch ⇒ kurzer Tipp ohne Wischen ⇒ Fenster; beides weg ⇒ es
wurde gescrollt ⇒ nichts. **Ausgenommen ist das Falt-Zeichen** (D38): Der Tipp
darauf muss weiter umklappen, und weil das Fenster `preventDefault()` braucht
(sonst öffnete der Link-Knoten zusätzlich seine URL), hätte es den folgenden
Klick sonst verschluckt — Falten wäre auf Touch unbedienbar geworden.
Nachgemessen: Tipp auf das ▾ des Wurzelknotens 149 → 1 Knoten, kein Fenster.

**Es ist ein Fenster, kein zweiter Tooltip — also nutzt es, was ein `title`
nicht kann.** Der Trennstrich zwischen Beschreibung und Kurz-Fakten musste
dort aus 24 `─` gebaut werden (D40-Nachtrag), weil `title` kein Markup kennt;
hier ist er eine echte Linie, und ohne Beschreibung entfällt er ganz. Zerlegt
wird der `title` **an genau diesem Strich** (`TIP_RULE`, jetzt exportiert). Die
Alternative wäre ein zweites data-Attribut mit derselben Beschreibung gewesen —
im Werkbaum-Plan rund 20 kB DOM-Text als reine Verdopplung.

**Einzelne Zeilenumbrüche werden zu Leerzeichen, Leerzeilen zu Absätzen.** Das
ist die Lesart von SPEC §1 („Leerzeilen bleiben als Absatztrenner"), und es war
im Fenster sofort zu sehen: Die Beschreibungen im Plan sind bei ~76 Zeichen
umgebrochen, und in einem 336 px breiten Fenster stand der Text dadurch
ausgefranst („…a textual notation for work breakdown / structures, a browser
editor…"). Der `title` zeigt die harten Umbrüche weiterhin — dort haben wir
keine Wahl.

**Der Sprung-Hinweis nennt hier den langen Druck.** Der Tooltip endet mit
„Alt+Klick: zur Zeile im Text"; Alt gibt es auf dem Telefon nicht. Neuer
i18n-Schlüssel `jumpHintTouch` in allen neun Sprachen, plus `tipClose` und
`tipOpenLink`.

**`position:fixed` auf `<body>`, nicht in `#out`.** Ein Kind von `#out` erbte
dessen CSS-`zoom` (der Fenstertext skalierte mit dem Diagramm) und würde von
dessen `overflow` beschnitten — die Falle aus D50. Gesetzt wird aus
`getBoundingClientRect()`, das den Zoom schon enthält; waagerecht an den
Fensterrand geklemmt, nach oben ausweichend, wenn unten kein Platz ist. Die
Spitze bleibt über `--tipx` am Knoten, auch wenn geklemmt wurde (nachgemessen:
0 px Abweichung von der Knotenmitte im Normalfall).

**Zu macht es alles, was seine Aussage hinfällig macht:** Tipp daneben, zweiter
Tipp auf denselben Knoten, Esc, das ×, **Scrollen des Diagramms** (das Fenster
ist `fixed`, der Knoten wandert — es zeigte danach auf etwas anderes), der
**Bereichswechsel** auf Mobil (das Ziel ist dann `display:none`), der **Sprung
in den Text** (er führt weg) und jeder **Neubau** (er ersetzt das Element, an
dem es hängt). Die letzten drei fehlten in der ersten Fassung und fielen erst
im Durchspielen auf.

**Nachgemessen** (375 × 812, mitgelieferter Werkbaum-Plan): Tipp auf den
Wurzelknoten öffnet 336 × 220 px vollständig im Bild, mit Beschreibung als
einem Absatz ohne harte Umbrüche, Fakten `#wb · in Arbeit · Langer Druck: zur
Zeile im Text` und Knopf „↗ Link öffnen"; der Knoten trägt den Petrol-Ring, die
URL wird **nicht** geöffnet. Knoten ohne Beschreibung: nur die Faktenzeile,
39 px, ohne Trennstrich. Zweiter Tipp, Esc, Tipp daneben und eine **echte**
Wischgeste (`scrollLeft` 0 → 300) schließen; der lange Druck springt und
schließt mit.

**Werkzeuggrenze, wie in D25 und D17-Nachtrag 4:** Synthetische `TouchEvent`s
beweisen nur die eigene Ereignis-Logik — dass der Tipp den Link unterdrückt,
dass die drei Gesten auseinandergehalten werden, dass Position und Inhalt
stimmen. Sie beweisen **nicht**, wie ein echter Finger mit dem 300-ms-Klick,
dem Doppeltipp-Zoom und der Textauswahl des Systems zusammenspielt. Zwei
Messungen liefen deshalb auffällig ins Leere und sind hier festgehalten, damit
sie niemand für Befunde nimmt: Ein programmatisch gesetztes `scrollLeft` löste
**kein** `scroll`-Ereignis aus (die D33-Falle — geprüft wurde daraufhin mit
einer echten Wischgeste), und ein synthetischer Tipp trifft einen Knoten auch
dann, wenn er 8968 px **außerhalb** des Bildes liegt — dort zeigte das Fenster
folgerichtig auf nichts. Ein Finger kann das nicht.

**Nicht im Druck** (`.nodetip` und der `.tipped`-Ring ausgeblendet) und nicht
im Grafikexport — Bedienung, keine Aussage über den Plan; der Export liest
ohnehin nur `#out`.

## D53 — Tab rückt Zeilen ein, statt die Auswahl zu ersetzen — und zerstört kein Undo mehr
Zwei gemeldete Fehler, eine Zeile. Der Tab-Handler schrieb:

```js
src.value = value.slice(0, s) + '  ' + value.slice(eEnd);
```

**Fehler 1: Mehrere markierte Zeilen wurden durch zwei Leerzeichen ersetzt.**
Der Ausdruck schneidet den Bereich zwischen Auswahlanfang und -ende heraus.
Ohne Auswahl (`s === eEnd`) fügt er nur ein — deshalb ist es nie aufgefallen,
solange niemand mehrere Zeilen auf einmal einrücken wollte. In einer Notation,
in der die Einrückung die **Hierarchie** ist (SPEC §2), ist das die
naheliegendste Geste überhaupt.

**Fehler 2: Undo war danach tot.** `src.value = …` löscht die Undo-Historie
eines Textfelds vollständig — das steht seit D38-Nachtrag 2 im Projekt
(„nachgemessen: `value =` und `setRangeText` machen Strg+Z wirkungslos"), war
aber nur für das Zurückschreiben der Faltung beherzigt worden. Hier erneut
gemessen, mit der alten Zeile nachgestellt: Nach dem Schreiben ändert das
erste `undo` **nichts** (Text unverändert), das zweite liefert **`false`** —
der Stapel ist leer. Betroffen ist damit nicht nur das Einrücken selbst,
sondern **alles davor Getippte**. Das ist die Antwort auf „wann geht Undo
kaputt": bei **jedem** Tab-Druck, und sonst nirgends im laufenden Bearbeiten.
Die übrigen drei `src.value =` im Code laden ein **anderes** Dokument
(Dokumentwechsel, Wiederherstellen, Pad-Abruf) — dorthin gibt es nichts
zurückzunehmen, dort ist es richtig.

**Die neue Regel, bewusst einfach:**

- **Ohne Auswahl** zwei Leerzeichen an der Schreibmarke (Tab zählt in dieser
  Notation als zwei, SPEC §2); **Shift+Tab** nimmt der Zeile den Einzug wieder
  und zieht die Schreibmarke um dasselbe Stück mit, damit sie am selben
  Zeichen stehen bleibt.
- **Mit Auswahl** wird **jede berührte Zeile** ein- bzw. ausgerückt.

Erwogen war die Editor-übliche Feinregel „nur bei mehrzeiliger Auswahl
einrücken, sonst die Auswahl ersetzen" (so macht es VS Code). Verworfen: Wer
**eine** ganze Zeile markiert und Tab drückt, meint auch dann Einrücken — und
die einfache Regel hat die bessere Eigenschaft, dass Tab **niemals Text
löschen kann**. Der Preis ist, dass ein markiertes Wort nicht mehr durch
Leerzeichen ersetzt wird; in einem Notationseditor ist das kein Verlust.

Nach dem Zug ist der **ganze Zeilenblock** ausgewählt, sodass wiederholtes Tab
weiter einrückt. Endet die Auswahl genau auf einem Zeilenanfang, gehört diese
Zeile **nicht** mehr dazu — sonst rückte ein Zug bis zum nächsten Zeilenbeginn
eine Zeile zu viel ein. **Leerzeilen** bekommen keinen Einzug (er wäre
unsichtbarer Weißraum), und beim Ausrücken fällt wahlweise die
Zwei-Leerzeichen-Stufe, ein Tabulator oder ein einzelnes Leerzeichen — sonst
bliebe eine ungerade Einrückung hängen.

**Nebenbefund, mitbehoben: Tab war eine Tastenfalle.** Der Handler nahm die
Taste bedingungslos; wer nur mit der Tastatur arbeitet, kam aus dem Textfeld
nicht mehr heraus (WCAG 2.1.2 „No Keyboard Trap"). **Esc** hebt sie jetzt für
den nächsten Tastendruck auf — der übliche Ausweg. Das kollidiert nicht mit
dem Esc, das das Knoten-Fenster schließt (D52): Das hängt an `document` und
läuft weiter.

**Nachgemessen** an einem Wegwerf-Dokument, mit **echten** Tastendrücken:
Drei markierte Zeilen, Tab → alle drei von 2 auf 4 Leerzeichen, **nichts
gelöscht**, Block bleibt ausgewählt, Fokus bleibt im Feld, Diagramm weiter
4 Knoten. Shift+Tab → zurück auf 2. Undo-Kette: tippen `(XL)`, dann Tab, dann
zweimal `undo` → erst der Einzug zurück, dann das Getippte; beide Zustände
zeichengenau wie zuvor.

**Werkzeuggrenze, die dabei fast zu einem Fehlschluss geführt hätte:** Ein
synthetisches `ctrl+z` aus der Automatisierung löst **kein** natives Undo aus
— der Text blieb stehen, was zunächst wie „Undo weiterhin kaputt" aussah. Im
selben Moment griff `document.execCommand('undo')` einwandfrei. Geprüft wird
Undo deshalb über `execCommand('undo')`; das steht jetzt auch in
`frontend/CLAUDE.md`. Dieselbe Lehre wie D25 (synthetische `TouchEvent`s) und
D17-Nachtrag 4 (Bildschirmtastatur): Was die Umgebung stellt, stellt der
Emulator nicht.

## D54 — Frühere Stände: alle zehn Minuten, nur bei Änderung, die letzten zwanzig
Ein Sicherheitsnetz gegen Versehen — und der Anlass war ein echtes: Der
Tab-Fehler aus D53 konnte eine ganze Auswahl löschen und nahm dabei auch noch
das Rückgängig mit. Ohne Netz war der Text dann weg.

**Aufbewahrt werden die letzten 20 je Dokument** (Nutzer-Entscheidung), also
rund 3½ Stunden bei gleichmäßigen Abständen und höchstens ~800 kB beim größten
Dokument. Erwogen und verworfen: **ausgedünnt** (alle der letzten Stunde,
stündlich für einen Tag, täglich für eine Woche — reicht weiter zurück, kostet
aber eine Ausdünn-Regel, die man beim Lesen erst verstehen muss) und
**lückenlos 24 Stunden** (bis zu 144 Stände, beim großen Plan ~5,8 MB und damit
über dem localStorage-Limit — es bräuchte doch wieder eine Notbremse). Der
Anspruch ist bewusst klein: Wer weiter zurück will, hat Git.

**„Nur bei Änderung" heißt: gegen den letzten Stand, nicht gegen das Laden.**
Gibt es noch keinen Stand, wird gegen den Text beim Aktivieren des Dokuments
verglichen (`snapBase`). Ohne das legte der erste Takt nach dem Öffnen auch ein
**unverändertes** Dokument weg — beim Herumklicken durch mehrere Dokumente
sammelte sich so Ballast, den niemand erzeugt hat. Nachgemessen: Ohne Eingabe
entsteht der Schlüssel im localStorage gar nicht erst.

**Die Dokumente sind wichtiger als ihre Stände.** Beide teilen sich den
localStorage. Läuft er über, wirft `persistSnaps()` deshalb so lange den
jeweils ältesten Stand weg, bis es passt, notfalls alle — statt eine Ausnahme
hochzureichen und damit womöglich das Speichern der **Dokumente** zu
gefährden. Ein gelöschtes Dokument nimmt seine Stände mit.

**Zurückgeholt wird undo-fähig** (`replaceTextUndoable`, D53): ein Griff
daneben kostet ein Strg+Z, keine Rückfrage — dieselbe Haltung wie beim Falten
(D38-Nachtrag 2). Vorher wird der **aktuelle** Stand weggelegt, falls er noch
nicht drin ist; sonst wäre ausgerechnet er das Einzige, was das Zurückholen
verlöre.

**Pad-Dokumente (D31) bleiben außen vor.** Ihr Textfeld ist schreibgeschützt —
ein alter Stand ließe sich dort gar nicht einsetzen, und Stände zu sammeln,
die niemand laden kann, wäre nur Ballast. Der Knopf ist dort verborgen
(`src.readOnly` bewacht Sammeln, Laden und Sichtbarkeit).

**Platzierung: rechts neben dem Dokumenten-Wähler** (Nutzer-Vorgabe), beide in
einer Gruppe, die das `margin-right:auto` trägt. Der Positionsbezug des Menüs
ist der **Knopf**, nicht die Gruppe: An der Gruppe ausgerichtet (`right:0`)
begann es 190 px weiter links und lief aus dem Panel heraus — in der ersten
Fassung gebaut, im Bild sofort zu sehen und nachgemessen (linke Kante bei
−65 px). Jetzt `position:relative` an einer Hülle um den Knopf und `left:0` am
Menü: linke Kante bei 99 px, gleichauf mit dem Knopf, ganz im Panel.

Jeder Eintrag nennt **Uhrzeit und Zeilenzahl** — die Zeilenzahl sagt auf einen
Blick, welchen der ähnlich benannten Stände man greift. Neueste zuoberst,
danach sucht man zuerst.

**Nachgemessen** (Takt für die Prüfung auf 2 s verkürzt, danach zurückgestellt
und geprüft): ohne Eingabe kein Eintrag; nach einer Eingabe genau einer; ohne
weitere Eingabe kommt keiner dazu; nach 29 Änderungen sind es **20** (gedeckelt,
Zeitstempel aufsteigend, der älteste ist der kleinste Text). Menü: 20 Einträge,
neueste zuoberst. Klick auf einen älteren Eintrag lädt ihn (36 → 32 Zeilen),
schließt das Menü, das Diagramm zeichnet neu (30 Knoten) — und ein `undo` holt
den vorherigen Stand zeichengenau zurück. Der **Pad-Fall** ist durch die
`readOnly`-Wächter im Code abgedeckt, aber nicht live durchgespielt (er
bräuchte ein echtes Pad).

**Nachtrag — ein Knopf, der von Hand sichert.** Zehn Minuten sind der falsche
Takt für den einen Moment, in dem man einen Stand wirklich will: unmittelbar
**vor** einer größeren Änderung. Genau dann ist der letzte selbsttätige Stand
im Zweifel neun Minuten alt und enthält die Arbeit nicht, die man gleich
aufs Spiel setzt. Der Knopf steht rechts neben dem Verlaufs-Knopf, in
derselben Gruppe wie der Dokument-Wähler.

**Kamera, nicht Plus.** Ein `+` unmittelbar neben dem Dokument-Namen liest
sich als „neues Dokument" — das gibt es schon, im Menü daneben. Ein
Lesezeichen läse sich als „Favorit". Die Kamera ist gegen beide Nachbarn
eindeutig (Uhr mit Pfeil = Verlauf, Caret = Dokumentwahl) und trifft die
Vorstellung, die der Nutzer selbst benannt hat („einen Snapshot manuell
anfertigen"). Die UI-Texte bleiben bei „Stand", weil das Menü daneben so
heißt.

**Die Rückmeldung kommt immer — auch wenn nichts angelegt wurde.** Ein Knopf,
der bei unverändertem Text stumm bleibt, wirkt kaputt; genau das passiert,
denn `snapshotNow()` legt keinen doppelten Eintrag an. Der Ausweg ist keine
zweite Meldung, sondern eine genauere Zusage: Der Knopf verspricht **„dein
aktueller Stand ist gesichert"**, nicht „ein Eintrag wurde erzeugt". Bei
unverändertem Text steht er bereits oben in der Liste — die Zusage stimmt
also in beiden Fällen, und es braucht weder eine Fallunterscheidung noch
einen zehnten i18n-Text. Einen Eintrag zu erzwingen wäre die schlechtere
Wahl: Er kostete einen der zwanzig Plätze für Text, der schon da ist.

Gezeigt wird das mit dem **vorhandenen** Haus-Idiom: `flashBtn()` setzt für
1,5 s die Klasse `done`, die Petrol färbt und das Icon gegen einen Haken
tauscht — dieselbe Rückmeldung wie bei „kopieren" und „herunterladen". Dafür
musste nur die CSS-Regel `.copybtn.done .ic-copy` um `.ic-main` erweitert
werden: die neutrale Form desselben Platzes für Knöpfe, die nichts kopieren.

Ein **offenes Menü bleibt offen** und zeichnet neu — dort sieht man den
Eintrag entstehen. Der Pad-Fall folgt von selbst: Beide Knöpfe werden in
**einer** Zuweisung versteckt (`snapBtn.hidden = snapAddBtn.hidden =
src.readOnly`), sie können also nicht auseinanderlaufen.

Der Leer-Text des Menüs nennt jetzt beide Wege („auf Knopfdruck und alle 10
Minuten") — er ist die Stelle, an der jemand fragt, wie man überhaupt zu
einem Stand kommt.

**Nachgemessen** (Werkbaum-Plan, Stände zuvor leer): 0 → Klick → **1**,
Haken sichtbar (`ic-done` block, `ic-main` none), nach 1,7 s wieder das
Kamera-Icon. Zweiter Klick **ohne** Änderung → weiterhin 1, Rückmeldung
trotzdem. Text geändert, Klick → **2**; Menü zeigt beide, neueste zuoberst,
und liegt vollständig im Panel. Im schmalen Layout kostet der Knopf nichts:
Kopfhöhe 44 px und Zeilenzahl sind mit und ohne ihn identisch, die Breite des
Dokument-Namens bleibt bei 54 px.

**Nachtrag 2 — der Knopf sicherte nichts, wenn noch nichts geändert war.**
Gemeldet: „I took a manual snapshot, and expected it to appear in the list of
snapshots. but it does not appear. List is empty." Nachgestellt und
bestätigt — und es war die schlimmste Bauart eines Fehlers: Es wurde **nichts
gespeichert, der Knopf bestätigte aber trotzdem**. Er hat gelogen.

**Die Ursache ist der Denkfehler des ersten Nachtrags.** `snapshotNow()`
vergleicht bei **leerer** Liste gegen `snapBase` — den Text beim Öffnen des
Dokuments. Für den Takt ist das richtig und der Grund, warum bloßes Ansehen
keine Stände sammelt. Für den Knopf ist es falsch, und die Begründung von oben
(„bei unverändertem Text steht er schon oben in der Liste") trifft genau dann
nicht zu, wenn die Liste leer ist: Dann steht er **nirgends**. Das ist
ausgerechnet der Fall, für den der Knopf gebaut wurde — Dokument öffnen,
zuerst sichern, *dann* die große Änderung. Die Messung des ersten Nachtrags
hat ihn nicht gefunden, weil sie mit einer Eingabe begann; sie prüfte die
Wirkung des Knopfes, nicht seinen Anlass.

**Behoben mit einem Schalter, nicht mit einer zweiten Funktion:**
`snapshotNow(manuell)` lässt die `snapBase`-Sperre nur für den Takt gelten.
Verglichen wird für den Knopf allein gegen den **letzten Eintrag** — der
doppelte Eintrag bleibt vermieden, und die Zusage „dein Stand ist gesichert"
wird in jedem Fall wahr, statt nur meistens.

Zwei Stellen zogen mit. `loadSnapshot()` legt den aktuellen Stand ebenfalls
als **bewusstes** Ereignis weg (in der Sache unverändert — dort ist die Liste
nie leer, sonst gäbe es nichts zu laden — aber jetzt sagt der Aufruf, was er
meint). Und der Takt heißt jetzt `setInterval(() => snapshotNow(), …)`: Ein
durchgereichtes Argument wäre wahr und hebelte genau die Sperre aus, die er
als Einziger braucht — dieselbe Falle, die schon D17-Nachtrag 4 bei
`setAppHeight` benannt hat.

**Nachgemessen**, beide Richtungen getrennt. Knopf (kleines Dokument, Liste
zuvor leer): 10 Zeilen, Klick **ohne jede Eingabe** → Liste `[10]`; eine Zeile
eingefügt, Klick → `[10, 11]`; Menü zeigt beide, neueste zuoberst; ältesten
laden → Text zurück auf 10 Zeilen, kein zusätzlicher Eintrag. Takt (für die
Prüfung auf 2 s verkürzt, danach zurückgestellt und nachgesehen): Dokument nur
angesehen, drei Takte → **0** Stände; nach einer Änderung → 1; weitere Takte
ohne Änderung → weiterhin 1. Die Sperre wirkt also weiter genau dort, wo sie
hingehört.

**Nicht durch Tests gedeckt:** Die Stände leben in `app.js` (localStorage,
DOM), und dafür gibt es keine Testumgebung — dieselbe Lücke wie bei
`applyOptStairs()` (D29) und `drawDepLinks()` (D41). Ein Fehler dieser Art
fällt deshalb erst im Browser auf, und das ist der Preis dafür, dass die
Zustandslogik im UI-Modul sitzt statt in `model.js`.

**Nachtrag 3 — die Regeln ziehen nach `snapshots.js` um, damit sie prüfbar
sind.** Nachtrag 2 endete mit dem Satz, die Stände seien „nicht durch Tests
gedeckt … das ist der Preis dafür, dass die Zustandslogik im UI-Modul sitzt".
Der Preis war zu hoch: Der Fehler kam bis in Produktion, und ein Test hätte
ihn in einer Zeile gefunden. Also wird nicht der Preis bezahlt, sondern die
Ursache beseitigt.

**Geschnitten wird nach dem Vorbild von `remote.js` (D31): die entscheidbare
Hälfte heraus, die I/O bleibt.** `snapshots.js` beantwortet, **was gilt** —
wann ein Stand entsteht (`addSnapshot`), was bei Platzmangel zuerst fliegt
(`dropOldestSnap`, `persistSnaps`), was aus dem Speicher überhaupt gelesen
werden darf (`parseSnaps`) und wie ein Eintrag heißt (`snapLabel`). In
`app.js` bleibt, **woher die Werte kommen** (aktives Dokument, Schreibschutz,
Textfeld) und **wohin sie gehen** (`localStorage`, Menü). Der Speicher wird
als `{setItem, removeItem}` hereingereicht, die Uhr als Zahl — genau die
beiden Abhängigkeiten, an denen die Prüfbarkeit vorher scheiterte. `app.js`
verliert dabei 55 Zeilen; `snapshotNow()` schrumpft auf sechs.

**Kein Store-Objekt, keine Klasse:** Die Nachbarmodule sind schlichte
Funktionsmodule, und `snaps` als Parameter durchzureichen kostet nichts. Wo
das Original den Zustand verändert hat, tut es das weiter (`addSnapshot`
hängt an die Liste an) — das ist im Test genauso ablesbar und hält den Diff
klein.

**Die Gegenprobe zählt, nicht die Zahl der Tests.** Baut man exakt den
ausgelieferten Fehler wieder ein (`manual ? null : base` → `base`), fällt
**genau eine** Zusicherung — die, die nach ihm benannt ist —, und die
übrigen 27 bleiben grün. Ein Test, von dem man das nicht geprüft hat, ist nur
eine Behauptung.

28 Tests decken jetzt ab: Knopf gegen Takt (beide Richtungen, inklusive des
gemeldeten Falls), kein Doppel-Eintrag, Deckelung bei 20, dokumentübergreifende
Verdrängung des Ältesten, das Aufgeben bei vollem Speicher samt Wegräumen des
Schlüssels, sechs Formen beschädigten Speichers und die Beschriftung (heute
nur Uhrzeit, sonst mit Datum, Kalendertag statt 24 Stunden, Rückfall bei
unbekannter Sprache).

**Zwei Verhaltensänderungen, beide bewusst.** `parseSnaps()` wirft Einträge
weg, die nicht die erwartete Form haben (Liste kein Array, `t` keine Zahl,
`text` kein String) — vorher wären sie stehen geblieben und hätten beim Lesen
zugeschlagen. Und ein Array statt eines Objekts im Speicher ergibt jetzt `{}`
statt eines halb benutzbaren Zustands. Ein Sicherheitsnetz darf die App nicht
umbringen.

**Was Unit-Tests weiterhin nicht abdecken, ist die Verdrahtung** — dass
`app.js` `base` und `manual` richtig durchreicht. Dafür bleibt die Messung im
Browser, und sie ist nach dem Umbau wiederholt worden: Knopf ohne jede
Eingabe → ein Stand; Takt (für die Prüfung auf 2 s) bei bloß angesehenem
Dokument → **0**, nach einer Änderung → 1, weitere Takte → 1.

**Nebenbefund, als Werkzeugfalle notiert:** Die Konsole des Browser-Werkzeugs
puffert kumulativ — `console.clear()` und ein Neuladen räumen sie nicht. Eine
`ReferenceError`-Meldung aus einer HMR-Zwischenfassung stand deshalb noch da,
als der Fehler längst weg war. Auseinandergehalten hat es der `?t=`-Stempel
im Stacktrace gegen den der geladenen Datei (`performance.getEntriesByType`):
`…961240` gegen `…049984`. Dieselbe Sorte Lehre wie D25 und D17-Nachtrag 4 —
die Meldung des Werkzeugs ist noch kein Befund.

## D55 — ID-Kurzschreibweise: Eingabehilfe statt Notation
Gefragt war, ob man unter `#prod-stage` einfach `#.kc` schreiben könnte, das
dann `#prod-stage.kc` bedeutet. Die Beobachtung dahinter stimmt: Die
D48-Konvention `#bereich.task` wiederholt das Präfix auf jeder Zeile, und die
Einrückung sagt dasselbe noch einmal.

**Als Notation wäre es trotzdem falsch — das zeigt der eigene Plan.** Gemessen
an `docs/examples/werkbaum.werkbaum`: 181 IDs im Baumteil, davon **50 (28 %),
deren gepunktetes Präfix gar nicht die Eltern-ID ist** — `#ed.parser` hängt
unter `#ed.live`, `#not.status` unter `#not.line`. Das ist kein Schlendrian,
sondern D48 wörtlich („dritte Stufe nur, wo es sonst kryptisch würde"): Die
Punkte benennen den **Bereich**, nicht den Pfad. Eine Kurzform, die gegen den
Elternknoten auflöst, wäre also für über ein Viertel der IDs des Dokuments
falsch, das die Konvention erfunden hat. Der Gewinn wäre klein: 802 Zeichen in
einer 40-kB-Datei, rund 2 %.

Drei weitere Kosten, jede für sich schwerer als das Tippen:

- **Der Beschreibungsteil hat keinen Baum.** Hinter `---` steht der Block-Kopf
  uneingerückt und ohne Vorfahren; dort müsste weiterhin die volle ID stehen.
  Eine ID, zwei Schreibweisen — je nachdem, wo man sie hinschreibt.
- **Die ID wäre keine Adresse mehr.** Heute überlebt sie das Umsortieren, und
  genau darauf bauen die Abhängigkeiten `:#…`, die bewusst quer zum Baum zeigen
  (D34). Mit Kurzform ändert **Einrücken** die Identität, und Verweise zeigen
  still ins Leere. Dieselbe Zerbrechlichkeit, wegen der D34 den Verweis auf den
  *Titel* verworfen hat.
- **Aus einer Konvention würde Grammatik.** Der Punkt ist heute ein gewöhnliches
  Zeichen der ID-Zeichenmenge (SPEC §1); dass `#ed.closure` unter `#ed` hängt,
  prüft niemand. Machte man ihn strukturell, wären die 50 Fälle oben
  Regelverstöße.

**Entschieden (Nutzer): die Kurzform als Eingabehilfe.** Getippt wird `#.kc`,
und beim **Verlassen der Zeile** steht `#prod-stage.kc` im Text. Der
Präzedenzfall liegt im Haus: Umklappen im Diagramm schreibt seine Faltmarke
ebenso zurück (D38-Nachtrag 2). Damit bleibt die Datei eindeutig, durchsuchbar
und umsortierbar — die Ersparnis beim Tippen gibt es trotzdem, und keine der
drei Kosten oben fällt an. Dass die Auflösung den **Baum**-Vorfahren nimmt und
nicht das Bereichs-Präfix, ist dabei kein Mangel: Man sieht das Ergebnis sofort
im Text und kann es hinschreiben, wie man es will.

**Aufgelöst wird gegen den nächsten Vorfahren MIT ID**, nicht gegen den
direkten Elternknoten — der kann selbst keine haben. Findet sich keiner
(Wurzelzeile) oder trägt er selbst noch eine Kurzform, bleibt die Zeile
unangetastet: lieber `#.kc` stehen lassen als etwas Falsches hineinschreiben.
Das ist auch deshalb ungefährlich, weil `#.kc` schon heute eine **gültige** ID
ist (der Punkt gehört zur Zeichenmenge) — es geht also nichts verloren, es ist
nur nicht aufgelöst. `#..x` wird nicht angefasst: zwei Punkte haben keine
vereinbarte Bedeutung.

**Angefasst wird nur die eine Zeile, in der auch getippt wurde.** Beides ist
nötig: Wer ein fremdes Dokument bloß durchklickt, darf es nicht umgeschrieben
bekommen — es fiele sonst aus dem Nachziehen mitgelieferter Fassungen (D27)
und würde als bearbeitet geführt. Nachgemessen: Ein per Dokumentwechsel
geladener Text mit zwei Kurzformen bleibt beim Durchklicken zeichengenau
stehen.

**Die Falle beim Bauen, zum zweiten Mal dieselbe:** Der Zeilenwechsel kommt oft
aus dem `input`-Ereignis der Enter-Taste, und `execCommand` verweigert den
Dienst, wenn es **re-entrant** darin aufgerufen wird. `replaceTextUndoable`
fällt dann auf `src.value =` zurück — und das löscht die Undo-Historie
(D38-Nachtrag 2, D53). Gemessen: erstes Rückgängig ohne Wirkung, jedes weitere
`false`. Geschrieben wird deshalb einen Zug später (`setTimeout(…, 0)`), und
nur, solange der Fokus im Textfeld steht: Wer die Zeile per Klick ins Diagramm
verlässt, soll nicht zurückgerissen werden (`replaceTextUndoable` fokussiert
selbst). Danach nimmt ein Rückgängig genau die Auflösung zurück
(`#stage.kc` → `#.kc`), und der Stapel lebt weiter.

**Abhängigkeiten bleiben außen vor.** `:#.kc` wäre eine eigene Entscheidung —
relativ wozu, zum verweisenden Knoten? Das ist selten nützlich und mehrdeutig;
die Regel bleibt vorerst auf die Knoten-ID beschränkt.

**Getestet ist die Regel, nicht die Verdrahtung** — `expandShortIds()` liegt
als Text→Text-Funktion in `parser.js` neben `setFoldMark` und hat 17
Zusicherungen (Auflösen über mehrere Ebenen, Vorfahren ohne ID überspringen,
Kommentar/Beschreibungsteil/`"`-Zeilen/Abhängigkeiten unangetastet, nur das
erste `#`-Token, zeichengenaue Erhaltung von Einrückung, Zeichen, Statusbox
und Faltmarke, und dass das Ergebnis denselben Baum ergibt wie die von Hand
ausgeschriebene Fassung). Das Zusammenspiel mit dem Textfeld bleibt
Browser-Sache — die Lehre aus D54-Nachtrag 3.

**Nachtrag — aufgelöst wird schon beim Doppelpunkt, nicht erst beim Verlassen
der Zeile.** Gefragt war, ob es „schon in dem Moment" gehen könnte, „wo ein `:`
geschrieben wird oder der Cursor hinter einem vorhandenen `:` in der Zeile
landet". Beides ist im Kern **derselbe** Anlass, und er ist besser als der
bisherige: **Der Doppelpunkt schließt die ID ab.** Er ist per D36 der übliche
Trenner vor dem Titel und zugleich der Anfang einer Abhängigkeitsliste
(`#.kc:#db`) — steht er da, kann sich der Name der ID durch nichts mehr ändern,
was danach getippt wird. Das Verlassen der Zeile war nie das eigentliche
Kriterium, sondern nur der späteste Zeitpunkt, zu dem man sicher sein kann.

**Der Gewinn ist nicht Bequemlichkeit, sondern Nachprüfbarkeit.** Aufgelöst
wird gegen den **Baum**-Vorfahren, und der ist nach D48 nicht immer der, dessen
Namen das gepunktete Präfix trägt — im eigenen Plan bei **50 von 181 IDs
(28 %)** nicht (gemessen oben). Wer das Ergebnis erst zwei Zeilen später bekommt, sieht es
womöglich gar nicht mehr; wer es beim Doppelpunkt bekommt, liest es dort, wo
sein Blick ohnehin steht, und kann es sofort hinschreiben, wie er es will.

**Eine Regel, zwei Auslöser.** Der Doppelpunkt wird entweder gerade getippt
oder er steht schon da; im zweiten Fall greift es beim **nächsten
Tastendruck** in dieser Zeile. Formuliert ist es deshalb als Zustand („die
Kurzform ist abgeschlossen"), nicht als zwei Ereignisse.

**Der Cursor allein genügt nicht — bewusst gegen den Wortlaut der Frage.**
„Der Cursor landet hinter einem `:`" wäre der dritte Auslöser gewesen und
hätte die D55-Regel gebrochen, die genau hier steht: Angefasst wird nur die
Zeile, **in der auch getippt wurde**. Ohne die Einschränkung schriebe bloßes
Durchklicken ein fremdes Dokument um — es fiele damit aus dem Nachziehen
mitgelieferter Fassungen (D27) und zeigte fortan „Original wiederherstellen".
Ein Klick ist keine Absicht, ein Tastendruck ist eine.

**Umgesetzt als Vorfilter, nicht als zweite Regel-Instanz.**
`shortIdClosed(zeile)` in `parser.js` beantwortet nur die billige Frage („folgt
der Kurzform unmittelbar ein `:`?"), damit nicht bei jedem Tastendruck der
ganze Text durchgesehen wird. Ob die Zeile überhaupt einen Knoten trägt und ob
es einen Vorfahren mit ID gibt, weiß weiterhin allein `expandShortIds()` —
dieselbe Haltung wie bei `initialCollapsed()` (D38-Nachtrag 2): eine Stelle
kennt die Bedeutung, alles andere fragt sie. Scheitert die Auflösung (noch kein
Vorfahr mit ID), bleibt die Zeile stehen und der nächste Tastendruck versucht
es erneut; das Verlassen der Zeile fängt es ohnehin auf.

`writeShortId()` ist aus `resolveShortId()` herausgelöst, weil der neue Weg die
Prüfung „ist das die getippte Zeile?" nicht braucht — er hängt am
`input`-Ereignis, ist also per Definition darin. Das `setTimeout(…, 0)` bleibt
für **beide** Wege nötig, und beim Doppelpunkt sogar offensichtlicher als
vorher: Der Aufruf steckt jetzt unmittelbar im `input`-Ereignis, und
`execCommand` verweigert dort den Dienst — `replaceTextUndoable` fiele auf
`src.value =` zurück und löschte die Undo-Historie (D38-Nachtrag 2, D53).

**Nachgemessen** mit echten Tastendrücken: `  - #.kc` + `:` ergibt sofort
`  - #prod-stage.kc:`, die Schreibmarke steht unmittelbar hinter dem
Doppelpunkt; ` Keycloak` tippt sich normal weiter, und zweimal Rückgängig nimmt
erst den Titel, dann die Auflösung zurück (die Historie lebt also). In eine
Zeile mit fertigem `#.kc: Keycloak` **hineinzuklicken** ändert nichts; **ein**
Tastendruck darin löst auf, und das getippte Zeichen bleibt an seiner Stelle
(`Keycloa!k`). Ohne Vorfahren mit ID bleibt `#.kc: …` über mehrere
Tastendrücke stehen und wird aufgelöst, sobald es einen gibt. Zehn neue
Zusicherungen für den Vorfilter; Gegenprobe: Lockert man ihn auf „irgendwo ein
`:`", fällt genau die danach benannte, nimmt man die Punkt-Prüfung heraus,
fallen genau die drei anderen.

## D56 — `#`-Umschalter: die Knoten-ID vor dem Titel, geschrieben wie im Text
Die ID ist die **Adresse** eines Knotens — Ziel der Abhängigkeiten (§1), Schlüssel
der Beschreibungsblöcke, und seit D55 auch das, was man beim Tippen abkürzt. Im
Diagramm stand sie bisher nur im Tooltip (D36: „eine eigene Darstellung hat sie
(noch) nicht"). Wer Text und Bild nebeneinander liest, musste jeden Knoten
antippen, um zu wissen, welcher er ist.

Ein Umschalter im Diagramm-Kopf blendet sie ein, **geschrieben wie im Text**:
`#some.id: Titel`, mit Doppelpunkt und Leerzeichen. Dieselbe Schreibweise auf
beiden Seiten ist der ganze Zweck — eine eigene Darstellung (Badge in der Ecke,
Klammern, Kapitälchen) wäre eine zweite Konvention für dieselbe Sache.

**Als Renderer-Option, nicht per CSS versteckt.** Der naheliegende Weg wäre eine
Klasse an `#out` und `display:none` gewesen. Dann aber stünde die ID trotzdem im
`textContent` — und genau daraus zieht `diagramToSvg()` den Knotentext. Der
Export hätte die IDs also **immer** enthalten, egal was auf dem Schirm steht.
Als Option in `renderTreeHtml(roots, {…, showIds})` folgt er von selbst;
nachgemessen im ausgegebenen SVG: `>#not.line: Line format</text>` mit
Umschalter, `>Line format</text>` ohne. Das entspricht der Hausregel, UI-State
als **Parameter** zu übergeben (frontend/CLAUDE.md), und der Linie von D38/D44:
Export und Druck zeigen, was sichtbar ist.

**Zurückgenommen dargestellt:** Mono-Schrift wie im Textfeld, 0,86 em, in
`--muted` (am dunklen Wurzelknoten in Weiß mit 75 %). Die ID ist die Adresse,
nicht der Name — der Titel soll die Zeile weiter anführen. `aria-hidden`, weil
der Screenreader sie über `a11yId` ohnehin bekommt (D36) und sie sonst doppelt
vorläse. Der Zustand gehört zur Ansicht und wird wie Modus, Zoom und Aufteilung
global gemerkt (D22).

**Der Knopf trägt das Zeichen selbst.** Ein gezeichnetes Icon sagte hier
weniger als `#` — dasselbe Argument wie beim Fenster-Wähler in D31, nur
umgekehrt: Wo es ein etabliertes Schriftzeichen gibt, ist es das beste Symbol.

**Das zehnte Bedienelement hat die Kopfzeile gekippt — zweimal dieselbe
Rechnung wie D17-Nachtrag 5.** Nachgemessen statt geschätzt:

- **Schreibtisch:** 738 px nötig, 728 verfügbar — 10 px zu wenig, die Zeile ging
  auf 82 statt 49 px. Nicht die Knöpfe waren das Problem (566 px für elf
  Elemente), sondern der Weißraum: zehn Lücken à 14 px sind 140 px. `gap:10`
  statt `14` gibt 40 px zurück, also fast genau die Breite des neuen Knopfes;
  danach 698 von 728 und wieder 49 px — mit **und** ohne den Knopf.
- **Telefon (375 px):** Dort sind alle Ziele schon auf dem 29-px-Fingerminimum
  und die Lücken auf 6 px; ein zehntes passt arithmetisch nicht (386 gegen
  359 px). Die Umbruch-Schwelle aus D50 wandert deshalb von 360 auf 440 px —
  dieselbe Rechnung, ein Element mehr. Sie greift auch nur dann wirklich: Der
  „Was ist neu?"-Knopf (44 px) erscheint nur bei Neuigkeiten, ohne ihn bleiben
  336 px und damit eine Reihe. Gemessen: mit allen zehn 78 px und zwei Reihen,
  alles innerhalb; ohne den Neuigkeiten-Knopf 49 px und eine Reihe.

Ein `overflow` an der Kopfzeile bleibt weiterhin ausgeschlossen — es klippt die
beiden Aufklapp-Menüs (D50).

## D57 — Das Knoten-Fenster löst den nativen Tooltip überall ab
Das Fenster aus D52 war für Touch gebaut: Ohne Zeiger gibt es keinen `title`,
und die Beschreibungen (D40) wären dort gar nicht zu sehen gewesen. Damit
standen zwei Darstellungen desselben Inhalts nebeneinander — und ausgerechnet
die schlechtere bekam der Zeiger. Jetzt zeigt das Fenster überall: am Zeiger
nach kurzer Verzögerung beim Überfahren, bei **Tastaturfokus** sofort, auf
Touch unverändert beim einfachen Tipp.

**Was der `title` nicht konnte, und zwar prinzipiell:**

- **Keine Absätze.** Die Beschreibungen im mitgelieferten Plan sind bei ~76
  Zeichen umgebrochen; ein `title` zeigt genau diese harten Umbrüche, in einem
  schmalen Fenster sah der Text ausgefranst aus. Das Fenster bricht um, wie es
  die Breite hergibt (D52 hatte das für Touch schon gelöst).
- **Keine Linie.** Der Trennstrich zwischen Beschreibung und Kurz-Fakten musste
  aus 24 `─`-Zeichen **gemalt** werden (D40-Nachtrag) — im Fenster ist er eine
  echte Kante, und ohne Beschreibung entfällt er ganz.
- **Nichts bei Tastaturfokus.** Kein Browser zeigt einen `title`, wenn man mit
  Tab auf ein Element springt. Wer das Diagramm mit der Tastatur durchgeht, sah
  bisher keine Beschreibung. Das ist der eigentliche Zugewinn und kein Beiwerk —
  nachgemessen mit einem **echten** Tastendruck: Fokus wandert von `#not.line`
  auf `#not.status`, das Fenster folgt mit dessen Text, 10 px unter dem Knoten,
  Petrol-Ring am fokussierten Knoten.

**Der Inhalt zieht von `title` nach `data-tip` um.** Bliebe er im `title`,
zeigte der Browser seinen eigenen Tooltip **zusätzlich** — unterdrücken lässt er
sich nicht. Es ist kein zweites Attribut, sondern dasselbe unter anderem Namen;
die Sorge aus D52 („keine 20 kB DOM-Text verdoppeln") bleibt gewahrt.

**Dabei mussten die letzten drei nativen Tooltips *innerhalb* der Knoten
weichen** — sonst wären sie neben dem Fenster ein zweites Mal erschienen:

- Das **Warndreieck** (`[!]`) trug „High Risk – Aufwand unklar". Das ist der
  Statusname und steht ohnehin in der Faktenzeile — der `title` war redundant
  und ist ersatzlos weg.
- Das **implizite M-Badge** trug die Kostenannahme „Größe fehlt, gilt als M"
  (D18). Die ist nicht redundant, also wandert sie in die Faktenzeile und der
  `title` entfällt. Nachgemessen: `data-tip="st_geplant · implicitSizeTooltip ·
  jumpHint"`, Badge ohne Attribut.

Damit trägt im ganzen Diagramm kein Element mehr einen nativen Tooltip
(nachgemessen: 0 von 160 Knoten, 0 Kinder) — außer dem Geister-Knoten, der kein
`.node` ist.

**Absicht-Erkennung statt sofortigem Aufpoppen.** Über einen dichten Baum fährt
man hinweg, ohne etwas wissen zu wollen: 350 ms Verzögerung. Steht schon ein
Fenster offen, zeigt der nächste Knoten **ohne** Warten — wer liest, wartet
nicht noch einmal. Beim Verlassen wird 120 ms gewartet, bevor zugemacht wird:
Der Weg vom Knoten ins Fenster führt über einen Zwischenraum, in dem der Zeiger
über keinem von beiden steht. Wer im Fenster ist, hält es offen (Text lässt
sich markieren).

**Der ↗-Knopf bleibt Touch vorbehalten.** Am Zeiger ist der ganze Knoten der
Link (§6) — ein Knopf im Fenster wäre ein zweiter Weg zum selben Ziel. Ebenso
nennt die Faktenzeile nur auf Touch den langen Druck statt Alt+Klick.

**Für Screenreader ändert sich nichts, und das ist Absicht.** Das Fenster ist
`aria-hidden`: Sein ganzer Inhalt steht bereits im `aria-label` des Knotens
(SPEC §9), er würde sonst doppelt vorgelesen. Damit dürfen darin keine
fokussierbaren Elemente liegen — × und ↗ tragen deshalb `tabindex="-1"`;
erreichbar bleibt beides über den Knoten selbst und über Esc.

**Werkzeuggrenze, wieder dieselbe Sorte:** `element.focus()` setzt in einem
nicht fokussierten Automatisierungsfenster zwar `document.activeElement`, feuert
aber **keine** Fokus-Ereignisse (`document.hasFocus() === false`). Der erste
Prüflauf zeigte deshalb „Tastaturfokus öffnet nichts", obwohl die Logik stimmte;
mit synthetischem `focusin` öffnete es sofort. Erst das Fronten des Tabs samt
echtem Klick und echter Tab-Taste hat es bewiesen. Wie D25 (synthetische
`TouchEvent`s), D17-Nachtrag 4 (Bildschirmtastatur) und D53 (synthetisches
Strg+Z): Was die Umgebung stellt, stellt der Emulator nicht.

## D58 — Neuigkeiten: der Stern wandert in die Kopfzeile und bekommt ein Popup
Der „Was ist neu?"-Knopf (D28) stand im Diagramm-Kopf und war **verborgen,
solange es nichts gab** — er konnte also nur etwas über das gerade offene
Dokument sagen, und meistens sagte er gar nichts. Jetzt steht er permanent in
der oberen Bedienleiste, zeigt ein Popup mit der Chronik der letzten Tage, und
jeder Tag führt seine Knoten im Diagramm vor.

**Zwei Aussagen, ein Knopf.** Die **Chronik** ist allgemein („was ist am
Produkt geschehen"), der **Besuchsvergleich** persönlich („was ist seit deinem
letzten Besuch live gegangen"). Sie zu trennen hieße, zwei Knöpfe in eine Zeile
zu setzen, die D56 gerade erst auf zehn Elemente zurechtgemessen hat — und für
den Betrachter sind es ohnehin dieselbe Frage in zwei Zeitmaßstäben. Der
Besuchsvergleich steht als abgesetzter Abschnitt **zuoberst** im Popup und
trägt den „gesehen"-Knopf, den vorher der Knopf selbst war.

**Bernstein heißt ungesehen, Petrol heißt „wird vorgeführt".** Zwei Zustände,
zwei Farben, beide schon vergeben: Bernstein ist die Farbe des Strahlenkranzes
am Knoten (D28) — Knopf und Knoten sagen damit dasselbe —, Petrol die für
Interaktion (D32). Ein dritter Kanal war nicht nötig.

**Aufgeschlagen heißt gelesen.** Der Deckel wandert beim Öffnen auf den
**neuesten gelisteten Tag**, nicht auf „heute": Ein Datum aus der Uhr des
Betrachters verglichen mit einem Datum aus dem Build ginge schief, sobald die
Uhren auseinanderliegen. Der Besuchsvergleich behält seinen eigenen Knopf — er
hat eine andere Basis (den Text der zuletzt gesehenen Fassung, D28).

**Woher die Daten kommen: zwei Quellen, jede in ihrer Rolle.**

- `docs/CHANGELOG.md` → **was** geschehen ist, ein englischer Satz je Änderung.
- Die git-Historie von `docs/examples/werkbaum.werkbaum` → **welche Knoten**
  sich an diesem Tag bewegt haben (neu oder mit anderem Status).

Beides wird **zur Bauzeit** eingelesen und als virtuelles Modul eingebettet
(Vite-Plugin). Zur Laufzeit gibt es kein git und keinen Server, der nachliefern
könnte (D11/D19), und nachladen würde D20 brechen. Der Preis ist benannt: Der
Dev-Server liest einmal beim Start, neue Einträge erscheinen nach einem
Neustart.

**Die Notizen kommen NICHT aus den Commit-Betreffs** — obwohl sie dort stünden
und die erste Fassung sie genau so gezogen hat (samt Filter für Bau-, Test- und
Beförderungs-Commits). Der Nutzer hat die richtige Frage gestellt: *„Sind die
Neuigkeiten nun in allen unterstützten Sprachen? Da hätte ich eine Rückfrage
erwartet."* Die Betreffs sind **deutsch** (CLAUDE.md: Doku auf Deutsch), das
Popup aber ist Produkt-Oberfläche in neun Sprachen — ein japanischer Besucher
hätte einen japanischen Rahmen um deutsche Sätze bekommen. Entschieden
(Nutzer): eine **gepflegte englische Changelog-Datei**, wie der mitgelieferte
Plan und `llms.md` ausgeliefertes Artefakt mit weltweitem Publikum (D22, D43).

Verworfen waren: **deutsch lassen und benennen** (billig, aber acht der neun
Sprachen lesen es nicht) und **die Notizen aus den Knoten-Labels des Plans
ableiten** (schon englisch, keine Pflege, Text und Hervorhebung sagten
zwangsläufig dasselbe — aber „Fold marks → fertig" ist eine Statusmeldung, kein
Satz, und Tage ohne Plan-Änderung fielen ganz weg). Der Preis der gewählten
Lösung ist ehrlich zu nennen: **eine Datei mehr, die beim Bauen eines Features
mitgeschrieben werden muss** — als Regel in CLAUDE.md festgehalten, sonst
veraltet sie still.

**Der Link je Tag nennt die Zahl der Knoten, die es HEUTE noch gibt.** Die
Schlüssel sind Label-Pfade (dieselbe Identität wie D28/D38); ein seither
umbenannter Knoten ist nicht mehr zu treffen. Gezählt wird deshalb gegen den
aktuellen Plan — im mitgelieferten Stand sind das beim 22.08. dreißig statt der
zweiunddreißig gespeicherten. Ein Link, der „32 Knoten" verspricht und 30
zeigt, wäre eine kleine Lüge an einer Stelle, an der es nichts kostet, die
Wahrheit zu sagen.

**Ein Tag kann einen Link ohne Notizen haben, aber nie umgekehrt.** Der
Beförderungs-Commit (D30) ist der Regelfall: An einem reinen Deploy-Tag bewegt
sich der Plan, ohne dass jemand einen Changelog-Eintrag schreibt. Ohne die
Vereinigung beider Quellen fiele ausgerechnet der Tag stumm unter den Tisch, an
dem etwas in Produktion gegangen ist.

**Die Vorführung ersetzt den Besuchsvergleich, statt neben ihm zu stehen.** Es
ist dieselbe Ansicht (gelber Kranz), nur mit einer anderen Frage; zwei
gleichzeitige Mengen im selben Kanal wären nicht auseinanderzuhalten.
Umgeschaltet wird dabei auf den mitgelieferten Plan — dessen Knoten sind
gemeint. **Reihenfolge beachtet:** `switchDoc()` räumt einen vorgeführten Tag
ausdrücklich weg (in einem anderen Dokument zeigten seine Schlüssel ins Leere),
also muss erst gewechselt und dann gesetzt werden. In der anderen Reihenfolge
löschte der Wechsel gerade den Tag, den man zeigen wollte — beim Bauen
hineingelaufen.

**Nicht persistiert.** Der Faltzustand steht im Text (D38), der Besuchsstand im
localStorage (D28) — eine vorgeführte Chronik ist weder das eine noch das
andere. Sie endet mit der Sitzung, mit dem Dokumentwechsel oder mit dem zweiten
Druck.

**Auf dem Telefon ist der Bezug die Werkzeugleiste, nicht der Knopf.** Das
Popup ist 351 px breit, der Knopf 30 — an ihm ausgerichtet begann es bei
**−116 px**, also außerhalb des Bildes (nachgemessen bei 375 px). `body.mobile
.newswrap{position:static}` macht die `.header-tools` zum Bezug, deren rechter
Rand auch der der Seite ist: danach 17 bis 368 px. Ein `overflow` an der
Kopfzeile als Ausweg verbietet sich — das klippt genau diese Menüs (D50).

**Backticks werden zu Code-Stücken**, und zwar **nach** dem Escapen: Was der
Ersetzung vorliegt, ist bereits harmloser Text, der Weg zu eigenem Markup
bleibt also verschlossen. Ohne die Ersetzung stünde `` `#auth` `` mit nackten
Backticks im Popup und läse sich wie ein Tippfehler.

**Nachgemessen** (Werkbaum-Plan, Dev-Server): 12 Tage im Popup, davon einer
(28.07.) ohne Notizen mit Link — der Deploy-Tag. Der Link des 24.08. hebt 12
Knoten hervor, holt den ersten in die Mitte und färbt den Knopf petrol; ein
zweiter Druck stellt die 11 Knoten des Besuchsvergleichs wieder her; „gesehen"
löscht sie und nimmt dem Knopf das Bernstein. Bei 375 px liegt das Popup
vollständig im Bild und wird an beiden Kanten getroffen (`elementFromPoint`),
die Kopfzeile bleibt einreihig. 20 neue Tests in `frontend/tests/news.test.js`,
darunter einer, der die **ausgelieferte** `docs/CHANGELOG.md` liest — ist sie
unlesbar, stünde das Popup sonst leer da, ohne dass es jemand merkt.

**Nachtrag — ein übersetzter Hinweis sagt, dass die Notizen englisch sind.**
Der Haupttext oben begründet die englischen Notizen und lässt den Betrachter
damit allein: Wer die Oberfläche auf Japanisch stehen hat, sieht einen
japanischen Rahmen um englische Sätze und kann das für einen Fehler halten —
für eine fehlende Übersetzung oder einen kaputten Sprachwechsel. Ein Satz
oben im Popup nimmt dem die Spitze: „Diese Übersicht wird leider nur auf
Englisch gepflegt", in allen neun Sprachen.

**Er tritt optisch zurück** (klein, grau, ohne Rahmen und ohne Fläche): Es ist
eine Fußnote zum Inhalt, nicht der Inhalt. Der bernsteinfarbene
Besuchsvergleich darunter bleibt damit das erste, worauf der Blick fällt.

**Bei englischer Oberfläche entfällt er** — dort wäre es eine Auskunft über
nichts. Der Schlüssel ist trotzdem in allen neun Sprachen angelegt, auch auf
Englisch: Ein Loch in der Tabelle lädt dazu ein, beim nächsten Durchsehen für
einen Fehler gehalten und „repariert" zu werden.

## D59 — Fortsetzungszeilen: `\` am Zeilenende, Leerraum davor Pflicht
Eine Zeile trägt in dieser Notation alles auf einmal — Einrückung, Zeichen,
Statusbox, Label, Größe, URL, Tags, ID, Abhängigkeiten, Fokusmarke, Kommentar.
Im mitgelieferten Plan ist die längste Zeile 122 Zeichen lang (D49), und seit
das Textfeld nicht mehr umbricht, muss man dafür waagerecht schieben. Ein `\`
am Zeilenende verteilt sie jetzt auf mehrere Textzeilen, ohne dass ein neuer
Knoten entsteht.

**Leerraum vor dem `\` ist Pflicht** — `… \` setzt fort, `…\` nicht. Das ist
die entscheidende Festlegung, und sie geht bewusst gegen die Gewohnheit aus
Shell, C und Makefile, wo `foo\` fortsetzt. Der Grund ist die **Asymmetrie der
Fehlerfälle**:

- Ohne die Regel verschluckt ein Label, das selbst auf einen Backslash endet
  (`C:\temp\`), **stumm den folgenden Knoten**. Ein Knoten verschwindet aus dem
  Diagramm, und im Text sieht die Zeile richtig aus.
- Mit der Regel bekommt, wer aus der Shell `foo\` schreibt, **keine
  Fortsetzung**. Die Zeile bleibt stehen, der `\` ist sichtbar, der Fehler
  erklärt sich beim Hinsehen.

Der zweite Fehler ist häufiger, der erste ist schlimmer — und dieses Projekt
zieht durchweg den lauten dem stillen vor (SPEC §4, D40). Die Regel ist zudem
keine neue Sorte: `=`, `>`/`<` und `"` verlangen alle Leerraum, nur auf der
**anderen** Seite des Zeichens. Ein `\\`-Escape als Alternative wäre die dritte
Möglichkeit gewesen — verworfen, weil die Notation sonst nirgends escapt und
eine einzige Escape-Regel für einen Randfall mehr Erklärung kostet, als sie
wert ist.

**Verbunden wird mit genau einem Leerzeichen.** Damit ist ein Token nicht über
den Umbruch trennbar — eine zerschnittene URL bleibt zerschnitten. Das ist eine
echte Einschränkung und trotzdem richtig herum: Ohne das Leerzeichen führen
`Backend \` + `Frontend` zu `BackendFrontend`, und *das* wäre die stille
Variante. Wer eine lange URL hat, lässt sie in ihrer Zeile.

**Alles gehört zur ersten Zeile.** Ihre Einrückung bestimmt die Ebene, ihre
Nummer nennen die Warnungen, und alles, was zurückschreibt, fasst nur sie an —
`setFoldMark()` (D38) und `expandShortIds()` (D55) finden Gate und Statusbox
dort. `expandShortIds()` musste dafür lernen, Fortsetzungszeilen zu
**überspringen**: Sonst hätte es eine solche Zeile für eine Wurzelzeile
gehalten (sie hat kein Gate) und den Vorfahren-Stapel verdorben.

**Der Cursor in einer Fortsetzungszeile wählt ihren Knoten aus** — dieselbe
Regel wie bei Beschreibungszeilen (D40-Nachtrag 2), und aus demselben Grund:
Die Zeile trägt keinen eigenen Knoten, gehört aber zu einem, und wer darin
schreibt, arbeitet an genau diesem. Getragen wird das von `node.descLines`, das
damit nicht mehr nur Beschreibungen führt; der Name bleibt, weil eine
Umbenennung durch Renderer, Tests und Snapshots nichts hinzufügte, was der
Kommentar nicht sagt.

**Gilt nur im Baumteil.** Hinter dem `---`-Trenner ist der Zeilenumbruch
Absatzstruktur (§1), und der Inhalt ist ausdrücklich Freitext — ein `\` bleibt
dort gewöhnlicher Text.

**Reihenfolge gegenüber dem Kommentar:** Kommentare fallen zuerst weg (§1,
Schritt 1), das Verbinden ist Schritt 1b. Also setzt `- A \ %% Notiz` fort und
`- A %% Notiz \` nicht — beides ist die natürliche Lesart, und sie fällt ohne
Sonderregel richtig aus.

**Umgesetzt als Vor-Durchlauf** (`logicalLines()` in parser.js): Er liefert
statt roher Zeilen `{raw, line, cont}`, und `parse()` arbeitet unverändert
darauf weiter. Dadurch gibt es genau **eine** Stelle, die die Regel kennt, und
die Extraktionsreihenfolge aus §1 bleibt unangetastet — die Folgezeile ist
schon Teil der Zeile, bevor irgendetwas aus ihr gelesen wird. Ein Sonderfall
steckt darin: Bleibt von der ersten Zeile nur die **Einrückung** übrig (`  \`),
darf sie nicht mit weggeputzt werden — sie trägt die Ebene.

**Nachgemessen** im laufenden Editor: `- Ein Knoten mit einem \` + `sehr langen
Titel (L) @anna` ergibt einen Knoten mit `data-line="2"` und
`data-desc-lines="3"`, Größe `L` und Tag `anna` von der zweiten Zeile gelesen,
0 Warnungen; der Cursor auf Zeile 3 hebt denselben Knoten hervor wie auf Zeile
2. 20 neue Tests; die Gegenprobe (Leerraum-Pflicht aus dem Regex entfernt)
lässt genau die zwei danach benannten Zusicherungen fallen.

## D60 — Ohne Titel vertritt die Knoten-ID ihn
D36 hielt fest: „Eine Zeile, die **nur** aus einer ID besteht, wird wie jede
leere Zeile ignoriert und belegt die ID nicht." Das ist jetzt umgekehrt — eine
solche Zeile ist ein Knoten, und sein Label ist `#id`.

**Der Anlass ist die Ticket-Referenz.** §11 hält fest, dass die Kennung eines
Trackers oft die natürliche Knoten-ID ist (`#US-123`, `#ABC-123`). Wo das
zutrifft, **ist die Kennung schon der Name** — `- #US-123: US-123` daneben zu
schreiben wäre eine Verdopplung, und wer sie wegließe, verlor bisher den
ganzen Knoten. Die alte Regel war für den Fall gedacht, dass jemand eine ID
ohne Absicht stehen lässt; sie hat dabei den häufigeren Fall miterschlagen.

**Das Label ist `#id`, mit Doppelkreuz.** Erwogen war die ID ohne `#`
(`US-123`) oder eine eigene, zurückgenommene Darstellung wie beim
`#`-Umschalter (mono, grau, D56). Beides verworfen: Ohne `#` liest sich der
Knoten wie ein gewöhnlicher Titel, der zufällig nach einer Kennung aussieht —
das `#` sagt „hier steht die Adresse, weil es keinen Titel gibt". Und eine
durchgehend graue Beschriftung ließe den Knoten wie zurückgetreten aussehen,
was er nicht ist.

**Der `#`-Umschalter setzt bei so einem Knoten nichts davor.** Sonst stünde
dort `#US-123: #US-123`. Erkannt wird das an `labelFromId` am Knoten und nicht
am Vergleich `label === '#' + id`: Wer `#a: #a` bewusst schreibt, hat einen
Titel, und der soll auch mit Umschalter so erscheinen. Aus demselben Grund
entfallen für solche Knoten die ID-Zeile im Tooltip und `a11yId` im
`aria-label` — ein Screenreader läse die Kennung sonst zweimal hintereinander.

**Die ID ist damit vergeben.** Das ist die eigentliche Verhaltensänderung und
die einzige, die jemandem auffallen kann: `- #auth` gefolgt von
`- [ ] Echt #auth` gibt jetzt zwei Knoten und eine `duplicateId`-Warnung, wo
vorher einer und keine Warnung stand. Das ist richtig herum — die erste Zeile
ist jetzt ein Knoten, und zwei Knoten mit derselben ID sind genau der Fall,
für den es die Warnung gibt.

Eine Zeile **ohne** ID und ohne Label bleibt, was sie war: keine Zeile. Auch
`- (L) @anna` ergibt weiterhin nichts — Größe und Zuständige allein sind kein
Knoten.

**Nachgemessen:** `- [x] #US-123 (L) @anna` ergibt einen Knoten mit Label
`#US-123`, Größe `L`, Tag `anna`, Status fertig; mit eingeschaltetem
`#`-Umschalter bekommt er **keine** `nid`-Spanne, der Nachbar `#auth: Backend`
schon. 337 Tests, davon 6 neue; der eine alte, der die frühere Regel festhielt,
ist umgeschrieben und benennt jetzt diese.

## D61 — Angefangenes liegt auf dem Pfad: Zugaben und Alternativen
Gemeldet an einem kleinen Baum:

```
- [ ] #fe
  + [~] #fe.rel: Relations bearbeitbar (S)
  + [?] #fe.more: weitere Features …
```

Erwartet war, dass der Pfad durch `#fe.rel` läuft — „auch wenn es optional
ist, weil das ja nun schon begonnen wurde". Er lief stattdessen durch `#fe`,
und die einzige Station war der Elternknoten.

**Die Regel dahinter stand seit D29 ohne Ausnahme da:** Optionale Knoten sind
*nie* nötig. Sie ist aus einem echten Fehler entstanden — der Pfad rechnete
jede Zugabe ins Minimum und **überschätzte** sich systematisch. Der umgekehrte
Fehler war dabei nie bedacht: angefangene Arbeit zu **unterschlagen**. Seit
D46 beantwortet der Pfad ohnehin nicht mehr „was hätte der Plan von vorn
gekostet?", sondern „was ist als Nächstes dran?" — und `[~]` ist das
Vorderste, was es gibt. Praktisch heißt das, dass der
Von-Station-zu-Station-Knopf (D47) einen nie dorthin führt, wo gerade
tatsächlich gearbeitet wird.

`+` ist eine Aussage über den **Plan** („entbehrlich"), der Status eine über
die **Tatsachen** („daran wird gearbeitet"). Die beiden Achsen bleiben
unabhängig (§3) — der Pfad ist ein Drittes und darf beide lesen.

**Entschieden: Eine Zugabe liegt auf dem Pfad, sobald sie realisiert (§3),
aber noch nicht erledigt (D46) ist** — also bei `[~]` und `[/]`.

**Die Formulierung ist der eigentliche Fund.** Mein erster Vorschlag war die
volle Schwelle „realisiert" (`[~] [/] [x] [^]`), begründet damit, dass §3 das
Wort schon führt und keine dritte Schwelle dazukommt. Der Nutzer hat
widersprochen: *„Eigentlich sollen fertige oder gar deployed Knoten gar nicht
auf den Lean-Path, da gibt es ja nichts mehr zu tun."* Das ist richtig, und
mein Argument gegen die engere Fassung fällt weg, sobald man sie aus den
**vorhandenen** Begriffen zusammensetzt: *realisiert, aber nicht erledigt*.
`isStarted = isRealized && !isDone` — kein neues Vokabular.

**Was dabei zu klären war: „auf dem Pfad" ist nicht „Station".** Seit D46
bekommt ein erledigter Knoten auf dem Pfad **keinen** Stationspunkt, **keine**
Pfadlinie und geht mit **0** in die Kosten; übrig bleibt allein, dass er nicht
zurücktritt — und das tut er per D46-Nachtrag ohnehin nie. Für den fertigen
Knoten **selbst** war der Unterschied zwischen beiden Schwellen also exakt
null. Er lag einzig darin, ob der Pfad **in eine fertige Zugabe hineinschaut**
und dort liegen gebliebene offene Kinder als Station zeigt. Auch das entfällt
jetzt, und zwar mit einem eigenen Argument aus §3: Wer unter einem `+`-Knoten
hängt, ist mit ihm zusammen entbehrlich — der Autor hat `[x]` geschrieben, ein
offener Rest darunter ist Buchhaltung, keine offene Front.

**Ehrlich zu benennen ist der Einwand gegen die ganze Regel:** Streng „am
günstigsten" wäre es, die angefangene Zugabe **abzubrechen** — Restkosten
gespart. Der Pfad zeigt seit D46 aber die offene Front, nicht das theoretische
Optimum. Und der Rückweg steht in der Notation schon: Wer die Zugabe wirklich
fallen lässt, schreibt `[-]`, und Verworfenes zählt nie.

**Dabei gefunden: dieselbe Lücke bei Alternativen — und die SPEC hatte recht,
der Code nicht.** §9 sagt seit D46 wörtlich: „Eine bereits realisierte
Alternative gewinnt, auch wenn eine unangetastete nominell billiger wäre — die
Wahl ist getroffen und bezahlt." Umgesetzt war das aber nur **über die
Kosten**, und die sind allein bei `[x]`/`[^]` null. Nachgemessen an
`= [~] A (L)` / `= [ ] B (S)`: Der Pfad wählte **B** und blasste das
angefangene A aus — das Bild widersprach damit der XOR-Regel des Plans, die
gerade sagt, dass A die realisierte Alternative ist. Also kein neues Feature,
sondern die fehlende Hälfte der Umsetzung: `chosenPool(kids)` schränkt die
Wahlmenge auf die realisierten Alternativen ein, sobald es welche gibt; die
Kostenregel (kleinste rekursive Kosten, Gleichstand ⇒ erste) gilt darin
unverändert.

**Mehrere realisierte Alternativen** sind in einer `=`-Gruppe schon per
`xorConflict` gemeldet, in einer `|`-Gruppe („mindestens eine") aber zulässig.
Dort entscheiden unter ihnen wieder die Kosten. Erwogen und **aufgeschoben**:
alle realisierten gemeinsam auf den Pfad zu nehmen. Das wäre ein größerer
Eingriff — eine any-of-Gruppe trüge dann nicht mehr genau eine Alternative —,
und die gewählte Lesart ist für sich verteidigbar: `|` erlaubt das Fallenlassen,
also ist „die billigere der begonnenen fertigstellen" ein gültiger günstigster
Weg.

**Nebengewinn bei der Suche (D42):** Eine Gruppe mit genau einer realisierten
Alternative ist entschieden und damit **keine freie Variable** mehr — sie
koppelt nicht und geht nicht in den Odometer ein. Die erschöpfende Suche wird
dadurch kleiner, nie größer.

**Nachgemessen.** Der gemeldete Baum: `#fe.rel` ist jetzt die Station, `#fe`
liegt auf dem Pfad ohne Punkt, `#fe.more` bleibt blass. Eine fertige Zugabe
mit offenem Kind bleibt samt Kind draußen. `= [~] A (L)` schlägt
`= [ ] B (S)`. Der **mitgelieferte Plan ändert sich nicht** (131 Pfadknoten,
27 Stationen, vorher wie nachher) — er hat keine angefangene Zugabe, und seine
einzige Gruppe mit realisierten Alternativen trägt zwei `[^]`, die schon
vorher beide 0 kosteten.

346 Tests, davon 10 neue. Gegenprobe: Nimmt man die Zugaben-Ausnahme wieder
heraus, fallen genau die fünf danach benannten Zusicherungen; nimmt man
`chosenPool` heraus, genau die zwei zu den Alternativen. Die Tests, die das
**unveränderte** Verhalten festhalten (unangetastete und erledigte Zugaben
bleiben draußen), bleiben in beiden Fällen grün.

## D62 — Größen-Konflikt: Bereiche statt Punkt-Zahlen, XXL nach oben offen
Gewünscht war eine Anzeige, „wenn die angegebenen T-Shirt-Größen mit den
Unterknoten nicht zusammenpassen" — ohne automatische Korrektur. Die Skala
dafür gab es schon (`SIZE_RANK`, D18 nutzt Rang+1 als Kosten); die eigentliche
Entscheidung war, **wann** „passt nicht" gilt.

**Eine Punkt-Zahl je Größe trägt nicht — egal wie steil die Skala steigt.**
Der erste Vorschlag war eine additive Verdopplungsskala (XS=1 … XXL=32):
Summe der Kinder > Elternwert ⇒ Konflikt. Der Nutzer wandte ein, dass damit
bei jedem größeren Baum die oberen Knoten selbst mit XXL nicht auskommen —
und die Prüfung der Steilheit führte auf einen härteren Befund: Schon das
**kanonische Beispiel aus SPEC §10** warnte. `Website-Relaunch (XL)` mit
Kindern `(M) + (XL) + (M)` ergibt bei Faktor 2 wie bei Faktor 3 eine Summe
über dem Elternwert — sobald ein Kind die Elterngröße teilt, sprengt jedes
Geschwister die Summe. Das widerspricht der gelebten Praxis, dass „XL =
XL-Kind plus etwas Kleinkram" eine völlig normale Schätzung ist. Der Fehler
liegt nicht im Faktor, sondern darin, dass eine Punkt-Zahl so tut, als wäre
`(M)` exakt.

**Entschieden: Größen sind Bereiche.** XS=[1,2), S=[2,4), M=[4,8), L=[8,16),
XL=[16,32), **XXL=[32,∞)**. Konflikt erst, wenn die Summe der **Untergrenzen**
der Kinder die **Obergrenze** des Elternknotens erreicht — also erst, wenn es
unter *jeder* Lesart falsch ist. Das hält das kanonische Beispiel sauber
(24 < 32), meldet vier `(S)` unter `(M)` (8 ≥ 8), enthält den Ordinal-Fall
(ein strikt größeres Kind warnt immer) und beantwortet den Einwand direkt:
**XXL hat keine Obergrenze**, ein XXL-Knoten warnt nie — für die großen
Sammelknoten behauptet die Skala schlicht keine Schranke mehr. Das ist
dieselbe Haltung wie bei `unknownStatus` und `descStray`: lieber laut, aber
nur, wo es sicher ist. D46 („die Größen sind ordinal, nicht additiv") bleibt
für alles andere unangetastet — die Bereichs-Lesart gilt genau dieser einen
Prüfung.

**Was zählt:** nur die direkten Kinder (je Ebene eine eigene Prüfung, die
Warnung zeigt auf die Elternzeile), davon nur die mit **angegebener** Größe —
fehlende Größe ist keine Autoren-Aussage (D44-Linie; anders als bei den
Pfadkosten wird kein M angenommen). Verworfene und optionale (`+`) Kinder
zählen nicht; in einer disjunktiven Gruppe (`|`/`=`) zählt die **kleinste**
Alternative, denn nur eine wird realisiert. Die Gegenrichtung (Eltern größer
als die Kindersumme) warnt nicht — sie heißt nur unvollständige Zerlegung,
und dafür gibt es den Geister-Knoten (D8). Ein Elternknoten ohne Größe wird
nie geprüft.

**Darstellung: das Badge wechselt auf `--warn`, nicht auf Rot.** Der Nutzer
hatte Rot vorgeschlagen und sich für die Warnfarbe entschieden: „Der Plan
widerspricht sich" hat mit `#B45309` schon eine Farbe (Geister-Knoten,
Warnzeilen), und Rot bliebe unvergeben (D34). Dazu die Warnung `sizeConflict`
mit Zeilennummer (eine Stelle: `build()` in warnings.js), der Grund im
Tooltip und im `aria-label`. **Nichts wird automatisch korrigiert.**

**Nebenbefund: Der Grafikexport zeichnete das Größen-Badge mit festen
Farben** (`drawBadge(sizeEl, '#0F766E', '#ffffff')`) — das invertierte
implizite M (D18) stand damit seit jeher gefüllt im exportierten Bild. Jetzt
liest der Export die gemessenen Farben wie bei Tags und Diskrepanz-Marke;
damit folgt auch das Konflikt-Badge von selbst.

**Der eigene Plan hatte acht solcher Konflikte** — alle berechtigt, die
Größen stammten aus der Zeit ohne Prüfung. Nachgezogen (`#not` L→XL, `#ed`
XL→XXL, `#ed.live`/`#ed.path`/`#ed.fold`/`#bld`/`#col.own` M→L, `#col.pad`
S→L, und als Kaskade davon `#col` XL→XXL): 0 Warnungen. Dass die erste
Anwendung der Regel den eigenen Plan korrigiert, ist kein schlechtes Zeichen —
genau dafür ist sie da.

**Nachgemessen:** 372 Tests (16 neue in `tests/sizes.test.js`); Gegenprobe
per Mutation — XXL-Obergrenze wieder eingeführt: genau die zwei danach
benannten Zusicherungen fallen; optionale Kinder mitgezählt: genau eine;
disjunktive Gruppen summiert statt Minimum: genau zwei. Im Browser: Badge
`rgb(180, 83, 9)`, Warnung „Zeile 1: …", Tooltip und `aria-label` benennen
den Grund; im exportierten SVG das Konflikt-Badge bernstein und das implizite
M weiß mit Petrol-Rand. Kanonisches Beispiel §10 und der mitgelieferte Plan:
0 Warnungen.

## D63 — ID-Vorschläge beim Tippen von Abhängigkeiten (`:#`)
Wer eine Abhängigkeit tippt, muss die Ziel-ID auswendig wissen oder im Text
suchen — bei 180 IDs im mitgelieferten Plan keine Kleinigkeit. Jetzt öffnet
`:#` eine Vorschlagsliste an der Schreibmarke: die vergebenen IDs, gefiltert
nach dem getippten Fragment, mit dem Knotentitel als Kontext.

**Dieselbe Kategorie wie die ID-Kurzform (D55): Eingabehilfe, keine
Notation.** Der Parser sieht nie etwas davon, SPEC-Syntax und `llms.md`
bleiben unberührt; übernommen wird undo-fähig über das vorhandene `writeAt()`
(D53). Die drei schwierigen Zutaten lagen schon im Haus: Die **Kandidaten**
kommen aus dem Parse-Baum, der bei jedem Tastendruck ohnehin frisch ist; die
**Pixel-Position der Schreibmarke** misst der Spiegel-`div` aus D25/D33 (ein
Marker-Span, `offsetTop`/`offsetLeft` — seit `wrap="off"` (D49) trivial); das
**Einfügen ohne Undo-Verlust** ist die D53-Lehre. Kein CodeMirror/Monaco —
das wäre eine Laufzeit-Abhängigkeit (D11/D19) für etwas, das drei vorhandene
Mechanismen zusammensetzen.

**Ausgelöst nur im Abhängigkeits-Kontext, nicht bei jedem `#`.** Ein
alleinstehendes `#` *definiert* meist eine neue ID — dort wäre die Liste im
Weg. Erkannt wird dieselbe Form, die der Parser liest: `(^|\s):#…` (§1) und
die Kopf-Form `#auth:#…` (D36); `(:#a` bleibt Zitat, `Regel: #x` bleibt
Label, im Kommentar und hinter `---` gibt es keinen Kontext. Die Erkennung
(`depFragment`) und die Kandidaten-Auswahl (`collectIds`/`matchIds`) stehen
headless in **`autocomplete.js`** — die Hausregel aus D54-Nachtrag 3; app.js
verdrahtet nur Popup, Tasten und Einfügen.

**Angeboten wird alles, ausgenommen das Sinnlose.** Auch IDs verworfener und
eingeklappter Knoten stehen in der Liste — eine Abhängigkeit darf dorthin
zeigen (§1), und die Faltung ist nur Ansicht (D38). Ausgenommen sind die im
Token **schon gelisteten** IDs und die **eigene ID der Zeile** (die
Selbst-Abhängigkeit ist zulässig, aber nie das, was man tippen will).
Sortierung: Präfix-Treffer vor Teilstring-Treffern, je in
Dokumentreihenfolge, Groß-/Kleinschreibung egal — die IDs selbst bleiben, wie
sie geschrieben sind. Ersetzt wird bis ans **Ende der ID-Zeichen** hinter der
Schreibmarke, sonst ergäbe eine Übernahme mitten im Wort `#authth`.

**Die Tasten-Arbitrierung ist der heikle Teil, nicht das Popup.** ↑/↓, Enter,
Tab und Esc gehören sonst dem Textfeld — abgefangen werden sie **nur bei
offener Liste**, über einen Capture-Handler auf `document`: Die
Textfeld-Handler (Tab rückt ein, Esc löst die Tab-Falle — beide D53) sind
früher registriert und kämen sonst zuerst; `stopPropagation` hält sie heraus.
Zwei Folgen, beide gemessen: Tab übernimmt bei offener Liste, **ohne**
zusätzlich einzurücken, und rückt bei geschlossener unverändert ein; Esc
schließt die Liste, ohne die Tab-Falle zu lösen. **Nach Esc und nach einer
Übernahme bleibt derselbe Kontext zu** (`acSuppress`) — sonst öffnete ihn das
nächste keyup sofort wieder; Weitertippen ändert das Fragment und hebt die
Sperre.

**Ein Echo wird nicht angeboten:** Steht die ID schon vollständig da (der
eine exakte Treffer, Schreibmarke am Token-Ende), bleibt die Liste zu — so
schließt sie nach der Übernahme von selbst und meldet sich nicht bei jedem
Cursor-Besuch einer fertigen Zeile.

**Barrierefreiheit als benannte Grenze, nicht als Behauptung.** Das saubere
ARIA-Combobox-Muster passt nicht auf ein `<textarea>` (kein
`aria-activedescendant` über Elementgrenzen). Das Popup ist deshalb
`aria-hidden` wie das Knoten-Fenster (D57); eine höfliche **Live-Region**
meldet die Trefferzahl beim Öffnen und die gewählte ID beim Blättern. Die
Liste blockiert nie normales Tippen — wer sie nicht wahrnimmt, verliert
nichts.

**Position wie das Knoten-Fenster:** `position:fixed` auf `<body>` — in
einem Vorfahren mit `overflow` würde die Liste geklippt (D50), und `#out`s
`zoom` geht sie nichts an. Verankert unter dem `#` des Fragments, nach oben
ausweichend, wenn unten kein Platz ist; zu geht sie bei Blur, Scrollen des
Textfelds, Fenstergröße — allem, was ihre Position hinfällig macht (die
D52-Liste). In Pad-Dokumenten (schreibgeschützt, D31) öffnet sie nie.

**Nachgemessen** im Browser mit echten Ereignisfolgen: `:` allein öffnet
nichts, `:#` zeigt alle vier IDs des Testbaums (verworfene eingeschlossen),
`a` filtert auf drei, ↑/↓ wandert (Live-Region nennt die gewählte ID), Enter
übernimmt (`- Frontend :#api`), `,#` öffnet ohne das schon gelistete `api`,
Esc schließt und bleibt bei Cursorbewegung zu, `d` öffnet wieder, Klick
übernimmt, und **jede** Übernahme ist ein einzelner Undo-Schritt. Tab: bei
offener Liste übernehmen ohne Einrücken, danach einrücken wie immer. 20 neue
Tests in `tests/autocomplete.test.js` (397 gesamt): Kontext-Erkennung
(Kopf-Form, Zitier-Klammer, Kommentar, Beschreibungsteil, Fortsetzungszeile
D59, Ersetzen über die Schreibmarke hinaus), Sammeln (Dokumentreihenfolge,
verworfene, D60-Knoten ohne Titel) und Sortierung (Präfix vor Teilstring,
case-insensitiv, exclude).

## D64 — Lange Labels brechen um: balanciert, ~40 Zeichen, erste Zeile als Anker
Breite Knotenkästen trieben den Baum in die Breite — ein einziger langer Titel
kostete eine ganze Spalte davon. Jetzt brechen Labels um: höchstens ~40
Zeichen je Zeile (Nutzer-Vorgabe), zentriert, und die Zeichen **gleichmäßig
auf die Zeilen verteilt** (ausdrücklicher Nutzer-Nachtrag): Der gierige
Umbruch machte aus 44 Zeichen eine volle Zeile plus ein einsames Wort.

**Die Umbrüche setzt der Renderer, nicht CSS.** `text-wrap:balance` wäre eine
Zeile gewesen und ist verworfen: Es balanciert nur **innerhalb** der einmal
bestimmten Kastenbreite — der Kasten bliebe auf `max-width` stehen, mit
Leerraum um zwei kurze Zeilen. `wrapLabel()` in render.js bricht selbst
(Zeilenzahl = ⌈Länge/40⌉, Ziel = gleichmäßig, gebrochen wird an der Stelle,
die dem Ziel am nächsten kommt, nie mitten im Wort) und schreibt echte `\n`
ins Markup; `white-space:pre-line` macht sie sichtbar, und der Kasten
schrumpft auf die längste **balancierte** Zeile. Nebengewinn: Die Regel ist
headless testbar (Hausregel D54-Nachtrag 3) und in jedem Browser gleich.
`max-width:40ch` + `overflow-wrap` bleiben als Rückhalt für das einzelne Wort
über der Grenze. Bewusst `\n` statt `<br>`: Der `textContent` behielte sonst
keine Wortgrenze, und alles, was den Knotentext liest (Export,
Fokusmarken-Schlüssel), bekäme zusammengeklebte Wörter.

**Die Geometrie ankert an der ersten Zeile.** Der 23-px-Abzweig der
gestapelten Anordnungen (§9: 5 px Listenabstand + halbe einzeilige
Knotenhöhe) bleibt fest — bei mehrzeiligen Knoten trifft er damit die Mitte
der **ersten Zeile**, das gewohnte Idiom jeder Baumansicht. Eine gemessene
„wahre Mitte" hätte die 23-px-Konstante an einem Dutzend CSS-Stellen dynamisch
gemacht — für einen Unterschied, den das Auge als falsch gar nicht liest. Zwei
Stellen mussten mitziehen:

- Der **Optional-Kreis** (D29) saß bei `top:50%` der Knotenhöhe — für
  einzeilige Knoten dasselbe wie die Abzweighöhe, für mehrzeilige nicht mehr.
  Er sitzt jetzt fest bei 18 px (= Abzweighöhe), **auf dem Abzweig statt auf
  der Knotenmitte**; die eine Ausnahme sind die vertikal zentrierten
  all-of-Zwischenknoten, deren Abzweig wirklich die Mitte trifft (dort bleibt
  50 %). Nachgemessen am dreizeiligen Optional-Knoten im vertikalen Modus:
  Kreismitte = Abzweighöhe, 0 px Abweichung.
- Der **Grafikexport** zeichnete das Label als ein `<text>` — ein SVG-`<text>`
  bricht nicht von selbst. `labelLines()` misst die gerenderten Zeilen am
  Live-Knoten (zeichenweise per Range: neue Zeilen-Oberkante = neue Zeile —
  das deckt auch den `overflow-wrap`-Bruch mitten im langen Wort ab, den eine
  Nachbildung der Wortlogik verfehlte) und gibt je Zeile ein `<text>` an der
  gemessenen Position aus. Die Linienführung des Exports zielte schon immer
  auf die gemessene Knotenmitte und blieb unberührt.

**Zwei Nachträge aus derselben Runde, beide Nutzer-Wünsche:**

- **Die eingeblendete ID steht in einer eigenen Zeile ÜBER dem Titel**
  (ändert D56). Vorher stand sie inline davor (`#some.id: Titel`) und machte
  gerade die Knoten am breitesten, die ohnehin lange Titel tragen. Der
  Trenn-Doppelpunkt entfällt: Er trennte ID und Titel in **derselben** Zeile —
  hier trennt der Umbruch, und `#auth:` allein auf einer Zeile läse sich wie
  ein Block-Kopf (§1). Der Export folgt von selbst (er misst Zeilen).
- **Das Falt-Zeichen ist jetzt ein gerahmter Chip** (ändert die D38-Optik):
  Das nackte ▾ war ~10 px klein und schwer zu treffen. Der Chip (19×16 px,
  Rahmen, dezente Füllung) ist das Klickziel, das er immer sein sollte. Seine
  Höhe ist gedeckelt (`line-height:14px`, kein vertikales Padding), denn ein
  Inline-Block, der höher ist als die Zeilenbox, höbe die feste Zeilenhöhe an,
  an der die 23-px-Geometrie hängt — mit 15 px Zeilenhöhe wuchs der Knoten
  nachgemessen von 34,3 auf 35,0 px, mit 14 px bleibt er exakt bei 34,3.

**Nachgemessen** am mitgelieferten Plan (horizontal, Pfad an): 166 Knoten,
0 Warnungen, 27 Stationen (unverändert), `--stem-x` weiterhin punktgenau auf
der Knotenmitte (130,8 = 130,8 px) — und am Testbaum: 79 Zeichen ergeben zwei
Zeilen zu ~40/39 statt 40+Rest, drei Zeilen bei ~100; im exportierten SVG
stehen die zwei Zeilen des langen Titels 18,3 px auseinander vollständig im
52,6-px-Kasten, die ID-Zeile als eigene Textzeile. Falten am Chip klappt
weiter um (166 → 140 → 166 Knoten). 405 Tests, davon 8 neue in
`tests/wrap.test.js` (Balance, keine Zeile über 40, kein Zeichenverlust, nie
mitten im Wort, `\n` im Knotentext); die showIds-Tests sind auf die eigene
Zeile umgeschrieben. Der neue Plan-Knoten `#ed.render.wrap (S)` kippte prompt
die Größenprüfung des eigenen Plans (`#ed.render (M)` mit nun 4×S, D62) —
ehrlich nachgezogen auf `(L)`, danach wieder 0 Warnungen.

**Nachtrag — der Falt-Chip bekommt deckendes Weiß.** Gemeldet: „teilweise
schwierig zu erkennen (z. B. weiß auf heller Farbe)". Die erste Fassung
füllte den Chip fast transparent (`rgba(36,52,71,.04)`) mit mattgrauer
Glyphe — auf den acht Pastell-Statusfarben (§4) verschwand er. Jetzt:
deckendes Weiß, Glyphe in Tinte (`--line`, ~7,6:1 auf Weiß), satter Rand in
`--muted`; auf dem weißen Neutral-Knoten trägt der Rand allein, der dunkle
Wurzelknoten bekommt die helle Umkehrung (weiße Glyphe, Rand 0,7). Nur
Farben — Innenabstand und `line-height:14px` bleiben unangetastet, die
23-px-Geometrie (oben) hängt daran.

## D65 — Abgerissene Linien im vertikalen Modus: Geometrie-Fehler, kein Rendering-Problem
Gemeldet: „Es geschieht immer wieder, dass die Verbindungslinien zu Sub-Knoten
nicht durchgängig sind, sondern Lücken haben — meistens fehlen in der
vertikalen Ansicht kurze vertikale Linien", mit der Frage, ob das stabil zu
fixen sei oder ein Umstieg auf Canvas-Rendering nötig würde. Der entscheidende
Hinweis kam nachgereicht: „meistens, wenn es nur einen einzigen oder zwei
Unterknoten gibt."

**Es ist kein Rundungs- oder Rendering-Problem, sondern ein deterministischer
Geometrie-Fehler** — gemessen statt geraten: Ein Scanner über die
Pseudo-Element-Geometrie aller 45 vertikalen all-of-Gruppen des mitgelieferten
Plans fand **8 kaputte**, alle mit 1–3 Kindern, alle exakt reproduzierbar.
Zwei Fehlerarten, eine gemeinsame Wurzel: **Der Eltern-Stub dockt bei 50 % der
Gruppenhöhe an** (`li.has-and{align-items:center}`, D9), **die Sammelleiste
endet aber am Abzweigpunkt des Rand-Kindes** — und nichts garantierte, dass
die 50 % dazwischen liegen.

- **Einziges Kind:** `li:only-child::after{border:0}` schaltete die Leiste ganz
  ab — in der Annahme, Stub (50 %) und Kind-Abzweig (fest 23 px) fielen
  zusammen. Das taten sie, solange das `<li>` symmetrisch gepolstert war
  (5+5 px: Mitte 22,15 ≈ 23). Der **20-px-Zusatzabstand nach unten**
  (D-Transponiert, gegen Badge/Tag-Überlappung) verschob die Mitte auf 29,65 —
  **6,6 px Lücke**; mehrzeilige Knoten (D64) machten daraus **15,8 px**. Der
  Fehler war also alt und wurde schrittweise sichtbarer — daher „immer wieder".
- **Letztes Kind mit großem Teilbaum:** Die Leiste läuft vom ersten bis zum
  letzten Abzweig (je 23 px unter der Zellen-Oberkante). Trägt das letzte Kind
  einen großen Teilbaum, liegt die Gruppen-**Mitte** unterhalb seines Abzweigs
  — der Stub hing frei in der Luft (gemessen: 4,5 bis **98 px**).

**Fix in zwei Teilen, je auf dem billigsten tragfähigen Weg:**

- **Einziges Kind rein in CSS:** Bei `:only-child` ist die Gruppenhöhe die
  Kindhöhe (`padding-top:0`), 50 % ist also im `<li>` ausdrückbar —
  `top:23px; height:max(0px, calc(50% - 23px))` verbindet Abzweig und Stub
  exakt. Für ein has-and-Einzelkind bleibt `border:0` (Abzweig liegt dort
  selbst bei 50 %, beides fällt zusammen).
- **Letztes Kind per Messung:** Die Gruppenmitte relativ zum letzten `<li>`
  kann CSS nicht ausdrücken — dieselbe Lage wie bei `--stem-x`
  (D29-Nachtrag 2), also derselbe Griff: `alignVRails()` misst nach jedem
  Rendern/Moduswechsel und setzt `--vrail-ext` (unskalierte px, durch
  `effZoom()` zurückgerechnet); die CSS-Regel
  `li:last-child:not(.has-and):not(:only-child)::after{height:var(--vrail-ext, 23px)}`
  verlängert die Leiste bis zum Stub. **has-and-Letztkinder brauchen das
  nie** — deren Abzweig liegt bei 50 % ihrer Zelle, und die Gruppenmitte kann
  rechnerisch nie darunter liegen (H/2 > H − h/2 hieße h > H). Nach **oben**
  kann die Mitte ebenfalls nie herausfallen (der erste Abzweig liegt höchstens
  23 px unter dem Gruppenanfang, und H/2 ≥ 23 gilt ab 46 px Gruppenhöhe —
  ein einzelner Knoten ist schon höher).

**Canvas (oder eine SVG-Volleinzeichnung) ist damit nicht nötig.** Die Frage
war berechtigt — viele einzeln positionierte Border-Segmente sind die
fehleranfälligere Bauart als ein durchgezogener Pfad —, aber der konkrete
Fehler lag in zwei falschen Annahmen der Geometrie, nicht im Mechanismus.
Ein Umstieg kostete die CSS-gestützte Selbstverständlichkeit von Fokus,
Hover, Zoom und Druck und müsste alle über D9–D64 austarierten Sonderfälle
(Treppe, only-child-Leiterstück, has-and-Zentrierung) neu beweisen. Sollte
je das **zweite** Phänomen auftreten — 1-px-Haarlinien an Segment-Stößen
unter `zoom` ≠ 1 —, wäre das ein eigener Fall mit eigenem Mittel
(Segmente an Stößen minimal überlappen lassen), kein Grund für einen Umbau.

**Export und Kompakt-Modus waren nie betroffen:** `diagramToSvg()` spannt die
Leiste seit jeher über die Kinder **und** die Elternmitte
(`kids.map(cy).concat(p.cy)`, D29-Nachtrag 4); im kompakten Modus dockt der
Stub oben an (kein Zentrieren). Beides nachgemessen (Scanner: 0 Befunde in
45 Kompakt-Gruppen; 0 verwaiste `--vrail-ext` nach Moduswechsel).

**Nachgemessen** nach dem Fix (mitgelieferter Plan, vertikal): 0 Befunde in
45 Gruppen; der Only-Child-Verbinder endet auf 0,0 px genau am Stub
(336,5 → 352,3 = Stub-Höhe); die 98-px-Lücke trägt jetzt eine
121-px-Verlängerung bis zum Stub; Zoom-Gegenprobe bei 0,9 sauber (die Variable
ist zoom-invariant, wie `--stem-x`). 405 Tests grün — die Regeln sind
DOM-Geometrie und damit Browser-geprüft, nicht unit-testbar (dieselbe Grenze
wie `alignStems()`, D29).

**Nachtrag 3 zu D64 — die Umbruchgrenze sinkt von 40 auf 32 Zeichen.**
Nutzerwunsch nach dem Leben mit der 40er-Grenze: „einige Titel ziehen das
Diagramm doch arg in die Breite". Die 40 waren eine gesetzte Zahl, keine
hergeleitete — 32 ist es ebenso, nur mit Erfahrung dahinter. Die Änderung ist
genau der eine Parameter, für den `wrapLabel()` gebaut wurde: Default in
render.js, der `max-width`-Rückhalt im CSS (40ch → 32ch) und die
SPEC-§9-Zahl ziehen mit; Balance-Regel, Erste-Zeile-Verankerung und Export
bleiben unberührt. Sichtbare Folge: mehr Knoten brechen um (rund 100 Zeichen
ergeben jetzt vier statt drei Zeilen), dafür wird der breiteste Fächer
schmaler. Testerwartungen mit dem echten Algorithmus nachgerechnet statt
geschätzt.

## D66 — Fehlende Größe wird aus den Teilpaketen geschätzt statt pauschal M
Gewünscht vom Nutzer: „Die Kostenschätzung für Knoten ohne explizite
T-Shirt-Größe soll anhand der Sub-Knoten geschehen. Mindestens die größte
T-Shirt-Größe der Sub-Knoten; wenn mehr als 2 diese Größe haben, also ab 3,
dann sogar eine T-Shirt-Größe mehr." Die alte D18-Pauschale — fehlende Größe
= M — unterschätzte jeden größenlosen Sammelknoten, sobald ein Kind über M
lag; die Kinder sagen mehr, als die Pauschale nutzte.

**Die Regel:** Angenommen wird **mindestens die größte Größe der zählenden
Kinder**; tragen **drei oder mehr** Kinder diese größte Größe, eine Stufe
mehr (Deckel `XXL`). Ein Knoten ohne Größe und ohne zählende Kinder bleibt
beim M-Rückfall — für ein Blatt gibt es nichts abzuleiten, und D18 nannte M
selbst schon „die konservative Annahme ‚mindestens M'".

**Es zählen dieselben Kinder wie beim Größen-Konflikt (§5/D62)** — direkte,
verworfene und optionale (`+`) nie, in einer disjunktiven Gruppe (`|`/`=`)
nur die **kleinste** Alternative —, mit genau einem Unterschied: Kinder
**ohne** Größe zählen hier mit, ihre Größe wird nach derselben Regel
**rekursiv** mitgeschätzt. D62 schließt sie aus, weil eine fehlende Größe
keine Autoren-Aussage ist und die Konfliktprüfung nur meldet, was sicher
ist; hier wird ohnehin geschätzt — sie auszuschließen hieße, drei größenlose
Blätter für kostenlos zu halten. Die D62-Zählung zu übernehmen statt eine
dritte Regelmenge zu erfinden hält die Doku bei einem Satz: „dieselben
Kinder wie beim Größen-Konflikt".

**Disjunktiv gilt das Minimum, und keine Stufe mehr.** Realisiert wird genau
eine Alternative — die kleinste ist der Boden, den jede Wahl mindestens
kostet, und drei gleich große Alternativen sind kein dreifacher Aufwand. Ist
in der Gruppe etwas realisiert, ist die Wahl getroffen (D61, `chosenPool`):
Dann zählt die kleinste der **realisierten**. Bewusst **nicht** die
Alternative, die der günstigste Pfad wählt — die Wahl hängt von den Kosten
ab und die Kosten hingen dann von der Wahl: ein Zirkel. Das Minimum ist
deterministisch und für ein „mindestens" die ehrliche Untergrenze.

**Nur die Kostenschätzung ändert sich.** Die §5-Semantik bleibt unberührt,
die Konfliktprüfung (D62) rechnet weiter nur mit angegebenen Größen, und die
Falt-Voreinstellung „ab M abwärts" (D44, `atMostM`) klappt weiterhin nichts
ohne Größenangabe zu — dort wäre die Schätzung eine Vermutung, die wie eine
Angabe behandelt würde (die D44-Begründung gilt wörtlich weiter).

**Das invertierte Badge zeigt jetzt die geschätzte Größe** statt immer „M";
Tooltip und `aria-label` sagen „mindestens {size} angenommen". Die beiden
vorhandenen i18n-Schlüssel wurden **parameterisiert** statt verdoppelt: Ein
Text mit „mindestens {size}" stimmt für die Ableitung wie für den
M-Rückfall — kein neuer Schlüssel in neun Sprachen für dieselbe Aussage.

**Memoisiert per WeakMap**, nicht am Knotenobjekt und nicht ungecacht:
`computeCheapPlan` (D42) ruft `ownCost` je Suchbelegung über die ganze
nötige Menge — eine ungecachte Rekursion wäre O(n²) je Belegung, bei 20 000
Belegungen zu viel. Der Parse-Baum wird bei jedem Tastendruck neu gebaut,
der Cache kann also nie veralten, und die WeakMap gibt alte Bäume von
selbst frei.

**Nachgemessen:** Der mitgelieferte Plan hat genau **einen** größenlosen
Knoten (`#not.people`, ein Blatt → weiterhin M) — Pfadknoten 135 und
Stationen 27 unverändert, 0 Warnungen. Das kanonische Beispiel (§10) ändert
sich nicht (seine größenlosen Knoten sind Blätter); alle Snapshots bleiben
stehen. 424 Tests, davon 19 neue in `tests/assumed.test.js`. Gegenprobe per
Mutation: Stufe-ab-drei entfernt → genau die drei danach benannten
Zusicherungen fallen; disjunktiv Maximum statt Minimum → genau eine; alte
M-Pauschale in `ownCost` zurückgebaut → genau die zwei Kosten-Tests.

## D67 — Strg+Klick folgt einer Abhängigkeit zur Zeile ihrer ID
Gewünscht vom Nutzer: Strg+Klick auf eine ID-Referenz wie `:#ziel` im Textfeld
soll zur referenzierten ID springen; Alt+Klick bleibt wie gehabt und
fokussiert den Knoten im Diagramm. Die Lücke ist real: Abhängigkeiten zeigen
bewusst quer durch den Baum (D34), und im mitgelieferten Plan liegt das Ziel
oft hunderte Zeilen entfernt. Die ID-Vorschläge (D63) helfen beim
**Schreiben** einer Abhängigkeit — beim **Lesen** blieb nur die Textsuche.

**Die Schreibmarke ist der Treffer, kein eigenes Hit-Testing.** Ein Klick ins
Textfeld setzt die Schreibmarke, bevor das `click`-Ereignis läuft —
`depIdAt(text, caret)` liest also einfach an `selectionStart`, welche ID dort
steht. Kein Pixel-Rechnen, kein Spiegel-`div`; dieselbe Sparsamkeit wie beim
Alt+Klick im Textfeld (D25-Nachtrag), der auch nur die Cursor-Zeile nimmt.

**Erkannt wird dieselbe Form wie bei den ID-Vorschlägen (D63):** das Token
alleinstehend angesetzt oder in der Kopf-Form `#auth:#db`; kein Treffer im
Kommentar, im Beschreibungsteil hinter `---` und innerhalb einer URL, und
`(:#a,#b)` bleibt Zitat (§1/D37). Jede ID der Liste ist einzeln ansteuerbar —
die Schreibmarke wählt das Segment. **Benannte Grenze:** Der Parser erkennt
nach der Extraktion auch Randformen wie `(M):#b` als Abhängigkeit (die
Größen-Entfernung macht das Token alleinstehend); die Klick-Erkennung auf der
rohen Zeile tut das nicht. Dort geschieht schlicht nichts — der harmlose
Fehlermodus, und dieselbe Vereinfachung, die D63 bereits gewählt hat.

**Aufgelöst wird zur ersten Vergabe** (`idLine`, Dokumentreihenfolge) — die
Regel aus D36/D39, nach der überall aufgelöst wird. Eine unbekannte ID tut
still nichts: `unknownDep` warnt bereits, ein zweiter Kanal wäre Lärm.
Vorwärts-Referenzen springen nach unten, Zyklen sind schlicht zwei Sprünge.

**Das Ziel bekommt denselben Sprung wie aus dem Diagramm:** `jumpToLine()` —
ganze Zeile markiert, in Sicht gescrollt, waagerecht auf Anfang (D49), und
über `caretLine` hebt sich der Zielknoten im Diagramm mit hervor. Kein neues
Idiom für dieselbe Aussage „hier ist es".

**Strg, mit Cmd als macOS-Zwilling.** Alt ist vergeben (Text → Diagramm,
D25); Strg+Klick ist in Editoren und IDEs die etablierte
„zur Definition"-Geste. Auf macOS ist Strg+Klick das Kontextmenü — dort
übernimmt Cmd+Klick (`metaKey`). Tastatur-Pendant ist **Strg+Enter** an der
Schreibmarke im Token — dasselbe Muster wie Alt+Enter (D25); `preventDefault`
nur bei erfolgtem Sprung, sonst bleibt der Browser-Default unberührt. Auf
Touch gibt es kein Strg und **kein Pendant** — bewusst nicht gebaut; der
lange Druck ist vergeben (D25), und ein Knopf im Knoten-Fenster wäre eine
eigene Entscheidung.

**Headless nach Hausregel** (D54-Nachtrag 3): `depIdAt` und `idLine` liegen
in `autocomplete.js` neben den D63-Regeln, mit denen sie sich Zeichenmenge
und Kontext-Ausschlüsse teilen; app.js verdrahtet nur zwei Handler.
Auffindbarkeit über die vorhandene Legenden-Zeile `hint_jump` (erweitert in
allen neun Sprachen, statt eines neuen Schlüssels — das D25-Idiom) und
SPEC §9.

**Nachgemessen** im Browser mit einem **echten** Strg+Klick auf das `#ui` in
`:#api,#ui`: Zeile `- #ui: Oberflaeche (S)` vollständig markiert, Fokus im
Textfeld, `scrollLeft` 0, Diagramm hebt „Oberflaeche" hervor. Strg+Enter im
Token springt ebenso (preventDefault gesetzt, kein Umbruch eingefügt); im
Kommentar, im Label und neben dem Token geschieht nichts. 440 Tests, davon 16
neue in `tests/deplink.test.js`; Gegenprobe per Mutation: Alleinstehend-
Prüfung entfernt → genau die zwei danach benannten Zusicherungen fallen.

**Werkzeuggrenze, wieder dieselbe Sorte wie D53:** Der synthetische
Strg+Enter der Browser-Automatisierung kommt mit **`e.key === ""`** an und
kann den Handler prinzipiell nicht treffen — der erste Prüflauf sah deshalb
wie ein Fehler aus, der keiner war. Geprüft wird das Tastatur-Pendant mit
einem korrekt gebauten `KeyboardEvent`; der Klick-Weg ließ sich dagegen echt
auslösen.

## D68 — Größe: das letzte alleinstehende Token, nicht das erste
Gemeldet vom Nutzer: Manchmal braucht der Titel runde Klammern — und wenn ihr
Inhalt zufällig ein Größenkürzel ist (`Variante (L) bauen`), fraß die
Extraktion das Titel-`(L)` als Größe. Mit echter Angabe dahinter war es
doppelt falsch: Das Literal wurde die Größe, das gemeinte `(M)` blieb im
Label. Entschieden (Nutzer): beide vorgeschlagenen Regeln kombiniert.

**Alleinstehend angesetzt** (`(^|\s)\(…\)`) — dieselbe Regel-Familie wie bei
`#id`, `:#…`, `!!!` und `&tag`, und der eigentliche Gewinn liegt darin, dass
die **vorhandenen Zitier-Konventionen dadurch von selbst greifen**: `"(L)"`
bleibt Label (das `(` hängt am `"`), `((L))` ebenso (am äußeren `(`). Kein
neues Zeichen, kein Escape — die Notation escapt weiterhin nirgends (D59).
Wer eine Größe erwähnen will, zitiert sie; llms.md führt beide Formen in der
Zitier-Faustregel.

**Das letzte Token gewinnt, nicht das erste.** Die übliche Schreibweise
stellt die Größe hinter den Titel — das letzte Token ist die Angabe, alles
davor ist Text. Damit löst sich auch der Fall ohne Anführungszeichen richtig
auf: `Variante (L) bauen (M)` → Größe `M`, Label „Variante (L) bauen“. In
der Idee-Runde war „letztes statt erstes“ zunächst verworfen worden („stille
Umdeutung bestehender Zeilen“); der Einwand wiegt hier wenig, weil die alte
Erste-gewinnt-Lesart in genau diesen Zeilen schon falsch war — es gibt keine
richtige Bedeutung, die verloren ginge.

**Preis, benannt:** `Backend(L)` ohne Leerzeichen ist keine Größe mehr. Der
Fehlermodus ist der laute (das Badge fehlt sichtbar, D59-Haltung), und in den
mitgelieferten Beispielen kommt die enge Schreibweise nicht vor — geprüft per
Grep und per Parse-Vergleich alt/neu über alle `docs/examples/*.werkbaum`
(Knoten- und Größenzahlen identisch, Warnungen unverändert; die drei
`sizeConflict` der Demo-Pläne sind Altbestand).

**Umgesetzt als Schleife über alle Treffer** statt eines cleveren
Rückwärts-Regex: gut lesbar, und der führende Leerraum der Fundstelle bleibt
beim Entfernen stehen (wie `pre` bei den übrigen Extraktionen). SPEC §1
(Schritt 4, eigener Größen-Block, Referenz-Regex) und §5 zuerst, llms.md im
selben Zug (Schritt-3-Regel, Größen-Abschnitt, Zitier-Faustregel).

**Nachgemessen:** 445 Tests (4 neue in `tests/parser.test.js`); Gegenprobe
per Mutation: erster statt letzter Treffer → genau der Letztes-gewinnt-Test
fällt; Anker entfernt → genau die zwei Alleinstehend-/Zitier-Tests. Alle
Snapshots (kanonisches Beispiel §10) unverändert.

## D69 — Die Größe bepreist den ganzen Teilbaum: Kinder kommen nicht obendrauf
Gemeldet am eigenen Beispiel: Eine `|`-Gruppe mit `Manuell mit Downtime (S)`
(zerlegt in XS + S + eine Zugabe) verlor gegen `Failover (L)` — der Pfad
rechnete S(2) + XS(1) + S(2) = 5 gegen L(4). Der Einwand des Nutzers trifft
das Modell im Kern: **„Manuell mit Downtime" ist mit (S) bepreist — dann ist
egal, wie teuer die Summe der Teilpakete ist.** Ob die Zerlegung in die
Größe passt, prüft seit D62 der Größen-Konflikt; die Pfadrechnung hat die
Bewertung nicht anzuzweifeln. Das alte Modell (D18: „eigene Größe plus
Summe/Minimum der Kinder") zählte doppelt und bestrafte damit systematisch
genau die Pläne, die sorgfältig zerlegen — je ehrlicher die Zerlegung, desto
teurer sah das Paket aus.

**Neue Regel: Der Preis eines Knotens ist seine Größe.** Angegeben oder —
seit D66 — aus den Teilpaketen geschätzt; die Schätzung ist dieselbe Sorte
Gesamtaussage und übernimmt die Rolle nahtlos. Erledigtes bleibt 0 (D46).
`cheapestCost()` kollabiert damit auf `ownCost()`: Die Rekursion über die
Kinder entfällt, die Aggregation für größenlose Knoten trägt allein die
D66-Schätzregel. Die Wahl in einer Alternativgruppe vergleicht schlicht die
Größen der Alternativen.

**Die Bewertung gilt auch, wenn die Kinder sie sprengen.** Vier `(S)` unter
einem `(S)` sind ein `sizeConflict` — der Marker zeigt es, aber der Knoten
bleibt bewertet, wie er bewertet wurde (ausdrückliche Nutzer-Entscheidung:
„der übergeordnete Knoten bleibt dennoch S"). Die Alternative — die Kinder
könnten den Preis anheben (max-Variante) — war vorgeschlagen und ist damit
verworfen: Sie hätte die Bewertung des Autors stillschweigend überstimmt,
und für den Widerspruch gibt es bereits den lauten Kanal.

**Das Vereinigungs-Maß der Closure-Suche (D42) zieht mit.** Die Suche über
die gekoppelten Gruppen verglich Belegungen über die Summe der Knoten-Preise
der nötigen Menge — mit Teilbaum-Bepreisung zählte ein zerlegtes
Abhängigkeits-Ziel dann mehrfach (Eltern plus Kinder), ein grobes nur
einmal: dieselbe Zerlegungs-Strafe, nur im Suchmaß. Jeder nötige Knoten
zählt jetzt nur mit dem, was seine Größe **über die nötigen Teilpakete
hinaus** behauptet (nie negativ); die Summe dieser Margen bepreist einen
vollständig zerlegten Teilbaum mit seiner Spitzengröße, gemeinsam
Gebrauchtes zählt über die Mengen-Vereinigung weiterhin einmal. Benannte
Grenze: Wo Kinder ihre Elterngröße im Rangraum übersteigen, liegt das
Suchmaß über dem Preis der lokalen Wahl — die beiden Maße sind dann nicht
identisch; das betrifft genau die Teilbäume, die der Größen-Konflikt ohnehin
anmahnt oder die eng bepreist sind, und die lokale Wahl (der Regelfall)
folgt strikt der Nutzer-Regel.

**Benannter Verlust:** Erledigte Teilpakete unter einem offenen Knoten
senken dessen Preis nicht mehr (kein Kinder-Summieren, keine Bruchteile —
D46 lehnte anteilige Restkosten schon ab). Für die Wahl trägt das kaum:
Sobald an einer Alternative selbst gearbeitet ist, entscheidet ohnehin
`chosenPool` (D61); Stationen und Markierung behalten ihre Knoten-Genauigkeit
unverändert.

**Nachgemessen:** Der gemeldete Fall wählt jetzt „Manuell mit Downtime"
(S=2 gegen L=4). Der mitgelieferte Werkbaum-Plan wählt unter altem und neuem
Modell **identisch** (137 Pfadknoten, 57 Stationen, gleiche Menge — per
git-stash-Vergleich gemessen, nicht angenommen). 450 Tests, davon 5 neue in
`tests/pricing.test.js`; drei Alt-Tests, die die Summen-Semantik festhielten,
sind auf die neue Regel umgeschrieben. Gegenproben per Mutation: alte
Rekursion zurückgebaut → genau die drei danach benannten Zusicherungen
fallen; Vereinigungs-Maß auf schlichte Summe zurück → genau der eine
Marginal-Test (dessen erste Fassung nicht unterschied, weil Wurzeln immer
nötig sind — der Testbaum musste die Ziele unter einen unangetasteten
`+`-Zweig legen).

## D70 — Die geschätzte Größe bepreist den Rest: Erledigtes fällt aus der Schätzung
Nachgefragt vom Nutzer zum benannten D69-Verlust (erledigte Teilpakete
senken den Preis eines offenen Knotens nicht mehr): „Wenn der Überknoten
keine explizite, sondern nur eine implizit berechnete Größe hat, dann ist
das doch kein Problem?" Die Prüfung ergab: **Es war eines** — die
D66-Schätzung war status-blind. Ein größenloses Paket mit `[x] (L)` und
`[ ] (S)` wurde als L geschätzt (Preis 4), obwohl nur noch S offen ist.

**Die Unterscheidung des Nutzers ist genau die tragfähige Linie:** Eine
**angegebene** Größe ist die Aussage des Autors — D69 erklärt sie für
maßgeblich, dort bleibt der Verlust bewusst bestehen (anteilige Restkosten
hat D46 verworfen). Die **geschätzte** Größe ist dagegen eine Kostenannahme
des Werkzeugs, und der Pfad fragt seit D46 „was ist noch offen?" — eine
Annahme, die Erledigtes einpreist, beantwortet die falsche Frage.

Die Regeln:

- **Erledigte Kinder (`[x]`/`[^]`, intrinsisch) fallen aus der Schätzung**
  wie verworfene — geschätzt wird die noch offene Arbeit, auch für die
  Stufe-ab-drei-Regel zählen nur die offenen.
- **Disjunktiv stellt eine erledigte realisierte Alternative die Gruppe
  fertig.** Kein eigener Sonderfall, sondern die Wahl des Pfads
  nachvollzogen: Unter mehreren realisierten entscheidet die Kostenregel
  (D61), und die erledigte kostet 0 — sie würde gewählt, die Gruppe trägt
  nichts mehr bei. Das gilt auch neben einer angefangenen zweiten
  Alternative.
- **Alles Benannte erledigt, der Knoten selbst offen → `XS`**, nicht der
  M-Rückfall. Die Restarbeit ist dann seine eigene Abschlussarbeit (er ist
  die Station, D46) — und der M-Rückfall erzeugte eine Absurdität: Das
  Fertigstellen des letzten S-Kindes *erhöbe* den Preis von S auf M. Die
  Schätzung muss beim Fertigwerden monoton sinken; XS ist der Boden der
  Skala. Nur der echte Blattknoten ohne Kinder bleibt beim M-Rückfall —
  dort gibt es keine Information.

**Sichtbare Nebenwirkung, gewollt:** Das invertierte Größen-Badge zeigt an
solchen Knoten die **Rest**-Schätzung. Der Tooltip sagt ohnehin „für die
Kostenschätzung mindestens {size} angenommen" — die Aussage bleibt wahr.
Größen-Konflikt (D62) und Falt-Voreinstellung (D44) arbeiten nur mit
angegebenen Größen und bleiben unberührt.

**Nachgemessen:** 457 Tests, davon 7 neue in `tests/assumed.test.js`
(darunter die Monotonie und die Zusicherung, dass eine ANGEGEBENE Größe
trotz erledigter Kinder stehen bleibt). Gegenproben per Mutation:
Done-Filter entfernt → genau die drei danach benannten Zusicherungen
fallen; XS-Boden auf M zurück → genau die drei XS-Tests; „Gruppe fertig"
entfernt → genau die zwei disjunktiven. Der mitgelieferte Plan ist
unberührt (sein einziger größenloser Knoten ist ein Blatt): weiterhin
0 Warnungen, 137 Pfadknoten, 57 Stationen, exakt gerechnet.

## D71 — Zuständigen-Engpass: warnen, wenn eine Person mehr als die Hälfte des Pfads trägt
Gewünscht: „eine Warnung, wenn ein und derselbe Verantwortliche (@name) zu oft
auf dem Lean-Path liegt — so eine Art Konflikt-Indikator." Kein neues
Zeichen — Tags (§7) und der günstigste Pfad existieren, es fehlte der
Konsument, der sie übereinanderlegt. Die Entscheidungen (Vorschlag bestätigt):

**Was der Indikator sagt:** Werkbaum ist bewusst kein Netzplan — die Warnung
behauptet nichts über Termine, sondern: Die **nächste Ausbaustufe ist nicht
parallelisierbar**, alles Weitere serialisiert sich durch eine Person. Genau
die Auskunft, die man beim Lean Pathfinding braucht.

**Maß: Marginalkosten, Stationen nur für den Text.** Zählen und Gewichten
standen zur Wahl; gewählt ist die Rollenteilung — Schwelle und Anteil rechnen
**gewichtet** (5×XS sind weniger Last als 2×XL), der Meldungstext nennt
zusätzlich die **Stationszahl**, weil Stationen sichtbare, mit dem Auge
nachprüfbare Objekte sind (die Punkte, die der D47-Knopf abgeht). Das
Gewichts-Maß gab es schon: die Marginalkosten des Belegungs-Vergleichs
(D69) — jeder nötige Knoten zählt mit dem, was seine Größe über die nötigen
Teilpakete hinaus behauptet; Erledigtes hat `ownCost` 0 und fällt von selbst
heraus. Die Personen-Summen ergeben zusammen exakt den Pfadpreis — kein
zweites Kostenmodell.

**Zuständigkeit erbt vom nächsten getaggten Vorfahren.** Die übliche
WBS-Lesart: Wer das Paket hat, hat die Teilpakete. Ohne Vererbung zählte in
sparsam getaggten Plänen fast nichts — im Test trüge die Person eines
zerlegten L-Pakets nur dessen Marge (1 statt 4). Mehrere Tags einer Zeile
**teilen** sich den Beitrag zu gleichen Teilen — voll doppelt gezählt bliese
gemeinsame Pakete künstlich zum Engpass auf. Beiträge ohne getaggten
Vorfahren gehen nur in die Gesamtsumme ein: Sie **verwässern** die Anteile
(konservativ — gemeldet wird nur, was sicher ist), warnen aber nicht selbst;
„viel ist niemandem zugewiesen" wäre eine eigene Aussage und, wenn überhaupt,
eine eigene Meldung.

**Schwelle: strikt mehr als die Hälfte, und mindestens zwei Personen mit Last
auf der offenen Front.** Der Solo-Plan ist die Falle — eine Person mit 100 %
ist dort keine Engstelle, sondern die Realität. Gezählt werden Personen **auf
der Front** (Last > 0), nicht im Dokument: Wer nur erledigte Knoten trägt,
macht aus einem faktischen Solo-Rest kein Zwei-Personen-Problem. Mehr als
eine Person über der Hälfte kann es nicht geben — die Meldung ist eindeutig.
Die Schwelle ist gesetzt, nicht hergeleitet (wie die 32 Zeichen in D64);
justiert wird nach Erfahrung.

**Anzeige: zeilenlose Warnung plus Warn-Pille.** Der Engpass hat keine
einzelne Zeile — `assigneeOverload` ist zeilenlos wie `cheapApprox` und nennt
Person, Anteil und Stationen. Zusätzlich wechseln die **Personen-Pillen** der
betroffenen Person an offenen Pfad-Knoten auf `--warn` — derselbe Griff wie
beim Größen-Konflikt-Badge (D62); der Grafikexport folgt von selbst, weil er
die gemessenen Pillen-Farben liest (D62). Geerbte Zuständigkeit hat keine
Pille und damit keine Färbung — benannt, kein Fehler. Kein neuer Umschalter,
kein Panel; bei ausgeschaltetem Pfad entfällt beides (ohne Pfad keine offene
Front).

**Headless nach Hausregel** (D54-Nachtrag 3): `assigneeLoads`/
`overloadedAssignee` in model.js, der Renderer bekommt nur `overloadTag`;
app.js verdrahtet Warnung und Option. Die mitgelieferten Dokumente bleiben
still (der Werkbaum-Plan hat keine Knoten-Tags; im Example liegt anna bei
3 von 13) — nachgemessen, nicht angenommen.

**Nachgemessen** im Browser an einem Wegwerf-Dokument: „@anna trägt 80 % der
offenen Arbeit auf dem günstigsten Pfad (1 von 2 Stationen) — mögliche
Engstelle.", genau eine Pille bernstein (`rgb(180,83,9)`) — am offenen
Pfad-Knoten, nicht am erledigten und nicht bei @ben; Pfad aus ⇒ Warnung und
Färbung weg, wieder an ⇒ beides zurück. 470 Tests, davon 13 neue in
`tests/overload.test.js`. Gegenproben per Mutation: Solo-Wächter entfernt →
genau der Solo-Test fällt; Schwelle aufgeweicht → genau die drei
Schwellen-Tests; Vererbung entfernt → genau der Vererbungs-Test; Teilung
entfernt → genau der Mehrfach-Tag-Test; Erledigt-Ausnahme der Pille
entfernt → genau der Pillen-Test.

## D72 — Lokale Dateien öffnen und speichern, in zwei Stufen
Der Notationstext ist das führende Datenformat (D14) — und war zugleich das
Einzige, das den Browser nicht als Datei verlassen konnte, während das
Diagramm zwei Download-Knöpfe hat. D24 hatte den Fall vorgesehen („ein
künftiges Öffnen/Speichern im Editor — dann als `accept`-Filter und
Download-Endung"). Entschieden (Nutzer): **zwei Stufen** — zuerst der
klassische Weg, der in jedem Browser läuft; darauf die File System Access API
für Chromium, die aus „Speichern unter" ein echtes „Speichern" macht.

**Stufe 1: Datei-Input und Blob-Download, im Dokumenten-Menü.** Zwei Einträge
neben „Neues Dokument": „Datei öffnen…" (verstecktes
`<input type="file" accept=".werkbaum,.txt,text/plain">`, gelesen per
`file.text()`) und „Als Datei speichern" (Blob + `<a download>`, über das
vorhandene `saveBlob()` des Grafikexports). Das Menü ist der richtige Ort:
Beide Aktionen handeln davon, *welcher Text* da ist — wie Anlegen, Umbenennen,
Wiederherstellen (D22).

**Geöffnet wird als NEUES Dokument, nicht per Namens-Identität.** D23 lässt
denselben `?sourceUrl=`-Link dasselbe Dokument aktualisieren — dort ist die
URL eine echte Adresse. Ein Dateiname ist keine: Zwei verschiedene Dateien
gleichen Namens (`plan.werkbaum` aus zwei Ordnern) überschrieben sich still,
und der stille Fehler ist der schlimmere (D59-Linie). Wer dieselbe Datei
zweimal öffnet, bekommt eben `plan.werkbaum` und `plan.werkbaum (2)` — sichtbar
und harmlos; die echte Datei-Identität bringt erst das Handle der Stufe 2.
Der Dateiname wird der Dokumentname (über `uniqueName`, wie überall).

**Der Dateiname beim Speichern entsteht aus dem Dokumentnamen** — headless in
`localfile.js` (`saveFileName`, Hausregel D54-Nachtrag 3): verbotene Zeichen
und Pfadtrenner werden zu `-` (URL-Namen aus D23 bleiben so lesbar), führende
Punkte fallen weg (sonst entstünde eine versteckte Datei), die Endung
`.werkbaum` kommt dazu, wenn nicht schon `.werkbaum` oder `.txt` dasteht
(D24: `.txt` bleibt zulässig), leerer Rest fällt auf `plan.werkbaum` zurück.
Gespeichert wird als `text/plain;charset=utf-8` mit LF — die D24-Konvention;
Pad-Dokumente (D31) dürfen ebenso gespeichert werden (der Schreibschutz gilt
dem Textfeld, nicht dem Export).

**Kein SPEC-Eintrag:** Öffnen/Speichern ist Dokumentverwaltung wie der
Wähler (D22) und die früheren Stände (D54) — Notation und Darstellung des
Plans ändern sich nicht; `llms.md` bleibt unberührt. Die Endungs-Konvention
steht seit D24 in SPEC §12.

**Nachgemessen** im Browser (echte `File` per DataTransfer — das prüft den
vollständigen Weg samt `file.text()`; der Download mit abgefangenem
Anchor-Klick und zurückgelesenem Blob): Öffnen legt ein drittes Dokument
„probe-plan.werkbaum" an, aktiviert es, Diagramm zeigt dessen 2 Knoten, der
Input ist geleert (dieselbe Datei bleibt erneut wählbar); Speichern liefert
`probe-plan.werkbaum` mit byte-identischem Inhalt. 479 Tests, davon 9 neue in
`tests/localfile.test.js`. Werkzeuggrenze wie in D25/D53: Der echte
Dateidialog und der echte Download lassen sich nicht automatisiert auslösen —
geprüft ist alles bis an diese Kante.

**Nachtrag — Stufe 2: die File System Access API macht aus „Speichern unter"
ein „Speichern".** Wo die Picker existieren (`showOpenFilePicker` als
Feature-Detection — Chromium; Firefox und Safari haben sie bewusst nicht),
ändert sich hinter denselben zwei Menü-Einträgen das Verhalten:

- **Öffnen** liefert ein `FileSystemFileHandle`. Damit gibt es die
  Datei-Identität, die Stufe 1 nicht hatte: `isSameEntry` prüft gegen die
  gemerkten Handles, **dieselbe Datei öffnet wieder in dasselbe Dokument**
  (aktualisiert den Text), eine andere Datei gleichen Namens bleibt ein
  eigenes. `adoptFile()` trägt beide Wege — der Stufe-1-Input ruft es ohne
  Handle, dann entsteht immer ein neues Dokument wie bisher.
- **Speichern** schreibt mit gemerktem Handle **in dieselbe Datei zurück**
  (`createWritable`), ohne Dialog. Ohne Handle fragt `showSaveFilePicker`
  (mit `saveFileName()` als Vorschlag) und merkt sich das Ergebnis — der
  Komfort greift ab dem zweiten Speichern. Ein **Abbruch** des Dialogs tut
  nichts — bewusst auch kein Download hinterher: Wer abbricht, will nicht
  woandershin speichern. Der Menü-Eintrag trägt den Dateinamen des Handles
  als Tooltip (Dateinamen sind Daten, kein i18n).
- **Handles überleben den Neustart in IndexedDB** — localStorage kann sie
  nicht halten (nicht JSON-serialisierbar), IndexedDB kann es (structured
  clone). Beim Start werden sie zurückgeholt; verwaiste Einträge (Dokument
  gelöscht) und Fremdes ohne `createWritable` räumen sich dabei weg. Nach dem
  Neustart steht die Berechtigung auf `prompt` — der Browser fragt beim
  ersten Speichern einmal nach (der Menü-Klick ist die nötige Nutzergeste);
  verweigert er, entscheidet der Dialog neu. **Alles daran ist Komfort, keine
  Pflicht**: Jeder IndexedDB-Fehler wird geschluckt, Speichern funktioniert
  dann eben wieder über den Dialog.
- `deleteDoc()` nimmt das Handle mit (Map und IndexedDB) — wie die Stände
  (D54): Mit dem Dokument geht, was an ihm hängt.

**Kein Strg+S** — erwogen und zurückgestellt: Der Browser-Default (Seite
speichern) müsste abgefangen werden, und ohne Handle öffnete die Geste
unvermittelt einen Dialog; wenn, dann als eigene Entscheidung mit
Legenden-Zeile.

**Nachgemessen** im Browser (echtes Chromium, `hasFsAccess === true`; die
Picker gestubbt — den nativen Dialog kann die Automatisierung nicht bedienen,
die Logik dahinter schon; Werkzeuggrenze wie D52): Öffnen legt das Dokument
mit Handle an, der Speichern-Eintrag trägt den Dateinamen als Tooltip,
Speichern schreibt in place (**0** Dialog-Aufrufe), dieselbe Datei erneut
geöffnet aktualisiert **dasselbe** Dokument (Anzahl unverändert, Text auf
Version 2, Diagramm folgt); ein Dokument ohne Handle bekommt beim ersten
Speichern den Dialog (`suggestedName` korrekt) und beim zweiten nicht mehr
(1 Aufruf, 2 Schreibvorgänge); Abbruch bzw. verweigerte Berechtigung
schreiben nichts und laden nichts herunter. **Nicht messbar** blieb die
IndexedDB-Rundreise über einen Neustart: Stub-Handles überleben den
Structured Clone nicht (`DataCloneError`, planmäßig geschluckt) — echte
Handles sind gerade dafür klonbar; dieser eine Pfad ist Code-Review statt
Messung. 480 Tests.

## D73 — PWA: Manifest und ein bewusst dummer Offline-Worker, network-first
Werkbaum ist als App installierbar (`#bld.pwa`): Manifest mit Icons und
Standalone-Fenster, ein Service Worker für den Offline-Start, und die
installierte App registriert sich für `.werkbaum`-Dateien. Die tragende
Entscheidung ist die Rolle des Workers — und sie hat den gefürchteten Teil
des Features aufgelöst.

**Der Worker ist ein Offline-Mantel, kein App-Verwalter.** Er fasst
ausschließlich die **Navigation zur App-Wurzel** an und beantwortet sie
**network-first**: Der Server bleibt die Quelle der Wahrheit, genau wie ohne
Worker; der Cache hält nur die zuletzt gesehene Fassung der einen
self-contained Datei (D19) für den Offline-Fall und wird bei jeder
erfolgreichen Navigation aufgefrischt. Alles andere — `?sourceUrl=`- und
Pad-Abrufe (D23/D31), `llms.md`/`llms.txt`, jeder `fetch()` — geht unangefasst
durch.

**Damit blieb die geplante D45-Migration aus — und das ist ein Befund, keine
Abkürzung.** Der Plan-Knoten hieß „The reload notice moves into the worker",
in der Annahme, ein Worker entscheide, was ausgeliefert wird, und der
Vergleich „laufender Build gegen den, den der Server sendet" (D45) verliere
seine Grundlage. Das gilt für einen **cache-first** Worker — und genau
deshalb ist der verworfen: Er hätte den skipWaiting-/updatefound-Lebenszyklus
gebraucht (die Stelle, an der PWAs erfahrungsgemäß Fehler sammeln, und D45
hat seine eigene Fehlergeschichte), eine zweite Update-Logik neben der
bestehenden, und jeden Nutzer bis dahin auf der zuerst installierten Fassung
festgenagelt. Network-first braucht nichts davon: Der Prüf-`fetch()` ist
keine Navigation und läuft ans echte Netz; „Jetzt laden" ist eine Navigation
und bekommt die frische Fassung. Beides gemessen, nicht angenommen (unten).
Der Knoten heißt jetzt „The reload notice stays truthful under the worker" —
die Arbeit war der Nachweis, nicht der Umzug. Der Preis von network-first ist
benannt: Der Start kostet online weiterhin einen Netz-Abruf (wie bisher auch)
statt sofort aus dem Cache zu kommen — für ein Produkt, das laufend deployt,
der richtige Tausch.

**`sw.js` ändert sich praktisch nie.** Weil die App vom Server kommt und
nicht aus dem Worker, gibt es keine Versionsnummer, die dort gepflegt oder
von den Deploy-Skripten eingespritzt werden müsste — kein zweiter
`sed`-Stempel neben der Footer-Version (D16).

**Aus „eine Datei" wird ehrlich „eine Datei plus App-Hülle".** Manifest,
Icons und Worker sind **nicht inlinebar** — der Browser holt sie per URL;
ein Worker braucht seine eigene Adresse. Sie liegen als `frontend/public/`-
Assets neben der Datei (der `llms.md`-Weg, D43) und werden von **beiden**
Deploy-Wegen mitkopiert (Pages-Workflow und `deploy-prod.sh` stellen die Site
je von Hand zusammen — dieselbe Doppelpflege wie bei den `sed`-Regeln, D16).
Die `file://`-Tauglichkeit der einen Datei bleibt: Ohne die Hülle fehlt nur
die Installierbarkeit, nicht die App. Die `.htaccess` bekommt den MIME-Typ
für `.webmanifest` — dieselbe Apache-Falle wie bei `.md` (D43-Nachtrag 2):
unbekannte Endung, kein Content-Type, Chromium verwirft das Manifest still.

**Icons aus der Marke, eingecheckt.** Die Raster-Größen (192/512 plus eine
Maskable-Variante mit Schutzzone: Marke auf 60 % statt 78 % der Fläche) sind
einmalig per Inkscape aus `docs/brand/favicon.svg` gerendert und eingecheckt —
der Fonts-Präzedenzfall (D20): Assets im Repo, kein Werkzeug im Build.

**Nicht im Dev-Server registriert.** Dort würde der Worker die HMR-Seite
cachen; der Zweig hängt an `!import.meta.env.DEV` und fällt im Dev als toter
Code weg. Auf `file://` und http ohne Secure Context gibt es keinen nutzbaren
`serviceWorker` — das Scheitern ist geschluckt, die App läuft ohne.

**Dateihandling (`#bld.pwa.files`):** `file_handlers` im Manifest
(`.werkbaum`/`.txt`, dieselben Endungen wie `FILE_TYPES`, D72) plus ein
`launchQueue`-Empfänger, der das gereichte Handle an das vorhandene
`adoptFile()` gibt — dieselbe Datei landet damit im selben Dokument, und das
gemerkte Handle macht „Als Datei speichern" dialogfrei (D72-Nachtrag).
`launch_handler: focus-existing`, damit der Doppelklick ein offenes Fenster
wiederverwendet, statt Instanzen zu stapeln. Chromium only — Firefox
installiert auf dem Desktop nicht, Safari kennt `file_handlers` nicht; dort
ändert sich nichts.

**Nachgemessen** am gebauten Stand (`vite preview`, dist auf localhost:8138):
Worker aktiv und `controller` gesetzt, Cache hält genau `./`. Dann ein Marker
in `dist/index.html` geschrieben: Der D45-artige `fetch(…, no-store)` **sieht
ihn sofort** (läuft also am Worker vorbei ans Netz), während die laufende
Seite ihn nicht hat; ein Reload **lädt ihn** (Navigation network-first) und
frischt den Cache mit auf. Server gestoppt, Reload: Die Seite kommt
vollständig aus dem Cache (18 Knoten gerendert, Marker enthalten). Manifest
parst mit `file_handlers` und `launch_handler`; `launchQueue` existiert und
der Consumer registriert sich fehlerfrei. Aufgeräumt per `unregister()` +
`caches.delete()`. 480 Tests unverändert grün.

**Werkzeuggrenzen, wie bei D72 benannt:** Installieren, der OS-Doppelklick
auf eine `.werkbaum`-Datei und die persistente Schreibberechtigung der
installierten App sind Betriebssystem-Dialoge und bleiben ein Handtest auf
echter Hardware; gemessen ist alles bis an diese Kante (Manifest gültig,
Consumer registriert, `adoptFile()`-Weg seit D72 geprüft).

## D74 — Strg+S speichert direkt: die D72-Zurückstellung ist umgekehrt
D72-Nachtrag hielt fest: „Kein Strg+S — erwogen und zurückgestellt", mit zwei
Einwänden — der Browser-Default (Seite speichern) müsste abgefangen werden,
und ohne Handle öffnete die Geste unvermittelt einen Dialog. Mit der
installierten PWA (D73) kippt die Abwägung, und der Nutzer hat es benannt:
Ein lokal geladenes Dokument soll **direkt** speicherbar sein, ohne Dialog.
Genau dafür ist Strg+S die Geste, die jeder zuerst versucht — und ohne
eigenen Handler tut sie das Schlimmstmögliche: Sie öffnet den
„Seite speichern"-Dialog des Browsers, also einen Dialog, der nicht einmal
das Dokument speichert.

**Die beiden D72-Einwände, neu bewertet:**

- **Der Browser-Default ist kein Preis, sondern der Anlass.** `preventDefault`
  ist eine Zeile; was sie unterdrückt, war vorher der einzige Effekt der
  Geste — und der falsche.
- **„Ohne Handle unvermittelt ein Dialog" trägt nicht mehr.** Die Geste
  **heißt** Speichern; ein Speicher-Dialog auf eine Speichern-Geste ist keine
  Überraschung, sondern das Verhalten jedes Editors beim ersten Strg+S.
  Danach ist das Handle gemerkt und jede weitere Geste dialogfrei.

**Verhalten = der Menü-Eintrag, nur als Geste.** Strg+S (macOS auch Cmd+S)
ruft dasselbe `saveLocalFile()`: mit gemerktem Handle in dieselbe Datei
(die einmalige Schreibberechtigungs-Nachfrage des Browsers bleibt — der
Tastendruck ist die dafür nötige Nutzergeste; die installierte App kann sie
mit „Bei jedem Besuch zulassen" dauerhaft erteilen), ohne Handle der
Speichern-Dialog (Chromium) bzw. Download (Firefox/Safari). Pad-Dokumente
dürfen wie über das Menü gespeichert werden (D72: der Schreibschutz gilt dem
Textfeld, nicht dem Export). `e.repeat` ist ausgefiltert — eine gehaltene
Taste speichert einmal.

**Stilles Speichern braucht eine sichtbare Antwort.** Der In-Place-Weg zeigt
sonst nichts — die Geste wirkte tot, und niemand wüsste, ob gespeichert ist.
Rückmeldung im Haus-Idiom (`flashBtn`, D54: 1,5 s Petrol samt Haken), am
**Dokumentnamen** in der Editor-Titelzeile — der benennt, was gespeichert
wurde. Dialog und Download sind selbst sichtbar und brauchen keine.

**Die Legenden-Zeile, die D72 zur Bedingung machte, ist da:** `hint_save` in
allen neun Sprachen, als zweite Zeile der Bedienungs-Zeile am Ende der
Legende (D25-Idiom: Auffindbarkeit gehört zur Geste).

**Nebenbefund, mitbehoben: der launchQueue-Empfänger wartete nicht auf die
gemerkten Handles.** `idbLoadHandles()` läuft asynchron beim Start; ein
Doppelklick, der die App erst startet, konnte seinen Consumer **vor** dem
Laden der Handle-Map erreichen — der `isSameEntry`-Abgleich lief dann über
eine leere Map, und dieselbe Datei wurde als Duplikat angelegt statt ihr
Dokument zu aktualisieren (genau die Zusage aus D73, „dieselbe Datei landet
im selben Dokument", wäre im häufigsten PWA-Startweg gebrochen).
`adoptFile()` wartet jetzt auf das `handlesReady`-Promise, bevor es
abgleicht — an der einen Stelle, die die Map braucht, statt in jedem
Aufrufer. Der Race ist zeitabhängig und im Werkzeug nicht deterministisch
auslösbar; der Fix ist eine Ordnungszusage im Code, geprüft per Review und
dadurch, dass der Picker-Weg (der dasselbe `adoptFile()` nimmt) unverändert
funktioniert.

**Nachgemessen** am gebauten Stand (dist auf localhost, Picker gestubbt —
die Werkzeuggrenze aus D72: den nativen Dialog kann die Automatisierung
nicht bedienen, die Logik dahinter schon): Erster Strg+S ruft den
Speichern-Dialog genau einmal (richtiger `suggestedName`) und schreibt;
zweiter Strg+S schreibt **ohne** Dialog in dasselbe Handle (0 weitere
Picker-Aufrufe, 2 Schreibvorgänge). Beide waren **echte** Tastendrücke
(CDP), und kein Browser-Dialog erschien — `preventDefault` greift. Den
Petrol-Haken am Dokumentnamen hat erst ein synthetischer Strg+S nach 400 ms
gezeigt (Klasse `done`, ✓, `#0F766E`): Der Werkzeug-Umlauf ist langsamer als
die 1,5 s des Blitzes — eine Messgrenze, kein Befund. Die Legende zeigt die
neue Zeile in DE und EN.

**Nachtrag — der Speichern-Dialog zeigt jetzt auf die Originaldatei.**
Gemeldet: „beim Ctrl-S erscheint immer ein Dialog und der Dateiname mit (1)
dahinter, ich möchte aber direkt speichern." Der Befund hat zwei Schichten:

- **„Immer ein Dialog" ist der Abbruch-Kreislauf.** Ein Handle wird erst nach
  einem **abgeschlossenen** Dialog gemerkt (D72-Nachtrag) — wer den Dialog
  abbricht, steht beim nächsten Strg+S wieder davor. Abgebrochen wird er zu
  Recht, wenn er das Falsche vorschlägt, und genau das tat er:
- **Das „(1)" ist Chromiums Ausweich-Vorschlag.** `showSaveFilePicker` öffnet
  ohne weitere Angaben im zuletzt benutzten Ordner und macht aus dem
  Namensvorschlag einen „name (1)"-Nachbarn, wenn dort schon eine gleichnamige
  Datei liegt. Wer **den** bestätigt, speichert an der falschen Stelle — der
  Dialog lud also zum Fehler ein und zum Abbruch gleichermaßen.

Zwei Handgriffe, beide am Picker-Aufruf:

- **Mit bekanntem, aber nicht beschreibbarem Handle** (der Fall „Berechtigung
  verweigert" oder ein gescheiterter Schreibversuch) bekommt der Dialog
  `startIn: <handle>` und den **exakten Dateinamen** des Handles: Er öffnet im
  Ordner der Originaldatei mit ihrem Namen. Einmal Ersetzen bestätigen, und
  das neue Handle ist beschreibbar — jedes weitere Strg+S ist still.
- **Ohne bekanntes Handle** teilen sich Öffnen- und Speichern-Dialog eine
  Picker-`id` (`werkbaum-files`): Chromium merkt sich je id den zuletzt
  benutzten Ordner, der Speichern-Dialog geht also dort auf, wo zuletzt
  geöffnet wurde — statt in Downloads. Kein `id` im startIn-Fall: Ein
  gemerkter Ordner überstimmte sonst das startIn.

Dazu gehört die Einordnung, die kein Code ändern kann: Der **erste** Strg+S
je Datei zeigt ohne beschreibbares Handle rechtens einen Dialog (die API
verlangt es), und nach einem App-Neustart fragt der Browser einmal nach der
Schreibberechtigung — „Bei jedem Besuch zulassen" der installierten App
räumt auch das ab. Direkt heißt: ab dem zweiten Mal.

**Nachgemessen** (dist, Picker gestubbt): Ohne Handle trägt der Aufruf
`suggestedName: "Example.werkbaum"` und `id: "werkbaum-files"`; mit
verweigertem Handle (`queryPermission → 'denied'`) trägt er den exakten
Handle-Namen und `startIn` = genau dieses Handle, ohne `id`; nach dem
Dialog wird geschrieben. Wegwerf-Dokument über die echte UI angelegt und
gelöscht (übrig: Example, Werkbaum). Ob der Nutzer zusätzlich noch das
**alte, vor dem Deploy geöffnete PWA-Fenster** vor sich hatte (dort gab es
den Strg+S-Handler noch nicht — die Taste ging an den Browser, dessen
„Seite speichern" hängt bei Wiederholung ebenfalls „ (1)" an), ließ sich
von hier nicht feststellen; ein Neustart der App stellt es klar.

## D72 — Nachtrag 2: Browser ohne File System Access erklären sich einmalig
Gewünscht vom Nutzer: In Firefox/Safari (und allem anderen ohne die API)
verhält sich die App bei lokalen Dateien „etwas seltsam" — eine geöffnete
Datei kommt als Kopie herein (beim erneuten Öffnen eine weitere, D72), und
Speichern legt eine neue Datei in den Downloads ab, statt zurückzuschreiben.
Wer die Chromium-Fassung kennt oder erwartet, hält das für einen Fehler.
Ein **einmaliger Hinweis** benennt die Grenze, bevor sie verwirrt.

- **Gezeigt beim ersten Öffnen oder Speichern, nicht beim App-Start.** Der
  Hinweis erklärt das Verhalten der Datei-Funktionen — wer sie nie benutzt,
  bekommt ihn nie zu sehen. Ein Banner beim Start hätte jeden
  Firefox-Besucher mit einer Auskunft über etwas begrüßt, das ihn (noch)
  nichts angeht.
- **Form: das Banner-Idiom der Update-Meldung** (fixiert oben, Tinte statt
  Petrol — Information, keine Aufforderung), mit „Verstanden"-Knopf. Er darf
  neben dem gerade aufgehenden Datei-Dialog erscheinen: Der Dialog liegt
  darüber, und nach dessen Schließen steht die Erklärung da — genau dann,
  wenn man das Ergebnis sieht.
- **„Verstanden" merkt der localStorage** (`werkbaum-fs-notice`); der
  Debug-Reset räumt den Schlüssel mit weg. Kein erneutes Zeigen je Sitzung
  oder je Dokument — die Auskunft ändert sich nicht, und ein wiederkehrender
  Hinweis wäre Gängelung.
- **Text in allen neun Sprachen** (`fsNotice`/`fsNoticeOk`, Deutsch als
  Quellsprache): was passiert (Kopie, Download) und dass Chromium-Browser
  direkt zurückschreiben — die eine Zeile, die den Wechsel-Anreiz ehrlich
  benennt, ohne zu werben.

**Nachgemessen** im Dev-Server mit erzwungenem `hasFsAccess = false` (das
Prüf-Pane ist Chromium — dieselbe Werkzeuggrenze wie bei den
Picker-Stubs; der Datei-Input war stummgeschaltet): Erstes „Datei öffnen…"
zeigt das Banner mit deutschem Text und Knopf, der Input-Klick läuft
trotzdem; „Verstanden" setzt den Merker und entfernt das Banner; ein
zweites Öffnen zeigt nichts mehr und öffnet weiter den Input. In Chromium
(`hasFsAccess` wahr) kehrt `maybeShowFsNotice()` in der ersten Zeile um —
dort existiert der Hinweis nicht.

**Nachtrag 3 — „Chromium" war die falsche Auskunft: Brave ist Chromium ohne
die API.** Gemeldet vom Nutzer, der den neuen Hinweis ausgerechnet in Brave
bekam: „Aber der ist doch Chromium basiert." Stimmt — und genau deshalb war
der Text falsch. Brave schaltet die File-System-Access-Schnittstelle
**bewusst ab** (Fingerprinting-/Datenschutz-Haltung; `showOpenFilePicker`
existiert dort nicht). Die Feature-Erkennung der App tat das Richtige — Brave
verhält sich wie Firefox —, aber Hinweis und Legenden-Zeile begründeten das
Verhalten mit der **Engine-Familie**, obwohl es am **Feature** hängt. Eine
Erklärung, die dem Betroffenen nachweislich widerspricht, ist schlimmer als
keine.

Alle 18 nutzersichtbaren Stellen (`fsNotice` und `hint_save`, je neun
Sprachen) benennen jetzt die Schnittstelle und Beispiel-Browser („mit der
File-System-Access-Schnittstelle, z. B. Chrome oder Edge") statt „Chromium".
Beispiele statt einer Liste, weil die Menge sich bewegt (Opera und Vivaldi
haben die API, Brave nicht, und Brave-Nutzer können sie über
`brave://flags/#file-system-access-api` selbst einschalten — dann greift
Stufe 2 dort unverändert, die Erkennung ist ja Feature-basiert).
Code-Kommentare dürfen weiter „Chromium" sagen — sie reden mit Entwicklern,
und dort ist die Kurzform tragbar.

**Nachtrag 4 — in Brave nennt der Hinweis die Flag-Adresse.** Gewünscht vom
Nutzer als Ergänzung zu Nachtrag 3: Wenn der Browser Brave ist, soll der
Hinweis sagen, wie man die Schnittstelle dort selbst einschaltet
(`brave://flags/#file-system-access-api`) — und nur dann; allen anderen
sagt die Adresse nichts. Erkannt wird Brave an `navigator.brave`, das
ausschließlich dort existiert (die Prüfung ist synchron auf die Existenz —
das Promise von `isBrave()` braucht es dafür nicht). Die Adresse steht als
kopierbarer Code-Text in einer zweiten Zeile: `brave://`-Links lassen sich
aus einer Webseite nicht öffnen (interne Schemata sind gesperrt), ein
toter Link wäre schlimmer als kein Link. Neuer i18n-Schlüssel
`fsNoticeBrave` in neun Sprachen; die Adresse selbst steht im Code, nicht
in den Übersetzungen — eine Stelle statt neun, an denen sie vertippt sein
kann. **Nachgemessen** im Dev-Server (Stufe-1-Pfad erzwungen, Brave per
`navigator.brave`-Stub zur Laufzeit): mit Stub trägt das Banner die zweite
Zeile samt Mono-Code der Adresse, ohne Stub fehlt beides.

## D75 — Querverbindungen folgen der Faltung und bekommen einen Schalter; der Falt-Knopf schaltet vier Voreinstellungen durch
Drei zusammenhängende Nutzerwünsche an derselben Stelle des Diagramms, in
einem Zug gebaut.

**1. Abhängigkeits-Kanten enden am nächsten sichtbaren Vorfahren.** D41 ließ
Kanten zu eingeklappten Knoten schlicht entfallen — gerade in einem dicht
gefalteten Plan verschwand damit die Aussage „dieser Zweig braucht jenen"
genau dann, wenn man sie am nötigsten hat. Die Regel gab es längst: **Der
eingeklappte Knoten vertritt seinen Teilbaum** — für die Pfad-Station, den
„▸ n"-Zähler und die Cursor-Zeile (D38-Nachträge). Jetzt gilt sie auch für
die Querverbindungen, für **Quelle wie Ziel** (Nutzer-Vorgabe). Fallen beide
Endpunkte in denselben sichtbaren Knoten, entfällt die Kante (sie sagte
nichts mehr); mehrere so zusammengefallene Kanten desselben Paars werden
**eine**. Kanten zu ausgeblendeten **verworfenen** Knoten entfallen
weiterhin — dieselbe Grenze wie bei der Cursor-Zeile (D38-Nachtrag 4):
Faltung ist Ansicht, der Verworfen-Filter ist eine Aussage über den Plan.

**Umgesetzt im Renderer, nicht in einer App-Nebenrechnung:** `walkFolded()`
läuft ohnehin durch jeden verborgenen Teilbaum (Warnungen, „▸ n") und sammelt
jetzt dessen IDs und Abhängigkeiten mit; der eingeklappte Knoten trägt sie
als `data-sub-ids`/`data-sub-deps` — getrennt von den eigenen Attributen,
damit die Bedeutung ablesbar bleibt, und headless testbar (Hausregel
D54-Nachtrag 3). `depEdges()` in app.js löst dann nur noch auf: Die
Sub-IDs stehen in DFS- und damit Dokumentreihenfolge, „erste Vergabe
gewinnt" (D36) gilt so auch über die Faltgrenze hinweg. Der Grafikexport
nutzt dasselbe `depEdges()` und folgt ohne Zusatzcode.

**2. Ein Umschalter für die Querverbindungen**, neben dem
Günstigster-Pfad-Knopf (Nutzer-Vorgabe): Voreinstellung an, persistiert in
`werkbaum-ui` wie die Nachbarn (D22). Export und Druck folgen ihm wie den
übrigen Ansichts-Filtern (die D38/D44/D56-Linie: das Bild zeigt, was
sichtbar ist). Der Klick zeichnet nur die Overlays neu statt zu rendern —
am Baum ändert sich nichts.

**3. Der Falt-Knopf wird ein Durchschalter mit vier Voreinstellungen**
(Nutzer-Vorgabe, Reihenfolge wie gewünscht): **(1)** ab Größe M abwärts zu
(die D44-Regel, unverändert), **(2)** alles zu, durch dessen Teilbaum der
günstigste Pfad nicht läuft — weder der Knoten selbst noch ein Unterknoten
liegt darauf; sichtbar bleibt genau der Pfad, alles Übrige steht als je ein
eingeklappter Knoten da —, **(3)** alles zu, **(4)** alles offen, dann
wieder von vorn. Jede Stufe beschreibt einen **vollständigen** Faltzustand
(die D44-Eigenschaft bleibt: zweimal Drücken derselben Stufe ergäbe
dasselbe), geschrieben wird über denselben Weg wie bisher — ein
Undo-Schritt je Stufe, beim Pad trägt die Sitzungs-Überlagerung.

- **Der Knopf zeigt den NÄCHSTEN Schritt** (Icon per `data-next`, Tooltip
  aus vier neuen i18n-Schlüsseln × 9 Sprachen; `foldSmallTooltip` entfällt).
  Das ist die D17-Logik des Bereichs-Umschalters: Ein Knopf, der den
  Zustand zeigt, den man vor sich hat, sagt nichts — einer, der das Ziel
  zeigt, sagt, was passiert. Mit vier Stufen ist er zudem kein Umschalter
  mehr, `aria-pressed` entfällt.
- **Die Reihum-Position wird nicht gemerkt, sondern geprüft** — die
  D44-Fortschreibung für vier Stufen: `render()` rechnet nach, ob der Baum
  noch die zuletzt hergestellte Stufe beschreibt (`presetFoldSet` in
  model.js, headless getestet); wenn nicht — Handfaltung, Textänderung,
  Dokumentwechsel —, beginnt der nächste Druck wieder bei 1. Ein reines
  Ablesen ohne Position (D44) trägt bei vier Stufen nicht mehr: Ein voll
  offener Baum kann zugleich Stufe 4 und einer leeren Stufe 1 entsprechen —
  die Mehrdeutigkeit ist den Stufen inhärent, die geprüfte Position löst
  sie deterministisch.
- **Stufe 2 rechnet den Pfad auch bei ausgeschaltetem Pfad-Umschalter** —
  die Voreinstellung fragt nach dem Pfad, nicht nach seiner Anzeige; die
  Rechnung ist dieselbe, die bei eingeschaltetem Pfad ohnehin je Tastendruck
  läuft (D42).

**Preis in der Kopfzeile, benannt:** Der Querverbindungs-Knopf ist das elfte
Element. Auf dem Telefon (375 px) bricht die Zeile damit regulär in zwei
Reihen à 78 px — genau der Umbruch, den D50/D56 unterhalb von 440 px
vorsehen; am Schreibtisch bleibt sie einreihig (gemessen 44 px bei 800 px).

**Nachgemessen** im Browser an einem Wegwerf-Dokument (10 Knoten, 3 Kanten,
über die echte UI angelegt und gelöscht): Mittel eingeklappt → Kante endet
am Vertreter (`data-sub-deps="z1"`), Ziel-Seite ebenso; beide Quellen unter
einem Vorfahren eingeklappt → **eine** Kante statt zwei (3 → 2); Wurzel zu →
0 Kanten. Durchschalter: small → path → closed → open → wieder small, je mit
korrekter Faltmenge und Tooltip; Handfaltung danach setzt auf small zurück;
`path` faltet bei ausgeschaltetem Pfad-Umschalter identisch; Undo nimmt eine
Stufe in einem Zug zurück (4 Marken → 1 → 4). Umschalter: aus → 0 Overlays
und 0 Kanten im exportierten SVG, an → 3/3; `depLinks` überlebt den Reload.
480 → 487 Tests, davon 7 neue in `tests/fold.test.js` (presetFoldSet-Modi
inkl. des per `:#…` gezogenen Ziels unter einer Zugabe; `data-sub-*` in
Dokumentreihenfolge, dedupliziert, nie an offenen Knoten, nie für
ausgeblendete verworfene).

## D76 — Live-Editing über HTTP: die offenen Punkte der beiden Konzepte entschieden
Zu `backend/docs/live-editing-proposal.md` und
`backend/docs/client-live-editing-instructions.md` (beide Entwurf, nichts
implementiert). Die Konzepte sind in ihrem Kern schlüssig — zeilenbasierte
Diffs gegen eine Basisversion, Optimistic Locking auf Dokumentebene, Long
Polling statt WebSocket. Offen waren die Ränder: Löschen und
Wiederherstellen, Wiederholungen nach Netzwerkfehlern, das Verhältnis zum
tatsächlichen Frontend — und die Frage, was im Werkbaum-Editor überhaupt
eine Textänderung ist. Die Antworten, jeweils mit dem Grund:

**Faltung wird geteilt.** Nach D38-Nachtrag 2 schreibt jedes Klappen eine
Faltmarke in den Text zurück; unter Live-Editing wird daraus ein PATCH, der
bei allen ankommt. Erwogen war, sie bei geteilten Dokumenten wie bei Pads
(D31) nur sitzungsweise zu überlagern. Entschieden ist das Gegenteil: Der
Text bleibt die eine Quelle der Wahrheit (D14), und „was du siehst, steht
geschrieben" gilt uneingeschränkt. Auch der Falt-Durchschalter (D75)
bekommt **keine** Sonderbehandlung, obwohl ein Druck den ganzen Baum
umbaut. Sollte sich das im Betrieb als störend erweisen, ist die ehrliche
Antwort, Faltung insgesamt persönlich zu machen — nicht eine Ausnahme für
einen einzelnen Knopf.

**Zugriff über die unerratbare UUID, wie ein Pad-Link.** Kein Login, kein
Rechtemodell; das Protokoll bleibt davon unberührt, echte Authentifizierung
kann später als Schicht davor. Das kollidierte mit dem vorhandenen
`GET /documents`, das sämtliche Dokumente samt Inhalt auflistet und damit
jede UUID auffindbar macht — der Schutz wäre hinfällig gewesen. Dieser
Endpunkt verlangt deshalb ein **Master-Passwort**, dessen Hash serverseitig
in einer Umgebungsvariable liegt; geprüft wird mit **Spring Security**
(erste Abhängigkeit dieser Art, bewusst: sie ist zugleich der Platz für die
spätere richtige Authentifizierung). Ein einzelnes Passwort auf einem
offenen Endpunkt braucht eine Sperre nach Fehlversuchen, und die
Übertragung setzt HTTPS voraus.

**Identität pseudonym: Client-ID plus selbstgewählter Anzeigename** — das
Etherpad-Modell (D31). Ohne Anmeldung ist der Name nur eine Behauptung und
darf nicht wie ein Nachweis aussehen; er trägt aber vier Dinge zugleich:
Wiedererkennung beim Retry, „geändert von" in der Historie, eine
deterministische Reihenfolge bei gleichzeitigen Einfügungen und spätere
Präsenz.

**Der Feed arbeitet auf der Historie, nicht am Dokument.** `delete()`
entfernt das Dokument und lässt nur den Tombstone stehen — ein Feed am
Dokument müsste danach 404 liefern, ausgerechnet für das DELETED-Ereignis,
das er zustellen soll. Solange es Historieneinträge zur UUID gibt,
antwortet der Feed also; 404 nur bei gänzlich unbekannter UUID, dieselbe
Regel wie `history()` sie schon anwendet. Wartende Long-Polls müssen beim
Löschen zugestellt bekommen, bevor die Warteliste verworfen wird.

**Die Historie bekommt zwei Ebenen.** Mit 1,5 s Debounce wird sie sonst zum
Transaktionslog: hunderte Volltext-Snapshots eines 40-kB-Dokuments je
Sitzung. Getrennt werden kurzlebige **Sync-Versionen** (tragen das
Protokoll) und nutzersichtbare **Meilensteine**. Letztere entstehen nach
einer Schreibpause und auf Knopfdruck — dasselbe Muster wie die „Früheren
Stände" im Editor (D54), erprobt und den Nutzern vertraut. Bei
Server-Dokumenten zeigt der Verlaufs-Knopf künftig die **Server**-Meilensteine
statt der lokalen Stände: gleiche Bedienung, bessere Quelle (geteilt,
überlebt Geräte- und Browserwechsel). Lokale Stände wären dort sogar
irreführend, weil „mein Stand von vorhin" fremde Änderungen enthält, die man
nie gesehen hat.

**Nachzügler bekommen den Volltext.** Ist `since` bereits verdichtet, kann
der Server kein exaktes Diff mehr liefern. Statt eines eigenen Fehlerpfads
enthält die Feed-Antwort dann den kompletten Inhalt samt Version — ein
Roundtrip und ein Zustand weniger im Client, und der Cursor-Erhalt ist über
hunderte Versionen hinweg ohnehin nicht zu retten. Deckt zugleich den
PWA-Fall nach längerer Offline-Zeit ab.

**Der Server rebased selbst; 409 nur bei echter Überlappung.** Das Proposal
lehnte jeden veralteten PATCH ab. Das führt zu **Starvation**: Ein Client
mit höherer Latenz kommt bei fleißigen Mitschreibern womöglich nie durch,
weil jeder Versuch beim Eintreffen wieder veraltet ist — genau deswegen hat
CodeMirror sein `rebaseUpdates` nachgerüstet. Überschneiden sich die Ops
nicht mit den zwischenzeitlichen, verschiebt der Server sie also selbst und
antwortet mit 200; die Antwort liefert die fremden Ops mit, damit der Client
seine Schattenkopie nachzieht. Nebengewinn: Der aufwendigste Teil der
Client-Instruktion (§4, Rebase) wird nur noch für echte Konflikte gebraucht.

**Wiederholte Patches werden erkannt.** Geht die Antwort verloren — im
Mobilnetz der Normalfall —, weiß der Client nicht, ob seine Änderung ankam;
ein Retry würde sie über den Rebase ein zweites Mal anwenden. Der PATCH
trägt deshalb Client-ID und eine **laufende Nummer**, und der Server
beantwortet eine Wiederholung mit dem Ergebnis von damals.

**Einfügungen kollidieren untereinander nicht, mit Löschungen schon.** Die
Client-Instruktion definierte den Bereich einer Op halboffen als
`[index, index+count)`, für insert aber `[index, index]` — das ist die leere
Menge und schneidet nichts, Einfüge-Konflikte wären nie erkannt worden. Zwei
Einfügungen an derselben Stelle sind kein Konflikt: Beide Zeilen bleiben, die
bereits bestätigte fremde steht oben. Eine Einfügung in einen Bereich, den
ein anderer löscht, ist einer.

**Rollback bekommt einen eigenen Änderungstyp.** `restore()` tut zweierlei —
ein gelöschtes Dokument wiederherstellen und ein lebendes auf eine alte
Version zurücksetzen —, beides bisher als `RESTORED`. Der Client soll bei
`RESTORED` die Sperre aufheben; beim Rollback gab es nie eine Sperre, dort
ändert sich nur der Inhalt. Ein Typ, der zwei Dinge bedeutet, ist die
Unschärfe, aus der später Fehler werden.

**Der Titel läuft mit.** Er ist ein Metadatum, kein Zeileninhalt, und bekommt
einen eigenen Weg mit Versionsprüfung; das Feed-Ereignis führt den neuen
Titel im Klartext mit. Bisher hätte ein Umbenennen eine Version erzeugt, von
der niemand etwas erfährt.

**Prüfsumme als Pflichtfeld.** Das Proposal sah sie optional vor, die
Client-Instruktion kannte sie gar nicht. Optional ist die schlechteste
Variante — die Kosten der Spezifikation ohne den Nutzen. Die Versionsnummer
bestätigt nur, dass die Basis dieselbe Version ist, nicht dass beide Seiten
sie gleich lesen; ein Index-Versatz zerstört Text sonst unbemerkt, und dieses
Projekt zieht durchweg den lauten Fehler dem stillen vor (D59, SPEC §4).
Damit beide dasselbe hashen, normalisiert der **Server** Zeilenenden beim
Speichern autoritativ auf LF (SPEC §12), der Client beim Laden ebenfalls.

**Der Client bleibt bei der Textarea.** Die Instruktion nennt CodeMirror 6
oder Monaco als bevorzugten Weg und die Textarea als Fallback — bei Werkbaum
ist sie der einzige Fall (D49), und `dependencies` ist leer. Gemessen kostet
CodeMirror **120 kB gzip** für den Einstieg (Editor, Zeilennummern, Undo),
voll ausgestattet 138 kB, gegen aktuell 294 kB Bundle. Bemerkenswert: Der
Einstieg ist teuer, alles Weitere danach fast umsonst — Syntax-Hervorhebung
und Autovervollständigung kosten zusammen 18 kB. Es gäbe echte Gewinne (die
`execCommand`-Altlast aus D53/D55 verschwände, Zeilennummern und
Autovervollständigung wären eingebaut, der Spiegel-Div entfiele), aber der
Umbau berührt ein Dutzend Entscheidungen und darf nicht die Nebenwirkung
eines anderen Features sein. CodeMirror bleibt eine **eigene Frage**.
`@codemirror/collab` hilft dabei ohnehin nicht: Es arbeitet mit
CodeMirror-ChangeSets und rebased **serverseitig**, setzt also JavaScript auf
dem Server voraus.

**Die Diff-Berechnung wird selbst implementiert**, nicht per jsdiff — rund
hundert Zeilen über die längste gemeinsame Teilfolge, in derselben
Größenordnung wie der Zeilenumbruch aus D64. Dieselbe Grenze wie bei
CodeMirror: keine Laufzeit-Abhängigkeit (D11/D19/D20).

**Adressiert wird über einen URL-Parameter**, wie `?sourceUrl=` (D23) und
`?etherpad=` (D31): Die Identität leitet sich aus der URL ab, derselbe Link
führt immer in dasselbe Dokument, der Name ist die URL. Angelegt wird über
einen Menüeintrag „Auf den Server legen", analog zu „Als Datei speichern"
(D72). Kein neues Bedienkonzept, und ein geteiltes Dokument wird ohnehin per
Link geteilt.

**Debounce bleibt bei 1,5 s.** Die Rate-Limit-Disziplin des Proposals stammt
von Etherpad — einem fremden Server mit 10 Abrufen je 90 s (D31). Am eigenen
Backend gelten die eigenen Grenzen, und die Last ist gering: ein Request alle
1,5 s ausschließlich während aktiven Tippens. Kleine Diffs und seltene
Überschneidungen sind das wert.

**Im Konfliktfall zwei klar benannte Knöpfe** — fremde Fassung übernehmen
oder eigene durchsetzen, jeweils nur für die überlappenden Zeilen; alles
übrige wird ohnehin rebased. Einer gewinnt dort vollständig, aber nichts geht
endgültig verloren: Jede Version steht in der Historie.

**Der Betrieb wird gemessen, bevor er festgeschrieben wird.** Long Polling
hält je Beobachter eine Verbindung offen; hinter dem Apache der stabilen
Instanz (D43) sind `ProxyTimeout`, Pufferung und das Worker-Modell offene
Fragen, ebenso das Browser-Limit von sechs Verbindungen je Herkunft bei
mehreren Tabs. Der `wait`-Wert von 25 s steht erst fest, wenn die
Zielumgebung vermessen ist — die Lehre aus D17-Nachtrag 4: Was die Umgebung
stellt, stellt der Emulator nicht.

**Ohne eigene Entscheidung festgehalten**, weil alternativlos: Gepufferte
Feed-Antworten werden nur angewendet, wenn ihr `fromVersion` zur aktuellen
Schattenkopie passt — sonst wendet ein Client dieselben Ops doppelt an, wenn
Feed und 409-Antwort sie beide liefern. Der In-Process-Notifier setzt eine
**Einzelinstanz** voraus. Der Feed braucht `Cache-Control: no-store` und eine
serverseitige Obergrenze für `wait`. PATCH braucht ein Größenlimit für
Dokument und Op-Anzahl. `DocumentHistoryRepository` braucht gezielten Zugriff
auf eine einzelne Version, statt wie heute stets alle Einträge zu laden. Und
die im Proposal zitierte „Speicher-Evaluation" existiert im Repo nicht — sie
gehört nachgeliefert oder der Verweis aufgelöst.

**Nachtrag — die Zielumgebung ist vermessen (2026-08-26).** Gemessen auf
`mih00.hostsharing.net`: Apache 2.4.68 mit **MPM event** und
MaxRequestWorkers **1024**, `Timeout 300` und kein gesetztes `ProxyTimeout`,
mod_proxy_http und mod_rewrite geladen, systemd-`Linger=yes` (ein eigener
Dienst darf also dauerhaft laufen), PostgreSQL auf 5432 vorhanden.
**Long Polling trägt dort**: Die Zeitgrenzen sind großzügig, zehn offene
Verbindungen sind bei 1024 Workern unkritisch, und die Sorge vor einem
Prozess je Verbindung war unbegründet — sie gilt mpm_prefork, hier läuft
event. Auch Pufferung ist kein Thema: Anders als bei SSE kommt genau eine
Antwort am Ende des Wartens.

Drei Befunde bleiben als Arbeit stehen. **Kein HTTP/2** — damit gilt das
Browser-Limit von sechs Verbindungen je Herkunft, und mehrere Tabs derselben
Person binden je eine dauerhaft. **Entschieden: Der Feed läuft nur im
sichtbaren Tab** — bei `visibilitychange` schließen, beim Zurückkommen einmal
mit dem eigenen `since` nachholen. Ein Hintergrund-Tab braucht keinen
Live-Feed, niemand schaut hin, und ein einziger Request holt den Rückstand;
das spart nebenbei Server-Worker und Akku. Erwogen und verworfen war ein
**SharedWorker**, der allen Tabs eine gemeinsame Verbindung gibt — technisch
sauberer und auch für Hintergrund-Tabs aktuell, aber eine eigene Baustelle
mit Nachrichtenprotokoll, Lebenszyklus und Rückfallpfad, für ein Problem, das
die einfache Lösung praktisch ganz beseitigt.
**Nur Java 17** installiert, während `build.gradle.kts`
`JavaLanguageVersion.of(21)` verlangt. Und der **Weg vom Apache zum Backend
ist ungeklärt**: `ProxyPass` ist in `.htaccess` nicht zulässig,
`~/doms/<domain>/etc/` ist leer; bliebe `RewriteRule … [P]` oder eine
Rückfrage beim Hoster. Dieser letzte Punkt ist bewusst **nicht** getestet —
dafür hätte eine Proxy-Regel in der Produktionsumgebung eingerichtet werden
müssen. Details in `backend/docs/live-editing-proposal.md`, Abschnitt
„Betrieb".

**Nachtrag 2 — der Proxy-Weg ist gemessen, und das JDK ist entschieden
(2026-08-26).** Der in Nachtrag 1 als ungetestet markierte Punkt ist
nachgeholt: **`RewriteRule … [P]` ist in der `.htaccess` erlaubt** — manche
Hoster sperren das P-Flag, dieser nicht. Gemessen mit einer temporären Regel
auf einen lokalen Testprozess (danach vollständig zurückgebaut, `.htaccess`
aus der Sicherung wiederhergestellt, Prozess und Skript entfernt, Site
verifiziert): sofortige Antwort HTTP 200 nach 0,13 s, **absichtlich um 30 s
verzögerte Antwort HTTP 200 nach 30,1 s**. Apache hält die Verbindung also
durch und puffert nichts weg — Long Polling mit `wait=25` ist auf dieser
Umgebung nicht nur rechnerisch, sondern gemessen tragfähig. Die Regel gehört
nach `scripts/prod.htaccess`, weil `deploy-prod.sh` die Datei mit
`rsync --delete` spiegelt.

**JDK: ein eigenes 21 ins Home**, statt die Toolchain auf die installierte 17
zu senken — Entwicklung und Produktion laufen dann auf derselben Version, und
`Linger=yes` erlaubt den dauerhaften Dienst ohne Root. Erwogen und
**vorgemerkt statt verworfen** war ein natives Binary via GraalVM: Es löste
das Problem vollständig (kein Java auf dem Server) und spart den Großteil des
Speichers — der geteilte Host ist eng (berichtigte Zahlen in Nachtrag 3).
Dagegen stehen derzeit drei Dinge: die glibc-Differenz
zwischen Ubuntu 24.04 (2.39) und Debian 12 (2.36), die einen Container-Build
erzwingt; Liquibase braucht Metadaten aus einem Native-Agent-Lauf und
Hibernate das Enhancement-Plugin; und ein offener Fehler in Spring Boot 4
zerlegt Native-Image-Builds mit genau der Kombination JPA + Liquibase.
**Kotlin/Native scheidet grundsätzlich aus** — Spring, Hibernate, Liquibase
und JDBC sind JVM-Bibliotheken; das wäre kein Umbau, sondern ein Neubau auf
einem anderen Stack. Unabhängig davon: Beim Deployment gehört ein `-Xmx`
gesetzt, statt der JVM auf einem geteilten Server die Voreinstellung zu
überlassen.

**Nachtrag 3 — die Speicherzahlen berichtigt, und die Zuordnung geht doch
(2026-08-26).** Nachtrag 2 nennt „nur **832 MB frei** bei 3,9 GB gesamt“ als
Argument für das native Image. Die Zahl war ein Schnappschuss und dazu
mehrdeutig: `free` und `available` sind verschiedene Dinge. Nachgemessen
schwankt es zwischen **326–358 MB `free`** und **978–1004 MB `available`**
von 3915 MB; dazu 4 GB Swap, davon rund **1 GB belegt**.

**Die Annahme, ein Managed Webspace könne den Verbrauch nicht zuordnen, war
falsch.** `/proc` trägt zwar `hidepid=invisible`, aber es gibt zwei Wege
daran vorbei: das **systemd-cgroup-Accounting** (`systemctl status
pacs-<paket>.slice` — so nennt es auch das Hostsharing-Wiki, „RAM Belegung“)
und die **world-readable atop-Aufzeichnungen** unter `/var/log/atop/`, die
als root geschrieben werden und vier Wochen Historie im 10-Minuten-Takt
enthalten.

**Es sind nicht die Datenbanken.** Gemessen je Dienst: `clamav-daemon`
**988 MB**, `apache2` 580 MB, `systemd-journald` 310 MB, `spamd` 224 MB,
`dovecot` 173 MB, `mariadb` **150 MB**, `postgresql@15-main` **111 MB**.
Beide Datenbanken zusammen sind gut 8 % dessen, was im `system.slice` steht;
der Virenscanner allein ist das Vierfache (atop, prozessgenau: `clamd`
RSIZE 969,5 MB = 25 % des Maschinenspeichers). **Alle Webspaces zusammen
belegen 100 MB**, unserer davon 30 MB.

Die Datenbanken sind trotzdem beteiligt — als Verlierer: `mariadbd` hat laut
atop **602 MB im Swap**, also den größten Teil des belegten Gigabytes.
Provisioniert sind sie üppig (`shared_buffers` 979 MB, `innodb_buffer_pool_size`
979 MB, `key_buffer_size` 489 MB — 979 MB sind exakt 25 % von 3915 MB, eine
automatische Sizing-Regel, zweimal angewandt), residieren aber nur zu einem
Zehntel davon. `Committed_AS` 12,0 GB gegen `CommitLimit` 5,9 GB: Der Host
ist chronisch überbucht. **Das ist das schärfere GraalVM-Argument** als die
Momentaufnahme aus Nachtrag 2 — nicht „gerade wenig frei“, sondern „hier
gewinnt beim nächsten Engpass, wer zuerst da war“.

**Das Budget fürs Deployment steht in `/etc/systemd/system/pacs-mih00.slice`:
`MemoryMax=3147M`.** Das ist eine **Erlaubnis, keine Reservierung** — frei
sind rund 300 MB. Ein `-Xmx` gehört also gegen das Freie bemessen, nicht
gegen die Grenze; und die JVM-Voreinstellung (¼ des physischen RAM ≈ 980 MB)
ist genau die Größenordnung, die MariaDBs Puffer in den Swap gedrängt hat.

**Nachtrag zu D13 — Paketwurzel `de.werkbaum`, und drei Fallen von Spring
Boot 4 (2026-08-26).** Das Backend-Gerüst kam zunächst unter der
Platzhalter-Wurzel `com.example.editor` herein und widersprach damit
`backend/CLAUDE.md`. Umgezogen nach **`de.werkbaum`** (17 Kotlin-Dateien,
Gradle-`group`, `apiPackage`/`modelPackage` der OpenAPI-Generierung, die
jacoco-Ausschlüsse und das Cucumber-`glue`-Paket) — jetzt war es billig, mit
jeder Woche Entwicklung wäre es teurer geworden. Nachgemessen: 22 Tests grün,
`check` inklusive Coverage-Verifikation besteht, 91,7 % Zeilenabdeckung,
generierter Code weiterhin ausgeschlossen.

Dabei sind drei Eigenheiten von **Spring Boot 4** aufgefallen, die jeweils
denselben Ursprung haben — die Modularisierung, bei der vieles aus dem
Kern-Artefakt in eigene Module gewandert ist:

1. **`TestRestTemplate` ist umgezogen** von `org.springframework.boot.test.web.client`
   nach `org.springframework.boot.resttestclient` und liegt im Modul
   `spring-boot-resttestclient`, das `spring-boot-starter-test` **nicht**
   mitbringt.
2. **`@SpringBootTest` stellt die Test-Client-Bean nicht mehr von selbst
   bereit** — es braucht `@AutoConfigureTestRestTemplate` bzw.
   `@AutoConfigureRestTestClient`.
3. **Liquibase braucht seinen Starter.** Das nackte `org.liquibase:liquibase-core`
   bringt die Autokonfiguration nicht mehr mit; ohne
   `spring-boot-starter-liquibase` läuft keine Migration, und die Tests
   scheitern erst spät mit „Schema validation: missing table".

Die Zusicherungen sind auf **Kotest** umgestellt (`shouldBe`,
`shouldContain`, `shouldThrow`) — `backend/CLAUDE.md` hatte das vorgesehen,
der Code benutzte aber JUnit-Assertions. Bei 25 Aufrufen war es billig, und
Test-Abhängigkeiten sind unkritisch, weil sie in keinem Artefakt landen.
Gegenprobe per Mutation: eine falsche Erwartung im Service-Test und eine im
BDD-Schritt lassen genau die danach benannten Tests fallen — die
Zusicherungen greifen also, statt nur gut auszusehen.

Die BDD-Tests nutzen jetzt **`RestTestClient`** (aus `spring-test`) statt
`TestRestTemplate`, das in Boot 4 als Auslaufmodell gilt. Umgestellt bei
fünfzehn Aufrufen in einer Datei — die Zahl wächst von hier an nur. Weil
Cucumber Senden (Wenn) und Prüfen (Dann) trennt, wird die fluent API nicht
für Zusicherungen genutzt, sondern über `returnResult` das Ergebnis
festgehalten.

**Nachtrag 4 — beim Bauen entschieden (2026-08-26).** Die Schritte 1–3 der
Umsetzungsreihenfolge stehen (Zeilen-Diff, zweistufige Historie,
`PATCH /content`). Sechs Dinge waren dabei zu entscheiden, die das Konzept
offengelassen hat:

**Eine Einfügung liegt ZWISCHEN den Zeilen.** Das Konzept nennt sie einen
„Punkt bei `index`" und lässt die Ränder offen. Umgesetzt ist die strikte
Lesart `start < index < end`: Die Einfügung kollidiert nur mit dem **Inneren**
eines fremden Bereichs. Beide im Konzept genannten Folgen gelten damit weiter —
zwei Einfügungen an derselben Stelle vertragen sich, eine Einfügung in einen
gelöschten Bereich nicht —, aber die Ränder bleiben konfliktfrei. Das ist der
häufige Fall: Wer eine Zeile über einer gerade geänderten einfügt, meint
eindeutig „davor" und soll keinen 409 bekommen. Die halboffene Variante
(`start <= index < end`) hätte genau diesen Alltagsfall zum Konflikt erklärt,
ohne dass ihm eine Mehrdeutigkeit zugrunde läge.

**Meilensteine entstehen rückwirkend, ohne Zeitgeber.** „Nach einer
Schreibpause" klingt nach einem Timer; gebaut ist die Umkehrung: Die **nächste**
Änderung stellt fest, dass eine Pause war, und befördert die Version davor. Das
braucht keinen Hintergrund-Thread, ist mit fester Uhr prüfbar und trifft
genau den gemeinten Stand — die letzte vor der Pause, nicht die erste danach.
Die Lücke am Ende (nach der letzten Änderung kommt keine mehr) schließt die
Historie-Abfrage, indem sie den jüngsten Stand immer mitliefert.

**Restore liest den Tombstone.** Bisher übersprang die Wiederherstellung den
`DELETED`-Eintrag und nahm den letzten inhaltlichen davor. Inhaltlich sind
beide gleich — aber der davor ist womöglich eine Sync-Version und damit
verdichtet, der Tombstone dagegen ein Meilenstein und bleibt. Verhalten
unverändert, Verlässlichkeit gewonnen.

**Die Sperre liegt außerhalb der Transaktion.** „Locking pro Dokument-UUID"
und `@Transactional` an derselben Methode wäre falsch: Der Proxy gibt die
Sperre vor dem Commit frei, und der nächste Schreiber läse einen Stand, der
noch nicht steht. Deshalb ist `LiveEditingService` **nicht** transaktional und
schreibt über die transaktionalen Methoden des `DocumentService`. Die Sperren
sind ein festes Feld von 64 (Striping über die UUID): Zwei Dokumente können
sich eine teilen — das kostet Zeit, nie Richtigkeit —, und die Menge wächst
nie. Eine Sperre je Dokument müsste beim Löschen aufgeräumt werden und wäre
sonst ein langsames Leck.

**Die Idempotenz lebt im Speicher, gedeckelt.** Je (Dokument, Client) die
zuletzt verarbeitete `seq` samt Ergebnis, verdrängt wird das am längsten nicht
benutzte. Persistenz wäre eine weitere Tabelle für ein Fenster von Sekunden;
die Einzelinstanz ist ohnehin vorausgesetzt (Long Polling). Eine **kleinere**
`seq` als die zuletzt verarbeitete ist ein eigener Fehler (422): Das Ergebnis
von damals ist nicht mehr bekannt, und ein zweites Anwenden verdürbe den Text.

**400 gegen 422, sauber getrennt.** 422 heißt „richtig gebaut, aber nicht
anwendbar" — Prüfsumme, Index, verdichtete Basis, veraltete `seq`; der Client
lädt einmal neu und es geht weiter. 400 heißt „so nicht gefragt" —
Grenzüberschreitung oder ein `delete`/`replace` **ohne `count`**. Letzteres
wird bewusst **nicht** als 0 gelesen: Die Operation täte dann stillschweigend
nichts bzw. würde zur Einfügung, und ein stiller Fehler ist in diesem Projekt
durchweg der schlechtere (SPEC §4, D59).

Zahlen: 104 Tests. Gegenproben je Regel — Prüfsumme nicht geprüft, Idempotenz
entfernt, veraltete Basis abgelehnt statt verschoben, Schreibpause ignoriert,
Rückfall wieder als `RESTORED`, jüngster Stand aus der Historie genommen: Es
fallen jeweils genau die danach benannten Zusicherungen.

**Nachtrag 5 — Long Polling blockiert, aber auf einem virtuellen Thread
(2026-08-26).** Der Haupttext sah `DeferredResult` vor, damit ein Wartender
keinen Server-Thread bindet. Beim Bauen stellte sich das als teurer heraus,
als es klingt: Der Endpunkt steht in der OpenAPI-Spezifikation, und der
Generator erzeugt daraus eine **synchrone** Signatur
(`ResponseEntity<ChangeFeed>`). Ein `DeferredResult` verlangt eine andere —
also entweder die Operation aus der Generierung herausnehmen (dann prüft
niemand mehr, ob Vertrag und Code zusammenpassen; genau die Zusage, für die
API-First in diesem Projekt gebaut ist) oder den Generator umstellen (WebFlux
für alles).

**Gewählt: blockieren, und `spring.threads.virtual.enabled=true`.** Auf JDK 21
kostet ein wartender virtueller Thread praktisch nichts — kein Stack von einem
Megabyte, keine Poolgrenze. Das Argument gegen das Blockieren war der
Speicher, und der ist auf der Zielumgebung tatsächlich die knappe Größe
(D76-Nachtrag 3); genau dort löst der virtuelle Thread es auf, statt es zu
verschieben. Der Endpunkt behält die generierte Signatur, und für ihn gilt
dieselbe Regel wie für alle anderen: Weicht die Implementierung vom Vertrag
ab, bricht der Compile.

**Zwei Dinge, die daran hängen und leicht zu übersehen sind.** Erstens darf
das Warten nicht mit `synchronized`/`wait()` gebaut sein — ein Monitor nagelt
den virtuellen Thread an seinen Träger (JDK 21). Der `ChangeNotifier` benutzt
deshalb `ReentrantLock`/`Condition`. Zweitens darf **während** des Wartens
keine Transaktion und keine Datenbankverbindung offen sein; der
`LiveEditingService` ist ohnehin nicht transaktional und liest über je eigene
Aufrufe.

**Geweckt wird nach dem Commit, nicht davor** (`afterCommit` der
Transaktions-Synchronisation). Davor geweckt läse ein Beobachter einen Stand,
der noch nicht steht — und bekäme das Ereignis nie wieder, denn er zieht
danach mit der neuen Version weiter.

**Der Stempel statt der Versionsnummer.** Der Aufrufer liest den Stempel des
Dokuments, **bevor** er in der Datenbank nachsieht. Ändert sich etwas in der
Lücke dazwischen, kehrt das Warten sofort zurück. Ohne diesen Griff ginge das
Signal verloren und der Client bekäme seine Änderung erst nach Ablauf der
vollen Wartezeit — ein Fehler, der im Test nur auffällt, wenn man die **Dauer**
misst. Das Cucumber-Szenario tut das (< 4 s bei 5 s Wartezeit); gegengeprüft
durch Entfernen der Benachrichtigung, dann fällt genau dieses Szenario.

**`RENAMED` ist noch nicht vergeben.** Der Feed kennt `CREATED`, `UPDATED`,
`DELETED`, `RESTORED` und `ROLLED_BACK`. Das Umbenennen bekommt seinen eigenen
Weg (`PATCH /title` mit `expectedVersion`) und erst damit den Typ — ihn vorher
zu deklarieren wäre eine Zusage ohne Deckung.

**Nachtrag 6 — das Master-Passwort: gesperrt als Voreinstellung, global
gesperrt nach Fehlversuchen (2026-08-26).** Drei Festlegungen beim Bauen von
Schritt 5:

**Ohne konfigurierten Hash ist die Liste versperrt, nicht offen.** Die
naheliegende Bequemlichkeit — „solange nichts konfiguriert ist, lassen wir
durch" — kehrt die Beweislast um: Ein vergessener Umgebungswert gäbe jede
Dokument-UUID preis, und niemandem fiele es auf, weil alles funktioniert.
Umgekehrt fällt es sofort auf, und das Log sagt beim Start, was fehlt.
Umgesetzt ausdrücklich mit `denyAll`, nicht bloß über ein zufälliges Passwort,
das niemand kennt: Was gesperrt sein soll, soll auch gesperrt dastehen —
nachlesbar und **prüfbar**. Der Unterschied ist nicht theoretisch: Die erste
Fassung setzte nur das Zufallspasswort, und die Gegenprobe (den Schutz
mutieren, prüfen ob Tests fallen) blieb stumm. Erst mit `denyAll` fällt genau
die danach benannte Zusicherung.

**Die Sperre nach Fehlversuchen ist global, nicht je Adresse.** Es gibt genau
ein Passwort; eine globale Sperre ist damit die passende Aussage und nicht zu
umgehen, indem jemand die Adresse wechselt. Sie hängt außerdem nicht an
`X-Forwarded-For` — hinter dem Reverse Proxy der Zielumgebung (Nachtrag 1)
sähe der Server für alle dieselbe 127.0.0.1, und eine „adressbezogene" Sperre
wäre unfreiwillig doch global, nur schlechter begründet. Der Preis ist
benannt: Wer falsch rät, sperrt die Liste für alle, 15 Minuten lang. Die Liste
ist eine Bequemlichkeit für den Betreiber; die Dokumente selbst bleiben über
ihre UUID erreichbar.

**Der Hash trägt sein Verfahren als Präfix** (`{bcrypt}$2a$…`, Spring
Securitys `DelegatingPasswordEncoder`). So steht in der Konfiguration, womit
gehasht wurde, ein Wechsel des Verfahrens bricht nichts — und die Tests dürfen
`{noop}` benutzen, ohne dass dafür eine zweite Code-Bahn nötig wäre.

**Nachtrag beim ersten Einrichten: der Hash wird interaktiv erzeugt, nie mit
dem Passwort auf der Kommandozeile.** Die erste Anleitung schrieb
`htpasswd -bnBC 12 "" PASSWORT` — und lieferte prompt ein 401, obwohl Hash und
Konfiguration nachweislich in Ordnung waren (68 Zeichen, `{bcrypt}`, drei `$`,
im Prozess angekommen). Die Ursache liegt vor dem Hashen: Das Passwort steht
dort ungeschützt in einer Kommandozeile, und die Shell fasst es an —
`ge$heim` wird zu `ge`, `ge heim` zu `geheim`. Gehasht wird dann etwas anderes
als das, was man später eintippt.

Richtig ist `htpasswd -nBC 12 ''` **ohne `-b`**: Es fragt zweimal nach, das
Passwort geht nie durch eine Shell und landet nicht in der History. Der Fehler
ist besonders unangenehm, weil er wie ein Konfigurationsfehler aussieht — alles
Prüfbare stimmt, nur der Vergleich schlägt fehl. Zum Auseinanderhalten gehört
deshalb eine direkte Probe in die Anleitung: `htpasswd -v` gegen den
gespeicherten Hash sagt in einem Schritt, ob Hash und Passwort zueinander
passen, ohne den Dienst zu befragen.

**Die neue Laufzeit-Abhängigkeit** (`spring-boot-starter-security`) ist in D76
ausdrücklich vorgesehen („geprüft über Spring Security") und damit von der
Rückfragepflicht der Wurzel-CLAUDE.md gedeckt. Sie ist zugleich der Platz für
die spätere richtige Authentifizierung.

**Nachtrag 7 — der Client: was der Live-Test gefunden hat (2026-08-26).**
Schritt 6 steht: `?live=<Dokument-URL>` führt ein Server-Dokument, schickt nach
1,5 s Ruhe das Diff und hält einen Feed offen. Die entscheidbare Hälfte liegt
headless in `frontend/src/live.js`, die I/O in `app.js` (Hausregel,
D54-Nachtrag 3). Fünf Festlegungen und zwei Funde:

**Der Name ist der Titel des Servers, nicht die URL.** Das weicht vom
Haupttext ab („der Name ist die URL", wie bei `?sourceUrl=` und `?etherpad=`),
und zwar mit Grund: Anders als eine Datei oder ein Pad **hat** ein
Server-Dokument einen Namen, und alle sehen denselben. Die vollständige
Adresse steht wie dort im Tooltip. Identität und Wiederfinden hängen
unverändert an der URL.

**Konflikte entstehen beim Tippen, nicht erst beim Senden — und das war der
erste Fund.** Der Server sieht nur, was eingereicht wird; den ungesendeten
Text im Editor kennt er nicht. Mit laufendem Feed zieht die Schattenkopie
ständig nach, die eigene Basis ist also nie veraltet — ein 409 käme praktisch
nie zustande, und die fremde Zeile wäre **stillschweigend überschrieben**.
Deshalb prüft der Client beim Einblenden fremder Änderungen selbst, ob sie
sich mit dem gerade Getippten überschneiden, und stellt dann dieselbe Frage.
Ein Zustand, zwei Wege hinein: lokal erkannt oder vom Server gemeldet.

**Die Frage lautet „wessen Fassung", nicht „welche Zeile".** Zwei Knöpfe,
ganzes Dokument: *Fremde übernehmen* setzt den Text auf den Server-Stand,
*Eigene durchsetzen* zieht nur die Schattenkopie nach und schickt den eigenen
Text darauf. Zeilenweises Zusammenführen im Konfliktfall wäre eine eigene
Oberfläche; verloren geht dabei ohnehin nichts — der verworfene Stand liegt in
den früheren Ständen (D54) und jede Version in der Historie des Servers.
Solange die Frage offen ist, ruhen Senden **und** Feed: Sonst zöge der Stand
unter der Frage weg, die gerade gestellt ist.

**Kennung und laufende Nummer liegen im sessionStorage, also je Tab — das war
der zweite Fund.** Erst lag beides im localStorage. Nach einem Neuladen begann
`seq` wieder bei 1, die Kennung blieb — und der Server hielt die erste echte
Änderung für die Wiederholung der letzten von vorhin und tat **nichts**. Im
Live-Test sofort sichtbar, in keinem Unit-Test: Genau die Naht zwischen Modul
und Verdrahtung, vor der D54-Nachtrag 3 warnt. Je Tab ist zugleich die
richtige Aussage: Zwei Tabs sind zwei Schreiber; mit gemeinsamer Nummer
schickte der eine bald eine kleinere `seq` als der andere.

**Fremde Änderungen werden nicht undo-fähig eingespielt.** Ein Strg+Z, das den
Beitrag eines anderen zurücknimmt, wäre eine Lüge über die Herkunft. Die
Schreibmarke wandert dagegen mit (`mapLine`) — ohne das spränge sie bei jeder
fremden Änderung weiter oben im Dokument, und „kein Neuladen" wäre nichts
wert.

**CORS steht auf `*`, und das ist hier keine Nachlässigkeit.** Der Editor läuft
je nach Installation überall (Pages, eigene Domain, Dev-Server); Zugriff regelt
die unerratbare UUID, nicht die Herkunft, und Cookies werden nie mitgesendet
(`credentials: omit`). CORS schützt Anmeldedaten — die es hier nicht gibt. Wer
es enger will, setzt `werkbaum.cors.allowed-origins`.

**Nachgemessen im Browser gegen das laufende Backend**, weil das der einzige
Ort ist, an dem sich das beweisen lässt: Ein Server-Dokument lädt und rendert;
eine fremde Änderung erscheint ohne Neuladen; Getipptes erreicht nach 1,5 s
den Server; zwei Änderungen an derselben Zeile öffnen das Konflikt-Band, und
beide Knöpfe tun, was sie sagen; die Schreibmarke steht nach zwei fremd
eingefügten Zeilen darüber unverändert bei Zeile+2, Spalte 8. **Werkzeuggrenze,
wie in D25 und D17-Nachtrag 4:** Der Automatisierungs-Tab meldet sich dauerhaft
als `document.hidden` — die Sichtbarkeits-Sperre des Feeds (Nachtrag 1) greift
also nachweislich, ließ sich aber nur mit gestellter Sichtbarkeit umgehen, um
alles Übrige zu sehen.

**Offen bleibt** `PATCH /title` (und damit das Ereignis `RENAMED`), ein
Eingabefeld für den Anzeigenamen und die Präsenz-Anzeige.

**Nachtrag 8 — „Auf den Server legen" im Dokumenten-Menü (2026-08-26).** Der
Haupttext sah den Menüeintrag vor („analog zu ‚Als Datei speichern'", D72), er
fehlte aber: Auf den Server kam ein Plan nur per `curl`. Jetzt legt der Knopf
das aktive Dokument an, schaltet dorthin um, schreibt den Link in die
Adresszeile (`history.replaceState`) und in die Zwischenablage. Vier
Festlegungen:

**Die Basis-Adresse ist die eigene Herkunft.** Bei der produktiven
Installation liegt das Backend hinter derselben Domain (`/api/…` per
Proxy-Regel, D77) — wer nichts konfiguriert, bekommt also das Richtige.
Darüber liegen zwei stärkere Quellen: der `?server=`-Parameter (für die
Entwicklung, Editor auf 8137 und Backend auf 8080) und die Adresse des
gerade offenen Server-Dokuments (wer dort sitzt und ein neues anlegt, meint
denselben Server). Trägt nichts davon — auf `file://` gibt es keine
brauchbare Herkunft —, wird gefragt und die Antwort gemerkt. Die Reihenfolge
steht als reine Funktion in `live.js`, der Dialog nicht: Fragen ist keine
entscheidbare Regel.

**Das lokale Dokument bleibt.** Es zu löschen wäre die aufgeräumtere Geste
und die riskantere: Wer sein einziges Exemplar einem Server anvertraut, soll
es nicht im selben Zug verlieren.

**Dafür braucht der Wähler eine Unterscheidung.** Das hochgeladene Dokument
trägt denselben Namen wie das lokale — im Test standen prompt zwei Einträge
„Nur lokal" da, unterscheidbar nur am Tooltip. Server-Dokumente nennen
deshalb ihren **Host** neben dem Namen, zurückgenommen gesetzt; der Name
bleibt die Hauptaussage.

**Und der Knopf verschwindet, wo er nichts mehr zu tun hat.** Bei einem
Dokument, das schon auf einem Server liegt, entstünde sonst ein zweites,
gleichnamiges daneben. Erkannt an der id (`live:…`), nicht am laufenden
Feed: Auch ein Server-Dokument, das gerade nicht das aktive ist, liegt
bereits dort.

**Nachtrag 9 — der Client stritt mit sich selbst: der Feed liefert die eigene
Änderung zurück (2026-08-26).** Gemeldet mit zwei Browsern am selben Dokument:
Einen Knoten zuklappen, und es kommt „Someone changed the same lines. Whose
version should win?" — mit der Vermutung, die Änderung des anderen zähle wieder
als eigene und die beiden spielten Ping-Pong. Die Vermutung war richtig, nur
braucht es den zweiten Browser dafür nicht.

**Der Server schickt jedem die Änderungen ALLER, die eigenen eingeschlossen.**
Das ist keine Nachlässigkeit, sondern die Bauform des Feeds: Er beantwortet
„was ist seit Version N geschehen", und wer da mitgeschrieben hat, steht nicht
in der Frage. Wacht er im Moment des eigenen Sendens auf, kommt die eigene
Änderung also zurück, **bevor die Antwort darauf da ist**. Die Schattenkopie
steht dann noch auf dem Stand davor — der Client hält die eigene Änderung für
fremd, sieht sie sich mit dem eigenen (aus seiner Sicht ungesendeten) Text
überschneiden und stellt die Frage, die für genau diesen Fall gebaut ist
(Nachtrag 7: „der Konflikt entsteht beim Tippen"). Die Erkennung hatte recht;
falsch war nur, wen sie für den anderen hielt.

**Das Falten macht es sichtbar, verursacht es aber nicht.** Umklappen schreibt
eine Faltmarke in den Text (D38-Nachtrag 2), also eine gewöhnliche
Textänderung — die Geste ist nur die kürzeste, die eine ganze Zeile ändert und
dabei keine Sekunde Tippen kostet.

**Nachgemessen statt vermutet, und das war der eigentliche Aufwand.** Auf
localhost liegen die beiden Antworten **7 ms** auseinander, und die PATCH-Antwort
gewinnt — der Fehler tritt dort nie auf. Erst als die PATCH-Antwort im Client um
500 ms verzögert wurde (eine Reihenfolge, die übers Netz jederzeit auftritt),
stand er in der Spur: `PATCH an 200` · `FEED an 200` · `KONFLIKT-BANNER`, drei
Zeilen, fünf Millisekunden. Ohne das Erzwingen hätte die Prüfung „geht doch"
gemeldet.

**Behoben, wo die Regel hingehört: `feedAction` in `live.js`.** Sie entscheidet
ohnehin, ob eine Feed-Antwort angewendet werden darf; jetzt lautet die dritte
Bedingung „nicht, solange ein eigenes Diff unterwegs ist". Verloren geht
dadurch nichts — was zwischen unserer Basis und der neuen Version liegt, steht
in `opsSinceBase` der Antwort, und der nächste Abruf setzt auf der dann
aktuellen Version auf. Dass die Regel im Modul steht, ist der Punkt: Sie hat
eine Zusicherung und eine Gegenprobe (Sperre entfernt ⇒ genau die zwei neuen
Tests fallen, sonst nichts). Genau diese Lehre steht seit D54-Nachtrag 3 im
Haus, und dieser Fehler wäre ihr Beispiel gewesen.

**Die Sperre gehört an ZWEI Stellen, gegen zwei verschiedene Fälle.** In
`feedAction` für die Antwort, die eintrifft, während wir senden — und in der
Feed-Schleife dafür, dass währenddessen gar nicht erst gefragt wird. Ohne die
zweite fragte die Schleife sofort wieder, bekäme sofort dieselbe Antwort,
ließe sie wieder aus und drehte eine enge Runde über das Netz, bis das Senden
durch ist.

**Dabei gefunden: `pushLive()` las seine Basis erst NACH dem Warten.** `const
alt = liveState.shadow` stand hinter dem `await` und nahm damit an, dass sich
dazwischen nichts ändert. Genau die Annahme brach der Feed: Er zog die
Schattenkopie schon nach, und die eigene Änderung wäre ein zweites Mal
daraufgerechnet worden — Textverderb ohne Fehlermeldung, hinter dem Banner
verborgen. Die Basis wird jetzt **vor** dem Warten festgehalten. Die Sperre
oben verhindert den Fall zwar auch, aber eine Rechnung, die nur wegen einer
Sperre anderswo stimmt, schreibt man nicht auf.

**Nachgemessen** im Browser gegen ein lokales Backend, mit erzwungener
Reihenfolge: Falten in A erzeugt **kein** Banner mehr (Feed-Antwort ausgelassen,
danach mit der neuen Version neu aufgesetzt); eine echte fremde Änderung aus B
kommt weiterhin an; und der **echte** Konflikt wird weiterhin erkannt — A hält
ungesendeten Text auf Zeile 1, B ändert dieselbe Zeile, das Banner erscheint,
„Fremde übernehmen" setzt B's Fassung. 525 Tests.
Das Frontend geht seit D16 per rsync auf die stabile Instanz. Das Backend
braucht mehr als Dateien: eine Java-Laufzeit, einen dauerhaft laufenden Dienst
und einen Weg von außen nach innen. Die Zielumgebung ist vermessen
(D76-Nachträge 1–3), hier stehen die Entscheidungen, die daraus folgen.

**Ein eigenes JDK 21 im Home, nicht die installierte 17.** Der Server hat nur
Java 17, `build.gradle.kts` verlangt 21. Die Toolchain zu senken wäre der
kürzere Weg und der schlechtere: Entwicklung und Produktion liefen dann auf
verschiedenen Versionen, und der Unterschied fiele erst im Betrieb auf. Ein
JDK im Home braucht kein root; `scripts/install-jdk.sh` holt es von Adoptium
und **prüft die Prüfsumme aus deren API, bevor es auspackt** — ohne das wäre es
„lade ein Archiv aus dem Netz und führe es aus". Getauscht wird erst, wenn
alles heil ist: Ein abgebrochener Download darf kein halbes JDK hinterlassen,
das der Dienst beim nächsten Start vorfindet.

**Ein systemd-User-Unit, kein nohup.** `Linger=yes` ist auf der Zielumgebung
gesetzt (gemessen), der Dienst überlebt also die Sitzung; Neustart nach einem
Absturz, Logrotation und ein definierter Zustand kommen kostenlos dazu. Zwei
Fallen sind eingebaut, weil beide nur am Ziel auffielen:

- Die Pfade stehen als **`%h/…`**, nicht als `$HOME/…`. In
  `WorkingDirectory` und `EnvironmentFile` expandiert systemd keine
  Shell-Variablen; ein `$HOME` stünde dort wörtlich und der Dienst startete
  nicht — in einer Datei, die man nur auf dem Server zu sehen bekommt.
- Das Skript setzt **`XDG_RUNTIME_DIR`**, bevor es `systemctl --user` ruft.
  Über eine nicht-interaktive SSH-Sitzung ist die Variable oft nicht gesetzt,
  und `systemctl --user` findet seinen Manager dann nicht.

**Ohne Sandbox-Optionen.** `PrivateTmp` und Verwandte brauchen in einem
User-Unit unprivilegierte Benutzer-Namensräume; wo die abgeschaltet sind,
startet der Dienst gar nicht. Auf einem fremden Host ist das kein Risiko, das
sich lohnt — `NoNewPrivileges` ist ein schlichtes prctl und bleibt.

**Der Dienst lauscht nur auf 127.0.0.1.** Von außen kommt man ausschließlich
über den Apache, und damit gilt dessen HTTPS: Das Master-Passwort geht nie im
Klartext über das Netz. Der Weg hinein ist `RewriteRule … [P]` in der
`.htaccess` — `ProxyPass` ist dort nicht zulässig, und `~/doms/<domain>/etc/`
ist leer. Dass das P-Flag auf diesem Hoster **erlaubt** ist, war die offene
Frage und ist gemessen (D76-Nachtrag 2), samt der 30 s gehaltenen Verbindung,
auf die das Long Polling angewiesen ist.

**Die Portnummer steht an genau einer Stelle.** `BACKEND_PORT` in der
`.env`; `deploy-prod.sh` setzt sie in die Proxy-Regel ein, `deploy-backend.sh`
in die Unit. Zwei Zahlen, die zueinander passen müssen, sind eine Zahl zu
viel — und der Fehler zeigte sich als 503, ohne zu sagen, warum.

**Der Speicher: gemessen, nicht geschätzt.** Der erste Entwurf setzte
`-Xmx384m` mit der Begründung, die Voreinstellung (¼ des RAM) sei zu viel.
Nachgemessen — 30 Dokumente angelegt, dann GC — stimmte die Richtung, aber
nicht der Hebel:

| Flags | RSS | Heap belegt |
|---|---|---|
| ohne Angaben | 291 MB | 359 MB |
| nur `-Xmx384m` | 254 MB | 359 MB |
| **`-Xmx192m -Xms48m` + Freiraum-Verhältnisse** | **174 MB** | 46 MB |
| dito mit G1 statt Serial | 194 MB | 48 MB |

Nach einem GC leben rund **45 MB**. Der große Hebel sind deshalb nicht die
Obergrenzen, sondern `MinHeapFreeRatio`/`MaxHeapFreeRatio`: Ohne sie behält
der Kollektor den einmal gewachsenen Heap, mit ihnen gibt er ihn zurück. Das
sind 80 MB gegenüber dem Entwurf — auf einem Host mit rund 300 MB frei ist das
der Unterschied zwischen „passt" und „drängt die Datenbank weiter in den Swap".
SerialGC statt G1 bringt weitere 20 MB und kostet bei zehn Beobachtern nichts,
was auffiele.

**Das Master-Passwort steht in einer Datei am Ziel, nie im Repository und nie
in der Unit.** `<BACKEND_DIR>/env` mit Modus 600; `systemctl --user show`
gäbe ein `Environment=` sonst preis. Das Deploy legt die Datei beim ersten Mal
leer an und sagt, was zu tun ist — solange kein Hash drinsteht, bleibt die
Dokumentenliste gesperrt, und das ist Absicht (D76-Nachtrag 6).

**Ein Deploy tauscht das Jar, er räumt nicht auf.** Anders als beim Frontend
(`rsync --delete`, dort ist das Zielverzeichnis exklusiv) liegen im
Backend-Verzeichnis die Datenbank, das Log und die Passwortdatei. Ohne
`--delete` ist ein Deploy wiederholbar, ohne dass jemand vorher nachdenken muss.

**Die Lebendprobe ist eine Anfrage nach einem Dokument, das es nicht gibt.**
HTTP 404 heißt: Die Anwendung ist oben und beantwortet Anfragen. Ein
Health-Endpunkt wäre die sauberere Antwort, kostet aber eine weitere
Laufzeit-Abhängigkeit (Actuator) — er steht als eigener Knoten im Plan
(`#be.scaffold.ci`), und bis dahin ist die 404 die ehrlichste Probe, die ohne
ihn zu haben ist.

**Nachtrag beim ersten Lauf: `$HOME` taugt nicht als rsync-Ziel.** Das Skript
schrieb die entfernten Pfade als `$HOME/opt/werkbaum/…`. Seit rsync 3.2.4 ist
`--protect-args` aber **voreingestellt**: Der entfernte Pfad geht nicht mehr
durch eine Shell, und ein `$HOME` bleibt wörtlich stehen. Gemessen gegen die
Zielumgebung (beide Seiten 3.2.7): `change_dir "/home/pacs/mih00/$HOME/opt/
werkbaum" failed: No such file or directory`. Mit `~/opt/werkbaum` gelingt es —
die Tilde expandiert rsync selbst, und genau deshalb funktioniert
`deploy-prod.sh` seit jeher.

Damit steht derselbe Pfad jetzt in **drei** Schreibweisen im Skript, je eine
für systemd (`%h`, keine Shell-Variablen), die Shell im ssh-Aufruf (`$HOME`)
und rsync (`~`). Das sieht nach Umständlichkeit aus und ist keine: Jedes der
drei Werkzeuge liest den Pfad anders, und zwei davon scheitern still oder
legen ein Verzeichnis an, das wörtlich `$HOME` heißt.

**Warum es der Stub-Test nicht gefunden hat:** Er ersetzte `rsync` durch ein
Skript, das seine Argumente protokolliert — und ein Protokoll expandiert
nichts. Der Test hat bewiesen, dass die richtigen Pfade *übergeben* werden,
nicht dass die Gegenseite sie versteht. Dieselbe Grenze wie in D25 und D72,
nur eine Ebene tiefer: Ein Stub prüft die eigene Seite der Naht.

**Nachtrag beim ersten Betrieb: `MODE=PostgreSQL` verhindert den Neustart.**
Der Dienst lief einmal und stürzte danach in einer Schleife: Liquibase legt
seine Verwaltungstabelle an, H2 antwortet „Table databasechangelog already
exists". In dem Modus schreibt H2 unquotierte Bezeichner **klein** (wie
PostgreSQL, dafür stand er in der URL); Liquibase sucht sie **groß**, findet
nichts und legt sie neu an. Der erste Start ging, jeder weitere nicht.

Gemessen, mit dem echten Jar und je frischem Verzeichnis:

| URL | zweiter Start |
|---|---|
| `MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE` (bisher) | stürzt ab |
| dito, Liquibase-Tabellen kleingeschrieben konfiguriert | stürzt ab |
| **ohne `MODE=PostgreSQL`** | **läuft** |

Die zweite Zeile ist der Grund, warum der Modus ganz weicht statt Liquibase
umkonfiguriert zu werden: Liquibase korrigiert den Namen selbst wieder auf
Großschreibung. Verloren geht wenig — der Modus ließ H2 wie PostgreSQL
*aussehen*, das Schema kommt aber ohnehin aus einem Liquibase-Changelog, und
der Umstieg auf echtes PostgreSQL bleibt eine Frage von URL und Treiber.

**Warum die Testsuite das nicht gefunden hat, und was daraus folgt.** Jeder
Test bekam eine frische In-Memory-Datenbank; „starte noch einmal" kam nie vor.
Der Regressionstest dafür hat mich dann **zweimal hintereinander belogen**, und
beide Male auf dieselbe Art — er prüfte etwas anderes, als er behauptete:

1. Er reichte die JDBC-URL über `SpringApplicationBuilder.properties(…)`
   herein. Das sind **Default**-Properties mit der *niedrigsten* Priorität; die
   `application.yaml` überstimmt sie. Der Test lief die ganze Zeit gegen eine
   andere Datenbank und meldete für jede Variante dasselbe Ergebnis.
2. Als Kommandozeilen-Argument gereicht wirkte die URL — aber jetzt prüfte der
   Test eine URL, die er sich **selbst ausgedacht** hatte, während die
   ausgelieferte ungeprüft blieb. Die Gegenprobe (Modus zurückbauen, muss
   fallen) blieb prompt stumm.

Beides fiel nur auf, weil die Gegenprobe zum Verfahren gehört. Jetzt hat die
URL **einen** Regler — `werkbaum.data-dir` —, der Test überschreibt nur den,
und alles Übrige an der ausgelieferten URL steht unter Test. Mit
`MODE=PostgreSQL` zurück fällt genau die eine danach benannte Zusicherung.

Dieselbe Lehre eine Ebene höher: Die Testkonfiguration hieß
`application.yaml` und **verdeckte** damit die Hauptkonfiguration vollständig —
die Tests prüften eine Konfiguration, die in Produktion nie läuft. Sie heißt
jetzt `application-test.yaml` und ist eine Profil-Überlagerung.

**Eine Lebendprobe braucht einen eigenen Endpunkt.** Bis hierher fragte das
Deploy nach einem Dokument, das es nicht gibt, und hoffte auf **404**. Ein
erwarteter *Fehler* ist eine schlechte Zusicherung: Dieselbe 404 liefert auch
ein falsch konfigurierter Proxy. `GET /api/v1/info` antwortet stattdessen mit
Name, Version und Bauzeitpunkt — offen, ohne Nebenwirkung, und es sagt
zugleich, **welcher Stand** läuft. Die Daten kommen aus
`META-INF/build-info.properties` (Gradle: `springBoot { buildInfo() }`, Teil
des Boot-Plugins — keine neue Abhängigkeit) und sind optional: Wer aus der IDE
startet, hat die Datei nicht und bekommt „unbekannt" statt eines Fehlers.

**Das Passwort setzt jetzt ein eigenes Skript** (`scripts/reset-password.sh`).
Es fragt verdeckt nach, schickt das Passwort über **stdin** zum Server (nicht
als Argument — Argumente stehen in der Prozessliste, die auf einem geteilten
Host jeder lesen kann), hasht dort mit `htpasswd -i` und prüft anschließend
selbst mit `htpasswd -vi`, ob Hash und Passwort zueinander passen. Genau diese
Gegenprobe fehlte, als das erste 401 wie ein Konfigurationsfehler aussah.

**Drei Anläufe hat das Skript gebraucht, und alle drei Fehler waren lautlos.**
Sie sind es wert, benannt zu werden, weil sie dieselbe Bauform haben — der
Fehler meldet sich nicht, er tut einfach nichts:

1. **Skript per Heredoc UND Daten per Pipe geht nicht.** Kommt das Skript über
   `stdin` (`ssh … 'bash -s' <<'REMOTE'`), dann frisst ein `cat`/`read` darin
   den **Rest des eigenen Skripts**. Die erste Fassung endete nach drei Zeilen,
   schrieb nichts und meldete Erfolg. Gemessen: Pipe + Heredoc → 0 Zeichen
   kommen an, Skript als Argument → alles kommt an. Jetzt geht beides über
   **einen** Strom: erste Zeile Passwort, danach das Skript; die äußere
   Kommandozeile liest die Zeile weg und reicht sie als Umgebungsvariable
   weiter.
2. **`case "$PW" in *"$(printf '\n')"*` lehnt alles ab.** Die
   Kommandosubstitution schneidet Zeilenumbrüche am Ende ab — das Muster ist
   leer, und `*""*` passt auf jede Zeichenkette. Richtig ist `[[ "$PW" ==
   *$'\n'* ]]`.
3. **`DIR=… read …` setzt `DIR` nur für das `read`.** Eine Zuweisung als
   Kommando-Präfix gilt für dieses eine Kommando; das nachfolgende `export`
   exportierte eine leere Variable. Semikolons statt Präfix.

Gefunden hat sie ein Testlauf gegen ein **Wegwerf-Verzeichnis** auf dem echten
Server (`BACKEND_DIR=opt/werkbaum-probe`, Terminal per `script -qec`, Passwort
mit `$` und `!`), gefolgt von einer **unabhängigen** Gegenprobe: den
gespeicherten Hash mit `htpasswd -vi` gegen das richtige *und* ein falsches
Passwort halten. Dem Skript zu glauben, dass es funktioniert hat, wäre nach
drei stillen Fehlschlägen die falsche Sorte Vertrauen gewesen.

**Nicht getestet, weil es nicht zu testen war:** Alles bis zur SSH-Grenze ist
gemessen — die erzeugte Unit ist mit `systemd-analyze verify` gültig, das Jar
startet mit **genau** den Flags der Unit in einer Sekunde, antwortet auf die
Probe mit 404 und ist von außen nicht erreichbar (`server.address=127.0.0.1`,
gegengeprüft über die LAN-Adresse). Der Deploy selbst — SSH, `systemctl`, die
Proxy-Regel im Betrieb — läuft erst, wenn jemand ihn startet. Das ist dieselbe
Grenze wie in D25 und D72: Was die Umgebung stellt, stellt der Emulator nicht.

**Nachtrag — `tools/remote`: eine Vordertür, Ziel und Aktion (2026-08-26).**
Die Skripte deckten den Deploy ab und sonst nichts. Alles Übrige — Log
ansehen, Dienst schalten, fragen was läuft — war ein von Hand getipptes
`ssh … systemctl --user …`, jedes Mal samt der `XDG_RUNTIME_DIR`-Falle. Nach
dem Muster eines anderen Projekts des Nutzers gibt es dafür jetzt einen
Befehl: `remote <ziel> <aktion>`, mit `backend`, `frontend` und `ssh` als
Zielen. Eine `.envrc` legt `tools/` auf den PATH (direnv), sodass `remote`
ohne Pfad genügt.

**Die Skripte bleiben die Implementierung, `remote` ist die Vordertür.** Sie
sind in beiden READMEs und in diesem Eintrag beschrieben, einzeln aufrufbar
und in Vorbereitung eines CI-Laufs nützlich; sie in das Werkzeug zu ziehen
hätte einen großen Diff für keinen Gewinn gebracht. `remote` bringt nur mit,
wofür es bisher gar nichts gab: die systemd-Verben, `log`, `info`,
`documents`, `backup`. Der Preis ist benannt — zwei Namen für dieselbe Sache,
deshalb nennen die READMEs jetzt `remote …` zuerst.

**Wo es einen Schalter brauchte, kam der ins Skript, nicht ins Werkzeug.**
`remote backend setup` schreibt nur die Unit neu; dafür hat
`deploy-backend.sh` ein `--unit-only` bekommen, statt dass `tools/remote`
die Platzhalter der Vorlage ein zweites Mal ersetzt. Genau diese Verdopplung
ist in D16 schon einmal teuer geworden (dieselben `sed`-Regeln in Workflow
und Skript). Ebenso `remote frontend preview` → `deploy-prod.sh --dry-run`.

**`--dry-run` schaltet die Beförderung ausdrücklich mit ab.** Sie läuft als
Schritt 0, also **vor** der rsync-Vorschau, und macht einen Commit (D30) —
ein Probelauf, der etwas schreibt, ist keiner. Gebaut und zusammengestellt
wird trotzdem, sonst wüsste der Vergleich nicht, wogegen er läuft.
Nachgemessen: HEAD und der Plan bleiben unangetastet.

**Sichern heißt anhalten.** H2 hält die Datei offen, solange der Dienst
läuft; eine Kopie im Betrieb kann zerrissen sein, und eine Sicherung, der man
nicht trauen kann, ist keine. `remote backend backup` hält den Dienst an,
holt `data/` als Tar-Strom und startet ihn wieder — gemessen rund 8 s Auszeit.
Zwei Feinheiten, die beide lautlos zuschlagen würden: Der Strom geht über
stdout in die Datei, **alle** Meldungen müssen deshalb nach stderr (sonst
landen sie im Archiv), und der Trap fängt `PIPE` mit ab — bricht die lokale
Seite weg, bliebe der Dienst sonst ausgerechnet dann unten.

**Und der Befehl liest das Archiv, bevor er es behält.** Erst nach
`tar tzf` und dem Nachweis, dass eine H2-Datei darin liegt, wird aus
`.teil` die endgültige Datei. Die eigentliche Gegenprobe lief einmal von
Hand und gehört hierher, weil sie die Zusage prüft und nicht die Mechanik:
Das Archiv lokal ausgepackt, das Backend mit `--werkbaum.data-dir` dagegen
gestartet — es kommt hoch und liefert genau die Dokumente, die auch auf dem
Server stehen. Ein Archiv, das nie jemand geöffnet hat, ist eine Hoffnung.

**`backend info` fragt über die öffentliche Adresse**, nicht am Dienst
vorbei: So ist die Proxy-Regel mitgeprüft. Die Domain wird aus dem
rsync-Ziel des Frontends abgelesen (`…/doms/<domain>/…`); ohne sie fragt der
Befehl direkt an `127.0.0.1` **und sagt, dass er es tut**. `frontend info`
liest den Versions-Link aus dem ausgelieferten Footer (D16) und vergleicht
den Commit mit dem eigenen HEAD — die einzige Stelle, an der die Datei
selbst sagt, was sie ist.

**`documents` bekommt das Passwort nie über die Kommandozeile.** Ohne
Angabe fragt curl selbst danach; mit `--from-env` kommt es als
`curl -K -` über stdin. Die Begründung steht schon im
`reset-password`-Nachtrag oben und gilt hier wörtlich: Argumente stehen in
der Prozessliste, und die Shell verändert das Passwort vorher.

**Gemessen statt geraten, zwei Kleinigkeiten am Rand:** Ein `frontend log`
gibt es **nicht** — `~/doms/werkbaum.javagil.de/var/` ist leer, der Managed
Webspace reicht die Apache-Logs nicht ins Home (nur monatliche
`~/var/domaintraffic-*.log`); an seine Stelle tritt `frontend info`. Und
`ssh -t` gehört nur dorthin, wo es ein Terminal gibt: Sonst steht
„Pseudo-terminal will not be allocated" als erste Zeile mitten im Log
(beim Bauen gemessen).

**Der Befehl wartet, bis der Dienst wieder antwortet.** Die erste Fassung von
`backup` meldete „Dienst wieder gestartet" und das nächste `info` bekam ein
503 — der Start dauert rund 8 s. Ein Werkzeug, das eine Sache meldet, die
gleich darauf nicht stimmt, ist schlechter als eines, das schweigt.

**Nachgemessen** gegen die produktive Instanz: `backend info` (200 samt
Version), `frontend info` (1.1.162, Commit = HEAD), `backend status`,
`backend log`, `backend documents --from-env` (liefert die Dokumente),
`backend setup -y` (Unit neu, Jar unangetastet — mtime unverändert),
`backend restart`, `backend backup` samt lokalem Wiederanlauf,
`frontend preview` (nichts geschrieben, HEAD unverändert) und die
Fehlerpfade (Exit-Code 2 bei unbekanntem Ziel und fehlender Aktion).

## D78 — Die Etherpad-Anbindung ist ausgebaut
D31 lieh sich für die Echtzeit-Zusammenarbeit ein **Etherpad**: Das Pad war die
Schreibfläche, Werkbaum die Ansicht. Das war die richtige Entscheidung für den
Zeitpunkt — die schwere Arbeit (gleichzeitige Änderungen zusammenführen) war
dort seit Jahren getan, und Werkbaum hatte kein Backend. **Jetzt hat es eins**
(D76), und das kann dasselbe besser und im Editor selbst. Also raus damit,
statt zwei Wege zur selben Sache zu pflegen.

**D31 bleibt stehen** — Entscheidungen werden nicht gelöscht, sondern
fortgeschrieben. Was dort gemessen wurde, gilt weiter und ist der Grund, warum
die Anbindung nie gut wurde: Etherpad **drosselt den Export** (serienmäßig 10
Abrufe je 90 s und IP), ein Hintergrund-Takt erzeugt die Drosselung, statt sie
zu umgehen; das Autoren-Cookie ist `SameSite=Lax` und kommt im eingebetteten
Rahmen nicht an, also ist man bei jedem Laden ein neuer Autor; und ein eigener
Socket zum Pad wurde von der Gegenseite abgelehnt (D31-Nachtrag, Code 1006).
Übrig blieb ein Neu-laden-Knopf und ein schreibgeschütztes Textfeld — die
Rückmeldung „funktioniert sowieso nicht gut" ist die ehrliche Zusammenfassung.

**Was `?live=` besser macht**, in derselben Reihenfolge: Es wird **im Editor
geschrieben** statt in einem fremden Rahmen; die Gegenrichtung ist ein offener
Abruf statt eines Takts gegen ein fremdes Limit; der Konflikt wird benannt
statt versteckt; und der Plantext liegt auf **eigener** Infrastruktur statt auf
einem Pad, das jeder lesen kann, der die Adresse kennt.

**Ein alter Link meldet sich, statt still nichts zu tun.** `?etherpad=` bleibt
als **erkannter** Parameter stehen und ergibt die zeilenlose Warnung `padGone`,
die auf `?live=` zeigt — in allen neun Sprachen. Der Parameter war geteilt: Wer
ihn irgendwo stehen hat (in einer Mail, einem Wiki, einem Lesezeichen), bekäme
sonst ein leeres Werkbaum ohne Erklärung. Genau der stille Fehler, den dieses
Projekt sonst überall ablehnt (SPEC §4, D59). Es ist bewusst **kein**
Rest-Feature: Geholt wird nichts, der Pad-Host sieht keine Anfrage mehr
(nachgemessen).

**Vorhandene Pad-Dokumente bleiben liegen — und werden dabei besser.** Sie sind
im localStorage gewöhnliche Dokumente (`{id, name, text, source}`); ohne den
Schreibschutz sind sie ab jetzt **bearbeitbar**, sammeln frühere Stände (D54)
und lassen sich falten. Ihr Text ist der zuletzt geholte. Nichts wird gelöscht,
niemand verliert seinen Plan.

**Der Schreibschutz verschwindet ganz, nicht nur seine Ursache.** `src.readOnly`
wurde ausschließlich von Pad-Dokumenten gesetzt; danach hätten sieben Wächter
in Falten, Kurz-IDs, Autovervollständigung und Ständen auf eine Bedingung
geprüft, die nie mehr wahr wird — mit Kommentaren, die auf D31 zeigen. Tote
Wächter mit veralteter Begründung sind schlechter als keine; ein künftiger
Lesemodus braucht ohnehin seine eigene Entscheidung. Mit ihm fällt
`updateSnapBtn()` weg: Der Knopf ist jetzt immer da.

**Eine Layout-Ebene weniger.** `#srcArea` gab es nur, damit Pad-Rahmen und
Textspiegel sich einen Bereich teilen konnten, ohne die Legenden-Aufteilung
(D26) anzufassen. Ohne Rahmen ist es ein Kasten mit einem Kind. Nachgemessen
nach dem Entfernen: `.editor-body` trägt jetzt direkt `srcWrap` · `hintGutter` ·
`agenda`, und die drei kacheln die Breite exakt (954 + 10 + 300 px) — der
Legenden-Splitter arbeitet unverändert.

**Mit ausgebaut**, weil sie nur der Anbindung dienten: `remote.js` samt seinen
Tests (die Pad-Adressen normalisieren), der Ansichts-Wähler und sein Splitter
(`--pcol`/`--prow`), der Neu-laden-Knopf samt Drosselungs-Zähler, die Warnungen
`sourceTimeout` und `padRateLimit`, elf i18n-Schlüssel × 9 Sprachen und der
Timeout-Parameter von `fetchRemote()`. **`?sourceUrl=` bleibt unangetastet**
(D23) — beide teilten sich einen Fetch-Pfad, und das war die eine Stelle, an der
beim Schneiden nichts verrutschen durfte.

**Der Plan sagt es auch.** Im mitgelieferten `werkbaum.werkbaum` wird aus dem
`#col.pad`-Zweig (14 Knoten samt der ganzen „Update by itself"-Gruppe, die nur
Etherpads Grenze umgehen wollte) **ein** verworfener Knoten `[-] #col.pad` mit
Begründung — dieselbe Form, in der dort schon `#bld.ghpages` und `#not.store`
stehen. Der eine Knoten, der weiterlebt, wandert heraus: `#col.pad.point` wird
`#col.point`, denn der gemeinsame Zeigefinger `!!!` gilt jedem geteilten
Dokument, nicht nur einem Pad. Danach 196 Knoten, 0 Warnungen.

**Nebengewinn: Der README bekommt endlich den Abschnitt zu `?live=`.** Den gab
es nie — D76 ist gebaut und dokumentiert (SPEC §9, DECISIONS), aber die
Einstiegs-Beschreibung stand weiter beim Pad. Das Ausbauen hätte sonst ein Loch
hinterlassen; jetzt steht dort in beiden Sprachen, wie man ein Server-Dokument
anlegt, teilt und was bei einem Konflikt passiert.

**Nachgemessen** im Browser: `?etherpad=…` zeigt die Warnung, und im
Netzwerk-Mitschnitt geht **keine** Anfrage an den Pad-Host; `?sourceUrl=` lädt
unverändert und das Dokument ist beschreibbar (früher: schreibgeschützt); das
Textfeld liegt mit dem Zahlenstreifen bündig (1151 + 20 px), die Zeilennummern
sitzen auf ihren Höhen, Pfad und Stationen werden gezeichnet; der
Legenden-Splitter teilt wie zuvor. 501 Tests (die 24 Pad-Adress-Tests sind mit
`remote.js` gegangen, `padGone` ist dazugekommen).

## D79 — Debounce auf 600 ms, Sync-Versionen nur noch fünf Minuten
Gemeldet: „der Delay beim Live-Editing zwischen zwei Browsern ist ca. 3 s, das
ist zu träge." Nachgemessen und zerlegt, statt am Gefühl zu drehen.

**Die Wartezeit vor dem Senden IST die Verzögerung.** Der Weg A → B in Zahlen
(lokal, Wanduhr beider Tabs):

| Abschnitt | gemessen |
|---|---|
| Tippen → PATCH raus | 1666 ms |
| PATCH-Rundlauf | 48 ms |
| Feed-Antwort bei B | 9 ms danach |
| Text steht bei B | 11 ms |

Alles außer dem Debounce sind zusammen rund 70 ms. Zwei Verdächtige sind
ausdrücklich **freigesprochen**: Der Server weckt den wartenden Feed **39 ms**
nach dem PATCH (isoliert per curl gemessen, ohne Browser), und der Apache der
produktiven Instanz hält den Long-Poll die vollen **25 s** durch und schließt
sauber mit 204 — es gibt also kein Fenster ohne offenen Feed und keinen
5-Sekunden-Fehlerpfad (`LIVE_RETRY_MS`). Produktiv kommen ~130 ms Rundlauf je
Anfrage dazu (gemessen, TLS eingeschlossen), macht ≈ 1,8 s.

Die gemeldeten 3 s liegen darüber, und der Rest steckt in der Wahrnehmung —
das ist keine Ausrede, sondern eine **Eigenschaft des Debounce**: Die Uhr
startet bei jedem Tastendruck neu. Gefühlt beginnt die Wartezeit, wenn der
Gedanke fertig ist; gerechnet beim letzten Anschlag.

**Entschieden (Nutzer): 600 ms, und es bleibt ein Debounce.** Erwogen war, aus
dem Debounce eine **Drossel** zu machen (regelmäßig senden statt nur in der
Pause) — verworfen: Wer durchtippt, soll weiterhin keine Version erzeugen. Der
Grund, aus dem D76 bei 1,5 s blieb, trägt ohnehin nicht mehr: Er stammte aus
der Rate-Limit-Disziplin des Etherpad-Konzepts, und Etherpad ist ausgebaut
(D78).

**Die zweite Hälfte ist die Aufbewahrung — und sie zahlt die erste.** Jede
Version speichert den **ganzen** Text; Sync-Versionen lagen eine Stunde. Wofür
ist die Frist überhaupt da? Für genau eines: ob ein zurückgefallener Client ein
**Diff** bekommt oder den **Volltext**. Nutzersichtbar ist die Historie der
**Meilensteine**, und die wird nie verdichtet. Wer einen offenen Feed hat,
fällt gar nicht zurück — zurückfallen kann nur, wessen Feed **ruht**
(Hintergrund-Tab, D76-Nachtrag 1). Fünf Minuten decken die kurze Abwesenheit
ab, alles darüber bekommt anstandslos den Volltext.

Zusammen **sinkt** der Platzbedarf, obwohl öfter gesendet wird — gerechnet mit
dem mitgelieferten Plan (49 kB), Dauertippen als Spitze:

| | Versionen/min | Frist | Spitze je Dokument |
|---|---|---|---|
| vorher | 40 | 60 min | **115 MB** |
| nachher | 100 | 5 min | **24 MB** |

Auf einem Host mit rund 300 MB frei (D76-Nachtrag 3) ist das der Unterschied,
der zählt.

**Dabei gefunden, und erst durch die kurze Frist gefährlich:** Eine Schreibpause
**länger als die Aufbewahrungsfrist** war mit einer Stunde der Ausnahmefall und
ist mit fünf Minuten der Normalfall. Dass die letzte Sync-Version davor
trotzdem nicht verlorengeht, hängt an einer einzigen Sache — `recordHistory()`
**befördert zuerst und verdichtet danach**. In der anderen Reihenfolge löschte
die Verdichtung genau den Stand, den die Beförderung gleich zum Meilenstein
gemacht hätte: ein nutzersichtbarer Stand wäre still weg. Die Reihenfolge war
bisher nur eine Anordnung von Anweisungen; sie hat jetzt eine Zusicherung
(`verifyOrder`). Gegenprobe: vertauscht fällt genau der danach benannte Test.

**Werkzeuggrenze, die diese Messung fast verdorben hätte.** Der
Automatisierungs-Browser zeigt seine Fläche nicht an, die Seite ist damit
wirklich verborgen — und Chrome drosselt Timer verborgener Seiten auf **1 Hz**.
Der `document.hidden`-Stub belügt die App, nicht den Scheduler. Nachgemessen:
ein blanker `setTimeout(…, 600)` feuert dort nach 999–1053 ms. Ein
Sub-Sekunden-Debounce ist in dieser Umgebung **grundsätzlich nicht messbar**;
die 600 ms sind gesetzt, und was daneben liegt (Server 39 ms, Rundlauf 130 ms,
PATCH → sichtbar 46 ms) ist einzeln gemessen. Dieselbe Lehre wie D25
(synthetische `TouchEvent`s), D17-Nachtrag 4 (Bildschirmtastatur) und D53
(synthetisches Strg+Z): Was die Umgebung stellt, stellt der Emulator nicht.

## D80 — Die Adresszeile beschreibt das aktive Dokument, und die Live-Sitzung folgt ihm
Gemeldet: Wer bei offenem `?live=…` auf ein anderes Dokument umschaltet, behält
die alte Adresse — „das sieht optisch falsch aus, und beim Neuladen würde wohl
auch das Dokument aus `live=` wieder geladen". Beides stimmt, und beim
Nachsehen kam ein dritter, schwererer Befund dazu.

**Die Adresse ist kein Andenken an den Aufruf, sondern der Stand.** Sie ist der
Link, den man weitergibt, und das, was ein Neuladen wiederherstellt. Zeigt sie
auf etwas anderes als der Bildschirm, ist eines von beiden gelogen — und beim
Neuladen entscheidet die Adresse. Die Regel lautet deshalb: **Der Parameter
gehört zum aktiven Dokument.** Umschalten auf ein lokales Dokument räumt ihn
weg, Umschalten auf ein anderes Server-Dokument tauscht ihn aus.

**Sie gilt für beide Eingänge, nicht nur für `?live=`.** `?sourceUrl=` (D23)
hatte dasselbe Problem, und eine Regel, die nur für einen der beiden gilt, ist
keine. Beide Eingänge sind ohnehin schon die **Identität** des Dokuments
(`live:<url>`, `url:<href>`) — der Parameter lässt sich also aus der id
zurückrechnen, statt nebenher geführt zu werden. `?etherpad=` ist ausgebaut
(D78) und wird nur noch weggeräumt.

**Für `?sourceUrl=` ist das keine neue Gefahr**, obwohl der Parameter beim
Zurückschalten wiederkommt und ein Neuladen den Text dann erneut holt (D23:
„lokale Änderungen daran überleben ein Neuladen nicht"). Bisher stand er
**immer** da, unabhängig davon, was vorn war — es wird also nicht mehr
überschrieben als vorher, sondern weniger.

**Fremde Parameter bleiben wörtlich stehen — auch ihre Schreibweise.** Der
naheliegende Weg über `URLSearchParams` schriebe jedes `:` und `/` als
`%3A`/`%2F` und machte damit gerade die URL unleserlich, um die es hier geht;
`?server=` (D76-Nachtrag 8) fiele bei einem Neubau der Adresse ganz weg.
Maskiert wird nur, was den Query-String sonst zerrisse (`&`, `#`). Die
entscheidbare Hälfte steht als reine Funktion in `docurl.js`
(Hausregel D54-Nachtrag 3), die `history.replaceState`-Seite in app.js.

**Der dritte Befund: Die Live-Sitzung lief weiter, während ein anderes Dokument
vorn stand.** `switchDoc()` hat bisher nur `activeId` gewechselt; `liveState`
blieb, der Feed lief, und `setLiveText()` schreibt in `src.value` **und** in
`activeDoc().text` — eine fremde Änderung am Server-Dokument landete also im
Text des Dokuments, das man gerade ansieht. Nachgemessen war die Lücke echt:
Die Meldung des Nutzers ist die Tür dazu.

**Also gehört die Sitzung dem sichtbaren Dokument.** Umschalten beendet sie;
Umschalten auf ein Server-Dokument nimmt sie auf (`startLive()`, aus
`loadLive()` herausgelöst — derselbe Weg, nur mit der URL aus dem Dokument
statt aus dem Parameter). Der Nebengewinn ist der eigentliche: Ein
Server-Dokument, das man im Wähler auswählt, ist danach wirklich live. Vorher
zeigte es stumm seinen letzten Stand — die Adresse hätte also nicht nur
optisch, sondern der Sache nach gelogen, wenn man sie einfach mitgeführt hätte.

**Verdrahtet an genau einer Stelle:** `loadActiveIntoEditor()` — jeder Weg zu
einem anderen aktiven Dokument führt dort durch (Umschalten, Anlegen, Löschen,
Datei öffnen, Server-Dokument laden). Während des Starts ruht die Regel
(`bootDone`): `loadRemoteSource()` und `loadLive()` lesen ihre Parameter erst,
nachdem das zuletzt aktive Dokument wiederhergestellt ist — ein vorschnelles
Aufräumen nähme ihnen die Vorlage.

**Was noch im Debounce steckt, wird beim Umschalten losgeschickt.** Sonst
verlöre ein Wechsel innerhalb von 600 ms nach dem letzten Tastendruck genau
diese Änderung an den Server. Gesendet wird, **bevor** `activeId` wechselt —
`pushLive()` liest `src.value` synchron, danach zeigt das Feld schon den
anderen Text.

**Und `pushLive()` hält jetzt seine Sitzung fest, nicht nur deren Felder.**
Wer während des Sendens umschaltet, beendet sie; die Fortsetzung nach dem
`await` dürfte danach weder schreiben noch in ein `null` greifen (das
`finally` hätte es getan). Dieselbe Sorte Annahme, die D76-Nachtrag 9 schon
einmal an dieser Funktion korrigiert hat: dass sich über ein `await` hinweg
nichts ändert.

**Nachgemessen** im Browser gegen ein lokales Backend, mit zwei
Server-Dokumenten: Umschalten auf ein lokales Dokument räumt `?live=` weg,
Umschalten auf das andere Server-Dokument tauscht die URL aus, `?sourceUrl=`
verhält sich symmetrisch und bleibt unmaskiert lesbar. Eine fremde Änderung
erreicht das per Wähler geöffnete Server-Dokument ohne Neuladen (die Sitzung
läuft also wirklich); dieselbe Änderung, während ein lokales Dokument vorn
steht, lässt dessen Text unangetastet (vorher hätte sie ihn überschrieben);
beim Zurückschalten steht der Server-Stand da. Eine Zeile, im selben Zug
getippt und umgeschaltet, kommt beim Server an. 514 Tests, davon 13 neue in
`tests/docurl.test.js`; Gegenproben: fremde Parameter mitwerfen → genau die
zwei danach benannten Zusicherungen fallen, `encodeURIComponent` statt der
sparsamen Maskierung → genau die sieben, die die Lesbarkeit festhalten.

## D81 — Dokumenten-Menü neu: Brotkrume im App-Kopf, Stand-Knöpfe in der Editor-Titelzeile
Das Dokumenten-Menü war gewachsen, ohne je gestaltet zu sein: Der Dokumentname
in der Editor-Titelzeile war Auslöser eines Dropdowns, sah aber nicht nach
Menü aus, und das Menü mischte Dokumentwahl, Dateifunktionen und Verwaltung in
einem Knopf-Wust am Fuß. Auf dem Telefon (Brave) war es zudem **unten
abgeschnitten** — sieben Aktions-Knöpfe unter einer Liste, verankert in einer
Titelzeile in der unteren Bildschirmhälfte. Einer Design-Runde mit vier
Mockup-Richtungen (Knopf & Menü am Ort, Schublade, Dokument im App-Kopf,
Palette) folgte die Entscheidung des Nutzers für **C — Dokument im App-Kopf**.

**Der Name gehört über beide Bereiche, nicht in eine Panel-Zeile.** Das
Dokument bestimmt Text UND Diagramm; im App-Kopf steht es als Brotkrume
**„Werkbaum › Name"** — ein gerahmter Chip mit Pfeil, der endlich nach Menü
aussieht und lange URL-Namen mit Ellipse kürzt (voller Name im Tooltip, wie
gehabt). Nebengewinn auf dem Telefon: Der Kopf ist in beiden Bereichen
sichtbar, die Dokumentwahl ist also auch bei Diagramm-vorn erreichbar — vorher
musste man erst in den Textbereich wechseln (D17). Der Name übernimmt dort die
Zeile des Untertitels; es kommt keine Fläche hinzu (die harte Randbedingung
der Design-Runde: größerer App-Header und ständige Werkzeugleiste waren in
einer früheren Runde genau daran gescheitert).

**Die Editor-Titelzeile bekommt ihre Beschriftung zurück — „Text-Editor"**
(Nutzer-Vorgabe; vorher „Struktur (Text)", zuletzt ganz vom Wähler verdrängt,
D22) — **und trägt die Stand-Funktionen des aktiven Dokuments** als Knöpfe:

- **Speichern** (Als Datei speichern, Strg+S — der Blitz samt Haken von D74
  sitzt jetzt hier statt am Dokumentnamen: der Knopf ist die Geste);
- **Stand jetzt sichern** und **Frühere Stände** (unverändert, D54);
- **Neu laden** — kontextabhängig: bei mitgelieferten Dokumenten „Original
  wiederherstellen" (ausgegraut, solange unverändert), bei URL-Dokumenten
  frisch holen (die URL ist die Quelle der Wahrheit, D23), bei Dateien mit
  gemerktem Handle neu aus der Datei lesen (D72); sonst verborgen. Die
  Abweichungs-Prüfung hängt am **input-Ereignis**, nicht nur am
  Dokumentwechsel — beim Bauen gefunden: Nach dem ersten Tippen blieb der
  Knopf ausgegraut, weil die Abweichung beim Tippen entsteht;
- **Teilen** — der neue, kurze Name für „Auf den Server legen"
  (D76-Nachtrag 8, Nutzer: „prägnanter und kurzer"): legt das Dokument auf
  einen Werkbaum-Server und startet die gemeinsame Bearbeitung; entfällt, wo
  es schon liegt (id `live:…`). Aus dem Menü heraus, in die Titelzeile hinein
  — es ist eine Funktion des aktiven Dokuments, keine Dokumentverwaltung.

**Das Menü selbst: Gruppen nach Dokumentart, Aktionen an der Zeile.** Drei
Gruppen — **Mitgeliefert · Eigene · Quellen** (Server- und URL-Dokumente);
die Art steckt in der id und ist als `docKind()` headless in docurl.js
(Hausregel D54-Nachtrag 3, getestet). Umbenennen, Löschen und — bei
abweichenden mitgelieferten — Wiederherstellen hängen als **Symbole an der
Zeile des jeweiligen Dokuments**, immer sichtbar (Touch kennt kein Hover; die
Hover-only-Variante des Mockups hätte dort versagt). Damit wirken sie auf
**jedes** Dokument, nicht mehr nur auf das aktive, und das Menü bleibt nach
einer Verwaltungs-Aktion **offen** — wer aufräumt, räumt meist weiter. Kein
Knopf im Knopf: Die Zeile ist ein `div`, Wählen-Knopf und Aktions-Knöpfe sind
Geschwister (verschachtelte interaktive Elemente sind ungültiges HTML). Unten
bleiben zwei Befehle als gewöhnliche Menüzeilen: „＋ Neues Dokument" und
„Datei öffnen…".

**Gegen das Abschneiden auf dem Telefon: scrollen, nicht klappen.** Das Menü
bekommt `max-height` und scrollt **als Ganzes**; die vom Nutzer alternativ
vorgeschlagenen auf-/zuklappbaren Gruppen sind verworfen — sie brauchten
einen gemerkten Klapp-Zustand und versteckten Dokumente hinter einem zweiten
Klick, während das Scrollen zustandslos ist und nichts versteckt. Dazu kommt,
dass das Menü jetzt **oben** hängt statt in der Mitte des Bildschirms — der
Platz darunter ist das Mehrfache des alten.

**Drei Messbefunde beim Bauen, alle in derselben Sitzung behoben:**

- **Das Menü spannte auf Mobil nur 155 px** statt der vollen Breite: Bezug
  war die Marken-Gruppe, und die ist nur so breit, wie die Werkzeuge rechts
  ihr lassen. Dieselbe Verlegung wie beim Neuigkeiten-Popup (D58): Bezug ist
  die ganze Kopfzeile; die Marken-Gruppe löst sich auf Mobil per
  `display:contents` auf, damit die Chip-Zeile per `order` unter Marke und
  Werkzeuge umbricht — gemessen danach 335 px, `elementFromPoint` trifft
  (die D50-Prüfung).
- **Marke und Werkzeuge brachen in zwei Zeilen** (Kopf: drei Zeilen = neue
  Fläche): 164 + 164 px bei 335 px Breite. Wie in D17-Nachtrag 5 weichen die
  **Lücken, nicht die Knöpfe** — nachgemessen mit eingeblendetem
  Neuigkeiten-Zähler UND Build-Hinweis (die D17-Lektion, mit dem versteckten
  Element zu messen): Worst Case 325 von 335 px, eine Zeile, Kopf 63 px.
  Bei 320 px bricht es ehrlich um (Marke und Werkzeuge passen physisch nicht
  nebeneinander) — dieselbe Philosophie wie die 440-px-Schwelle (D50).
- **Der Neu-laden-Knopf blieb nach dem Tippen ausgegraut** (siehe oben).

**Was mitgeht:** Der Collapsed-Editor zeigt jetzt „TEXT-EDITOR" (senkrecht im
Seitenmodus) statt des Dokumentnamens; der Klick-Wächter am alten Auslöser
(minimierter Editor) entfällt — im App-Kopf gibt es nichts wiederherzustellen.
Ein offenes Menü wechselt die Sprache mit (wie das Neuigkeiten-Popup). Der
Untertitel-Kurztext (`subtitleShort`, 9 Sprachen) ist ersatzlos ausgebaut —
seine Zeile gehört jetzt dem Dokumentnamen.

**Werkzeuggrenzen, wieder dieselbe Sorte wie D25/D17-Nachtrag 4:** Nach einem
programmatischen Resize lieferte das Browser-Pane Miniatur-Screenshots einer
Seite, die sich selbst nachweislich korrekt maß (1280 × 860), und die
`matchMedia`-Umschaltung von `body.mobile` feuerte nicht — beides
Umgebungs-Artefakte, kein Befund; entschieden haben die Messwerte im
Dokument, nicht die Bilder.

**Nachgemessen** (518 Tests, davon 4 neue für `docKind`; Browser Desktop und
375/320 px): Chip im Kopf öffnet das gruppierte Menü, `elementFromPoint`
trifft es auf allen Breiten; Neues Dokument geht in die Inline-Benennung mit
markiertem Vorschlag und landet unter „Eigene"; ein bearbeitetes Beispiel
zeigt das Zeilen-Restore-Symbol und aktiviert Neu laden, Wiederherstellen
stellt Text und Knopfzustände zurück, ohne das Menü zu schließen; Löschen
eines nicht-aktiven Dokuments lässt den Editor unangetastet; auf dem Telefon
ist der Wähler aus dem Diagramm-Bereich erreichbar und der Wechsel rendert
183 Knoten, langer Name füllt die 335-px-Chipzeile mit Ellipse.

**Nachtrag — vor dem Teilen wird die Basis-Adresse per Lebendprobe geprüft.**
Gemeldet vom ersten echten Druck auf den neuen Teilen-Knopf: „Server-Dokument
nicht geladen: https://mhoennig.github.io/api/v1/documents (HTTP 405)." Die
Ursache liegt nicht im Knopf, sondern in der Vorgabe aus D76-Nachtrag 8: Die
Basis-Adresse ist die **eigene Herkunft** — richtig auf der produktiven
Installation (dort liegt `/api/` per Proxy dahinter, D77), falsch auf jeder
statischen Instanz. GitHub Pages beantwortet den POST mit 405, und die
Meldung führte auf die falsche Fährte („ist die Adresse eine
Dokument-Adresse?"). Der Fehler war schon vor D81 da; der Knopf in der
Titelzeile hat ihn nur sichtbar gemacht — im Menü hat ihn dort schlicht
niemand gedrückt.

**Gefixt mit der Lebendprobe, die es schon gibt:** `GET /api/v1/info` (D77,
gebaut genau als „antwortet hier die Anwendung?"). `serverBaseOrAsk()` prüft
die Vorgabe damit, **bevor** gePOSTet wird; besteht sie nicht, wird
**gefragt** — der vorhandene Dialog samt gemerkter Antwort. Gemerkt wird nur
eine Adresse, die die Probe besteht: Ein Tippfehler klemmt sich nicht fest
(und eine gemerkte Adresse, deren Backend verschwindet, heilt sich beim
nächsten Teilen von selbst — Probe scheitert, es wird neu gefragt). Eine
eingegebene Adresse, die nicht antwortet, wird trotzdem versucht — der
POST-Fehlerpfad nennt dann ehrlich, was nicht erreichbar war, statt dass der
Dialog stumm wieder aufgeht.

**Von Pages aus funktioniert das Teilen damit wirklich:** Das Backend erlaubt
CORS `*` (D76-Nachtrag 7) — wer auf `mhoennig.github.io` arbeitet und im
Dialog `https://werkbaum.javagil.de` einträgt, legt sein Dokument dort ab.
Gemessen aus dem Browser: Die Probe gegen die stabile Instanz besteht
cross-origin.

**Nachgemessen** am Dev-Server (dieselbe Lage wie Pages: keine eigene
`/api/`): Teilen öffnet jetzt den Adress-Dialog statt der 405-Warnung,
Abbruch tut nichts; die Probe gegen das echte Backend liefert
`{name:"editor-backend"}`. `infoUrl()` liegt headless in live.js (39
Live-Tests, +1).
