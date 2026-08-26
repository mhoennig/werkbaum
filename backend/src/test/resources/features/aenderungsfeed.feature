# language: de
Funktionalität: Änderungen mitbekommen, ohne zu pollen
  Als Betrachter eines geteilten Plans
  möchte ich Änderungen sofort sehen,
  ohne dass mein Browser dauernd nachfragt.

  Der Server hält die Anfrage offen und antwortet, sobald sich etwas tut
  (Long Polling). Kommt in der Wartezeit nichts, antwortet er mit 204 und der
  Client fragt erneut.

  Szenario: Wer zurückliegt, bekommt sofort das Diff
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      - [ ] Zwei
      """
    Und Client "anna" kennt den aktuellen Stand
    Und Client "ben" folgendes Diff einreicht:
      """
      [{"op":"replace","index":0,"count":1,"lines":["- [x] Eins"]}]
      """
    Wenn ich die Änderungen seit Version 1 abrufe
    Dann erhalte ich für das Diff den Status 200
    Und der Feed meldet die Version 2
    Und der Feed liefert 1 Operationen ab Version 1
    Und der Feed meldet das Ereignis "UPDATED"
    Und die Antwort verbietet das Zwischenspeichern

  Szenario: Wer auf dem neuesten Stand ist, bekommt nichts
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      """
    Wenn ich höchstens 1 Sekunden auf Änderungen seit Version 1 warte
    Dann erhalte ich für das Diff den Status 204

  Szenario: Ein Wartender wird geweckt, sobald eine Änderung eintrifft
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      """
    Und im Hintergrund auf Änderungen seit Version 1 gewartet wird
    Wenn Client "ben" folgendes Diff einreicht:
      """
      [{"op":"insert","index":1,"lines":["- [ ] Zwei"]}]
      """
    Dann hat der wartende Abruf die Änderung erhalten
    Und der Feed meldet die Version 2
    Und der Feed liefert 1 Operationen ab Version 1

  Szenario: Wer noch gar nichts hat, bekommt den Volltext
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      - [ ] Zwei
      """
    Wenn ich die Änderungen seit Version 0 abrufe
    Dann erhalte ich für das Diff den Status 200
    Und der Feed liefert den Volltext:
      """
      - [ ] Eins
      - [ ] Zwei
      """

  Szenario: Der Feed nennt den Absender einer Änderung
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      """
    Und Client "anna" folgendes Diff einreicht:
      """
      [{"op":"replace","index":0,"count":1,"lines":["- [x] Eins"]}]
      """
    Wenn ich die Änderungen seit Version 1 abrufe
    Dann erhalte ich für das Diff den Status 200
    Und der Feed nennt als Absender "anna"

  Szenario: Der Feed meldet das Löschen und die Wiederherstellung
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      """
    Und dieses Dokument gelöscht wird
    Wenn ich die Änderungen seit Version 1 abrufe
    Dann erhalte ich für das Diff den Status 200
    Und der Feed meldet das Ereignis "DELETED"
    Wenn dieses Dokument wiederhergestellt wird
    Und ich die Änderungen seit Version 2 abrufe
    Dann erhalte ich für das Diff den Status 200
    Und der Feed meldet das Ereignis "RESTORED"

  Szenario: Eine gänzlich unbekannte UUID hat keinen Feed
    Wenn ich die Änderungen eines unbekannten Dokuments abrufe
    Dann erhalte ich für das Diff den Status 404
