package com.lukesteuber.jankify

import android.view.ViewGroup
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SystemBarsTest {
    @get:Rule
    val activityRule = ActivityScenarioRule(MainActivity::class.java)

    @Test
    fun testWebContentClearsStatusAndNavigationBars() {
        activityRule.scenario.onActivity { activity ->
            val content = activity.findViewById<ViewGroup>(android.R.id.content)
            val shell = content.getChildAt(0)
            val insets = checkNotNull(ViewCompat.getRootWindowInsets(shell)).getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )

            assertTrue("No status-bar inset was reported", insets.top > 0)
            assertTrue(
                "Web shell padding ${shell.paddingTop} did not clear status bar ${insets.top}",
                shell.paddingTop >= insets.top,
            )
            assertTrue(
                "Web shell padding ${shell.paddingBottom} did not clear navigation bar ${insets.bottom}",
                shell.paddingBottom >= insets.bottom,
            )
        }
    }
}
