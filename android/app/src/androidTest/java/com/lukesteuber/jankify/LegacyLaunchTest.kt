package com.lukesteuber.jankify

import android.view.ViewGroup
import android.view.accessibility.AccessibilityNodeInfo
import android.webkit.WebView
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.SdkSuppress
import androidx.test.platform.app.InstrumentationRegistry
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

    @Test
    fun exposesWorkspaceSwitcherToAccessibilityServices() {
        assertTrue(
            "Edit workspace control is missing from the accessibility tree",
            waitForAccessibleText("Edit"),
        )
        assertTrue(
            "Create workspace control is missing from the accessibility tree",
            waitForAccessibleText("Create"),
        )
    }

    private fun waitForAccessibleText(expected: String): Boolean {
        val deadline = System.currentTimeMillis() + 10_000
        val automation = InstrumentationRegistry.getInstrumentation().uiAutomation
        do {
            val root = automation.rootInActiveWindow
            if (root != null && containsText(root, expected)) return true
            Thread.sleep(100)
        } while (System.currentTimeMillis() < deadline)
        return false
    }

    private fun containsText(node: AccessibilityNodeInfo, expected: String): Boolean {
        if (node.text?.toString() == expected || node.contentDescription?.toString() == expected) {
            return true
        }
        for (index in 0 until node.childCount) {
            val child = node.getChild(index) ?: continue
            if (containsText(child, expected)) return true
        }
        return false
    }
}
