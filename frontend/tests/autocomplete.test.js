// ID-Vorschläge beim Tippen von Abhängigkeiten (D63): Kontext-Erkennung und
// Kandidaten-Auswahl. Die Verdrahtung (Popup, Tasten, Einfügen) bleibt
// Browser-Sache — hier steht, WAS gilt.
import { describe, it, expect } from 'vitest';
import { depFragment, collectIds, matchIds } from '../src/autocomplete.js';
import { parse } from '../src/parser.js';

/* Kontext am Zeilenende: Text bis `|` ist alles vor der Schreibmarke. */
const at = text => {
  const caret = text.indexOf('|');
  return depFragment(text.replace('|', ''), caret);
};

describe('depFragment: wann ein :#-Kontext vorliegt', () => {
  it('öffnet direkt nach :# mit leerem Fragment', () => {
    const ctx = at('- Backend :#|');
    expect(ctx).toMatchObject({fragment: '', exclude: []});
    expect(ctx.start).toBe(12);
    expect(ctx.end).toBe(12);
  });

  it('liefert das angefangene Fragment', () => {
    expect(at('- Backend :#au|')).toMatchObject({fragment: 'au', start: 12});
  });

  it('setzt in der Liste fort und schließt Gelistetes aus', () => {
    expect(at('- X :#auth,#a|')).toMatchObject({fragment: 'a', exclude: ['auth']});
  });

  it('erkennt die Kopf-Form #auth:#… und schließt die eigene ID aus', () => {
    expect(at('- #auth:#d|')).toMatchObject({fragment: 'd', exclude: ['auth']});
  });

  it('schließt die eigene ID der Zeile auch weiter vorn aus', () => {
    expect(at('- #auth: Backend :#|')).toMatchObject({fragment: '', exclude: ['auth']});
  });

  it('reicht über die Schreibmarke bis ans Ende der ID-Zeichen (end)', () => {
    const text = '- X :#auth (S)';
    const ctx = depFragment(text, 8);   /* Schreibmarke mitten in `auth` */
    expect(ctx).toMatchObject({fragment: 'au', start: 6, end: 10});
  });

  it('kein Kontext bei bloßem # — das definiert eine ID', () => {
    expect(at('- Backend #au|')).toBeNull();
  });

  it('kein Kontext in der Zitier-Klammer und nach Label-Doppelpunkten', () => {
    expect(at('- siehe (:#auth|')).toBeNull();
    expect(at('- Regel:#x|')).toBeNull();
  });

  it('kein Kontext im Kommentar', () => {
    expect(at('- A %% braucht :#auth|')).toBeNull();
  });

  it('kein Kontext im Beschreibungsteil hinter ---', () => {
    expect(at('- A\n---\n#a\n  siehe :#|')).toBeNull();
  });

  it('kein Kontext, wenn das Token nicht bis zur Schreibmarke reicht', () => {
    expect(at('- A :#auth |')).toBeNull();
  });

  it('am Anfang einer Fortsetzungszeile gilt der Zeilenanfang als Leerraum', () => {
    expect(at('- Langer Titel \\\n:#au|')).toMatchObject({fragment: 'au'});
  });
});

describe('collectIds: alle vergebenen IDs in Dokumentreihenfolge', () => {
  it('sammelt über alle Ebenen, mit Titel als Kontext', () => {
    const { roots } = parse('#a: Wurzel\n  - #b: Kind\n    - Ohne ID\n  - #c: Kind 2');
    expect(collectIds(roots)).toEqual([
      {id: 'a', label: 'Wurzel'}, {id: 'b', label: 'Kind'}, {id: 'c', label: 'Kind 2'},
    ]);
  });

  it('nimmt auch verworfene Knoten mit — Abhängigkeiten dürfen dorthin zeigen', () => {
    const { roots } = parse('A\n  - [-] #alt: Verworfen');
    expect(collectIds(roots)).toEqual([{id: 'alt', label: 'Verworfen'}]);
  });

  it('lässt den Titel leer, wenn die ID ihn nur vertritt (D60)', () => {
    const { roots } = parse('- #US-123');
    expect(collectIds(roots)).toEqual([{id: 'US-123', label: ''}]);
  });
});

describe('matchIds: Präfix vor Teilstring, Dokumentreihenfolge, ohne exclude', () => {
  const ids = [
    {id: 'auth', label: ''}, {id: 'db', label: ''},
    {id: 'be.auth', label: ''}, {id: 'author', label: ''},
  ];

  it('leeres Fragment zeigt alle', () => {
    expect(matchIds(ids, '').map(c => c.id)).toEqual(['auth', 'db', 'be.auth', 'author']);
  });

  it('Präfix-Treffer stehen vor Teilstring-Treffern, je in Reihenfolge', () => {
    expect(matchIds(ids, 'au').map(c => c.id)).toEqual(['auth', 'author', 'be.auth']);
  });

  it('vergleicht ohne Groß-/Kleinschreibung, behält die Schreibweise', () => {
    expect(matchIds([{id: 'US-123', label: ''}], 'us').map(c => c.id)).toEqual(['US-123']);
  });

  it('ausgeschlossene IDs erscheinen nicht', () => {
    expect(matchIds(ids, 'au', ['auth']).map(c => c.id)).toEqual(['author', 'be.auth']);
  });

  it('ohne Treffer bleibt die Liste leer', () => {
    expect(matchIds(ids, 'xyz')).toEqual([]);
  });
});
