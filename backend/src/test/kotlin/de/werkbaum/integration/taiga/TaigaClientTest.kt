package de.werkbaum.integration.taiga

import com.sun.net.httpserver.HttpServer
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.net.InetSocketAddress

/**
 * Der Taiga-Client gegen **aufgezeichnete Antworten** (Stub-Server im Test),
 * nie gegen die Live-Instanz (backend/CLAUDE.md). Die Antwortformen stammen
 * aus der Vermessung der Zielinstanz (D91-Nachtrag 1) bzw. der Taiga-API.
 */
class TaigaClientTest {

    private fun client() = TaigaClient(TaigaProperties(apiUrl = "http://127.0.0.1:$port/api/v1"))

    @BeforeEach
    fun reset() {
        recorded = null
        responseStatus = 200
        responseBody = "{}"
    }

    @Test
    fun `login reicht Typ, Benutzername und Passwort durch und liefert die schmale Sitzung`() {
        responseBody = AUTH_OK
        val session = client().login("mi", "geheim")

        session.authToken shouldBe "tok-abc123"
        session.userId shouldBe 42L
        session.username shouldBe "mi"
        session.fullName shouldBe "Michael"

        val req = recorded!!
        req.path shouldBe "/api/v1/auth"
        req.body shouldContain "\"type\":\"ldap\""
        req.body shouldContain "\"username\":\"mi\""
        req.body shouldContain "\"password\":\"geheim\""
    }

    @Test
    fun `abgelehnte Zugangsdaten (Taiga 400) werden mit Status und Fehlertext durchgereicht`() {
        responseStatus = 400
        responseBody = AUTH_FAIL
        val ex = shouldThrow<TaigaUpstreamException> { client().login("mi", "falsch") }
        ex.status shouldBe 400
        ex.message shouldContain "does not matches"
    }

    @Test
    fun `projects sendet Bearer-Token, member-Filter und schaltet die Paginierung ab`() {
        responseBody = PROJECTS_OK
        val projects = client().projects("tok-abc123", 42)

        projects.map { it.slug } shouldBe listOf("mi-intern", "mi-kunde")
        projects[0].id shouldBe 7L
        projects[0].name shouldBe "Intern"

        val req = recorded!!
        req.path shouldBe "/api/v1/projects"
        req.query shouldBe "member=42&order_by=user_order"
        req.auth shouldBe "Bearer tok-abc123"
        req.noPagination shouldBe "1"
    }

    @Test
    fun `createStory postet project und subject und liefert die Ref`() {
        responseStatus = 201
        responseBody = STORY_OK
        val ticket = client().createStory("tok-abc123", 7, "Backend bauen")

        ticket.ref shouldBe 123L
        ticket.id shouldBe 1234L
        ticket.subject shouldBe "Backend bauen"

        val req = recorded!!
        req.path shouldBe "/api/v1/userstories"
        req.auth shouldBe "Bearer tok-abc123"
        req.body shouldContain "\"project\":7"
        req.body shouldContain "\"subject\":\"Backend bauen\""
    }

    @Test
    fun `createTask haengt die Task per user_story an ihre Story`() {
        responseStatus = 201
        responseBody = TASK_OK
        val ticket = client().createTask("tok-abc123", 7, "API-Teil", 1234)

        ticket.ref shouldBe 124L
        recorded!!.path shouldBe "/api/v1/tasks"
        recorded!!.body shouldContain "\"user_story\":1234"
    }

    @Test
    fun `ohne konfigurierte Instanz gibt es kein Ziel`() {
        val bare = TaigaClient(TaigaProperties(apiUrl = ""))
        shouldThrow<TaigaNotConfiguredException> { bare.login("mi", "geheim") }
    }

    @Test
    fun `eine nicht erreichbare Instanz ist ein eigener, benannter Fehler`() {
        val dead = TaigaClient(TaigaProperties(apiUrl = "http://127.0.0.1:$deadPort/api/v1"))
        shouldThrow<TaigaUnavailableException> { dead.login("mi", "geheim") }
    }

    @Test
    fun `eine Antwort ohne die erwarteten Felder scheitert laut statt still`() {
        responseBody = """{"unexpected": true}"""
        val ex = shouldThrow<TaigaUnavailableException> { client().login("mi", "geheim") }
        ex.message shouldContain "auth_token"
    }

    data class Recorded(
        val path: String,
        val query: String?,
        val auth: String?,
        val noPagination: String?,
        val body: String,
    )

    companion object {
        private lateinit var server: HttpServer
        private var port = 0
        private var deadPort = 0
        @Volatile var recorded: Recorded? = null
        @Volatile var responseStatus = 200
        @Volatile var responseBody = "{}"

        /* Aufgezeichnete Antwortformen (gekuerzt auf die gebrauchten Felder
           plus typisches Beiwerk, damit der Client Unbekanntes ignoriert). */
        const val AUTH_OK =
            """{"id": 42, "username": "mi", "full_name": "Michael", "email": "mi@example.org", "auth_token": "tok-abc123", "roles": ["Product Owner"]}"""
        const val AUTH_FAIL =
            """{"_error_message": "Username or password does not matches user.", "_error_type": "taiga.base.exceptions.WrongArguments"}"""
        const val PROJECTS_OK =
            """[{"id": 7, "name": "Intern", "slug": "mi-intern", "description": "x"}, {"id": 9, "name": "Kunde", "slug": "mi-kunde", "description": "y"}]"""
        const val STORY_OK =
            """{"id": 1234, "ref": 123, "subject": "Backend bauen", "project": 7, "status": 1}"""
        const val TASK_OK =
            """{"id": 5678, "ref": 124, "subject": "API-Teil", "project": 7, "user_story": 1234}"""

        @JvmStatic
        @BeforeAll
        fun startStub() {
            server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
            server.createContext("/") { ex ->
                recorded = Recorded(
                    path = ex.requestURI.path,
                    query = ex.requestURI.query,
                    auth = ex.requestHeaders.getFirst("Authorization"),
                    noPagination = ex.requestHeaders.getFirst("x-disable-pagination"),
                    body = ex.requestBody.readBytes().decodeToString(),
                )
                val bytes = responseBody.encodeToByteArray()
                ex.responseHeaders.set("Content-Type", "application/json")
                ex.sendResponseHeaders(responseStatus, bytes.size.toLong())
                ex.responseBody.use { it.write(bytes) }
            }
            server.start()
            port = server.address.port
            /* Ein Port, hinter dem sicher nichts lauscht: kurz binden, wieder
               freigeben. */
            val probe = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
            deadPort = probe.address.port
            probe.stop(0)
        }

        @JvmStatic
        @AfterAll
        fun stopStub() = server.stop(0)
    }
}
