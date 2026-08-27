import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { taigaSlugs } from '../src/model.js';
import { ticketRefOf, taskCandidates, appendToken, refToken, slugToken, ticketUrl, ticketRefAt, refParts, ticketApiPath, mapTaigaStatus } from '../src/taiga.js';

/* Schlagworte `&tag` (SPEC §1, D91): Extraktion im Parser und die
   `taiga.*`-Vererbung in model.js — der erste Konsument der reservierten
   freien Schlagworte (Projekt-Vorbelegung der Ticket-Anlage). */

describe('parse — Schlagworte &tag (SPEC §1, D91)', () => {
  it('extrahiert alleinstehende &-Token aus dem Label', () => {
    const { roots, warnings } = parse('- Backend &taiga.intern &infra (M)');
    expect(roots[0].label).toBe('Backend');
    expect(roots[0].marks).toEqual(['taiga.intern', 'infra']);
    expect(roots[0].size).toBe('M');
    expect(warnings).toEqual([]);
  });

  it('Zeichenmenge wie @name: Punkt, Unterstrich, Bindestrich, Unicode', () => {
    const { roots } = parse('- X &über_a.b-c');
    expect(roots[0].marks).toEqual(['über_a.b-c']);
  });

  it('nur alleinstehend angesetzt: R&D und Drag & Drop bleiben Labels', () => {
    const { roots } = parse('- R&D für Drag & Drop');
    expect(roots[0].marks).toEqual([]);
    expect(roots[0].label).toBe('R&D für Drag & Drop');
  });

  it('Zitier-Konvention: (&taiga.slug) bleibt Label', () => {
    const { roots } = parse('- (&taiga.slug) benennt das Projekt');
    expect(roots[0].marks).toEqual([]);
    expect(roots[0].label).toBe('(&taiga.slug) benennt das Projekt');
  });

  it('ein & in einer URL bleibt Teil der URL (URL wird zuerst extrahiert)', () => {
    const { roots } = parse('- Suche https://example.org/?a=1&b=2');
    expect(roots[0].url).toBe('https://example.org/?a=1&b=2');
    expect(roots[0].marks).toEqual([]);
  });

  it('ein Schlagwort hinter %% wirkt nicht (Kommentar fällt zuerst weg)', () => {
    const { roots } = parse('- Backend %% &taiga.intern');
    expect(roots[0].marks).toEqual([]);
  });

  it('ändert weder Status noch Notwendigkeit noch Kosten-Felder', () => {
    const { roots } = parse('+ [x] Zugabe &taiga.intern (S)');
    const n = roots[0];
    expect(n.optional).toBe(true);
    expect(n.status.key).toBe('fertig');
    expect(n.size).toBe('S');
  });
});

describe('taigaSlugs — Projekt-Vererbung (SPEC §1, D91-Nachtrag 3)', () => {
  const tree = text => parse(text).roots;

  it('eigenes taiga.*-Schlagwort setzt den Slug, Nachkommen erben ihn', () => {
    const roots = tree('- Wurzel &taiga.intern\n  - Kind\n    - Enkel');
    const map = taigaSlugs(roots);
    expect(map.get(roots[0])).toBe('intern');
    expect(map.get(roots[0].children[0])).toBe('intern');
    expect(map.get(roots[0].children[0].children[0])).toBe('intern');
  });

  it('ein eigenes Schlagwort am Knoten übersteuert das geerbte', () => {
    const r = tree('- Wurzel &taiga.a\n  - Kind &taiga.b\n    - Enkel\n  - Bruder');
    const m = taigaSlugs(r);
    expect(m.get(r[0])).toBe('a');
    expect(m.get(r[0].children[0])).toBe('b');
    expect(m.get(r[0].children[0].children[0])).toBe('b');
    expect(m.get(r[0].children[1])).toBe('a');
  });

  it('ohne taiga.*-Vorfahren gibt es keinen Eintrag', () => {
    const r = tree('- Wurzel &infra\n  - Kind');
    const m = taigaSlugs(r);
    expect(m.has(r[0])).toBe(false);
    expect(m.has(r[0].children[0])).toBe(false);
  });

  it('mehrere taiga.*-Schlagworte auf einer Zeile: das erste gilt', () => {
    const r = tree('- Wurzel &taiga.a &taiga.b');
    expect(taigaSlugs(r).get(r[0])).toBe('a');
  });

  it('das nackte &taiga. ohne Slug zählt nicht', () => {
    const r = tree('- Wurzel &taiga.');
    expect(taigaSlugs(r).has(r[0])).toBe(false);
  });
});

describe('ticketRefOf — der Idempotenz-Marker (D91-Nachtrag 2)', () => {
  const node = text => parse(text).roots[0];

  it('erkennt die Ref als Knoten-ID (Label-Vertreter, SPEC §1)', () => {
    expect(ticketRefOf(node('- #US-123'))).toBe('US-123');
  });

  it('erkennt die Ref als weiteres #-Token im Label, neben der Knoten-ID', () => {
    const n = node('- #auth: Backend #US-123 (M)');
    expect(n.id).toBe('auth');
    expect(ticketRefOf(n)).toBe('US-123');
  });

  it('erkennt Task-Refs (#T-…)', () => {
    expect(ticketRefOf(node('- API-Teil #T-1234'))).toBe('T-1234');
  });

  it('ein Knoten ohne Tracker-Token hat keine Ref', () => {
    expect(ticketRefOf(node('- #auth: Backend (M)'))).toBe(null);
    expect(ticketRefOf(node('- US-123 als Text'))).toBe(null);   /* ohne # */
    expect(ticketRefOf(node('- #ABC-123: Jira-artig'))).toBe(null);
  });
});

describe('taskCandidates — Vorbelegung des Häkchen-Dialogs (D91)', () => {
  const kids = text => taskCandidates(parse(text).roots[0]);

  it('konjunktiv: Pflicht- und optionale Kinder vorbelegt, erledigte abgewählt, verworfene fehlen', () => {
    const c = kids('- P\n  - [ ] a\n  + [?] b\n  - [x] c\n  - [-] d');
    expect(c.map(x => x.node.label)).toEqual(['a', 'b', 'c']);
    expect(c.map(x => x.checked)).toEqual([true, true, false]);
  });

  it('disjunktiv: nur realisierte Alternativen vorbelegt', () => {
    const c = kids('- P\n  | [~] a\n  | [ ] b\n  | [x] c');
    expect(c.map(x => x.checked)).toEqual([true, false, false]);  /* c ist erledigt */
  });

  it('disjunktiv ohne Realisiertes: nichts vorbelegt — die Wahl ist nicht getroffen', () => {
    const c = kids('= P\n  = [ ] a\n  = [?] b');
    expect(c.map(x => x.checked)).toEqual([false, false]);
  });

  it('ein Kind mit eigener Ref ist gesperrt und abgewählt', () => {
    const c = kids('- P\n  - [ ] a #T-9\n  - [ ] b');
    expect(c[0].exists).toBe(true);
    expect(c[0].checked).toBe(false);
    expect(c[1].checked).toBe(true);
  });

  it('ein Blatt hat keine Kandidaten', () => {
    expect(kids('- P')).toEqual([]);
  });
});

describe('appendToken — Token ans sichtbare Zeilenende (D91)', () => {
  it('hängt hinter den Inhalt an', () => {
    expect(appendToken('  - [ ] Backend (M)', '#US-123')).toBe('  - [ ] Backend (M) #US-123');
  });

  it('vor einen %%-Kommentar, dessen Leerraum bleibt', () => {
    expect(appendToken('- X  %% Notiz', '#US-1')).toBe('- X #US-1  %% Notiz');
  });

  it('vor die Fortsetzungsmarke ` \\` (SPEC §1)', () => {
    expect(appendToken('- Langer Titel \\', '#US-1')).toBe('- Langer Titel #US-1 \\');
  });

  it('eine leere oder reine Kommentarzeile bleibt unangetastet', () => {
    expect(appendToken('   ', '#US-1')).toBe('   ');
    expect(appendToken('%% nur Kommentar', '#US-1')).toBe('%% nur Kommentar');
  });

  it('das Ergebnis parst mit der Ref im Label und unveränderter Struktur', () => {
    const zeile = appendToken('  - [ ] #auth: Backend (M) @anna', refToken('US', 123));
    const { roots } = parse('- Wurzel\n' + zeile);
    const n = roots[0].children[0];
    expect(n.id).toBe('auth');
    expect(n.label).toBe('Backend #US-123');
    expect(n.size).toBe('M');
    expect(ticketRefOf(n)).toBe('US-123');
  });

  it('slugToken ergibt das Schlagwort der Projekt-Zuordnung', () => {
    const zeile = appendToken('- Teilbaum', slugToken('mi-intern'));
    const { roots } = parse(zeile);
    expect(roots[0].marks).toEqual(['taiga.mi-intern']);
  });
});

/* Ticket-Links (D91-Nachtrag 5): die Adresse im Taiga-Frontend und die
   Ref-Erkennung unter der Schreibmarke (Strg+Klick). */

describe('ticketUrl — Adresse im Taiga-Frontend', () => {
  it('Stories unter /us/, Tasks unter /task/ — das Präfix trägt den Typ', () => {
    expect(ticketUrl('https://plan.example', 'mi-kunde', 'US-123'))
      .toBe('https://plan.example/project/mi-kunde/us/123');
    expect(ticketUrl('https://plan.example', 'mi-kunde', 'T-45'))
      .toBe('https://plan.example/project/mi-kunde/task/45');
  });

  it('ohne Web-Basis, Slug oder gültige Ref: keine Adresse', () => {
    expect(ticketUrl(null, 'mi-kunde', 'US-1')).toBe(null);
    expect(ticketUrl('https://plan.example', null, 'US-1')).toBe(null);
    expect(ticketUrl('https://plan.example', 'mi-kunde', 'ABC-1')).toBe(null);
    expect(ticketUrl('https://plan.example', 'mi-kunde', 'US-1x')).toBe(null);
  });
});

describe('ticketRefAt — die Ref unter der Schreibmarke', () => {
  const at = (text, needle) => text.indexOf(needle);

  it('trifft ein freistehendes Token, über seine ganze Breite', () => {
    const text = '- Login bauen #US-123 (M)';
    const p = at(text, '#US-123');
    expect(ticketRefAt(text, p)).toEqual({ref: 'US-123', line: 1});
    expect(ticketRefAt(text, p + 7)).toEqual({ref: 'US-123', line: 1});
    /* das Leerzeichen davor gehört nicht mehr zum Token */
    expect(ticketRefAt(text, p - 1)).toBe(null);
  });

  it('nennt die richtige Zeile', () => {
    const text = '- A\n  - B #T-77';
    expect(ticketRefAt(text, at(text, '#T-77') + 2)).toEqual({ref: 'T-77', line: 2});
  });

  it('mit Trenn-Doppelpunkt dahinter (§1) bleibt es ein Treffer', () => {
    const text = '- #US-123: Titel dazu';
    expect(ticketRefAt(text, at(text, 'US') + 1)).toEqual({ref: 'US-123', line: 1});
  });

  it('in einem Abhängigkeits-Token ist die Ref nicht freistehend', () => {
    const text = '- A :#US-123';
    expect(ticketRefAt(text, at(text, 'US') + 1)).toBe(null);
  });

  it('kein Treffer neben dem Token, im Kommentar, in der URL, hinter ---', () => {
    expect(ticketRefAt('- A #US-1 B', 0)).toBe(null);
    const c = '- A %% siehe #US-123';
    expect(ticketRefAt(c, at(c, 'US'))).toBe(null);
    const u = '- A https://x.example/#US-123 dazu';
    expect(ticketRefAt(u, at(u, 'US'))).toBe(null);
    const d = '- A\n---\n#US-123\n  Text';
    expect(ticketRefAt(d, at(d, 'US'))).toBe(null);
  });

  it('kein Treffer mitten in einem längeren Token', () => {
    const text = '- A #US-123abc B';
    expect(ticketRefAt(text, at(text, 'US'))).toBe(null);
  });
});

/* Ticket-Stand lesen (D91-Nachtrag 6): Ref zerlegen, Proxy-Pfad bauen,
   Taiga-Workflow auf die Statusbox der Notation abbilden. */

describe('refParts / ticketApiPath — das Präfix trägt den Typ', () => {
  it('zerlegt Story- und Task-Refs', () => {
    expect(refParts('US-123')).toEqual({kind: 'US', nr: '123'});
    expect(refParts('T-9')).toEqual({kind: 'T', nr: '9'});
  });

  it('alles andere ergibt null — geraten wird nicht', () => {
    expect(refParts('ABC-1')).toBe(null);
    expect(refParts('US-1x')).toBe(null);
    expect(refParts('123')).toBe(null);
    expect(refParts(null)).toBe(null);
  });

  it('baut die getrennten by_ref-Pfade des Proxys samt Slug', () => {
    expect(ticketApiPath('US-123', 'mi-kunde')).toBe('/userstories/123?slug=mi-kunde');
    expect(ticketApiPath('T-1234', 'mi-kunde')).toBe('/tasks/1234?slug=mi-kunde');
  });

  it('kodiert den Slug — er hängt keinen zweiten Parameter an', () => {
    expect(ticketApiPath('US-1', 'a&b=2')).toBe('/userstories/1?slug=a%26b%3D2');
  });

  it('ohne Slug oder mit unbrauchbarer Ref gibt es keinen Pfad', () => {
    expect(ticketApiPath('US-1', null)).toBe(null);
    expect(ticketApiPath('ABC-1', 'mi-kunde')).toBe(null);
  });
});

describe('mapTaigaStatus — Workflow auf die Statusbox (SPEC §4/§9)', () => {
  const code = name => (mapTaigaStatus(name) || {}).code;

  it('bildet die fünf vorgegebenen Zustände ab', () => {
    expect(code('New')).toBe(' ');
    expect(code('In progress')).toBe('~');
    expect(code('Ready for test')).toBe('/');
    expect(code('Done')).toBe('x');
    expect(code('Archived')).toBe('^');
  });

  it('liefert den vollen Status samt Schlüssel für die Anzeige', () => {
    expect(mapTaigaStatus('in progress').key).toBe('arbeit');
    expect(mapTaigaStatus('DONE').key).toBe('fertig');
  });

  it('Groß-/Kleinschreibung und Leerraum sind egal', () => {
    expect(code('  ready   FOR test ')).toBe('/');
  });

  it('ein unbekannter Name bleibt unabgebildet', () => {
    expect(mapTaigaStatus('Blocked')).toBe(null);
    expect(mapTaigaStatus('')).toBe(null);
    expect(mapTaigaStatus(null)).toBe(null);
    expect(mapTaigaStatus(undefined)).toBe(null);
  });
});
