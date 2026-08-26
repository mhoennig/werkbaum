package com.example.editor.repository

import com.example.editor.domain.Document
import java.util.UUID

/**
 * Abstraktion über die Persistenz. Die In-Memory-Implementierung ist ein
 * Platzhalter und kann später durch JPA/R2DBC ersetzt werden, ohne dass
 * Service oder Controller angepasst werden müssen.
 */
interface DocumentRepository {
    fun findAll(): List<Document>
    fun findById(id: UUID): Document?
    fun save(document: Document): Document
    fun deleteById(id: UUID): Boolean
    fun clear()
}
