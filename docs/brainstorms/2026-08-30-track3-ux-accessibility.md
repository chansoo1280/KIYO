# Brainstorm — Track 3. UX·접근성·인터랙션 품질 (STRATEGY §3)

- Date: 2026-08-30
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- Source: STRATEGY.md §3
- Status: Brainstorm (no code changed)
- Scope: §3의 모든 하위 항목을 단일 문서로 정리. Track 1(autofill), Track 2(vault integrity)와 명확히 분리된 **인터랙션/UX/a11y** 작업만 다룬다. 보안·암호화·자동잠금 자체는 §4 범위.

---

## 1. Problem

STRATEGY §3(UX·접근성·인터랙션 품질)는 5개 카테고리(로딩, 중복제출, 키보드/a11y, 에러, 테마)와 1개 후속 후보(Plan-7: 파일 생성 모달 → 다단계 페이지)로 구성되지만, **각 항목이 실제 어디까지 구현되어 있고 무엇이 "남은 일"인지** 한 화면에서 판단하기 어렵다. §2 brainstorm(`2026-08-29-vault-file-integrity.md`)에서 Plan-7 후보가 §12 메모로 잠깐 언급되었지만, **Plan-7 자체는 별도 brainstorm이 필요**한 상태로 남아 있고 §3 나머지 4개 카테고리(로딩·중복제출·키보드·에러·테마)는 한 번도 통합 정리가 된 적이 없다.

본 문서는:
1. §3의 6개 항목 각각에 대해 "현재 상태 / 남은 일 / 의존성 / 리스크"를 단일 표로 매핑
2. 우선순위 결정에 필요한 open questions만 남기고, 나머지는 옵션으로 압축
3. 후속 `ce-plan`이 본 문서를 기준으로 작업 범위를 좁힐 수 있도록 함

**업데이트 (2026-08-30):** Multi-Vault brainstorm [`2026-08-30-multi-vault-support.md`](2026-08-30-multi-vault-support.md) 가 별도 brainstorm으로 열렸고, **Track 3 진입 전 Multi-Vault가 최우선**으로 재배치됨 (§3.3, §8.1 갱신). 본 brainstorm은 §3의 UX 항목에 집중하고, Home UI 변경점은 Multi-Vault 결과에 의존.

**업데이트 (2026-08-30, 후속):** Multi-Vault plan [`2026-08-30-multi-vault-support.md`](../plans/2026-08-30-multi-vault-support.md) **완료**. Dexie v14 migration + `ACTIVE_FILE_ID` 제거 + `resolveFileName` suffix + Home 파일 리스트 UI + 21 파일/334 테스트 통과. Post-Implementation Dead Code Cleanup으로 62줄 정리 (syncAutofillToken 주석, importDataFile 주석, syncDatabaseToFile 별칭, changePin 중복 가드). Track 3의 §3.3 / §8.1 의존성이 해소되어 **Plan-7 활성화 가능**.

## 2. Goal

1. **Track 3의 진척 매트릭스** — ✅ / ⚠️ / ❌ / ❓로 코드 상태 매핑 (커밋 로그 + 실제 컴포넌트 인스펙션 기반)
2. **후속 작업 단위 식별** — Plan-A/Plan-B/... 식으로 잘라낼 수 있는 후보군
3. **Plan-7 후보의 위치 결정** — §3의 한 항목으로 흡수할지, 별도 plan으로 풀지
4. **의존성/순서 명시** — Plan-4(패스프레이즈, 완료)와 다른 plan의 관계

## 3. Context

### 3.1 인스펙션한 파일/모듈

| 영역 | 파일 | 메모 |
|---|---|---|
| 라우터 | `src/App.tsx` | `BrowserRouter` + 10개 라우트. `/create-vault` 미존재 — Plan-7 추가 필요 |
| 자동잠금 표시 | `src/components/AutoLockIndicator.tsx` | `role="status" aria-live="polite" aria-label` 적용 — a11y 모범 사례 |
| 라우트 보호 | `src/hooks/useFileAuthGuard.tsx`, `useAndroidBackButton.tsx` | 안드로이드 하드웨어 뒤로가기 처리 |
| 모달 베이스 | `src/components/dialogs/BaseDialog.tsx` | `aria-modal` 등 표준 처리 확인됨 (test 존재) |
| 폼 다이얼로그 | `src/components/dialogs/FormDialog.tsx` | 에러 throw → 상위에서 catch → 토스트/alert |
| 파일 생성 모달 | `src/components/dialogs/FileCreateDialog.tsx` | **단일 모달 안에 파일명/암호화여부/PIN 동시 표시** — Plan-7 후보의 출발점 |
| 파일 열기 모달 | `src/components/dialogs/FileOpenDialog.tsx` | 동일 패턴, fileName + PIN 한 화면 |
| 에러 표시 | `src/store/accountStore.ts` → `setSyncError` | sync 에러는 store에 저장, UI가 구독 표시 |
| 토스트/스낵바 | (전체 `src/` grep) | **토스트/스낵바 컴포넌트 없음** — alert/throw 의존 |
| 스켈레톤/로더 | (전체 `src/` grep) | `skeleton/Spinner/Loading/Suspense` 흔적 없음 |
| 테마 토글 | `src/store/settingsStore.ts` (`initializeTheme`) | 시스템 설정 연동은 존재, 토글 UI는 `Settings/UISection`에 |
| 강도 표시 | `src/components/inputs/PinStrengthMeter.tsx` | zxcvbn 기반, `aria-` 일부 적용 — Plan-4 산출물 |
| React Router | `react-router-dom` v7 (lock-step) | nested route/stepper 패턴 가능 |

### 3.2 STRATEGY §3 원문 (요약 매핑)

| STRATEGY §3 항목 | 코드 상태 | 비고 |
|---|---|---|
| 로딩 상태/스켈레톤 UI (암호화/복호화·동기화·파일 I/O) | ❌ 미구현 | 스피너/스켈레톤 컴포넌트 부재, `persistVaultSnapshot`/`loadAccounts` 등 비동기 경로에 시각 피드백 없음 |
| 더블클릭/중복 제출 방지 | ⚠️ 부분 | `Button.tsx` disabled 상태 일부 처리되나 일관성 부재. 폼 submit은 throw 기반, 비동기 in-flight 표시는 미흡 |
| 키보드 네비게이션/포커스 순서, 스크린리더 | ⚠️ 부분 | `AutoLockIndicator`/`BaseDialog`는 `aria-*` 적용. 그 외(메인 페이지/리스트/탭)는 표준 HTML 의미론에 의존, 명시적 포커스 관리 부재 |
| 에러 토스트/인라인 에러, 사용자 언어 매핑 | ⚠️ 부분 | `setSyncError`는 store에 저장하지만 토스트 없음. 다이얼로그 에러는 `throw` → caller가 alert. 네이티브 에러 → 한국어 매핑 함수 부재 |
| 다크/라이트 테마 전환 깜빡임, 시스템 연동 | ⚠️ 부분 | `initializeTheme`는 존재, 시스템 설정 감지 로직 확인 필요. 깜빡임(FOUC) 가드 없음 |
| **후속 후보 Plan-7: 파일 생성 모달 → 다단계 페이지** | ❌ 미구현 | §12 brainstorm 메모 단계 — 본 문서에서 Q로 흡수 |

### 3.3 §2 brainstorm이 Plan-7을 어떻게 남겼나

`docs/brainstorms/2026-08-29-vault-file-integrity.md` §12 (메모 단계):
- **문제:** 단일 모달에서 폴더/이름/PIN 동시 처리 → 모바일 키보드 가림, back 의미 모호, "되돌리기 어려운 결정" 가시성 부족
- **제안 흐름:** Step 1 폴더 선택 → Step 2 파일 이름 → Step 3 암호 입력 (Plan-4 패스프레이즈와 자연 통합)
- **명시적 보류:** "이 섹션은 **메모 단계**이며, Plan-7로 공식 채택 시 별도 brainstorm에서 통합. §3.2 매핑표 / §9 진행 순서 / §10 Plan 상태에는 반영하지 않음"

→ 본 brainstorm은 §12 메모를 **공식 흡수**하고 Q1~Q5를 §11에서 결정한다.

### 3.4 STRATEGY ↔ 코드 매칭 (ce-brainstorm 규칙)

> "✅는 코드 존재 + 동작 검증 둘 다 만족. 코드만 있고 STRATEGY가 ✅라고 말하는 것은 ⚠️ 또는 ❓다."

| STRATEGY §3 원문 | 표면 증거 | 실제 동작 | 진짜 상태 |
|---|---|---|---|
| "로딩 상태/스켈레톤 UI" | 없음 | 없음 | ❌ |
| "더블클릭/중복 제출 방지" | `Button disabled` 일부 | submit 중 disabled 일관성 없음, throw 기반 에러 | ⚠️ |
| "키보드 네비게이션/포커스 순서" | `aria-*` 20+ 파일 | 표준 HTML 의존, 포커스 트랩/복귀 미구현 | ⚠️ |
| "스크린리더 대응" | `BaseDialog` `aria-modal` | 전체 점검은 안 됨 | ⚠️ |
| "에러 토스트/인라인 에러" | `setSyncError` store | 토스트 컴포넌트 없음, alert/throw 의존 | ⚠️ |
| "다크/라이트 테마 시스템 설정 연동" | `initializeTheme` | 시스템 감지 로직 확인 필요, FOUC 가드 미확인 | ⚠️ |
| "테마 전환 시 깜빡임 없음" | 없음 | 검증 안 됨 | ❓ |
| "Plan-7 (다단계 페이지)" | 없음 | 메모 단계 | ❌ |
| **README "다중 데이터 파일 — 여러 암호화된 볼트 생성/가져오기/백업/복원"** | multi-row + Dexie v14 + Home 리스트 UI | — | **✅ 완료** (2026-08-30) — [Multi-Vault plan](../plans/2026-08-30-multi-vault-support.md) 결과 |

**중요 시그널:** STRATEGY §3의 "최근 신호"는 "Tailwind CSS 4, Ionic 컴포넌트 기반, AutoLockIndicator 등 상태 표시 컴포넌트 존재" — **AutoLockIndicator 외에는 상태 표시 컴포넌트가 없다.** 이 한 줄이 §3의 5개 카테고리 중 어느 것도 본격 착수되지 않았음을 강하게 시사한다.

## 4. Constraints

- **네트워크 권한 0, 클라우드 동기화 없음** (STRATEGY Boundary #1) — UI 라이브러리 추가도 번들 크기/오프라인 영향 검토 필요
- **cryptoKey는 메모리 only** — UI 개선이 키 lifecycle에 영향 주면 안 됨
- **자동잠금/세션 만료**와 충돌 금지 — UI가 잠금 화면 위에 떠있으면 안 됨
- **Autofill 경로 격리** — §1 autofill 신뢰도 작업과 독립 (autofill 경로는 Android native, Track 3은 React 측 한정)
- **Capacitor 8 + React 19** — web 표준 패턴 우선, native bridge 토글이 필요한 기능은 제외
- **Tailwind CSS 4 + Ionic 컴포넌트** — 기존 스택 위에 구축, 신규 UI 라이브러리 의존 추가는 최소화
- **i18n** — 현재 한국어 위주, 추후 다국어 가능성 → 모든 사용자 문구 i18n 키로 분리
- **E2E 영향 최소화** — Plan-7 라우트 추가는 Playwright pageobject 업데이트 필요

## 5. Existing Architecture (요약)

```
[User action / async work]
  ├─ store mutation (Zustand)
  │    └─ persistVaultSnapshot / loadAccounts / etc. (Dexie + encrypt)
  │         └─ 에러 시 setSyncError / throw
  │
  └─ UI
       ├─ <FormDialog> / <ConfirmDialog> / <BaseDialog> (공통 베이스)
       ├─ <Button> (disabled 처리 일부)
       ├─ <AutoLockIndicator> (자동잠금 카운트다운, aria 표준)
       ├─ <PinStrengthMeter> (zxcvbn, Plan-4)
       └─ React Router (BrowserRouter, 10 라우트)
            └─ [Plan-7 추가 예정] /create-vault/step-{1|2|3}

[Theme]
  └─ settingsStore.initializeTheme() → CSS 변수 + 시스템 감지
       └─ FOUC 가드 / dark class 토글 미확인
```

**라우터 구조 (현재):**
- `/`, `/auth`, `/accounts`, `/accounts/new`, `/accounts/:id`, `/accounts/:id/edit`, `/settings`, `/autofill-test`, `/templates`, `/templates/new`, `/templates/:id/edit`
- `AndroidBackButtonHandler`가 `useFileAuthGuard`와 결합되어 라우트별 뒤로가기 처리

**자동잠금과의 관계:**
- `useAutoLock` 훅이 활동 감지 + 타이머 관리
- `AutoLockIndicator`는 `remainingSeconds > 0`일 때만 표시
- `BrowserRouter` + `useFileAuthGuard` 조합으로 잠금 시 `/auth` 리다이렉트

## 6. Relevant Previous Knowledge

- **AGENTS.md** — `src/` 구조, `@/` alias, React 19 + TS strict, pipeline functions, Android 변경 후 `npx cap sync android`
- **STRATEGY §1 (autofill)** — 본 Track과 독립, §3 작업이 autofill 경로에 영향 주지 않음
- **STRATEGY §2 (vault integrity)** — Plan-4(패스프레이즈) 완료. Plan-7(다단계 페이지)과 **자연 통합** — Step 3의 "암호 입력"이 패스프레이즈 strength UI로 들어감
- **STRATEGY §4 (session & auto-lock)** — 본 Track은 §4와 직접 충돌하지 않음. 다만 자동잠금 카운트다운 UI(`AutoLockIndicator`)는 이미 §3의 a11y 모범 사례이므로, 다른 영역 a11y 작업의 레퍼런스로 활용
- **`.hermes/plans/` 패턴** — `Goal / 범위 명확화 / Current State (인스펙션) / Relevant Files / Plan / 검증 / 리스크` 구조. 본 brainstorm이 분기할 plan도 동일 형식 권장
- **`docs/brainstorms/2026-08-29-vault-file-integrity.md` §12** — Plan-7 메모 단계. 본 brainstorm에서 공식 흡수
- **사용자 작업 스타일 메모** — "단순화 / 이전과 같게"는 speculative fix 중단 신호. Track 3는 아직 첫 plan 전이므로 **시작 시점에 범위를 좁히는 데 집중**

## 7. Options (Track 3 분할 후보)

### A. 로딩/스켈레톤/에러 토스트 통합 인프라 (Plan-A)

**포함:**
- `<Spinner>` / `<Skeleton>` 공통 컴포넌트
- `<Toast>` / `<Snackbar>` (성공/에러/경고 variant)
- `setSyncError` → 토스트 자동 표시
- 비동기 작업의 in-flight 상태 hook (`useAsync` 같은 wrapper)
- i18n 키 분리

**장점:** 다른 모든 plan이 의존하는 **기반 인프라**. 한 번 만들면 §3 나머지 항목이 모두 활용.
**단점:** 인프라 자체로는 사용자가 체감하기 어려움 (눈에 보이는 변화 적음).
**복잡도:** 중. Toast 위치/타이밍/queueing/dismiss 인터랙션 결정 필요.
**보안:** 영향 없음.
**테스팅:** Toast/Skeleton 단위 테스트 + Playwright E2E.
**마이그레이션:** `setSyncError` 호출처를 토스트로 교체하는 작업 동반.

### B. 중복 제출/버튼 일관성 (Plan-B)

**포함:**
- `Button` 컴포넌트에 `loading` prop 추가, in-flight 시 자동 disabled
- 폼 submit wrapper: `useFormSubmit` hook (throw → 에러 표시 통합)
- `FormDialog`/`ConfirmDialog`에서 일관된 비동기 처리

**장점:** 사용자 체감이 큼 ("왜 또 누르지?" → "한 번만 누르면 됨").
**단점:** Plan-A(토스트)와 결합 시 시너지, 단독으로는 에러 표시가 alert로 한정.
**복잡도:** 소. 기존 Button/FormDialog 수정 중심.
**보안:** 영향 없음.
**테스팅:** Button 단위 테스트(loading 상태) + 폼 submit 통합 테스트.
**마이그레이션:** 모든 dialog 호출처에서 async/await 패턴 점검.

### C. 키보드/포커스/a11y (Plan-C)

**포함:**
- 포커스 트랩 (모달 내 Tab 순환)
- 모달 닫힐 때 트리거로 포커스 복귀
- 메인 페이지/리스트에 `aria-label`/`role` 보강
- `<button>`/`<a>` 의미론 점검, `<div onClick>` 패턴 제거
- 라우트 변경 시 메인 영역으로 포커스 이동 (skip-to-content)
- 스크린리더 테스트 (수동 또는 axe-core 통합)

**장점:** **STRATEGY §3이 Boundary #6 "자동완성 품질 저하 허용, 핵심 보안 불가"와 함께 강조하는 a11y 기준**. 다양한 사용자(저시력/운동障碍) 지원.
**단점:** 광범위, 측정 어려움 (사용자별 보조기기 다름). 시각적 변화 적음.
**복잡도:** 대. 모든 페이지/컴포넌트 점검 필요.
**보안:** 영향 없음.
**테스팅:** axe-core CI 통합 + 키보드 네비게이션 Playwright 시나리오.
**마이그레이션:** 점진적 가능 (페이지별 모듈 단위).

### D. 테마 깜빡임(FOUC) 가드 + 시스템 연동 강화 (Plan-D)

**포함:**
- 초기 paint 전 theme 결정 (inline script in `index.html` 또는 CSS `@media (prefers-color-scheme)`)
- `settingsStore` → `localStorage` 영구화 확인
- 시스템 테마 변경 시 live 갱신 (`matchMedia` 리스너)
- Settings UI에서 강제 light/dark/system 3-way 토글

**장점:** 작은 작업으로 큰 시각 효과 ("깜빡임 없이 자연스럽게"). 테마 일관성.
**단점:** 현재 FOUC가 실제로 발생하는지 검증 필요 (실측 우선). 시스템 변경 live 갱신은 추가 코드.
**복잡도:** 소. `index.html` + `settingsStore` 수정.
**보안:** 영향 없음.
**테스팅:** Playwright reload 시 깜빡임 시각 검증 + theme persistence.
**마이그레이션:** 기존 `initializeTheme` 호출자 영향 점검.

### E. Plan-7: 파일 생성 다단계 페이지 (Plan-7)

**포함:**
- 신규 라우트 `/create-vault/step-{1|2|3}` 또는 단일 `/create-vault` + Zustand `useCreateVaultStore`
- Step 1: SAF folder picker (web fallback 포함)
- Step 2: 파일명 + `.json` 검증 + 중복 검사
- Step 3: PIN 입력 (zxcvbn, Plan-4 산출물 활용)
- Stepper UI (1·2·3 진행 표시)
- 기존 `FileCreateDialog` 호출처에서 `<Link to="/create-vault">`로 변경

**장점:** "되돌리기 어려운 결정"의 가시성 ↑, 모바일 키보드 가림 해결, Plan-4 자연 통합.
**단점:** 라우터 추가 → Playwright E2E navigation 영향. 모달 → 페이지 마이그레이션 작업.
**복잡도:** 중~대. 3단계 컴포넌트 + stepper + store + router + i18n.
**보안:** 영향 없음 (입력값만 페이지화, crypto 경로 동일).
**테스팅:** Playwright E2E (3단계 시나리오) + Android instrumentation (folder picker native 경로).
**마이그레이션:** `FileCreateDialog` 호출처 모두 점검. 기존 모달은 deprecated 또는 완전 제거 (Q 결정).

## 8. Recommended Direction

### 8.1 우선순위 권장 (사용자 결정 기반)

> **2026-08-30 갱신:** Multi-Vault brainstorm [`2026-08-30-multi-vault-support.md`](2026-08-30-multi-vault-support.md) 결과로 **순서 재배치** — Multi-Vault가 Track 3 진입 전 **최우선**으로 처리되어야 Home의 파일 리스트 UI가 가능해짐. Plan-7(다단계 페이지)의 "기존 파일 선택 / 새로 만들기" 분기도 Multi-Vault 결과에 의존.

| 순서 | Plan | 근거 | 예상 복잡도 |
|---|---|---|---|
| **0** | **[Multi-Vault Support](../2026-08-30-multi-vault-support.md) (§2 후속)** | Home 파일 리스트 UI 가능하게 함. STRATEGY Boundary #4 ("멀티 볼트는 로컬 파일 단위로만") 격차 해소. **Track 3 모든 plan의 전제** | 중~대 |
| 1 | **Plan-7: 다단계 페이지** | Multi-Vault 리스트 위에서 "기존 파일 선택 / 새로 만들기" 분기 가능. Plan-4(패스프레이즈, 완료)와 자연 통합 | 중~대 |
| 2 | **Plan-A: 로딩/에러 토스트 인프라** | Plan-7의 단계 전환 피드백, Plan-B의 에러 표시 기반 | 중 |
| 3 | **Plan-B: 중복 제출/버튼 일관성** | Plan-A 위에서 동작, 사용자 체감 큼. 기존 Button/FormDialog 수정 중심 | 소 |
| 4 | **Plan-D: 테마 FOUC 가드** | 독립, 실측 후 작업 | 소 |
| 5 | **a11y 부산물 흡수** | Plan-A/B/D 진행 중 role/aria/focus 자연 보강 + 후속 a11y audit plan | 대 |

**근거 갱신:**
- **Multi-Vault가 0순위인 이유:** Plan-7의 "기존 파일 선택 / 새로 만들기" 분기(§12.2 Step 1)는 1개 파일 모델에선 의미가 없음. Multi-Vault가 먼저 와야 Plan-7의 v1이 의미를 가짐. 또한 Home UI 자체가 "파일 1개 표시 → 파일 N개 리스트"로 바뀌어야 사용자가 multi-vault를 체감.
- **Plan-7을 1순위(Track 3 내)로 둔 이유:** 사용자가 STRATEGY §3에 직접 후보로 명시. Plan-A 없이 진행하면 "단계 전환 시 피드백이 alert"로 품질 저하.
- **Plan-A를 2순위로:** Plan-7과 Plan-B 모두 의존. 먼저 만들어야 후속이 "alert 띄우기"로 끝나지 않음.
- **Plan-C(a11y)를 5순위로:** 모든 plan의 부산물로 흡수하는 게 효율적. 단독 plan으로 묶으면 누락 위험.

### 8.2 권장 분할

```
Track 3: UX·접근성·인터랙션 품질
└─ ✅ Multi-Vault Support (2026-08-30 완료 — [plan](../plans/2026-08-30-multi-vault-support.md))
   ├─ Plan-7: 파일 생성 다단계 페이지 (/create-vault Step 1·2·3) — 활성화 가능
   ├─ Plan-A: 공통 UI 인프라 (Spinner, Skeleton, Toast, useAsync)
   ├─ Plan-B: 버튼/폼 일관성 (Button.loading, useFormSubmit, FormDialog async)
   ├─ Plan-D: 테마 FOUC 가드 + 시스템 연동 강화
   └─ (점진 흡수) a11y — Plan-A/B/D 진행 중 role/aria/focus 자연 보강
       별도 plan은 "누락 점검" 또는 "특정 영역 a11y audit" 트리거 시에만
```

### 8.3 Plan-7 흡수 결정

§12 메모를 본 brainstorm에서 **공식 채택**. 이유:
- STRATEGY §3에 명시된 후속 후보
- §2 brainstorm이 "별도 brainstorm에서 통합"을 명시 → 본 문서가 그 통합처
- Plan-A(인프라) 없이 Plan-7을 먼저 진행하면 품질 저하

**Plan-7 자체의 Q는 §11에서 결정.**

## 9. Open Questions (다음 단계 결정 필요)

| Q | 질문 | 옵션 | 권장 |
|---|---|---|---|
| Q1 | Plan-A 토스트 라이브러리: 신규 의존 추가 vs 직접 구현? | (a) `sonner`/`react-hot-toast` 등 가벼운 라이브러리 (b) 직접 구현 (30~50줄) | **(b) 직접 구현** — Toast UI 단순, 한 가지 길 선호, 의존성 최소화 |
| Q2 | Plan-B FormDialog 에러: throw 유지 vs callback 패턴? | (a) throw (현재) (b) onError callback (c) 둘 다 | **(c) 둘 다** — throw는 `FormDialog` 내부에서 catch 후 `setError` state, 외부에는 `onError` callback |
| Q3 | Plan-7 라우트 전략: nested route vs 단일 라우트 + store step? | (a) `/create-vault/folder\|name\|password` (b) `/create-vault` + `useCreateVaultStore.step` | **(b) 단일 라우트 + store** — 페이지 전환 애니메이션 단순, deep-link 불필요 (vault 생성은 외부 진입점 없음) |
| Q4 | Plan-7 기존 FileCreateDialog 처리: 완전 제거 vs deprecated 잔존? | (a) 완전 제거 (b) deprecated로 fallback | **(a) 완전 제거** — KIYO 컨벤션 "한 가지 길". 호출처 100% 마이그레이션 후 제거 |
| Q5 | Plan-C a11y: 별도 plan vs Plan-A/B/D에 흡수? | (a) 별도 plan (b) 부산물 흡수 | **(b) 부산물 흡수** — 단, Playwright keyboard navigation + axe-core CI 통합은 별도 "a11y 회귀" plan으로 후속 |
| Q6 | Plan-D FOUC 실측: 현재 깜빡임이 실제로 발생하나? | (a) Playwright로 실측 후 판단 (b) 코드 인스펙션만으로 추정 | **(a) 실측 우선** — 발생 안 하면 작업 불필요 |
| Q7 | Plan-A Skeleton 적용 범위: 어디에? | (a) `loadAccounts` / `loadTemplates` 초기 진입 (b) `persistVaultSnapshot` 중 (c) 둘 다 | **(a) 초기 진입** — 가장 가시적. (b)는 매우 짧아 사용자 체감 적음. 단, sync error 토스트는 Plan-A에 포함 |
| Q8 | Plan-7 Step 3의 PIN: Plan-4 정책(4~20자 mixed) 그대로 vs 추가 강화? | (a) Plan-4 그대로 (b) 패스프레이즈 옵션 (별도 입력 모델) 추가 | **(a) Plan-4 그대로** — Plan-4 범위 밖 분리. Q는 본 Track 3와 무관 |

## 10. Current Decision State

| # | 결정 | 상태 |
|---|---|---|
| Q1 | Plan-A 토스트: 직접 구현 (b) | 📋 권장 (사용자 확정 대기) |
| Q2 | Plan-B FormDialog 에러: 둘 다 (c) | 📋 권장 (사용자 확정 대기) |
| Q3 | Plan-7 라우트: 단일 + store (b) | 📋 권장 (사용자 확정 대기) |
| Q4 | Plan-7 FileCreateDialog: 완전 제거 (a) | 📋 권장 (사용자 확정 대기) |
| Q5 | a11y: 부산물 흡수 (b) + 후속 audit plan | 📋 권장 (사용자 확정 대기) |
| Q6 | Plan-D FOUC: 실측 우선 (a) | 📋 권장 (사용자 확정 대기) |
| Q7 | Plan-A Skeleton: 초기 진입 (a) | 📋 권장 (사용자 확정 대기) |
| Q8 | Plan-7 PIN: Plan-4 그대로 (a) | 📋 권장 (사용자 확정 대기) |
| §8.1 순서 | **Multi-Vault → Plan-7 → Plan-A → Plan-B → Plan-D** | ✅ Multi-Vault 완료 2026-08-30, 나머지 순서 확정 |

**진행 순서 (2026-08-30 갱신):**
1. **✅ Multi-Vault Support** ([plan](../plans/2026-08-30-multi-vault-support.md)) — 완료 (21 파일/334 테스트, Post-Implementation Dead Code Cleanup 62줄 정리)
2. **Plan-7** (다단계 페이지) — 이제 활성화 가능. Q3/Q4 확정 대기
3. **Plan-A** (공통 UI 인프라) — Plan-7의 단계 전환 피드백, Plan-B의 에러 기반
4. **Plan-B** (버튼/폼 일관성) — Plan-A 위에서 동작
5. **Plan-D** (테마 FOUC 가드) — 독립, Q6 실측 후 작업
6. **a11y 부산물 흡수** — Plan-A/B/D 진행 중 자연 보강 + 후속 audit plan

> Multi-Vault 완료로 Track 3의 Q1~Q8 활성화됨. Plan-7 Q3/Q4는 Multi-Vault 결과 반영해 사용자 확정 가능.

## 11. Risks

| 리스크 | 완화 |
|---|---|
| Plan-A 토스트를 잘못 만들면 모든 plan에 영향 (alert → 토스트 마이그레이션 강제) | 첫 plan을 Plan-A로 격리, 마이그레이션 매핑표 작성 |
| Plan-7 라우트 추정이 Playwright E2E navigation 깨뜨림 | stepper `data-testid` 일관성 + pageobject 추가, 기존 E2E smoke 먼저 |
| Plan-C a11y를 흡수하다 보면 누락 발생 | 각 plan 완료 시 `axe-core` 단일 페이지 scan 결과를 체크리스트화 |
| Plan-D FOUC가 실측에서 안 나타나면 작업 무의미 | Q6 실측 우선 결정, 발생 안 하면 Plan-D cancel |
| Track 1(autofill)/Track 2(vault) 진행 중 회귀 | Plan-A/B는 React UI 한정, autofill native 경로와 격리됨. Plan-7 라우트 추가는 `/create-vault` 신규라 기존 라우트 미영향 |
| "단순화/이전과 같게" 사용자 신호 (메모) | 각 plan 시작 전 작업 범위 재확인, 첫 plan에서 검증된 패턴을 후속에 복제 |
| 6개 항목 동시 착수 시 산만 | **Multi-Vault → Plan-7 → Plan-A → Plan-B → Plan-D** 순서 엄수, a11y는 흡수 |
| ~~Multi-Vault 결과에 Track 3 전체 의존~~ | ✅ 해소 (2026-08-30 Multi-Vault 완료). 이제 Plan-7 활성화 가능 |
| Multi-Vault E2E 회귀 위험 | Home의 "파일 생성" 버튼은 `FileCreateDialog` 그대로 — Multi-Vault는 다이얼로그 UI 변경 0, E2E 회귀 0 (Q8 사용자 확정) |

## 12. Next Action

**Track 3의 Multi-Vault 선행 의존성 해소 (2026-08-30).** 본 brainstorm의 Q1~Q8은 사용자 확정 대기 상태.

1. **✅ Multi-Vault 완료:** [plan](../plans/2026-08-30-multi-vault-support.md) — Dexie v14 + Home 파일 리스트 UI + 21 파일/334 테스트 + Dead Code Cleanup 62줄
2. **즉시 가능:** 본 brainstorm §9 Q1~Q8 사용자 확정 (Plan-7 Q3/Q4는 Multi-Vault 결과 반영)
3. **첫 plan 선택:** Plan-7 (Multi-Vault와 가장 강하게 결합된 §3 항목)
4. **그 후:** Plan-A → Plan-B → Plan-D 순서로 진행

**본 brainstorm의 ce-plan 직접 개설 보류 사유 해소됨.** 이제 Plan-7의 `ce-plan` 작성이 다음 자연스러운 단계.

---

## 부록 A. §3 카테고리 ↔ Plan 매핑 (최종)

| §3 원문 | 흡수 plan | 비고 |
|---|---|---|
| 로딩 상태/스켈레톤 UI | Plan-A | Spinner/Skeleton + 초기 진입 UX |
| 더블클릭/중복 제출 방지 | Plan-B | Button.loading + useFormSubmit |
| 키보드 네비게이션/포커스/스크린리더 | Plan-C(흡수) | 모든 plan에 role/aria/focus 자연 보강 + 후속 a11y audit plan 별도 |
| 에러 토스트/인라인 에러 | Plan-A + Plan-B | Plan-A: Toast 인프라, Plan-B: FormDialog 에러 통합 |
| 다크/라이트 테마 + 깜빡임 | Plan-D | FOUC 실측 후 작업 |
| Plan-7: 파일 생성 다단계 | Plan-7 | §12 메모 공식 흡수 |

## 부록 B. STRATEGY §3 업데이트 제안 (Multi-Vault 후속 결정 반영)

본 brainstorm은 **Multi-Vault brainstorm(2026-08-30) 후속**으로 갱신됨. STRATEGY.md §3은 Multi-Vault + 본 brainstorm 양쪽 완료 후 갱신. **Multi-Vault는 2026-08-30 완료**, 본 brainstorm의 STRATEGY diff는 §3의 Track 3 진행 상태를 반영.

```diff
 ### 3. UX·접근성·인터랙션 품질 (UX & Accessibility)
+- 로딩 상태/스켈레톤 UI — 암호화/복호화·동기화·파일 I/O 중 시각적 피드백
+- 더블클릭/중복 제출 방지 — 버튼·폼·리스트 액션에 debounce·disabled 상태 적용
+- 키보드 네비게이션/포커스 순서 — 웹·데스크톱 확장 대비, 스크린리더 대응
+- 에러 토스트/인라인 에러 — 네이티브/브리지 에러를 사용자 언어로 매핑
+- 다크/라이트 테마 전환 시 깜빡임 없음, 시스템 설정 연동
+- **후속 후보 — Plan-7: 파일 생성 모달 → 다단계 페이지 분리** ([brainstorm §12](docs/brainstorms/2026-08-29-vault-file-integrity.md)) — 3단계 (폴더 선택 → 파일 이름 → 암호 입력) 라우트 기반 흐름으로 모바일 키보드 가시성·뒤로가기 모호함·"되돌리기 어려운 결정" 가시성 개선. §2 볼트 무결성과 분리된 UX 개선 항목이며, Plan-4 (패스프레이즈) 도입 시 Step 3가 자연스럽게 통합됨
+- **진척 (2026-08-30 갱신):** 6개 항목 중 0개 완료, 4개 부분 구현 (a11y/에러/테마/중복제출), 2개 미구현 (로딩/Plan-7). **선행 의존성 해소**: Multi-Vault Support ✅ 완료 (2026-08-30) — [plan](../plans/2026-08-30-multi-vault-support.md)
+  - ✅ Multi-Vault Support — 완료, Post-Implementation Dead Code Cleanup 62줄 정리. Home 파일 리스트 UI 전제 해소
+  - 📋 Plan-7: 다단계 페이지 — §8.1 (이제 활성화 가능, 사용자 확정 대기)
+  - 📋 Plan-A: 공통 UI 인프라 (Spinner, Skeleton, Toast, useAsync) — §8.1 Q1
+  - 📋 Plan-B: 버튼/폼 일관성 (Button.loading, useFormSubmit) — §8.1 Q2
+  - 📋 Plan-D: 테마 FOUC 가드 — §8.1, Q6 실측 후 작업
+  - 📋 a11y: Plan-A/B/D 부산물 흡수 + 후속 a11y audit plan (Q5)
 - **최근 신호:** Tailwind CSS 4, Ionic 컴포넌트 기반, AutoLockIndicator 등 상태 표시 컴포넌트 존재
+ - **상태:** Brainstorm 단계 ([docs/brainstorms/2026-08-30-track3-ux-accessibility.md](docs/brainstorms/2026-08-30-track3-ux-accessibility.md)) — **Multi-Vault 선행 완료 (2026-08-30), Q1~Q8 사용자 확정 대기**
+ - **진행 순서 (2026-08-30 갱신):** ~~Multi-Vault~~ → Plan-7 → Plan-A → Plan-B → Plan-D (Multi-Vault ✅)
```
