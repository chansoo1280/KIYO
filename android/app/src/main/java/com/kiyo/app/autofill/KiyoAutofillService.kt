package com.kiyo.app.autofill

import android.app.assist.AssistStructure
import android.service.autofill.AutofillService
import android.service.autofill.Dataset
import android.service.autofill.FillCallback
import android.service.autofill.FillContext
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveRequest
import android.util.Log
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
/**
 * Android Autofill Service for KIYO Password Manager
 * Provides autofill functionality for Android apps (API 26+)
 * Uses official Android Autofill Dataset API
 *
 * Simplified Implementation:
 * - onFillRequest: traverses ViewNode, finds username/password fields, returns test accounts
 * - onSaveRequest: minimal implementation, just acknowledges save request
 * - ViewNode traversal for username/password field detection
 * - No biometric authentication, no repository, no packageName filtering
 * - Returns hardcoded test accounts for testing
 */
class KiyoAutofillService : AutofillService() {

    private val TAG = "KiyoAutofillService"

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Autofill service created")
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "Autofill service destroyed")
    }
    
    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: android.os.CancellationSignal,
        callback: FillCallback
    ) {
        Log.d(TAG, "onFillRequest() called")

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

        // 테스트용 하드코딩 AutofillId
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

        // 테스트 계정 데이터 (여러 계정 지원)
        val testAccounts = listOf(
            Pair("test@kiyo.com", "12345678"),
            Pair("user@example.com", "password123"),
            Pair("admin@kiyo.app", "admin1234")
        )

        val responseBuilder = FillResponse.Builder()

        testAccounts.forEach { (username, password) ->
            val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1)
            presentation.setTextViewText(android.R.id.text1, username)

            val datasetBuilder = Dataset.Builder(presentation)
            usernameId?.let { id ->
                datasetBuilder.setValue(
                    id,
                    AutofillValue.forText(username)
                )
                Log.d(TAG, "Set username value for id=$id: $username")
            }

            passwordId?.let { id ->
                datasetBuilder.setValue(
                    id,
                    AutofillValue.forText(password)
                )
                Log.d(TAG, "Set password value for id=$id")
            }

            val dataset = datasetBuilder.build()
            responseBuilder.addDataset(dataset)
            Log.d(TAG, "Added dataset for account: $username")
        }

        val response = responseBuilder.build()
        callback.onSuccess(response)
        Log.d(TAG, "Autofill response sent with ${testAccounts.size} datasets")
    }

    override fun onSaveRequest(
        request: SaveRequest,
        callback: SaveCallback
    ) {
        Log.d(TAG, "onSaveRequest() called")
        // Minimal implementation - just acknowledge the save request
        callback.onSuccess()
    }
}
