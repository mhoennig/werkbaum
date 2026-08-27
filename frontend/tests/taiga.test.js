import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { taigaSlugs } from '../src/model.js';
import { ticketRefOf, taskCandidates, appendToken, refToken, slugToken } from '../src/taiga.js';

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
