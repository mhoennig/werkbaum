import { describe, it, expect } from 'vitest';
import { formatWarning, warningText } from '../src/warnings.js';

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

  it('sourceLoad escaped die URL und reicht das technische Detail durch', () => {
    const out = formatWarning({type: 'sourceLoad', url: 'https://a/?x=1&y=2', error: 'HTTP 404'}, t);
    expect(out).toBe('sourceLoadWarn|{"url":"https://a/?x=1&amp;y=2","error":"HTTP 404"}');
  });

  /* Ein alter ?etherpad=-Link soll nicht still ins Leere laufen: Die Anbindung
     ist ausgebaut (D78), der Text zeigt auf ?live=. Ohne Platzhalter — die
     Meldung hat nichts einzusetzen. */
  it('padGone meldet den ausgebauten Eingang ohne Platzhalter', () => {
    expect(formatWarning({type: 'padGone'}, t)).toBe('padGoneWarn|undefined');
  });

  it('unbekannter Typ fällt auf eine generische, escapte Meldung zurück', () => {
    expect(formatWarning({type: 'was?', line: 9}, t)).toBe('was? (9)');
    expect(formatWarning({type: 'x'}, t)).toBe('x (?)');
  });
});

/* Der `title` der Zeilennummer ist kein HTML — dort stünde sonst wörtlich
   „Drag &amp; Drop“ (D33-Nachtrag). Dieselben Typen, dieselbe Vorlage, nur
   ohne Escaping. */
describe('warningText — dieselbe Meldung als Klartext', () => {
  it('lässt das Label unangetastet', () => {
    expect(warningText({type: 'mixedGate', line: 7, label: 'A & <B>'}, t))
      .toBe('mixedWarn|{"line":7,"label":"A & <B>"}');
  });

  it('lässt die URL unangetastet', () => {
    expect(warningText({type: 'sourceLoad', url: 'https://a/?x=1&y=2', error: 'HTTP 404'}, t))
      .toBe('sourceLoadWarn|{"url":"https://a/?x=1&y=2","error":"HTTP 404"}');
  });

  it('deckt dieselben Typen ab wie formatWarning', () => {
    expect(warningText({type: 'descStray', line: 4}, t)).toBe('descStrayWarn|{"line":4}');
    expect(warningText({type: 'cheapApprox'}, t)).toBe('cheapApproxWarn|undefined');
    expect(warningText({type: 'was?', line: 9}, t)).toBe('was? (9)');
  });
});
