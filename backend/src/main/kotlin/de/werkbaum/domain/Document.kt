package de.werkbaum.domain

import java.time.OffsetDateTime
import java.util.UUID

/**
 * Internes Domänenmodell (bewusst getrennt vom generierten API-Modell).
 *
 * [version] wird bei jeder Änderung inkrementiert und dient später als Basis
 * für Optimistic Locking und Live-Editing-Konflikterkennung.
 * [content] ist ein opaker String – bei clientseitiger Verschlüsselung wird
 * hier später Ciphertext gespeichert, ohne dass sich das Modell ändert.
 */
data class Document(
    val id: UUID,
    val title: String,
    val content: String,
    val version: Long,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime,
)
