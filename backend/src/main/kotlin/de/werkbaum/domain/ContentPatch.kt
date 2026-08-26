package de.werkbaum.domain

import de.werkbaum.diff.LineOp

/**
 * Wer eine Änderung eingereicht hat. Pseudonym: [clientId] ist eine zufällige
 * Kennung, [displayName] ein selbstgewählter Name.
 *
 * Ohne Anmeldung ist der Name eine **Behauptung** und darf in der Oberfläche
 * nicht wie ein Nachweis aussehen (D76, Etherpad-Modell). Er trägt trotzdem
 * vier Dinge: Wiedererkennung beim Retry, „geändert von" in der Historie, die
 * Reihenfolge bei gleichzeitigen Einfügungen und später die Präsenz.
 */
data class ChangeAuthor(
    val clientId: String,
    val displayName: String? = null,
)

/**
 * Eine eingereichte Änderung: ein Zeilen-Diff gegen [baseVersion].
 *
 * [checksum] ist Pflicht – die Versionsnummer bestätigt nur, dass die Basis
 * dieselbe *Version* ist, nicht dass beide Seiten sie *gleich lesen*.
 * [clientId] und [seq] machen das Einreichen wiederholbar: Geht die Antwort
 * unterwegs verloren, weiß der Client nicht, ob seine Änderung ankam.
 */
data class ContentPatch(
    val baseVersion: Long,
    val checksum: String,
    val author: ChangeAuthor,
    val seq: Long,
    val ops: List<LineOp>,
    val milestone: Boolean = false,
)

/**
 * Ergebnis einer angenommenen Änderung.
 *
 * [opsSinceBase] ist leer, wenn die Basis noch aktuell war; sonst stehen dort
 * die fremden Operationen, um die der Server verschoben hat – damit der Client
 * seine Schattenkopie nachzieht, ohne neu zu laden.
 */
data class ContentPatchOutcome(
    val version: Long,
    val opsSinceBase: List<LineOp>,
)
