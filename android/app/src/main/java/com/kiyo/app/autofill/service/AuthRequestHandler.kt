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
import com.kiyo.app.autofill.store.AutofillAuthStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Handles authentication request logic for autofill.
 * Extracted from KiyoAutofillService.onFillRequest to separate concerns.
 * Responsible for:
 * - Checking vault encryption status
 * - Validating session tokens
 * - Creating auth responses when token is missing/expired
 * - Creating fill responses when token is valid
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
     * Checks token validity and returns appropriate response.
     */
    suspend fun processFillRequest(
        domain: String,
        usernameId: AutofillId?,
        passwordId: AutofillId?
    ) {
        val isEncrypted = AutofillAuthStore.isEncrypted(context)
        Log.d(TAG, "AutofillAuthStore :: isEncrypted=$isEncrypted")

        // 1. Non-encrypted vault -> return fill response directly
        if (!isEncrypted) {
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
            return
        }

        // 2. Encrypted vault -> check for valid token
        val hasValidToken = AutofillAuthStore.hasValidToken(context)
        Log.d(TAG, "AutofillAuthStore :: hasValidToken=$hasValidToken")

        if (!hasValidToken) {
            // No valid token -> request auth
            val response = FillResponseBuilder.createAuthResponse(
                context,
                usernameId,
                passwordId
            )
            handler.post { callback.onSuccess(response) }
            return
        }

        // 3. Valid token exists -> return fill response
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
    }
}