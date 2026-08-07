package com.kiyo.app.autofill.viewnode

import android.app.assist.AssistStructure
import android.util.Log

/**
 * Core ViewNode traversal functions.
 * Provides generic tree traversal utilities for finding nodes and dumping structure.
 */
object ViewNodeTraversal {

    private const val TAG = "ViewNodeTraversal"

    /**
     * Generic depth-first traversal of ViewNode tree.
     * Stops early if the action returns true.
     */
    fun traverse(node: AssistStructure.ViewNode, action: (AssistStructure.ViewNode) -> Boolean) {
        fun traverseInternal(n: AssistStructure.ViewNode): Boolean {
            if (action(n)) return true
            for (i in 0 until n.childCount) {
                if (traverseInternal(n.getChildAt(i))) return true
            }
            return false
        }
        traverseInternal(node)
    }

    /**
     * Generic depth-first traversal with depth tracking.
     */
    fun traverseWithDepth(node: AssistStructure.ViewNode, depth: Int, action: (AssistStructure.ViewNode, Int) -> Unit) {
        fun traverseInternal(n: AssistStructure.ViewNode, d: Int) {
            action(n, d)
            for (i in 0 until n.childCount) {
                traverseInternal(n.getChildAt(i), d + 1)
            }
        }
        traverseInternal(node, depth)
    }

    /**
     * Find the first node matching a predicate.
     */
    fun findFirst(node: AssistStructure.ViewNode, predicate: (AssistStructure.ViewNode) -> Boolean): AssistStructure.ViewNode? {
        var found: AssistStructure.ViewNode? = null
        traverse(node) { n ->
            if (predicate(n)) {
                found = n
                return@traverse true
            }
            false
        }
        return found
    }

    /**
     * Find the focused node in the tree.
     */
    fun findFocusedNode(rootNode: AssistStructure.ViewNode): AssistStructure.ViewNode? {
        return findFirst(rootNode) { it.isFocused }
    }

    /**
     * Dump entire ViewNode tree for debugging.
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

    /**
     * Log field detection debug info for entire tree.
     */
    fun logFieldDetectionDebugInfo(rootNode: AssistStructure.ViewNode, logNode: (AssistStructure.ViewNode, Int) -> Unit) {
        Log.d(TAG, "=== Field Detection Debug Info ===")

        traverseWithDepth(rootNode, 0) { node, depth ->
            logNode(node, depth)
        }

        Log.d(TAG, "=== End Field Detection Debug Info ===")
    }
}