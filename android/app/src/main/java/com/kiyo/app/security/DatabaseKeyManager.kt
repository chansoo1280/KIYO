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

/**
 * DB_KEY 래핑 관리자.
 *
 * v3 설계:
 * - **alias 포인터**: DataStore의 [CURRENT_ALIAS] preference가 현재 마스터 키 alias를 가리킨다.
 *   재래핑은 새 인덱스 alias(`kiyo_master_key_N`)를 만들고 포인터만 전환한다.
 * - **원자적 재래핑**: 복호화 → 신규 키 생성 → 재암호화 → (블롭+포인터 동시 커밋) → **커밋 성공 후** 구 alias 삭제.
 *   어느 단계에서든 실패하면 구 alias + 구 블롭 + 구 포인터가 모두 보존된다 (완전 롤백).
 * - **KPInvalidated = 살리지 않음**: auth-required 키가 PIN/생체 변경으로 무효화되면
 *   기존 wrapping을 복구하려 하지 않고, 파생 데이터(자동완성 DB) 리셋 + 새 상태 즉시 커밋으로 처리한다.
 */
object DatabaseKeyManager {

    private val TAG = "DatabaseKeyManager"
    private val DB_ENCRYPTED_KEY = stringPreferencesKey("db_encrypted_key")
    private val CURRENT_ALIAS = stringPreferencesKey("current_master_key_alias")
    private const val AUTO_FILL_DB_NAME = "kiyo_autofill.db"

    /** 인덱스 alias 접두사 (`kiyo_master_key_1`, `kiyo_master_key_2`, ...) */
    private const val INDEXED_ALIAS_PREFIX = "kiyo_master_key_"

    /** 마지막 getKey() 호출에서 보안 업그레이드(DB_KEY 재래핑)가 수행됐는지 (UI 안내용, 1회성) */
    @Volatile
    private var securityUpgraded = false

    /** 업그레이드 수행 여부 확인 후 플래그 소비 (1회성) */
    fun wasSecurityUpgraded(): Boolean {
        val value = securityUpgraded
        securityUpgraded = false
        return value
    }

    /**
     * DataStore에서 현재 마스터 키 alias를 읽는다. 없으면 마이그레이션 규칙으로 결정한다:
     * - 레거시 `kiyo_master_key`가 Keystore에 있으면 그것을 첫 current_alias로 사용 (강제 rename 없음)
     * - 없으면 첫 인덱스 alias `_1`을 반환 (첫 생성 시 사용)
     *
     * 주의: 이 함수는 preference를 커밋하지 않는다 (읽기 전용).
     * 커밋은 getKey()/재래핑 흐름에서 실제 사용 시점에 이루어진다.
     */
    private suspend fun resolveCurrentAlias(prefs: Preferences): String {
        prefs[CURRENT_ALIAS]?.let { return it }
        // 기존 기기 마이그레이션: 레거시 무인덱스 키가 살아 있으면 그대로 current_alias로 사용
        if (KeystoreManager.hasKey(KeystoreManager.LEGACY_KEY_ALIAS)) {
            Log.d(TAG, "No current alias preference - adopting legacy alias '${KeystoreManager.LEGACY_KEY_ALIAS}' as current")
            return KeystoreManager.LEGACY_KEY_ALIAS
        }
        Log.d(TAG, "No current alias preference and no legacy key - defaulting to ${INDEXED_ALIAS_PREFIX}1")
        return "${INDEXED_ALIAS_PREFIX}1"
    }

    /** 다음 인덱스 alias 결정: 현재가 인덱스면 N+1, 아니면(레거시/미지정) 1부터 */
    private fun nextAlias(currentAlias: String): String {
        val nextIndex = if (currentAlias.startsWith(INDEXED_ALIAS_PREFIX)) {
            currentAlias.removePrefix(INDEXED_ALIAS_PREFIX).toIntOrNull()?.plus(1) ?: 1
        } else 1
        return "$INDEXED_ALIAS_PREFIX$nextIndex"
    }

    /**
     * Get the SQLCipher database encryption key.
     * - First call: generates new key, encrypts with Keystore master key, stores in DataStore
     * - Subsequent calls: reads encrypted key from DataStore, decrypts with current master key
     * - Security upgrade: 잠금화면이 새로 설정되어 현재 키가 auth-required가 아니면
     *   원자적으로 재래핑한다 (새 alias + 포인터 전환 + 커밋 후 구 alias 삭제).
     */
    suspend fun getKey(context: Context): SecretKey {
        val prefs = context.securityDataStore.data.first()
        val json = prefs[DB_ENCRYPTED_KEY]

        // Keystore 키 생성 시 보안 잠금화면 여부 확인을 위한 Context 주입
        KeystoreManager.init(context)

        if (json == null) {
            Log.d(TAG, "No DB_KEY found, generating and storing new key")
            val alias = resolveCurrentAlias(prefs)
            // 첫 사용 시점에 포인터를 커밋해 이후 읽기 경로를 일관되게 만든다
            context.securityDataStore.edit { it[CURRENT_ALIAS] = alias }
            val masterKey = KeystoreManager.getOrCreateKey(alias)
            return generateAndStoreKey(context, alias, masterKey)
        }

        val currentAlias = resolveCurrentAlias(prefs)

        // 보안 업그레이드: 잠금화면이 생겼는데 현재 키는 auth-required가 아닌 경우
        if (KeystoreManager.needsSecurityUpgrade(currentAlias)) {
            try {
                val rewrapped = rewrapDbKey(context, currentAlias, json)
                securityUpgraded = true
                return rewrapped
            } catch (e: Exception) {
                Log.e(TAG, "Security upgrade failed, falling back to normal flow: ${e.message}", e)
                // 실패 시 구 alias + 구 블롭 보존 상태로 정상 읽기 흐름 진행 (완전 롤백)
            }
        }

        val masterKey = KeystoreManager.getOrCreateKey(currentAlias)

        Log.d(TAG, "Reading existing encrypted DB_KEY from DataStore (alias=$currentAlias)")
        val encrypted = EncryptedKey.fromJson(json)
        return try {
            val plainBytes = KeystoreManager.decrypt(masterKey, encrypted)
            Log.d(TAG, "DB_KEY decrypted successfully")
            SecretKeySpec(plainBytes, "AES")
        } catch (e: android.security.keystore.KeyPermanentlyInvalidatedException) {
            // auth-required 키가 PIN/생체 등록 변경으로 시스템 무효화됨.
            // 파생 데이터 복구를 시도하지 않는다: 리셋 → 새 wrapping 즉시 커밋 → sync로 재구축.
            Log.w(TAG, "Master key permanently invalidated (PIN/biometric changed). Resetting autofill state")
            resetAutofillData(context)
            Log.w(TAG, "Generating fresh DB_KEY after reset (autofill DB will be rebuilt on next sync)")
            generateFreshStateAfterReset(context)
        } catch (e: javax.crypto.AEADBadTagException) {
            // GCM 태그 검증 실패 = 현재 마스터 키가 이 블롭을 암호화한 키와 다름.
            // 예상치 못한 상태의 최후 복구: 리셋 후 재동기화 (공격적 리셋 지양 원칙상 로그 관찰 필요).
            Log.w(TAG, "DB_KEY decryption failed with AEADBadTagException - master key no longer matches. Resetting autofill state")
            resetAutofillData(context)
            Log.w(TAG, "Generating fresh DB_KEY after reset (autofill DB will be rebuilt on next sync)")
            generateFreshStateAfterReset(context)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to decrypt DB_KEY: ${e.message}", e)
            throw e
        }
    }

    /**
     * 원자적 재래핑: 현재 alias 키로 복호화 → 다음 인덱스 alias로 새 auth-required 키 생성 →
     * 재암호화 → (새 블롭 + 새 alias 포인터) 동시 커밋 → 커밋 성공 후 구 alias 삭제.
     * 중간 실패 시 구 alias + 구 블롭 + 구 포인터 모두 보존.
     */
    private suspend fun rewrapDbKey(context: Context, currentAlias: String, json: String): SecretKey {
        Log.w(TAG, "Security upgrade needed: re-wrapping DB_KEY ($currentAlias → next index)")
        val oldMasterKey = KeystoreManager.getOrCreateKey(currentAlias)
        val plainBytes = KeystoreManager.decrypt(oldMasterKey, EncryptedKey.fromJson(json))

        val newAlias = nextAlias(currentAlias)
        val newMasterKey = KeystoreManager.getOrCreateKey(newAlias)
        val reEncrypted = KeystoreManager.encrypt(newMasterKey, plainBytes)

        context.securityDataStore.edit { preferences ->
            preferences[DB_ENCRYPTED_KEY] = EncryptedKey.toJson(reEncrypted)
            preferences[CURRENT_ALIAS] = newAlias
        }
        Log.w(TAG, "DB_KEY re-wrapped with upgraded master key ($currentAlias → $newAlias)")

        // 커밋 성공 확정 후 구 alias 삭제 (레거시 alias와 동일하면 스킵)
        if (newAlias != currentAlias) {
            try {
                KeystoreManager.deleteKey(currentAlias)
            } catch (e: Exception) {
                // 구 alias 삭제 실패는 치명적이지 않다 (다음 재래핑에서 정리 대상)
                Log.w(TAG, "Failed to delete old master key '$currentAlias': ${e.message}")
            }
        }
        return SecretKeySpec(plainBytes, "AES")
    }

    /** 리셋 직후 새 상태(포인터 + DB_KEY + wrapping)를 즉시 커밋한다. 커밋 누락 시 매 요청마다 리셋 반복. */
    private suspend fun generateFreshStateAfterReset(context: Context): SecretKey {
        val freshAlias = "${INDEXED_ALIAS_PREFIX}${nextIndexAfterReset()}"
        context.securityDataStore.edit { it[CURRENT_ALIAS] = freshAlias }
        val masterKey = KeystoreManager.getOrCreateKey(freshAlias)
        return generateAndStoreKey(context, freshAlias, masterKey)
    }

    /** 리셋 후 사용 가능한 다음 인덱스: Keystore에 남아 있는 최대 인덱스 + 1 */
    private fun nextIndexAfterReset(): Int {
        var max = 0
        for (i in 1..64) { // 합리적 상한 — 실제 재래핑 빈도에서 도달 불가능한 값
            if (KeystoreManager.hasKey("$INDEXED_ALIAS_PREFIX$i")) max = i
        }
        return max + 1
    }

    /**
     * Generate a new DB_KEY, encrypt with the given master key, and store in DataStore.
     */
    private suspend fun generateAndStoreKey(context: Context, alias: String, masterKey: SecretKey): SecretKey {
        val newKey = DatabaseKeyGenerator.generate()
        val encrypted = KeystoreManager.encrypt(masterKey, newKey.encoded)
        val jsonOut = EncryptedKey.toJson(encrypted)

        context.securityDataStore.edit { preferences ->
            preferences[DB_ENCRYPTED_KEY] = jsonOut
        }

        Log.d(TAG, "New DB_KEY generated and stored encrypted (master alias=$alias)")
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
     * 자동완성 보안 상태 전체 리셋: 현재 마스터 키 + DB_KEY + SQLCipher DB 파일 삭제.
     * KPInvalidated(PIN/생체 변경)와 보안 다운그레이드(잠금화면 제거) 모두 이 정책을 공유한다.
     * 자동완성 DB는 React 볼트의 파생 데이터이므로 다음 동기화에서 재구축 가능.
     * @return true if reset succeeded
     */
    suspend fun resetAutofillData(context: Context): Boolean {
        Log.w(TAG, "Resetting autofill security state")
        val prefs = context.securityDataStore.data.first()

        var success = true

        // 1. 현재 마스터 키 삭제 (무효화된 키)
        val currentAlias = resolveCurrentAlias(prefs)
        try {
            if (KeystoreManager.deleteKey(currentAlias)) {
                Log.d(TAG, "Invalidated master key deleted: alias=$currentAlias")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete master key", e)
            success = false
        }

        // 2. DataStore의 암호화된 DB_KEY 삭제 (포인터는 유지 — 리셋 후 새 상태 커밋 시 갱신)
        try {
            deleteKey(context)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete DB_KEY from DataStore", e)
            success = false
        }

        // 3. SQLCipher DB 파일 삭제 (다음 동기화에서 재생성)
        try {
            val dbFile = context.getDatabasePath(AUTO_FILL_DB_NAME)
            if (dbFile.exists() && !dbFile.delete()) {
                Log.w(TAG, "Failed to delete SQLCipher database file")
                success = false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to delete SQLCipher database file", e)
            success = false
        }

        return success
    }

    /** 보안 다운그레이드 상태 확인 (현재 alias 기준, KeystoreManager 위임) */
    fun isSecurityDowngrade(currentAlias: String): Boolean {
        return try {
            KeystoreManager.isSecurityDowngrade(currentAlias)
        } catch (e: Exception) {
            Log.w(TAG, "Downgrade check failed: ${e.message}")
            false
        }
    }

    /** 현재 마스터 키 alias 조회 (다운그레이드 체크 등 외부 호출용) */
    suspend fun getCurrentAlias(context: Context): String {
        KeystoreManager.init(context)
        val prefs = context.securityDataStore.data.first()
        return resolveCurrentAlias(prefs)
    }

    /**
     * Check if encrypted DB_KEY exists in DataStore.
     */
    suspend fun hasKey(context: Context): Boolean {
        val prefs = context.securityDataStore.data.first()
        return prefs[DB_ENCRYPTED_KEY] != null
    }
}
