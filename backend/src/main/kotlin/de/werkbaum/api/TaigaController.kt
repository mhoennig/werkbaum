package de.werkbaum.api

import de.werkbaum.generated.api.TaigaApi
import de.werkbaum.generated.model.TaigaAuthRequest
import de.werkbaum.generated.model.TaigaProject
import de.werkbaum.generated.model.TaigaSession
import de.werkbaum.generated.model.TaigaStoryCreateRequest
import de.werkbaum.generated.model.TaigaTaskCreateRequest
import de.werkbaum.generated.model.TaigaStatus
import de.werkbaum.generated.model.TaigaStatusPatch
import de.werkbaum.generated.model.TaigaTicket
import de.werkbaum.generated.model.TaigaTicketDetail
import de.werkbaum.integration.taiga.TaigaBadRequestException
import de.werkbaum.integration.taiga.TaigaBulkRefData
import de.werkbaum.integration.taiga.TaigaClient
import de.werkbaum.integration.taiga.TaigaTicketDetailData
import de.werkbaum.integration.taiga.TaigaTicketData
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Der Taiga-Proxy (D91) — implementiert das generierte Interface, wie der
 * DocumentsController seines: Ändert sich die Spezifikation, schlägt hier
 * der Compile fehl (API First).
 *
 * Hier gibt es nur die Abbildung API ↔ Client; alles Inhaltliche —
 * Ziel-URL aus der Server-Konfiguration, Fehlerklassen, das schmale
 * Antwortformat — liegt im [TaigaClient]. Kein Logging von Request-Bodies:
 * Der Auth-Endpunkt sieht das Passwort nur im Durchflug.
 */
@RestController
@RequestMapping("/api/v1")
class TaigaController(private val client: TaigaClient) : TaigaApi {

    override fun taigaLogin(taigaAuthRequest: TaigaAuthRequest): ResponseEntity<TaigaSession> {
        val session = client.login(taigaAuthRequest.username, taigaAuthRequest.password)
        return ResponseEntity.ok(
            TaigaSession(
                authToken = session.authToken,
                userId = session.userId,
                username = session.username,
                fullName = session.fullName,
            )
        )
    }

    override fun taigaProjects(xTaigaToken: String, member: Long): ResponseEntity<List<TaigaProject>> =
        ResponseEntity.ok(
            client.projects(xTaigaToken, member).map {
                TaigaProject(id = it.id, name = it.name, slug = it.slug)
            }
        )

    override fun taigaCreateStory(
        xTaigaToken: String,
        taigaStoryCreateRequest: TaigaStoryCreateRequest,
    ): ResponseEntity<TaigaTicket> {
        val ticket = client.createStory(
            token = xTaigaToken,
            project = taigaStoryCreateRequest.project,
            subject = taigaStoryCreateRequest.subject,
        )
        return created(ticket)
    }

    override fun taigaCreateTask(
        xTaigaToken: String,
        taigaTaskCreateRequest: TaigaTaskCreateRequest,
    ): ResponseEntity<TaigaTicket> {
        val ticket = client.createTask(
            token = xTaigaToken,
            project = taigaTaskCreateRequest.project,
            subject = taigaTaskCreateRequest.subject,
            userStory = taigaTaskCreateRequest.userStory,
        )
        return created(ticket)
    }

    /* Bulk-Lesen (D91-Nachtrag 10): eine Anfrage vom Editor, der Fächer läuft
       im Client. Die Refs kommen MIT Werkbaum-Präfix (`US-`/`T-`) — es trägt
       den Typ; geparst wird streng, Ungültiges ist ein 400 statt still
       übersprungen (D59-Linie). Doppelte Refs werden vor dem Fächer
       zusammengelegt. */
    override fun taigaTickets(
        xTaigaToken: String,
        slug: String,
        refs: String,
    ): ResponseEntity<Map<String, TaigaTicketDetail>> =
        ResponseEntity.ok(
            client.tickets(xTaigaToken, slug, parseBulkRefs(refs))
                .mapValues { it.value.toApi() }
        )

    private fun parseBulkRefs(refs: String): List<TaigaBulkRefData> {
        val teile = refs.split(',').distinct()
        if (teile.size > MAX_BULK_REFS) {
            throw TaigaBadRequestException("Höchstens $MAX_BULK_REFS Refs je Anfrage")
        }
        return teile.map { teil ->
            val m = BULK_REF.matchEntire(teil)
                ?: throw TaigaBadRequestException("Ungültige Ref: '$teil'")
            TaigaBulkRefData(key = teil, task = m.groupValues[1] == "T", nr = m.groupValues[2].toLong())
        }
    }

    /* Lesen (D91-Nachtrag 6): zwei Endpunkte statt eines mit Typ-Parameter —
       das Präfix der Ref trägt den Typ, und Taiga hat getrennte
       `by_ref`-Endpunkte. Die Abbildung des Status auf die Notation macht der
       Editor: Das Backend parst die Notation nicht (D14). */
    override fun taigaStoryByRef(xTaigaToken: String, ref: Long, slug: String) =
        ticket(xTaigaToken, slug, ref, task = false)

    override fun taigaTaskByRef(xTaigaToken: String, ref: Long, slug: String) =
        ticket(xTaigaToken, slug, ref, task = true)

    private fun ticket(token: String, slug: String, ref: Long, task: Boolean):
        ResponseEntity<TaigaTicketDetail> =
        ResponseEntity.ok(client.ticket(token, slug, ref, task).toApi())

    /* Schreiben (D91-Nachtrag 7/8): angestoßen wird es im Knoten-Fenster, von
       selbst geschieht nichts. Die Zielspalte kommt als Id herein — welche es
       ist, entscheidet der Editor über die Statusbox-Abbildung (D14). */
    override fun taigaStoryStatuses(xTaigaToken: String, slug: String) =
        statuses(xTaigaToken, slug, task = false)

    override fun taigaTaskStatuses(xTaigaToken: String, slug: String) =
        statuses(xTaigaToken, slug, task = true)

    private fun statuses(token: String, slug: String, task: Boolean):
        ResponseEntity<List<TaigaStatus>> =
        ResponseEntity.ok(
            client.statuses(token, slug, task).map {
                TaigaStatus(id = it.id, name = it.name, closed = it.closed)
            }
        )

    override fun taigaSetStoryStatus(
        xTaigaToken: String,
        ref: Long,
        slug: String,
        taigaStatusPatch: TaigaStatusPatch,
    ) = setStatus(xTaigaToken, slug, ref, task = false, patch = taigaStatusPatch)

    override fun taigaSetTaskStatus(
        xTaigaToken: String,
        ref: Long,
        slug: String,
        taigaStatusPatch: TaigaStatusPatch,
    ) = setStatus(xTaigaToken, slug, ref, task = true, patch = taigaStatusPatch)

    private fun setStatus(
        token: String,
        slug: String,
        ref: Long,
        task: Boolean,
        patch: TaigaStatusPatch,
    ): ResponseEntity<TaigaTicketDetail> =
        ResponseEntity.ok(
            client.setStatus(token, slug, ref, task, patch.status, patch.version).toApi()
        )

    private fun TaigaTicketDetailData.toApi() = TaigaTicketDetail(
        id = id,
        ref = ref,
        subject = subject,
        status = status,
        statusClosed = statusClosed,
        assignee = assignee,
        version = version,
    )

    private fun created(ticket: TaigaTicketData): ResponseEntity<TaigaTicket> =
        ResponseEntity.status(HttpStatus.CREATED).body(
            TaigaTicket(id = ticket.id, ref = ticket.ref, subject = ticket.subject)
        )

    companion object {
        /** Höchstens so viele Refs je Bulk-Anfrage — mehr referenziert kein Plan. */
        private const val MAX_BULK_REFS = 200
        private val BULK_REF = Regex("(US|T)-(\\d{1,10})")
    }
}
