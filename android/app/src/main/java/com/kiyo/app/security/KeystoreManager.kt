package com.kiyo.app.security

import android.annotation.SuppressLint
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.util.Log
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Android Keystore wrapper for the master key (kiyo_master_key).
 * This key never leaves the Keystore and is used to wrap/unwrap the SQLCipher DB_KEY.
 */
object KeystoreManager : KeystoreProvider {
    private const val TAG = "KeystoreManager"
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    private const val KEY_ALIAS = "kiyo_master_key"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val KEY_SIZE = 256
    private const val GCM_IV_LENGTH = 12
    private const val GCM_TAG_LENGTH = 16

    private var cachedKey: SecretKey? = null

    /**
     * Get or create the master key from Android Keystore.
     * Returns cached key if already loaded.
     * Handles key invalidation due to PIN/biometric changes.
     */
    @Throws(Exception::class)
    override fun getOrCreateKey(): SecretKey {
        if (cachedKey != null) {
            return cachedKey!!
        }

        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)

        val keyExisted = keyStore.containsAlias(KEY_ALIAS)
        if (!keyExisted) {
            Log.d(TAG, "Creating new master key in Keystore: $KEY_ALIAS")
        } else {
            Log.d(TAG, "Reusing existing master key in Keystore: $KEY_ALIAS")
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

                        Log.d(TAG, "Master key loaded from Keystore: ${cachedKey!!.algorithm}")
                    } catch (e: KeyPermanentlyInvalidatedException) {
                        Log.w(TAG, "Master key permanently invalidated (PIN/biometric changed), recreating")
                        deleteKeyInternal(keyStore)
                        generateNewKey(keyStore)
                    } catch (e: android.security.keystore.UserNotAuthenticatedException) {
                        // Key exists but requires user authentication (auth timeout expired).
                        // This is expected - the key is still valid, it just needs auth when actually used.
                        // We accept the key as-is and let the actual encrypt/decrypt operations trigger auth.
                        Log.d(TAG, "Master key requires user authentication (will prompt when actually used)")
                    } catch (e: Exception) {
                        // Other exceptions - key might be invalidated
                        if (e is java.security.KeyStoreException ||
                            e.message?.contains("invalidated", true) == true) {
                            Log.w(TAG, "Master key appears invalidated, recreating: ${e.message}")
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
                // Key requires user authentication - this is expected when auth timeout expired
                // Don't throw here - the key is still valid, just needs auth at actual use time
                Log.d(TAG, "Key requires user authentication (will prompt when actually used)")
            }
        }

    private fun generateNewKey(keyStore: KeyStore) {
            val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
            val spec = KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(KEY_SIZE)
                .setUserAuthenticationRequired(true)
                .setUserAuthenticationParameters(30 * 60, KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL)
                .build()
            keyGenerator.init(spec)
            keyGenerator.generateKey()

            val entry = keyStore.getEntry(KEY_ALIAS, null) as KeyStore.SecretKeyEntry
            cachedKey = entry.secretKey
            Log.d(TAG, "New master key generated and loaded: ${cachedKey!!.algorithm}")
        }

        /**
         * Generate a test master key that requires authentication on EVERY use (no timeout).
         * For testing only - bypasses the 30-minute auth cache.
         */
        @SuppressLint("VisibleForTests")
        fun generateTestKeyRequiringAuthEveryTime(keyStore: KeyStore): SecretKey {
            val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
            val spec = KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(KEY_SIZE)
                .setUserAuthenticationRequired(true)
                .setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL)  // 0 = no cache, auth every time
                .setInvalidatedByBiometricEnrollment(true)
                .build()
            keyGenerator.init(spec)
            keyGenerator.generateKey()

            val entry = keyStore.getEntry(KEY_ALIAS, null) as KeyStore.SecretKeyEntry
            Log.d(TAG, "Test master key generated (auth required every time): ${entry.secretKey.algorithm}")
            return entry.secretKey
        }

        private fun deleteKeyInternal(keyStore: KeyStore): Boolean {
        if (keyStore.containsAlias(KEY_ALIAS)) {
            keyStore.deleteEntry(KEY_ALIAS)
            cachedKey = null
            Log.d(TAG, "Invalidated master key deleted from Keystore")
            return true
        }
        return false
    }

    /**
     * Encrypt a plaintext key using the master key.
     * Returns EncryptedKey with IV and ciphertext (includes GCM tag).
     */
    @Throws(Exception::class)
    override fun encrypt(masterKey: SecretKey, plainKey: ByteArray): EncryptedKey {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, masterKey)

        val iv = cipher.iv
        require(iv.size == GCM_IV_LENGTH) { "Unexpected IV length: ${iv.size}" }

        val ciphertext = cipher.doFinal(plainKey)
        // ciphertext includes plaintext + GCM tag (16 bytes)
        require(ciphertext.size == plainKey.size + GCM_TAG_LENGTH) {
            "Unexpected ciphertext length: ${ciphertext.size}"
        }

        Log.d(TAG, "Encrypted DB_KEY: iv=${iv.size} bytes, ciphertext=${ciphertext.size} bytes")
        return EncryptedKey(iv, ciphertext)
    }

    /**
     * Decrypt an encrypted key using the master key.
     */
    @Throws(Exception::class)
    override fun decrypt(masterKey: SecretKey, encrypted: EncryptedKey): ByteArray {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        val spec = GCMParameterSpec(GCM_TAG_LENGTH * 8, encrypted.iv)
        cipher.init(Cipher.DECRYPT_MODE, masterKey, spec)

        val plaintext = cipher.doFinal(encrypted.ciphertext)
        Log.d(TAG, "Decrypted DB_KEY: ${plaintext.size} bytes")
        return plaintext
    }

    /**
     * Clear cached key (for testing).
     */
    @SuppressLint("VisibleForTests")
    internal fun clearCache() {
        cachedKey = null
        Log.d(TAG, "Master key cache cleared")
    }

    /**
     * Delete the master key from Keystore (for testing).
     */
    @SuppressLint("VisibleForTests")
    fun deleteKey(): Boolean {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)
        return deleteKeyInternal(keyStore)
    }

    /**
     * Check if master key exists in Keystore.
     */
    @SuppressLint("VisibleForTests")
    fun hasKey(): Boolean {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)
        return keyStore.containsAlias(KEY_ALIAS)
    }
}