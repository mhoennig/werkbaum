package de.werkbaum.service

import de.werkbaum.domain.ChangeAuthor
import de.werkbaum.domain.ChangeType
import de.werkbaum.domain.Document
import de.werkbaum.domain.DocumentHistoryEntry
import de.werkbaum.repository.DocumentHistoryRepository
import de.werkbaum.repository.DocumentRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Duration
import java.time.OffsetDateTime
import java.util.UUID

@Service
@Transactional
class DocumentService(
    private val repository: DocumentRepository,
    private val historyRepository: DocumentHistoryRepository,
    private val clock: Clock,
    private val properties: LiveEditingProperties,
) {

    fun findAll(): List<Document> = repository.findAll()

    fun findById(id: UUID): Document =
        findByIdOrNull(id) ?: throw DocumentNotFoundException(id)

    /** Wie [findById], nur ohne Ausnahme – wenn der Aufrufer selbst unterscheiden will. */
    fun findByIdOrNull(id: UUID): Document? = repository.findById(id)

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

    /**
     * Ersetzt Titel und Inhalt vollständig.
     *
     * [milestone] `false` schreibt eine **Sync-Version** – gedacht für den
     * getakteten Strom des Live-Editings (D76), der sonst hunderte
     * nutzersichtbare Stände je Sitzung erzeugte. Der Vollersatz über die API
     * ist dagegen eine bewusste Handlung (Import, Reparatur) und bleibt
     * Meilenstein.
     */
    fun update(
        id: UUID,
        title: String,
        content: String,
        milestone: Boolean = true,
        author: ChangeAuthor? = null,
    ): Document {
        val existing = findById(id)
        val updated = existing.copy(
            title = title,
            content = content,
            version = existing.version + 1,
            updatedAt = OffsetDateTime.now(clock),
        )
        repository.save(updated)
        recordHistory(updated, ChangeType.UPDATED, milestone, author)
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
     * Die **nutzersichtbare** Historie: alle Meilensteine, älteste zuerst,
     * dazu immer der jüngste Stand. Sync-Versionen bleiben draußen – sie
     * tragen das Protokoll, nicht die Erzählung (D76).
     *
     * Funktioniert auch für bereits gelöschte Dokumente; 404 nur, wenn die
     * UUID gänzlich unbekannt ist.
     */
    fun history(id: UUID): List<DocumentHistoryEntry> {
        if (!historyRepository.exists(id)) throw DocumentNotFoundException(id)
        val milestones = historyRepository.findMilestones(id)
        // Die letzte Version einer noch laufenden Schreibphase ist noch kein
        // Meilenstein – sichtbar sein muss sie trotzdem.
        val latest = historyRepository.findLatest(id)
        return if (latest != null && milestones.none { it.version == latest.version }) {
            milestones + latest
        } else {
            milestones
        }
    }

    /**
     * Stellt ein Dokument unter derselben UUID wieder her.
     *
     * - Ohne [targetVersion]: letzter Stand vor dem Löschen ([ChangeType.RESTORED]).
     *   Existiert das Dokument noch, gibt es einen Konflikt (409).
     * - Mit [targetVersion]: Inhalt dieser Version wird als neue Version
     *   übernommen. Bei einem lebenden Dokument ist das ein Rückfall
     *   ([ChangeType.ROLLED_BACK]), kein Wiederherstellen – der Client hatte
     *   nie eine Sperre.
     *
     * Eine verdichtete Sync-Version ist nicht mehr anzusteuern (404). Das ist
     * die Zwei-Ebenen-Regel im Betrieb: Angeboten werden Meilensteine, und die
     * bleiben.
     */
    fun restore(id: UUID, targetVersion: Long? = null): Document {
        if (!historyRepository.exists(id)) throw DocumentNotFoundException(id)

        val existing = repository.findById(id)
        if (existing != null && targetVersion == null) {
            throw DocumentConflictException(
                "Dokument $id existiert noch; zum Rollback bitte eine Zielversion angeben"
            )
        }

        val snapshot = if (targetVersion != null) {
            historyRepository.findVersion(id, targetVersion)
                ?.takeIf { it.changeType != ChangeType.DELETED }
                ?: throw DocumentNotFoundException(id)
        } else {
            // Der Tombstone trägt den letzten Stand – er ist die verlässliche
            // Quelle, auch wenn die Version davor längst verdichtet wurde.
            historyRepository.findLatest(id) ?: throw DocumentNotFoundException(id)
        }

        val now = OffsetDateTime.now(clock)
        val lastVersion = maxOf(historyRepository.maxVersion(id) ?: 0, existing?.version ?: 0)
        val restored = Document(
            id = id,
            title = snapshot.title,
            content = snapshot.content,
            version = lastVersion + 1,
            createdAt = existing?.createdAt
                ?: historyRepository.findOldest(id)?.timestamp
                ?: now,
            updatedAt = now,
        )
        repository.save(restored)
        recordHistory(
            restored,
            if (existing != null) ChangeType.ROLLED_BACK else ChangeType.RESTORED,
        )
        return restored
    }

    /**
     * Schreibt einen Historieneintrag und hält dabei die zwei Ebenen instand:
     *
     * 1. War die vorige Version eine Sync-Version und liegt sie länger als
     *    [LiveEditingProperties.milestonePause] zurück, war sie die **letzte
     *    vor einer Schreibpause** und wird nachträglich Meilenstein. So
     *    braucht es keinen Zeitgeber – die nächste Änderung stellt fest, dass
     *    eine Pause war.
     * 2. Strukturelle Änderungen sind immer Meilensteine.
     * 3. Danach wird verdichtet: Sync-Versionen jenseits der
     *    Aufbewahrungsfrist entfallen.
     */
    private fun recordHistory(
        document: Document,
        changeType: ChangeType,
        milestone: Boolean = true,
        author: ChangeAuthor? = null,
    ) {
        val previous = historyRepository.findLatest(document.id)
        if (previous != null && !previous.milestone &&
            Duration.between(previous.timestamp, document.updatedAt) >= properties.milestonePause
        ) {
            historyRepository.promoteToMilestone(document.id, previous.version)
        }

        historyRepository.append(
            DocumentHistoryEntry(
                documentId = document.id,
                version = document.version,
                title = document.title,
                content = document.content,
                changeType = changeType,
                timestamp = document.updatedAt,
                milestone = milestone || changeType.isStructural,
                author = author,
            )
        )

        historyRepository.compact(
            document.id,
            document.updatedAt.minus(properties.syncRetention),
        )
    }

    /** Anlegen, Löschen, Wiederherstellen und Rückfall sind nie bloß Sync-Versionen. */
    private val ChangeType.isStructural: Boolean
        get() = this != ChangeType.UPDATED
}
