package de.werkbaum.domain

import de.werkbaum.diff.LineOp

/** Was an einer Version geschehen ist und wer sie eingereicht hat. */
data class ChangeEvent(
    val version: Long,
    val changeType: ChangeType,
    val author: ChangeAuthor? = null,
)

/**
 * Alles, was seit einer bekannten Version geschehen ist.
 *
 * Entweder [ops] (der Normalfall – der Client wendet sie an und behält Cursor
 * und Scrollposition) **oder** [content] als Volltext. Letzteres, wenn die
 * Basis bereits verdichtet ist oder der Client noch gar nichts hat: Dann kann
 * kein exaktes Diff mehr entstehen, und über hunderte Versionen hinweg wäre
 * der Cursor ohnehin nicht zu retten. Ein Roundtrip und ein Sonderzustand
 * weniger als ein eigener Fehlerpfad (D76).
 */
data class ChangeFeed(
    val fromVersion: Long?,
    val currentVersion: Long,
    val ops: List<LineOp>?,
    val content: String?,
    val events: List<ChangeEvent>,
)
