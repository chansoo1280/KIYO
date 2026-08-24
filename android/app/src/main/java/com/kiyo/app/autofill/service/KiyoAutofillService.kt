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
 *
 * v3 설계 원칙:
 * - **요청 단위 fresh 초기화** — repository 필드/영구 캐시가 없다.
 *   매 fill/save 요청마다 현재 상태(alias 포인터 → 마스터 키 → DB_KEY)를 다시 읽어
 *   repository를 생성하고, finally에서 반드시 close한다.
 *   메인 앱의 재래핑/리셋 이후에도 별도 동기화 장치 없이 항상 현재 상태로 동작한다.
 * */
class KiyoAutofillService : AutofillService() {

    private val TAG = "KiyoAutofillService"
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        Log.e(TAG, "========== SERVICE CREATED ==========")
        // Intentionally left blank – no key acquisition here.
        // Repository is created per-request (fresh), never cached.
    }

    override fun onDestroy() {
        executor.shutdown()
        super.onDestroy()
        Log.d(TAG, "AutofillService destroyed")
    }

    /**
     * 요청 단위 repository 획득: 매번 현재 상태를 다시 읽는다 (캐시 없음).
     * UserNotAuthenticatedException이 발생하면 호출자 catch에서 인증 프롬프트 경로로 연결된다.
     */
    private suspend fun openRepository(): AutofillRepository {
        val dbKey = DatabaseKeyManager.getKey(this@KiyoAutofillService)
        return AutofillRepository.create(this@KiyoAutofillService, dbKey.encoded)
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

        CoroutineScope(Dispatchers.IO).launch {
            // Declare variables outside try block so they're accessible in catch
            var usernameId: AutofillId? = null
            var passwordId: AutofillId? = null
            var repo: AutofillRepository? = null

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

                // If no fields found, return empty response
                if (usernameId == null && passwordId == null) {
                    Log.d(TAG, "No username or password fields detected")
                    handler.post { callback.onSuccess(null) }
                    return@launch
                }

                // Get domain from structure for account matching
                val domain = ViewNodeExtractor.extractDomainFromStructure(rootViewNode)
                Log.d(TAG, "Extracted domain: $domain, packages: $packageNames")

                // Obtain a fresh repository for this request (may trigger auth)
                repo = openRepository()

                // Get matching accounts using repository
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
                if (usernameId == null && passwordId == null) {
                    Log.d(TAG, "No fields for auth response")
                    handler.post { callback.onSuccess(null) }
                } else {
                    val response = FillResponseBuilder.createAuthResponse(
                        this@KiyoAutofillService,
                        usernameId,
                        passwordId
                    )
                    handler.post { callback.onSuccess(response) }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error in onFillRequest", e)
                handler.post { callback.onSuccess(null) }
            } finally {
                // 요청 단위 수명: 반드시 닫는다 (stale DB 핸들이 다음 요청으로 넘어가지 않음)
                try {
                    repo?.close()
                } catch (e: Exception) {
                    Log.w(TAG, "Error closing repository", e)
                }
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
            var repo: AutofillRepository? = null
            try {
                // Obtain a fresh repository for this request (may trigger auth)
                repo = openRepository()

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
                // SaveCallback does not support auth UI; complete silently.
                handler.post { callback.onSuccess() }
            } catch (e: Exception) {
                Log.e(TAG, "Error in onSaveRequest", e)
                handler.post { callback.onSuccess() }
            } finally {
                // 요청 단위 수명: 반드시 닫는다
                try {
                    repo?.close()
                } catch (e: Exception) {
                    Log.w(TAG, "Error closing repository", e)
                }
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
