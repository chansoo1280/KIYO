package com.kiyo.app.security

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.test.core.app.ApplicationProvider
import io.mockk.every
import io.mockk.mockkObject
import io.mockk.unmockkAll
import io.mockk.verify
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File
import javax.crypto.spec.SecretKeySpec

/**
 * DatabaseKeyManager 단위 테스트 (JVM/Robolectric).
 *
 * Mock boundary: mockkObject(KeystoreManager) + Robolectric context (실제 DataStore 파일 사용).
 * DataStore 상태 확인은 공개 API([DatabaseKeyManager.getCurrentAlias], [DatabaseKeyManager.hasKey],
 * [DatabaseKeyManager.deleteKey])를 통해 수행한다.
 *
 * 명시적 규칙 (plan): relaxed mock Context로 DB 파일 삭제를 단언하지 않는다 —
 * DB 파일 삭제 검증은 Robolectric real-path 테스트로 분리.
 *
 * 검증하지 않는 것: 실제 Android Keystore invalidation 발생 자체 (E2E 소관).
 */
@RunWith(RobolectricTestRunner::class)
class DatabaseKeyManagerTest {

    private lateinit var context: Context

    /** deleteKey 호출 시점에 새 alias 포인터+블롭이 이미 커밋돼 있었는지 (커밋→삭제 순서 검증) */
    private var newAliasCommittedAtDeleteTime: Boolean? = null

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        mockkObject(KeystoreManager)
        every { KeystoreManager.init(any()) } returns Unit
        newAliasCommittedAtDeleteTime = null
        // 깨끗한 DataStore 파일에서 시작 (테스트 간 포인터/블롭 잔존 방지)
        clearPrefsDirectly()
        // 보안 업그레이드 플래그는 object 공유 상태 → 이전 테스트 값 소비
        DatabaseKeyManager.wasSecurityUpgraded()
    }

    /** DataStore 파일을 직접 정리해 테스트 격리를 보장한다 */
    private fun clearPrefsDirectly() {
        val ds = dataStore()
        runBlocking {
            ds.edit { prefs -> prefs.asMap().keys.forEach { key -> prefs.remove(key) } }
        }
    }

    /**
     * DatabaseKeyManager.kt의 private top-level delegate(`securityDataStore`)에
     * 접근해 테스트에서 동일한 DataStore 인스턴스를 얻는다.
     */
    @Suppress("UNCHECKED_CAST")
    private fun dataStore(): DataStore<Preferences> {
        val field = Class.forName("com.kiyo.app.security.DatabaseKeyManagerKt")
            .getDeclaredField("securityDataStore\$delegate")
        field.isAccessible = true
        val delegate = field.get(null)
        val getValue = delegate.javaClass.methods.first { it.name == "getValue" }
        return getValue.invoke(delegate, context, this::markerProp) as DataStore<Preferences>
    }

    @Suppress("unused")
    private val markerProp: String = ""

    private suspend fun clearPrefs() = clearPrefsDirectly()

    @After
    fun tearDown() {
        unmockkAll()
    }

    // ---------- seed helpers ----------

    /** 레거시 무인덱스 키가 살아 있어 resolveCurrentAlias가 그것을 채택하는 시나리오 */
    private fun stubLegacyAdoption(enabled: Boolean) {
        every { KeystoreManager.hasKey(KeystoreManager.LEGACY_KEY_ALIAS) } returns enabled
    }

    /**
     * 블롭을 심고 current_alias 포인터도 함께 커밋한다.
     * decrypt가 모킹되므로 블롭 바이트는 임의 값으로 충분.
     */
    private suspend fun seedBlob(alias: String, plainBytes: ByteArray = ByteArray(32) { 7 }): String {
        val blob = EncryptedKey.toJson(EncryptedKey(ByteArray(12) { 1 }, plainBytes.copyOf()))
        seedRawBlob(blob)
        // 포인터 커밋: getKey()의 첫-사용 경로를 우회해 직접 설정하기 위해
        // legacy adoption + 빈 블롭 경로 대신, getCurrentAlias가 이 alias를 반환하도록
        // DataStore에 기록한다. public API로 포인터만 쓰는 길이 없으므로
        // getKey()의 "no blob" 경로를 이용한다 (alias 결정 + 포인터 커밋 후 블롭 생성까지 감).
        return blob
    }

    private suspend fun commitPointerViaFirstUsePath(aliasToResolve: String) {
        stubGetOrCreateKey()
        stubLegacyAdoption(aliasToResolve == KeystoreManager.LEGACY_KEY_ALIAS)
        if (aliasToResolve != KeystoreManager.LEGACY_KEY_ALIAS) {
            // 인덱스 alias 강제는 불가(기본 _1) → 레거시가 아닌 시드는 _1 포인터에서 시작해 재래핑으로 진행
            every { KeystoreManager.hasKey(any()) } answers {
                firstArg<String>() == KeystoreManager.LEGACY_KEY_ALIAS &&
                    aliasToResolve == KeystoreManager.LEGACY_KEY_ALIAS
            }
        }
        every { KeystoreManager.needsSecurityUpgrade(any()) } returns false
        every { KeystoreManager.encrypt(any(), any()) } returns EncryptedKey(ByteArray(12), ByteArray(48))
        DatabaseKeyManager.getKey(context) // 포인터 커밋 + 초기 블롭 생성
        runBlocking { DatabaseKeyManager.deleteKey(context) } // 블롭만 제거 (포인터 유지)
    }

    private suspend fun seedRawBlob(json: String) {
        // deleteKey 이후 getKey 재호출로 새 블롭을 만들 수 없으므로,
        // 테스트는 "포인터 확정 → 블롭 제거 → getKey 재진입" 흐름 대신
        // 아래 개별 시나리오에서 stub 구성으로 필요한 상태를 만든다.
    }

    private fun stubHappyDecrypt(plainBytes: ByteArray) {
        every { KeystoreManager.decrypt(any(), any()) } returns plainBytes
    }

    private fun stubGetOrCreateKey() {
        every { KeystoreManager.getOrCreateKey(any()) } answers {
            javax.crypto.spec.SecretKeySpec(firstArg<String>().toByteArray(), "AES")
        }
        // createKey: 재래핑 시 새 auth-required 키 생성 경로 (getOrCreateKey와 동일하게 모킹)
        every { KeystoreManager.createKey(any()) } answers {
            javax.crypto.spec.SecretKeySpec(firstArg<String>().toByteArray(), "AES")
        }
    }

    private fun stubHasKeys(vararg aliasesWithKeys: Pair<String, Boolean>) {
        every { KeystoreManager.hasKey(any()) } answers {
            aliasesWithKeys.firstOrNull { it.first == firstArg() }?.second ?: false
        }
    }

    /** deleteKey 모킹: 호출 시점에 새 alias 포인터+블롭이 이미 커밋됐는지 기록 */
    private fun stubDeleteKeyRecordingCommit(expectedNewAlias: String) {
        every { KeystoreManager.deleteKey(any()) } answers {
            val alias = firstArg<String>()
            if (alias.startsWith("kiyo_master_key_")) {
                val committed = runBlocking {
                    DatabaseKeyManager.getCurrentAlias(context) == expectedNewAlias &&
                        DatabaseKeyManager.hasKey(context)
                }
                if (expectedNewAlias.isNotEmpty()) newAliasCommittedAtDeleteTime = committed
            }
            alias.isNotEmpty()
        }
    }

    private fun stubNoUpgradeNeeded() {
        every { KeystoreManager.needsSecurityUpgrade(any()) } returns false
    }

    private fun stubUpgradeNeeded() {
        every { KeystoreManager.needsSecurityUpgrade(any()) } returns true
        // 재래핑 경로에서 createKey로 새 auth-required 키를 생성한다
        every { KeystoreManager.createKey(any()) } answers {
            javax.crypto.spec.SecretKeySpec(firstArg<String>().toByteArray(), "AES")
        }
    }

    // ---------- 1. nextAlias 규칙 (재래핑 경유 간접 검증) ----------

    @Test
    fun rewrapFromIndexedAlias_incrementsIndex(): Unit = runBlocking {
        // 초기 상태: _1 포인터 + 블롭 (첫 사용 경로로 커밋)
        val plain = ByteArray(32) { 9 }
        stubGetOrCreateKey()
        stubLegacyAdoption(false)
        stubNoUpgradeNeeded()
        every { KeystoreManager.encrypt(any(), any()) } returns EncryptedKey(ByteArray(12), ByteArray(48))
        DatabaseKeyManager.getKey(context) // alias=_1, 블롭 생성
        assertEquals("kiyo_master_key_1", DatabaseKeyManager.getCurrentAlias(context))
        assertTrue(DatabaseKeyManager.hasKey(context))

        // 업그레이드 트리거 → 재래핑
        stubHappyDecrypt(plain)
        stubUpgradeNeeded()
        stubDeleteKeyRecordingCommit("kiyo_master_key_2")

        val key = DatabaseKeyManager.getKey(context)

        assertEquals(SecretKeySpec(plain, "AES"), key)
        assertEquals("kiyo_master_key_2", DatabaseKeyManager.getCurrentAlias(context))
    }

    @Test
    fun rewrapFromLegacyAlias_usesIndexedAlias1(): Unit = runBlocking {
        val plain = ByteArray(32) { 9 }
        stubGetOrCreateKey()
        stubLegacyAdoption(true) // resolveCurrentAlias가 레거시 alias 채택
        stubNoUpgradeNeeded()
        every { KeystoreManager.encrypt(any(), any()) } returns EncryptedKey(ByteArray(12), ByteArray(48))
        DatabaseKeyManager.getKey(context)
        assertEquals(KeystoreManager.LEGACY_KEY_ALIAS, DatabaseKeyManager.getCurrentAlias(context))

        stubHappyDecrypt(plain)
        stubUpgradeNeeded()

        DatabaseKeyManager.getKey(context)

        assertEquals("kiyo_master_key_1", DatabaseKeyManager.getCurrentAlias(context))
    }

    // ---------- 2. 재래핑 원자성: 블롭+포인터 동시 커밋 후에만 구 alias 삭제 ----------

    @Test
    fun rewrapCommitsBlobAndPointerAtomically_beforeDeletingOldAlias(): Unit = runBlocking {
        val plain = ByteArray(32) { 9 }
        stubGetOrCreateKey()
        stubLegacyAdoption(false)
        stubNoUpgradeNeeded()
        every { KeystoreManager.encrypt(any(), any()) } returns EncryptedKey(ByteArray(12), ByteArray(48))
        DatabaseKeyManager.getKey(context)

        stubHappyDecrypt(plain)
        stubUpgradeNeeded()
        stubDeleteKeyRecordingCommit("kiyo_master_key_2")

        DatabaseKeyManager.getKey(context)

        // 최종 상태: 새 블롭 + 새 포인터가 함께 커밋됨
        assertTrue(DatabaseKeyManager.hasKey(context))
        assertEquals("kiyo_master_key_2", DatabaseKeyManager.getCurrentAlias(context))
        // 커밋 성공 이후에만 구 alias 삭제 호출
        assertEquals(true, newAliasCommittedAtDeleteTime)
        verify(exactly = 1) { KeystoreManager.deleteKey("kiyo_master_key_1") }
    }

    @Test
    fun rewrapFailure_preservesOldAliasAndBlob_noRollbackSideEffects(): Unit = runBlocking {
        val plain = ByteArray(32) { 9 }
        stubGetOrCreateKey()
        stubLegacyAdoption(false)
        stubNoUpgradeNeeded()
        every { KeystoreManager.encrypt(any(), any()) } returns EncryptedKey(ByteArray(12), ByteArray(48))
        DatabaseKeyManager.getKey(context)

        stubHappyDecrypt(plain)
        stubUpgradeNeeded()
        // 재암호화 실패 시 예외가 그대로 전파된다 (삼키면 사용자 인증 요청이 발화하지 않음)
        every { KeystoreManager.encrypt(any(), any()) } throws RuntimeException("keystore boom")

        val thrown = runCatching { DatabaseKeyManager.getKey(context) }.exceptionOrNull()

        // 예외 전파 검증: 재래핑 실패는 호출자(AutofillService/SyncManager)에게 반드시 전달되어야 한다
        assertTrue("rewrap failure must propagate", thrown is RuntimeException)

        // 구 상태 보존 + 업그레이드 플래그 미설정
        assertEquals("kiyo_master_key_1", DatabaseKeyManager.getCurrentAlias(context))
        assertTrue(DatabaseKeyManager.hasKey(context))
        assertFalse(DatabaseKeyManager.wasSecurityUpgraded())
        verify(exactly = 0) { KeystoreManager.deleteKey(any()) }
    }

    // ---------- 3. KPInvalidated: old-wrapping 미부활 + fresh 상태 즉시 커밋 ----------

    @Test
    fun kpInvalidated_resetsAndCommitsFreshState_neverReusesOldWrapping(): Unit = runBlocking {
        val plain = ByteArray(32) { 9 }
        stubGetOrCreateKey()
        stubLegacyAdoption(false)
        stubNoUpgradeNeeded()
        every { KeystoreManager.encrypt(any(), any()) } returns EncryptedKey(ByteArray(12), ByteArray(48))
        DatabaseKeyManager.getKey(context) // alias=_1 + 블롭

        stubHasKeys("kiyo_master_key_1" to true) // 남아 있는 최대 인덱스 → fresh alias=_2
        stubDeleteKeyRecordingCommit("kiyo_master_key_2")
        every { KeystoreManager.decrypt(any(), any()) }
            .throws(android.security.keystore.KeyPermanentlyInvalidatedException())

        val key = DatabaseKeyManager.getKey(context)

        // old-wrapping 미부활: decrypt 정확히 1회(예외 발생 1회), 재호출 없음
        verify(exactly = 1) { KeystoreManager.decrypt(any(), any()) }
        // 무효화된 마스터 키 삭제 실행
        verify(atLeast = 1) { KeystoreManager.deleteKey("kiyo_master_key_1") }
        // fresh wrapping 즉시 커밋 (포인터 + 블롭), 구 alias와 다른 인덱스
        assertEquals("kiyo_master_key_2", DatabaseKeyManager.getCurrentAlias(context))
        assertTrue(DatabaseKeyManager.hasKey(context))
        // 새 DB_KEY 반환 (리셋 전 키와 다름)
        assertNotEquals(SecretKeySpec(plain, "AES"), key)
    }

    // ---------- 4. AEADBadTagException: 동일 정책 ----------

    @Test
    fun aeadBadTag_resetsAndCommitsFreshState_neverReusesOldWrapping(): Unit = runBlocking {
        stubGetOrCreateKey()
        stubLegacyAdoption(false)
        stubNoUpgradeNeeded()
        every { KeystoreManager.encrypt(any(), any()) } returns EncryptedKey(ByteArray(12), ByteArray(48))
        DatabaseKeyManager.getKey(context)

        stubHasKeys("kiyo_master_key_1" to true)
        stubDeleteKeyRecordingCommit("kiyo_master_key_2")
        every { KeystoreManager.decrypt(any(), any()) }.throws(javax.crypto.AEADBadTagException())

        val key = DatabaseKeyManager.getKey(context)

        verify(exactly = 1) { KeystoreManager.decrypt(any(), any()) }
        assertEquals("kiyo_master_key_2", DatabaseKeyManager.getCurrentAlias(context))
        assertTrue(DatabaseKeyManager.hasKey(context))
        assertTrue(key is SecretKeySpec)
    }

    // ---------- 5. resetAutofillData — Robolectric real path ----------

    @Test
    fun resetRemovesMasterKeyBlobAndDbFile_thenKeyReturnsDifferentKey(): Unit = runBlocking {
        val knownPlain = ByteArray(32) { 42 }
        stubGetOrCreateKey()
        stubLegacyAdoption(false)
        stubNoUpgradeNeeded()
        stubHappyDecrypt(knownPlain)
        every { KeystoreManager.encrypt(any(), any()) } returns EncryptedKey(ByteArray(12), ByteArray(48))

        val keyBefore = DatabaseKeyManager.getKey(context)

        val dbFile: File = context.getDatabasePath("kiyo_autofill.db")
        dbFile.parentFile?.mkdirs()
        dbFile.writeText("pretend sqlcipher")
        assertTrue(dbFile.exists())
        assertTrue(DatabaseKeyManager.hasKey(context))

        stubDeleteKeyRecordingCommit("")
        val success = DatabaseKeyManager.resetAutofillData(context)

        assertTrue(success)
        assertFalse(dbFile.exists())   // SQLCipher DB 파일 삭제
        assertFalse(DatabaseKeyManager.hasKey(context)) // DataStore 블롭 제거 (포인터 유지)
        assertEquals(
            "kiyo_master_key_1",
            DatabaseKeyManager.getCurrentAlias(context),
        )
        verify(atLeast = 1) { KeystoreManager.deleteKey("kiyo_master_key_1") } // 마스터 키 삭제

        // 리셋 직후 getKey(): 이전 DB_KEY와 다른 새 키 반환 (복구 불가 증명)
        stubHappyDecrypt(knownPlain)
        val keyAfter = DatabaseKeyManager.getKey(context)
        assertNotEquals(keyBefore, keyAfter)
        assertTrue(keyAfter is SecretKeySpec)
    }

    // ---------- 6. isSecurityDowngrade 위임 및 예외 시 false ----------

    @Test
    fun isSecurityDowngrade_delegatesToKeystoreManager() {
        every { KeystoreManager.isSecurityDowngrade("alias-a") } returns true
        every { KeystoreManager.isSecurityDowngrade("alias-b") } returns false

        assertTrue(DatabaseKeyManager.isSecurityDowngrade("alias-a"))
        assertFalse(DatabaseKeyManager.isSecurityDowngrade("alias-b"))
    }

    @Test
    fun isSecurityDowngrade_returnsFalseOnException() {
        every { KeystoreManager.isSecurityDowngrade("boom") } throws RuntimeException("ks down")
        assertFalse(DatabaseKeyManager.isSecurityDowngrade("boom"))
    }
}
