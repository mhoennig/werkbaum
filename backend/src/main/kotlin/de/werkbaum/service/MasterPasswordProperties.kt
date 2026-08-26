package de.werkbaum.service

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration

/**
 * Der Schutz der Dokumentenliste (D76).
 *
 * Das Zugriffsmodell ist die **unerratbare UUID**, wie ein Pad-Link. Das
 * kollidiert mit `GET /documents`, das sämtliche Dokumente auflistet und damit
 * jede UUID auffindbar machte — der Schutz wäre hinfällig. Dieser eine
 * Endpunkt verlangt deshalb ein Master-Passwort.
 *
 * [hash] ist ein **Passwort-Hash** (BCrypt), gesetzt über eine
 * Umgebungsvariable; im
 * Repository steht kein Zugangsdatum (backend/CLAUDE.md). Fehlt er, ist die
 * Liste **gesperrt** statt offen: Die sichere Voreinstellung ist die, bei der
 * ein vergessener Konfigurationsschritt nichts preisgibt.
 */
@ConfigurationProperties(prefix = "werkbaum.master-password")
data class MasterPasswordProperties(

    /**
     * Hash **mit Verfahrens-Präfix**, in Produktion `{bcrypt}$2a$…`
     * (z. B. `htpasswd -bnBC 12 "" geheim | tr -d ':\n'`, davor `{bcrypt}`).
     */
    val hash: String = "",

    /** Fehlversuche bis zur Sperre. */
    val maxAttempts: Int = 5,

    /** Wie lange danach gesperrt bleibt. */
    val lockout: Duration = Duration.ofMinutes(15),
) {
    val configured: Boolean get() = hash.isNotBlank()
}
