package de.werkbaum.service

import de.werkbaum.diff.DiffNotApplicableException
import de.werkbaum.diff.LineDiff
import de.werkbaum.domain.ContentPatch
import de.werkbaum.domain.ContentPatchOutcome
import de.werkbaum.repository.DocumentHistoryRepository
import org.springframework.stereotype.Service
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

    private fun lockFor(documentId: UUID): ReentrantLock =
        stripes[Math.floorMod(documentId.hashCode(), stripes.size)]

}
