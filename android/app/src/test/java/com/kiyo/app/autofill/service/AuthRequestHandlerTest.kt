package com.kiyo.app.autofill.service

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.service.autofill.FillCallback
import android.service.autofill.FillResponse
import android.view.autofill.AutofillId
import com.kiyo.app.autofill.repository.AutofillRepository
import com.kiyo.app.autofill.response.FillResponseBuilder
import com.kiyo.app.autofill.store.AutofillAuthStore
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.advanceUntilIdle
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLooper

@ExperimentalCoroutinesApi
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE)
class AuthRequestHandlerTest {

    private lateinit var context: Context
    private lateinit var mockRepository: AutofillRepository
    private lateinit var handler: Handler
    private lateinit var mockCallback: FillCallback
    private lateinit var authRequestHandler: AuthRequestHandler
    private val testDomain = "example.com"
    private val testUsernameId = mockk<AutofillId>()
    private val testPasswordId = mockk<AutofillId>()

    @Before
    fun setup() {
        context = org.robolectric.RuntimeEnvironment.getApplication()
        mockRepository = mockk()
        handler = Handler(Looper.getMainLooper())
        // Use relaxed mock for callback to handle cross-thread calls from handler
        mockCallback = mockk(relaxed = true)
        
        // Mock AutofillAuthStore singleton object with suspend functions
        mockkObject(AutofillAuthStore)
        // Mock FillResponseBuilder to avoid Android framework dependencies
        mockkObject(FillResponseBuilder)
        
        authRequestHandler = AuthRequestHandler(
            context = context,
            repository = mockRepository,
            handler = handler,
            callback = mockCallback
        )
    }

    private fun processLooper() {
        ShadowLooper.getShadowMainLooper().idle()
    }

    @Test
    fun `non-encrypted vault returns fill response directly`() = runTest {
        // Given
        coEvery { AutofillAuthStore.isEncrypted(context) } returns false
        every { mockRepository.findMatchingAccounts(testDomain) } returns listOf(
            AutofillRepository.AutofillAccount(
                id = 1,
                username = "testuser",
                password = "testpass",
                domain = testDomain
            )
        )
        // Mock FillResponseBuilder to return a mock response
        val mockFillResponse = mockk<FillResponse>()
        coEvery { FillResponseBuilder.createFillResponse(context, any(), testUsernameId, testPasswordId) } returns mockFillResponse

        // When
        authRequestHandler.processFillRequest(testDomain, testUsernameId, testPasswordId)
        
        // Advance test coroutine to process handler posts
        advanceUntilIdle()
        // Process main looper to execute handler posts
        runBlocking { processLooper() }

        // Then
        coVerify { AutofillAuthStore.isEncrypted(context) }
        verify { mockRepository.findMatchingAccounts(testDomain) }
        verify { mockCallback.onSuccess(mockFillResponse) }
    }

    @Test
    fun `non-encrypted vault with no matching accounts returns null`() = runTest {
        // Given
        coEvery { AutofillAuthStore.isEncrypted(context) } returns false
        every { mockRepository.findMatchingAccounts(testDomain) } returns emptyList()

        // When
        authRequestHandler.processFillRequest(testDomain, testUsernameId, testPasswordId)
        advanceUntilIdle()
        runBlocking { processLooper() }

        // Then
        coVerify { AutofillAuthStore.isEncrypted(context) }
        verify { mockCallback.onSuccess(null) }
    }

    @Test
    fun `encrypted vault with valid token returns fill response`() = runTest {
        // Given
        coEvery { AutofillAuthStore.isEncrypted(context) } returns true
        coEvery { AutofillAuthStore.hasValidToken(context) } returns true
        every { mockRepository.findMatchingAccounts(testDomain) } returns listOf(
            AutofillRepository.AutofillAccount(
                id = 1,
                username = "testuser",
                password = "testpass",
                domain = testDomain
            )
        )
        val mockFillResponse = mockk<FillResponse>()
        coEvery { FillResponseBuilder.createFillResponse(context, any(), testUsernameId, testPasswordId) } returns mockFillResponse

        // When
        authRequestHandler.processFillRequest(testDomain, testUsernameId, testPasswordId)
        advanceUntilIdle()
        runBlocking { processLooper() }

        // Then
        coVerify { AutofillAuthStore.isEncrypted(context) }
        coVerify { AutofillAuthStore.hasValidToken(context) }
        verify { mockRepository.findMatchingAccounts(testDomain) }
        verify { mockCallback.onSuccess(mockFillResponse) }
    }

    @Test
    fun `encrypted vault with valid token but no matching accounts returns null`() = runTest {
        // Given
        coEvery { AutofillAuthStore.isEncrypted(context) } returns true
        coEvery { AutofillAuthStore.hasValidToken(context) } returns true
        every { mockRepository.findMatchingAccounts(testDomain) } returns emptyList()

        // When
        authRequestHandler.processFillRequest(testDomain, testUsernameId, testPasswordId)
        advanceUntilIdle()
        runBlocking { processLooper() }

        // Then
        coVerify { AutofillAuthStore.isEncrypted(context) }
        coVerify { AutofillAuthStore.hasValidToken(context) }
        verify { mockCallback.onSuccess(null) }
    }

    @Test
    fun `encrypted vault with expired token returns auth response`() = runTest {
        // Given
        coEvery { AutofillAuthStore.isEncrypted(context) } returns true
        coEvery { AutofillAuthStore.hasValidToken(context) } returns false
        val mockAuthResponse = mockk<FillResponse>()
        coEvery { FillResponseBuilder.createAuthResponse(context, testUsernameId, testPasswordId) } returns mockAuthResponse

        // When
        authRequestHandler.processFillRequest(testDomain, testUsernameId, testPasswordId)
        advanceUntilIdle()
        runBlocking { processLooper() }

        // Then
        coVerify { AutofillAuthStore.isEncrypted(context) }
        coVerify { AutofillAuthStore.hasValidToken(context) }
        verify { mockCallback.onSuccess(mockAuthResponse) }
    }

    @Test
    fun `encrypted vault with missing token returns auth response`() = runTest {
        // Given - same as expired token, hasValidToken returns false covers both cases
        coEvery { AutofillAuthStore.isEncrypted(context) } returns true
        coEvery { AutofillAuthStore.hasValidToken(context) } returns false
        val mockAuthResponse = mockk<FillResponse>()
        coEvery { FillResponseBuilder.createAuthResponse(context, testUsernameId, testPasswordId) } returns mockAuthResponse

        // When
        authRequestHandler.processFillRequest(testDomain, testUsernameId, testPasswordId)
        advanceUntilIdle()
        runBlocking { processLooper() }

        // Then
        coVerify { AutofillAuthStore.isEncrypted(context) }
        coVerify { AutofillAuthStore.hasValidToken(context) }
        verify { mockCallback.onSuccess(mockAuthResponse) }
    }

    @Test
    fun `repository error during findMatchingAccounts handles gracefully`() = runTest {
        // Given
        coEvery { AutofillAuthStore.isEncrypted(context) } returns false
        every { mockRepository.findMatchingAccounts(testDomain) } throws RuntimeException("DB error")

        // When / Then - exception should propagate since AuthRequestHandler doesn't catch it
        try {
            authRequestHandler.processFillRequest(testDomain, testUsernameId, testPasswordId)
            advanceUntilIdle()
            runBlocking { processLooper() }
            fail("Expected RuntimeException to be thrown")
        } catch (e: RuntimeException) {
            assertEquals("DB error", e.message)
        }
        
        // Verify the repository call was attempted
        coVerify { AutofillAuthStore.isEncrypted(context) }
        verify { mockRepository.findMatchingAccounts(testDomain) }
    }

    @Test
    fun `auth response is created when vault is locked`() = runTest {
        // Given
        coEvery { AutofillAuthStore.isEncrypted(context) } returns true
        coEvery { AutofillAuthStore.hasValidToken(context) } returns false
        val mockAuthResponse = mockk<FillResponse>()
        coEvery { FillResponseBuilder.createAuthResponse(context, testUsernameId, testPasswordId) } returns mockAuthResponse

        // When
        authRequestHandler.processFillRequest(testDomain, testUsernameId, testPasswordId)
        advanceUntilIdle()
        runBlocking { processLooper() }

        // Then - should request authentication
        coVerify { AutofillAuthStore.isEncrypted(context) }
        coVerify { AutofillAuthStore.hasValidToken(context) }
        verify { mockCallback.onSuccess(mockAuthResponse) }
    }
}