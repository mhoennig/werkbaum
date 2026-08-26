package de.werkbaum.service

import de.werkbaum.diff.LineOp
import java.util.UUID

/**
 * Echte Überschneidung mit einer zwischenzeitlichen Änderung (409).
 *
 * Trägt alles mit, was der Client zum Weiterarbeiten braucht – ohne neu zu
 * laden: die aktuelle Version und das Diff von seiner Basis dorthin. Er zeigt
 * dann zwei Knöpfe (fremde Fassung übernehmen / eigene durchsetzen); an dieser
 * Stelle gewinnt einer vollständig, aber nichts geht endgültig verloren, denn
 * jede Version steht in der Historie.
 */
class ContentConflictException(
    val currentVersion: Long,
    val opsSinceBase: List<LineOp>,
) : RuntimeException("Überschneidung mit Version $currentVersion")

/**
 * Das Dokument ist gelöscht, seine Historie gibt es noch (404 mit Hinweis auf
 * die Wiederherstellung).
 */
class DocumentDeletedException(val id: UUID) :
    RuntimeException(
        "Dokument $id wurde gelöscht; es lässt sich über " +
            "POST /api/v1/documents/$id/restore wiederherstellen"
    )
