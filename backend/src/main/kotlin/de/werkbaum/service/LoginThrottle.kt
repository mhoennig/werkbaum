package de.werkbaum.service

import org.springframework.stereotype.Component
import java.time.Clock
import java.time.Instant
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Sperre nach Fehlversuchen für die Dokumentenliste (D76).
 *
 * **Global, nicht je Adresse.** Es gibt genau ein Master-Passwort; eine
 * globale Sperre ist damit die passende Aussage und nicht zu umgehen, indem
 * jemand die Adresse wechselt. Sie hängt außerdem nicht an
 * `X-Forwarded-For` — hinter dem Reverse Proxy der Zielumgebung (D76,
 * „Betrieb") sähe der Server sonst für alle dieselbe 127.0.0.1 und die Sperre
 * wäre unfreiwillig doch global, nur schlechter begründet.
 *
 * Der Preis ist benannt: Wer das Passwort falsch rät, sperrt die Liste für
 * alle — für ein paar Minuten. Die Liste ist eine Bequemlichkeit für den
 * Betreiber; die Dokumente selbst bleiben über ihre UUID erreichbar.
 */
@Component
class LoginThrottle(
    private val properties: MasterPasswordProperties,
    private val clock: Clock,
) {

    private val lock = ReentrantLock()
    private var failures = 0
    private var lockedUntil: Instant = Instant.EPOCH

    /** Ist gerade gesperrt? Eine abgelaufene Sperre räumt sich dabei selbst weg. */
    fun locked(): Boolean = lock.withLock {
        if (clock.instant().isBefore(lockedUntil)) return true
        if (lockedUntil != Instant.EPOCH) reset()
        false
    }

    /** Restdauer der Sperre in Sekunden – für `Retry-After`. */
    fun retryAfterSeconds(): Long = lock.withLock {
        maxOf(0, java.time.Duration.between(clock.instant(), lockedUntil).seconds)
    }

    fun recordFailure() = lock.withLock {
        failures++
        if (failures >= properties.maxAttempts) {
            lockedUntil = clock.instant().plus(properties.lockout)
        }
    }

    fun recordSuccess() = lock.withLock { reset() }

    private fun reset() {
        failures = 0
        lockedUntil = Instant.EPOCH
    }
}
