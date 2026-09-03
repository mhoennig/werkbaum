# RFC 003 — Knoten im Text verschieben: zwei Knöpfe, ein Block, ein Undo-Schritt

|                                 |                                                                                                                                                       |
|---------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| Status                          | **Entschieden, nicht gebaut** (2026-09-03). Dieses Dokument ist die vollständige Bauanleitung; ein Coding-Agent soll es ohne Rückfrage umsetzen können. |
| Anlass                          | Nutzerwunsch: In der Editor-Titelzeile Knöpfe „nach oben“/„nach unten“, die den Knoten der Cursor-Zeile vor den vorherigen bzw. hinter den nächsten Geschwisterknoten schieben — samt `"`-Zeilen und `\`-Fortsetzungen |
| Plan-Knoten                     | `#ed.move` in `docs/examples/werkbaum.werkbaum` (anzulegen, §9.6)                                                                                     |
| Entscheidung                    | D95 in `docs/DECISIONS.md` (anzulegen, §9.5)                                                                                                          |
| Berührt                         | `frontend/src/parser.js` (eine neue Text→Text-Funktion), `frontend/src/app.js` (zwei Knöpfe, Tastatur, Zustand), `frontend/index.html`, `frontend/src/style.css` (höchstens eine Regel), i18n ×9, `frontend/tests/move.test.js` (neu), SPEC §9 (ein Abschnitt), CHANGELOG, Plan |
| Berührt nicht                   | Notation (kein neues Zeichen, `llms.md` bleibt unberührt), Renderer, Modell, Backend, Live-Protokoll (D76), Deploy                                      |
| Neue Technologie / Abhängigkeit | **keine** — reine Textoperation auf dem vorhandenen `<textarea>`                                                                                      |

## 1. Zusammenfassung

Der Text-Editor bekommt in seiner Titelzeile zwei Knöpfe (▲ / ▼) und die
Tastenkürzel **Alt+↑** / **Alt+↓**. Sie verschieben den **Block** des
Knotens, in dem die Schreibmarke steht, vor seinen vorherigen bzw. hinter
seinen nächsten **Geschwister**-Block. Ein Block ist alles, was zu dem Knoten
gehört: seine Zeile, ihre `\`-Fortsetzungen, seine `"`-Beschreibungszeilen
und sein **ganzer Teilbaum** (jede Zeile darunter mit größerer Einrückung,
samt deren Fortsetzungen, Beschreibungen und Kommentaren). Geschrieben wird
als **ein Undo-Schritt** über den vorhandenen `execCommand`-Weg; die
Schreibmarke wandert mit ihrem Knoten mit. Am Rand der Geschwistergruppe
(kein Geschwister in dieser Richtung) sind Knopf und Taste wirkungslos, der
Knopf ist dann deaktiviert.

Das braucht **keine neue Editor-Komponente** (kein CodeMirror, kein Monaco —
D76 hält das als eigene Frage offen). Verschieben ist eine Text→Text-Regel,
und für genau diese Sorte gibt es im Haus drei Vorbilder: `setFoldMark`
(D38), `expandShortIds` (D55) und `setStatusBox` (D91-Nachtrag 8) in
`parser.js`, alle headless getestet, alle über `app.js` undo-fähig ins
Textfeld geschrieben.

## 2. Begriffe, wie der Code sie schon kennt

Wer das baut, sollte diese Stellen zuerst lesen:

- **`logicalLines(text)`** in `frontend/src/parser.js` (~Zeile 77): liefert
  je logischer Zeile `{raw, line, cont}` — `line` ist die Nummer der ersten
  Textzeile, `cont` die Nummern der angehängten `\`-Fortsetzungen (SPEC §1,
  D59). Hinter dem `---`-Trenner wird nicht mehr verbunden. Die Menge aller
  `cont`-Nummern ist genau die Menge der Zeilen, die **keine eigene Zeile**
  sind, sondern zu der davor gehören.
- **`RE_CONT`**, **`RE_SEP`** (parser.js ~Zeile 60–63): Fortsetzungsmarke
  (Leerraum + `\` am Ende, Leerraum ist Pflicht) und `---`-Trenner.
- **Einrückungsbreite**: `m[1].replace(/\t/g, '  ').length` (parser.js
  ~Zeile 130 und 295) — Tab zählt als zwei Leerzeichen (SPEC §2).
- **Beschreibungszeile (Kurzform)**: erstes Zeichen nach der Einrückung ist
  `"`, gefolgt von Leerraum oder Zeilenende, auf einer Zeile **ohne**
  Zerlegungszeichen (SPEC §1). Sie gehört zum vorangehenden Knoten.
- **`node.line`** und **`node.descLines`** (parser.js ~Zeile 184 und 378):
  `line` ist die Nummer der Knotenzeile, `descLines` die Nummern aller
  Zeilen, die zu diesem Knoten gehören, ohne einen eigenen zu tragen —
  `"`-Zeilen, `\`-Fortsetzungen **und** die Zeilen seines ID-Blocks im
  `---`-Beschreibungsteil. Damit wird die Cursor-Zeile zum Knoten aufgelöst
  (§4.1).
- **`replaceTextUndoable(neu)`** in `frontend/src/app.js` (~Zeile 1519) und
  **`writeAt(von, bis, ein, selA, selB)`** (~Zeile 1240): die beiden
  Schreibwege über `document.execCommand('insertText')`. `value =` und
  `setRangeText` **zerstören die Undo-Historie** (D38-Nachtrag 2, D53) und
  sind tabu. Für dieses Feature ist `writeAt` der richtige (§5.3).
- **`viewOnly`** (app.js Zeile 135): Nur-Ansehen-Modus aus D94 — kein
  programmatischer Schreibzugriff; `replaceTextUndoable` prüft das selbst,
  `writeAt` **nicht**. Die Knöpfe müssen es selbst prüfen.
- **`caretLineOf()`** (app.js ~Zeile 2816) und **`syncCaret()`** (~Zeile
  2819): Cursor-Zeile lesen; `syncCaret` läuft bei `click`, `keyup`, `input`,
  `focus` am Textfeld — dort hängt der Knopfzustand (§5.4) mit ein.
- **`updateDocButtons()`** (app.js ~Zeile 5333): das Vorbild für Knöpfe der
  Editor-Titelzeile, die je nach Lage sichtbar/deaktiviert sind.
- **`keyboardOnJump(true)`** (app.js ~Zeile 1448): hält auf dem Telefon die
  Bildschirmtastatur unten, wenn das Textfeld programmatisch fokussiert wird
  (D25); `scrollEditorToOffset(offset)` (~Zeile 1419) scrollt eine Textstelle
  per Spiegel-`div` in Sicht.
- **Editor-Titelzeile**: `frontend/index.html` ~Zeile 106–137, die Gruppe
  `<span class="standgroup">` mit `saveBtn`, `snapAddBtn`, `snapBtn`,
  `reloadBtn`, `shareBtn`. Knöpfe tragen `class="copybtn"`, ein Inline-SVG
  (24×24, `stroke="currentColor" stroke-width="1.8"`) und
  `data-i18n-title`/`data-i18n-aria`.
- **i18n**: `const I18N = {de:{…}, en:{…}, es:{…}, fr:{…}, pl:{…}, ru:{…},
  hi:{…}, zh:{…}, ja:{…}}` in app.js (~Zeile 3468 ff.), Deutsch ist die
  Quellsprache. Die Legende endet mit
  `<div class="hint-op">${esc(t('hint_jump'))}<br>${esc(t('hint_save'))}</div>`
  (~Zeile 4787) — dort kommt die neue Bedienungs-Zeile dazu.
  **Anführungszeichen in i18n-Texten nur typografisch** (`„…“`, `“…”`,
  `«…»`), ein gerades `"` bricht den Bundle, und `npm test` merkt es nicht
  (D91-Nachtrag 8).

## 3. Was ein „Knoten“ beim Verschieben umfasst

Verschoben wird der **Block** eines Knotens. Der Block ist eine zusammen-
hängende Folge von Textzeilen im **Baumteil** (vor dem `---`-Trenner):

1. Die **Knotenzeile** `N` (die Zeile, die `node.line` nennt).
2. Danach jede Zeile, solange sie eine der folgenden ist:
   - eine **Fortsetzungszeile** (steht in einer `cont`-Liste von
     `logicalLines()`) — egal, wie sie eingerückt ist;
   - eine **`"`-Zeile** (Beschreibung, Kurzform) — egal, wie sie eingerückt
     ist;
   - eine **Leerzeile** oder eine Zeile, die nur aus Leerraum und einem
     `%%`-Kommentar besteht;
   - eine **Knotenzeile mit größerer Einrückungsbreite** als `N` (ein
     Nachkomme) — samt allem, was nach diesen Regeln zu ihr gehört.
3. Der Block endet **vor** der ersten Zeile, die nichts davon ist: die
   nächste Knotenzeile mit Einrückungsbreite **≤** der von `N`, der
   `---`-Trenner oder das Dateiende.
4. **Nachlaufende** Leer- und Kommentar-only-Zeilen gehören **nicht** zum
   Block — sie sind der **Abstand** zwischen zwei Blöcken und bleiben beim
   Verschieben zwischen den beiden Blöcken stehen (§4.3). Leer- und
   Kommentarzeilen **innerhalb** des Blocks (zwischen zwei Nachkommen)
   wandern mit.

**Was nicht mitwandert und nicht angefasst wird:**

- Der **Beschreibungsteil** hinter `---`: ID-Blöcke sind per ID adressiert,
  nicht per Position. Sie bleiben, wo sie sind.
- Alles **außerhalb** der beiden getauschten Blöcke und ihres Abstands. Die
  Operation ist ein reiner Tausch zweier Zeilenfolgen; die Gesamtlänge des
  Textes ändert sich **nicht** — jedes Zeichen vor und nach dem geänderten
  Bereich behält seinen Offset (das macht die Schreibmarken-Korrektur trivial,
  §5.3).

**Geschwister** sind Knotenzeilen mit **derselben** Einrückungsbreite unter
demselben Elternknoten — also ohne dass zwischen ihnen eine Knotenzeile mit
**kleinerer** Breite steht. Wurzelknoten (Breite 0, SPEC §2) sind
untereinander Geschwister; die Regel ist dieselbe.

## 4. Die Regel als Funktion (`parser.js`)

### 4.1 Signatur

```js
/* Verschiebt den Block des Knotens der Zeile `line` um eine Position unter
   seinen Geschwistern. `dir` ist -1 (nach oben) oder +1 (nach unten).
   Liefert null, wenn nichts zu tun ist (Zeile trägt keinen Knoten, kein
   Geschwister in dieser Richtung, Zeile liegt hinter `---`); sonst
   {text, from, to, lines, shift}:
     text   — der neue Gesamttext
     from   — 0-basierter Index der ersten geänderten Zeile
     to     — 0-basierter Index der letzten geänderten Zeile (einschließlich)
     lines  — die neuen Zeilen des Bereichs [from, to]
     shift  — um wie viele Zeilen die Knotenzeile gewandert ist (negativ = hoch) */
export function moveNodeBlock(text, line, dir)
```

`line` ist 1-basiert wie überall im Projekt (`node.line`, Warnungen,
`caretLine`). Die Funktion ist **rein** (kein DOM, kein Zustand) und liegt
neben `setFoldMark`, `setStatusBox` und `expandShortIds` in `parser.js`.

Zusätzlich, für den Knopfzustand ohne Schreiben:

```js
/* Sagt, ob der Knoten der Zeile `line` ein Geschwister vor (`up`) bzw.
   nach (`down`) sich hat. Ohne Knoten an der Zeile: {up:false, down:false}. */
export function moveTargets(text, line)
```

Beide teilen sich eine interne Hilfsfunktion, die die Blockgrenzen und die
Nachbarblöcke bestimmt (§4.3); `moveNodeBlock` setzt danach nur noch zusammen.

### 4.2 Die Cursor-Zeile zum Knoten auflösen

Die Schreibmarke kann auf einer Zeile stehen, die keinen eigenen Knoten
trägt, aber zu einem gehört (`"`-Zeile, Fortsetzung, Zeile eines ID-Blocks
hinter `---`). SPEC §9 sagt: Dann gilt dieser Knoten als ausgewählt — und
der Nutzer, der dort tippt, arbeitet an genau diesem Knoten. Dieselbe Lesart
gilt hier.

Auflösung: `parse(text).roots` rekursiv durchlaufen; der Knoten mit
`node.line === line` oder `node.descLines?.includes(line)` ist der gemeinte;
`N = node.line`. Gibt es keinen (Kommentarzeile, Leerzeile, `---` selbst,
Zeile hinter `---` ohne Block-Zuordnung) → `null`.

Achtung: `parse()` rechnet mit der **kommentarfreien, verbundenen** Fassung;
die Blockgrenzen (§4.3) werden aber auf den **Rohzeilen** `text.split('\n')`
bestimmt. Das passt zusammen, weil `node.line` immer die Nummer der ersten
Rohzeile ist (D59: „alles gehört zur ersten Zeile“).

### 4.3 Blockgrenzen und Nachbar bestimmen

Auf `lines = text.split('\n')` (0-basiert; Rohzeile `i` ist Textzeile `i+1`):

1. `sep` = Index der ersten Zeile, die `RE_SEP` erfüllt (auf der Rohzeile
   ohne Kommentar geprüft), sonst `lines.length`. Alles ab `sep` ist tabu.
2. `contSet` = Menge aller `cont`-Nummern aus `logicalLines(text)`,
   umgerechnet auf 0-basierte Indizes.
3. Klassifikation einer Rohzeile `i < sep`:
   - `strip = lines[i].replace(/%%.*$/, '')`
   - **cont**, wenn `contSet.has(i)`
   - **blank**, wenn `strip.trim() === ''` (deckt Leerzeile und
     Kommentar-only ab)
   - **desc**, wenn `/^[ \t]*"([ \t]|$)/.test(strip)`
   - sonst **node** mit `width = strip.match(/^[ \t]*/)[0].replace(/\t/g, '  ').length`

   (Eine Zeile, die nach Zeichen und Statusbox kein Label hat, wäre laut
   SPEC §1 kein Knoten — für die Blockrechnung darf sie trotzdem als `node`
   mit ihrer Breite zählen; sie gehört dann zu dem, wo sie steht. Solche
   Zeilen kommen praktisch nicht vor.)
4. **Blockende** `end(start)`: `j = start + 1`; solange `j < sep` und die
   Zeile `j` cont, blank, desc oder node mit `width > width(start)` ist,
   `j++`. Dann `j` rückwärts über blank-Zeilen zurückziehen (nachlaufende
   Abstände gehören nicht dazu). Ergebnis: letzter Index des Blocks
   (einschließlich), mindestens `start` plus seine eigenen cont-Zeilen.
5. **Vorheriges Geschwister** `prevStart(N)`: `k = N - 1`; solange `k ≥ 0`:
   ist Zeile `k` cont, blank oder desc → `k--`; ist sie node mit `width >
   width(N)` → `k--` (ein Nachkomme des Vorgängers); ist sie node mit
   `width === width(N)` → **gefunden**, `P = k`; ist sie node mit `width <
   width(N)` → **kein** Vorgänger (Elternknoten erreicht) → `null`. Bei
   `k < 0` ebenso `null`.
   Vorsicht: Beim Rückwärtslaufen trifft man eine `desc`-Zeile oder eine
   `cont`-Zeile, **bevor** man deren Knotenzeile trifft. Deshalb werden sie
   übersprungen — die Zuordnung ergibt sich, sobald man die Knotenzeile
   erreicht. Der gefundene Vorgänger-Block ist `[P, end(P)]`; per Konstruktion
   ist `end(P) < N`.
6. **Nächstes Geschwister** `nextStart(N)`: `k = end(N) + 1`; über
   blank-Zeilen vorwärts; die erste Nicht-blank-Zeile muss node mit `width
   === width(N)` sein → `Q = k`; alles andere (`k ≥ sep`, node mit kleinerer
   Breite) → `null`. (Größere Breite, cont oder desc können hier nicht
   auftreten — sie wären Teil des Blocks.) Der Nachbar-Block ist
   `[Q, end(Q)]`.

### 4.4 Zusammensetzen

Nach oben (`dir = -1`, Vorgänger `[P, endP]`, eigener Block `[N, endN]`,
Abstand `gap = lines.slice(endP + 1, N)`):

```
neu = lines.slice(0, P)
    .concat(lines.slice(N, endN + 1))      // eigener Block zuerst
    .concat(gap)                            // Abstand bleibt zwischen beiden
    .concat(lines.slice(P, endP + 1))       // dann der Vorgänger
    .concat(lines.slice(endN + 1));
from = P; to = endN; shift = P - N;
```

Nach unten (`dir = +1`, Nachbar `[Q, endQ]`, `gap = lines.slice(endN + 1, Q)`):

```
neu = lines.slice(0, N)
    .concat(lines.slice(Q, endQ + 1))       // Nachbar zuerst
    .concat(gap)
    .concat(lines.slice(N, endN + 1))       // dann der eigene Block
    .concat(lines.slice(endQ + 1));
from = N; to = endQ; shift = (endQ - Q + 1) + gap.length;
```

`text = neu.join('\n')`. Weil nur Zeilen umgestellt werden, ist
`neu.length === lines.length` und `text.length === alt.length`.

### 4.5 Was ausdrücklich **nicht** passiert

- Keine Änderung an Einrückung, Zeichen, Statusbox, Faltmarke, IDs, Tags,
  Abhängigkeiten. Eine Faltmarke `>` wandert mit ihrer Zeile — die Faltung
  bleibt am Knoten.
- Kein Verschieben **über** die Geschwistergruppe hinaus (nicht zum Onkel,
  nicht in einen anderen Elternknoten). Das wäre Umhängen, nicht
  Verschieben, und eine eigene Entscheidung.
- Kein Verschieben, wenn die Zeile keinen Knoten trägt oder hinter `---`
  liegt, ohne zu einem ID-Block zu gehören.
- Keine Prüfung der Gates: Wer in einer gemischten Gruppe verschiebt, kann
  das erste Kind wechseln und damit die Darstellung der Gruppe (SPEC §3:
  Darstellung nach dem ersten Kind). Das ist dieselbe Wirkung wie beim
  händischen Umsortieren; `mixedGate` warnt ohnehin.

## 5. Verdrahtung im Editor (`app.js`, `index.html`)

### 5.1 Zwei Knöpfe in der Editor-Titelzeile

In `index.html` innerhalb von `<span class="standgroup">`, **vor**
`saveBtn` (die Verschiebe-Knöpfe gehören zum Bearbeiten, Speichern & Co. zur
Ablage; so stehen sie am Anfang der Gruppe):

```html
<!-- Knoten der Cursor-Zeile unter seinen Geschwistern verschieben (RFC 003,
     D95): der ganze Block — Zeile, Fortsetzungen, "-Zeilen, Teilbaum — als
     ein Undo-Schritt. Deaktiviert ohne Geschwister in der Richtung. -->
<button type="button" class="copybtn" id="moveUpBtn" data-i18n-title="moveUpTooltip" data-i18n-aria="moveUpTooltip" title="Knoten nach oben (Alt+↑)" aria-label="Knoten nach oben (Alt+↑)" disabled>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6"/><path d="M6 12l6-6 6 6"/></svg>
</button>
<button type="button" class="copybtn" id="moveDownBtn" data-i18n-title="moveDownTooltip" data-i18n-aria="moveDownTooltip" title="Knoten nach unten (Alt+↓)" aria-label="Knoten nach unten (Alt+↓)" disabled>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v13"/><path d="M6 12l6 6 6-6"/></svg>
</button>
```

**Eine CSS-Regel** in `frontend/src/style.css` neben den `.copybtn`-Regeln
(geprüft: es gibt bisher keine allgemeine Regel für deaktivierte Knöpfe, der
`reloadBtn` verlässt sich auf die Browser-Voreinstellung):

```css
.copybtn:disabled{opacity:.45;cursor:default}
```

Sie gilt damit auch dem `reloadBtn` — gewollt, derselbe Zustand soll gleich
aussehen. Auf dem Telefon (D17, `body.mobile`) stehen die Knöpfe in der
Text-Titelzeile wie die übrigen; nach dem Einbau bei 375 px nachmessen, dass
die Zeile einreihig bleibt (Vorbild D17-Nachtrag 5 / D50 — die Umbruch-
Schwelle liegt bei 440 px; die Editor-Titelzeile hat weniger Elemente als
die Diagramm-Titelzeile und war bisher nie knapp).

### 5.2 Tastatur

Am Textfeld, neben den vorhandenen `keydown`-Handlern (~Zeile 2915):

```js
/* Alt+↑ / Alt+↓ verschieben den Knoten der Cursor-Zeile (RFC 003). Ohne
   Alt gehören die Pfeile der Schreibmarke bzw. der ID-Vorschlagsliste (D63). */
src.addEventListener('keydown', e => {
  if(!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if(e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  moveCaretNode(e.key === 'ArrowUp' ? -1 : 1);
});
```

`e.repeat` **nicht** ausfiltern: gehaltenes Alt+↓ soll den Knoten
weiterschieben, jeder Schritt ist ein eigener Undo-Schritt — das ist das
Verhalten von IntelliJ und VS Code. Die ID-Vorschlagsliste (D63) fängt
ArrowUp/Down nur **ohne** Alt ab; kein Konflikt.

### 5.3 Der Schreibvorgang

```js
function moveCaretNode(dir){
  if(viewOnly) return;                       /* Nur-Ansehen (D94 §6.5) */
  const line = caretLineOf();
  const col  = src.selectionStart - (src.value.lastIndexOf('\n', src.selectionStart - 1) + 1);
  const r = moveNodeBlock(src.value, line, dir);
  if(!r) return;
  const alt = src.value;
  /* Nur den geänderten Bereich ersetzen — die Zeilen [from, to]. */
  const von = offsetOfLine(alt, r.from);           /* Offset des Zeilenanfangs von Rohzeile from */
  const bis = offsetOfLine(alt, r.to + 1) - 1;     /* Ende der Zeile to, ohne deren '\n' */
  const ein = r.lines.join('\n');
  /* Schreibmarke: dieselbe Spalte in derselben Zeile des Blocks, der um `shift`
     Zeilen gewandert ist. Zeilen, die nicht zum eigenen Block gehörten (Cursor
     in einem ID-Block hinter ---), liegen außerhalb des Bereichs und behalten
     ihren Offset — der Text ist gleich lang geblieben. */
  const newLine = (line - 1 >= r.from && line - 1 <= r.to && istImEigenenBlock)
      ? line + r.shift : line;
  keyboardOnJump(true);                    /* Telefon: Fokus ohne Tastatur (D25) */
  src.focus({preventScroll: true});
  const top = src.scrollTop;
  writeAt(von, bis, ein, 0, 0);            /* Auswahl setzen wir gleich selbst */
  const pos = Math.min(offsetOfLine(src.value, newLine - 1) + col,
                       offsetOfLine(src.value, newLine) - 1);
  src.setSelectionRange(pos, pos);
  src.scrollTop = top;
  scrollEditorToOffset(pos);               /* nur, wenn die Zeile aus dem Bild gerückt ist */
  const btn = dir < 0 ? moveUpBtn : moveDownBtn;
  if(btn) flashBtn(btn);
}
```

Dabei ist `offsetOfLine(text, idx)` eine kleine Hilfsfunktion: Offset des
Anfangs der 0-basierten Rohzeile `idx` (`idx === Zeilenzahl` ⇒
`text.length + 1`, damit `bis` für die letzte Zeile stimmt). Ob es sie schon
gibt, vorher mit `grep -n "function offsetOf\|lineStart" frontend/src/app.js`
prüfen; sonst anlegen.

`istImEigenenBlock` ist wahr, wenn die Cursor-Zeile (0-basiert `line-1`) im
Bereich `[N, endN]` des **eigenen** Blocks lag — `moveNodeBlock` sollte dafür
`from`/`to` des eigenen Blocks mitliefern (im Rückgabeobjekt z. B. als
`own: [N, endN]`); die Signatur in §4.1 entsprechend ergänzen. Stand die
Schreibmarke im Nachbar-Block (kann sie nicht — die Cursor-Zeile bestimmt
den eigenen Block), braucht es keinen Fall.

Warum **`writeAt` und nicht `replaceTextUndoable`**: Letztere sucht den
kleinsten abweichenden Bereich und klemmt eine Schreibmarke **innerhalb**
des Bereichs an dessen Anfang — für einen Block, der gerade darin wandert,
wäre das die falsche Stelle. Hier ist der Bereich bekannt und die neue
Position berechenbar. `writeAt` feuert `input`, daran hängen `render()`,
`saveSrc()` und der Live-Push (D76) von selbst; **kein** zusätzlicher
Aufruf nötig. Der Rückfall in `writeAt` (`src.value = …`, wenn `execCommand`
scheitert) ist Absicht (D14: der richtige Zustand geht vor der Historie).

`flashBtn` (~Zeile 3435) gibt den kurzen Petrol-Blitz mit Haken — dafür
braucht der Knopf die beiden SVGs `ic-main`/`ic-done` wie `saveBtn`; **oder**
der Blitz entfällt, weil der Text sich sichtbar bewegt. **Empfehlung:
weglassen.** Die Bewegung des Textes ist Rückmeldung genug (wie beim Falten,
D38-Nachtrag 2: „die neue Farbe des Knotens ist die Rückmeldung“). Dann auch
die `flashBtn`-Zeile oben streichen und nur ein SVG je Knopf.

### 5.4 Knopfzustand

Der Zustand hängt an der Cursor-Zeile und am Text. In `syncCaret()` (~Zeile
2819) am Ende ergänzen:

```js
updateMoveButtons();
```

und

```js
function updateMoveButtons(){
  const up = document.getElementById('moveUpBtn'), dn = document.getElementById('moveDownBtn');
  if(!up || !dn) return;
  const tgt = viewOnly ? {up:false, down:false} : moveTargets(src.value, caretLineOf());
  up.disabled = !tgt.up;
  dn.disabled = !tgt.down;
}
```

Zusätzlich aufrufen in `loadActiveIntoEditor()` (Dokumentwechsel) und dort,
wo `viewOnly` gesetzt wird (`setViewOnly` o. ä., app.js ~Zeile 144).
`moveTargets` parst den Text; bei jedem `keyup` ist das für den
mitgelieferten Plan (≈ 1000 Zeilen) im einstelligen Millisekundenbereich —
`render()` parst bei jedem `input` ohnehin. Wird es messbar, den letzten
`parse()`-Baum aus `render()` wiederverwenden statt neu zu parsen; zuerst
die einfache Fassung.

Die Klicks:

```js
document.getElementById('moveUpBtn')  ?.addEventListener('click', () => moveCaretNode(-1));
document.getElementById('moveDownBtn')?.addEventListener('click', () => moveCaretNode(1));
```

Der Klick nimmt dem Textfeld den Fokus — `moveCaretNode` holt ihn zurück
(`src.focus`, §5.3), damit `execCommand` greift und die Schreibmarke danach
sichtbar im Text steht. Auf dem Telefon hält `keyboardOnJump(true)` die
Bildschirmtastatur dabei unten.

### 5.5 i18n (Deutsch als Quelle; die übrigen sieben Sprachen übersetzt der Umsetzende)

| Schlüssel         | de                                                                                                   | en                                                                                                      |
|-------------------|------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| `moveUpTooltip`   | Knoten nach oben – vor den vorherigen Geschwisterknoten, samt Teilbaum (Alt+↑)                        | Move node up – before its previous sibling, subtree included (Alt+↑)                                    |
| `moveDownTooltip` | Knoten nach unten – hinter den nächsten Geschwisterknoten, samt Teilbaum (Alt+↓)                       | Move node down – after its next sibling, subtree included (Alt+↓)                                       |
| `hint_move`       | Alt+↑/↓ verschiebt den Knoten der Cursor-Zeile unter seinen Geschwistern – mit Beschreibung und Teilbaum. | Alt+↑/↓ moves the node of the caret line among its siblings – description and subtree included.          |

Die Legenden-Zeile einhängen: in der Legenden-Funktion (~Zeile 4787)
`…${esc(t('hint_save'))}<br>${esc(t('hint_move'))}</div>`. Alle neun
Sprachen (`de en es fr pl ru hi zh ja`) bekommen alle drei Schlüssel — ein
Loch in der Tabelle wird beim nächsten Durchsehen für einen Fehler gehalten
(D58-Nachtrag). Nach dem Eintragen die Syntaxprobe laufen lassen:
`cd frontend && npx esbuild src/app.js --outfile=/dev/null` — `npm test`
importiert `app.js` nicht (D91-Nachtrag 8).

### 5.6 Verhalten in besonderen Lagen

- **Geteiltes Dokument (`?live=`)**: nichts Besonderes. Der Umbau ist eine
  gewöhnliche Textänderung; nach 0,6 s Ruhe geht sie als Zeilen-Diff an den
  Server (D76/D79). Der Diff ist größer als beim Tippen (zwei Blöcke), der
  Server rebased ihn wie jeden anderen; bei echter Überlappung mit fremden
  Änderungen an denselben Zeilen kommt das Konflikt-Band. Kein Sonderfall.
- **Nur-Ansehen (D94 §6.5)**: Knöpfe deaktiviert, Taste wirkungslos
  (`viewOnly`-Wächter in `moveCaretNode` **und** `updateMoveButtons`).
- **Faltung**: Marken wandern mit ihrer Zeile; die Sitzungs-Überlagerungen
  (`foldOverrides`) hängen am Label-Pfad (D38) und bleiben gültig. Nichts zu
  tun.
- **Cursor in einem eingeklappten Teilbaum**: Das Verschieben arbeitet auf
  dem Text, nicht auf dem DOM — der eingeklappte Knoten wird wie jeder
  andere verschoben. Der Neubau zeichnet den Zustand.
- **Cursor in einem ID-Block hinter `---`**: Der beschriebene Knoten wird
  verschoben (§4.2); die Schreibmarke bleibt an Ort und Stelle (Offsets hinter
  dem Bereich ändern sich nicht).
- **Cursor auf Leer-/Kommentarzeile / `---` / ohne Knoten**: Knöpfe
  deaktiviert, Taste tut nichts. Dieselbe stille Regel wie beim Alt+Klick
  (D25).

## 6. Tests (`frontend/tests/move.test.js`, neu)

Vitest, Muster wie `tests/fold.test.js`. Mindestens diese Fälle; jeder als
Text → erwarteter Text, zeichengenau (`toBe`, nicht nur „enthält“):

1. **Einfacher Tausch nach oben/unten** zweier Blatt-Geschwister:
   `A\n  - B\n  - C` → Cursor Zeile 3, `dir -1` ⇒ `A\n  - C\n  - B`;
   `shift === -1`; nach unten von Zeile 2 ⇒ dasselbe Ergebnis, `shift === 1`.
2. **Teilbaum wandert mit**: `A\n  - B\n    - B1\n    - B2\n  - C` → C
   nach oben ⇒ `A\n  - C\n  - B\n    - B1\n    - B2`.
3. **`"`-Zeilen wandern mit**: `A\n  - B\n    " Beschreibung B\n  - C` →
   B nach unten ⇒ `A\n  - C\n  - B\n    " Beschreibung B`.
4. **`\`-Fortsetzungen wandern mit** (auch wenn die Fortsetzung anders
   eingerückt ist): `A\n  - B lang \\\n      weiter (L)\n  - C` → C hoch ⇒
   `A\n  - C\n  - B lang \\\n      weiter (L)`.
5. **Cursor in der Fortsetzung / in der `"`-Zeile** wählt den Knoten:
   Cursor Zeile 3 in Fall 4 (die Fortsetzung) und `dir +1` ⇒ B wandert
   hinter C; Rückgabe `shift === 1`, und `own` deckt Zeile 2–3 ab.
6. **Abstand bleibt zwischen den Blöcken**: `A\n  - B\n\n  - C` → C hoch ⇒
   `A\n  - C\n\n  - B`. Kommentar-only-Zeile im Abstand ebenso.
7. **Kommentar-/Leerzeile innerhalb des Blocks wandert mit**:
   `A\n  - B\n    - B1\n    %% Notiz\n    - B2\n  - C` → C hoch ⇒ Notiz
   steht weiter zwischen B1 und B2.
8. **Kein Geschwister**: einziges Kind, erstes Kind nach oben, letztes Kind
   nach unten ⇒ `null`; `moveTargets` liefert entsprechend
   `{up:false, down:true}` usw.
9. **Nicht über den Elternknoten hinaus**: `A\n  - B\n    - B1\n  - C` →
   B1 nach unten ⇒ `null` (C ist kein Geschwister von B1).
10. **Wurzelknoten** sind untereinander Geschwister: `A\n  - A1\nB\n  - B1`
    → B hoch ⇒ `B\n  - B1\nA\n  - A1`.
11. **Beschreibungsteil bleibt stehen**: `A\n  - #b: B\n  - #c: C\n---\n#b\n  Text b\n#c\n  Text c`
    → C hoch ⇒ Baumteil getauscht, alles ab `---` byte-identisch; Cursor
    auf Zeile 8 (`  Text c`) verschiebt C ebenfalls (Auflösung über
    `descLines`); Cursor auf Zeile 4 (`---`) ⇒ `null`.
12. **Faltmarke wandert mit**: `A\n  - [ ] > B\n    - B1\n  - C` → C hoch ⇒
    `A\n  - C\n  - [ ] > B\n    - B1`.
13. **Tab-Einrückung** zählt als zwei Leerzeichen: `A\n\t- B\n  - C` → C hoch
    ⇒ `A\n  - C\n\t- B` (B und C sind Geschwister).
14. **Invariante**: für jeden Fall `neu.length === alt.length` und die
    sortierten Zeilen beider Texte sind gleich (nichts geht verloren, nichts
    kommt dazu).
15. **Idempotenz-Probe**: hoch und dann runter ergibt den Ausgangstext.

Gegenprobe per Mutation (Hausregel D54-Nachtrag 3): Entfernt man in
`end()` das Überspringen der `desc`-Zeilen, müssen **genau** Fall 3 und 5
fallen; entfernt man die Tab-Umrechnung, genau Fall 13; entfernt man das
Zurückziehen nachlaufender Leerzeilen, genau Fall 6. Das Ergebnis der
Gegenprobe gehört in den Commit-Text.

## 7. Browser-Nachmessung (vor dem Merge)

Dev-Server `cd frontend && npm run dev`, Werkbaum-Plan öffnen:

1. Cursor auf `#ed.render.vert`, Alt+↑ ⇒ die Zeile steht über
   `#ed.render.horiz`, Schreibmarke in derselben Spalte derselben Zeile,
   Diagramm zeigt die neue Reihenfolge, **ein** Strg+Z stellt alles her
   (Text und Bild).
2. Cursor auf `#ed.fold` (hat Kinder und Faltmarken im Plan), Knopf ▼ ⇒
   der ganze Block samt Kindern steht hinter `#ed.lens`; Beschreibungsteil
   unverändert (per `git diff` der Textarea-Fassung oder Zeilenzahl
   prüfen: Zeilenzahl gleich).
3. Cursor in eine `\`-Fortsetzung oder `"`-Zeile setzen ⇒ Knöpfe aktiv,
   Verschieben nimmt die Zeile mit.
4. Cursor auf eine Kommentarzeile oder in `---` ⇒ beide Knöpfe deaktiviert.
5. Erstes Kind: ▲ deaktiviert, ▼ aktiv; letztes Kind umgekehrt.
6. Nur-Ansehen (zweites Fenster auf demselben lokalen Dokument, D94) ⇒
   beide deaktiviert, Alt+↑ tut nichts.
7. 375 px (`body.mobile`): Editor-Titelzeile bleibt einreihig; Tipp auf ▲
   verschiebt, ohne dass die Bildschirmtastatur hochkommt (soweit in der
   Emulation prüfbar — die Tastatur selbst ist Handtest, D17-Nachtrag 4).
8. Geteiltes Dokument gegen ein lokales Backend: Verschieben kommt beim
   zweiten Client an (Feed) — sofern ein Backend läuft; sonst als
   Handtest notieren.

Werkzeuggrenzen, die dabei zuschnappen können (alle schon bezahlt):
`execCommand` braucht Fensterfokus (D57, D91-Nachtrag 8) — in einer
verborgenen Automations-Fläche greift der `src.value`-Rückfall; synthetische
Tastendrücke kommen ggf. mit `e.key === ''` an (D67); `document.hidden`
drosselt Timer (D79).

## 8. Alternativen (verworfen)

- **Neue Editor-Komponente (CodeMirror 6)**: bringt „Zeile verschieben“
  mit, kostet 120 kB gzip und berührt ein Dutzend Entscheidungen (D76 misst
  das). Für ein Feature, das eine Text→Text-Funktion und zwei Knöpfe ist,
  außer Verhältnis. Bleibt eine eigene Frage.
- **Verschieben per Drag & Drop im Diagramm**: die stärkere Geste, aber
  ein anderes Feature (Umhängen zwischen Eltern eingeschlossen, Touch-
  Konflikt mit langem Druck D25 und Scrollen). Nicht hier.
- **Nur die Cursor-Zeile verschieben** (wie ein Texteditor): zerreißt in
  dieser Notation Teilbäume und Beschreibungen — der Nutzerwunsch nennt
  ausdrücklich `"`-Zeilen und `\`-Fortsetzungen. Der Block ist die Einheit.
- **Abstand-Leerzeilen mitnehmen**: dann sammelten sich Leerzeilen an einem
  Ende der Gruppe; als Abstand zwischen den Blöcken bleiben sie neutral.
- **`e.repeat` filtern**: ein gehaltener Pfeil soll weiterschieben — das
  Vorbild der IDEs; jeder Schritt bleibt ein eigener Undo-Schritt.

## 9. Nachziehen der Dokumente (im selben Zug, nicht am Ende)

### 9.1 SPEC §9 — neuer Abschnitt, hinter „Zeilennummern im Texteditor“

```
### Knoten verschieben (Editor-Titelzeile)
Zwei Knöpfe (▲ / ▼) in der Titelzeile des Text-Editors — Tastatur **Alt+↑**
/ **Alt+↓** im Textfeld — verschieben den Knoten der **Cursor-Zeile** vor
seinen vorherigen bzw. hinter seinen nächsten **Geschwisterknoten**.
Verschoben wird der ganze **Block**: die Zeile, ihre Fortsetzungen (`\`,
§1), ihre Beschreibungszeilen (`"`, §1) und der Teilbaum darunter, samt
Kommentar- und Leerzeilen darin; Leerzeilen **zwischen** zwei Blöcken bleiben
zwischen ihnen stehen. Steht der Cursor in einer Fortsetzungs- oder
Beschreibungszeile oder in einem ID-Block hinter `---`, gilt der beschriebene
Knoten (§9, Sprung). Der Beschreibungsteil hinter `---` wird nie angefasst —
seine Blöcke sind per ID adressiert. Über die Geschwistergruppe hinaus wird
nicht verschoben; ohne Geschwister in der Richtung ist der Knopf deaktiviert.
Die Änderung ist eine gewöhnliche, **undo-fähige** Textänderung (ein
Schritt) — in einem geteilten Dokument (`?live=`) sehen sie damit alle. Im
Nur-Ansehen-Modus (D94) ist sie gesperrt. Eine Eingabehilfe, keine Notation:
Der Parser sieht nie etwas davon, `llms.md` (§13) bleibt unberührt. Siehe D95.
```

### 9.2 CHANGELOG (`## 2026-09-…`, oberster Tag)

```
- Two buttons in the editor title bar — and Alt+↑/↓ in the text — move the node of the caret line before its previous or after its next sibling, taking its continuation lines, `"` descriptions and whole subtree along in one undo step
```

### 9.3 Legende

`hint_move` als dritte Zeile der Bedienungs-Zeile (§5.5).

### 9.4 `frontend/CLAUDE.md`

Falls dort eine Liste der Text→Text-Rückschreiber steht (`setFoldMark`,
`expandShortIds`, `setStatusBox`), `moveNodeBlock` ergänzen. Sonst nichts.

### 9.5 DECISIONS — D95 anhängen (Entwurf; beim Bauen um Messwerte ergänzen)

```
## D95 — Knoten im Text verschieben: Block statt Zeile, Alt+↑/↓, kein neuer Editor
Nutzerwunsch: Knöpfe in der Editor-Titelzeile, die den Knoten der
Cursor-Zeile vor den vorherigen bzw. hinter den nächsten Geschwisterknoten
schieben, samt `"`-Zeilen und `\`-Fortsetzungen. Gebaut als reine
Text→Text-Regel (`moveNodeBlock` in parser.js, neben `setFoldMark`,
`expandShortIds`, `setStatusBox`), geschrieben über `writeAt` als ein
Undo-Schritt; kein CodeMirror (D76 hält das als eigene Frage offen).
Verschoben wird der **Block** — Zeile, Fortsetzungen, Beschreibungen,
Teilbaum —, nicht die Zeile: In dieser Notation ist die Zeile keine
Einheit, der Knoten ist es. Leerzeilen zwischen Blöcken bleiben Abstand.
Nicht über die Geschwistergruppe hinaus (das wäre Umhängen, eine eigene
Entscheidung); der Beschreibungsteil hinter `---` bleibt stehen (per ID
adressiert). Tastatur Alt+↑/↓ wie in IntelliJ und VS Code; ohne Alt
gehören die Pfeile der Schreibmarke und der ID-Vorschlagsliste (D63).
`e.repeat` bewusst nicht gefiltert. Vollständige Bauanleitung, Fälle und
Alternativen: docs/rfc/003-knoten-verschieben.md.
```

### 9.6 Plan (`docs/examples/werkbaum.werkbaum`)

Im Baumteil unter `#ed`, nach der Zeile `#ed.depcomplete` (Zeile ≈ 88):

```
    - [x] #ed.move: Move a node up or down among its siblings, block and all (S)  %% docs/rfc/003-knoten-verschieben.md, D95
```

(`[x]` beim Mergen; `[^]` setzt erst der Deploy, D30. Bis zum Bauen: `[ ]`.)
Im Beschreibungsteil, alphabetisch bei den `#ed.*`-Blöcken:

```
#ed.move
  Two buttons in the editor title bar and Alt+Up/Down move the node of the
  caret line before its previous or after its next sibling. The whole block
  travels — continuation lines, quote descriptions, the subtree — as one
  undo step; the description part behind --- stays where it is.
```

Danach `npm test` — der Plan hat Snapshot-/Warnungs-Tests; 0 Warnungen
müssen bleiben (Größenprüfung D62: `#ed` ist XXL und warnt nie, aber die
Elterngröße einer Zwischenebene könnte kippen — dann ehrlich nachziehen wie
in D64/D91-Nachtrag 11).

## 10. Umsetzungsreihenfolge

1. `moveNodeBlock`/`moveTargets` in `parser.js` + `tests/move.test.js`
   (§4, §6), Gegenprobe per Mutation. `npm test` grün.
2. Knöpfe, Tastatur, `moveCaretNode`, `updateMoveButtons`, i18n ×9,
   Legenden-Zeile (§5). `npx esbuild src/app.js --outfile=/dev/null`.
3. Browser-Nachmessung (§7), Befunde in den Commit-Text.
4. SPEC §9, CHANGELOG, D95, Plan-Knoten (§9) — im selben Commit oder direkt
   danach, nie später.

Commit-Texte auf Deutsch, Betreff nach dem Muster der Historie
(`feat(editor): …`), Abschluss `Co-Authored-By: Claude Fable 5.1
<noreply@anthropic.com>`. Direkt auf `main`, kein PR.

## 11. Revisionsgeschichte

- 2026-09-03 — erste Fassung aus dem Nutzerwunsch; als Bauanleitung für
  einen Coding-Agenten geschrieben. Nichts gebaut.
