package com.kiyo.app.autofill

import android.util.Base64
import android.util.Log
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec
import java.security.SecureRandom
import java.security.spec.KeySpec
import java.util.concurrent.ConcurrentHashMap

/**
 * Crypto utility for Autofill password encryption using AES-GCM.
 * Uses PBKDF2 with SHA-256 for key derivation (100,000 iterations).
 * AES-GCM with 256-bit key, 12-byte IV, 128-bit auth tag.
 * 
 * Performance optimization: Caches derived keys per salt to avoid
 * repeated PBKDF2 iterations (100,000 iterations) on every encrypt/decrypt.
 * Keys are cached in memory for the session lifetime.
 */
object AutofillCrypto {

    private const val TAG = "AutofillCrypto"
    private const val KEY_ALGORITHM = "PBKDF2WithHmacSHA256"
    private const val CIPHER_ALGORITHM = "AES/GCM/NoPadding"
    private const val KEY_LENGTH = 256
    private const val ITERATIONS = 100000
    private const val SALT_LENGTH = 16
    private const val IV_LENGTH = 12
    private const val TAG_LENGTH = 128 // bits

    // Master key for autofill encryption (derived from app-specific secret)
    // In production, this should be derived from a secure source like Android Keystore
    private const val MASTER_SECRET = "KIYO_AUTOFILL_MASTER_SECRET_2024"

    // In-memory session cache for derived keys (salt -> SecretKey)
    // Keys are cached per session to avoid repeated PBKDF2 iterations
    private val keyCache = ConcurrentHashMap<String, SecretKey>()

    /**
     * Encrypt a password using AES-GCM with PBKDF2 key derivation.
     * Returns Base64 encoded string: salt:iv:ciphertext
     * Uses cached derived key if available for the salt.
     */
    fun encryptPassword(password: String): String {
        try {
            // Generate random salt
            val salt = ByteArray(SALT_LENGTH)
            SecureRandom().nextBytes(salt)

            // Derive key from master secret + salt (uses cache if available)
            val key = deriveKeyCached(MASTER_SECRET, salt)

            // Generate random IV
            val iv = ByteArray(IV_LENGTH)
            SecureRandom().nextBytes(iv)

            // Encrypt
            val cipher = Cipher.getInstance(CIPHER_ALGORITHM)
            val gcmSpec = GCMParameterSpec(TAG_LENGTH, iv)
            cipher.init(Cipher.ENCRYPT_MODE, key, gcmSpec)

            val ciphertext = cipher.doFinal(password.toByteArray())

            // Combine salt + iv + ciphertext
            val combined = ByteArray(SALT_LENGTH + IV_LENGTH + ciphertext.size)
            System.arraycopy(salt, 0, combined, 0, SALT_LENGTH)
            System.arraycopy(iv, 0, combined, SALT_LENGTH, IV_LENGTH)
            System.arraycopy(ciphertext, 0, combined, SALT_LENGTH + IV_LENGTH, ciphertext.size)

            return Base64.encodeToString(combined, Base64.NO_WRAP)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to encrypt password", e)
            throw RuntimeException("Failed to encrypt password", e)
        }
    }

    /**
     * Decrypt a password encrypted with encryptPassword().
     * Expects Base64 encoded string: salt:iv:ciphertext
     * Uses cached derived key if available for the salt.
     */
    fun decryptPassword(encryptedData: String): String {
        try {
            val combined = Base64.decode(encryptedData, Base64.NO_WRAP)

            if (combined.size < SALT_LENGTH + IV_LENGTH) {
                throw IllegalArgumentException("Invalid encrypted data length")
            }

            // Extract salt, iv, ciphertext
            val salt = combined.copyOfRange(0, SALT_LENGTH)
            val iv = combined.copyOfRange(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
            val ciphertext = combined.copyOfRange(SALT_LENGTH + IV_LENGTH, combined.size)

            // Derive key from master secret + salt (uses cache if available)
            val key = deriveKeyCached(MASTER_SECRET, salt)

            // Decrypt
            val cipher = Cipher.getInstance(CIPHER_ALGORITHM)
            val gcmSpec = GCMParameterSpec(TAG_LENGTH, iv)
            cipher.init(Cipher.DECRYPT_MODE, key, gcmSpec)

            val plaintext = cipher.doFinal(ciphertext)
            return String(plaintext)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to decrypt password", e)
            throw RuntimeException("Failed to decrypt password", e)
        }
    }

    /**
     * Check if a string appears to be encrypted (Base64 with correct length)
     */
    fun isEncrypted(data: String?): Boolean {
        if (data == null || data.isEmpty()) return false
        try {
            val decoded = Base64.decode(data, Base64.NO_WRAP)
            // Minimum length: salt(16) + iv(12) + at least 1 byte ciphertext + auth tag(16)
            return decoded.size >= SALT_LENGTH + IV_LENGTH + 17
        } catch (e: Exception) {
            return false
        }
    }

    /**
     * Derive AES-256 key from password and salt using PBKDF2.
     * Uses in-memory session cache to avoid repeated PBKDF2 iterations.
     * Cache key is Base64 encoded salt.
     */
    private fun deriveKeyCached(password: String, salt: ByteArray): SecretKey {
        val saltKey = Base64.encodeToString(salt, Base64.NO_WRAP)
        
        // Check cache first
        val cachedKey = keyCache[saltKey]
        if (cachedKey != null) {
            Log.d(TAG, "Using cached derived key for salt: $saltKey")
            return cachedKey
        }

        // Derive new key (expensive PBKDF2 operation)
        val key = deriveKey(password, salt)
        
        // Cache the derived key for this session
        keyCache[saltKey] = key
        Log.d(TAG, "Derived and cached new key for salt: $saltKey")
        
        return key
    }

    /**
     * Derive AES-256 key from password and salt using PBKDF2 (100,000 iterations).
     * This is the expensive operation that we cache.
     */
    private fun deriveKey(password: String, salt: ByteArray): SecretKey {
        val factory = SecretKeyFactory.getInstance(KEY_ALGORITHM)
        val spec = PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_LENGTH)
        val secretKey = factory.generateSecret(spec)
        return SecretKeySpec(secretKey.encoded, "AES")
    }

    /**
     * Clear the key cache (e.g., on app background, biometric re-auth, or logout).
     * Should be called when the master secret might have changed or session ends.
     */
    fun clearKeyCache() {
        keyCache.clear()
        Log.d(TAG, "Key cache cleared")
    }

    /**
     * Get current cache size (for debugging/monitoring)
     */
    fun getCacheSize(): Int {
        return keyCache.size
    }
}