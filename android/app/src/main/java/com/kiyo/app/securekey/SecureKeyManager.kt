package com.kiyo.app.securekey

import android.annotation.SuppressLint
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.util.Base64
import android.util.Log
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

/**
 * Android Keystore wrapper for SecureKey master key (kiyo_secure_master_key).
 * This key is separate from the autofill master key (kiyo_master_key) and
 * is used to wrap/unwrap the cryptoKey for biometric authentication login.
 */
object SecureKeyManager {
    private const val TAG = "SecureKeyManager"
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private const val KEY_ALIAS = "kiyo_secure_master_key"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val KEY_SIZE = 256
    private const val GCM_IV_LENGTH = 12
    private const val GCM_TAG_LENGTH = 16
    private const val AUTH_VALIDITY_DURATION_SECONDS = 30 * 60 // 30 minutes

    private var cachedKey: SecretKey? = null

    /**
     * Get or create the master key from Android Keystore.
     * Returns cached key if already loaded.
     * Handles key invalidation due to biometric enrollment changes.
     */
    @Throws(Exception::class)
    fun getOrCreateKey(): SecretKey {
        if (cachedKey != null) {
            return cachedKey!!
        }

        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)

        val keyExisted = keyStore.containsAlias(KEY_ALIAS)
        if (!keyExisted) {
            Log.d(TAG, "Creating new secure master key in Keystore: $KEY_ALIAS")
        } else {
            Log.d(TAG, "Reusing existing secure master key in Keystore: $KEY_ALIAS")
        }

        if (!keyExisted) {
            generateNewKey(keyStore)
        } else {
            // Try to load existing key - if it's invalidated, recreate
            try {
                val entry = keyStore.getEntry(KEY_ALIAS, null) as KeyStore.SecretKeyEntry
                cachedKey = entry.secretKey

                // Test if key is usable (not invalidated)
                testKeyUsability(cachedKey!!)

                Log.d(TAG, "Secure master key loaded from Keystore: ${cachedKey!!.algorithm}")
            } catch (e: KeyPermanentlyInvalidatedException) {
                Log.w(TAG, "Secure master key permanently invalidated (biometric changed), recreating")
                deleteKeyInternal(keyStore)
                generateNewKey(keyStore)
            } catch (e: Exception) {
                // Other exceptions - key might be invalidated
                if (e is java.security.KeyStoreException ||
                    e.message?.contains("invalidated", true) == true) {
                    Log.w(TAG, "Secure master key appears invalidated, recreating: ${e.message}")
                    deleteKeyInternal(keyStore)
                    generateNewKey(keyStore)
                } else {
                    throw e
                }
            }
        }

        return cachedKey!!
    }

    private fun testKeyUsability(key: SecretKey) {
            // Try to initialize cipher with the key to verify it's usable
            // Note: This may fail with UserNotAuthenticatedException if the key requires
            // user authentication and the user hasn't authenticated recently.
            // In that case, the key is still valid - it just needs authentication when actually used.
            try {
                val cipher = Cipher.getInstance(TRANSFORMATION)
                cipher.init(Cipher.ENCRYPT_MODE, key)
            } catch (e: java.security.InvalidKeyException) {
                // Key is not usable (e.g., permanently invalidated)
                throw e
            } catch (e: android.security.keystore.UserNotAuthenticatedException) {
                // Key requires user authentication - this is expected in test environments
                // or when the auth timeout has expired. The key itself is valid.
                Log.d(TAG, "Key requires user authentication (will prompt when actually used)")
            }
        }

    private fun generateNewKey(keyStore: KeyStore) {
        Log.d(TAG, "Creating new secure master key in Keystore: $KEY_ALIAS")
        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(KEY_SIZE)
            .setUserAuthenticationRequired(true)
            .setUserAuthenticationParameters(
                AUTH_VALIDITY_DURATION_SECONDS,
                KeyProperties.AUTH_BIOMETRIC_STRONG
            )
            .setInvalidatedByBiometricEnrollment(true)
            .build()
        keyGenerator.init(spec)
        keyGenerator.generateKey()

        val entry = keyStore.getEntry(KEY_ALIAS, null) as KeyStore.SecretKeyEntry
        cachedKey = entry.secretKey
        Log.d(TAG, "New secure master key generated and loaded: ${cachedKey!!.algorithm}")
    }

    private fun deleteKeyInternal(keyStore: KeyStore): Boolean {
        if (keyStore.containsAlias(KEY_ALIAS)) {
            keyStore.deleteEntry(KEY_ALIAS)
            cachedKey = null
            Log.d(TAG, "Invalidated secure master key deleted from Keystore")
            return true
        }
        return false
    }

    /**
     * Encrypt a plaintext key using the master key.
     * Returns EncryptedKey with IV and ciphertext (includes GCM tag).
     * Note: This method is called WITHOUT CryptoObject - actual encryption
     * with biometric binding happens in BiometricAuthHelper.
     */
    @Throws(Exception::class)
    fun encrypt(masterKey: SecretKey, plainKey: ByteArray): EncryptedKey {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, masterKey)

        val iv = cipher.iv
        require(iv.size == GCM_IV_LENGTH) { "Unexpected IV length: ${iv.size}" }

        val ciphertext = cipher.doFinal(plainKey)
        // ciphertext includes plaintext + GCM tag (16 bytes)
        require(ciphertext.size == plainKey.size + GCM_TAG_LENGTH) {
            "Unexpected ciphertext length: ${ciphertext.size}"
        }

        Log.d(TAG, "Encrypted secure key: iv=${iv.size} bytes, ciphertext=${ciphertext.size} bytes")
        return EncryptedKey(iv, ciphertext)
    }

    /**
     * Decrypt an encrypted key using the master key.
     * Note: This method is called WITHOUT CryptoObject - actual decryption
     * with biometric binding happens in BiometricAuthHelper.
     */
    @Throws(Exception::class)
    fun decrypt(masterKey: SecretKey, encrypted: EncryptedKey): ByteArray {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val spec = GCMParameterSpec(GCM_TAG_LENGTH * 8, encrypted.iv)
        cipher.init(Cipher.DECRYPT_MODE, masterKey, spec)

        val plaintext = cipher.doFinal(encrypted.ciphertext)
        Log.d(TAG, "Decrypted secure key: ${plaintext.size} bytes")
        return plaintext
    }

    /**
     * Delete the master key from Keystore.
     */
    @Throws(Exception::class)
    fun deleteKey(): Boolean {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)
        return deleteKeyInternal(keyStore)
    }

    /**
     * Clear cached key (for testing).
     */
    @SuppressLint("VisibleForTests")
    internal fun clearCache() {
        cachedKey = null
        Log.d(TAG, "Secure master key cache cleared")
    }

    /**
     * Check if master key exists in Keystore (for testing).
     */
    @SuppressLint("VisibleForTests")
    fun hasKey(): Boolean {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)
        return keyStore.containsAlias(KEY_ALIAS)
    }

    data class EncryptedKey(
        val iv: ByteArray,
        val ciphertext: ByteArray
    ) {
        fun toJson(): String {
            val json = JSONObject().apply {
                put("iv", Base64.encodeToString(iv, Base64.NO_WRAP))
                put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
            }
            return json.toString()
        }

        companion object {
            @Throws(Exception::class)
            fun fromJson(jsonString: String): EncryptedKey {
                val json = JSONObject(jsonString)
                val iv = Base64.decode(json.getString("iv"), Base64.NO_WRAP)
                val ciphertext = Base64.decode(json.getString("ciphertext"), Base64.NO_WRAP)
                return EncryptedKey(iv, ciphertext)
            }
        }
    }
}