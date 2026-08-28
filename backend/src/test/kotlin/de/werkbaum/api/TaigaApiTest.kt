package de.werkbaum.api

import com.sun.net.httpserver.HttpServer
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.context.TestPropertySource
import org.springframework.test.web.servlet.client.RestTestClient
import java.net.InetSocketAddress

/**
 * Der Taiga-Proxy Ende-zu-Ende: eigene API -> Client -> Stub-Instanz.
 * Deckt die Verdrahtung ab, die der Unit-Test des Clients nicht sieht —
 * generierte Signaturen, Header-Namen, Fehler-Mapping, das Feature-Flag in
 * `GET /info`.
 */
@ActiveProfiles("test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureRestTestClient
@TestPropertySource(
    properties = [
        // Eigene Datenbank: zweiter Spring-Kontext (siehe MasterPasswordDefaultTest).
        "spring.datasource.url=jdbc:h2:mem:editor-taiga;" +
            "DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1",
    ]
)
class TaigaApiTest {

    @Autowired
    private lateinit var client: RestTestClient

    @Test
    fun `info meldet das konfigurierte Taiga-Feature`() {
        val result = client.get().uri("/api/v1/info").exchange().returnResult(String::class.java)
        result.status.value() shouldBe 200
        result.responseBody!! shouldContain "\"taiga\":true"
        // Die Web-Basis für die Ticket-Links (D91-Nachtrag 5) — ohne den
        // konfigurierten Schrägstrich am Ende.
        result.responseBody!! shouldContain "\"taigaWeb\":\"https://plan.example.test\""
    }

    @Test
    fun `die Anmeldung liefert die schmale Sitzung in camelCase`() {
        val result = client.post()
            .uri("/api/v1/taiga/auth")
            .header("Content-Type", "application/json")
            .body("""{"username":"mi","password":"geheim"}""")
            .exchange()
            .returnResult(String::class.java)
        result.status.value() shouldBe 200
        result.responseBody!! shouldContain "\"authToken\":\"tok-abc123\""
        result.responseBody!! shouldContain "\"userId\":42"
    }

    @Test
    fun `abgelehnte Zugangsdaten kommen als 400 mit Taigas Fehlertext an`() {
        stubStatus = 400
        stubBody = TaigaClientTestData.AUTH_FAIL
        try {
            val result = client.post()
                .uri("/api/v1/taiga/auth")
                .header("Content-Type", "application/json")
                .body("""{"username":"mi","password":"falsch"}""")
                .exchange()
                .returnResult(String::class.java)
            result.status.value() shouldBe 400
            result.responseBody!! shouldContain "does not matches"
        } finally {
            stubStatus = 200
            stubBody = null
        }
    }

    @Test
    fun `die Projektliste nimmt das Token aus X-Taiga-Token`() {
        val result = client.get()
            .uri("/api/v1/taiga/projects?member=42")
            .header("X-Taiga-Token", "tok-abc123")
            .exchange()
            .returnResult(String::class.java)
        result.status.value() shouldBe 200
        result.responseBody!! shouldContain "\"slug\":\"mi-intern\""
    }

    @Test
    fun `eine angelegte Story antwortet mit 201 und ihrer Ref`() {
        val result = client.post()
            .uri("/api/v1/taiga/userstories")
            .header("X-Taiga-Token", "tok-abc123")
            .header("Content-Type", "application/json")
            .body("""{"project":7,"subject":"Backend bauen"}""")
            .exchange()
            .returnResult(String::class.java)
        result.status.value() shouldBe 201
        result.responseBody!! shouldContain "\"ref\":123"
    }

    @Test
    fun `eine angelegte Task antwortet mit 201 und ihrer Ref`() {
        val result = client.post()
            .uri("/api/v1/taiga/tasks")
            .header("X-Taiga-Token", "tok-abc123")
            .header("Content-Type", "application/json")
            .body("""{"project":7,"subject":"API-Teil","userStory":1234}""")
            .exchange()
            .returnResult(String::class.java)
        result.status.value() shouldBe 201
        result.responseBody!! shouldContain "\"ref\":124"
    }

    @Test
    fun `eine Story-Ref wird ueber Slug und by_ref aufgeloest`() {
        val result = client.get()
            .uri("/api/v1/taiga/userstories/123?slug=mi-kunde")
            .header("X-Taiga-Token", "tok-abc123")
            .exchange()
            .returnResult(String::class.java)
        result.status.value() shouldBe 200
        result.responseBody!! shouldContain "\"subject\":\"Login bauen\""
        // Der Status kommt als NAME an; abgebildet wird er im Editor (D14).
        result.responseBody!! shouldContain "\"status\":\"In progress\""
        result.responseBody!! shouldContain "\"assignee\":\"Anna Beispiel\""
    }

    @Test
    fun `eine Task-Ref geht an den Task-Endpunkt und darf ohne Zustaendigen kommen`() {
        val result = client.get()
            .uri("/api/v1/taiga/tasks/1234?slug=mi-kunde")
            .header("X-Taiga-Token", "tok-abc123")
            .exchange()
            .returnResult(String::class.java)
        result.status.value() shouldBe 200
        result.responseBody!! shouldContain "\"status\":\"Done\""
        result.responseBody!! shouldContain "\"statusClosed\":true"
        // Niemand zugewiesen: ausdrücklich null, nicht geraten.
        result.responseBody!! shouldContain "\"assignee\":null"
    }

    @Test
    fun `die Workflow-Spalten eines Projekts kommen als Id und Name`() {
        val result = client.get()
            .uri("/api/v1/taiga/userstory-statuses?slug=mi-kunde")
            .header("X-Taiga-Token", "tok-abc123")
            .exchange()
            .returnResult(String::class.java)
        result.status.value() shouldBe 200
        result.responseBody!! shouldContain """{"id":12,"name":"In progress","closed":false}"""
    }

    @Test
    fun `die Bulk-Abfrage liefert eine Map unter den Werkbaum-Refs`() {
        val result = client.get()
            .uri("/api/v1/taiga/tickets?slug=mi-kunde&refs=US-123,T-1234")
            .header("X-Taiga-Token", "tok-abc123")
            .exchange()
            .returnResult(String::class.java)
        result.status.value() shouldBe 200
        result.responseBody!! shouldContain "\"US-123\""
        result.responseBody!! shouldContain "\"T-1234\""
        result.responseBody!! shouldContain "\"status\":\"In progress\""
        result.responseBody!! shouldContain "\"status\":\"Done\""
    }

    @Test
    fun `eine ungueltige Ref in der Bulk-Liste ist ein 400, nicht still uebersprungen`() {
        val result = client.get()
            .uri("/api/v1/taiga/tickets?slug=mi-kunde&refs=US-123,kaputt")
            .header("X-Taiga-Token", "tok-abc123")
            .exchange()
            .returnResult(String::class.java)
        result.status.value() shouldBe 400
        result.responseBody!! shouldContain "kaputt"
    }

    @Test
    fun `ein Status wird per Ref gesetzt und antwortet mit dem neuen Stand`() {
        val result = client.patch()
            .uri("/api/v1/taiga/userstories/123/status?slug=mi-kunde")
            .header("X-Taiga-Token", "tok-abc123")
            .header("Content-Type", "application/json")
            .body("""{"status":13,"version":7}""")
            .exchange()
            .returnResult(String::class.java)
        result.status.value() shouldBe 200
        result.responseBody!! shouldContain "\"status\":\"Done\""
        result.responseBody!! shouldContain "\"version\":8"
    }

    companion object {
        private lateinit var stub: HttpServer
        @Volatile private var stubStatus = 200
        @Volatile private var stubBody: String? = null

        private fun startStub() {
            if (::stub.isInitialized) return
            stub = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
            stub.createContext("/") { ex ->
                val canned = stubBody ?: when (ex.requestURI.path) {
                    "/api/v1/auth" -> TaigaClientTestData.AUTH_OK
                    "/api/v1/projects" -> TaigaClientTestData.PROJECTS_OK
                    "/api/v1/userstories" -> TaigaClientTestData.STORY_OK
                    "/api/v1/tasks" -> TaigaClientTestData.TASK_OK
                    "/api/v1/projects/by_slug" -> TaigaClientTestData.PROJECT_OK
                    "/api/v1/userstories/by_ref" -> TaigaClientTestData.STORY_DETAIL
                    "/api/v1/tasks/by_ref" -> TaigaClientTestData.TASK_DETAIL
                    "/api/v1/userstory-statuses", "/api/v1/task-statuses" ->
                        TaigaClientTestData.STATUSES_OK
                    "/api/v1/userstories/1234" -> TaigaClientTestData.STORY_PATCHED
                    else -> "{}"
                }
                val status = if (stubBody != null) stubStatus
                    else if (ex.requestMethod == "POST" && ex.requestURI.path != "/api/v1/auth") 201
                    else 200
                ex.requestBody.readBytes()
                val bytes = canned.encodeToByteArray()
                ex.responseHeaders.set("Content-Type", "application/json")
                ex.sendResponseHeaders(status, bytes.size.toLong())
                ex.responseBody.use { it.write(bytes) }
            }
            stub.start()
        }

        @JvmStatic
        @AfterAll
        fun stopStub() {
            if (::stub.isInitialized) stub.stop(0)
        }

        /* Der Stub muss VOR dem Spring-Kontext laufen — die Property braucht
           seinen Port. DynamicPropertySource läuft beim Kontextaufbau, also
           genau rechtzeitig. */
        @JvmStatic
        @DynamicPropertySource
        fun taigaUrl(registry: DynamicPropertyRegistry) {
            startStub()
            registry.add("werkbaum.taiga.api-url") { "http://127.0.0.1:${stub.address.port}/api/v1" }
            // Mit abschließendem Schrägstrich — /info muss ihn abstreifen.
            registry.add("werkbaum.taiga.web-url") { "https://plan.example.test/" }
        }
    }
}

/** Aufgezeichnete Antwortformen (dieselben Formen wie im Client-Unit-Test). */
object TaigaClientTestData {
    const val AUTH_OK =
        """{"id": 42, "username": "mi", "full_name": "Michael", "auth_token": "tok-abc123"}"""
    const val AUTH_FAIL =
        """{"_error_message": "Username or password does not matches user.", "_error_type": "taiga.base.exceptions.WrongArguments"}"""
    const val PROJECTS_OK =
        """[{"id": 7, "name": "Intern", "slug": "mi-intern"}, {"id": 9, "name": "Kunde", "slug": "mi-kunde"}]"""
    const val STORY_OK =
        """{"id": 1234, "ref": 123, "subject": "Backend bauen", "project": 7}"""
    const val TASK_OK =
        """{"id": 5678, "ref": 124, "subject": "API-Teil", "project": 7, "user_story": 1234}"""
    const val PROJECT_OK =
        """{"id": 7, "name": "Kunde", "slug": "mi-kunde"}"""
    const val STORY_DETAIL =
        """{"id": 1234, "ref": 123, "subject": "Login bauen", "project": 7, "version": 7,
            "status_extra_info": {"name": "In progress", "is_closed": false},
            "assigned_to_extra_info": {"full_name_display": "Anna Beispiel"}}"""
    const val STATUSES_OK =
        """[{"id": 11, "name": "New", "is_closed": false},
            {"id": 12, "name": "In progress", "is_closed": false},
            {"id": 13, "name": "Done", "is_closed": true}]"""
    const val STORY_PATCHED =
        """{"id": 1234, "ref": 123, "subject": "Login bauen", "version": 8,
            "status_extra_info": {"name": "Done", "is_closed": true}}"""
    const val TASK_DETAIL =
        """{"id": 5678, "ref": 1234, "subject": "API-Teil", "project": 7,
            "status_extra_info": {"name": "Done", "is_closed": true}}"""
}
