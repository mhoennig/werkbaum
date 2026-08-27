/* Werkbaum-Taiga — die entscheidbaren Regeln der Ticket-Anlage (D91),
   headless nach Hausregel (D54-Nachtrag 3): Was hier steht, gilt; app.js
   verdrahtet nur Dialoge, Netz und Textfeld.

   Der Zuschnitt (D91): eine Story je Knoten, Tasks nur unter einem Knoten
   mit Story — storyless Tasks sind im Kanban unsichtbar. Die Ref kommt
   ZUSÄTZLICH zur Knoten-ID als eigenes Token an die Zeile (`#US-123` /
   `#T-1234`, D91-Nachtrag 2); die Präfixe schreibt Werkbaum selbst, Taiga
   zeigt nur die Nummer. */

import { gateOf, isDone, isRealized } from './model.js';

/* Das Tracker-Muster (SPEC §11): `US-\d+` (Story) und `T-\d+` (Task). */
export const TICKET_ID_RE = /^(?:US|T)-\d+$/;

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
  const m = /^(US|T)-(\d+)$/.exec(ref || '');
  if(!m || !web || !slug) return null;
  return web + '/project/' + slug + '/' + (m[1] === 'US' ? 'us' : 'task') + '/' + m[2];
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
