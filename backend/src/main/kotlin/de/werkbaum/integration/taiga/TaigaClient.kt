package de.werkbaum.integration.taiga

import org.springframework.core.ParameterizedTypeReference
import org.springframework.http.MediaType
import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.stereotype.Service
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException
import java.net.URLEncoder
import java.net.http.HttpClient
import java.nio.charset.StandardCharsets
import java.time.Duration

/** Keine Taiga-Instanz konfiguriert — der Proxy hat kein Ziel (503). */
class TaigaNotConfiguredException :
    RuntimeException("Keine Taiga-Instanz konfiguriert (werkbaum.taiga.api-url)")

/** Taiga nicht erreichbar oder mit unbrauchbarer Antwort (502). */
class TaigaUnavailableException(message: String, cause: Throwable? = null) :
    RuntimeException(message, cause)

/**
 * Taiga hat mit einem Fehlerstatus geantwortet. 4xx wird durchgereicht
 * (Taiga meldet z. B. falsche Zugangsdaten als 400), 5xx wird zu 502 —
 * ein fremder Serverfehler ist aus Client-Sicht „Upstream kaputt“.
 */
class TaigaUpstreamException(val status: Int, message: String) : RuntimeException(message)

data class TaigaSessionData(
    val authToken: String,
    val userId: Long,
    val username: String,
    val fullName: String?,
)

data class TaigaProjectData(val id: Long, val name: String, val slug: String)

data class TaigaTicketData(val id: Long, val ref: Long, val subject: String)

/**
 * Der gelesene Stand eines Tickets (D91-Nachtrag 6). Status und Zuständiger
 * kommen aus Taigas `*_extra_info`-Blöcken und sind **nullbar**: Liefert die
 * Instanz sie nicht mit, fehlt die Zeile im Knoten-Fenster — geraten wird
 * nicht.
 */
data class TaigaTicketDetailData(
    val id: Long,
    val ref: Long,
    val subject: String,
    val status: String?,
    val statusClosed: Boolean?,
    val assignee: String?,
)

/**
 * Schmaler, benannter Client zur konfigurierten Taiga-Instanz (D91) — kein
 * Durchreich-Proxy: genau die vier Aufrufe, die die Ticket-Anlage braucht.
 *
 * Das Token kommt je Aufruf vom Browser herein und geht als
 * `Authorization: Bearer …` hinaus; der Server **speichert nichts** und
 * **loggt keine Request-Bodies** (der Auth-Endpunkt sieht das Passwort nur
 * im Durchflug). Die Antworten werden als Maps gelesen und auf die schmalen
 * Datenklassen abgebildet — so hängt nichts an Taigas übrigen Feldern.
 */
@Service
class TaigaClient(private val properties: TaigaProperties) {

    private val rest: RestClient = RestClient.builder()
        .requestFactory(
            JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build()
            ).apply { setReadTimeout(Duration.ofSeconds(20)) }
        )
        .build()

    fun login(username: String, password: String): TaigaSessionData {
        val map = exchange {
            rest.post().uri(url("/auth"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(mapOf("type" to properties.authType, "username" to username, "password" to password))
                .retrieve().body(MAP)
        } ?: throw TaigaUnavailableException("Leere Antwort von Taiga (/auth)")
        return TaigaSessionData(
            authToken = str(map, "auth_token"),
            userId = num(map, "id"),
            username = str(map, "username"),
            fullName = map["full_name"] as? String,
        )
    }

    fun projects(token: String, member: Long): List<TaigaProjectData> {
        val list = exchange {
            rest.get().uri(url("/projects?member=$member&order_by=user_order"))
                .header("Authorization", "Bearer $token")
                // Taiga paginiert sonst bei 30 — die Projektliste eines
                // Nutzers soll vollständig sein.
                .header("x-disable-pagination", "1")
                .retrieve().body(LIST)
        } ?: emptyList()
        return list.map { TaigaProjectData(num(it, "id"), str(it, "name"), str(it, "slug")) }
    }

    fun createStory(token: String, project: Long, subject: String): TaigaTicketData =
        create(token, "/userstories", mapOf("project" to project, "subject" to subject))

    fun createTask(token: String, project: Long, subject: String, userStory: Long): TaigaTicketData =
        // Taigas Feldname; unsere API sagt `userStory` (camelCase wie überall).
        create(token, "/tasks", mapOf("project" to project, "subject" to subject, "user_story" to userStory))

    /**
     * Ein Ticket über seine **Ref** lesen (D91-Nachtrag 6). Zwei Schritte,
     * weil eine Ref nur je Projekt eindeutig ist: erst der Projekt-Slug zur
     * Id (`/projects/by_slug`), dann `by_ref` am passenden Endpunkt. Beide
     * sind dokumentierte Taiga-Endpunkte — der eine gesparte Umlauf über
     * `project__slug` wäre eine Wette auf eine Filter-Eigenheit gewesen.
     *
     * `task` unterscheidet die beiden Typen; welcher gemeint ist, weiß der
     * Aufrufer aus dem Präfix der Ref (`US-`/`T-`, SPEC §11) — hier steht
     * nur, wohin gefragt wird.
     */
    fun ticket(token: String, slug: String, ref: Long, task: Boolean): TaigaTicketDetailData {
        val project = projectId(token, slug)
        val pfad = if (task) "/tasks/by_ref" else "/userstories/by_ref"
        val map = exchange {
            rest.get().uri(url("$pfad?project=$project&ref=$ref"))
                .header("Authorization", "Bearer $token")
                .retrieve().body(MAP)
        } ?: throw TaigaUnavailableException("Leere Antwort von Taiga ($pfad)")
        return TaigaTicketDetailData(
            id = num(map, "id"),
            ref = num(map, "ref"),
            subject = str(map, "subject"),
            status = extra(map, "status_extra_info")?.get("name") as? String,
            statusClosed = extra(map, "status_extra_info")?.get("is_closed") as? Boolean,
            assignee = extra(map, "assigned_to_extra_info")?.get("full_name_display") as? String,
        )
    }

    /**
     * Projekt-Slug -> Id; Taigas `by_ref` filtert über die Id. Der Slug kommt
     * vom Client und wird deshalb **kodiert** in die Anfrage gesetzt — sonst
     * hängte ein `&` daran einen weiteren Filter an.
     */
    fun projectId(token: String, slug: String): Long {
        val map = exchange {
            rest.get().uri(url("/projects/by_slug?slug=" + enc(slug)))
                .header("Authorization", "Bearer $token")
                .retrieve().body(MAP)
        } ?: throw TaigaUnavailableException("Leere Antwort von Taiga (/projects/by_slug)")
        return num(map, "id")
    }

    @Suppress("UNCHECKED_CAST")
    private fun extra(m: Map<String, Any?>, key: String): Map<String, Any?>? =
        m[key] as? Map<String, Any?>

    private fun create(token: String, path: String, body: Map<String, Any>): TaigaTicketData {
        val map = exchange {
            rest.post().uri(url(path))
                .header("Authorization", "Bearer $token")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve().body(MAP)
        } ?: throw TaigaUnavailableException("Leere Antwort von Taiga ($path)")
        return TaigaTicketData(id = num(map, "id"), ref = num(map, "ref"), subject = str(map, "subject"))
    }

    private fun enc(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8)

    private fun url(path: String): String {
        if (!properties.configured) throw TaigaNotConfiguredException()
        return properties.apiUrl.trimEnd('/') + path
    }

    private fun <T> exchange(call: () -> T): T =
        try {
            call()
        } catch (e: RestClientResponseException) {
            // Der Fehlertext kommt aus Taigas ANTWORT (`_error_message`) —
            // nie aus der Anfrage; Zugangsdaten stehen darin nicht.
            throw TaigaUpstreamException(e.statusCode.value(), errorMessage(e))
        } catch (e: ResourceAccessException) {
            throw TaigaUnavailableException("Taiga-Instanz nicht erreichbar: ${e.message}", e)
        }

    private fun errorMessage(e: RestClientResponseException): String {
        val fromBody = Regex("\"_error_message\"\\s*:\\s*\"([^\"]*)\"")
            .find(e.responseBodyAsString)?.groupValues?.get(1)
        return fromBody ?: "Taiga antwortete mit ${e.statusCode.value()}"
    }

    private fun str(m: Map<String, Any?>, key: String): String =
        m[key] as? String
            ?: throw TaigaUnavailableException("Unerwartete Taiga-Antwort: Feld '$key' fehlt")

    private fun num(m: Map<String, Any?>, key: String): Long =
        (m[key] as? Number)?.toLong()
            ?: throw TaigaUnavailableException("Unerwartete Taiga-Antwort: Feld '$key' fehlt")

    companion object {
        private val MAP = object : ParameterizedTypeReference<Map<String, Any?>>() {}
        private val LIST = object : ParameterizedTypeReference<List<Map<String, Any?>>>() {}
    }
}
