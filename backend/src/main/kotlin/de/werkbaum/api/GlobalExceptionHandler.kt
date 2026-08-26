package de.werkbaum.api

import de.werkbaum.service.DocumentConflictException
import de.werkbaum.service.DocumentNotFoundException
import org.springframework.http.HttpStatus
import org.springframework.http.ProblemDetail
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

/**
 * Zentrale Fehlerbehandlung im Problem-Details-Format (RFC 9457),
 * passend zum ProblemDetail-Schema der OpenAPI-Spezifikation.
 */
@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(DocumentNotFoundException::class)
    fun handleNotFound(ex: DocumentNotFoundException): ProblemDetail =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.message ?: "Nicht gefunden").apply {
            title = "Dokument nicht gefunden"
        }

    @ExceptionHandler(DocumentConflictException::class)
    fun handleConflict(ex: DocumentConflictException): ProblemDetail =
        ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.message ?: "Konflikt").apply {
            title = "Konflikt"
        }
}
