/* Neuigkeiten für das Popup (D58) — aus zwei Quellen, jede in ihrer Rolle:
 *
 *   docs/CHANGELOG.md   → WAS geschehen ist, als englischer Satz je Änderung.
 *   git-Historie        → WELCHE Knoten des mitgelieferten Plans sich an
 *                         diesem Tag bewegt haben (für die Vorführung im
 *                         Diagramm, „Was ist neu?"-Ansicht, D28).
 *
 * Warum die Notizen nicht aus den Commit-Betreffs kommen, obwohl sie dort
 * stünden: Die Betreffs sind **deutsch** (CLAUDE.md: Doku auf Deutsch), das
 * Popup aber ist Produkt-Oberfläche in neun Sprachen. Der Changelog ist
 * englisch wie der mitgelieferte Plan und `llms.md` — ausgelieferte Artefakte
 * mit weltweitem Publikum (D22, D43). Preis: eine Datei, die beim Bauen eines
 * Features mitgeschrieben werden muss.
 *
 * Zwei Hälften, nach der Hausregel getrennt (frontend/CLAUDE.md): Was
 * ENTSCHEIDBAR ist, steht hier als reine Funktion und ist getestet
 * (frontend/tests/news.test.js); was git und Dateisystem liefern, steht in
 * `collectNews()` ganz unten und läuft nur zur Bauzeit (Vite-Plugin).
 *
 * Das Ergebnis ist ein Array, neueste zuerst:
 *   [{date: '2026-08-24', lines: ['…', …], keys: ['… > Notation', …]}]
 * `keys` sind Label-Pfade — dieselbe Identität wie „Was ist neu?" (D28).
 */

export const PLAN_FILE = 'docs/examples/werkbaum.werkbaum';
export const CHANGELOG_FILE = 'docs/CHANGELOG.md';
export const MAX_DAYS = 20;       /* so weit reicht das Popup zurück */

const RE_DAY = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/;
const RE_ITEM = /^[-*]\s+(.*\S)\s*$/;

/* `docs/CHANGELOG.md` → Tageseinträge, neueste zuerst. Erkannt wird genau
   zweierlei: eine Überschrift `## JJJJ-MM-TT` eröffnet einen Tag, eine
   Aufzählungszeile darunter ist eine Notiz. Alles andere ist Fließtext für
   Menschen und wird überlesen — so kann die Datei oben erklären, was sie ist,
   ohne dass daraus Notizen werden. Kein Deckel je Tag: Die Datei ist gepflegt,
   ihr Autor entscheidet, wie viel ein Tag hergibt. */
export function parseChangelog(md, opts){
  const {maxDays = MAX_DAYS} = opts || {};
  const byDay = new Map();
  let day = null;
  for(const raw of String(md || '').split('\n')){
    const kopf = raw.match(RE_DAY);
    if(kopf){ day = kopf[1]; if(!byDay.has(day)) byDay.set(day, []); continue; }
    if(/^#{1,6}\s/.test(raw)){ day = null; continue; }   /* andere Überschrift beendet den Tag */
    if(!day) continue;
    const item = raw.match(RE_ITEM);
    if(item) byDay.get(day).push(item[1]);
  }
  return [...byDay.entries()]
    .filter(([, lines]) => lines.length)
    .sort((a, b) => a[0] < b[0] ? 1 : -1)
    .slice(0, maxDays)
    .map(([date, lines]) => ({date, lines}));
}

/* Knoten, die sich zwischen zwei Fassungen des Plans bewegt haben: neu
   hinzugekommen oder mit anderem Status. `prev == null` (die erste bekannte
   Fassung) ergibt die leere Menge — dieselbe Zurückhaltung wie beim
   Erstkontakt in D28, sonst leuchtete der halbe Plan als „Änderung von damals". */
export function changedKeys(prev, curr){
  if(!prev) return [];
  const out = [];
  for(const [key, st] of curr){
    if(!prev.has(key) || prev.get(key) !== st) out.push(key);
  }
  return out;
}

/* Tageseinträge + Fassungen des Plans (chronologisch, je `{date, status}` mit
   `status` = Map Schlüssel → Status-Key) → dieselben Einträge mit `keys`.
   Ein Tag, an dem sich nur der Plan bewegt hat, bekommt einen **eigenen**
   Eintrag ohne Zeilen — typischerweise der Deploy-Tag (D30) oder einer, an dem
   der Changelog vergessen wurde. Der Link führt dort trotzdem vor, was sich
   bewegt hat; ohne diese Vereinigung fiele der Tag stumm unter den Tisch. */
export function attachKeys(entries, versions, opts){
  const {maxDays = MAX_DAYS} = opts || {};
  const keysByDay = new Map();
  for(let i = 0; i < versions.length; i++){
    const k = changedKeys(i ? versions[i - 1].status : null, versions[i].status);
    if(k.length) keysByDay.set(versions[i].date, k);
  }
  const out = entries.map(e => ({...e, keys: keysByDay.get(e.date) || []}));
  const haben = new Set(out.map(e => e.date));
  for(const [date, keys] of keysByDay){
    if(!haben.has(date)) out.push({date, lines: [], keys});
  }
  return out.sort((a, b) => a.date < b.date ? 1 : -1).slice(0, maxDays);
}

/* ---------- ab hier git und Dateisystem (nur zur Bauzeit) ---------- */

const SEP_FIELD = '\x1f', SEP_REC = '\x1e';
/* Der Satztrenner steht **vorn**, nicht hinten: Mit `--name-only` hängt git die
   Dateinamen hinter die Formatzeile, und nur so gehören sie beim Zerlegen zum
   richtigen Commit. */
export const LOG_FORMAT = `--format=${SEP_REC}%H${SEP_FIELD}%cd${SEP_FIELD}%s`;

export function parseLog(raw){
  return String(raw).split(SEP_REC).filter(r => r.trim()).map(r => {
    const [kopf, ...rest] = r.split('\n');
    const [sha, date, subject] = kopf.split(SEP_FIELD);
    return {sha, date, subject: subject || '', files: rest.filter(l => l.trim())};
  });
}

/* `run`, `changelog` und `parsePlan` werden hereingereicht, damit diese
   Funktion ohne child_process, ohne Dateisystem und ohne den Parser prüfbar
   bleibt. */
export function collectNews({run, changelog, parsePlan, statusByKey, planFile = PLAN_FILE, opts} = {}){
  const entries = parseChangelog(changelog, opts);

  /* Je Tag, an dem der Plan angefasst wurde, zählt sein LETZTER Stand.
     `--follow` reicht über die Umbenennung hinweg (`example-werkbaum.werkbaum`
     → `werkbaum.werkbaum`, 16.08.) — ohne das begänne die Geschichte des Plans
     dort, und der erste Tag danach hätte keine Vergleichsfassung. Deshalb
     `--name-only`: Vor der Umbenennung heißt die Datei anders, und `git show`
     braucht den Namen, den sie **in diesem Commit** trug. */
  const planLog = parseLog(run(
    ['log', '--follow', '--name-only', '--date=short', LOG_FORMAT, '--', planFile]));
  const lastOfDay = new Map();               /* neueste zuerst ⇒ der erste gewinnt */
  for(const c of planLog) if(!lastOfDay.has(c.date)) lastOfDay.set(c.date, c);
  const versions = [...lastOfDay.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)
    .map(([date, c]) => ({
      date,
      status: statusByKey(parsePlan(run(['show', `${c.sha}:${c.files[0] || planFile}`]))),
    }));

  return attachKeys(entries, versions, opts);
}
