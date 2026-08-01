package com.kiyo.app.autofill

import android.app.assist.AssistStructure
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
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
import com.kiyo.app.autofill.CredentialExtractor
import com.kiyo.app.autofill.FillResponseBuilder
import com.kiyo.app.autofill.ViewNodeUtils
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.collections.any
import com.kiyo.app.security.SecuritySession
import android.content.Intent
import com.kiyo.app.MainActivity
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
    private lateinit var repository: AutofillRepository
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        repository = AutofillRepository(this)
        Log.d(TAG, "AutofillService created")
    }

    override fun onDestroy() {
        executor.shutdown()
        super.onDestroy()
        Log.d(TAG, "AutofillService destroyed")
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
        
        executor.execute {
            try {
                // Use fillContexts API (API 26+)
                val fillContexts = request.fillContexts
                if (fillContexts == null || fillContexts.isEmpty()) {
                    Log.w(TAG, "No fill contexts available")
                    handler.post { callback.onSuccess(null) }
                    return@execute
                }
                
                val structure = fillContexts.last().structure
                if (structure == null) {
                    Log.w(TAG, "No assist structure available")
                    handler.post { callback.onSuccess(null) }
                    return@execute
                }

                val rootViewNode = structure.getWindowNodeAt(0).rootViewNode
                
                // Debug: dump full ViewNode tree for debugging
                if (BuildConfig.DEBUG) {
                    ViewNodeUtils.dumpViewNodeTree(rootViewNode, 0)
                }
                val focusedNode = FieldDetector.findFocusedNode(rootViewNode)
                if (focusedNode == null) {
                    callback.onSuccess(null)
                    return@execute
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

                val usernameId = usernameCandidate?.autofillId
                val passwordId = passwordCandidate?.autofillId

                Log.d(TAG, "Field detection result: usernameId=${usernameId != null}, passwordId=${passwordId != null}")
                usernameCandidate?.let { Log.d(TAG, "Username candidate: score=${it.score}, reason=${it.reason}, className=${it.className}, hints=[${it.autofillHints}], hint=${it.hint}, inputType=${it.inputType}, htmlInputType=${it.htmlInputType}, htmlAutocomplete=${it.htmlAutocomplete}, htmlName=${it.htmlName}, webDomain=${it.webDomain}") }
                passwordCandidate?.let { Log.d(TAG, "Password candidate: score=${it.score}, reason=${it.reason}, className=${it.className}, hints=[${it.autofillHints}], hint=${it.hint}, inputType=${it.inputType}, htmlInputType=${it.htmlInputType}, htmlAutocomplete=${it.htmlAutocomplete}, htmlName=${it.htmlName}, webDomain=${it.webDomain}") }

                // Validation logging before FillResponse creation
                Log.d(TAG, "=== FillResponse Validation ===")
                Log.d(TAG, "usernameId: ${usernameId?.toString() ?: "null"}")
                Log.d(TAG, "passwordId: ${passwordId?.toString() ?: "null"}")
                Log.d(TAG, "usernameCandidate: ${usernameCandidate?.let { "score=${it.score}, reason=${it.reason}" } ?: "null"}")
                Log.d(TAG, "passwordCandidate: ${passwordCandidate?.let { "score=${it.score}, reason=${it.reason}" } ?: "null"}")
                Log.d(TAG, "================================")

                // If no fields found, return empty response
                if (usernameId == null && passwordId == null) {
                    Log.d(TAG, "No username or password fields detected")
                    handler.post { callback.onSuccess(null) }
                    return@execute
                }

                // Get domain from structure for account matching
                val domain = extractDomainFromStructure(rootViewNode)
                Log.d(TAG, "Extracted domain: $domain")

                // Find matching accounts from repository
                val accounts = repository.findMatchingAccounts(domain)
                Log.d(TAG, "Found ${accounts.size} matching accounts for domain: $domain")

                if (accounts.isEmpty()) {
                    Log.d(TAG, "No matching accounts found")
                    handler.post { callback.onSuccess(null) }
                    return@execute
                }
                
                val key = SecuritySession.get()
                val isLocked = SecuritySession.isLocked()
                Log.d(TAG, "SecuritySession :: key=${key != null}, isLocked=$isLocked")

                if (isLocked && key == null) {
                    val response = FillResponseBuilder.createAuthResponse(
                        this@KiyoAutofillService,
                        usernameId,
                        passwordId
                    )

                    handler.post { callback.onSuccess(response) }
                    return@execute
                }

                // Build FillResponse with matching accounts
                val response = FillResponseBuilder.createFillResponse(
                    this@KiyoAutofillService,
                    accounts,
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
        
        executor.execute {
            try {
                // Use fillContexts API (API 26+)
                val fillContexts = request.fillContexts
                if (fillContexts == null || fillContexts.isEmpty()) {
                    Log.w(TAG, "No fill contexts available in save request")
                    return@execute
                }
                
                val structure = fillContexts.last().structure
                if (structure == null) {
                    Log.w(TAG, "No assist structure in save request")
                    return@execute
                }
                // Get root ViewNode from AssistStructure
                val rootViewNode = structure.getWindowNodeAt(0).rootViewNode
                
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
                val domain = extractDomainFromStructure(rootViewNode)
                val packageNames = ViewNodeUtils.extractPackageNamesFromStructure(rootViewNode)

                Log.d(TAG, "Extracted credentials: username=${username != null}, password=${password != null}, domain=$domain, packages=$packageNames")

                if (username == null || password == null) {
                    Log.d(TAG, "No username or password found to save")
                    return@execute
                }

                // Check if this is a login form using unified detection logic
                // Uses HTML attributes for Samsung Internet compatibility (works without webDomain)
                val hasLoginForm = FieldDetector.hasLoginForm(rootViewNode)
                
                if (!hasLoginForm) {
                    Log.d(TAG, "Not a login form (usernameField=${usernameCandidate != null}, passwordField=${passwordCandidate != null}), skipping save")
                    return@execute
                }

                // Save or update account (encrypt password before saving)
                val account = AutofillRepository.AutofillAccount(
                    id = -1,
                    username = username,
                    password = password,
                    domain = domain,
                    packageNames = packageNames,
                    appName = ViewNodeUtils.extractAppNameFromStructure(rootViewNode),
                    title = ViewNodeUtils.extractTitleFromStructure(rootViewNode),
                    createdAt = System.currentTimeMillis(),
                    updatedAt = System.currentTimeMillis()
                )

                val savedAccountId = repository.upsertAccount(account)
                Log.d(TAG, "Account saved/updated: $savedAccountId")
                
                // Per Android Autofill API: just call onSuccess() to confirm save
                // SaveInfo is provided during fill response (onFillRequest), not here
                handler.post { callback.onSuccess() }

            } catch (e: Exception) {
                Log.e(TAG, "Error in onSaveRequest", e)
            }
        }
    }

    /**
     * Extract credentials from specific field IDs
     */
    private data class ExtractedCredentials(
        val username: String?,
        val password: String?
    )

    private fun extractCredentialsFromFields(
        structure: AssistStructure.ViewNode,
        usernameId: AutofillId?,
        passwordId: AutofillId?
    ): ExtractedCredentials {
        var username: String? = null
        var password: String? = null

        fun traverse(node: AssistStructure.ViewNode) {
            val autofillId = node.autofillId
            val text = node.text?.toString() ?: ""
            
            if (text.isNotEmpty()) {
                if (autofillId != null && autofillId == usernameId && username == null) {
                    username = text
                } else if (autofillId != null && autofillId == passwordId && password == null) {
                    password = text
                }
            }

            for (i in 0 until node.childCount) {
                traverse(node.getChildAt(i))
            }
        }

        traverse(structure)
        return ExtractedCredentials(username, password)
    }

    /**
     * Extract domain from assist structure
     */
    private fun extractDomainFromStructure(structure: AssistStructure.ViewNode): String {
        var domain = ""
        
        fun traverse(node: AssistStructure.ViewNode) {
            if (domain.isNotEmpty()) return
            node.webDomain?.let { domain = it.toString() }
            for (i in 0 until node.childCount) {
                traverse(node.getChildAt(i))
                if (domain.isNotEmpty()) break
            }
        }
        
        traverse(structure)
        return domain
    }

    /**
     * Extract package names from assist structure
     */
    private fun extractPackageNamesFromStructure(structure: AssistStructure.ViewNode): List<String> {
        val packages = mutableSetOf<String>()
        
        fun traverse(node: AssistStructure.ViewNode) {
            node.idPackage?.let { packages.add(it.toString()) }
            for (i in 0 until node.childCount) {
                traverse(node.getChildAt(i))
            }
        }
        
        traverse(structure)
        return packages.toList()
    }

    /**
     * Extract app name from structure
     */
    private fun extractAppNameFromStructure(structure: AssistStructure.ViewNode): String? {
        var appName: String? = null
        
        fun traverse(node: AssistStructure.ViewNode) {
            if (appName != null) return
            node.idPackage?.let { appName = it.toString() }
            for (i in 0 until node.childCount) {
                traverse(node.getChildAt(i))
                if (appName != null) break
            }
        }
        
        traverse(structure)
        return appName
    }

    /**
     * Extract title from structure (web page title)
     */
    private fun extractTitleFromStructure(structure: AssistStructure.ViewNode): String? {
        var title: String? = null
        
        fun traverse(node: AssistStructure.ViewNode) {
            if (title != null) return
            node.htmlInfo?.let { htmlInfo ->
                // Try to get title from HTML
                val attributes = htmlInfo.attributes
                if (attributes != null) {
                    for (attr in attributes) {
                        if (attr.first.lowercase() == "title") {
                            title = attr.second
                            break
                        }
                    }
                }
            }
            for (i in 0 until node.childCount) {
                traverse(node.getChildAt(i))
                if (title != null) break
            }
        }
        
        traverse(structure)
        return title
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
            val currentService = android.provider.Settings.Secure.getString(
                context.contentResolver,
                "autofill_service"
            )
            return currentService != null && currentService == componentName.flattenToString()
        }
    }
}
