/*
 * File Purpose: Centralize validation rules for messages from Jankify web content.
 * Primary Functions: MIME allowlisting, payload sizing, filename sanitizing, and action parsing.
 * Inputs/Outputs: Accepts untrusted bridge strings; returns constrained values or rejects them.
 */
package com.lukesteuber.jankify

import org.json.JSONObject

internal object BridgePolicy {
    const val MAX_DECODED_BYTES = 50 * 1_024 * 1_024
    const val MAX_CLIPBOARD_CHARS = 2 * 1_024 * 1_024
    val maxEncodedChars: Int = ((MAX_DECODED_BYTES + 2) / 3) * 4

    val allowedMimeTypes = setOf(
        "application/json",
        "image/gif",
        "image/png",
        "image/svg+xml",
        "text/css",
        "text/html",
        "text/plain"
    )

    fun safeFilename(filename: String): String {
        val leaf = filename.substringAfterLast('/').substringAfterLast('\\')
        val sanitized = leaf.map { character ->
            if (character.isLetterOrDigit() || character in ".-_") character else '-'
        }.joinToString("").trim('.').take(180)
        return sanitized.ifEmpty { "jankify-export" }
    }

    fun decode(message: String): BridgeMessage {
        require(message.length <= maxEncodedChars + 1_024) { "Message too large" }
        val root = JSONObject(message)
        return when (root.getString("action")) {
            "pickImage" -> BridgeMessage.PickImage
            "copyText" -> {
                val text = root.getJSONObject("payload").getString("text")
                require(text.length <= MAX_CLIPBOARD_CHARS) { "Clipboard text too large" }
                BridgeMessage.CopyText(text)
            }
            "share" -> {
                val payload = root.getJSONObject("payload")
                val mimeType = payload.getString("mimeType")
                require(mimeType in allowedMimeTypes) { "Unsupported MIME type" }
                val base64 = payload.getString("base64")
                require(base64.length <= maxEncodedChars) { "Export too large" }
                BridgeMessage.Share(
                    safeFilename(payload.getString("filename")),
                    mimeType,
                    base64
                )
            }
            else -> throw IllegalArgumentException("Unsupported bridge action")
        }
    }
}

internal sealed interface BridgeMessage {
    data object PickImage : BridgeMessage
    data class CopyText(val text: String) : BridgeMessage
    data class Share(val filename: String, val mimeType: String, val base64: String) : BridgeMessage
}
