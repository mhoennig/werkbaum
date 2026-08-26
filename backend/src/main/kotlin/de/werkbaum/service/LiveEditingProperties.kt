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
     */
    val syncRetention: Duration = Duration.ofHours(1),

    /**
     * Höchstzahl der Operationen je Anfrage. Ohne Grenze ist ein einzelner
     * Request ein Ausfall-Vektor – auch versehentlich, durch einen Client-Bug.
     */
    val maxOps: Int = 1_000,

    /** Höchstlänge des Dokuments in Zeichen; der mitgelieferte Plan hat ~40 000. */
    val maxContentLength: Int = 2_000_000,
)
