import { describe, it, expect } from 'vitest';
import { expandShortIds, shortIdClosed, parse } from '../src/parser.js';

/* Kurzschreibweise der Knoten-ID (D55): `#.kc` unter `#prod-stage` wird beim
   Verlassen der Zeile zu `#prod-stage.kc`. Eingabehilfe, keine Notation — in
   der Datei steht danach immer die volle ID. */

describe('expandShortIds — auflösen gegen den nächsten Vorfahren mit ID', () => {
  it('löst gegen den Elternknoten auf', () => {
    const text = ['#prod-stage: Stage', '  - #.kc: Keycloak'].join('\n');
    expect(expandShortIds(text)).toBe(
      ['#prod-stage: Stage', '  - #prod-stage.kc: Keycloak'].join('\n'));
  });

  it('löst über mehrere Ebenen jeweils gegen die nächste auf', () => {
    const text = ['#a: A', '  - #.b: B', '    - #.c: C'].join('\n');
    /* Die zweite Zeile ist beim Auflösen der dritten bereits `#a.b`. */
    expect(expandShortIds(text)).toBe(
      ['#a: A', '  - #a.b: B', '    - #a.b.c: C'].join('\n'));
  });

  /* Der direkte Elternknoten muss keine ID haben — dann zählt der nächste
     Vorfahre, der eine hat. */
  it('überspringt Vorfahren ohne ID', () => {
    const text = ['#a: A', '  - Zwischenknoten ohne ID', '    - #.c: C'].join('\n');
    expect(expandShortIds(text)).toContain('#a.c: C');
  });

  it('nimmt mehrere Stufen auf einmal', () => {
    const text = ['#a: A', '  - #.b.c: tief'].join('\n');
    expect(expandShortIds(text)).toContain('#a.b.c: tief');
  });

  it('lässt volle IDs unangetastet', () => {
    const text = ['#a: A', '  - #ganz.anders: X'].join('\n');
    expect(expandShortIds(text)).toBe(text);
  });

  it('gibt denselben String zurück, wenn nichts aufzulösen ist', () => {
    const text = '- [x] Nichts zu tun (M)';
    expect(expandShortIds(text)).toBe(text);
  });
});

describe('expandShortIds — wo nicht aufgelöst werden kann, bleibt der Text stehen', () => {
  it('lässt eine Wurzelzeile in Ruhe (kein Vorfahre)', () => {
    const text = '#.kc: Keycloak';
    expect(expandShortIds(text)).toBe(text);
  });

  it('löst nicht gegen einen Vorfahren auf, der selbst noch kurz ist', () => {
    const text = ['#.a: A', '  - #.b: B'].join('\n');
    expect(expandShortIds(text)).toBe(text);
  });

  /* Zwei Punkte sind keine vereinbarte Bedeutung — also nichts erfinden. */
  it('rührt `#..x` nicht an', () => {
    const text = ['#a: A', '  - #..x: X'].join('\n');
    expect(expandShortIds(text)).toBe(text);
  });
});

describe('expandShortIds — fasst nur an, was die ID ist', () => {
  it('lässt den Beschreibungsteil hinter --- unberührt', () => {
    const text = ['#a: A', '  - #.b: B', '---', '#.b', '  Text mit #.b darin'].join('\n');
    const out = expandShortIds(text).split('\n');
    expect(out[1]).toContain('#a.b: B');
    expect(out[3]).toBe('#.b');
    expect(out[4]).toBe('  Text mit #.b darin');
  });

  it('lässt eine Kurzform im Kommentar stehen', () => {
    const text = ['#a: A', '  - #.b: B  %% später vielleicht #.c'].join('\n');
    expect(expandShortIds(text)).toBe(
      ['#a: A', '  - #a.b: B  %% später vielleicht #.c'].join('\n'));
  });

  it('fasst nur das ERSTE #-Token an (SPEC §1)', () => {
    const text = ['#a: A', '  - #.b: siehe auch #.c'].join('\n');
    expect(expandShortIds(text)).toContain('#a.b: siehe auch #.c');
  });

  it('lässt eine `"`-Beschreibungszeile aus', () => {
    const text = ['#a: A', '  " Zitat mit #.b', '  - #.c: C'].join('\n');
    const out = expandShortIds(text).split('\n');
    expect(out[1]).toBe('  " Zitat mit #.b');
    expect(out[2]).toContain('#a.c: C');
  });

  it('erhält Einrückung, Zeichen, Statusbox und Faltmarke zeichengenau', () => {
    const text = ['#a: A', '  =   [x] > #.b: B (M) @anna :#a !!!'].join('\n');
    expect(expandShortIds(text)).toBe(
      ['#a: A', '  =   [x] > #a.b: B (M) @anna :#a !!!'].join('\n'));
  });

  /* Die Abhängigkeits-Schreibweise beginnt mit `:#` und ist damit kein
     alleinstehendes `#`-Token — sie bleibt außen vor (Kurzform dort wäre eine
     eigene Entscheidung, D55). */
  it('rührt Abhängigkeiten nicht an', () => {
    const text = ['#a: A', '  - Kind :#.b'].join('\n');
    expect(expandShortIds(text)).toBe(text);
  });
});

describe('expandShortIds — das Ergebnis parst wie eine von Hand geschriebene ID', () => {
  it('ergibt denselben Baum wie die ausgeschriebene Fassung', () => {
    const kurz = ['#prod-stage: Stage', '  - #.kc: Keycloak'].join('\n');
    const lang = ['#prod-stage: Stage', '  - #prod-stage.kc: Keycloak'].join('\n');
    expect(parse(expandShortIds(kurz))).toEqual(parse(lang));
  });

  it('macht aus der Kurzform eine auflösbare Abhängigkeit', () => {
    const text = ['#a: A', '  - #.b: B', '  - #.c: C :#a.b'].join('\n');
    const r = parse(expandShortIds(text));
    expect(r.warnings).toEqual([]);           /* kein unknownDep mehr */
  });
});

/* Vorfilter für den frühen Zeitpunkt (D55-Nachtrag): Folgt der Kurzform
   unmittelbar ein Doppelpunkt, steht fest, wie die ID heißt — der Editor löst
   dann sofort auf, statt das Verlassen der Zeile abzuwarten. */
describe('shortIdClosed — die Kurzform ist mit einem Doppelpunkt abgeschlossen', () => {
  it('erkennt den Trenner vor dem Titel', () => {
    expect(shortIdClosed('  - #.kc: Keycloak')).toBe(true);
  });

  it('erkennt ihn auch am Zeilenende, noch ohne Titel', () => {
    expect(shortIdClosed('  - #.kc:')).toBe(true);
  });

  it('zählt auch den Anfang einer Abhängigkeitsliste', () => {
    expect(shortIdClosed('  - #.kc:#db')).toBe(true);
  });

  it('sagt ohne Doppelpunkt nein — dort wird beim Verlassen der Zeile aufgelöst', () => {
    expect(shortIdClosed('  - #.kc Keycloak')).toBe(false);
  });

  it('verlangt ihn unmittelbar, nicht irgendwo in der Zeile', () => {
    expect(shortIdClosed('  - #.kc Keycloak: Stage')).toBe(false);
  });

  it('lässt die volle ID in Ruhe — da gibt es nichts aufzulösen', () => {
    expect(shortIdClosed('  - #prod-stage.kc: Keycloak')).toBe(false);
  });

  it('fasst `#..x` nicht an, wie expandShortIds auch nicht', () => {
    expect(shortIdClosed('  - #..x: X')).toBe(false);
  });

  it('sieht nur das erste `#`-Token', () => {
    expect(shortIdClosed('  - #a: siehe #.b: dort')).toBe(false);
  });

  it('übergeht den Kommentar', () => {
    expect(shortIdClosed('  - #.kc Keycloak  %% #.x: Notiz')).toBe(false);
  });

  it('was er meldet, löst expandShortIds auch wirklich auf', () => {
    const zeile = '  - #.kc: Keycloak';
    expect(shortIdClosed(zeile)).toBe(true);
    expect(expandShortIds(['#prod-stage: Stage', zeile].join('\n')))
      .toContain('#prod-stage.kc: Keycloak');
  });
});
