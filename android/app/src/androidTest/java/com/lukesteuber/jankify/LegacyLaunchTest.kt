package com.lukesteuber.jankify

import android.view.ViewGroup
import android.webkit.WebView
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.SdkSuppress
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

@RunWith(AndroidJUnit4::class)
@SdkSuppress(maxSdkVersion = 32)
class LegacyLaunchTest {
    @get:Rule
    val activityRule = ActivityScenarioRule(MainActivity::class.java)

    @Test
    fun launchesWithoutResolvingAndroid13BackCallback() {
        activityRule.scenario.onActivity { activity ->
            assertFalse(activity.isFinishing)
        }
    }

    @Test
    fun loadsBundledEditorOnFireWebView() {
        val bodyText = AtomicReference<String>()
        val loaded = CountDownLatch(1)

        activityRule.scenario.onActivity { activity ->
            val content = activity.findViewById<ViewGroup>(android.R.id.content)
            val shell = content.getChildAt(0) as ViewGroup
            val webView = shell.getChildAt(0) as WebView
            webView.evaluateJavascript("document.body.innerText") { value ->
                bodyText.set(value)
                loaded.countDown()
            }
        }

        assertTrue("Bundled editor did not finish loading", loaded.await(10, TimeUnit.SECONDS))
        assertTrue("Bundled editor was replaced by an error page: ${bodyText.get()}", bodyText.get().contains("Jankify"))
    }
}
