# language: de
Funktionalität: Gemeinsam am selben Dokument arbeiten
  Als mehrere Bearbeiter eines Plans
  möchte ich Änderungen als Zeilen-Diff einreichen,
  damit niemand den Text der anderen überschreibt und nichts neu geladen
  werden muss.

  Grundlage: Jede Änderung ist ein Diff gegen eine Basisversion. Ist die Basis
  veraltet, verschiebt der Server sie selbst — abgelehnt wird nur, was sich
  wirklich überschneidet.

  Szenario: Eine Änderung auf aktueller Basis wird angewendet
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      - [ ] Zwei
      - [ ] Drei
      """
    Wenn Client "anna" folgendes Diff einreicht:
      """
      [{"op":"replace","index":1,"count":1,"lines":["- [x] Zwei"]}]
      """
    Dann erhalte ich für das Diff den Status 200
    Und die Antwort meldet die Version 2
    Und die Antwort enthält 0 fremde Operationen
    Und das Dokument hat die Zeilen:
      """
      - [ ] Eins
      - [x] Zwei
      - [ ] Drei
      """

  Szenario: Eine veraltete Basis ohne Überschneidung wird serverseitig verschoben
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      - [ ] Zwei
      - [ ] Drei
      """
    Und Client "anna" kennt den aktuellen Stand
    Wenn Client "ben" folgendes Diff einreicht:
      """
      [{"op":"replace","index":0,"count":1,"lines":["- [x] Eins"]}]
      """
    Und Client "anna" folgendes Diff einreicht:
      """
      [{"op":"replace","index":2,"count":1,"lines":["- [x] Drei"]}]
      """
    Dann erhalte ich für das Diff den Status 200
    Und die Antwort enthält 1 fremde Operationen
    Und das Dokument hat die Zeilen:
      """
      - [x] Eins
      - [ ] Zwei
      - [x] Drei
      """

  Szenario: Eine veraltete Basis mit Überschneidung meldet einen Konflikt
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      - [ ] Zwei
      """
    Und Client "anna" kennt den aktuellen Stand
    Wenn Client "ben" folgendes Diff einreicht:
      """
      [{"op":"replace","index":0,"count":1,"lines":["- [x] Eins, von Ben"]}]
      """
    Und Client "anna" folgendes Diff einreicht:
      """
      [{"op":"replace","index":0,"count":1,"lines":["- [x] Eins, von Anna"]}]
      """
    Dann erhalte ich für das Diff den Status 409
    Und die Konfliktantwort nennt die aktuelle Version 2 und 1 fremde Operationen
    Und das Dokument hat die Zeilen:
      """
      - [x] Eins, von Ben
      - [ ] Zwei
      """

  Szenario: Zwei Einfügungen an derselben Stelle sind kein Konflikt
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      - [ ] Zwei
      """
    Und Client "anna" kennt den aktuellen Stand
    Wenn Client "ben" folgendes Diff einreicht:
      """
      [{"op":"insert","index":1,"lines":["- [ ] Von Ben"]}]
      """
    Und Client "anna" folgendes Diff einreicht:
      """
      [{"op":"insert","index":1,"lines":["- [ ] Von Anna"]}]
      """
    Dann erhalte ich für das Diff den Status 200
    Und das Dokument hat die Zeilen:
      """
      - [ ] Eins
      - [ ] Von Ben
      - [ ] Von Anna
      - [ ] Zwei
      """

  Szenario: Dieselbe Änderung zweimal gesendet wirkt nur einmal
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      """
    Wenn Client "anna" folgendes Diff einreicht:
      """
      [{"op":"insert","index":1,"lines":["- [ ] Zwei"]}]
      """
    Und dieselbe Anfrage noch einmal gesendet wird
    Dann erhalte ich für das Diff den Status 200
    Und die Antwort meldet die Version 2
    Und das Dokument hat die Version 2
    Und das Dokument hat die Zeilen:
      """
      - [ ] Eins
      - [ ] Zwei
      """

  Szenario: Eine falsche Prüfsumme wird nicht angewendet
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      """
    Wenn Client "anna" folgendes Diff mit falscher Prüfsumme einreicht:
      """
      [{"op":"replace","index":0,"count":1,"lines":["- [x] Eins"]}]
      """
    Dann erhalte ich für das Diff den Status 422
    Und das Dokument hat die Version 1

  Szenario: Ein Index außerhalb des Dokuments wird nicht angewendet
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      """
    Wenn Client "anna" folgendes Diff einreicht:
      """
      [{"op":"delete","index":7,"count":1}]
      """
    Dann erhalte ich für das Diff den Status 422
    Und das Dokument hat die Version 1

  Szenario: Ein gelöschtes Dokument nimmt keine Änderung mehr an
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      """
    Und Client "anna" kennt den aktuellen Stand
    Und dieses Dokument gelöscht wird
    Wenn Client "anna" folgendes Diff einreicht:
      """
      [{"op":"replace","index":0,"count":1,"lines":["- [x] Eins"]}]
      """
    Dann erhalte ich für das Diff den Status 404
