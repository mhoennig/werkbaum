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

  /* Eigener Typ, weil sourceLoadWarn auf CORS zeigt: Bei Etherpads Drosselung
     (10 Abrufe je 90 s) schickte das den Leser auf die falsche Fährte (D31). */
  it('sourceTimeout ist ein eigener Typ und nennt die Sekunden', () => {
    const out = formatWarning({type: 'sourceTimeout', url: 'https://p/x&y', seconds: 20}, t);
    expect(out).toBe('sourceTimeoutWarn|{"url":"https://p/x&amp;y","seconds":20}');
  });

  /* Kein `url` im Objekt: Der Nutzer hat gar nichts angefordert, was scheitern
     konnte — Werkbaum hat den Abruf verhindert (D31). */
  it('padRateLimit nennt die Restzeit und braucht keine URL', () => {
    expect(formatWarning({type: 'padRateLimit', seconds: 7}, t))
      .toBe('padRateLimitWarn|{"seconds":7}');
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
