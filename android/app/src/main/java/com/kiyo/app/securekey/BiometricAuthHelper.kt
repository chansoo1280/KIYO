package com.kiyo.app.securekey

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.security.keystore.UserNotAuthenticatedException
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
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

/**
 * Biometric authentication helper using CryptoObject pattern.
 * Both encryption and decryption require user authentication via BiometricPrompt.
 * Manages a single global biometric-protected key (not per-vault).
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
     * Uses non-crypto prompt + init+doFinal (see storeKey comments for why CryptoObject not used).
     */
    suspend fun storeKey(cryptoKeyBase64: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val masterKey = getOrCreateMasterKey()
            val plainKeyBytes = Base64.decode(cryptoKeyBase64, Base64.NO_WRAP)

            // ⚠️ CryptoObject 경로는 사용하지 않는다 (2026-08-27 실측):
            // Keystore2에서 cipher.init()이 UserNotAuthenticatedException 없이 성공해도
            // op handle이 지연/정리되어 BiometricPrompt.authenticate(CryptoObject) 시점에
            // "Crypto primitive not initialized"로 크래시난다.
            // → non-crypto 프롬프트로 사용자 인증(키 30분 유효창 오픈) 후 init+doFinal.
            //   doFinal이 auth-required 키를 강제하므로 보안 등가이다 (유효창 닫히면 UNAE).
            authenticateWithPrompt(
                title = "생체인증 등록",
                subtitle = "암호화 키를 생체인증으로 보호합니다",
            ) {
                val cipher = Cipher.getInstance(TRANSFORMATION)
                cipher.init(Cipher.ENCRYPT_MODE, masterKey)
                val ciphertext = cipher.doFinal(plainKeyBytes)
                saveEncryptedKeyToDataStore(cipher.iv, ciphertext)
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Log.e(TAG, "storeKey failed", e)
            Result.failure(e)
        }
    }

    /**
     * Unlock (decrypt) the cryptoKey using biometric authentication.
     * Uses non-crypto prompt + init+doFinal; auth-required 키라 doFinal이 인증을 강제한다.
     */
    suspend fun unlockKeyWithBiometric(): Result<String> = withContext(Dispatchers.IO) {
        try {
            val masterKey = getOrCreateMasterKey()

            // 1. Read encrypted key from DataStore
            val encryptedKey = readEncryptedKeyFromDataStore()
            val spec = GCMParameterSpec(GCM_TAG_LENGTH * 8, encryptedKey.iv)

            // CryptoObject 미사용 (storeKey 주석 참조 — Keystore2 "Crypto primitive not initialized" 크래시).
            // non-crypto 인증 후 init+doFinal; auth-required 키라 doFinal이 인증을 강제한다.
            val plainKeyBytes = authenticateWithPrompt(
                title = "생체인증으로 로그인",
                subtitle = "볼트 잠금 해제",
            ) {
                val cipher = Cipher.getInstance(TRANSFORMATION)
                cipher.init(Cipher.DECRYPT_MODE, masterKey, spec)
                cipher.doFinal(encryptedKey.ciphertext)
            }
            Result.success(Base64.encodeToString(plainKeyBytes, Base64.NO_WRAP))
        } catch (e: AEADBadTagException) {
            // 저장된 IV+ciphertext가 현재 Keystore 키와 불일치 (잔여 키 데이터/재등록 사이클 오염).
            // 사용자가 볼 수 있는 원인을 명확히 전달한다.
            Log.e(TAG, "Stored biometric key data is corrupted (GCM tag mismatch). Re-enrollment required.", e)
            Result.failure(BiometricKeyCorruptedException())
        } catch (e: Exception) {
            Log.e(TAG, "unlockKeyWithBiometric failed", e)
            Result.failure(e)
        }
    }

    /**
     * 저장된 생체인증 키 데이터(IV+ciphertext)가 손상/불일치 상태임을 나타내는 예외.
     * UI는 이 예외를 받아 "생체인증 재등록 필요" 안내를 해야 한다.
     */
    class BiometricKeyCorruptedException : Exception("저장된 생체인증 키가 손상되었습니다. 설정에서 생체인증을 다시 등록해 주세요.")

    /**
     * BiometricPrompt를 띄우고 인증 성공 시 block을 실행해 값을 반환받는다 (non-crypto 인증).
     *
     * ⚠️ authenticate()는 FragmentManager 트랜잭션을 실행하므로 메인 스레드에서 호출해야 한다.
     */
    private suspend fun <T> authenticateWithPrompt(
        title: String,
        subtitle: String,
        block: () -> T,
    ): T {
        val executor = ContextCompat.getMainExecutor(context)
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setDescription("지문 또는 얼굴 인증으로 확인하세요")
            .setNegativeButtonText("취소")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build()

        val deferred = CompletableDeferred<T>()
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                try {
                    deferred.complete(block())
                } catch (e: Exception) {
                    Log.e(TAG, "Crypto operation failed after authentication", e)
                    deferred.completeExceptionally(e)
                }
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                deferred.completeExceptionally(BiometricAuthException(errorCode, errString.toString()))
            }

            override fun onAuthenticationFailed() {
                deferred.completeExceptionally(BiometricAuthException(-1, "Biometric authentication failed"))
            }
        }

        withContext(Dispatchers.Main) {
            BiometricPrompt(activity, executor, callback).authenticate(promptInfo)
        }
        return deferred.await()
    }

    /**
     * Check if biometric key exists.
     */
    suspend fun hasKey(): Result<Boolean> = withContext(Dispatchers.IO) {
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
    suspend fun deleteKey(): Result<Unit> = withContext(Dispatchers.IO) {
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
    override val message: String
) : Exception(message)

/**
 * Factory for BiometricAuthHelper to ensure proper initialization.
 */
object BiometricAuthHelperFactory {
    fun create(context: Context, activity: FragmentActivity): BiometricAuthHelper {
        return BiometricAuthHelper(context, activity)
    }
}