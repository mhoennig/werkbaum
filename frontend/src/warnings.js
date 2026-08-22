/* Vereinheitlichtes Warnungs-Modell.
   Producer (Renderer, künftig auch Parser) liefern strukturierte Objekte
       { type, line, ...data }
   statt fertig formatierter Strings — so bleiben Typ und Zeilennummer
   maschinenlesbar (sortierbar, filterbar, testbar). Die i18n-/HTML-Aufbereitung
   passiert an genau einer Stelle: formatWarning(). Vgl. SPEC §3 (gemischte
   Gates) und TASKS Phase 2 (unbekannte Statuszeichen).

   Bekannte Typen:
   - mixedGate     { line, label }  — Geschwister mit gemischtem Gate (SPEC §3)
   - unknownStatus { line, code }   — unbekanntes Statuszeichen (Phase 2)
   - xorConflict   { line, label }  — weitere realisierte Alternative in einer
                                      `=`-Gruppe (SPEC §3/D35); je Zeile eine
                                      Warnung, damit sie dorthin zeigt
   - sourceLoad    { url, error }   — ?sourceUrl= nicht ladbar (D23); ohne
                                      Zeilennummer, erscheint dadurch zuoberst
   - padRateLimit  { seconds }      — zu früh nachgeladen; Werkbaum hat gar nicht
                                      erst geholt, um Etherpads Grenze nicht
                                      auszulösen (D31)
   - sourceTimeout { url, seconds } — Abruf abgebrochen, Gegenseite zu langsam
                                      (D31). Eigener Typ, weil `sourceLoad` auf
                                      CORS zeigt — bei einem Zeitablauf schickt
                                      das den Leser auf die falsche Fährte */

import { esc } from './render.js';

/* Strukturierte Warnung -> lokalisierter Anzeigetext (HTML-escaped Daten).
   `t` ist die i18n-Funktion (key, vars) -> String. */
export function formatWarning(w, t){
  switch(w.type){
    case 'mixedGate':
      return t('mixedWarn', {line: w.line, label: esc(w.label)});
    case 'unknownStatus':
      return t('unknownStatusWarn', {line: w.line, code: esc(w.code)});
    case 'xorConflict':
      return t('xorConflictWarn', {line: w.line, label: esc(w.label)});
    case 'sourceLoad':
      return t('sourceLoadWarn', {url: esc(w.url), error: esc(w.error)});
    case 'padRateLimit':
      return t('padRateLimitWarn', {seconds: w.seconds});
    case 'sourceTimeout':
      return t('sourceTimeoutWarn', {url: esc(w.url), seconds: w.seconds});
    default:
      return `${esc(String(w.type))} (${w.line ?? '?'})`;
  }
}
