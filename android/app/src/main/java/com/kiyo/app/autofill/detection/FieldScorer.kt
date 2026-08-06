package com.kiyo.app.autofill.detection

import android.app.assist.AssistStructure
import android.util.Log
import android.view.autofill.AutofillId
import com.kiyo.app.autofill.viewnode.ViewNodeUtils

/**
 * 필드 점수 계산기
 * 사용자명/비밀번호 필드 후보에 점수를 매겨 최적의 필드 선택
 * 
 * 점수 체계 (우선순위 순):
 * 1. autofillHints=username/password/current-password: +200
 * 2. HTML autocomplete=username/password/current-password/new-password: +150
 * 3. HTML type=email/password: +100
 * 4. inputType PASSWORD/EMAIL_ADDRESS/TEXT_CLASS: +100
 * 5. hint/resourceId/name 기반 키워드 탐지: +30
 * 6. 일반 EditText fallback: +10
 * 
 * 제외 대상:
 * - android.widget.TextView
 * - android.view.View
 * - 입력 기능이 없는 container View
 * - autofillHints가 없고 실제 입력 속성이 없는 노드
 * 
 * 허용:
 * - EditText
 * - WebView 내부 autofillHints=username/password/current-password 노드
 * - autofillId를 가진 실제 입력 노드
 * - TextView가 절대 최고 후보가 되지 않도록 함
 */
object FieldScorer {

    private const val TAG = "FieldScorer"

    /**
     * 사용자명 필드 후보 점수 계산
     * 
     * @param node ViewNode to evaluate
     * @return FieldCandidate with score, or null if not a valid candidate
     */
    fun calculateUsernameScore(node: AssistStructure.ViewNode): FieldCandidate? {
        val className = node.className?.toString() ?: "null"
        val autofillHints = node.autofillHints?.joinToString(", ") ?: "null"
        val hint = node.hint?.toString() ?: "null"
        val inputType = node.inputType?.toString() ?: "null"
        val autofillId = node.autofillId
        val webDomain = node.webDomain?.toString() ?: "null"

        if (autofillId == null) return null
        if (!FieldScoringRules.isValidInputField(node)) return null

        var score = 0
        val reasons = mutableListOf<String>()

        // 1. autofillHints=username/email/userName/emailAddress: +200 (최우선)
        node.autofillHints?.let { hints ->
            if (hints.contains("username") || hints.contains("email") ||
                hints.contains("userName") || hints.contains("emailAddress")) {
                score += FieldScoringRules.SCORE_AUTOFILL_HINTS_USERNAME
                reasons.add("autofillHints=username/email")
            } else if (hints.any { it.contains("user", true) || it.contains("email", true) ||
                it.contains("login", true) || it.contains("id", true) }) {
                score += FieldScoringRules.SCORE_AUTOFILL_HINTS_USER_EMAIL
                reasons.add("autofillHints contains user/email/login/id")
            }
        }

        // 2. HTML autocomplete=username/email/user/login: +150
        val htmlAutocomplete = ViewNodeUtils.getHtmlAutocomplete(node)
        if (htmlAutocomplete != null) {
            if (htmlAutocomplete.contains("username") || htmlAutocomplete.contains("email") ||
                htmlAutocomplete.contains("user") || htmlAutocomplete.contains("login")) {
                score += FieldScoringRules.SCORE_HTML_AUTOCOMPLETE_USERNAME
                reasons.add("htmlAutocomplete=username/email/user/login")
            }
        }

        // 3. HTML type=email: +100
        val htmlInputType = ViewNodeUtils.getHtmlInputType(node)
        if (htmlInputType != null) {
            if (htmlInputType == "email") {
                score += FieldScoringRules.SCORE_HTML_INPUT_TYPE_EMAIL
                reasons.add("htmlInputType=email")
            } else if (htmlInputType == "text") {
                score += FieldScoringRules.SCORE_HTML_INPUT_TYPE_TEXT
                reasons.add("htmlInputType=text")
            }
        }

        // 4. inputType EMAIL_ADDRESS: +100
        val inputTypeInt = node.inputType ?: 0
        if (FieldScoringRules.isEmailVariation(inputTypeInt)) {
            score += FieldScoringRules.SCORE_INPUT_TYPE_EMAIL
            reasons.add("inputType=EMAIL_ADDRESS")
        }

        // 5. inputType TEXT_CLASS: +10 (단순 TEXT_CLASS는 낮은 점수)
        if (FieldScoringRules.isTextClass(inputTypeInt)) {
            score += FieldScoringRules.SCORE_INPUT_TYPE_TEXT_CLASS
            reasons.add("inputType=TEXT_CLASS")
        }

        // 6. HTML name/id attribute keywords: +30
        val htmlName = ViewNodeUtils.getHtmlName(node)
        val htmlId = ViewNodeUtils.getHtmlId(node)
        if (htmlName != null || htmlId != null) {
            val nameOrId = (htmlName ?: "") + " " + (htmlId ?: "")
            if (nameOrId.contains("email") || nameOrId.contains("user") ||
                nameOrId.contains("login") || nameOrId.contains("id") || nameOrId.contains("account")) {
                score += FieldScoringRules.SCORE_HTML_NAME_ID_USERNAME
                reasons.add("htmlName/Id contains username keywords")
            }
        }

        // 7. hint/resourceId keywords: +30
        val hintLower = hint.lowercase()
        val idEntry = node.idEntry?.toString() ?: "null"
        val idPackage = node.idPackage?.toString() ?: "null"
        val resourceId = if (idPackage != "null" && idEntry != "null") "$idPackage:$idEntry" else "null"
        val resourceIdLower = resourceId.lowercase()

        val hasUsernameKeyword = FieldScoringRules.usernameKeywords.any { keyword ->
            hintLower.contains(keyword) || resourceIdLower.contains(keyword)
        }
        if (hasUsernameKeyword) {
            score += FieldScoringRules.SCORE_HINT_RESOURCE_USERNAME
            reasons.add("hint/resourceId contains username keywords")
        }

        // 8. Google accounts.google.com special handling (username screen): +50
        // This is a special case for Google's split username/password screens
        if (ViewNodeUtils.isGoogleFieldCandidate(node)) {
            val hasPasswordOnScreen = ViewNodeUtils.hasPasswordFieldOnScreen(node)
            if (!hasPasswordOnScreen) {
                score += FieldScoringRules.SCORE_GOOGLE_USERNAME_SCREEN
                reasons.add("Google login page (username screen)")
            }
        }

        // 9. EditText class fallback: +10
        if (FieldScoringRules.isEditTextClass(node) && FieldScoringRules.isTextClass(inputTypeInt)) {
            // Exclude password variations
            val isPasswordVariation = FieldScoringRules.isPasswordVariation(inputTypeInt)
            val isVisiblePasswordVariation = FieldScoringRules.isVisiblePasswordVariation(inputTypeInt)
            if (!isPasswordVariation && !isVisiblePasswordVariation) {
                score += FieldScoringRules.SCORE_EDITTEXT_FALLBACK
                reasons.add("EditText class fallback")
            }
        }

        // Skip if score is 0 (no indicators)
        if (score == 0) return null

        Log.d(TAG, "Username candidate:")
        Log.d(TAG, "autofillId=$autofillId")
        Log.d(TAG, "hints=[$autofillHints]")

        return FieldCandidate(
            autofillId = autofillId,
            score = score,
            className = className,
            autofillHints = autofillHints,
            hint = hint,
            inputType = inputType,
            htmlInputType = htmlInputType,
            htmlAutocomplete = htmlAutocomplete,
            htmlName = htmlName,
            webDomain = webDomain,
            reason = reasons.joinToString("; ")
        )
    }

    /**
     * 비밀번호 필드 후보 점수 계산
     * 
     * @param node ViewNode to evaluate
     * @return FieldCandidate with score, or null if not a valid candidate
     */
    fun calculatePasswordScore(node: AssistStructure.ViewNode): FieldCandidate? {
        val className = node.className?.toString() ?: "null"
        val autofillHints = node.autofillHints?.joinToString(", ") ?: "null"
        val hint = node.hint?.toString() ?: "null"
        val inputType = node.inputType?.toString() ?: "null"
        val autofillId = node.autofillId
        val webDomain = node.webDomain?.toString() ?: "null"

        if (autofillId == null) return null
        if (!FieldScoringRules.isValidInputField(node)) return null

        var score = 0
        val reasons = mutableListOf<String>()

        // 1. autofillHints=password/current-password/new-password: +200 (최우선)
        node.autofillHints?.let { hints ->
            if (hints.contains("password") || hints.contains("current-password") || hints.contains("new-password")) {
                score += FieldScoringRules.SCORE_AUTOFILL_HINTS_PASSWORD
                reasons.add("autofillHints=password/current-password")
            } else if (hints.any { it.contains("password", true) || it.contains("pass", true) }) {
                score += FieldScoringRules.SCORE_AUTOFILL_HINTS_PASS
                reasons.add("autofillHints contains password/pass")
            }
        }

        // 2. HTML autocomplete=password/current-password/new-password: +150
        val htmlAutocomplete = ViewNodeUtils.getHtmlAutocomplete(node)
        if (htmlAutocomplete != null) {
            if (htmlAutocomplete.contains("password") || htmlAutocomplete.contains("pass") ||
                htmlAutocomplete.contains("current-password") || htmlAutocomplete.contains("new-password")) {
                score += FieldScoringRules.SCORE_HTML_AUTOCOMPLETE_PASSWORD
                reasons.add("htmlAutocomplete=password/current-password")
            }
        }

        // 3. HTML type=password: +100
        val htmlInputType = ViewNodeUtils.getHtmlInputType(node)
        if (htmlInputType != null) {
            if (htmlInputType == "password") {
                score += FieldScoringRules.SCORE_HTML_INPUT_TYPE_PASSWORD
                reasons.add("htmlInputType=password")
            }
        }

        // 4. inputType PASSWORD variations: +100
        val inputTypeInt = node.inputType ?: 0
        val isPasswordVariation = FieldScoringRules.isPasswordVariation(inputTypeInt)
        val isVisiblePasswordVariation = FieldScoringRules.isVisiblePasswordVariation(inputTypeInt)
        if (isPasswordVariation || isVisiblePasswordVariation) {
            score += FieldScoringRules.SCORE_INPUT_TYPE_PASSWORD
            reasons.add(if (isPasswordVariation) "inputType=PASSWORD" else "inputType=VISIBLE_PASSWORD")
        }

        // 5. HTML name/id attribute keywords: +30
        val htmlName = ViewNodeUtils.getHtmlName(node)
        val htmlId = ViewNodeUtils.getHtmlId(node)
        if (htmlName != null || htmlId != null) {
            val nameOrId = (htmlName ?: "") + " " + (htmlId ?: "")
            if (nameOrId.contains("password") || nameOrId.contains("pass") || nameOrId.contains("pwd")) {
                score += FieldScoringRules.SCORE_HTML_NAME_ID_PASSWORD
                reasons.add("htmlName/Id contains password keywords")
            }
        }

        // 6. hint/resourceId keywords: +30
        val hintLower = hint.lowercase()
        val idEntry = node.idEntry?.toString() ?: "null"
        val idPackage = node.idPackage?.toString() ?: "null"
        val resourceId = if (idPackage != "null" && idEntry != "null") "$idPackage:$idEntry" else "null"
        val resourceIdLower = resourceId.lowercase()

        val hasPasswordKeyword = FieldScoringRules.passwordKeywords.any { keyword ->
            hintLower.contains(keyword) || resourceIdLower.contains(keyword)
        }
        if (hasPasswordKeyword) {
            score += FieldScoringRules.SCORE_HINT_RESOURCE_PASSWORD
            reasons.add("hint/resourceId contains password keywords")
        }

        // 7. Google accounts.google.com special handling (password screen): +50
        if (ViewNodeUtils.isGoogleFieldCandidate(node)) {
            val hasPasswordOnScreen = ViewNodeUtils.hasPasswordFieldOnScreen(node)
            if (hasPasswordOnScreen) {
                score += FieldScoringRules.SCORE_GOOGLE_PASSWORD_SCREEN
                reasons.add("Google login page (password screen)")
            }
        }

        // 8. EditText class with password variation: +10
        if (FieldScoringRules.isEditTextClass(node) && (isPasswordVariation || isVisiblePasswordVariation)) {
            score += FieldScoringRules.SCORE_EDITTEXT_PASSWORD_FALLBACK
            reasons.add("EditText class with password variation")
        }

        // Skip if score is 0 (no indicators)
        if (score == 0) return null

        Log.d(TAG, "Password candidate:")
        Log.d(TAG, "autofillId=$autofillId")
        Log.d(TAG, "hints=[$autofillHints]")

        return FieldCandidate(
            autofillId = autofillId,
            score = score,
            className = className,
            autofillHints = autofillHints,
            hint = hint,
            inputType = inputType,
            htmlInputType = htmlInputType,
            htmlAutocomplete = htmlAutocomplete,
            htmlName = htmlName,
            webDomain = webDomain,
            reason = reasons.joinToString("; ")
        )
    }
}