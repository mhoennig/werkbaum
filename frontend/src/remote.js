/* Werkbaum — Adressen für Dokumente von außen (headless, D31).
   Hier steht nur reine Logik, damit sie testbar ist; das Holen selbst und der
   ganze DOM-Kram bleiben in app.js. */

/* Pad-Adresse normalisieren (D31). Eingabe ist die Adresse aus der Browser-
   Adresszeile — ohne Export-Pfad, den hängt Werkbaum selbst an. Abgeschnitten
   werden ein versehentlich mitgegebener Export- oder /timeslider-Pfad, Query,
   Fragment und Schrägstriche am Ende: derselbe Pad soll genau ein Dokument
   ergeben, gleich in welcher Schreibweise der Link kam.

   Verlangt wird `/p/<name>` am Ende (auch unter einem Unterpfad montiert) — das
   ist die Prüfung, ob überhaupt eine Pad-Adresse vorliegt. Erlaubt sind nur
   http(s), wie bei ?sourceUrl= (D23).

   Rückgabe {pad, text} oder null. `pad` ist zugleich Name und Identität des
   Dokuments — die **vollständige** URL, nicht der bloße Pad-Name: Pad-Namen sind
   nur pro Instanz eindeutig, zwei Hosts mit je einem Pad `plan` wären sonst im
   Wähler nicht zu unterscheiden. */
export function padUrls(raw, base){
  let u;
  try{ u = base ? new URL(raw, base) : new URL(raw); }catch(_){ return null; }
  if(u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const path = u.pathname.replace(/\/+$/, '').replace(/\/(export\/[^/]+|timeslider)$/, '');
  if(!/\/p\/[^/]+$/.test(path)) return null;
  u.pathname = path; u.search = ''; u.hash = '';
  const pad = u.href;
  return {pad, text: pad + '/export/txt'};
}
