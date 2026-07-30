# WBS-Notation – Spezifikation

Textuelle Notation für Projektstrukturpläne (Work Breakdown Structure) mit
Und/Oder-Zerlegung. Diese Datei ist die verbindliche Sprachdefinition.
Syntaxänderungen werden zuerst hier dokumentiert, dann implementiert.

## 1. Zeilenformat

```
[Einrückung][Zeichen] [Statusbox] Label (Größe) URL @tag … %% Kommentar
```

Alle Bestandteile außer dem Label sind optional. Die Extraktion erfolgt in
dieser Reihenfolge (wichtig für Kollisionsfreiheit):

1. Kommentar entfernen: alles ab `%%` bis Zeilenende.
2. Einrückung, Zeichen (`-` / `+` / `|`) und Statusbox `[…]` per Zeilen-Regex.
3. URL: erstes Token, das auf `https?://\S+` passt (dadurch stören `@` in URLs nicht).
4. Größe: erstes `(XS|S|M|L|XL|XXL)`, Groß-/Kleinschreibung egal.
5. Tags: alle `@name`-Vorkommen.
6. Rest, whitespace-normalisiert = Label. Leeres Label ⇒ Zeile ignorieren.

Referenz-Regex der Implementierung:

```
^([ \t]*)([-|+])?\s*(?:\[([ ?~xX^/-])\]\s*)?(.*)$
```

## 2. Hierarchie

- Die Einrückung bestimmt die Ebene. Es gibt keine feste Schrittweite:
  Elternknoten ist die nächste vorangehende Zeile mit **kleinerer**
  Einrückungsbreite (Tab zählt als 2 Leerzeichen).
- Zeilen ohne Zeichen (`-`/`+`/`|`) sind Wurzelknoten. Mehrere Wurzeln = mehrere
  Bäume nebeneinander.

## 3. Zerlegungsart (Gate)

| Zeichen | Bedeutung | Semantik |
|---|---|---|
| `-` | all of (Und-Zerlegung) | Alle Teilpakete sind erforderlich. |
| `+` | optional (Zugabe) | Einzelnes zusätzliches Teilpaket, nicht erforderlich. |
| `\|` | any of (Oder-Zerlegung) | Mindestens eine Alternative wird gewählt. |

- `-` und `|` sind Eigenschaften der **Geschwistergruppe**; `+` ist eine
  Eigenschaft des **einzelnen Knotens** (er hängt an derselben Und-Zerlegung,
  ist darin aber entbehrlich).
- Daraus folgt die Mischregel: Eine Gruppe ist entweder **konjunktiv** — dann
  dürfen `-` und `+` frei nebeneinander stehen — oder **disjunktiv** (`|`).
  `|` mit `-`/`+` zu mischen ist ungültig: Darstellung nach dem **ersten** Kind,
  plus Warnung `mixedGate` mit Zeilennummer.
- Ein `+`-Knoten zerlegt sich weiter wie jeder andere; das Gate seiner eigenen
  Kinder ist davon unabhängig. Optionalität vererbt sich nicht ausdrücklich —
  wer unter einem `+`-Knoten hängt, ist mit ihm zusammen entbehrlich.
- `+` sagt nichts über den Fortschritt: Eine Zugabe kann längst `[^]` sein. Die
  beiden Achsen (Status §4, Notwendigkeit §3) sind unabhängig.

## 4. Status

Codiert als Checkbox nach dem Zeichen (Erweiterung der Markdown-Task-Syntax):

| Code | Key | Name | Bedeutung | Hintergrund | Rahmen |
|---|---|---|---|---|---|
| `[?]` | idee | Idee | vage Idee | `#EBEDEF` (grau) | `#A2ABB5` |
| `[ ]` | geplant | geplant | beschlossen, nichts investiert | `#EBE4F6` (flieder) | `#A991D4` |
| `[~]` | arbeit | in Arbeit | Kosten investiert, Risiko hoch | `#FADDE4` (rosé) | `#D897A8` |
| `[/]` | durchstich | Durchstich | funktionsbereit/vorführbar, Feinarbeiten offen | `#FBF2CE` (pastellgelb) | `#D9BE63` |
| `[x]` | fertig | fertig | abgeschlossen | `#DCF1DE` (pastellgrün) | `#86C293` |
| `[^]` | prod | in Produktion | deployed/live | `#DBEAF8` (pastellblau) | `#85ACD7` |
| `[-]` | verworfen | verworfen | bewusst nicht weiterverfolgt | `#F1F2F4`, gestrichelter Rahmen, Text durchgestrichen | `#B3BAC2` |
| `[!]` | highrisk | High Risk | Aufwand noch unklar, hohes Risiko | `#FFE5CC` (orange) | `#F97316` |

- Ohne Statusbox: neutraler Knoten (weiß).
- `x` auch als `X` zulässig.
- **High-Risk-Kennzeichnung:** Der `[!]`-Knoten trägt zusätzlich zur orangen
  Färbung ein **Warndreieck** (⚠, in `#F97316`) als kleines Badge an der oberen
  linken Ecke — Tooltip „High Risk – Aufwand noch unklar." Das Badge erscheint
  auch im Grafikexport. (Mnemonik: `!` = Achtung. Ob `[!]` später zusätzlich zum
  Fertigstellungsstatus stehen darf, ist offen; vorerst ist es ein eigener
  Status wie die übrigen.)
- Verworfene Knoten (inkl. Teilbaum) sind per Default **ausgeblendet**;
  Toggle „verworfene einblenden“ zeigt sie.
- **Fehlertoleranz:** Ein unbekanntes Zeichen in der Statusbox (z. B. `[z]`)
  wird nicht verschluckt: Der Knoten erscheint **neutral** und es wird eine
  Warnung `unknownStatus` mit Zeilennummer gemeldet — die Zeile geht nicht
  verloren, Folgezeilen bleiben unberührt. (Eine mehrzeichige Klammer wie
  `[xyz]` ist keine Statusbox und bleibt Teil des Labels.)

## 5. Aufwand (T-Shirt-Größen)

- Werte: `XS < S < M < L < XL < XXL`, notiert in Klammern, z. B. `(L)`.
- **Untergliederungsregel:** Ab `(M)` muss ein Element weiter zerlegt sein.
  Ein Element ≥ M **ohne Kinder** erhält einen Geister-Knoten an gestrichelter
  Linie darunter (in `--warn`, `#B45309`). Sein Label ist knapp „…“; die
  Erklärung („Ab Größe M sollte ein Element weiter untergliedert werden.“)
  steht im Tooltip — der ausgeschriebene Text machte die Zelle sonst breiter
  als der Knoten und verschob gestapelte Geschwister. Der angedeutete
  Unterpunkt genügt als Hinweis; eine zusätzliche Umrandung des Knotens gibt es
  nicht.
- Ausnahme: verworfene Elemente lösen die Regel nie aus.
- Anzeige: petrolfarbenes Badge (`--or`, `#0F766E`) mit weißer Schrift oben
  rechts an der Knoten-Ecke.

## 6. Links

- Ein nacktes `https://…`-Token macht den ganzen Knoten klickbar
  (neuer Tab, `rel="noopener"`); Kennzeichnung mit ↗ hinter dem Label.

## 7. Personen-Tags

- `@name` mit `name` aus Unicode-Buchstaben, Ziffern, `.`, `_`, `-`.
- Mehrere Tags pro Zeile möglich, Position im Text egal.
- Anzeige: helle Pillen unten rechts an der Knoten-Ecke.

## 8. Kommentare

- `%%` leitet einen Kommentar ein — ganze Zeile oder ab Zeilenmitte.
- Konvention aus Mermaid übernommen; `%%{` vermeiden (dort Direktiven-Syntax).

## 9. Darstellung

Drei Modi, im Editor umschaltbar über Icon-Buttons (Reihenfolge
**horizontal · kompakt · vertikal**, je mit Tooltip). Der Modus wählt zugleich
die Seitenanordnung: **horizontal** stellt Diagramm über den Editor
(volle Breite), **vertikal** und **kompakt** stellen Editor und Diagramm
nebeneinander (schmales Diagramm rechts).

**Linienführung (in allen Modi gleich):** all-of-Linien durchgezogen in Tinte
(`#41556E`); any-of-Linien — Haupt-/Sammelleiste **und** Abzweige — durchgehend
**gestrichelt in Grau** (`#6B7A8C`). Auch der **Rahmen der Alternative-Knoten**
ist grau (`#6B7A8C`) — kein Petrol mehr im Diagramm. Der Modus ändert nur die
**Anordnung**, nicht die Linienfarbe.

**Optionale Knoten (`+`, §3):** Sie hängen an der normalen all-of-Zerlegung,
die Anordnung bleibt unverändert. Zwei Kennzeichen, beide auch im Grafikexport:

- Der **Abzweig zum Knoten** ist **gestrichelt in Tinte** (`#41556E`). Nur der
  Abzweig — die **Sammelleiste bleibt durchgezogen**, sie gehört der ganzen
  Geschwistergruppe. Die any-of-Linien sind ebenfalls gestrichelt, aber in
  **Grau** (`#6B7A8C`); die Farbe hält beide auseinander, und weil `|` nicht mit
  `-`/`+` gemischt werden darf (§3), treffen sie in einer Gruppe nie aufeinander.
- Am Auftreffpunkt sitzt ein **kleiner hohler Kreis** (weiß gefüllt, Rand in
  Tinte): in der horizontalen Fächer-Anordnung **oben mittig**, in den
  gestapelten Anordnungen (vertikal, kompakt, unterhalb einer any-of-Gruppe)
  **links auf halber Höhe**. Übernommen aus den Feature-Diagrammen (FODA:
  gefüllter Punkt = erforderlich, hohler Punkt = optional). Er markiert
  eindeutig, **welcher** Knoten optional ist — auch dort, wo der Strich allein
  mit den grauen any-of-Linien verwechselt werden könnte.

Siehe D29.

### Horizontal (Normalmodus)
- **all of:** Kinder nebeneinander, klassischer Organigramm-Fächer.
- **any of:** Alternativen untereinander; gestrichelte graue Sammelleiste links
  unterhalb des Parents, gestrichelte graue Abzweige zu den Alternativen.
- **Treppe für optionale Endknoten:** Stehen **zwei oder mehr** optionale
  **Endknoten** (`+`, §3) unmittelbar nebeneinander, bekommen sie nicht je eine
  eigene Spalte, sondern werden als **Kaskade** gestapelt: Die erste Stufe hängt
  am Stiel von oben wie ein gewöhnliches Kind, jede weitere steht eine Stufe
  tiefer und weiter rechts und hängt an einem gestrichelten Winkel, der an der
  linken Kante der vorigen Stufe herabfällt und waagerecht in ihren Kreis
  einbiegt. Das spart Breite genau dort, wo das Entbehrlichste steht.
  Es bleiben **Geschwister** — die Treppe ist eine Anordnung, keine Ebene, und
  ändert weder Lese-/Fokusreihenfolge noch `aria-label`. Nur Endknoten, weil der
  Platzgewinn gerade daher rührt, dass kein Teilbaum mitgestapelt wird; ein
  optionaler Knoten **mit** Kindern behält seine Spalte. Die transponierten Modi
  kennen die Treppe nicht — dort stehen die Kinder ohnehin untereinander. Der
  Grafikexport folgt der Kaskade.

### Vertikal (transponiert)
- **all of:** exakter transponierter Organigramm-Fächer (horizontal um 90°
  gedreht): Der Parent sitzt **vertikal mittig** zu seiner Kindergruppe, die
  Linie tritt **rechts auf halber Höhe** aus (entspricht Richtung LR), eine
  vertikale Sammelleiste (von erster bis letzter Kindmitte) verteilt mit
  durchgezogenen Abzweigen; Kinder rechts untereinander.
- **any of:** Austritt **unten links**, gestrichelte graue Abzweige.
- Merkregel: Austrittsseite codiert das Gate (rechts = und, unten = oder),
  Linienstil bestätigt es.

### Kompakt (transponiert, platzsparend)
- **Beide Gates** laufen **unten links** aus dem Parent heraus, Kinder
  untereinander — kein Rechts-Fächer, dadurch minimale Breite.
- Das Gate wird hier allein über den **Linienstil** codiert (siehe D15):
  und = durchgezogen (Tinte), oder = gestrichelt (Grau).

### Geometrie-Invarianten
- Knoten haben feste Zeilenhöhe (`line-height: 1.3`), damit Abzweige
  deterministisch auf Knotenmitte liegen (Offset 23 px = 5 px Listenabstand
  + halbe Knotenhöhe). Abzweige zielen auf den **Knoten**, nie auf die Mitte
  des Teilbaums.
- Dasselbe gilt **waagerecht**: Im horizontalen Fächer trifft der Stiel die
  **Knotenmitte**, nicht die Mitte der Zelle. Beides fällt nur zusammen, solange
  der Knoten in seiner Zelle zentriert steht — ein Knoten mit any-of-Kindern
  steht dort aber **linksbündig** (damit die Sammelleiste unter ihm aufsetzt),
  während seine Zelle so breit ist wie der Teilbaum. Der Stiel wird deshalb an
  der gemessenen Knotenmitte ausgerichtet.
- In den transponierten Modi (vertikal, kompakt) stehen untereinander
  gestapelte Geschwister mit **zusätzlichem Abstand nach unten** (damit das
  Größen-Badge oben rechts nicht mit den Tags unten rechts des darüber
  liegenden Knotens überlappt). Der Abstand wird nur **unterhalb** ergänzt, der
  23-px-Abzweig oben bleibt unverändert; die vertikal **zentrierten**
  all-of-Zwischenknoten bekommen ihn **symmetrisch**, damit ihr Abzweig
  (50 %-Höhe) weiterhin auf der Knotenmitte liegt.

### Kleiner Bildschirm (mobil)
Ab schmaler Breite (≤ 640 px, z. B. Smartphone) werden Diagramm und Texteditor
**gestapelt** und über den **Splitter** frei geteilt: Ziehen verteilt beliebig,
jederzeit erneut verstellbar; die beiden **Titelzeilen bleiben dabei immer
stehen** (jedes Panel schrumpft höchstens bis auf seine volle Titelzeile — die
Zeilen-Minima entsprechen den gemessenen Kopfhöhen). Ein **Antippen einer
Titelzeile klappt dieses Panel ganz aus** (das andere schrumpft auf seine
Titelzeile). Es gibt hier kein diskretes Minimieren/Einrasten mehr (kein Snap,
keine Min/Normal/Max-Buttons) — die Aufteilung ist durchgehend stufenlos.
Voreinstellung ist Diagramm maximiert (Editor als Titelzeile). Die **Legende**
bekommt hier einen eigenen
Umschalter im Editor-Kopf (statt der dauerhaften „AGENDA“-Zeile), damit sie
zugeklappt keinen Platz kostet. Der **Modus-Wähler** zeigt nur das aktive Icon
und schaltet bei jedem Tippen reihum weiter (horizontal → kompakt → vertikal →
…), spart also zwei Drittel der Breite. Die **Sprachwahl** zeigt eingeklappt
nur die aktive Sprache; ein Tipp darauf klappt die volle Leiste als **Overlay
über die Kopfzeile** auf (verdeckt die übrigen Bedienelemente, statt die Zeile
zu verbreitern), nach der Auswahl klappt sie wieder auf die gewählte Sprache
ein (Tipp daneben schließt ebenfalls). Die **Download-Buttons** (SVG/PNG mit
Text-Label) verbergen sich hinter einem einzelnen Download-Icon, das die
Formatwahl bei Bedarf als kleines **Dropdown-Overlay** unter der Kopfzeile
zeigt — sonst bräche die Titelzeile um; „Kopieren" bleibt sichtbar. Der
**Untertitel** wird auf eine garantiert einzeilige Kurzfassung reduziert.
Voreinstellung auf kleinem Bildschirm ist **Vollbild** (siehe D17).

### Günstigster Pfad (Kosten-Hervorhebung)
Ein Umschalter (Icon-Button im Diagramm-Kopf, Voreinstellung **an**, Zustand
persistiert) hebt den kostengünstigsten Weg durch den Baum hervor. Ermittelt
werden die für die günstigste Realisierung **nötigen** Knoten:

- **all of:** alle Kinder sind nötig.
- **any of:** nur die **günstigste** Alternative ist nötig. „Günstig" =
  kleinste rekursive Kosten (eigene T-Shirt-Größe plus — je Gate — Summe bzw.
  Minimum der Kinder). Bei Gleichstand gewinnt die **erste** Alternative.
- **Optionale Knoten (`+`, §3) sind nie nötig** — sie zählen weder zu den
  Kosten ihres Elternknotens noch liegen sie auf dem Pfad, und der Teilbaum
  unter ihnen ebenso wenig. Genau dafür gibt es das Zeichen: Ohne `+` rechnet
  der günstigste Pfad jede Zugabe ins Minimum ein und überschätzt es.
- Verworfene Knoten zählen nie mit (unabhängig vom „verworfene einblenden"-
  Filter).
- **Fehlende Größe wird als `M` gewertet** (nur für diese Kostenschätzung; die
  SPEC-Semantik der Größen in §5 bleibt unberührt).

Darstellung per **Inversion**: nicht benötigte Knoten (nicht-gewählte
any-of-Alternativen und optionale Knoten, je samt Teilbaum) treten zurück
(blass, entsättigt); der
günstige Pfad hebt sich dadurch von selbst ab — kein zusätzlicher Rahmen an den
ohnehin dichten Knoten-Ecken. Wo die Größe **implizit** als `M` angenommen wird,
zeigt der Knoten ein **invertiertes** Größen-Badge (weiß mit petrolfarbenem
Rand/Text statt gefüllt) mit erläuterndem Tooltip.

Zusätzlich fädelt eine **gestrichelte, geschwungene Petrol-Linie** durch die
**Endknoten (Blätter)** des Pfads (Katmull-Rom-Spline in Dokument-Reihenfolge,
in allen Modi). Die kräftige Linie liegt **hinter** den Knoten (nur in den
Lücken voll sichtbar), eine **abgetönte Kopie** davor deutet den Verlauf beim
Durchschreiten eines Knotens nur schwach an. An jedem echten Endknoten sitzt ein
großer, **blasser Petrol-Stationspunkt** (U-Bahn-Plan-Prinzip: der Knotentext
bleibt lesbar) — nur **durchquerte** Fremd- oder Zwischenknoten tragen keinen
Punkt, sodass eindeutig bleibt, welche Knoten auf dem Pfad **enden**. Linie,
abgetönte Kopie und Punkte erscheinen bei aktivem Umschalter auch im
Grafikexport. Siehe D18.

### Diagramm aus einer URL laden (`?sourceUrl=`)
Der Editor kann den Notationstext aus einer externen Textdatei beziehen:
`…?sourceUrl=https://example.org/plan.txt` (relative Angaben werden gegen die
Seite aufgelöst; zugelassen sind nur `http`/`https`). Der Text wird als
**eigenes Dokument** geführt, dessen **Name die URL** ist (vollständige URL im
Tooltip); derselbe Link aktualisiert dieses Dokument, statt ein neues anzulegen.
Ist der Parameter gesetzt, wird bei **jedem** Laden neu geholt — die URL ist die
Quelle der Wahrheit, lokale Änderungen daran überleben ein Neuladen nicht.
Scheitert das Laden (häufigster Fall: das Ziel sendet keinen
`Access-Control-Allow-Origin`-Header, außerdem 404/Netzfehler), bleibt der
bisherige Stand stehen und es erscheint eine **Warnung**. Siehe D23.

### Gemeinsam an einem Pad arbeiten (`?etherpad=`)
Für Zusammenarbeit in Echtzeit nimmt der Editor die Adresse eines
**Etherpad-Pads** — die Adresse, die im Browser steht, ohne Export-Pfad:
`…?etherpad=https://pad.example.org/p/mein-plan`. Werkbaum hängt den
Klartext-Export (`/export/txt`) selbst an; ein versehentlich mitgegebener
Export- oder `/timeslider`-Pfad wird abgeschnitten.

- **Das Pad ist die Schreibfläche, Werkbaum die Ansicht.** Alle bearbeiten den
  Notationstext im Pad, jeder Betrachter sieht das Diagramm mitwachsen. Das
  Zusammenführen gleichzeitiger Änderungen macht Etherpad; Werkbaum tut es
  nicht.
- Deshalb ist das Textfeld für ein solches Dokument **schreibgeschützt** — ein
  Knopf in der Editor-Titelzeile öffnet das Pad im neuen Tab. Ohne den Schutz
  verschwände getippter Text beim nächsten Abruf.
- Das Pad kann **im Editor-Panel eingebettet** werden. Ein Wähler in der
  Titelzeile schaltet reihum zwischen drei Ansichten: **Pad und Text** (beide,
  durch einen eigenen **Splitter** frei geteilt — Doppelklick setzt zurück),
  **nur Pad** und **nur Text**. Die Aufteilung wird für nebeneinander und
  gestapelt getrennt gehalten und bleibt erhalten.
  - Der schmal gezogene Textspiegel behält seinen Zweck: Der Sprung zwischen
    Diagramm und Text (§9) arbeitet auf ihm. In „nur Pad" ist er ausgeblendet —
    ein Sprung holt ihn dann selbst zurück, so wie er ein zugeklapptes
    Editor-Panel aufklappt.
  - Der Rahmen wird **nur geladen, wenn er sichtbar ist**. Ein geladenes Pad
    verbindet sich und zeigt dich in dessen Anwesenden-Liste; „nur Text" ist
    damit die Ansicht, die nichts von dir verrät.
- Geholt wird **auf Knopfdruck**, nicht selbsttätig: Ein Neu-laden-Knopf neben
  dem Pad-Knopf holt den aktuellen Stand. Etherpad **drosselt** den Export
  (serienmäßig 10 Abrufe je 90 s und IP); ein Hintergrund-Takt läuft dagegen an
  und bekommt am Ende gar nichts mehr. Läuft ein Abruf, dreht das Symbol — bei
  gedrosselter Gegenseite kann das bis zum Abbruch (20 s) dauern.
- Der Knopf greift gut mit „Was ist neu?" (§9) zusammen: drücken, und was seither
  in Produktion ging, leuchtet auf.
- **Name ist die vollständige Pad-URL** (nicht der bloße Pad-Name — zwei Pads
  gleichen Namens auf verschiedenen Hosts wären sonst nicht zu unterscheiden),
  wie bei `?sourceUrl=`. Identität und Name leiten sich von der **Pad**-Adresse
  ab, nicht von der Export-Adresse — derselbe Pad ergibt damit genau ein
  Dokument, gleich in welcher Schreibweise der Link kam.
- `?sourceUrl=` bleibt unverändert: statische Datei, einmal pro Laden geholt.
  Der eigene Parameter trägt gerade den Unterschied.
- Fehler (CORS, 404, Netz) melden sich wie bei `?sourceUrl=`. Ein **Abbruch**
  wegen Zeitablauf bekommt eine eigene Meldung, die die Drosselung benennt —
  die `?sourceUrl=`-Meldung zeigt auf CORS und schickte hier auf die falsche
  Fährte. Scheitert schon der erste Abruf, bleibt der Neu-laden-Knopf sichtbar
  und holt es nach; ein Neuladen der Seite ist nicht nötig.

Siehe D31.

### Legende im Editor-Panel
Neben dem Textfeld steht eine aufklappbare **Legende** (Notation in Kurzform,
abschließend eine Bedienungs-Zeile). Sie ist **scrollbar**, wenn ihr Inhalt
höher ist als der Platz, und über einen eigenen **Splitter** vom Textfeld
abgeteilt: horizontal nebeneinander (Legendenbreite), in den gestapelten Modi
und auf kleinem Bildschirm untereinander (Legendenhöhe). Ziehen verteilt frei,
Doppelklick stellt die Vorgabe wieder her; die Aufteilung bleibt für beide
Ausrichtungen getrennt erhalten. Die Legende belegt höchstens 85 % des Panels,
damit das Textfeld nie ganz verschwindet. Siehe D26.

### Was ist neu? (Dokumente von außen)
Bei Dokumenten, die von außen kommen (mitgeliefert, per `?sourceUrl=` oder
`?etherpad=`), wird
gezeigt, was sich seit dem letzten Besuch getan hat. **„Neu" heißt: neu in
Produktion** — ein Knoten trägt jetzt `[^]` und tat es in der zuletzt gesehenen
Fassung nicht. Solche Knoten bekommen einen **gelben Strahlenkranz** nach außen
(die Füllung bleibt die Statusfarbe aus §4). Ein Knopf im Diagramm-Kopf nennt
die Anzahl und bestätigt per Klick; danach ist die aktuelle Fassung die neue
Vergleichsbasis. Beim ersten Ansehen eines Dokuments leuchtet nichts. Der Kranz
erscheint weder im Druck noch im Grafikexport — er hängt am persönlichen
Besuchsstand. Siehe D28.

### Sprung zwischen Diagramm und Text
Jeder Knoten kennt seine Zeilennummer im Notationstext; beide Richtungen sind
verknüpft (siehe D25):

- **Diagramm → Text:** **Alt+Klick** auf einen Knoten markiert die zugehörige
  Zeile im Texteditor (ganze Zeile ausgewählt, in Sicht gescrollt, Fokus im
  Textfeld). Tastatur: **Alt+Enter** am fokussierten Knoten. Auf Touch-Geräten:
  **langer Druck** — nach ≥ 500 ms zeigt der Knoten einen Petrol-Ring („scharf"),
  der Sprung erfolgt beim **Loslassen**; ein Wischen bricht ab. Ist das
  Editor-Panel zugeklappt, öffnet der Sprung es zuerst. Der Sprung ist
  „hinschauen": Er holt **keine Bildschirmtastatur** herauf — die erscheint erst,
  wenn das Textfeld selbst angetippt wird.
- **Text → Diagramm:** Der Knoten der **Cursor-Zeile** wird im Diagramm
  hervorgehoben (weißer Halo + Ring in Tinte) und beim Zeilenwechsel ins Bild
  gescrollt. Zeilen ohne Knoten (Kommentar, Leerzeile, ausgeblendetes
  verworfenes Element) heben nichts hervor.
- Der **einfache** Klick bleibt unverändert der Link (§6): Ein Knoten mit URL
  öffnet sie weiterhin im neuen Tab. Deshalb Alt und nicht der einfache Klick.
- **Auffindbarkeit:** Solange **Alt gedrückt** ist, zeigen alle Knoten den
  Sprung-Cursor und der Knoten unter dem Zeiger einen Petrol-Ring — die Geste
  ist im Moment des Ausprobierens sichtbar, auch auf verlinkten Knoten. Dazu
  nennt der Knoten-Tooltip die Geste, und die aufklappbare Legende schließt mit
  einer Bedienungs-Zeile ab.
- Die Hervorhebung ist eine reine Editierhilfe: nicht im Grafikexport, nicht im
  Druck.

### Grafikexport des Diagramms
Das Diagramm wird aus der Live-Geometrie in ein eigenständiges SVG (nur Formen
+ Text, keine externen Ressourcen) nachgezeichnet. Zwei Icon-Schaltflächen:

- **Kopieren** — als **PNG** in die Zwischenablage. Es werden zwei Flavors
  geschrieben: `image/png` (das eigentliche Bild) und `text/html` mit
  eingebettetem PNG. Fällt der Bild-Clipboard ganz aus (fehlende
  `ClipboardItem`-Unterstützung), wird der **SVG-Quelltext** kopiert.
- **Herunterladen** — als Datei, zwei Schaltflächen mit Format-Label:
  **SVG** (`werkbaum-diagramm.svg`, Vektor) und **PNG**
  (`werkbaum-diagramm.png`, Raster). Der Datei-Weg ist der verlässliche Weg
  für Programme, die das Browser-Bild-Clipboard nicht erkennen. Manche
  Programme lesen auch das SVG nicht (z. B. LibreOffice) — dafür gibt es die
  PNG-Datei, die überall per „Bild einfügen“ importierbar ist.
- Übernommen werden Knotenfarben (Status §4), Größen-Badge, Tags und der
  Geister-Knoten; die Verbindungslinien werden je Gate neu gezogen
  (und = durchgezogen Tinte, oder = gestrichelt Grau) und treffen die Knoten
  unabhängig vom Darstellungsmodus.
- Es wird genau die **sichtbare** Struktur exportiert (der „verworfene
  einblenden“-Filter wirkt auch hier).

### Barrierefreiheit
Die visuell codierten Knoten-Eigenschaften werden für Screenreader in einem
sprechenden **`aria-label`** je Knoten zusammengefasst — Label, Status, Aufwand
(inkl. „(angenommen)“ beim impliziten M), Zuständige, ob der Knoten optional
(§3) und ob er verlinkt ist —, alles in der aktuellen UI-Sprache. Die rein visuellen Beiwerke
(Größen-Badge, Tags, ↗-Pfeil) sind `aria-hidden`, damit sie nicht kryptisch
doppelt vorgelesen werden. **Alle** Knoten sind fokussierbar (`tabindex="0"`
bzw. der Link selbst); die **Fokusreihenfolge entspricht der Dokument-/
Lesereihenfolge** (Wurzeln, dann Kinder in Tiefe). Ein sichtbarer
`:focus-visible`-Rahmen (Petrol) zeigt den Tastaturfokus. Der Warnungsbereich
ist eine **Live-Region** (`role="status"`, `aria-live="polite"`), sodass neue
Warnungen (z. B. gemischte Gates) angesagt werden.

### Druck
Ein `@media print`-Stylesheet reduziert die Seite auf das **Diagramm**:
Kopfzeile, Editor-Panel, Splitter, sämtliche Bedienelemente (Diagramm-Kopf),
Warnungen und Footer werden ausgeblendet; das Diagramm füllt die Seite und darf
über mehrere Seiten laufen. Die **Statusfarben** werden bewusst mitgedruckt
(`print-color-adjust: exact`), Knoten brechen nicht über den Seitenrand
(`break-inside: avoid`), und der Günstigster-Pfad-Overlay wird mitgedruckt.
Sehr breite Bäume laufen bei 100 % über die Seitenbreite hinaus — dann im
Druckdialog „an Seite anpassen“ bzw. Querformat wählen.

## 10. Beispiel (kanonisch)

```
%% Projektstruktur – Stand Sprint 14
[~] Website-Relaunch (XL) https://wiki.example.de/relaunch
  - [x] Konzeption (M)
    - [x] Zielgruppenanalyse (S)
    - [x] Sitemap (XS)
  - [~] Umsetzung (XL)
    - [/] Frontend (S) https://git.example.de/frontend @anna
    - [ ] Backend (L) @ben @carla
    + [?] Dark Mode (S)  %% Zugabe, nicht erforderlich
    - [ ] CMS-Anbindung (M)
      | [ ] WordPress
      | [?] Headless CMS
      | [-] Eigenentwicklung  %% Aufwand zu hoch
  - [?] Hosting (M)
    | Cloud
    | On-Premise
```

## 11. Reservierte Erweiterungen (noch nicht implementiert)

- `#123` — Referenz auf externe Tickets (geplant für Taiga-Integration).
- `#tag` — freie Schlagworte (deshalb `#` nicht anderweitig verwenden).

## 12. Dateiendung

- Notationstexte tragen die Endung **`.werkbaum`**, Kodierung UTF-8,
  Zeilenende LF. Beispiele: `docs/examples/*.werkbaum`.
- Die Endung ist **Konvention, kein Vertrag**: Der Parser sieht nur Text, und
  das Laden per `?sourceUrl=` (§9) wertet weder Endung noch `Content-Type` aus.
  `.txt` und endungslose Dateien bleiben damit gültig.
- Es gibt keinen registrierten MIME-Typ; wer selbst ausliefert, nimmt
  `text/plain; charset=utf-8` (dann zeigt der Browser die Datei an, statt sie
  herunterzuladen). Siehe D24.
