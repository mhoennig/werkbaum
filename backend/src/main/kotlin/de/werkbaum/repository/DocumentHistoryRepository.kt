package de.werkbaum.repository

import de.werkbaum.domain.DocumentHistoryEntry
import java.util.UUID

interface DocumentHistoryRepository {
    fun append(entry: DocumentHistoryEntry)

    /** Alle Einträge zu einem Dokument, älteste zuerst. */
    fun findByDocumentId(documentId: UUID): List<DocumentHistoryEntry>

    fun clear()
}
