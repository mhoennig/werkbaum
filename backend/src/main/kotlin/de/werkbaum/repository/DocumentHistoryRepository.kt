package de.werkbaum.repository

import de.werkbaum.domain.DocumentHistoryEntry
import java.time.OffsetDateTime
import java.util.UUID

/**
 * Zugriff auf die Dokumenthistorie.
 *
 * Bewusst **gezielt** statt „lade alles und filtere in Kotlin": Mit dem
 * Live-Editing entstehen hunderte Versionen je Dokument, und jede trägt den
 * vollen Text (D76).
 */
interface DocumentHistoryRepository {
    fun append(entry: DocumentHistoryEntry)

    /** Gibt es zu dieser UUID überhaupt Historie? Auch für gelöschte Dokumente wahr. */
    fun exists(documentId: UUID): Boolean

    /** Genau eine Version – oder `null`, wenn sie nie existierte oder verdichtet wurde. */
    fun findVersion(documentId: UUID, version: Long): DocumentHistoryEntry?

    /** Der jüngste Eintrag, gleich welchen Typs (bei gelöschten Dokumenten der Tombstone). */
    fun findLatest(documentId: UUID): DocumentHistoryEntry?

    /** Der älteste Eintrag – die Anlage des Dokuments, immer ein Meilenstein. */
    fun findOldest(documentId: UUID): DocumentHistoryEntry?

    /** Höchste vergebene Versionsnummer, auch wenn deren Eintrag verdichtet wurde. */
    fun maxVersion(documentId: UUID): Long?

    /** Alle Einträge mit einer Version größer [version], älteste zuerst. */
    fun findAfterVersion(documentId: UUID, version: Long): List<DocumentHistoryEntry>

    /** Die nutzersichtbare Historie, älteste zuerst. */
    fun findMilestones(documentId: UUID): List<DocumentHistoryEntry>

    /**
     * Erhebt eine Sync-Version nachträglich zum Meilenstein – sie war die
     * letzte vor einer Schreibpause.
     */
    fun promoteToMilestone(documentId: UUID, version: Long)

    /**
     * Verdichtet: entfernt Sync-Versionen dieses Dokuments, die älter als
     * [olderThan] sind. Meilensteine bleiben. Liefert die Zahl der entfernten
     * Einträge.
     */
    fun compact(documentId: UUID, olderThan: OffsetDateTime): Int

    fun clear()
}
