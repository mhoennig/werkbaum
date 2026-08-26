package com.example.editor.service

import java.util.UUID

class DocumentNotFoundException(id: UUID) :
    RuntimeException("Dokument mit ID $id wurde nicht gefunden")
