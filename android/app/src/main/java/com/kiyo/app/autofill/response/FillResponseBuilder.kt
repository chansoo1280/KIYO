package com.kiyo.app.autofill.response

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.service.autofill.Dataset
import android.service.autofill.FillResponse
import android.util.Log
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import com.kiyo.app.R
import com.kiyo.app.autofill.auth.AutofillAuthActivity
import com.kiyo.app.autofill.repository.AutofillRepository

/**
 * FillResponse 빌더
 * 자동완성 응답 데이터셋 생성
 */
object FillResponseBuilder {

    private const val TAG = "FillResponseBuilder"

    fun createAuthResponse(
            context: Context,
            usernameId: AutofillId? = null,
            passwordId: AutofillId? = null,
        ): FillResponse {

            val autofillIds = listOfNotNull(
                usernameId,
                passwordId
            )

            // 호출부(서비스)에서 non-null을 보장한다 — 여기서는 가드 없이 진행.
            // (이전 check()는 인증 필요 순간 프롬프트가 크래시로 사라지는 경로였음)
            require(autofillIds.isNotEmpty()) { "createAuthResponse requires at least one AutofillId" }

            /*
             * Android Autofill Framework가 인증 Activity를 실행할 때
             * 원래 화면의 AssistStructure 등을 Intent extras로 전달한다.
             *
             * 따라서 여기서는 ID를 직접 넘길 필요가 없다.
             */
            val authIntent = Intent(
                context,
                AutofillAuthActivity::class.java
            )

            /*
             * IMPORTANT:
             *
             * Android 12+ (API 31+)에서는 PendingIntent 생성 시
             * FLAG_IMMUTABLE 또는 FLAG_MUTABLE 중 하나를 반드시 지정해야 함.
             *
             * Autofill Framework가 authentication Intent에 extras를 추가해야 하므로
             * FLAG_MUTABLE을 사용해야 함.
             */
            val pendingIntent = PendingIntent.getActivity(
                context,
                1001,
                authIntent,
                PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_MUTABLE
            )

            val presentation = RemoteViews(
                context.packageName,
                R.layout.autofill_auth_item
            ).apply {
                setTextViewText(
                    R.id.tv_message,
                    "🔒 잠금 해제하여 자동완성을 사용하세요."
                )
            }

            Log.d(
                TAG,
                "createAuthResponse: " +
                    "usernameId=${usernameId != null}, " +
                    "passwordId=${passwordId != null}, " +
                    "autofillIds=${autofillIds.size}"
            )

            return FillResponse.Builder()
                .setAuthentication(
                    autofillIds.toTypedArray(),
                    pendingIntent.intentSender,
                    presentation
                )
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

        // TODO: Save saveInfo later — disabled to suppress system save dialog during E2E testing
        // val fieldIds = mutableListOf<AutofillId>()
        // usernameId?.let { fieldIds.add(it) }
        // passwordId?.let { fieldIds.add(it) }
        //
        // if (fieldIds.isNotEmpty()) {
        //     val saveInfo = SaveInfo.Builder(
        //         SaveInfo.SAVE_DATA_TYPE_PASSWORD,
        //         fieldIds.toTypedArray()
        //     ).build()
        //     responseBuilder.setSaveInfo(saveInfo)
        //     Log.d(TAG, "SaveInfo added with ${fieldIds.size} field IDs")
        // }

        val response = responseBuilder.build()
        Log.d(TAG, "FillResponse built with ${datasets.size} datasets (accounts: ${accounts.size}, usernameId: ${usernameId != null}, passwordId: ${passwordId != null})")
        return response
    }
}