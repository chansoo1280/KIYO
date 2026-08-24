package com.kiyo.app.autofill.auth

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.service.autofill.Dataset
import android.service.autofill.FillResponse
import android.util.Log
import android.view.autofill.AutofillManager
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.appcompat.app.AppCompatActivity
import com.kiyo.app.R
import com.kiyo.app.autofill.repository.AutofillRepository
import com.kiyo.app.autofill.detection.FieldDetector
import com.kiyo.app.autofill.detection.FieldScorer
import com.kiyo.app.autofill.viewnode.ViewNodeExtractor
import com.kiyo.app.security.DatabaseKeyManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Authentication activity for Autofill.
 * Shows system BiometricPrompt with DEVICE_CREDENTIAL (PIN) support.
 * When authentication succeeds, creates authenticated FillResponse and returns it via EXTRA_AUTHENTICATION_RESULT.
 */
class AutofillAuthActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "AutofillAuthActivity"

        /**
         * Start authentication activity for sync (not from autofill service).
         * Opens biometric/PIN auth and returns when done.
         */
        @JvmStatic
        fun startAuthForSync(context: android.content.Context) {
            val intent = android.content.Intent(context, AutofillAuthActivity::class.java).apply {
                putExtra("reason", "autofill_auth_required")
                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // No UI needed - BiometricPrompt shows system dialog
        // Theme.Translucent.NoTitleBar makes this invisible

        // Check if this is for sync (not from autofill service)
        val isSyncAuth = intent.getStringExtra("reason") == "autofill_auth_required"

        Log.d(TAG, "onCreate - starting BiometricPrompt, isSyncAuth=$isSyncAuth")

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("KIYO 잠금 해제")
            .setSubtitle("자동완성을 사용하려면 인증하세요")
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or
                    BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
            .build()

        val executor = ContextCompat.getMainExecutor(this)
        val biometricPrompt = BiometricPrompt(
            this,
            executor,
            object : BiometricPrompt.AuthenticationCallback() {

                override fun onAuthenticationSucceeded(
                    result: BiometricPrompt.AuthenticationResult
                ) {
                    Log.d(TAG, "Authentication succeeded")
                    if (isSyncAuth) {
                        // For sync auth, just finish successfully - Keystore auth cache is now active
                        setResult(Activity.RESULT_OK)
                        finish()
                    } else {
                        loadAuthenticatedResponse()
                    }
                }

                override fun onAuthenticationError(
                    errorCode: Int,
                    errString: CharSequence
                ) {
                    Log.d(TAG, "Authentication error: $errorCode - $errString")
                    if (isSyncAuth) {
                        setResult(Activity.RESULT_CANCELED)
                        finish()
                    } else {
                        returnWithNullResponse()
                    }
                }

                override fun onAuthenticationFailed() {
                    Log.d(TAG, "Authentication failed")
                    // Don't finish - allow retry
                }
            }
        )

        biometricPrompt.authenticate(promptInfo)
    }

    private fun loadAuthenticatedResponse() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                /*
                 * Here the user has authenticated, so Keystore DB_KEY access should be available.
                 */
                val dbKey = DatabaseKeyManager.getKey(this@AutofillAuthActivity).encoded

                Log.d(TAG, "DB_KEY obtained after authentication")

                val repository = AutofillRepository.create(this@AutofillAuthActivity, dbKey)

                /*
                 * Get AssistStructure from the authentication Intent.
                 * Android Autofill Framework puts it there when launching this Activity.
                 */
                val structure: android.app.assist.AssistStructure? = if (android.os.Build.VERSION.SDK_INT >= 33) {
                    intent.getParcelableExtra(
                        AutofillManager.EXTRA_ASSIST_STRUCTURE,
                        android.app.assist.AssistStructure::class.java
                    )
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(AutofillManager.EXTRA_ASSIST_STRUCTURE)
                }

                if (structure == null) {
                    Log.e(TAG, "No AssistStructure in authentication Intent")
                    returnWithNullResponse()
                    return@launch
                }

                /*
                 * Re-detect username/password field IDs from AssistStructure.
                 * Reuse existing FieldDetector logic.
                 */
                val rootViewNode = structure.getWindowNodeAt(0).rootViewNode

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

                Log.d(TAG, "Authenticated field detection: username=${usernameId != null}, password=${passwordId != null}")

                // Extract domain and package names for account matching
                val domain = ViewNodeExtractor.extractDomainFromStructure(rootViewNode)
                val extractedPackages = ViewNodeExtractor
                    .extractPackageNamesFromStructure(rootViewNode)
                    .filter { !it.equals("com.kiyo.app", ignoreCase = true) }
                    .toMutableList()
                // 서비스(onFillRequest)와 동일한 폴백: idPackage가 비어있는 구조에서는
                // activityComponent.packageName으로 대상 앱을 식별한다 (검증됨 2026-08:
                // auth Intent의 AssistStructure에서는 idPackage가 비어 packages=[]가 되어 매칭 실패)
                if (extractedPackages.isEmpty()) {
                    val activityComponent = structure.activityComponent?.packageName
                    if (activityComponent != null &&
                        !activityComponent.equals("com.kiyo.app", ignoreCase = true) &&
                        !activityComponent.startsWith("android")
                    ) {
                        extractedPackages.add(activityComponent)
                        Log.d(TAG, "packages empty from idPackage - fell back to activityComponent: $activityComponent")
                    }
                }
                val packageNames = extractedPackages.distinct()

                Log.d(TAG, "Authenticated lookup: domain='$domain', packages=$packageNames")

                // Look up matching accounts
                val accounts = if (domain.isNotEmpty()) {
                    repository.findMatchingAccounts(domain)
                } else {
                    val result = mutableListOf<AutofillRepository.AutofillAccount>()
                    for (pkg in packageNames) {
                        result.addAll(repository.findByPackageName(pkg))
                        if (result.isNotEmpty()) break
                    }
                    result
                }

                Log.d(TAG, "Authenticated lookup found ${accounts.size} accounts")

                if (accounts.isEmpty()) {
                    Log.d(TAG, "No accounts after authentication")
                    returnWithNullResponse()
                    return@launch
                }

                /*
                 * Create authenticated FillResponse with datasets
                 */
                val response = createAuthenticatedFillResponse(
                    accounts = accounts,
                    usernameId = usernameId,
                    passwordId = passwordId
                )

                /*
                 * CRITICAL: Return the FillResponse via EXTRA_AUTHENTICATION_RESULT
                 * This is what Android Autofill Framework expects from the auth Activity.
                 */
                val replyIntent = Intent().apply {
                    putExtra(
                        AutofillManager.EXTRA_AUTHENTICATION_RESULT,
                        response
                    )
                }

                withContext(Dispatchers.Main) {
                    Log.d(TAG, "Returning authenticated FillResponse")
                    setResult(Activity.RESULT_OK, replyIntent)
                    finish()
                }

            } catch (e: Exception) {
                Log.e(TAG, "Failed to create authenticated response", e)
                returnWithNullResponse()
            }
        }
    }

    private fun createAuthenticatedFillResponse(
        accounts: List<AutofillRepository.AutofillAccount>,
        usernameId: android.view.autofill.AutofillId?,
        passwordId: android.view.autofill.AutofillId?
    ): FillResponse {
        val builder = FillResponse.Builder()
        val datasetFactory = com.kiyo.app.autofill.response.DatasetFactory(this)

        for (account in accounts) {
            // DatasetFactory 재사용 (검증됨 2026-08): 기존 인라인 구현은
            // autofill_dataset_item 레이아웃에 존재하지 않는 tv_message에 텍스트를 설정해서
            // XML 프리뷰 기본값("Site Name"/"domain.com"/"user@email.com")이 그대로 노출됐다.
            // DatasetFactory는 정상 fill 경로와 동일하게 3개 필드를 모두 채운다.
            val dataset = datasetFactory.createDataset(account, usernameId, passwordId)
            if (dataset != null) {
                builder.addDataset(dataset)
            }
        }

        return builder.build()
    }

    private fun returnWithNullResponse() {
        runOnUiThread {
            val replyIntent = Intent().apply {
                putExtra(
                    AutofillManager.EXTRA_AUTHENTICATION_RESULT,
                    null as android.os.Parcelable?
                )
            }
            setResult(Activity.RESULT_OK, replyIntent)
            finish()
        }
    }
}