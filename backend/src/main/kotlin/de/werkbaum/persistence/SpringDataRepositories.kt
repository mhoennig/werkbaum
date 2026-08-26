package de.werkbaum.persistence

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.OffsetDateTime
import java.util.UUID

interface DocumentJpaRepository : JpaRepository<DocumentEntity, UUID>

interface DocumentHistoryJpaRepository : JpaRepository<DocumentHistoryEntity, Long> {

    fun existsByDocumentId(documentId: UUID): Boolean

    fun findFirstByDocumentIdAndVersionOrderByIdDesc(
        documentId: UUID,
        version: Long,
    ): DocumentHistoryEntity?

    fun findFirstByDocumentIdOrderByIdDesc(documentId: UUID): DocumentHistoryEntity?

    fun findFirstByDocumentIdOrderByIdAsc(documentId: UUID): DocumentHistoryEntity?

    fun findByDocumentIdAndMilestoneTrueOrderByIdAsc(documentId: UUID): List<DocumentHistoryEntity>

    fun findByDocumentIdAndVersionGreaterThanOrderByIdAsc(
        documentId: UUID,
        version: Long,
    ): List<DocumentHistoryEntity>

    @Query("select max(e.version) from DocumentHistoryEntity e where e.documentId = :documentId")
    fun maxVersion(@Param("documentId") documentId: UUID): Long?

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
        """
        update DocumentHistoryEntity e set e.milestone = true
        where e.documentId = :documentId and e.version = :version
        """
    )
    fun promoteToMilestone(
        @Param("documentId") documentId: UUID,
        @Param("version") version: Long,
    ): Int

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(
        """
        delete from DocumentHistoryEntity e
        where e.documentId = :documentId and e.milestone = false and e.changeTime < :cutoff
        """
    )
    fun deleteSyncVersionsOlderThan(
        @Param("documentId") documentId: UUID,
        @Param("cutoff") cutoff: OffsetDateTime,
    ): Int
}
