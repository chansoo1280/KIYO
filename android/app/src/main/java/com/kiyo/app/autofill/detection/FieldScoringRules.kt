package com.kiyo.app.autofill.detection

import android.app.assist.AssistStructure
import android.util.Log
import android.view.autofill.AutofillId
import com.kiyo.app.autofill.viewnode.ViewNodeUtils

/**
 * Scoring rules and helper methods for field detection.
 * Extracted from FieldScorer to separate scoring constants and helper functions.
 */
object FieldScoringRules {

    private const val TAG = "FieldScoringRules"

    // EditText 클래스 이름들
    val editTextClassNames = listOf(
        "EditText", "TextInputEditText", "AppCompatEditText",
        "MaterialAutoCompleteTextView", "AutoCompleteTextView"
    )

    // 제외할 클래스 이름들 (TextView, View, 컨테이너 등)
    val excludedClassNames = listOf(
        "TextView", "View", "ViewGroup", "FrameLayout", "LinearLayout",
        "RelativeLayout", "ConstraintLayout", "CoordinatorLayout", "ScrollView",
        "HorizontalScrollView", "ViewPager", "RecyclerView", "ListView", "GridView",
        "CardView", "Toolbar", "AppBarLayout", "CollapsingToolbarLayout",
        "WebView", "Form", "ViewStub", "Space", "ViewSwitcher", "ViewFlipper",
        "FrameLayout", "LinearLayout", "RelativeLayout", "ConstraintLayout"
    )

    val usernameKeywords = listOf("email", "username", "login", "id", "account", "user")
    val passwordKeywords = listOf("password", "passwd", "pwd")

    // Score weights
    const val SCORE_AUTOFILL_HINTS_USERNAME = 200
    const val SCORE_AUTOFILL_HINTS_USER_EMAIL = 100
    const val SCORE_HTML_AUTOCOMPLETE_USERNAME = 150
    const val SCORE_HTML_INPUT_TYPE_EMAIL = 100
    const val SCORE_HTML_INPUT_TYPE_TEXT = 50
    const val SCORE_INPUT_TYPE_EMAIL = 100
    const val SCORE_INPUT_TYPE_TEXT_CLASS = 10
    const val SCORE_HTML_NAME_ID_USERNAME = 30
    const val SCORE_HINT_RESOURCE_USERNAME = 30
    const val SCORE_GOOGLE_USERNAME_SCREEN = 50
    const val SCORE_EDITTEXT_FALLBACK = 10

    const val SCORE_AUTOFILL_HINTS_PASSWORD = 200
    const val SCORE_AUTOFILL_HINTS_PASS = 100
    const val SCORE_HTML_AUTOCOMPLETE_PASSWORD = 150
    const val SCORE_HTML_INPUT_TYPE_PASSWORD = 100
    const val SCORE_INPUT_TYPE_PASSWORD = 100
    const val SCORE_HTML_NAME_ID_PASSWORD = 30
    const val SCORE_HINT_RESOURCE_PASSWORD = 30
    const val SCORE_GOOGLE_PASSWORD_SCREEN = 50
    const val SCORE_EDITTEXT_PASSWORD_FALLBACK = 10

    /**
     * Validate if node is a valid input field.
     * TextView, View, container Views, nodes without input attributes are excluded.
     */
    fun isValidInputField(node: AssistStructure.ViewNode): Boolean {
        val className = node.className?.toString() ?: ""
        val inputTypeInt = node.inputType ?: 0
        val hasInputType = inputTypeInt != 0
        val autofillHints = node.autofillHints
        val hasAutofillHints = autofillHints != null && autofillHints.isNotEmpty()
        val isLeafNode = node.childCount == 0
        val autofillId = node.autofillId
        val hasAutofillId = autofillId != null

        // Exclude: TextView, View, container classes
        if (excludedClassNames.any { className.contains(it, true) }) {
            // But allow EditText classes
            val isEditTextClass = editTextClassNames.any { className.contains(it, true) }
            if (!isEditTextClass) {
                return false
            }
        }

        // Allow WebView internal nodes with username/password autofillHints
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

        // Actual input field: leaf node with inputType or EditText class or autofillId
        val isEditTextClass = editTextClassNames.any { className.contains(it, true) }
        val isActualInput = isLeafNode && (hasInputType || isEditTextClass || hasAutofillId)

        // Allow if has autofillHints AND input attributes
        val hasInputAttributes = hasInputType || isEditTextClass || hasAutofillId

        return isActualInput || (hasAutofillHints && hasInputAttributes)
    }

    /**
     * Check if node is an EditText class.
     */
    fun isEditTextClass(node: AssistStructure.ViewNode): Boolean {
        val className = node.className?.toString() ?: ""
        return editTextClassNames.any { className.contains(it, true) }
    }

    /**
     * Check if inputType is password variation.
     */
    fun isPasswordVariation(inputTypeInt: Int): Boolean {
        return (inputTypeInt and 0x000000FF) == 0x00000080 // TYPE_TEXT_VARIATION_PASSWORD
    }

    /**
     * Check if inputType is visible password variation.
     */
    fun isVisiblePasswordVariation(inputTypeInt: Int): Boolean {
        return (inputTypeInt and 0x000000FF) == 0x00000090 // TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
    }

    /**
     * Check if inputType is email variation.
     */
    fun isEmailVariation(inputTypeInt: Int): Boolean {
        return (inputTypeInt and 0x000000FF) == 0x00000020 // TYPE_TEXT_VARIATION_EMAIL_ADDRESS
    }

    /**
     * Check if inputType is text class.
     */
    fun isTextClass(inputTypeInt: Int): Boolean {
        return (inputTypeInt and 0x0000000F) == 0x00000001
    }
}