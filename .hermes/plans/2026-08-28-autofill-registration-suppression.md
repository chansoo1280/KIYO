# Plan: Autofill Registration Form Suppression — FormClassifier & FillResponse Branching

**Date:** 2026-08-28 (Extracted from Autofill Matching Layer)  
**Branch:** `feature/autofill-reliability`  
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도  
**Depends on:** None (independent of index DB)

---

## Core Principle

**회원가입/비밀번호 변경 폼에서는 자동완성 데이터셋을 표시하지 않음.**
- `autocomplete="new-password"`만 있고 `autocomplete="current-password"`가 없는 폼을 대상
- 억제 시 `FillResponse`에 데이터셋 대신 `SaveInfo`만 포함하거나 `null` 반환
- 인덱스 DB와 **완전 분리** — 별도 계획으로 관리

---

## Goal

로그인 폼이 아닌 **회원가입/비번변경 폼에서 자동완성 드롭다운이 뜨는 것을 원천 차단**.

---

## Architecture

```
FillRequest
   │
   ├─ FormClassifier.isRegistrationForm(structure)
   │      └─ new-password만 있고 current-password 없으면 true
   │
   └─ false (로그인 폼 등)
        ↓
   인덱스 DB 매칭 → 메인 DB 조회 → FillResponse (데이터셋)
```

**FormClassifier는 ViewNode 트리만 순회** — DB 접근 없음, 인증 없음, 인덱스 DB 의존성 없음.

---

## Changes

### 1. FormClassifier — 회원가입 폼 판별 (신규 파일)

**File:** `android/app/src/main/java/com/kiyo/app/autofill/detection/FormClassifier.kt`

```kotlin
package com.kiyo.app.autofill.detection

import android.app.assist.AssistStructure
import com.kiyo.app.autofill.viewnode.HtmlAttributeExtractor
import com.kiyo.app.autofill.detection.FieldScoringRules

object FormClassifier {

    /**
     * 화면이 회원가입/비번변경 폼인지 판별 (autocomplete 기반)
     * - new-password 존재 && current-password 없음 → true
     * - autocomplete 속성이 없거나 판별 불가 시 → false (기존 동작 유지)
     */
    fun isRegistrationForm(rootNode: AssistStructure.ViewNode): Boolean {
        var hasCurrentPassword = false
        var hasNewPassword = false

        traverse(rootNode) { node ->
            val autocomplete = HtmlAttributeExtractor.getHtmlAutocomplete(node)?.lowercase() ?: ""
            if (autocomplete.contains("current-password")) hasCurrentPassword = true
            if (autocomplete.contains("new-password")) hasNewPassword = true
        }

        return hasNewPassword && !hasCurrentPassword
    }

    /** 화면에 어떤 비밀번호 필드든 존재하는지 확인 (폴백용) */
    fun hasAnyPasswordField(rootNode: AssistStructure.ViewNode): Boolean {
        return traverseAndCheck { node ->
            val autocomplete = HtmlAttributeExtractor.getHtmlAutocomplete(node)?.lowercase() ?: ""
            val inputType = HtmlAttributeExtractor.getHtmlInputType(node)?.lowercase() ?: ""
            autocomplete.contains("password") || inputType == "password" ||
            FieldScoringRules.isPasswordVariation(node.inputType ?: 0)
        }
    }

    private fun traverse(node: AssistStructure.ViewNode, action: (AssistStructure.ViewNode) -> Unit) {
        action(node)
        for (i in 0 until node.childCount) {
            traverse(node.getChildAt(i), action)
        }
    }

    private fun traverseAndCheck(node: AssistStructure.ViewNode, check: (AssistStructure.ViewNode) -> Boolean): Boolean {
        if (check(node)) return true
        for (i in 0 until node.childCount) {
            if (traverseAndCheck(node.getChildAt(i), check)) return true
        }
        return false
    }
}
```

---

### 2. FillResponseBuilder — 응답 분기

**File:** `android/app/src/main/java/com/kiyo/app/autofill/response/FillResponseBuilder.kt`

```kotlin
fun createFillResponse(
    accounts: List<AutofillAccount>,
    usernameId: AutofillId,
    passwordId: AutofillId,
    isRegistrationForm: Boolean = false
): FillResponse {
    if (isRegistrationForm) {
        // 회원가입 폼: 데이터셋 대신 SaveInfo만 반환 (저장 다이얼로그만 표시)
        return createSaveInfoResponse(usernameId, passwordId)
    }
    // 로그인 폼: 정상 데이터셋 반환
    return createDatasetResponse(accounts, usernameId, passwordId)
}
```

---

### 3. AuthRequestHandler — 플로우 통합 (인덱스 DB와 무관하게 적용 가능)

**File:** `android/app/src/main/java/com/kiyo/app/autofill/service/AuthRequestHandler.kt`

```kotlin
fun handleFillRequest(request: FillRequest, callback: FillCallback) {
    // 1. ViewNode에서 domain/packageNames 추출
    val domain = ViewNodeExtractor.extractDomainFromStructure(request.structure)
    val packageNames = ViewNodeExtractor.extractPackageNames(request.structure)

    // 2. 회원가입 폼 판별 (DB 접근 전, 인증 불필요, 인덱스 DB 의존성 없음)
    val isRegistrationForm = FormClassifier.isRegistrationForm(request.structure)

    // 3. 1차 필터링: 인덱스 DB에서 매칭 (별도 계획에서 구현)
    val matchingIds = repository.findMatchingAccountIdsByIndex(domain, packageNames)

    if (matchingIds.isEmpty()) {
        callback.onSuccess(null)
        return
    }

    // 4. 매칭됨 → 전체 계정 정보 조회 (메인 DB)
    val fullAccounts = try {
        repository.getAccountsByIds(matchingIds)
    } catch (e: UserNotAuthenticatedException) {
        callback.onSuccess(FillResponseBuilder.createAuthResponse())
        return
    }

    // 5. 필드 탐지
    val usernameId = FieldDetector.findBestFieldCandidate(request.structure, FieldScorer::calculateUsernameScore)
    val passwordId = FieldDetector.findBestFieldCandidate(request.structure, FieldScorer::calculatePasswordScore)

    // 6. 응답 생성 (회원가입 폼이면 SaveInfo, 아니면 데이터셋)
    val response = FillResponseBuilder.createFillResponse(fullAccounts, usernameId, passwordId, isRegistrationForm)
    callback.onSuccess(response)
}
```

> **핵심**: `FormClassifier.isRegistrationForm()`은 **인덱스 DB가 없어도 동작**함. 인덱스 DB 계획과 독립적으로 머지 가능.

---

## Tests

### Unit Tests (JVM)

| Test File | Scenarios |
|-----------|-----------|
| `FormClassifierTest` (NEW) | `isRegistrationForm`: new-password만 true → true, current-password도 있으면 false, autocomplete 없으면 false |
| `FillResponseBuilderTest` (추가) | `isRegistrationForm=true` → SaveInfo 반환, `false` → 데이터셋 반환 |

### Instrumentation Tests (E2E)

**File:** `AutofillE2ETest.kt` 신규 메서드

| 테스트 | 시나리오 | 기대 결과 |
|--------|----------|-----------|
| `autofillSuppressedOnRegistrationForm` | 회원가입 페이지(`new-password`만) 진입 → 자동완성 트리거 | 드롭다운 안 뜸 (또는 저장 다이얼로그만 표시) |
| `autofillWorksOnLoginForm` | 로그인 페이지(`current-password`) 진입 → 자동완성 트리거 | 정상 드롭다운 + 채우기 동작 |
| `autofillWorksOnPasswordChangeForm` | 비번변경 페이지(`current-password` + `new-password`) 진입 → 자동완성 트리거 | 정상 드롭다운 (current-password 있으므로 억제 안 함) |

---

## Risks & Mitigations

| 위험 | 영향 | 완화 |
|------|------|------|
| 회원가입 폼 판별 오탐 (False Positive) | 로그인 폼인데 드롭다운 억제됨 | `autocomplete` 없을 땐 판별 안 함(`false` 반환), 기존 폴백 유지 |
| 회원가입 폼 판별 누락 (False Negative) | 회원가입 폼인데 드롭다운 뜸 | `new-password` 탐지 로직 강화, 현장 테스트로 커버리지 확대 |
| SaveInfo 응답 시 UX 이슈 | 저장 다이얼로그가 오히려 방해됨 | 필요 시 `callback.onSuccess(null)`로 완전 무응답 옵션 추가 |

---

## Rollback

| 시나리오 | 롤백 액션 |
|----------|-----------|
| 판별 로직 버그 | `FormClassifier.isRegistrationForm` 기본 반환 `false`로 변경 |
| SaveInfo 응답 문제 | `FillResponseBuilder.createFillResponse`에서 `isRegistrationForm` 분기 제거 |

---

## Implementation Order

1. **FormClassifier 신규** + 단위 테스트
2. **FillResponseBuilder 분기** + 단위 테스트
3. **AuthRequestHandler 플로우 통합** (인덱스 DB 여부와 무관하게 적용)
4. **E2E 테스트 추가** + 수동 검증

---

## Verification Criteria

- [ ] `./gradlew test --tests "*FormClassifierTest" --tests "*FillResponseBuilderTest"` green
- [ ] `npm run test:e2e:android` — 신규 3개 시나리오 통과
- [ ] 수동 검증: 회원가입 폼에서 드롭다운 억제 확인, 로그인/비번변경 폼에서 정상 동작 확인
- [ ] 인덱스 DB 미적용 상태에서도 정상 동작 확인 (독립성 검증)

---

## Can Implementation Begin?

**Yes** — 인덱스 DB 계획과 **완전 독립적**. 별도 브랜치/PR로 진행 가능.

---

## Related Plans

- **Main Plan:** `2026-08-28-autofill-matching-layer.md` — Independent Encrypted Index DB
- **This Plan:** Registration Form Suppression (extracted for independent delivery)