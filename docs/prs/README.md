# PR-Dokumentation

Jeder Pull Request bekommt hier **eine** Datei.

## Dateiname

`JJJJ-MM-TT-PR#<nummer>-kurze-beschreibung.md`

Die Nummer ist die des Gitea-PR auf <https://git.javagil.de/mi/werkbaum>.
Steht sie noch nicht fest, gilt `PR#000` als Platzhalter — im Dateinamen wie in
den Szenario-IDs — und wird nachgezogen, sobald der PR offen ist.

## Aufbau

Die `##`-Abschnitte in genau dieser Reihenfolge, nicht Zutreffendes weglassen:

1. Das Problem
2. Nicht das Ziel
3. Die Szenarien
4. Die Lösung
5. Offene Fragen
6. Weitere Änderungen
7. Vorausgesetzte PRs
8. Folge-PRs

## Regeln

- Deutsch (CLAUDE.md), Markdown, ein Satz je Zeile, kurz halten.
- Das „Warum“ erklären, nicht nur das „Was“.
- Szenarien in Markdown-eigenem Pseudo-Gherkin mit IDs `Szenario#<pr-nummer>.<nn>`,
  jedes mit einer Liste `##### Nachgewiesen durch`.
- Ein PR-doc beschreibt den Stand **dieses** PR. Ältere PR-docs werden nicht
  nachgepflegt, wenn spätere PRs das Verhalten ändern — dauerhafte Begründungen
  gehören nach `docs/DECISIONS.md`.
