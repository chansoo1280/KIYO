package com.kiyo.app.autofill.store

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

/**
 * DataStore wrapper for autofill authentication session persistence.
 * Replaces in-memory SecuritySession with persistent storage across process restarts.
 */
object AutofillAuthStore {

    private const val DATASTORE_NAME = "autofill_prefs"
    private const val KEY_AUTOFILL_TOKEN = "autofill_token"
    private const val KEY_TOKEN_EXPIRE_AT = "token_expire_at"
    private const val KEY_IS_ENCRYPTED = "is_encrypted"

    // Default token expiry: 30 minutes
    const val DEFAULT_TOKEN_EXPIRY_MS = 30 * 60 * 1000L

    private val Context.autofillDataStore: DataStore<Preferences> by preferencesDataStore(name = DATASTORE_NAME)

    private val TOKEN_KEY = stringPreferencesKey(KEY_AUTOFILL_TOKEN)
    private val EXPIRE_AT_KEY = longPreferencesKey(KEY_TOKEN_EXPIRE_AT)
    private val IS_ENCRYPTED_KEY = stringPreferencesKey(KEY_IS_ENCRYPTED) // Store as string "true"/"false"

    /**
     * Save autofill token with expiry and encryption status.
     * Called from Capacitor plugin when user unlocks vault via PIN/biometric.
     */
    suspend fun saveAutofillToken(
        context: Context,
        token: String,
        expireAt: Long = System.currentTimeMillis() + DEFAULT_TOKEN_EXPIRY_MS,
        isEncrypted: Boolean
    ) {
        context.autofillDataStore.edit { preferences ->
            preferences[TOKEN_KEY] = token
            preferences[EXPIRE_AT_KEY] = expireAt
            preferences[IS_ENCRYPTED_KEY] = isEncrypted.toString()
        }
    }

    /**
     * Get stored autofill token, or null if not set.
     */
    suspend fun getAutofillToken(context: Context): String? {
        val prefs = context.autofillDataStore.data.first()
        return prefs[TOKEN_KEY]
    }

    /**
     * Get token expiry timestamp, or null if not set.
     */
    suspend fun getTokenExpireAt(context: Context): Long? {
        val prefs = context.autofillDataStore.data.first()
        return prefs[EXPIRE_AT_KEY]
    }

    /**
     * Check if current vault is encrypted.
     * Defaults to true for safety (encrypted vault requires auth).
     */
    suspend fun isEncrypted(context: Context): Boolean {
        val prefs = context.autofillDataStore.data.first()
        val value = prefs[IS_ENCRYPTED_KEY]
        return value?.toBoolean() ?: true
    }

    /**
     * Check if there's a valid (non-expired) token.
     */
    suspend fun hasValidToken(context: Context): Boolean {
        val token = getAutofillToken(context)
        val expireAt = getTokenExpireAt(context)
        val now = System.currentTimeMillis()
        return token != null && expireAt != null && now < expireAt
    }

    /**
     * Clear all autofill session data.
     * Called on logout, vault switch, or explicit lock.
     */
    suspend fun clear(context: Context) {
        context.autofillDataStore.edit { preferences ->
            preferences.remove(TOKEN_KEY)
            preferences.remove(EXPIRE_AT_KEY)
            // Keep isEncrypted to know vault type, or remove it too?
            // For now, keep isEncrypted as it represents vault property not session
        }
    }

    /**
     * Clear only the token (keep isEncrypted for vault type).
     * Called when token expires or explicit lock without vault switch.
     */
    suspend fun clearToken(context: Context) {
        context.autofillDataStore.edit { preferences ->
            preferences.remove(TOKEN_KEY)
            preferences.remove(EXPIRE_AT_KEY)
        }
    }

    /**
     * Set vault encryption status (called when opening/creating vault).
     * Non-encrypted vault: isEncrypted = false
     * Encrypted vault: isEncrypted = true
     */
    suspend fun setVaultEncryptionStatus(context: Context, isEncrypted: Boolean) {
        context.autofillDataStore.edit { preferences ->
            preferences[IS_ENCRYPTED_KEY] = isEncrypted.toString()
        }
    }
}