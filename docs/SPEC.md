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
2. Einrückung, Zeichen (`-` / `|`) und Statusbox `[…]` per Zeilen-Regex.
3. URL: erstes Token, das auf `https?://\S+` passt (dadurch stören `@` in URLs nicht).
4. Größe: erstes `(XS|S|M|L|XL|XXL)`, Groß-/Kleinschreibung egal.
5. Tags: alle `@name`-Vorkommen.
6. Rest, whitespace-normalisiert = Label. Leeres Label ⇒ Zeile ignorieren.

Referenz-Regex der Implementierung:

```
^([ \t]*)([-|])?\s*(?:\[([ ?~xX^/-])\]\s*)?(.*)$
```

## 2. Hierarchie

- Die Einrückung bestimmt die Ebene. Es gibt keine feste Schrittweite:
  Elternknoten ist die nächste vorangehende Zeile mit **kleinerer**
  Einrückungsbreite (Tab zählt als 2 Leerzeichen).
- Zeilen ohne Zeichen (`-`/`|`) sind Wurzelknoten. Mehrere Wurzeln = mehrere
  Bäume nebeneinander.

## 3. Zerlegungsart (Gate)

| Zeichen | Bedeutung | Semantik |
|---|---|---|
| `-` | all of (Und-Zerlegung) | Alle Teilpakete sind erforderlich. |
| `\|` | any of (Oder-Zerlegung) | Mindestens eine Alternative wird gewählt. |

- Das Gate ist eine Eigenschaft der Geschwistergruppe; alle Geschwister sollen
  dasselbe Zeichen tragen.
- Gemischte Geschwister: Darstellung nach dem **ersten** Kind, plus Warnung
  mit Zeilennummer.

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

- Ohne Statusbox: neutraler Knoten (weiß).
- `x` auch als `X` zulässig.
- Verworfene Knoten (inkl. Teilbaum) sind per Default **ausgeblendet**;
  Toggle „verworfene einblenden“ zeigt sie.

## 5. Aufwand (T-Shirt-Größen)

- Werte: `XS < S < M < L < XL < XXL`, notiert in Klammern, z. B. `(L)`.
- **Untergliederungsregel:** Ab `(M)` muss ein Element weiter zerlegt sein.
  Ein Element ≥ M **ohne Kinder** erhält einen Geister-Knoten
  „Untergliederung fehlt“ an gestrichelter Linie darunter (in `--warn`,
  `#B45309`). Der angedeutete Unterpunkt genügt als Hinweis; eine zusätzliche
  Umrandung des Knotens gibt es nicht.
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

### Horizontal (Normalmodus)
- **all of:** Kinder nebeneinander, klassischer Organigramm-Fächer.
- **any of:** Alternativen untereinander; gestrichelte graue Sammelleiste links
  unterhalb des Parents, gestrichelte graue Abzweige zu den Alternativen.

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
