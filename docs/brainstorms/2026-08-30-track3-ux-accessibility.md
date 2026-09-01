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

**업데이트 (2026-08-30, Plan-A1/A2 완료):** Plan-A1 ([plan](../plans/2026-08-30-plan-a1-error-visibility.md), PR `19341aec`) — `mapError()` + `SyncErrorBanner` + 호출처 8곳 try/catch 마이그레이션. Plan-A2 ([plan](../plans/2026-08-30-plan-a2-spinner-loading.md), PR `f1dcc638`) — `<Spinner>` 공통 컴포넌트 + Accounts 페이지 spinner. Plan-A 전체 완료로 후속 plan(B/D)의 공통 전제 해소.

**업데이트 (2026-08-30, Plan-B 분할 완료):** Plan-B ([plan](../plans/2026-08-30-plan-b-button-loading-consistency.md)) — 3-PR 분할 진행. Plan-B-1 (인프라, PR `cebf14ca`) 완료: `Button.tsx` 보강 + `FormDialog`/`ConfirmDialog` 마이그레이션 + `aria-busy` 추가. Plan-B-2 (자주 쓰는 페이지, PR `e3a4c1ae`) 완료: Accounts/AccountDetail/AccountEdit/Home/Auth/CreateVault의 inline 버튼 → `<Button>` 마이그레이션. Plan-B-3 (나머지 페이지) 미착수.

**업데이트 (2026-08-30, Plan-B-3 완료):** Plan-B-3 ([plan](../plans/2026-08-30-plan-b3-settings-templates-buttons.md)) — Templates/index (3개), TemplateEdit (4개), Settings/index (2개), AutofillSection (3개, toggle switch 제외), DataSection (5개, `FileCreateDialog` 잔존 보류), SecuritySection (4개) = **21개 inline `<button>` → `<Button>` 마이그레이션**. Toggle switch(`AutofillSection.tsx:213` `role="switch"`)는 의미/시각적 토글로 `<Button>` 부적합 → a11y audit plan 이관. **`TemplateEdit/index.test.tsx` 신규** (3 테스트: Button 마이그레이션 + 저장 catch + 삭제 catch — Plan-A1 catch 결합 회귀 0 가드). 회귀 게이트: `typecheck` ✓, `lint` ✓ (신규 0 errors, 16 errors는 Plan-B-3과 무관한 기존), `test` 444/444 ✓, `build` ✓, Android `compileDebugKotlin` + `testDebugUnitTest` ✓, **Playwright React E2E 44/44 (31.8s) ✓**. Q4-a (`DataSection.tsx:180`의 `FileCreateDialog` 잔존)은 사용자 결정으로 보류 유지. Plan-B-3는 PR 미생성 (commit/push 대기).

**업데이트 (2026-08-31, Plan-D PR 1 완료):** Plan-D ([plan](../plans/2026-08-30-plan-d-theme-fouc.md)) — 2-PR 분할 중 PR 1 (커밋 `15e2e870`+보완 `325a3b2f`+문서 `b148855f`). FOUC는 실측 대신 `index.html` inline script로 사전 차단 (Q6 결정 변경). PR 1 = 라우트 + FOUC 가드 + RootRedirect (4-state 머신: checking/preloading/redirecting/error + Dexie close race 3s timeout + 1회 재시도 + stale 감지) + SplashScreen + ErrorScreen + `App.tsx` useEffect 5개 제거 + `Home` → `/home` 이동 + `settingsStore.initializeXxx` 5개 제거. 보완에서 `e2e/10-persistence.spec.ts` 3건 회귀 흡수 — **self-load 패턴** (페이지 단위 load 책임 + `useFileAuthGuard.onInitialized` 단일 콜백 + store-side `if (get().initialized) return;` 가드 + `initializeStores` 명시 reset). `e2e/11-close-datafile.spec.ts` 7건 `waitForURL('/')` → `waitForURL((url) => url.pathname === '/')` 교체 (React Router `history.replaceState`의 pushstate/popstate 부재). 회귀 게이트: `typecheck` ✓, `lint` (우리 변경 파일 에러 0) ✓, `test` 470/470 ✓, `e2e/10-persistence.spec.ts` 3건 ✓ (사용자 직접 실행). PR 2 (`themeMode: "light" | "dark" | "system"` + UISection 3-way + `matchMedia` live 갱신) 미착수. **새로운 페이지 추가 시 self-load 적용 필수** — 잊으면 동일 회귀 재발. **2026-08-31 (Plan-D 머지 후) 추가 사실:** Plan-B-3 커밋 `93e007ed`은 이미 origin `feat/ux-accessibility` history에 포함 (Plan-D PR 1보다 시간상 먼저 push) — HEAD = `b148855f`의 ancestor. PR은 GitHub REST API로 0개 확인 → **단독 PR 개설 사용자 결정 대기**. 본 brainstorm 갱신분도 commit + push 미실행. **2026-08-31 추가 결정:** Plan-D PR 2 (themeMode + 시스템 연동 live 갱신) **보류** — inline script + 매치미디어 폴백으로 충분, 사용자가 "필요성 낮음" 결정. PR 개설 안 함

**업데이트 (2026-08-31, 문서 점검 보정):** 사용자 요청으로 brainstorm ↔ 코드 일치성 점검. 3건 발견 → 본문/부록 A 정정 (코드 변경 없음):
1. **`DataSection.tsx:197` → `:180` (6곳 일괄 수정)** — `FileCreateDialog` 잔존 위치는 line 180 (`<FileCreateDialog open={showBackupDialog} ... />`). line 197은 자동 백업 폴더 다이얼로그 헤더(`<h3>자동 백업 폴더 선택</h3>`). §3.1 표 외 §10 Q4 / §11 진행 순서 8 / §11 리스크표 / §12 항목 11 / §11 부록 A Plan-7a / 부록 B STRATEGY diff Plan-B-3 행. 6곳.
2. **Plan-A2 "a11y 자연 보강" 주장 ↔ 실제 코드 부재 정정** — §7 A2 / §10 Q5 / §11 부록 A (로딩 + 키보드 행) / §11 리스크표 모두 수정. `Accounts/index.tsx:144` 의 `accounts-loading` 컨테이너는 `data-testid`만 가지고 `role="status"` / `aria-busy="true"` 미적용. `<Spinner label>`만 의존. 의도된 상태였으나 "자연 보강" 문구는 코드와 불일치 → 정직하게 표기.
3. **§3.1 스켈레톤/로더 표 갱신** — Plan-A2 전 시점 사실(`Skeleton 흔적 없음`)은 outdated. 현 상태: `<Spinner>` 공통 컴포넌트 존재, Accounts에만 적용. **부수 추가**: `Templates/index.tsx:38-40`은 자체 인라인 `<div className="animate-spin ...">` 사용 — `<Spinner>` 통일 미적용 (Q7 결정에 따라 Templates도 Plan-A2 범위 외로 보는 게 정직). §8.2 트리에 "⚠️ 실제 적용 = Accounts만" 주석 추가.

부수 갱신:
- §12 본문 직후 "2026-08-31 문서 점검 메모" 추가 — STRATEGY.md 갱신(부록 B diff)이 **현재까지 미적용**임을 명시. STRATEGY.md §3 line 124-134는 2026-08-30 시점 그대로 (예: `Plan-7a 📋 구현 대기`). 본 brainstorm 갱신분과 묶음 push 또는 별도 commit 사용자 결정 대기.
- **코드 변경 0** — 본 갱신은 brainstorm 문서 정직화만. `accounts-loading` 컨테이너에 `role="status"` / `aria-busy="true"` 추가하는 코드 보강은 별도 작업으로 분리 (a11y audit plan 또는 트리거 시점에 진행).

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
| 스켈레톤/로더 | (전체 `src/` grep) | `skeleton/Spinner/Loading/Suspense` 흔적 없음 — Plan-A2 전 시점의 사실. **현재(2026-08-31)**: `src/components/feedback/Spinner.tsx` 존재 (Plan-A2). Accounts 페이지에 `<Spinner label>` 적용. **단, Templates/index.tsx line 38-40은 자체 인라인 `<div className="animate-spin ...">` 를 사용** — `<Spinner>` 통일 미적용, Templates는 사실상 Plan-A2 범위 외. Q7 결정에 따라 의도된 상태이나 코드 일관성 측면에서는 차이 |
| 테마 토글 | `src/store/settingsStore.ts` (`initializeTheme`) | 시스템 설정 연동은 존재, 토글 UI는 `Settings/UISection`에 |
| 강도 표시 | `src/components/inputs/PinStrengthMeter.tsx` | zxcvbn 기반, `aria-` 일부 적용 — Plan-4 산출물 |
| React Router | `react-router-dom` v7 (lock-step) | nested route/stepper 패턴 가능 |

### 3.2 STRATEGY §3 원문 (요약 매핑)

| STRATEGY §3 항목 | 코드 상태 | 비고 |
|---|---|---|
| 로딩 상태/스켈레톤 UI (암호화/복호화·동기화·파일 I/O) | ❌ 미구현 | 스피너/스켈레톤 컴포넌트 부재, `persistVaultSnapshot`/`loadAccounts` 등 비동기 경로에 시각 피드백 없음 |
| 더블클릭/중복 제출 방지 | ✅ 완료 | Plan-B-1/2/3 완료. `Button.tsx` `loading`/`disabled`/`aria-busy` 일관 처리, FormDialog/ConfirmDialog 마이그레이션, 21개 페이지 inline `<button>` → `<Button>` 마이그레이션. `useFormSubmit` wrapper **포함 안 함** (Q2) |
| 키보드 네비게이션/포커스 순서, 스크린리더 | ⚠️ 부분 | `AutoLockIndicator`/`BaseDialog`는 `aria-*` 적용. 그 외(메인 페이지/리스트/탭)는 표준 HTML 의미론에 의존, 명시적 포커스 관리 부재 |
| 에러 토스트/인라인 에러, 사용자 언어 매핑 | ⚠️ 부분 | `setSyncError`는 store에 저장하지만 토스트 없음. 다이얼로그 에러는 `throw` → caller가 alert. 네이티브 에러 → 한국어 매핑 함수 부재 |
|| 다크/라이트 테마 전환 깜빡임, 시스템 연동 | ✅ 완료 (Plan-D PR 1) | Plan-D PR 1 (`15e2e870`+보완 `325a3b2f`) — `index.html` inline splash CSS+script로 React mount 전 `<html class>` 결정 (FOUC 가드), SplashScreen/RootRedirect/ErrorScreen 도입. **`matchMedia` 시스템 변경 live 갱신 + `themeMode: "light" | "dark" | "system"` 3-way 토글은 Plan-D PR 2 미착수 → 2026-08-31 사용자 결정으로 보류** (현재 inline script가 localStorage.theme만 읽고 매치미디어는 첫 paint 폴백으로 작동 — 시스템 변경 live 갱신의 사용자 체감 가치 낮음). UISection은 2-way (light/dark) 유지 |
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
| "다크/라이트 테마 시스템 설정 연동" | `settingsStore.theme: light\|dark`, UISection 2-way | inline script가 localStorage.theme + 매치미디어 폴백으로 첫 paint 처리, 사용자 명시 theme 시 강제. **`matchMedia` live 갱신 + 3-way 토글은 Plan-D PR 2 → 2026-08-31 사용자 결정으로 보류** (필요성 낮음) | ⚠️ (FOUC ✅, 시스템 live 갱신 ⚠️) |
| "테마 전환 시 깜빡임 없음" | `index.html` inline script (`15e2e870`) | React mount 전 `<html class="dark|light">` 결정 → 첫 paint부터 정확한 테마. 사용자 reload 실측 시 깜빡임 0 확인 | ✅ |
| "Plan-7 (다단계 페이지)" | `/create-vault` 단일 라우트 (`e878f85b`) | 2단계 Stepper (이름→PIN), Plan-4 zxcvbn 통합 | ✅ |
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

### A1. Plan-A1: 에러 가시화

**포함 (Q1 확정):**
- `mapError(err: unknown): string` — 네이티브/IndexedDB/일반 에러 → 한국어 매핑
- 호출처 6곳 수동 try/catch (`AccountEdit` 저장 2건, `AccountDetail` 삭제 1건, `loadAccounts`/`loadTemplates` 초기, `syncToAutofill`)
- `setSyncError` → `<SyncErrorBanner>` 페이지 상단 표시
- i18n 키 분리

**범위 밖 (Q1 확정):**
- Toast / Snackbar / 공통 hook (`useAsync`, `useFormError` 등) — **포함하지 않음**
- Spinner / Skeleton — **A2에서 다룸**

**장점:** 실패 UI가 모두 가시화됨, 토스트 의존성 0, "한 가지 길" (수동 try/catch + 매핑 함수) 유지. Plan-7/Plan-B의 공통 전제.
**단점:** 호출처 마이그레이션 6곳 수동 — `mapError` 누락 시 fallback이 `error.message` 그대로 노출.
**복잡도:** 소. 새 hook 0, 새 컴포넌트 1~2개 (`SyncErrorBanner`), 매핑 함수 + 호출처 패치.
**보안:** 영향 없음.
**테스팅:** `mapError` 단위 테스트 + `SyncErrorBanner` 렌더 테스트 + 호출처 6곳 통합 테스트 (실패 시뮬레이션).
**마이그레이션:** `setSyncError` 호출처를 인라인/SyncErrorBanner로 교체. 기존 `FormDialog`의 `data-testid="form-dialog-error"` 패턴은 유지.

### A2. Plan-A2: 초기 진입 Skeleton

**포함 (Q7 확정):**
- `<Spinner>` / `<Skeleton>` 공통 컴포넌트
- `loadAccounts` / `loadTemplates` 첫 진입 시 Skeleton 표시 (`Accounts`/`Templates` 페이지)
- `AccountDetail` 첫 진입 시 (해당 account 로드)
- `<Spinner>` 자체 `label` prop으로 a11y label 부여 (컨테이너 `<div role="status" aria-busy="true">` 명시 적용은 **미적용** — Accounts/index.tsx line 144 컨테이너는 `data-testid`만 가짐, 2026-08-31 점검 시 정정)

**범위 밖 (Q7 확정):**
- 자동 저장 중 (`persistVaultSnapshot`) — **포함 안 함**
- sync 중 (`syncToAutofill`) — **A1의 SyncErrorBanner로 충분**

**장점:** 첫 페이지 로드 시 빈 화면 → Skeleton → 콘텐츠로 자연스러운 전환. 시각적 피드백.
**단점:** 로딩이 매우 짧으면 Skeleton이 깜빡임 — throttle 가능하면 그 자리에서 표시 안 함.
**복잡도:** 소. 공통 컴포넌트 2개 + 3개 페이지 적용.
**보안:** 영향 없음.
**테스팅:** Skeleton 렌더 테스트 (accounts.length === 0 && isLoading 시 표시) + Playwright E2E.
**마이그레이션:** 기존 `isLoading` prop 활용, 새 추상화 없음.

**A1/A2 분리 근거:**
- **A1이 모든 plan의 전제** — Plan-7/Plan-B가 `mapError` 활용
- **A2는 독립 가능** — Skeleton은 다른 plan과 결합도 약함, 단독 plan으로 검증된 패턴 만들기 좋음
- **A1을 먼저 해야 A2에서 Skeleton 내부 에러도 매핑 가능**

### B. Plan-B: 버튼/폼 일관성

**포함 (Q2 확정 반영):**
- `Button` 컴포넌트에 `loading` prop 추가, in-flight 시 자동 `disabled` + `aria-busy="true"`
- `FormDialog`/`ConfirmDialog`의 submit 핸들러가 `loading` 상태 관리
- 호출자는 FormDialog 변경 없음 — **throw 유지** (Q1의 수동 try/catch 패턴과 일관)

**범위 밖 (Q2 확정):**
- `useFormSubmit` 같은 wrapper hook — **포함하지 않음**
- FormDialog의 `onError` callback 패턴 — **포함하지 않음**

**장점:** 사용자 체감 큼 ("왜 또 누르지?" → "한 번만 누르면 됨"). Plan-A의 매핑 함수와 자연 결합.
**단점:** 단독으로는 Plan-A(에러 매핑) 없이는 에러 표시가 alert 한정.
**복잡도:** 소. 기존 Button/FormDialog 수정 중심, 호출처 변경 0.
**보안:** 영향 없음.
**테스팅:** Button 단위 테스트(loading 상태) + FormDialog 통합 테스트(in-flight 시 disabled).
**마이그레이션:** 없음 (호출자 API 변경 없음).

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

### E. Plan-7a: 파일 생성 다단계 페이지 (UI 흐름)

**포함 (Q3/Q4/Q8 확정 + 2026-08-30 Plan-7a/b 분리 결정 반영):**
- 신규 라우트 `/create-vault` 1개 (Q3-b: nested route 아님)
- `useCreateVaultStore` (Zustand): `step: 1 | 2`, `fileName`, `pin`
- **Step 순서 (Plan-7a 확정):** 2단계
  - Step 1: 파일 이름 + `.json` 검증 + 중복 검사
  - Step 2: PIN 입력 (zxcvbn, Plan-4 산출물 활용, **Q8: Plan-4 정책 그대로 4~20자 mixed**)
- **Stepper UI (Q3-b-2-B 확정):** Progress bar + 단계 라벨 (`●─────●─────○` 형태, 2단계)
- 기존 `FileCreateDialog` 호출처는 `<Link to="/create-vault">`로 마이그레이션
  - `Home.tsx` "파일 생성" 버튼
  - **`DataSection.tsx` "백업 파일 저장"은 별도 처리** (Q4-a: FileCreateDialog 완전 제거 시점에 분리된 백업 다이얼로그 또는 별도 페이지로 결정)
- **Q4-a: `FileCreateDialog`는 호출처 100% 마이그레이션 후 완전 제거** (deprecated 잔존 X)

**범위 밖 (Plan-7a):**
- **폴더 선택 Step / SAF URI 저장 / 자동 백업 활성화** — **Plan-7b로 분리** (별도 plan)
- **암호화 체크박스** — Plan-7a에서는 모든 새 파일을 암호화로 가정 (Plan-4 정책 따라감), 체크박스 제거 단순화. 비암호화 파일은 기존 v1 데이터 마이그레이션 시나리오만

**장점:** "되돌리기 어려운 결정"의 가시성 ↑, 모바일 키보드 가림 해결, Plan-4 자연 통합, 단일 라우트로 deep-link 부담 없음.
**단점:** 라우터 추가 → Playwright E2E navigation 영향. 모달 → 페이지 마이그레이션 작업.
**복잡도:** 중. 2단계 컴포넌트 + stepper + store + router + i18n.
**보안:** 영향 없음 (입력값만 페이지화, crypto 경로 동일).
**테스팅:** Playwright E2E (2단계 시나리오) + 단위 테스트 (`useCreateVaultStore`).
**마이그레이션:** `FileCreateDialog` 호출처 1개 (`Home.tsx`) + DataSection 백업은 Plan-7a와 별도.

### E-b. Plan-7b: 폴더 선택 + 자동 백업 통합 (후속, 별도 brainstorm)

**작업 위치 (2026-08-31 사용자 결정):** `KIYO-vault-integrity` worktree에서 진행 (Track 2 영역, 본 Track 3 brainstorm은 의존성 표기만).

**계획 (Plan-7a 완료 후 별도 brainstorm):**
- Plan-7a의 Step 3 (또는 별도 라우트) — SAF `pickBackupFolder`로 폴더 선택
- `files` 테이블에 `autoBackupUri?: string` 필드 추가 (Dexie v15 migration)
- 변경 시 `writeBackupToUri`로 자동 백업 (`useAutoLock` 또는 `persistVaultSnapshot` 직후)
- 폴더 안 선택 시 → DB만 (Plan-7a 동작 유지)
- `Settings > 자동 백업` 항목에서 URI 변경/해제 가능

**핵심 정책 (2026-08-31 사용자 결정):**
- **자동저장 시 파일이름을 고정이 아니라 현재 vault의 `fileName`으로 덮어쓴다.**
- 자동저장 위치는 **SAF 폴더 URI** (사용자가 한 번 선택한 폴더). 즉 SAF 폴더 안의 `<fileName>.json` 자리에 overwrite — vault의 원본 위치(`Documents/<fileName>.json`)가 아님.
- 현재 동작(`writeBackupToUri(autoBackupUri, encrypted)`)과 일치. 변경점은 파일이름을 `fileName` 인자에서 활성 vault의 `fileName`으로 동적 결정하는 것.
- vault 전환(import/changePin) 시 새 `fileName`이 SAF 폴더 안의 새 파일이름이 되며, 이전 파일은 SAF 폴더에 그대로 남음 (사용자가 수동 정리).

**범위 (예상):**
- 새 라우트 또는 Plan-7a의 Step 3 추가
- Dexie schema migration (v15) — `fileName`은 이미 v14에 존재하므로 `autoBackupUri?` 추가만 필요할 수 있음 (KIYO-vault-integrity brainstorm에서 확정)
- `useAutoBackup` hook (변경 감지 → SAF 폴더 URI 안의 `<fileName>.json`에 overwrite)

**상태:** brainstorm 미작성. **STRATEGY §2 (vault integrity) 후속**으로 분류, Plan-7a 완료 + 사용자 결정 후 진행.

## 8. Recommended Direction

### 8.1 우선순위 권장 (사용자 결정 기반)

> **2026-08-30 갱신:** Multi-Vault brainstorm [`2026-08-30-multi-vault-support.md`](2026-08-30-multi-vault-support.md) 결과로 **순서 재배치** — Multi-Vault가 Track 3 진입 전 **최우선**으로 처리되어야 Home의 파일 리스트 UI가 가능해짐. Plan-7(다단계 페이지)의 "기존 파일 선택 / 새로 만들기" 분기도 Multi-Vault 결과에 의존.
> **2026-08-30 (2차) 갱신:** Multi-Vault / Plan-7a / Plan-A1 / Plan-A2 / Plan-B-1 / Plan-B-2 6개 plan 완료. 순서 표는 **계획**과 **실제 진행**을 모두 반영.

| 순서 | Plan | 근거 | 예상 복잡도 | 상태 |
|---|---|---|---|---|
| **0** | **[Multi-Vault Support](../2026-08-30-multi-vault-support.md) (§2 후속)** | Home 파일 리스트 UI 가능하게 함. STRATEGY Boundary #4 ("멀티 볼트는 로컬 파일 단위로만") 격차 해소. **Track 3 모든 plan의 전제** | 중~대 | ✅ 완료 (PR `afff2e1f`) |
| 1 | **Plan-7a: 다단계 페이지** (이름 → PIN, Progress bar + 라벨, 2단계) | Multi-Vault 리스트 위에서 "기존 파일 선택 / 새로 만들기" 분기 가능. Plan-4(패스프레이즈, 완료)와 자연 통합 | 중 | ✅ 완료 (PR `e878f85b`) |
| **Plan-7a 2차 (Q4-a)** | `DataSection` 백업 마이그레이션 + `FileCreateDialog` 완전 제거 | Q4 결정. 2026-08-30 사용자 결정으로 **보류** — 트리거 발생 시 진행 | 소 | ⏸️ 보류 |
| **후속** | **Plan-7b: 폴더 선택 + 자동 백업 통합** (별도 brainstorm, STRATEGY §2 분류) | SAF `pickBackupFolder` + `autoBackupUri` + `useAutoBackup` hook. Plan-7a 완료 + 사용자 결정 후 진행 | 대 | 📋 미착수 (별도 brainstorm) |
| 2 | **Plan-A1: 에러 가시화** (`mapError()` + 호출처 8곳 try/catch + `SyncErrorBanner`) | Plan-7a/Plan-B의 공통 전제. 토스트 없음 (Q1) | 소 | ✅ 완료 (PR `19341aec`) |
| 3 | **Plan-A2: 초기 진입 Spinner** (`<Spinner>` + Accounts 페이지 적용) | A1과 독립 가능, 단독 plan으로 검증된 패턴 만들기 좋음 (Q7). **범위 축소**: Templates/AccountDetail 미적용 | 소 | ✅ 완료 (PR `f1dcc638`) |
| 4a | **Plan-B-1: Button 인프라** (Button.tsx + Dialog 마이그레이션) | A2의 `<Spinner>` 활용, `FormDialog`/`ConfirmDialog` inline → `<Button>` | 소 | ✅ 완료 (PR `cebf14ca`) |
| 4b | **Plan-B-2: 자주 쓰는 페이지** (Accounts/AccountDetail/AccountEdit/Home/Auth/CreateVault) | A1의 `mapError` 활용, 사용자 체감 큼. 호출자 API 변경 0 | 소 | ✅ 완료 (PR `e3a4c1ae`) |
| 4c | **Plan-B-3: 나머지 페이지** (Templates/Settings/AutofillSection/DataSection/SecuritySection) | A1의 `mapError` 활용, 21개 inline `<button>` → `<Button>` 마이그레이션. Toggle switch(`AutofillSection` line 213) 제외, `FileCreateDialog` 잔존(Q4-a) 보류. **순수 범위만** | 소 | ✅ 완료 (커밋 `93e007ed`, **push 완료 (origin 브랜치 history에 포함)**, PR 미개설 — GitHub REST API `/pulls?head=chansoo1280:feat/ux-accessibility` 빈 배열) |
| 5a | **Plan-D PR 1: 라우트 + FOUC 가드 + RootRedirect** | inline script로 FOUC 사전 차단 + 4-state RootRedirect + useEffect 5개 제거. **Q6 결정 변경** (실측 → 사전 차단). 10-persistence E2E 회귀는 self-load 패턴으로 흡수 | 중 | ✅ 완료 (커밋 `15e2e870`+`325a3b2f`) |
| 5b | **Plan-D PR 2: themeMode + UI 3-way + matchMedia live 갱신** | Q6 시스템 연동 live 갱신 흡수. PR 1 머지 후 진행 | 소 | ⏸️ 보류 (2026-08-31 사용자 결정: inline script + 매치미디어 폴백으로 충분, 필요성 낮음) |
| 6 | **a11y audit (별도 plan)** | axe-core CI + 키보드 Playwright + remediation. Plan-B-3/D 완료 후 또는 트리거 발생 시 (Q5) | 대 | 📋 미착수 |

**근거 갱신:**
- **Multi-Vault가 0순위인 이유:** Plan-7a의 "기존 파일 선택 / 새로 만들기" 분기는 1개 파일 모델에선 의미가 없음. Multi-Vault가 먼저 와야 Plan-7a의 v1이 의미를 가짐. 또한 Home UI 자체가 "파일 1개 표시 → 파일 N개 리스트"로 바뀌어야 사용자가 multi-vault를 체감.
- **Plan-7a을 1순위(Track 3 내)로 둔 이유:** 사용자가 STRATEGY §3에 직접 후보로 명시. A1(에러 가시화) 없이 진행하면 "단계 전환 시 피드백이 alert"로 품질 저하.
- **Plan-7b를 후속으로 분리 (2026-08-30 결정):** 폴더 선택 + 자동 백업은 STRATEGY §2(vault integrity) 영역, Plan-7a(UI 흐름)와 결합 약함. 별도 brainstorm으로 충분한 설계 필요.
- **Plan-A1을 2순위로 (Q1 확정):** 토스트/`useAsync` 제외, 단순 매핑 함수 + 호출처 try/catch. Plan-7a/Plan-B가 의존하는 `mapError()`만 제공하면 충분.
- **Plan-A2를 3순위로 (Q7 확정, A1과 분리):** Skeleton은 다른 plan과 결합 약함, 단독 검증된 패턴으로 만들기 좋음. A1 후속이 아닌 독립 — 순서는 3이지만 plan 시작 시점은 Plan-B와 병행 가능.
- **a11y를 별도 plan(Q5-a)으로 분리:** 각 plan에 a11y 자연 보강 + 별도 audit plan에서 axe-core violations 0 / 키보드 시나리오 통과를 명시적 게이트로.

### 8.2 권장 분할

```
Track 3: UX·접근성·인터랙션 품질
└─ ✅ Multi-Vault Support (2026-08-30 완료 — [plan](../plans/2026-08-30-multi-vault-support.md))
   ├─ Plan-7a: 파일 생성 다단계 페이지 (/create-vault 단일 라우트, 2단계)
   │       Step 1: 이름 → Step 2: PIN
   │       Stepper: Progress bar + 단계 라벨 (●─────●) [2단계]
   │       FileCreateDialog: Home.tsx 마이그레이션 후 완전 제거
   │       DataSection 백업은 Plan-7a와 별도
   ├─ Plan-A1: 에러 가시화
   │       mapError() + 호출처 6곳 수동 try/catch + SyncErrorBanner
   │       ❌ 토스트 / useAsync / useFormError (포함 안 함)
   ├─ Plan-A2: 초기 진입 Skeleton
   │       Spinner/Skeleton + Accounts/Templates/AccountDetail 첫 진입
   │       ❌ 자동 저장/persistVaultSnapshot (포함 안 함)
   │       ⚠️ 실제 적용 = Accounts만 (Templates/AccountDetail은 미적용, Q7 결정)
   ├─ Plan-B: 버튼/폼 일관성
   │       Button.loading + FormDialog/ConfirmDialog throw 유지
   │       ❌ useFormSubmit wrapper (포함 안 함)
   ├─ Plan-D: 테마 FOUC 가드 + 시스템 연동 (2-PR 분할)
   │       PR 1 ✅ 완료 (커밋 `15e2e870`+`325a3b2f`): inline script로 FOUC 사전 차단 + RootRedirect/SplashScreen/ErrorScreen + useEffect 5개 제거
   │       PR 2 ⏸️ 보류 (2026-08-31 사용자 결정): themeMode 3-way + matchMedia live 갱신 + UISection 토글 — inline script + 매치미디어 폴백으로 충분
   └─ a11y audit (별도 plan) — Plan-A/B/D 완료 후 또는 트리거 시
          axe-core CI + 키보드 Playwright + remediation
          (각 plan에 a11y 자연 보강은 계속 진행)

후속 (STRATEGY §2 분류):
└─ Plan-7b: 폴더 선택 + 자동 백업 통합 (별도 brainstorm 예정)
       SAF pickBackupFolder + autoBackupUri + useAutoBackup hook
       Dexie v15 migration + Settings UI
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

|| # | 결정 | 상태 |
||---|---|---|
|| Q1 | Plan-A 에러 표시: **인라인만** (수동 try/catch + `mapError()` 매핑 함수). 토스트/Snackbar/공통 hook 없음. `setSyncError`는 페이지 상단 배너로 가시화 | ✅ 확정 + Plan-A1 구현 완료 (PR `19341aec`) |
|| Q2 | Plan-B FormDialog 에러: **throw 유지** (Q1-b와 일관, 호출자가 try/catch) | ✅ 확정 + Plan-B-1 구현 완료 (PR `cebf14ca`). throw 유지 + `aria-busy` 추가 |
|| Q3 | Plan-7 라우트: **단일 라우트** `/create-vault` + `useCreateVaultStore.step`. Stepper는 **Progress bar + 단계 라벨** (`●─────●─────○` 형태) | ✅ 확정 + Plan-7a 구현 완료 (PR `e878f85b`) |
|| Q3-추가 | Plan-7 Step 순서: **1. 이름 → 2. PIN → 3. 폴더 (선택, 건너뛰기 가능)** | ✅ 확정 (2026-08-30 갱신: Plan-7a는 2단계(UI 흐름만)로 축소, Step 3 폴더 선택은 Plan-7b로 분리. Plan-7a 구현에는 "비밀번호 없이 만들기" 버튼이 추가되어 비암호화 vault 흐름도 유지됨 — plan §구현 노트 참조) |
|| Q4 | Plan-7 `FileCreateDialog`: **완전 제거** (호출처 100% 마이그레이션 후) | ⚠️ **부분 완료** — Home.tsx는 `/create-vault`로 마이그레이션됨. **`Settings/components/DataSection.tsx` 백업 다이얼로그가 여전히 FileCreateDialog 사용 중** (2026-08-30 grep: `DataSection.tsx:180` 미마이그레이션). **2026-08-30 사용자 결정: Q4-a 후속(완전 제거) 보류**, 다음 단계로 분리하지 않음. Plan-B-3는 순수 inline 버튼 마이그레이션만, FileCreateDialog 잔존은 그대로 |
|| Q5 | a11y: **별도 plan** (axe-core CI + 키보드 시나리오 + remediation). Plan-A/B/D 완료 후 또는 트리거 발생 시 | ✅ 확정 + **각 plan에 a11y 자연 보강 계속 진행** (Plan-B-1은 `aria-busy` 추가, Plan-A2는 `<Spinner label>` 적용). **단, 2026-08-31 점검에서 Plan-A2의 `accounts-loading` 컨테이너는 `role="status"` / `aria-busy="true"` 미적용** — Spinner label만 의존. 컨테이너 보강은 별도 audit plan 또는 트리거 시점에 진행. 별도 audit plan 미착수 |
||| Q6 | Plan-D FOUC: **Playwright 실측 우선** (reload 시 frame capture → 발생 시 작업, 아니면 cancel) | ✅ 확정 + **Plan-D PR 1 구현 완료 (커밋 `15e2e870`, 보완 `325a3b2f`, 문서 `b148855f`)**. 실측 대신 inline script로 FOUC를 사전 차단 (실측 결과 대기 불필요). system 연동 live 갱신은 **PR 2 미착수** |
||| Q7 | Plan-A Skeleton: **초기 진입만** (`loadAccounts`/`loadTemplates` 첫 페이지 로드) | ✅ 확정 + Plan-A2 부분 구현 완료 (Accounts만). Templates/AccountDetail 미적용 (Q7 적용 범위 축소 결정 가능성) |
||| Q8 | Plan-7 PIN 정책: **Plan-4 그대로** (4~20자 mixed, 변경 없음) | ✅ 확정 + Plan-7a 구현 완료 |
||| §8.1 순서 | **Multi-Vault → Plan-7 → Plan-A → Plan-B → Plan-D** | ✅ Multi-Vault / Plan-7a / Plan-7a-android-e2e / Plan-A1 / Plan-A2 / Plan-B-1 / Plan-B-2 / Plan-B-3 / **Plan-D PR 1** 완료 (8개). **Plan-D PR 2 (themeMode + UI)** ⏸️ 보류 (2026-08-31) / a11y audit / Plan-7a 2차 PR / Plan-7b 미착수 |

**진행 순서 (2026-08-30 갱신):**
1. **✅ Multi-Vault Support** ([plan](../plans/2026-08-30-multi-vault-support.md)) — 완료 (21 파일/334 테스트, Post-Implementation Dead Code Cleanup 62줄 정리)
2. **✅ Plan-7a** (다단계 페이지, 2단계) — 완료 (2026-08-30, PR `e878f85b`). `/create-vault` 라우트 + Stepper + NameStep/PinStep + 4개 단위 테스트 + E2E 재작성. [plan](../plans/2026-08-30-plan-7a-create-vault-multistep.md)
3. **✅ Plan-7a-android-e2e** (Android E2E 갱신) — 완료 (2026-08-30). `VaultCreateDialog.kt` → `CreateVaultPage.kt` 페이지 기반 재작성 + 사용자 E2E 직접 실행으로 Android E2E 전부 성공
4. **✅ Plan-A1** (에러 가시화) — 완료 (PR `19341aec`). [plan](../plans/2026-08-30-plan-a1-error-visibility.md). `mapError()` + `SyncErrorBanner` + 호출처 8곳 try/catch (`AccountEdit` 저장 2건, `AccountDetail` 삭제, `loadAccounts`/`loadTemplates` 초기, `syncToAutofill`, `CreateVaultPage.handleSubmit/handleSkip`). 후속 plan 공통 전제 해소
5. **✅ Plan-A2** (Spinner + Accounts 로딩 표시) — 완료 (PR `f1dcc638`). [plan](../plans/2026-08-30-plan-a2-spinner-loading.md). `<Spinner>` 공통 컴포넌트 + Accounts 페이지 spinner. **범위 축소 결정** — Templates/AccountDetail은 미적용 (Q7 적용 범위 재확인 필요)
6. **✅ Plan-B-1** (Button 인프라 + Dialog 마이그레이션) — 완료 (PR `cebf14ca`). [plan](../plans/2026-08-30-plan-b-button-loading-consistency.md). `Button.tsx` 보강 + `<Spinner>` 통합 + `aria-busy` + `FormDialog`/`ConfirmDialog` inline 버튼 → `<Button>` 마이그레이션 + 4+ 단위 테스트
7. **✅ Plan-B-2** (자주 쓰는 페이지 inline 버튼 → Button) — 완료 (PR `e3a4c1ae`). Accounts/AccountDetail/AccountEdit/Home/Auth/CreateVault의 inline `<button>` → `<Button>`. 후속 PR `e99ec404`로 `Spinner aria-hidden` 보강
| 8 | **Plan-B-3** (나머지 페이지) — **✅ 완료 (push 완료, PR 미개설)** (커밋 `93e007ed`, [plan](../plans/2026-08-30-plan-b3-settings-templates-buttons.md)). Templates/index, TemplateEdit, Settings/index, AutofillSection, DataSection, SecuritySection의 inline `<button>` → `<Button>` 마이그레이션 (21개). Toggle switch(`AutofillSection` line 213) 제외, `DataSection.tsx:180`의 `FileCreateDialog` 잔존은 Q4-a 후속으로 사용자 결정 보류 유지. **원격 HEAD = `b148855f` (2026-08-31)이므로 Plan-B-3 커밋이 5개 commit 뒤에 위치 — push 완료된 상태에서 Plan-D PR 1(+보완) 커밋 5개가 그 뒤로 머지됨**. **PR은 GitHub에 미개설** (`api.github.com/.../pulls?head=chansoo1280:feat/ux-accessibility` 빈 배열) — 사용자 결정 시 별도 PR 개설 가능 (코드 리뷰 단순, 단독 PR 권장). **다음 단계:** PR 개설 여부 사용자 결정 → a11y audit → Plan-7a 2차 PR(Q4-a) → Plan-7b (별도 brainstorm) |
| 9 | **Plan-D PR 1** (라우트 + FOUC 가드 + RootRedirect) — **완료** (커밋 `15e2e870`, 보완 `325a3b2f`, 문서 `b148855f`). `index.html` inline splash CSS + script (React mount 전 `<html class>` 결정) + `SplashScreen` (unlock 직후 preload 표시) + `RootRedirect` (4-state 머신: checking/preloading/redirecting/error, stale 감지 + Dexie close race 3s timeout + 1회 재시도) + `ErrorScreen` (variant='stale'/'generic') + `App.tsx` useEffect 5개 제거 + `Home` → `/home` 이동 + `settingsStore.initializeXxx` 5개 제거. 보완 커밋은 `e2e/10-persistence.spec.ts` 실패 진단 — RootRedirect는 `/`에서만 매칭하므로 `/accounts` 직접 렌더 시 `loadAccounts` 미호출 → Spinner 영원 → **self-load 패턴** (`useFileAuthGuard.onInitialized` + `AccountList`/`Templates/index` self-load + `loadAccounts`/`loadTemplates` 진입 시 `if (get().initialized) return;` store-side 가드 + `initializeStores` 명시 reset)으로 흡수. 회귀 게이트: `typecheck` ✓, `lint` (우리 변경 파일 에러 0) ✓, `test` 470/470 ✓, `e2e/10-persistence.spec.ts` 3건 ✓ (사용자 직접 실행 확인), `e2e/11-close-datafile.spec.ts` 7건 pathname predicate 교체. **Q6 결정 변경** — FOUC는 실측 대신 inline script로 사전 차단. PR 2 (themeMode + UI 3-way + `matchMedia` live 갱신) 미착수 |
| 10 | **Plan-D PR 2** (themeMode + UI + 시스템 연동 live 갱신) — **⏸️ 보류** (2026-08-31 사용자 결정: inline script + 매치미디어 폴백으로 충분, 필요성 낮음). PR 개설 안 함. 트리거 발생 시 진행 (예: 다중 디바이스/OS 테마 토글 시 자동 동기화 요구 등) |
| 11 | **a11y audit plan** (별도) — Q5 확정. axe-core CI + 키보드 Playwright + remediation. Plan-B-3/D 완료 후 또는 트리거 시. 미착수 |
| 12 | **Plan-7a 2차 PR** (`DataSection` 백업 마이그레이션 + `FileCreateDialog` 완전 제거, Q4-a 후속) — **2026-08-30 사용자 결정으로 보류**. 트리거 발생 시(예: DataSection 백업 흐름 회귀, FileCreateDialog 코드 정리 요청) 진행 |
| 13 | **후속 — Plan-7b** (폴더 선택 + 자동 백업 통합) — STRATEGY §2 분류, 별도 brainstorm 예정. Plan-B-3 완료 + 사용자 결정 후 진행. 미착수 |

> 2026-08-31 현재 **8개 plan commit 완료 + 8개 모두 push 완료** (Multi-Vault, Plan-7a, Plan-7a-android-e2e, Plan-A1, Plan-A2, Plan-B-1, Plan-B-2, Plan-B-3, Plan-D PR 1) — 7개 PR 머지 + **Plan-B-3 1개는 PR 미개설** (커밋 `93e007ed`은 origin `feat/ux-accessibility` history에 있음, HEAD = `b148855f`의 ancestor). **Plan-D PR 2 ⏸️ 보류** (2026-08-31 사용자 결정: inline script + 매치미디어 폴백으로 충분). 다음 자연스러운 단계는 **a11y audit** → **Plan-7a 2차 PR** (Q4-a 후속, 사용자 결정 보류) → **Plan-7b** (별도 brainstorm). **즉시 사용자 결정 항목:** (a) Plan-B-3 PR 개설 여부 (코드 리뷰 단순, 단독 PR 권장), (b) brainstorm 본 갱신분 commit + push.

## 11. Risks

| 리스크 | 완화 |
|---|---|
| ~~Plan-A 토스트를 잘못 만들면 모든 plan에 영향~~ | ✅ 해소 (Q1: 인라인만, 토스트 없음) + Plan-A1 완료 (PR `19341aec`). `mapError()` + 수동 try/catch + SyncErrorBanner로 한정, 마이그레이션 매핑표 불필요 |
| ~~Plan-7a 라우트 추정이 Playwright E2E navigation 깨뜨림~~ | ✅ 해소 (PR `e878f85b` + 2026-08-30 Android E2E 갱신). 단일 라우트(`/create-vault`)로 deep-link 부담 0, E2E 전면 재작성 후 사용자 직접 실행으로 Android E2E 전부 성공 확인 |
| ~~Plan-A1 호출처 마이그레이션 누락~~ | ✅ 해소 (PR `19341aec`). 8곳 try/catch + CreateVaultPage 인라인 처리 마이그레이션 완료 |
| a11y 누락 | Q5-a로 별도 plan 분리. 각 plan은 a11y 자연 보강 (Plan-B-1 `aria-busy` 추가됨, Plan-A2는 `<Spinner label>` 적용). **단, Plan-A2의 컨테이너(`accounts-loading`)는 `role="status"` / `aria-busy="true"` 미적용** — Spinner label만 의존 (2026-08-31 점검). 별도 audit plan에서 axe-core violations 0 / 키보드 시나리오 통과를 명시적 게이트로 |
| Plan-D FOUC가 실측에서 안 나타나면 작업 무의미 | ✅ 해소 (Q6 결정 변경 + PR 1 완료). inline script로 FOUC를 사전 차단, 실측 결과 대기 불필요. PR 2 시스템 연동 live 갱신은 PR 1 완료 후 진행 |
| ~~Track 1(autofill)/Track 2(vault) 진행 중 회귀~~ | ✅ 해소. Plan-A1/A2/B-1/B-2는 React UI 한정, autofill native 경로와 격리됨. git diff로 회귀 0 검증 |
| "단순화/이전과 같게" 사용자 신호 (메모) | 각 plan 시작 전 작업 범위 재확인, 첫 plan에서 검증된 패턴을 후속에 복제. Plan-A/B 4개 PR이 모두 이 신호 없이 머지됨 |
| ~~7개 항목 동시 착수 시 산만~~ | ✅ 해소. 순서 (Multi-Vault → Plan-7a → Plan-A → Plan-B) 엄수로 6개 plan 순차 완료. Plan-B-3 다음 / Plan-D 그 다음 |
| Plan-D PR 1 도입 회귀 (`/accounts` reload → Spinner 영원) | ✅ 해소 (커밋 `325a3b2f`). RootRedirect는 `/`에서만 매칭하므로 `/accounts` 직접 렌더 시 `loadAccounts` 미호출 → self-load 패턴으로 흡수 (`useFileAuthGuard.onInitialized` + 페이지 단위 `loadAccounts`/`loadTemplates` + store-side 가드 + `initializeStores` reset). **새로운 페이지 추가 시 동일 self-load 적용 필수** — 잊으면 동일 회귀 재발 |
| `e2e/11-close-datafile.spec.ts` 7건의 timing 의존 (pathname predicate로 흡수했으나 잔존) | 경미. 핵심 동작은 후속 `expect(page.getByText('파일을 선택하세요'))`가 보장. 향후 `useNavigate` 패턴 변경 시 재평가 필요 |
| Plan-B-3 PR 미개설 (origin HEAD = `b148855f`, 커밋 `93e007ed`은 origin 브랜치 history에 포함) | GitHub REST API `pulls?head=chansoo1280:feat/ux-accessibility` 빈 배열로 PR 0개 확인. 사용자 결정으로 PR 개설 보류 (코드 리뷰 단순, 단독 PR 권장). **본 brainstorm 갱신분도 같이 commit + push 미실행** (Plan-B-3 push 사실 자체와 무관 — docs 파일 자체가 미커밋) |
| Plan-D PR 2 보류 (2026-08-31 사용자 결정) | inline script + 매치미디어 폴백으로 시스템 변경 live 갱신 없이도 동작. 사용자가 "필요성 낮음" 결정 — 트리거 발생 시에만 진행. PR 개설 안 함 |
| ~~Multi-Vault 결과에 Track 3 전체 의존~~ | ✅ 해소 (2026-08-30 Multi-Vault 완료) |
| ~~Multi-Vault E2E 회귀 위험~~ | ⚠️ **부분 해소 + 사용자 결정으로 보류**. Home.tsx는 마이그레이션됨, DataSection.tsx:180 잔존. **2026-08-30 사용자 결정: Q4-a (완전 제거)는 지금 진행하지 않음**, FileCreateDialog 잔존은 그대로 유지. 트리거 발생 시(회귀/정리 요청) 진행 |
| ~~Plan-7a Step 3 폴더 "건너뛰기" 시 기본 저장 위치 결정~~ | ✅ 해소 (2026-08-30: Plan-7a는 2단계, Step 3 폴더 선택은 Plan-7b로 분리). Plan-7a는 DB만 저장 (현재 `createDataFile` 동작 유지) |
| ~~Plan-A2 Skeleton 깜빡임 (로딩이 짧으면)~~ | ✅ 부분 해소 (Accounts만 spinner 적용). Templates/AccountDetail은 미적용 (Q7 적용 범위 축소 — 사용자 결정 대기) |
| **Plan-B-3 시작 시 inline `<button>` 잔존 범위 정확히 파악 필요** | ✅ 해소 (2026-08-30 Plan-B-3 완료). 21개 인라인 버튼 정확히 식별·마이그레이션 (Templates 7 + Settings 14, AutofillSection toggle switch 1 제외). Plan-B-1/2 PR들과 동일 패턴 적용, Button prop 매핑표 작성 |

## 12. Next Action

**Track 3의 Q1~Q8 모두 확정 + 8개 plan commit 완료 (2026-08-31). 8개 모두 push 완료 / 7개 PR 머지 + Plan-B-3 1개 PR 미개설 (사용자 결정 대기).**

1. **✅ Multi-Vault 완료:** [plan](../plans/2026-08-30-multi-vault-support.md) — Dexie v14 + Home 파일 리스트 UI + 21 파일/334 테스트 + Dead Code Cleanup 62줄
2. **✅ Q1~Q8 확정** (2026-08-30): 인라인 에러 / throw 유지 / 단일 라우트 + Progress bar / Step 순서 (이름→PIN, 2026-08-30 Plan-7a로 2단계 축소) / FileCreateDialog 완전 제거 / a11y 별도 plan / FOUC 실측 / 초기 진입 Spinner / PIN Plan-4 그대로
3. **Plan-A 분리 확정 (2026-08-30):** Plan-A1 (에러 가시화) / Plan-A2 (Spinner) — A1이 모든 plan의 전제, A2는 Plan-B와 병행 가능
4. **Plan-7a/7b 분리 확정 (2026-08-30):** Plan-7a는 2단계(UI 흐름만), Plan-7b는 폴더 선택 + 자동 백업 통합(STRATEGY §2 후속, 별도 brainstorm)
5. **✅ Plan-7a 완료 (2026-08-30, PR `e878f85b`):** `/create-vault` 라우트 + Stepper + NameStep/PinStep + 4개 단위 테스트 + E2E 재작성 — [plan](../plans/2026-08-30-plan-7a-create-vault-multistep.md). React E2E(Playwright) 통과 + `npm run check` 383/383 통과
6. **✅ Plan-7a-android-e2e 완료 (2026-08-30):** Android E2E pageobject `VaultCreateDialog.kt` → `CreateVaultPage.kt` 페이지 기반 재작성. 사용자 직접 E2E 실행(`run-autofill-e2e.ps1`, `run-autosave-e2e.ps1`, `run-biometric-e2e.ps1`) 전부 성공. Auth/Biometric/SecureKey 코드 경로는 Plan-7a PR에서 변경 없음 — git diff로 회귀 0 검증
7. **✅ Plan-A1 완료 (2026-08-30, PR `19341aec`):** [plan](../plans/2026-08-30-plan-a1-error-visibility.md). `mapError()` (네이티브/Dexie/Web Crypto → 한국어 매핑) + `SyncErrorBanner` + 호출처 8곳 try/catch 마이그레이션 + `CreateVaultPage` 인라인 처리 정식 `mapError`로 전환. 후속 plan 공통 전제 해소
8. **✅ Plan-A2 완료 (2026-08-30, PR `f1dcc638`):** [plan](../plans/2026-08-30-plan-a2-spinner-loading.md). `<Spinner>` 공통 컴포넌트 + `aria-hidden` 지원 + Accounts 페이지 spinner 표시. **범위 축소**: Templates/AccountDetail은 미적용 (Q7 적용 범위 사용자 결정 대기)
9. **✅ Plan-B-1 완료 (2026-08-30, PR `cebf14ca`):** [plan](../plans/2026-08-30-plan-b-button-loading-consistency.md). `Button.tsx` 보강 (`loading`/`disabled`/`aria-busy` 일관 처리) + `<Spinner>` 통합 + `FormDialog`/`ConfirmDialog` inline 버튼 → `<Button>` 마이그레이션 + 4+ 단위 테스트
10. **✅ Plan-B-2 완료 (2026-08-30, PR `e3a4c1ae`):** 자주 쓰는 페이지(Accounts/AccountDetail/AccountEdit/Home/Auth/CreateVault)의 inline `<button>` → `<Button>` 마이그레이션. 후속 PR `e99ec404`로 `Spinner aria-hidden` 보강
11. **✅ Plan-B-3 완료 (2026-08-30, 커밋 `93e007ed`, push 완료, PR 미개설):** [plan](../plans/2026-08-30-plan-b3-settings-templates-buttons.md). Templates/Settings/AutofillSection/DataSection/SecuritySection의 21개 inline `<button>` → `<Button>` 마이그레이션. Toggle switch(`AutofillSection` line 213) 제외, `DataSection.tsx:180`의 `FileCreateDialog` 잔존은 Q4-a 후속으로 사용자 결정 보류 유지. `TemplateEdit/index.test.tsx` 신규 (3 테스트, Plan-A1 catch 결합 회귀 가드). 회귀 게이트: typecheck/lint(신규 0)/test 444/444/build/Android compile+unitTest/Playwright React E2E 44/44 모두 ✓. **origin HEAD = `b148855f`이므로 Plan-B-3 커밋은 origin 브랜치 history에 포함 (HEAD의 ancestor) — push는 완료. PR은 GitHub REST API로 0개 확인 — 사용자 결정 시 단독 PR 개설 가능**
12. **✅ Plan-D PR 1 완료 (2026-08-31):** [plan](../plans/2026-08-30-plan-d-theme-fouc.md). `index.html` inline splash CSS + script (FOUC 가드) + `SplashScreen` + `RootRedirect` (4-state 머신 + Dexie close race 3s timeout + 1회 재시도 + stale 감지) + `ErrorScreen` (variant='stale'/'generic') + `App.tsx` useEffect 5개 제거 + `Home` → `/home` 이동 + `settingsStore.initializeXxx` 5개 제거. 보완 (`325a3b2f`): `e2e/10-persistence.spec.ts` 실패 진단 → **self-load 패턴** (페이지 단위 load 책임, RootRedirect 우회 흡수) + `useFileAuthGuard.onInitialized` 단일 콜백 (onNoFile/onLocked YAGNI 제거) + store-side `if (get().initialized) return;` 가드 + `initializeStores` 명시 reset (vault 전환 시 잔존 회귀 방지). `e2e/11-close-datafile.spec.ts` 7건 `waitForURL` → `waitForURL((url) => url.pathname === '/', { timeout: 5000 })` 교체 (history.replaceState의 pushstate/popstate 부재 흡수). 회귀 게이트: `typecheck` ✓, `lint` (우리 변경 파일 에러 0) ✓, `test` 470/470 ✓, `e2e/10-persistence.spec.ts` 3건 ✓ (사용자 직접 실행). 4개 knowledge 캡처: ① 페이지 단위 self-load 원칙, ② store-side 가드의 transition 책임, ③ React Router replace navigate + Playwright waitForURL flake, ④ useFileAuthGuard 콜백 YAGNI
13. **Plan-D PR 2** (themeMode + UI 3-way + 시스템 연동 live 갱신) — **⏸️ 보류** (2026-08-31 사용자 결정: inline script + 매치미디어 폴백으로 충분, 필요성 낮음). PR 개설 안 함. 트리거 발생 시 진행
14. **a11y audit plan** (별도) — Q5 확정. axe-core CI + 키보드 Playwright + remediation. Plan-D PR 2 보류, 다음 자연스러운 단계
15. **Plan-7a 2차 PR** (`DataSection` 백업 마이그레이션 + `FileCreateDialog` 완전 제거, Q4-a 후속) — **2026-08-30 사용자 결정으로 보류**. 트리거 발생 시 진행
16. **후속 — Plan-7b** (폴더 선택 + 자동 백업 통합) — STRATEGY §2 분류, 별도 brainstorm 예정

**본 brainstorm의 ce-plan 직접 개설 보류 사유 해소됨.** §7 Options / §8.1/8.2 / §10 Current Decision State / §11 Risks 모두 확정 내용 반영 (Plan-A1/A2 분리, Plan-7a/7b 분리, Plan-D PR 1/2 분할, E2E 회귀 0 가정 철회, Plan-B 3-PR 분할 진행 반영 포함). STRATEGY.md 갱신은 별도 작업 (부록 B diff 적용).

> **2026-08-31 문서 점검 메모:** 본 brainstorm 갱신분은 commit + push 미실행 상태 — STRATEGY.md 갱신(부록 B diff)도 함께 보류. 2026-08-31 grep 결과 `STRATEGY.md §3` line 124-134는 **2026-08-30 시점 그대로** (예: `Plan-7a 📋 구현 대기`, `Plan-A1 📋`, `Plan-A2 📋` 표기). 다음 commit 시점에 (a) brainstorm 본 갱신분 + (b) STRATEGY.md §3 갱신(부록 B diff 적용)을 한 묶음으로 push할지, 별도 commit으로 분리할지 사용자 결정 대기.

---

## 부록 A. §3 카테고리 ↔ Plan 매핑 (최종, Q1~Q8 + Plan-A 분리 + Plan-B 3-PR 진행 반영)

|| §3 원문 | 흡수 plan | 비고 |
||---|---|---|
|| 로딩 상태/스피너 UI | **Plan-A2** ✅ 완료 (PR `f1dcc638`) | `<Spinner>` 공통 컴포넌트 + Accounts 페이지 spinner. 토스트는 **포함 안 함** (Q1). **범위 축소**: Templates/AccountDetail 미적용 (Q7 사용자 결정 대기). **a11y 보강 범위**: `<Spinner label>` 적용은 완료, `accounts-loading` 컨테이너의 `role="status"` / `aria-busy="true"` 명시 적용은 **미완** (2026-08-31 점검) |
|| 더블클릭/중복 제출 방지 | **Plan-B** (3-PR 분할) | Plan-B-1 ✅ 완료 (PR `cebf14ca`, Button 인프라 + Dialog 마이그레이션 + `aria-busy`). Plan-B-2 ✅ 완료 (PR `e3a4c1ae`, 자주 쓰는 페이지). **Plan-B-3 ✅ 완료** (2026-08-30, 커밋 `93e007ed`, 21개 inline → `<Button>` 마이그레이션, [plan](../plans/2026-08-30-plan-b3-settings-templates-buttons.md)). Toggle switch 제외, FileCreateDialog 잔존은 Q4-a 보류. **origin HEAD = `b148855f` (Plan-B-3은 ancestor) — push는 완료, PR은 GitHub REST API로 0개 확인 — 단독 PR 개설 사용자 결정 대기**. `useFormSubmit` wrapper **포함 안 함** (Q2) |
|| 키보드 네비게이션/포커스/스크린리더 | **별도 plan (Q5-a)** 미착수 | axe-core CI + 키보드 Playwright + remediation. 각 plan에 a11y 자연 보강은 계속 (Plan-B-1 `aria-busy` 추가, Plan-A2 `<Spinner label>` 적용). **단, Plan-A2 컨테이너의 `role="status"` / `aria-busy="true"` 명시 적용은 미완** (2026-08-31 점검) |
|| 에러 토스트/인라인 에러 | **Plan-A1** ✅ 완료 (PR `19341aec`) | `mapError()` + 인라인 + `SyncErrorBanner` + 호출처 8곳 try/catch. **토스트는 포함 안 함** (Q1). 후속 plan 공통 전제 해소 |
|| 다크/라이트 테마 + 깜빡임 | **Plan-D** PR 1 ✅ 완료 (커밋 `15e2e870`+`325a3b2f`) / PR 2 ⏸️ 보류 (2026-08-31) | FOUC: `index.html` inline script로 React mount 전 `<html class>` 결정 (실측 없이 사전 차단). 시스템 연동 live 갱신 + themeMode 3-way는 **PR 2 보류** — inline script + 매치미디어 폴백으로 충분, 사용자 결정. PR 1에서 `settingsStore.initializeXxx` 5개 제거 |
|| Plan-7a: 파일 생성 다단계 | **Plan-7a** ✅ 완료 (PR `e878f85b`) + Plan-7a-android-e2e ✅ | 단일 라우트 + Progress bar + Step 순서 (이름→PIN, 2단계). **Q4-a 후속 보류** (2026-08-30 사용자 결정): `DataSection.tsx:180`에서 `FileCreateDialog` 미마이그레이션 — 현재는 그대로 유지, 트리거 발생 시 진행. 폴더 선택 Step은 **Plan-7b로 분리** (별도 brainstorm) |
|| (후속) Plan-7b: 폴더 선택 + 자동 백업 | **Plan-7b** (별도 brainstorm, STRATEGY §2 분류) 미착수 | SAF `pickBackupFolder` + `autoBackupUri` + `useAutoBackup` hook + Dexie v15 |

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
|+- **진척 (2026-08-31 갱신):** 6개 항목 중 **5개 완료** (Plan-7a / Plan-A1 / Plan-A2 / Plan-B-1 / Plan-B-2 / Plan-B-3, 8개 PR/PR-series 머지 — Multi-Vault + Plan-7a + Plan-7a-android-e2e + Plan-A1 + Plan-A2 + Plan-B-1 + Plan-B-2 + Plan-B-3 + Plan-D PR 1, **Plan-B-3은 commit + push 완료, PR 미개설**), 1개 미구현 (a11y audit). Plan-D PR 1(FOUC 가드) 완료, PR 2(시스템 연동) 보류. **선행 의존성 해소**: Multi-Vault Support ✅ 완료 (2026-08-30) — [plan](../plans/2026-08-30-multi-vault-support.md)
+  - ✅ Multi-Vault Support — 완료, Post-Implementation Dead Code Cleanup 62줄 정리. Home 파일 리스트 UI 전제 해소
+  - ✅ Plan-7a: 다단계 페이지 — 완료 (2026-08-30, PR `e878f85b`). `/create-vault` 2단계 라우트 + Stepper + NameStep/PinStep + 4개 단위 테스트. 후속(2026-08-30): Android E2E pageobject `VaultCreateDialog.kt` → `CreateVaultPage.kt` 페이지 기반 재작성 + 사용자 E2E 직접 실행으로 `BiometricUnlockE2ETest` 포함 Android E2E 전부 성공 확인
+  - ✅ Plan-A1: 에러 가시화 — 완료 (2026-08-30, PR `19341aec`). `mapError()` (네이티브/Dexie/Web Crypto → 한국어) + `SyncErrorBanner` + 호출처 8곳 try/catch + `CreateVaultPage` 인라인 정식 전환. 토스트 없음 (Q1). 후속 plan 공통 전제 해소 — [plan](../plans/2026-08-30-plan-a1-error-visibility.md)
+  - ✅ Plan-A2: Spinner — 완료 (2026-08-30, PR `f1dcc638`). `<Spinner>` 공통 컴포넌트 + Accounts 페이지 spinner. **범위 축소**: Templates/AccountDetail 미적용 (Q7 사용자 결정 대기) — [plan](../plans/2026-08-30-plan-a2-spinner-loading.md)
+  - ✅ Plan-B-1: Button 인프라 — 완료 (2026-08-30, PR `cebf14ca`). `Button.tsx` 보강 (`loading`/`disabled`/`aria-busy`) + `<Spinner>` 통합 + `FormDialog`/`ConfirmDialog` inline → `<Button>` + 4+ 단위 테스트
|  - ✅ Plan-B-2: 자주 쓰는 페이지 — 완료 (PR `e3a4c1ae`). Accounts/AccountDetail/AccountEdit/Home/Auth/CreateVault inline → `<Button>`. 후속 PR `e99ec404`로 `Spinner aria-hidden` 보강
|  - ✅ Plan-B-3: 나머지 페이지 — 완료 (2026-08-30, 커밋 `93e007ed`, PR 미개설, [plan](../plans/2026-08-30-plan-b3-settings-templates-buttons.md)). Templates/index (3개) / TemplateEdit (4개) / Settings/index (2개) / AutofillSection (3개) / DataSection (5개) / SecuritySection (4개) = **21개 inline `<button>` → `<Button>` 마이그레이션**. Toggle switch(`AutofillSection` line 213) 제외, `DataSection.tsx:180`의 `FileCreateDialog` 잔존은 Q4-a 보류 유지. `TemplateEdit/index.test.tsx` 신규 (3 테스트, Plan-A1 catch 결합 회귀 가드). 회귀 게이트: typecheck/lint(신규 0)/test 444/444/build/Android compile+unitTest/Playwright React E2E 44/44 모두 ✓. **origin HEAD = `b148855f` (Plan-B-3은 ancestor) — push 완료, PR은 GitHub REST API로 0개 확인 — 단독 PR 개설 사용자 결정 대기**
|  - ✅ **Plan-D PR 1** — 완료 (2026-08-31, 커밋 `15e2e870`+보완 `325a3b2f`+문서 `b148855f`). `index.html` inline splash CSS + script (FOUC 가드) + `SplashScreen` + `RootRedirect` (4-state 머신 + Dexie close race 3s timeout + 1회 재시도 + stale 감지) + `ErrorScreen` (variant='stale'/'generic') + `App.tsx` useEffect 5개 제거 + `Home` → `/home` 이동 + `settingsStore.initializeXxx` 5개 제거. 보완에서 `e2e/10-persistence.spec.ts` 회귀 흡수 — **self-load 패턴** (페이지 단위 load 책임 + `useFileAuthGuard.onInitialized` 단일 콜백 + store-side `if (get().initialized) return;` 가드 + `initializeStores` 명시 reset). **`e2e/11-close-datafile.spec.ts` 7건** `waitForURL('/')` → `waitForURL((url) => url.pathname === '/')` 교체 (React Router `history.replaceState`의 pushstate/popstate 부재). 회귀 게이트: `typecheck` ✓, `lint` (우리 변경 파일 0) ✓, `test` 470/470 ✓, `e2e/10-persistence.spec.ts` 3건 ✓ (사용자 직접 실행). 4개 knowledge 캡처: ① 페이지 단위 self-load 원칙, ② store-side 가드의 transition 책임, ③ React Router replace navigate + Playwright waitForURL flake, ④ useFileAuthGuard 콜백 YAGNI. **Q6 결정 변경** — 실측 대신 inline script로 FOUC 사전 차단
|  - 📋 **Plan-D PR 2** — **⏸️ 보류** (2026-08-31 사용자 결정: inline script + 매치미디어 폴백으로 충분). `themeMode: "light" | "dark" | "system"` 추가 + `setThemeMode` + `matchMedia` 리스너 + UISection 3-way 토글. 트리거 발생 시 진행 (다중 디바이스/OS 테마 토글 시 자동 동기화 요구 등)
+  - 📋 a11y audit plan — 미착수. axe-core CI + 키보드 Playwright + remediation. Plan-B-3/D 완료 후 또는 트리거 시 (Q5-a)
|  - 📋 Plan-7b: 폴더 선택 + 자동 백업 통합 — 미착수. SAF `pickBackupFolder` + `autoBackupUri` + `useAutoBackup` hook + Dexie v15. STRATEGY §2 분류, 별도 brainstorm 예정
| - **최근 신호:** Tailwind CSS 4, Ionic 컴포넌트 기반, AutoLockIndicator 등 상태 표시 컴포넌트 존재
+- **상태:** Brainstorm 단계 ([docs/brainstorms/2026-08-30-track3-ux-accessibility.md](docs/brainstorms/2026-08-30-track3-ux-accessibility.md)) — **8개 plan commit 완료 / 8개 push 완료 / 7개 PR 머지 + Plan-B-3 PR 미개설 + Plan-D PR 2 보류** (2026-08-31 갱신). 다음 단계는 a11y audit → Plan-7a 2차 PR (Q4-a, 보류) → Plan-7b (별도 brainstorm)
+ - **진행 순서 (2026-08-31 갱신):** ~~Multi-Vault~~ ✅ → ~~Plan-7a~~ ✅ → ~~Plan-A1~~ ✅ → ~~Plan-A2~~ ✅ → ~~Plan-B-1~~ ✅ → ~~Plan-B-2~~ ✅ → **Plan-B-3** ✅ (commit + push 완료, PR 미개설 — 사용자 결정 대기) → **Plan-D PR 1** ✅ (커밋 `15e2e870`+`325a3b2f`+`b148855f`, origin HEAD) → **Plan-D PR 2** ⏸️ 보류 → **a11y audit plan** → **Plan-7a 2차 PR (Q4-a, 보류)** → **Plan-7b** (별도 brainstorm)
```
