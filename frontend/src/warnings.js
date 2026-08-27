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
   - duplicateId   { line, id, firstLine } — Knoten-ID doppelt vergeben
                                      (SPEC §1/D36); gemeldet an der späteren
                                      Zeile, die erste wird genannt
   - unknownDep    { line, id }     — Abhängigkeit auf eine ID ohne Knoten
                                      (SPEC §1/D37); Zyklen sind dagegen
                                      zulässig und warnen nie
   - unknownDesc   { line, id }     — Beschreibungsblock für eine ID ohne
                                      Knoten (SPEC §11/D40)
   - descStray     { line }         — Beschreibungszeile ohne Bezug: `"`-Zeile
                                      ohne Knoten davor bzw. Zeile im
                                      Beschreibungsteil ohne #id-Block; meldet
                                      auch die von einem versehentlichen
                                      `---` verschluckten Knotenzeilen
   - sizeConflict  { line, size }   — Teilpakete übersteigen zusammen die
                                      angegebene Größe des Elternknotens, selbst
                                      in der günstigsten Bereichs-Lesart
                                      (SPEC §5/D62); Zeile = Elternknoten
   - assigneeOverload { tag, share, stations, totalStations }
                                    — eine Person trägt mehr als die Hälfte der
                                      offenen Arbeit des günstigsten Pfads
                                      (SPEC §9/D71); zeilenlos — der Engpass
                                      hat keine einzelne Zeile
   - cheapApprox   { }              — günstigster Pfad nur gierig geschätzt:
                                      zu viele gekoppelte Gruppen für die
                                      exakte Suche (D42); zeilenlos
   - sourceLoad    { url, error }   — ?sourceUrl= nicht ladbar (D23); ohne
                                      Zeilennummer, erscheint dadurch zuoberst
   - padGone       { }              — ein alter ?etherpad=-Link: die Anbindung
                                      ist ausgebaut (D78), der Text zeigt auf
                                      ?live=; zeilenlos
   - liveLoad      { url, error }   — Server-Dokument (?live=, D76) nicht
                                      erreichbar oder keine Dokument-Adresse
   - liveStale     { error }        — eigene Änderung nicht anwendbar
                                      (Prüfsumme, Index, Basis verdichtet);
                                      der Client hat einmal neu geladen (D76)
   - storeFailed   { }              — Speichern im Browser fehlgeschlagen
                                      (localStorage-Quota, D82): Datenverlust
                                      droht beim Neuladen; zeilenlos, steht
                                      zuoberst und verschwindet, sobald ein
                                      Schreiben wieder gelingt */

import { esc } from './render.js';

/* Strukturierte Warnung -> lokalisierter Anzeigetext (HTML-escaped Daten).
   `t` ist die i18n-Funktion (key, vars) -> String. */
export function formatWarning(w, t){
  return build(w, t, esc);
}

/* Dasselbe als **Klartext**, ohne HTML-Escaping — für Senken, die kein HTML
   sind: der `title` der Zeilennummer (D33-Nachtrag). Dort stünde sonst
   „Drag &amp; Drop“ statt „Drag & Drop“; die Vorlagen selbst enthalten kein
   Markup, escaped werden ohnehin nur die eingesetzten Daten. */
export function warningText(w, t){
  return build(w, t, s => String(s));
}

/* Der Parameter verdeckt das importierte `esc` bewusst: So bleibt der Rumpf
   unverändert und es gibt nur **eine** Stelle, die die Typen kennt. */
function build(w, t, esc){
  switch(w.type){
    case 'mixedGate':
      return t('mixedWarn', {line: w.line, label: esc(w.label)});
    case 'unknownStatus':
      return t('unknownStatusWarn', {line: w.line, code: esc(w.code)});
    case 'xorConflict':
      return t('xorConflictWarn', {line: w.line, label: esc(w.label)});
    case 'duplicateId':
      return t('duplicateIdWarn', {line: w.line, id: esc(w.id), firstLine: w.firstLine});
    case 'unknownDep':
      return t('unknownDepWarn', {line: w.line, id: esc(w.id)});
    case 'unknownDesc':
      return t('unknownDescWarn', {line: w.line, id: esc(w.id)});
    case 'descStray':
      return t('descStrayWarn', {line: w.line});
    case 'sizeConflict':
      return t('sizeConflictWarn', {line: w.line, size: esc(w.size)});
    case 'assigneeOverload':
      return t('assigneeOverloadWarn', {tag: esc(w.tag), share: w.share,
                                        stations: w.stations, total: w.totalStations});
    case 'cheapApprox':
      return t('cheapApproxWarn');
    case 'sourceLoad':
      return t('sourceLoadWarn', {url: esc(w.url), error: esc(w.error)});
    case 'padGone':
      return t('padGoneWarn');
    case 'liveLoad':
      return t('liveLoadWarn', {url: esc(w.url), error: esc(w.error)});
    case 'liveStale':
      return t('liveStaleWarn', {error: esc(w.error)});
    case 'storeFailed':
      return t('storeFailedWarn');
    default:
      return `${esc(String(w.type))} (${w.line ?? '?'})`;
  }
}
