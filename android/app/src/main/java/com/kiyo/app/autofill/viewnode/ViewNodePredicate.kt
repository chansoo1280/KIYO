package com.kiyo.app.autofill.viewnode

import android.app.assist.AssistStructure

/**
 * ViewNode predicate functions.
 * Determines if a node matches certain criteria (input field, container, Google-specific, etc.)
 */
object ViewNodePredicate {

    /**
     * Check if node is an actual input field (not a container like Form, FrameLayout, WebView).
     * Leaf node with inputType or EditText class.
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
     * Check if node is a container (Form, FrameLayout, WebView, etc.) 
     * that should be skipped for HTML attribute detection.
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
     * Check if node is a leaf node (no children).
     */
    fun isLeafNode(node: AssistStructure.ViewNode): Boolean {
        return node.childCount == 0
    }

    /**
     * Check if the ViewNode is from Google accounts.google.com domain.
     */
    fun isGoogleAccountsDomain(node: AssistStructure.ViewNode): Boolean {
        val webDomain = node.webDomain?.toString() ?: ""
        return webDomain == "accounts.google.com"
    }

    /**
     * Check if node is a Google login field candidate (accounts.google.com).
     * Used for special handling of Google's split username/password screens.
     */
    fun isGoogleFieldCandidate(node: AssistStructure.ViewNode): Boolean {
        val webDomain = node.webDomain?.toString() ?: ""
        return webDomain == "accounts.google.com"
    }

    /**
     * Check if the structure is from a known login domain.
     * Checks webDomain and HTML attributes for login indicators.
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

    // ===== HTML Attribute Helpers (local to avoid circular dependency) =====

    /**
     * Extract HTML input type from ViewNode's htmlInfo.attributes.
     * Returns the value of 'type' attribute (e.g., "email", "password", "text")
     */
    fun getHtmlInputType(node: AssistStructure.ViewNode): String? {
        val htmlInfo = node.htmlInfo
        if (htmlInfo == null) return null

        val attributes = htmlInfo.attributes
        if (attributes == null) return null

        for (attr in attributes) {
            if (attr.first.lowercase() == "type") {
                return attr.second.lowercase()
            }
        }
        return null
    }

    /**
     * Extract HTML autocomplete attribute from ViewNode's htmlInfo.attributes.
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
     * Extract HTML name attribute from ViewNode's htmlInfo.attributes.
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
     * Extract HTML id attribute from ViewNode's htmlInfo.attributes.
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
}