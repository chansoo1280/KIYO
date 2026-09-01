---
type: android-component
title: DomainMatcher
description: Web domain and Android package name matching for autofill credential lookup.
tags: [android, domain-matching, autofill]
---

# DomainMatcher

`/android/app/src/main/java/com/kiyo/app/autofill/repository/DomainMatcher.kt` provides the matching logic that decides whether a stored credential is relevant to the current `onFillRequest` context.

## API

```kotlin
object DomainMatcher {
    fun matches(
        storedDomain: String?,
        storedPackageNames: List<String>,
        requestDomain: String?,
        requestPackageNames: List<String>
    ): Boolean

    fun matchesDomain(stored: String?, request: String?): Boolean
    fun matchesPackage(stored: List<String>, request: List<String>): Boolean
}
```

## Domain Match Rules

`matchesDomain(stored, request)` returns `true` if:

- Both are null (no-domain match).
- Stored equals request (exact match).
- Stored is a **suffix** of request with a `.` separator (e.g., stored `google.com` matches request `accounts.google.com`).
- Request is a suffix of stored with a `.` separator (less common; covers redirects to parent).

Case is normalized to lowercase before comparison.

## Package Match Rules

`matchesPackage(stored, request)` returns `true` if any of the request package names matches any of the stored package names (case-insensitive). The stored list is typically `["com.example.app"]` while the request list may contain `["com.example.app", "com.example.app.activity"]` — any non-empty intersection matches.

## Combined Match

`matches` returns `true` if either `matchesDomain` or `matchesPackage` succeeds. This is the function called from `AutofillRepository.findMatchingAccountIdsByIndex`.

## Index DB Query

The matcher is paired with an SQL query in `AutofillRepository`:

```sql
SELECT account_id FROM autofill_index
WHERE LOWER(domain) = LOWER(?)
   OR LOWER(domain) IN (subdomains derived by string compare)
   OR package_names LIKE ?
```

The Java/Kotlin matcher handles the subdomain logic; the SQL query is a coarse pre-filter. Final scoring happens in Kotlin after row fetch.

## Source Anchors

- `DomainMatcher.kt` — `/android/app/src/main/java/com/kiyo/app/autofill/repository/DomainMatcher.kt`
- Caller — `/android/app/src/main/java/com/kiyo/app/autofill/repository/AutofillRepository.kt` (`findMatchingAccountIdsByIndex`)

## Tests

- `/android/app/src/test/java/com/kiyo/app/autofill/repository/DomainMatcherTest.kt`