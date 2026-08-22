package com.kiyo.app.autofill.service

import android.app.assist.AssistStructure
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.service.autofill.AutofillService
import android.service.autofill.FillCallback
import android.service.autofill.FillContext
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveRequest
import android.util.Log
import android.view.autofill.AutofillId
import android.view.autofill.AutofillManager
import android.view.autofill.AutofillValue
import androidx.core.content.ContextCompat
import com.kiyo.app.BuildConfig
import com.kiyo.app.autofill.credential.CredentialExtractor
import com.kiyo.app.autofill.detection.FieldDetector
import com.kiyo.app.autofill.detection.FieldScorer
import com.kiyo.app.autofill.repository.AutofillRepository
import com.kiyo.app.autofill.response.FillResponseBuilder
import com.kiyo.app.autofill.viewnode.ViewNodeExtractor
import com.kiyo.app.autofill.viewnode.ViewNodeTraversal
import com.kiyo.app.security.DatabaseKeyManager
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.collections.any
import kotlin.jvm.Volatile
import android.content.Intent
import com.kiyo.app.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

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
 * */
class KiyoAutofillService : AutofillService() {

    private val TAG = "KiyoAutofillService"
    @Volatile
    private var repository: AutofillRepository? = null
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        Log.e(TAG, "========== SERVICE CREATED ==========")
        // Intentionally left blank – no key acquisition here.
        // Repository will be created lazily on first authenticated request.
    }

    override fun onDestroy() {
        executor.shutdown()
        super.onDestroy()
        Log.d(TAG, "AutofillService destroyed")
    }

    /**
     * Lazily creates the AutofillRepository after obtaining the DB_KEY from Keystore.
     * This method may throw UserNotAuthenticatedException if authentication is required.
     */
    private suspend fun ensureRepositoryInitialized(): AutofillRepository {
        val repo = repository
        if (repo != null) return repo
        // Not initialized yet, get key (may trigger auth) and create repo
        val encryptedKey = DatabaseKeyManager.getKey(this@KiyoAutofillService)
        val dbKey = encryptedKey.encoded
        val newRepo = AutofillRepository.create(this@KiyoAutofillService, dbKey)
        // Atomic update if still null
        synchronized(this) {
            if (repository == null) {
                repository = newRepo
            }
            return repository!!
        }
    }

    private fun openKiyoApp() {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
            putExtra("reason", "autofill_auth_required")
        }
        startActivity(intent)
    }

    /**
     * Fill request handler - finds username/password fields and returns matching accounts
     */
    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        Log.d(TAG, "onFillRequest called")

        // Debug: Dump all FillContexts to understand activityComponent
        request.fillContexts?.forEachIndexed { index, fc ->
            Log.d(TAG, "=== FillContext[$index] ===")
            val structure = fc.structure
            Log.d(TAG, "  structure: $structure")
            Log.d(TAG, "  windowCount: ${structure?.windowNodeCount}")
            val activityComponent = structure?.activityComponent
            Log.d(TAG, "  activityComponent: $activityComponent")
            Log.d(TAG, "  activityComponent.packageName: ${activityComponent?.packageName}")
            structure?.let { s ->
                for (i in 0 until s.windowNodeCount) {
                    val root = s.getWindowNodeAt(i).rootViewNode
                    Log.d(TAG, "  window[$i] root.idPackage: ${root.idPackage}")
                    Log.d(TAG, "  window[$i] root.idEntry: ${root.idEntry}")
                }
            }
        }

        CoroutineScope(Dispatchers.IO).launch {
                    // Declare variables outside try block so they're accessible in catch
                    var usernameId: AutofillId? = null
                    var passwordId: AutofillId? = null
            
                    try {
                        // First, detect fields from the structure (needs to be done before potential auth)
                        // Use fillContexts API (API 26+)
                        val fillContexts = request.fillContexts
                        if (fillContexts == null || fillContexts.isEmpty()) {
                            Log.w(TAG, "No fill contexts available")
                            handler.post { callback.onSuccess(null) }
                            return@launch
                        }

                        val structure = fillContexts.last().structure
                        if (structure == null) {
                            Log.w(TAG, "No assist structure available")
                            handler.post { callback.onSuccess(null) }
                            return@launch
                        }

                        val rootViewNode = structure.getWindowNodeAt(0).rootViewNode

                        // Skip autofill for KIYO app itself (package name: com.kiyo.app)
                        // Try to extract package names from ViewNode structure first,
                        // then fallback to FillContext's activityComponent
                        val extractedPackages = ViewNodeExtractor.extractPackageNamesFromStructure(rootViewNode)
                        val fillContext = fillContexts.last()
                        val activityPackageName = fillContext.structure?.activityComponent?.packageName
                        // Combine extracted packages and activity package name, filter out self and system packages
                        val allPackages = mutableListOf<String>()
                        allPackages.addAll(extractedPackages)
                        activityPackageName?.let { allPackages.add(it) }
                        val packageNames = allPackages
                            .filter { !it.equals("com.kiyo.app", ignoreCase = true) && !it.startsWith("android") }
                            .distinct()
                        Log.d(TAG, "Extracted packages from structure: $extractedPackages, from activityComponent: $activityPackageName, final packageNames: $packageNames")
                        if (packageNames.isEmpty()) {
                            Log.w(TAG, "No valid package names after filtering, skipping autofill")
                            handler.post { callback.onSuccess(null) }
                            return@launch
                        }

                        // Debug: dump full ViewNode tree for debugging
                        if (BuildConfig.DEBUG) {
                            ViewNodeTraversal.dumpViewNodeTree(rootViewNode, 0)
                        }
                        val focusedNode = FieldDetector.findFocusedNode(rootViewNode)
                        if (focusedNode == null) {
                            handler.post { callback.onSuccess(null) }
                            return@launch
                        }

                        // Find best username and password field candidates using unified detection logic
                        val usernameCandidate = FieldDetector.findBestFieldCandidate(
                            rootViewNode,
                            FieldScorer::calculateUsernameScore
                        )
                        val passwordCandidate = FieldDetector.findBestFieldCandidate(
                            rootViewNode,
                            FieldScorer::calculatePasswordScore
                        )

                        usernameId = usernameCandidate?.autofillId
                        passwordId = passwordCandidate?.autofillId

                        Log.d(TAG, "Field detection result: usernameId=${usernameId != null}, passwordId=${passwordId != null}")
                        usernameCandidate?.let { Log.d(TAG, "Username candidate: score=${it.score}, reason=${it.reason}, className=${it.className}, hints=[${it.autofillHints}], hint=${it.hint}, inputType=${it.inputType}, htmlInputType=${it.htmlInputType}, htmlAutocomplete=${it.htmlAutocomplete}, htmlName=${it.htmlName}, webDomain=${it.webDomain}") }
                        passwordCandidate?.let { Log.d(TAG, "Password candidate: score=${it.score}, reason=${it.reason}, className=${it.className}, hints=[${it.autofillHints}], hint=${it.hint}, inputType=${it.inputType}, htmlInputType=${it.htmlInputType}, htmlAutocomplete=${it.htmlAutocomplete}, htmlName=${it.htmlName}, webDomain=${it.webDomain}") }

                        // Validation logging before FillResponse creation
                        Log.d(TAG, "usernameId: $usernameId, passwordId: $passwordId")
                        Log.d(TAG, "=================================")

                        // If no fields found, return empty response
                        if (usernameId == null && passwordId == null) {
                            Log.d(TAG, "No username or password fields detected")
                            handler.post { callback.onSuccess(null) }
                            return@launch
                        }

                        // Get domain from structure for account matching
                        val domain = ViewNodeExtractor.extractDomainFromStructure(rootViewNode)
                        Log.d(TAG, "Extracted domain: $domain, packages: $packageNames")

                        // Obtain repository (may trigger auth)
                        val repo = ensureRepositoryInitialized()

                        // Get matching accounts using repository (we already have the key via ensureRepositoryInitialized)
                        val accounts = if (domain.isNotEmpty()) {
                            repo.findMatchingAccounts(domain)
                        } else if (packageNames.isNotEmpty()) {
                            // For native apps without webDomain, match by package name
                            val accountsByPackage = mutableListOf<AutofillRepository.AutofillAccount>()
                            for (pkg in packageNames) {
                                accountsByPackage.addAll(repo.findByPackageName(pkg))
                                if (accountsByPackage.isNotEmpty()) break
                            }
                            accountsByPackage
                        } else {
                            emptyList()
                        }
                        Log.d(TAG, "Found ${accounts.size} matching accounts for domain: '$domain', packages: $packageNames")

                        if (accounts.isEmpty()) {
                            handler.post { callback.onSuccess(null) }
                            return@launch
                        }

                        val response = FillResponseBuilder.createFillResponse(
                            this@KiyoAutofillService,
                            accounts,
                            usernameId,
                            passwordId
                        )
                        handler.post { callback.onSuccess(response) }

                    } catch (e: android.security.keystore.UserNotAuthenticatedException) {
                        // Authentication required -> request auth
                        Log.d(TAG, "User authentication required for DB_KEY access")
                        Log.d(TAG, "AuthResponse with usernameId=${usernameId != null}, passwordId=${passwordId != null}")
                        val response = FillResponseBuilder.createAuthResponse(
                            this@KiyoAutofillService,
                            usernameId,
                            passwordId
                        )
                        handler.post { callback.onSuccess(response) }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error in onFillRequest", e)
                        handler.post { callback.onSuccess(null) }
                    }
                }
    }

    /**
     * Save request handler - extracts username/password and saves to repository
     * Per Android Autofill API: onSaveRequest should save the credentials and call callback.onSuccess()
     * The SaveInfo is provided during fill response (onFillRequest), not during save request.
     */
    override fun onSaveRequest(
        request: SaveRequest,
        callback: SaveCallback
    ) {
        Log.d(TAG, "onSaveRequest called")

        CoroutineScope(Dispatchers.IO).launch {
            try {
                // Obtain repository (may trigger auth)
                val repo = ensureRepositoryInitialized()

                // Use fillContexts API (API 26+)
                val fillContexts = request.fillContexts
                if (fillContexts == null || fillContexts.isEmpty()) {
                    Log.w(TAG, "No fill contexts available in save request")
                    return@launch
                }

                val structure = fillContexts.last().structure
                if (structure == null) {
                    Log.w(TAG, "No assist structure in save request")
                    return@launch
                }

                // Get root ViewNode from AssistStructure
                val rootViewNode = structure.getWindowNodeAt(0).rootViewNode

                // Skip autofill for KIYO app itself (package name: com.kiyo.app)
                val packageNames = ViewNodeExtractor.extractPackageNamesFromStructure(rootViewNode)
                if (packageNames.contains("com.kiyo.app")) {
                    Log.d(TAG, "Skipping save for KIYO app (com.kiyo.app)")
                    return@launch
                }

                // Use unified field detection logic for save request
                val usernameCandidate = FieldDetector.findBestFieldCandidate(
                    rootViewNode,
                    FieldScorer::calculateUsernameScore
                )
                val passwordCandidate = FieldDetector.findBestFieldCandidate(
                    rootViewNode,
                    FieldScorer::calculatePasswordScore
                )

                val usernameId = usernameCandidate?.autofillId
                val passwordId = passwordCandidate?.autofillId

                Log.d(TAG, "Save request field detection: usernameId=${usernameId != null}, passwordId=${passwordId != null}")
                usernameCandidate?.let { Log.d(TAG, "Save username candidate: score=${it.score}, reason=${it.reason}") }
                passwordCandidate?.let { Log.d(TAG, "Save password candidate: score=${it.score}, reason=${it.reason}") }

                // Extract username and password from the detected fields using CredentialExtractor
                val extractedData = CredentialExtractor.extractCredentialsFromFields(rootViewNode, usernameId, passwordId)
                val username = extractedData.username
                val password = extractedData.password
                val domain = ViewNodeExtractor.extractDomainFromStructure(rootViewNode)

                Log.d(TAG, "Extracted credentials: username=${username != null}, password=${password != null}, domain=$domain, packages=$packageNames")

                if (username == null || password == null) {
                    Log.d(TAG, "No username or password found to save")
                    return@launch
                }

                // Check if this is a login form using unified detection logic
                // Uses HTML attributes for Samsung Internet compatibility (works without webDomain)
                val hasLoginForm = FieldDetector.hasLoginForm(rootViewNode)

                if (!hasLoginForm) {
                    Log.d(TAG, "Not a login form (usernameField=${usernameCandidate != null}, passwordField=${passwordCandidate != null}), skipping save")
                    return@launch
                }

                // Save or update account (encrypt password before saving)
                val account = AutofillRepository.AutofillAccount(
                    id = -1,
                    username = username,
                    password = password,
                    domain = domain,
                    packageNames = packageNames,
                    appName = ViewNodeExtractor.extractAppNameFromStructure(rootViewNode),
                    title = ViewNodeExtractor.extractTitleFromStructure(rootViewNode),
                    createdAt = System.currentTimeMillis(),
                    updatedAt = System.currentTimeMillis()
                )

                val savedAccountId = repo.upsertAccount(account)
                Log.d(TAG, "Account saved/updated: $savedAccountId")

                // Per Android Autofill API: just call onSuccess() to confirm save
                // SaveInfo is provided during fill response (onFillRequest), not here
                handler.post { callback.onSuccess() }

            } catch (e: android.security.keystore.UserNotAuthenticatedException) {
                Log.d(TAG, "Save request needs auth")
                // For save, we also need to prompt for authentication if the key is not available.
                // We'll reuse the same auth response builder? Actually SaveCallback does not support auth UI.
                // So we just indicate that save processing is complete (no save performed).
                handler.post { callback.onSuccess() }
            } catch (e: Exception) {
                Log.e(TAG, "Error in onSaveRequest", e)
                handler.post { callback.onSuccess() }
            }
        }
    }

    companion object {
        /**
         * Check if autofill service is enabled
         */
        fun isAutofillEnabled(context: Context): Boolean {
            val autofillManager = context.getSystemService(AutofillManager::class.java)
            return autofillManager.hasEnabledAutofillServices()
        }

        /**
         * Check if this service is the current autofill service
         */
        fun isCurrentAutofillService(context: Context): Boolean {
            val componentName = ComponentName(context, KiyoAutofillService::class.java)
            val currentService = Settings.Secure.getString(
                context.contentResolver,
                "autofill_service"
            )
            return currentService != null && currentService == componentName.flattenToString()
        }
    }
}