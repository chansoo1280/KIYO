package com.kiyo.app.autofill.response

import android.content.Context
import android.service.autofill.Dataset
import android.service.autofill.FillResponse
import android.service.autofill.SaveInfo
import android.util.Log
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import com.kiyo.app.R
import com.kiyo.app.autofill.repository.AutofillRepository

/**
 * FillResponse 빌더
 * 자동완성 응답 데이터셋 생성
 */
object FillResponseBuilder {

    private const val TAG = "FillResponseBuilder"

    fun createAuthResponse(
        context: Context,
        usernameId: AutofillId?,
        passwordId: AutofillId?
    ): FillResponse {

        val presentation = RemoteViews(
            context.packageName,
            R.layout.autofill_auth_item
        )

        presentation.setTextViewText(
            R.id.tv_message,
            "🔒 잠금 해제하여 자동완성을 사용하세요."
        )

        val datasetBuilder = Dataset.Builder(presentation)

        usernameId?.let {
            datasetBuilder.setValue(
                it,
                AutofillValue.forText("")
            )
        } ?: passwordId?.let {
            datasetBuilder.setValue(
                it,
                AutofillValue.forText("")
            )
        }

        return FillResponse.Builder()
            .addDataset(datasetBuilder.build())
            .build()
    }

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

        val datasetFactory = DatasetFactory(context)

        accounts.forEach { account ->
            val dataset = datasetFactory.createDataset(account, usernameId, passwordId)
            if (dataset != null) {
                datasets.add(dataset)
                responseBuilder.addDataset(dataset)
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