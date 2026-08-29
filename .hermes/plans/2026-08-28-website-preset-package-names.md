# Plan: WebsitePreset `packageNames` Population — Unified Web + Android Autofill Matching

**Date:** 2026-08-28 (Extracted from Autofill Matching Layer)  
**Branch:** `feature/autofill-reliability`  
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도  
**Depends on:** `2026-08-28-autofill-matching-layer.md` (Index DB 완료 후 효과 발휘)  
**See Also:** `2026-08-24-autofill-field-detection.md` (73번 줄에서 별도 추적 결정)

---

## Goal

`src/data/websitePresets.ts`의 14개 모든 프리셋에 `packageNames` 필드를 채워서,
**하나의 통합 매칭 레이어**가 web(domain) + Android app(packageName) 양쪽에서 일관되게 동작하도록 한다.

---

## 왜 필요한가

현재 `WebsitePreset`은 `domain`만 가짐 → Android 앱에서 해당 사이트의 계정을 자동완성하려면
사용자가 직접 `packageName`을 입력해야 함. 프리셋이 `packageNames`까지 제공하면:

1. **One-click setup**: 사용자가 프리셋 선택 → 자동으로 web URL + Android app packageName 모두 등록
2. **정확도 향상**: 잘 알려진 사이트(Google, Naver, Kakao 등)의 Android 앱 packageName이 자동 매칭
3. **WebView vs Native app 일관성**: 한 사이트가 web 로그인과 Android 앱 로그인 모두 있을 때 단일 계정으로 fill

---

## Architecture

```
WebsitePreset (React)
   ├─ domain → Index DB (domain 매칭)
   └─ packageNames → Index DB (packageNames 매칭)
         ↓
   통합 매칭 레이어 (Index DB 1차 필터링)
         ↓
   메인 DB 조회 → FillResponse
```

**의존성**: 인덱스 DB(`2026-08-28-autofill-matching-layer.md`)가 `packageNames`로 1차 필터링하는 기능이 완료되어야 프리셋 데이터가 실제로 효과를 봄.

---

## Changes

### 1. `WebsitePreset` 모델 확장

**File:** `src/models/websitePreset.ts`

```typescript
export interface WebsitePreset {
  id: string;
  name: string;
  aliases: string[];
  icon?: string;
  websiteUrl: string;
  domain: string;
  category?: string;
  packageNames?: string[];  // 신규: Android app package name(s)
}
```

---

### 2. `websitePresets.ts` 14개 프리셋에 `packageNames` 채우기

**File:** `src/data/websitePresets.ts`

각 프리셋마다 실제 Android package name(s)을 조사하여 채워야 함. **조사 완료된 값 (Play Store 검증 2026-08-28)**:

| id | name | websiteUrl (검증됨) | packageNames (Play Store URL `?id=` 기준 검증) |
|----|------|-------------------|------------------------------------------------|
| google | Google | `https://accounts.google.com` | `com.google.android.googlequicksearchbox` (Google Search 앱)<br>※ Gmail 단독 앱: `com.google.android.gm` |
| naver | Naver | `https://nid.naver.com` | `com.nhn.android.search` (NAVER 메인 앱) |
| kakao | Kakao | `https://accounts.kakao.com` | `com.kakao.talk` (KakaoTalk) |
| microsoft | Microsoft | `https://login.microsoftonline.com` | `com.microsoft.office.outlook` (Microsoft Outlook) |
| apple | Apple | `https://appleid.apple.com` | **(없음 — Apple은 Android 공식 앱 없음, `packageNames` 필드 생략)** |
| github | GitHub | `https://github.com/login` | `com.github.android` |
| discord | Discord | `https://discord.com/login` | `com.discord` |
| instagram | Instagram | `https://www.instagram.com/accounts/login/` | `com.instagram.android` |
| facebook | Facebook | `https://www.facebook.com/login` | `com.facebook.katana` |
| twitter | X (Twitter) | `https://x.com/i/flow/login` | `com.twitter.android` |
| netflix | Netflix | `https://www.netflix.com/login` | `com.netflix.mediaclient` |
| steam | Steam | `https://store.steampowered.com/login/` | `com.valvesoftware.android.steam.community` |
| amazon | Amazon | `https://www.amazon.com/ap/signin` | `com.amazon.mShop.android.shopping` |
| dropbox | Dropbox | `https://www.dropbox.com/login` | `com.dropbox.android` |

> **검증 의무**: `packageNames`에 나열된 값들은 **실제 Google Play Store에 존재하는 정확한 package name**이어야 함.
> 존재하지 않는 package name을 등록하면 autofill 매칭이 영구히 실패한다.
> 조사 방법: `adb shell pm list packages | grep <keyword>` 또는 Google Play Store URL에서 `id=` 추출.
>
> **현재 채워야 할 데이터**:
> - Google은 여러 Google 앱(Gmail, Search, Maps 등) 모두 같은 Google 계정 사용 → 한 프리셋에 1-3개까지만 채우는 게 실용적 (선택)
> - Apple은 `packageNames` 필드 자체를 생략 (`undefined`) — Android 앱이 없으므로
> - 나머지 12개는 위 표 값으로 채우기

---

### 3. AccountMapper가 `packageNames`를 Android autofill DB로 전달

**File:** `android/app/src/main/java/com/kiyo/app/autofill/repository/AccountMapper.kt`

`parseReactAccount`가 React account JSON의 `packageNames` 배열을 읽어 `AutofillAccount.packageNames`에 저장.
(이미 완료된 작업 — `2026-08-28-accountmapper-fromcursor-validation.md` 참조)

---

### 4. 단위 테스트 추가

**File:** `src/data/__tests__/websitePresets.test.ts` (NEW) 또는 기존 `src/data/websitePresets.test.ts`

| Test | 검증 |
|------|------|
| 모든 프리셋이 `packageNames?: string[]` 시그니처 준수 | TypeScript 컴파일 |
| `packageNames`가 있는 프리셋은 모두 non-empty 배열 | 길이 ≥ 1 |
| `packageNames` 값 형식 검증 | `com.example.app` 패턴 (소문자, 점 구분) |
| `packageNames` 값 중복 없음 | 각 프리셋 내 unique |
| `searchPresets`는 `packageNames` 무관하게 동작 | 기존 검색 동작 회귀 없음 |
| `getPresetById`는 `packageNames` 포함하여 반환 | 매핑 무결성 |

---

### 5. E2E 시나리오 (선택, 인덱스 DB와 통합 시)

**File:** `android/app/src/androidTest/java/com/kiyo/app/autofill/AutofillE2ETest.kt`

| Test | 시나리오 | 기대 결과 |
|------|----------|-----------|
| `autofillPresetPackagesMatch` | `Google` 프리셋으로 계정 생성 → KIYO가 Google Android 앱에서 fill 동작 | 드롭다운 표시 + 성공적 fill |
| `autofillPresetWebAndAppUnified` | 동일 프리셋으로 web + Android app 모두에서 fill | 양쪽 컨텍스트에서 단일 계정 매칭 |

---

## Implementation Order

1. **`WebsitePreset` 모델에 `packageNames?` 필드 추가** (타입만)
2. **`packageNames` 값 조사** — 각 프리셋별 실제 Google Play Store package name 1-3개씩
3. **`websitePresets.ts` 14개 모두에 값 채우기** (조사 완료된 것부터 점진적 머지)
4. **단위 테스트 추가** (검증 + 회귀 방지)
5. **E2E 통합** (선택 — 인덱스 DB Phase 4와 함께)

---

## Risks & Mitigations

| 위험 | 영향 | 완화 |
|------|------|------|
| 잘못된 package name 등록 | autofill 영구 실패 | 조사 단계에서 `adb shell pm list packages`로 실기기 검증, 단위 테스트로 형식 검증 |
| Google이 앱을 리팩토링하여 package name 변경 | 매칭 실패 | 매니페스트 PR 시점의 최신 package name 사용, 향후 업데이트 plan 별도 |
| Package name 누락된 프리셋 (Apple 등) | Android app fill 불가 | `packageNames?: string[]` (optional) — 누락 시 web autofill만 동작, OK |
| 사용자 정의 account와 프리셋 충돌 | 사용자 입력 우선 | AccountMapper가 React 입력값을 그대로 사용 (프리셋은 초기값 제공만) |

---

## Verification Criteria

- [ ] `WebsitePreset.packageNames?: string[]` 타입 추가됨
- [ ] `websitePresets.ts` 14개 모두 검토 완료 (조사 완료된 것은 채워짐, 불가한 것은 주석으로 사유 명시)
- [ ] 단위 테스트 통과 — 모든 프리셋의 `packageNames` 형식/중복/유일성 검증
- [ ] 기존 search/getById/getByCategory 함수 동작 회귀 없음
- [ ] (선택) E2E 시나리오 2개 통과 — web + Android app 양쪽 매칭

---

## Out of Scope

- iOS bundle ID (현재는 Android만, iOS는 `AutofillPlatformBridge` 추후)
- App icon, splash screen 등 UI 요소
- 사용자가 직접 package name 입력/수정 UI (프리셋은 초기값만)

---

## 관련 기존 결정

- `2026-08-24-autofill-field-detection.md` 73번 줄: 별도 추적 결정
- `2026-08-24-autofill-reliability.md` 225/232/284/297번 줄: DomainMatcher/AccountMapper에 `packageNames` 지원 이미 구현됨
- `2026-08-28-autofill-matching-layer.md` Phase 4: 인덱스 DB가 `packageNames`로 1차 필터링 — 이 Phase가 완료되어야 프리셋 데이터가 실제로 효과를 봄