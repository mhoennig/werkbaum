package de.werkbaum.service

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

/**
 * Stellschrauben des Live-Editings (D76). Bewusst konfigurierbar: Die Werte
 * sind gesetzt, nicht hergeleitet, und werden nach Erfahrung justiert – wie
 * die Schwellen im Frontend (D64, D71).
 */
@ConfigurationProperties(prefix = "werkbaum.live-editing")
data class LiveEditingProperties(

    /**
     * Schreibpause, nach der die letzte Version zum Meilenstein wird. Kürzer
     * heißt mehr nutzersichtbare Stände, länger heißt gröbere Historie.
     */
    val milestonePause: Duration = Duration.ofSeconds(30),

    /**
     * Wie lange Sync-Versionen aufgehoben werden. Danach beantwortet der Feed
     * ein so altes `since` mit Volltext statt mit einem Diff.
     *
     * **Das ist die einzige Aufgabe des Werts** – nutzersichtbar ist die
     * Historie der Meilensteine, und die wird nie verdichtet. Wer einen
     * offenen Feed hat, fällt gar nicht zurück; zurückfallen kann nur, wessen
     * Feed **ruht** (Hintergrund-Tab, D76-Nachtrag 1) oder gerade neu
     * ansetzt. Fünf Minuten decken die kurze Abwesenheit ab, alles darüber
     * bekommt anstandslos den Volltext. Länger aufzuheben kostet dagegen
     * echten Platz: Jede Version speichert den **ganzen** Text (D79).
     */
    val syncRetention: Duration = Duration.ofMinutes(5),

    /**
     * Höchstzahl der Operationen je Anfrage. Ohne Grenze ist ein einzelner
     * Request ein Ausfall-Vektor – auch versehentlich, durch einen Client-Bug.
     */
    val maxOps: Int = 1_000,

    /** Höchstlänge des Dokuments in Zeichen; der mitgelieferte Plan hat ~40 000. */
    val maxContentLength: Int = 2_000_000,

    /**
     * Obergrenze für das Warten am Änderungsfeed. Ein Client darf keine
     * beliebig lange Verbindung binden. 25 s sind gemessen: Apache auf der
     * Zielumgebung hält einen Long-Poll nachweislich 30 s durch, seine
     * Zeitgrenzen liegen bei 300 s (D76-Nachtrag 1/2).
     */
    val maxWait: Duration = Duration.ofSeconds(25),
)
