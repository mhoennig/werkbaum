package de.werkbaum.service

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

class LoginThrottleTest {

    private class TestClock(var moment: Instant) : Clock() {
        override fun getZone(): ZoneId = ZoneOffset.UTC
        override fun withZone(zone: ZoneId?): Clock = this
        override fun instant(): Instant = moment
    }

    private val clock = TestClock(Instant.parse("2026-01-01T12:00:00Z"))
    private val throttle = LoginThrottle(
        MasterPasswordProperties(maxAttempts = 3, lockout = Duration.ofMinutes(15)),
        clock,
    )

    @Test
    fun `ohne Fehlversuche ist nichts gesperrt`() {
        throttle.locked() shouldBe false
    }

    @Test
    fun `unterhalb der Schwelle bleibt offen`() {
        repeat(2) { throttle.recordFailure() }
        throttle.locked() shouldBe false
    }

    @Test
    fun `mit der Schwelle wird gesperrt`() {
        repeat(3) { throttle.recordFailure() }
        throttle.locked() shouldBe true
    }

    @Test
    fun `die Sperre laeuft ab`() {
        repeat(3) { throttle.recordFailure() }
        clock.moment = clock.moment.plus(Duration.ofMinutes(16))

        throttle.locked() shouldBe false
    }

    @Test
    fun `nach dem Ablauf faengt das Zaehlen von vorn an`() {
        repeat(3) { throttle.recordFailure() }
        clock.moment = clock.moment.plus(Duration.ofMinutes(16))
        throttle.locked() shouldBe false

        repeat(2) { throttle.recordFailure() }
        throttle.locked() shouldBe false
    }

    @Test
    fun `ein gelungener Zugang hebt die Sperre auf`() {
        repeat(3) { throttle.recordFailure() }
        throttle.recordSuccess()

        throttle.locked() shouldBe false
    }

    @Test
    fun `die Restdauer wird genannt`() {
        repeat(3) { throttle.recordFailure() }
        clock.moment = clock.moment.plus(Duration.ofMinutes(5))

        throttle.retryAfterSeconds() shouldBe 600
    }

    @Test
    fun `ohne Sperre ist die Restdauer null`() {
        throttle.retryAfterSeconds() shouldBe 0
    }
}
