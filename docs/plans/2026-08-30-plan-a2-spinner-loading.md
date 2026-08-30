# Plan-A2 (슬림) — 공통 `<Spinner>` 컴포넌트 + Accounts 페이지 spinner

- Date: 2026-08-30
- Source: [`docs/brainstorms/2026-08-30-track3-ux-accessibility.md`](../brainstorms/2026-08-30-track3-ux-accessibility.md) §7 A2, §8.1, §10 Q7
- 선행: [Multi-Vault Support](./2026-08-30-multi-vault-support.md) ✅, [Plan-7a](./2026-08-30-plan-7a-create-vault-multistep.md) ✅
- 후속: [Plan-B-1](./2026-08-30-plan-b-button-loading-consistency.md) (`<Spinner>` 활용)
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- 결정 사항: §결정 (Plan-A2 대화형 리뷰 결과) 참고

---

# Goal

**`<Spinner>` 공통 컴포넌트 1개 + Accounts 리스트 페이지 spinner+텍스트**로 일관성 확보.

완료 시 다음이 참:
- `src/components/feedback/Spinner.tsx` — 공통 spinner 컴포넌트 (size/label prop, a11y)
- `src/pages/Accounts/index.tsx` — 첫 진입 시 `<Spinner size="md" />` + "계정을 불러오는 중..." 텍스트 표시
- `Button.tsx`의 inline spinner는 Plan-B-1에서 `<Spinner>`로 교체 (Plan-A2는 무관)

**범위 밖 (Plan-A2 슬림):**
- `<Skeleton>` / `<SkeletonList>` — **포함 안 함** (IDB 로컬 응답은 100ms 미만, 깜빡임만 유발)
- `AccountDetail` spinner — **포함 안 함** (필요 시 별도 추가)
- `Templates/index.tsx` inline spinner 교체 — **포함 안 함** (이미 작동 중, Plan-B-3에서 Button 통일 시 자연 교체)
- 자동 저장 중 / sync 중 indicator — **포함 안 함** (Q7 확정, 사용자 체감 적음)

---

# Current State

## 인스펙션으로 확인된 사실 (코드 기준)

### `Accounts/index.tsx`의 현재 로딩 상태
- `useAccountStore` selector: `state.accounts` (line 13) — `isLoading`/`initialized` 미구독
- `App.tsx:32-34`에서 마운트 시 `loadAccounts()` 호출 → store는 `isLoading=true`였다가 false로 전환
- **AccountList는 이 전환을 관찰하지 못함** → 첫 진입 시 `accounts=[]` + 빈 화면 (헤더만 보임)
- UX 저하: "왜 아무것도 안 보이지?" 사용자 혼란

### 기존 spinner 흔적
- `src/pages/Templates/index.tsx:34` inline `<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)]" />`
- `src/components/Button.tsx:46-54` inline `<svg className="animate-spin ...">`
- 그 외 `<Spinner>`/`<Skeleton>` 컴포넌트 grep 결과 0

### a11y
- `AutoLockIndicator:role="status" aria-live="polite"` — 프로젝트 a11y 패턴
- spinner는 **`role="status"` + `aria-label={label}`** 조합

---

# 결정 (Plan-A2 대화형 리뷰 결과, 2026-08-30)

| Q | 결정 | 근거 |
|---|---|---|
| Skeleton vs 단순 spinner | **단순 spinner+텍스트** | IDB 로컬은 100ms 미만 응답, Skeleton은 깜빡임만 유발 (외부 API용 추상화) |
| 적용 범위 | **Accounts/index.tsx만** | 가장 큰 UX 저하(빈 화면), 다른 페이지는 이미 작동 중 또는 영향 적음 |
| `<Skeleton>`/`<SkeletonList>` 컴포넌트 | **만들지 않음** | IDB 로컬에 Skeleton은 오버킬 |
| 깜빡임 방지 (delay/throttle) | **불필요** | spinner가 1~2프레임만 보였다 사라져도 사용자 인지 미미. 0 추가 코드 |

---

# Architecture

## 컴포넌트 설계

### `<Spinner>` (`src/components/feedback/Spinner.tsx`)

```ts
interface SpinnerProps {
  size?: "sm" | "md" | "lg";  // sm: h-4 w-4 / md: h-6 w-6 / lg: h-8 w-8
  className?: string;
  label?: string;  // a11y label, 기본 "로딩 중"
}

export const Spinner = ({ size = "md", className = "", label = "로딩 중" }: SpinnerProps) => (
  <div role="status" aria-label={label} className={`inline-block ${sizeStyles[size]} ${className}`}>
    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  </div>
);
```

- `Button.tsx:46-54`의 inline SVG와 동일 구조 → Plan-B-1에서 Button도 `<Spinner size="sm" />` 사용
- `role="status"` + 시각적으로 보이지 않을 때 `aria-label`로 스크린리더 안내
- 위치: `src/components/feedback/` (기존 `src/components/inputs/`, `dialogs/` 컨벤션 따름)

## Accounts/index.tsx 통합

```tsx
const AccountList = () => {
  // 기존 selector
  const accounts = useAccountStore((state) => state.accounts);
  // 추가
  const isLoading = useAccountStore((state) => state.isLoading);
  const initialized = useAccountStore((state) => state.initialized);

  // ...

  if (!initialized || isLoading) {
    return (
      <section className="min-h-svh bg-[var(--color-bg)] px-5 py-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          {/* 헤더는 유지 (사용자 위치 인식) */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">Accounts</p>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--color-text-h)]">My accounts</h2>
            </div>
          </div>
          {/* Spinner + 텍스트 */}
          <div className="flex flex-col items-center justify-center gap-3 py-16" data-testid="accounts-loading">
            <Spinner size="lg" />
            <p className="text-sm text-[var(--color-text-muted)]">계정을 불러오는 중...</p>
          </div>
        </div>
      </section>
    );
  }

  // 기존 list 렌더
  return ( /* ... */ );
};
```

**조건: `!initialized || isLoading`** — 두 경우 모두 spinner. `initialized=true` 이후 refetch는 이전 데이터 유지 (Accounts list 본문은 그대로).

---

# Proposed Changes

## 1. 새 파일: `src/components/feedback/Spinner.tsx`

위 명세대로.

## 2. 새 파일: `src/components/feedback/Spinner.test.tsx`

- size prop → width/height 클래스 검증
- label prop → `aria-label` 렌더 검증
- `role="status"` 검증
- SVG `aria-hidden="true"` 검증

## 3. `src/pages/Accounts/index.tsx` — Spinner 통합

- `useAccountStore` selector에 `isLoading`, `initialized` 추가
- `if (!initialized || isLoading) return <Spinner 화면>` 분기 추가
- 헤더(Accounts/My accounts)는 유지
- `BottomTabs`는 유지 (네비게이션 가능)

---

# Tests

## 단위 테스트

| 파일 | 케이스 | 명령 |
|---|---|---|
| `src/components/feedback/Spinner.test.tsx` (신규) | size prop, label prop, role="status", svg aria-hidden | `npm run test -- Spinner` |

## 통합 테스트

| 파일 | 케이스 | 명령 |
|---|---|---|
| `src/pages/Accounts/AccountList.test.tsx` (신규) | `isLoading=true` 시 Spinner 표시, 완료 후 list | `npm run test -- AccountList` |

## E2E (Playwright)

- **회귀 0 가정** — 첫 마운트 시 spinner가 잠깐 보이거나(100ms 미만) 안 보임. 기존 E2E의 `waitForSelector` 패턴은 영향 없음
- 기존 11개 spec 통과 확인

## Android E2E

- **변경 없음**
- `compileDebugKotlin` + `testDebugUnitTest` 통과

## 수동 검증

1. `npm run dev` → `/accounts` 진입 → spinner 1~2 프레임 → list 전환
2. Chrome DevTools → Network throttling "Slow 3G" → spinner 더 오래 보임 → list 전환
3. `/accounts/1` (AccountDetail, spinner 없음) — 기존 not-found 분기 그대로

## 회귀 게이트

- `npm run check` 통과
- `npm run lint` 통과
- `npm run build` 통과
- 사용자 Playwright E2E 직접 실행 — 회귀 0

---

# Risks

| 리스크 | 완화 |
|---|---|
| IDB 응답이 빨라서 spinner 1~2 프레임만 깜빡임 | 사용자 인지 미미, 추가 코드(throttle/delay) 불필요. 결정: 그냥 `isLoading`만 사용 |
| `Accounts` 페이지 E2E가 spinner로 인해 pattern match 실패 | 기존 E2E는 list 본문 검증 중심, spinner는 잠깐만 표시 → 영향 미미 |
| `useAccountStore` selector 추가가 React 리렌더 영향 | `isLoading`/`initialized` 둘 다 store에서 set → 기존 selector 사용처에 영향 없음 |
| 다크/라이트 모드에서 spinner 색상 | `currentColor` 사용 → 부모의 `text-*` 클래스 따름. accent 색상 자동 적용 |

## 호환성

- **API 표면**: store selector 추가는 영향 0
- **신규 컴포넌트 1개** — Plan-B-1의 Button.tsx가 이걸 import
- **데이터 마이그레이션**: 0
- **DB 마이그레이션**: 0
- **자동잠금/세션**: 무관
- **Android native**: 무관

## 마이그레이션

- 기존 `Templates/index.tsx`의 inline spinner는 **그대로 유지** (영향 없는 코드)
- Plan-B-3에서 Templates button 마이그레이션 시 inline spinner도 자연 검토 대상 (별도 결정)

---

# Rollback

1. `git revert <plan-a2-commit>` — 2개 신규 파일 + Accounts/index.tsx selector/spinner 분기 revert
2. 외부 의존성 0 → 즉시 안전
3. Accounts 빈 화면 상태로 복원 (현재 동작)

---

# Out of Scope (후속 plan)

- **Plan-B-1:** Button.tsx의 inline spinner → `<Spinner size="sm" />` 교체
- **Plan-B-3:** Templates/index.tsx inline spinner 교체 (선택)
- **AccountDetail spinner:** 필요 시 별도 추가
- **`<Skeleton>`/`<SkeletonList>`:** IDB 로컬에선 불필요, **만들지 않음**
- **자동 저장 중 indicator:** Q7 확정으로 포함 안 함

---

# Cross-Plan Integration

**Upstream (이 plan이 의존):**
- ✅ Multi-Vault Support (store 필드 `isLoading`/`initialized` 정의)

**Downstream (이 plan이 제공):**
- **Plan-B-1:** `<Spinner>` 컴포넌트 활용 (Button.tsx 통합)
- **a11y audit:** `role="status"` 레퍼런스

**호환 시그니처:**
- `<Spinner size="sm" | "md" | "lg" label="..." />` — Plan-B-1에서 동일 사용

---

# Verification Checklist

- [x] `src/components/feedback/Spinner.tsx` 신규
- [x] `src/components/feedback/Spinner.test.tsx` 신규, 4+ 케이스
- [x] `src/pages/Accounts/index.tsx` `isLoading`/`initialized` 구독 + Spinner 분기
- [x] `src/pages/Accounts/AccountList.test.tsx` 신규, spinner/list 전환 검증
- [x] `npm run typecheck` 통과
- [x] `npm run lint` 통과 (신규 파일 0 에러)
- [x] `npm run test` 394 passed (기존 383 + 신규 11 = Spinner 7 + AccountList 4)
- [x] `npm run build` 통과
- [x] Android: `compileDebugKotlin` + `testDebugUnitTest` 통과
- [ ] 사용자가 Playwright E2E 직접 실행 시 회귀 0

## Status (2026-08-30)

**✅ 완료** — 5개 작업 항목 모두 verified.

| # | 항목 | 상태 | 근거 |
|---|---|---|---|
| 1 | Spinner 컴포넌트 | ✅ | `src/components/feedback/Spinner.tsx` (45줄, 4+ prop, a11y) |
| 2 | Spinner 단위 테스트 | ✅ | 7 케이스, 1.62s |
| 3 | AccountList Spinner 분기 | ✅ | `src/pages/Accounts/index.tsx:113-146` (selector + 분기 JSX) |
| 4 | AccountList 통합 테스트 | ✅ | 4 케이스, 1.40s |
| 5 | check/lint/build | ✅ | 27 test files / 394 tests / 0 신규 lint / build 1.54s |
| 6 | Android | ✅ | compileDebugKotlin + testDebugUnitTest UP-TO-DATE, 6s |

**git diff:**
- `src/pages/Accounts/index.tsx` +36 lines
- `src/components/feedback/Spinner.tsx` 신규 (45 lines)
- `src/components/feedback/Spinner.test.tsx` 신규 (60 lines)
- `src/pages/Accounts/AccountList.test.tsx` 신규 (96 lines)

**남은 일:**
- 사용자가 Playwright E2E 직접 실행 (회귀 0 검증, Plan-A2는 spinner 일시 표시로 기존 wait 패턴 영향 없음)
- 1 commit (사용자 요청 시)
