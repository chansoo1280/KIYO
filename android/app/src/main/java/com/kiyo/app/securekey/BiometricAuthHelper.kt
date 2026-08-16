package com.kiyo.app.securekey

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

/**
 * Biometric authentication helper using CryptoObject pattern.
 * Both encryption and decryption require user authentication via BiometricPrompt.
 */
class BiometricAuthHelper internal constructor(
    private val context: Context,
    private val activity: FragmentActivity
) {
    companion object {
        private const val TAG = "BiometricAuthHelper"
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val KEY_ALIAS = "kiyo_secure_master_key"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_TAG_LENGTH = 16
        private const val DATASTORE_NAME = "kiyo_secure_prefs"
        private const val ENCRYPTED_KEY_KEY = "encrypted_key"
    }

    /**
     * Store the cryptoKey encrypted with Keystore master key, bound to biometric authentication.
     * Uses CryptoObject pattern: Cipher.init(ENCRYPT_MODE) → CryptoObject → BiometricPrompt.authenticate()
     */
    suspend fun storeKey(vaultId: String, cryptoKeyBase64: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val masterKey = getOrCreateMasterKey()
            val plainKeyBytes = Base64.decode(cryptoKeyBase64, Base64.NO_WRAP)

            // 1. Initialize Cipher in ENCRYPT_MODE - this cipher will be bound to biometric auth
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, masterKey)

            // 2. Create CryptoObject wrapping the cipher
            val cryptoObject = BiometricPrompt.CryptoObject(cipher)

            // 3. Create biometric prompt
            val executor = ContextCompat.getMainExecutor(context)
            val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle("생체인증 등록")
                .setSubtitle("$vaultId 볼트의 암호화 키를 생체인증으로 보호합니다")
                .setDescription("지문 또는 얼굴 인증으로 키 저장을 확인하세요")
                .setNegativeButtonText("취소")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .build()

            val deferred = CompletableDeferred<Unit>()
            val callback = object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    try {
                        val authenticatedCipher = result.cryptoObject?.cipher
                            ?: throw IllegalStateException("CryptoObject is null in authentication result")

                        // 4. Perform actual encryption with the authenticated cipher
                        val ciphertext = authenticatedCipher.doFinal(plainKeyBytes)
                        val iv = authenticatedCipher.iv

                        // 5. Save encrypted key to DataStore
                        saveEncryptedKeyToDataStore(iv, ciphertext)

                        deferred.complete(Unit)
                    } catch (e: Exception) {
                        Log.e(TAG, "Encryption failed after authentication", e)
                        deferred.completeExceptionally(e)
                    }
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    deferred.completeExceptionally(
                        BiometricAuthException(errorCode, errString.toString())
                    )
                }

                override fun onAuthenticationFailed() {
                    deferred.completeExceptionally(
                        BiometricAuthException(-1, "Biometric authentication failed")
                    )
                }
            }

            val biometricPrompt = BiometricPrompt(activity, executor, callback)
            biometricPrompt.authenticate(promptInfo, cryptoObject)

            deferred.await()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "storeKey failed", e)
            Result.failure(e)
        }
    }

    /**
     * Unlock (decrypt) the cryptoKey using biometric authentication.
     * Uses CryptoObject pattern: Cipher.init(DECRYPT_MODE, IV) → CryptoObject → BiometricPrompt.authenticate()
     */
    suspend fun unlockKeyWithBiometric(vaultId: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            val masterKey = getOrCreateMasterKey()

            // 1. Read encrypted key from DataStore
            val encryptedKey = readEncryptedKeyFromDataStore()
            val iv = encryptedKey.iv
            val ciphertext = encryptedKey.ciphertext

            // 2. Initialize Cipher in DECRYPT_MODE with IV - bound to biometric auth
            val cipher = Cipher.getInstance(TRANSFORMATION)
            val spec = GCMParameterSpec(GCM_TAG_LENGTH * 8, iv)
            cipher.init(Cipher.DECRYPT_MODE, masterKey, spec)

            // 3. Create CryptoObject wrapping the cipher
            val cryptoObject = BiometricPrompt.CryptoObject(cipher)

            // 4. Create biometric prompt
            val executor = ContextCompat.getMainExecutor(context)
            val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle("생체인증으로 로그인")
                .setSubtitle("$vaultId 볼트 잠금 해제")
                .setDescription("지문 또는 얼굴 인증으로 로그인하세요")
                .setNegativeButtonText("취소")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .build()

            val deferred = CompletableDeferred<String>()
            val callback = object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    try {
                        val authenticatedCipher = result.cryptoObject?.cipher
                            ?: throw IllegalStateException("CryptoObject is null in authentication result")

                        // 5. Perform actual decryption with the authenticated cipher
                        val plainKeyBytes = authenticatedCipher.doFinal(ciphertext)
                        val cryptoKeyBase64 = Base64.encodeToString(plainKeyBytes, Base64.NO_WRAP)

                        deferred.complete(cryptoKeyBase64)
                    } catch (e: Exception) {
                        Log.e(TAG, "Decryption failed after authentication", e)
                        deferred.completeExceptionally(e)
                    }
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    deferred.completeExceptionally(
                        BiometricAuthException(errorCode, errString.toString())
                    )
                }

                override fun onAuthenticationFailed() {
                    deferred.completeExceptionally(
                        BiometricAuthException(-1, "Biometric authentication failed")
                    )
                }
            }

            val biometricPrompt = BiometricPrompt(activity, executor, callback)
            biometricPrompt.authenticate(promptInfo, cryptoObject)

            val result = deferred.await()
            Result.success(result)
        } catch (e: Exception) {
            Log.e(TAG, "unlockKeyWithBiometric failed", e)
            Result.failure(e)
        }
    }

    /**
     * Check if biometric key exists for the vault.
     */
    suspend fun hasKey(vaultId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val prefs = context.getSharedPreferences(DATASTORE_NAME, Context.MODE_PRIVATE)
            val json = prefs.getString(ENCRYPTED_KEY_KEY, null)
            Result.success(json != null)
        } catch (e: Exception) {
            Log.e(TAG, "hasKey failed", e)
            Result.failure(e)
        }
    }

    /**
     * Delete the stored biometric key.
     */
    suspend fun deleteKey(vaultId: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val prefs = context.getSharedPreferences(DATASTORE_NAME, Context.MODE_PRIVATE)
            prefs.edit().remove(ENCRYPTED_KEY_KEY).apply()
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "deleteKey failed", e)
            Result.failure(e)
        }
    }

    /**
     * Check if biometric hardware is available and enrolled.
     */
    suspend fun isBiometryAvailable(): Result<BiometryAvailability> = withContext(Dispatchers.IO) {
        try {
            val biometricManager = BiometricManager.from(context)
            val authResult = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)

            when (authResult) {
                BiometricManager.BIOMETRIC_SUCCESS -> {
                    // Check which biometric type is available
                    val hasFingerprint = biometricManager.canAuthenticate(
                        BiometricManager.Authenticators.BIOMETRIC_STRONG
                    ) == BiometricManager.BIOMETRIC_SUCCESS
                    val hasFace = false // Face detection requires different API
                    val type = if (hasFingerprint) "fingerprint" else "face"
                    Result.success(BiometryAvailability(true, type))
                }
                BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> {
                    Result.success(BiometryAvailability(false, "none"))
                }
                BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE,
                BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                    Result.success(BiometryAvailability(false, "none"))
                }
                else -> {
                    Result.success(BiometryAvailability(false, "none"))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "isBiometryAvailable failed", e)
            Result.failure(e)
        }
    }

    private fun getOrCreateMasterKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)

        if (!keyStore.containsAlias(KEY_ALIAS)) {
            val keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                KEYSTORE_PROVIDER
            )
            val spec = KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setUserAuthenticationRequired(true)
                .setUserAuthenticationParameters(
                    30 * 60,
                    KeyProperties.AUTH_BIOMETRIC_STRONG
                )
                .setInvalidatedByBiometricEnrollment(true)
                .build()
            keyGenerator.init(spec)
            keyGenerator.generateKey()
        }

        val entry = keyStore.getEntry(KEY_ALIAS, null) as KeyStore.SecretKeyEntry
        return entry.secretKey
    }

    private data class EncryptedKeyData(val iv: ByteArray, val ciphertext: ByteArray)

    private fun saveEncryptedKeyToDataStore(iv: ByteArray, ciphertext: ByteArray) {
        val prefs = context.getSharedPreferences(DATASTORE_NAME, Context.MODE_PRIVATE)
        val json = JSONObject().apply {
            put("iv", Base64.encodeToString(iv, Base64.NO_WRAP))
            put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
        }
        prefs.edit().putString(ENCRYPTED_KEY_KEY, json.toString()).apply()
    }

    private fun readEncryptedKeyFromDataStore(): EncryptedKeyData {
        val prefs = context.getSharedPreferences(DATASTORE_NAME, Context.MODE_PRIVATE)
        val jsonString = prefs.getString(ENCRYPTED_KEY_KEY, null)
            ?: throw IllegalStateException("No encrypted key found in DataStore")

        val json = JSONObject(jsonString)
        val iv = Base64.decode(json.getString("iv"), Base64.NO_WRAP)
        val ciphertext = Base64.decode(json.getString("ciphertext"), Base64.NO_WRAP)
        return EncryptedKeyData(iv, ciphertext)
    }
}

data class BiometryAvailability(
    val available: Boolean,
    val type: String // "fingerprint" | "face" | "none"
)

class BiometricAuthException(
    val errorCode: Int,
    message: String
) : Exception(message)

/**
 * Factory for BiometricAuthHelper to ensure proper initialization.
 */
object BiometricAuthHelperFactory {
    fun create(context: Context, activity: FragmentActivity): BiometricAuthHelper {
        return BiometricAuthHelper(context, activity)
    }
}