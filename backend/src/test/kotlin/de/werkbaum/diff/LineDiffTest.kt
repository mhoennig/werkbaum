package de.werkbaum.diff

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

class LineDiffTest {

    private val basis = listOf("a", "b", "c", "d")

    // -----------------------------------------------------------------------
    @Nested
    inner class TextUndZeilen {

        @Test
        fun `zerlegen und zusammensetzen sind zueinander invers`() {
            val text = "eins\nzwei\ndrei"
            LineDiff.text(LineDiff.lines(text)) shouldBe text
        }

        @Test
        fun `ein abschliessendes LF ergibt eine leere letzte Zeile`() {
            LineDiff.lines("a\n") shouldBe listOf("a", "")
            LineDiff.text(listOf("a", "")) shouldBe "a\n"
        }

        @Test
        fun `der leere Text ist genau eine leere Zeile`() {
            LineDiff.lines("") shouldBe listOf("")
        }

        @Test
        fun `CRLF und CR werden auf LF normalisiert`() {
            LineDiff.lines("a\r\nb\rc") shouldBe listOf("a", "b", "c")
        }
    }

    // -----------------------------------------------------------------------
    @Nested
    inner class Pruefsumme {

        @Test
        fun `gleicher Text ergibt gleiche Pruefsumme`() {
            LineDiff.checksum("a\nb") shouldBe LineDiff.checksum("a\nb")
        }

        @Test
        fun `unterschiedlicher Text ergibt unterschiedliche Pruefsumme`() {
            LineDiff.checksum("a\nb") shouldNotBe LineDiff.checksum("a\nc")
        }

        @Test
        fun `Zeilenenden gehen nicht in die Pruefsumme ein`() {
            // Sonst haetten Windows- und Unix-Client nie dieselbe Basis.
            LineDiff.checksum("a\r\nb") shouldBe LineDiff.checksum("a\nb")
        }

        @Test
        fun `die Pruefsumme nennt ihr Verfahren`() {
            LineDiff.checksum("a").startsWith("sha256:") shouldBe true
            LineDiff.checksum("a").length shouldBe "sha256:".length + 64
        }
    }

    // -----------------------------------------------------------------------
    @Nested
    inner class Anwenden {

        @Test
        fun `replace ersetzt count Zeilen ab index`() {
            LineDiff.apply(basis, listOf(LineOp.Replace(1, 2, listOf("X")))) shouldBe
                listOf("a", "X", "d")
        }

        @Test
        fun `insert setzt vor den Index`() {
            LineDiff.apply(basis, listOf(LineOp.Insert(2, listOf("X", "Y")))) shouldBe
                listOf("a", "b", "X", "Y", "c", "d")
        }

        @Test
        fun `insert am Dokumentende haengt an`() {
            LineDiff.apply(basis, listOf(LineOp.Insert(4, listOf("e")))) shouldBe
                listOf("a", "b", "c", "d", "e")
        }

        @Test
        fun `delete entfernt count Zeilen ab index`() {
            LineDiff.apply(basis, listOf(LineOp.Delete(0, 2))) shouldBe listOf("c", "d")
        }

        @Test
        fun `die letzte Zeile laesst sich loeschen`() {
            LineDiff.apply(basis, listOf(LineOp.Delete(3, 1))) shouldBe listOf("a", "b", "c")
        }

        @Test
        fun `mehrere Operationen wirken alle gegen die Basis`() {
            // Die Indizes der zweiten Operation zaehlen die erste NICHT mit.
            val ops = listOf(
                LineOp.Insert(1, listOf("neu")),
                LineOp.Delete(3, 1),
            )
            LineDiff.apply(basis, ops) shouldBe listOf("a", "neu", "b", "c")
        }

        @Test
        fun `ein leeres Dokument nimmt eine Zeile auf`() {
            LineDiff.apply(LineDiff.lines(""), listOf(LineOp.Replace(0, 1, listOf("a")))) shouldBe
                listOf("a")
        }

        @Test
        fun `ohne Operationen bleibt alles stehen`() {
            LineDiff.apply(basis, emptyList()) shouldBe basis
        }

        @Test
        fun `ein Index hinter dem Dokumentende ist nicht anwendbar`() {
            shouldThrow<DiffNotApplicableException> {
                LineDiff.apply(basis, listOf(LineOp.Insert(5, listOf("x"))))
            }
        }

        @Test
        fun `ein Bereich ueber das Dokumentende hinaus ist nicht anwendbar`() {
            shouldThrow<DiffNotApplicableException> {
                LineDiff.apply(basis, listOf(LineOp.Delete(3, 2)))
            }
        }

        @Test
        fun `ein negativer Index ist nicht anwendbar`() {
            shouldThrow<DiffNotApplicableException> {
                LineDiff.apply(basis, listOf(LineOp.Insert(-1, listOf("x"))))
            }
        }

        @Test
        fun `ein negatives count ist nicht anwendbar`() {
            shouldThrow<DiffNotApplicableException> {
                LineDiff.apply(basis, listOf(LineOp.Delete(1, -1)))
            }
        }

        @Test
        fun `unsortierte Operationen sind nicht anwendbar`() {
            shouldThrow<DiffNotApplicableException> {
                LineDiff.apply(basis, listOf(LineOp.Delete(2, 1), LineOp.Delete(0, 1)))
            }
        }

        @Test
        fun `sich ueberschneidende Operationen sind nicht anwendbar`() {
            shouldThrow<DiffNotApplicableException> {
                LineDiff.apply(basis, listOf(LineOp.Delete(0, 2), LineOp.Replace(1, 1, listOf("x"))))
            }
        }
    }

    // -----------------------------------------------------------------------
    @Nested
    inner class Ueberschneidung {

        @Test
        fun `zwei Einfuegungen an derselben Stelle vertragen sich`() {
            LineDiff.conflicts(
                LineOp.Insert(3, listOf("x")),
                LineOp.Insert(3, listOf("y")),
            ) shouldBe false
        }

        @Test
        fun `eine Einfuegung IN einen geloeschten Bereich ist ein Konflikt`() {
            LineDiff.conflicts(
                LineOp.Insert(6, listOf("x")),
                LineOp.Delete(5, 3),
            ) shouldBe true
        }

        @Test
        fun `eine Einfuegung am Rand eines geloeschten Bereichs ist keiner`() {
            // Vor dem Block und hinter dem Block ist die Stelle eindeutig.
            LineDiff.conflicts(LineOp.Insert(5, listOf("x")), LineOp.Delete(5, 3)) shouldBe false
            LineDiff.conflicts(LineOp.Insert(8, listOf("x")), LineOp.Delete(5, 3)) shouldBe false
        }

        @Test
        fun `eine Einfuegung neben einer geaenderten Zeile ist keiner`() {
            LineDiff.conflicts(
                LineOp.Insert(5, listOf("x")),
                LineOp.Replace(5, 1, listOf("y")),
            ) shouldBe false
        }

        @Test
        fun `dieselbe Zeile zweimal geaendert ist ein Konflikt`() {
            LineDiff.conflicts(
                LineOp.Replace(5, 1, listOf("x")),
                LineOp.Replace(5, 1, listOf("y")),
            ) shouldBe true
        }

        @Test
        fun `aneinandergrenzende Bereiche vertragen sich`() {
            LineDiff.conflicts(LineOp.Delete(5, 2), LineOp.Replace(7, 2, listOf("x"))) shouldBe false
        }

        @Test
        fun `die Regel ist symmetrisch`() {
            val insert = LineOp.Insert(6, listOf("x"))
            val delete = LineOp.Delete(5, 3)
            LineDiff.conflicts(insert, delete) shouldBe LineDiff.conflicts(delete, insert)
        }
    }

    // -----------------------------------------------------------------------
    @Nested
    inner class Rebasen {

        @Test
        fun `ohne fremde Operationen bleibt alles unveraendert`() {
            val meine = listOf(LineOp.Replace(2, 1, listOf("x")))
            LineDiff.rebase(meine, emptyList()) shouldBe meine
        }

        @Test
        fun `eine fremde Einfuegung davor verschiebt nach unten`() {
            LineDiff.rebase(
                listOf(LineOp.Replace(5, 1, listOf("x"))),
                listOf(LineOp.Insert(2, listOf("neu", "neu2"))),
            ) shouldBe listOf(LineOp.Replace(7, 1, listOf("x")))
        }

        @Test
        fun `eine fremde Loeschung davor verschiebt nach oben`() {
            LineDiff.rebase(
                listOf(LineOp.Replace(5, 1, listOf("x"))),
                listOf(LineOp.Delete(1, 2)),
            ) shouldBe listOf(LineOp.Replace(3, 1, listOf("x")))
        }

        @Test
        fun `eine fremde Operation dahinter verschiebt nichts`() {
            val meine = listOf(LineOp.Replace(1, 1, listOf("x")))
            LineDiff.rebase(meine, listOf(LineOp.Insert(5, listOf("neu")))) shouldBe meine
        }

        @Test
        fun `eine bestaetigte fremde Einfuegung an derselben Stelle steht oben`() {
            LineDiff.rebase(
                listOf(LineOp.Insert(3, listOf("meins"))),
                listOf(LineOp.Insert(3, listOf("fremd"))),
            ) shouldBe listOf(LineOp.Insert(4, listOf("meins")))
        }

        @Test
        fun `echte Ueberschneidung meldet Konflikt`() {
            LineDiff.rebase(
                listOf(LineOp.Replace(5, 1, listOf("meins"))),
                listOf(LineOp.Replace(5, 1, listOf("fremd"))),
            ) shouldBe null
        }

        @Test
        fun `rebasen ergibt das erwartete Dokument`() {
            val basis = listOf("a", "b", "c", "d", "e")
            val fremd = listOf(LineOp.Insert(1, listOf("neu")))
            val meine = listOf(LineOp.Replace(3, 1, listOf("D")))

            val aktuell = LineDiff.apply(basis, fremd)
            val verschoben = LineDiff.rebase(meine, fremd)!!

            LineDiff.apply(aktuell, verschoben) shouldBe listOf("a", "neu", "b", "c", "D", "e")
        }

        @Test
        fun `mehrere eigene Operationen bleiben nach dem Rebasen sortiert und anwendbar`() {
            val basis = (0..11).map { "z$it" }
            val fremd = listOf(LineOp.Delete(6, 3))
            val meine = listOf(LineOp.Insert(5, listOf("x")), LineOp.Delete(10, 2))

            val verschoben = LineDiff.rebase(meine, fremd)!!
            verschoben shouldBe listOf(LineOp.Insert(5, listOf("x")), LineOp.Delete(7, 2))

            LineDiff.apply(LineDiff.apply(basis, fremd), verschoben) shouldBe
                listOf("z0", "z1", "z2", "z3", "z4", "x", "z5", "z9")
        }
    }

    // -----------------------------------------------------------------------
    @Nested
    inner class Berechnen {

        private fun rundreise(von: List<String>, nach: List<String>) {
            LineDiff.apply(von, LineDiff.compute(von, nach)) shouldBe nach
        }

        @Test
        fun `gleiche Staende ergeben kein Diff`() {
            LineDiff.compute(basis, basis) shouldBe emptyList()
        }

        @Test
        fun `eine geaenderte Zeile ergibt genau ein replace`() {
            LineDiff.compute(basis, listOf("a", "B", "c", "d")) shouldBe
                listOf(LineOp.Replace(1, 1, listOf("B")))
        }

        @Test
        fun `eine eingefuegte Zeile ergibt genau ein insert`() {
            LineDiff.compute(basis, listOf("a", "b", "neu", "c", "d")) shouldBe
                listOf(LineOp.Insert(2, listOf("neu")))
        }

        @Test
        fun `eine entfernte Zeile ergibt genau ein delete`() {
            LineDiff.compute(basis, listOf("a", "c", "d")) shouldBe
                listOf(LineOp.Delete(1, 1))
        }

        @Test
        fun `Anhaengen an das Dokumentende`() {
            LineDiff.compute(basis, basis + "e") shouldBe listOf(LineOp.Insert(4, listOf("e")))
        }

        @Test
        fun `aus dem leeren Dokument heraus`() {
            rundreise(LineDiff.lines(""), listOf("a", "b"))
        }

        @Test
        fun `in das leere Dokument hinein`() {
            rundreise(listOf("a", "b"), LineDiff.lines(""))
        }

        @Test
        fun `identische Zeilen weiter unten verwirren die Zuordnung nicht`() {
            // Leerzeilen und wiederholte Einrueckung sind in der Notation Alltag.
            val von = listOf("", "a", "", "a", "")
            val nach = listOf("", "a", "", "a", "", "b")
            rundreise(von, nach)
        }

        @Test
        fun `mehrere getrennte Aenderungen ergeben mehrere Operationen`() {
            val von = listOf("a", "b", "c", "d", "e", "f")
            val nach = listOf("a", "B", "c", "d", "neu", "e", "f")
            LineDiff.compute(von, nach) shouldBe listOf(
                LineOp.Replace(1, 1, listOf("B")),
                LineOp.Insert(4, listOf("neu")),
            )
            rundreise(von, nach)
        }

        @Test
        fun `ein vollstaendig anderer Text ergibt ein anwendbares Diff`() {
            rundreise(listOf("a", "b", "c"), listOf("x", "y"))
        }

        @Test
        fun `ein grosser Plan mit einer geaenderten Zeile bleibt sparsam`() {
            val von = (0..899).map { "  - [ ] Knoten $it (S)" }
            val nach = von.toMutableList().also { it[500] = "  - [x] Knoten 500 (S)" }
            LineDiff.compute(von, nach) shouldBe
                listOf(LineOp.Replace(500, 1, listOf("  - [x] Knoten 500 (S)")))
        }

        @Test
        fun `ein berechnetes Diff ist immer anwendbar`() {
            val von = "%% Plan\n- [~] Wurzel (XL)\n  - [x] Eins (S)\n  - [ ] Zwei (M)\n"
            val nach = "%% Plan geaendert\n- [~] Wurzel (XL)\n  - [x] Eins (S)\n  + [?] Zugabe (S)\n  - [ ] Zwei (L)\n"
            rundreise(LineDiff.lines(von), LineDiff.lines(nach))
        }
    }
}
