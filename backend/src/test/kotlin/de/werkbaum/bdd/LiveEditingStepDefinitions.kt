package de.werkbaum.bdd

import de.werkbaum.diff.LineDiff
import de.werkbaum.generated.model.ContentConflict
import de.werkbaum.generated.model.ContentPatchResult
import de.werkbaum.generated.model.Document as ApiDocument
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule
import io.cucumber.java.de.Angenommen
import io.cucumber.java.de.Dann
import io.cucumber.java.de.Und
import io.cucumber.java.de.Wenn
import io.kotest.assertions.withClue
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.client.EntityExchangeResult
import org.springframework.test.web.servlet.client.RestTestClient

/**
 * Behavior-Tests des Live-Editings (D76) gegen die laufende Anwendung.
 *
 * Die Schritte rechnen Basisversion und Prüfsumme selbst aus – genau wie ein
 * echter Client. Ein fest verdrahteter Hash im Feature wäre bei der ersten
 * Textänderung falsch, ohne dass es jemandem auffiele.
 */
class LiveEditingStepDefinitions {

    @Autowired
    private lateinit var client: RestTestClient

    private lateinit var documentId: String

    /** Stand, den ein Client zuletzt gesehen hat: Version und Prüfsumme. */
    private val knownState = mutableMapOf<String, Pair<Long, String>>()

    private var lastResponse: EntityExchangeResult<String>? = null
    private var lastRequestBody: String? = null

    private fun status(): Int? = lastResponse?.status?.value()

    private fun currentDocument(): ApiDocument =
        client.get()
            .uri("/api/v1/documents/$documentId")
            .exchange()
            .returnResult(ApiDocument::class.java)
            .responseBody
            .shouldNotBeNull()

    private fun json(text: String): String = buildString {
        append('"')
        for (c in text) when (c) {
            '"' -> append("\\\"")
            '\\' -> append("\\\\")
            '\n' -> append("\\n")
            '\r' -> append("\\r")
            '\t' -> append("\\t")
            else -> append(c)
        }
        append('"')
    }

    private fun sendPatch(body: String) {
        lastRequestBody = body
        lastResponse = client.patch()
            .uri("/api/v1/documents/$documentId/content")
            .contentType(MediaType.APPLICATION_JSON)
            .body(body)
            .exchange()
            .returnResult(String::class.java)
    }

    private fun patchBody(
        clientId: String,
        ops: String,
        baseVersion: Long,
        checksum: String,
        seq: Long = 1,
    ) = """
        {"baseVersion":$baseVersion,"checksum":${json(checksum)},
         "clientId":${json(clientId)},"seq":$seq,"ops":$ops}
    """.trimIndent()

    private fun baseOf(clientId: String): Pair<Long, String> =
        knownState[clientId] ?: currentDocument().let { it.version to LineDiff.checksum(it.content) }

    // ---------------- Angenommen ----------------

    @Angenommen("es existiert ein Dokument {string} mit den Zeilen:")
    fun `es existiert ein Dokument mit Zeilen`(titel: String, inhalt: String) {
        val response = client.post()
            .uri("/api/v1/documents")
            .contentType(MediaType.APPLICATION_JSON)
            .body("""{"title":${json(titel)},"content":${json(inhalt)}}""")
            .exchange()
            .returnResult(ApiDocument::class.java)
        withClue("Testdatenanlage fehlgeschlagen") { response.status.value() shouldBe 201 }
        documentId = response.responseBody.shouldNotBeNull().id.toString()
        knownState.clear()
    }

    @Angenommen("Client {string} kennt den aktuellen Stand")
    fun `Client kennt den aktuellen Stand`(clientId: String) {
        val doc = currentDocument()
        knownState[clientId] = doc.version to LineDiff.checksum(doc.content)
    }

    @Angenommen("dieses Dokument gelöscht wird")
    fun `dieses Dokument wird geloescht`() {
        client.delete()
            .uri("/api/v1/documents/$documentId")
            .exchange()
            .returnResult(String::class.java)
            .status.value() shouldBe 204
    }

    // ---------------- Wenn ----------------

    @Wenn("Client {string} folgendes Diff einreicht:")
    fun `Client reicht ein Diff ein`(clientId: String, ops: String) {
        val (version, checksum) = baseOf(clientId)
        sendPatch(patchBody(clientId, ops, version, checksum))
    }

    @Wenn("Client {string} folgendes Diff mit falscher Prüfsumme einreicht:")
    fun `Client reicht ein Diff mit falscher Pruefsumme ein`(clientId: String, ops: String) {
        val (version, _) = baseOf(clientId)
        sendPatch(patchBody(clientId, ops, version, "sha256:" + "0".repeat(64)))
    }

    @Wenn("dieselbe Anfrage noch einmal gesendet wird")
    fun `dieselbe Anfrage noch einmal`() {
        sendPatch(lastRequestBody.shouldNotBeNull())
    }

    // ---------------- Dann / Und ----------------

    @Dann("erhalte ich für das Diff den Status {int}")
    fun `erhalte ich fuer das Diff den Status`(erwartet: Int) {
        withClue("Antwort: ${lastResponse?.responseBody}") { status() shouldBe erwartet }
    }

    @Und("das Dokument hat die Zeilen:")
    fun `das Dokument hat die Zeilen`(erwartet: String) {
        currentDocument().content shouldBe erwartet
    }

    @Und("das Dokument hat die Version {long}")
    fun `das Dokument hat die Version`(erwartet: Long) {
        currentDocument().version shouldBe erwartet
    }

    @Und("die Antwort meldet die Version {long}")
    fun `die Antwort meldet die Version`(erwartet: Long) {
        lastBody<ContentPatchResult>().version shouldBe erwartet
    }

    @Und("die Antwort enthält {int} fremde Operationen")
    fun `die Antwort enthaelt n fremde Operationen`(anzahl: Int) {
        lastBody<ContentPatchResult>().opsSinceBase.size shouldBe anzahl
    }

    @Und("die Konfliktantwort nennt die aktuelle Version {long} und {int} fremde Operationen")
    fun `die Konfliktantwort nennt`(version: Long, anzahl: Int) {
        val conflict = lastBody<ContentConflict>()
        conflict.currentVersion shouldBe version
        conflict.opsSinceBase.size shouldBe anzahl
    }

    /**
     * Der Rumpf der letzten Antwort, typisiert gelesen. Bewusst aus dem
     * gemerkten Text und nicht durch erneutes Senden: Ein zweiter Aufruf wäre
     * zwar idempotent, würde aber genau den Fehler verdecken, den er prüfen
     * soll.
     */
    private inline fun <reified T : Any> lastBody(): T =
        mapper.readValue(lastResponse?.responseBody.shouldNotBeNull(), T::class.java)

    private companion object {
        val mapper: JsonMapper = JsonMapper.builder().addModule(kotlinModule()).build()
    }
}
