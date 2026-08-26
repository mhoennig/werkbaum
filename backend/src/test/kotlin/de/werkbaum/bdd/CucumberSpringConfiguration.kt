package de.werkbaum.bdd

import de.werkbaum.repository.DocumentHistoryRepository
import de.werkbaum.repository.DocumentRepository
import io.cucumber.java.Before
import io.cucumber.spring.CucumberContextConfiguration
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient
import org.springframework.boot.test.context.SpringBootTest

@CucumberContextConfiguration
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
// Seit Boot 4 stellt @SpringBootTest die Test-Client-Bean nicht mehr von selbst bereit
@AutoConfigureRestTestClient
class CucumberSpringConfiguration {

    @Autowired
    private lateinit var repository: DocumentRepository

    @Autowired
    private lateinit var historyRepository: DocumentHistoryRepository

    @Before
    fun resetState() {
        repository.clear()
        historyRepository.clear()
    }
}
