package com.kiyo.app.capacitor

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.view.autofill.AutofillManager
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.kiyo.app.autofill.repository.AutofillRepository
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

    private val autofillManager: AutofillManager? by lazy {
        getContext()?.getSystemService(AutofillManager::class.java)
    }

    override fun load() {
        super.load()
        // Repository is lazily initialized on first use via ensureRepositoryInitialized()
        // This ensures proper initialization timing without blocking load()
    }

    private suspend fun ensureRepositoryInitialized(): AutofillRepository {
        return autofillRepository ?: CoroutineScope(Dispatchers.IO).async {
            val context = getContext() ?: throw IllegalStateException("Context is null")
            val repository = AutofillRepository.create(context)
            autofillRepository = repository
            Log.d(TAG, "AutofillRepository initialized")
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
                val repository = ensureRepositoryInitialized()

                val accountsJson = call.getString("accountsJson") ?: return@launch call.reject("No accounts JSON provided")

                val result = repository.syncAccountsFromReact(accountsJson)
                call.resolve(JSObject().apply {
                    put("syncedCount", result.first)
                    put("errorCount", result.second)
                    put("success", result.second == 0)
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error syncing accounts from React", e)
                call.reject("Failed to sync accounts: ${e.message}")
            }
        }
    }
}