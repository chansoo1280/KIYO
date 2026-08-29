# Plan: Autofill Field Detection — FieldScorerTest.kt (Phase 4 of 5)

**Date:** 2026-08-24  
**Branch:** `feature/autofill-reliability`  
**Target Test File:** `android/app/src/test/java/com/kiyo/app/autofill/detection/FieldScorerTest.kt` (NEW FILE)  
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도
**Parent Plan:** `.hermes/plans/2026-08-24-autofill-field-detection.md` (master plan)
**Decided:** OTP signal strength = -100, new-password = simple score adjustment (no SaveInfo)

---

## Phase Overview (Full Track 1 Field Detection Work)

| Phase | Scope | File | Status |
|-------|-------|------|--------|
| **1** | Add constants to `FieldScoringRules.kt` | `SCORE_OTP_NEGATIVE = 100`, tune HTML autocomplete (150→180), reduce fallback (10→5) | `FieldScoringRules.kt` | 🔴 TODO |
| **2** | Implement scoring logic in `FieldScorer.kt` | OTP negative signal, new-password handling, structured logging | `FieldScorer.kt` | 🔴 TODO |
| **3** | Update `FieldScoringRulesTest.kt` | Replace 3 WebView TODOs + OTP/new-password tests | `FieldScoringRulesTest.kt` | 🔴 TODO |
| **4** | **Create `FieldScorerTest.kt` (THIS PLAN)** | New test file covering all FieldScorer changes | `FieldScorerTest.kt` | 🟡 READY WHEN 1-2 DONE |
| **5** | Manual + E2E verification | Samsung Internet, Chrome Custom Tabs, OTP forms, registration forms | Device/Emulator | 🔴 TODO |

> **Execution Order:** 1 → 2 → 3 → 4 → 5. Phase 4 (this plan) MUST wait for Phases 1-2 to complete (constants + logic must exist before tests compile).

---

## Goal

Create new test file `FieldScorerTest.kt` covering all `FieldScorer.kt` changes from Phases 1-2.

---

## Changes to Test (from FieldScorer.kt Phases 1-2)

| # | Component | Change | Verification (Test Method) |
|---|-----------|--------|---------------------------|
| 1 | `calculateUsernameScore` | Add structured logging for candidate details | `calculateUsernameScore logs structured candidate details` (verify via **ShadowLog** capture in test) |
| 2 | `calculatePasswordScore` | Add structured logging for candidate details | `calculatePasswordScore logs structured candidate details` (verify via **ShadowLog** capture in test) |

---

## Test File Structure (NEW FILE)

```kotlin
package com.kiyo.app.autofill.detection

import android.app.assist.AssistStructure
import android.util.Log
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowLog

@ExperimentalCoroutinesApi
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE)
class FieldScorerTest {

    private lateinit var mockNode: AssistStructure.ViewNode
    private lateinit var logOutput: java.io.ByteArrayOutputStream

    @Before
    fun setup() {
        // Capture logs for structured logging verification
        logOutput = java.io.ByteArrayOutputStream()
        ShadowLog.stream = java.io.PrintStream(logOutput)

        mockNode = mockk()
        // Common setup for all tests
        every { mockNode.autofillId } returns mockk<android.view.autofill.AutofillId>()
        every { mockNode.className } returns "android.widget.EditText"
        every { mockNode.childCount } returns 0
        every { mockNode.inputType } returns 1 // TYPE_CLASS_TEXT
        every { mockNode.autofillHints } returns null
        every { mockNode.hint } returns null
        every { mockNode.idEntry } returns null
        every { mockNode.idPackage } returns null
        every { mockNode.webDomain } returns null
    }

    // Helper: Mock HTML autocomplete attribute
    private fun mockHtmlAutocomplete(value: String) {
        val mockHtmlInfo = mockk<AssistStructure.HtmlInfo>()
        every { mockHtmlInfo.attributes } returns listOf("autocomplete" to value)
        every { mockNode.htmlInfo } returns mockHtmlInfo
    }

    // Helper: Mock HTML input type attribute
    private fun mockHtmlInputType(value: String) {
        val mockHtmlInfo = mockk<AssistStructure.HtmlInfo>()
        every { mockHtmlInfo.attributes } returns listOf("type" to value)
        every { mockNode.htmlInfo } returns mockHtmlInfo
    }

    // Helper: Mock HTML autocomplete AND input type (for combined attributes)
    private fun mockHtmlAttributes(autocomplete: String? = null, inputType: String? = null) {
        val attributes = mutableListOf<Pair<String, String>>()
        autocomplete?.let { attributes.add("autocomplete" to it) }
        inputType?.let { attributes.add("type" to it) }
        val mockHtmlInfo = mockk<AssistStructure.HtmlInfo>()
        every { mockHtmlInfo.attributes } returns attributes
        every { mockNode.htmlInfo } returns mockHtmlInfo
    }

    // Helper: Capture and assert structured log format
    private fun assertStructuredLogContains(autofillId: String, expectedScore: Int, expectedHtmlAutocomplete: String?) {
        val logs = logOutput.toString()
        assertTrue("Log should contain FieldCandidate entry", logs.contains("FieldCandidate"))
        assertTrue("Log should contain autofillId=$autofillId", logs.contains("autofillId=$autofillId"))
        assertTrue("Log should contain score=$expectedScore", logs.contains("score=$expectedScore"))
        expectedHtmlAutocomplete?.let {
            assertTrue("Log should contain htmlAutocomplete=$it", logs.contains("htmlAutocomplete=$it"))
        }
    }

    // Test 1: Username structured logging
    @Test
    fun `calculateUsernameScore logs structured candidate details`() = runTest {
        // Setup: any valid username candidate
        // Verify: System.out contains structured log format
        // Expected: "FieldCandidate autofillId=<id> score=<score> reasons=[...] className=<class> htmlAutocomplete=<val>"
        every { mockNode.autofillHints } returns arrayOf("username")

        FieldScorer.calculateUsernameScore(mockNode)

        val autofillId = (mockNode.autofillId as android.view.autofill.AutofillId).toString()
        assertStructuredLogContains(autofillId, FieldScoringRules.SCORE_AUTOFILL_HINTS_USERNAME, null)
    }

    // Test 2: Password structured logging
    @Test
    fun `calculatePasswordScore logs structured candidate details`() = runTest {
        // Setup: any valid password candidate
        // Verify: System.out contains structured log format
        every { mockNode.autofillHints } returns arrayOf("password")

        FieldScorer.calculatePasswordScore(mockNode)

        val autofillId = (mockNode.autofillId as android.view.autofill.AutofillId).toString()
        assertStructuredLogContains(autofillId, FieldScoringRules.SCORE_AUTOFILL_HINTS_PASSWORD, null)
    }

    // Additional baseline tests for coverage (not in plan but needed for new file):
    @Test
    fun `calculateUsernameScore returns candidate for autofillHints=username`() = runTest {
        every { mockNode.autofillHints } returns arrayOf("username")
        val candidate = FieldScorer.calculateUsernameScore(mockNode)
        assertNotNull(candidate)
        assertTrue(candidate!!.score >= FieldScoringRules.SCORE_AUTOFILL_HINTS_USERNAME)
    }

    @Test
    fun `calculateUsernameScore returns candidate for htmlAutocomplete=username`() = runTest {
        mockHtmlAutocomplete("username")
        val candidate = FieldScorer.calculateUsernameScore(mockNode)
        assertNotNull(candidate)
        assertTrue(candidate!!.score >= FieldScoringRules.SCORE_HTML_AUTOCOMPLETE_USERNAME)
    }

    @Test
    fun `calculatePasswordScore returns candidate for autofillHints=password`() = runTest {
        every { mockNode.autofillHints } returns arrayOf("password")
        val candidate = FieldScorer.calculatePasswordScore(mockNode)
        assertNotNull(candidate)
        assertTrue(candidate!!.score >= FieldScoringRules.SCORE_AUTOFILL_HINTS_PASSWORD)
    }

    @Test
    fun `calculatePasswordScore returns candidate for htmlInputType=password`() = runTest {
        mockHtmlInputType("password")
        val candidate = FieldScorer.calculatePasswordScore(mockNode)
        assertNotNull(candidate)
        assertTrue(candidate!!.score >= FieldScoringRules.SCORE_HTML_INPUT_TYPE_PASSWORD)
    }
}
```

---

## Verification Criteria

- [ ] **Phase 1-2 complete**: `FieldScoringRules.kt` has `SCORE_OTP_NEGATIVE = 100`, `SCORE_REGISTRATION_FORM = 50`, tuned constants; `FieldScorer.kt` has OTP negative, new-password bonus, structured logging logic
- [ ] **All 2 plan-specific tests** in `FieldScorerTest.kt` pass (`./gradlew test --tests "*FieldScorerTest*"`)
- [ ] **Additional baseline tests** pass (ensure new file has full coverage)
- [ ] **Structured logging verified programmatically** via `ShadowLog` (not manual logcat):
  - Log format: `FieldCandidate autofillId=<id> score=<score> reasons=[...] className=<class> htmlAutocomplete=<val>`
  - Both username and password log tests capture and assert on this format
- [ ] **Existing tests unaffected**: `./gradlew test --tests "*FieldScoringRulesTest*"` passes (18 existing + new WebView/OTP/new-password tests from Phase 3)
- [ ] **Run command**: `./gradlew test --tests "*FieldScorer*" --tests "*FieldScoringRules*"`

---

## Dependencies (Strict Order)

1. **Phase 1**: `FieldScoringRules.kt` — Add `SCORE_OTP_NEGATIVE = 100`, `SCORE_REGISTRATION_FORM` (value TBD), tuned constants
2. **Phase 2**: `FieldScorer.kt` — Implement OTP negative, new-password bonus, structured logging (single-line format)
3. **Phase 3**: `FieldScoringRulesTest.kt` — WebView TODOs + OTP/new-password tests (parallel with Phase 4)
4. **Phase 4 (THIS)**: `FieldScorerTest.kt` — New file, compiles only after Phase 1-2
5. **Phase 5**: Manual/E2E verification

> **Note**: This plan (Phase 4) is NOT independently actionable. It requires Phases 1-2 to be merged first.

---

## Open Questions (Resolved for This Plan)

| Question | Decision | Rationale |
|----------|----------|-----------|
| OTP signal strength | **-100** (`SCORE_OTP_NEGATIVE = 100`) | Same magnitude as positive autofillHints bonus; strong enough to push OTP below valid username |
|| new-password handling | **Simple score adjustment** (bonus) | No SaveInfo trigger; registration form detection via score only; UX handled at fill-response layer |
|| Structured logging verification | **ShadowLog capture** in unit tests | Automatable, CI-friendly; manual logcat as supplementary only |
|| `SCORE_REGISTRATION_FORM` value | **50** | Same as `SCORE_GOOGLE_PASSWORD_SCREEN`; meaningful but not dominant |