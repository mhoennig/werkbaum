package com.example.editor.bdd

import com.example.editor.repository.DocumentHistoryRepository
import com.example.editor.repository.DocumentRepository
import io.cucumber.java.Before
import io.cucumber.spring.CucumberContextConfiguration
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate
import org.springframework.boot.test.context.SpringBootTest

@CucumberContextConfiguration
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
// Seit Boot 4 stellt @SpringBootTest die TestRestTemplate-Bean nicht mehr von selbst bereit
@AutoConfigureTestRestTemplate
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
