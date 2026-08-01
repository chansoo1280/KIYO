package com.kiyo.app.autofill

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking

/**
 * Java-friendly wrapper for AutofillDataStore suspend functions.
 * Provides blocking calls for Java interop using runBlocking.
 */
object AutofillDataStoreJavaBridge {

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
            AutofillDataStore.saveAutofillToken(context, token, expireAt, isEncrypted)
        }
    }

    /**
     * Clear autofill token (blocking call for Java).
     */
    @JvmStatic
    fun clearToken(context: Context) {
        runBlocking(Dispatchers.IO) {
            AutofillDataStore.clearToken(context)
        }
    }

    /**
     * Get autofill token (blocking call for Java).
     */
    @JvmStatic
    fun getAutofillToken(context: Context): String? {
        return runBlocking(Dispatchers.IO) {
            AutofillDataStore.getAutofillToken(context)
        }
    }

    /**
     * Get token expiry (blocking call for Java).
     */
    @JvmStatic
    fun getTokenExpireAt(context: Context): Long? {
        return runBlocking(Dispatchers.IO) {
            AutofillDataStore.getTokenExpireAt(context)
        }
    }

    /**
     * Check if vault is encrypted (blocking call for Java).
     */
    @JvmStatic
    fun isEncrypted(context: Context): Boolean {
        return runBlocking(Dispatchers.IO) {
            AutofillDataStore.isEncrypted(context)
        }
    }

    /**
     * Check if valid token exists (blocking call for Java).
     */
    @JvmStatic
    fun hasValidToken(context: Context): Boolean {
        return runBlocking(Dispatchers.IO) {
            AutofillDataStore.hasValidToken(context)
        }
    }

    /**
     * Set vault encryption status (blocking call for Java).
     */
    @JvmStatic
    fun setVaultEncryptionStatus(context: Context, isEncrypted: Boolean) {
        runBlocking(Dispatchers.IO) {
            AutofillDataStore.setVaultEncryptionStatus(context, isEncrypted)
        }
    }
}