package de.werkbaum.api

import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.client.RestTestClient

/**
 * Ohne konfigurierte Taiga-Instanz ist der Proxy **aus**, nicht kaputt:
 * `GET /info` meldet `taiga: false` (der Editor zeigt die Aktionen dann gar
 * nicht erst), und ein Aufruf trotzdem antwortet mit 503 statt eines
 * nichtssagenden Fehlers (D91).
 */
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@TestPropertySource(
    properties = [
        // Eigene Datenbank: zweiter Spring-Kontext (siehe MasterPasswordDefaultTest).
        "spring.datasource.url=jdbc:h2:mem:editor-taiga-off;" +
            "DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
    ]
)
class TaigaDisabledTest {

    @Autowired
    private lateinit var client: RestTestClient

    @Test
    fun `info meldet das fehlende Taiga-Feature`() {
        val result = client.get().uri("/api/v1/info").exchange().returnResult(String::class.java)
        result.status.value() shouldBe 200
        result.responseBody!! shouldContain "\"taiga\":false"
    }

    @Test
    fun `ein Aufruf ohne Konfiguration antwortet mit 503`() {
        val result = client.post()
            .uri("/api/v1/taiga/auth")
            .header("Content-Type", "application/json")
            .body("""{"username":"mi","password":"geheim"}""")
            .exchange()
            .returnResult(String::class.java)
        result.status.value() shouldBe 503
    }
}
