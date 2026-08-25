/* Werkbaum — Service Worker (D73).
 *
 * Bewusst ein dummer Offline-Mantel, kein App-Verwalter: Navigationen gehen
 * NETWORK-FIRST (der Server ist die Quelle der Wahrheit, wie ohne Worker),
 * der Cache hält nur die zuletzt gesehene Fassung der einen self-contained
 * Datei (D19) für den Offline-Fall bereit. Drei Folgen, alle Absicht:
 *
 * - Die Update-Prüfung (D45) bleibt wahr: ihr fetch() ist keine Navigation
 *   und läuft unangefasst ans Netz; „Jetzt laden" ist eine Navigation und
 *   bekommt network-first die frische Fassung. Kein skipWaiting-Tanz,
 *   keine zweite Update-Logik.
 * - ?sourceUrl=- und Pad-Abrufe (D23/D31) werden nie abgefangen — der
 *   Worker fasst ausschließlich die Navigation zur App-Wurzel an; llms.md,
 *   llms.txt und alles Fremde gehen unverändert durch.
 * - Diese Datei ändert sich praktisch nie: Die App kommt vom Server, nicht
 *   aus dem Worker — es gibt keine Versionsnummer, die hier gepflegt werden
 *   müsste.
 */
const CACHE = 'werkbaum-shell';

self.addEventListener('install', e => {
  /* Die Shell sofort vorhalten, damit Offline schon nach dem ersten Besuch
     funktioniert (die erste Navigation lief noch ohne Worker). {cache:
     'reload'} umgeht den HTTP-Cache — vorgehalten wird, was der Server
     JETZT sagt. Scheitert das (Installation offline), bleibt der Cache
     leer und die nächste erfolgreiche Navigation füllt ihn. */
  e.waitUntil(
    caches.open(CACHE)
      .then(c => fetch('./', { cache: 'reload' })
        .then(r => { if (r.ok) return c.put('./', r); }))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
  /* Nur die Navigation zur App selbst; alles andere geht unangefasst durch. */
  if (e.request.mode !== 'navigate') return;
  const path = new URL(e.request.url).pathname;
  const scopePath = new URL(self.registration.scope).pathname;
  if (path !== scopePath && path !== scopePath + 'index.html') return;

  e.respondWith((async () => {
    try {
      const r = await fetch(e.request);
      if (r.ok) {
        const copy = r.clone();
        e.waitUntil(caches.open(CACHE).then(c => c.put('./', copy)));
      }
      return r;
    } catch (_) {
      const m = await caches.match('./');
      return m || Response.error();
    }
  })());
});
