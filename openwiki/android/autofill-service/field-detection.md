---
type: android-component
title: Autofill Field Detection
description: FieldDetector, FieldScorer, FieldScoringRules, FieldCandidate - logic that identifies username/password fields from an AssistStructure.
tags: [android, autofill, field-detection, scorer]
---

# Autofill Field Detection

KIYO detects username and password fields from the Android `AssistStructure` view hierarchy using a heuristic scoring system. The four collaborating classes live in `/android/app/src/main/java/com/kiyo/app/autofill/detection/`.

## FieldDetector

`FieldDetector.kt` is the entry point. It exposes three primary functions:

```kotlin
fun findFocusedNode(root: AssistNode): AssistNode?
fun findBestFieldCandidate(root: AssistNode, scorer: (AssistNode) -> Int): FieldCandidate?
fun hasLoginForm(root: AssistNode): Boolean
```

### findFocusedNode

Recursively walks the view hierarchy to find the field with the current input focus. This is the anchor that subsequent detection uses (e.g., password field is typically a descendant of the focused field's parent).

### findBestFieldCandidate

Walks the tree and selects the highest-scoring candidate according to the provided scorer function:

```kotlin
val usernameCandidate = FieldDetector.findBestFieldCandidate(
    rootViewNode,
    FieldScorer::calculateUsernameScore
)
val passwordCandidate = FieldDetector.findBestFieldCandidate(
    rootViewNode,
    FieldScorer::calculatePasswordScore
)
```

The result is a `FieldCandidate` with `autofillId`, `score`, and `reason` (a debug-friendly tag explaining the score).

### hasLoginForm

Returns `true` only when both a username and a password field are detected. Used by `KiyoAutofillService.onSaveRequest` to gate save operations.

## FieldScorer

`FieldScorer.kt` contains the per-field-type scoring logic:

```kotlin
fun calculateUsernameScore(node: AssistNode): Int
fun calculatePasswordScore(node: AssistNode): Int
```

These delegate to `FieldScoringRules` for individual rule contributions and combine them via weighted summation.

## FieldScoringRules

`FieldScoringRules.kt` defines the individual scoring rules. Each rule inspects a node and returns a score contribution:

| Rule | Description |
|------|-------------|
| `autofillHints` | Adds weight for `autofillHints` containing "username" / "emailAddress" / "name" or "password" / "newPassword" |
| `inputType` | Inspects `InputType` flags (TYPE_CLASS_TEXT, TYPE_TEXT_VARIATION_PASSWORD, TYPE_TEXT_VARIATION_EMAIL_ADDRESS, etc.) |
| `htmlAttributes` | Reads `htmlInfo.attributes` for `autocomplete` attribute values (`username`, `email`, `current-password`, etc.) — critical for Samsung Internet compatibility where `webDomain` is unavailable |
| `idEntry` | Matches Android `idEntry` against common username/password IDs |
| `text` | Inspects existing text content |
| `fieldLabel` | Reads sibling or parent label nodes |

The rules are weighted and combined in `FieldScorer` so that any single strong signal (e.g., `autocomplete="current-password"`) outweighs multiple weak signals.

## FieldCandidate

```kotlin
data class FieldCandidate(
    val autofillId: AutofillId,
    val score: Int,
    val reason: String
)
```

A simple holder for the detection result. `reason` is used only in `BuildConfig.DEBUG` logs to help diagnose misdetection.

## Source Anchors

- `FieldDetector.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/detection/FieldDetector.kt`
- `FieldScorer.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/detection/FieldScorer.kt`
- `FieldScoringRules.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/detection/FieldScoringRules.kt`
- `FieldCandidate.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/detection/FieldCandidate.kt`

## Tests

- `/android/app/src/test/java/com/kiyo/app/autofill/detection/FieldScorerTest.kt` — score contributions for various node shapes
- `/android/app/src/test/java/com/kiyo/app/autofill/detection/FieldScoringRulesTest.kt` — individual rules with positive/negative cases