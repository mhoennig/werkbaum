package com.example.editor.persistence

import com.example.editor.domain.Document
import com.example.editor.repository.DocumentRepository
import org.springframework.stereotype.Repository
import java.util.UUID

/**
 * JPA-Adapter fuer das fachliche Repository-Interface.
 * Ersetzt die fruehere In-Memory-Implementierung.
 */
@Repository
class JpaDocumentRepository(
    private val jpa: DocumentJpaRepository,
) : DocumentRepository {

    override fun findAll(): List<Document> =
        jpa.findAll().map { it.toDomain() }.sortedBy { it.createdAt }

    override fun findById(id: UUID): Document? =
        jpa.findById(id).map { it.toDomain() }.orElse(null)

    override fun save(document: Document): Document {
        jpa.save(DocumentEntity.fromDomain(document))
        return document
    }

    override fun deleteById(id: UUID): Boolean {
        if (!jpa.existsById(id)) return false
        jpa.deleteById(id)
        return true
    }

    override fun clear() = jpa.deleteAll()
}
