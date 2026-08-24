import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseChangelog, changedKeys, attachKeys, parseLog }
  from '../../scripts/news.mjs';

/* Neuigkeiten (D58). Geprüft ist die entscheidbare Hälfte — was aus dem
   Changelog eine Notiz wird und welche Knoten sich an einem Tag bewegt haben.
   Was git und Dateisystem liefern, steht in `collectNews()` und bleibt Sache
   des Builds. */

const st = (...paare) => new Map(paare);

describe('parseChangelog — Notizen aus docs/CHANGELOG.md', () => {
  const md = [
    '# Changelog', '', 'Fließtext, der niemanden interessiert.', '- keine Notiz, kein Tag offen',
    '', '## 2026-08-24', '', '- Erste Notiz', '* Zweite Notiz', 'kein Aufzählungszeichen',
    '', '## 2026-08-23', '', '- Ältere Notiz', '',
  ].join('\n');

  it('liest Tage und Notizen, neueste zuerst', () => {
    expect(parseChangelog(md)).toEqual([
      {date: '2026-08-24', lines: ['Erste Notiz', 'Zweite Notiz']},
      {date: '2026-08-23', lines: ['Ältere Notiz']},
    ]);
  });

  /* Die Datei erklärt oben, was sie ist — das darf nicht als Notiz enden. */
  it('überliest alles vor dem ersten Tag', () => {
    expect(parseChangelog(md)[0].lines).not.toContain('keine Notiz, kein Tag offen');
  });

  it('beendet einen Tag an der nächsten Überschrift', () => {
    const x = '## 2026-08-24\n- drin\n## Anhang\n- draußen\n';
    expect(parseChangelog(x)).toEqual([{date: '2026-08-24', lines: ['drin']}]);
  });

  it('lässt einen Tag ohne Notizen weg', () => {
    expect(parseChangelog('## 2026-08-24\n\n## 2026-08-23\n- da\n'))
      .toEqual([{date: '2026-08-23', lines: ['da']}]);
  });

  it('führt zwei Abschnitte desselben Tages zusammen', () => {
    expect(parseChangelog('## 2026-08-24\n- a\n\n## 2026-08-24\n- b\n')[0].lines)
      .toEqual(['a', 'b']);
  });

  it('deckelt die Tage', () => {
    const x = '## 2026-08-24\n- a\n## 2026-08-23\n- b\n';
    expect(parseChangelog(x, {maxDays: 1}).map(e => e.date)).toEqual(['2026-08-24']);
  });

  it('verträgt Leeres', () => {
    expect(parseChangelog('')).toEqual([]);
    expect(parseChangelog(undefined)).toEqual([]);
  });

  /* Die ausgelieferte Datei selbst: Sie ist die Quelle des Popups — ist sie
     unlesbar, steht das Popup leer da, ohne dass es jemand merkt. */
  it('liest die echte docs/CHANGELOG.md', () => {
    const echt = parseChangelog(readFileSync(new URL('../../docs/CHANGELOG.md', import.meta.url), 'utf8'));
    expect(echt.length).toBeGreaterThan(3);
    expect(echt[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(echt.every(e => e.lines.length > 0)).toBe(true);
    /* Absteigend sortiert — das Popup zeigt sie in dieser Reihenfolge. */
    expect([...echt].sort((a, b) => a.date < b.date ? 1 : -1)).toEqual(echt);
  });
});

describe('changedKeys — was sich im Plan bewegt hat', () => {
  it('meldet neue Knoten und geänderten Status', () => {
    const prev = st(['> A', 'geplant'], ['> B', 'fertig']);
    const curr = st(['> A', 'fertig'], ['> B', 'fertig'], ['> C', 'idee']);
    expect(changedKeys(prev, curr).sort()).toEqual(['> A', '> C']);
  });

  /* Wie beim Erstkontakt in D28: Ohne Vergleichsfassung leuchtet nichts. */
  it('gibt ohne Vorfassung nichts zurück', () => {
    expect(changedKeys(null, st(['> A', 'fertig']))).toEqual([]);
  });

  /* Ein entfernter Knoten ist im Diagramm nicht mehr da — es gäbe nichts
     hervorzuheben. */
  it('meldet entfernte Knoten nicht', () => {
    expect(changedKeys(st(['> A', 'fertig']), st())).toEqual([]);
  });
});

describe('attachKeys — Tageseinträge und Plan-Fassungen zusammenführen', () => {
  const versionen = [
    {date: '2026-08-22', status: st(['> A', 'geplant'])},
    {date: '2026-08-23', status: st(['> A', 'fertig'])},
    {date: '2026-08-24', status: st(['> A', 'prod'])},
  ];

  it('hängt die Knoten an den Tag', () => {
    const e = attachKeys([{date: '2026-08-24', lines: ['x']}], versionen);
    expect(e[0]).toEqual({date: '2026-08-24', lines: ['x'], keys: ['> A']});
  });

  it('gibt einem Tag ohne Plan-Änderung eine leere Menge', () => {
    const e = attachKeys([{date: '2026-08-25', lines: ['x']}], versionen);
    expect(e[0].keys).toEqual([]);
  });

  /* Der Deploy-Tag (D30) oder ein vergessener Changelog-Eintrag: Der Link
     führt trotzdem vor, was sich bewegt hat. */
  it('legt für einen reinen Plan-Tag einen eigenen Eintrag an', () => {
    const e = attachKeys([{date: '2026-08-24', lines: ['x']}], versionen);
    expect(e.map(x => x.date)).toEqual(['2026-08-24', '2026-08-23']);
    expect(e[1]).toEqual({date: '2026-08-23', lines: [], keys: ['> A']});
  });

  it('nimmt die erste Fassung nicht als Änderung', () => {
    const e = attachKeys([], [versionen[0]]);
    expect(e).toEqual([]);
  });

  it('deckelt auch nach dem Zusammenführen', () => {
    const e = attachKeys([{date: '2026-08-24', lines: ['x']}], versionen, {maxDays: 1});
    expect(e.map(x => x.date)).toEqual(['2026-08-24']);
  });
});

describe('parseLog — git-Ausgabe zerlegen', () => {
  const REC = '\x1e', F = '\x1f';

  it('liest Kennung, Datum und Betreff', () => {
    const raw = `${REC}abc${F}2026-08-24${F}feat: X${REC}def${F}2026-08-23${F}fix: Y`;
    expect(parseLog(raw)).toEqual([
      {sha: 'abc', date: '2026-08-24', subject: 'feat: X', files: []},
      {sha: 'def', date: '2026-08-23', subject: 'fix: Y', files: []},
    ]);
  });

  /* Mit `--name-only` hängt git die Dateinamen hinter die Formatzeile — sie
     gehören zu diesem Commit, weil der Satztrenner vorn steht. */
  it('sammelt die Dateinamen aus --name-only', () => {
    const raw = `${REC}abc${F}2026-08-24${F}rename\n\ndocs/examples/alt.werkbaum\n`;
    expect(parseLog(raw)[0].files).toEqual(['docs/examples/alt.werkbaum']);
  });

  it('verträgt leere Ausgabe', () => {
    expect(parseLog('')).toEqual([]);
    expect(parseLog(REC + '\n')).toEqual([]);
  });
});
