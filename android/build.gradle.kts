/*
 * File Purpose: Pin Android and Kotlin build plugins for the Jankify shell.
 * Primary Functions: Make plugin versions available to Android modules.
 * Inputs/Outputs: Resolves cached or remote Gradle plugins; produces no artifact directly.
 */
plugins {
    id("com.android.application") version "8.13.0" apply false
    id("org.jetbrains.kotlin.android") version "2.2.21" apply false
}
