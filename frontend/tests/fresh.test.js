import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { freshProdSet, statusByKey } from '../src/model.js';

const roots = txt => parse(txt).roots;
const labels = set => [...set].map(n => n.label).sort();

/* „Neu" heißt: jetzt [^] in Produktion, vorher nicht (D28). */
describe('freshProdSet — neu in Produktion', () => {
  const VORHER = `[~] Werkzeug (L)
  - [x] Parser (S)
  - [ ] Export (M)
    - [ ] SVG (S)
    - [ ] PNG (S)`;

  it('meldet einen Knoten, dessen Status auf [^] gewechselt ist', () => {
    const NACHHER = VORHER.replace('- [x] Parser (S)', '- [^] Parser (S)');
    expect(labels(freshProdSet(roots(VORHER), roots(NACHHER)))).toEqual(['Parser']);
  });

  it('meldet einen neu hinzugekommenen [^]-Knoten', () => {
    const NACHHER = VORHER + '\n  - [^] Doku (S)';
    expect(labels(freshProdSet(roots(VORHER), roots(NACHHER)))).toEqual(['Doku']);
  });

  it('meldet neue Knoten, die NICHT in Produktion sind, nicht', () => {
    const NACHHER = VORHER + '\n  - [ ] Doku (S)\n  - [?] Idee (S)';
    expect(freshProdSet(roots(VORHER), roots(NACHHER)).size).toBe(0);
  });

  it('meldet unveränderte [^]-Knoten nicht (nur den Übergang)', () => {
    const A = '[^] Fertig (S)';
    expect(freshProdSet(roots(A), roots(A)).size).toBe(0);
  });

  it('ohne Vergleichsfassung ist nichts neu — sonst leuchtete beim Erstkontakt alles', () => {
    expect(freshProdSet(null, roots('[^] A (S)\n[^] B (S)')).size).toBe(0);
  });

  it('Umeinrücken und Umsortieren erzeugen keine Falschmeldung (Identität = Label-Pfad)', () => {
    const A = '[~] Wurzel (L)\n  - [^] Eins (S)\n  - [x] Zwei (S)';
    const B = '[~] Wurzel (L)\n\t- [x] Zwei (S)\n\t- [^] Eins (S)';   /* Tab statt Leerzeichen, getauscht */
    expect(freshProdSet(roots(A), roots(B)).size).toBe(0);
  });

  it('gleicher Label unter verschiedenen Eltern wird auseinandergehalten', () => {
    const A = '[~] W (L)\n  - [ ] Alpha (M)\n    - [ ] Test (S)\n  - [ ] Beta (M)\n    - [ ] Test (S)';
    const B = A.replace('- [ ] Beta (M)\n    - [ ] Test (S)', '- [ ] Beta (M)\n    - [^] Test (S)');
    const set = freshProdSet(roots(A), roots(B));
    expect(set.size).toBe(1);
    /* der gemeldete „Test" hängt unter Beta, nicht unter Alpha */
    const key = [...statusByKey(roots(B)).keys()].find(k => k.includes('Beta') && k.includes('Test'));
    expect(key).toBeTruthy();
  });

  it('gleichnamige Geschwister bekommen getrennte Identitäten', () => {
    const A = '[~] W (L)\n  - [ ] Doppelt (S)\n  - [ ] Doppelt (S)';
    const B = '[~] W (L)\n  - [ ] Doppelt (S)\n  - [^] Doppelt (S)';
    expect(freshProdSet(roots(A), roots(B)).size).toBe(1);
  });

  it('erfasst auch verworfene Teilbäume nicht als Produktion', () => {
    const A = '[~] W (L)\n  - [-] Weg (S)';
    const B = '[~] W (L)\n  - [-] Weg (S)\n  - [^] Da (S)';
    expect(labels(freshProdSet(roots(A), roots(B)))).toEqual(['Da']);
  });
});
