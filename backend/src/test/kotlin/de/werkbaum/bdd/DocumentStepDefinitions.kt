package de.werkbaum.bdd

import io.cucumber.java.de.Angenommen
import io.cucumber.java.de.Dann
import io.cucumber.java.de.Und
import io.cucumber.java.de.Wenn
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.client.EntityExchangeResult
import org.springframework.test.web.servlet.client.RestTestClient

/**
 * Behavior-Tests gegen die laufende Anwendung (RANDOM_PORT), also echtes
 * Verhalten der API inklusive Serialisierung, Statuscodes und Fehlerpfaden.
 *
 * Verwendet [RestTestClient] – den Nachfolger von TestRestTemplate, das in
 * Spring Boot 4 als Auslaufmodell gilt. Die fluent API prueft normalerweise
 * sofort; hier wird stattdessen ueber `returnResult` das Ergebnis
 * festgehalten, weil Cucumber Senden (Wenn) und Pruefen (Dann) trennt.
 */
class DocumentStepDefinitions {

    @Autowired
    private lateinit var client: RestTestClient

    private var lastResponse: EntityExchangeResult<String>? = null
    private var currentDocumentId: String? = null

    private fun status(): Int? = lastResponse?.status?.value()

    private fun body(): String? = lastResponse?.responseBody

    private fun createDocument(title: String, content: String): EntityExchangeResult<String> =
        client.post()
            .uri("/api/v1/documents")
            .contentType(MediaType.APPLICATION_JSON)
            .body("""{"title":"$title","content":"$content"}""")
            .exchange()
            .returnResult(String::class.java)

    private fun extractId(body: String?): String {
        val match = Regex("\"id\"\\s*:\\s*\"([^\"]+)\"").find(body ?: "")
        assertNotNull(match, "Antwort enthält keine ID: $body")
        return match!!.groupValues[1]
    }

    // ---------------- Angenommen ----------------

    @Angenommen("es existiert ein Dokument mit dem Titel {string}")
    fun `es existiert ein Dokument`(titel: String) {
        val response = createDocument(titel, "Initialer Inhalt")
        assertEquals(201, response.status.value(), "Testdatenanlage fehlgeschlagen")
        currentDocumentId = extractId(response.responseBody)
    }

    // ---------------- Wenn ----------------

    @Wenn("ich ein Dokument mit dem Titel {string} und dem Inhalt {string} anlege")
    fun `ich lege ein Dokument an`(titel: String, inhalt: String) {
        lastResponse = createDocument(titel, inhalt)
        currentDocumentId = Regex("\"id\"\\s*:\\s*\"([^\"]+)\"")
            .find(body() ?: "")?.groupValues?.get(1)
    }

    @Wenn("ich alle Dokumente abrufe")
    fun `ich rufe alle Dokumente ab`() {
        lastResponse = client.get()
            .uri("/api/v1/documents")
            .exchange()
            .returnResult(String::class.java)
    }

    @Wenn("ich dieses Dokument abrufe")
    fun `ich rufe dieses Dokument ab`() {
        lastResponse = client.get()
            .uri("/api/v1/documents/$currentDocumentId")
            .exchange()
            .returnResult(String::class.java)
    }

    @Wenn("ich ein Dokument mit einer unbekannten ID abrufe")
    fun `ich rufe ein unbekanntes Dokument ab`() {
        lastResponse = client.get()
            .uri("/api/v1/documents/00000000-0000-0000-0000-000000000000")
            .exchange()
            .returnResult(String::class.java)
    }

    @Wenn("ich den Titel dieses Dokuments auf {string} ändere")
    fun `ich aendere den Titel`(neuerTitel: String) {
        lastResponse = client.put()
            .uri("/api/v1/documents/$currentDocumentId")
            .contentType(MediaType.APPLICATION_JSON)
            .body("""{"title":"$neuerTitel","content":"Aktualisierter Inhalt"}""")
            .exchange()
            .returnResult(String::class.java)
    }

    @Wenn("ich dieses Dokument lösche")
    fun `ich loesche dieses Dokument`() {
        lastResponse = client.delete()
            .uri("/api/v1/documents/$currentDocumentId")
            .exchange()
            .returnResult(String::class.java)
    }

    // ---------------- Dann / Und ----------------

    @Dann("erhalte ich den Status {int}")
    fun `erhalte ich den Status`(status: Int) {
        assertEquals(status, status())
    }

    @Und("die Antwort enthält den Titel {string}")
    fun `die Antwort enthaelt den Titel`(titel: String) {
        assertTrue(
            body()?.contains("\"title\":\"$titel\"") == true,
            "Erwarteter Titel '$titel' nicht in Antwort: ${body()}",
        )
    }

    @Und("die Antwort enthält {int} Dokumente")
    fun `die Antwort enthaelt n Dokumente`(anzahl: Int) {
        val count = Regex("\"id\"").findAll(body() ?: "").count()
        assertEquals(anzahl, count, "Antwort: ${body()}")
    }

    @Und("die Antwort enthält die Version {long}")
    fun `die Antwort enthaelt die Version`(version: Long) {
        assertTrue(
            body()?.contains("\"version\":$version") == true,
            "Erwartete Version $version nicht in Antwort: ${body()}",
        )
    }

    @Und("das Dokument ist nicht mehr abrufbar")
    fun `das Dokument ist nicht mehr abrufbar`() {
        val response = client.get()
            .uri("/api/v1/documents/$currentDocumentId")
            .exchange()
            .returnResult(String::class.java)
        assertEquals(404, response.status.value())
    }

    // ---------------- Historie & Wiederherstellung ----------------

    @Wenn("ich die Historie dieses Dokuments abrufe")
    fun `ich rufe die Historie ab`() {
        lastResponse = client.get()
            .uri("/api/v1/documents/$currentDocumentId/history")
            .exchange()
            .returnResult(String::class.java)
    }

    @Wenn("ich dieses Dokument wiederherstelle")
    fun `ich stelle dieses Dokument wieder her`() {
        lastResponse = client.post()
            .uri("/api/v1/documents/$currentDocumentId/restore")
            .contentType(MediaType.APPLICATION_JSON)
            .body("{}")
            .exchange()
            .returnResult(String::class.java)
    }

    @Und("die Antwort enthält {int} Historieneinträge")
    fun `die Antwort enthaelt n Historieneintraege`(anzahl: Int) {
        val count = Regex("\"changeType\"").findAll(body() ?: "").count()
        assertEquals(anzahl, count, "Antwort: ${body()}")
    }

    @Und("die Antwort enthält den Änderungstyp {string}")
    fun `die Antwort enthaelt den Aenderungstyp`(typ: String) {
        assertTrue(
            body()?.contains("\"changeType\":\"$typ\"") == true,
            "Erwarteter Änderungstyp '$typ' nicht in Antwort: ${body()}",
        )
    }

    @Und("das Dokument ist wieder abrufbar")
    fun `das Dokument ist wieder abrufbar`() {
        val response = client.get()
            .uri("/api/v1/documents/$currentDocumentId")
            .exchange()
            .returnResult(String::class.java)
        assertEquals(200, response.status.value())
    }
}
