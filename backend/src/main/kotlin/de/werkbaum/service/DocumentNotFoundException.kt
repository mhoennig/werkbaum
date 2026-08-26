package de.werkbaum.service

import java.util.UUID

class DocumentNotFoundException(id: UUID) :
    RuntimeException("Dokument mit ID $id wurde nicht gefunden")
