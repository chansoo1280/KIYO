package com.kiyo.app.capacitor

import android.content.Context
import android.security.keystore.UserNotAuthenticatedException
import com.kiyo.app.autofill.repository.AutofillRepository
import com.kiyo.app.security.DatabaseKeyManager
import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.mockkObject
import io.mockk.unmockkAll
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@ExperimentalCoroutinesApi
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE)
class AutofillSyncManagerTest {

    private lateinit var context: Context
    private lateinit var repository: AutofillRepository
    private lateinit var authLaunches: MutableList<String?>
    private lateinit var manager: AutofillSyncManager

    @Before
    fun setup() {
        context = mockk(relaxed = true)
        repository = mockk()
        authLaunches = mutableListOf()

        // DatabaseKeyManager is an object (singleton) - isolate via mockkObject.
        // Security class signatures are never changed for testability (plan constraint).
        mockkObject(DatabaseKeyManager)
        coEvery { DatabaseKeyManager.getCurrentAlias(any()) } returns "alias_v1"
        every { DatabaseKeyManager.isSecurityDowngrade(any()) } returns false
        every { DatabaseKeyManager.wasSecurityUpgraded() } returns false

        manager = AutofillSyncManager(
            ensureRepository = { repository },
            authNavigator = { json -> authLaunches.add(json) },
        )
        coEvery { DatabaseKeyManager.getKey(any()) } returns javax.crypto.spec.SecretKeySpec(ByteArray(32), "AES")
        every { DatabaseKeyManager.wasStateReset() } returns false
    }

    @After
    fun teardown() {
        unmockkAll()
    }

    private fun stubSync(synced: Int, errors: Int) {
        coEvery { repository.syncAccountsFromReact(any()) } returns android.util.Pair(synced, errors)
    }

    @Test
    fun `sync with valid key initializes repository and delegates sync`() = runTest {
        stubSync(synced = 3, errors = 0)

        val result = manager.syncAccountsFromReact(context, "[]")

        assertEquals(3, result.syncedCount)
        assertTrue(result.success)
        assertFalse(result.securityUpgrade)
        assertTrue(authLaunches.isEmpty())
    }

    @Test
    fun `sync when security downgrade detected resets autofill data then proceeds`() = runTest {
        every { DatabaseKeyManager.isSecurityDowngrade("alias_v1") } returns true
        coEvery { DatabaseKeyManager.resetAutofillData(context) } returns true
        stubSync(synced = 2, errors = 0)

        val result = manager.syncAccountsFromReact(context, "[]")

        // Reset happened and sync still proceeded with fresh state
        io.mockk.coVerify(exactly = 1) { DatabaseKeyManager.resetAutofillData(context) }
        assertEquals(2, result.syncedCount)
        assertTrue(result.success)
    }

    @Test
    fun `sync includes securityUpgrade flag when upgrade detected`() = runTest {
        every { DatabaseKeyManager.wasSecurityUpgraded() } returns true
        stubSync(synced = 1, errors = 0)

        val result = manager.syncAccountsFromReact(context, "[]")

        assertTrue(result.securityUpgrade)
    }

    @Test
    fun `sync when auth required propagates UserNotAuthenticatedException`() = runTest {
        coEvery { repository.syncAccountsFromReact(any()) } throws UserNotAuthenticatedException()

        try {
            manager.syncAccountsFromReact(context, "[]")
            fail("Expected UserNotAuthenticatedException")
        } catch (e: UserNotAuthenticatedException) {
            // expected - caller (plugin) stores pending sync and launches auth activity
        }
    }

    @Test
    fun `error during repository initialization propagates`() = runTest {
        val failingManager = AutofillSyncManager(
            ensureRepository = { throw IllegalStateException("init failed") },
            authNavigator = { },
        )

        try {
            failingManager.syncAccountsFromReact(context, "[]")
            fail("Expected IllegalStateException")
        } catch (e: IllegalStateException) {
            assertEquals("init failed", e.message)
        }
    }

    @Test
    fun `auth success retries pending sync to completion`() = runTest {
        stubSync(synced = 5, errors = 0)
        var successResult: AutofillSyncManager.SyncResult? = null
        var cancelled = false

        manager.handleAuthResult(
            resultCode = android.app.Activity.RESULT_OK,
            accountsJson = "[]",
            onSuccess = { successResult = it },
            onCancel = { cancelled = true },
        )

        // retry happens on the IO scope; poll briefly for completion
        waitFor { successResult != null || cancelled }
        assertFalse(cancelled)
        assertEquals(5, successResult?.syncedCount)
        assertTrue(successResult?.success == true)
    }

    @Test
    fun `auth cancel resolves as authRequired`() = runTest {
        var successResult: AutofillSyncManager.SyncResult? = null
        var cancelled = false

        manager.handleAuthResult(
            resultCode = android.app.Activity.RESULT_CANCELED,
            accountsJson = "[]",
            onSuccess = { successResult = it },
            onCancel = { cancelled = true },
        )

        waitFor { successResult != null || cancelled }
        assertTrue(cancelled)
    }

    private fun waitFor(timeoutMs: Long = 3000, condition: () -> Boolean) {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (condition()) return
            Thread.sleep(25)
        }
        fail("Condition not met within ${timeoutMs}ms")
    }
}
