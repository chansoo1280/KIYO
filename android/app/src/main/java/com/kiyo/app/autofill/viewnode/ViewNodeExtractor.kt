package com.kiyo.app.autofill.viewnode

import android.app.assist.AssistStructure
import com.kiyo.app.autofill.viewnode.HtmlAttributeExtractor.getHtmlAutocomplete
import com.kiyo.app.autofill.viewnode.HtmlAttributeExtractor.getHtmlId
import com.kiyo.app.autofill.viewnode.HtmlAttributeExtractor.getHtmlInputType
import com.kiyo.app.autofill.viewnode.HtmlAttributeExtractor.getHtmlName
import com.kiyo.app.autofill.viewnode.ViewNodePredicate.isActualInputField
import com.kiyo.app.autofill.viewnode.ViewNodePredicate.isContainerNode
import com.kiyo.app.autofill.viewnode.ViewNodePredicate.isGoogleFieldCandidate
import com.kiyo.app.autofill.viewnode.ViewNodePredicate.isKnownLoginDomain
import com.kiyo.app.autofill.viewnode.ViewNodeTraversal.traverse

/**
 * ViewNode data extractors.
 * Extracts domain, package names, app name, title, and password field detection from assist structure.
 */
object ViewNodeExtractor {

    /**
     * Extract domain from assist structure (webDomain from ViewNode).
     */
    fun extractDomainFromStructure(structure: AssistStructure.ViewNode): String {
        var domain = ""

        traverse(structure) { node ->
            if (domain.isNotEmpty()) return@traverse true
            node.webDomain?.let { domain = it.toString() }
            false
        }

        return domain
    }

    /**
     * Extract package names from assist structure.
     */
    fun extractPackageNamesFromStructure(structure: AssistStructure.ViewNode): List<String> {
        val packages = mutableSetOf<String>()

        traverse(structure) { node ->
            node.idPackage?.let { packages.add(it.toString()) }
            false
        }

        return packages.toList()
    }

    /**
     * Extract app name from structure (uses first package name found).
     */
    fun extractAppNameFromStructure(structure: AssistStructure.ViewNode): String? {
        var appName: String? = null

        traverse(structure) { node ->
            if (appName != null) return@traverse true
            node.idPackage?.let { appName = it.toString() }
            false
        }

        return appName
    }

    /**
     * Extract title from structure (web page title from HTML).
     */
    fun extractTitleFromStructure(structure: AssistStructure.ViewNode): String? {
        var title: String? = null

        traverse(structure) { node ->
            if (title != null) return@traverse true
            node.htmlInfo?.let { htmlInfo ->
                val attributes = htmlInfo.attributes
                if (attributes != null) {
                    for (attr in attributes) {
                        if (attr.first.lowercase() == "title") {
                            title = attr.second
                            return@traverse true
                        }
                    }
                }
            }
            false
        }

        return title
    }

    /**
     * Check if the current screen has a password field (password inputType or password hint).
     * Traverses from ROOT node to find any password field on the entire screen.
     */
    fun hasPasswordFieldOnScreen(rootNode: AssistStructure.ViewNode): Boolean {
        var hasPassword = false

        traverse(rootNode) { node ->
            if (hasPassword) return@traverse true

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
                return@traverse true
            }
            false
        }

        return hasPassword
    }

    /**
     * Check if node is an actual input field (not a container).
     * Delegates to ViewNodePredicate.
     */
    fun isActualInputField(node: AssistStructure.ViewNode): Boolean {
        return ViewNodePredicate.isActualInputField(node)
    }

    /**
     * Check if node is a container node.
     * Delegates to ViewNodePredicate.
     */
    fun isContainerNode(node: AssistStructure.ViewNode): Boolean {
        return ViewNodePredicate.isContainerNode(node)
    }

    /**
     * Check if node is a Google field candidate.
     * Delegates to ViewNodePredicate.
     */
    fun isGoogleFieldCandidate(node: AssistStructure.ViewNode): Boolean {
        return ViewNodePredicate.isGoogleFieldCandidate(node)
    }

    /**
     * Check if the structure is from a known login domain.
     * Delegates to ViewNodePredicate.
     */
    fun isKnownLoginDomain(rootNode: AssistStructure.ViewNode): Boolean {
        return ViewNodePredicate.isKnownLoginDomain(rootNode)
    }

    // Delegate HTML attribute getters to HtmlAttributeExtractor
    fun getHtmlInputType(node: AssistStructure.ViewNode): String? = HtmlAttributeExtractor.getHtmlInputType(node)
    fun getHtmlAutocomplete(node: AssistStructure.ViewNode): String? = HtmlAttributeExtractor.getHtmlAutocomplete(node)
    fun getHtmlName(node: AssistStructure.ViewNode): String? = HtmlAttributeExtractor.getHtmlName(node)
    fun getHtmlId(node: AssistStructure.ViewNode): String? = HtmlAttributeExtractor.getHtmlId(node)
}