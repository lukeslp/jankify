/*
 * File Purpose: Host Jankify's bundled web app in a secure, offline Android WebView.
 * Primary Functions: Serve trusted assets, constrain navigation, pick photos, share exports, and copy text.
 * Inputs/Outputs: Receives local web bridge messages and document URIs; emits native intents and web callbacks.
 */
package com.lukesteuber.jankify

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.provider.OpenableColumns
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.MimeTypeMap
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.InputStream
import java.util.Base64
import java.util.concurrent.Executors

@Suppress("DEPRECATION")
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private val bridgeExecutor = Executors.newSingleThreadExecutor()
    private val backCallback = OnBackInvokedCallback(::handleBack)
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        webView = WebView(this).apply {
            contentDescription = getString(R.string.web_content_description)
            importantForAccessibility = WebView.IMPORTANT_FOR_ACCESSIBILITY_YES
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = false
                allowFileAccess = false
                allowContentAccess = false
                allowFileAccessFromFileURLs = false
                allowUniversalAccessFromFileURLs = false
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                cacheMode = WebSettings.LOAD_NO_CACHE
                setSupportZoom(true)
                builtInZoomControls = true
                displayZoomControls = false
                mediaPlaybackRequiresUserGesture = true
                textZoom = (resources.configuration.fontScale * 100).toInt().coerceIn(100, 200)
                userAgentString = "$userAgentString JankifyAndroid/${BuildConfig.VERSION_NAME}"
            }
            webViewClient = OfflineWebViewClient()
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = filePathCallback
                    val intent = fileChooserParams?.createIntent()
                        ?: Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                            addCategory(Intent.CATEGORY_OPENABLE)
                            type = "image/*"
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                    return runCatching {
                        startActivityForResult(intent, FILE_CHOOSER_REQUEST)
                        true
                    }.getOrElse {
                        this@MainActivity.filePathCallback = null
                        filePathCallback?.onReceiveValue(null)
                        showError(R.string.no_handler)
                        false
                    }
                }
            }
            addJavascriptInterface(NativeBridge(), BRIDGE_NAME)
        }
        setContentView(webView)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                backCallback
            )
        }
        webView.loadUrl(APP_URL)
    }

    @Deprecated("Android callback required for the framework document picker")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_CHOOSER_REQUEST) {
            val callback = filePathCallback
            filePathCallback = null
            val uris = if (resultCode == RESULT_OK) {
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            } else {
                null
            }
            callback?.onReceiveValue(uris)
            return
        }
        if (requestCode != PICK_IMAGE_REQUEST || resultCode != RESULT_OK) return
        val uri = data?.data ?: return
        bridgeExecutor.execute {
            runCatching { importImage(uri) }
                .onFailure { runOnUiThread { showError(R.string.image_load_failed) } }
        }
    }

    @Deprecated("Framework fallback for Android 12 and older")
    @SuppressLint("GestureBackNavigation")
    override fun onBackPressed() {
        handleBack()
    }

    override fun onDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            onBackInvokedDispatcher.unregisterOnBackInvokedCallback(backCallback)
        }
        webView.removeJavascriptInterface(BRIDGE_NAME)
        webView.stopLoading()
        webView.destroy()
        bridgeExecutor.shutdownNow()
        super.onDestroy()
    }

    private fun handleBack() {
        if (webView.canGoBack()) webView.goBack() else finish()
    }

    private fun pickImage() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "image/*"
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        runCatching { startActivityForResult(intent, PICK_IMAGE_REQUEST) }
            .onFailure { showError(R.string.no_handler) }
    }

    private fun importImage(uri: Uri) {
        val mimeType = contentResolver.getType(uri)
            ?.takeIf { it.startsWith("image/") }
            ?: throw IllegalArgumentException("Not an image")
        val declaredSize = contentResolver.query(
            uri,
            arrayOf(OpenableColumns.SIZE),
            null,
            null,
            null
        )?.use { cursor ->
            if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getLong(0) else null
        }
        require(declaredSize == null || declaredSize <= BridgePolicy.MAX_DECODED_BYTES)

        val bytes = contentResolver.openInputStream(uri)?.use(::readLimited)
            ?: throw IllegalArgumentException("Image unavailable")
        val base64 = Base64.getEncoder().encodeToString(bytes)
        val script = "window.jankifyReceiveImage(${JSONObject.quote(base64)},${JSONObject.quote(mimeType)})"
        runOnUiThread { webView.evaluateJavascript(script, null) }
    }

    private fun readLimited(stream: InputStream): ByteArray {
        val output = java.io.ByteArrayOutputStream()
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        var total = 0
        while (true) {
            val count = stream.read(buffer)
            if (count < 0) break
            total += count
            require(total <= BridgePolicy.MAX_DECODED_BYTES) { "Image too large" }
            output.write(buffer, 0, count)
        }
        return output.toByteArray()
    }

    private fun shareExport(message: BridgeMessage.Share) {
        bridgeExecutor.execute {
            runCatching {
                val bytes = Base64.getDecoder().decode(message.base64)
                require(bytes.size <= BridgePolicy.MAX_DECODED_BYTES) { "Export too large" }
                val directory = File(cacheDir, "exports").apply { mkdirs() }
                directory.listFiles()?.forEach { it.delete() }
                val export = File(directory, message.filename)
                export.outputStream().use { it.write(bytes) }
                val uri = FileProvider.getUriForFile(
                    this,
                    "${BuildConfig.APPLICATION_ID}.exports",
                    export
                )
                runOnUiThread { launchShare(uri, message.mimeType) }
            }.onFailure {
                runOnUiThread { showError(R.string.action_failed) }
            }
        }
    }

    private fun launchShare(uri: Uri, mimeType: String) {
        val share = Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            clipData = ClipData.newUri(contentResolver, "Jankify export", uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        runCatching { startActivity(Intent.createChooser(share, getString(R.string.app_name))) }
            .onFailure { showError(R.string.no_handler) }
    }

    private fun copyText(text: String) {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("Jankify output", text))
    }

    private fun openExternal(uri: Uri) {
        if (uri.scheme !in setOf("https", "http")) return
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
            .onFailure { showError(R.string.no_handler) }
    }

    private fun showError(message: Int) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private inner class NativeBridge {
        @JavascriptInterface
        fun postMessage(message: String) {
            runOnUiThread {
                if (webView.url != APP_URL) return@runOnUiThread
                runCatching { BridgePolicy.decode(message) }
                    .onSuccess { decoded ->
                        when (decoded) {
                            BridgeMessage.PickImage -> pickImage()
                            is BridgeMessage.CopyText -> copyText(decoded.text)
                            is BridgeMessage.Share -> shareExport(decoded)
                        }
                    }
                    .onFailure { showError(R.string.action_failed) }
            }
        }
    }

    private inner class OfflineWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url
            if (request.isForMainFrame && uri.toString() == APP_URL) return false
            if (request.isForMainFrame) openExternal(uri)
            return true
        }

        override fun shouldInterceptRequest(
            view: WebView,
            request: WebResourceRequest
        ): WebResourceResponse? {
            val uri = request.url
            if (uri.scheme != "https" || uri.host != APP_HOST) {
                return forbiddenResponse()
            }
            val assetName = uri.path?.removePrefix("/assets/") ?: return forbiddenResponse()
            if (assetName !in ALLOWED_ASSETS) return forbiddenResponse()
            return runCatching {
                val mimeType = MimeTypeMap.getSingleton()
                    .getMimeTypeFromExtension(assetName.substringAfterLast('.'))
                    ?: "application/octet-stream"
                WebResourceResponse(mimeType, "UTF-8", assets.open(assetName))
            }.getOrElse { forbiddenResponse() }
        }

        private fun forbiddenResponse(): WebResourceResponse {
            return WebResourceResponse(
                "text/plain",
                "UTF-8",
                403,
                "Blocked",
                emptyMap(),
                ByteArrayInputStream(ByteArray(0))
            )
        }
    }

    private companion object {
        const val APP_HOST = "appassets.androidplatform.net"
        const val APP_URL = "https://$APP_HOST/assets/index.html"
        const val BRIDGE_NAME = "JankifyAndroid"
        const val PICK_IMAGE_REQUEST = 1001
        const val FILE_CHOOSER_REQUEST = 1002
        val ALLOWED_ASSETS = setOf("index.html", "offline.css", "android-bridge.js")
    }
}
