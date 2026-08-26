package com.example.editor.bdd

import io.cucumber.java.de.Angenommen
import io.cucumber.java.de.Dann
import io.cucumber.java.de.Und
import io.cucumber.java.de.Wenn
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.resttestclient.TestRestTemplate
import org.springframework.http.HttpEntity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity

/**
 * Behavior-Tests gegen die laufende Anwendung (RANDOM_PORT), also echtes
 * Verhalten der API inklusive Serialisierung, Statuscodes und Fehlerpfaden.
 */
class DocumentStepDefinitions {

    @Autowired
    private lateinit var rest: TestRestTemplate

    private var lastResponse: ResponseEntity<String>? = null
    private var currentDocumentId: String? = null

    private fun jsonEntity(body: String): HttpEntity<String> {
        val headers = HttpHeaders().apply { contentType = MediaType.APPLICATION_JSON }
        return HttpEntity(body, headers)
    }

    private fun createDocument(title: String, content: String): ResponseEntity<String> =
        rest.postForEntity(
            "/api/v1/documents",
            jsonEntity("""{"title":"$title","content":"$content"}"""),
            String::class.java,
        )

    private fun extractId(body: String?): String {
        val match = Regex("\"id\"\\s*:\\s*\"([^\"]+)\"").find(body ?: "")
        assertNotNull(match, "Antwort enthält keine ID: $body")
        return match!!.groupValues[1]
    }

    // ---------------- Angenommen ----------------

    @Angenommen("es existiert ein Dokument mit dem Titel {string}")
    fun `es existiert ein Dokument`(titel: String) {
        val response = createDocument(titel, "Initialer Inhalt")
        assertEquals(201, response.statusCode.value(), "Testdatenanlage fehlgeschlagen")
        currentDocumentId = extractId(response.body)
    }

    // ---------------- Wenn ----------------

    @Wenn("ich ein Dokument mit dem Titel {string} und dem Inhalt {string} anlege")
    fun `ich lege ein Dokument an`(titel: String, inhalt: String) {
        lastResponse = createDocument(titel, inhalt)
        currentDocumentId = Regex("\"id\"\\s*:\\s*\"([^\"]+)\"")
            .find(lastResponse?.body ?: "")?.groupValues?.get(1)
    }

    @Wenn("ich alle Dokumente abrufe")
    fun `ich rufe alle Dokumente ab`() {
        lastResponse = rest.getForEntity("/api/v1/documents", String::class.java)
    }

    @Wenn("ich dieses Dokument abrufe")
    fun `ich rufe dieses Dokument ab`() {
        lastResponse = rest.getForEntity("/api/v1/documents/$currentDocumentId", String::class.java)
    }

    @Wenn("ich ein Dokument mit einer unbekannten ID abrufe")
    fun `ich rufe ein unbekanntes Dokument ab`() {
        lastResponse = rest.getForEntity(
            "/api/v1/documents/00000000-0000-0000-0000-000000000000",
            String::class.java,
        )
    }

    @Wenn("ich den Titel dieses Dokuments auf {string} ändere")
    fun `ich aendere den Titel`(neuerTitel: String) {
        lastResponse = rest.exchange(
            "/api/v1/documents/$currentDocumentId",
            HttpMethod.PUT,
            jsonEntity("""{"title":"$neuerTitel","content":"Aktualisierter Inhalt"}"""),
            String::class.java,
        )
    }

    @Wenn("ich dieses Dokument lösche")
    fun `ich loesche dieses Dokument`() {
        lastResponse = rest.exchange(
            "/api/v1/documents/$currentDocumentId",
            HttpMethod.DELETE,
            HttpEntity.EMPTY,
            String::class.java,
        )
    }

    // ---------------- Dann / Und ----------------

    @Dann("erhalte ich den Status {int}")
    fun `erhalte ich den Status`(status: Int) {
        assertEquals(status, lastResponse?.statusCode?.value())
    }

    @Und("die Antwort enthält den Titel {string}")
    fun `die Antwort enthaelt den Titel`(titel: String) {
        assertTrue(
            lastResponse?.body?.contains("\"title\":\"$titel\"") == true,
            "Erwarteter Titel '$titel' nicht in Antwort: ${lastResponse?.body}",
        )
    }

    @Und("die Antwort enthält {int} Dokumente")
    fun `die Antwort enthaelt n Dokumente`(anzahl: Int) {
        val count = Regex("\"id\"").findAll(lastResponse?.body ?: "").count()
        assertEquals(anzahl, count, "Antwort: ${lastResponse?.body}")
    }

    @Und("die Antwort enthält die Version {long}")
    fun `die Antwort enthaelt die Version`(version: Long) {
        assertTrue(
            lastResponse?.body?.contains("\"version\":$version") == true,
            "Erwartete Version $version nicht in Antwort: ${lastResponse?.body}",
        )
    }

    @Und("das Dokument ist nicht mehr abrufbar")
    fun `das Dokument ist nicht mehr abrufbar`() {
        val response = rest.getForEntity("/api/v1/documents/$currentDocumentId", String::class.java)
        assertEquals(404, response.statusCode.value())
    }

    // ---------------- Historie & Wiederherstellung ----------------

    @Wenn("ich die Historie dieses Dokuments abrufe")
    fun `ich rufe die Historie ab`() {
        lastResponse = rest.getForEntity(
            "/api/v1/documents/$currentDocumentId/history",
            String::class.java,
        )
    }

    @Wenn("ich dieses Dokument wiederherstelle")
    fun `ich stelle dieses Dokument wieder her`() {
        lastResponse = rest.postForEntity(
            "/api/v1/documents/$currentDocumentId/restore",
            jsonEntity("{}"),
            String::class.java,
        )
    }

    @Und("die Antwort enthält {int} Historieneinträge")
    fun `die Antwort enthaelt n Historieneintraege`(anzahl: Int) {
        val count = Regex("\"changeType\"").findAll(lastResponse?.body ?: "").count()
        assertEquals(anzahl, count, "Antwort: ${lastResponse?.body}")
    }

    @Und("die Antwort enthält den Änderungstyp {string}")
    fun `die Antwort enthaelt den Aenderungstyp`(typ: String) {
        assertTrue(
            lastResponse?.body?.contains("\"changeType\":\"$typ\"") == true,
            "Erwarteter Änderungstyp '$typ' nicht in Antwort: ${lastResponse?.body}",
        )
    }

    @Und("das Dokument ist wieder abrufbar")
    fun `das Dokument ist wieder abrufbar`() {
        val response = rest.getForEntity("/api/v1/documents/$currentDocumentId", String::class.java)
        assertEquals(200, response.statusCode.value())
    }
}
