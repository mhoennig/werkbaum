import { describe, it, expect } from 'vitest';
import { padUrls } from '../src/remote.js';

const PAD = 'https://pad.example.org/p/mein-plan';

describe('padUrls — Pad-Adresse normalisieren (D31)', () => {
  it('hängt den Klartext-Export an', () => {
    expect(padUrls(PAD)).toEqual({ pad: PAD, text: PAD + '/export/txt' });
  });

  /* Derselbe Pad soll genau EIN Dokument ergeben — die Identität leitet sich
     aus `pad` ab, also müssen alle Schreibweisen darauf zusammenfallen. */
  it.each([
    ['Schrägstrich am Ende',        PAD + '/'],
    ['mehrere Schrägstriche',       PAD + '///'],
    ['Export-Pfad mitgegeben',      PAD + '/export/txt'],
    ['anderer Export',              PAD + '/export/html'],
    ['Timeslider',                  PAD + '/timeslider'],
    ['Query dran',                  PAD + '?showChat=false'],
    ['Fragment dran',               PAD + '#anker'],
    ['Query und Schrägstrich',      PAD + '/?showControls=false'],
  ])('fällt auf dieselbe Pad-URL zusammen: %s', (_name, input) => {
    expect(padUrls(input)).toEqual({ pad: PAD, text: PAD + '/export/txt' });
  });

  it('erlaubt eine Montage unter einem Unterpfad', () => {
    const sub = 'https://example.org/etherpad/p/plan';
    expect(padUrls(sub)).toEqual({ pad: sub, text: sub + '/export/txt' });
  });

  it('erlaubt http neben https', () => {
    const h = 'http://pad.example.org/p/plan';
    expect(padUrls(h).pad).toBe(h);
  });

  it('behält den Port', () => {
    const h = 'https://pad.example.org:9001/p/plan';
    expect(padUrls(h)).toEqual({ pad: h, text: h + '/export/txt' });
  });

  /* Zwei Pads gleichen Namens auf verschiedenen Hosts müssen unterscheidbar
     bleiben — deshalb ist der Name die vollständige URL, nicht der Pad-Name. */
  it('unterscheidet gleichnamige Pads verschiedener Hosts', () => {
    expect(padUrls('https://a.example/p/plan').pad)
      .not.toBe(padUrls('https://b.example/p/plan').pad);
  });

  it.each([
    ['kein /p/-Pfad',        'https://pad.example.org/mein-plan'],
    ['nur der Host',         'https://pad.example.org'],
    ['/p/ ohne Namen',       'https://pad.example.org/p/'],
    ['fremdes Schema',       'file:///tmp/plan.txt'],
    ['javascript:',          'javascript:alert(1)'],
    ['data:',                'data:text/plain,foo'],
    ['gar keine URL',        'nicht mal eine URL'],
    ['leer',                 ''],
  ])('weist ab: %s', (_name, input) => {
    expect(padUrls(input)).toBeNull();
  });

  it('löst relative Angaben gegen die Seite auf, wenn eine Basis da ist', () => {
    expect(padUrls('/p/plan', 'https://pad.example.org/x/y').pad)
      .toBe('https://pad.example.org/p/plan');
  });

  it('ohne Basis bleibt eine relative Angabe unbrauchbar', () => {
    expect(padUrls('/p/plan')).toBeNull();
  });
});
