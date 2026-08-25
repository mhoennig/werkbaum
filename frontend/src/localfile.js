/* Öffnen und Speichern lokaler Dateien (D72).
   Hier liegt die entscheidbare Hälfte (Hausregel, D54-Nachtrag 3): welcher
   Dateiname aus einem Dokumentnamen wird. Die I/O — Datei-Input, Blob-Download,
   ab Stufe 2 die File System Access API — bleibt in app.js. */

/* Der accept-Filter des Öffnen-Dialogs (D24: die Endung macht Dateien
   zuordenbar; .txt bleibt zulässig — die Endung ist Konvention, kein Vertrag). */
export const FILE_ACCEPT = '.werkbaum,.txt,text/plain';

/* Dateiname für das Speichern, abgeleitet aus dem Dokumentnamen.
   Dokumentnamen sind freier Text — bei ?sourceUrl=-Dokumenten sogar die volle
   URL (D23). Zeichen, die auf gängigen Dateisystemen verboten sind, werden zu
   `-`; die Endung `.werkbaum` kommt dazu, wenn nicht schon `.werkbaum` oder
   `.txt` dasteht (D24). Ein leerer Rest fällt auf `plan` zurück. */
export function saveFileName(docName){
  let base = String(docName == null ? '' : docName)
    .replace(/[\u0000-\u001f/\\:*?"<>|]+/g, '-')   /* verbotene Zeichen, auch Pfadtrenner */
    .replace(/-{2,}/g, '-')
    .replace(/^[-. ]+|[-. ]+$/g, '')   /* Ränder: führende Punkte wären versteckte Dateien */
    .trim();
  if(!base) base = 'plan';
  if(/\.(werkbaum|txt)$/i.test(base)) return base;
  return base + '.werkbaum';
}

/* Dialog-Typen der File System Access API (Stufe 2): derselbe Filter wie
   FILE_ACCEPT, in der Form von showOpenFilePicker/showSaveFilePicker. */
export const FILE_TYPES = [
  {description: 'Werkbaum', accept: {'text/plain': ['.werkbaum', '.txt']}},
];
