package de.werkbaum.api

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.client.RestTestClient
import java.util.Base64

/**
 * Ohne konfiguriertes Master-Passwort ist die Dokumentenliste **gesperrt**,
 * nicht offen.
 *
 * Die sichere Voreinstellung ist die, bei der ein vergessener
 * Konfigurationsschritt nichts preisgibt: Andernfalls stünde jede Dokument-
 * UUID offen da, und das Zugriffsmodell (D76) wäre hinfällig — ohne dass es
 * jemandem auffiele.
 */
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@TestPropertySource(
    properties = [
        "werkbaum.master-password.hash=",
        // Eigene Datenbank: Dieser Test braucht einen zweiten Spring-Kontext,
        // und zwei Kontexte auf derselben In-Memory-H2 stolpern uebereinander
        // (Liquibase legt DATABASECHANGELOG ein zweites Mal an).
        "spring.datasource.url=jdbc:h2:mem:editor-master-pw;" +
            "DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
    ]
)
class MasterPasswordDefaultTest {

    @Autowired
    private lateinit var client: RestTestClient

    @Test
    fun `ohne Hash bleibt die Liste ohne Passwort verschlossen`() {
        client.get()
            .uri("/api/v1/documents")
            .exchange()
            .returnResult(String::class.java)
            .status.value() shouldBe 401
    }

    @Test
    fun `ohne Hash oeffnet auch ein leeres Passwort nicht`() {
        val basic = Base64.getEncoder().encodeToString("werkbaum:".toByteArray())
        client.get()
            .uri("/api/v1/documents")
            .header("Authorization", "Basic $basic")
            .exchange()
            .returnResult(String::class.java)
            .status.value() shouldBe 401
    }

    @Test
    fun `ein einzelnes Dokument bleibt ueber seine UUID erreichbar`() {
        // Der Schutz gilt der Liste, nicht dem Dokument - sonst waere die
        // ganze Zugriffsidee (Link teilen) dahin.
        val created = client.post()
            .uri("/api/v1/documents")
            .header("Content-Type", "application/json")
            .body("""{"title":"Offen","content":"- [ ] Eins"}""")
            .exchange()
            .returnResult(String::class.java)
        created.status.value() shouldBe 201

        val id = Regex("\"id\"\\s*:\\s*\"([^\"]+)\"").find(created.responseBody!!)!!.groupValues[1]
        client.get()
            .uri("/api/v1/documents/$id")
            .exchange()
            .returnResult(String::class.java)
            .status.value() shouldBe 200
    }
}
