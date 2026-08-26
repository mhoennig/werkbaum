package de.werkbaum.service

import org.springframework.stereotype.Component
import java.time.Duration
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Weckt wartende Beobachter, wenn sich an einem Dokument etwas getan hat —
 * der Kern der „Echtzeit ohne WebSocket"-Lösung (D76).
 *
 * **Setzt eine Einzelinstanz voraus.** Hinter einem Load Balancer erführe ein
 * Beobachter auf der zweiten Instanz nichts und liefe in den Timeout. Bewusste
 * Annahme, für zehn Beobachter angemessen.
 *
 * Gezählt wird je Dokument ein **Stempel**, nicht die Versionsnummer: Der
 * Aufrufer liest ihn, **bevor** er in der Datenbank nachsieht. Ändert sich in
 * der Lücke dazwischen etwas, kehrt das Warten sofort zurück, statt das Signal
 * zu verpassen und die volle Wartezeit abzusitzen.
 *
 * Gewartet wird mit `ReentrantLock`/`Condition`, nicht mit `synchronized`
 * plus `wait()`: Der Feed blockiert seinen Thread, und das soll ein
 * **virtueller** Thread sein dürfen (siehe `spring.threads.virtual.enabled`) —
 * ein Monitor würde dessen Träger festnageln.
 */
@Component
class ChangeNotifier {

    private val lock = ReentrantLock()
    private val changed = lock.newCondition()
    private val stamps = ConcurrentHashMap<UUID, Long>()

    fun stampOf(documentId: UUID): Long = stamps[documentId] ?: 0L

    /** Meldet eine Änderung – aufzurufen **nach** dem Commit, nie davor. */
    fun published(documentId: UUID) = lock.withLock {
        stamps.merge(documentId, 1L) { old, one -> old + one }
        changed.signalAll()
    }

    /**
     * Wartet, bis sich der Stempel des Dokuments von [since] unterscheidet.
     * `true` heißt: es hat sich etwas getan. `false` heißt: Zeit abgelaufen.
     */
    fun awaitChange(documentId: UUID, since: Long, timeout: Duration): Boolean = lock.withLock {
        var remaining = timeout.toNanos()
        while (stampOf(documentId) == since) {
            if (remaining <= 0) return false
            remaining = changed.awaitNanos(remaining)
        }
        true
    }
}
