package com.kiyo.app.capacitor

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.view.autofill.AutofillManager
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.FragmentActivity
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.kiyo.app.autofill.repository.AutofillRepository
import com.kiyo.app.security.DatabaseKeyManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.async

@CapacitorPlugin(name = "KiyoAutofill")
class KiyoAutofillPlugin : Plugin() {

    companion object {
        private const val TAG = "KiyoAutofillPlugin"
        private const val KIYO_PACKAGE_NAME = "com.kiyo.app"
    }

    private var autofillRepository: AutofillRepository? = null

    // Policy layer for sync (extracted from syncAccountsFromReact)
    private lateinit var syncManager: AutofillSyncManager

    // Track pending sync call for auto-retry after authentication
    private var pendingSyncCall: PluginCall? = null
    private var pendingSyncAccountsJson: String? = null
    // 보안 다운그레이드 재시도 대기 플래그 (첫 동기화 시도 후 사용자 재클릭 시 리셋 진행)
    
    // ActivityResultLauncher for handling authentication result
    private lateinit var authActivityLauncher: ActivityResultLauncher<Intent>

    private val autofillManager: AutofillManager? by lazy {
        getContext()?.getSystemService(AutofillManager::class.java)
    }

    override fun load() {
        super.load()
        // Repository is lazily initialized on first use via ensureRepositoryInitialized()
        // This ensures proper initialization timing without blocking load()

        // Policy layer: sync decisions live in AutofillSyncManager (testable without Capacitor)
        syncManager = AutofillSyncManager(
            ensureRepository = { ensureRepositoryInitialized() },
            authNavigator = { accountsJson -> authActivityLauncher.launch(authIntent()) },
            invalidateRepository = {
                // 보안 리셋(다운그레이드 등) 후 예전 키로 열린 repository를 닫고 캐시를 비운다.
                // 다음 ensureRepositoryInitialized() 호출에서 새 키로 재생성된다.
                autofillRepository?.close()
                autofillRepository = null
            },
        )

        // Register ActivityResultLauncher for authentication.
        // Guarded so JVM unit tests (no Capacitor bridge) can call load() without crashing;
        // in production a bridge/activity is always present.
        val activity = try {
            getActivity()
        } catch (e: Exception) {
            Log.w(TAG, "No Capacitor activity at load() - skipping auth launcher registration", e)
            null
        } ?: return
        val fragmentActivity = activity as FragmentActivity
        authActivityLauncher = fragmentActivity.registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            handleAuthResult(result)
        }
    }

    private fun authIntent(): Intent {
        val context = getContext() ?: throw IllegalStateException("Context is null")
        // Launch AutofillAuthActivity directly for authentication.
        // Previously this launched MainActivity which delegated to AutofillAuthActivity,
        // but the ActivityResultLauncher was waiting for MainActivity's result (which never came).
        // IMPORTANT: Do NOT use FLAG_ACTIVITY_NEW_TASK here - it breaks ActivityResultLauncher
        // result delivery because the launched activity goes to a new task.
        return Intent(context, Class.forName("com.kiyo.app.autofill.auth.AutofillAuthActivity")).apply {
            putExtra("reason", "autofill_auth_required")
        }
    }

    private suspend fun ensureRepositoryInitialized(): AutofillRepository {
        return autofillRepository ?: CoroutineScope(Dispatchers.IO).async {
            val context = getContext() ?: throw IllegalStateException("Context is null")
            // [Autofill Matching Layer plan 2026-08-28]
            // 프로덕션 경로: DB_KEY + INDEX_KEY 모두 주입.
            // - DB_KEY: auth-required, 재래핑/리셋 가능 (DatabaseKeyManager.getKey)
            // - INDEX_KEY: non-auth, 즉시 사용 가능 (DatabaseKeyManager.getIndexKey)
            // 두 키 획득은 독립적이며 순서 무관. INDEX_KEY는 non-auth이므로 인증 프롬프트 발생 안 함.
            val dbKey = DatabaseKeyManager.getKey(context).encoded
            val indexKey = DatabaseKeyManager.getIndexKey(context)
            val repository = AutofillRepository.create(context, dbKey, indexKey)
            autofillRepository = repository
            Log.d(TAG, "AutofillRepository initialized with index helper")
            repository
        }.await()
    }

    private fun getActiveAutofillService(context: Context): ComponentName? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            return context.getSystemService(AutofillManager::class.java)?.autofillServiceComponentName
        } else {
            val serviceString = Settings.Secure.getString(
                context.contentResolver,
                "autofill_service"
            )
            return if (serviceString != null && serviceString.isNotEmpty()) {
                ComponentName.unflattenFromString(serviceString)
            } else null
        }
    }

    private fun getActiveAutofillServicePackageName(context: Context): String? {
        return getActiveAutofillService(context)?.packageName
    }

    private fun isKiyoAutofillServiceActive(context: Context): Boolean {
        return KIYO_PACKAGE_NAME == getActiveAutofillServicePackageName(context)
    }

    private fun buildAutofillStatus(context: Context): JSObject {
        val autofillManager = context.getSystemService(AutofillManager::class.java)
        val isEnabled = autofillManager?.isEnabled() == true
        val hasEnabledServices = autofillManager?.hasEnabledAutofillServices() == true

        val servicePackageName = getActiveAutofillServicePackageName(context)
        val isOurService = KIYO_PACKAGE_NAME == servicePackageName

        val enabled = isOurService && isEnabled

        val service = getActiveAutofillService(context)
        val serviceClassName = service?.className

        return JSObject().apply {
            put("enabled", enabled)
            put("hasService", hasEnabledServices)
            put("servicePackageName", servicePackageName)
            put("isOurService", isOurService)
            put("serviceClassName", serviceClassName)
        }
    }

    @PluginMethod
    fun isAutofillEnabled(call: PluginCall) {
        val context = getContext() ?: return call.reject("Context is null")

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve(JSObject().apply {
                put("enabled", false)
                put("hasService", false)
                put("servicePackageName", null)
                put("isOurService", false)
            })
            return
        }

        try {
            val result = buildAutofillStatus(context)
            Log.d(TAG, "isAutofillEnabled: $result")
            call.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking autofill status", e)
            call.reject("Failed to check autofill status: ${e.message}")
        }
    }

    @PluginMethod
    fun requestAutofillEnable(call: PluginCall) {
        val context = getContext() ?: return call.reject("Context is null")

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("Autofill requires Android 8.0 (API 26) or higher")
            return
        }

        try {
            val intent = Intent("android.settings.REQUEST_SET_AUTOFILL_SERVICE").apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            call.resolve()
        } catch (e: android.content.ActivityNotFoundException) {
            Log.w(TAG, "REQUEST_SET_AUTOFILL_SERVICE not found, trying fallback", e)
            try {
                val intent = Intent("android.settings.AUTOFILL_SETTINGS").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                call.resolve()
            } catch (e2: android.content.ActivityNotFoundException) {
                Log.e(TAG, "No autofill settings activity found", e2)
                call.reject("자동완성 설정 화면을 찾을 수 없습니다.")
            } catch (e2: Exception) {
                Log.e(TAG, "Error opening autofill settings fallback", e2)
                call.reject("자동완성 설정 열기 실패: ${e2.message}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error requesting autofill service", e)
            call.reject("자동완성 서비스 요청 실패: ${e.message}")
        }
    }

    @PluginMethod
    fun openAppForAuth(call: PluginCall) {
        val context = getContext() ?: return call.reject("Context is null")
        try {
            val intent = Intent(context, Class.forName("com.kiyo.app.MainActivity")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                putExtra("reason", "autofill_auth_required")
            }
            // Use ActivityResultLauncher to track result
            authActivityLauncher.launch(intent)
            call.resolve()
        } catch (e: Exception) {
            Log.e(TAG, "Error opening app for auth", e)
            call.reject("Failed to open app for authentication: ${e.message}")
        }
    }

    @PluginMethod
    fun ping(call: PluginCall) {
        Log.d(TAG, "Ping received from React")
        call.resolve(JSObject().apply {
            put("pong", true)
            put("timestamp", System.currentTimeMillis())
            put("message", "KiyoAutofill plugin is working")
        })
    }

    @PluginMethod
    fun getAutofillServiceInfo(call: PluginCall) {
        val context = getContext() ?: return call.reject("Context is null")

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("Autofill requires Android 8.0 (API 26) or higher")
            return
        }

        try {
            val result = buildAutofillStatus(context)
            Log.d(TAG, "getAutofillServiceInfo: $result")
            call.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting autofill service info", e)
            call.reject("Failed to get autofill service info: ${e.message}")
        }
    }

    @PluginMethod
    fun getAccounts(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val repository = ensureRepositoryInitialized()

                val packageName = call.getString("packageName")?.takeIf { it.isNotEmpty() }
                val domain = call.getString("domain")?.takeIf { it.isNotEmpty() }
                val favoritesOnly = call.getBoolean("favoritesOnly", false) ?: false

                val accounts = when {
                    packageName != null -> repository.findByPackageName(packageName)
                    domain != null -> repository.findByDomain(domain)
                    favoritesOnly -> repository.getFavoriteAccounts()
                    else -> repository.getAllAccounts()
                }

                val accountsArray = JSArray()
                for (account in accounts) {
                    accountsArray.put(JSObject().apply {
                        put("id", account.id)
                        put("username", account.username)
                        put("password", account.password)
                        put("title", account.title)
                        put("packageNames", JSArray(account.packageNames))
                        put("appName", account.appName)
                        put("domain", account.domain)
                        put("createdAt", account.createdAt)
                        put("updatedAt", account.updatedAt)
                        put("favorite", account.favorite)
                    })
                }

                call.resolve(JSObject().apply {
                    put("accounts", accountsArray)
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error getting accounts", e)
                call.reject("Failed to get accounts: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun updateAccount(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val repository = ensureRepositoryInitialized()

                val id = call.getLong("id") ?: return@launch call.reject("Valid account ID is required")
                if (id <= 0) return@launch call.reject("Valid account ID is required")

                val existing = repository.getAccountById(id) ?: return@launch call.reject("Account not found")

                val username = call.getString("username") ?: existing.username
                val password = call.getString("password") ?: existing.password
                val title = call.getString("title")?.takeIf { it.isNotEmpty() } ?: existing.title
                val packageName = call.getString("packageName")?.takeIf { it.isNotEmpty() }
                val appName = call.getString("appName")?.takeIf { it.isNotEmpty() } ?: existing.appName
                val domain = call.getString("domain")?.takeIf { it.isNotEmpty() } ?: existing.domain
                val favorite = call.getBoolean("favorite") ?: existing.favorite

                val packageNames = existing.packageNames.toMutableList()
                packageName?.let { if (it !in packageNames) packageNames.add(it) }

                val updated = AutofillRepository.AutofillAccount(
                    id = id,
                    username = username,
                    password = password,
                    title = title,
                    packageNames = packageNames,
                    appName = appName,
                    domain = domain,
                    createdAt = existing.createdAt,
                    updatedAt = System.currentTimeMillis(),
                    favorite = favorite
                )

                val count = repository.updateAccount(updated)

                call.resolve(JSObject().apply {
                    put("updated", count > 0)
                    put("id", id)
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error updating account", e)
                call.reject("Failed to update account: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun deleteAccount(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val repository = ensureRepositoryInitialized()

                val id = call.getLong("id") ?: return@launch call.reject("Valid account ID is required")
                if (id <= 0) return@launch call.reject("Valid account ID is required")

                val count = repository.deleteAccount(id)

                call.resolve(JSObject().apply {
                    put("deleted", count > 0)
                    put("id", id)
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error deleting account", e)
                call.reject("Failed to delete account: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun toggleFavorite(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val repository = ensureRepositoryInitialized()

                val id = call.getLong("id") ?: return@launch call.reject("Valid account ID is required")
                if (id <= 0) return@launch call.reject("Valid account ID is required")

                val success = repository.toggleFavorite(id)

                call.resolve(JSObject().apply {
                    put("success", success)
                    put("id", id)
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error toggling favorite", e)
                call.reject("Failed to toggle favorite: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun getAccountCount(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val repository = ensureRepositoryInitialized()
                val count = repository.getAccountCount()
                call.resolve(JSObject().apply {
                    put("count", count)
                })
            } catch (e: android.security.keystore.UserNotAuthenticatedException) {
                Log.d(TAG, "User authentication required for getAccountCount")
                call.resolve(JSObject().apply {
                    put("authRequired", true)
                    put("success", false)
                    put("message", "Authentication required to access autofill database")
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error getting account count", e)
                call.reject("Failed to get account count: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun clearAllAccounts(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val repository = ensureRepositoryInitialized()
                val count = repository.deleteAllAccounts()

                call.resolve(JSObject().apply {
                    put("deletedCount", count)
                    put("success", true)
                })
            } catch (e: android.security.keystore.UserNotAuthenticatedException) {
                Log.d(TAG, "User authentication required for clearAllAccounts")
                call.resolve(JSObject().apply {
                    put("authRequired", true)
                    put("success", false)
                    put("message", "Authentication required to access autofill database")
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error clearing all accounts", e)
                call.reject("Failed to clear all accounts: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun syncAccountsFromReact(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val context = getContext() ?: return@launch call.reject("Context is null")
                val accountsJson = call.getString("accountsJson") ?: return@launch call.reject("No accounts JSON provided")

                // Policy decisions (downgrade reset, upgrade flag, repository init) live in AutofillSyncManager
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
            } catch (e: android.security.keystore.UserNotAuthenticatedException) {
                // Authentication required - store pending sync and trigger auth
                Log.d(TAG, "User authentication required for sync - storing pending sync")
                pendingSyncCall = call
                pendingSyncAccountsJson = call.getString("accountsJson")

                // Open auth activity and track result
                authActivityLauncher.launch(authIntent())
            } catch (e: Exception) {
                Log.e(TAG, "Error syncing accounts from React", e)
                call.reject("Failed to sync accounts: ${e.message}")
            }
        }
    }

    // Test-only method to sync accounts directly from native test code
    // This bypasses the JS bridge but uses the same Keystore-protected AutofillRepository
    @PluginMethod
    fun syncAccountsForTest(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val repository = ensureRepositoryInitialized()

                val username = call.getString("username") ?: return@launch call.reject("username required")
                val password = call.getString("password") ?: return@launch call.reject("password required")
                val domain = call.getString("domain") ?: return@launch call.reject("domain required")
                val packageNamesJson = call.getString("packageNames") ?: "[]"
                val appName = call.getString("appName") ?: "Autofill Test Host"
                val title = call.getString("title") ?: "Test Account"

                // Parse packageNames from JSON array string
                val packageNames = try {
                    val jsonArray = org.json.JSONArray(packageNamesJson)
                    val list = mutableListOf<String>()
                    for (i in 0 until jsonArray.length()) {
                        list.add(jsonArray.getString(i))
                    }
                    list
                } catch (e: Exception) {
                    listOf("com.kiyo.autofilltest")
                }

                // Create test account JSON
                val accountsJsonArray = org.json.JSONArray()
                val account = org.json.JSONObject()
                account.put("username", username)
                account.put("password", password)
                account.put("domain", domain)
                account.put("packageNames", org.json.JSONArray(packageNames))
                account.put("appName", appName)
                account.put("title", title)
                account.put("createdAt", System.currentTimeMillis())
                account.put("updatedAt", System.currentTimeMillis())
                account.put("favorite", false)
                accountsJsonArray.put(account)

                val accountsJson = accountsJsonArray.toString()
                Log.d(TAG, "Test sync: $accountsJson")

                val result = repository.syncAccountsFromReact(accountsJson)
                call.resolve(JSObject().apply {
                    put("syncedCount", result.first)
                    put("errorCount", result.second)
                    put("success", result.second == 0)
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error syncing test accounts", e)
                call.reject("Failed to sync test accounts: ${e.message}")
            }
        }
    }

    /**
     * Handle authentication activity result.
     * If authentication succeeded, retry the pending sync operation.
     * If authentication failed or was cancelled, reject the pending call with authRequired.
     */
    private fun handleAuthResult(result: androidx.activity.result.ActivityResult) {
        if (pendingSyncCall == null) {
            Log.d(TAG, "Auth result received but no pending sync call")
            return
        }

        val call = pendingSyncCall!!
        val accountsJson = pendingSyncAccountsJson
        pendingSyncCall = null
        pendingSyncAccountsJson = null

        if (result.resultCode == Activity.RESULT_OK) {
            // Authentication succeeded - retry sync via policy layer
            Log.d(TAG, "Authentication succeeded - retrying sync")
            syncManager.handleAuthResult(
                resultCode = result.resultCode,
                accountsJson = accountsJson,
                onSuccess = { syncResult ->
                    call.resolve(JSObject().apply {
                        put("syncedCount", syncResult.syncedCount)
                        put("errorCount", syncResult.errorCount)
                        put("success", syncResult.success)
                    })
                },
                onCancel = {
                    call.resolve(JSObject().apply {
                        put("authRequired", true)
                        put("success", false)
                        put("message", "Authentication required to access autofill database")
                    })
                }
            )
        } else {
            // Authentication failed or cancelled
            Log.d(TAG, "Authentication failed or cancelled - resultCode: ${result.resultCode}")
            call.resolve(JSObject().apply {
                put("authRequired", true)
                put("success", false)
                put("message", "Authentication cancelled or failed")
            })
        }
    }
}