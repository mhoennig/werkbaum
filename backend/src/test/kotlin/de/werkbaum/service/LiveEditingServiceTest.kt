package de.werkbaum.service

import de.werkbaum.diff.DiffNotApplicableException
import de.werkbaum.diff.LineDiff
import de.werkbaum.diff.LineOp
import de.werkbaum.domain.ChangeAuthor
import de.werkbaum.domain.ChangeType
import de.werkbaum.domain.ContentPatch
import de.werkbaum.domain.ContentPatchOutcome
import de.werkbaum.domain.Document
import de.werkbaum.domain.ChangeEvent
import de.werkbaum.domain.DocumentHistoryEntry
import de.werkbaum.repository.DocumentHistoryRepository
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.OffsetDateTime
import java.util.UUID

class LiveEditingServiceTest {

    private val id = UUID.randomUUID()
    private val documents = mockk<DocumentService>()
    private val history = mockk<DocumentHistoryRepository>(relaxed = true)
    private val properties = LiveEditingProperties(
        maxOps = 3,
        maxContentLength = 40,
        maxWait = Duration.ofMillis(200),
    )
    private val notifier = ChangeNotifier()
    private val service = LiveEditingService(documents, history, properties, notifier)

    private val basis = "eins\nzwei\ndrei"

    private fun document(content: String = basis, version: Long = 7) = Document(
        id = id,
        title = "Plan",
        content = content,
        version = version,
        createdAt = OffsetDateTime.parse("2026-01-01T12:00:00Z"),
        updatedAt = OffsetDateTime.parse("2026-01-01T12:00:00Z"),
    )

    private fun patch(
        ops: List<LineOp> = listOf(LineOp.Replace(1, 1, listOf("ZWEI"))),
        baseVersion: Long = 7,
        checksum: String = LineDiff.checksum(basis),
        clientId: String = "anna",
        seq: Long = 1,
        milestone: Boolean = false,
    ) = ContentPatch(
        baseVersion = baseVersion,
        checksum = checksum,
        author = ChangeAuthor(clientId, "Anna"),
        seq = seq,
        ops = ops,
        milestone = milestone,
    )

    private fun expectUpdate(content: String, newVersion: Long = 8) {
        every { documents.update(id, "Plan", content, any(), any()) } returns
            document(content, newVersion)
    }

    // -----------------------------------------------------------------------

    @Test
    fun `eine Aenderung auf aktueller Basis wird angewendet`() {
        every { documents.findByIdOrNull(id) } returns document()
        val content = slot<String>()
        every { documents.update(id, "Plan", capture(content), any(), any()) } answers {
            document(content.captured, 8)
        }

        val outcome = service.patchContent(id, patch())

        outcome shouldBe ContentPatchOutcome(8, emptyList())
        content.captured shouldBe "eins\nZWEI\ndrei"
    }

    @Test
    fun `der Autor wandert in die Historie`() {
        every { documents.findByIdOrNull(id) } returns document()
        expectUpdate("eins\nZWEI\ndrei")
        val autor = slot<ChangeAuthor>()
        every { documents.update(id, any(), any(), any(), capture(autor)) } returns document()

        service.patchContent(id, patch())

        autor.captured shouldBe ChangeAuthor("anna", "Anna")
    }

    @Test
    fun `der getaktete Strom schreibt Sync-Versionen, der Knopfdruck einen Meilenstein`() {
        every { documents.findByIdOrNull(id) } returns document()
        val meilenstein = slot<Boolean>()
        every { documents.update(id, any(), any(), capture(meilenstein), any()) } returns document()

        service.patchContent(id, patch(seq = 1))
        meilenstein.captured shouldBe false

        service.patchContent(id, patch(seq = 2, milestone = true))
        meilenstein.captured shouldBe true
    }

    // -----------------------------------------------------------------------
    // Rebasen und Konflikt
    // -----------------------------------------------------------------------

    @Test
    fun `eine veraltete Basis ohne Ueberschneidung wird verschoben`() {
        // Basis v6: "eins/zwei/drei". Fremd: eine Zeile vorn eingefuegt -> v7.
        val aktuell = "null\neins\nzwei\ndrei"
        every { documents.findByIdOrNull(id) } returns document(aktuell, 7)
        every { history.findVersion(id, 6) } returns historyEntry(basis, 6)
        val content = slot<String>()
        every { documents.update(id, "Plan", capture(content), any(), any()) } answers {
            document(content.captured, 8)
        }

        val outcome = service.patchContent(id, patch(baseVersion = 6))

        outcome.version shouldBe 8
        outcome.opsSinceBase shouldBe listOf(LineOp.Insert(0, listOf("null")))
        content.captured shouldBe "null\neins\nZWEI\ndrei"
    }

    @Test
    fun `eine echte Ueberschneidung meldet Konflikt samt fremdem Diff`() {
        val aktuell = "eins\nfremd\ndrei"
        every { documents.findByIdOrNull(id) } returns document(aktuell, 7)
        every { history.findVersion(id, 6) } returns historyEntry(basis, 6)

        val konflikt = shouldThrow<ContentConflictException> {
            service.patchContent(id, patch(baseVersion = 6))
        }

        konflikt.currentVersion shouldBe 7
        konflikt.opsSinceBase shouldBe listOf(LineOp.Replace(1, 1, listOf("fremd")))
        verify(exactly = 0) { documents.update(any(), any(), any(), any(), any()) }
    }

    // -----------------------------------------------------------------------
    // Wiederholung
    // -----------------------------------------------------------------------

    @Test
    fun `dieselbe Sequenznummer wirkt nur einmal`() {
        every { documents.findByIdOrNull(id) } returns document()
        expectUpdate("eins\nZWEI\ndrei")

        val erste = service.patchContent(id, patch(seq = 4))
        val zweite = service.patchContent(id, patch(seq = 4))

        zweite shouldBe erste
        verify(exactly = 1) { documents.update(any(), any(), any(), any(), any()) }
    }

    @Test
    fun `ein anderer Client teilt die Sequenznummer nicht`() {
        every { documents.findByIdOrNull(id) } returns document()
        expectUpdate("eins\nZWEI\ndrei")

        service.patchContent(id, patch(seq = 4, clientId = "anna"))
        service.patchContent(id, patch(seq = 4, clientId = "ben"))

        verify(exactly = 2) { documents.update(any(), any(), any(), any(), any()) }
    }

    @Test
    fun `eine veraltete Sequenznummer wird nicht angewendet`() {
        every { documents.findByIdOrNull(id) } returns document()
        expectUpdate("eins\nZWEI\ndrei")
        service.patchContent(id, patch(seq = 4))

        shouldThrow<StalePatchSequenceException> { service.patchContent(id, patch(seq = 3)) }
    }

    // -----------------------------------------------------------------------
    // Nicht anwendbar
    // -----------------------------------------------------------------------

    @Test
    fun `eine falsche Pruefsumme wird nicht angewendet`() {
        every { documents.findByIdOrNull(id) } returns document()

        shouldThrow<DiffNotApplicableException> {
            service.patchContent(id, patch(checksum = LineDiff.checksum("etwas anderes")))
        }
        verify(exactly = 0) { documents.update(any(), any(), any(), any(), any()) }
    }

    @Test
    fun `eine verdichtete Basisversion laesst sich nicht mehr rebasen`() {
        every { documents.findByIdOrNull(id) } returns document(version = 7)
        every { history.findVersion(id, 2) } returns null

        shouldThrow<DiffNotApplicableException> { service.patchContent(id, patch(baseVersion = 2)) }
    }

    @Test
    fun `eine Basisversion aus der Zukunft wird abgewiesen`() {
        every { documents.findByIdOrNull(id) } returns document(version = 7)

        shouldThrow<DiffNotApplicableException> { service.patchContent(id, patch(baseVersion = 9)) }
    }

    @Test
    fun `ein geloeschtes Dokument nennt den Weg zurueck`() {
        every { documents.findByIdOrNull(id) } returns null
        every { history.exists(id) } returns true

        val ex = shouldThrow<DocumentDeletedException> { service.patchContent(id, patch()) }
        ex.message!!.contains("restore") shouldBe true
    }

    @Test
    fun `eine gaenzlich unbekannte UUID ist schlicht nicht gefunden`() {
        every { documents.findByIdOrNull(id) } returns null
        every { history.exists(id) } returns false

        shouldThrow<DocumentNotFoundException> { service.patchContent(id, patch()) }
    }

    // -----------------------------------------------------------------------
    // Grenzen
    // -----------------------------------------------------------------------

    @Test
    fun `zu viele Operationen werden abgewiesen, bevor irgendetwas geschieht`() {
        val zuViele = (0..3).map { LineOp.Insert(0, listOf("x")) }

        shouldThrow<InvalidPatchException> { service.patchContent(id, patch(ops = zuViele)) }
        verify(exactly = 0) { documents.findByIdOrNull(any()) }
    }

    @Test
    fun `ein zu langes Ergebnis wird abgewiesen`() {
        every { documents.findByIdOrNull(id) } returns document()

        shouldThrow<InvalidPatchException> {
            service.patchContent(id, patch(ops = listOf(LineOp.Insert(0, listOf("x".repeat(60))))))
        }
        verify(exactly = 0) { documents.update(any(), any(), any(), any(), any()) }
    }

    // -----------------------------------------------------------------------
    // Änderungsfeed
    // -----------------------------------------------------------------------

    @Test
    fun `ohne Aenderung liefert der Feed nichts`() {
        every { history.exists(id) } returns true
        every { history.findLatest(id) } returns historyEntry(basis, 7)

        service.changesSince(id, since = 7, wait = Duration.ZERO) shouldBe null
    }

    @Test
    fun `der Feed liefert das kumulierte Diff seit der bekannten Version`() {
        every { history.exists(id) } returns true
        every { history.findLatest(id) } returns historyEntry("eins\nZWEI\ndrei", 9)
        every { history.findVersion(id, 7) } returns historyEntry(basis, 7)
        every { history.findAfterVersion(id, 7) } returns listOf(
            historyEntry("eins\nzwischendrin\ndrei", 8),
            historyEntry("eins\nZWEI\ndrei", 9),
        )

        val feed = service.changesSince(id, since = 7, wait = Duration.ZERO)!!

        feed.fromVersion shouldBe 7
        feed.currentVersion shouldBe 9
        feed.ops shouldBe listOf(LineOp.Replace(1, 1, listOf("ZWEI")))
        feed.content shouldBe null
        feed.events.map { it.version } shouldBe listOf(8L, 9L)
    }

    @Test
    fun `eine verdichtete Basis liefert den Volltext statt eines Diffs`() {
        every { history.exists(id) } returns true
        every { history.findLatest(id) } returns historyEntry("neu", 9)
        every { history.findVersion(id, 2) } returns null
        every { history.findAfterVersion(id, 2) } returns emptyList()

        val feed = service.changesSince(id, since = 2, wait = Duration.ZERO)!!

        feed.fromVersion shouldBe null
        feed.ops shouldBe null
        feed.content shouldBe "neu"
    }

    @Test
    fun `der Feed nennt den Absender jeder Aenderung`() {
        every { history.exists(id) } returns true
        every { history.findLatest(id) } returns historyEntry("neu", 8)
        every { history.findVersion(id, 7) } returns historyEntry(basis, 7)
        every { history.findAfterVersion(id, 7) } returns listOf(
            historyEntry("neu", 8).copy(author = ChangeAuthor("c-1", "Anna")),
        )

        service.changesSince(id, since = 7, wait = Duration.ZERO)!!.events shouldBe listOf(
            ChangeEvent(8, ChangeType.UPDATED, ChangeAuthor("c-1", "Anna")),
        )
    }

    @Test
    fun `ein geloeschtes Dokument hat weiterhin einen Feed`() {
        // Sonst käme ausgerechnet das DELETED-Ereignis nie an.
        every { history.exists(id) } returns true
        every { history.findLatest(id) } returns
            historyEntry(basis, 8).copy(changeType = ChangeType.DELETED)
        every { history.findVersion(id, 7) } returns historyEntry(basis, 7)
        every { history.findAfterVersion(id, 7) } returns listOf(
            historyEntry(basis, 8).copy(changeType = ChangeType.DELETED),
        )

        val feed = service.changesSince(id, since = 7, wait = Duration.ZERO)!!

        feed.events.single().changeType shouldBe ChangeType.DELETED
    }

    @Test
    fun `eine gaenzlich unbekannte UUID hat keinen Feed`() {
        every { history.exists(id) } returns false

        shouldThrow<DocumentNotFoundException> {
            service.changesSince(id, since = 0, wait = Duration.ZERO)
        }
    }

    @Test
    fun `die Wartezeit wird serverseitig geklemmt`() {
        // maxWait steht in diesem Test auf 200 ms; ein Client darf keine
        // beliebig lange Verbindung binden.
        every { history.exists(id) } returns true
        every { history.findLatest(id) } returns historyEntry(basis, 7)

        val start = System.nanoTime()
        service.changesSince(id, since = 7, wait = Duration.ofSeconds(30)) shouldBe null
        val dauer = Duration.ofNanos(System.nanoTime() - start)

        (dauer < Duration.ofSeconds(5)) shouldBe true
    }

    private fun historyEntry(content: String, version: Long) = DocumentHistoryEntry(
        documentId = id,
        version = version,
        title = "Plan",
        content = content,
        changeType = ChangeType.UPDATED,
        timestamp = OffsetDateTime.parse("2026-01-01T12:00:00Z"),
        milestone = false,
    )
}
