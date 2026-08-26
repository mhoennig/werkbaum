package com.example.editor.persistence

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface DocumentJpaRepository : JpaRepository<DocumentEntity, UUID>

interface DocumentHistoryJpaRepository : JpaRepository<DocumentHistoryEntity, Long> {
    fun findByDocumentIdOrderByIdAsc(documentId: UUID): List<DocumentHistoryEntity>
}
