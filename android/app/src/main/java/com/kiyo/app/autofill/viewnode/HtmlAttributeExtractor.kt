package com.kiyo.app.autofill.viewnode

import android.app.assist.AssistStructure

/**
 * HTML attribute extractors from ViewNode's htmlInfo.
 * Pure extraction functions - no logic, just attribute retrieval.
 */
object HtmlAttributeExtractor {

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