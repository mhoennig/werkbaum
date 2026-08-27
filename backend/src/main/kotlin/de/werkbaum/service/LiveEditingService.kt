package de.werkbaum.service

import de.werkbaum.diff.DiffNotApplicableException
import de.werkbaum.diff.LineDiff
import de.werkbaum.domain.ChangeEvent
import de.werkbaum.domain.ChangeFeed
import de.werkbaum.domain.ContentPatch
import de.werkbaum.domain.ContentPatchOutcome
import de.werkbaum.domain.DocumentHistoryEntry
import de.werkbaum.repository.DocumentHistoryRepository
import org.springframework.stereotype.Service
import java.time.Duration
import java.util.UUID
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Die eingereichte Änderung ist ungültig oder überschreitet eine
 * serverseitige Grenze (400). Ohne solche Grenzen ist ein einzelner Request
 * ein Ausfall-Vektor – auch versehentlich, durch einen Client-Bug.
 */
class InvalidPatchException(message: String) : RuntimeException(message)

/**
 * Das Live-Editing: Zeilen-Diffs einreichen (D76).
 *
 * Bewusst **ohne** `@Transactional`. Die Änderung eines Dokuments muss strikt
 * sequenziell laufen – prüfen, rebasen und anwenden gehören zusammen –, und
 * die Sperre dafür liegt **außerhalb** der Transaktion: Läge sie innen, gäbe
 * der Proxy sie vor dem Commit wieder frei, und der nächste Schreiber läse
 * einen Stand, der noch nicht steht. Geschrieben wird deshalb über die
 * transaktionalen Methoden von [DocumentService].
 */
@Service
class LiveEditingService(
    private val documents: DocumentService,
    private val history: DocumentHistoryRepository,
    private val properties: LiveEditingProperties,
    private val notifier: ChangeNotifier,
) {

    /**
     * Feste Zahl von Sperren, verteilt über die UUID. Zwei Dokumente können
     * sich eine teilen – das kostet nur Zeit, nie Richtigkeit – und die Menge
     * wächst nie: eine Sperre je Dokument müsste beim Löschen aufgeräumt
     * werden und wäre sonst ein langsames Leck.
     */
    private val stripes = Array(64) { ReentrantLock() }

    /** Wiederholte Einreichungen erkennen (Idempotenz). */
    private val patchLog = PatchLog()

    fun patchContent(documentId: UUID, patch: ContentPatch): ContentPatchOutcome =
        lockFor(documentId).withLock { applyPatch(documentId, patch) }

    /**
     * Umbenennen unter derselben Sperre wie die Inhalts-Patches (D85): Auch
     * der Titel bumpt die Version, und prüfen und schreiben gehören zusammen.
     * Titel-Regeln liegen hier (400), die Versionsprüfung im [DocumentService].
     */
    fun renameDocument(documentId: UUID, title: String, expectedVersion: Long) =
        lockFor(documentId).withLock {
            val bereinigt = title.trim()
            if (bereinigt.isEmpty()) throw InvalidPatchException("Titel darf nicht leer sein")
            if (bereinigt.length > 255) {
                throw InvalidPatchException("Titel zu lang: ${bereinigt.length} (erlaubt: 255)")
            }
            documents.rename(documentId, bereinigt, expectedVersion)
        }

    private fun applyPatch(documentId: UUID, patch: ContentPatch): ContentPatchOutcome {
        if (patch.ops.size > properties.maxOps) {
            throw InvalidPatchException(
                "Zu viele Operationen: ${patch.ops.size} (erlaubt: ${properties.maxOps})"
            )
        }

        patchLog.outcomeOf(documentId, patch.author.clientId, patch.seq)?.let { return it }

        val current = documents.findByIdOrNull(documentId)
            ?: if (history.exists(documentId)) throw DocumentDeletedException(documentId)
            else throw DocumentNotFoundException(documentId)

        val baseContent = baseContentOf(documentId, current.content, current.version, patch.baseVersion)
        if (LineDiff.checksum(baseContent) != patch.checksum) {
            throw DiffNotApplicableException(
                "Prüfsumme passt nicht zur Basisversion ${patch.baseVersion} – " +
                    "beide Seiten lesen denselben Stand verschieden"
            )
        }

        // Veraltete Basis: selbst rebasen, statt abzulehnen. Reines Ablehnen
        // führte zu Starvation - ein Client mit hoher Latenz käme bei
        // fleißigen Mitschreibern womöglich nie durch.
        val opsSinceBase =
            if (patch.baseVersion == current.version) emptyList()
            else LineDiff.compute(LineDiff.lines(baseContent), LineDiff.lines(current.content))

        val ops = LineDiff.rebase(patch.ops, opsSinceBase)
            ?: throw ContentConflictException(current.version, opsSinceBase)

        val newContent = LineDiff.text(LineDiff.apply(LineDiff.lines(current.content), ops))
        if (newContent.length > properties.maxContentLength) {
            throw InvalidPatchException(
                "Dokument würde ${newContent.length} Zeichen lang " +
                    "(erlaubt: ${properties.maxContentLength})"
            )
        }

        val updated = documents.update(
            id = documentId,
            title = current.title,
            content = newContent,
            milestone = patch.milestone,
            author = patch.author,
        )

        return ContentPatchOutcome(updated.version, opsSinceBase)
            .also { patchLog.record(documentId, patch.author.clientId, patch.seq, it) }
    }

    /**
     * Der Text, gegen den das Diff gebildet wurde. Der Normalfall ist die
     * aktuelle Version; sonst der Snapshot aus der Historie. Ist der bereits
     * verdichtet, lässt sich nicht mehr rebasen – dann bleibt nur einmal neu
     * laden (422), und das ist ehrlicher als ein geratenes Diff.
     */
    private fun baseContentOf(
        documentId: UUID,
        currentContent: String,
        currentVersion: Long,
        baseVersion: Long,
    ): String = when {
        baseVersion == currentVersion -> currentContent
        baseVersion > currentVersion -> throw DiffNotApplicableException(
            "Basisversion $baseVersion liegt vor der aktuellen Version $currentVersion"
        )

        else -> history.findVersion(documentId, baseVersion)?.content
            ?: throw DiffNotApplicableException(
                "Basisversion $baseVersion ist nicht mehr verfügbar (verdichtet)"
            )
    }

    // -----------------------------------------------------------------------
    // Änderungsfeed
    // -----------------------------------------------------------------------

    /**
     * Alles seit [since] – oder `null`, wenn innerhalb von [wait] nichts
     * passiert (im Protokoll: 204).
     *
     * Der Feed arbeitet auf der **Historie**, nicht am Dokument: `delete()`
     * entfernt das Dokument und lässt nur den Tombstone stehen – ein Feed am
     * Dokument müsste danach 404 liefern, ausgerechnet für das
     * DELETED-Ereignis, das er zustellen soll. 404 gibt es deshalb nur bei
     * gänzlich unbekannter UUID.
     */
    fun changesSince(documentId: UUID, since: Long, wait: Duration): ChangeFeed? {
        if (!history.exists(documentId)) throw DocumentNotFoundException(documentId)

        // Den Stempel VOR dem Nachsehen lesen: Ändert sich in der Lücke
        // dazwischen etwas, kehrt das Warten unten sofort zurück.
        val stamp = notifier.stampOf(documentId)
        feedSince(documentId, since)?.let { return it }

        val timeout = minOf(wait, properties.maxWait)
        if (timeout.isNegative || timeout.isZero) return null
        if (!notifier.awaitChange(documentId, stamp, timeout)) return null

        return feedSince(documentId, since)
    }

    private fun feedSince(documentId: UUID, since: Long): ChangeFeed? {
        val latest = history.findLatest(documentId) ?: return null
        if (latest.version <= since) return null

        val events = history.findAfterVersion(documentId, since).map { it.toEvent() }
        val base = history.findVersion(documentId, since)?.content

        // Ohne Basis kein exaktes Diff - dann der Volltext. Das deckt den
        // Nachzügler nach dem Verdichten ebenso ab wie den Erstkontakt
        // (since = 0) und die PWA nach langer Offline-Zeit.
        return if (base == null) {
            ChangeFeed(
                fromVersion = null,
                currentVersion = latest.version,
                ops = null,
                content = latest.content,
                events = events,
            )
        } else {
            ChangeFeed(
                fromVersion = since,
                currentVersion = latest.version,
                ops = LineDiff.compute(LineDiff.lines(base), LineDiff.lines(latest.content)),
                content = null,
                events = events,
            )
        }
    }

    private fun DocumentHistoryEntry.toEvent() = ChangeEvent(
        version, changeType, author,
        title = title.takeIf { changeType == de.werkbaum.domain.ChangeType.RENAMED },
    )

    private fun lockFor(documentId: UUID): ReentrantLock =
        stripes[Math.floorMod(documentId.hashCode(), stripes.size)]

}
