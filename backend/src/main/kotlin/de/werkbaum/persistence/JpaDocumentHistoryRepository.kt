package de.werkbaum.persistence

import de.werkbaum.domain.DocumentHistoryEntry
import de.werkbaum.repository.DocumentHistoryRepository
import org.springframework.stereotype.Repository
import java.time.OffsetDateTime
import java.util.UUID

@Repository
class JpaDocumentHistoryRepository(
    private val jpa: DocumentHistoryJpaRepository,
) : DocumentHistoryRepository {

    override fun append(entry: DocumentHistoryEntry) {
        jpa.save(DocumentHistoryEntity.fromDomain(entry))
    }

    override fun exists(documentId: UUID): Boolean = jpa.existsByDocumentId(documentId)

    override fun findVersion(documentId: UUID, version: Long): DocumentHistoryEntry? =
        jpa.findFirstByDocumentIdAndVersionOrderByIdDesc(documentId, version)?.toDomain()

    override fun findLatest(documentId: UUID): DocumentHistoryEntry? =
        jpa.findFirstByDocumentIdOrderByIdDesc(documentId)?.toDomain()

    override fun findOldest(documentId: UUID): DocumentHistoryEntry? =
        jpa.findFirstByDocumentIdOrderByIdAsc(documentId)?.toDomain()

    override fun maxVersion(documentId: UUID): Long? = jpa.maxVersion(documentId)

    override fun findAfterVersion(documentId: UUID, version: Long): List<DocumentHistoryEntry> =
        jpa.findByDocumentIdAndVersionGreaterThanOrderByIdAsc(documentId, version).map { it.toDomain() }

    override fun findMilestones(documentId: UUID): List<DocumentHistoryEntry> =
        jpa.findByDocumentIdAndMilestoneTrueOrderByIdAsc(documentId).map { it.toDomain() }

    override fun promoteToMilestone(documentId: UUID, version: Long) {
        jpa.promoteToMilestone(documentId, version)
    }

    override fun compact(documentId: UUID, olderThan: OffsetDateTime): Int =
        jpa.deleteSyncVersionsOlderThan(documentId, olderThan)

    override fun clear() = jpa.deleteAll()
}
