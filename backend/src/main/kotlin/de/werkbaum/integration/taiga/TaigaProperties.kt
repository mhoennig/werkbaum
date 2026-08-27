package de.werkbaum.integration.taiga

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * Der Taiga-Proxy (D91).
 *
 * Die Basis-URL der Taiga-API ist **Server-Konfiguration**, nie
 * Request-Parameter — ein Proxy, der sein Ziel vom Aufrufer nimmt, ist ein
 * offenes Relay (die SSRF-Falle naiver Proxies). Leer heißt: Feature aus;
 * alle Taiga-Endpunkte antworten dann mit 503, und `GET /info` meldet
 * `taiga: false`, sodass der Editor die Aktionen gar nicht erst zeigt.
 */
@ConfigurationProperties(prefix = "werkbaum.taiga")
data class TaigaProperties(

    /**
     * Basis-URL der Taiga-**API**, nicht des Frontends — bei der Zielinstanz
     * liegt sie auf einem eigenen Host (`https://plan-api.hostsharing.net/api/v1`,
     * aus deren `conf.json` gelesen; D91-Nachtrag 1).
     */
    val apiUrl: String = "",

    /**
     * Login-Typ für `POST /auth`: `ldap` (LDAP-Plugin, so die Zielinstanz)
     * oder `normal`. Nur der Auth-Endpunkt braucht ihn; bei der angekündigten
     * OIDC-Umstellung wird er durch den Redirect-Flow ersetzt.
     */
    val authType: String = "ldap",
) {
    val configured: Boolean get() = apiUrl.isNotBlank()
}
