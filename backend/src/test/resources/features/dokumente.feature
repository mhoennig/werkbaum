# language: de
Funktionalität: Dokumente verwalten
  Als Nutzer der API
  möchte ich Dokumente anlegen, abrufen, ändern und löschen können,
  damit das Backend die Grundlage für den Editor bildet.

  Szenario: Ein neues Dokument anlegen
    Wenn ich ein Dokument mit dem Titel "Notizen" und dem Inhalt "Hallo Welt" anlege
    Dann erhalte ich den Status 201
    Und die Antwort enthält den Titel "Notizen"
    Und die Antwort enthält die Version 1

  Szenario: Alle Dokumente auflisten
    Angenommen es existiert ein Dokument mit dem Titel "Erstes"
    Und es existiert ein Dokument mit dem Titel "Zweites"
    Wenn ich alle Dokumente mit dem Master-Passwort abrufe
    Dann erhalte ich den Status 200
    Und die Antwort enthält 2 Dokumente

  Szenario: Ohne Master-Passwort bleibt die Liste verschlossen
    Angenommen es existiert ein Dokument mit dem Titel "Geheim"
    Wenn ich alle Dokumente ohne Master-Passwort abrufe
    Dann erhalte ich den Status 401

  Szenario: Nach zu vielen Fehlversuchen ist die Liste gesperrt
    Angenommen es existiert ein Dokument mit dem Titel "Geheim"
    Wenn ich 3 mal mit falschem Master-Passwort abrufe
    Und ich alle Dokumente mit dem Master-Passwort abrufe
    Dann erhalte ich den Status 429

  Szenario: Ein einzelnes Dokument abrufen
    Angenommen es existiert ein Dokument mit dem Titel "Protokoll"
    Wenn ich dieses Dokument abrufe
    Dann erhalte ich den Status 200
    Und die Antwort enthält den Titel "Protokoll"

  Szenario: Ein Dokument aktualisieren erhöht die Version
    Angenommen es existiert ein Dokument mit dem Titel "Entwurf"
    Wenn ich den Titel dieses Dokuments auf "Final" ändere
    Dann erhalte ich den Status 200
    Und die Antwort enthält den Titel "Final"
    Und die Antwort enthält die Version 2

  Szenario: Ein Dokument löschen
    Angenommen es existiert ein Dokument mit dem Titel "Veraltet"
    Wenn ich dieses Dokument lösche
    Dann erhalte ich den Status 204
    Und das Dokument ist nicht mehr abrufbar

  Szenario: Ein unbekanntes Dokument abrufen
    Wenn ich ein Dokument mit einer unbekannten ID abrufe
    Dann erhalte ich den Status 404

  Szenario: Die Historie protokolliert alle Änderungen
    Angenommen es existiert ein Dokument mit dem Titel "Bericht"
    Wenn ich den Titel dieses Dokuments auf "Bericht v2" ändere
    Und ich die Historie dieses Dokuments abrufe
    Dann erhalte ich den Status 200
    Und die Antwort enthält 2 Historieneinträge
    Und die Antwort enthält den Änderungstyp "CREATED"
    Und die Antwort enthält den Änderungstyp "UPDATED"

  Szenario: Die Historie überlebt das Löschen eines Dokuments
    Angenommen es existiert ein Dokument mit dem Titel "Wichtig"
    Wenn ich dieses Dokument lösche
    Und ich die Historie dieses Dokuments abrufe
    Dann erhalte ich den Status 200
    Und die Antwort enthält den Änderungstyp "DELETED"

  Szenario: Ein gelöschtes Dokument wiederherstellen
    Angenommen es existiert ein Dokument mit dem Titel "Vertrag"
    Wenn ich dieses Dokument lösche
    Und ich dieses Dokument wiederherstelle
    Dann erhalte ich den Status 200
    Und die Antwort enthält den Titel "Vertrag"
    Und das Dokument ist wieder abrufbar

  Szenario: Ein Rückfall auf eine alte Version ist kein Wiederherstellen
    Angenommen es existiert ein Dokument mit dem Titel "Satzung"
    Wenn ich den Titel dieses Dokuments auf "Satzung v2" ändere
    Und ich dieses Dokument auf Version 1 zurücksetze
    Dann erhalte ich den Status 200
    Und die Antwort enthält den Titel "Satzung"
    Wenn ich die Historie dieses Dokuments abrufe
    Dann die Antwort enthält den Änderungstyp "ROLLED_BACK"

  Szenario: Wiederherstellen ohne Historie schlägt fehl
    Wenn ich ein Dokument mit einer unbekannten ID abrufe
    Dann erhalte ich den Status 404
