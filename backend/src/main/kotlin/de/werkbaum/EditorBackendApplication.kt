package de.werkbaum

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication
class EditorBackendApplication

fun main(args: Array<String>) {
    runApplication<EditorBackendApplication>(*args)
}
