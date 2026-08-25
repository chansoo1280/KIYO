package com.kiyo.app.capacitor

import io.mockk.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

// Robolectric required: the delegation test touches android.util.Pair, which is a
// stub (null-returning) on plain JVM.
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE)
class KiyoAutofillPluginTest {

    @Test
    fun `plugin initializes without crashing`() = runTest {
        // Given
        val plugin = KiyoAutofillPlugin()

        // When
        plugin.load()

        // Then - should not crash
        assertNotNull(plugin)
    }

    @Test
    fun `plugin can be instantiated`() = runTest {
        // Given/When
        val plugin = KiyoAutofillPlugin()

        // Then
        assertNotNull(plugin)
    }

    @Test
    fun `AutofillSyncManager delegates to repository and maps result`() {
        // Verifies the plugin's policy-layer dependency contract without Capacitor:
        // the manager wraps repository Pair results into SyncResult.
        mockkObject(com.kiyo.app.security.DatabaseKeyManager)
        try {
            coEvery { com.kiyo.app.security.DatabaseKeyManager.getCurrentAlias(any()) } returns "alias_v1"
            every { com.kiyo.app.security.DatabaseKeyManager.isSecurityDowngrade(any()) } returns false
            every { com.kiyo.app.security.DatabaseKeyManager.wasSecurityUpgraded() } returns false

            val repository = mockk<com.kiyo.app.autofill.repository.AutofillRepository>()
            coEvery { repository.syncAccountsFromReact(any()) } returns android.util.Pair(4, 0)

            val manager = AutofillSyncManager(
                ensureRepository = { repository },
                authNavigator = { },
            )

            var result: AutofillSyncManager.SyncResult? = null
            kotlinx.coroutines.test.runTest {
                result = manager.syncAccountsFromReact(mockk(relaxed = true), "[]")
            }

            assertEquals(4, result!!.syncedCount)
            assertTrue(result!!.success)
        } finally {
            unmockkAll()
        }
    }
}
