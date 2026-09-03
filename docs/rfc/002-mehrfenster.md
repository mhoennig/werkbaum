# RFC 002 — Mehr-Fenster-Betrieb: PWA und Browser-Tab am selben Speicher

|                                 |                                                                                                                                                              |
|---------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Status                          | **Gebaut und im Browser nachgemessen** (2026-09-02, Branch `rfc-002-mehrfenster`; Fälle 1–8 grün, Fall 9 deckte eine Lücke auf, die geschlossen ist — §10. Offen: die Handarbeit, PWA/Firefox/Safari/ohne Locks) |                                                                  |
| Anlass                          | Fehlerbericht: installierte App und Browser-Tab mit demselben geteilten Dokument ⇒ modaler Dialog in beiden Fenstern, einziger Ausgang „Trotzdem fortfahren“ |
| Plan-Knoten                     | `#ed.docs.windows` in `docs/examples/werkbaum.werkbaum`                                                                                                      |
| Entscheidung                    | D94 in `docs/DECISIONS.md`; revidiert **D89** (Dialog) und schreibt **D83** (Ablageschema) und **D84** (Fremd-Tab-Warnung) fort                              |
| Berührt                         | `frontend/src/docstore.js`, `snapshots.js`, neu `docsync.js`, `app.js` (Speicher, Präsenz, Dialog, Start), i18n ×9, Tests, SPEC §9 (ein Absatz)              |
| Berührt nicht                   | Notation, Backend, Live-Protokoll (D76), Deploy, `llms.md`                                                                                                   |
| Neue Technologie / Abhängigkeit | **keine** — die Web Locks API ist Browser-Bestand, kein Paket                                                                                                |

## 1. Zusammenfassung

Werkbaum darf gleichzeitig als installierte App **und** im Browser-Tab
laufen. Das ist heute faktisch verboten: Ein zweites Fenster bekommt einen
modalen Dialog (D89), dessen einziger Ausgang „Trotzdem fortfahren (nicht
empfohlen)“ ist — und zwar auch in dem Fall, der problemlos funktioniert
(dasselbe **geteilte** Dokument in beiden Fenstern; jedes ist ein eigener
Live-Client, der Server führt zusammen). Zugleich schützt der Dialog nicht
vor dem, wovor er warnt: Hinter der Overlay-Schicht läuft der Start
ungebremst weiter und schreibt.

Der Umbau setzt an der Ursache an, nicht am Dialog. **Kein Fenster schreibt
je den Schlüssel eines anderen**: Text, Meta und frühere Stände liegen je
Dokument unter eigenen Schlüsseln, der Index wird zum bloßen
Reihenfolge-Hinweis und löscht nie mehr; Löschungen hinterlassen einen
Tombstone. Damit kollidieren verschiedene Dokumente in zwei Fenstern **gar
nicht**, und der modale Dialog entfällt. Übrig bleibt genau ein Verlustfall —
dasselbe **nicht geteilte** Dokument in beiden Fenstern vorn —, und den
erkennt eine Sperre je Dokument über die **Web Locks API**, die beim
Schließen des Fensters von selbst fällt. Dort bekommt das zweite Fenster
einen Dialog mit drei echten Auswegen: anderes Dokument öffnen, hier nur
ansehen, trotzdem hier bearbeiten.

## 2. Symptom und Befund

**Symptom (Nutzer):** Werkbaum läuft als PWA mit einem `?live=`-Dokument.
Dieselbe Seite zusätzlich im Browser geöffnet, stellt der Tab das **zuletzt
aktive** Dokument wieder her — genau das geteilte, denn die PWA hat es
zuletzt aktiv gemacht (`werkbaum-active`, letzter Schreiber gewinnt). Sofort
steht in beiden Fenstern der Dialog. „Eigentlich kann man mit demselben
Browser gar nicht PWA und Browser als solches für Werkbaum verwenden.“

**Befund 1 — die Modalität gilt nur für den Benutzer.**
`updateTabModal()` (`frontend/src/app.js`, ~Zeile 146) hängt eine
Overlay-Schicht an `<body>`, sonst nichts. Dahinter laufen:

- `loadDocs()` — liest die Ablage und schreibt bei Migration/Seeding
  (`seedShippedDocs()` setzt `werkbaum-seeded` immer);
- `initDocs()` — ruft `persistDocs()` sofort nach dem Laden;
- `loadActiveIntoEditor()` — stellt das zuletzt aktive Dokument her, bei
  `live:` samt `startLive()` und Änderungs-Feed;
- `setLiveText()` — schreibt jede fremde Feed-Änderung in den Text-Schlüssel;
- der 10-Minuten-Takt (`snapshotNow()`) und `pagehide`/`visibilitychange`
  — schreiben Stände bzw. den **ganzen Index**.

Nichts zu klicken schützt also ebenso wenig wie „Trotzdem fortfahren“.

**Befund 2 — der Index löscht.** `storeDocs()` (`docstore.js`) schreibt den
Index aus der eigenen In-Memory-Liste und **entfernt jeden
`werkbaum-doc:`-Schlüssel, der nicht darin steht** („verwaiste Texte
abräumen“, D83). Ein im anderen Fenster angelegtes Dokument fehlt in dieser
Liste — beim nächsten Voll-Flush (Wechseln, Anlegen, Umbenennen, Verlassen
der Seite, verborgener Tab) ist es nicht nur aus dem Index, sondern **samt
Text gelöscht**. Das ist ein Datenverlust ohne Dialog, ohne Warnung und ohne
Beteiligung des Live-Editings.

**Befund 3 — die Stände genauso.** `persistSnaps()` (`snapshots.js`)
schreibt `{docId: [...]}` **aller** Dokumente unter einen Schlüssel. Der
Flush des einen Fensters wirft die Stände des anderen weg — auch die
Rettungs-Sicherungen aus D89, die gerade dagegen gebaut sind.

**Befund 4 — der Dialog verbietet den Fall, der funktioniert.** Zwei Fenster
auf demselben `live:`-Dokument sind zwei Live-Clients mit eigener
Client-Kennung und laufender Nummer (je Tab im `sessionStorage`,
D76-Nachtrag 7). Der Server führt zusammen (D76); das lokale Abbild ist nur
Cache, `adoptLive()` überschreibt es beim Laden ohnehin mit dem
Server-Stand.

## 3. Was zwischen zwei Fenstern wirklich kollidiert

Ablageschema seit D83, je Schlüssel: wer schreibt, wann, und was bei
Gleichzeitigkeit passiert.

| Schlüssel                                                 | Inhalt                      | schreibt                                                          | Kollision zweier Fenster                           | Verlust                                                                                              |
|-----------------------------------------------------------|-----------------------------|-------------------------------------------------------------------|----------------------------------------------------|------------------------------------------------------------------------------------------------------|
| `werkbaum-doc:<id>`                                       | Text eines Dokuments        | jeder Tastendruck am **aktiven** Dokument; `setLiveText()`; Flush | nur wenn **dasselbe** Dokument in beiden aktiv ist | ja — letzter Tastendruck gewinnt (nicht bei `live:`)                                                 |
| `werkbaum-docs`                                           | Index `[{id,name,source?}]` | jeder Voll-Flush, aus der eigenen Liste                           | immer, sobald die Listen abweichen                 | **ja** — fremde Dokumente werden gelöscht (Befund 2)                                                 |
| `werkbaum-snaps`                                          | Stände **aller** Dokumente  | Takt, Kamera, Rettung, Löschen                                    | immer                                              | **ja** — fremde Stände weg (Befund 3)                                                                |
| `werkbaum-src`                                            | Spiegel des aktiven Texts   | Tastendruck, Flush                                                | immer                                              | nein — nur noch Rollback-Rückfall (D83)                                                              |
| `werkbaum-active`                                         | id des aktiven Dokuments    | Flush                                                             | immer                                              | nein — aber der **Anlass** des Symptoms: das neue Fenster öffnet, was das andere zuletzt aktiv hatte |
| `werkbaum-seeded*`, `werkbaum-seen`, `werkbaum-news-seen` | Merker                      | Laden, Bestätigen                                                 | selten                                             | nein — beide rechnen dasselbe bzw. letzter gewinnt harmlos                                           |
| `werkbaum-ui`, `werkbaum-lang`                            | Ansicht                     | Bedienung                                                         | immer                                              | nein — Zoom/Modus folgen dem letzten Schreiber (App und Tab teilen sie sich, siehe §11)              |
| IndexedDB `handles`                                       | Datei-Handles je id (D72)   | Öffnen/Speichern                                                  | je id                                              | nein — ein Fenster kennt fremde Handles erst nach dem Neuladen (§6.9)                                |
| `sessionStorage` (Client-Id, `seq`)                       | Live-Identität              | —                                                                 | **keine** — je Tab                                 | —                                                                                                    |

Zusammengefasst: **Verschiedene Dokumente kollidieren nur über die beiden
Sammel-Schlüssel** (Index, Stände), und die sind ein Bauartfehler, kein
Bedienfehler. **Dasselbe Dokument** kollidiert am Text — außer bei `live:`,
wo der Server die Wahrheit hält.

## 4. Was am Web-Speicher nicht geht

Die Frage „kann die PWA in einem eigenen Bereich speichern?“ ist mit
**nein** zu beantworten. Web-Speicher ist an den **Ursprung** gebunden
(Schema + Host + Port), nicht an die Darstellungsart: Installierte App und
Browser-Tab desselben Profils teilen `localStorage`, IndexedDB, Cookies,
Cache, Service Worker und BroadcastChannel; es gibt keinen Schalter. Die
Storage-Buckets-API teilt nur *innerhalb* eines Ursprungs auf — beide Seiten
sehen alle Buckets. Echte Trennung gäbe nur ein **anderer Ursprung** (eigene
Subdomain für die App), und dann sind es zwei unabhängige Installationen:
lokale Dokumente, frühere Stände und Datei-Handles wandern nicht mit
(Alternative E, §7).

Erkennen lässt sich die Lage sehr wohl:
`matchMedia('(display-mode: standalone)')` sagt jedem Fenster, ob es die App
oder ein Tab ist. Der Vorschlag **braucht das nicht** — zwei Tabs haben
denselben Fehler, und die Lösung ist von der Darstellungsart unabhängig.
Genutzt wird es nur zur Beschriftung (§6.6: „in der App geöffnet“ statt „in
einem anderen Fenster“).

## 5. Analyse der Lösungsidee

Die Idee aus dem Bericht: (1) den Index vor jedem Flush frisch lesen und
zusammenführen, Waisen nur für selbst gelöschte Dokumente abräumen, Stände
je Dokument zusammenführen, die Liste per `storage`-Ereignis nachziehen;
(2) den modalen Dialog streichen und nur für „dasselbe lokale Dokument“
zurückholen, mit echtem Ausweg.

**Sie trägt in der Richtung und bricht an vier Stellen:**

### 5.1 Lesen + Zusammenführen + Schreiben ist nicht atomar

`localStorage` ist je Fenster synchron, aber zwei Fenster laufen in eigenen
Threads (oft eigenen Prozessen); zwischen `getItem` und `setItem` des einen
kann der andere schreiben. Das Fenster dafür ist klein (Mikrosekunden,
keine `await`s), aber es ist da, und es trifft ausgerechnet die Flush-Punkte
`pagehide` und `visibilitychange`, die in zwei Fenstern **gleichzeitig**
feuern (das Fronten des einen verbirgt das andere — D82 hat das beim Messen
selbst ausgelöst). Eine Sperre um das Zusammenführen (Web Locks) hilft nur
halb: `pagehide` kann nicht auf eine asynchrone Sperre warten.

**Folgerung:** Das Race lässt sich nicht mildern, nur **vermeiden** — indem
es keinen gemeinsamen Schlüssel mehr gibt, den beide schreiben müssen. Je
Dokument eigene Schlüssel, und der Index degradiert zum Hinweis, dessen
Verlust nichts kostet (§6.1).

### 5.2 „Gelöscht“ ist von „nie gesehen“ nicht zu unterscheiden

Fenster A hat `d1` in seiner Liste, im Speicher fehlt der Schlüssel. Zwei
Lesarten: B hat `d1` gelöscht — oder A hat `d1` gerade angelegt und noch
nicht geschrieben. Beim Flush entscheidet das über Anlegen gegen
Wiederbeleben; beim Tastendruck (`storeDocText` schreibt, wenn der Wert
abweicht — `null` weicht immer ab) legt A ein von B gelöschtes Dokument
**still wieder an**. „Nur abräumen, was dieses Fenster gelöscht hat“ ist
die halbe Regel; die andere Hälfte — „nicht wieder anlegen, was ein anderes
gelöscht hat“ — braucht ein Zeichen im Speicher.

**Folgerung:** ein **Tombstone** je gelöschter id, als eigener Schlüssel
(kein gemeinsamer, §5.1), mit Zeitstempel und Verfall (§6.2).

### 5.3 Nachziehen per `storage`-Ereignis trifft das aktive Dokument

Das Ereignis kommt nur in **fremden** Fenstern an und nennt Schlüssel, alten
und neuen Wert — für Liste, Namen und Tombstones ist das die vollständige
Information. Heikel sind drei Fälle am **aktiven** Dokument:

- **anderswo umbenannt:** übernehmen, der Chip folgt (der Text ist
  unberührt).
- **anderswo gelöscht:** Der Text steht noch im Editor, womöglich unter dem
  Cursor. Sofort wegzuschalten zöge Text unter der Schreibmarke weg; ihn
  stumm zu behalten schriebe ihn beim nächsten Tastendruck wieder in den
  Speicher (§5.2). Entschieden: **behalten, warnfarben markiert, bis getippt
  wird** — Tippen ist Absicht (D55-Linie) und legt das Dokument wieder an;
  ohne Tastendruck geht der Text beim nächsten Wechsel in die lokalen
  Sicherungen und das Dokument verschwindet (§6.5).
- **anderswo Text geschrieben:** Das ist der Restfall „dasselbe Dokument in
  beiden Fenstern“ — nicht nachziehen (es überschriebe das Getippte),
  sondern warnen (§6.6).

### 5.4 „Dasselbe lokale Dokument“ ist als Kriterium fast richtig

Der Verlustfall ist „dasselbe Dokument, dessen Wahrheit im **Browser**
liegt“. Das sind lokale Dokumente, **URL-Dokumente** (bearbeitbar seit D78,
Wahrheit ist die URL, lokale Änderungen sind ohnehin flüchtig — aber
innerhalb einer Sitzung genauso verlierbar) und **Datei-Dokumente** (Text im
Browser, Handle in IndexedDB). Ausgenommen sind nur `live:`-Dokumente. Das
Kriterium lautet also **„nicht `live:`“**, nicht „lokal“.

Weitere Verlustfälle, geprüft (§3): Datei-Handles kollidieren nicht am Text,
aber ein Fenster kennt Handles des anderen erst nach dem Neuladen und
überschriebe beim Speichern per Dialog das gemerkte (§6.9 — klein, lösbar).
Seed-Merker, Besuchsstand, Ansichts-Zustand: letzter Schreiber gewinnt,
kein Textverlust. `werkbaum-active`: kein Verlust, aber der Auslöser des
Symptoms — beim Start darf das zuletzt aktive Dokument nicht **still**
geöffnet werden, wenn ein anderes Fenster es hält (§6.4).

## 6. Vorschlag

### 6.1 Ablageschema v3: je Dokument eigene Schlüssel, der Index löscht nie

| Schlüssel                         | Inhalt                                 | Regel                                                                                                                                           |
|-----------------------------------|----------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| `werkbaum-doc:<id>`               | Text                                   | unverändert; schreibt nur das Fenster, in dem das Dokument aktiv ist                                                                            |
| `werkbaum-meta:<id>`              | `{name, source?, born}`                | **neu**; geschrieben beim Anlegen, Umbenennen, Adoptieren (Datei, URL, Server); `born` ordnet Dokumente, die der Index nicht kennt              |
| `werkbaum-snaps:<id>`             | Stände dieses Dokuments `[{t,text},…]` | **neu**, ersetzt `werkbaum-snaps`; schreibt nur das Fenster mit diesem aktiven Dokument (Takt, Kamera, Rettung)                                 |
| `werkbaum-gone:<id>`              | Zeitstempel der Löschung               | **neu**, Tombstone (§6.2)                                                                                                                       |
| `werkbaum-docs`                   | Index `[{id,name,source?}]`            | bleibt als **Reihenfolge-Hinweis** und Rollback-Brücke; wird beim Flush aus `Speicher-ids ∪ eigene Liste` geschrieben; **entfernt nichts mehr** |
| `werkbaum-active`, `werkbaum-src` | wie bisher                             | letzter Schreiber gewinnt, harmlos                                                                                                              |

**Lesen** (`readDocs`): Menge der Dokumente = ids mit `werkbaum-meta:` oder
`werkbaum-doc:`-Schlüssel, vereinigt mit den ids des Index, minus ids mit
Tombstone; Name aus Meta, sonst aus dem Index, sonst die id; Reihenfolge:
Index, danach Nachzügler nach `born`. Ein Index-Eintrag ohne Text und ohne
Meta ist ein Rest und wird ignoriert.

**Schreiben:** Es gibt keinen Voll-Flush mehr, der alles aus der eigenen
Liste schreibt. Jedes Fenster führt eine **Dirty-Menge** (angelegt,
umbenannt, getippt) und schreibt an den Flush-Punkten (D82: Wechseln,
Anlegen, Löschen, Umbenennen, Verlassen der Seite, verborgener Tab) **nur
diese** Dokumente plus den Index-Hinweis. Der Tastendruck bleibt, was er ist
(`storeDocText`). Das ist zugleich weniger Schreibarbeit als heute.

**Migration** (einmalig beim Laden, idempotent): `werkbaum-snaps` in
`werkbaum-snaps:<id>` aufteilen und entfernen; für Dokumente ohne Meta den
Eintrag aus dem Index schreiben. Zwei Fenster, die das gleichzeitig tun,
schreiben identische Werte — harmlos. **Rollback:** Ein Build vor v3 liest
`werkbaum-docs` + Texte wie bisher (der Index wird ja weiter geschrieben);
er sieht die per-Dokument-Stände nicht und räumt mit seinem alten
Orphan-Sweep Texte ab, die nicht in *seinem* Index stehen — der bekannte
Preis, den auch D83 für ein Downgrade genannt hat.

### 6.2 Tombstones

Löschen und Verlassen (`removeDocLocally`) entfernen Text, Meta und Stände
der id und schreiben `werkbaum-gone:<id> = <ms>`. Wer den Tombstone sieht —
beim Laden, im `storage`-Ereignis oder unmittelbar vor einem Schreibvorgang
—, schreibt die id nicht mehr, außer der Benutzer hat ausdrücklich getippt
(§6.5), dann wird der Tombstone entfernt und das Dokument neu angelegt.
Tombstones verfallen nach **7 Tagen** (beim Laden abgeräumt), der Debug-Reset
räumt sie mit. Ein Tombstone je Löschung ist kein gemeinsamer Schlüssel —
das Race aus §5.1 entsteht hier nicht. Die shipped ids (`example`,
`werkbaum`) bekommen ebenso einen Tombstone; das Seeding respektiert
„gelöscht bleibt gelöscht“ ohnehin über die Merker (D27), der Tombstone
schützt nur die Sitzung des anderen Fensters.

### 6.3 Nachziehen im laufenden Fenster (`storage`-Ereignis)

Ein neues Modul **`docsync.js`** (headless, D54-Nachtrag 3) beantwortet als
reine Funktion `applyStorageEvent(docs, activeId, {key, oldValue, newValue})
→ {docs, action}`:

| Ereignis                                             | Wirkung auf die Liste                                                    | `action` am aktiven Dokument |
|------------------------------------------------------|--------------------------------------------------------------------------|------------------------------|
| `werkbaum-meta:<id>` neu                             | Dokument anhängen (Text lazy aus dem Speicher)                           | —                            |
| `werkbaum-meta:<id>` geändert                        | Name/Quelle übernehmen                                                   | `renamed`                    |
| `werkbaum-gone:<id>` neu                             | Dokument aus der Liste, **außer** es ist aktiv                           | `deleted` (§6.5)             |
| `werkbaum-doc:<id>` geändert, id nicht aktiv         | Text für die Vorschau nachziehen                                         | —                            |
| `werkbaum-doc:<id>` geändert, id aktiv, kein `live:` | nichts am Text                                                           | `foreignWrite` (§6.6)        |
| `werkbaum-doc:<id>` geändert, id aktiv, `live:`      | nichts — der Feed ist die Quelle                                         | —                            |
| `werkbaum-snaps:<id>`                                | Stände-Cache der id verwerfen (beim nächsten Öffnen des Menüs neu lesen) | —                            |
| `werkbaum-docs` (Hinweis)                            | Reihenfolge übernehmen                                                   | —                            |

`app.js` wendet das Ergebnis an: Menü neu zeichnen, Chip aktualisieren,
`action` in Beschriftung und Warnung übersetzen. Das Ereignis kommt nicht
gedrosselt — anders als Timer feuert `storage` auch in verborgenen Fenstern
sofort (die Werkzeuggrenze aus D79 betrifft es nicht).

### 6.4 Sperre je Dokument: Web Locks API

Beim Aktivwerden eines **nicht-`live:`**-Dokuments fordert das Fenster
`navigator.locks.request('werkbaum-doc:' + id, {ifAvailable: true}, …)` an
und hält die Sperre, solange das Dokument aktiv ist (die Callback-Promise
bleibt offen; Wechsel löst sie). Eigenschaften, die den Herzschlag über
BroadcastChannel (D89) überflüssig machen:

- **Sie fällt von selbst**, wenn das Fenster schließt oder abstürzt — kein
  `bye`, kein 75-s-Timeout, keine Timer-Drosselung im Hintergrund.
- **Sie ist atomar**: Genau ein Fenster bekommt sie; kein „beide sehen
  einander nicht“.
- **`navigator.locks.query()`** nennt den Halter (Client-Kennung) — genug
  für „ein anderes Fenster hält dieses Dokument“.
- **Der Wartende wird geweckt:** Ein zweiter, wartender `request` (ohne
  `ifAvailable`) löst sich, sobald der Halter loslässt — der Dialog (§6.5)
  verschwindet damit von selbst, wenn das andere Fenster schließt oder das
  Dokument wechselt, wie der D89-Dialog es auch tat.

Unterstützung: Chrome 69, Edge 79, Firefox 96, Safari 15.4 — und `file://`?
Dort gibt es keine Locks (und keinen `storage`-Austausch zwischen Fenstern);
der Rückfall ist der `storage`-Weg aus §6.3: Ein `foreignWrite` am eigenen
aktiven Dokument ist der Beweis, dass ein zweites Fenster darin schreibt —
dann Warnung (§6.6), ohne Dialog. Der Präsenz-Kanal (BroadcastChannel,
`WIN_ID`, `foreignBeats`, `tabModalDismissed`) wird **ersatzlos ausgebaut**.

`live:`-Dokumente werden **nie** gesperrt: Zwei Fenster sind zwei Clients,
der Server führt zusammen. Ein `live:`-Dokument mit toter Sitzung (offline)
schreibt in beiden Fenstern ungesendeten Text in denselben Schlüssel —
letzter gewinnt lokal, aber jedes Fenster hält seine Schattenkopie und
schickt sein Diff, sobald der Server antwortet (D90-Nachtrag), und der
Wachhund rettet Ungesendetes in die Stände. Kein Dialog nötig.

### 6.5 Der Dialog im Restfall, mit drei Auswegen

Bekommt ein Fenster die Sperre nicht (ein anderes hält dasselbe
nicht-`live:`-Dokument), zeigt es einen Dialog **über dem Editor** — das
Textfeld ist bis zur Wahl schreibgeschützt, Diagramm und Menü sind
bedienbar:

1. **Anderes Dokument öffnen** — die Dokumentenliste im Dialog; das
   gewählte wird aktiv, die Sperre dafür wird angefordert.
2. **Hier nur ansehen** — das Dokument bleibt vorn, Textfeld
   schreibgeschützt (`readOnly`), Diagramm voll; das Art-Label sagt
   „nur ansehen — in einem anderen Fenster geöffnet“. Ein Dokumentwechsel
   hebt es auf. Ein wartender `request` läuft im Hintergrund: Lässt das
   andere Fenster los, wird das Textfeld beschreibbar und das Label normal.
3. **Trotzdem hier bearbeiten** — wie heute: beide schreiben, der letzte
   Tastendruck gewinnt im Speicher; die Warnung aus §6.6 steht, solange das
   Dokument aktiv ist. Keine Sperre wird gestohlen (`steal` gäbe es, aber
   ein stiller Entzug beim anderen Fenster wäre der schlechtere Fehler).

**Beim Start** gilt dasselbe: `werkbaum-active` wird zwar wiederhergestellt,
aber ein nicht-`live:`-Dokument, dessen Sperre ein anderes Fenster hält,
öffnet nicht still — der Dialog steht vor dem ersten Tastendruck. Das ist
genau das gemeldete Symptom, mit dem Unterschied, dass der Dialog jetzt nur
im Verlustfall erscheint und drei Ausgänge hat.

**Aktives Dokument anderswo gelöscht** (§5.3): kein Dialog. Das Art-Label
wechselt warnfarben auf „anderswo gelöscht“, der Editor bleibt. Der nächste
Tastendruck legt Meta und Text neu an und entfernt den Tombstone; ein
Dokumentwechsel ohne Tastendruck legt den Text in die lokalen Sicherungen
(`rescueSnapshot`, unter der alten id — sichtbar im Uhr-Menü, solange die
Sitzung lebt) und lässt das Dokument gehen.

### 6.6 Die zeilenlose Warnung (D84), umformuliert und eingegrenzt

`tabConflict` erscheint **nur noch im Restfall**: wenn dasselbe
nicht-`live:`-Dokument anderswo bearbeitet wird — nach „Trotzdem
bearbeiten“, im Rückfall ohne Locks bei `foreignWrite`, und nennt das
Dokument: „‚Plan X‘ wird in einem anderen Fenster bearbeitet — der letzte
Tastendruck gewinnt.“ Läuft das andere Fenster als installierte App
(`display-mode: standalone` ist nicht über Fenstergrenzen abfragbar, aber
das eigene Fenster kennt seine Art), sagt der Text „in der App“ bzw. „im
Browser“ aus der eigenen Sicht. Verschiedene Dokumente in zwei Fenstern
sind **still** — dort kollidiert nichts mehr, und eine Warnung ohne Gefahr
lehrt, Warnungen zu übersehen (der D89-Vorfall in Umkehrung). Die Warnung
räumt sich ab, sobald das Dokument wechselt oder die Sperre doch noch
kommt.

### 6.7 Was aus den D89-Netzen wird

| D89-Netz                                | danach                                                                                                                                         |
|-----------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| Modaler Zwei-Fenster-Dialog             | **entfällt**; ersetzt durch den Sperren-Dialog im Restfall (§6.5)                                                                              |
| Lokale Sicherungen für Server-Dokumente | bleiben, jetzt je Dokument unter eigenem Schlüssel — und damit vor dem Flush des anderen Fensters **sicher** (§3, Befund 3 hob sie bisher auf) |
| Rettung ungesendeten Texts              | bleibt unverändert                                                                                                                             |
| Wachhund `liveUnsent`/`liveEnded`       | bleibt unverändert                                                                                                                             |

### 6.8 Frühere Stände unter Quota-Druck

`dropOldestSnap()` (D54) wirft bei vollem Speicher den ältesten Stand
**über alle Dokumente** weg. Mit Schlüsseln je Dokument heißt das: das
Fenster räumt im Notfall auch Stände fremder Dokumente ab — der einzige
Fall, in dem ein Fenster einen fremden Schlüssel anfasst. Bewusst so
belassen: Dokumente sind wichtiger als Stände (D54), und ein voller Speicher
ist ein Notfall, kein Alltag. Die Warnung `storeFailed` (D82) bleibt.

### 6.9 Datei-Handles (IndexedDB)

Handles liegen je Dokument-id (D72) und kollidieren nicht. Lücke: Fenster A
öffnet eine Datei (Handle in IDB), Fenster B erfährt vom neuen Dokument per
`storage`, hat das Handle aber nicht in seiner Map — beim Speichern in B
käme der Dialog und überschriebe das Handle. Behebung: Bei `meta` neu und
bei `deleted` das Handle der id **lazy** aus IDB nachladen bzw. verwerfen
(`idbLoadHandle(id)`, eine Ergänzung der vorhandenen Helfer). Klein, aber
ohne sie wäre „dieselbe Datei landet im selben Dokument“ (D73) über
Fenstergrenzen hinweg gebrochen.

### 6.10 Was der Start tut, in Reihenfolge

1. `readDocs()` (v3-Lesen), Migration, Tombstones altern.
2. `werkbaum-active` wiederherstellen; ist es `live:` → wie heute
   (`startLive`); sonst Sperre anfordern (`ifAvailable`).
3. Sperre da → Editor beschreibbar; Sperre nicht da → Dialog §6.5, Editor
   schreibgeschützt bis zur Wahl.
4. `storage`-Handler registrieren (vor dem ersten Flush, sonst verpasst das
   Fenster, was der andere währenddessen schreibt).
5. Kein `persistDocs()` mehr nach dem Laden — nur die Migration schreibt,
   und nur, was fehlt.

## 7. Alternativen

|       | Weg                                                                                                                          | Preis                                                                                                                                                                                                                                                                           |
|-------|------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **A** | **Nichts tun, den Dialog ehrlicher beschriften** („dasselbe Dokument in beiden Fenstern verliert; verschiedene meist nicht“) | Behebt Befund 2 und 3 **nicht** — Dokumente und Stände gehen weiter an Flushes verloren, unabhängig vom Dialog. Der Dialog bliebe modal in dem Fall, der funktioniert. Verworfen.                                                                                               |
| **B** | **Index behalten, vor dem Flush lesen und zusammenführen** (die Lösungsidee, Punkt 1 wörtlich)                               | Kleinerer Umbau; das Race (§5.1) bleibt und trifft genau die gleichzeitigen Flush-Punkte; Tombstone trotzdem nötig. Verworfen zugunsten von D.                                                                                                                                  |
| **C** | **Ein Fenster schreibt, alle anderen lesen** — globale Sperre (Web Locks `werkbaum`), die übrigen Fenster schreibgeschützt   | Erkennt auch Fälle, die es nicht gibt (verschiedene Dokumente); zwingt den Nutzerfall (App und Tab am selben geteilten Dokument arbeiten) in Lesemodus; braucht den Schreibschutz-Modus zurück, der in D78 ausgebaut wurde. Verworfen.                                          |
| **D** | **Je Dokument eigene Schlüssel + Tombstones + Sperre je Dokument + Dialog mit Auswegen** (§6)                                | Schema-Änderung (D83 fortschreiben) mit Migration; neues Modul; i18n-Texte ×9; der Rückfall ohne Locks ist warnungs-, nicht dialoggestützt. **Gewählt.**                                                                                                                        |
| **E** | **Eigene Subdomain für die PWA**                                                                                             | Echte Trennung, aber zwei Installationen: lokale Dokumente, Stände, Handles wandern nicht; zwei Service Worker, Apache-Konfiguration, ein zweites Manifest; und derselbe Fehler bleibt für zwei Tabs. Verworfen.                                                                |
| **F** | **Ablage ins Backend verlegen** (lokale Dokumente werden Server-Dokumente je Nutzer)                                         | Die Richtung, die D22 vorsieht („Platzhalter bis zum Backend“), braucht aber Konten oder das Owner-Passwort (`#col.live.owner`) und eine Offline-Geschichte — kein Bugfix, ein Produktschritt. Nicht verworfen, nur nicht hier.                                                 |
| **G** | **IndexedDB statt localStorage** (Transaktionen machen Lesen-Zusammenführen-Schreiben atomar)                                | Umbau des synchronen Ladepfads (D83 hat es aus demselben Grund abgelehnt); löst Befund 2 nicht von selbst (der Sweep wäre auch in einer Transaktion falsch). Verworfen.                                                                                                         |
| **H** | **Das zweite Fenster tritt zugunsten der App zurück** (Tab erkennt `standalone`-Peer, bietet „in der App öffnen“)            | Aus einem Tab lässt sich die installierte App nicht zuverlässig fokussieren (`launch_handler` gilt für Link-Capturing, nicht für Skripte); setzt die App als primär, der Nutzer will ausdrücklich beide. Verworfen; D90-Nachtrag notierte dieselbe Grenze für `window.close()`. |

## 8. Empfehlung

**D**, aus drei Gründen, die unabhängig voneinander tragen:

1. **Es behebt den Datenverlust, den niemand gemeldet hat.** Befund 2 und 3
   sind Bauartfehler der Sammel-Schlüssel und wirken bei jedem Flush zweier
   Fenster — auch bei zwei gewöhnlichen Tabs, auch ohne PWA, auch ohne
   Live-Editing. Nur D und F beseitigen sie; F ist kein Bugfix.
2. **Es verkleinert das Problem, statt es zu verwalten.** Mit getrennten
   Schlüsseln bleibt genau ein Verlustfall, und der ist mit einem
   Browser-Bestandsmittel atomar erkennbar. Alles, was D89 mit Herzschlag,
   Timeout, Notluke-je-Fenster und Timer-Drossel ausbalancieren musste,
   entfällt — die Sperre fällt von selbst, und `storage` ist ungedrosselt.
3. **Es hält die D89-Zusagen.** Ungesendetes bleibt laut und wird gerettet;
   die lokalen Sicherungen werden erst durch das neue Schema wirklich
   fensterfest.

Preis, benannt: eine dritte Fassung des Ablageschemas innerhalb weniger
Wochen (D82 → D83 → v3), mit Migration und Rollback-Preis; ein neuer
Dialog mit drei Auswegen und rund acht neuen i18n-Schlüsseln ×9 Sprachen;
und ein Rückfall für Umgebungen ohne Web Locks, der nur warnt.

## 9. Impact auf den bestehenden Code

| Datei                                      | Änderung                                                                                                                                                                                                                                                                                                                                                                                                                                            |
|--------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `frontend/src/docstore.js`                 | Schema v3: `readDocs` liest Meta ∪ Index ∪ Texte minus Tombstones; `storeDocs` (Voll-Flush mit Sweep) **entfällt**, ersetzt durch `writeDoc(storage, doc)`, `writeIndexHint(storage, ids)`, `removeDoc(storage, id, now)` (Tombstone), `expireTombstones(storage, now)`; `isDocKey` kennt `meta`/`gone`/`snaps:`; Migration `migrateV3(storage)`                                                                                                    |
| `frontend/src/snapshots.js`                | `LS_SNAPS` → Präfix `werkbaum-snaps:`; `persistSnaps(id, list, store)` je Dokument; `dropOldestSnap` iteriert über die Schlüssel; `parseSnaps` je Liste                                                                                                                                                                                                                                                                                             |
| `frontend/src/docsync.js` (**neu**)        | `applyStorageEvent()` (§6.3), `lockDecision()` (welche Dokumente gesperrt werden: nicht `live:`), Tombstone-Alter, Dirty-Menge — headless, getestet                                                                                                                                                                                                                                                                                                 |
| `frontend/src/app.js`                      | Präsenz-Kanal, `WIN_ID`, `foreignBeats`, `tabModalDismissed`, `updateTabModal` **raus**; `persistDocs` → Dirty-Flush; `storage`-Handler wendet `docsync` an; Sperre anfordern/halten/lösen in `loadActiveIntoEditor`/`switchDoc`/`removeDocLocally`; Dialog §6.5; `readOnly`-Zustand „nur ansehen“; Art-Label-Zustände (§6.5/6.6, D90-Muster); Start-Reihenfolge §6.10; Debug-Reset räumt `gone:`/`meta:`/`snaps:`; `initDocs` ohne `persistDocs()` |
| `frontend/src/app.js` (I18N)               | `tabModalTitle/Text/Force` **raus**; neu `docLockTitle`, `docLockText`, `docLockOpenOther`, `docLockViewOnly`, `docLockEditAnyway`, `docKindViewOnly`, `docKindGoneElsewhere`, `tabConflictWarn` umformuliert (mit `{name}`, App/Browser) — deutsch zuerst, ×9                                                                                                                                                                                      |
| `frontend/src/style.css`                   | `.tabmodal*` → Dialog mit Liste und drei Knöpfen; `readOnly`-Optik des Textfelds                                                                                                                                                                                                                                                                                                                                                                    |
| `frontend/tests/docstore.test.js`          | umschreiben auf v3 (Union-Lesen, kein Sweep, Tombstone, Migration, Rollback-Lesbarkeit des Index)                                                                                                                                                                                                                                                                                                                                                   |
| `frontend/tests/snapshots.test.js`         | je-Dokument-Schlüssel, Quota-Verdrängung über Schlüssel                                                                                                                                                                                                                                                                                                                                                                                             |
| `frontend/tests/docsync.test.js` (**neu**) | Ereignis-Matrix §6.3, Sperr-Entscheidung, Tombstone-Verfall, Dirty-Flush schreibt nur Eigenes                                                                                                                                                                                                                                                                                                                                                       |
| `docs/SPEC.md` §9                          | Absatz „Ein zweites Werkbaum-Fenster desselben Browsers“ ersetzen: Fenster kollidieren nur am selben nicht geteilten Dokument; Sperre, Dialog mit drei Auswegen, Warnung                                                                                                                                                                                                                                                                            |
| `docs/DECISIONS.md`                        | D94 (dieser Umbau), Nachtrag an D89 (revidiert), Verweise in D83/D84 sind über D94 erreichbar                                                                                                                                                                                                                                                                                                                                                       |
| `docs/CHANGELOG.md`                        | je Änderung eine Zeile (Schema, Dialog, Sperre, Warnung)                                                                                                                                                                                                                                                                                                                                                                                            |
| `docs/examples/werkbaum.werkbaum`          | `#ed.docs.windows` mit Teilpaketen; Kommentar an `#col.live.safe`                                                                                                                                                                                                                                                                                                                                                                                   |
| Backend, Deploy, `llms.md`, SPEC §1–8      | unberührt                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## 10. Was gemessen werden muss, bevor es als erledigt gilt

**Headless (Vitest), die Regeln:** Union-Lesen mit und ohne Meta, mit
Tombstone; kein Schlüssel eines fremden Dokuments wird durch einen Flush
geschrieben oder entfernt (Zähler auf `setItem`/`removeItem` je Schlüssel);
Tombstone blockiert Wiederanlegen, Tippen hebt ihn auf, Verfall nach 7
Tagen; `applyStorageEvent`-Matrix (§6.3) inklusive der drei Fälle am aktiven
Dokument; Sperr-Entscheidung (`live:` nie); Migration idempotent (zweimal
laufen = einmal laufen); Stände-Verdrängung über Schlüssel. Gegenproben per
Mutation wie üblich: Sweep zurückbauen ⇒ genau der danach benannte Test
fällt.

**Im Browser, zwei echte Tabs** (Automation kann zwei Tabs auf demselben
Ursprung öffnen; `storage`-Ereignisse und Web Locks arbeiten unabhängig von
der Sichtbarkeit):

1. B legt ein Dokument an → A wechselt das Dokument (Flush) → B's Dokument
   existiert weiter, Text intakt. **Das ist der Test für Befund 2** und
   heute nachweislich rot.
2. Kamera in A auf Dokument X, Kamera in B auf Dokument Y → beide Stände da
   (Befund 3).
3. B löscht A's aktives Dokument → A zeigt „anderswo gelöscht“, Editor
   bleibt; Tastendruck in A → Dokument wieder da, Tombstone weg; ohne
   Tastendruck Wechsel → Text in A's Sicherungen, Dokument weg.
4. B benennt A's aktives Dokument um → A's Chip folgt, Text unverändert.
5. Dasselbe lokale Dokument: A hält es, B öffnet es → Dialog in B, A
   unberührt; B „nur ansehen“ → `readOnly`; A wechselt weg → B wird
   beschreibbar von selbst; „trotzdem“ → Warnung mit Namen, beide tippen,
   letzter gewinnt im Speicher (der bekannte Rest).
6. Dasselbe `live:`-Dokument in A und B → **kein** Dialog, beide tippen,
   Server-Version steigt, beide sehen beides (Feed nur mit gestellter
   Sichtbarkeit, D76-Nachtrag 7).
7. Start mit `werkbaum-active` = ein von A gehaltenes lokales Dokument →
   Dialog vor dem ersten Tastendruck; = A's `live:`-Dokument → kein Dialog
   (das gemeldete Symptom).
8. Quota (gestelltes `setItem`): Stände weichen, Dokumente bleiben,
   `storeFailed` erscheint und verschwindet.
9. Rollback-Probe: Speicher aus v3 mit einem Build vor v3 laden → alle
   Dokumente sichtbar.

**Von Hand, weil nicht automatisierbar:** installierte PWA + Tab in
Chromium (Symptom-Nachstellung 1:1: geteiltes Dokument in beiden — kein
Dialog); Firefox und Safari je zwei Fenster (Web-Locks-Verhalten, Firefox
≥ 96, Safari ≥ 15.4); ein Browser ohne Locks (Rückfall: nur Warnung).

**Werkzeuggrenzen, benannt:** Der Automatisierungs-Tab meldet sich dauerhaft
als `document.hidden` und drosselt Timer verborgener Fenster auf einen Tick
je Minute — der 10-Minuten-Takt und der Wachhund sind dort nicht zu messen,
Flush-Punkte werden per gestelltem `visibilitychange` ausgelöst (D82). Das
Fronten des zweiten Tabs löst im ersten den Sichtbarkeits-Flush aus — beim
Inszenieren von Speicherzuständen erst alle alten Tabs schließen (D83).
`window.confirm` lässt sich in der isolierten Welt des Prüf-Panes nicht
stubben (D91-Nachtrag 9) — Löschen wird über die Ablage selbst inszeniert.
Eine echte PWA-Installation lässt sich nicht automatisieren (D73).

### Ergebnis der Nachmessung (2026-09-02)

Zwei echte Tabs auf `localhost:8137`, Fall 6 gegen ein lokal laufendes
Backend. **Grün: 1 bis 8.** Im Einzelnen — Fall 1: A sieht B's neues Dokument
ohne Neuladen, und nach A's Dokumentwechsel samt `visibilitychange`/
`pagehide` sind dessen Text **und** Meta unangetastet; Fall 2: beide
Kamera-Stände liegen nebeneinander, B's Flush lässt A's stehen; Fall 3: Chip
„deleted elsewhere", Editor behält seine 221 Knoten, Tastendruck holt
Dokument und Tombstone zurück, der Wechsel ohne Tastendruck legt den Text
(68 791 Zeichen) in `werkbaum-snaps:werkbaum`; Fall 4: der Chip folgt der
fremden Umbenennung, der Text bleibt; Fall 5: Dialog nur im zweiten Fenster,
„nur ansehen" setzt `readOnly`, und als das erste Fenster wegwechselte, wurde
das zweite **von selbst** beschreibbar — „trotzdem" nennt Dokument und
Fensterart in beiden Fenstern; Fall 6 und 7: dasselbe `live:`-Dokument in
beiden Fenstern gibt **keinen** Dialog, auch beim Start (das gemeldete
Symptom), beide schreiben, der Server zählt von 2 auf 4 und behält beide
Zeilen; Fall 8: mit wirklich voller Quota (kein Stub) steht `storeFailed`,
die Dokumente bleiben unangetastet, die Stände weichen 4 → 0, und der nächste
gelungene Schreibvorgang räumt die Warnung.

**Gegenprobe im Vor-v3-Build gezogen** (git-Worktree am Commit davor, eigener
Dev-Server): Dort ist Fall 1 nachweislich rot — B legt ein Dokument an, A
wechselt das Dokument, und B's Text ist weg (`werkbaum-doc:… = null`, Eintrag
aus dem Index entfernt). Genau Befund 2.

**Fall 9 hat eine Lücke aufgedeckt, die jetzt geschlossen ist.** Alles, was
der Index kennt, ist im alten Build sichtbar — ein Dokument, das gerade nur
an `werkbaum-meta:<id>` und `werkbaum-doc:<id>` hängt, aber nicht im Index
steht, ist dort jedoch nicht nur unsichtbar: Dessen Voll-Flush **löscht**
seinen Text-Schlüssel. Das Fenster dafür ist schmal, weil `indexHint()` die
Speicher-Schlüssel mitliest und sich damit bei jedem Flush selbst heilt —
aber es gab eine Stelle, die es regelmäßig öffnete: `reviveGoneDoc()`
(§6.5) schrieb Meta und Text und **nicht** den Index-Hinweis. Ein anderswo
gelöschtes und hier durch Tippen wiederbelebtes Dokument hing also bis zum
nächsten Flush-Punkt allein an seinen eigenen Schlüsseln. Die Funktion
schreibt den Hinweis jetzt mit. Nachgemessen im Browser: Index nach dem
Tastendruck sofort wieder vollständig; Gegenprobe per Mutation — ohne die
Zeile bleibt der Index ohne das Dokument, während Meta und Text dastehen.

**Zwei Beobachtungen ohne Handlungsbedarf.** Fügen zwei Fenster gleichzeitig
an derselben Stelle eines geteilten Dokuments ein, kann die Zeilenreihenfolge
im Editor kurz von der des Servers abweichen; der nächste Push gleicht sie an,
verloren geht nichts. Und die **Feed-Hälfte** von Fall 6 („beide sehen beides
ohne Neuladen") ist in dieser Umgebung nicht messbar — der Automatisierungs-
Tab ist dauerhaft `hidden`, der Feed ruht dort planmäßig (D76-Nachtrag 1);
gemessen ist stattdessen, dass B A's Zeile über die Antwort auf den eigenen
PATCH bekam. Getippt wurde durchweg per `value` + `input`-Ereignis, weil die
Browser-Fläche verborgen war und echte Tastendrücke nicht ankommen
(D91-Nachtrag 8).

**Offen bleibt die Handarbeit** aus dem Absatz oben: installierte PWA + Tab,
Firefox, Safari, ein Browser ohne Locks-API.

## 11. Abgrenzung — was nicht gebaut wird

| Nicht gebaut                                                                                          | Warum                                                                                                                  |
|-------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| Sperre stehlen (`steal`) oder eine „Übergabe“ zwischen Fenstern (D90-Nachtrag)                        | Ein stiller Entzug ist der schlechtere Fehler; die Übergabe bleibt eine eigene Entscheidung über Mehr-Fenster-Semantik |
| Nachziehen des aktiven Texts aus dem anderen Fenster (Zwei-Fenster-Zusammenführung lokaler Dokumente) | Das wäre Live-Editing ohne Server; wer das will, teilt das Dokument (`?live=`)                                         |
| Getrennte Ansichts-Einstellungen für App und Tab (`werkbaum-ui` je `display-mode`)                    | Kein Verlust, nur Komfort; eigener kleiner Schritt, wenn er jemanden stört                                             |
| Eigene Subdomain, IndexedDB-Umbau, Ablage im Backend                                                  | Alternativen E/G/F, §7                                                                                                 |
| Präsenz-Anzeige („Fenster 2 hat Plan Y offen“)                                                        | `navigator.locks.query()` gäbe es her; ohne Bedienbedarf ist es Rauschen                                               |
| Lesemodus als allgemeines Feature                                                                     | „Nur ansehen“ ist ein Zustand des Dialogs, kein Schalter (D78 hat den Schreibschutz-Modus bewusst ausgebaut)           |

## 12. Umsetzungsreihenfolge

1. **Schema v3 + Tombstones** (`docstore.js`, `snapshots.js`, Migration,
   Tests) und der Dirty-Flush in `app.js` — behebt Befund 2 und 3 für sich
   allein; der D89-Dialog bleibt in diesem Schritt noch stehen.
2. **`docsync.js` + `storage`-Handler**: Liste, Namen, Tombstones im
   laufenden Fenster; „anderswo gelöscht“-Zustand; Handle-Nachladen (§6.9).
3. **Web Locks + Dialog + Warnung**: Präsenz-Kanal und modaler Dialog raus,
   Sperre je Dokument, Dialog mit drei Auswegen, `readOnly`-Zustand,
   `tabConflict` umformuliert; Start-Reihenfolge §6.10.
4. **SPEC §9, D94, D89-Nachtrag, CHANGELOG, Plan-Knoten** — je Schritt
   nachgezogen, nicht am Ende gesammelt.

Jeder Schritt ist für sich deploybar und lässt den Stand nicht schlechter
zurück als heute.

## 13. Entscheidungen (Multiple-Choice-Runde, 2026-09-02)

| Frage                              | Entschieden                                     | Verworfen                                             |
|------------------------------------|-------------------------------------------------|-------------------------------------------------------|
| Ablageschema                       | je Dokument eigene Schlüssel, Index nur Hinweis | Index zusammenführen (Race bleibt); offen halten      |
| „Gelöscht“ erkennen                | Tombstone-Schlüssel je id, 7 Tage               | kein Tombstone (Löschen wirkungslos beim Race); offen |
| Restfall erkennen                  | Web Locks je Dokument, Rückfall `storage`       | Präsenz-Kanal mit aktiver id; ein Schreiber für alle  |
| Ausweg im Restfall                 | Dialog: anderes öffnen / nur ansehen / trotzdem | nur Warnung; automatisch anderes öffnen               |
| Aktives Dokument anderswo gelöscht | behalten bis Tastendruck, dann wieder anlegen   | sofort wechseln und sichern                           |
| D84-Warnung                        | nur im Restfall, nennt das Dokument             | ganz weg                                              |
| Plan-Knoten                        | `#ed.docs.windows`                              | unter `#col.live.safe`, unter `#bld.pwa`              |

## 14. Revisionsgeschichte

- 2026-09-02 — erste Fassung aus dem Fehlerbericht; sieben Fragen
  entschieden; RFC, Plan-Knoten und D94 in einem Commit. Nichts gebaut.
- 2026-09-02 — gebaut in vier Schritten (§12): Schema v3 + Tombstones +
  Dirty-Flush; `docsync.js` + storage-Handler; Web Locks + Dialog + Warnung;
  Dokumentation. Headless 666 Tests grün, Gegenprobe per Mutation gezogen;
  die Browser-Nachmessungen (§10) standen noch aus.
- 2026-09-02 — im Browser nachgemessen (§10): Fälle 1–8 grün, Fall 1 im
  Vor-v3-Build gegengeprüft und dort rot. Fall 9 deckte auf, dass
  `reviveGoneDoc()` den Index-Hinweis nicht mitschrieb — behoben, Gegenprobe
  per Mutation gezogen. Offen bleibt die Handarbeit: PWA neben Tab, Firefox,
  Safari, ein Browser ohne Locks-API.
