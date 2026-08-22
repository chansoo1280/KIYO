# KIYO Android E2E Test Completion - Long-term Plan

## Executive Summary

This document outlines a comprehensive plan to complete the Android E2E test suite for KIYO's autofill functionality. The goal is to establish reliable, maintainable E2E tests that verify the complete autofill flow from vault creation through credential filling in real Android apps.

---

## Current State Analysis

### ✅ What Exists

1. **Web E2E Tests (Playwright)**: 11 test files covering vault lifecycle, account CRUD, templates, search, lock, import/export, persistence
2. **Android Unit/Integration Tests**: DomainMatcherTest, FieldScoringRules, AccountMapper tests
3. **Android E2E Test Skeleton**: `AutofillE2ETest.kt` with one main test (`E2E_A_CreateVaultCreateAccountSyncAndVerifyAutofill`)
4. **Test Host App**: `AutofillTestHostActivity` - native Android Activity for testing autofill dropdown
5. **Test Infrastructure**: `TestSecurityInitializer`, `DeviceLockHelper` for test environment setup
6. **Run Script**: `run-autofill-e2e.ps1` for device setup and test execution

### ❌ What's Missing / Incomplete

| Area | Status | Gap |
|------|--------|-----|
| **Test Coverage** | ~1 test | Need comprehensive test matrix (biometric, auto-lock, multi-vault, edge cases) |
| **Test Stability** | Fragile | WebView interactions via Espresso-Web are flaky; no proper waits/selectors |
| **CI Integration** | None | No GitHub Actions workflow for Android E2E |
| **Device Management** | Manual | Requires manual ADB commands; no emulator lifecycle automation |
| **Test Data** | Hardcoded | Need test data factories and isolation between tests |
| **Reporting** | Logcat only | No structured test reports (JUnit XML, Allure, etc.) |
| **Parallel Execution** | N/A | Tests not designed for parallel execution |

---

## Architecture Constraints (Must Respect)

1. **Security**: Never weaken production security for tests (Keystore, SQLCipher, biometric requirements)
2. **Process Boundaries**: AutofillService runs in separate process - no shared memory state
3. **Keystore Behavior**: Keys persist across process restarts when device unlocked; 30-min auth cache
4. **Autofill Flow**: Fill request → Keystore auth → DB query → FillResponse (no token sync needed)
5. **WebView Testing**: React app in WebView requires Espresso-Web; **use user-centric selectors (visible text, accessibility labels, ARIA roles, placeholders) — NO `data-testid` or test-only attributes**. Tests must mirror real user interaction.

---

## Phased Implementation Plan

### Phase 1: Foundation & Stabilization (Weeks 1-2)
**Goal**: Make existing test reliable and establish test infrastructure

#### Tasks
1. **Adopt user-centric selector strategy for WebView** — No `data-testid` added to production code
   - Use **visible text** (button labels, headings), **ARIA roles/labels**, **placeholders**, **input types** as primary selectors
   - Espresso-Web `Locator.XPATH` with `contains(text(), '...')`, `Locator.ID` for `aria-label`, `Locator.CLASS_NAME` for Ionic components
   - Build robust `WebViewTestHelper` with retry logic, explicit waits, and fallback selector chains

2. **Refactor AutofillE2ETest.kt** - Replace fragile hardcoded selectors with resilient user-centric patterns
   - Extract `WebViewTestHelper` with methods: `clickByText()`, `clickByAriaLabel()`, `typeByPlaceholder()`, `typeByInputType()`, `waitForText()`
   - Add proper explicit waits with conditions (element visible, enabled, text present)
   - Extract page object pattern for React app screens using user-centric selectors

3. **Create test utilities**
   - `TestDataFactory` for generating unique vault/account data per test
   - `WebViewTestHelper` with stable user-centric element finding
   - `AutofillTestHost` wrapper for launching/verifying test host app

4. **Fix test environment setup**
   - Ensure `run-autofill-e2e.ps1` works reliably
   - Add Gradle task for test APK assembly
   - Document exact device/emulator requirements (API 26+, biometric support)

5. **Add test for basic vault unlock flow**
   - Encrypted vault creation → PIN unlock → verify autofill works

#### Deliverables
- Stable `E2E_A_CreateVaultCreateAccountSyncAndVerifyAutofill` test (user-centric selectors only)
- Page object classes for React screens (user-centric)
- Test utilities package
- Working run script

---

### Phase 2: Core Autofill Test Matrix (Weeks 3-4)
**Goal**: Comprehensive coverage of autofill scenarios

#### Test Cases to Implement

| Test ID | Scenario | Priority |
|---------|----------|----------|
| E2E_B | Encrypted vault + PIN unlock → autofill | P0 |
| E2E_C | Biometric vault unlock → autofill | P0 |
| E2E_D | Auto-lock triggers → autofill blocked until unlock | P0 |
| E2E_E | Multiple accounts for same domain → dropdown selection | P1 |
| E2E_F | Package name matching (app autofill) | P1 |
| E2E_G | Domain matching with subdomains/path variants | P1 |
| E2E_H | No matching account → no dropdown | P1 |
| E2E_I | Vault switch → autofill data updates | P2 |
| E2E_J | Account edit/delete → autofill sync | P2 |

#### Technical Tasks
1. **Implement biometric test** - Use `BiometricAuthHelper` with test biometric (API 29+ emulator)
2. **Implement auto-lock test** - Use `useAutoLock` settings, verify key clearing
3. **Add package name test support** - Test app `com.kiyo.autofilltest` already configured
4. **Test data isolation** - Each test creates unique vault file name

---

### Phase 3: Edge Cases & Resilience (Weeks 5-6)
**Goal**: Production-ready test robustness

#### Test Cases
| Test ID | Scenario | Priority |
|---------|----------|----------|
| E2E_K | Process death/restart → Keystore auth cache works | P0 |
| E2E_L | Biometric enrollment change → key invalidated | P1 |
| E2E_M | Wrong PIN/biometric → proper error handling | P1 |
| E2E_N | Corrupted vault file → graceful error | P2 |
| E2E_O | Concurrent autofill requests | P2 |
| E2E_P | Screen rotation during autofill | P3 |

#### Technical Tasks
1. **Process death simulation** - Kill app process, verify autofill still works
2. **Biometric re-enrollment test** - Use `adb shell cmd biometric` (API 29+)
3. **Flaky test mitigation** - Retry logic, better timeouts, screenshot on failure
4. **Test cleanup verification** - Ensure no state leakage between tests

---

### Phase 4: CI/CD Integration (Weeks 7-8)
**Goal**: Automated execution in GitHub Actions

#### Tasks
1. **Create GitHub Actions workflow** (`.github/workflows/android-e2e.yml`)
   - Spin up Android emulator (API 30+ with Play Store for biometric)
   - Install KIYO app + autofill-test-host app
   - Enable autofill service via ADB
   - Run `connectedAndroidTest`
   - Upload test reports (JUnit XML) and artifacts (screenshots, logs)

2. **Emulator configuration**
   - Hardware profile: pixel_6_pro (API 30+)
   - Biometric enrollment via `adb -e emu finger touch 1`
   - PIN setup via ADB in workflow

3. **Test result publishing**
   - JUnit XML for test results
   - Allure or HTML report for visualization
   - Failure artifacts: logcat, screenshots, WebView dumps

4. **Scheduled runs** - Nightly + PR validation

---

### Phase 5: Advanced & Maintenance (Ongoing)
**Goal**: Continuous improvement

- Visual regression for WebView screens
- Performance benchmarks (autofill latency)
- Cross-API level testing (API 26, 28, 30, 33, 34)
- Real device farm integration (Firebase Test Lab)
- Test analytics dashboard

---

## Implementation Details

### User-Centric Selector Strategy for React Components (WebView)

**No `data-testid` or test-only attributes added to production code.** Tests interact with the app exactly as users do:

| Selector Type | Espresso-Web Locator | Example |
|---------------|---------------------|---------|
| **Visible text** | `Locator.XPATH` with `contains(text(), '...')` | Button "파일 생성", "생성", "저장", "+" |
| **ARIA label** | `Locator.ID` (maps to `aria-label`) | FAB `aria-label="Add account"` |
| **Placeholder** | `Locator.XPATH` with `@placeholder='...'` | Input `placeholder="example@email.com"` |
| **Input type** | `Locator.XPATH` with `@type='...'` | `input[type='password']`, `input[type='email']` |
| **ARIA role** | `Locator.XPATH` with `@role='...'` | `role='button'`, `role='dialog'` |
| **Ionic component** | `Locator.CLASS_NAME` / `Locator.TAG_NAME` | `ion-fab-button`, `ion-input`, `ion-checkbox` |
| **Accessibility hint** | `Locator.XPATH` with `@content-desc='...'` | Native accessibility description |

**Robust selector chain pattern** (try in order, fallback on failure):
```kotlin
// Example: Click "파일 생성" button
fun clickCreateVaultButton() = trySelectorChain(
    { clickByAriaLabel("파일 생성") },           // 1. ARIA label
    { clickByText("파일 생성") },                // 2. Visible text
    { clickByRole("button", "파일 생성") },      // 3. Role + text
    { clickByClassName("ion-fab-button") }       // 4. Ionic component fallback
)
```

### Page Object Pattern (User-Centric)

```kotlin
// Example: VaultCreatePage.kt
class VaultCreatePage(private val helper: WebViewTestHelper) {
    fun createVault(fileName: String, encrypted: Boolean = true) {
        helper.clickByText("파일 생성")           // "파일 생성" 버튼
        helper.typeByPlaceholder("파일명", fileName)  // 파일명 입력
        if (!encrypted) {
            helper.clickByText("파일 암호화 사용")    // 체크박스 라벨 클릭
        }
        helper.clickByText("생성")                // "생성" 버튼
        helper.waitForText("내 계정")             // 계정 리스트 페이지 진입 확인
    }
}
```

### Test Data Factory

```kotlin
object TestDataFactory {
    fun uniqueVaultName(): String = "e2e-vault-${System.currentTimeMillis()}.json"
    fun uniqueAccount(): Account = Account(
        username = "user${System.currentTimeMillis()}",
        password = "pass${System.currentTimeMillis()}",
        domain = "test${System.currentTimeMillis()}.com"
    )
}
```

---

## Risk Assessment & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WebView test flakiness | High | High | User-centric selector chains with fallbacks, explicit waits, retry logic, screenshot on failure |
| Emulator biometric unreliability | Medium | High | Fallback to PIN tests; document biometric as optional |
| Keystore state leakage between tests | Medium | High | `TestSecurityInitializer` with `recreateKeystoreKeys=true` per test class |
| Slow test execution (2-3 min/test) | High | Medium | Parallel test execution, test sharding |
| CI emulator startup time | Medium | Medium | Reuse emulator across jobs, cache AVD |
| Autofill service not enabled in CI | Low | High | Explicit ADB enable in workflow with verification |
| Korean/English text mismatch | Medium | Medium | Selector chains try both languages; use placeholders/input types as language-agnostic fallback |

---

## Resource Requirements

### Infrastructure
- GitHub Actions: `ubuntu-latest` with Android emulator (API 30+)
- Self-hosted runner option for faster execution (macOS/Linux with KVM)
- Estimated CI time: 15-20 min per full test suite run

### Development
- 1 engineer for Phases 1-3 (core implementation)
- 0.5 engineer for Phase 4 (CI integration)
- Ongoing: 10% capacity for maintenance

---

## Success Metrics

1. **Reliability**: <5% flake rate over 30 runs
2. **Coverage**: All P0/P1 scenarios covered
3. **Speed**: Full suite <15 min in CI
4. **Signal**: Clear failure diagnostics (screenshots, logs, WebView dumps)
5. **Maintainability**: New autofill feature → add 1 E2E test in <30 min

---

## Rollback Strategy

If Phase 1-2 destabilize existing tests:
1. Revert to single working test (`E2E_A`)
2. Keep new test utilities but disable new tests
3. Debug incrementally with verbose logging

---

## Dependencies & Blockers

| Dependency | Status | Notes |
|------------|--------|-------|
| **User-centric selector infrastructure** | Not started | Build `WebViewTestHelper` with selector chains (no frontend changes needed) |
| Biometric emulator support | Available | API 29+ required; `emu finger touch` works |
| Android test orchestration | Manual | Need Gradle/AndroidJUnitRunner config |
| Playwright Web E2E | Working | Separate from Android E2E |
| Korean/English UI text mapping | Partial | Need to catalog all visible texts used in selectors |

---

## Next Steps

1. **Immediate**: Build `WebViewTestHelper` with user-centric selector chains (Week 1) — no frontend changes needed
2. **Week 1**: Refactor `AutofillE2ETest` with page objects using user-centric selectors
3. **Week 2**: Verify stable execution locally
4. **Week 3-4**: Implement core test matrix
5. **Week 5-6**: Edge cases & resilience
6. **Week 7-8**: CI integration

---

## Appendix: File Map

| File | Purpose | Phase |
|------|---------|-------|
| `android/app/src/androidTest/java/com/kiyo/app/autofill/AutofillE2ETest.kt` | Main E2E test | 1-3 |
| `android/app/src/androidTest/java/com/kiyo/app/autofill/pageobjects/` | Page objects (new) | 1 |
| `android/app/src/androidTest/java/com/kiyo/app/autofill/testutil/` | Test utilities (new) - includes `WebViewTestHelper` | 1 |
| `android/app/src/androidTest/java/com/kiyo/app/testutil/TestSecurityInitializer.kt` | Env setup | 1 |
| `android/app/src/androidTest/java/com/kiyo/app/testutil/DeviceLockHelper.kt` | Device state | 1 |
| `android/autofill-test-host/src/main/java/com/kiyo/autofilltest/AutofillTestHostActivity.kt` | Test host app | 1-3 |
| `run-autofill-e2e.ps1` | Local run script | 1 |
| `.github/workflows/android-e2e.yml` | CI workflow (new) | 4 |