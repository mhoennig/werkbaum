package de.werkbaum.service

import de.werkbaum.diff.DiffNotApplicableException
import de.werkbaum.diff.LineDiff
import de.werkbaum.diff.LineOp
import de.werkbaum.domain.ChangeAuthor
import de.werkbaum.domain.ChangeType
import de.werkbaum.domain.ContentPatch
import de.werkbaum.domain.ContentPatchOutcome
import de.werkbaum.domain.Document
import de.werkbaum.domain.DocumentHistoryEntry
import de.werkbaum.repository.DocumentHistoryRepository
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.junit.jupiter.api.Test
import java.time.OffsetDateTime
import java.util.UUID

class LiveEditingServiceTest {

    private val id = UUID.randomUUID()
    private val documents = mockk<DocumentService>()
    private val history = mockk<DocumentHistoryRepository>(relaxed = true)
    private val properties = LiveEditingProperties(maxOps = 3, maxContentLength = 40)
    private val service = LiveEditingService(documents, history, properties)

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
