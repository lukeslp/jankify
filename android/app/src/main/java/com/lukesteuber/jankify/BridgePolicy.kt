/*
 * File Purpose: Centralize validation rules for messages from Jankify web content.
 * Primary Functions: MIME allowlisting, payload sizing, filename sanitizing, and action parsing.
 * Inputs/Outputs: Accepts untrusted bridge strings; returns constrained values or rejects them.
 */
package com.lukesteuber.jankify

import org.json.JSONObject
import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

internal object BridgePolicy {
    const val APP_HOST = "appassets.androidplatform.net"
    const val APP_URL = "https://$APP_HOST/assets/index.html"
    const val CREATE_URL = "https://$APP_HOST/assets/create/app/index.html"
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
        "text/plain",
        "video/mp4",
        "video/webm"
    )

    private val rootAssets = setOf("index.html", "offline.css", "android-bridge.js")
    private val createExtensions = setOf("html", "css", "js", "mjs", "json", "png", "txt")

    const val contentSecurityPolicy =
        "default-src 'self'; base-uri 'self'; connect-src 'none'; form-action 'none'; " +
            "frame-src 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; " +
            "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
            "media-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:"

    fun assetPathForUrl(rawUrl: String?): String? {
        if (rawUrl == null) return null
        val uri = runCatching { URI(rawUrl) }.getOrNull() ?: return null
        if (!uri.scheme.equals("https", ignoreCase = true) || uri.host != APP_HOST) return null
        if (uri.port != -1 || uri.rawUserInfo != null) return null
        val prefix = "/assets/"
        val rawPath = uri.rawPath ?: return null
        if (!rawPath.startsWith(prefix)) return null
        val encodedAsset = rawPath.removePrefix(prefix)
        val asset = runCatching {
            URLDecoder.decode(encodedAsset.replace("+", "%2B"), StandardCharsets.UTF_8.name())
        }.getOrNull() ?: return null
        if (asset.isEmpty() || asset.contains('\\') || asset.any { it.code < 0x20 || it.code == 0x7f }) {
            return null
        }
        val segments = asset.split('/')
        if (segments.any { it.isEmpty() || it == "." || it == ".." }) return null
        if (asset in rootAssets) return asset
        if (!asset.startsWith("create/")) return null
        val extension = asset.substringAfterLast('.', missingDelimiterValue = "").lowercase()
        return asset.takeIf { extension in createExtensions }
    }

    fun isAllowedMainDocumentUrl(rawUrl: String?): Boolean {
        val path = assetPathForUrl(rawUrl) ?: return false
        return path == "index.html" || path == "create/app/index.html"
    }

    fun mimeTypeForAsset(asset: String): String = when (asset.substringAfterLast('.').lowercase()) {
        "html" -> "text/html"
        "css" -> "text/css"
        "js", "mjs" -> "text/javascript"
        "json" -> "application/json"
        "png" -> "image/png"
        "txt" -> "text/plain"
        else -> "application/octet-stream"
    }

    fun isAllowedImportMimeType(mimeType: String): Boolean =
        mimeType.startsWith("image/") || mimeType.startsWith("video/")

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
