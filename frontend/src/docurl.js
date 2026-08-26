/* ---------- Welche Adresse beschreibt das aktive Dokument? (D80) ----------

   Die Adresszeile ist der Link, den man weitergibt, und der Stand, den ein
   Neuladen wiederherstellt. Sie muss deshalb sagen, welches Dokument **gerade
   vorn** ist — nicht, mit welchem die Seite einmal aufgerufen wurde. Bleibt
   ein `?live=` stehen, nachdem man auf ein anderes Dokument umgeschaltet hat,
   zeigt die Adresse auf etwas anderes als der Bildschirm, und ein Neuladen
   holt das falsche Dokument zurück.

   Die beiden Eingänge, die ein Dokument adressieren, sind zugleich seine
   Identität: `live:<url>` (D76) und `url:<href>` (D23). Aus der id lässt sich
   der Parameter also zurückrechnen — hier steht diese eine Regel. Eigene
   Dokumente, Dateien und die mitgelieferten haben keine Adresse: Dort fällt
   der Parameter weg. `?etherpad=` ist ausgebaut (D78) und wird nur noch
   weggeräumt. */

export const LIVE_PARAM = 'live';
export const SOURCE_PARAM = 'sourceUrl';
export const ETHERPAD_PARAM = 'etherpad';

/* Die Parameter, über die diese Regel bestimmt. Alles andere ist fremd und
   bleibt unangetastet. */
const OWNED = [LIVE_PARAM, SOURCE_PARAM, ETHERPAD_PARAM];

/* Der Parameter, der dieses Dokument wieder öffnet — oder null. */
export function docParam(id){
  if(typeof id !== 'string') return null;
  if(id.startsWith('live:')) return {name: LIVE_PARAM, value: id.slice(5)};
  if(id.startsWith('url:')) return {name: SOURCE_PARAM, value: id.slice(4)};
  return null;
}

/* Der neue Query-String zu `search` (mit oder ohne führendes `?`) für das
   Dokument `id`.

   Fremde Parameter (etwa `?server=`, D76-Nachtrag 8) bleiben **wörtlich**
   stehen, Schreibweise eingeschlossen: Der Umweg über `URLSearchParams`
   schriebe jedes `:` und `/` als `%3A`/`%2F` und machte damit gerade die URL
   unleserlich, um die es hier geht. Aus demselben Grund wird der eigene Wert
   nur dort maskiert, wo er den Query-String sonst zerrisse (`&`, `#`). */
export function docSearch(search, id){
  const roh = String(search == null ? '' : search).replace(/^\?/, '');
  const rest = roh ? roh.split('&').filter(p => p && OWNED.indexOf(p.split('=')[0]) < 0) : [];
  const mein = docParam(id);
  if(mein){
    const wert = String(mein.value).replace(/&/g, '%26').replace(/#/g, '%23');
    rest.push(mein.name + '=' + wert);
  }
  return rest.length ? '?' + rest.join('&') : '';
}
