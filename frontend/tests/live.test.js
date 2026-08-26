import {describe, it, expect} from 'vitest';
import {
  liveUrls, normalize, lines, text, computeOps, applyOps,
  mapLine, caretToLineCol, lineColToCaret, feedAction, serverBase, documentsUrl,
} from '../src/live.js';

describe('Adressen', () => {
  const doc = 'https://werkbaum.example/api/v1/documents/3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607';

  it('erkennt eine Dokument-Adresse und leitet die Endpunkte ab', () => {
    const u = liveUrls(doc);
    expect(u.doc).toBe(doc);
    expect(u.content).toBe(doc + '/content');
    expect(u.changes).toBe(doc + '/changes');
    expect(u.id).toBe('3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607');
  });

  it('schneidet Query, Fragment und Schrägstriche ab', () => {
    // Derselbe Link soll genau ein Dokument ergeben, gleich wie er kam.
    expect(liveUrls(doc + '/?x=1#top').doc).toBe(doc);
  });

  it('weist an, was keine Dokument-Adresse ist', () => {
    expect(liveUrls('https://werkbaum.example/api/v1/documents')).toBe(null);
    expect(liveUrls('https://werkbaum.example/api/v1/documents/keine-uuid')).toBe(null);
  });

  it('erlaubt nur http und https', () => {
    expect(liveUrls('javascript:alert(1)')).toBe(null);
    expect(liveUrls('file:///api/v1/documents/3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607')).toBe(null);
  });

  it('löst relative Angaben gegen die Seite auf', () => {
    const u = liveUrls('/api/v1/documents/3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f607',
      'https://werkbaum.example/editor/');
    expect(u.doc).toBe(doc);
  });
});

describe('Zeilen', () => {
  it('zerlegen und zusammensetzen sind zueinander invers', () => {
    expect(text(lines('a\nb\nc'))).toBe('a\nb\nc');
  });

  it('ein abschliessendes LF ergibt eine leere letzte Zeile', () => {
    expect(lines('a\n')).toEqual(['a', '']);
  });

  it('der leere Text ist genau eine leere Zeile', () => {
    expect(lines('')).toEqual(['']);
  });

  it('CRLF und CR werden auf LF normalisiert', () => {
    expect(lines('a\r\nb\rc')).toEqual(['a', 'b', 'c']);
    expect(normalize('a\r\nb')).toBe('a\nb');
  });
});

describe('Diff berechnen', () => {
  const basis = ['a', 'b', 'c', 'd'];
  const rundreise = (von, nach) => expect(applyOps(von, computeOps(von, nach))).toEqual(nach);

  it('gleiche Stände ergeben kein Diff', () => {
    expect(computeOps(basis, basis)).toEqual([]);
  });

  it('eine geänderte Zeile ergibt genau ein replace', () => {
    expect(computeOps(basis, ['a', 'B', 'c', 'd']))
      .toEqual([{op: 'replace', index: 1, count: 1, lines: ['B']}]);
  });

  it('eine eingefügte Zeile ergibt genau ein insert', () => {
    expect(computeOps(basis, ['a', 'b', 'neu', 'c', 'd']))
      .toEqual([{op: 'insert', index: 2, lines: ['neu']}]);
  });

  it('eine entfernte Zeile ergibt genau ein delete', () => {
    expect(computeOps(basis, ['a', 'c', 'd']))
      .toEqual([{op: 'delete', index: 1, count: 1}]);
  });

  it('Anhängen an das Dokumentende', () => {
    expect(computeOps(basis, [...basis, 'e']))
      .toEqual([{op: 'insert', index: 4, lines: ['e']}]);
  });

  it('identische Zeilen weiter unten verwirren die Zuordnung nicht', () => {
    // Leerzeilen und wiederholte Einrückung sind in der Notation Alltag.
    rundreise(['', 'a', '', 'a', ''], ['', 'a', '', 'a', '', 'b']);
  });

  it('mehrere getrennte Änderungen ergeben mehrere Operationen', () => {
    const von = ['a', 'b', 'c', 'd', 'e', 'f'];
    const nach = ['a', 'B', 'c', 'd', 'neu', 'e', 'f'];
    expect(computeOps(von, nach)).toEqual([
      {op: 'replace', index: 1, count: 1, lines: ['B']},
      {op: 'insert', index: 4, lines: ['neu']},
    ]);
    rundreise(von, nach);
  });

  it('ein berechnetes Diff ist immer anwendbar', () => {
    const von = lines('%% Plan\n- [~] Wurzel (XL)\n  - [x] Eins (S)\n  - [ ] Zwei (M)\n');
    const nach = lines('%% Plan neu\n- [~] Wurzel (XL)\n  + [?] Zugabe (S)\n  - [ ] Zwei (L)\n');
    rundreise(von, nach);
  });

  it('ein Plan mit einer geänderten Zeile bleibt sparsam', () => {
    const von = Array.from({length: 300}, (_, i) => `  - [ ] Knoten ${i} (S)`);
    const nach = [...von];
    nach[150] = '  - [x] Knoten 150 (S)';
    expect(computeOps(von, nach))
      .toEqual([{op: 'replace', index: 150, count: 1, lines: ['  - [x] Knoten 150 (S)']}]);
  });
});

describe('Diff anwenden', () => {
  const basis = ['a', 'b', 'c', 'd'];

  it('mehrere Operationen wirken alle gegen dieselbe Basis', () => {
    expect(applyOps(basis, [
      {op: 'insert', index: 1, lines: ['neu']},
      {op: 'delete', index: 3, count: 1},
    ])).toEqual(['a', 'neu', 'b', 'c']);
  });

  it('ein Diff, das nicht passt, wird nicht halb angewendet', () => {
    expect(() => applyOps(basis, [{op: 'delete', index: 7, count: 1}])).toThrow();
    expect(() => applyOps(basis, [{op: 'delete', index: 3, count: 2}])).toThrow();
  });
});

describe('Cursor', () => {
  it('eine Einfügung darüber schiebt die Zeile nach unten', () => {
    expect(mapLine(5, [{op: 'insert', index: 2, lines: ['x', 'y']}])).toBe(7);
  });

  it('eine Löschung darüber zieht die Zeile nach oben', () => {
    expect(mapLine(5, [{op: 'delete', index: 1, count: 2}])).toBe(3);
  });

  it('eine Änderung darunter lässt die Zeile stehen', () => {
    expect(mapLine(2, [{op: 'insert', index: 5, lines: ['x']}])).toBe(2);
  });

  it('eine Zeile im Eingriff landet an dessen Anfang', () => {
    // Sie hat kein Gegenüber mehr; der Anfang des Bereichs ist die
    // verlässlichste Antwort - dort hat die fremde Änderung eingegriffen.
    expect(mapLine(6, [{op: 'replace', index: 5, count: 3, lines: ['x']}])).toBe(5);
  });

  it('Zeile und Spalte überstehen die Umrechnung', () => {
    const t = 'eins\nzwei\ndrei';
    const {line, col} = caretToLineCol(t, 7);      /* "zw|ei" */
    expect([line, col]).toEqual([1, 2]);
    expect(lineColToCaret(lines(t), line, col)).toBe(7);
  });

  it('eine zu grosse Spalte rutscht ans Zeilenende, nicht darüber hinaus', () => {
    expect(lineColToCaret(['ab', 'c'], 1, 99)).toBe(4);
  });
});

describe('Feed-Antwort anwenden oder nicht', () => {
  it('Operationen auf passender Basis werden angewendet', () => {
    expect(feedAction({fromVersion: 4, currentVersion: 6, ops: []}, 4)).toBe('apply');
  });

  it('eine Antwort auf fremder Basis wird übersprungen', () => {
    // Sonst wendet der Client dieselben Ops doppelt an - der Fall tritt ein,
    // wenn Feed und 409-Antwort beide dasselbe fremde Diff liefern.
    expect(feedAction({fromVersion: 3, currentVersion: 6, ops: []}, 4)).toBe('skip');
  });

  it('was wir schon haben, wird übersprungen', () => {
    expect(feedAction({fromVersion: 4, currentVersion: 4, ops: []}, 4)).toBe('skip');
  });

  it('Volltext ersetzt den Stand', () => {
    expect(feedAction({fromVersion: null, currentVersion: 87, content: 'x'}, 4)).toBe('replace');
  });

  it('nichts Verwertbares heisst nichts tun', () => {
    expect(feedAction(null, 4)).toBe('skip');
    expect(feedAction({currentVersion: 9}, 4)).toBe('skip');
  });
});

describe('Basis-Adresse des Backends', () => {
  const seite = 'https://werkbaum.example/editor/';

  it('nimmt die Herkunft der Seite, wenn nichts anderes da ist', () => {
    expect(serverBase(null, null, seite)).toBe('https://werkbaum.example');
    expect(documentsUrl(serverBase(null, null, seite)))
      .toBe('https://werkbaum.example/api/v1/documents');
  });

  it('der ?server=-Parameter hat Vorrang', () => {
    expect(serverBase('http://localhost:8080', 'https://fremd.example/api/v1/documents/x', seite))
      .toBe('http://localhost:8080');
  });

  it('sonst gilt der Server des offenen Dokuments', () => {
    // Wer in einem ?live=-Dokument sitzt und ein neues anlegt, meint denselben.
    expect(serverBase(null, 'https://anderer.example/api/v1/documents/3f2a', seite))
      .toBe('https://anderer.example');
  });

  it('ein Backend unter einem Unterpfad bleibt erhalten', () => {
    expect(serverBase(null, 'https://h.example/werkbaum/api/v1/documents/3f2a', seite))
      .toBe('https://h.example/werkbaum');
  });

  it('ohne brauchbare Herkunft lieber nichts', () => {
    // Auf file:// gibt es keine; raten waere schlechter als fragen.
    expect(serverBase(null, null, 'file:///home/x/index.html')).toBe(null);
    expect(serverBase('javascript:alert(1)', null, null)).toBe(null);
  });
})
