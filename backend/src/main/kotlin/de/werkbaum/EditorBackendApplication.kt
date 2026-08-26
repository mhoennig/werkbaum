package de.werkbaum

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication

@SpringBootApplication
@ConfigurationPropertiesScan
class EditorBackendApplication

fun main(args: Array<String>) {
    runApplication<EditorBackendApplication>(*args)
}
