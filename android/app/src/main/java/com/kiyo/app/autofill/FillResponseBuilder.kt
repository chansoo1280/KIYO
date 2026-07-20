package com.kiyo.app.autofill

import android.content.Context
import android.service.autofill.Dataset
import android.service.autofill.FillResponse
import android.service.autofill.SaveInfo
import android.util.Log
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import com.kiyo.app.R

/**
 * FillResponse 빌더
 * 자동완성 응답 데이터셋 생성
 */
object FillResponseBuilder {

    private const val TAG = "FillResponseBuilder"

    /**
     * FillResponse 생성
     * 
     * @param context 컨텍스트
     * @param accounts 매칭된 계정 리스트
     * @param usernameId 사용자명 필드 AutofillId
     * @param passwordId 비밀번호 필드 AutofillId
     * @return FillResponse
     */
    fun createFillResponse(
        context: Context,
        accounts: List<AutofillRepository.AutofillAccount>,
        usernameId: AutofillId?,
        passwordId: AutofillId?
    ): FillResponse {
        val responseBuilder = FillResponse.Builder()
        val datasets = mutableListOf<Dataset>()

        // Log field IDs presence
        Log.d(TAG, "createFillResponse: usernameId=${usernameId != null}, passwordId=${passwordId != null}, accounts=${accounts.size}")

        accounts.forEach { account ->
            val siteName = account.title ?: account.appName ?: account.packageNames.firstOrNull() ?: "Unknown Site"
            val domain = account.domain ?: account.packageNames.firstOrNull() ?: ""

            val presentation = RemoteViews(context.packageName, R.layout.autofill_dataset_item)
            presentation.setTextViewText(R.id.tv_site_name, siteName)
            presentation.setTextViewText(R.id.tv_domain, domain)
            presentation.setTextViewText(R.id.tv_username, account.username)

            // Set site icon based on priority: account icon -> website preset icon -> default icon
            val iconResId = IconResourceMapper.getSiteIconResource(account)
            presentation.setImageViewResource(R.id.iv_site_icon, iconResId)

            val datasetBuilder = Dataset.Builder(presentation)
            var hasValue = false
            usernameId?.let { id ->
                datasetBuilder.setValue(id, AutofillValue.forText(account.username))
                Log.d(TAG, "Set username value for id=$id: ${account.username}")
                hasValue = true
            }
            passwordId?.let { id ->
                datasetBuilder.setValue(id, AutofillValue.forText(account.password))
                Log.d(TAG, "Set password value for id=$id")
                hasValue = true
            }
            
            // Only create dataset if at least one value is set (username or password)
            if (hasValue) {
                val dataset = datasetBuilder.build()
                datasets.add(dataset)
                responseBuilder.addDataset(dataset)
                Log.d(TAG, "Added dataset for account: ${account.username}, site: $siteName, domain: $domain")
            } else {
                Log.d(TAG, "Skipping dataset for account ${account.username}: no field IDs available")
            }
        }

        // Add SaveInfo to enable save UI when user fills credentials
        // SaveInfo tells the autofill service which fields to watch for save
        val fieldIds = mutableListOf<AutofillId>()
        usernameId?.let { fieldIds.add(it) }
        passwordId?.let { fieldIds.add(it) }
        
        if (fieldIds.isNotEmpty()) {
            val saveInfo = SaveInfo.Builder(
                SaveInfo.SAVE_DATA_TYPE_PASSWORD,
                fieldIds.toTypedArray()
            ).build()
            responseBuilder.setSaveInfo(saveInfo)
            Log.d(TAG, "SaveInfo added with ${fieldIds.size} field IDs")
        }

        val response = responseBuilder.build()
        Log.d(TAG, "FillResponse built with ${datasets.size} datasets (accounts: ${accounts.size}, usernameId: ${usernameId != null}, passwordId: ${passwordId != null})")
        return response
    }
}
