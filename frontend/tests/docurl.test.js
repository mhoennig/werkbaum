import { describe, it, expect } from 'vitest';
import { docParam, docSearch, docKind, LIVE_PARAM, SOURCE_PARAM } from '../src/docurl.js';

const LIVE = 'live:https://werkbaum.example/api/v1/documents/44753df1';
const URLDOC = 'url:https://example.org/plan.werkbaum';

describe('docParam — welcher Parameter öffnet dieses Dokument wieder?', () => {
  it('ein Server-Dokument wird über ?live= adressiert', () => {
    expect(docParam(LIVE)).toEqual(
      {name: LIVE_PARAM, value: 'https://werkbaum.example/api/v1/documents/44753df1'});
  });

  it('ein geholtes Dokument über ?sourceUrl=', () => {
    expect(docParam(URLDOC)).toEqual(
      {name: SOURCE_PARAM, value: 'https://example.org/plan.werkbaum'});
  });

  it('eigene, mitgelieferte und aus Dateien geöffnete Dokumente haben keine Adresse', () => {
    expect(docParam('example')).toBe(null);
    expect(docParam('werkbaum')).toBe(null);
    expect(docParam('k3f9x1')).toBe(null);
    expect(docParam(null)).toBe(null);
    expect(docParam(undefined)).toBe(null);
  });
});

describe('docSearch — die Adresszeile folgt dem aktiven Dokument', () => {
  it('setzt den Parameter des Server-Dokuments', () => {
    expect(docSearch('', LIVE))
      .toBe('?live=https://werkbaum.example/api/v1/documents/44753df1');
  });

  it('räumt ihn weg, sobald ein lokales Dokument vorn ist', () => {
    expect(docSearch('?live=https://werkbaum.example/api/v1/documents/44753df1', 'example'))
      .toBe('');
  });

  it('tauscht ihn beim Wechsel auf ein anderes Server-Dokument', () => {
    expect(docSearch('?live=https://werkbaum.example/api/v1/documents/aaa',
                     'live:https://werkbaum.example/api/v1/documents/bbb'))
      .toBe('?live=https://werkbaum.example/api/v1/documents/bbb');
  });

  it('tauscht auch zwischen den beiden Eingängen', () => {
    expect(docSearch('?sourceUrl=https://example.org/plan.werkbaum', LIVE))
      .toBe('?live=https://werkbaum.example/api/v1/documents/44753df1');
    expect(docSearch('?live=https://werkbaum.example/api/v1/documents/44753df1', URLDOC))
      .toBe('?sourceUrl=https://example.org/plan.werkbaum');
  });

  it('räumt den ausgebauten ?etherpad= mit weg (D78)', () => {
    expect(docSearch('?etherpad=https://pad.example/p/plan', 'example')).toBe('');
  });

  it('lässt fremde Parameter wörtlich stehen — auch ihre Schreibweise', () => {
    expect(docSearch('?server=http://localhost:8080&live=https://a/x', 'example'))
      .toBe('?server=http://localhost:8080');
    expect(docSearch('?server=http://localhost:8080', LIVE))
      .toBe('?server=http://localhost:8080&live=https://werkbaum.example/api/v1/documents/44753df1');
  });

  it('schreibt die URL unmaskiert — lesbar ist der Zweck', () => {
    expect(docSearch('', LIVE)).toContain('https://werkbaum.example/api/v1/documents/44753df1');
  });

  it('maskiert nur, was den Query-String zerrisse', () => {
    expect(docSearch('', 'url:https://example.org/p?a=1&b=2#tail'))
      .toBe('?sourceUrl=https://example.org/p?a=1%26b=2%23tail');
  });

  it('nimmt den Query-String mit und ohne führendes Fragezeichen', () => {
    expect(docSearch('server=x', 'example')).toBe('?server=x');
    expect(docSearch('?server=x', 'example')).toBe('?server=x');
    expect(docSearch(undefined, 'example')).toBe('');
  });

  it('ändert nichts, wenn schon das Richtige dasteht', () => {
    const s = '?live=https://werkbaum.example/api/v1/documents/44753df1';
    expect(docSearch(s, LIVE)).toBe(s);
    expect(docSearch('', 'example')).toBe('');
  });
});

describe('docKind — welche Gruppe des Dokumenten-Menüs? (D81)', () => {
  const SHIPPED = ['example', 'werkbaum'];

  it('mitgelieferte Dokumente erkennt die feste id', () => {
    expect(docKind('example', SHIPPED)).toBe('shipped');
    expect(docKind('werkbaum', SHIPPED)).toBe('shipped');
  });

  it('Server- und URL-Dokumente sind Quellen von außen', () => {
    expect(docKind(LIVE, SHIPPED)).toBe('server');
    expect(docKind(URLDOC, SHIPPED)).toBe('url');
  });

  it('alles andere ist ein eigenes Dokument — auch aus Dateien geöffnete', () => {
    expect(docKind('k3f9x1', SHIPPED)).toBe('own');
    expect(docKind('Unbenannt', SHIPPED)).toBe('own');
  });

  it('verträgt fehlende Argumente, ohne zu werfen', () => {
    expect(docKind(null, SHIPPED)).toBe('own');
    expect(docKind('example')).toBe('own');   /* ohne Liste ist nichts mitgeliefert */
  });
});
