package de.werkbaum.domain

import java.time.OffsetDateTime
import java.util.UUID

/**
 * Art der Änderung.
 *
 * [RESTORED] heißt ausschließlich: ein **gelöschtes** Dokument ist wieder da —
 * der Client hebt daraufhin seine Sperre auf. [ROLLED_BACK] ist der Rückfall
 * eines **lebenden** Dokuments auf eine alte Version; für den Client ein
 * gewöhnlicher Inhaltswechsel. Beide trugen früher denselben Typ; ein Typ, der
 * zwei Dinge bedeutet, ist die Unschärfe, aus der später Fehler werden (D76).
 */
enum class ChangeType { CREATED, UPDATED, DELETED, RESTORED, ROLLED_BACK }

/**
 * Ein Eintrag der Dokumenthistorie. Die Historie wird getrennt vom Dokument
 * gespeichert und überlebt daher ein DELETE – Grundlage für die
 * Wiederherstellung und für die Diffs des Live-Editings.
 *
 * Die Historie hat **zwei Ebenen** (D76):
 * - [milestone] `false` — eine **Sync-Version**. Sie trägt das Protokoll
 *   (Diffs zwischen beliebigen Versionen), ist kurzlebig und wird nach einer
 *   Weile verdichtet. Danach beantwortet der Feed betroffene `since`-Werte
 *   mit Volltext.
 * - [milestone] `true` — ein **Meilenstein**, die nutzersichtbare Historie.
 *   Meilensteine entstehen bei strukturellen Änderungen, nach einer
 *   Schreibpause und auf Knopfdruck; sie werden nie verdichtet.
 *
 * Ohne die Trennung würde die Historie bei 1,5 s Debounce zum Transaktionslog:
 * hunderte Volltext-Snapshots eines 40-kB-Dokuments je Sitzung.
 */
data class DocumentHistoryEntry(
    val documentId: UUID,
    val version: Long,
    val title: String,
    val content: String,
    val changeType: ChangeType,
    val timestamp: OffsetDateTime,
    val milestone: Boolean = true,
)
