---
type: utility
title: URL Parsing Utilities
description: Utility functions for extracting, normalizing, and validating domains and URLs used in autofill service integration.
tags: [frontend, utils, url, domain]
---
# URL Parsing Utilities (`src/utils/urlUtils.ts`)

This module provides utility functions for handling URLs and domains, primarily used by the Android Autofill service for matching websites and apps to stored credentials.

## Functions

### `extractDomain(url: string): string | null`

Extracts and normalizes the domain from a URL string.

**Parameters:**
- `url`: The URL to process

**Returns:** 
- Normalized domain string (lowercase, no www prefix, no port) or `null` if invalid

**Examples:**
```typescript
extractDomain("https://www.naver.com/login")    // returns "naver.com"
extractDomain("https://login.microsoftonline.com/") // returns "login.microsoftonline.com"
extractDomain("http://localhost:3000")          // returns "localhost"
extractDomain("https://sub.domain.example.co.kr/path") // returns "sub.domain.example.co.kr"
extractDomain("invalid-url")                    // returns null
```

**Implementation Notes:**
1. Adds `https://` protocol if missing for proper URL parsing
2. Extracts hostname and removes port if present
3. Converts to lowercase
4. Removes "www." prefix if present
5. Validates the result is a valid domain or localhost

### `isValidDomain(domain: string): boolean`

Validates if a string is a valid domain name using regex.

**Parameters:**
- `domain`: The domain string to validate

**Returns:** `true` if valid domain format, `false` otherwise

<!-- openwiki: broken internal link [[a-z0-9-]{0,61}[a-z0-9]] file "[a-z0-9-]{0,61}[a-z0-9]" does not exist. Fix the href or restore the target, then delete this comment. -->
<!-- openwiki: broken internal link [[a-z0-9-]{0,61}[a-z0-9]] file "[a-z0-9-]{0,61}[a-z0-9]" does not exist. Fix the href or restore the target, then delete this comment. -->
**Regex:** `/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i`

### `processWebsiteUrl(url: string): { websiteUrl: string; domain: string | null }`

Processes a website URL to extract both the original URL and its domain.

**Parameters:**
- `url`: The website URL to process

**Returns:** Object with:
- `websiteUrl`: The trimmed original URL
- `domain`: The extracted domain (or `null` if invalid)

### `isValidUrl(url: string): boolean`

Checks if a URL is syntactically valid.

**Parameters:**
- `url`: The URL to validate

**Returns:** `true` if valid URL format, `false` otherwise

**Implementation:** Attempts to construct a URL object (adding `https://` if missing) and catches exceptions.

### `normalizeDomain(domain: string): string`

Normalizes a domain for comparison (lowercase, no www prefix).

**Parameters:**
- `domain`: The domain to normalize

**Returns:** Normalized domain string

**Examples:**
```typescript
normalizeDomain("WWW.EXAMPLE.COM")   // returns "example.com"
normalizeDomain("Example.Com:8080")  // returns "example.com:8080" (note: port not removed here)
```

## Usage in Autofill Service

These utilities are used by the Android Autofill service to:
1. Extract domains from saved credential websites for matching
2. Normalize domains for comparison with autofill request origins
3. Validate website URLs when saving new credentials
4. Process user-entered URLs in the settings and UI

The autofill service uses `extractDomain` to convert stored website URLs into comparable domain strings when determining if a saved credential matches the current app or website requesting autofill.

## Testing

Unit tests for these functions can be found in the test suite. Look for tests related to URL parsing and domain extraction.

## Related Files

- Android domain matching logic: `/openwiki/android/repository/domain-matching.md`
- Autofill repository: `/openwiki/android/repository/autofill-repository.md`
- Settings storage: `/openwiki/frontend/state-management.md`