package com.kiyo.app.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
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
     */
    @Throws(Exception::class)
    override fun getOrCreateKey(): SecretKey {
        if (cachedKey != null) {
            return cachedKey!!
        }

        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)

        if (!keyStore.containsAlias(KEY_ALIAS)) {
            Log.d(TAG, "Creating new master key in Keystore: $KEY_ALIAS")
            val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
            val spec = KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(KEY_SIZE)
                .setUserAuthenticationRequired(false)
                .build()
            keyGenerator.init(spec)
            keyGenerator.generateKey()
        }

        val entry = keyStore.getEntry(KEY_ALIAS, null) as KeyStore.SecretKeyEntry
        cachedKey = entry.secretKey
        Log.d(TAG, "Master key loaded from Keystore: ${cachedKey!!.algorithm}")
        return cachedKey!!
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
}