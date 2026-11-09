---
type: android-component
title: ViewNode Extraction
description: ViewNodeTraversal, ViewNodeExtractor, ViewNodePredicate, HtmlAttributeExtractor - utilities for extracting web domain, package names, and HTML attributes from an AssistStructure.
tags: [android, autofill, viewnode, html-attributes]
---

# ViewNode Extraction

KIYO extracts metadata from the `AssistStructure` view hierarchy to drive account matching, save eligibility, and UI presentation. The four collaborating classes live in `/android/app/src/main/java/com/kiyo/app/autofill/viewnode/`.

## ViewNodeTraversal

`ViewNodeTraversal.kt` provides recursive descent utilities over an `AssistNode` tree:

```kotlin
object ViewNodeTraversal {
    fun walk(root: AssistNode, visitor: (AssistNode, Int) -> Unit)
    fun findFirst(root: AssistNode, predicate: (AssistNode) -> Boolean): AssistNode?
    fun findAll(root: AssistNode, predicate: (AssistNode) -> Boolean): List<AssistNode>
    fun dumpViewNodeTree(root: AssistNode, depth: Int = 0) // debug-only
}
```

`walk` performs a depth-first traversal, invoking the visitor with `(node, depth)`. `findFirst` and `findAll` short-circuit / accumulate based on a predicate.

`dumpViewNodeTree` is gated by `BuildConfig.DEBUG` in `KiyoAutofillService.onFillRequest` to print the full tree to logcat — useful for diagnosing misdetection on real devices.

## ViewNodePredicate

`ViewNodePredicate.kt` contains composable predicate factories used by the extractors:

```kotlin
object ViewNodePredicate {
    fun isWebView(node: AssistNode): Boolean
    fun hasHtmlInfo(node: AssistNode): Boolean
    fun isTextField(node: AssistNode): Boolean
    fun isPasswordField(node: AssistNode): Boolean
    fun hasAutofillHints(node: AssistNode, hints: List<String>): Boolean
}
```

Predicates are pure functions of `AssistNode` metadata — they do not read autofill values.

## ViewNodeExtractor

`ViewNodeExtractor.kt` aggregates traversal + predicate application to answer the high-level questions used by the service:

```kotlin
object ViewNodeExtractor {
    fun extractDomainFromStructure(root: AssistNode): String?
    fun extractPackageNamesFromStructure(root: AssistNode): List<String>
    fun extractAppNameFromStructure(root: AssistNode): String?
    fun extractTitleFromStructure(root: AssistNode): String?
}
```

### extractDomainFromStructure

Resolves the current web domain from the `WebView`'s `webDomain` or `webHost` (top-level frame's URL). Falls back to parsing the URL string for hostname. Returns `null` for native apps.

### extractPackageNamesFromStructure

Collects every package name referenced by an `AssistNode` (via `AssistNode.idPackage` or by inspecting `webView` URL authority). Returns a de-duplicated list. The caller filters out `com.kiyo.app` and `android.*`.

### extractAppNameFromStructure / extractTitleFromStructure

Returns the user-visible app name (for Android apps) or web page title (for web views), used in the save prompt and account-list UI.

## HtmlAttributeExtractor

`HtmlAttributeExtractor.kt` reads HTML attributes from `webView` nodes. This is critical for Samsung Internet compatibility — when the system does not provide `webDomain`, the only way to detect a login form is via HTML `autocomplete` attributes.

```kotlin
object HtmlAttributeExtractor {
    fun findAttribute(node: AssistNode, name: String): String?
    fun findAutocomplete(node: AssistNode): String?
    fun findActionUrl(node: AssistNode): String?
    fun findInputType(node: AssistNode): String?
}
```

`findAutocomplete` returns the value of the `autocomplete` attribute (e.g., `"username"`, `"current-password"`, `"email"`). Used by `FieldScoringRules.htmlAttributes` as a strong signal in the scoring system.

## Source Anchors

- `ViewNodeTraversal.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/viewnode/ViewNodeTraversal.kt`
- `ViewNodeExtractor.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/viewnode/ViewNodeExtractor.kt`
- `ViewNodePredicate.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/viewnode/ViewNodePredicate.kt`
- `HtmlAttributeExtractor.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/viewnode/HtmlAttributeExtractor.kt`

## Tests

- `/android/app/src/test/java/com/kiyo/app/autofill/viewnode/HtmlAttributeExtractorTest.kt`