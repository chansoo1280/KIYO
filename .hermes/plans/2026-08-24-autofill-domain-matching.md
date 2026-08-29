# Plan: Autofill Domain Matching Improvements

**Date:** 2026-08-24  
**Branch:** `feature/autofill-reliability`  
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도  
**Topic:** Domain Matching Improvements

## Goal

Improve domain matching reliability for web autofill and package name matching for native Android apps.

## Changes

### 1. DomainMatcher.kt Improvements

#### File: `android/app/src/main/java/com/kiyo/app/autofill/repository/DomainMatcher.kt`

**Component:** `findMatchingAccounts`  
**Change:** Add support for wildcard subdomain matching (`*.example.com`)  
**Reason:** Some sites use wildcard subdomains; current parent-domain-only misses these

**Component:** `findByPackageName`  
**Change:** Add exact package name match + prefix match for app families  
**Reason:** Package names like `com.example.app` and `com.example.app.beta` should match same account

**Component:** `findMatchingAccounts`  
**Change:** Normalize domain (lowercase, strip www., strip port) before matching  
**Reason:** Case/port differences cause missed matches

**Component:** New method  
**Change:** `findBestMatch(domain, packageNames)` — unified match scoring  
**Reason:** Single entry point for both web + native matching with confidence score

## Tests

### Unit Tests (JVM) - Additions to Existing Test File

**Test File:** `DomainMatcherTest`  
**Additions:**
- +5: parent domain (a.b.c.com→b.c.com)
- +5: wildcard `*.example.com`
- +5: case/port normalization
- +5: prefix package match (`com.app`/`com.app.beta`)
- +5: `findBestMatch` unified scoring

## Verification Criteria

- [x] Unit tests pass for DomainMatcher (26/26 green)
- [ ] Manual verification shows improved matching for:
  - Wildcard subdomains (e.g., account for *.example.com works on api.example.com)
  - Case-insensitive domain matching
  - Port-normalized domain matching
  - Package name prefix matching (com.app and com.app.beta share accounts)

## Verification Structure (Test File by Test File)

| Test File | Type | Scenarios to Pass | Status |
|-----------|------|-------------------|--------|
| `DomainMatcherTest` | JVM Unit | **Existing 12 tests** + **14 new/updated**: parent domain, wildcard subdomain, wildcard base match, case/port/www/protocol normalization, prefix package match, unrelated package rejection, `findBestMatch` unified scoring (exact vs wildcard domain, exact vs prefix package, combined, both-match highest) | ✅ 26/26 Pass |

**Pass Criteria:** All test files in this table must pass (green) for this plan to be complete.