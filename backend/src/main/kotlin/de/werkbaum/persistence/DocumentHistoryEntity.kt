package de.werkbaum.persistence

import de.werkbaum.domain.ChangeAuthor
import de.werkbaum.domain.ChangeType
import de.werkbaum.domain.DocumentHistoryEntry
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.OffsetDateTime
import java.util.UUID

@Entity
@Table(name = "document_history")
class DocumentHistoryEntity(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "document_id", nullable = false)
    val documentId: UUID,

    @Column(nullable = false)
    val version: Long,

    @Column(nullable = false)
    val title: String,

    @Column(nullable = false, columnDefinition = "text")
    val content: String,

    @Enumerated(EnumType.STRING)
    @Column(name = "change_type", nullable = false, length = 16)
    val changeType: ChangeType,

    @Column(name = "change_time", nullable = false)
    val changeTime: OffsetDateTime,

    /** Meilenstein (nutzersichtbar, bleibt) oder Sync-Version (wird verdichtet) – D76. */
    @Column(nullable = false)
    var milestone: Boolean = true,

    @Column(name = "client_id", length = 64)
    val clientId: String? = null,

    @Column(name = "display_name", length = 64)
    val displayName: String? = null,
) {
    fun toDomain() = DocumentHistoryEntry(
        documentId = documentId,
        version = version,
        title = title,
        content = content,
        changeType = changeType,
        timestamp = changeTime,
        milestone = milestone,
        author = clientId?.let { ChangeAuthor(it, displayName) },
    )

    companion object {
        fun fromDomain(entry: DocumentHistoryEntry) = DocumentHistoryEntity(
            documentId = entry.documentId,
            version = entry.version,
            title = entry.title,
            content = entry.content,
            changeType = entry.changeType,
            changeTime = entry.timestamp,
            milestone = entry.milestone,
            clientId = entry.author?.clientId,
            displayName = entry.author?.displayName,
        )
    }
}
