# WBS-Notation – Spezifikation

Textuelle Notation für Projektstrukturpläne (Work Breakdown Structure) mit
Und/Oder-Zerlegung. Diese Datei ist die verbindliche Sprachdefinition.
Syntaxänderungen werden zuerst hier dokumentiert, dann implementiert.

## 1. Zeilenformat

```
[Einrückung][Zeichen] [Faltmarke] [Statusbox] Label (Größe) URL @tag … !!! %% Kommentar
```

Alle Bestandteile außer dem Label sind optional. Die Extraktion erfolgt in
dieser Reihenfolge (wichtig für Kollisionsfreiheit):

1. Kommentar entfernen: alles ab `%%` bis Zeilenende.
2. Einrückung, Zeichen (`-` / `+` / `|` / `=`), Faltmarke (`>` / `<`) und
   Statusbox `[…]` per Zeilen-Regex; `=` nur mit folgendem Leerraum (§3),
   die Faltmarke ebenso (siehe unten).
3. URL: erstes Token, das auf `https?://\S+` passt (dadurch stören `@` in URLs nicht).
4. Größe: erstes `(XS|S|M|L|XL|XXL)`, Groß-/Kleinschreibung egal.
5. Tags: alle `@name`-Vorkommen.
6. Knoten-ID: das **erste** alleinstehend angesetzte `#name`-Token (siehe unten).
7. Abhängigkeiten: alle alleinstehend angesetzten `:#a,#b`-Token (siehe unten).
8. Fokusmarke: `!!!` als **alleinstehendes** Token (siehe unten).
9. Rest, whitespace-normalisiert = Label. Leeres Label ⇒ Zeile ignorieren.

**Faltmarke `>` / `<`** — bestimmt, wie das Dokument **eröffnet** wird:

- Steht **zwischen** Zerlegungszeichen und Statusbox (`- > [x] Backend`); bei
  Wurzelknoten (ohne Zeichen) am Zeilenanfang. Erkannt nur mit **folgendem
  Leerraum** — `- >Achtung` bleibt damit ein Label. Begründung der Stellung:
  D34-Nachtrag.
- `>` heißt: der Teilbaum dieses Knotens ist beim Öffnen **eingeklappt**.
- `<` innerhalb eines eingeklappten Bereichs holt den **eigenen Teilbaum**
  gezielt wieder hervor (Mechanik: §9).
- Die Marken bestimmen nur den **Anfangszustand** — im Diagramm wird danach
  unabhängig vom Text gefaltet (§9). Sie sagen nichts über Fortschritt (§4)
  oder Notwendigkeit (§3) und ändern weder Kosten noch Warnungen.

**Knoten-ID `#name`** — benennt einen Knoten im **ganzen Dokument** eindeutig;
sie ist die Adresse für Abhängigkeiten und Beschreibungsblöcke (§11).

- Zeichenmenge wie bei `@name` (§7): Unicode-Buchstaben, Ziffern, `.`, `_`, `-`.
  (Enger als das frühere „whitespace-frei“ aus §11 — Begründung: D36.)
- Erkannt nur **alleinstehend angesetzt** (`(^|\s)#…`): „C#“ bleibt damit ein
  Label, und der für Abhängigkeiten reservierte Doppelpunkt `:#a,#b` (§11)
  kollidiert nicht.
- Das **erste** solche Token der Zeile ist die ID; weitere `#`-Token bleiben im
  Label stehen (dort liegt die reservierte Ticket-Referenz `#123`, §11). Eine
  rein numerische ID ist zugleich die künftige Ticket-Referenz — oft ist die
  Ticket-Nummer die natürliche Knoten-ID (D34).
- Die ID gehört **nicht** zum Label. Eine eigene Darstellung im Diagramm hat
  sie (noch) nicht; sichtbar ist sie im Knoten-Tooltip und im `aria-label`.
- **Doppelte ID:** Warnung `duplicateId` mit beiden Zeilennummern; die spätere
  ID gilt trotzdem am Knoten (fehlertolerant wie §4 — die Zeile geht nicht
  verloren).

**Abhängigkeiten `:#a,#b`** — der Knoten hängt von den Knoten mit diesen IDs
ab, auch außerhalb seines eigenen Teilbaums.

- Die Liste ist **ein zusammenhängendes Token**: Doppelpunkt, dann
  kommagetrennt je ID mit `#`, **ohne Leerraum**. `:#a, #b` liest nur `#a` —
  das ` #b` dahinter ist ein alleinstehendes Token und damit die Knoten-ID
  (siehe oben). Mehrere Listen je Zeile werden zusammengeführt.
- Erkannt nur **alleinstehend angesetzt** (`(^|\s):#…`, enger als die frühere
  §11-Formulierung — Begründung: D37): Ein Doppelpunkt im Label bleibt Label,
  und eine **eingeklammerte Erwähnung** wie `(:#auth,#api)` bleibt Label —
  dieselbe Zitier-Konvention wie `(#auth)` bei der Knoten-ID.
- Abhängigkeiten sagen **nichts über Reihenfolge oder Startzeitpunkt** — sie
  sagen etwas über den **Status** (effektiver Status, §11). Das trennt
  Werkbaum von einem Netzplan.
- **Zyklen sind zulässig** und bedeuten: diese Knoten werden gemeinsam fertig.
  Kein Fehler, keine Warnung — auch die Abhängigkeit auf sich selbst nicht.
  Vorwärts-Referenzen (Ziel steht weiter unten) sind normal.
- Eine ID ohne zugehörigen Knoten: Warnung `unknownDep` mit Zeilennummer.
- Sichtbar im Tooltip (`→ #a, #b`) und im `aria-label`; die Querverbindungen
  im Diagramm sind reserviert (§11).

**Fokusmarke `!!!`** — „schau hier hin": Der Knoten wird im Diagramm
hervorgehoben und ins Bild geholt (§9). Gedacht für das gemeinsame Arbeiten an
einem Pad (§9, `?etherpad=`): Weil dort niemand den Cursor der anderen sieht,
ist eine Marke **im Text** der einzige Weg, auf eine Stelle zu zeigen — und sie
hat etwas, das ein Cursor nicht hat: **alle** sehen dieselbe Stelle.

- Erkannt nur **alleinstehend**, also am Zeilenanfang/-ende oder von Leerraum
  umgeben. `Achtung!!!` bleibt damit ein gewöhnliches Label; auch `!!!`
  innerhalb einer URL bleibt Teil der URL.
- Die Marke gehört **nicht** zum Label und ist an jeder Position der Zeile
  zulässig. Mehrere Marken sind erlaubt: alle markierten Knoten werden
  hervorgehoben, ins Bild geholt wird der **erste**.
- Sie sagt nichts über Fortschritt (§4) oder Notwendigkeit (§3) — eine dritte,
  unabhängige Achse.
- Sie bleibt im Text stehen, bis jemand sie löscht; ein Werkzeug entfernt sie
  nicht von selbst.

**Beschreibungszeilen (`"`) und Beschreibungsteil (`---`)** — erläuternder
Text zu einem Knoten (Anzeige: §9):

- **Kurzform:** Eine Zeile, deren erstes Zeichen nach der Einrückung `"` ist
  (**mit folgendem Leerraum**, Leerraum-Regel wie bei `=` und `>`/`<` — ein
  Label wie `"Zitat"` bleibt ein Label), ist **Beschreibung, kein Knoten**.
  Sie gehört zum **vorangehenden Knoten**; mehrere `"`-Zeilen setzen dieselbe
  Beschreibung fort. Die Einrückung der Zeile hat keine Bedeutung (Konvention:
  wie ein Kind eingerückt); ohne vorangehenden Knoten: Warnung `descStray`.
  Nur auf Zeilen **ohne** Zerlegungszeichen — `- " Zitat" …` bleibt ein
  gewöhnlicher Knoten.
- **Langform:** Eine Zeile aus **drei oder mehr `-`** (nur Bindestriche,
  umgebender Leerraum erlaubt) trennt den Baumteil vom **Beschreibungsteil**;
  alles danach gehört zu ihm (YAML-/Frontmatter-Konvention). Es gibt keinen
  Schlusszaun — er kann also nicht vergessen werden. Dort eröffnet eine
  **uneingerückte Zeile mit genau einer Knoten-ID** (`#auth`, allein) einen
  Block; die **eingerückten** Zeilen darunter sind sein Text (um den Einzug
  gekürzt, Leerzeilen bleiben als Absatztrenner). Die Wurzelknoten-Regel (§2)
  gilt hinter dem Trenner nicht mehr. Weitere `---`-Zeilen dort sind ohne
  Bedeutung.
- **Fehlertoleranz:** ID ohne Knoten → `unknownDesc`; uneingerückte
  Nicht-ID-Zeilen und eingerückte Zeilen ohne offenen Block → `descStray`, je
  mit Zeilennummer. Ein versehentlicher Trenner mitten im Plan meldet die
  verschluckten Knotenzeilen so zeilengenau selbst.
- Der Inhalt ist **Freitext** — die Extraktion aus diesem Abschnitt findet
  darin nicht statt; nur `%%`-Kommentare fallen weiterhin als Erstes weg.
  Mehrere Blöcke und Kurz- und Langform zum selben Knoten werden in
  Dokumentreihenfolge aneinandergehängt.
- Bewusste Verhaltensänderungen: `---` ergab früher einen Knoten mit Label
  `--`; eine zeichenlose `" `-Zeile war früher ein Wurzelknoten.

Referenz-Regex der Implementierung:

```
^([ \t]*)([-|+]|=(?=[ \t]))?\s*(?:([><])(?=[ \t])\s*)?(?:\[([ ?~xX^/-])\]\s*)?(.*)$
```

Für die Knoten-ID (Schritt 6, nur der erste Treffer):

```
(^|\s)#([\p{L}\p{N}._-]+)
```

Für die Abhängigkeiten (Schritt 7, alle Treffer):

```
(^|\s):#([\p{L}\p{N}._-]+(?:,#[\p{L}\p{N}._-]+)*)
```

Für die Fokusmarke (Schritt 8):

```
(^|\s)!!!(?=\s|$)
```

## 2. Hierarchie

- Die Einrückung bestimmt die Ebene. Es gibt keine feste Schrittweite:
  Elternknoten ist die nächste vorangehende Zeile mit **kleinerer**
  Einrückungsbreite (Tab zählt als 2 Leerzeichen).
- Zeilen ohne Zeichen (`-`/`+`/`|`/`=`) sind Wurzelknoten. Mehrere Wurzeln =
  mehrere Bäume nebeneinander.

## 3. Zerlegungsart (Gate)

| Zeichen | Bedeutung | Semantik |
|---|---|---|
| `-` | all of (Und-Zerlegung) | Alle Teilpakete sind erforderlich. |
| `+` | optional (Zugabe) | Einzelnes zusätzliches Teilpaket, nicht erforderlich. |
| `\|` | any of (Oder-Zerlegung) | Mindestens eine Alternative wird gewählt. |
| `=` | exactly one (XOR-Zerlegung) | Genau eine Alternative wird realisiert. |

- `-`, `|` und `=` sind Eigenschaften der **Geschwistergruppe**; `+` ist eine
  Eigenschaft des **einzelnen Knotens** (er hängt an derselben Und-Zerlegung,
  ist darin aber entbehrlich).
- Daraus folgt die Mischregel: Eine Gruppe ist entweder **konjunktiv** — dann
  dürfen `-` und `+` frei nebeneinander stehen — oder **disjunktiv**
  (einheitlich `|` oder einheitlich `=`). Jede andere Mischung ist ungültig:
  Darstellung nach dem **ersten** Kind, plus Warnung `mixedGate` mit
  Zeilennummer.
- **Leerraum-Regel:** Als Gate wird `=` nur mit **folgendem Leerraum** erkannt —
  ein Label wie `=SUMME(A1:B2)` bleibt damit ein Label. `=` ist das einzige
  Gate, das diese Regel braucht; für `-`/`+`/`|` ändert sich nichts.
- **XOR-Regel:** In einer `=`-Gruppe darf genau **eine** Alternative realisiert
  werden. **Realisiert** heißt: Kosten sind investiert oder mehr — Status `[~]`,
  `[/]`, `[x]` oder `[^]` (§4); `[?]`, `[ ]`, `[!]`, `[-]` und neutrale Knoten
  zählen nicht. Jede **weitere** realisierte Alternative ergibt eine Warnung
  `xorConflict` mit ihrer Zeilennummer. Die Regel ist verletzbar, kein
  Parse-Fehler: Der Baum wird unverändert dargestellt. Für den günstigsten
  Pfad (§9) verhält sich `=` wie `|` — der wählt ohnehin genau eine.
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

**Intrinsischer und effektiver Status (Abhängigkeiten, §1).** Der Status in
der Box ist der **intrinsische** — der Bearbeitungsstand des Knotens selbst.
Der **effektive** Status berücksichtigt die Abhängigkeiten: Ein Knoten kann
effektiv nicht weiter sein als das, was er braucht.

- **Fortschritts-Rang** entlang der Ergebnis-Skala (D5):
  `[?]` 0 · `[ ]` 1 · `[~]` 2 · `[/]` 3 · `[x]` 4 · `[^]` 5. Außerhalb der
  Skala zählen neutrale Knoten und `[-]` als Rang 0 („nichts Anrechenbares“),
  `[!]` als Rang 1 (Absicht ohne Investition, D35).
- **Effektiver Rang = Minimum des intrinsischen Rangs über die
  Abhängigkeits-Hülle**: der Knoten selbst plus alles, was er per `:#…` direkt
  oder mittelbar braucht. Zyklen brauchen keine Sonderregel — alle Knoten
  eines Zyklus teilen so von selbst ihr Minimum („wird gemeinsam fertig“, §1).
  Unbekannte IDs zählen nicht (sie sind schon gewarnt); bei doppelter ID gilt
  die **erste** Vergabe (D36).
- Der effektive Status wird **gerechnet, nie geschrieben** (D14: der Text ist
  die eine Quelle der Wahrheit). Darstellung: §9; Begründung: D39.

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

**XOR-Gruppen (`=`, §3)** werden wie any-of gezeichnet (gestrichelt in Grau,
gleiche Anordnung). Zusätzlich sitzt am **Austritt der Sammelleiste** — auf dem
Stück zwischen Elternknoten und erstem Abzweig — eine kleine **„1“-Plakette**
(weißer Kreis mit grauem Rand, graue Ziffer): „genau eine“. Sie erscheint auch
im Grafikexport. Siehe D35.

**Knotenbeschreibungen (§1)** erscheinen im **Tooltip** des Knotens (zuerst
der Text, dann die Kurz-Fakten wie ID und Abhängigkeiten) und im
`aria-label`. Ein Knoten mit Beschreibung trägt eine kleine **”-Marke** hinter
dem Label — sie macht die sonst unsichtbare Beschreibung auffindbar und
spiegelt das `"`-Zeichen der Notation. Die Marke erscheint **nicht** im
Grafikexport: Der Text selbst kann dort nicht angezeigt werden, eine Marke
ohne Ziel wäre Rauschen. Siehe D40.

**Die Knotenfarbe zeigt den effektiven Status (§4)**, nicht den intrinsischen —
das Diagramm beantwortet „wie weit ist das wirklich?“. Wo der eigene Status
**weiter** ist als der effektive (der Knoten wird von Abhängigkeiten
zurückgehalten), sitzt unten links eine kleine **Status-Marke** mit der
eigenen Statusbox (z. B. `[x]`) in den §4-Farben des intrinsischen Status;
Tooltip und `aria-label` benennen beide. Ohne Diskrepanz ändert sich nichts —
und für die XOR-Regel (§3) und „Was ist neu?“ (unten) zählt weiterhin der
**intrinsische** Status: Investiert ist investiert, und `[^]` im Text bleibt
die Deploy-Aussage. Marke und Färbung erscheinen auch im Grafikexport und im
Druck. Siehe D39.

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

**Mit Abhängigkeiten (§1) zählt die Dependency Closure.** Jeder nötige Knoten
zieht seine `:#…`-Ziele samt deren Realisierung in die nötige Menge; gemeinsam
Gebrauchtes zählt über die Mengen-Vereinigung nur **einmal**. Regeln:

- Abhängigkeiten ziehen ihr Ziel auch dann, wenn es **optional** ist oder in
  einer **nicht gewählten Alternative** steht — gebraucht ist gebraucht; im
  Diagramm bleibt so ein einzelner heller Knoten in einem zurückgetretenen
  Zweig stehen. Nur **verworfene** Ziele werden nie gezogen (verworfen zählt
  nie); dass so ein Knoten nicht fertig werden kann, zeigt der effektive
  Status (§4).
- Damit ist die Wahl je Alternativgruppe **nicht mehr lokal**: Eine teurere
  Alternative kann gewinnen, weil ihre Abhängigkeiten anderswo ohnehin
  bezahlt werden. **Verfahren (D42): erschöpfende Suche** über die
  **gekoppelten** Gruppen (Gruppen, deren Teilbäume Abhängigkeiten enthalten
  oder gebraucht werden); alle übrigen wählen lokal wie bisher, bei
  Gleichstand die erste. Wird die Suche zu groß, rechnet die Anzeige **gierig
  und sagt es** — Warnung `cheapApprox`, zeilenlos.

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
- **Text → Diagramm, ausdrücklich:** **Alt+Klick** im Textfeld (Tastatur:
  **Alt+Enter**) holt den Knoten der Cursor-Zeile in die **Mitte** des Diagramms
  und gibt ihm den Tastaturfokus — dieselbe Geste in beide Richtungen. Sie
  ergänzt das Mitlaufen der Cursor-Zeile: Das scrollt bewusst nur so weit wie
  nötig und nur beim Zeilenwechsel (sonst ruckelte das Diagramm beim Tippen).
  Wer einen Knoten wirklich **sehen** will, sagt es mit Alt. Auf einer Zeile ohne
  Knoten geschieht nichts.
- Der **einfache** Klick bleibt unverändert der Link (§6): Ein Knoten mit URL
  öffnet sie weiterhin im neuen Tab. Deshalb Alt und nicht der einfache Klick.
- **Auffindbarkeit:** Solange **Alt gedrückt** ist, zeigen alle Knoten den
  Sprung-Cursor und der Knoten unter dem Zeiger einen Petrol-Ring — die Geste
  ist im Moment des Ausprobierens sichtbar, auch auf verlinkten Knoten. Dazu
  nennt der Knoten-Tooltip die Geste, und die aufklappbare Legende schließt mit
  einer Bedienungs-Zeile ab.
- Die Hervorhebung ist eine reine Editierhilfe: nicht im Grafikexport, nicht im
  Druck.

### Zeilennummern im Texteditor
Links neben dem Textfeld steht ein schmaler Streifen mit den **Zeilennummern** —
dieselben, die die Warnungen nennen („Zeile 12: …", §4). Ohne ihn muss man sie
im Text abzählen.

- Gezählt werden **logische** Zeilen des Notationstexts. Eine weich umbrochene
  Zeile behält **eine** Nummer; die Nummer steht an ihrer ersten Bildzeile.
- Die **Cursor-Zeile** und Zeilen mit einer **Warnung** heben sich ab (Warnung in
  `--warn`, `#B45309`) — genau die beiden Fälle, für die man hinsieht.
- Reine Lesehilfe: kein Bestandteil des Notationstexts, nicht im Grafikexport
  und nicht im Druck (dort ist ohnehin nur das Diagramm zu sehen).

Siehe D33.

### Fokusmarke im Diagramm (`!!!`, §1)
Ein mit `!!!` markierter Knoten trägt einen **Strahlenkranz in Petrol** —
kräftiger Ring in `--or` (`#0F766E`) plus leuchtender Schein in hellem Teal
(`#14B8A6`) — und wird ins Bild geholt. Gebaut wie der gelbe Kranz für „neu in
Produktion" (§9): Schein nach **außen**, damit die Knotenfüllung dem Status (§4)
gehört und lesbar bleibt. Kein Blinken.

- **Die Farbe trägt die Bedeutung:** Gelb heißt „seit deinem letzten Besuch live
  gegangen" (eine stehende Tatsache), Petrol heißt „jemand zeigt gerade hierauf"
  (ein Zuruf). Beides kann zugleich zutreffen und muss darum unterscheidbar
  bleiben; trifft es zusammen, wird der Ring petrol und der Schein gelb.
- Trifft die Marke mit der **Cursor-Zeile** zusammen, liegt der Tinte-Ring innen
  und der Schein außen — die eigene Cursor-Position und der fremde Zuruf bleiben
  so auseinanderzuhalten.
- Ins Bild geholt wird nur, wenn sich die Marke **ändert** — sonst zöge das
  Diagramm bei jedem Neubau den Blick zurück und man könnte nicht wegscrollen.
- Wie die Cursor-Zeile erscheint sie **nicht** im Druck und **nicht** im
  Grafikexport: Sie sagt „schau jetzt hierhin", nicht „so ist der Plan".

### Ein- und ausklappbare Teilbäume (`>` / `<`, §1)
Jeder Knoten mit sichtbaren Kindern trägt ein kleines **Falt-Zeichen** vor dem
Label: **▾** offen, **„▸ n“** eingeklappt (n = Zahl der verborgenen Knoten).
Klick auf das Zeichen klappt um — der einfache Klick auf den Knoten selbst
bleibt der Link (§6); Tastatur: **←** klappt zu, **→** klappt auf am
fokussierten Knoten (WAI-ARIA-Baum-Idiom).

- **Anfangszustand aus dem Text (§1):** `>` klappt ein. `<` holt seinen
  Teilbaum hervor, indem die Faltung die Pfad-Ebenen **hinunterwandert**:
  Jeder eingeklappte Vorfahr öffnet sich, seine übrigen Kinder stehen
  stattdessen als einzelne eingeklappte Knoten da — sichtbar ist genau der
  Pfad samt Teilbaum, der Rest bleibt kompakt. Ein `>` **innerhalb** des
  hervorgeholten Teilbaums bleibt respektiert.
- Auch ein **`!!!`-markierter Knoten** (§1) holt sich auf diese Weise hervor —
  ein Zeigefinger auf etwas Unsichtbares zeigte ins Leere.
- Der interaktive Eingriff gilt **je Knoten** (Identität = Label-Pfad, wie bei
  „Was ist neu?“) und **für die Sitzung**; er wird nicht gespeichert — die
  dauerhafte Aussage steht im Text (D34). Ein Dokumentwechsel setzt zurück.
- Faltung ist **reine Ansicht**: Warnungen aus eingeklappten Teilbäumen werden
  weiter gemeldet (sie gelten dem Text), und der günstigste Pfad rechnet
  unverändert über den ganzen Baum — seine Linie zeigt nur die sichtbaren
  Endknoten.
- **Export und Druck folgen der sichtbaren Faltung** (dieselbe Regel wie beim
  „verworfene einblenden“-Filter): Verborgene Teilbäume fehlen, eingeklappte
  Knoten behalten die Kennzeichnung „▸ n“ — das Bild behauptet damit keine
  Vollständigkeit. Das ▾ offener Knoten ist ein Bedienelement und erscheint
  weder im Export noch im Druck.

Siehe D38.

### Querverbindungen der Abhängigkeiten (`:#…`, §1)
Abhängigkeiten werden als **optisch sekundäre** Kanten gezeichnet: dünn,
blassgrau (`#6B7A8C`), **gepunktet** und **geschwungen** — Punktierung und
Krümmung unterscheiden sie doppelt von den Baumlinien (durchgezogen bzw.
gestrichelt, immer orthogonal) und halten sie zurückhaltend — auf einer
eigenen Zeichenebene **hinter** den Knoten, mit einer kleinen **offenen
Pfeilspitze auf das Gebrauchte** („braucht“-Richtung; ein Winkel aus zwei
Strichen, kein gefülltes Dreieck). Der Baum trägt weiterhin die Hauptaussage.

- Die Kanten des **ausgewählten** Knotens — Tastaturfokus im Diagramm, sonst
  der Knoten der Cursor-Zeile — liegen hervorgehoben in Tinte auf einer
  vorderen Ebene, ein- wie ausgehende.
- Kanten zu gerade nicht sichtbaren Knoten (eingeklappt §9, verworfen
  ausgeblendet §4) entfallen; bei doppelter ID zielt die Kante auf die erste
  Vergabe (D36/D39).
- Die Basis-Kanten erscheinen auch im **Grafikexport** und im **Druck**; die
  Hervorhebung ist Interaktion und erscheint nicht. Siehe D41.

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

Vergebene Zeichen und geplante Schreibweisen. **Reserviert heißt: nicht
anderweitig verwenden** — nicht: schon entschieden. Die endgültige Schreibweise
wird hier festgelegt, **bevor** sie gebaut wird; wo unten „offen“ steht, ist sie
das auch. Begründung und Zusammenhang: D34.

### Referenzen und Knoten-IDs (`#`)

- `#123` — Referenz auf externe Tickets (geplant für Taiga-Integration).
  Ticket-Referenzen werden **so** notiert, weil es die etablierte
  Kurzschreibweise ist; sie haben unter den `#`-Verwendungen Vorrang.
- `#auth` — **Knoten-ID**: **umgesetzt**, Definition jetzt in §1 (Zeichenmenge,
  Alleinstehend-Regel, Warnung `duplicateId`). Ziel für Abhängigkeiten und
  Beschreibungsblöcke (siehe unten).

Beide Rollen vertragen sich: Oft **ist** die Ticket-Nummer die natürliche
Knoten-ID. Als Ticket-Link behandelt wird heuristisch das rein **numerische**
`#123`; wo das nicht reicht, schafft eine Präfix-Konvention (z. B. `#t123`)
Eindeutigkeit. Freie Schlagworte liegen **nicht** mehr auf `#` — siehe `&tag`
unten; damit ist die frühere Dreifach-Rolle von `#` aufgelöst (D34).

### Schlagworte (`&tag`) — reserviert, bewusst ungebaut

- `&tag` — freies Schlagwort: benennt eine **Menge** von Knoten quer zur
  Hierarchie (die ID benennt genau einen). Mehrere pro Zeile, Position egal,
  gleiche Zeichenmenge wie `@name` (§7: Unicode-Buchstaben, Ziffern, `.`,
  `_`, `-`).
- Erkannt nur **alleinstehend** angesetzt (`(^|\s)&\w`, wie `!!!` in §1) —
  „R&D“ und „Drag & Drop“ bleiben damit gewöhnliche Labels.
- **Niedrig priorisiert:** Ohne ein Feature, das Schlagworte auswertet
  (Filter-/Hervorheben-Linse, Taiga-Label-Sync), sind sie nur Kommentare mit
  Extra-Syntax — gebaut werden sie erst **zusammen mit** dem ersten solchen
  Konsumenten. Bis dahin gilt allein: `&` nicht anderweitig vergeben.

### Abhängigkeiten zwischen Knoten (`:#auth,#api`)

Die **Schreibweise ist umgesetzt** — Definition jetzt in §1 (Token-Vertrag,
Alleinstehend-Regel, Zyklen zulässig, Warnung `unknownDep`). Offen sind die
**Konsumenten**: der effektive Status, die Querverbindungen im Diagramm und
die Closure-Rechnung des günstigsten Pfads (alle drei unten).

### Intrinsischer und effektiver Status

**Umgesetzt** — Rechenregel in §4 (Fortschritts-Rang, Minimum über die
Abhängigkeits-Hülle), Darstellung in §9 (Knotenfarbe = effektiver Status,
Diskrepanz-Marke unten links). Siehe D39.

### Querverbindungen im Diagramm

**Umgesetzt** — siehe §9 (Querverbindungen der Abhängigkeiten): eigene
SVG-Zeichenebene, gekrümmte blassgraue Kanten mit Pfeilspitze hinter den
Knoten, Hervorhebung am ausgewählten Knoten. Begründung: D41.

### Günstigster Pfad mit Abhängigkeiten

**Umgesetzt** — siehe §9 (Dependency Closure): Vereinigung statt Teilbaum,
gemeinsam Gebrauchtes zählt einmal, erschöpfende Suche über die gekoppelten
Gruppen mit benanntem gierigem Rückfall. Begründung: D42.

### Knotenbeschreibungen (`"` und `---`)

**Umgesetzt** — Schreibweise in §1 (Kurzform als `"`-Zeile, Langform als
ID-Blöcke im `---`-Beschreibungsteil), Anzeige in §9 (Tooltip, ”-Marke).
Entscheidung und verworfene Alternativen: D34-Nachtrag, D40.

## 12. Dateiendung

- Notationstexte tragen die Endung **`.werkbaum`**, Kodierung UTF-8,
  Zeilenende LF. Beispiele: `docs/examples/*.werkbaum`.
- Die Endung ist **Konvention, kein Vertrag**: Der Parser sieht nur Text, und
  das Laden per `?sourceUrl=` (§9) wertet weder Endung noch `Content-Type` aus.
  `.txt` und endungslose Dateien bleiben damit gültig.
- Es gibt keinen registrierten MIME-Typ; wer selbst ausliefert, nimmt
  `text/plain; charset=utf-8` (dann zeigt der Browser die Datei an, statt sie
  herunterzuladen). Siehe D24.
