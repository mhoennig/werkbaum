import { describe, it, expect } from 'vitest';
import { applyStorageEvent, lockDecision, lockName, tombstoneExpired,
         createDirtySet, GONE_TTL } from '../src/docsync.js';

/* docsync (RFC 002 §6.3): Die Ereignis-Matrix — was ein storage-Ereignis im
   laufenden Fenster bedeutet. Headless: Liste und Ereignis sind Daten.

   Fixture: A ist dieses Fenster. Das Ereignis kommt von Fenster B. */
function apply(docs, activeId, key, newValue, oldValue){
  return applyStorageEvent(docs, activeId, {key, newValue, oldValue});
}
const D = (id, name, text) => ({id, name, text: text ?? ''});

describe('applyStorageEvent — die Matrix aus §6.3', () => {
  it('meta neu: Dokument hängt in der Liste, ohne Text (lazy)', () => {
    const docs = [D('a', 'A', '- a')];
    const erg = apply(docs, 'a', 'werkbaum-meta:neu', '{"name":"Neu","born":1}');
    expect(erg.docs).toEqual([{id: 'a', name: 'A', text: '- a'}, {id: 'neu', name: 'Neu', text: ''}]);
    expect(erg.action).toBe('created');
  });

  it('meta geändert am FREMDEN Dokument: Name/Quelle übernehmen, kein action', () => {
    const docs = [D('a', 'A', '- a'), D('b', 'Alt')];
    const erg = apply(docs, 'a', 'werkbaum-meta:b', '{"name":"Neu","born":1}');
    expect(erg.docs[0]).toBe(docs[0]);                 /* dasselbe Array — die Mutation trägt */
    expect(erg.docs[1].name).toBe('Neu');
    expect(erg.action).toBe(null);
  });

  it('meta geändert am AKTIVEN Dokument: action „renamed" — der Chip folgt', () => {
    const docs = [D('a', 'Alt')];
    const erg = apply(docs, 'a', 'werkbaum-meta:a', '{"name":"Neu","born":1}');
    expect(erg.action).toBe('renamed');
    expect(erg.docs[0].name).toBe('Neu');
  });

  it('gone neu, id NICHT aktiv: aus der Liste', () => {
    const docs = [D('a', 'A', '- a'), D('b', 'B', '- b')];
    const erg = apply(docs, 'a', 'werkbaum-gone:b', '123');
    expect(erg.docs.map(d => d.id)).toEqual(['a']);
    expect(erg.action).toBe(null);
  });

  it('gone neu, id AKTIV: behalten, action „deleted" — warnfarben, bis getippt wird (§6.5)', () => {
    const docs = [D('a', 'A', '- a')];
    const erg = apply(docs, 'a', 'werkbaum-gone:a', '123');
    expect(erg.docs).toBe(docs);                       /* behalten */
    expect(erg.action).toBe('deleted');
  });

  it('gone aufgehoben (newValue null): nichts tun — das meta-Ereignis legt an', () => {
    const erg = apply([D('a', 'A')], 'a', 'werkbaum-gone:a', null);
    expect(erg.action).toBe(null);
  });

  it('doc geändert, id NICHT aktiv: Text für die Vorschau nachziehen', () => {
    const docs = [D('a', 'A', '- a'), D('b', 'B', '- alt')];
    const erg = apply(docs, 'a', 'werkbaum-doc:b', '- neu');
    expect(erg.docs[1].text).toBe('- neu');
    expect(erg.action).toBe(null);
  });

  it('doc geändert, id AKTIV, kein live: — NICHTS am Text, action „foreignWrite" (§6.6)', () => {
    const docs = [D('a', 'A', '- mein Text')];
    const erg = apply(docs, 'a', 'werkbaum-doc:a', '- fremder Text');
    expect(erg.docs[0].text).toBe('- mein Text');      /* das Getippte bleibt */
    expect(erg.action).toBe('foreignWrite');
  });

  it('doc geändert, id aktiv, live: — nichts, der Feed ist die Quelle', () => {
    const docs = [D('live:https://x/d1', 'Geteilt', '- gemeinsam')];
    const erg = apply(docs, 'live:https://x/d1', 'werkbaum-doc:live:https://x/d1', '- server');
    expect(erg.docs[0].text).toBe('- gemeinsam');
    expect(erg.action).toBe(null);
  });

  it('doc geändert, id unbekannt: ignorieren — das meta-Ereignis legt das Dokument an', () => {
    const docs = [D('a', 'A')];
    const erg = apply(docs, 'a', 'werkbaum-doc:fremd', '- x');
    expect(erg.docs).toBe(docs);
    expect(erg.action).toBe(null);
  });

  it('snaps: action „snaps" — der Stände-Cache der id wird verworfen', () => {
    const erg = apply([D('a', 'A')], 'a', 'werkbaum-snaps:b', '[{"t":1,"text":"x"}]');
    expect(erg.action).toBe('snaps');
    expect(erg.id).toBe('b');
  });

  it('docs (Index-Hinweis): Reihenfolge übernehmen, unbekannte ids bleiben hinten', () => {
    const docs = [D('a', 'A'), D('b', 'B'), D('fremd', 'F')];
    const erg = apply(docs, 'a', 'werkbaum-docs', '[{"id":"b","name":"B"},{"id":"a","name":"A"}]');
    expect(erg.docs.map(d => d.id)).toEqual(['b', 'a', 'fremd']);
    expect(erg.action).toBe('order');
  });

  it('docs unlesbar oder bereits gleich: nichts', () => {
    const docs = [D('a', 'A')];
    expect(apply(docs, 'a', 'werkbaum-docs', '{kaputt').docs).toBe(docs);
    expect(apply(docs, 'a', 'werkbaum-docs', null).docs).toBe(docs);
  });

  it('Harmlose Schlüssel (active, Spiegel, Ansicht, Merker): nichts', () => {
    const docs = [D('a', 'A')];
    for(const k of ['werkbaum-active', 'werkbaum-src', 'werkbaum-ui', 'werkbaum-lang', 'werkbaum-seeded']){
      const erg = apply(docs, 'a', k, '1');
      expect(erg.docs).toBe(docs);
      expect(erg.action).toBe(null);
    }
  });
});

describe('lockDecision — gesperrt wird nie ein geteiltes Dokument (§6.4)', () => {
  it('nicht „live:" wird gesperrt — eigene, URL- und Datei-Dokumente ebenso', () => {
    expect(lockDecision('example')).toBe(true);
    expect(lockDecision('d12345')).toBe(true);
    expect(lockDecision('url:https://x.example/p.werkbaum')).toBe(true);
  });

  it('live: nie — zwei Fenster sind zwei Live-Clients, der Server führt zusammen', () => {
    expect(lockDecision('live:https://w.example/api/v1/documents/abc')).toBe(false);
    expect(lockDecision(null)).toBe(true);
  });
});

describe('tombstoneExpired — Verfall nach 7 Tagen (§6.2)', () => {
  const jetzt = 1750000000000;
  it('junge Tombstones bleiben', () => {
    expect(tombstoneExpired(jetzt - GONE_TTL + 1, jetzt)).toBe(false);
    expect(tombstoneExpired(jetzt, jetzt)).toBe(false);
  });

  it('nach sieben Tagen fallen sie', () => {
    expect(tombstoneExpired(jetzt - GONE_TTL - 1, jetzt)).toBe(true);
  });

  it('ohne brauchbaren Zeitstempel gilt der Tombstone als verfallen', () => {
    expect(tombstoneExpired(undefined, jetzt)).toBe(true);
    expect(tombstoneExpired('kaputt', jetzt)).toBe(true);
    expect(tombstoneExpired(0, jetzt)).toBe(true);
  });
});

describe('createDirtySet — die Flush-Punkte schreiben nur Eigenes (§6.1)', () => {
  it('sammelt ids, take räumt auf', () => {
    const dirty = createDirtySet();
    expect(dirty.entries()).toEqual([]);
    dirty.add('a'); dirty.add('b'); dirty.add('a');
    expect(dirty.entries()).toEqual(['a', 'b']);
    dirty.clear();
    expect(dirty.entries()).toEqual([]);
  });

  it('ignoriert fehlende ids', () => {
    const dirty = createDirtySet();
    dirty.add(null); dirty.add(undefined); dirty.add('');
    expect(dirty.entries()).toEqual([]);
    dirty.add('x');
    expect(dirty.has('x')).toBe(true);
  });
});