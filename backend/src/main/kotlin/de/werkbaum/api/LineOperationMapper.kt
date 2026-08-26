package de.werkbaum.api

import de.werkbaum.diff.LineOp
import de.werkbaum.generated.model.LineOperation
import de.werkbaum.service.InvalidPatchException

/**
 * Übersetzt zwischen dem generierten API-Modell und dem internen Diff-Modell.
 *
 * Das API-Modell hat ein Feld je Form (`count`, `lines`, beide optional), das
 * interne ist eine versiegelte Hierarchie – dort kann eine Operation gar nicht
 * erst halb ausgefüllt sein. Genau dafür ist die Trennung da.
 */
internal fun LineOperation.toDomain(): LineOp = when (op) {
    LineOperation.Op.INSERT -> LineOp.Insert(index, lines.orEmpty())
    LineOperation.Op.DELETE -> LineOp.Delete(index, requiredCount())
    LineOperation.Op.REPLACE -> LineOp.Replace(index, requiredCount(), lines.orEmpty())
}

/**
 * Ein fehlendes `count` bei `delete`/`replace` wird **nicht** als 0 gelesen:
 * Die Operation täte dann stillschweigend nichts bzw. würde zur Einfügung.
 * Lieber der laute Fehler (dieselbe Haltung wie in SPEC §4).
 */
private fun LineOperation.requiredCount(): Int =
    count ?: throw InvalidPatchException(
        "Operation '${op.value}' bei Index $index ohne 'count'"
    )

internal fun LineOp.toApi(): LineOperation = when (this) {
    is LineOp.Insert -> LineOperation(LineOperation.Op.INSERT, index, lines = lines)
    is LineOp.Delete -> LineOperation(LineOperation.Op.DELETE, index, count = count)
    is LineOp.Replace ->
        LineOperation(LineOperation.Op.REPLACE, index, count = count, lines = lines)
}

internal fun List<LineOp>.toApi(): List<LineOperation> = map { it.toApi() }
