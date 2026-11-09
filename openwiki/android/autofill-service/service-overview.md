---
type: android-component
title: KiyoAutofillService
description: Lifecycle and request handlers for the Android AutofillService entry point (per-request fresh repository, two-stage fill, onSaveRequest).
tags: [android, autofill, service, lifecycle]
---

# KiyoAutofillService

`/android/app/src/main/java/com/kiyo/app/autofill/service/KiyoAutofillService.kt` is the Android `AutofillService` entry point. It is invoked by the system Autofill Framework when a user focuses an autofillable field in any app (other than KIYO itself).

## Lifecycle

```kotlin
class KiyoAutofillService : AutofillService() {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        // Intentionally left blank – no key acquisition here.
        // Repository is created per-request (fresh), never cached.
    }

    override fun onDestroy() {
        executor.shutdown()
        super.onDestroy()
    }
}
```

`onCreate` is **intentionally empty**. No key, no repository, no cached state. Every fill/save request constructs a fresh `AutofillRepository`, uses it, and closes it in `finally`. This is the v3 design principle: avoid stale-key issues after `DatabaseKeyManager.rewrapDbKey` or KPInvalidated resets. A new repository always reads the current alias pointer, decrypts with the current master key, and reflects the latest persisted state.

## onFillRequest

Two-stage matching that separates non-auth (index) from auth-required (main) DB access:

```mermaid
flowchart TD
    A[onFillRequest] --> B[Extract packages + domain from AssistStructure]
    B --> C[FieldDetector: findBestFieldCandidate username + password]
    C --> D{Any fields found?}
    D -->|No| E[callback.onSuccess(null)]
    D -->|Yes| F[DatabaseKeyManager.getIndexKey]
    F --> G[AutofillRepository.createForIndexOnly]
    G --> H[findMatchingAccountIdsByIndex]
    H --> I{Matches?}
    I -->|No| E
    I -->|Yes| J[DatabaseKeyManager.getKey]
    J -->|UserNotAuthenticatedException| K[FillResponseBuilder.createAuthResponse]
    K --> L[callback.onSuccess authResponse]
    J -->|Success| M[AutofillRepository.create w/ dbKey + indexKey]
    M --> N[getAccountsByIds]
    N --> O{Accounts found?}
    O -->|No| E
    O -->|Yes| P[FillResponseBuilder.createFillResponse]
    P --> Q[callback.onSuccess fillResponse]
```

### Self-filter

```kotlin
val packageNames = allPackages
    .filter { !it.equals("com.kiyo.app", ignoreCase = true) && !it.startsWith("android") }
    .distinct()
```

`com.kiyo.app` is always filtered out so the vault UI never autofills itself. Generic `android.*` packages are also excluded.

### Self-skip on save

`onSaveRequest` independently checks for `com.kiyo.app` and returns silently if the user is in KIYO itself.

### Auth-response path

When `DatabaseKeyManager.getKey` throws `UserNotAuthenticatedException`, the service constructs an auth response via `FillResponseBuilder.createAuthResponse` rather than prompting in-process. The system displays a chooser; choosing KIYO triggers `AutofillAuthActivity` (via `Settings.Secure` autofill flow). After auth succeeds, the user re-focuses the field and a new `onFillRequest` is issued.

### Repository close

In both stages (index and main), the repository is closed in `finally`:

```kotlin
finally {
    try { indexRepo?.close() } catch (e: Exception) { Log.w(TAG, "Error closing index repository", e) }
    try { mainRepo?.close() } catch (e: Exception) { Log.w(TAG, "Error closing main repository", e) }
}
```

This is critical for the per-request fresh-repository invariant. A leaked connection holds the SQLCipher key in memory and can stall subsequent requests.

## onSaveRequest

```kotlin
override fun onSaveRequest(
    request: SaveRequest,
    callback: SaveCallback
) {
    CoroutineScope(Dispatchers.IO).launch {
        var repo: AutofillRepository? = null
        try {
            val dbKey = try {
                DatabaseKeyManager.getKey(this@KiyoAutofillService).encoded
            } catch (e: UserNotAuthenticatedException) {
                handler.post { callback.onSuccess() }
                return@launch
            }
            // ... extract credentials, build AutofillAccount, upsertAccount ...
            handler.post { callback.onSuccess() }
        } finally {
            repo?.close()
        }
    }
}
```

`SaveCallback` does not support auth UI. If the user is not authenticated, the save is silently dropped (`callback.onSuccess()` with no DB write). Otherwise, `CredentialExtractor` reads `AutofillValue` from the focused fields, builds an `AutofillAccount`, and upserts it via `AutofillRepository.upsertAccount`.

### Login form check

```kotlin
val hasLoginForm = FieldDetector.hasLoginForm(rootViewNode)
if (!hasLoginForm) return@launch
```

Save is only offered if both username and password fields are detected. This avoids saving to non-login forms.

## openKiyoApp helper

```kotlin
private fun openKiyoApp() {
    val intent = Intent(this, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
        putExtra("reason", "autofill_auth_required")
    }
    startActivity(intent)
}
```

Reserved for future use as a fallback when the system auth flow is unavailable. The current implementation prefers the system-driven `FillResponseBuilder.createAuthResponse` path.

## Companion utilities

```kotlin
fun isAutofillEnabled(context: Context): Boolean
fun isCurrentAutofillService(context: Context): Boolean
```

`isAutofillEnabled` queries `AutofillManager.hasEnabledAutofillServices()`. `isCurrentAutofillService` checks `Settings.Secure.getString("autofill_service")` against `ComponentName(context, KiyoAutofillService::class.java)`.

These are exposed via the Capacitor plugin (`KiyoAutofillPlugin.isAutofillEnabled`) so React can decide whether to call `syncAccountsFromReact`.

## Source Anchors

- `KiyoAutofillService.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/service/KiyoAutofillService.kt`
- `AutofillRepository.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillRepository.kt`
- `FieldDetector.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/detection/FieldDetector.kt`
- `CredentialExtractor.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/credential/CredentialExtractor.kt`
- `FillResponseBuilder.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/response/FillResponseBuilder.kt`
- `DatabaseKeyManager.kt` — `/android/app/src/main/java/com/kiyo/app/security/DatabaseKeyManager.kt`

## Tests

- E2E: `/android/app/src/androidTest/java/com/kiyo/app/autofill/AutofillE2ETest.kt`
- E2E: `/android/app/src/androidTest/java/com/kiyo/app/autosave/AutosaveE2ETest.kt`
- Unit (smoke): `/android/app/src/test/java/com/kiyo/app/capacitor/KiyoAutofillPluginTest.kt`