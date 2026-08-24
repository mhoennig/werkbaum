import { describe, it, expect } from 'vitest';
import { parse, logicalLines, expandShortIds } from '../src/parser.js';

/* Fortsetzungszeilen (SPEC §1): Endet eine Zeile auf Leerraum + `\`, gehört
   die Folgezeile noch dazu — es beginnt kein neuer Knoten. */

const baum = t => parse(t).roots;
const labels = nodes => nodes.map(n => n.label);

describe('logicalLines — Zeilen zusammenfügen', () => {
  it('hängt die Folgezeile mit genau einem Leerzeichen an', () => {
    expect(logicalLines('- Ein sehr langes \\\n  Label').map(r => r.raw))
      .toEqual(['- Ein sehr langes Label']);
  });

  it('merkt sich die erste Zeilennummer und die angehängten', () => {
    const r = logicalLines('a\n- b \\\n  c \\\n  d\ne');
    expect(r.map(x => ({line: x.line, cont: x.cont})))
      .toEqual([{line: 1, cont: []}, {line: 2, cont: [3, 4]}, {line: 5, cont: []}]);
  });

  /* Von der ersten Zeile bleibt nur die Einrückung übrig — sie trägt die
     Ebene (§2) und muss stehen bleiben. */
  it('erhält die Einrückung, wenn die erste Zeile nur aus ihr besteht', () => {
    expect(logicalLines('  \\\n- Kind').map(r => r.raw)).toEqual(['  - Kind']);
  });

  it('lässt eine Zeile ohne Leerraum vor dem Backslash in Ruhe', () => {
    expect(logicalLines('- C:\\temp\\\n- Zweiter').map(r => r.raw))
      .toEqual(['- C:\\temp\\', '- Zweiter']);
  });

  /* Der Kommentar fällt zuerst weg (Schritt 1) — ein `\` DAHINTER wirkt also
     nicht, einer davor schon. */
  it('achtet auf die Reihenfolge mit dem Kommentar', () => {
    expect(logicalLines('- A %% Notiz \\\n- B').map(r => r.raw)).toEqual(['- A ', '- B']);
    expect(logicalLines('- A \\ %% Notiz\n- B').map(r => r.raw)).toEqual(['- A - B']);
  });

  it('lässt am Dateiende einfach den Backslash weg', () => {
    expect(logicalLines('- A \\').map(r => r.raw)).toEqual(['- A ']);
  });

  it('hängt auch eine leere Folgezeile an, ohne etwas zu verlieren', () => {
    expect(logicalLines('- A \\\n\n- B').map(r => r.raw)).toEqual(['- A ', '- B']);
  });

  /* Hinter dem Trenner ist der Zeilenumbruch Absatzstruktur (SPEC §1). */
  it('verbindet im Beschreibungsteil nicht', () => {
    const r = logicalLines('- A #x\n---\n#x\n  erste \\\n  zweite');
    expect(r.map(x => x.raw)).toEqual(['- A #x', '---', '#x', '  erste \\', '  zweite']);
  });
});

describe('parse — die fortgesetzte Zeile ergibt EINEN Knoten', () => {
  it('macht aus zwei Textzeilen einen Knoten', () => {
    const r = baum('- Backend mit einem \\\n  sehr langen Titel');
    expect(labels(r)).toEqual(['Backend mit einem sehr langen Titel']);
  });

  it('liest Größe, Tag, ID und URL auch von der Folgezeile', () => {
    const r = parse('- #api: Backend \\\n  (L) @anna https://example.org/x');
    const n = r.roots[0];
    expect(n.label).toBe('Backend');
    expect(n.size).toBe('L');
    expect(n.tags).toEqual(['anna']);
    expect(n.id).toBe('api');
    expect(n.url).toBe('https://example.org/x');
    expect(r.warnings).toEqual([]);
  });

  /* Die Einrückung der ERSTEN Zeile bestimmt die Ebene — die der Folgezeile
     ist bedeutungslos, auch wenn sie tiefer steht. */
  it('nimmt die Ebene von der ersten Zeile', () => {
    const r = baum('Wurzel\n  - Kind \\\n        Fortsetzung\n  - Zweites');
    expect(labels(r)).toEqual(['Wurzel']);
    expect(labels(r[0].children)).toEqual(['Kind Fortsetzung', 'Zweites']);
  });

  it('zählt die Zeile der ersten Textzeile', () => {
    const r = baum('\n\n- Knoten \\\n  weiter');
    expect(r[0].line).toBe(3);
  });

  /* Warnungen nennen die Zeile, an der man eingreift. */
  it('meldet eine Warnung an der ersten Zeile', () => {
    const w = parse('- [z] Knoten \\\n  weiter').warnings;
    expect(w).toEqual([{type: 'unknownStatus', line: 1, code: 'z'}]);
  });

  /* Fortsetzungszeilen tragen keinen eigenen Knoten und wählen deshalb den
     ihren aus, wenn der Cursor darin steht (SPEC §9, wie Beschreibungen). */
  it('ordnet die Fortsetzungszeilen ihrem Knoten zu', () => {
    const n = baum('- Knoten \\\n  weiter \\\n  und weiter')[0];
    expect(n.descLines).toEqual([2, 3]);
  });

  it('setzt eine Zeile über mehrere Umbrüche fort', () => {
    expect(labels(baum('- a \\\n  b \\\n  c \\\n  d'))).toEqual(['a b c d']);
  });

  it('lässt einen Backslash ohne Leerraum davor im Label stehen', () => {
    expect(labels(baum('- C:\\temp\\\n- Zweiter'))).toEqual(['C:\\temp\\', 'Zweiter']);
  });

  it('fügt kein Token über den Umbruch zusammen', () => {
    /* Verbunden wird mit einem Leerzeichen — eine zerschnittene URL bleibt
       zerschnitten, und das ist die ehrliche Auskunft. */
    expect(parse('- Titel https://exa \\\n  mple.org').roots[0].url).toBe('https://exa');
  });

  it('verbindet eine Beschreibungszeile ebenso', () => {
    const n = parse('- Knoten\n  " erster Teil \\\n  zweiter Teil').roots[0];
    expect(n.desc).toBe('erster Teil zweiter Teil');
  });
});

describe('expandShortIds — Fortsetzungszeilen sind keine Knotenzeilen', () => {
  it('nimmt eine Fortsetzung nicht in den Vorfahren-Stapel auf', () => {
    const text = ['#a: A', '  - Zwischen \\', '    weiter', '  - #.c: C'].join('\n');
    expect(expandShortIds(text)).toContain('#a.c: C');
  });

  it('fasst eine Kurzform in einer Fortsetzungszeile nicht an', () => {
    const text = ['#a: A', '  - Kind \\', '    #.x bleibt'].join('\n');
    expect(expandShortIds(text)).toBe(text);
  });
});
