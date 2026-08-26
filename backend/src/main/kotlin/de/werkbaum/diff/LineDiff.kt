package de.werkbaum.diff

import java.security.MessageDigest

/** Ein Diff ist nicht anwendbar (Index außerhalb, Überschneidung, Prüfsummenfehler). */
class DiffNotApplicableException(message: String) : RuntimeException(message)

/**
 * Zeilen-Diffs: anwenden, berechnen, rebasen — reine Funktionen ohne Spring.
 *
 * Grundlage des Live-Editings (D76, `backend/docs/live-editing-proposal.md`).
 * Das Backend parst die Notation dabei **nicht** (D14): Zeilen sind opake
 * Strings, Fortsetzungszeilen und Beschreibungsblöcke sind schlicht Zeilen.
 */
object LineDiff {

    const val CHECKSUM_PREFIX = "sha256:"

    /**
     * Obergrenze für die LCS-Tabelle. Darüber wird der abweichende Abschnitt in
     * einem einzigen `replace` zusammengefasst — bei einem so großen
     * Unterschied ist das ohnehin die ehrliche Beschreibung, und die Tabelle
     * bliebe sonst ein Ausfall-Vektor (Konzept: „Grenzen").
     */
    const val LCS_LIMIT = 1_000_000L

    // -----------------------------------------------------------------------
    // Text ↔ Zeilen
    // -----------------------------------------------------------------------

    /**
     * Zeilenenden auf LF (SPEC §12). Der **Server** normalisiert autoritativ
     * beim Speichern, der Client beim Laden — nur so hashen beide denselben
     * Text.
     */
    fun normalize(text: String): String = text.replace("\r\n", "\n").replace('\r', '\n')

    /**
     * Zerlegt in physische Zeilen. Es gilt `text(lines(t)) == normalize(t)`;
     * ein abschließendes LF ergibt also eine leere letzte Zeile, und der leere
     * Text ist genau eine leere Zeile. Der Client muss identisch zerlegen,
     * sonst zeigen die Indizes auseinander.
     */
    fun lines(text: String): List<String> = normalize(text).split("\n")

    fun text(lines: List<String>): String = lines.joinToString("\n")

    /** Prüfsumme des Basistexts, Format `sha256:<hex>`. */
    fun checksum(text: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(normalize(text).toByteArray(Charsets.UTF_8))
        return CHECKSUM_PREFIX + digest.joinToString("") { "%02x".format(it) }
    }

    // -----------------------------------------------------------------------
    // Anwenden
    // -----------------------------------------------------------------------

    /**
     * Wendet [ops] auf [base] an. Erwartet aufsteigend sortierte,
     * überschneidungsfreie Operationen innerhalb der Dokumentgrenzen —
     * sonst [DiffNotApplicableException] (im Protokoll: 422).
     */
    fun apply(base: List<String>, ops: List<LineOp>): List<String> {
        validate(base.size, ops)
        val out = ArrayList<String>(base.size)
        var cursor = 0
        for (op in ops) {
            out.addAll(base.subList(cursor, op.index))
            out.addAll(op.insertedLines)
            cursor = op.endExclusive
        }
        out.addAll(base.subList(cursor, base.size))
        return out
    }

    private fun validate(size: Int, ops: List<LineOp>) {
        var prevEnd = 0
        for (op in ops) {
            if (op.removedCount < 0) {
                throw DiffNotApplicableException("count darf nicht negativ sein: $op")
            }
            if (op.index < 0 || op.index > size) {
                throw DiffNotApplicableException("Index ${op.index} liegt außerhalb von 0..$size")
            }
            if (op.endExclusive > size) {
                throw DiffNotApplicableException(
                    "Operation reicht über das Dokumentende hinaus (${op.endExclusive} > $size): $op"
                )
            }
            if (op.index < prevEnd) {
                throw DiffNotApplicableException(
                    "Operationen müssen aufsteigend und überschneidungsfrei sein: $op"
                )
            }
            prevEnd = op.endExclusive
        }
    }

    // -----------------------------------------------------------------------
    // Überschneidung
    // -----------------------------------------------------------------------

    /**
     * Überschneiden sich zwei Operationen derselben Basis? Das ist die
     * Konfliktdefinition des Protokolls.
     *
     * `replace`/`delete` belegen den halboffenen Bereich
     * `[index, index+count)`. `insert` ist ein **Punkt**, und zwar zwischen
     * den Zeilen: Er kollidiert nur mit einem Bereich, in dessen **Innerem**
     * er liegt (`start < index < end`).
     *
     * Daraus folgt, was das Konzept fordert:
     * - Zwei Einfügungen an derselben Stelle sind **kein** Konflikt.
     * - Eine Einfügung **in** einen gelöschten Bereich hinein ist einer.
     *
     * An den Rändern ist die Einfügung dagegen eindeutig — vor bzw. hinter dem
     * fremden Block —, und Ränder sind der häufige Fall: Wer eine Zeile über
     * einer gerade geänderten einfügt, soll keinen 409 bekommen.
     */
    fun conflicts(a: LineOp, b: LineOp): Boolean = when {
        a is LineOp.Insert && b is LineOp.Insert -> false
        a is LineOp.Insert -> b.index < a.index && a.index < b.endExclusive
        b is LineOp.Insert -> a.index < b.index && b.index < a.endExclusive
        else -> a.index < b.endExclusive && b.index < a.endExclusive
    }

    // -----------------------------------------------------------------------
    // Rebasen
    // -----------------------------------------------------------------------

    /**
     * Verschiebt [ops] (gegen eine veraltete Basis gebildet) auf den Stand,
     * der durch [onto] daraus entstanden ist.
     *
     * Ergebnis `null` heißt **echter Konflikt** (im Protokoll: 409) — nur dann
     * muss der Client entscheiden. Ohne Überschneidung rebased der Server
     * selbst und akzeptiert; ohne das verhungerte ein Client mit hoher Latenz
     * bei fleißigen Mitschreibern (D76).
     */
    fun rebase(ops: List<LineOp>, onto: List<LineOp>): List<LineOp>? {
        if (onto.isEmpty() || ops.isEmpty()) return ops
        for (mine in ops) {
            for (theirs in onto) {
                if (conflicts(mine, theirs)) return null
            }
        }
        return ops.map { shift(it, onto) }
    }

    /**
     * Verschiebt eine einzelne Operation um die Zeilenänderung aller fremden
     * Operationen, die **vor** ihr liegen. Eine fremde Einfügung an derselben
     * Stelle zählt dazu: Sie ist bereits bestätigt und steht deshalb oben.
     */
    private fun shift(op: LineOp, onto: List<LineOp>): LineOp {
        val delta = onto.filter { it.endExclusive <= op.index }.sumOf { it.lineDelta }
        if (delta == 0) return op
        return when (op) {
            is LineOp.Insert -> op.copy(index = op.index + delta)
            is LineOp.Delete -> op.copy(index = op.index + delta)
            is LineOp.Replace -> op.copy(index = op.index + delta)
        }
    }

    // -----------------------------------------------------------------------
    // Berechnen
    // -----------------------------------------------------------------------

    /**
     * Zeilen-Diff zwischen zwei Ständen; es gilt `apply(from, compute(from, to)) == to`.
     *
     * Gemeinsamer Anfang und gemeinsames Ende fallen zuerst weg — der übliche
     * Fall (ein paar geänderte Zeilen in einem großen Plan) kostet danach fast
     * nichts. Erst der Rest geht durch die LCS-Tabelle.
     */
    fun compute(from: List<String>, to: List<String>): List<LineOp> {
        var head = 0
        val shortest = minOf(from.size, to.size)
        while (head < shortest && from[head] == to[head]) head++
        var tail = 0
        while (tail < shortest - head && from[from.size - 1 - tail] == to[to.size - 1 - tail]) tail++

        val a = from.subList(head, from.size - tail)
        val b = to.subList(head, to.size - tail)

        return when {
            a.isEmpty() && b.isEmpty() -> emptyList()
            a.isEmpty() -> listOf(LineOp.Insert(head, b.toList()))
            b.isEmpty() -> listOf(LineOp.Delete(head, a.size))
            a.size.toLong() * b.size.toLong() > LCS_LIMIT ->
                listOf(LineOp.Replace(head, a.size, b.toList()))
            else -> lcsOps(a, b, head)
        }
    }

    private fun lcsOps(a: List<String>, b: List<String>, offset: Int): List<LineOp> {
        val n = a.size
        val m = b.size
        // lcs[i][j] = Länge der längsten gemeinsamen Teilfolge von a[i..] und b[j..]
        val lcs = Array(n + 1) { IntArray(m + 1) }
        for (i in n - 1 downTo 0) {
            for (j in m - 1 downTo 0) {
                lcs[i][j] = if (a[i] == b[j]) lcs[i + 1][j + 1] + 1
                else maxOf(lcs[i + 1][j], lcs[i][j + 1])
            }
        }

        val ops = mutableListOf<LineOp>()
        var i = 0
        var j = 0
        while (i < n || j < m) {
            if (i < n && j < m && a[i] == b[j]) {
                i++
                j++
                continue
            }
            // Ein zusammenhängender Unterschied: alles bis zur nächsten
            // gemeinsamen Zeile wird zu einer Operation zusammengefasst.
            val removedFrom = i
            val inserted = mutableListOf<String>()
            while (i < n || j < m) {
                if (i < n && j < m && a[i] == b[j]) break
                if (j < m && (i == n || lcs[i][j + 1] >= lcs[i + 1][j])) {
                    inserted += b[j]
                    j++
                } else {
                    i++
                }
            }
            val removed = i - removedFrom
            ops += when {
                removed > 0 && inserted.isNotEmpty() ->
                    LineOp.Replace(offset + removedFrom, removed, inserted.toList())

                removed > 0 -> LineOp.Delete(offset + removedFrom, removed)
                else -> LineOp.Insert(offset + removedFrom, inserted.toList())
            }
        }
        return ops
    }
}
