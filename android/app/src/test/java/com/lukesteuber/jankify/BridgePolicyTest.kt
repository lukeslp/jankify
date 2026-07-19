/*
 * File Purpose: Verify security boundaries shared by Android bridge operations.
 * Primary Functions: Test filename confinement, MIME allowlisting, and size limits.
 * Inputs/Outputs: Supplies adversarial values and asserts constrained policy results.
 */
package com.lukesteuber.jankify

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BridgePolicyTest {
    @Test
    fun sanitizesTraversalAndPunctuation() {
        assertEquals("My-Jank-.svg", BridgePolicy.safeFilename("../../My Jank!.svg"))
        assertEquals("jankify-export", BridgePolicy.safeFilename(".."))
    }

    @Test
    fun keepsExportsInsideReasonableFilenameLength() {
        assertTrue(BridgePolicy.safeFilename("x".repeat(500) + ".png").length <= 180)
    }

    @Test
    fun allowsOnlyCanonicalExportMimeTypes() {
        assertTrue("image/png" in BridgePolicy.allowedMimeTypes)
        assertTrue("image/gif" in BridgePolicy.allowedMimeTypes)
        assertTrue("video/mp4" in BridgePolicy.allowedMimeTypes)
        assertTrue("video/webm" in BridgePolicy.allowedMimeTypes)
        assertFalse("application/vnd.android.package-archive" in BridgePolicy.allowedMimeTypes)
    }

    @Test
    fun importPolicyAcceptsImagesAndVideosOnly() {
        assertTrue(BridgePolicy.isAllowedImportMimeType("image/gif"))
        assertTrue(BridgePolicy.isAllowedImportMimeType("video/mp4"))
        assertTrue(BridgePolicy.isAllowedImportMimeType("video/quicktime"))
        assertFalse(BridgePolicy.isAllowedImportMimeType("application/pdf"))
    }

    @Test
    fun encodedLimitCoversExactlyFiftyMegabytes() {
        assertEquals(
            ((50 * 1_024 * 1_024 + 2) / 3) * 4,
            BridgePolicy.maxEncodedChars
        )
    }
}
