package com.kiyo.app.autofill.store

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking

/**
 * Java-friendly wrapper for AutofillAuthStore suspend functions.
 * Provides blocking calls for Java interop using runBlocking.
 */
object AutofillAuthStoreBridge {

    /**
     * Save autofill token (blocking call for Java).
     */
    @JvmStatic
    fun saveAutofillToken(
        context: Context,
        token: String,
        expireAt: Long,
        isEncrypted: Boolean
    ) {
        runBlocking(Dispatchers.IO) {
            AutofillAuthStore.saveAutofillToken(context, token, expireAt, isEncrypted)
        }
    }

    /**
     * Clear autofill token (blocking call for Java).
     */
    @JvmStatic
    fun clearToken(context: Context) {
        runBlocking(Dispatchers.IO) {
            AutofillAuthStore.clearToken(context)
        }
    }

    /**
     * Get autofill token (blocking call for Java).
     */
    @JvmStatic
    fun getAutofillToken(context: Context): String? {
        return runBlocking(Dispatchers.IO) {
            AutofillAuthStore.getAutofillToken(context)
        }
    }

    /**
     * Get token expiry (blocking call for Java).
     */
    @JvmStatic
    fun getTokenExpireAt(context: Context): Long? {
        return runBlocking(Dispatchers.IO) {
            AutofillAuthStore.getTokenExpireAt(context)
        }
    }

    /**
     * Check if vault is encrypted (blocking call for Java).
     */
    @JvmStatic
    fun isEncrypted(context: Context): Boolean {
        return runBlocking(Dispatchers.IO) {
            AutofillAuthStore.isEncrypted(context)
        }
    }

    /**
     * Check if valid token exists (blocking call for Java).
     */
    @JvmStatic
    fun hasValidToken(context: Context): Boolean {
        return runBlocking(Dispatchers.IO) {
            AutofillAuthStore.hasValidToken(context)
        }
    }

    /**
     * Set vault encryption status (blocking call for Java).
     */
    @JvmStatic
    fun setVaultEncryptionStatus(context: Context, isEncrypted: Boolean) {
        runBlocking(Dispatchers.IO) {
            AutofillAuthStore.setVaultEncryptionStatus(context, isEncrypted)
        }
    }
}