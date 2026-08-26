package com.example.editor.service

import com.example.editor.domain.ChangeType
import com.example.editor.domain.Document
import com.example.editor.domain.DocumentHistoryEntry
import com.example.editor.repository.DocumentHistoryRepository
import com.example.editor.repository.DocumentRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.OffsetDateTime
import java.util.UUID

@Service
@Transactional
class DocumentService(
    private val repository: DocumentRepository,
    private val historyRepository: DocumentHistoryRepository,
    private val clock: Clock,
) {

    fun findAll(): List<Document> = repository.findAll()

    fun findById(id: UUID): Document =
        repository.findById(id) ?: throw DocumentNotFoundException(id)

    fun create(title: String, content: String): Document {
        val now = OffsetDateTime.now(clock)
        val document = Document(
            id = UUID.randomUUID(),
            title = title,
            content = content,
            version = 1,
            createdAt = now,
            updatedAt = now,
        )
        repository.save(document)
        recordHistory(document, ChangeType.CREATED)
        return document
    }

    fun update(id: UUID, title: String, content: String): Document {
        val existing = findById(id)
        val updated = existing.copy(
            title = title,
            content = content,
            version = existing.version + 1,
            updatedAt = OffsetDateTime.now(clock),
        )
        repository.save(updated)
        recordHistory(updated, ChangeType.UPDATED)
        return updated
    }

    fun delete(id: UUID) {
        val existing = findById(id)
        repository.deleteById(id)
        // Tombstone-Eintrag: konserviert den letzten Stand und überlebt das DELETE.
        recordHistory(
            existing.copy(
                version = existing.version + 1,
                updatedAt = OffsetDateTime.now(clock),
            ),
            ChangeType.DELETED,
        )
    }

    /**
     * Historie eines Dokuments – funktioniert auch für bereits gelöschte
     * Dokumente. 404 nur, wenn die UUID gänzlich unbekannt ist.
     */
    fun history(id: UUID): List<DocumentHistoryEntry> {
        val entries = historyRepository.findByDocumentId(id)
        if (entries.isEmpty()) throw DocumentNotFoundException(id)
        return entries
    }

    /**
     * Stellt ein Dokument unter derselben UUID wieder her.
     *
     * - Ohne [targetVersion]: letzter inhaltlicher Stand vor dem Löschen.
     *   Existiert das Dokument noch, gibt es einen Konflikt (409).
     * - Mit [targetVersion]: Inhalt dieser Version wird als neue Version
     *   übernommen – funktioniert auch als Rollback für existierende Dokumente.
     */
    fun restore(id: UUID, targetVersion: Long? = null): Document {
        val entries = historyRepository.findByDocumentId(id)
        if (entries.isEmpty()) throw DocumentNotFoundException(id)

        val existing = repository.findById(id)
        if (existing != null && targetVersion == null) {
            throw DocumentConflictException(
                "Dokument $id existiert noch; zum Rollback bitte eine Zielversion angeben"
            )
        }

        val snapshot = if (targetVersion != null) {
            entries.lastOrNull { it.version == targetVersion && it.changeType != ChangeType.DELETED }
                ?: throw DocumentNotFoundException(id)
        } else {
            entries.last { it.changeType != ChangeType.DELETED }
        }

        val now = OffsetDateTime.now(clock)
        val lastVersion = maxOf(entries.maxOf { it.version }, existing?.version ?: 0)
        val restored = Document(
            id = id,
            title = snapshot.title,
            content = snapshot.content,
            version = lastVersion + 1,
            createdAt = existing?.createdAt ?: entries.first().timestamp,
            updatedAt = now,
        )
        repository.save(restored)
        recordHistory(restored, ChangeType.RESTORED)
        return restored
    }

    private fun recordHistory(document: Document, changeType: ChangeType) {
        historyRepository.append(
            DocumentHistoryEntry(
                documentId = document.id,
                version = document.version,
                title = document.title,
                content = document.content,
                changeType = changeType,
                timestamp = document.updatedAt,
            )
        )
    }
}
