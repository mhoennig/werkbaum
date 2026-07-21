# Werkbaum — Marke

Leitidee: Die Marke ist aus den Strichen der Notation gebaut —
**durchgezogen = und**, **gestrichelt = oder**. Das Zeichen ist eine Miniatur
des Diagramms; es existiert in zwei Orientierungen, analog zu den beiden
Darstellungsmodi des Produkts.

## Dateien (`brand/`)

| Datei | Zweck |
|---|---|
| `logo.svg` | Primärzeichen, Hochformat (Variante A), helle Flächen |
| `logo-dark.svg` | Primärzeichen für dunkle Flächen |
| `logo-quer.svg` | Sekundärzeichen, transponiert (Variante B), für breite/niedrige Flächen (Header-Leisten, Banner) |
| `logo-quer-dark.svg` | Sekundärzeichen für dunkle Flächen |
| `favicon.svg` | vereinfachte Zwei-Ebenen-Form für 16–32 px |

Design-Herleitung und Alternativen: `docs/design/logo-konzepte.html` und
`docs/design/logo-k2-varianten.html`.

## Farben

- Tinte `#243447`, Petrol `#0F766E` (Oder-Anteile).
- Auf dunklem Grund: Papier `#F3F6F9`, Petrol hell `#45C4B4`.
- Die Pastelltöne des Produkts sind **Statusfarben** und erscheinen nie im Logo.
- Einfarbige Variante: alles in Tinte; die Strichelung bleibt erhalten.

## Wortbild

- IBM Plex Sans SemiBold, Zweiteilung: **Werk** (Tinte) + **baum** (Petrol),
  letter-spacing −0.02em.
- CLI/npm/Code-Kontexte: konsequent kleingeschrieben `werkbaum`
  (IBM Plex Mono).

## Regeln

- Gestrichelte Anteile behalten Richtung und Strichmuster; nichts rotieren.
- Unter 24 px immer `favicon.svg` verwenden, nie das Primärzeichen verkleinern.
- Schutzraum: mindestens die Höhe des Wurzel-Kästchens rundum.
