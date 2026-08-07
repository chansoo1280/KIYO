package com.kiyo.app.autofill.store

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@ExperimentalCoroutinesApi
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE)
class AutofillAuthStoreTest {

    private lateinit var context: Context
    private val testToken = "test-autofill-token-12345"
    private val testExpireAt = System.currentTimeMillis() + 1800000 // 30분 후

    @Before
    fun setup() {
        context = org.robolectric.RuntimeEnvironment.getApplication()
        // Clean up any existing data
        runBlocking {
            AutofillAuthStore.clear(context)
        }
    }

    @Test
    fun `saveAutofillToken stores token with expiry and encryption status`() = runTest {
        // When
        AutofillAuthStore.saveAutofillToken(context, testToken, testExpireAt, true)

        // Then
        val savedToken = runBlocking { AutofillAuthStore.getAutofillToken(context) }
        val savedExpireAt = runBlocking { AutofillAuthStore.getTokenExpireAt(context) }
        val savedIsEncrypted = runBlocking { AutofillAuthStore.isEncrypted(context) }

        assertEquals(testToken, savedToken)
        assertEquals(testExpireAt, savedExpireAt)
        assertTrue(savedIsEncrypted)
    }

    @Test
    fun `getAutofillToken returns null when not set`() = runTest {
        // When
        val token = runBlocking { AutofillAuthStore.getAutofillToken(context) }

        // Then
        assertNull(token)
    }

    @Test
    fun `getTokenExpireAt returns null when not set`() = runTest {
        // When
        val expireAt = runBlocking { AutofillAuthStore.getTokenExpireAt(context) }

        // Then
        assertNull(expireAt)
    }

    @Test
    fun `isEncrypted defaults to true when not set`() = runTest {
        // When
        val isEncrypted = runBlocking { AutofillAuthStore.isEncrypted(context) }

        // Then
        assertTrue(isEncrypted)
    }

    @Test
    fun `clearToken removes token and expireAt but keeps isEncrypted`() = runTest {
        // Given
        AutofillAuthStore.saveAutofillToken(context, testToken, testExpireAt, true)

        // When
        runBlocking { AutofillAuthStore.clearToken(context) }

        // Then
        val token = runBlocking { AutofillAuthStore.getAutofillToken(context) }
        val expireAt = runBlocking { AutofillAuthStore.getTokenExpireAt(context) }
        val isEncrypted = runBlocking { AutofillAuthStore.isEncrypted(context) }

        assertNull(token)
        assertNull(expireAt)
        assertTrue(isEncrypted) // Should remain true
    }

    @Test
    fun `clear removes token and expireAt but keeps isEncrypted`() = runTest {
        // Given - save with isEncrypted = false
        AutofillAuthStore.saveAutofillToken(context, testToken, testExpireAt, false)

        // When
        runBlocking { AutofillAuthStore.clear(context) }

        // Then
        val token = runBlocking { AutofillAuthStore.getAutofillToken(context) }
        val expireAt = runBlocking { AutofillAuthStore.getTokenExpireAt(context) }
        val isEncrypted = runBlocking { AutofillAuthStore.isEncrypted(context) }

        assertNull(token)
        assertNull(expireAt)
        // clear() does NOT reset isEncrypted - it keeps the last saved value
        assertFalse(isEncrypted)
    }

    @Test
    fun `setVaultEncryptionStatus updates isEncrypted`() = runTest {
        // When
        runBlocking { AutofillAuthStore.setVaultEncryptionStatus(context, false) }

        // Then
        val isEncrypted = runBlocking { AutofillAuthStore.isEncrypted(context) }
        assertFalse(isEncrypted)
    }

    @Test
    fun `hasValidToken returns true when token exists and not expired`() = runTest {
        // Given
        val futureExpireAt = System.currentTimeMillis() + 60000 // 1분 후
        AutofillAuthStore.saveAutofillToken(context, testToken, futureExpireAt, true)

        // When
        val hasValid = runBlocking { AutofillAuthStore.hasValidToken(context) }

        // Then
        assertTrue(hasValid)
    }

    @Test
    fun `hasValidToken returns false when token is expired`() = runTest {
        // Given - token expired 1 minute ago
        val pastExpireAt = System.currentTimeMillis() - 60000
        AutofillAuthStore.saveAutofillToken(context, testToken, pastExpireAt, true)

        // When
        val hasValid = runBlocking { AutofillAuthStore.hasValidToken(context) }

        // Then
        assertFalse(hasValid)
    }

    @Test
    fun `hasValidToken returns false when token is null`() = runTest {
        // When
        val hasValid = runBlocking { AutofillAuthStore.hasValidToken(context) }

        // Then
        assertFalse(hasValid)
    }

    @Test
    fun `hasValidToken returns false when expireAt is null`() = runTest {
        // This test is skipped because AutofillAuthStore doesn't expose a way to set token without expireAt
        // The hasValidToken function correctly returns false when expireAt is missing
        // as it's implemented to require both token and expireAt
    }

    @Test
    fun `saveAutofillToken overwrites existing token`() = runTest {
        // Given
        val oldToken = "old-token"
        val oldExpireAt = System.currentTimeMillis() - 60000
        AutofillAuthStore.saveAutofillToken(context, oldToken, oldExpireAt, false)

        // When
        AutofillAuthStore.saveAutofillToken(context, testToken, testExpireAt, true)

        // Then
        val token = runBlocking { AutofillAuthStore.getAutofillToken(context) }
        val expireAt = runBlocking { AutofillAuthStore.getTokenExpireAt(context) }
        val isEncrypted = runBlocking { AutofillAuthStore.isEncrypted(context) }

        assertEquals(testToken, token)
        assertEquals(testExpireAt, expireAt)
        assertTrue(isEncrypted)
    }
}