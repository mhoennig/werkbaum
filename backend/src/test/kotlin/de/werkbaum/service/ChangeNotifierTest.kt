package de.werkbaum.service

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import java.time.Duration
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

class ChangeNotifierTest {

    private val notifier = ChangeNotifier()
    private val id = UUID.randomUUID()

    @Test
    fun `ohne Aenderung laeuft die Wartezeit ab`() {
        notifier.awaitChange(id, notifier.stampOf(id), Duration.ofMillis(50)) shouldBe false
    }

    @Test
    fun `eine Aenderung weckt den Wartenden`() {
        val stamp = notifier.stampOf(id)
        val wartend = CompletableFuture.supplyAsync {
            notifier.awaitChange(id, stamp, Duration.ofSeconds(5))
        }
        Thread.sleep(100)
        notifier.published(id)

        wartend.get(5, TimeUnit.SECONDS) shouldBe true
    }

    @Test
    fun `eine Aenderung in der Luecke geht nicht verloren`() {
        // Genau dafuer ist der Stempel da: Der Aufrufer liest ihn, bevor er in
        // der Datenbank nachsieht. Passiert dazwischen etwas, kehrt das Warten
        // sofort zurueck, statt die volle Zeit abzusitzen.
        val stamp = notifier.stampOf(id)
        notifier.published(id)

        notifier.awaitChange(id, stamp, Duration.ofMillis(50)) shouldBe true
    }

    @Test
    fun `ein anderes Dokument weckt nicht`() {
        val stamp = notifier.stampOf(id)
        notifier.published(UUID.randomUUID())

        notifier.awaitChange(id, stamp, Duration.ofMillis(50)) shouldBe false
    }
}
