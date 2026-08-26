package com.example.editor.api

import com.example.editor.generated.api.DocumentsApi
import com.example.editor.generated.model.Document as ApiDocument
import com.example.editor.generated.model.DocumentCreateRequest
import com.example.editor.generated.model.DocumentHistoryEntry as ApiHistoryEntry
import com.example.editor.generated.model.DocumentUpdateRequest
import com.example.editor.generated.model.RestoreRequest
import com.example.editor.domain.Document
import com.example.editor.domain.DocumentHistoryEntry
import com.example.editor.service.DocumentService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

/**
 * Implementiert das aus der OpenAPI-Spezifikation generierte Interface.
 * Aendert sich die Spezifikation, schlaegt hier der Compile fehl – so bleibt
 * die Implementierung immer synchron zum Vertrag (API First).
 */
@RestController
@RequestMapping("/api/v1")
class DocumentsController(
    private val service: DocumentService,
) : DocumentsApi {

    override fun listDocuments(): ResponseEntity<List<ApiDocument>> =
        ResponseEntity.ok(service.findAll().map { it.toApi() })

    override fun createDocument(documentCreateRequest: DocumentCreateRequest): ResponseEntity<ApiDocument> {
        val created = service.create(
            title = documentCreateRequest.title,
            content = documentCreateRequest.content,
        )
        return ResponseEntity.status(HttpStatus.CREATED).body(created.toApi())
    }

    override fun getDocument(documentId: UUID): ResponseEntity<ApiDocument> =
        ResponseEntity.ok(service.findById(documentId).toApi())

    override fun updateDocument(
        documentId: UUID,
        documentUpdateRequest: DocumentUpdateRequest,
    ): ResponseEntity<ApiDocument> {
        val updated = service.update(
            id = documentId,
            title = documentUpdateRequest.title,
            content = documentUpdateRequest.content,
        )
        return ResponseEntity.ok(updated.toApi())
    }

    override fun deleteDocument(documentId: UUID): ResponseEntity<Unit> {
        service.delete(documentId)
        return ResponseEntity.noContent().build()
    }

    override fun getDocumentHistory(documentId: UUID): ResponseEntity<List<ApiHistoryEntry>> =
        ResponseEntity.ok(service.history(documentId).map { it.toApi() })

    override fun restoreDocument(
        documentId: UUID,
        restoreRequest: RestoreRequest?,
    ): ResponseEntity<ApiDocument> {
        val restored = service.restore(documentId, restoreRequest?.version)
        return ResponseEntity.ok(restored.toApi())
    }

    private fun Document.toApi(): ApiDocument = ApiDocument(
        id = id,
        title = title,
        content = content,
        version = version,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )

    private fun DocumentHistoryEntry.toApi(): ApiHistoryEntry = ApiHistoryEntry(
        documentId = documentId,
        version = version,
        title = title,
        content = content,
        changeType = ApiHistoryEntry.ChangeType.valueOf(changeType.name),
        timestamp = timestamp,
    )
}
