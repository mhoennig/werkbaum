package de.werkbaum.api

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

/**
 * Von welchen Herkünften darf der Editor die API ansprechen?
 *
 * Voreinstellung `*`. Das ist hier keine Nachlässigkeit, sondern das
 * Zugriffsmodell (D76): Wer die unerratbare UUID hat, darf; wer sie nicht hat,
 * findet sie auch über eine erlaubte Herkunft nicht. CORS schützt Cookies und
 * mitgesendete Anmeldedaten — beides gibt es hier nicht (`credentials: omit`).
 * Der Editor wiederum läuft je nach Installation überall: GitHub Pages, eigene
 * Domain, Dev-Server, `file://`.
 *
 * Wer es enger will, setzt `werkbaum.cors.allowed-origins` auf die eigenen
 * Adressen.
 */
@ConfigurationProperties(prefix = "werkbaum.cors")
data class CorsProperties(
    val allowedOrigins: List<String> = listOf("*"),
)

@Configuration
class CorsConfiguration(private val properties: CorsProperties) {

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val config = CorsConfiguration().apply {
            allowedOriginPatterns = properties.allowedOrigins
            allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            // Authorization fuer das Master-Passwort, Content-Type fuer JSON,
            // X-Taiga-Token fuer den Taiga-Proxy (D91).
            allowedHeaders = listOf("Authorization", "Content-Type", "X-Taiga-Token")
            // Nichts Vertrauliches im Spiel; Cookies werden nie mitgesendet.
            allowCredentials = false
            maxAge = 3600
        }
        return UrlBasedCorsConfigurationSource().apply {
            registerCorsConfiguration("/api/**", config)
        }
    }
}
