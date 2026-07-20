package com.kiyo.app.autofill

import android.app.assist.AssistStructure
import android.view.autofill.AutofillId

/**
 * 자격증명 추출 유틸리티
 * ViewNode에서 username/password 텍스트 추출
 */
object CredentialExtractor {

    private const val TAG = "CredentialExtractor"

    /**
     * 특정 필드 ID에서 자격증명(username/password) 추출
     */
    data class ExtractedCredentials(
        val username: String?,
        val password: String?
    )

    fun extractCredentialsFromFields(
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
}