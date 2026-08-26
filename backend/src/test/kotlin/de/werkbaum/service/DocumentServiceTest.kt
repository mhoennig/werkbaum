package de.werkbaum.service

import de.werkbaum.domain.ChangeType
import de.werkbaum.domain.Document
import de.werkbaum.domain.DocumentHistoryEntry
import de.werkbaum.repository.DocumentHistoryRepository
import de.werkbaum.repository.DocumentRepository
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.CapturingSlot
import io.mockk.slot
import io.mockk.verify
import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.UUID

class DocumentServiceTest {

    /** Uhr, die sich im Test weiterstellen lässt – für die Schreibpause-Regel. */
    private class TestClock(var moment: Instant) : Clock() {
        override fun getZone(): ZoneId = ZoneOffset.UTC
        override fun withZone(zone: ZoneId?): Clock = this
        override fun instant(): Instant = moment
    }

    private val clock = TestClock(Instant.parse("2026-01-01T12:00:00Z"))
    private val properties = LiveEditingProperties(
        milestonePause = Duration.ofSeconds(30),
        syncRetention = Duration.ofHours(1),
    )

    private val repository = mockk<DocumentRepository>()
    private val historyRepository = mockk<DocumentHistoryRepository>(relaxed = true)
    private val notifier = ChangeNotifier()
    private val service =
        DocumentService(repository, historyRepository, clock, properties, notifier)

    private fun sampleDocument(
        id: UUID = UUID.randomUUID(),
        version: Long = 1,
    ) = Document(
        id = id,
        title = "Titel",
        content = "Inhalt",
        version = version,
        createdAt = OffsetDateTime.now(clock),
        updatedAt = OffsetDateTime.now(clock),
    )

    private fun historyEntry(
        id: UUID,
        version: Long,
        changeType: ChangeType,
        title: String = "Titel v$version",
        content: String = "Inhalt v$version",
        milestone: Boolean = true,
        timestamp: OffsetDateTime = OffsetDateTime.now(clock),
    ) = DocumentHistoryEntry(
        documentId = id,
        version = version,
        title = title,
        content = content,
        changeType = changeType,
        timestamp = timestamp,
        milestone = milestone,
    )

    private fun captureAppended(): CapturingSlot<DocumentHistoryEntry> {
        val slot = slot<DocumentHistoryEntry>()
        every { historyRepository.append(capture(slot)) } returns Unit
        return slot
    }

    // -----------------------------------------------------------------------
    // Anlegen, Ändern, Löschen
    // -----------------------------------------------------------------------

    @Test
    fun `create legt Dokument an und schreibt CREATED-Historieneintrag`() {
        val saved = slot<Document>()
        every { repository.save(capture(saved)) } answers { saved.captured }
        val entry = captureAppended()

        val result = service.create(title = "Notizen", content = "Hallo")

        result.version shouldBe 1
        entry.captured.changeType shouldBe ChangeType.CREATED
        entry.captured.documentId shouldBe result.id
        entry.captured.content shouldBe "Hallo"
    }

    @Test
    fun `update inkrementiert Version und schreibt UPDATED-Historieneintrag`() {
        val doc = sampleDocument(version = 3)
        every { repository.findById(doc.id) } returns doc
        val saved = slot<Document>()
        every { repository.save(capture(saved)) } answers { saved.captured }
        val entry = captureAppended()

        val result = service.update(doc.id, title = "Neu", content = "Neuer Inhalt")

        result.version shouldBe 4
        entry.captured.changeType shouldBe ChangeType.UPDATED
        entry.captured.version shouldBe 4
    }

    @Test
    fun `delete entfernt Dokument und schreibt DELETED-Tombstone`() {
        val doc = sampleDocument(version = 2)
        every { repository.findById(doc.id) } returns doc
        every { repository.deleteById(doc.id) } returns true
        val entry = captureAppended()

        service.delete(doc.id)

        verify(exactly = 1) { repository.deleteById(doc.id) }
        entry.captured.changeType shouldBe ChangeType.DELETED
        entry.captured.version shouldBe 3
    }

    @Test
    fun `delete wirft Exception bei unbekannter ID`() {
        val id = UUID.randomUUID()
        every { repository.findById(id) } returns null

        shouldThrow<DocumentNotFoundException> { service.delete(id) }
    }

    // -----------------------------------------------------------------------
    // Zwei Ebenen: Meilensteine und Sync-Versionen
    // -----------------------------------------------------------------------

    @Test
    fun `ein gewoehnliches Update ist ein Meilenstein`() {
        val doc = sampleDocument(version = 1)
        every { repository.findById(doc.id) } returns doc
        every { repository.save(any()) } answers { firstArg() }
        val entry = captureAppended()

        service.update(doc.id, "T", "C")

        entry.captured.milestone shouldBe true
    }

    @Test
    fun `ein getaktetes Update schreibt eine Sync-Version`() {
        val doc = sampleDocument(version = 1)
        every { repository.findById(doc.id) } returns doc
        every { repository.save(any()) } answers { firstArg() }
        val entry = captureAppended()

        service.update(doc.id, "T", "C", milestone = false)

        entry.captured.milestone shouldBe false
    }

    @Test
    fun `strukturelle Aenderungen sind immer Meilensteine`() {
        val doc = sampleDocument(version = 1)
        every { repository.findById(doc.id) } returns doc
        every { repository.deleteById(doc.id) } returns true
        val entry = captureAppended()

        service.delete(doc.id)

        entry.captured.milestone shouldBe true
    }

    @Test
    fun `die letzte Version vor einer Schreibpause wird nachtraeglich Meilenstein`() {
        val doc = sampleDocument(version = 5)
        every { repository.findById(doc.id) } returns doc
        every { repository.save(any()) } answers { firstArg() }
        every { historyRepository.findLatest(doc.id) } returns
            historyEntry(doc.id, 5, ChangeType.UPDATED, milestone = false)

        clock.moment = clock.moment.plusSeconds(31)
        service.update(doc.id, "T", "C", milestone = false)

        verify(exactly = 1) { historyRepository.promoteToMilestone(doc.id, 5) }
    }

    @Test
    fun `innerhalb der Schreibpause wird nichts befoerdert`() {
        val doc = sampleDocument(version = 5)
        every { repository.findById(doc.id) } returns doc
        every { repository.save(any()) } answers { firstArg() }
        every { historyRepository.findLatest(doc.id) } returns
            historyEntry(doc.id, 5, ChangeType.UPDATED, milestone = false)

        clock.moment = clock.moment.plusSeconds(29)
        service.update(doc.id, "T", "C", milestone = false)

        verify(exactly = 0) { historyRepository.promoteToMilestone(any(), any()) }
    }

    @Test
    fun `ein Meilenstein wird nicht noch einmal befoerdert`() {
        val doc = sampleDocument(version = 5)
        every { repository.findById(doc.id) } returns doc
        every { repository.save(any()) } answers { firstArg() }
        every { historyRepository.findLatest(doc.id) } returns
            historyEntry(doc.id, 5, ChangeType.UPDATED, milestone = true)

        clock.moment = clock.moment.plusSeconds(3600)
        service.update(doc.id, "T", "C", milestone = false)

        verify(exactly = 0) { historyRepository.promoteToMilestone(any(), any()) }
    }

    @Test
    fun `nach jeder Aenderung wird jenseits der Aufbewahrungsfrist verdichtet`() {
        val doc = sampleDocument(version = 1)
        every { repository.findById(doc.id) } returns doc
        every { repository.save(any()) } answers { firstArg() }

        service.update(doc.id, "T", "C")

        verify(exactly = 1) {
            historyRepository.compact(doc.id, OffsetDateTime.now(clock).minusHours(1))
        }
    }

    // -----------------------------------------------------------------------
    // Historie
    // -----------------------------------------------------------------------

    @Test
    fun `history liefert die Meilensteine, auch ohne existierendes Dokument`() {
        val id = UUID.randomUUID()
        val meilensteine = listOf(
            historyEntry(id, 1, ChangeType.CREATED),
            historyEntry(id, 2, ChangeType.DELETED),
        )
        every { historyRepository.exists(id) } returns true
        every { historyRepository.findMilestones(id) } returns meilensteine
        every { historyRepository.findLatest(id) } returns meilensteine.last()

        service.history(id) shouldBe meilensteine
    }

    @Test
    fun `history zeigt den juengsten Stand auch als noch nicht befoerderte Sync-Version`() {
        // Sonst fehlte in einer laufenden Schreibphase ausgerechnet der aktuelle Stand.
        val id = UUID.randomUUID()
        val meilenstein = historyEntry(id, 1, ChangeType.CREATED)
        val laufend = historyEntry(id, 7, ChangeType.UPDATED, milestone = false)
        every { historyRepository.exists(id) } returns true
        every { historyRepository.findMilestones(id) } returns listOf(meilenstein)
        every { historyRepository.findLatest(id) } returns laufend

        service.history(id) shouldBe listOf(meilenstein, laufend)
    }

    @Test
    fun `history wirft Exception bei gaenzlich unbekannter ID`() {
        val id = UUID.randomUUID()
        every { historyRepository.exists(id) } returns false

        shouldThrow<DocumentNotFoundException> { service.history(id) }
    }

    // -----------------------------------------------------------------------
    // Wiederherstellen und Rückfall
    // -----------------------------------------------------------------------

    @Test
    fun `restore stellt geloeschtes Dokument aus dem Tombstone wieder her`() {
        val id = UUID.randomUUID()
        every { historyRepository.exists(id) } returns true
        every { historyRepository.findLatest(id) } returns
            historyEntry(id, 3, ChangeType.DELETED, title = "Titel v2", content = "Inhalt v2")
        every { historyRepository.maxVersion(id) } returns 3
        every { historyRepository.findOldest(id) } returns historyEntry(id, 1, ChangeType.CREATED)
        every { repository.findById(id) } returns null
        val saved = slot<Document>()
        every { repository.save(capture(saved)) } answers { saved.captured }
        val entry = captureAppended()

        val result = service.restore(id)

        result.id shouldBe id
        result.title shouldBe "Titel v2"
        result.content shouldBe "Inhalt v2"
        result.version shouldBe 4
        entry.captured.changeType shouldBe ChangeType.RESTORED
    }

    @Test
    fun `restore mit Zielversion ist bei lebendem Dokument ein Rueckfall`() {
        val id = UUID.randomUUID()
        val existing = sampleDocument(id = id, version = 3)
        every { historyRepository.exists(id) } returns true
        every { historyRepository.findVersion(id, 1) } returns
            historyEntry(id, 1, ChangeType.CREATED)
        every { historyRepository.maxVersion(id) } returns 3
        every { repository.findById(id) } returns existing
        every { repository.save(any()) } answers { firstArg() }
        val entry = captureAppended()

        val result = service.restore(id, targetVersion = 1)

        result.title shouldBe "Titel v1"
        result.version shouldBe 4
        // RESTORED hiesse "die Sperre ist aufgehoben" - hier gab es nie eine.
        entry.captured.changeType shouldBe ChangeType.ROLLED_BACK
    }

    @Test
    fun `eine verdichtete Zielversion ist nicht mehr anzusteuern`() {
        val id = UUID.randomUUID()
        every { historyRepository.exists(id) } returns true
        every { historyRepository.findVersion(id, 42) } returns null
        every { repository.findById(id) } returns sampleDocument(id = id)

        shouldThrow<DocumentNotFoundException> { service.restore(id, targetVersion = 42) }
    }

    @Test
    fun `restore ohne Zielversion wirft Konflikt wenn Dokument noch existiert`() {
        val id = UUID.randomUUID()
        every { historyRepository.exists(id) } returns true
        every { repository.findById(id) } returns sampleDocument(id = id)

        shouldThrow<DocumentConflictException> { service.restore(id) }
    }

    @Test
    fun `restore wirft Exception bei unbekannter ID`() {
        val id = UUID.randomUUID()
        every { historyRepository.exists(id) } returns false

        shouldThrow<DocumentNotFoundException> { service.restore(id) }
    }

    // -----------------------------------------------------------------------

    @Test
    fun `findById wirft Exception bei unbekannter ID`() {
        val id = UUID.randomUUID()
        every { repository.findById(id) } returns null

        shouldThrow<DocumentNotFoundException> { service.findById(id) }
    }

    @Test
    fun `findAll delegiert an das Repository`() {
        val docs = listOf(sampleDocument(), sampleDocument())
        every { repository.findAll() } returns docs

        service.findAll() shouldBe docs
    }
}
