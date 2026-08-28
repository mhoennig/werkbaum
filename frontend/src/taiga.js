/* Werkbaum-Taiga — die entscheidbaren Regeln der Ticket-Anlage (D91),
   headless nach Hausregel (D54-Nachtrag 3): Was hier steht, gilt; app.js
   verdrahtet nur Dialoge, Netz und Textfeld.

   Der Zuschnitt (D91): eine Story je Knoten, Tasks nur unter einem Knoten
   mit Story — storyless Tasks sind im Kanban unsichtbar. Die Ref kommt
   ZUSÄTZLICH zur Knoten-ID als eigenes Token an die Zeile (`#US-123` /
   `#T-1234`, D91-Nachtrag 2); die Präfixe schreibt Werkbaum selbst, Taiga
   zeigt nur die Nummer. */

import { gateOf, isDone, isRealized } from './model.js';
import { STATUS_BY_CODE } from './parser.js';

/* Das Tracker-Muster (SPEC §11): `US-\d+` (Story) und `T-\d+` (Task). */
export const TICKET_ID_RE = /^(?:US|T)-\d+$/;

/* Zerlegt eine Ref in Typ und nackte Nummer: `US-123` -> {kind:'US', nr:123}.
   Das Präfix trägt den Typ (SPEC §11) — daran hängen der Frontend-Pfad
   (unten), Taigas getrennte `by_ref`-Endpunkte und damit auch der Proxy-Pfad.
   Ungültiges ergibt null; geraten wird nirgends. */
export function refParts(ref){
  const m = /^(US|T)-(\d+)$/.exec(ref || '');
  return m ? {kind: m[1], nr: m[2]} : null;
}

/* Trägt die Zeile eines Knotens schon eine Ticket-Referenz? Das ist der
   Idempotenz-Marker (D91-Nachtrag 2): So ein Knoten wird nicht erneut
   angelegt. Die Ref ist entweder die Knoten-ID selbst (erstes `#`-Token,
   ggf. als Label-Vertreter) oder ein weiteres `#`-Token, das im Label
   stehen geblieben ist (§1: nur das erste ist die ID). */
export function ticketRefOf(n){
  if(n.id && TICKET_ID_RE.test(n.id)) return n.id;
  const m = (' ' + n.label + ' ').match(/[ ]#((?:US|T)-\d+)(?=[ ])/);
  return m ? m[1] : null;
}

/* Die Adresse eines Tickets im Taiga-FRONTEND (D91-Nachtrag 5): Stories
   liegen unter `/us/`, Tasks unter `/task/` — das Präfix trägt den Typ,
   genau dafür schreibt Werkbaum es (SPEC §11). Ohne Web-Basis, Projekt-Slug
   oder gültige Ref gibt es keine Adresse (null). */
export function ticketUrl(web, slug, ref){
  const p = refParts(ref);
  if(!p || !web || !slug) return null;
  return web + '/project/' + slug + '/' + (p.kind === 'US' ? 'us' : 'task') + '/' + p.nr;
}

/* Die Eingabe des Verknüpfen-Dialogs (D91-Nachtrag 11): Was hat der Nutzer
   da eingefügt? Drei Formen, absteigend nach Vollständigkeit —
   - die **Taiga-URL** eines Tickets (die Adresszeile, `ticketUrl` rückwärts):
     sie trägt Slug, Typ und Nummer selbst, keine weitere Frage;
   - eine **Ref** mit Typ-Präfix (`US-123`/`T-45`, `#` und Kleinschreibung
     erlaubt — normalisiert wird auf die Schreibweise der Tokens);
   - eine **nackte Nummer** (`123`/`#123`, so zeigt Taiga sie): der Typ ist
     offen und wird per Probe aufgelöst — Taigas Zähler läuft je Projekt über
     beide Typen gemeinsam, genau einer trifft.
   Alles andere ist null — der Dialog bleibt dann still (Tipp-Zwischenstände
   sind kein Fehler). */
export function parseTicketInput(text){
  const s = (text || '').trim();
  if(!s) return null;
  if(/^https?:\/\//i.test(s)){
    let u;
    try{ u = new URL(s); }catch(_){ return null; }
    const m = /^\/project\/([^/]+)\/(us|task)\/(\d+)\/?$/.exec(u.pathname);
    if(!m) return null;
    return {kind: 'url', origin: u.origin, slug: m[1],
            ref: (m[2] === 'us' ? 'US-' : 'T-') + m[3]};
  }
  const r = /^#?(us|t)-(\d+)$/i.exec(s);
  if(r) return {kind: 'ref', ref: r[1].toUpperCase() + '-' + r[2]};
  const n = /^#?(\d+)$/.exec(s);
  if(n) return {kind: 'nr', nr: n[1]};
  return null;
}

/* Gehört eine eingefügte Ticket-URL zu einer ANDEREN Taiga-Instanz als der
   konfigurierten Web-Basis? Dann wäre die Verknüpfung eine Lüge: Slug und
   Nummer würden gegen UNSERE Instanz aufgelöst und träfen dort womöglich ein
   fremdes Ticket gleicher Nummer. Ohne Web-Basis ist nichts zu prüfen —
   die Bestätigung per Betreff bleibt dann der Wächter. */
export function foreignTaigaUrl(parsed, web){
  if(!parsed || parsed.kind !== 'url' || !web) return false;
  try{ return parsed.origin !== new URL(web).origin; }catch(_){ return false; }
}

/* Der Pfad am Backend-Proxy zum LESEN eines Tickets (D91-Nachtrag 6),
   relativ zu `/api/v1/taiga`: zwei benannte Endpunkte statt eines mit
   Typ-Parameter, weil Taiga getrennte `by_ref`-Endpunkte hat. Der Slug
   kommt als Query dazu (eine Ref ist nur je Projekt eindeutig). */
export function ticketApiPath(ref, slug){
  const p = refParts(ref);
  if(!p || !slug) return null;
  return '/' + (p.kind === 'US' ? 'userstories' : 'tasks') + '/' + p.nr +
    '?slug=' + encodeURIComponent(slug);
}

/* Taiga-Workflow -> Statusbox der Notation (SPEC §4/§9, D91-Nachtrag 6).
   Die Vorgabe steht in backend/CLAUDE.md; abgebildet wird im **Editor**, denn
   die Statuscodes sind Notations-Vokabular und das Backend parst die Notation
   nicht (D14). Groß-/Kleinschreibung und Leerraum sind egal; ein Name
   außerhalb der Liste bleibt unabgebildet (null) — geraten wird nicht, und
   Taigas Workflows sind je Projekt frei benennbar. */
export const TAIGA_STATUS_CODE = {
  'new': ' ',
  'in progress': '~',
  'ready for test': '/',
  'done': 'x',
  'archived': '^',
};
export function mapTaigaStatus(name){
  if(typeof name !== 'string') return null;
  const code = TAIGA_STATUS_CODE[normName(name)];
  return code ? STATUS_BY_CODE[code] : null;
}
const normName = s => s.trim().toLowerCase().replace(/\s+/g, ' ');

/* Die Gegenrichtung (D91-Nachtrag 7/8): Zu welcher Taiga-Spalte gehört eine
   Statusbox? Nur die fünf abgebildeten Zustände haben eine — `[?]`, `[!]`,
   `[-]` und der neutrale Knoten (code null) haben keine Entsprechung und
   lassen das Ticket unangetastet; erfunden wird nichts. */
export const TAIGA_STATUS_NAME = Object.fromEntries(
  Object.entries(TAIGA_STATUS_CODE).map(([name, code]) => [code, name]));
export function taigaStatusName(code){
  const name = code ? TAIGA_STATUS_NAME[code] : null;
  /* Zurück in die Schreibweise, in der Taiga die Spalten führt — gesucht wird
     ohnehin normalisiert (`pickStatus`), aber gemeldet wird sie im Klartext. */
  return name ? name.replace(/^./, c => c.toUpperCase()) : null;
}

/* Die Spalte des Projekts zu einem Namen — Taiga schreibt nach **Id**, und
   die Namen sind je Projekt frei. Verglichen wird mit derselben
   Normalisierung wie beim Lesen; findet sich nichts, wird nicht geschrieben
   (der Aufrufer sagt, welche Spalte fehlte). */
export function pickStatus(list, name){
  if(!Array.isArray(list) || typeof name !== 'string') return null;
  const gesucht = normName(name);
  return list.find(s => s && typeof s.name === 'string' && normName(s.name) === gesucht) || null;
}

/* Die beiden Schreib-Pfade am Proxy: der Status des Tickets und die Spalten
   des Projekts — je Typ ein eigener Endpunkt, wie beim Lesen. */
export function statusApiPath(ref, slug){
  const p = ticketApiPath(ref, slug);
  if(!p) return null;
  const [pfad, query] = p.split('?');
  return pfad + '/status?' + query;
}
export function statusListPath(ref, slug){
  const p = refParts(ref);
  if(!p || !slug) return null;
  return '/' + (p.kind === 'US' ? 'userstory-statuses' : 'task-statuses') +
    '?slug=' + encodeURIComponent(slug);
}

/* Alle Ticket-Refs eines Baums, gruppiert nach ihrem geerbten Projekt-Slug
   (D91-Nachtrag 10): die Menge, die die Bulk-Abfrage holt — die Refs im Plan
   sind der Filter, nie die Projektgröße. Knoten ohne Slug fallen heraus
   (ohne Projekt ist eine Ref nicht auflösbar — dieselbe stille Regel wie
   beim Öffnen, D91-Nachtrag 5). Map slug -> [{ref, node}]; dieselbe Ref an
   mehreren Knoten steht mehrfach darin (markiert wird je Knoten),
   dedupliziert wird erst im Anfrage-Pfad. */
export function collectTicketRefs(roots, slugMap){
  const out = new Map();
  (function w(ns){
    for(const n of ns){
      const ref = ticketRefOf(n);
      const slug = slugMap.get(n);
      if(ref && slug){
        if(!out.has(slug)) out.set(slug, []);
        out.get(slug).push({ref, node: n});
      }
      w(n.children || []);
    }
  })(roots);
  return out;
}

/* Der Bulk-Pfad am Proxy (eine Anfrage je Projekt): Refs dedupliziert und
   bei 200 gedeckelt — der benannte Server-Deckel; mehr referenziert kein
   Plan, und die ersten 200 markiert zu bekommen ist besser als wegen eines
   400 gar keine. */
export function bulkPath(slug, refs){
  const uniq = [...new Set(refs)].slice(0, 200);
  if(!uniq.length || !slug) return null;
  return '/tickets?slug=' + encodeURIComponent(slug) + '&refs=' + uniq.join(',');
}

/* Steht die Ref sichtbar im LABEL des Knotens? Nein heißt: Sie ist (nur)
   seine Knoten-ID (§1, erstes `#`-Token) — die Abweichungs-Marke braucht
   dann ein Badge hinter dem Label als sichtbaren Träger (D91-Nachtrag 10).
   Ein D60-Knoten (die ID vertritt das Label) zählt als sichtbar. */
export function refVisibleInLabel(n, ref){
  return new RegExp('(^|\\s)#' + ref + '(?=\\s|$)').test(n.label);
}

/* Weicht der Ticket-Status von der Statusbox des Knotens ab? (Die
   Abweichungs-Marke im Diagramm, D91-Nachtrag 10.) Verglichen wird nur, was
   abbildbar ist — ein unbekannter Spaltenname sagt nichts über den Plan
   (dieselbe Regel wie im Knoten-Fenster). Ein Knoten OHNE Statusbox weicht
   von jedem abgebildeten Ticket-Status ab — auch das zeigt das Fenster so. */
export function ticketDiverges(node, statusName){
  const ticket = mapTaigaStatus(statusName);
  if(!ticket) return false;
  return (node.status ? node.status.code : null) !== ticket.code;
}

/* Die Ticket-Referenz unter der Schreibmarke (Strg+Klick im Text,
   D91-Nachtrag 5): ein FREISTEHENDES `#US-123`/`#T-1234`-Token im Baumteil.
   Dieselben Ausschlüsse wie beim Abhängigkeits-Sprung (D67): nicht im
   Kommentar, nicht im Beschreibungsteil hinter `---`, nicht innerhalb einer
   URL. In einer Abhängigkeitsliste (`:#US-123`) ist die Ref nicht
   freistehend — dort behält Strg+Klick den Sprung zur Zeile. Liefert
   {ref, line} (Zeile 1-basiert) oder null. */
export function ticketRefAt(text, caret){
  const sol = text.lastIndexOf('\n', caret - 1) + 1;
  let eol = text.indexOf('\n', caret);
  if(eol === -1) eol = text.length;
  const before = text.slice(0, sol);
  for(const l of before.split('\n')){
    if(/^\s*-{3,}\s*$/.test(l)) return null;
  }
  const line = text.slice(sol, eol);
  const col = caret - sol;
  const k = line.indexOf('%%');
  if(k !== -1 && col >= k) return null;
  const head = k === -1 ? line : line.slice(0, k);
  const u = /https?:\/\/\S+/.exec(head);
  if(u && col > u.index && col < u.index + u[0].length) return null;
  const re = /(^|\s)#((?:US|T)-\d+)/g;
  let m;
  while((m = re.exec(head))){
    const p = m.index + m[1].length;
    const end = p + 1 + m[2].length;
    /* Kein Treffer mitten in einem längeren Token (`#US-123abc`) — hinter
       den Ziffern darf kein weiteres ID-Zeichen stehen (der Doppelpunkt als
       Trenner, §1, ist keines). */
    if(/[\p{L}\p{N}._-]/u.test(head[end] || '')) continue;
    if(col >= p && col <= end)
      return {ref: m[2], line: before.split('\n').length};
  }
  return null;
}

/* Der nächste Vorfahr mit einer STORY-Ref (D91-Nachtrag 9): Unter so einem
   Knoten wird ein Teilpaket direkt als Task angelegt — in dessen Story, ohne
   eigenen Dialog (Projekt und Story folgen aus dem Baum, es gibt nichts zu
   wählen). Vorfahren mit Task-Ref (`T-…`) werden übersprungen: Taiga-Tasks
   haben keine Subtasks, die Task eines Task-Knotens gehört in die Story
   darüber. null, wenn es keinen gibt oder der Knoten nicht im Baum steht. */
export function storyAncestor(roots, node){
  let result = null, hit = false;
  (function w(ns, chain){
    for(const n of ns){
      if(hit) return;
      if(n === node){
        hit = true;
        for(let i = chain.length - 1; i >= 0; i--){
          const r = ticketRefOf(chain[i]);
          if(r && r.startsWith('US-')){ result = {node: chain[i], ref: r}; return; }
        }
        return;
      }
      w(n.children || [], chain.concat(n));
    }
  })(roots, []);
  return result;
}

/* Das Token, das an die Zeile geschrieben wird. */
export function refToken(kind, ref){ return '#' + kind + '-' + ref; }
export function slugToken(slug){ return '&taiga.' + slug; }

/* Kandidaten für den Häkchen-Dialog „Story + Teilpakete als Tasks" (D91):
   die direkten Kinder, je mit Vorbelegung —
   - verworfene (`[-]`) erscheinen gar nicht;
   - erledigte (`[x]`/`[^]`) starten ABGEWÄHLT (dort ist nichts mehr zu tun,
     und angelegt wird ohnehin alles offen — Status-Sync ist #trk.write);
   - konjunktiv sind Pflicht- UND optionale (`+`) Kinder vorbelegt;
   - in einer `|`/`=`-Gruppe nur die REALISIERTEN Alternativen — ist nichts
     realisiert, ist die Wahl nicht getroffen und nichts vorbelegt.
   Kinder, die selbst schon eine Ref tragen, erscheinen abgewählt und
   gesperrt — sie sind schon angelegt. */
export function taskCandidates(n){
  const kids = (n.children || []).filter(k => !(k.status && k.status.key === 'verworfen'));
  if(!kids.length) return [];
  const disjunktiv = gateOf(kids) !== 'and';
  return kids.map(k => {
    const exists = !!ticketRefOf(k);
    const checked = !exists && !isDone(k) && (disjunktiv ? isRealized(k) : true);
    return {node: k, checked, exists};
  });
}

/* Hängt ein Token ans sichtbare Ende einer Textzeile — VOR einen
   `%%`-Kommentar und vor die Fortsetzungsmarke ` \` (beides gehört nicht zum
   Zeileninhalt, SPEC §1); vorhandener Leerraum vor dem Kommentar bleibt
   stehen. Eine Zeile ohne Inhalt bleibt unangetastet. */
export function appendToken(line, token){
  const k = line.indexOf('%%');
  let head = k === -1 ? line : line.slice(0, k);
  const tail = k === -1 ? '' : line.slice(k);
  let cont = '';
  const cm = head.match(/[ \t]\\[ \t]*$/);
  if(cm){ cont = head.slice(cm.index); head = head.slice(0, cm.index); }
  const wm = head.match(/[ \t]*$/);
  const base = head.slice(0, wm.index);
  const ws = head.slice(wm.index);
  if(!base.trim()) return line;
  return base + ' ' + token + ws + cont + tail;
}
