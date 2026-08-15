package com.kiyo.app.security

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
            Log.d(TAG, "Generating new DB_KEY and storing encrypted")
            try {
                val newKey = DatabaseKeyGenerator.generate()
                val encrypted = KeystoreManager.encrypt(masterKey, newKey.encoded)
                val jsonOut = EncryptedKey.toJson(encrypted)

                context.securityDataStore.edit { preferences ->
                    preferences[DB_ENCRYPTED_KEY] = jsonOut
                }

                Log.d(TAG, "New DB_KEY generated and stored encrypted")
                newKey
            } catch (e: Exception) {
                Log.e(TAG, "Failed to generate and encrypt DB_KEY: ${e.message}", e)
                throw e
            }
        }
    }
}