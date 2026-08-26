package com.example.editor.persistence

import com.example.editor.domain.DocumentHistoryEntry
import com.example.editor.repository.DocumentHistoryRepository
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
class JpaDocumentHistoryRepository(
    private val jpa: DocumentHistoryJpaRepository,
) : DocumentHistoryRepository {

    override fun append(entry: DocumentHistoryEntry) {
        jpa.save(DocumentHistoryEntity.fromDomain(entry))
    }

    override fun findByDocumentId(documentId: UUID): List<DocumentHistoryEntry> =
        jpa.findByDocumentIdOrderByIdAsc(documentId).map { it.toDomain() }

    override fun clear() = jpa.deleteAll()
}
