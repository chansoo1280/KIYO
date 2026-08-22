# Autofill Repository Lazy Initialization Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Ensure that `AutofillRepository` is created only after the DB_KEY is successfully obtained from the Keystore (or generated on first install), and that this happens lazily on the first autofill/save request, not in `onCreate()`. This prevents unwanted authentication prompts at service start and aligns the key acquisition with the actual moment it is needed.

**Architecture:** 
- Keep `AutofillRepository` ignorant of Keystore; it only accepts a pre‑obtained plain‑text DB key via `create(Context, ByteArray)`.  
- In `KiyoAutofillService`, keep a nullable `repository` field.  
- Provide a synchronized `getOrCreateRepository()` method that, on first call, invokes `DatabaseKeyManager.getKey()` (which may trigger user authentication), then creates the repository via `AutofillRepository.create(context, dbKey)`. Subsequent calls return the cached instance.  
- `onFillRequest()` and `onSaveRequest()` obtain the repository via this getter and then use it directly—no further Keystore access occurs.  
- Remove any internal calls to `DatabaseKeyManager.getKey()` inside `AutofillRepository` (the existing overload is deprecated and should not be used).

**Tech Stack:** Kotlin, Android Keystore, SQLCipher, Coroutines (for async key retrieval if needed).

---

## Task 1: Make AutofillRepository keyless‑creation internal overload deprecated

**Objective:** Prevent accidental use of the overload that fetches the key internally, ensuring all production code supplies the key externally.

**Files:** 
- Modify: `android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillRepository.kt`

**Step 1: Write failing test**  
*(We will not run tests now, but the plan notes what a test would look like.)*  
```kotlin
@Test
fun `create(context) overload is deprecated and should not be used in production`() {
    val ctx = ApplicationProvider.getApplicationContext()
    // Expect a deprecation warning when calling the overload
    // (checked via lint or @Deprecated usage)
}
```

**Step 2: Run test to verify failure**  
Run: `./gradlew testDebugUnitTest --tests "*AutofillRepositoryTest*"`  
Expected: FAIL – deprecation not yet present.

**Step 3: Write minimal implementation**  
Add `@Deprecated` message to the overload:
```kotlin
    @Deprecated(
        message = "Use create(context, dbKey) and obtain the key yourself from Keystore.",
        replaceWith = ReplaceWith(
            "create(context, DatabaseKeyManager.getKey(context).encoded)"
        )
    )
    @JvmStatic
    suspend fun create(context: Context): AutofillRepository =
        withContext(Dispatchers.IO) {
            val encryptionKey = DatabaseKeyManager.getKey(context).encoded
            val dbHelper = AutofillDatabaseHelper(context, encryptionKey)
            AutofillRepository(context, dbHelper)
        }
```

**Step 4: Run test to verify pass**  
Run same command; Expected: PASS.

**Step 5: Commit**  
```bash
git add android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillRepository.kt
git commit -m "feat: deprecate AutofillRepository.create(Context) overload"
```

---

## Task 2: Add lazy repository initialization in KiyoAutofillService

**Objective:** Ensure the repository is created only when first needed, after obtaining the DB_KEY from Keystore (or generating it on first install).

**Files:** 
- Modify: `android/app/src/main/java/com/kiyo/app/autofill/service/KiyoAutofillService.kt`

**Step 1: Write failing test**  
```kotlin
@Test
fun `repository is null after onCreate`() {
    val service = KiyoAutofillService()
    service.onCreate()
    // Using reflection or test-only accessor to check private field
    assertNull(service.repository) // placeholder
}
```
Expected: FAIL – repository may already be non‑null.

**Step 2: Run test to verify failure**  
Run: `./gradlew testDebugUnitTest --tests "*KiyoAutofillServiceTest*"`  
Expected: FAIL.

**Step 3: Write minimal implementation**  
- Change `onCreate()` to do nothing (just call super).  
- Add private synchronized `getOrCreateRepository()` method:
```kotlin
private var repository: AutofillRepository? = null
private val repoLock = Any()

@Override
fun onCreate() {
    super.onCreate()
    // Intentionally left blank – no key acquisition here.
}

@Throws(android.security.keystore.UserNotAuthenticatedException::class)
private fun getOrCreateRepository(): AutofillRepository {
    synchronized(repoLock) {
        val repo = repository
        if (repo != null) return repo
        // Obtain key – may throw UserNotAuthenticatedException
        val encryptedKey = DatabaseKeyManager.getKey(this@KiyoAutofillService)
        val dbKey = encryptedKey.encoded
        val newRepo = AutofillRepository.create(this@KiyoAutofillService, dbKey)
        repository = newRepo
        return newRepo
    }
}
```
- Update `getRepository()` (if exists) to call `getOrCreateRepository()` or directly use the synchronized block.

**Step 4: Run test to verify pass**  
Run same test; Expected: PASS.

**Step 5: Commit**  
```bash
git add android/app/src/main/java/com/kiyo/app/autofill/service/KiyoAutofillService.kt
git commit -m "feat: lazy init AutofillRepository on first auth‑required request"
```

---

## Task 3: Update onFillRequest and onSaveRequest to use lazy getter

**Objective:** Ensure both request handlers obtain the repository via the lazy getter, so Keystore access (and possible auth) happens only when needed.

**Files:** 
- Modify: `android/app/src/main/java/com/kiyo/app/autofill/service/KiyoAutofillService.kt`

**Step 1: Write failing test**  
```kotlin
@Test
fun `onFillRequest triggers key acquisition only when repository is null`() {
    // Setup mock DatabaseKeyManager to throw UserNotAuthenticatedException on first call,
    // then return a key on second call.
    // Verify that after handling the exception and retrying, repository is created.
}
```
Expected: FAIL – current implementation may call getKey in onCreate.

**Step 2: Run test to verify failure**  
Run: `./gradlew testDebugUnitTest --tests "*KiyoAutofillServiceTest*"`  
Expected: FAIL.

**Step 3: Write minimal implementation**  
Replace the current `getRepository()` call inside the executor block with:
```kotlin
val repo = getOrCreateRepository()   // synchronized, handles auth
```
Ensure any `catch (UserNotAuthenticatedException e)` block creates an auth response via `FillResponseBuilder.createAuthResponse(...)`.  
Do the same for `onSaveRequest`.

**Step 4: Run test to verify pass**  
Run same test; Expected: PASS.

**Step 5: Commit**  
```bash
git add android/app/src/main/java/com/kiyo/app/autofill/service/KiyoAutofillService.kt
git commit -m "feat: use lazy repository getter in onFillRequest/onSaveRequest"
```

---

## Task 4: Verify no Keystore access in onCreate() and repository usage after init

**Objective:** Confirm that after the changes, service start does not invoke `DatabaseKeyManager.getKey()` and that subsequent requests reuse the same repository instance.

**Files:** 
- (No code changes; verification via logging or test spies.)

**Step 1: Write failing test**  
```kotlin
@Test
fun `onCreate does not call DatabaseKeyManager.getKey`() {
    val mockKeyManager = mock(DatabaseKeyManager::class.java)
    // inject via test variant or use mockk/static mock
    val service = KiyoAutofillService()
    service.onCreate()
    verify(mockKeyManager, never()).getKey(any())
}
```
Expected: FAIL if onCreate still calls getKey.

**Step 2: Run test to verify failure**  
Run instrumentation or unit test with mocking; Expected: FAIL.

**Step 3: Write minimal implementation**  
(Implementation already done; just ensure onCreate body is empty of key acquisition.)

**Step 4: Run test to verify pass**  
Run test; Expected: PASS.

**Step 5: Commit**  
```bash
git commit -am "fix: ensure onCreate does not access Keystore"
```

---

## Task 5: Clean up any remaining internal calls to the deprecated overload

**Objective:** Ensure no production code (including tests that should mimic production) calls `AutofillRepository.create(Context)` without arguments.

**Files:** 
- Scan: `android/app/src/main/**/*.kt` for `.create(` patterns.

**Step 1: Write failing test**  
```kotlin
@Test
fun `no production code uses the deprecated create(Context) overload`() {
    // Use detekt or custom check to flag calls to create(Context) without ByteArray arg
}
```
Expected: FAIL if any such calls exist.

**Step 2: Run test to verify failure**  
Run: `./gradlew detekt` or custom script; Expected: FAIL.

**Step 3: Write minimal implementation**  
Replace any occurrences with the explicit key‑passing version, obtaining the key via `DatabaseKeyManager.getKey()` where appropriate (e.g., in tests, provide a test key).

**Step 4: Run test to verify pass**  
Run same check; Expected: PASS.

**Step 5: Commit**  
```bash
git add -u
git commit -m "chore: remove deprecated AutofillRepository.create(Context) usage"
```

---

## Validation / End‑to‑end Checks

- Run the full test suite: `./gradlew check` (includes lint, unit tests, and connected Android tests if devices/emulators available).  
- Manually verify on an emulator/device:  
  1. Install fresh app → service starts without auth prompt.  
  2. Trigger autofill → auth prompt appears (if Keyguard locked).  
  3. After successful auth, subsequent autofill requests are immediate (no prompt).  
  4. Force‑stop app and repeat – first request after restart again prompts for auth (since key must be re‑retrieved from Keystore).  

**Risks / Tradeoffs:**  
- Slightly more complex service lazily initialization logic, but keeps security boundary clear.  
- Deprecating the internal overload may break existing tests; they must be updated to supply keys explicitly.  
- Ensure proper synchronization to avoid race‑condition when multiple threads first request repository.

**Open Questions:**  
- Should we expose a `clearRepository()` method for testing to simulate key removal?  
- Consider using `kotlin.lazy` with a synchronized initializer instead of manual `synchronized` block – evaluate for readability.

--- 

**Plan complete and saved. Ready to execute using subagent-driven-development — I'll dispatch a fresh subagent per task with two‑stage review (spec compliance then code quality). Shall I proceed?'