package de.werkbaum.persistence

import de.werkbaum.domain.Document
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.OffsetDateTime
import java.util.UUID

@Entity
@Table(name = "document")
class DocumentEntity(
    @Id
    val id: UUID,

    @Column(nullable = false)
    var title: String,

    @Column(nullable = false, columnDefinition = "text")
    var content: String,

    @Column(nullable = false)
    var version: Long,

    @Column(name = "created_at", nullable = false)
    var createdAt: OffsetDateTime,

    @Column(name = "updated_at", nullable = false)
    var updatedAt: OffsetDateTime,
) {
    fun toDomain() = Document(
        id = id,
        title = title,
        content = content,
        version = version,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

    companion object {
        fun fromDomain(document: Document) = DocumentEntity(
            id = document.id,
            title = document.title,
            content = document.content,
            version = document.version,
            createdAt = document.createdAt,
            updatedAt = document.updatedAt,
        )
    }
}
