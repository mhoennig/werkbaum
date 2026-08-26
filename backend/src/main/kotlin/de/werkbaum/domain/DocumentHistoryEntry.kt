package de.werkbaum.domain

import java.time.OffsetDateTime
import java.util.UUID

enum class ChangeType { CREATED, UPDATED, DELETED, RESTORED }

/**
 * Ein Eintrag der Dokumenthistorie. Die Historie wird getrennt vom Dokument
 * gespeichert und überlebt daher ein DELETE – Grundlage für die
 * Wiederherstellung und später auch für Audit/Live-Editing-Replays.
 */
data class DocumentHistoryEntry(
    val documentId: UUID,
    val version: Long,
    val title: String,
    val content: String,
    val changeType: ChangeType,
    val timestamp: OffsetDateTime,
)
