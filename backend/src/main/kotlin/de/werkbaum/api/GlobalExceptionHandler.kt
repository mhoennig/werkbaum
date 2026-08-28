package de.werkbaum.api

import de.werkbaum.diff.DiffNotApplicableException
import de.werkbaum.generated.model.ContentConflict
import de.werkbaum.service.ContentConflictException
import de.werkbaum.service.DocumentConflictException
import de.werkbaum.service.DocumentDeletedException
import de.werkbaum.service.DocumentNotFoundException
import de.werkbaum.service.InvalidPatchException
import de.werkbaum.service.StalePatchSequenceException
import de.werkbaum.integration.taiga.TaigaBadRequestException
import de.werkbaum.integration.taiga.TaigaNotConfiguredException
import de.werkbaum.integration.taiga.TaigaUnavailableException
import de.werkbaum.integration.taiga.TaigaUpstreamException
import org.springframework.http.HttpStatus
import org.springframework.http.ProblemDetail
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

/**
 * Zentrale Fehlerbehandlung im Problem-Details-Format (RFC 9457),
 * passend zum ProblemDetail-Schema der OpenAPI-Spezifikation.
 *
 * Eine Ausnahme davon ist der Überschneidungs-Konflikt des Live-Editings: Er
 * ist kein bloßer Fehlertext, sondern trägt die Daten mit, die der Client zum
 * Weiterarbeiten braucht – und hat deshalb ein eigenes Schema.
 */
@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(DocumentNotFoundException::class)
    fun handleNotFound(ex: DocumentNotFoundException): ProblemDetail =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.message ?: "Nicht gefunden").apply {
            title = "Dokument nicht gefunden"
        }

    @ExceptionHandler(DocumentDeletedException::class)
    fun handleDeleted(ex: DocumentDeletedException): ProblemDetail =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.message ?: "Gelöscht").apply {
            title = "Dokument gelöscht"
        }

    @ExceptionHandler(DocumentConflictException::class)
    fun handleConflict(ex: DocumentConflictException): ProblemDetail =
        ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.message ?: "Konflikt").apply {
            title = "Konflikt"
        }

    /**
     * Echte Überschneidung: 409 mit aktueller Version und dem Diff von der
     * eingereichten Basis dorthin – damit der Client entscheiden kann, ohne
     * neu zu laden.
     */
    @ExceptionHandler(ContentConflictException::class)
    fun handleContentConflict(ex: ContentConflictException): ResponseEntity<ContentConflict> =
        ResponseEntity.status(HttpStatus.CONFLICT).body(
            ContentConflict(
                currentVersion = ex.currentVersion,
                opsSinceBase = ex.opsSinceBase.toApi(),
            )
        )

    /**
     * Nicht anwendbar (422): Prüfsumme, Index oder eine Basisversion, die es
     * nicht mehr gibt. Der Client lädt einmalig neu – das ist der Preis
     * dafür, dass der Text nie kaputtgeht.
     */
    @ExceptionHandler(DiffNotApplicableException::class, StalePatchSequenceException::class)
    fun handleNotApplicable(ex: RuntimeException): ProblemDetail =
        ProblemDetail.forStatusAndDetail(
            HttpStatus.UNPROCESSABLE_ENTITY,
            ex.message ?: "Diff nicht anwendbar",
        ).apply { title = "Diff nicht anwendbar" }

    @ExceptionHandler(InvalidPatchException::class)
    fun handleInvalidPatch(ex: InvalidPatchException): ProblemDetail =
        ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST,
            ex.message ?: "Ungültige Anfrage",
        ).apply { title = "Ungültige Anfrage" }

    /* ---- Taiga-Proxy (D91) ---- */

    /** Kein Ziel konfiguriert: 503 — der Editor fragt vorher `GET /info`. */
    @ExceptionHandler(TaigaNotConfiguredException::class)
    fun handleTaigaNotConfigured(ex: TaigaNotConfiguredException): ProblemDetail =
        ProblemDetail.forStatusAndDetail(
            HttpStatus.SERVICE_UNAVAILABLE,
            ex.message ?: "Taiga nicht konfiguriert",
        ).apply { title = "Taiga nicht konfiguriert" }

    /** Eine Anfrage, die schon der Proxy ablehnt (Refs-Liste der Bulk-Abfrage). */
    @ExceptionHandler(TaigaBadRequestException::class)
    fun handleTaigaBadRequest(ex: TaigaBadRequestException): ProblemDetail =
        ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_REQUEST,
            ex.message ?: "Ungültige Anfrage",
        ).apply { title = "Ungültige Anfrage" }

    @ExceptionHandler(TaigaUnavailableException::class)
    fun handleTaigaUnavailable(ex: TaigaUnavailableException): ProblemDetail =
        ProblemDetail.forStatusAndDetail(
            HttpStatus.BAD_GATEWAY,
            ex.message ?: "Taiga nicht erreichbar",
        ).apply { title = "Taiga nicht erreichbar" }

    /**
     * Taiga hat mit einem Fehler geantwortet: 4xx wird durchgereicht — Taiga
     * meldet z. B. falsche Zugangsdaten als 400, und der Text hilft dem
     * Benutzer —, ein fremder 5xx wird zu 502.
     */
    @ExceptionHandler(TaigaUpstreamException::class)
    fun handleTaigaUpstream(ex: TaigaUpstreamException): ProblemDetail =
        ProblemDetail.forStatusAndDetail(
            if (ex.status in 400..499) HttpStatus.valueOf(ex.status) else HttpStatus.BAD_GATEWAY,
            ex.message ?: "Taiga-Fehler",
        ).apply { title = "Taiga-Fehler" }
}
