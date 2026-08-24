package com.kiyo.app.autofill.service

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.security.keystore.UserNotAuthenticatedException
import android.service.autofill.FillCallback
import android.service.autofill.FillResponse
import android.view.autofill.AutofillId
import com.kiyo.app.autofill.repository.AutofillRepository
import com.kiyo.app.autofill.response.FillResponseBuilder
import com.kiyo.app.security.DatabaseKeyManager
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
        
        // Mock FillResponseBuilder to avoid Android framework dependencies
        mockkObject(FillResponseBuilder)
        // Mock DatabaseKeyManager singleton object
        mockkObject(DatabaseKeyManager)
        
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
    fun `successful DB_KEY access returns fill response`() = runTest {
        // Given
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
        // Mock successful DB_KEY access (suspend function)
        coEvery { DatabaseKeyManager.getKey(context) } returns mockk()

        // When
        authRequestHandler.processFillRequest(testDomain, testUsernameId, testPasswordId)
        advanceUntilIdle()
        runBlocking { processLooper() }

        // Then
        verify { mockRepository.findMatchingAccounts(testDomain) }
        verify { mockCallback.onSuccess(mockFillResponse) }
    }

    @Test
    fun `DB_KEY access with no matching accounts returns null`() = runTest {
        // Given
        every { mockRepository.findMatchingAccounts(testDomain) } returns emptyList()
        // Mock successful DB_KEY access (suspend function)
        coEvery { DatabaseKeyManager.getKey(context) } returns mockk()

        // When
        authRequestHandler.processFillRequest(testDomain, testUsernameId, testPasswordId)
        advanceUntilIdle()
        runBlocking { processLooper() }

        // Then
        verify { mockCallback.onSuccess(null) }
    }

    @Test
    fun `DB_KEY access requiring authentication returns auth response`() = runTest {
        // Given
        val mockAuthResponse = mockk<FillResponse>()
        coEvery { FillResponseBuilder.createAuthResponse(context, testUsernameId, testPasswordId) } returns mockAuthResponse
        // Mock DB_KEY access to throw authentication required exception (suspend function)
        coEvery { DatabaseKeyManager.getKey(context) } throws UserNotAuthenticatedException()

        // When
        authRequestHandler.processFillRequest(testDomain, testUsernameId, testPasswordId)
        advanceUntilIdle()
        runBlocking { processLooper() }

        // Then
        verify { mockCallback.onSuccess(mockAuthResponse) }
    }

    @Test
    fun `DB_KEY access with package name fallback finds accounts`() = runTest {
        // Given
        every { mockRepository.findMatchingAccounts("") } returns emptyList()
        val testAccount = AutofillRepository.AutofillAccount(
            id = 1,
            username = "testuser",
            password = "testpass",
            domain = "example.com",
            packageNames = listOf("com.example.app")
        )
        every { mockRepository.findByPackageName("com.example.app") } returns listOf(testAccount)
        val mockFillResponse = mockk<FillResponse>()
        coEvery { FillResponseBuilder.createFillResponse(context, any(), testUsernameId, testPasswordId) } returns mockFillResponse
        coEvery { DatabaseKeyManager.getKey(context) } returns mockk()

        // When - empty domain, but package name provided
        authRequestHandler.processFillRequest("", testUsernameId, testPasswordId, listOf("com.example.app"))
        advanceUntilIdle()
        runBlocking { processLooper() }

        // Then
        verify { mockRepository.findByPackageName("com.example.app") }
        verify { mockCallback.onSuccess(mockFillResponse) }
    }

    @Test
    fun `repository error during findMatchingAccounts returns null via callback`() = runTest {
        // Given
        every { mockRepository.findMatchingAccounts(testDomain) } throws RuntimeException("DB error")
        // Mock successful DB_KEY access (suspend function)
        coEvery { DatabaseKeyManager.getKey(context) } returns mockk()

        // When - exception should be caught and handled gracefully (callback.onSuccess(null))
        authRequestHandler.processFillRequest(testDomain, testUsernameId, testPasswordId)
        advanceUntilIdle()
        runBlocking { processLooper() }

        // Then - callback should be called with null (error handled gracefully)
        verify { mockCallback.onSuccess(null) }
        
        // Verify the repository call was attempted
        verify { mockRepository.findMatchingAccounts(testDomain) }
    }
}