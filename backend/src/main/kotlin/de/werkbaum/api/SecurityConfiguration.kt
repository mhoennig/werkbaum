package de.werkbaum.api

import de.werkbaum.service.LoginThrottle
import de.werkbaum.service.MasterPasswordProperties
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.event.EventListener
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent
import org.springframework.security.authentication.event.AuthenticationSuccessEvent
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.core.userdetails.User
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.crypto.factory.PasswordEncoderFactories
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.provisioning.InMemoryUserDetailsManager
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

/**
 * Schützt **genau einen** Endpunkt: `GET /api/v1/documents`.
 *
 * Das Zugriffsmodell ist die unerratbare UUID (D76) – eine Liste aller
 * Dokumente machte jede davon auffindbar und das Modell hinfällig. Alles
 * andere bleibt bewusst offen; echte Authentifizierung kommt später als
 * Schicht davor, ohne dass sich am Protokoll etwas ändert.
 */
@Configuration
class SecurityConfiguration {

    private val log = LoggerFactory.getLogger(javaClass)

    /**
     * Der Hash trägt sein Verfahren als Präfix (`{bcrypt}\$2a\$…`). So steht in
     * der Konfiguration, womit gehasht wurde, und ein Wechsel des Verfahrens
     * bricht nichts.
     */
    @Bean
    fun passwordEncoder(): PasswordEncoder =
        PasswordEncoderFactories.createDelegatingPasswordEncoder()

    /**
     * Ein einziger Benutzer mit dem konfigurierten Hash. Ohne Konfiguration
     * bekommt er ein zufälliges, nirgends notiertes Passwort – der Zugang ist
     * dann ohnehin schon per `denyAll` versperrt (siehe unten); das hier ist
     * der zweite Riegel für den Fall, dass jemand den ersten wegnimmt.
     */
    @Bean
    fun masterUser(properties: MasterPasswordProperties): UserDetailsService {
        if (!properties.configured) {
            log.warn(
                "werkbaum.master-password.hash ist nicht gesetzt – " +
                    "GET /api/v1/documents bleibt gesperrt."
            )
        }
        val hash = if (properties.configured) properties.hash
        else passwordEncoder().encode(java.util.UUID.randomUUID().toString())
        return InMemoryUserDetailsManager(
            User.withUsername(MASTER_USERNAME).password(hash).roles("LIST").build()
        )
    }

    @Bean
    fun apiSecurity(
        http: HttpSecurity,
        throttle: LoginThrottle,
        properties: MasterPasswordProperties,
    ): SecurityFilterChain =
        http
            // Zustandslose API: keine Sitzung, kein CSRF-Token. Der Schutz
            // hängt am Passwort, nicht an einem Cookie – ein CSRF-Token
            // schützte hier nichts und bräche jeden Client.
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests {
                val liste = it.requestMatchers(HttpMethod.GET, "/api/v1/documents")
                // Ohne konfiguriertes Passwort wird die Liste ausdrücklich
                // verweigert, statt hinter einem Geheimnis zu liegen, das
                // niemand kennt: Was gesperrt sein soll, soll auch gesperrt
                // dastehen - nachlesbar und prüfbar.
                if (properties.configured) liste.hasRole("LIST") else liste.denyAll()
                it.anyRequest().permitAll()
            }
            .httpBasic { }
            .addFilterBefore(LockoutFilter(throttle), BasicAuthenticationFilter::class.java)
            .build()

    companion object {
        const val MASTER_USERNAME = "werkbaum"
    }
}

/** Weist Anfragen ab, solange die Sperre steht – vor jeder Passwortprüfung. */
class LockoutFilter(private val throttle: LoginThrottle) : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        if (request.getHeader("Authorization") != null && throttle.locked()) {
            response.setHeader("Retry-After", throttle.retryAfterSeconds().toString())
            response.sendError(
                HttpStatus.TOO_MANY_REQUESTS.value(),
                "Zu viele Fehlversuche – bitte später erneut versuchen",
            )
            return
        }
        filterChain.doFilter(request, response)
    }
}

/**
 * Zählt Fehlversuche mit. Spring Security veröffentlicht die Ereignisse von
 * selbst – dadurch hängt die Sperre nicht in der Passwortprüfung fest und
 * bleibt für sich prüfbar.
 */
@Component
class LoginAttemptListener(private val throttle: LoginThrottle) {

    @EventListener
    fun onFailure(event: AuthenticationFailureBadCredentialsEvent) = throttle.recordFailure()

    @EventListener
    fun onSuccess(event: AuthenticationSuccessEvent) = throttle.recordSuccess()
}
