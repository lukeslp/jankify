package com.lukesteuber.jankify

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object DirectUpdateChecker {
    private const val feedUrl = "https://dr.eamer.dev/downloads/android/updates-v1.json"
    private const val preferencesName = "direct_update_check"
    private const val lastCheckKey = "last_check_ms"
    private const val intervalMs = 24 * 60 * 60 * 1000L

    fun check(activity: Activity) {
        val preferences = activity.getSharedPreferences(preferencesName, Activity.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val previous = preferences.getLong(lastCheckKey, 0)
        if (previous == 0L) {
            preferences.edit().putLong(lastCheckKey, now).apply()
            return
        }
        if (now - previous < intervalMs) return
        Thread {
            val release = runCatching {
                val connection = URL(feedUrl).openConnection() as HttpURLConnection
                connection.connectTimeout = 5_000
                connection.readTimeout = 5_000
                connection.setRequestProperty("Accept", "application/json")
                try {
                    if (connection.responseCode != 200) return@runCatching null
                    val json = connection.inputStream.bufferedReader().use { it.readText() }
                    preferences.edit().putLong(lastCheckKey, now).apply()
                    findUpdate(json, activity.packageName, installedVersionCode(activity))
                } finally { connection.disconnect() }
            }.getOrNull()
            if (release != null) activity.runOnUiThread { show(activity, release) }
        }.start()
    }

    internal fun findUpdate(json: String, packageName: String, installedCode: Long): Release? {
        val feed = JSONObject(json)
        if (feed.optInt("schema_version") != 1) return null
        val apps = feed.optJSONArray("apps") ?: return null
        for (index in 0 until apps.length()) {
            val item = apps.optJSONObject(index) ?: continue
            if (item.optString("package_id") != packageName || item.optString("channel") != "production") continue
            val code = item.optLong("version_code", -1)
            val page = item.optString("download_page")
            if (code <= installedCode || !page.startsWith("https://dr.eamer.dev/downloads/apps/") || !page.endsWith('/')) return null
            return Release(item.optString("version_name"), page)
        }
        return null
    }

    private fun installedVersionCode(activity: Activity): Long {
        val info = activity.packageManager.getPackageInfo(activity.packageName, 0)
        return if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
    }

    private fun show(activity: Activity, release: Release) {
        if (activity.isFinishing || activity.isDestroyed) return
        AlertDialog.Builder(activity)
            .setTitle("Jankify update available")
            .setMessage("Version ${release.versionName} is ready to install.")
            .setNegativeButton("Later", null)
            .setPositiveButton("View update") { _, _ -> activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(release.downloadPage))) }
            .show()
    }

    internal data class Release(val versionName: String, val downloadPage: String)
}
