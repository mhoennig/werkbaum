import { describe, it, expect } from 'vitest';
import { saveFileName, FILE_ACCEPT } from '../src/localfile.js';

/* Öffnen/Speichern lokaler Dateien (D72): der Dateiname beim Speichern wird
   aus dem Dokumentnamen abgeleitet — Endung .werkbaum (D24), verbotene
   Zeichen bereinigt, URL-Namen (D23) bleiben lesbar. */

describe('saveFileName', () => {
  it('gewöhnlicher Name bekommt die Endung .werkbaum', () => {
    expect(saveFileName('Mein Plan')).toBe('Mein Plan.werkbaum');
  });

  it('vorhandene Endung .werkbaum wird nicht verdoppelt', () => {
    expect(saveFileName('plan.werkbaum')).toBe('plan.werkbaum');
  });

  it('.txt bleibt zulässig — die Endung ist Konvention, kein Vertrag (D24)', () => {
    expect(saveFileName('notizen.txt')).toBe('notizen.txt');
    expect(saveFileName('notizen.TXT')).toBe('notizen.TXT');
  });

  it('URL-Namen (D23) werden zu brauchbaren Dateinamen', () => {
    expect(saveFileName('https://example.org/p/plan'))
      .toBe('https-example.org-p-plan.werkbaum');
  });

  it('verbotene Zeichen fallen zu einem einzigen Strich zusammen', () => {
    expect(saveFileName('a<b>c:d*e?f"g|h\\i')).toBe('a-b-c-d-e-f-g-h-i.werkbaum');
  });

  it('Leerzeichen und Klammern bleiben — sie sind in Dateinamen erlaubt', () => {
    expect(saveFileName('Sprint 15 (Q3)')).toBe('Sprint 15 (Q3).werkbaum');
  });

  it('führende Punkte fallen weg — sonst entstünde eine versteckte Datei', () => {
    expect(saveFileName('.geheim')).toBe('geheim.werkbaum');
  });

  it('leerer oder unbrauchbarer Name fällt auf plan.werkbaum zurück', () => {
    expect(saveFileName('')).toBe('plan.werkbaum');
    expect(saveFileName('...')).toBe('plan.werkbaum');
    expect(saveFileName(null)).toBe('plan.werkbaum');
  });
});

describe('FILE_ACCEPT', () => {
  it('nennt die Endung der Notation und lässt .txt zu (D24)', () => {
    expect(FILE_ACCEPT).toContain('.werkbaum');
    expect(FILE_ACCEPT).toContain('.txt');
  });
});
