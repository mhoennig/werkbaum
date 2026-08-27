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
        requests.clear()
        routes.clear()
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

    /* ---- Lesen über die Ref (D91-Nachtrag 6) ---- */

    @Test
    fun `ticket loest erst den Slug zur Projekt-Id auf und liest dann per by_ref`() {
        routes["/api/v1/projects/by_slug"] = 200 to PROJECT_OK
        routes["/api/v1/userstories/by_ref"] = 200 to STORY_DETAIL
        val d = client().ticket("tok-abc123", "mi-kunde", 123, task = false)

        d.ref shouldBe 123L
        d.id shouldBe 1234L
        d.subject shouldBe "Login bauen"
        d.status shouldBe "In progress"
        d.statusClosed shouldBe false
        d.assignee shouldBe "Anna Beispiel"

        requests.map { it.path } shouldBe
            listOf("/api/v1/projects/by_slug", "/api/v1/userstories/by_ref")
        requests[0].query shouldBe "slug=mi-kunde"
        requests[1].query shouldBe "project=7&ref=123"
        requests.all { it.auth == "Bearer tok-abc123" } shouldBe true
    }

    @Test
    fun `eine Task wird ueber ihren eigenen by_ref-Endpunkt gelesen`() {
        routes["/api/v1/projects/by_slug"] = 200 to PROJECT_OK
        routes["/api/v1/tasks/by_ref"] = 200 to TASK_DETAIL
        val d = client().ticket("tok-abc123", "mi-kunde", 1234, task = true)

        d.ref shouldBe 1234L
        d.status shouldBe "Done"
        requests[1].path shouldBe "/api/v1/tasks/by_ref"
        requests[1].query shouldBe "project=7&ref=1234"
    }

    @Test
    fun `ohne extra_info bleiben Status und Zustaendiger leer statt geraten`() {
        routes["/api/v1/projects/by_slug"] = 200 to PROJECT_OK
        routes["/api/v1/userstories/by_ref"] = 200 to STORY_BARE
        val d = client().ticket("tok-abc123", "mi-kunde", 123, task = false)

        d.subject shouldBe "Login bauen"
        d.status shouldBe null
        d.statusClosed shouldBe null
        d.assignee shouldBe null
    }

    @Test
    fun `ein unbekanntes Projekt wird als 404 durchgereicht, ohne zweiten Umlauf`() {
        routes["/api/v1/projects/by_slug"] = 404 to NOT_FOUND
        val ex = shouldThrow<TaigaUpstreamException> {
            client().ticket("tok-abc123", "gibt-es-nicht", 123, task = false)
        }
        ex.status shouldBe 404
        requests.map { it.path } shouldBe listOf("/api/v1/projects/by_slug")
    }

    @Test
    fun `der Slug wird kodiert - ein & haengt keinen weiteren Filter an`() {
        routes["/api/v1/projects/by_slug"] = 200 to PROJECT_OK
        routes["/api/v1/userstories/by_ref"] = 200 to STORY_DETAIL
        client().ticket("tok-abc123", "a&member=1", 123, task = false)
        requests[0].query shouldBe "slug=a%26member%3D1"
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

        /* Das Lesen eines Tickets braucht ZWEI Umläufe (Slug -> Id, dann
           by_ref) — deshalb Antworten je Pfad und alle Anfragen der Reihe
           nach, statt nur der letzten. */
        val routes = mutableMapOf<String, Pair<Int, String>>()
        val requests = mutableListOf<Recorded>()

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
        const val PROJECT_OK =
            """{"id": 7, "name": "Kunde", "slug": "mi-kunde"}"""
        /* Form der by_ref-Antwort: die Namen stehen in den
           `*_extra_info`-Blöcken, die Ids daneben (Taiga-API). */
        const val STORY_DETAIL =
            """{"id": 1234, "ref": 123, "subject": "Login bauen", "project": 7, "status": 3,
                "status_extra_info": {"name": "In progress", "color": "#ff9900", "is_closed": false},
                "assigned_to": 42,
                "assigned_to_extra_info": {"username": "anna", "full_name_display": "Anna Beispiel"}}"""
        const val TASK_DETAIL =
            """{"id": 5678, "ref": 1234, "subject": "API-Teil", "project": 7,
                "status_extra_info": {"name": "Done", "is_closed": true},
                "assigned_to_extra_info": null}"""
        const val STORY_BARE =
            """{"id": 1234, "ref": 123, "subject": "Login bauen", "project": 7, "status": 3}"""
        const val NOT_FOUND =
            """{"_error_message": "Not found.", "_error_type": "taiga.base.exceptions.NotFound"}"""

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
                requests += recorded!!
                val route = routes[ex.requestURI.path]
                val status = route?.first ?: responseStatus
                val bytes = (route?.second ?: responseBody).encodeToByteArray()
                ex.responseHeaders.set("Content-Type", "application/json")
                ex.sendResponseHeaders(status, bytes.size.toLong())
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
