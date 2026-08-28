# Plan: Autofill Matching Layer — Independent Encrypted Index DB (Non-Auth Keystore Key)

**Date:** 2026-08-28 (Revised v7 — Streamlined)  
**Branch:** `feature/autofill-reliability`  
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도  
**Depends on:** `2026-08-24-autofill-field-detection.md`, `2026-08-24-autofill-domain-matching.md`  
**See Also:** `2026-08-28-autofill-registration-suppression.md` (회원가입 폼 억제 — 별도 계획), `2026-08-28-website-preset-package-names.md` (Preset packageNames)

---

## Core Principle

**기존 `kiyo_autofill.db` (메인 자동완성 DB)는 절대 건드리지 않음.**
- 스키마 변경 없음
- FK 없음
- 캐스케이드 없음
- 공유 트랜잭션 없음
- 별도 파일, 별도 키, 별도 라이프사이클

인덱스 DB(`kiyo_autofill_index.db`)는 **완전 독립된 별도 SQLCipher DB**로, 메인 DB와는 동기화 시점에만 논리적으로 연관됨.
- **`kiyo_index_key` (비인증 Keystore 키)**로 암호화
- 사용자 인증 없이 접근 가능
- 별도 재래핑/키 수명주기 관리 **없음**

---

## Goal

**로그인 폼이 아닌 페이지에서 자동완성 드롭다운이 뜨는 것을 원천 차단**하기 위해:

1. **독립된 암호화 인덱스 DB (`kiyo_autofill_index.db`)** — `kiyo_index_key`(비인증 Keystore 키)로 SQLCipher 암호화, 메인 DB와 완전히 분리
   - 1차 필터링: 도메인/패키지명으로 매칭되는 `account_id`만 빠르게 조회
   - 매칭 없으면 즉시 종료 (메인 DB 접근 안 함, 인증 프롬프트 없음)
   - 매칭 있으면 2단계에서 메인 DB에서 전체 계정 조회 (기존 인증 사이클 적용)

> **회원가입 폼 판별 및 억제**는 별도 계획(`2026-08-28-autofill-registration-suppression.md`)에서 독립적으로 구현됨. 인덱스 DB와 런타임 의존성 없음.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXISTING (UNCHANGED)                                 │
│  kiyo_autofill.db (SQLCipher, DB_KEY)                                        │
│  └─ autofill_accounts 테이블                                                 │
│     - id, username, password, title, app_name, domain, package_names...     │
│     - 기존 코드 그대로 사용, 어떤 변경도 없음                                 │
│     - DB_KEY: 인증 필요 (userAuthenticationRequired = true)                   │
│     - kiyo_master_key로 보호                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │  (런타임 의존성 없음)
                                    │   동기화 시점에만 논리적 연관
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEW: INDEPENDENT ENCRYPTED INDEX DB                  │
│  kiyo_autofill_index.db (SQLCipher, INDEX_KEY)                              │
│  └─ autofill_index 테이블                                                    │
│     - _id INTEGER PRIMARY KEY                                                │
│     - account_id INTEGER  ← 메인 DB id 참조용 (FK 아님, 단순 정수 컬럼)       │
│     - domain TEXT  (SQLCipher가 암호화)                                       │
│     - package_names TEXT  (SQLCipher가 암호화, JSON 배열 문자열)             │
│     - updated_at INTEGER                                                     │
│     - UNIQUE(account_id)  ← 중복 방지용 유니크 인덱스                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ INDEX_KEY (32-byte)           │
                    │ - NON auth-required           │
                    │ - 사용자 인증 불필요           │
                    │ - 1차 필터링용                │
                    │ - 자격증명 없음 (domain/pkg만)│
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ kiyo_index_key                │
                    │ (Android Keystore,            │
                    │  userAuthenticationRequired = │
                    │  false)                       │
                    └───────────────────────────────┘
```

**핵심 설계 결정:**
- ✅ Index DB는 **SQLCipher로 암호화** (평문 SQLite 아님)
- ✅ **`kiyo_index_key`** — 비인증 Keystore AES 키 (`userAuthenticationRequired = false`)
- ✅ **별도 AES-GCM 래핑 없음** — SQLCipher가 전체 DB를 `INDEX_KEY`로 암호화
- ✅ **별도 키 수명주기/재래핑 로직 없음** — Keystore가 키 보호, Autofill이 바로 사용
- ✅ Index DB에는 **domain, packageNames만** — username/password 절대 저장 안 함
- ✅ 기존 DB의 `DB_KEY`, `kiyo_master_key`, 인증/재래핑 로직 **완전 분리**
- ✅ **전체 스캔 + 복호화 후 매칭** — 계정 수 ~50개면 충분히 빠름, SQL 인덱스/FTS 불필요

---

## Changes

### 1. KeystoreManager — 인덱스 키 전용 메서드 추가 (`requireAuth` 파라미터 추가)

**File:** `android/app/src/main/java/com/kiyo/app/security/KeystoreManager.kt`

```kotlin
object KeystoreManager : KeystoreProvider {
    // ... 기존 코드 ...

    const val INDEX_KEY_ALIAS = "kiyo_index_key"  // 비인증 키

    /** 인덱스용 비인증 키 생성/조회 (사용자 인증 불필요) */
    fun getOrCreateIndexKey(): SecretKey {
        return getOrCreateKey(INDEX_KEY_ALIAS, requireAuth = false)
    }

    /** 
     * 주어진 alias로 키 조회/생성. requireAuth로 인증 요구 여부 강제 지정.
     * - requireAuth=true: 잠금화면 필요 (인증-required 키)
     * - requireAuth=false: 잠금화면 불필요 (non-auth 키)
     */
    @Throws(Exception::class)
    fun getOrCreateKey(alias: String, requireAuth: Boolean): SecretKey = loadKeyStoreEntry(alias) { keyStore ->
        if (!keyStore.containsAlias(alias)) {
            generateNewKey(keyStore, alias, requireAuth)
        }
    }

    // 기존 getOrCreateKey(alias: String) 유지 (하위 호환) — 내부에서 requireAuth 파라미터 버전 호출
    @Throws(Exception::class)
    override fun getOrCreateKey(): SecretKey {
        return getOrCreateKey(LEGACY_KEY_ALIAS)
    }

    @Throws(Exception::class)
    fun getOrCreateKey(alias: String): SecretKey {
        // 기존 동작 유지: 잠금화면 상태에 따라 자동 결정
        return getOrCreateKey(alias, requireAuth = isSecureLockScreenEnabled())
    }

    // generateNewKey 시그니처 변경: requireAuth 파라미터 추가
    private fun generateNewKey(keyStore: KeyStore, alias: String, requireAuth: Boolean) {
        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
        val builder = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(KEY_SIZE)

        if (requireAuth) {
            val authValiditySeconds = if (BuildConfig.DEBUG) 30 else 30 * 60
            builder.setUserAuthenticationRequired(true)
                .setUserAuthenticationParameters(
                    authValiditySeconds,
                    KeyProperties.AUTH_BIOMETRIC_STRONG or KeyProperties.AUTH_DEVICE_CREDENTIAL
                )
            Log.d(TAG, "Master key generated WITH user authentication: alias=$alias, validity=${authValiditySeconds}s")
        } else {
            Log.w(TAG, "Generating key WITHOUT auth requirement: alias=$alias")
        }

        keyGenerator.init(builder.build())
        keyGenerator.generateKey()
        Log.d(TAG, "New key generated: alias=$alias, authRequired=$requireAuth")
    }
}
```

> **변경 포인트**: `generateNewKey`에 `requireAuth: Boolean` 추가, `getOrCreateKey(alias, requireAuth)` 오버로드 추가. 기존 `getOrCreateKey(alias)`는 잠금화면 상태 기반 자동 결정 유지.

---

### 2. 독립된 인덱스 DB 헬퍼 — `AutofillIndexDatabaseHelper` (신규 파일, 기존 `AutofillDatabaseHelper` 패턴 동일)

**File:** `android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillIndexDatabaseHelper.kt`

```kotlin
package com.kiyo.app.autofill.repository

import android.content.Context
import android.util.Log
import net.zetetic.database.sqlcipher.SQLiteDatabase

/**
 * 독립된 인덱스용 SQLCipher DB 헬퍼.
 * - 메인 DB(kiyo_autofill.db)와 완전히 분리된 별도 파일
 * - INDEX_KEY(비인증 키)로 SQLCipher 암호화 → 사용자 인증 없이 접근 가능
 * - 메인 DB 스키마/데이터/트랜잭션과 무관
 * - 매칭에 필요한 메타데이터만 저장 (domain, package_names)
 * - 자격증명(username/password) 절대 저장하지 않음
 * - 기존 AutofillDatabaseHelper와 동일한 수동 DB 관리 패턴 사용
 */
class AutofillIndexDatabaseHelper(
    private val context: Context,
    private val encryptionKey: ByteArray  // INDEX_KEY 평문 바이트 (SecretKey.encoded)
) {

    companion object {
        private const val DATABASE_NAME = "kiyo_autofill_index.db"
        private const val DATABASE_VERSION = 1
        private const val TAG = "AutofillIndexDatabaseHelper"

        const val TABLE_INDEX = "autofill_index"
        const val COLUMN_ID = "_id"
        const val COLUMN_ACCOUNT_ID = "account_id"           // 메인 DB id 참조용 (FK 아님)
        const val COLUMN_DOMAIN = "domain"                   // SQLCipher가 암호화
        const val COLUMN_PACKAGE_NAMES = "package_names"     // SQLCipher가 암호화
        const val COLUMN_UPDATED_AT = "updated_at"
    }

    private var database: SQLiteDatabase? = null

    /** Get readable database (opens with encryption key if not already open) */
    fun getReadableDatabase(): SQLiteDatabase {
        return getDatabase(SQLiteDatabase.OPEN_READONLY)
    }

    /** Get writable database (opens with encryption key if not already open) */
    fun getWritableDatabase(): SQLiteDatabase {
        return getDatabase(SQLiteDatabase.OPEN_READWRITE)
    }

    private fun getDatabase(flags: Int): SQLiteDatabase {
        val db = database
        if (db != null && db.isOpen) {
            return db
        }

        val dbFile = context.getDatabasePath(DATABASE_NAME)
        dbFile.parentFile?.mkdirs()

        val newDb = SQLiteDatabase.openOrCreateDatabase(
            dbFile,
            encryptionKey,
            null,
            null
        )

        database = newDb

        val cursor = newDb.rawQuery("PRAGMA user_version", null)
        var version = 0
        if (cursor.moveToFirst()) {
            version = cursor.getInt(0)
        }
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

    /** Close the database */
    fun close() {
        database?.close()
        database = null
    }

    /** Create database schema */
    private fun onCreate(db: SQLiteDatabase) {
        val createTableSql = """
            CREATE TABLE $TABLE_INDEX (
                $COLUMN_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COLUMN_ACCOUNT_ID INTEGER NOT NULL,
                $COLUMN_DOMAIN TEXT NOT NULL DEFAULT '',
                $COLUMN_PACKAGE_NAMES TEXT NOT NULL DEFAULT '[]',
                $COLUMN_UPDATED_AT INTEGER NOT NULL,
                UNIQUE($COLUMN_ACCOUNT_ID)
            )
        """.trimIndent()

        db.execSQL(createTableSql)
        Log.d(TAG, "Independent index database created (SQLCipher + INDEX_KEY, non-auth)")
    }

    /** Upgrade database schema */
    private fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        Log.w(TAG, "Upgrading index database from $oldVersion to $newVersion")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_INDEX")
        onCreate(db)
    }
}
```

> **핵심**: `AutofillDatabaseHelper`와 **동일한 패턴** — `SQLiteOpenHelper` 상속 안 함, `ByteArray` 키 직접 전달, `openOrCreateDatabase` 수동 호출, `getReadableDatabase`/`getWritableDatabase` 제공.

---

### 3. DatabaseKeyManager — INDEX_KEY 제공 메서드만 추가 (ByteArray 반환)

**File:** `android/app/src/main/java/com/kiyo/app/security/DatabaseKeyManager.kt`

```kotlin
object DatabaseKeyManager {
    // ... 기존 코드 그대로 유지 ...

    /**
     * 인덱스 DB용 INDEX_KEY 획득 (비인증 키, 사용자 인증 불필요)
     * - 별도 래핑/언래핑/재래핑 로직 없음
     * - Keystore에서 바로 꺼내서 ByteArray로 반환 (Index 헬퍼가 ByteArray 기대)
     */
    suspend fun getIndexKey(context: Context): ByteArray {
        KeystoreManager.init(context)
        val secretKey = KeystoreManager.getOrCreateIndexKey()
        return secretKey.encoded
    }
}
```

> **중요**: `getIndexKey()`는 단순히 Keystore에서 비인증 키를 꺼내 `.encoded`로 반환할 뿐. 메인 DB의 `getKey()`처럼 DataStore 래핑, 생체인증, 재래핑, `wasStateReset()` 플래그 등 **어떤 복잡한 로직도 없음**. Index 헬퍼가 `ByteArray`를 기대하므로 `SecretKey` 대신 `ByteArray` 반환.

---

### 4. AutofillRepository — 인덱스 헬퍼 주입받아 독립적 연동 (메인 DB 로직 변경 없음)

**File:** `android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillRepository.kt`

```kotlin
class AutofillRepository internal constructor(
    private val context: Context,
    private val dbHelper: AutofillDatabaseHelper,           // 기존 메인 DB 헬퍼 (변경 없음)
    private val indexDbHelper: AutofillIndexDatabaseHelper? = null  // 신규: 인덱스 DB 헬퍼 (nullable, 기본 null)
) {
    // ... 기존 모든 메서드 그대로 유지 (insertAccount, upsertAccount, deleteAccount,
    //      findMatchingAccounts, getAllAccounts, syncAccountsFromReact 등) ...

    // 신규: 인덱스 전용 메서드들 (메인 DB 로직과 완전 분리)

    /** 인덱스 테이블 동기화 (별도 트랜잭션, 메인 DB와 무관) */
    fun syncIndexTable(accountId: Long, account: AutofillAccount) {
        indexDbHelper?.let { helper ->
            executor.submit {
                val indexDb = helper.writableDatabase
                val values = ContentValues().apply {
                    put(AutofillIndexDatabaseHelper.COLUMN_ACCOUNT_ID, accountId)
                    put(AutofillIndexDatabaseHelper.COLUMN_DOMAIN, account.domain ?: "")
                    put(AutofillIndexDatabaseHelper.COLUMN_PACKAGE_NAMES, account.packageNamesToJson() ?: "[]")
                    put(AutofillIndexDatabaseHelper.COLUMN_UPDATED_AT, System.currentTimeMillis())
                }
                indexDb.insertWithOnConflict(
                    AutofillIndexDatabaseHelper.TABLE_INDEX,
                    null,
                    values,
                    SQLiteDatabase.CONFLICT_REPLACE
                )
            }.get()
        }
    }

    /** 인덱스 테이블에서 계정 ID 삭제 (메인 DB 삭제와 별도 호출) */
    fun deleteIndexEntry(accountId: Long) {
        indexDbHelper?.let { helper ->
            executor.submit {
                helper.writableDatabase.delete(
                    AutofillIndexDatabaseHelper.TABLE_INDEX,
                    "account_id = ?",
                    arrayOf(accountId.toString())
                )
            }.get()
        }
    }

    /** 인덱스 테이블 전체 재구축 (Sync 시 호출) */
    fun rebuildIndexTable(accounts: List<AutofillAccount>) {
        indexDbHelper?.let { helper ->
            executor.submit {
                val indexDb = helper.writableDatabase
                indexDb.beginTransaction()
                try {
                    indexDb.delete(AutofillIndexDatabaseHelper.TABLE_INDEX, null, null)
                    for (account in accounts) {
                        val values = ContentValues().apply {
                            put(AutofillIndexDatabaseHelper.COLUMN_ACCOUNT_ID, account.id)
                            put(AutofillIndexDatabaseHelper.COLUMN_DOMAIN, account.domain ?: "")
                            put(AutofillIndexDatabaseHelper.COLUMN_PACKAGE_NAMES, account.packageNamesToJson() ?: "[]")
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
    }

    /**
     * 1차 필터링: 인덱스 DB에서 도메인/패키지 매칭
     * - INDEX_KEY만 필요 (비인증 키, 사용자 인증 불필요)
     * - 메인 DB_KEY 불필요
     * - 전체 스캔 후 복호화 → DomainMatcher로 평문 비교
     */
    fun findMatchingAccountIdsByIndex(domain: String?, packageNames: List<String>): List<Long> {
        return indexDbHelper?.let { helper ->
            executor.submit {
                val indexDb = helper.readableDatabase
                val cursor = indexDb.query(
                    AutofillIndexDatabaseHelper.TABLE_INDEX,
                    arrayOf(
                        AutofillIndexDatabaseHelper.COLUMN_ACCOUNT_ID,
                        AutofillIndexDatabaseHelper.COLUMN_DOMAIN,
                        AutofillIndexDatabaseHelper.COLUMN_PACKAGE_NAMES
                    ),
                    null, null, null, null, null
                )

                val matchingIds = mutableListOf<Long>()
                cursor.use { c ->
                    while (c.moveToNext()) {
                        val accountId = c.getLong(c.getColumnIndexOrThrow(AutofillIndexDatabaseHelper.COLUMN_ACCOUNT_ID))
                        val storedDomain = c.getString(c.getColumnIndexOrThrow(AutofillIndexDatabaseHelper.COLUMN_DOMAIN))
                        val storedPkgJson = c.getString(c.getColumnIndexOrThrow(AutofillIndexDatabaseHelper.COLUMN_PACKAGE_NAMES))

                        if (DomainMatcher.matchesDomain(storedDomain, domain) ||
                            DomainMatcher.matchesPackage(storedPkgJson, packageNames)) {
                            matchingIds.add(accountId)
                        }
                    }
                }
                matchingIds
            }.get()
        } ?: emptyList()
    }

    /** 2단계: 매칭된 ID들로 전체 계정 조회 (메인 DB, 기존 로직 그대로 사용) */
    fun getAccountsByIds(ids: List<Long>): List<AutofillAccount> {
        if (ids.isEmpty()) return emptyList()
        return executor.submit {
            val db = dbHelper.readableDatabase
            val placeholders = ids.map { "?" }.joinToString(",")
            val cursor = db.rawQuery(
                "SELECT * FROM ${AutofillDatabaseHelper.TABLE_ACCOUNTS} WHERE ${AutofillDatabaseHelper.COLUMN_ID} IN ($placeholders)",
                ids.map { it.toString() }.toTypedArray()
            )
            val results = mutableListOf<AutofillAccount>()
            cursor.use { c ->
                while (c.moveToNext()) {
                    results.add(AccountMapper.fromCursor(c))
                }
            }
            results
        }.get()
    }

    // close()에 인덱스 헬퍼 close 추가
    override fun close() {
        dbHelper.close()
        indexDbHelper?.close()
        executor.shutdown()
        // ... 기존 shutdown 로직 ...
    }
}
```

> **핵심**: `indexDbHelper`는 **nullable + 기본값 `null`**로 하위 호환 유지. 메인 DB 로직(`findMatchingAccounts`, `syncAccountsFromReact` 등)은 **일절 변경하지 않음**.

---

### 5. DomainMatcher — 평문 매칭 로직 (SQLCipher가 복호화한 값 사용)

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

// 헬퍼 함수들 (기존 로직 재사용)
private fun normalizeDomain(domain: String): String = domain.lowercase().trim().removePrefix("www.")
private fun isSubdomainMatch(stored: String, query: String): Boolean = query.endsWith(".$stored")
private fun isWildcardMatch(stored: String, query: String): Boolean = stored.startsWith("*.") && query.endsWith(stored.substring(1))
```

---

### 6. AuthRequestHandler — 2단계 플로우 (메인 DB 로직 변경 없음)

**File:** `android/app/src/main/java/com/kiyo/app/autofill/service/AuthRequestHandler.kt`

```kotlin
fun handleFillRequest(request: FillRequest, callback: FillCallback) {
    // 1. ViewNode에서 domain/packageNames 추출
    val domain = ViewNodeExtractor.extractDomainFromStructure(request.structure)
    val packageNames = ViewNodeExtractor.extractPackageNames(request.structure)

    // 2. 회원가입 폼 판별 (별도 계획에서 구현, 여기선 인터페이스만 호출)
    val isRegistrationForm = FormClassifier.isRegistrationForm(request.structure)

    // 3. 1차 필터링: 인덱스 DB에서 매칭 (INDEX_KEY만 필요, 비인증, 메인 DB 안 건드림)
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

    // 6. 응답 생성 (회원가입 폼 분기는 별도 계획의 FillResponseBuilder가 처리)
    val response = FillResponseBuilder.createFillResponse(fullAccounts, usernameId, passwordId, isRegistrationForm)
    callback.onSuccess(response)
}
```

> **참고**: `FormClassifier`와 `FillResponseBuilder.createFillResponse(isRegistrationForm)`는 별도 계획(`2026-08-28-autofill-registration-suppression.md`)에서 구현됨. 여기서는 호출만 함.

---

### 7. AutofillSyncManager — Sync 시 인덱스 테이블 독립적 재구축 (정책 레이어에서 처리)

**File:** `android/app/src/main/java/com/kiyo/app/capacitor/AutofillSyncManager.kt`

```kotlin
// syncAccountsFromReact 내부, repository.syncAccountsFromReact() 호출 후 추가
suspend fun syncAccountsFromReact(context: Context, accountsJson: String): SyncResult {
    // ... 기존 보안 다운그레이드/업그레이드 감지 로직 ...
    
    val repository = ensureRepository()
    // ... key acquisition, state reset handling ...
    
    val result = activeRepository.syncAccountsFromReact(accountsJson)
    
    // 신규: 인덱스 테이블 별도 재구축 (별도 트랜잭션, 별도 DB, INDEX_KEY로 암호화)
    // 매번 동기화 시 전체 재구축 — React가 source of truth이므로 syncedCount가 0이어도
    // (사용자가 모든 계정 삭제) 인덱스를 비워야 함.
    val allAccounts = activeRepository.getAllAccounts()  // sync 후 최신 상태
    activeRepository.rebuildIndexTable(allAccounts)      // 인덱스 전용 재구축
    
    return SyncResult(
        syncedCount = result.first,
        errorCount = result.second,
        success = result.second == 0,
        securityUpgrade = securityUpgraded,
    )
}
```

> **핵심**: **Sync 정책은 `AutofillSyncManager`가 단일 책임**. Plugin은 orchestration만. 인덱스 재구축은 **매 sync마다** 수행 (syncedCount와 무관).

---

### 8. KiyoAutofillPlugin — SyncManager 위임만 수행 (인덱스 로직 없음)

**File:** `android/app/src/main/java/com/kiyo/app/capacitor/KiyoAutofillPlugin.kt`

```kotlin
@PluginMethod
fun syncAccountsFromReact(call: PluginCall) {
    CoroutineScope(Dispatchers.IO).launch {
        try {
            val context = getContext() ?: return@launch call.reject("Context is null")
            val accountsJson = call.getString("accountsJson") ?: return@launch call.reject("No accounts JSON provided")

            // Policy decisions (downgrade reset, upgrade flag, repository init, INDEX REBUILD) live in AutofillSyncManager
            val result = syncManager.syncAccountsFromReact(context, accountsJson)
            call.resolve(JSObject().apply {
                put("syncedCount", result.syncedCount)
                put("errorCount", result.errorCount)
                put("success", result.success)
                if (result.securityUpgrade) {
                    put("securityUpgrade", true)
                    put("message", "기기 잠금 화면이 설정되어 자동완성 보안 키를 강화했습니다. 이제 동기화 시 기기 인증을 요구할 수 있습니다.")
                }
            })
        } catch (e: UserNotAuthenticatedException) {
            // Authentication required - store pending sync and trigger auth
            // ... 기존 로직 유지 ...
        } catch (e: Exception) {
            Log.e(TAG, "Error syncing accounts from React", e)
            call.reject("Failed to sync accounts: ${e.message}")
        }
    }
}
```

> **핵심**: Plugin은 `AutofillSyncManager`에 위임만. 인덱스 재구축 로직은 **SyncManager에만** 있음.

---

## Tests

### Unit Tests (JVM)

| Test File | Scenarios |
|-----------|-----------|
| `KeystoreManagerTest` (추가) | `getOrCreateIndexKey` 비인증 키 생성 확인, `requireAuth=false` 검증 |
| `AutofillIndexDatabaseHelperTest` (NEW) | 별도 DB 파일 생성, SQLCipher 암호화 확인, 스키마, 인덱스 테이블 CRUD, 메인 DB와 무관함 확인, `ByteArray` 키로 열림 확인 |
| `AutofillRepositoryTest` (NEW) | `findMatchingAccountIdsByIndex`: INDEX_KEY로 열림, 메인 DB 헬퍼 호출 안 함 확인, `indexDbHelper=null` 시 빈 리스트 반환 확인 |
| `DomainMatcherTest` (추가) | 평문 매칭 로직: 도메인/와일드카드/패키지 prefix 매칭 |

> `FormClassifierTest`, `FillResponseBuilderTest`는 별도 계획(`registration-suppression`)에 포함.

### Instrumentation Tests (E2E)

**File:** `AutofillE2ETest.kt` 신규 메서드

| 테스트 | 시나리오 | 기대 결과 |
|--------|----------|-----------|
| `autofillSuppressedOnNonMatchingDomain` | 저장된 도메인과 다른 사이트 진입 → 자동완성 트리거 | 인덱스 필터링으로 즉시 종료, 메인 DB 접근 안 함, 인증 프롬프트 없음 |
| `autofillWorksOnLoginForm` | 로그인 페이지(`current-password`) 진입 → 자동완성 트리거 | 정상 드롭다운 + 채우기 동작 |
| `autofillIndexDbIndependent` | 메인 DB 삭제/재생성 후 → 인덱스 DB 별도 존재 확인 | 인덱스 DB 파일 별도 생성(`kiyo_autofill_index.db`), SQLCipher 암호화 확인, 메인 DB 스키마 변경 없음 |

> `autofillSuppressedOnRegistrationForm`, `autofillWorksOnPasswordChangeForm`은 별도 계획에 포함.

---

## Risks & Mitigations

| 위험 | 영향 | 완화 |
|------|------|------|
| 인덱스 테이블 동기화 불일치 | 매칭 실패 또는 잘못된 매칭 | Sync 시 전체 재구축(`rebuildIndexTable`), 개별 CRUD 시 `syncIndexTable`/`deleteIndexEntry` 호출 |
| 비인증 키(`kiyo_index_key`) 유출 | 어떤 사이트/앱 계정 저장됐는지 노출 | TEE 보호, 비인증 키지만 Keystore 밖 유출 불가, 자격증명은 별도 인증-required 키로 보호 |
| Repository 생성자 변경으로 기존 호출부 깨짐 | 컴파일 에러/런타임 에러 | `indexDbHelper: ...? = null`로 하위 호환 유지 |
| `FormClassifier` 미적용 시 컴파일 에러 | 빌드 실패 | 별도 계획 선행 머지 또는 try-catch 폴백으로 보호 |

---

## Rollback

| 시나리오 | 롤백 액션 |
|----------|-----------|
| 인덱스 DB/키 버그 | `AutofillRepository.findMatchingAccountIdsByIndex` 미사용 플래그, 기존 `findMatchingAccounts` 경로로 폴백 |
| 별도 DB 파일/키 문제 | `AutofillIndexDatabaseHelper` 미사용, `indexDbHelper = null` 허용하여 기존 단일 DB 경로 유지 |

> nullable 설계로 롤백이 단순함 — 호출부 변경 없이 `indexDbHelper = null` 전달만으로 기존 경로 복원 가능.

---

## Implementation Order

1. **KeystoreManager 인덱스 키 메서드** (`getOrCreateIndexKey` with `requireAuth = false`)
2. **AutofillIndexDatabaseHelper 신규** (별도 SQLCipher DB 파일, 스키마, 인덱스 테이블, `ByteArray` 생성자 파라미터)
3. **DatabaseKeyManager.getIndexKey** 추가 (Keystore 키를 `ByteArray`로 반환, 별도 래핑/재래핑 없음)
4. **AutofillRepository 확장** — `indexDbHelper` nullable 파라미터 추가, 신규 메서드들 추가 (`syncIndexTable`, `deleteIndexEntry`, `rebuildIndexTable`, `findMatchingAccountIdsByIndex`, `getAccountsByIds`), **기존 메서드 변경 없음**
5. **DomainMatcher 평문 매칭 로직** 정제
6. **AutofillSyncManager에 인덱스 재구축 추가** (`rebuildIndexTable` 호출)
7. **AuthRequestHandler 플로우 통합** (인덱스 1차 필터링 → 메인 DB 2단계 조회)
8. **생성자 변경에 따른 호출부 수정** (`KiyoAutofillPlugin`은 SyncManager 위임만, `AuthRequestHandler`는 repository 직접 사용)
9. **E2E 테스트 추가** + 수동 검증

---

## Verification Criteria

- [ ] `./gradlew test --tests "*KeystoreManagerTest" --tests "*AutofillIndexDatabaseHelperTest" --tests "*AutofillRepositoryTest" --tests "*DomainMatcherTest"` green
- [ ] **기존 메인 DB 테스트 회귀 없음** — `AutofillRepository` 기존 메서드 테스트 모두 통과
- [ ] `npm run test:e2e:android` — 신규 3개 시나리오 통과 (독립성 검증 포함)
- [ ] 수동 검증: 비로그인 페이지에서 드롭다운 억제 확인, 인증 프롬프트 발생 안 함 확인
- [ ] 기존 로그인 폼 자동완성 회귀 없음 확인 (Google, GitHub, 삼성 인터넷, 뱅킹 앱)
- [ ] 별도 인덱스 DB 파일(`kiyo_autofill_index.db`) 생성 확인, **SQLCipher + INDEX_KEY 암호화 확인**, 메인 DB(`kiyo_autofill.db`) 스키마/데이터 변경 없음 확인
- [ ] **암호화 검증**: `adb shell` → `sqlite3 kiyo_autofill_index.db` → 테이블 조회 시 암호화되어 읽히지 않는 것 확인
- [ ] **키 검증**: `adb shell dumpsys keystore` → `kiyo_index_key` 존재 확인, `userAuthenticationRequired=false` 확인

---

## Can Implementation Begin?

**Yes** — 아키텍처가 **완전 분리 + 비인증 Keystore 키 + SQLCipher**로 균형 잡혔고, 기존 메인 DB(`kiyo_autofill.db`)는 **어떤 변경도 없음**을 보장. 회원가입 폼 억제는 별도 계획으로 분리되어 독립적 배포 가능. 구현 전 `KeystoreManager.getOrCreateKey` 시그니처와 `AutofillDatabaseHelper` 상속 구조만 확인하면 바로 진행 가능.

---

## Related Plans

- **Registration Form Suppression:** `2026-08-28-autofill-registration-suppression.md` — FormClassifier, SaveInfo branching
- **WebsitePreset `packageNames`:** `2026-08-28-website-preset-package-names.md` — Unified web + Android matching data