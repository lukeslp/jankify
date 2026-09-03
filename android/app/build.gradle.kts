/*
 * File Purpose: Build the offline Jankify Android application and release artifacts.
 * Primary Functions: Configure API 36, JDK 21, optional environment-only signing, and tests.
 * Inputs/Outputs: Consumes Kotlin/resources/assets; produces APK and Android App Bundle files.
 */
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val signingValues = listOf(
    "JANKIFY_STORE_FILE",
    "JANKIFY_STORE_PASSWORD",
    "JANKIFY_KEY_ALIAS",
    "JANKIFY_KEY_PASSWORD"
).associateWith { providers.environmentVariable(it).orNull }
val hasReleaseSigning = signingValues.values.all { !it.isNullOrBlank() }

android {
    namespace = "com.lukesteuber.jankify"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.lukesteuber.jankify"
        minSdk = 26
        targetSdk = 36
        versionCode = 17
        versionName = "1.0.10"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(signingValues.getValue("JANKIFY_STORE_FILE")!!)
                storePassword = signingValues.getValue("JANKIFY_STORE_PASSWORD")
                keyAlias = signingValues.getValue("JANKIFY_KEY_ALIAS")
                keyPassword = signingValues.getValue("JANKIFY_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }
    buildFeatures {
        buildConfig = true
    }
    testOptions {
        unitTests.isIncludeAndroidResources = false
    }
    lint {
        // Core 1.19 requires API 37/AGP 9.1; 1.18 is the API 36-compatible release.
        disable += "GradleDependency"
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.18.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test:runner:1.7.0")
    androidTestImplementation("androidx.test:rules:1.7.0")
}

tasks.register("printVersion") {
    group = "help"
    description = "Prints the Android versionName for release staging."
    doLast {
        println(android.defaultConfig.versionName)
    }
}
