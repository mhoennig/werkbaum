package de.werkbaum.bdd

import de.werkbaum.diff.LineDiff
import de.werkbaum.generated.model.ChangeFeed
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
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.client.EntityExchangeResult
import org.springframework.test.web.servlet.client.RestTestClient
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

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

    /** Ein Feed-Abruf, der im Hintergrund wartet – für Long Polling. */
    private var pendingFeed: CompletableFuture<EntityExchangeResult<String>>? = null
    private var feedStartedAt: Long = 0

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
         "clientId":${json(clientId)},"displayName":${json(clientId)},
         "seq":$seq,"ops":$ops}
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

    @Angenommen("dieses Dokument wiederhergestellt wird")
    fun `dieses Dokument wird wiederhergestellt`() {
        client.post()
            .uri("/api/v1/documents/$documentId/restore")
            .contentType(MediaType.APPLICATION_JSON)
            .body("{}")
            .exchange()
            .returnResult(String::class.java)
            .status.value() shouldBe 200
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

    // ---------------- Änderungsfeed ----------------

    @Wenn("ich die Änderungen seit Version {long} abrufe")
    fun `ich rufe die Aenderungen ab`(since: Long) {
        lastResponse = feedRequest(since, wait = 0)
    }

    @Wenn("ich höchstens {int} Sekunden auf Änderungen seit Version {long} warte")
    fun `ich warte auf Aenderungen`(sekunden: Int, since: Long) {
        lastResponse = feedRequest(since, wait = sekunden)
    }

    @Wenn("im Hintergrund auf Änderungen seit Version {long} gewartet wird")
    fun `im Hintergrund wird gewartet`(since: Long) {
        feedStartedAt = System.nanoTime()
        pendingFeed = CompletableFuture.supplyAsync { feedRequest(since, wait = 5) }
        // Dem Abruf einen Moment geben, damit er wirklich wartet, statt die
        // Aenderung schon vorzufinden - sonst prueft das Szenario nichts.
        Thread.sleep(300)
    }

    @Dann("hat der wartende Abruf die Änderung erhalten")
    fun `der wartende Abruf hat die Aenderung erhalten`() {
        val response = pendingFeed.shouldNotBeNull().get(10, TimeUnit.SECONDS)
        val dauer = (System.nanoTime() - feedStartedAt) / 1_000_000
        withClue("Antwort: ${response.responseBody}") { response.status.value() shouldBe 200 }
        withClue("Der Abruf hat $dauer ms gebraucht - er wurde nicht geweckt, sondern lief ab") {
            (dauer < 4_000) shouldBe true
        }
        lastResponse = response
    }

    @Und("der Feed meldet die Version {long}")
    fun `der Feed meldet die Version`(erwartet: Long) {
        lastBody<ChangeFeed>().currentVersion shouldBe erwartet
    }

    @Und("der Feed liefert {int} Operationen ab Version {long}")
    fun `der Feed liefert n Operationen`(anzahl: Int, from: Long) {
        val feed = lastBody<ChangeFeed>()
        feed.fromVersion shouldBe from
        feed.ops.shouldNotBeNull().size shouldBe anzahl
    }

    @Und("der Feed liefert den Volltext:")
    fun `der Feed liefert den Volltext`(erwartet: String) {
        val feed = lastBody<ChangeFeed>()
        feed.fromVersion shouldBe null
        feed.content shouldBe erwartet
    }

    @Wenn("das Dokument auf {string} umbenannt wird")
    fun `das Dokument wird umbenannt`(titel: String) =
        sendRename(titel, currentDocument().version)

    @Wenn("das Dokument mit veralteter Version auf {string} umbenannt wird")
    fun `veraltete Umbenennung`(titel: String) =
        sendRename(titel, currentDocument().version - 1)

    private fun sendRename(titel: String, version: Long) {
        lastResponse = client.patch()
            .uri("/api/v1/documents/$documentId/title")
            .contentType(MediaType.APPLICATION_JSON)
            .body("""{"title":${json(titel)},"expectedVersion":$version}""")
            .exchange()
            .returnResult(String::class.java)
    }

    @Dann("erhalte ich für das Umbenennen den Status {int}")
    fun `status des Umbenennens`(erwartet: Int) {
        status() shouldBe erwartet
    }

    @Und("das Dokument trägt den Titel {string}")
    fun `dokument traegt den Titel`(titel: String) {
        currentDocument().title shouldBe titel
    }

    @Und("das Dokument steht auf Version {long}")
    fun `dokument steht auf Version`(version: Long) {
        currentDocument().version shouldBe version
    }

    @Und("das RENAMED-Ereignis nennt den Titel {string}")
    fun `renamed nennt den Titel`(titel: String) {
        lastBody<ChangeFeed>().events
            .first { it.changeType.value == "RENAMED" }
            .title shouldBe titel
    }

    @Und("der Feed meldet das Ereignis {string}")
    fun `der Feed meldet das Ereignis`(typ: String) {
        lastBody<ChangeFeed>().events.map { it.changeType.value } shouldContain typ
    }

    @Und("der Feed nennt als Absender {string}")
    fun `der Feed nennt als Absender`(name: String) {
        lastBody<ChangeFeed>().events.mapNotNull { it.displayName } shouldContain name
    }

    @Und("die Antwort verbietet das Zwischenspeichern")
    fun `die Antwort verbietet das Zwischenspeichern`() {
        lastResponse?.responseHeaders?.cacheControl shouldBe "no-store"
    }

    @Wenn("ich die Änderungen eines unbekannten Dokuments abrufe")
    fun `ich rufe die Aenderungen eines unbekannten Dokuments ab`() {
        lastResponse = client.get()
            .uri("/api/v1/documents/00000000-0000-0000-0000-000000000000/changes?since=0&wait=0")
            .exchange()
            .returnResult(String::class.java)
    }

    private fun feedRequest(since: Long, wait: Int): EntityExchangeResult<String> =
        client.get()
            .uri("/api/v1/documents/$documentId/changes?since=$since&wait=$wait")
            .exchange()
            .returnResult(String::class.java)

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
