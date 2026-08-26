package com.kiyo.app.security

import android.annotation.SuppressLint
import android.app.KeyguardManager
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Log
import com.kiyo.app.BuildConfig
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Android Keystore wrapper for the autofill master key.
 *
 * v3 설계 원칙:
 * - **캐시 없음** — 매 호출이 현재 Keystore 상태를 직접 읽는다. 재래핑/리셋 후
 *   stale 키를 사용할 구조적 가능성이 없다.
 * - **alias 파라미터** — 키 결정권은 호출자(DatabaseKeyManager)에 있다.
 *   이 클래스는 주어진 alias로 조회/생성만 한다.
 * - **KeyPermanentlyInvalidatedException 전파** — 무효화된 키를 같은 alias로
 *   재생성해 삼키지 않는다(그러면 wrapping 검증이 AEADBadTag로 반드시 깨진다).
 *   무효화 판정과 복구 정책은 DatabaseKeyManager의 몫이다.
 */
object KeystoreManager : KeystoreProvider {
    private const val TAG = "KeystoreManager"
    private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
    /** 레거시(무인덱스) alias — 기존 기기 마이그레이션에서 첫 current_alias로 사용 */
    const val LEGACY_KEY_ALIAS = "kiyo_master_key"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val KEY_SIZE = 256
    private const val GCM_IV_LENGTH = 12
    private const val GCM_TAG_LENGTH = 16

    /** 보안 잠금화면 확인용 Context (DatabaseKeyManager 등에서 init 시 주입) */
    @Volatile
    private var appContext: Context? = null

    /** Context 주입 (Application 또는 초기화 시점 호출) */
    fun init(context: Context) {
        if (appContext == null) {
            appContext = context.applicationContext
        }
    }

    /**
     * Get or create the master key for the given alias. No caching.
     * KeyPermanentlyInvalidatedException은 그대로 전파된다 (재생성으로 삼키지 않음).
     */
    @Throws(Exception::class)
    override fun getOrCreateKey(): SecretKey {
        return getOrCreateKey(LEGACY_KEY_ALIAS)
    }

    @Throws(Exception::class)
    fun createKey(alias: String): SecretKey = loadKeyStoreEntry(alias) {
        generateNewKey(keyStore = it, alias = alias)
    }

    /**
     * Keystore를 로드하고 [init]으로 키 준비(생성/기존 사용)한 뒤 entry를 반환한다.
     * getOrCreateKey/createKey의 중복 본문을 통합.
     *
     * 주의: auth-required 키가 인증 만료 상태여도 getEntry 자체는 성공한다.
     * 실제 암/복호화 시점에 UserNotAuthenticatedException이 발생하고,
     * 호출자(AutofillService)가 인증 프롬프트 경로로 연결한다.
     */
    private inline fun loadKeyStoreEntry(
        alias: String,
        init: (KeyStore) -> Unit
    ): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)
        init(keyStore)
        val entry = keyStore.getEntry(alias, null) as KeyStore.SecretKeyEntry
        Log.d(TAG, "Master key loaded from Keystore: alias=$alias")
        return entry.secretKey
    }

    fun getOrCreateKey(alias: String): SecretKey = loadKeyStoreEntry(alias) { keyStore ->
        if (!keyStore.containsAlias(alias)) {
            generateNewKey(keyStore, alias)
        }
    }

    /**
     * 기존 마스터 키가 보안 수준 업그레이드가 필요한지 확인.
     * 업그레이드 대상: 잠금화면이 새로 설정됐는데 현재 alias의 키는 auth-required가 아닌 경우.
     */
    fun needsSecurityUpgrade(currentAlias: String): Boolean {
        return isKeyMissingAuthRequirementWhileLockScreenEnabled(currentAlias)
    }

    /**
     * 보안 다운그레이드 감지: 현재 alias의 키는 auth-required인데 잠금화면이 제거된 경우.
     * KiyoAutofillPlugin.syncAccountsFromReact에서 호출되며, true 반환 시 리셋 후 재동기화.
     */
    fun isSecurityDowngrade(currentAlias: String): Boolean {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)
        if (!keyStore.containsAlias(currentAlias)) return false
        // 잠금화면이 있으면 다운그레이드 아님
        if (isSecureLockScreenEnabled()) return false

        return try {
            val entry = keyStore.getEntry(currentAlias, null) as KeyStore.SecretKeyEntry
            val info = getKeyInfo(entry.secretKey)
            if (info.isUserAuthenticationRequired) {
                Log.w(TAG, "Security downgrade detected: master key requires auth but no secure lock screen")
            }
            info.isUserAuthenticationRequired
        } catch (e: Exception) {
            // auth-required 키가 무효화된 경우 getEntry/getKeySpec 실패 가능 → 다운그레이드로 간주
            Log.w(TAG, "Failed to inspect key during downgrade check (likely invalidated): ${e.message}")
            true
        }
    }

    private fun isKeyMissingAuthRequirementWhileLockScreenEnabled(currentAlias: String): Boolean {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)
        if (!keyStore.containsAlias(currentAlias)) return false
        // 잠금화면이 없으면 업그레이드 불가능/불필요
        if (!isSecureLockScreenEnabled()) return false

        return try {
            val entry = keyStore.getEntry(currentAlias, null) as KeyStore.SecretKeyEntry
            val info = getKeyInfo(entry.secretKey)
            val authRequired = info.isUserAuthenticationRequired
            if (!authRequired) {
                Log.w(TAG, "Master key does NOT require user authentication while secure lock screen is enabled - upgrade recommended")
            }
            !authRequired
        } catch (e: Exception) {
            Log.w(TAG, "Failed to inspect master key security properties: ${e.message}")
            false
        }
    }

    private fun getKeyInfo(key: SecretKey): android.security.keystore.KeyInfo {
        val factory = javax.crypto.SecretKeyFactory.getInstance(key.algorithm, KEYSTORE_PROVIDER)
        @Suppress("UNCHECKED_CAST")
        return factory.getKeySpec(key, android.security.keystore.KeyInfo::class.java) as android.security.keystore.KeyInfo
    }

    /**
     * Generate a new key under the given alias.
     * auth-required 여부는 현재 잠금화면 상태(isSecureLockScreenEnabled)로 판정.
     */
    private fun generateNewKey(keyStore: KeyStore, alias: String) {
        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
        val builder = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(KEY_SIZE)
        Log.d(TAG, "isSecureLockScreenEnabled()=${isSecureLockScreenEnabled()}")
        if (isSecureLockScreenEnabled()) {
            // 보안 잠금화면(PIN/패턴/생체인증)이 있을 때만 인증 요구 키 생성 가능.
            // 없는 상태에서 setUserAuthenticationRequired(true)를 호출하면
            // IllegalStateException: "Secure lock screen must be enabled..." 발생.
            //
            // 디버그 빌드에서는 인증 유효시간을 30초로 단축해
            // "인증 캐시 만료 → fill 시 프롬프트" 경로를 빠르게 재현/검증할 수 있게 한다.
            // 릴리스 빌드는 항상 30분 (프로덕션 보안 속성 불변).
            val authValiditySeconds = if (BuildConfig.DEBUG) 30 else 30 * 60
            builder.setUserAuthenticationRequired(true)
                .setUserAuthenticationParameters(
                    authValiditySeconds,
                    KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL
                )
            Log.d(TAG, "Master key generated WITH user authentication: alias=$alias, validity=${authValiditySeconds}s${if (BuildConfig.DEBUG) " (debug short)" else ""}")
        } else {
            Log.w(TAG, "No secure lock screen - generating master key WITHOUT auth requirement: alias=$alias")
        }

        keyGenerator.init(builder.build())
        keyGenerator.generateKey()
        Log.d(TAG, "New master key generated: alias=$alias")
    }

    /**
     * 보안 잠금화면(PIN/패턴/비밀번호 또는 강력한 생체인증) 등록 여부 확인.
     * setUserAuthenticationRequired(true) 키 생성의 전제 조건.
     * Context가 주입되지 않았으면 안전하게 false (auth 없이 키 생성).
     */
    private fun isSecureLockScreenEnabled(): Boolean {
        val km = appContext?.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        return km?.isDeviceSecure == true
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
     * Delete the key under the given alias from Keystore.
     */
    @SuppressLint("VisibleForTests")
    fun deleteKey(alias: String): Boolean {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)
        if (keyStore.containsAlias(alias)) {
            keyStore.deleteEntry(alias)
            Log.d(TAG, "Master key deleted from Keystore: alias=$alias")
            return true
        }
        return false
    }

    /**
     * Check if a key exists in Keystore under the given alias.
     */
    @SuppressLint("VisibleForTests")
    fun hasKey(alias: String): Boolean {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER)
        keyStore.load(null)
        return keyStore.containsAlias(alias)
    }
}
