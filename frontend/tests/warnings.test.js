import { describe, it, expect } from 'vitest';
import { formatWarning } from '../src/warnings.js';

/* Stub bildet key + interpolierte Variablen sichtbar ab, damit wir prüfen
   können, welche Werte (inkl. Escaping) formatWarning durchreicht. */
const t = (key, vars) => `${key}|${JSON.stringify(vars)}`;

describe('formatWarning — vereinheitlichtes Warnungs-Modell', () => {
  it('mixedGate reicht Zeile durch und HTML-escaped das Label', () => {
    const out = formatWarning({type: 'mixedGate', line: 7, label: 'A & <B>'}, t);
    expect(out).toBe('mixedWarn|{"line":7,"label":"A &amp; &lt;B&gt;"}');
  });

  it('unknownStatus reicht Zeile durch und escaped den Code', () => {
    const out = formatWarning({type: 'unknownStatus', line: 3, code: '<'}, t);
    expect(out).toBe('unknownStatusWarn|{"line":3,"code":"&lt;"}');
  });

  it('unbekannter Typ fällt auf eine generische, escapte Meldung zurück', () => {
    expect(formatWarning({type: 'was?', line: 9}, t)).toBe('was? (9)');
    expect(formatWarning({type: 'x'}, t)).toBe('x (?)');
  });
});
