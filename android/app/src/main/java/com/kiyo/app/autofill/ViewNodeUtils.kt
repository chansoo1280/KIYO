package com.kiyo.app.autofill

import android.app.assist.AssistStructure
import android.util.Log

/**
 * ViewNode 유틸리티 함수들
 * ViewNode 탐색, HTML 속성 추출, 필드 타입 판별 등
 */
object ViewNodeUtils {

    private const val TAG = "ViewNodeUtils"

    /**
     * Check if the ViewNode is from Google accounts.google.com domain
     */
    fun isGoogleAccountsDomain(node: AssistStructure.ViewNode): Boolean {
        val webDomain = node.webDomain?.toString() ?: ""
        return webDomain == "accounts.google.com"
    }

    /**
     * Check if the structure is from a known login domain
     * Checks webDomain and HTML attributes for login indicators
     */
    fun isKnownLoginDomain(rootNode: AssistStructure.ViewNode): Boolean {
        var isKnown = false
        
        fun traverse(node: AssistStructure.ViewNode) {
            if (isKnown) return
            
            // Check webDomain for known login domains
            val webDomain = node.webDomain?.toString() ?: ""
            if (webDomain.isNotEmpty()) {
                val knownLoginDomains = listOf(
                    "accounts.google.com",
                    "login.microsoftonline.com",
                    "signin.aws.amazon.com",
                    "id.heroku.com",
                    "auth.atlassian.com",
                    "login.salesforce.com",
                    "github.com/login",
                    "gitlab.com/users/sign_in",
                    "bitbucket.org/account/signin"
                )
                if (knownLoginDomains.any { webDomain.contains(it, true) }) {
                    isKnown = true
                    return
                }
            }
            
            // Check HTML attributes for login form indicators
            val htmlAutocomplete = getHtmlAutocomplete(node)?.lowercase() ?: ""
            val htmlInputType = getHtmlInputType(node)?.lowercase() ?: ""
            val htmlName = getHtmlName(node)?.lowercase() ?: ""
            val htmlId = getHtmlId(node)?.lowercase() ?: ""
            
            if (htmlAutocomplete.contains("username") || htmlAutocomplete.contains("email") ||
                htmlAutocomplete.contains("password") || htmlAutocomplete.contains("current-password") ||
                htmlAutocomplete.contains("new-password") ||
                htmlInputType == "password" || htmlInputType == "email" ||
                htmlName.contains("login") || htmlName.contains("signin") || htmlName.contains("password") ||
                htmlId.contains("login") || htmlId.contains("signin") || htmlId.contains("password")) {
                isKnown = true
                return
            }
            
            for (i in 0 until node.childCount) {
                traverse(node.getChildAt(i))
                if (isKnown) break
            }
        }
        
        traverse(rootNode)
        return isKnown
    }

    /**
     * Check if node is a Google login field candidate (accounts.google.com)
     * Used for special handling of Google's split username/password screens
     */
    fun isGoogleFieldCandidate(node: AssistStructure.ViewNode): Boolean {
        val webDomain = node.webDomain?.toString() ?: ""
        return webDomain == "accounts.google.com"
    }

    /**
     * Debug logging when field detection fails
     */
    fun logFieldDetectionDebugInfo(rootNode: AssistStructure.ViewNode) {
        Log.d(TAG, "=== Field Detection Debug Info ===")
        
        fun traverse(node: AssistStructure.ViewNode, depth: Int) {
            val indent = "  ".repeat(depth)
            val className = node.className?.toString() ?: "null"
            val autofillHints = node.autofillHints?.joinToString(", ") ?: "null"
            val hint = node.hint?.toString() ?: "null"
            val inputType = node.inputType?.toString() ?: "null"
            val autofillId = node.autofillId?.toString() ?: "null"
            val webDomain = node.webDomain?.toString() ?: "null"
            val isLeaf = node.childCount == 0
            val isInputField = isActualInputField(node)
            val isContainer = isContainerNode(node)
            
            Log.d(TAG, "${indent}Node: className=$className, hints=[$autofillHints], hint=$hint, inputType=$inputType, autofillId=$autofillId, webDomain=$webDomain, isLeaf=$isLeaf, isInputField=$isInputField, isContainer=$isContainer")
            
            // Calculate scores for debugging
            val usernameScore = FieldScorer.calculateUsernameScore(node)
            val passwordScore = FieldScorer.calculatePasswordScore(node)
            
            usernameScore?.let { candidate ->
                Log.d(TAG, "${indent}  -> Username candidate: score=${candidate.score}, reason=${candidate.reason}")
            }
            passwordScore?.let { candidate ->
                Log.d(TAG, "${indent}  -> Password candidate: score=${candidate.score}, reason=${candidate.reason}")
            }
            
            for (i in 0 until node.childCount) {
                traverse(node.getChildAt(i), depth + 1)
            }
        }
        
        traverse(rootNode, 0)
        Log.d(TAG, "=== End Field Detection Debug Info ===")
    }

    /**
     * Extract package names from assist structure
     */
    fun extractPackageNamesFromStructure(structure: AssistStructure.ViewNode): List<String> {
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
     * Extract app name from structure (uses first package name found)
     */
    fun extractAppNameFromStructure(structure: AssistStructure.ViewNode): String? {
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
     * Extract title from structure (web page title from HTML)
     */
    fun extractTitleFromStructure(structure: AssistStructure.ViewNode): String? {
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

    /**
     * Check if the current screen has a password field (password inputType or password hint)
     * Traverses from ROOT node to find any password field on the entire screen
     */
    fun hasPasswordFieldOnScreen(rootNode: AssistStructure.ViewNode): Boolean {
        var hasPassword = false
        
        fun traverse(node: AssistStructure.ViewNode) {
            if (hasPassword) return
            
            val inputType = node.inputType ?: 0
            val isPasswordVariation = (inputType and 0x000000FF) == 0x00000080 // TYPE_TEXT_VARIATION_PASSWORD
            val isVisiblePasswordVariation = (inputType and 0x000000FF) == 0x00000090 // TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
            
            val hint = node.hint?.toString()?.lowercase() ?: ""
            val hasPasswordHint = hint.contains("password") || hint.contains("pass") || hint.contains("pwd")
            
            // Also check HTML attributes for password type
            val htmlInputType = getHtmlInputType(node)?.lowercase() ?: ""
            val htmlAutocomplete = getHtmlAutocomplete(node)?.lowercase() ?: ""
            val hasHtmlPassword = htmlInputType == "password" || 
                                  htmlAutocomplete.contains("password", true) ||
                                  htmlAutocomplete.contains("current-password", true) ||
                                  htmlAutocomplete.contains("new-password", true)
            
            if (isPasswordVariation || isVisiblePasswordVariation || hasPasswordHint || hasHtmlPassword) {
                hasPassword = true
                return
            }
            
            for (i in 0 until node.childCount) {
                traverse(node.getChildAt(i))
                if (hasPassword) break
            }
        }
        
        traverse(rootNode)
        return hasPassword
    }

    /**
     * Check if the ViewNode is a leaf node (no children)
     */
    fun isLeafNode(node: AssistStructure.ViewNode): Boolean {
        return node.childCount == 0
    }

    /**
     * Extract HTML input type from ViewNode's htmlInfo.attributes
     * Returns the value of 'type' attribute (e.g., "email", "password", "text")
     */
    fun getHtmlInputType(node: AssistStructure.ViewNode): String? {
        val htmlInfo = node.htmlInfo
        if (htmlInfo == null) return null
        
        val attributes = htmlInfo.attributes
        if (attributes == null) return null
        
        for (attr in attributes) {
            // attr is Pair<String, String> with name and value
            if (attr.first.lowercase() == "type") {
                return attr.second.lowercase()
            }
        }
        return null
    }

    /**
     * Extract HTML autocomplete attribute from ViewNode's htmlInfo.attributes
     * Returns the value of 'autocomplete' attribute (e.g., "username", "email", "current-password", "new-password")
     */
    fun getHtmlAutocomplete(node: AssistStructure.ViewNode): String? {
        val htmlInfo = node.htmlInfo
        if (htmlInfo == null) return null
        
        val attributes = htmlInfo.attributes
        if (attributes == null) return null
        
        for (attr in attributes) {
            if (attr.first.lowercase() == "autocomplete") {
                return attr.second.lowercase()
            }
        }
        return null
    }

    /**
     * Extract HTML name attribute from ViewNode's htmlInfo.attributes
     */
    fun getHtmlName(node: AssistStructure.ViewNode): String? {
        val htmlInfo = node.htmlInfo
        if (htmlInfo == null) return null
        
        val attributes = htmlInfo.attributes
        if (attributes == null) return null
        
        for (attr in attributes) {
            if (attr.first.lowercase() == "name") {
                return attr.second.lowercase()
            }
        }
        return null
    }

    /**
     * Extract HTML id attribute from ViewNode's htmlInfo.attributes
     */
    fun getHtmlId(node: AssistStructure.ViewNode): String? {
        val htmlInfo = node.htmlInfo
        if (htmlInfo == null) return null
        
        val attributes = htmlInfo.attributes
        if (attributes == null) return null
        
        for (attr in attributes) {
            if (attr.first.lowercase() == "id") {
                return attr.second.lowercase()
            }
        }
        return null
    }

    /**
     * Check if node is an actual input field (not a container like Form, FrameLayout, WebView)
     */
    fun isActualInputField(node: AssistStructure.ViewNode): Boolean {
        val inputTypeInt = node.inputType ?: 0
        val hasInputType = inputTypeInt != 0
        val className = node.className?.toString() ?: ""
        val isEditTextClass = listOf(
            "EditText", "TextInputEditText", "AppCompatEditText",
            "MaterialAutoCompleteTextView", "AutoCompleteTextView",
            "TextInputLayout", "EditTextWithClear"
        ).any { className.contains(it, true) }
        val isLeafNode = node.childCount == 0
        
        // Actual input field: leaf node with inputType or EditText class
        return isLeafNode && (hasInputType || isEditTextClass)
    }

    /**
     * Check if node is a container (Form, FrameLayout, WebView, etc.) that should be skipped for HTML attribute detection
     */
    fun isContainerNode(node: AssistStructure.ViewNode): Boolean {
        val className = node.className?.toString() ?: ""
        val containerClasses = listOf(
            "Form", "FrameLayout", "WebView", "LinearLayout", "RelativeLayout",
            "ConstraintLayout", "CoordinatorLayout", "ScrollView", "HorizontalScrollView",
            "ViewGroup", "ViewPager", "RecyclerView", "ListView", "GridView",
            "CardView", "Toolbar", "AppBarLayout", "CollapsingToolbarLayout"
        )
        return containerClasses.any { className.contains(it, true) }
    }

    /**
     * 전체 ViewNode 트리를 재귀적으로 탐색하며 상세 정보 로그 출력
     */
    fun dumpViewNodeTree(node: AssistStructure.ViewNode, depth: Int) {
        val indent = "  ".repeat(depth)
        val className = node.className?.toString() ?: "null"
        val autofillHints = node.autofillHints?.joinToString(", ") ?: "null"
        val hint = node.hint?.toString() ?: "null"
        val inputType = node.inputType?.toString() ?: "null"
        val idEntry = node.idEntry?.toString() ?: "null"
        val idPackage = node.idPackage?.toString() ?: "null"
        val hasText = node.text != null && node.text.toString().isNotEmpty()
        val webDomain = node.webDomain?.toString() ?: "null"
        val autofillId = node.autofillId?.toString() ?: "null"

        Log.d(TAG, "${indent}ViewNode: className=$className, autofillHints=[$autofillHints], hint=$hint, inputType=$inputType, idEntry=$idEntry, idPackage=$idPackage, hasText=$hasText, webDomain=$webDomain, autofillId=$autofillId")

        for (i in 0 until node.childCount) {
            dumpViewNodeTree(node.getChildAt(i), depth + 1)
        }
    }
}