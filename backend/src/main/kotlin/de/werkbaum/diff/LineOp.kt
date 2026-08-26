package de.werkbaum.diff

/**
 * Eine Zeilen-Operation relativ zu einer Basisversion (0-basierter Index).
 *
 * Die drei Formen entsprechen 1:1 dem Draht-Format aus dem Live-Editing-Konzept
 * (`backend/docs/live-editing-proposal.md`, Abschnitt „Datenmodell"):
 *
 * - [Insert]  – [lines] werden **vor** [index] eingefügt; `index == Zeilenzahl`
 *               hängt an.
 * - [Delete]  – [count] Zeilen ab [index] entfallen.
 * - [Replace] – [count] Zeilen ab [index] werden durch [lines] ersetzt.
 *
 * Bewusst ein eigenes, Spring-freies Modell: Anwenden, Berechnen und Rebasen
 * sind reine Funktionen und damit ohne Kontext testbar (D54-Nachtrag 3 zieht
 * dieselbe Grenze im Frontend).
 */
sealed interface LineOp {
    val index: Int

    data class Insert(override val index: Int, val lines: List<String>) : LineOp
    data class Delete(override val index: Int, val count: Int) : LineOp
    data class Replace(override val index: Int, val count: Int, val lines: List<String>) : LineOp
}

/** Zahl der Zeilen, die diese Operation aus der Basis entfernt. */
val LineOp.removedCount: Int
    get() = when (this) {
        is LineOp.Insert -> 0
        is LineOp.Delete -> count
        is LineOp.Replace -> count
    }

/** Zeilen, die diese Operation einsetzt. */
val LineOp.insertedLines: List<String>
    get() = when (this) {
        is LineOp.Insert -> lines
        is LineOp.Delete -> emptyList()
        is LineOp.Replace -> lines
    }

/** Ende des betroffenen Basisbereichs, exklusiv. Bei [LineOp.Insert] gleich [LineOp.index]. */
val LineOp.endExclusive: Int
    get() = index + removedCount

/** Wie viele Zeilen das Dokument durch diese Operation länger (positiv) oder kürzer wird. */
val LineOp.lineDelta: Int
    get() = insertedLines.size - removedCount
