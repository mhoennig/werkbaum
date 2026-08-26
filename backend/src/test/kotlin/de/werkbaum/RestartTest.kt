package de.werkbaum

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import org.springframework.boot.builder.SpringApplicationBuilder
import java.nio.file.Path

/**
 * Die Anwendung muss **gegen ihre eigene Datenbank neu starten** können.
 *
 * Klingt selbstverständlich und war es nicht: `DATABASE_TO_LOWER=TRUE` lässt
 * H2 unquotierte Bezeichner klein anlegen (wie PostgreSQL, dafür steht es in
 * der URL), Liquibase sucht seine Verwaltungstabellen aber unter
 * `DATABASECHANGELOG`, findet nichts und legt sie an — woraufhin H2
 * „Table databasechangelog already exists" sagt. Der **erste** Start ging,
 * jeder weitere stürzte ab.
 *
 * Gefunden hat das erst der Server, nicht die Testsuite: Jeder Test bekommt
 * eine frische In-Memory-Datenbank, und auch von Hand gestartet wurde immer
 * gegen ein leeres Verzeichnis. Der Fall „starte noch einmal" kam schlicht nie
 * vor — bis der erste Deploy ihn zum Regelfall machte (D77-Nachtrag).
 *
 * Deshalb hier eine **Datei**-Datenbank und zwei Starts nacheinander. Der Test
 * kostet zwei Kontext-Starts; das ist er wert.
 */
class RestartTest {

    @Test
    fun `startet auch gegen eine bestehende Datenbank`(@TempDir dir: Path) {
        repeat(2) { lauf ->
            val context = SpringApplicationBuilder(EditorBackendApplication::class.java)
                .run(
                    // Überschrieben wird **nur das Verzeichnis**, nicht die
                    // ganze JDBC-URL: Sonst prüfte der Test eine URL, die er
                    // sich selbst ausgedacht hat, und die ausgelieferte bliebe
                    // ungeprüft — genau daran ist der erste Anlauf gescheitert.
                    //
                    // Und als **Argument**, nicht als `properties(...)`:
                    // Letztere sind Default-Properties mit der NIEDRIGSTEN
                    // Priorität, die `application.yaml` überstimmt sie.
                    "--werkbaum.data-dir=$dir",
                    "--server.port=0",
                    "--werkbaum.master-password.hash={noop}egal",
                )
            try {
                context.isRunning shouldBe true
            } finally {
                context.close()
            }
        }
    }
}
