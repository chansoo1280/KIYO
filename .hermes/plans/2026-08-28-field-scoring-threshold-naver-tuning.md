# Plan: Field Scoring Threshold & Naver/Asian-Site Tuning (Phase 7)

**Date:** 2026-08-28
**Branch:** `feature/autofill-reliability`
**Status:** Draft — awaiting approval
**Related:**
- `.hermes/plans/2026-08-24-autofill-field-detection.md` (Phases 1-4 ✅)
- `.hermes/plans/2026-08-24-autofill-field-detection-Phase5-E2E-verification.md`
- `docs/brainstorms/2026-08-28-login-page-html-structure-survey.md` (4-site dump analysis)
- `docs/brainstorms/2026-08-28-autofill-field-detection-improvements.md`

---

## Problem

Brainstorm `2026-08-28-login-page-html-structure-survey.md`의 4개 사이트 dump 결과, KIYO의 field scoring에 두 가지 **상호 보완적인 결함**이 드러남:

### 결함 1: Naver/한국 사이트에서 점수 부족

Naver login (`nid.naver.com`)는 표준을 무시:
- `autocomplete=""` (빈 문자열) → HTML autocomplete 보너스 0점
- `name="id"` → usernameKeywords에 "id" 포함 → +30점
- `name="pw"` → passwordKeywords에 **"pw" 없음** → 0점
- `aria-label="아이디 또는 전화번호"`, `"비밀번호"` → KIYO는 aria-label 무시 → 0점

**현재 추정 점수**:
- Username: ~45점 (10 + 30 + 5)
- Password: ~105점 (100 + 5)

**위험**: Username 점수가 낮아서 화면의 다른 텍스트 input (예: Naver 메인의 검색바가 동일 도메인에 있을 때 false positive) 또는 password에 비해 매칭 약화

### 결함 2: 명시적 score threshold 없음 (false positive 위험)

`FieldDetector.findBestFieldCandidate`는 `score == 0`만 거부 (line 159, 287 in FieldScorer.kt). 그 외 양수 점수는 모두 후보로 등록.

**위험 시나리오**:
- Naver 메인 페이지에서 검색바 (fallback 5점)가 username 후보로 채택
- Reddit 메인에서 검색바가 username 후보
- 일반 검색/댓글 페이지 어디든 EditText가 있으면 username 후보 → 도메인 매칭되면 드롭다운 뜸 → 잘못된 fill

### 결함 3: `name="pw"` 패턴 미지원

`passwordKeywords`에 `["password", "passwd", "pwd"]`만 있음. 일부 한국/일본 사이트는 `name="pw"`를 사용.

### 결함 4: `aria-label` 미사용

`FieldScoringRules`는 `node.hint` (Android `EditText.hint`)만 봄. WebView 내부 노드의 `aria-label`은 별도 속성이라 무시됨.
Naver 외 다수 사이트가 aria-label에 한국어/일본어 label을 둠.

---

## Goal

다음 두 가지를 **동시에** 해결:
1. **Naver/아시아 사이트**에서 username/password 점수 향상
2. **일반 페이지**(검색바/댓글)에서의 false positive 차단 (명시적 threshold)

---

## Changes

### 1. `FieldScoringRules.kt` — 상수 및 threshold 추가

**File:** `android/app/src/main/java/com/kiyo/app/autofill/detection/FieldScoringRules.kt`

```kotlin
object FieldScoringRules {
    // ... existing keywords ...
    val passwordKeywords = listOf("password", "passwd", "pwd", "pw")  // ⬅️ "pw" 추가

    // Score weights
    // ... existing weights ...

    // Minimum score to be considered a valid candidate
    // Filters out low-confidence signals (e.g., fallback 5점, inputType 10점 단독)
    // Empirical threshold from 4-site dump analysis (2026-08-28):
    //   - Naver username: 45점 (with "id" name match)
    //   - Naver password: 135점 (with inputType PASSWORD)
    //   - GitHub/Google/Reddit: 215+점
    //   - 일반 검색바/댓글: 5점 (filter됨)
    const val MIN_CANDIDATE_SCORE = 20
}
```

### 2. `FieldScorer.kt` — threshold 적용

**File:** `android/app/src/main/java/com/kiyo/app/autofill/detection/FieldScorer.kt`

```kotlin
// Line 159 (calculateUsernameScore)
// Before:
if (score == 0) return null
// After:
if (score < FieldScoringRules.MIN_CANDIDATE_SCORE) return null

// Line 287 (calculatePasswordScore) — 동일
if (score < FieldScoringRules.MIN_CANDIDATE_SCORE) return null
```

### 3. `HtmlAttributeExtractor.kt` — aria-label 추출 추가

**File:** `android/app/src/main/java/com/kiyo/app/autofill/viewnode/HtmlAttributeExtractor.kt`

```kotlin
/**
 * Extract aria-label from WebView/HTML node.
 * Returns the value of 'aria-label' attribute (e.g., "이메일 또는 전화번호", "Username").
 */
fun getAriaLabel(node: AssistStructure.ViewNode): String? {
    val htmlInfo = node.htmlInfo ?: return null
    val attributes = htmlInfo.attributes ?: return null
    for (attr in attributes) {
        if (attr.first.lowercase() == "aria-label") {
            return attr.second
        }
    }
    return null
}
```

### 4. `FieldScorer.kt` — aria-label 매칭

`calculateUsernameScore` (after line 117, before line 122 fallback):

```kotlin
// 8. aria-label keyword matching (WebView/HTML): +30
val ariaLabel = HtmlAttributeExtractor.getAriaLabel(node)?.lowercase() ?: ""
if (ariaLabel.isNotEmpty()) {
    val hasUsernameLabel = FieldScoringRules.usernameKeywords.any { keyword ->
        ariaLabel.contains(keyword) ||
        // i18n keywords
        ariaLabel.contains("아이디") ||  // Korean
        ariaLabel.contains("이메일") ||  // Korean
        ariaLabel.contains("ログイン") ||   // Japanese
        ariaLabel.contains("ユーザ")      // Japanese
    }
    if (hasUsernameLabel) {
        score += FieldScoringRules.SCORE_HTML_NAME_ID_USERNAME  // 30
        reasons.add("aria-label=username keywords")
    }
}
```

`calculatePasswordScore` (after line 244, before line 247 hint check):

```kotlin
// 5.5. aria-label keyword matching (WebView/HTML): +30
val ariaLabel = HtmlAttributeExtractor.getAriaLabel(node)?.lowercase() ?: ""
if (ariaLabel.isNotEmpty()) {
    val hasPasswordLabel = FieldScoringRules.passwordKeywords.any { keyword ->
        ariaLabel.contains(keyword) ||
        ariaLabel.contains("비밀번호") ||  // Korean
        ariaLabel.contains("パスワード")   // Japanese
    }
    if (hasPasswordLabel) {
        score += FieldScoringRules.SCORE_HTML_NAME_ID_PASSWORD  // 30
        reasons.add("aria-label=password keywords")
    }
}
```

---

## Score Impact Analysis (Naver 재평가)

### 옵션 A만 (threshold 20 + "pw" 추가)

| 신호 | Username | Password |
|------|----------|----------|
| `inputType` | +10 | +100 |
| `name="id"`/`name="pw"` | +30 | +30 (`"pw"` 신규) |
| fallback | +5 | +5 |
| **합계** | **45** | **135** |
| threshold 20 | ✅ 통과 | ✅ 통과 |

### 옵션 B (aria-label 추가)

| 추가 신호 | Username | Password |
|----------|----------|----------|
| `aria-label="아이디 또는 전화번호"` | +30 | — |
| `aria-label="비밀번호"` | — | +30 |
| **합계 (A+B)** | **75** | **165** |

### 일반 검색바/댓글 (false positive 차단)

| 신호 | 점수 |
|------|------|
| EditText fallback (type="text") | 5 |
| **threshold 20** | ❌ 제외 |

→ **false positive 차단됨** ✅

---

## Tests

### Unit Tests (JVM)

**File:** `android/app/src/test/java/com/kiyo/app/autofill/detection/FieldScoringRulesTest.kt`

추가:

| Test | 검증 |
|------|------|
| `calculateUsernameScore returns null for low score (e.g., fallback 5점)` | threshold 적용 (username < 20 → null) |
| `calculatePasswordScore returns null for low score` | threshold 적용 (password < 20 → null) |
| `isValidInputField returns true for Naver pattern (name=id, type=text)` | Naver 매칭 OK |
| `isValidInputField returns true for Naver pattern (name=pw, type=password)` | Naver password OK |
| `passwordKeywords includes "pw"` | keyword 확장 검증 |
| `MIN_CANDIDATE_SCORE constant equals 20` | 상수 검증 |

**File:** `android/app/src/test/java/com/kiyo/app/autofill/viewnode/HtmlAttributeExtractorTest.kt` (NEW)

| Test | 검증 |
|------|------|
| `getAriaLabel returns value for node with aria-label` | 정상 추출 |
| `getAriaLabel returns null for node without htmlInfo` | null 안전 |
| `getAriaLabel returns null for node with empty attributes` | 빈 속성 처리 |
| `getAriaLabel returns value for Korean label (이메일)` | 한국어 추출 |

**File:** `android/app/src/test/java/com/kiyo/app/autofill/detection/FieldScorerTest.kt`

추가 (기존 6개 + 신규):

| Test | 검증 |
|------|------|
| `calculateUsernameScore applies aria-label=아이디 bonus` | +30 (Korean label) |
| `calculateUsernameScore applies aria-label=Username bonus` | +30 (English label) |
| `calculatePasswordScore applies aria-label=비밀번호 bonus` | +30 |
| `calculatePasswordScore applies name=pw match` | +30 (new keyword) |
| `calculateUsernameScore returns null when score below threshold` | threshold 적용 |
| `calculatePasswordScore returns null when score below threshold` | threshold 적용 |

### E2E (Optional)

**File:** `android/app/src/androidTest/java/com/kiyo/app/autofill/AutofillE2ETest.kt`

| Test | 시나리오 |
|------|----------|
| `autofillOnNaverLogin_works` | KIYO 계정 (도메인=naver.com) → Naver 로그인 페이지 → fill 성공 |
| `autofillNotShownOnNaverSearchBar` | Naver 메인 검색바 탭 → autofill 드롭다운 안 뜸 (false positive 방지) |
| `autofillNotShownOnRedditSearchBar` | Reddit 메인 검색바 → autofill 안 뜸 |

---

## Risks & Mitigations

| 위험 | 영향 | 완화 |
|------|------|------|
| **threshold 20이 너무 높음** → 일부 사이트에서 autofill 안 뜸 (false negative) | 사용자 경험 저하 | (1) Phase 5 E2E로 검증 (2) threshold 20 → 10 또는 15로 조정 가능 (3) 모든 기존 단위 테스트 + 수동 검증 |
| **aria-label 매칭이 너무 광범위** → "user" 같은 짧은 단어가 다른 input에도 매칭 | false positive | (1) 다국어 키워드는 Naver/Kakao/일본 사이트 dump로 확인된 것만 (2) "user"는 이미 usernameKeywords에 있어서 새 위험 아님 (3) E2E로 검증 |
| **`"pw"` 추가**로 다른 사이트에서 false positive | false positive | "pw"는 매우 짧아서 1-2자 match만. password input의 다른 신호(type=password)와 함께 점수 누적되므로 단독으론 위험 낮음 |
| **i18n 키워드 (아이디, 이메일, 로그인, ユーザ 등)** | 일본/중국 사이트에서 false positive | 1) 한국/일본에서 이미 검증된 키워드만 추가 2) 향후 사이트 추가 시 검토 |
| **Naver가 `aria-label`도 변경할 수 있음** | 미래 호환성 | aria-label은 표준 보조 신호로만 사용 (30점). 다른 강한 신호(autocomplete, type=password)와 함께 작동 |

---

## Verification Criteria

- [ ] `./gradlew :app:testDebugUnitTest --tests "*FieldScoringRules*"` green (24+ tests)
- [ ] `./gradlew :app:testDebugUnitTest --tests "*FieldScorer*"` green (6+ tests)
- [ ] `./gradlew :app:testDebugUnitTest --tests "*HtmlAttributeExtractor*"` green (4+ tests)
- [ ] `MIN_CANDIDATE_SCORE = 20` 단위 테스트 검증
- [ ] `passwordKeywords`에 `"pw"` 포함 검증
- [ ] `getAriaLabel` 추출 단위 테스트 검증
- [ ] (선택) E2E Naver 테스트 통과
- [ ] (선택) E2E Reddit 메인 검색바 false positive 차단 테스트

---

## Implementation Order

1. **`MIN_CANDIDATE_SCORE` 상수 추가** (`FieldScoringRules.kt`)
2. **`passwordKeywords`에 `"pw"` 추가** (`FieldScoringRules.kt`)
3. **`FieldScorer.kt`에 threshold 적용** (두 함수)
4. **`HtmlAttributeExtractor.getAriaLabel` 추가** + 단위 테스트
5. **`FieldScorer.kt`에 aria-label 매칭 추가** (i18n 포함) + 단위 테스트
6. **기존 단위 테스트 실행** → 회귀 없음 확인
7. **(선택) E2E 시나리오 추가** (Naver 로그인 + 검색바 false positive)
8. **(선택) Phase 5 수동 E2E 실행** — 실제 Naver/Reddit에서 검증

---

## Implementation Order (Alternative: TDD)

1. 새 단위 테스트 먼저 작성 (RED)
2. threshold + keywords 수정 (GREEN)
3. `getAriaLabel` 단위 테스트 + 구현
4. `FieldScorer` aria-label 매칭 단위 테스트 + 구현
5. 회귀 테스트
6. E2E

---

## Open Questions

| Question | Decision |
|----------|----------|
| threshold 값을 20으로 할지, 10/15/30도 가능한지? | **20** 권장. 4-site dump 분석 기반. 5점(fallback) < 20 < 30(name match) |
| `aria-label` i18n 키워드는 어디까지? | 한국/일본 1차. 중국어/기타는 향후 확장 |
| `MIN_CANDIDATE_SCORE`를 username/password 따로 둘지? | 동일 값 (20) 사용. 별도 임계값은 YAGNI |
| E2E 자동화 포함 vs 수동만? | Phase 5와 동일하게 수동 우선. 추후 E2E 추가 가능 |

---

## Related Documents

### Plans
- `.hermes/plans/2026-08-24-autofill-field-detection.md` — Master field detection
- `.hermes/plans/2026-08-24-autofill-field-detection-Phase5-E2E-verification.md` — E2E 검증

### Brainstorms
- `docs/brainstorms/2026-08-28-login-page-html-structure-survey.md` — 4-site dump analysis (Naver, GitHub, Reddit, Google)
- `docs/brainstorms/2026-08-28-autofill-field-detection-improvements.md` — Phase 1-4 결정 배경

### Code
- `FieldScoringRules.kt` — keyword 상수, MIN_CANDIDATE_SCORE 추가 위치
- `FieldScorer.kt:159, 287` — threshold 적용 위치
- `HtmlAttributeExtractor.kt` — `getAriaLabel` 추가 위치
- `FieldScorer.kt` — aria-label 매칭 추가 위치

---

## Estimated Effort

| 작업 | 시간 |
|------|------|
| threshold + keywords + 단위 테스트 | 20분 |
| `getAriaLabel` + 단위 테스트 | 15분 |
| `FieldScorer` aria-label 매칭 + 단위 테스트 | 30분 |
| 기존 테스트 회귀 검증 | 10분 |
| (선택) E2E 2-3 시나리오 | 1-2시간 |
| **합계 (필수)** | **~75분** |
| **합계 (E2E 포함)** | **~3시간** |
