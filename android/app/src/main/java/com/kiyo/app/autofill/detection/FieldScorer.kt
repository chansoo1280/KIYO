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

    // EditText 클래스 이름들
    private val editTextClassNames = listOf(
        "EditText", "TextInputEditText", "AppCompatEditText",
        "MaterialAutoCompleteTextView", "AutoCompleteTextView"
    )

    // 제외할 클래스 이름들 (TextView, View, 컨테이너 등)
    private val excludedClassNames = listOf(
        "TextView", "View", "ViewGroup", "FrameLayout", "LinearLayout",
        "RelativeLayout", "ConstraintLayout", "CoordinatorLayout", "ScrollView",
        "HorizontalScrollView", "ViewPager", "RecyclerView", "ListView", "GridView",
        "CardView", "Toolbar", "AppBarLayout", "CollapsingToolbarLayout",
        "WebView", "Form", "ViewStub", "Space", "ViewSwitcher", "ViewFlipper",
        "FrameLayout", "LinearLayout", "RelativeLayout", "ConstraintLayout"
    )

    private val usernameKeywords = listOf("email", "username", "login", "id", "account", "user")
    private val passwordKeywords = listOf("password", "passwd", "pwd")

    /**
     * 입력 가능한 ViewNode인지 검증
     * TextView, View, 컨테이너 View, 입력 속성이 없는 노드 제외
     */
    private fun isValidInputField(node: AssistStructure.ViewNode): Boolean {
        val className = node.className?.toString() ?: ""
        val inputTypeInt = node.inputType ?: 0
        val hasInputType = inputTypeInt != 0
        val autofillHints = node.autofillHints
        val hasAutofillHints = autofillHints != null && autofillHints.isNotEmpty()
        val isLeafNode = node.childCount == 0
        val autofillId = node.autofillId
        val hasAutofillId = autofillId != null
        
        // 제외: TextView, View, 컨테이너 클래스
        if (excludedClassNames.any { className.contains(it, true) }) {
            // 단, EditText 계열은 허용
            val isEditTextClass = editTextClassNames.any { className.contains(it, true) }
            if (!isEditTextClass) {
                return false
            }
        }
        
        // WebView 내부에서 autofillHints가 있는 경우 허용 (username/password/current-password)
        if (className.contains("WebView", true) && hasAutofillHints) {
            val hasUsernameOrPasswordHint = autofillHints.any { hint ->
                hint.contains("username", true) || hint.contains("password", true) || 
                hint.contains("current-password", true) || hint.contains("new-password", true) ||
                hint.contains("email", true)
            }
            if (hasUsernameOrPasswordHint) {
                return true
            }
        }
        
        // 실제 입력 필드: leaf node이면서 inputType이 있거나 EditText 클래스이거나 autofillId가 있는 경우
        val isEditTextClass = editTextClassNames.any { className.contains(it, true) }
        val isActualInput = isLeafNode && (hasInputType || isEditTextClass || hasAutofillId)
        
        // autofillHints가 있고 실제 입력 속성이 있는 경우도 허용
        val hasInputAttributes = hasInputType || isEditTextClass || hasAutofillId
        
        return isActualInput || (hasAutofillHints && hasInputAttributes)
    }

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
        if (!isValidInputField(node)) return null
        
        var score = 0
        val reasons = mutableListOf<String>()
        
        // 1. autofillHints=username/email/userName/emailAddress: +200 (최우선)
        node.autofillHints?.let { hints ->
            if (hints.contains("username") || hints.contains("email") || 
                hints.contains("userName") || hints.contains("emailAddress")) {
                score += 200
                reasons.add("autofillHints=username/email")
            } else if (hints.any { it.contains("user", true) || it.contains("email", true) || 
                it.contains("login", true) || it.contains("id", true) }) {
                score += 100
                reasons.add("autofillHints contains user/email/login/id")
            }
        }
        
        // 2. HTML autocomplete=username/email/user/login: +150
        val htmlAutocomplete = ViewNodeUtils.getHtmlAutocomplete(node)
        if (htmlAutocomplete != null) {
            if (htmlAutocomplete.contains("username") || htmlAutocomplete.contains("email") || 
                htmlAutocomplete.contains("user") || htmlAutocomplete.contains("login")) {
                score += 150
                reasons.add("htmlAutocomplete=username/email/user/login")
            }
        }
        
        // 3. HTML type=email: +100
        val htmlInputType = ViewNodeUtils.getHtmlInputType(node)
        if (htmlInputType != null) {
            if (htmlInputType == "email") {
                score += 100
                reasons.add("htmlInputType=email")
            } else if (htmlInputType == "text") {
                score += 50
                reasons.add("htmlInputType=text")
            }
        }
        
        // 4. inputType EMAIL_ADDRESS: +100
        val inputTypeInt = node.inputType ?: 0
        val isEmailVariation = (inputTypeInt and 0x000000FF) == 0x00000020 // TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        if (isEmailVariation) {
            score += 100
            reasons.add("inputType=EMAIL_ADDRESS")
        }
        
        // 5. inputType TEXT_CLASS: +10 (단순 TEXT_CLASS는 낮은 점수)
        val isTextClass = (inputTypeInt and 0x0000000F) == 0x00000001
        if (isTextClass) {
            score += 10
            reasons.add("inputType=TEXT_CLASS")
        }
        
        // 6. HTML name/id attribute keywords: +30
        val htmlName = ViewNodeUtils.getHtmlName(node)
        val htmlId = ViewNodeUtils.getHtmlId(node)
        if (htmlName != null || htmlId != null) {
            val nameOrId = (htmlName ?: "") + " " + (htmlId ?: "")
            if (nameOrId.contains("email") || nameOrId.contains("user") || 
                nameOrId.contains("login") || nameOrId.contains("id") || nameOrId.contains("account")) {
                score += 30
                reasons.add("htmlName/Id contains username keywords")
            }
        }
        
        // 7. hint/resourceId keywords: +30
        val hintLower = hint.lowercase()
        val idEntry = node.idEntry?.toString() ?: "null"
        val idPackage = node.idPackage?.toString() ?: "null"
        val resourceId = if (idPackage != "null" && idEntry != "null") "$idPackage:$idEntry" else "null"
        val resourceIdLower = resourceId.lowercase()
        
        val hasUsernameKeyword = usernameKeywords.any { keyword ->
            hintLower.contains(keyword) || resourceIdLower.contains(keyword)
        }
        if (hasUsernameKeyword) {
            score += 30
            reasons.add("hint/resourceId contains username keywords")
        }
        
        // 8. Google accounts.google.com special handling (username screen): +50
        // This is a special case for Google's split username/password screens
        if (ViewNodeUtils.isGoogleFieldCandidate(node)) {
            val hasPasswordOnScreen = ViewNodeUtils.hasPasswordFieldOnScreen(node)
            if (!hasPasswordOnScreen) {
                score += 50
                reasons.add("Google login page (username screen)")
            }
        }
        
        // 9. EditText class fallback: +10
        val isEditTextClass = editTextClassNames.any { className.contains(it, true) }
        if (isEditTextClass && isTextClass) {
            // Exclude password variations
            val isPasswordVariation = (inputTypeInt and 0x000000FF) == 0x00000080
            val isVisiblePasswordVariation = (inputTypeInt and 0x000000FF) == 0x00000090
            if (!isPasswordVariation && !isVisiblePasswordVariation) {
                score += 10
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
        if (!isValidInputField(node)) return null
        
        var score = 0
        val reasons = mutableListOf<String>()
        
        // 1. autofillHints=password/current-password/new-password: +200 (최우선)
        node.autofillHints?.let { hints ->
            if (hints.contains("password") || hints.contains("current-password") || hints.contains("new-password")) {
                score += 200
                reasons.add("autofillHints=password/current-password")
            } else if (hints.any { it.contains("password", true) || it.contains("pass", true) }) {
                score += 100
                reasons.add("autofillHints contains password/pass")
            }
        }
        
        // 2. HTML autocomplete=password/current-password/new-password: +150
        val htmlAutocomplete = ViewNodeUtils.getHtmlAutocomplete(node)
        if (htmlAutocomplete != null) {
            if (htmlAutocomplete.contains("password") || htmlAutocomplete.contains("pass") ||
                htmlAutocomplete.contains("current-password") || htmlAutocomplete.contains("new-password")) {
                score += 150
                reasons.add("htmlAutocomplete=password/current-password")
            }
        }
        
        // 3. HTML type=password: +100
        val htmlInputType = ViewNodeUtils.getHtmlInputType(node)
        if (htmlInputType != null) {
            if (htmlInputType == "password") {
                score += 100
                reasons.add("htmlInputType=password")
            }
        }
        
        // 4. inputType PASSWORD variations: +100
        val inputTypeInt = node.inputType ?: 0
        val isPasswordVariation = (inputTypeInt and 0x000000FF) == 0x00000080 // TYPE_TEXT_VARIATION_PASSWORD
        val isVisiblePasswordVariation = (inputTypeInt and 0x000000FF) == 0x00000090 // TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
        if (isPasswordVariation || isVisiblePasswordVariation) {
            score += 100
            reasons.add(if (isPasswordVariation) "inputType=PASSWORD" else "inputType=VISIBLE_PASSWORD")
        }
        
        // 5. HTML name/id attribute keywords: +30
        val htmlName = ViewNodeUtils.getHtmlName(node)
        val htmlId = ViewNodeUtils.getHtmlId(node)
        if (htmlName != null || htmlId != null) {
            val nameOrId = (htmlName ?: "") + " " + (htmlId ?: "")
            if (nameOrId.contains("password") || nameOrId.contains("pass") || nameOrId.contains("pwd")) {
                score += 30
                reasons.add("htmlName/Id contains password keywords")
            }
        }
        
        // 6. hint/resourceId keywords: +30
        val hintLower = hint.lowercase()
        val idEntry = node.idEntry?.toString() ?: "null"
        val idPackage = node.idPackage?.toString() ?: "null"
        val resourceId = if (idPackage != "null" && idEntry != "null") "$idPackage:$idEntry" else "null"
        val resourceIdLower = resourceId.lowercase()
        
        val hasPasswordKeyword = passwordKeywords.any { keyword ->
            hintLower.contains(keyword) || resourceIdLower.contains(keyword)
        }
        if (hasPasswordKeyword) {
            score += 30
            reasons.add("hint/resourceId contains password keywords")
        }
        
        // 7. Google accounts.google.com special handling (password screen): +50
        if (ViewNodeUtils.isGoogleFieldCandidate(node)) {
            val hasPasswordOnScreen = ViewNodeUtils.hasPasswordFieldOnScreen(node)
            if (hasPasswordOnScreen) {
                score += 50
                reasons.add("Google login page (password screen)")
            }
        }
        
        // 8. EditText class with password variation: +10
        val isEditTextClass = editTextClassNames.any { className.contains(it, true) }
        if (isEditTextClass && (isPasswordVariation || isVisiblePasswordVariation)) {
            score += 10
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