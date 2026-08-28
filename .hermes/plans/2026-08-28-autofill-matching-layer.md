# Plan: Autofill Matching Layer — Independent Index DB (Keystore Non-Auth Key) & Registration Form Suppression

**Date:** 2026-08-28 (Revised v3 — Complete Separation)  
**Branch:** `feature/autofill-reliability`  
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도  
**Depends on:** `2026-08-24-autofill-field-detection.md`, `2026-08-24-autofill-domain-matching.md`

---

## Core Principle

**기존 `kiyo_autofill.db` (메인 자동완성 DB)는 절대 건드리지 않음.**
- 스키마 변경 없음
- FK 없음
- 캐스케이드 없음
- 공유 트랜잭션 없음
- 별도 파일, 별도 키, 별도 라이프사이클

인덱스 DB(`kiyo_autofill_index.db`)는 **완전 독립된 별도 DB**로, 메인 DB와는 동기화 시점에만 논리적으로 연관됨.

---

## Goal

**로그인 폼이 아닌 페이지에서 자동완성 드롭다운이 뜨는 것을 원천 차단**하기 위해 두 가지 메커니즘을 구현:

1. **독립된 인덱스 DB (`kiyo_autofill_index.db`)** — `kiyo_index_key`(비인증 키)로 암호화, 메인 DB와 완전히 분리된 별도 파일
2. **회원가입 폼 판별 및 억제** — `new-password`만 존재하는 폼에서 데이터셋 응답 억제 (SaveInfo만 또는 응답 안 함)

---

## Architecture: Complete Separation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXISTING (UNCHANGED)                                 │
│  kiyo_autofill.db (SQLCipher, DB_KEY)                                        │
│  └─ autofill_accounts 테이블                                                 │
│     - id, username, password, title, app_name, domain, package_names...     │
│     - 기존 코드 그대로 사용, 어떤 변경도 없음                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │  (런타임 의존성 없음)
                                    │   동기화 시점에만 논리적 연관
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEW: INDEPENDENT INDEX DB                            │
│  kiyo_autofill_index.db (SQLCipher, INDEX_KEY)                              │
│  └─ autofill_index 테이블                                                    │
│     - _id INTEGER PRIMARY KEY                                                │
│     - account_id INTEGER  ← 메인 DB id 참조용 (FK 아님, 단순 정수 컬럼)       │
│     - domain_encrypted TEXT                                                  │
│     - package_names_encrypted TEXT                                           │
│     - updated_at INTEGER                                                     │
│     - UNIQUE(account_id)  ← 중복 방지용 유니크 인덱스                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌─────────────────────┐         ┌─────────────────────┐
        │ DB_KEY (32-byte)    │         │ INDEX_KEY (32-byte) │
        │ - auth-required     │         │ - NON auth-required │
        │ - 사용자 인증 필요  │         │ - 사용자 인증 불필요 │
        │ - 자격증명 보호     │         │ - 1차 필터링용      │
        └─────────────────────┘         └─────────────────────┘
                    │                               │
                    ▼                               ▼
        ┌─────────────────────┐         ┌─────────────────────┐
        │ kiyo_master_key_N   │         │ kiyo_index_key      │
        │ (인증 필요)          │         │ (인증 불필요)        │
        └─────────────────────┘         └─────────────────────┘
```

---

## Changes

### 1. KeystoreManager — 인덱스 키 전용 메서드 추가

**File:** `android/app/src/main/java/com/kiyo/app/security/KeystoreManager.kt`

```kotlin
object KeystoreManager {
    // 기존 키들...
    const val INDEX_KEY_ALIAS = "kiyo_index_key"  // 비인증 키
    
    /** 인덱스용 비인증 키 생성/조회 (사용자 인증 불필요) */
    fun getOrCreateIndexKey(): SecretKey {
        return getOrCreateKey(INDEX_KEY_ALIAS, requireAuth = false)
    }
    
    /** 인덱스 키로 암호화 (AES-GCM) */
    fun encryptForIndex(plainText: String): EncryptedIndexValue {
        val key = getOrCreateIndexKey()
        return encrypt(key, plainText.toByteArray(Charsets.UTF_8))
    }
    
    /** 인덱스 키로 복호화 */
    fun decryptFromIndex(encrypted: EncryptedIndexValue): String {
        val key = getOrCreateIndexKey()
        return decrypt(key, encrypted).toString(Charsets.UTF_8)
    }
    
    data class EncryptedIndexValue(
        val iv: ByteArray,
        val ciphertext: ByteArray
    ) {
        fun toBase64(): String = Base64.encodeToString(iv + ciphertext, Base64.NO_WRAP)
        companion object {
            fun fromBase64(str: String): EncryptedIndexValue {
                val bytes = Base64.decode(str, Base64.NO_WRAP)
                val iv = bytes.copyOfRange(0, 12)
                val ciphertext = bytes.copyOfRange(12, bytes.size)
                return EncryptedIndexValue(iv, ciphertext)
            }
        }
    }
}
```

### 2. 독립된 인덱스 DB 헬퍼 — `AutofillIndexDatabaseHelper` (신규 파일)

**File:** `android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillIndexDatabaseHelper.kt`

```kotlin
package com.kiyo.app.autofill.repository

import android.content.Context
import android.util.Log
import net.zetetic.database.sqlcipher.SQLiteDatabase

/**
 * 독립된 인덱스용 SQLCipher DB 헬퍼.
 * - 메인 DB(kiyo_autofill.db)와 완전히 분리된 별도 파일
 * - INDEX_KEY(비인증 키)로 암호화 → 사용자 인증 없이 접근 가능
 * - 메인 DB 스키마/데이터/트랜잭션과 무관
 */
class AutofillIndexDatabaseHelper(
    private val context: Context,
    private val encryptionKey: ByteArray  // INDEX_KEY 평문
) {

    companion object {
        private const val DATABASE_NAME = "kiyo_autofill_index.db"
        private const val DATABASE_VERSION = 1
        private const val TAG = "AutofillIndexDatabaseHelper"

        const val TABLE_INDEX = "autofill_index"
        const val COLUMN_ID = "_id"
        const val COLUMN_ACCOUNT_ID = "account_id"           // 메인 DB id 참조용 (FK 아님)
        const val COLUMN_DOMAIN_ENCRYPTED = "domain_encrypted"
        const val COLUMN_PACKAGE_NAMES_ENCRYPTED = "package_names_encrypted"
        const val COLUMN_UPDATED_AT = "updated_at"
    }

    private var database: SQLiteDatabase? = null

    fun getReadableDatabase(): SQLiteDatabase = getDatabase(SQLiteDatabase.OPEN_READONLY)
    fun getWritableDatabase(): SQLiteDatabase = getDatabase(SQLiteDatabase.OPEN_READWRITE)

    private fun getDatabase(flags: Int): SQLiteDatabase {
        val db = database
        if (db != null && db.isOpen) return db

        val dbFile = context.getDatabasePath(DATABASE_NAME)
        dbFile.parentFile?.mkdirs()

        val newDb = SQLiteDatabase.openOrCreateDatabase(dbFile, encryptionKey, null, null)
        database = newDb

        val cursor = newDb.rawQuery("PRAGMA user_version", null)
        var version = 0
        if (cursor.moveToFirst()) version = cursor.getInt(0)
        cursor.close()

        when {
            version == 0 -> {
                onCreate(newDb)
                newDb.execSQL("PRAGMA user_version = $DATABASE_VERSION")
            }
            version < DATABASE_VERSION -> {
                onUpgrade(newDb, version, DATABASE_VERSION)
                newDb.execSQL("PRAGMA user_version = $DATABASE_VERSION")
            }
        }
        return newDb
    }

    fun close() {
        database?.close()
        database = null
    }

    private fun onCreate(db: SQLiteDatabase) {
        val createTableSql = """
            CREATE TABLE $TABLE_INDEX (
                $COLUMN_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COLUMN_ACCOUNT_ID INTEGER NOT NULL,
                $COLUMN_DOMAIN_ENCRYPTED TEXT NOT NULL,
                $COLUMN_PACKAGE_NAMES_ENCRYPTED TEXT NOT NULL,
                $COLUMN_UPDATED_AT INTEGER NOT NULL,
                UNIQUE($COLUMN_ACCOUNT_ID)
            )
        """.trimIndent()

        db.execSQL(createTableSql)
        Log.d(TAG, "Independent index database created (encrypted with INDEX_KEY)")
    }

    private fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        Log.w(TAG, "Upgrading index database from $oldVersion to $newVersion")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_INDEX")
        onCreate(db)
    }
}
```

### 3. DatabaseKeyManager — INDEX_KEY 제공 메서드 추가

**File:** `android/app/src/main/java/com/kiyo/app/security/DatabaseKeyManager.kt`

```kotlin
object DatabaseKeyManager {
    // ... 기존 코드 그대로 유지 ...

    /** 인덱스 DB용 INDEX_KEY 획득 (비인증 키, 사용자 인증 불필요) */
    suspend fun getIndexKey(context: Context): SecretKey {
        KeystoreManager.init(context)
        return KeystoreManager.getOrCreateIndexKey()
    }
}
```

### 4. AutofillRepository — 인덱스 헬퍼 주입받아 독립적 연동 (메인 DB 로직 변경 없음)

**File:** `android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillRepository.kt`

```kotlin
class AutofillRepository internal constructor(
    private val context: Context,
    private val dbHelper: AutofillDatabaseHelper,           // 기존 메인 DB 헬퍼 (변경 없음)
    private val indexDbHelper: AutofillIndexDatabaseHelper  // 신규: 인덱스 DB 헬퍼 (선택적 주입)
) {
    // ... 기존 모든 메서드 그대로 유지 (insertAccount, upsertAccount, deleteAccount, 
    //      findMatchingAccounts, getAllAccounts, syncAccountsFromReact 등) ...
    
    // 신규: 인덱스 전용 메서드들 (메인 DB 로직과 완전 분리)
    
    /** 인덱스 테이블 동기화 (별도 트랜잭션, 메인 DB와 무관) */
    fun syncIndexTable(accountId: Long, account: AutofillAccount) {
        executor.submit {
            val indexDb = indexDbHelper.getWritableDatabase()  // 별도 DB, 별도 트랜잭션
            val domainEnc = KeystoreManager.encryptForIndex(account.domain ?: "").toBase64()
            val pkgEnc = KeystoreManager.encryptForIndex(account.packageNamesToJson() ?: "[]").toBase64()
            
            val values = ContentValues().apply {
                put(AutofillIndexDatabaseHelper.COLUMN_ACCOUNT_ID, accountId)
                put(AutofillIndexDatabaseHelper.COLUMN_DOMAIN_ENCRYPTED, domainEnc)
                put(AutofillIndexDatabaseHelper.COLUMN_PACKAGE_NAMES_ENCRYPTED, pkgEnc)
                put(AutofillIndexDatabaseHelper.COLUMN_UPDATED_AT, System.currentTimeMillis())
            }
            
            // UNIQUE(account_id)로 upsert 패턴
            indexDb.insertWithOnConflict(
                AutofillIndexDatabaseHelper.TABLE_INDEX,
                null,
                values,
                SQLiteDatabase.CONFLICT_REPLACE
            )
        }.get()
    }

    /** 인덱스 테이블에서 계정 ID 삭제 (메인 DB 삭제와 별도 호출) */
    fun deleteIndexEntry(accountId: Long) {
        executor.submit {
            indexDbHelper.getWritableDatabase().delete(
                AutofillIndexDatabaseHelper.TABLE_INDEX,
                "account_id = ?",
                arrayOf(accountId.toString())
            )
        }.get()
    }

    /** 인덱스 테이블 전체 재구축 (Sync 시 호출) */
    fun rebuildIndexTable(accounts: List<AutofillAccount>) {
        executor.submit {
            val indexDb = indexDbHelper.getWritableDatabase()
            indexDb.beginTransaction()
            try {
                indexDb.delete(AutofillIndexDatabaseHelper.TABLE_INDEX, null, null)
                for (account in accounts) {
                    val domainEnc = KeystoreManager.encryptForIndex(account.domain ?: "").toBase64()
                    val pkgEnc = KeystoreManager.encryptForIndex(account.packageNamesToJson() ?: "[]").toBase64()
                    val values = ContentValues().apply {
                        put(AutofillIndexDatabaseHelper.COLUMN_ACCOUNT_ID, account.id)
                        put(AutofillIndexDatabaseHelper.COLUMN_DOMAIN_ENCRYPTED, domainEnc)
                        put(AutofillIndexDatabaseHelper.COLUMN_PACKAGE_NAMES_ENCRYPTED, pkgEnc)
                        put(AutofillIndexDatabaseHelper.COLUMN_UPDATED_AT, System.currentTimeMillis())
                    }
                    indexDb.insert(AutofillIndexDatabaseHelper.TABLE_INDEX, null, values)
                }
                indexDb.setTransactionSuccessful()
            } finally {
                indexDb.endTransaction()
            }
        }.get()
    }

    /** 1차 필터링: 인덱스 DB에서 도메인/패키지 매칭 (메인 DB_KEY 불필요, 인증 불필요) */
    fun findMatchingAccountIdsByIndex(domain: String?, packageNames: List<String>): List<Long> {
        return executor.submit {
            val indexDb = indexDbHelper.getReadableDatabase()  // INDEX_KEY만 필요, 메인 DB 안 건드림
            val cursor = indexDb.query(
                AutofillIndexDatabaseHelper.TABLE_INDEX,
                arrayOf(
                    AutofillIndexDatabaseHelper.COLUMN_ACCOUNT_ID,
                    AutofillIndexDatabaseHelper.COLUMN_DOMAIN_ENCRYPTED,
                    AutofillIndexDatabaseHelper.COLUMN_PACKAGE_NAMES_ENCRYPTED
                ),
                null, null, null, null, null
            )

            val matchingIds = mutableListOf<Long>()
            cursor.use { c ->
                while (c.moveToNext()) {
                    val accountId = c.getLong(c.getColumnIndexOrThrow(AutofillIndexDatabaseHelper.COLUMN_ACCOUNT_ID))
                    val domainEnc = c.getString(c.getColumnIndexOrThrow(AutofillIndexDatabaseHelper.COLUMN_DOMAIN_ENCRYPTED))
                    val pkgEnc = c.getString(c.getColumnIndexOrThrow(AutofillIndexDatabaseHelper.COLUMN_PACKAGE_NAMES_ENCRYPTED))

                    // 인덱스 키로 복호화 (인증 불필요, Keystore 비인증 키 사용)
                    val decDomain = KeystoreManager.decryptFromIndex(KeystoreManager.EncryptedIndexValue.fromBase64(domainEnc))
                    val decPkg = KeystoreManager.decryptFromIndex(KeystoreManager.EncryptedIndexValue.fromBase64(pkgEnc))

                    // 매칭 판별 (DomainMatcher 위임)
                    if (domainMatcher.matchesDomain(decDomain, domain) ||
                        domainMatcher.matchesPackage(decPkg, packageNames)) {
                        matchingIds.add(accountId)
                    }
                }
            }
            matchingIds
        }.get()
    }

    /** 2단계: 매칭된 ID들로 전체 계정 조회 (메인 DB, 기존 로직 그대로 사용) */
    fun getAccountsByIds(ids: List<Long>): List<AutofillAccount> {
        if (ids.isEmpty()) return emptyList()
        // 기존 getAccountById 또는 findByIds 로직 재사용 — 메인 DB만 접근
        return executor.submit {
            val db = dbHelper.getReadableDatabase()  // 기존 메인 DB 헬퍼 사용
            val placeholders = ids.map { "?" }.joinToString(",")
            val cursor = db.rawQuery(
                "SELECT * FROM ${AutofillDatabaseHelper.TABLE_ACCOUNTS} WHERE ${AutofillDatabaseHelper.COLUMN_ID} IN ($placeholders)",
                ids.map { it.toString() }.toTypedArray()
            )
            val results = mutableListOf<AutofillAccount>()
            cursor.use { c ->
                while (c.moveToNext()) {
                    results.add(accountMapper.fromCursor(c))
                }
            }
            results
        }.get()
    }
    
    // close()에 인덱스 헬퍼 close 추가
    override fun close() {
        dbHelper.close()
        indexDbHelper.close()  // 별도 close
        executor.shutdown()
        // ... 기존 shutdown 로직 ...
    }
}
```

> **중요**: `AutofillRepository` 생성자 시그니처 변경 시 기존 호출부(`KiyoAutofillPlugin`, `AuthRequestHandler` 등)도 함께 수정 필요. 하지만 **메인 DB 로직(`findMatchingAccounts`, `syncAccountsFromReact` 등)은 일절 변경하지 않음**.

### 5. DomainMatcher — 평문 매칭 로직 (인덱스 복호화 후 사용)

**File:** `android/app/src/main/java/com/kiyo/app/autofill/repository/DomainMatcher.kt`

```kotlin
// 기존 매칭 로직 유지, 평문 문자열 받아서 처리
fun matchesDomain(storedDomain: String, queryDomain: String?): Boolean {
    if (queryDomain == null || queryDomain.isBlank()) return false
    val normalizedStored = normalizeDomain(storedDomain)
    val normalizedQuery = normalizeDomain(queryDomain)
    return normalizedStored == normalizedQuery ||
           isSubdomainMatch(normalizedStored, normalizedQuery) ||
           isWildcardMatch(normalizedStored, normalizedQuery)
}

fun matchesPackage(storedPkgJson: String, queryPackages: List<String>): Boolean {
    if (queryPackages.isEmpty()) return false
    val storedPackages = try { JSONArray(storedPkgJson).toList() } catch (e: Exception) { emptyList() }
    return queryPackages.any { qpkg ->
        storedPackages.any { spkg ->
            spkg == qpkg || spkg.startsWith(qpkg + ".")
        }
    }
}
```

### 6. FormClassifier — 회원가입 폼 판별 (신규 파일)

**File:** `android/app/src/main/java/com/kiyo/app/autofill/detection/FormClassifier.kt`

```kotlin
package com.kiyo.app.autofill.detection

import android.app.assist.AssistStructure
import com.kiyo.app.autofill.viewnode.HtmlAttributeExtractor
import com.kiyo.app.autofill.detection.FieldScoringRules

object FormClassifier {

    /** 화면이 회원가입/비번변경 폼인지 판별 (autocomplete 기반) */
    fun isRegistrationForm(rootNode: AssistStructure.ViewNode): Boolean {
        var hasCurrentPassword = false
        var hasNewPassword = false

        traverse(rootNode) { node ->
            val autocomplete = HtmlAttributeExtractor.getHtmlAutocomplete(node)?.lowercase() ?: ""
            if (autocomplete.contains("current-password")) hasCurrentPassword = true
            if (autocomplete.contains("new-password")) hasNewPassword = true
        }

        return hasNewPassword && !hasCurrentPassword
    }

    /** 화면에 어떤 비밀번호 필드든 존재하는지 확인 */
    fun hasAnyPasswordField(rootNode: AssistStructure.ViewNode): Boolean {
        return traverseAndCheck { node ->
            val autocomplete = HtmlAttributeExtractor.getHtmlAutocomplete(node)?.lowercase() ?: ""
            val inputType = HtmlAttributeExtractor.getHtmlInputType(node)?.lowercase() ?: ""
            autocomplete.contains("password") || inputType == "password" ||
            FieldScoringRules.isPasswordVariation(node.inputType ?: 0)
        }
    }

    private fun traverse(node: AssistStructure.ViewNode, action: (AssistStructure.ViewNode) -> Unit) {
        action(node)
        for (i in 0 until node.childCount) {
            traverse(node.getChildAt(i), action)
        }
    }

    private fun traverseAndCheck(node: AssistStructure.ViewNode, check: (AssistStructure.ViewNode) -> Boolean): Boolean {
        if (check(node)) return true
        for (i in 0 until node.childCount) {
            if (traverseAndCheck(node.getChildAt(i), check)) return true
        }
        return false
    }
}
```

### 7. FillResponseBuilder — 응답 분기

**File:** `android/app/src/main/java/com/kiyo/app/autofill/response/FillResponseBuilder.kt`

```kotlin
fun createFillResponse(
    accounts: List<AutofillAccount>,
    usernameId: AutofillId,
    passwordId: AutofillId,
    isRegistrationForm: Boolean = false
): FillResponse {
    if (isRegistrationForm) {
        return createSaveInfoResponse(usernameId, passwordId)
    }
    return createDatasetResponse(accounts, usernameId, passwordId)
}
```

### 8. AuthRequestHandler — 2단계 플로우 (메인 DB 로직 변경 없음)

**File:** `android/app/src/main/java/com/kiyo/app/autofill/service/AuthRequestHandler.kt`

```kotlin
fun handleFillRequest(request: FillRequest, callback: FillCallback) {
    // 1. ViewNode에서 domain/packageNames 추출
    val domain = ViewNodeExtractor.extractDomainFromStructure(request.structure)
    val packageNames = ViewNodeExtractor.extractPackageNames(request.structure)

    // 2. 회원가입 폼 판별 (DB 접근 전, 인증 불필요)
    val isRegistrationForm = FormClassifier.isRegistrationForm(request.structure)

    // 3. 1차 필터링: 인덱스 DB에서 매칭 (INDEX_KEY만 필요, 인증 불필요, 메인 DB 안 건드림)
    val matchingIds = repository.findMatchingAccountIdsByIndex(domain, packageNames)

    if (matchingIds.isEmpty()) {
        // 매칭되는 계정 없음 → 드롭다운 안 뜸, 인증 프롬프트도 안 뜸
        callback.onSuccess(null)
        return
    }

    // 4. 매칭됨 → 전체 계정 정보 조회 (메인 DB, 기존 로직 그대로, DB_KEY 필요, 인증 프롬프트 발생 가능)
    val fullAccounts = try {
        repository.getAccountsByIds(matchingIds)  // 기존 메인 DB 조회 로직 재사용
    } catch (e: UserNotAuthenticatedException) {
        // 인증 필요 → auth dataset 반환
        callback.onSuccess(FillResponseBuilder.createAuthResponse())
        return
    }

    // 5. 필드 탐지
    val usernameId = FieldDetector.findBestFieldCandidate(request.structure, FieldScorer::calculateUsernameScore)
    val passwordId = FieldDetector.findBestFieldCandidate(request.structure, FieldScorer::calculatePasswordScore)

    // 6. 응답 생성 (회원가입 폼이면 SaveInfo)
    val response = FillResponseBuilder.createFillResponse(fullAccounts, usernameId, passwordId, isRegistrationForm)
    callback.onSuccess(response)
}
```

### 9. KiyoAutofillPlugin — Sync 시 인덱스 테이블 독립적 재구축

**File:** `android/app/src/main/java/com/kiyo/app/capacitor/KiyoAutofillPlugin.kt`

```kotlin
@PluginMethod
fun syncAccountsFromReact(call: PluginCall) {
    // ... 기존 메인 DB 동기화 로직 (변경 없음) ...
    val result = repository.syncAccountsFromReact(accountsJson)
    
    // 신규: 인덱스 테이블 별도 재구축 (별도 트랜잭션, 별도 DB)
    if (result.first > 0) {  // syncedCount > 0
        val allAccounts = repository.getAllAccounts()  // 기존 메서드 재사용
        repository.rebuildIndexTable(allAccounts)      // 신규: 인덱스 전용 재구축
    }
    
    call.resolve(mapOf("synced" to result.first, "errors" to result.second))
}
```

> **핵심**: 메인 DB sync 로직은 **일절 변경하지 않음**. 인덱스 재구축은 별도 메서드 호출로 독립적으로 수행.

---

## Tests

### Unit Tests (JVM)

| Test File | Scenarios |
|-----------|-----------|
| `KeystoreManagerTest` (추가) | `getOrCreateIndexKey` 비인증 키 생성, `encryptForIndex`/`decryptFromIndex` 라운드트립 |
| `AutofillIndexDatabaseHelperTest` (NEW) | 별도 DB 파일 생성, 스키마, 인덱스 테이블 CRUD, 메인 DB와 무관함 확인 |
| `AutofillRepositoryTest` (NEW) | `findMatchingAccountIdsByIndex`: 인덱스 키로 복호화하며 매칭, 메인 DB 헬퍼 호출 안 함 확인 |
| `DomainMatcherTest` (추가) | 평문 매칭 로직: 도메인/와일드카드/패키지 prefix 매칭 |
| `FormClassifierTest` (NEW) | `isRegistrationForm`: new-password만 true, current-password 있으면 false |
| `FillResponseBuilderTest` (추가) | `isRegistrationForm=true` → SaveInfo, `false` → 데이터셋 |

### Instrumentation Tests (E2E)

**File:** `AutofillE2ETest.kt` 신규 메서드

| 테스트 | 시나리오 | 기대 결과 |
|--------|----------|-----------|
| `autofillSuppressedOnRegistrationForm` | 회원가입 페이지(`new-password`만) 진입 → 자동완성 트리거 | 드롭다운 안 뜸 (또는 저장 다이얼로그만) |
| `autofillSuppressedOnNonMatchingDomain` | 저장된 도메인과 다른 사이트 진입 → 자동완성 트리거 | 인덱스 필터링으로 즉시 종료, 메인 DB 접근 안 함, 인증 프롬프트 없음 |
| `autofillWorksOnLoginForm` | 로그인 페이지(`current-password`) 진입 → 자동완성 트리거 | 정상 드롭다운 + 채우기 동작 |
| `autofillIndexDbIndependent` | 메인 DB 삭제/재생성 후 → 인덱스 DB 별도 존재 확인 | 인덱스 DB 파일 별도 생성, 메인 DB 스키마 변경 없음 |

---

## Risks & Mitigations

| 위험 | 영향 | 완화 |
|------|------|------|
| 인덱스 테이블 동기화 불일치 | 매칭 실패 또는 잘못된 매칭 | Sync 시 전체 재구축(`rebuildIndexTable`), 개별 CRUD 시 `syncIndexTable`/`deleteIndexEntry` 호출 |
| 인덱스 키(`kiyo_index_key`) 유출 | 어떤 사이트/앱 계정 저장됐는지 노출 | TEE 보호, 비인증 키지만 Keystore 밖 유출 불가, 자격증명은 별도 키로 보호 |
| 인덱스 전체 스캔 성능 | 계정 많을 때(100+) 느려짐 | 초기엔 계정 수 적음(~50), 추후 평문 해시 컬럼+인덱스 또는 FTS 도입 |
| 회원가입 폼 판별 오탐 | 로그인 폼인데 억제됨 | `autocomplete` 없을 땐 판별 안 함(기존 폴백 유지) |
| Repository 생성자 변경으로 기존 호출부 깨짐 | 컴파일 에러/런타임 에러 | 생성자 오버로딩 또는 팩토리 메서드로 하위 호환 유지 |

---

## Rollback

| 시나리오 | 롤백 액션 |
|----------|-----------|
| 인덱스 DB/키 버그 | `AutofillRepository.findMatchingAccountIdsByIndex` 미사용 플래그, 기존 `findMatchingAccounts` 경로로 폴백 |
| 회원가입 폼 억제 과도 | `FormClassifier.isRegistrationForm` 기본 반환 `false`로 변경 |
| 별도 DB 파일 문제 | `AutofillIndexDatabaseHelper` 미사용, `indexDbHelper = null` 허용하여 기존 단일 DB 경로 유지 |

---

## Implementation Order

1. **KeystoreManager 인덱스 키 메서드** (`getOrCreateIndexKey`, `encryptForIndex`, `decryptFromIndex`)
2. **AutofillIndexDatabaseHelper 신규** (별도 DB 파일, 스키마, 인덱스 테이블)
3. **DatabaseKeyManager.getIndexKey** 추가
4. **AutofillRepository 확장** — 인덱스 헬퍼 선택적 주입, 신규 메서드들 추가 (`syncIndexTable`, `deleteIndexEntry`, `rebuildIndexTable`, `findMatchingAccountIdsByIndex`, `getAccountsByIds`), **기존 메서드 변경 없음**
5. **DomainMatcher 평문 매칭 로직** 정제
6. **FormClassifier 신규** + 단위 테스트
7. **FillResponseBuilder 분기** + 단위 테스트
8. **AuthRequestHandler 플로우 통합** (인덱스 1차 필터링 → 메인 DB 2단계 조회)
9. **KiyoAutofillPlugin sync 시 인덱스 재구축** (`rebuildIndexTable` 호출 추가)
10. **생성자 변경에 따른 호출부 수정** (`KiyoAutofillPlugin`, `AuthRequestHandler` 등)
11. **E2E 테스트 추가** + 수동 검증

---

## Verification Criteria

- [ ] `./gradlew test --tests "*KeystoreManagerTest" --tests "*AutofillIndexDatabaseHelperTest" --tests "*AutofillRepositoryTest" --tests "*DomainMatcherTest" --tests "*FormClassifierTest" --tests "*FillResponseBuilderTest"` green
- [ ] **기존 메인 DB 테스트 회귀 없음** — `AutofillRepository` 기존 메서드 테스트 모두 통과
- [ ] `npm run test:e2e:android` — 신규 4개 시나리오 통과 (독립성 검증 포함)
- [ ] 수동 검증: 회원가입 폼/비로그인 페이지에서 드롭다운 억제 확인, 인증 프롬프트 발생 안 함 확인
- [ ] 기존 로그인 폼 자동완성 회귀 없음 확인 (Google, GitHub, 삼성 인터넷, 뱅킹 앱)
- [ ] 별도 인덱스 DB 파일(`kiyo_autofill_index.db`) 생성/암호화 확인, 메인 DB(`kiyo_autofill.db`) 스키마/데이터 변경 없음 확인

---

## Can Implementation Begin?

**Yes** — 아키텍처가 **완전 분리**로 정의되었고, 기존 메인 DB(`kiyo_autofill.db`)는 **어떤 변경도 없음**을 보장. `ce-plan`으로 상세 구현 계획 수립 후 `ce-work` 진행 권장.

---

## Phase 6: WebsitePreset `packageNames` 채우기 (Future Enhancement — 추가됨 2026-08-28)

**원본 위치:** `2026-08-24-autofill-field-detection.md` 73번 줄에서 별도 추적 결정  
**선행 조건:** Phase 1-5 (현재까지의 인덱스 DB/매칭) 머지 완료 후

### Goal

`src/data/websitePresets.ts`의 14개 모든 프리셋에 `packageNames` 필드를 채워서,
**하나의 통합 매칭 레이어**가 web(domain) + Android app(packageName) 양쪽에서 일관되게 동작하도록 한다.

### 왜 필요한가

현재 `WebsitePreset`은 `domain`만 가짐 → Android 앱에서 해당 사이트의 계정을 자동완성하려면
사용자가 직접 `packageName`을 입력해야 함. 프리셋이 `packageNames`까지 제공하면:

1. **One-click setup**: 사용자가 프리셋 선택 → 자동으로 web URL + Android app packageName 모두 등록
2. **정확도 향상**: 잘 알려진 사이트(Google, Naver, Kakao 등)의 Android 앱 packageName이 자동 매칭
3. **WebView vs Native app 일관성**: 한 사이트가 web 로그인과 Android 앱 로그인 모두 있을 때 단일 계정으로 fill

### Changes

#### 1. `WebsitePreset` 모델 확장

**File:** `src/models/websitePreset.ts`

```typescript
export interface WebsitePreset {
  id: string;
  name: string;
  aliases: string[];
  icon?: string;
  websiteUrl: string;
  domain: string;
  category?: string;
  packageNames?: string[];  // 신규: Android app package name(s)
}
```

#### 2. `websitePresets.ts` 14개 프리셋에 `packageNames` 채우기

**File:** `src/data/websitePresets.ts`

각 프리셋마다 실제 Android package name(s)을 조사하여 채워야 함. **조사 완료된 값 (Play Store 검증 2026-08-28)**:

| id | name | websiteUrl (검증됨) | packageNames (Play Store URL `?id=` 기준 검증) |
|----|------|-------------------|------------------------------------------------|
| google | Google | `https://accounts.google.com` | `com.google.android.googlequicksearchbox` (Google Search 앱)<br>※ Gmail 단독 앱: `com.google.android.gm` |
| naver | Naver | `https://nid.naver.com` | `com.nhn.android.search` (NAVER 메인 앱) |
| kakao | Kakao | `https://accounts.kakao.com` | `com.kakao.talk` (KakaoTalk) |
| microsoft | Microsoft | `https://login.microsoftonline.com` | `com.microsoft.office.outlook` (Microsoft Outlook) |
| apple | Apple | `https://appleid.apple.com` | **(없음 — Apple은 Android 공식 앱 없음, `packageNames` 필드 생략)** |
| github | GitHub | `https://github.com/login` | `com.github.android` |
| discord | Discord | `https://discord.com/login` | `com.discord` |
| instagram | Instagram | `https://www.instagram.com/accounts/login/` | `com.instagram.android` |
| facebook | Facebook | `https://www.facebook.com/login` | `com.facebook.katana` |
| twitter | X (Twitter) | `https://x.com/i/flow/login` | `com.twitter.android` |
| netflix | Netflix | `https://www.netflix.com/login` | `com.netflix.mediaclient` |
| steam | Steam | `https://store.steampowered.com/login/` | `com.valvesoftware.android.steam.community` |
| amazon | Amazon | `https://www.amazon.com/ap/signin` | `com.amazon.mShop.android.shopping` |
| dropbox | Dropbox | `https://www.dropbox.com/login` | `com.dropbox.android` |

> **검증 의무**: `packageNames`에 나열된 값들은 **실제 Google Play Store에 존재하는 정확한 package name**이어야 함.
> 존재하지 않는 package name을 등록하면 autofill 매칭이 영구히 실패한다.
> 조사 방법: `adb shell pm list packages | grep <keyword>` 또는 Google Play Store URL에서 `id=` 추출.
>
> **현재 채워야 할 데이터**:
> - Google은 여러 Google 앱(Gmail, Search, Maps 등) 모두 같은 Google 계정 사용 → 한 프리셋에 1-3개까지만 채우는 게 실용적 (선택)
> - Apple은 `packageNames` 필드 자체를 생략 (`undefined`) — Android 앱이 없으므로
> - 나머지 12개는 위 표 값으로 채우기

#### 3. AccountMapper가 `packageNames`를 Android autofill DB로 전달

**File:** `android/app/src/main/java/com/kiyo/app/autofill/repository/AccountMapper.kt`

`parseReactAccount`가 React account JSON의 `packageNames` 배열을 읽어 `AutofillAccount.packageNames`에 저장.
(이미 완료된 작업 — `2026-08-28-accountmapper-fromcursor-validation.md` 참조)

#### 4. 단위 테스트 추가

**File:** `src/data/__tests__/websitePresets.test.ts` (NEW) 또는 기존 `src/data/websitePresets.test.ts`

| Test | 검증 |
|------|------|
| 모든 프리셋이 `packageNames?: string[]` 시그니처 준수 | TypeScript 컴파일 |
| `packageNames`가 있는 프리셋은 모두 non-empty 배열 | 길이 ≥ 1 |
| `packageNames` 값 형식 검증 | `com.example.app` 패턴 (소문자, 점 구분) |
| `packageNames` 값 중복 없음 | 각 프리셋 내 unique |
| `searchPresets`는 `packageNames` 무관하게 동작 | 기존 검색 동작 회귀 없음 |
| `getPresetById`는 `packageNames` 포함하여 반환 | 매핑 무결성 |

#### 5. E2E 시나리오 (선택, Phase 4 인덱스 DB와 통합 시)

**File:** `android/app/src/androidTest/java/com/kiyo/app/autofill/AutofillE2ETest.kt`

| Test | 시나리오 | 기대 결과 |
|------|----------|-----------|
| `autofillPresetPackagesMatch` | `Google` 프리셋으로 계정 생성 → KIYO가 Google Android 앱에서 fill 동작 | 드롭다운 표시 + 성공적 fill |
| `autofillPresetWebAndAppUnified` | 동일 프리셋으로 web + Android app 모두에서 fill | 양쪽 컨텍스트에서 단일 계정 매칭 |

### Implementation Order

1. **`WebsitePreset` 모델에 `packageNames?` 필드 추가** (타입만)
2. **`packageNames` 값 조사** — 각 프리셋별 실제 Google Play Store package name 1-3개씩
3. **`websitePresets.ts` 14개 모두에 값 채우기** (조사 완료된 것부터 점진적 머지)
4. **단위 테스트 추가** (검증 + 회귀 방지)
5. **E2E 통합** (선택 — 인덱스 DB Phase 4와 함께)

### Risks & Mitigations

| 위험 | 영향 | 완화 |
|------|------|------|
| 잘못된 package name 등록 | autofill 영구 실패 | 조사 단계에서 `adb shell pm list packages`로 실기기 검증, 단위 테스트로 형식 검증 |
| Google이 앱을 리팩토링하여 package name 변경 | 매칭 실패 | 매니페스트 PR 시점의 최신 package name 사용, 향후 업데이트 plan 별도 |
| Package name 누락된 프리셋 (Apple 등) | Android app fill 불가 | `packageNames?: string[]` (optional) — 누락 시 web autofill만 동작, OK |
| 사용자 정의 account와 프리셋 충돌 | 사용자 입력 우선 | AccountMapper가 React 입력값을 그대로 사용 (프리셋은 초기값 제공만) |

### Verification Criteria

- [ ] `WebsitePreset.packageNames?: string[]` 타입 추가됨
- [ ] `websitePresets.ts` 14개 모두 검토 완료 (조사 완료된 것은 채워짐, 불가한 것은 주석으로 사유 명시)
- [ ] 단위 테스트 통과 — 모든 프리셋의 `packageNames` 형식/중복/유일성 검증
- [ ] 기존 search/getById/getByCategory 함수 동작 회귀 없음
- [ ] (선택) E2E 시나리오 2개 통과 — web + Android app 양쪽 매칭

### Out of Scope

- iOS bundle ID (현재는 Android만, iOS는 `AutofillPlatformBridge` 추후)
- App icon, splash screen 등 UI 요소
- 사용자가 직접 package name 입력/수정 UI (프리셋은 초기값만)

### 관련 기존 결정

- `2026-08-24-autofill-field-detection.md` 73번 줄: 별도 추적 결정
- `2026-08-24-autofill-reliability.md` 225/232/284/297번 줄: DomainMatcher/AccountMapper에 `packageNames` 지원 이미 구현됨
- `2026-08-28-autofill-matching-layer.md` (현재 문서) Phase 4: 인덱스 DB가 `packageNames`로 1차 필터링 — 이 Phase가 완료되어야 프리셋 데이터가 실제로 효과를 봄