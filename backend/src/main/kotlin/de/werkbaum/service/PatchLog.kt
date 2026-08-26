package de.werkbaum.service

import de.werkbaum.domain.ContentPatchOutcome
import java.util.UUID

/**
 * Merkt sich je (Dokument, Client) die zuletzt verarbeitete Sequenznummer samt
 * Ergebnis – damit ein wiederholtes Einreichen nicht ein zweites Mal wirkt.
 *
 * Geht die Antwort unterwegs verloren – im Mobilnetz der Normalfall –, weiß
 * der Client nicht, ob seine Änderung ankam (D76). Kurzlebig und im Speicher:
 * Das Fenster ist Sekunden lang, und eine Einzelinstanz ist ohnehin
 * vorausgesetzt. Die Zahl der gemerkten Paare ist gedeckelt; verdrängt wird
 * das am längsten nicht benutzte.
 *
 * Alle Methoden sind synchronisiert: Aufrufe kommen aus verschiedenen
 * Dokument-Sperren und damit echt nebenläufig.
 */
class PatchLog(private val capacity: Int = 1_024) {

    private data class Seen(val seq: Long, val outcome: ContentPatchOutcome)

    private val entries = object : LinkedHashMap<Pair<UUID, String>, Seen>(64, 0.75f, true) {
        override fun removeEldestEntry(eldest: Map.Entry<Pair<UUID, String>, Seen>) =
            size > capacity
    }

    /**
     * `null` heißt: neu, bitte anwenden. Ein Ergebnis heißt: schon erledigt,
     * das war die Antwort. Eine **kleinere** Sequenznummer als die zuletzt
     * verarbeitete ist ein Client-Fehler – das Ergebnis von damals ist nicht
     * mehr bekannt, und ein zweites Anwenden verdürbe den Text.
     */
    @Synchronized
    fun outcomeOf(documentId: UUID, clientId: String, seq: Long): ContentPatchOutcome? {
        val seen = entries[documentId to clientId] ?: return null
        return when {
            seq > seen.seq -> null
            seq == seen.seq -> seen.outcome
            else -> throw StalePatchSequenceException(seq, seen.seq)
        }
    }

    @Synchronized
    fun record(documentId: UUID, clientId: String, seq: Long, outcome: ContentPatchOutcome) {
        entries[documentId to clientId] = Seen(seq, outcome)
    }

    @Synchronized
    fun size(): Int = entries.size
}

/** Eine ältere Sequenznummer als die zuletzt verarbeitete (422). */
class StalePatchSequenceException(seq: Long, lastSeen: Long) :
    RuntimeException("Sequenznummer $seq ist veraltet (zuletzt verarbeitet: $lastSeen)")
