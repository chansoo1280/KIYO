package com.kiyo.app.autofill.service

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.service.autofill.FillCallback
import android.service.autofill.FillResponse
import android.util.Log
import android.view.autofill.AutofillId
import com.kiyo.app.autofill.repository.AutofillRepository
import com.kiyo.app.autofill.response.FillResponseBuilder
import com.kiyo.app.security.DatabaseKeyManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Handles authentication request logic for autofill.
 * Extracted from KiyoAutofillService.onFillRequest to separate concerns.
 * Responsible for:
 * - Attempting to access DB_KEY (which requires authentication)
 * - Creating auth responses when authentication is needed
 * - Creating fill responses when authentication succeeds
 */
class AuthRequestHandler(
    private val context: Context,
    private val repository: AutofillRepository,
    private val handler: Handler,
    private val callback: FillCallback
) {

    private val TAG = "AuthRequestHandler"

    /**
     * Process fill request with auth logic.
     * Attempts to access the database key (which triggers authentication if needed)
     * and returns appropriate response.
     */
    suspend fun processFillRequest(
        domain: String,
        usernameId: AutofillId?,
        passwordId: AutofillId?
    ) {
        // Always try to access DB_KEY (requires authentication via Keystore)
        // Removed isEncrypted check to rely solely on user authentication for DB access
        try {
            // This will trigger UserNotAuthenticatedException if authentication is needed
            val encryptionKey = DatabaseKeyManager.getKey(context)
            Log.d(TAG, "Successfully accessed DB_KEY - authentication satisfied")

            // Key access succeeded, proceed with fill response
            val accounts = repository.findMatchingAccounts(domain)
            Log.d(TAG, "Found ${accounts.size} matching accounts for domain: $domain")

            if (accounts.isEmpty()) {
                handler.post { callback.onSuccess(null) }
                return
            }

            val response = FillResponseBuilder.createFillResponse(
                context,
                accounts,
                usernameId,
                passwordId
            )
            handler.post { callback.onSuccess(response) }
        } catch (e: android.security.keystore.UserNotAuthenticatedException) {
            // Authentication required -> request auth
            Log.d(TAG, "User authentication required for DB_KEY access")
            val response = FillResponseBuilder.createAuthResponse(
                context,
                usernameId,
                passwordId
            )
            handler.post { callback.onSuccess(response) }
        } catch (e: Exception) {
            Log.e(TAG, "Error accessing DB_KEY or processing fill request", e)
            handler.post { callback.onSuccess(null) }
        }
    }
}