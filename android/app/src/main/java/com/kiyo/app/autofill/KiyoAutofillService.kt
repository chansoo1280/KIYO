package com.kiyo.app.autofill

import android.app.assist.AssistStructure
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.net.Uri
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.service.autofill.AutofillService
import android.service.autofill.Dataset
import android.service.autofill.FillCallback
import android.service.autofill.FillContext
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveInfo
import android.service.autofill.SaveRequest
import android.util.Base64
import android.util.Log
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.core.os.HandlerCompat
import androidx.fragment.app.FragmentActivity
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.kiyo.app.R
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties

/**
 * Android Autofill Service for KIYO Password Manager
 * Provides autofill functionality for Android apps (API 26+)
 * Uses official Android Autofill Dataset API
 *
 * Implementation:
 * - onFillRequest: traverses ViewNode, finds username/password fields, returns accounts from repository
 * - onSaveRequest: extracts username/password, updates existing or saves new account to repository
 * - ViewNode traversal for username/password field detection
 * - Shows save UI only on login forms (username + password fields present)
 * - Domain-based account matching with subdomain support
 * - Biometric authentication protection for autofill via KiyoBiometricActivity
 * */
class KiyoAutofillService : AutofillService() {

    private val TAG = "KiyoAutofillService"
    private lateinit var repository: AutofillRepository
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())
    private var cancellationSignal = CancellationSignal()
    private var pendingFillRequest: FillRequest? = null
    private var pendingCallback: FillCallback? = null
    private var isAuthenticating = false
    private var pendingAccounts: List<AutofillRepository.AutofillAccount>? = null
    private var pendingUsernameId: AutofillId? = null
    private var pendingPasswordId: AutofillId? = null
    private var pendingSaveInfo: SaveInfo? = null
    private var pendingPackageName: String? = null
    
    // BiometricPrompt integration
    private var biometricPrompt: BiometricPrompt? = null
    private var biometricExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val pendingRequests = ConcurrentHashMap<Long, PendingFillRequest>()
    private val requestIdGenerator = AtomicLong(0)
    private val authInProgress = AtomicBoolean(false)
    private val authTimeoutMs = 30000L // 30 seconds timeout for biometric auth
    
    // SharedPreferences key for biometric setting (shared with main app)
    private val PREFS_NAME = "kiyo_autofill_prefs"
    private val KEY_BIOMETRIC_ENABLED = "biometric_enabled"

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Autofill service created")
        repository = AutofillRepository(this)
        initBiometricPrompt()
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "Autofill service destroyed")
        repository.close()
        cancellationSignal.cancel()
        executor.shutdown()
        biometricExecutor.shutdown()
        biometricPrompt = null
    }

    private fun initBiometricPrompt() {
        // AutofillService is a Service, not an Activity/Fragment, so we need to use the Application context
        // with a FragmentActivity wrapper or use the executor directly
        biometricPrompt = BiometricPrompt(
            this as FragmentActivity,
            biometricExecutor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    Log.d(TAG, "Biometric authentication error: $errorCode - $errString")
                    handleBiometricError(errorCode, errString.toString())
                }

                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    Log.d(TAG, "Biometric authentication succeeded")
                    handleBiometricSuccess()
                }

                override fun onAuthenticationFailed() {
                    super.onAuthenticationFailed()
                    Log.d(TAG, "Biometric authentication failed")
                    handleBiometricFailure("Authentication failed")
                }
            }
        )
    }

    private fun handleBiometricSuccess() {
        authInProgress.set(false)
        handler.post {
            // Find and complete the pending request
            val requestId = pendingRequests.keys.firstOrNull()
            requestId?.let { id ->
                val pendingRequest = pendingRequests.remove(id)
                pendingRequest?.let { req ->
                    sendAutofillResponse(req.accounts, req.usernameId, req.passwordId, req.saveInfo)
                }
            } ?: run {
                Log.w(TAG, "No pending request found for biometric success")
            }
        }
    }

    private fun handleBiometricFailure(error: String) {
        authInProgress.set(false)
        handler.post {
            val requestId = pendingRequests.keys.firstOrNull()
            requestId?.let { id ->
                val pendingRequest = pendingRequests.remove(id)
                pendingRequest?.let { req ->
                    Log.d(TAG, "Biometric auth failed for request $id: $error")
                    req.callback?.onSuccess(null)
                }
            } ?: run {
                Log.w(TAG, "No pending request found for biometric failure")
            }
        }
    }

    private fun handleBiometricError(errorCode: Int, errorMessage: String) {
        authInProgress.set(false)
        handler.post {
            val requestId = pendingRequests.keys.firstOrNull()
            requestId?.let { id ->
                val pendingRequest = pendingRequests.remove(id)
                pendingRequest?.let { req ->
                    Log.d(TAG, "Biometric auth error for request $id: $errorCode - $errorMessage")
                    req.callback?.onSuccess(null)
                }
            } ?: run {
                Log.w(TAG, "No pending request found for biometric error")
            }
        }
    }

    private fun sendAutofillResponse(
        accounts: List<AutofillRepository.AutofillAccount>,
        usernameId: AutofillId?,
        passwordId: AutofillId?,
        saveInfo: SaveInfo?
    ) {
        val responseBuilder = FillResponse.Builder()
        saveInfo?.let { responseBuilder.setSaveInfo(it) }

        accounts.forEach { account ->
            val siteName = account.title ?: account.appName ?: account.packageName ?: "Unknown Site"
            val domain = account.domain ?: account.packageName ?: ""

            val presentation = RemoteViews(this@KiyoAutofillService.packageName, R.layout.autofill_dataset_item)
            presentation.setTextViewText(R.id.tv_site_name, siteName)
            presentation.setTextViewText(R.id.tv_domain, domain)
            presentation.setTextViewText(R.id.tv_username, account.username)

            // Set site icon based on priority: account icon -> website preset icon -> default icon
            val iconResId = getSiteIconResource(account)
            presentation.setImageViewResource(R.id.iv_site_icon, iconResId)

            val datasetBuilder = Dataset.Builder(presentation)
            usernameId?.let { id ->
                datasetBuilder.setValue(id, AutofillValue.forText(account.username))
                Log.d(TAG, "Set username value for id=$id: ${account.username}")
            }
            passwordId?.let { id ->
                datasetBuilder.setValue(id, AutofillValue.forText(account.password))
                Log.d(TAG, "Set password value for id=$id")
            }
            responseBuilder.addDataset(datasetBuilder.build())
            Log.d(TAG, "Added dataset for account: ${account.username}, site: $siteName, domain: $domain")
        }

        val response = responseBuilder.build()
        // Find the callback for the current request
        val requestId = pendingRequests.keys.firstOrNull()
        requestId?.let { id ->
            val pendingRequest = pendingRequests.remove(id)
            pendingRequest?.callback?.onSuccess(response)
            Log.d(TAG, "Autofill response sent with ${accounts.size} datasets after biometric auth")
        } ?: run {
            Log.w(TAG, "No pending callback found for autofill response")
        }
    }

    /**
     * Get the site icon resource ID based on priority:
     * 1. Account icon (if stored in account)
     * 2. Website preset icon (matched by domain)
     * 3. Default icon
     */
    private fun getSiteIconResource(account: AutofillRepository.AutofillAccount): Int {
        // Priority 1: Check if account has a custom icon (not implemented in current model, fallback to preset)
        // Priority 2: Match domain to website preset
        val domain = account.domain ?: account.packageName ?: ""
        if (domain.isNotEmpty()) {
            val presetIconResId = getWebsitePresetIconResource(domain)
            if (presetIconResId != 0) {
                return presetIconResId
            }
        }
        // Priority 3: Default icon
        return R.drawable.ic_default
    }

    /**
     * Get website preset icon resource ID by domain
     * Maps known domains to their drawable resources
     */
    private fun getWebsitePresetIconResource(domain: String): Int {
        val normalizedDomain = domain.lowercase(Locale.getDefault())
        return when {
            normalizedDomain.contains("google.com") || normalizedDomain.contains("gmail.com") -> R.drawable.ic_google
            normalizedDomain.contains("naver.com") -> R.drawable.ic_naver
            normalizedDomain.contains("kakao.com") -> R.drawable.ic_kakao
            normalizedDomain.contains("microsoft.com") || normalizedDomain.contains("outlook.com") || normalizedDomain.contains("hotmail.com") -> R.drawable.ic_microsoft
            normalizedDomain.contains("apple.com") || normalizedDomain.contains("icloud.com") -> R.drawable.ic_apple
            normalizedDomain.contains("github.com") -> R.drawable.ic_github
            normalizedDomain.contains("discord.com") -> R.drawable.ic_discord
            normalizedDomain.contains("instagram.com") -> R.drawable.ic_instagram
            normalizedDomain.contains("facebook.com") || normalizedDomain.contains("fb.com") -> R.drawable.ic_facebook
            normalizedDomain.contains("twitter.com") || normalizedDomain.contains("x.com") -> R.drawable.ic_twitter
            normalizedDomain.contains("netflix.com") -> R.drawable.ic_netflix
            normalizedDomain.contains("steampowered.com") || normalizedDomain.contains("steamcommunity.com") -> R.drawable.ic_steam
            normalizedDomain.contains("amazon.com") -> R.drawable.ic_amazon
            normalizedDomain.contains("dropbox.com") -> R.drawable.ic_dropbox
            else -> 0
        }
    }

    private fun clearPendingRequest() {
        pendingFillRequest = null
        pendingCallback = null
        pendingAccounts = null
        pendingUsernameId = null
        pendingPasswordId = null
        pendingSaveInfo = null
        pendingPackageName = null
        cancellationSignal.cancel()
        cancellationSignal = CancellationSignal()
    }

    private fun startBiometricAuth(
        accounts: List<AutofillRepository.AutofillAccount>,
        usernameId: AutofillId?,
        passwordId: AutofillId?,
        saveInfo: SaveInfo?,
        packageName: String?
    ) {
        // Prevent duplicate authentication
        if (authInProgress.getAndSet(true)) {
            Log.d(TAG, "Biometric authentication already in progress, skipping duplicate")
            // Queue this request as pending
            val requestId = requestIdGenerator.incrementAndGet()
            val pendingRequest = PendingFillRequest(
                requestId = requestId,
                accounts = accounts,
                usernameId = usernameId,
                passwordId = passwordId,
                saveInfo = saveInfo,
                packageName = packageName,
                callback = pendingCallback!!
            )
            pendingRequests[requestId] = pendingRequest
            
            // Set timeout for this pending request
            handler.postDelayed({
                val req = pendingRequests.remove(requestId)
                req?.callback?.onSuccess(null)
                Log.d(TAG, "Pending request $requestId timed out")
            }, authTimeoutMs)
            return
        }

        // Store the current request
        val requestId = requestIdGenerator.incrementAndGet()
        val pendingRequest = PendingFillRequest(
            requestId = requestId,
            accounts = accounts,
            usernameId = usernameId,
            passwordId = passwordId,
            saveInfo = saveInfo,
            packageName = packageName,
            callback = pendingCallback!!
        )
        pendingRequests[requestId] = pendingRequest

        // Set timeout for biometric authentication
        handler.postDelayed({
            if (authInProgress.get()) {
                authInProgress.set(false)
                val req = pendingRequests.remove(requestId)
                req?.callback?.onSuccess(null)
                Log.d(TAG, "Biometric authentication timed out for request $requestId")
            }
        }, authTimeoutMs)

        // Build BiometricPrompt info
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("KIYO 자동완성")
            .setSubtitle("자동완성을 위해 생체 인증이 필요합니다.")
            .setDescription(packageName?.let { "앱: $it" } ?: "자동완성 인증")
            .setNegativeButtonText("취소")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
            .build()

        // Authenticate
        biometricPrompt?.authenticate(promptInfo)
        Log.d(TAG, "Biometric authentication started for ${accounts.size} accounts (requestId: $requestId)")
    }

    // Data class for pending fill requests
    private data class PendingFillRequest(
        val requestId: Long,
        val accounts: List<AutofillRepository.AutofillAccount>,
        val usernameId: AutofillId?,
        val passwordId: AutofillId?,
        val saveInfo: SaveInfo?,
        val packageName: String?,
        val callback: FillCallback
    )

    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        Log.d(TAG, "onFillRequest() called")

        // Cancel any pending authentication
        if (isAuthenticating) {
            Log.d(TAG, "Cancelling previous authentication for new request")
            clearPendingRequest()
        }

        val fillContexts = request.fillContexts
        if (fillContexts == null || fillContexts.isEmpty()) {
            Log.d(TAG, "No fill contexts")
            callback.onSuccess(null)
            return
        }

        val structure = fillContexts[0].structure
        if (structure == null) {
            Log.d(TAG, "No structure in fill context")
            callback.onSuccess(null)
            return
        }

        val rootNode = structure.getWindowNodeAt(0).rootViewNode
        if (rootNode == null) {
            Log.d(TAG, "No root view node")
            callback.onSuccess(null)
            return
        }

        // Find username and password field IDs
        var usernameId: AutofillId? = null
        var passwordId: AutofillId? = null

        fun traverse(node: AssistStructure.ViewNode) {
            node.autofillHints?.let { hints ->
                if (hints.contains("username")) {
                    usernameId = node.autofillId
                    Log.d(TAG, "usernameId found=$usernameId")
                }
                if (hints.contains("current-password")) {
                    passwordId = node.autofillId
                    Log.d(TAG, "passwordId found=$passwordId")
                }
            }
            for (i in 0 until node.childCount) {
                traverse(node.getChildAt(i))
            }
        }
        traverse(rootNode)

        if (usernameId == null && passwordId == null) {
            Log.d(TAG, "No autofill fields")
            callback.onSuccess(null)
            return
        }

        // ============================================================
        // 1. Log detailed request app information
        // ============================================================
        val fillContext = fillContexts[0]
        val activityComponent = fillContext.structure?.activityComponent
        val packageName = activityComponent?.packageName
        val activityClassName = activityComponent?.className
        val domain = extractDomainFromStructure(fillContext.structure)
        val activityComponentInfo = activityComponent?.flattenToString() ?: "null"
        val webDomainFromStructure = extractWebDomainFromStructure(fillContext.structure)

        Log.d(TAG, "===== Autofill Request Info =====")
        Log.d(TAG, "Requested:")
        Log.d(TAG, "  packageName=$packageName")
        Log.d(TAG, "  activityClassName=$activityClassName")
        Log.d(TAG, "  activityComponent=$activityComponentInfo")
        Log.d(TAG, "  domain=$domain")
        Log.d(TAG, "  webDomainFromStructure=$webDomainFromStructure")
        Log.d(TAG, "  hasUsernameField=${usernameId != null}")
        Log.d(TAG, "  hasPasswordField=${passwordId != null}")
        Log.d(TAG, "=================================")

        // ============================================================
        // 2. Fetch accounts with improved priority matching
        // Priority:
        // 1. packageName exact match (Android apps)
        // 2. domain exact match (web)
        // 3. domain subdomain match (e.g., login.naver.com -> naver.com)
        // 4. fallback to all accounts
        // ============================================================
        val accounts = when {
            packageName != null && packageName.isNotEmpty() -> {
                Log.d(TAG, "Priority 1: Matching accounts by packageName: $packageName")
                repository.findByPackageName(packageName)
            }
            domain != null && domain.isNotEmpty() -> {
                Log.d(TAG, "Priority 2: Matching accounts by domain (exact): $domain")
                val exactMatches = repository.findByDomain(domain)
                if (exactMatches.isNotEmpty()) {
                    Log.d(TAG, "  Found ${exactMatches.size} exact domain matches")
                    exactMatches
                } else {
                    // Priority 3: Try subdomain matching (e.g., login.naver.com -> naver.com)
                    val parentDomain = extractParentDomain(domain)
                    if (parentDomain != domain) {
                        Log.d(TAG, "Priority 3: Trying parent domain match: $parentDomain")
                        val parentMatches = repository.findByDomain(parentDomain)
                        if (parentMatches.isNotEmpty()) {
                            Log.d(TAG, "  Found ${parentMatches.size} parent domain matches")
                            parentMatches
                        } else {
                            Log.d(TAG, "  No parent domain matches, falling back to all accounts")
                            repository.getAllAccounts()
                        }
                    } else {
                        Log.d(TAG, "  No parent domain (already top-level), falling back to all accounts")
                        repository.getAllAccounts()
                    }
                }
            }
            else -> {
                Log.d(TAG, "Priority 4: No packageName or domain, fetching all accounts")
                repository.getAllAccounts()
            }
        }

        // Log matched accounts
        if (accounts.isNotEmpty()) {
            Log.d(TAG, "===== Matched Accounts =====")
            accounts.forEach { account ->
                Log.d(TAG, "  Matched: account=${account.username}, domain=${account.domain}, packageName=${account.packageName}, appName=${account.appName}")
            }
            Log.d(TAG, "=============================")
        } else {
            Log.d(TAG, "No accounts matched for package: $packageName, domain: $domain")
        }

        // Add SaveInfo to show save UI only on login forms (both username and password fields present)
        val hasUsernameField = usernameId != null
        val hasPasswordField = passwordId != null
        val isLoginForm = hasUsernameField && hasPasswordField

        val saveInfo = if (isLoginForm) {
            SaveInfo.Builder(SaveInfo.SAVE_DATA_TYPE_PASSWORD).build()
        } else {
            null
        }

        if (accounts.isEmpty()) {
            Log.d(TAG, "No accounts found, sending empty response with SaveInfo")
            val responseBuilder = FillResponse.Builder()
            saveInfo?.let { responseBuilder.setSaveInfo(it) }
            callback.onSuccess(responseBuilder.build())
            return
        }

        // Store pending request for biometric authentication
        pendingFillRequest = request
        pendingCallback = callback

        // Check if biometric authentication is enabled in settings
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val biometricEnabled = prefs.getBoolean(KEY_BIOMETRIC_ENABLED, true) // Default true
        
        if (biometricEnabled) {
            // Start biometric authentication
            startBiometricAuth(accounts, usernameId, passwordId, saveInfo, packageName)
            Log.d(TAG, "Biometric authentication initiated for ${accounts.size} accounts")
        } else {
            // Biometric disabled - send autofill response directly without authentication
            Log.d(TAG, "Biometric authentication disabled, sending autofill response directly")
            sendAutofillResponse(accounts, usernameId, passwordId, saveInfo)
        }
    }

    override fun onSaveRequest(
        request: SaveRequest,
        callback: SaveCallback
    ) {
        Log.d(TAG, "onSaveRequest() called")

        // Extract username and password from the save request
        val username = extractTextValue(request, "username")
        val password = extractTextValue(request, "current-password")

        Log.d(TAG, "Extracted username: $username, password: ${if (password != null) "***" else "null"}")

        if (username == null || username.isEmpty() || password == null || password.isEmpty()) {
            Log.w(TAG, "Username or password is empty, not saving")
            callback.onSuccess()
            return
        }

        // Get package name from the request context
        val packageName = request.fillContexts?.firstOrNull()?.structure?.activityComponent?.packageName
        Log.d(TAG, "Package name from save request: $packageName")

        // Extract domain from the request context (for web autofill matching)
        val domain = extractDomainFromSaveRequest(request)
        Log.d(TAG, "Domain from save request: $domain")

        // Get app name using PackageManager
        val appName = if (packageName != null && packageName.isNotEmpty()) {
            getAppNameFromPackage(packageName)
        } else {
            null
        }
        Log.d(TAG, "App name from PackageManager: $appName")

        // ============================================================
        // Find existing account with priority:
        // 1. Exact match: username + packageName (Android app)
        // 2. Exact match: username + domain (web)
        // 3. Username only (fallback - for linking packageName to existing web account)
        // ============================================================
        var existingAccount = repository.findByUsernameAndPackage(username, packageName, null)
        var matchType = "packageName"

        if (existingAccount == null && domain != null && domain.isNotEmpty()) {
            existingAccount = repository.findByUsernameAndPackage(username, null, domain)
            matchType = "domain"
        }

        if (existingAccount == null) {
            // Fallback: find by username only (to link packageName to existing web account)
            existingAccount = repository.findByUsername(username)
            matchType = "username"
        }

        if (existingAccount != null) {
            // Determine if we should add packageName
            // Only add packageName if:
            // - Current request has a packageName
            // - Account doesn't already have this packageName
            // - Account has a domain (indicating it was a web account) OR matchType is username
            val shouldAddPackageName = packageName != null && packageName.isNotEmpty() &&
                !existingAccount.hasPackageName(packageName) &&
                (existingAccount.domain != null || matchType == "username")

            var updatedAccount = existingAccount.copy(
                password = password, // Will be encrypted by updateAccount
                appName = existingAccount.appName ?: appName,
                updatedAt = System.currentTimeMillis()
            )

            // Add packageName to the account's packageNames JSON array if needed
            if (shouldAddPackageName) {
                updatedAccount = updatedAccount.addPackageName(packageName)
                Log.d(TAG, "Added packageName $packageName to existing account: $username")
            }

            repository.updateAccount(updatedAccount)
            Log.d(TAG, "Updated existing account: $username, matchType: $matchType, shouldAddPackageName: $shouldAddPackageName, packageName: ${updatedAccount.packageName}, packageNames: ${updatedAccount.packageNames}, domain: ${updatedAccount.domain}")
        } else {
            // Save new account to repository with encryption and appName
            val newAccount = AutofillRepository.AutofillAccount(
                username = username,
                password = password,
                title = null,
                packageName = packageName,
                appName = appName,
                domain = domain,
                createdAt = System.currentTimeMillis(),
                updatedAt = System.currentTimeMillis(),
                favorite = false
            )
            val id = repository.insertAccountEncrypted(newAccount)
            Log.d(TAG, "Inserted new account with id: $id, username: $username, packageName: $packageName, domain: $domain, appName: $appName")
        }

        callback.onSuccess()
    }

    /**
     * Get application name from package name using PackageManager
     */
    private fun getAppNameFromPackage(packageName: String): String? {
        return try {
            val packageManager = packageManager
            val applicationInfo = packageManager.getApplicationInfo(packageName, 0)
            packageManager.getApplicationLabel(applicationInfo).toString()
        } catch (e: PackageManager.NameNotFoundException) {
            Log.w(TAG, "Package not found: $packageName", e)
            null
        } catch (e: Exception) {
            Log.w(TAG, "Error getting app name for package: $packageName", e)
            null
        }
    }

    /**
     * Extract text value from SaveRequest for a given autofill hint
     */
    private fun extractTextValue(request: SaveRequest, hint: String): String? {
        val contexts = request.fillContexts
        if (contexts == null || contexts.isEmpty()) return null

        val structure = contexts[0].structure
        if (structure == null) return null

        val rootNode = structure.getWindowNodeAt(0).rootViewNode
        if (rootNode == null) return null

        var result: String? = null

        fun traverse(node: AssistStructure.ViewNode) {
            if (result != null) return

            node.autofillHints?.let { hints ->
                if (hints.contains(hint)) {
                    val autofillValue = node.autofillValue
                    if (autofillValue != null && autofillValue.isText) {
                        result = autofillValue.textValue?.toString()
                    }
                }
            }

            if (result == null) {
                for (i in 0 until node.childCount) {
                    traverse(node.getChildAt(i))
                    if (result != null) break
                }
            }
        }

        traverse(rootNode)
        return result
    }

    /**
     * Extract domain from AssistStructure (for native Android apps)
     */
    private fun extractDomainFromStructure(structure: AssistStructure?): String? {
        return structure?.let {
            val activityComponent = it.activityComponent
            activityComponent?.packageName?.let { packageName ->
                // For web views, try to extract web domain
                val webDomain = extractWebDomainFromStructure(it)
                if (webDomain != null && webDomain.isNotEmpty()) {
                    webDomain
                } else {
                    packageName
                }
            }
        }
    }

    /**
     * Extract web domain from AssistStructure (for WebView)
     */
    private fun extractWebDomainFromStructure(structure: AssistStructure?): String? {
        return structure?.let {
            // AssistStructure doesn't have webUris property in all API levels
            // Use reflection or alternative approach
            try {
                val webUrisField = AssistStructure::class.java.getDeclaredField("webUris")
                webUrisField.isAccessible = true
                val webUris = webUrisField.get(it) as? java.util.List<*>
                webUris?.firstOrNull()?.let { uri ->
                    Uri.parse(uri.toString()).host
                }
            } catch (e: Exception) {
                Log.w(TAG, "Could not extract webUris from AssistStructure", e)
                null
            }
        }
    }

    /**
     * Extract domain from SaveRequest
     */
    private fun extractDomainFromSaveRequest(request: SaveRequest): String? {
        val contexts = request.fillContexts
        if (contexts == null || contexts.isEmpty()) return null

        val structure = contexts[0].structure
        return extractDomainFromStructure(structure)
    }

    /**
     * Extract parent domain (e.g., login.naver.com -> naver.com)
     */
    private fun extractParentDomain(domain: String): String {
        val parts = domain.split(".")
        return if (parts.size > 2) {
            parts.drop(1).joinToString(".")
        } else {
            domain
        }
    }
}