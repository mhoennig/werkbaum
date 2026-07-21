/* Vereinheitlichtes Warnungs-Modell.
   Producer (Renderer, künftig auch Parser) liefern strukturierte Objekte
       { type, line, ...data }
   statt fertig formatierter Strings — so bleiben Typ und Zeilennummer
   maschinenlesbar (sortierbar, filterbar, testbar). Die i18n-/HTML-Aufbereitung
   passiert an genau einer Stelle: formatWarning(). Vgl. SPEC §3 (gemischte
   Gates) und TASKS Phase 2 (unbekannte Statuszeichen).

   Bekannte Typen:
   - mixedGate     { line, label }  — Geschwister mit gemischtem Gate (SPEC §3)
   - unknownStatus { line, code }   — unbekanntes Statuszeichen (Phase 2) */

import { esc } from './render.js';

/* Strukturierte Warnung -> lokalisierter Anzeigetext (HTML-escaped Daten).
   `t` ist die i18n-Funktion (key, vars) -> String. */
export function formatWarning(w, t){
  switch(w.type){
    case 'mixedGate':
      return t('mixedWarn', {line: w.line, label: esc(w.label)});
    case 'unknownStatus':
      return t('unknownStatusWarn', {line: w.line, code: esc(w.code)});
    default:
      return `${esc(String(w.type))} (${w.line ?? '?'})`;
  }
}
