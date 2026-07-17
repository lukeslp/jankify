/*
 * File Purpose: Define the standalone Jankify Android Gradle build.
 * Primary Functions: Configure dependency repositories and include the app module.
 * Inputs/Outputs: Reads Gradle project metadata and exposes :app to the build.
 */
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "JankifyAndroid"
include(":app")
