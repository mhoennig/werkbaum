plugins {
    kotlin("jvm") version "2.2.20"
    kotlin("plugin.spring") version "2.2.20"
    kotlin("plugin.jpa") version "2.2.20"
    id("org.springframework.boot") version "4.0.2"
    id("io.spring.dependency-management") version "1.1.7"
    id("org.openapi.generator") version "7.25.0"
    jacoco
}

group = "de.werkbaum"
version = "0.1.0-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

val cucumberVersion = "7.23.0"
val mockkVersion = "1.13.16"

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    // Boot 4: Liquibase-Autokonfiguration liegt im eigenen Starter (zieht liquibase-core mit)
    implementation("org.springframework.boot:spring-boot-starter-liquibase")
    runtimeOnly("com.h2database:h2")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    // Jackson 3 (Standard in Spring Boot 4) + Kotlin-Modul
    implementation("tools.jackson.module:jackson-module-kotlin")

    // --- Tests ---
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    // RestTestClient-Autokonfiguration (Boot 4). TestRestTemplate gilt dort als
    // Auslaufmodell; die BDD-Tests nutzen den Nachfolger aus spring-test.
    testImplementation("org.springframework.boot:spring-boot-resttestclient")
    testImplementation("io.mockk:mockk:$mockkVersion")

    // Behavior-Tests (BDD) mit Cucumber
    testImplementation("io.cucumber:cucumber-java:$cucumberVersion")
    testImplementation("io.cucumber:cucumber-spring:$cucumberVersion")
    testImplementation("io.cucumber:cucumber-junit-platform-engine:$cucumberVersion")
    testImplementation("org.junit.platform:junit-platform-suite")
}

// ---------------------------------------------------------------------------
// API First: Code-Generierung aus der OpenAPI-Spezifikation
// ---------------------------------------------------------------------------
openApiGenerate {
    generatorName.set("kotlin-spring")
    inputSpec.set("$projectDir/src/main/resources/openapi/api.yaml")
    outputDir.set(layout.buildDirectory.dir("generated/openapi").get().asFile.path)
    apiPackage.set("de.werkbaum.generated.api")
    modelPackage.set("de.werkbaum.generated.model")
    configOptions.set(
        mapOf(
            "useSpringBoot4" to "true",
            "interfaceOnly" to "true",          // nur Interfaces + Modelle, Implementierung liegt bei uns
            "skipDefaultInterface" to "true",   // Controller MUSS alle Operationen implementieren
            "useTags" to "true",                // Interface-Name aus Tag: DocumentsApi
            "useBeanValidation" to "true",
            "documentationProvider" to "none",
            "enumPropertyNaming" to "UPPERCASE",
            "gradleBuildFile" to "false",
        )
    )
}

sourceSets {
    main {
        kotlin {
            srcDir(layout.buildDirectory.dir("generated/openapi/src/main/kotlin"))
        }
    }
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    dependsOn(tasks.openApiGenerate)
}

// ---------------------------------------------------------------------------
// Tests + Code Coverage
// ---------------------------------------------------------------------------
tasks.test {
    useJUnitPlatform()
    finalizedBy(tasks.jacocoTestReport)
}

jacoco {
    toolVersion = "0.8.13"
}

tasks.jacocoTestReport {
    dependsOn(tasks.test)
    reports {
        xml.required = true
        html.required = true
    }
    // Generierter Code zaehlt nicht zur Coverage
    classDirectories.setFrom(
        classDirectories.files.map {
            fileTree(it) { exclude("de/werkbaum/generated/**") }
        }
    )
}

tasks.jacocoTestCoverageVerification {
    dependsOn(tasks.test)
    classDirectories.setFrom(
        classDirectories.files.map {
            fileTree(it) { exclude("de/werkbaum/generated/**") }
        }
    )
    violationRules {
        rule {
            limit {
                counter = "LINE"
                minimum = "0.80".toBigDecimal()
            }
        }
    }
}

tasks.check {
    dependsOn(tasks.jacocoTestCoverageVerification)
}
