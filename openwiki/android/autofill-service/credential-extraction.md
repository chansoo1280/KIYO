---
type: android-component
title: Credential Extractor
description: Extracts username/password values from AssistStructure fields after detection.
tags: [android, autofill, credentials, extraction]
---

# CredentialExtractor

`/android/app/src/main/java/com/kiyo/app/autofill/credential/CredentialExtractor.kt` reads the typed values from the detected username/password fields during an `onSaveRequest` flow.

## API

```kotlin
data class ExtractedCredentials(
    val username: String?,
    val password: String?
)

object CredentialExtractor {
    fun extractCredentialsFromFields(
        rootViewNode: AssistNode,
        usernameId: AutofillId?,
        passwordId: AutofillId?
    ): ExtractedCredentials
}
```

## Behavior

The extractor walks the `AssistStructure` view tree (rooted at `rootViewNode`), locates the nodes with the provided `AutofillId` values, and reads their `AutofillValue`:

- For text fields: returns the `textValue` as a UTF-8 string.
- For date fields: returns the date-time formatted as a string.
- For empty / null values: returns `null`.

Both fields are extracted in a single tree walk to avoid double-traversal cost.

## Caller

`KiyoAutofillService.onSaveRequest` uses the extractor to obtain the values to upsert:

```kotlin
val extractedData = CredentialExtractor.extractCredentialsFromFields(
    rootViewNode, usernameId, passwordId
)
val username = extractedData.username
val password = extractedData.password
// ...
if (username == null || password == null) {
    Log.d(TAG, "No username or password found to save")
    return@launch
}
```

If either field is empty, the save is silently dropped (per the Android Autofill contract — no UI is presented on save).

## Source Anchors

- `CredentialExtractor.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/credential/CredentialExtractor.kt`
- Caller — `/android/app/src/main/java/com/kiyo/app/autofill/service/KiyoAutofillService.kt` (`onSaveRequest`)