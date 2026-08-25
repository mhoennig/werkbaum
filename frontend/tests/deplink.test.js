import { describe, it, expect } from 'vitest';
import { depIdAt, idLine } from '../src/autocomplete.js';
import { parse } from '../src/parser.js';

/* Sprung entlang einer Abhängigkeit (D67, SPEC §9): Strg+Klick auf eine ID in
   einem `:#…`-Token springt zur Zeile, die die ID vergibt. Hier die beiden
   entscheidbaren Hälften: welche ID unter der Schreibmarke steht (depIdAt)
   und welche Zeile eine ID vergibt (idLine, erste Vergabe gewinnt). */

/* Schreibmarken-Position aus einer Markierung: `at('- X :#a|uth', '|')`
   liefert Text ohne die Marke und die Position der Marke. */
const at = marked => {
  const caret = marked.indexOf('|');
  return [marked.slice(0, caret) + marked.slice(caret + 1), caret];
};

describe('depIdAt — die ID unter der Schreibmarke (D67)', () => {
  it('Schreibmarke in einem einfachen Token liefert die ID', () => {
    expect(depIdAt(...at('- [ ] Frontend :#a|pi'))).toBe('api');
  });

  it('jede ID der Liste ist ansteuerbar', () => {
    expect(depIdAt(...at('- X :#a|uth,#db'))).toBe('auth');
    expect(depIdAt(...at('- X :#auth,#d|b'))).toBe('db');
  });

  it('Schreibmarke am Token-Anfang und -Ende zählt mit', () => {
    expect(depIdAt(...at('- X |:#auth'))).toBe('auth');
    expect(depIdAt(...at('- X :#auth|'))).toBe('auth');
  });

  it('Kopf-Form: das Token direkt hinter der Knoten-ID', () => {
    expect(depIdAt(...at('- #auth:#d|b: Backend'))).toBe('db');
  });

  it('eingeklammerte Erwähnung bleibt Zitat (§1/D37)', () => {
    expect(depIdAt(...at('- X (:#a|uth,#api)'))).toBe(null);
  });

  it('ein Doppelpunkt im Label ist kein Token-Anfang', () => {
    expect(depIdAt(...at('- Regel: #x| gilt'))).toBe(null);
    expect(depIdAt(...at('- time:#n|ote'))).toBe(null);
  });

  it('im Kommentar wird nicht gesprungen', () => {
    expect(depIdAt(...at('- X %% siehe :#a|uth'))).toBe(null);
  });

  it('im Beschreibungsteil hinter --- wird nicht gesprungen', () => {
    expect(depIdAt(...at('- X\n---\n#x\n  siehe :#a|uth'))).toBe(null);
  });

  it('ein `:#` in einer URL ist keins', () => {
    expect(depIdAt(...at('- X https://ex.org/:#a|nchor'))).toBe(null);
  });

  it('die Schreibmarke neben dem Token trifft nichts', () => {
    expect(depIdAt(...at('- Front|end :#api'))).toBe(null);
  });

  it('geschütztes Leerzeichen vor dem Token zählt wie beim Parser als Leerraum', () => {
    expect(depIdAt(...at('- X :#a|uth'))).toBe('auth');
  });

  it('in einer Fortsetzungszeile (D59) wird das Token erkannt', () => {
    expect(depIdAt(...at('- Langer Knoten \\\n  :#a|pi'))).toBe('api');
  });

  it('mehrere Token je Zeile: das getroffene zählt', () => {
    expect(depIdAt(...at('- X :#a :#b|'))).toBe('b');
  });
});

describe('idLine — die Zeile, die eine ID vergibt', () => {
  const roots = txt => parse(txt).roots;

  it('findet die Zeile der Definition, auch tief im Baum', () => {
    const r = roots(`- Wurzel
  - #auth: Backend
    - #auth.db: Datenbank`);
    expect(idLine(r, 'auth')).toBe(2);
    expect(idLine(r, 'auth.db')).toBe(3);
  });

  it('bei doppelter ID gewinnt die erste Vergabe (D36/D39)', () => {
    const r = roots(`- #x: Erste
- #x: Zweite`);
    expect(idLine(r, 'x')).toBe(1);
  });

  it('unbekannte ID liefert null', () => {
    expect(idLine(roots('- #a: X'), 'fehlt')).toBe(null);
  });

  it('Vorwärts-Referenz: das Ziel darf weiter unten stehen', () => {
    const r = roots(`- Nutzer :#ziel
- #ziel: Das Ziel`);
    expect(idLine(r, 'ziel')).toBe(2);
  });
});
