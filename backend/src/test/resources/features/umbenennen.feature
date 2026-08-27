# language: de
Funktionalität: Ein geteiltes Dokument umbenennen
  Als Bearbeiter eines geteilten Plans
  möchte ich den Titel für alle ändern,
  damit jeder im Wähler denselben Namen sieht.

  Grundlage: Der Titel ist ein Metadatum und bekommt seinen eigenen Weg mit
  Versionsprüfung (D76/D85); der Änderungsfeed stellt die Umbenennung samt
  neuem Titel zu.

  Szenario: Umbenennen mit aktueller Version gilt und lässt den Inhalt stehen
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      """
    Wenn das Dokument auf "Team-Plan" umbenannt wird
    Dann erhalte ich für das Umbenennen den Status 200
    Und das Dokument trägt den Titel "Team-Plan"
    Und das Dokument steht auf Version 2
    Und das Dokument hat die Zeilen:
      """
      - [ ] Eins
      """

  Szenario: Der Feed stellt die Umbenennung samt neuem Titel zu
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      """
    Wenn das Dokument auf "Team-Plan" umbenannt wird
    Und ich die Änderungen seit Version 1 abrufe
    Dann der Feed meldet das Ereignis "RENAMED"
    Und das RENAMED-Ereignis nennt den Titel "Team-Plan"

  Szenario: Eine veraltete Version wird abgelehnt
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      """
    Wenn das Dokument mit veralteter Version auf "Zu spät" umbenannt wird
    Dann erhalte ich für das Umbenennen den Status 409
    Und das Dokument trägt den Titel "Plan"

  Szenario: Ein leerer Titel wird abgelehnt
    Angenommen es existiert ein Dokument "Plan" mit den Zeilen:
      """
      - [ ] Eins
      """
    Wenn das Dokument auf "   " umbenannt wird
    Dann erhalte ich für das Umbenennen den Status 400
    Und das Dokument trägt den Titel "Plan"
