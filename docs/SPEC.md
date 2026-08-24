# WBS-Notation – Spezifikation

Textuelle Notation für Projektstrukturpläne (Work Breakdown Structure) mit
Und/Oder-Zerlegung. Diese Datei ist die verbindliche Sprachdefinition.
Syntaxänderungen werden zuerst hier dokumentiert, dann implementiert.

## 1. Zeilenformat

```
[Einrückung][Zeichen] [Statusbox] [Faltmarke] Label (Größe) URL @tag … !!! %% Kommentar
```

Alle Bestandteile außer dem Label sind optional. Die Extraktion erfolgt in
dieser Reihenfolge (wichtig für Kollisionsfreiheit):

1. Kommentar entfernen: alles ab `%%` bis Zeilenende.
1b. Fortsetzung: Endet die Zeile jetzt auf Leerraum + `\`, gehört die
   Folgezeile noch dazu (siehe unten). Erst danach ist die Zeile vollständig.
2. Einrückung, Zeichen (`-` / `+` / `|` / `=`), Statusbox `[…]` und Faltmarke
   (`>` / `<`) per Zeilen-Regex; `=` nur mit folgendem Leerraum (§3),
   die Faltmarke ebenso (siehe unten).
3. URL: erstes Token, das auf `https?://\S+` passt (dadurch stören `@` in URLs nicht).
4. Größe: erstes `(XS|S|M|L|XL|XXL)`, Groß-/Kleinschreibung egal.
5. Tags: alle `@name`-Vorkommen.
6. Knoten-ID: das **erste** alleinstehend angesetzte `#name`-Token (siehe unten).
7. Abhängigkeiten: alle alleinstehend angesetzten `:#a,#b`-Token (siehe unten).
8. Fokusmarke: `!!!` als **alleinstehendes** Token (siehe unten).
9. Rest, whitespace-normalisiert = Label. Leeres Label ⇒ Zeile ignorieren —
   **außer** die Zeile trägt eine Knoten-ID; dann wird `#id` das Label
   (siehe unten).

**Fortsetzungszeile `\`** — eine lange Zeile darf auf mehrere Textzeilen
verteilt werden, ohne dass ein neuer Knoten entsteht:

- Endet eine Zeile — **nach** dem Entfernen des Kommentars — auf **Leerraum und
  dann `\`** als letztem Zeichen, wird die **Folgezeile angehängt**: Der `\`
  entfällt, die Einrückung der Folgezeile entfällt, verbunden wird mit **genau
  einem Leerzeichen**. Mehrere `\` hintereinander setzen die Zeile über
  entsprechend viele Textzeilen fort.
- **Leerraum davor ist Pflicht** (`… \`, nicht `…\`) — dieselbe Sorte Regel wie
  bei `=`, `>`/`<` und `"`, nur an der anderen Seite des Zeichens. Sie hält
  Labels heraus, die selbst auf einen Backslash enden (`C:\temp\`): Ohne sie
  verschluckte so eine Zeile stumm den folgenden Knoten. Der Preis ist die
  umgekehrte Verwechslung — wer aus der Shell `…\` gewohnt ist, bekommt keine
  Fortsetzung —, und die ist die harmlosere: Die Zeile bleibt stehen, was man
  sofort sieht.
- **Alles gehört zur ersten Zeile:** Ihre Einrückung bestimmt die Ebene (§2),
  ihre Nummer nennen die Warnungen, und Werkzeuge, die zurückschreiben
  (Faltmarke §9, ID-Kurzform §9), fassen nur sie an. Der Cursor in einer
  Fortsetzungszeile wählt den Knoten der ersten aus (§9, Sprung).
- Ein Token darf **nicht** über den Umbruch hinweg getrennt werden — verbunden
  wird mit einem Leerzeichen, eine zerschnittene URL bleibt zerschnitten.
- Gilt nur im **Baumteil**. Im Beschreibungsteil hinter `---` (siehe unten) sind
  Zeilenumbrüche Absatzstruktur; ein `\` bleibt dort gewöhnlicher Text.
- Steht der `\` in der **letzten** Zeile der Datei, gibt es nichts anzuhängen:
  Er entfällt, die Zeile bleibt für sich.

Referenz-Regex (Schritt 1b, geprüft auf der kommentarfreien Zeile):

```
(^|[ \t])\\[ \t]*$
```

**Faltmarke `>` / `<`** — bestimmt, wie das Dokument **eröffnet** wird:

- Steht **unmittelbar vor dem Label**, also hinter der Statusbox
  (`- [x] > Backend`); ohne Statusbox rückt sie an deren Stelle
  (`- > Backend`, bei Wurzelknoten an den Zeilenanfang). Erkannt nur mit
  **folgendem Leerraum** — `- [x] >Achtung` bleibt damit ein Label. Die
  Stellung hält die Spalte der Statusboxen über die Ebenen hinweg bündig;
  Begründung: D34-Nachtrag 2.
- Die frühere Stellung **zwischen Zeichen und Statusbox** (`- > [x] Backend`)
  wird weiterhin **gelesen**, aber nie mehr geschrieben: Beim Zurückschreiben
  (§9) wird sie in die neue aufgelöst. Stehen beide, gilt die erste.
- `>` heißt: der Teilbaum dieses Knotens ist beim Öffnen **eingeklappt**.
- `<` innerhalb eines eingeklappten Bereichs holt den **eigenen Teilbaum**
  gezielt wieder hervor (Mechanik: §9). Es ist eine **Schreibhilfe für
  Autoren**: gelesen wird es unverändert, erzeugt wird es nie — das
  Zurückschreiben (§9) setzt ausschließlich `>`. Ein von Hand gesetztes `<`
  bleibt stehen, solange es den Zustand noch richtig beschreibt, und wird
  aufgelöst, sobald alle Marken neu gesetzt werden.
- Die Marken beschreiben den **Faltzustand des Dokuments**: Beim Öffnen stellen
  sie ihn her, und Umklappen im Diagramm schreibt sie zurück (§9) — Text und
  Bild sagen dasselbe. Sie sagen nichts über Fortschritt (§4) oder
  Notwendigkeit (§3) und ändern weder Kosten noch Warnungen.

**Knoten-ID `#name`** — benennt einen Knoten im **ganzen Dokument** eindeutig;
sie ist die Adresse für Abhängigkeiten und Beschreibungsblöcke (§11).

- Zeichenmenge wie bei `@name` (§7): Unicode-Buchstaben, Ziffern, `.`, `_`, `-`.
  (Enger als das frühere „whitespace-frei“ aus §11 — Begründung: D36.)
- Erkannt nur **alleinstehend angesetzt** (`(^|\s)#…`): „C#“ bleibt damit ein
  Label, und der für Abhängigkeiten reservierte Doppelpunkt `:#a,#b` (§11)
  kollidiert nicht.
- Das **erste** solche Token der Zeile ist die ID; weitere `#`-Token bleiben im
  Label stehen (dort liegt die reservierte Ticket-Referenz, §11). Eine ID, die
  dem Muster des angebundenen Trackers entspricht (`#123`, `#US-123`), ist
  zugleich die künftige Ticket-Referenz — oft ist die Ticket-Kennung die
  natürliche Knoten-ID (D34).
- **Übliche Schreibweise ist die ID vor dem Titel, mit Doppelpunkt:**
  `#auth: Backend`. Der Doppelpunkt ist **optional** und reines Trennzeichen im
  Text — er gehört weder zur ID noch zum Label und erscheint nicht im Diagramm.
  Geschluckt wird er nur, wenn er **unmittelbar** auf die ID folgt und ihm
  **Leerraum oder Zeilenende** folgt; ein Doppelpunkt im Label (`#auth: Regel:
  nur mit Token`) bleibt also stehen, und `#auth:#db` bleibt ID plus
  Abhängigkeit. Die Stellung ist frei — `Backend #auth` bedeutet dasselbe.
- Die ID gehört **nicht** zum Label. Sichtbar ist sie im Knoten-Tooltip, im
  `aria-label` und — auf Wunsch — vor dem Titel (§9, `#`-Umschalter).
- **Ohne Titel vertritt die ID ihn:** Bleibt nach der Extraktion kein Label
  übrig, die Zeile trägt aber eine ID, dann ist `#id` das Label — mit
  Doppelpunkt geschrieben (`#US-123:`) wie ohne. Die Zeile wird also **nicht**
  ignoriert, sondern ein gewöhnlicher Knoten, und die ID ist vergeben. Gedacht
  für den Fall, dass die Kennung schon der Name ist (Ticket-Referenzen, §11) —
  den Titel danebenzuschreiben wäre eine Verdopplung. Der `#`-Umschalter (§9)
  setzt bei so einem Knoten **nichts** davor: Die ID steht bereits da.
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
  **uneingerückte Zeile mit genau einer Knoten-ID** (`#auth`, allein — ein
  angehängter Doppelpunkt ist auch hier zugelassen) einen
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
^([ \t]*)([-|+]|=(?=[ \t]))?\s*(?:([><])(?=[ \t])\s*)?(?:\[([ ?~xX^/-])\]\s*)?(?:([><])(?=[ \t])\s*)?(.*)$
```

Die **zweite** Faltmarken-Gruppe ist die gültige Stellung, die erste die
weiterhin gelesene alte (siehe oben). Umkehrung fürs Zurückschreiben (§9) —
sie setzt die Marke immer in die zweite Stellung und löst die erste dabei auf:

```
^([ \t]*(?:[-|+]|=(?=[ \t]))?[ \t]*)(?:[><](?=[ \t])[ \t]*)?((?:\[[^\]]\][ \t]*)?)(?:[><](?=[ \t])[ \t]*)?
```

Für die Knoten-ID (Schritt 6, nur der erste Treffer; die letzte Gruppe ist der
optionale Trenn-Doppelpunkt, der mit entfällt):

```
(^|\s)#([\p{L}\p{N}._-]+)(?::(?=\s|$))?
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

**Größen-Konflikt** — die angegebene Größe eines Elements muss zu seinen
Teilpaketen passen. Die Skala ist ordinal; für diese eine Prüfung wird jede
Größe als **Bereich** gelesen (Untergrenzen verdoppeln sich):

| | XS | S | M | L | XL | XXL |
|---|---|---|---|---|---|---|
| Bereich | [1, 2) | [2, 4) | [4, 8) | [8, 16) | [16, 32) | [32, ∞) |

- **Konflikt** ist, wenn selbst die **günstigste Lesart der Kinder** die
  **großzügigste Lesart des Elternknotens** erreicht: Summe der Untergrenzen
  der zählenden Kinder ≥ Obergrenze der Elterngröße. Gemeldet wird also nur,
  was unter *jeder* Lesart falsch ist — `(XL) = XL-Kind + 2 × M` (16+4+4 = 24
  < 32) ist deshalb kein Konflikt, vier `(S)` unter einem `(M)` (8 ≥ 8) schon.
  Ein Kind, das **größer** ist als sein Elternknoten, ist immer ein Konflikt
  (Teilmenge der Regel).
- **XXL hat keine Obergrenze** — ein XXL-Element warnt nie: Für die großen
  Sammelknoten eines Plans behauptet die Skala schlicht keine Schranke mehr.
- **Es zählen nur die direkten Kinder**, und davon nur die mit **angegebener**
  Größe (fehlende Größe ist keine Aussage; anders als beim günstigsten Pfad
  wird hier kein `M` angenommen). Verworfene und optionale (`+`) Kinder zählen
  nicht. In einer disjunktiven Gruppe (`|`/`=`) wird nur eine Alternative
  realisiert — dort zählt die **kleinste**.
- Ein Elternknoten **ohne** Größe macht keine Aussage und wird nie geprüft;
  die Gegenrichtung (Eltern größer als die Kindersumme) warnt nicht — sie
  heißt nur, dass die Zerlegung unvollständig ist (dafür gibt es den
  Geister-Knoten).
- **Meldung und Anzeige:** Warnung `sizeConflict` mit der Zeilennummer des
  Elternknotens; sein Größen-Badge wechselt auf die Warnfarbe (`--warn`,
  `#B45309`, weiße Schrift), Tooltip und `aria-label` benennen den Grund.
  Badge-Färbung auch im Grafikexport und im Druck. **Nichts wird automatisch
  korrigiert** — die Größen bleiben, wie sie geschrieben sind. Siehe D62.

## 6. Links

- Ein nacktes `https://…`-Token macht den ganzen Knoten klickbar
  (neuer Tab, `rel="noopener"`); Kennzeichnung mit ↗ hinter dem Label.
- **Ausnahme auf Touch-Geräten:** Dort öffnet der einfache Tipp nicht die URL,
  sondern das Knoten-Fenster (§9) — der Link steht darin als eigener Knopf. Ohne
  Zeiger gibt es keinen Tooltip, und ein einziger Tipp kann nicht beides tun;
  „ansehen" ist die häufigere Absicht, und der Link bleibt einen Tipp entfernt.
  Siehe D52.

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
`aria-label`. Beschreibung und Kurz-Fakten sind im Tooltip **deutlich
getrennt**: Leerzeile und Trennstrich dazwischen, nicht bloß ein weiteres
Glied derselben Aufzählung — es sind zwei Arten von Aussage. Der Strich steht
nur, wenn es wirklich etwas zu trennen gibt, und nicht im `aria-label` (ein
Screenreader läse die Striche einzeln vor). Ein Knoten mit Beschreibung trägt eine kleine **”-Marke** hinter
dem Label — sie macht die sonst unsichtbare Beschreibung auffindbar und
spiegelt das `"`-Zeichen der Notation. Die Marke erscheint **nicht** im
Grafikexport: Der Text selbst kann dort nicht angezeigt werden, eine Marke
ohne Ziel wäre Rauschen. Siehe D40.

**Gezeigt wird das immer im eigenen Knoten-Fenster**, nicht im Tooltip des
Browsers: am Zeiger nach kurzer Verzögerung beim Überfahren, bei Tastaturfokus
sofort, auf Touch beim einfachen Tipp (§6). Ein `title` kann weder Absätze noch
eine Linie und erscheint nie beim Tastaturfokus; das Fenster kann beides. Der
Inhalt ist derselbe — die Beschreibung als Absatz, die Kurz-Fakten dahinter
durch eine echte Linie abgesetzt. Siehe D57.

- Das Fenster hängt am angetippten Knoten (kleine Spitze zu ihm hin) und weicht
  nach oben aus, wenn unten kein Platz ist. Der Knoten trägt, solange es offen
  ist, einen Petrol-Ring.
- Es schließt beim Tipp daneben, beim erneuten Tipp auf denselben Knoten, mit
  **Esc**, über sein ×, beim Scrollen des Diagramms und bei jedem Neubau.
- Ein **verlinkter** Knoten (§6) bekommt darin einen ↗-Knopf, der die URL im
  neuen Tab öffnet — auf Touch ist das der Weg zum Link.
- Der **Sprung-Hinweis** nennt hier den langen Druck statt Alt+Klick (§9,
  Sprung zwischen Diagramm und Text) — Alt gibt es auf dem Telefon nicht.
- Reine Bedienhilfe: nicht im Grafikexport, nicht im Druck. Auf Geräten mit
  Zeiger ändert sich nichts, dort bleibt es beim Tooltip.

Siehe D52.

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
- **Lange Labels brechen um** (D64): höchstens ~32 Zeichen je Zeile, die
  Zeichen **gleichmäßig** auf die Zeilen verteilt (nicht gierig — sonst stünde
  unter einer vollen Zeile ein einsames Wort). Die Umbrüche setzt der
  **Renderer**, deterministisch und nur an Leerzeichen; der Kasten schrumpft
  auf die längste Zeile, der Text steht zentriert. Bei **mehrzeiligen** Knoten
  trifft der 23-px-Abzweig die Mitte der **ersten Zeile** (die Zeilenhöhe
  bleibt fest); der Optional-Kreis (§9) sitzt auf dem Abzweig, nicht auf der
  Knotenmitte. Der Grafikexport misst die gerenderten Zeilen und gibt sie als
  einzelne Textzeilen aus.
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
- Im **vertikalen** Modus tritt die all-of-Verbindung rechts aus dem Knoten aus;
  die senkrechte Sammelleiste steht deshalb **weiter vom Knoten ab** als in den
  übrigen Anordnungen (20 statt 9 px). Größen-Badge und Tag-Pillen ragen an der
  rechten Knotenkante über den Knoten hinaus und lägen sonst unmittelbar an der
  Leiste — mit ihrem hellen Rand sähe die Linie dort aus, als risse sie ab.
  Betroffen ist nur der Rechts-Fächer: kompakt führt all-of nach unten, dort
  treffen Badge und Leiste nie aufeinander.

### Kleiner Bildschirm (mobil)
Ab schmaler Breite (≤ 640 px, z. B. Smartphone) ist **immer genau ein Bereich**
zu sehen — Diagramm **oder** Text, jeweils über die ganze Fläche. Oben links in
der Titelzeile schaltet ein **Knopf** auf den anderen um; er zeigt das Ziel
(Textzeilen bzw. Baum), denn den Zustand hat man ohnehin vor sich. Es gibt hier
weder Splitter noch Min/Normal/Max-Buttons — es ist nichts zu teilen. Der
Bereichstitel „DIAGRAMM" entfällt; die Zeile wird für Umschalter und Aktionen
gebraucht. Der **Dokumenten-Wähler** steht direkt neben dem Umschalter und ist
damit genau dann zu sehen, wenn der Text vorn ist. Die übrigen
**Aktions-Knöpfe** bleiben rechts in der Titelzeile und werden mit
umgeschaltet — jeder Bereich zeigt seine eigenen, in der unten beschriebenen
komprimierten Form. Der sichtbare Bereich wird gemerkt; ein Sprung zwischen
Diagramm und Text (§9) holt den nötigen Bereich selbst nach vorn. **Nur dieser
Umschalter wechselt den Bereich** — insbesondere kostet kein Tippen im Text
den Editor. Umgekehrt trägt der Umschalter zugleich die Navigation zum Knoten:
Wer aus dem Text ins Diagramm wechselt, landet auf dem Knoten der Cursor-Zeile
(zentriert und hervorgehoben) — der Alt+Klick dieser Richtung (§9) steht auf
dem Telefon nicht zur Verfügung.
Voreinstellung ist das Diagramm. Beide Inhalte werden hier zudem rund **25 %
kleiner** dargestellt, damit mehr Plan auf die Fläche passt; das ist ein Faktor
**auf** den Zoom, der Zoom-Regler arbeitet unverändert relativ dazu und zeigt
den effektiven Wert (auf dem Telefon also 75 %). Der **Grafikexport** ist davon
unberührt — er zeichnet immer die unskalierte Geometrie nach. Die **Legende**
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
persistiert) hebt den kostengünstigsten Weg durch den Baum hervor. Gerechnet
wird die **noch offene** Arbeit — der Pfad beantwortet „was ist als Nächstes
am günstigsten?", nicht „was hätte der Plan von vorn gekostet?". Ermittelt
werden die für die günstigste Realisierung **nötigen** Knoten:

- **Erledigtes kostet nichts mehr:** Ein Knoten mit `[x]` oder `[^]` (§4) geht
  mit **0** in die Rechnung, unabhängig von seiner Größe. Angefangenes (`[~]`,
  `[/]`) zählt dagegen **voll** — die Arbeit ist noch offen. Maßgeblich ist der
  **intrinsische** Status: Investiert ist investiert, auch wenn Abhängigkeiten
  den Knoten effektiv zurückhalten (§4). Abgezogen werden nur die **eigenen**
  Kosten des Knotens, nicht die seines Teilbaums. Folge in Alternativgruppen:
  Eine bereits realisierte Alternative gewinnt, auch wenn eine unangetastete
  nominell billiger wäre — die Wahl ist getroffen und bezahlt. Siehe D46.
- **all of:** alle Kinder sind nötig.
- **any of:** nur die **günstigste** Alternative ist nötig. „Günstig" =
  kleinste rekursive Kosten (eigene T-Shirt-Größe plus — je Gate — Summe bzw.
  Minimum der Kinder). Bei Gleichstand gewinnt die **erste** Alternative.
  **Ist in der Gruppe etwas realisiert** (§3: `[~]`, `[/]`, `[x]`, `[^]`), ist
  die Wahl damit getroffen — gewählt wird nur noch unter den realisierten
  Alternativen, auch wenn eine unangetastete nominell billiger wäre. Sind es
  mehrere (in einer `=`-Gruppe schon per `xorConflict` gemeldet, in einer
  `|`-Gruppe zulässig), entscheidet unter ihnen wieder die Kostenregel.
- **Optionale Knoten (`+`, §3) sind nur nötig, solange an ihnen gearbeitet
  wird** — also wenn sie realisiert (§3), aber noch nicht erledigt sind:
  `[~]` und `[/]`. Sonst zählen sie weder zu den Kosten ihres Elternknotens
  noch liegen sie auf dem Pfad, und der Teilbaum unter ihnen ebenso wenig.
  Genau dafür gibt es das Zeichen: Ohne `+` rechnet der günstigste Pfad jede
  Zugabe ins Minimum ein und überschätzt es. Die Ausnahme hält den umgekehrten
  Fehler heraus — eine angefangene Zugabe ist offene Arbeit, und der Pfad
  zeigt die offene Front. **Erledigte Zugaben bleiben draußen:** Dort ist
  nichts mehr zu tun, und was darunter offen blieb, ist mit ihnen zusammen
  entbehrlich (§3). Siehe D61.
- Verworfene Knoten zählen nie mit (unabhängig vom „verworfene einblenden"-
  Filter).
- **Fehlende Größe wird aus den Teilpaketen geschätzt** (nur für diese
  Kostenschätzung; die SPEC-Semantik der Größen in §5 bleibt unberührt):
  Angenommen wird **mindestens die größte Größe der zählenden Kinder**;
  tragen **drei oder mehr** Kinder diese größte Größe, eine Stufe mehr
  (Deckel: `XXL`). Es zählen dieselben Kinder wie beim Größen-Konflikt (§5) —
  nur die direkten, verworfene und optionale (`+`) nie, in einer disjunktiven
  Gruppe (`|`/`=`) nur die **kleinste** Alternative (ist dort etwas realisiert,
  §3, die kleinste der realisierten) —, mit einem Unterschied: Kinder **ohne**
  Größe zählen hier mit, ihre Größe wird nach derselben Regel **rekursiv**
  mitgeschätzt — geschätzt wird ohnehin. Ein Knoten ohne Größe und ohne
  zählende Kinder wird weiterhin als `M` gewertet.

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
ohnehin dichten Knoten-Ecken. **Erledigte Knoten treten nie zurück**: Ein Knoten
mit `[x]` oder `[^]` behält seine volle Statusfarbe (§4) — grün bzw. blau sagt
bereits „hier ist nichts mehr zu tun"; ihn auszublassen hieße, er sähe aus wie
eine verworfene Alternative. Das gilt **unabhängig davon, ob er auf dem Pfad
liegt**: auch die fertige Zugabe (`+`, §3) und die fertige, nicht gewählte
Alternative behalten ihre Farbe. Blass heißt damit einheitlich „hier ist nichts
getan und wird auch nichts getan". Maßgeblich ist der **intrinsische** Status
(die eigene Box), gefärbt wird weiterhin nach dem effektiven (oben) — ein von
Abhängigkeiten zurückgehaltenes `[x]` steht also in voller Stärke in seiner
effektiven Farbe. Wo die Größe **implizit** angenommen wird (aus den
Teilpaketen geschätzt bzw. `M`, oben), zeigt der Knoten die angenommene Größe
als **invertiertes** Größen-Badge (weiß mit petrolfarbenem Rand/Text statt
gefüllt) mit erläuterndem Tooltip — an einem **erledigten** Knoten entfällt
es, dort wird keine Kostenannahme mehr getroffen.

Zusätzlich fädelt eine **gestrichelte, geschwungene Petrol-Linie** durch die
**offenen Endknoten** des Pfads (Katmull-Rom-Spline in Dokument-Reihenfolge,
in allen Modi). Die kräftige Linie liegt **hinter** den Knoten (nur in den
Lücken voll sichtbar), eine **abgetönte Kopie** davor deutet den Verlauf beim
Durchschreiten eines Knotens nur schwach an. An jedem solchen Endknoten sitzt
ein großer, **blasser Petrol-Stationspunkt** (U-Bahn-Plan-Prinzip: der
Knotentext bleibt lesbar) — **durchquerte** Fremd- oder Zwischenknoten und
**erledigte** Knoten tragen keinen, sodass eindeutig bleibt, wo noch Arbeit
**endet**. Station ist damit der tiefste noch offene Knoten eines Zweigs: Sind
alle Kinder erledigt, wird der offene Elternknoten selbst die Station (die
Restarbeit ist dann seine); ist ein ganzer Zweig erledigt, hat er keine. Linie,
abgetönte Kopie und Punkte erscheinen bei aktivem Umschalter auch im
Grafikexport. Siehe D18, D46.

**Von Station zu Station.** Neben dem Umschalter steht ein **Knopf**, der die
Stationen der Reihe nach anspringt: Der erste Druck holt die **erste** — das,
was als Nächstes dran ist —, jeder weitere die nächste, nach der letzten wieder
die erste. Gegangen wird die Dokument-Reihenfolge, also dieselbe, in der die
Linie durch die Stationen fädelt. Der Knoten wird **zentriert, hervorgehoben
und bekommt den Tastaturfokus** — dieselbe Behandlung wie beim ausdrücklichen
Alt+Klick (§9, Sprung zwischen Diagramm und Text); von dort führt **Alt+Enter**
in die zugehörige Textzeile. Fortgesetzt wird am gerade hervorgehobenen Knoten:
Steht der auf einer Station, geht es bei der nächsten weiter, sonst wieder
vorn. Der Knopf ist **verborgen**, solange es keine Station gibt — bei
ausgeschaltetem Pfad ebenso wie bei einem durchweg erledigten Plan; sein
Tooltip nennt die Zahl der offenen Stationen. Siehe D47.

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
(die Füllung bleibt die Statusfarbe aus §4). Die Anzahl steht am
**Neuigkeiten-Knopf** in der Kopfzeile (siehe unten), bestätigt wird im Popup;
danach ist die aktuelle Fassung die neue
Vergleichsbasis. Beim ersten Ansehen eines Dokuments leuchtet nichts. Der Kranz
erscheint weder im Druck noch im Grafikexport — er hängt am persönlichen
Besuchsstand. Siehe D28.

### Neuigkeiten (Stern in der Kopfzeile)
Ein **Stern-Knopf in der oberen Bedienleiste** ist immer sichtbar und öffnet ein
Popup mit den Änderungen der letzten Tage — je Tag ein Datum und ein paar kurze
Notizen. Er trägt zwei Aussagen, die zusammengehören:

- **Die Chronik** (allgemein): was am Produkt geschehen ist. Die Notizen stehen
  in `docs/CHANGELOG.md`, die Knoten je Tag kommen aus der Versionsgeschichte
  des mitgelieferten Plans; beides wird **beim Bauen** eingelesen und
  eingebettet (zur Laufzeit lädt Werkbaum nichts nach, D20).
- **Der Besuchsvergleich** (persönlich): „Was ist neu?" des aktiven Dokuments
  (oben) — als abgesetzter Abschnitt zuoberst im Popup, mit dem Knopf
  „gesehen".

**Bernstein heißt ungesehen** — dieselben Töne wie der Strahlenkranz am Knoten,
damit Knopf und Knoten dasselbe sagen. Er färbt sich, solange es unangesehene
Tage gibt oder das aktive Dokument neue Knoten hat; die Zahl daneben ist die der
neuen Knoten. Aufgeschlagen heißt gelesen: Das Öffnen des Popups merkt den
neuesten gelisteten Tag als gesehen.

**Jeder Tag mit Knotenänderungen trägt einen Link**, der genau diese Knoten im
Diagramm in der „Was ist neu?"-Ansicht vorführt (gelber Kranz, §9) — dieselbe
Ansicht, nur mit einer anderen Frage: „was geschah am 24.08." statt „was ist
seit deinem letzten Besuch live gegangen". Dabei wird auf den mitgelieferten
Plan umgeschaltet, denn dessen Knoten sind gemeint; der Knopf steht dann in
Petrol („wird gerade vorgeführt") und ein zweiter Druck hebt es wieder auf.
Genannt wird die Zahl der Knoten, die es **heute noch gibt** — ein seither
umbenannter Knoten ist nicht mehr zu treffen, und der Link verspricht nichts,
was er nicht halten kann. Die Vorführung ist Sitzungssache und wird nicht
gemerkt.

Die **Notizen sind englisch**, auch wenn die Oberfläche in einer anderen Sprache
steht: `docs/CHANGELOG.md` ist ein ausgeliefertes Artefakt mit weltweitem
Publikum, wie der mitgelieferte Plan und `llms.md` (§13). Übersetzt ist alles
übrige — Titel, Knöpfe und die Datumsangaben. Damit das nicht wie ein Fehler
aussieht, steht **oben im Popup ein übersetzter Hinweis**, dass diese Übersicht
nur auf Englisch gepflegt wird; er ist klein und grau gehalten und tritt hinter
den Inhalt zurück, zu dem er gehört. Bei englischer Oberfläche entfällt er.
Siehe D58.

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
  hervorgehoben und beim Zeilenwechsel ins Bild gescrollt. **Beschreibungs- und
  Fortsetzungszeilen (§1)
  zählen zu ihrem Knoten**: Steht der Cursor in einer `"`-Zeile (§1), in einer
  Fortsetzung hinter `\` oder in
  einem ID-Block des `---`-Beschreibungsteils (Kopfzeile eingeschlossen), gilt
  der beschriebene Knoten als ausgewählt — solche Zeilen tragen keinen eigenen
  Knoten, gehören aber zu einem, und wer darin schreibt, arbeitet an genau
  diesem Knoten. Das gilt für beide Richtungen der Geste (also auch für den
  ausdrücklichen Alt+Klick unten) und für die Hervorhebung der
  Abhängigkeits-Kanten (§9). **Liegt der Knoten der Cursor-Zeile in einem
  eingeklappten Teilbaum** (§9, Falten), wird stattdessen sein **nächster
  sichtbarer Vorfahr** hervorgehoben — der eingeklappte Knoten vertritt seinen
  Teilbaum (D38), auch hier; das gilt ebenso für den ausdrücklichen Alt+Klick
  unten. Zeilen ohne Knoten (Kommentar, Leerzeile, der
  `---`-Trenner selbst, ausgeblendetes verworfenes Element) heben nichts
  hervor. Die Hervorhebung arbeitet auf einer **eigenen Achse — Tiefe**: weißer
  Halo + Ring in Tinte, dazu ein Schlagschatten und eine leichte Vergrößerung,
  sodass der Knoten sich aus der Ebene hebt. Das ist der einzige Kanal, den
  sonst nichts im Diagramm belegt, kollidiert also mit keiner Farbcodierung
  (Status §4, gelber Kranz und Petrol-Kranz oben). **Beim Zeilenwechsel** meldet
  sie sich zusätzlich mit einem **einmaligen Puls** — einem kurzen Hüpfer und
  einem auslaufenden Ring; kein Blinken, und bei `prefers-reduced-motion`
  entfällt er. Der Pfad-Filter (§9, günstigster Pfad) blasst sie nie aus: Wo der
  Cursor steht, bleibt sichtbar. Siehe D25.
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

### Knoten-IDs im Diagramm einblenden (`#`)
Ein Umschalter im Diagramm-Kopf stellt die Knoten-ID in eine **eigene Zeile
über den Titel** (`#some.id`, ohne den Trenn-Doppelpunkt — der trennt ID und
Titel in derselben Zeile, hier trennt der Umbruch; D56, geändert mit D64).
Dargestellt in der Mono-Schrift des Textfelds und zurückgenommen gefärbt — die
ID ist die Adresse, der Titel bleibt die Hauptzeile. Der Zustand wird gemerkt.

**Grafikexport und Druck folgen dem Umschalter** (wie beim „verworfene
einblenden"-Filter und der Faltung): Ist er an, stehen die IDs auch im
ausgegebenen Bild. Für Screenreader ändert sich nichts — sie bekommen die ID
ohnehin über das `aria-label`. Siehe D56.

### Kurzschreibweise der Knoten-ID beim Tippen (`#.name`)
Eine **Eingabehilfe**, keine Notation: Wer `#.kc` unter einem Knoten mit der ID
`#prod-stage` schreibt, findet `#prod-stage.kc` im Text. Aufgelöst wird gegen
den nächsten Vorfahren **mit** ID; gibt es keinen oder trägt er selbst noch eine
Kurzform, bleibt die Zeile stehen (`#.kc` ist ohnehin eine gültige ID — der
Punkt gehört zur Zeichenmenge, §1). `#..x` wird nicht angefasst.

**Aufgelöst wird, sobald die ID abgeschlossen ist** — also sobald ihr
unmittelbar ein **Doppelpunkt** folgt (`#.kc:`), der übliche Trenner vor dem
Titel (§1) und zugleich der Anfang einer Abhängigkeitsliste. Das gilt beim
Tippen des Doppelpunkts ebenso wie beim nächsten Tastendruck in einer Zeile,
die ihn schon trägt. Ohne Doppelpunkt bleibt es beim **Verlassen der Zeile** —
spätestens dann ist die ID fertig.

Die Datei enthält danach immer die volle ID: Sie bleibt durchsuchbar und
überlebt das Umsortieren, worauf die Abhängigkeiten `:#…` bauen. **An der
Notation ändert sich dadurch nichts** — der Parser sieht nie eine Kurzform,
und `llms.md` (§13) bleibt unberührt. Angefasst wird nur die Zeile, in der auch
**getippt** wurde — den Cursor hineinzusetzen genügt nicht, sonst schriebe
bloßes Durchklicken ein fremdes Dokument um; Abhängigkeiten (`:#…`) und der
Beschreibungsteil hinter `---` bleiben außen vor. Siehe D55.

### ID-Vorschläge beim Tippen von Abhängigkeiten (`:#`)
Ebenfalls eine **Eingabehilfe**, keine Notation: Wer im Baumteil ein
Abhängigkeits-Token beginnt (`:#`, auch in der Fortsetzung `,#` und in der
Kopf-Form `#auth:#…`), bekommt an der Schreibmarke eine **Liste der vergebenen
IDs** — gefiltert nach dem schon getippten Fragment (Präfix-Treffer zuerst,
dann Teilstring-Treffer, je in Dokumentreihenfolge), mit dem Knotentitel als
Kontext daneben. Angeboten werden **alle** IDs des Dokuments, auch die
verworfener oder eingeklappter Knoten — eine Abhängigkeit darf überallhin
zeigen (§1); nicht angeboten werden die im Token schon gelisteten IDs und die
eigene ID der Zeile.

- **Bedienung:** ↑/↓ wählt, Enter oder Tab übernimmt (undo-fähig, ein
  Schritt), Esc schließt — Weitertippen öffnet wieder. Klick bzw. Tipp auf
  einen Eintrag übernimmt ebenso. Wer die Liste ignoriert, tippt einfach
  weiter: Sie fängt keine Taste ab, solange sie nichts anzeigt, und Tab rückt
  bei geschlossener Liste unverändert ein.
- **Kein Vorschlag** bei bloßem `#` (das *definiert* eine ID), im Kommentar
  (`%%`), im Beschreibungsteil hinter `---` und in schreibgeschützten
  Pad-Dokumenten (§9).
- Der Parser sieht nie etwas davon; `llms.md` (§13) bleibt unberührt. Für
  Screenreader meldet eine höfliche Live-Region die Trefferzahl und den
  gewählten Eintrag; das Popup selbst ist `aria-hidden`, normales Tippen
  bleibt unberührt. Siehe D63.

### Zeilennummern im Texteditor
Links neben dem Textfeld steht ein schmaler Streifen mit den **Zeilennummern** —
dieselben, die die Warnungen nennen („Zeile 12: …", §4). Ohne ihn muss man sie
im Text abzählen.

- **Das Textfeld bricht Zeilen nicht um** (D49). Die Einrückung trägt die
  Hierarchie (§2), und ein weicher Umbruch setzt die Fortsetzung an den linken
  Rand — die Ebene wäre damit gerade dort nicht mehr abzulesen, wo eine Zeile
  lang ist. Zu lange Zeilen bekommen einen **waagerechten Balken**; eine
  logische Zeile ist damit immer genau eine Bildzeile.
- Der Streifen scrollt **nur senkrecht** mit: Die Zahlen bleiben stehen, wenn
  der Text waagerecht verschoben wird. Ein Sprung auf eine Zeile (§9) setzt die
  waagerechte Verschiebung zurück — er zeigt auf eine Zeile, nicht auf ihr Ende.
- Die **Cursor-Zeile** und Zeilen mit einer **Warnung** heben sich ab (Warnung in
  `--warn`, `#B45309`) — genau die beiden Fälle, für die man hinsieht.
- Die Zahl einer Warn-Zeile trägt die **Meldung als Tooltip** — wörtlich
  dieselbe, die unter dem Diagramm im Warnungsbereich steht; mehrere Warnungen
  einer Zeile stehen darin untereinander. Der Streifen bleibt `aria-hidden`:
  Für Screenreader ist die Live-Region des Warnungsbereichs die Quelle, der
  Tooltip erspart nur den Weg dorthin. Ohne Zeiger gibt es ihn nicht (wie
  überall) — die Meldung steht dort ohnehin vollständig. Siehe D33-Nachtrag.
- Über einer Warn-Zeile trägt der **Zeiger ein Warndreieck** — dasselbe ⚠, das
  im Warnungsbereich vor jeder Meldung steht. Der Pfeil bleibt daneben stehen,
  damit der Zeiger weiter zeigt. Siehe D33-Nachtrag 2.
- Reine Lesehilfe: kein Bestandteil des Notationstexts, nicht im Grafikexport
  und nicht im Druck (dort ist ohnehin nur das Diagramm zu sehen).

Siehe D33, D49.

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
Jeder Knoten mit sichtbaren Kindern trägt ein **Falt-Zeichen** vor dem
Label: **▾** offen, **„▸ n“** eingeklappt (n = Zahl der verborgenen Knoten) —
als kleiner **gerahmter Chip**, damit das Klickziel zu treffen ist (D64; das
nackte Glyph war zu klein). Klick auf das Zeichen klappt um — der einfache
Klick auf den Knoten selbst
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
- **Umklappen im Diagramm schreibt die Marke in den Text zurück.** Damit ist
  der Text auch für die Faltung die eine Quelle der Wahrheit: Was du siehst,
  steht geschrieben, und ein Neuladen stellt es wieder her. Die Änderung ist
  eine gewöhnliche Textänderung — sie lässt sich mit **Rückgängig** zurücknehmen
  und macht ein mitgeliefertes Dokument zu einem bearbeiteten (§9, D27).
  Geschrieben wird **minimal**: Nur die Zeile des umgeklappten Knotens wird
  angefasst, solange die übrigen Marken den Zustand noch richtig beschreiben —
  ein von Hand gesetztes `<` bleibt also stehen. Trifft es nicht mehr zu, werden
  alle Marken neu gesetzt und das `<` dabei aufgelöst.
- Wo der Text **nicht beschreibbar** ist — bei einem Pad-Dokument (§9) —, gilt
  der Eingriff **je Knoten** (Identität = Label-Pfad, wie bei „Was ist neu?“)
  und **nur für die Sitzung**; ein Dokumentwechsel setzt ihn zurück. Dasselbe
  gilt für einen Zustand, der sich in Marken gar nicht ausdrücken lässt (etwa
  weil eine Fokusmarke `!!!` ihren Knoten immer wieder hervorholt): Dann wird
  lieber nichts geschrieben, als einen Text zu hinterlassen, der etwas anderes
  sagt als das Bild.
- **Für den ganzen Baum** gibt es im Diagramm-Kopf einen **Umschalter**:
  gedrückt ist alles **ab Größe M abwärts** zugeklappt, nicht gedrückt ist der
  ganze Baum **offen**. Betroffen ist jeder Knoten mit Kindern, dessen
  **angegebene** Größe (§5) `M` oder kleiner ist — offen bleiben `L`, `XL`,
  `XXL`. Ein Knoten **ohne** Größenangabe wird nicht zugeklappt: Der günstigste
  Pfad rechnet fehlende Größen zwar als `M` (unten), das ist aber eine
  Kostenannahme und keine Aussage des Autors.
- Beide Stellungen beschreiben einen **vollständigen** Faltzustand — was der
  Umschalter nicht zuklappt, ist danach offen. Sein Zustand wird **nicht
  gemerkt, sondern am Baum abgelesen**: Wer danach einen Knoten von Hand
  umklappt, sieht ihn von selbst herausspringen. Geschrieben wird wie beim
  einzelnen Umklappen — ein einziger Rückgängig-Schritt für den ganzen
  Vorgang. Siehe D44.
- Faltung ist **reine Ansicht**: Warnungen aus eingeklappten Teilbäumen werden
  weiter gemeldet (sie gelten dem Text), und der günstigste Pfad rechnet
  unverändert über den ganzen Baum.
- **Ein eingeklappter Knoten vertritt seinen Teilbaum auch auf dem günstigsten
  Pfad:** Liegt darin noch **offene** Pfadarbeit (§9, Erledigtes zählt nicht),
  ist er deren tiefste noch sichtbare
  Station — die Linie führt zu ihm und endet dort mit einem Stationspunkt
  („hier drin liegt noch Pfad"). Ohne das überspränge sie den ganzen Zweig, als
  wäre dort nichts zu tun. Ist der verborgene Teilbaum dagegen **fertig**,
  bekommt der eingeklappte Knoten keinen Punkt — dort ist wirklich nichts mehr
  zu tun. Beim Aufklappen geben die Station wieder die
  Endknoten darunter. Das gilt auch, wenn der eingeklappte Knoten selbst nicht
  gebraucht wird, sein Teilbaum aber schon (etwa ein per `:#…` gezogenes Ziel):
  Er ist dann der einzige sichtbare Griff auf nötige Arbeit und tritt deshalb
  auch nicht zurück. Bleibt so nur **eine** sichtbare Station übrig (etwa bei
  eingeklapptem Wurzelknoten), entfällt die **Linie** — durch einen einzelnen
  Punkt führt keine —, der **Stationspunkt bleibt**; sonst verschwände der
  Pfad ausgerechnet dort ganz, wo der Baum am dichtesten gefaltet ist. Gilt
  auch im Grafikexport.
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

- **Alle** Kanten laufen **hinter** den Knoten durch, auch die hervorgehobenen:
  sichtbar in den Lücken, verdeckt vom Knoten selbst. Der Baum bleibt damit
  lesbar — eine Kante, die quer über fremde Knoten hinwegläuft, durchstreicht
  deren Beschriftung.
- Die Kanten des **ausgewählten** Knotens — Tastaturfokus im Diagramm, sonst
  der Knoten der Cursor-Zeile — sind in Tinte hervorgehoben, ein- wie
  ausgehende; sie liegen über den übrigen Kanten, aber unter jedem Knoten.
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
(inkl. „(angenommen)“ bei implizit geschätzter Größe), Zuständige, ob der Knoten optional
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

- `#123`, `#US-123` — Referenz auf externe Tickets (geplant für die
  Tracker-Integration). Ticket-Referenzen werden **so** notiert, weil es die
  etablierte Kurzschreibweise ist; sie haben unter den `#`-Verwendungen
  Vorrang. Ticket-Kennungen sind **auch alphanumerisch** (Taiga schreibt
  `#US-123` für eine User Story, Jira `#ABC-123`) — die Zeichenmenge der
  Knoten-ID (§1) deckt sie ab.
- `#auth` — **Knoten-ID**: **umgesetzt**, Definition jetzt in §1 (Zeichenmenge,
  Alleinstehend-Regel, Warnung `duplicateId`). Ziel für Abhängigkeiten und
  Beschreibungsblöcke (siehe unten).

Beide Rollen vertragen sich: Oft **ist** die Ticket-Kennung die natürliche
Knoten-ID. Als Ticket-Link behandelt wird ein Token **nicht an seiner Form**
(die frühere Heuristik „rein numerisch" trägt bei alphanumerischen Kennungen
nicht), sondern am **Muster des angebundenen Trackers** — konfigurierbar,
z. B. `US-\d+`/`\d+` bei Taiga; festzulegen im Taiga-Spike (D34-Nachtrag).
Freie Schlagworte liegen **nicht** mehr auf `#` — siehe `&tag` unten; damit
ist die frühere Dreifach-Rolle von `#` aufgelöst (D34).

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

## 13. Agenten-Fassung (`llms.md`)

Eine **englische Kurzfassung dieser Spezifikation für KI-Agenten** (lesen
**und** schreiben) liegt als Markdown in `frontend/public/llms.md` und wird
von jeder Instanz unter der Site-Wurzel ausgeliefert
(`https://werkbaum.javagil.de/llms.md`); der Footer verlinkt sie neben der
Versionsnummer. **Diese SPEC bleibt normativ**: Bei Syntaxänderungen
wird die Agenten-Fassung im selben Zug nachgezogen (CLAUDE.md). Siehe D43.

Daneben liegt `llms.txt` — der **Wegweiser** der llms.txt-Konvention
(llmstxt.org): Name, ein Satz zur Sache und Links auf die Kurzfassung, diese
SPEC, den Editor und das Repo. Er ist bewusst kurz und **rein ASCII**, damit
er auch dort ankommt, wo ein Server die Kodierung nicht mitschickt. Die
Konvention meint mit `llms.txt` genau so einen Index, **nicht** den Inhalt
selbst — die Kurzfassung ist eine der „markdown files providing more detailed
information“, auf die er zeigt. Siehe D43-Nachtrag 2.
