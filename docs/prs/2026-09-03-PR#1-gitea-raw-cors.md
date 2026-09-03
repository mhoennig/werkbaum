> **Hinweis:** Dieses Dokument beschreibt nur die Änderung dieses PR.
> Es kann veraltet sein, sobald der nächste PR gemergt ist.
> Historische PR-Dokumentation wird nicht nachgepflegt — sie ist eine Momentaufnahme, keine aktuelle Doku.

## Das Problem

Die Beispiel-Links beider READMEs laden ihren Plan per `?sourceUrl=` aus einer Textdatei im Netz (D23).
Der Browser holt eine fremde Herkunft nur, wenn die Antwort `Access-Control-Allow-Origin` trägt.
`raw.githubusercontent.com` sendet den Header, `git.javagil.de` sendete ihn nicht.
Deshalb mussten die Links nach dem Umzug nach Gitea (D95) weiterhin auf den GitHub-Klon zeigen, obwohl das Repository dort gar nicht mehr zuhause ist.

Gemessen am 2026-09-03, mit `Origin:`-Header: HTTP 200, `Access-Control-Expose-Headers: Content-Disposition`, `Content-Type: text/plain; charset=utf-8` — aber kein `Access-Control-Allow-Origin`.
Die Datei selbst war also einwandfrei erreichbar; es fehlte genau ein Header.

## Nicht das Ziel

- Der GitHub-Klon verschwindet nicht: die GitHub-Pages-Instanz (D16) hängt weiter daran, sie ist ein Actions-Workflow und lässt sich nicht mitnehmen.
- Kein Proxy-Dienst als Ausweg — D23 verwirft ihn ausdrücklich, weil er fremde Inhalte über einen Dritt-Host leiten würde.
- Keine Änderung am Frontend: `sourceUrl` bleibt, wie es ist; der Fehler lag ausschließlich auf der Serverseite.

## Die Szenarien

### Feature: Beispiel-Pläne laden aus dem eigenen Gitea

#### Hintergrund

- Die Konfiguration liegt beim Unix-Benutzer `mih09-git` auf mih09 und in **keinem** Repository; sie ist im Wortlaut in D96 festgehalten.
- Giteas eigener `[cors]`-Abschnitt und die `.htaccess` der Domain teilen sich die Arbeit: die API-Route deckt Gitea ab, die Web-Route der Apache davor.

#### Szenario#1.01: Ein Beispiel-Link öffnet den Plan statt eines CORS-Fehlers

Damit die Links auf `origin` zeigen können und nicht auf einen Klon.

- **Gegeben** ein Beispiel-Link mit `?sourceUrl=https://git.javagil.de/mi/werkbaum/raw/branch/main/…`
- **Wenn** der Browser die Datei aus der fremden Herkunft holt
- **Dann** trägt die Antwort `Access-Control-Allow-Origin: *` und der Plan wird geöffnet

##### Nachgewiesen durch

- Messung 2026-09-03 auf allen fünf Beispieldateien: je HTTP 200 mit genau einem `Access-Control-Allow-Origin: *`.

#### Szenario#1.02: Die API-Route trägt den Header genau einmal

Damit die Antwort gültig bleibt — zwei `Access-Control-Allow-Origin`-Header verwirft der Browser als ungültig.

- **Gegeben** Gitea setzt den Header auf `/api/v1/…` bereits selbst
- **Wenn** die `.htaccess` diese Route nicht mitfasst
- **Dann** steht in der Antwort genau ein `Access-Control-Allow-Origin: *`

##### Nachgewiesen durch

- Messung 2026-09-03: `/api/v1/repos/mi/werkdock/raw/README.md` → ein Header (zuvor, mit der ersten Fassung der `.htaccess`, waren es zwei).

#### Szenario#1.03: Gewöhnliche Repo-Seiten bleiben unberührt

Damit der Header nur dort steht, wo er gebraucht wird, und nicht site-weit.

- **Gegeben** eine gewöhnliche Seite wie `/mi/werkdock`
- **Wenn** sie abgerufen wird
- **Dann** trägt die Antwort keinen `Access-Control-Allow-Origin`

##### Nachgewiesen durch

- Messung 2026-09-03: `/mi/werkdock` → HTTP 200, null `Access-Control-Allow-Origin`-Header.

## Die Lösung

Auf mih09, beim Benutzer `mih09-git` (Sicherungskopien mit Zeitstempel liegen jeweils daneben):

- `gitea/custom/conf/app.ini` bekommt einen `[cors]`-Abschnitt (`ENABLED = true`, `ALLOW_DOMAIN = *`, `METHODS = GET,HEAD`); Gitea neu gestartet.
- `doms/git.javagil.de/htdocs-ssl/.htaccess` bekommt `SetEnvIf Request_URI "^/[^/]+/[^/]+/(raw|media)/"` plus `Header always set Access-Control-Allow-Origin "*" env=…`, vor den vorhandenen Proxy-Regeln.

Im Repository:

- Die Beispiel-Links beider READMEs zeigen auf `git.javagil.de/mi/werkbaum/raw/branch/main/…`.
- Die CORS-Einschränkung in beiden READMEs und in D23 nennt `git.javagil.de` jetzt unter den Hosts, die den Header senden.
- Der Absatz „GitHub bleibt ein Klon“ nennt nur noch GitHub Pages als Grund; D95 bekommt einen Nachtrag, D96 hält die Konfiguration im Wortlaut fest.

Warum die Aufteilung auf zwei Stellen: Gitea 1.27 legt die CORS-Middleware nur auf `/api/v1`, nicht auf die Web-raw-Route — und genau die benutzen die Links.
Warum `SetEnvIf` statt `<LocationMatch>`: Location-Direktiven sind in einer `.htaccess` nicht erlaubt, und auf einem Managed Webspace gibt es nur `.htaccess`.
Warum `*` ohne Credentials: unter einem Wildcard-Ursprung sendet der Browser keine Cookies, ein fremder Ursprung liest also nur, was ohnehin anonym abrufbar ist; private Repositories antworten weiter mit 404/403.

## Offene Fragen

- Keine. Beide Fallen (verbotenes `<LocationMatch>`, doppelter Header) sind beim Umsetzen aufgetreten und behoben; die Messungen decken Web-raw, API-raw und eine gewöhnliche Seite ab.

## Weitere Änderungen

- Der Link „Werkbaum selbst“ war schon vorher tot: er zeigte auf `example-werkbaum.werkbaum`, die Datei heißt `werkbaum.werkbaum` — auch auf GitHub lieferte er 404. Beim Umstellen mit korrigiert.
- `docs/prs/` samt Konvention neu eingeführt; `CLAUDE.md` verweist darauf.

## Vorausgesetzte PRs

- Keine; setzt den Umzug nach Gitea (D95) voraus, der bereits auf `main` liegt.

## Folge-PRs

- Keine geplant.
