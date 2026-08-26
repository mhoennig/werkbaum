package com.example.editor.service

import com.example.editor.domain.ChangeType
import com.example.editor.domain.Document
import com.example.editor.domain.DocumentHistoryEntry
import com.example.editor.repository.DocumentHistoryRepository
import com.example.editor.repository.DocumentRepository
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import io.mockk.slot
import io.mockk.verify
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

class DocumentServiceTest {

    private val fixedClock: Clock =
        Clock.fixed(Instant.parse("2026-01-01T12:00:00Z"), ZoneOffset.UTC)

    private val repository = mockk<DocumentRepository>()
    private val historyRepository = mockk<DocumentHistoryRepository>(relaxUnitFun = true)
    private val service = DocumentService(repository, historyRepository, fixedClock)

    private fun sampleDocument(
        id: UUID = UUID.randomUUID(),
        version: Long = 1,
    ) = Document(
        id = id,
        title = "Titel",
        content = "Inhalt",
        version = version,
        createdAt = OffsetDateTime.now(fixedClock),
        updatedAt = OffsetDateTime.now(fixedClock),
    )

    private fun historyEntry(
        id: UUID,
        version: Long,
        changeType: ChangeType,
        title: String = "Titel v$version",
        content: String = "Inhalt v$version",
    ) = DocumentHistoryEntry(
        documentId = id,
        version = version,
        title = title,
        content = content,
        changeType = changeType,
        timestamp = OffsetDateTime.now(fixedClock),
    )

    @Test
    fun `create legt Dokument an und schreibt CREATED-Historieneintrag`() {
        val saved = slot<Document>()
        every { repository.save(capture(saved)) } answers { saved.captured }
        val historyEntry = slot<DocumentHistoryEntry>()
        every { historyRepository.append(capture(historyEntry)) } just runs

        val result = service.create(title = "Notizen", content = "Hallo")

        assertEquals(1, result.version)
        assertEquals(ChangeType.CREATED, historyEntry.captured.changeType)
        assertEquals(result.id, historyEntry.captured.documentId)
        assertEquals("Hallo", historyEntry.captured.content)
    }

    @Test
    fun `update inkrementiert Version und schreibt UPDATED-Historieneintrag`() {
        val doc = sampleDocument(version = 3)
        every { repository.findById(doc.id) } returns doc
        val saved = slot<Document>()
        every { repository.save(capture(saved)) } answers { saved.captured }
        val historyEntry = slot<DocumentHistoryEntry>()
        every { historyRepository.append(capture(historyEntry)) } just runs

        val result = service.update(doc.id, title = "Neu", content = "Neuer Inhalt")

        assertEquals(4, result.version)
        assertEquals(ChangeType.UPDATED, historyEntry.captured.changeType)
        assertEquals(4, historyEntry.captured.version)
    }

    @Test
    fun `delete entfernt Dokument und schreibt DELETED-Tombstone`() {
        val doc = sampleDocument(version = 2)
        every { repository.findById(doc.id) } returns doc
        every { repository.deleteById(doc.id) } returns true
        val historyEntry = slot<DocumentHistoryEntry>()
        every { historyRepository.append(capture(historyEntry)) } just runs

        service.delete(doc.id)

        verify(exactly = 1) { repository.deleteById(doc.id) }
        assertEquals(ChangeType.DELETED, historyEntry.captured.changeType)
        assertEquals(3, historyEntry.captured.version)
    }

    @Test
    fun `delete wirft Exception bei unbekannter ID`() {
        val id = UUID.randomUUID()
        every { repository.findById(id) } returns null

        assertThrows(DocumentNotFoundException::class.java) { service.delete(id) }
    }

    @Test
    fun `history liefert Eintraege auch ohne existierendes Dokument`() {
        val id = UUID.randomUUID()
        val entries = listOf(
            historyEntry(id, 1, ChangeType.CREATED),
            historyEntry(id, 2, ChangeType.DELETED),
        )
        every { historyRepository.findByDocumentId(id) } returns entries

        assertEquals(entries, service.history(id))
    }

    @Test
    fun `history wirft Exception bei gaenzlich unbekannter ID`() {
        val id = UUID.randomUUID()
        every { historyRepository.findByDocumentId(id) } returns emptyList()

        assertThrows(DocumentNotFoundException::class.java) { service.history(id) }
    }

    @Test
    fun `restore stellt geloeschtes Dokument mit letztem Stand wieder her`() {
        val id = UUID.randomUUID()
        every { historyRepository.findByDocumentId(id) } returns listOf(
            historyEntry(id, 1, ChangeType.CREATED),
            historyEntry(id, 2, ChangeType.UPDATED),
            historyEntry(id, 3, ChangeType.DELETED),
        )
        every { repository.findById(id) } returns null
        val saved = slot<Document>()
        every { repository.save(capture(saved)) } answers { saved.captured }
        val historyEntry = slot<DocumentHistoryEntry>()
        every { historyRepository.append(capture(historyEntry)) } just runs

        val result = service.restore(id)

        assertEquals(id, result.id)
        assertEquals("Titel v2", result.title)
        assertEquals("Inhalt v2", result.content)
        assertEquals(4, result.version)
        assertEquals(ChangeType.RESTORED, historyEntry.captured.changeType)
    }

    @Test
    fun `restore mit Zielversion funktioniert als Rollback fuer existierendes Dokument`() {
        val id = UUID.randomUUID()
        val existing = sampleDocument(id = id, version = 3)
        every { historyRepository.findByDocumentId(id) } returns listOf(
            historyEntry(id, 1, ChangeType.CREATED),
            historyEntry(id, 2, ChangeType.UPDATED),
            historyEntry(id, 3, ChangeType.UPDATED),
        )
        every { repository.findById(id) } returns existing
        val saved = slot<Document>()
        every { repository.save(capture(saved)) } answers { saved.captured }
        every { historyRepository.append(any()) } just runs

        val result = service.restore(id, targetVersion = 1)

        assertEquals("Titel v1", result.title)
        assertEquals(4, result.version)
    }

    @Test
    fun `restore ohne Zielversion wirft Konflikt wenn Dokument noch existiert`() {
        val id = UUID.randomUUID()
        every { historyRepository.findByDocumentId(id) } returns listOf(
            historyEntry(id, 1, ChangeType.CREATED),
        )
        every { repository.findById(id) } returns sampleDocument(id = id)

        assertThrows(DocumentConflictException::class.java) { service.restore(id) }
    }

    @Test
    fun `restore wirft Exception bei unbekannter ID`() {
        val id = UUID.randomUUID()
        every { historyRepository.findByDocumentId(id) } returns emptyList()

        assertThrows(DocumentNotFoundException::class.java) { service.restore(id) }
    }

    @Test
    fun `findById wirft Exception bei unbekannter ID`() {
        val id = UUID.randomUUID()
        every { repository.findById(id) } returns null

        assertThrows(DocumentNotFoundException::class.java) { service.findById(id) }
    }

    @Test
    fun `findAll delegiert an das Repository`() {
        val docs = listOf(sampleDocument(), sampleDocument())
        every { repository.findAll() } returns docs

        assertEquals(docs, service.findAll())
    }
}
