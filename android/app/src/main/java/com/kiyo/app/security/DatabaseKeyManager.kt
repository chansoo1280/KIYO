package com.kiyo.app.security

import android.annotation.SuppressLint
import android.content.Context
import android.util.Base64
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

private val Context.securityDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "kiyo_security_prefs"
)

object DatabaseKeyManager {

    private val TAG = "DatabaseKeyManager"
    private val DB_ENCRYPTED_KEY = stringPreferencesKey("db_encrypted_key")

    /**
     * Get the SQLCipher database encryption key.
     * - First call: generates new key, encrypts with Keystore master key, stores in DataStore
     * - Subsequent calls: reads encrypted key from DataStore, decrypts with Keystore master key
     */
    suspend fun getKey(context: Context): SecretKey {
        val prefs = context.securityDataStore.data.first()
        val json = prefs[DB_ENCRYPTED_KEY]

        val masterKey = KeystoreManager.getOrCreateKey()

        return if (json != null) {
            Log.d(TAG, "Reading existing encrypted DB_KEY from DataStore")
            val encrypted = EncryptedKey.fromJson(json)
            try {
                val plainBytes = KeystoreManager.decrypt(masterKey, encrypted)
                Log.d(TAG, "DB_KEY decrypted successfully")
                SecretKeySpec(plainBytes, "AES")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to decrypt DB_KEY: ${e.message}", e)
                throw e
            }
        } else {
            Log.d(TAG, "No DB_KEY found, generating and storing new key")
            generateAndStoreKey(context, masterKey)
        }
    }

    /**
     * Generate a new DB_KEY, encrypt with Keystore master key, and store in DataStore.
     * Separated from getKey() for single responsibility and testability.
     */
    private suspend fun generateAndStoreKey(context: Context, masterKey: SecretKey): SecretKey {
        val newKey = DatabaseKeyGenerator.generate()
        val encrypted = KeystoreManager.encrypt(masterKey, newKey.encoded)
        val jsonOut = EncryptedKey.toJson(encrypted)

        context.securityDataStore.edit { preferences ->
            preferences[DB_ENCRYPTED_KEY] = jsonOut
        }

        Log.d(TAG, "New DB_KEY generated and stored encrypted")
        return newKey
    }

    /**
     * Delete the encrypted DB_KEY from DataStore (for testing).
     */
    @SuppressLint("VisibleForTests")
    suspend fun deleteKey(context: Context) {
        context.securityDataStore.edit { preferences ->
            preferences.remove(DB_ENCRYPTED_KEY)
        }
        Log.d(TAG, "Encrypted DB_KEY deleted from DataStore")
    }

    /**
     * Check if encrypted DB_KEY exists in DataStore (for testing).
     */
    @SuppressLint("VisibleForTests")
    suspend fun hasKey(context: Context): Boolean {
        val prefs = context.securityDataStore.data.first()
        return prefs[DB_ENCRYPTED_KEY] != null
    }


    /**
         * Generate a test DB key and store it in DataStore (for testing only).
         * Uses the SAME production Keystore master key as getKey() - so the autofill service can read it with getKey().
         * The test must ensure Keystore auth cache is cleared (or expired) to trigger PIN prompt.
         */
        @SuppressLint("VisibleForTests")
        suspend fun generateAndStoreTestKey(context: Context): SecretKey {
            val newKey = DatabaseKeyGenerator.generate()
            val masterKey = KeystoreManager.getOrCreateKey()
            val encrypted = KeystoreManager.encrypt(masterKey, newKey.encoded)
            val jsonOut = EncryptedKey.toJson(encrypted)

            context.securityDataStore.edit { preferences ->
                preferences[DB_ENCRYPTED_KEY] = jsonOut
            }

            Log.d(TAG, "Test DB_KEY generated and stored encrypted with production master key")
            return newKey
        }

        /**
         * Generate a test DB key using a test master key that requires auth on EVERY use (no cache).
         * For tests that need to verify auth prompt on EVERY encrypt/decrypt operation.
         * Note: The autofill service uses the production key, so this is only for direct test verification.
         */
        @SuppressLint("VisibleForTests")
        suspend fun generateAndStoreTestKeyRequiringAuthEveryTime(context: Context): SecretKey {
            val newKey = DatabaseKeyGenerator.generate()

            // Create a test master key that requires authentication every time (no cache)
            val keyStore = java.security.KeyStore.getInstance("AndroidKeyStore")
            keyStore.load(null)
            val testMasterKey = KeystoreManager.generateTestKeyRequiringAuthEveryTime(keyStore)

            val encrypted = KeystoreManager.encrypt(testMasterKey, newKey.encoded)
            val jsonOut = EncryptedKey.toJson(encrypted)

            context.securityDataStore.edit { preferences ->
                preferences[DB_ENCRYPTED_KEY] = jsonOut
            }

            Log.d(TAG, "Test DB_KEY generated and stored encrypted with test master key (auth every time)")
            return newKey
        }
    }