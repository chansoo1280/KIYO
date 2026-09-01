# Plan-G2 — PageShell + PageHeader (페이지 셸/헤더 통일)

- Date: 2026-09-01
- Source: [brainstorm 2026-09-01-component-unification-patterns](../brainstorms/2026-09-01-component-unification-patterns.md) §7.B/§7.A + §9 G2 결정
- 선행: [Plan-G1 SettingsSection+SettingsRow](../plans/2026-09-01-plan-g1-settings-section-row.md) (commit `da77d072`, PR #58)
- 후속: Plan-G3 (tracking), Plan-G4 (PasswordField), Plan-G5 (TagChip/FieldCard)
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- 결정 사항: Q2=(c), Q3=(c), Q4=(c), Q5=(a) — 사용자 답변 없는 권장안 기본값 채택 (Plan-G1 패턴 일관)

---

# Goal

**페이지 셸/헤더 통일** 완료 시 다음이 참:

1. `src/components/PageShell.tsx` + `PageHeader.tsx` 신규 wrapper 컴포넌트
2. 호출처 13개 페이지 마이그레이션
3. 5개 페이지의 `<section>` → `<main>` landmark 통일
4. 단위 테스트 2개 (PageShell.test.tsx + PageHeader.test.tsx) — 5+5 케이스
5. 회귀 게이트: typecheck / lint / test / build / Android compile+unitTest 모두 통과

**범위 밖**:
- Plan-G3 (tracking 토큰화)
- Plan-G4 (PasswordField 묶음)
- Plan-G5 (TagChip/FieldCard 통합)
- Home의 KIYO 로고 + eyebrow는 Plan-G2 범위 밖 (eyebrow 흡수 안 함, Q2 결정)

---

# Current State (2026-09-01 인스펙션)

## 1. 인라인 PageShell (13곳) — 동일 className 변종

**PageShell className** (`min-h-svh bg-[var(--color-bg)] px-5 py-8 [pb-28]`):

| # | 파일 | 라인 | element | max-width | pb-28 | 비고 |
|---|---|---|---|---|---|---|
| 1 | `Home.tsx` | 108 | `<main>` | max-w-3xl | - | KIYO 로고 + 시작 카드 |
| 2 | `Auth.tsx` | 150 | `<main>` | (없음) | - | PIN 인증 |
| 3 | `AutofillTestLogin.tsx` | 16 | `<main>` | (없음) | - | autofill 테스트 |
| 4 | `Accounts/index.tsx` | 127 | `<section>` | max-w-4xl | - | loading state (분기 1) |
| 5 | `Accounts/index.tsx` | 159 | `<section>` | max-w-4xl | - | main render (분기 2) |
| 6 | `AccountDetail.tsx` | 54 | `<section>` | (없음) | - | not-found 분기 |
| 7 | `AccountDetail.tsx` | 95 | `<section>` | (없음) | - | main render |
| 8 | `AccountEdit/index.tsx` | 242 | `<section>` | (없음) | - | main render |
| 9 | `Templates/index.tsx` | 31 | `<main>` | max-w-3xl | pb-28 | loading state |
| 10 | `Templates/index.tsx` | 48 | `<main>` | max-w-3xl | pb-28 | main render |
| 11 | `TemplateEdit/index.tsx` | 177 | `<main>` | max-w-3xl | pb-28 | main render |
| 12 | `Settings/index.tsx` | 29 | `<main>` | max-w-3xl | pb-28 | main render |
| 13 | `CreateVault/index.tsx` | 80 | `<main>` | max-w-2xl | - | Stepper + Step |

**불일치 사항**:
- `<main>` (8곳) vs `<section>` (5곳) — Q5=(a) 결정으로 `<main>` 통일
- `max-w-{2xl|3xl|4xl}` 변종 3개 — Q4=(c) 결정으로 페이지별 `maxWidth` prop
- `pb-28` 유무 — BottomTabs가 있는 페이지에만 의미, prop으로 명시

## 2. 인라인 PageHeader (5곳) — 동일 className 변종

**PageHeader className** (`<header>` + `<h1 className="text-3xl font-semibold text-[var(--color-text-h)]">` + 우측 actions):

| # | 파일 | 라인 | title | actions | 비고 |
|---|---|---|---|---|---|
| 1 | `Settings/index.tsx` | 32 | "Settings" | (없음) | 단일 h1 |
| 2 | `Templates/index.tsx` | 51 | "템플릿 관리" | `<Button>+ 템플릿 생성</Button>` | h1 + action |
| 3 | `TemplateEdit/index.tsx` | 180 | "템플릿 수정" / "새 템플릿" | 3 buttons (삭제/취소/저장) | h1 + 3 actions |
| 4 | `AccountEdit/index.tsx` | 244 | "새 계정" / "계정 수정" | 2 buttons (취소/저장) | h1 + 2 actions |
| 5 | `Home.tsx` | 110-122 | "KIYO" | (없음) | eyebrow + h1 (Plan-G2 범위 밖) |

**불일치 사항**:
- title 형식: 단일 string (4곳) vs 동적 string (TemplateEdit/AccountEdit)
- actions: 0~3 buttons 자유 — Q3=(c) 결정으로 자유 슬롯

---

# Relevant Files

| 파일 | 역할 | 변경 |
|---|---|---|
| `src/components/PageShell.tsx` (신규) | 페이지 셸 wrapper (`<main>` + 컨테이너) | 신규 |
| `src/components/PageHeader.tsx` (신규) | 페이지 헤더 wrapper (`<header>` + `<h1>` + actions) | 신규 |
| `src/components/PageShell.test.tsx` (신규) | 단위 테스트 5 케이스 | 신규 |
| `src/components/PageHeader.test.tsx` (신규) | 단위 테스트 5 케이스 | 신규 |
| 13 페이지 파일 | 페이지 셸 마이그레이션 | 마이그레이션 |
| 4 페이지 파일 (Header) | 페이지 헤더 마이그레이션 (Home은 Plan-G2 범위 밖) | 마이그레이션 |

---

# Architecture

```
<PageShell maxWidth="md" withBottomTabs>
  <PageHeader title="Settings" />  // optional
  {/* 본문 */}
</PageShell>
```

**PageShell**:
```tsx
interface PageShellProps {
  children: ReactNode;
  maxWidth?: "md" | "lg" | "xl";  // default 없음 — 호출처 명시
  withBottomTabs?: boolean;  // pb-28 분기
}
```

- 기본: `<main className="min-h-svh bg-[var(--color-bg)] px-5 py-8 [pb-28]">`
- `maxWidth` 매핑 → `max-w-2xl` / `max-w-3xl` / `max-w-4xl`
- `withBottomTabs={true}` → `pb-28` 추가

**PageHeader**:
```tsx
interface PageHeaderProps {
  title: string;  // 동적 string (TemplateEdit: isEdit ? "템플릿 수정" : "새 템플릿")
  actions?: ReactNode;  // optional, 우측 슬롯
}
```

- 기본: `<header className="flex items-center justify-between gap-3"><h1>...</h1>{actions}</header>`
- Home의 eyebrow/h1/title 패턴은 Plan-G2 범위 밖 — Home.tsx는 PageHeader 미사용 (PageShell만 사용)

---

# Proposed Changes

## 신규 컴포넌트

### 1. `src/components/PageShell.tsx` (신규)

```tsx
import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  /** "md" → max-w-2xl, "lg" → max-w-3xl, "xl" → max-w-4xl. 명시 권장. */
  maxWidth?: "md" | "lg" | "xl";
  /** BottomTabs가 있는 페이지는 true (pb-28 추가). */
  withBottomTabs?: boolean;
}

const MAX_WIDTH_MAP = {
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
} as const;

/**
 * Plan-G2: 페이지 셸 wrapper.
 *
 * 기존 13 호출처가 동일하게 사용하던 className을 단일 컴포넌트로 흡수:
 *   <main|section> min-h-svh bg-[var(--color-bg)] px-5 py-8 [pb-28]
 *   <div className="mx-auto flex w-full max-w-{N} flex-col gap-6">...</div>
 *
 * 결정 사항:
 * - Q5: <main> 통일 (AccountList/Detail/Edit의 <section> → <main>)
 * - Q4: max-width 페이지별 prop (디자인 의도 보존)
 * - withBottomTabs: pb-28 명시화 (BottomTabs가 있는 페이지만)
 */
export function PageShell({ children, maxWidth, withBottomTabs }: PageShellProps) {
  const maxWidthClass = maxWidth ? MAX_WIDTH_MAP[maxWidth] : "";
  return (
    <main
      className={`min-h-svh bg-[var(--color-bg)] px-5 py-8${
        withBottomTabs ? " pb-28" : ""
      }`}
    >
      <div
        className={`mx-auto flex w-full flex-col gap-6${
          maxWidthClass ? ` ${maxWidthClass}` : ""
        }`}
      >
        {children}
      </div>
    </main>
  );
}

export default PageShell;
```

### 2. `src/components/PageHeader.tsx` (신규)

```tsx
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
}

/**
 * Plan-G2: 페이지 헤더 wrapper.
 *
 * 기존 5 호출처가 동일하게 사용하던 className:
 *   <header className="flex items-center justify-between gap-3">
 *     <h1 className="text-3xl font-semibold text-[var(--color-text-h)]">{title}</h1>
 *     {actions}
 *   </header>
 *
 * 결정 사항:
 * - Q2: eyebrow 슬롯 없음 (Home의 KIYO 로고+eyebrow는 예외로 흡수 안 함)
 * - Q3: actions 자유 슬롯 (0~3 buttons 흡수 가능)
 */
export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <h1 className="text-3xl font-semibold text-[var(--color-text-h)]">{title}</h1>
      {actions}
    </header>
  );
}

export default PageHeader;
```

## 호출처 마이그레이션

### 3-15. 13개 페이지 셸 마이그레이션

**공통 패턴**:
```tsx
// Before (AccountList 예시)
<section className="min-h-svh bg-[var(--color-bg)] px-5 py-8">
  <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
    {/* 본문 */}
  </div>
</section>

// After
<PageShell maxWidth="xl">
  {/* 본문 */}
</PageShell>
```

| 파일 | 변경 |
|---|---|
| `Home.tsx` | `<main>` + `max-w-3xl` → `<PageShell maxWidth="lg">` (eyebrow/h1 내부 인라인 유지) |
| `Auth.tsx` | `<main>` (max-width 없음) → `<PageShell>` (maxWidth 명시 안 함) |
| `AutofillTestLogin.tsx` | `<main>` (max-width 없음) → `<PageShell>` |
| `Accounts/index.tsx` | `<section>` + `max-w-4xl` (2 return) → `<PageShell maxWidth="xl" withBottomTabs>` (loading state + main render 양쪽) |
| `AccountDetail.tsx` | `<section>` (2 return) → `<PageShell>` (maxWidth 명시 안 함) |
| `AccountEdit/index.tsx` | `<section>` → `<PageShell>` |
| `Templates/index.tsx` | `<main>` + `max-w-3xl` + `pb-28` (2 return) → `<PageShell maxWidth="lg" withBottomTabs>` |
| `TemplateEdit/index.tsx` | `<main>` + `max-w-3xl` + `pb-28` → `<PageShell maxWidth="lg" withBottomTabs>` |
| `Settings/index.tsx` | `<main>` + `max-w-3xl` + `pb-28` → `<PageShell maxWidth="lg" withBottomTabs>` (Plan-G1과 결합) |
| `CreateVault/index.tsx` | `<main>` + `max-w-2xl` → `<PageShell maxWidth="md">` |

**예외 처리**:
- **Home.tsx**: `<PageShell maxWidth="lg">`만 도입 (eyebrow/h1 자체는 인라인 유지 — Plan-G2 범위 밖)
- **CreateVault/index.tsx**: 단일 return (loading 분기 없음) — 마이그레이션 단순
- **AccountDetail.tsx**: 2 return (not-found 분기 + main render) — 양쪽 모두 PageShell로

### 16-19. 4개 페이지 헤더 마이그레이션 (Home 제외)

| 파일 | 변경 |
|---|---|
| `Settings/index.tsx` | `<header><h1>Settings</h1></header>` → `<PageHeader title="Settings" />` |
| `Templates/index.tsx` | `<header><h1>템플릿 관리</h1><Button .../></header>` → `<PageHeader title="템플릿 관리" actions={<Button .../>} />` |
| `TemplateEdit/index.tsx` | 3 actions + 동적 title → `<PageHeader title={isEdit ? "템플릿 수정" : "새 템플릿"} actions={<><Button .../>...</>} />` |
| `AccountEdit/index.tsx` | 2 actions + 동적 title → `<PageHeader title={isNew ? "새 계정" : "계정 수정"} actions={<><Button .../><Button .../></>} />` |

## 신규 단위 테스트

### 20. `src/components/PageShell.test.tsx` (신규) — 5 케이스

1. ① `<main>` 렌더 (Q5 landmark 통일 회귀 가드)
2. ② `maxWidth="lg"` → `max-w-3xl` className
3. ③ `maxWidth="xl"` → `max-w-4xl` className
4. ④ `withBottomTabs` → `pb-28` className
5. ⑤ children 렌더

### 21. `src/components/PageHeader.test.tsx` (신규) — 5 케이스

1. ① `<header>` + `<h1>` 렌더
2. ② `title` prop → `<h1>` 텍스트
3. ③ `actions` optional — 미전달 시 actions 영역 미렌더
5. ④ `actions` ReactNode — 우측 슬롯 렌더
6. ⑤ header className 보존

---

# Tests

## 신규 (Plan-G2 범위)

| 테스트 파일 | 케이스 |
|---|---|
| `src/components/PageShell.test.tsx` | 5 케이스 |
| `src/components/PageHeader.test.tsx` | 5 케이스 |

## 기존 회귀

- **단위 테스트**: `npm run test` — 모든 기존 + 신규 통과
- **TypeScript**: `npm run typecheck` — wrapper 신규 타입 + 호출처 마이그레이션 후 회귀 0
- **ESLint**: `npm run lint` — 우리 변경 파일 에러 0
- **빌드**: `npm run build` — 통과
- **Android 단위**: `compileDebugKotlin` + `testDebugUnitTest` — 본 plan은 React 측 한정, Android 영향 0
- **Playwright E2E**: 회귀 0 (사용자 직접 실행)

---

# Risks

| 리스크 | 완화 |
|---|---|
| `<main>` 통일 시 AccountList/Detail/Edit의 `<section>` → `<main>` 변경 | `<section>` → `<main>`은 landmark 표준화. 외부 selector 영향 확인 — grep 결과 기존 selector는 본문에서 매칭, 셸은 영향 없음 |
| `max-w-3xl → 2xl` 등 강제 통일 시 시각 회귀 | Q4=(c) 결정으로 페이지별 prop, 의도 보존. 강제 통일 0 |
| `pb-28` 누락 시 BottomTabs 가림 | `withBottomTabs={true}` prop으로 명시, 마이그레이션 시 13 파일 직접 검토 |
| `withBottomTabs` 누락 — Templates/Settings/Templates는 필수, 나머지 0 | 인스펙션 결과 기반 매핑표 (위 13개 표). 정확히 4 페이지에만 `withBottomTabs` 적용 |
| Home의 eyebrow 흡수 안 함 (Q2 결정) | 의도적. Home은 별도 디자인 패턴 (KIYO 로고 + "Start" eyebrow + "KIYO" h1). wrapper로 강제 시 디자인 손상 |
| 단일 PR + 13 페이지 동시 마이그레이션 | 13 파일은 단일 PR 관리 가능 (Plan-F1 25 호출처 단일 PR 패턴 일관). 단, AccountDetail/Edit의 `<section>` → `<main>` 변경은 landmark 회귀 가능 — 신중히 |
| PageShell/PageHeader 의존: SettingsSection (Plan-G1) | Plan-G1이 머지된 상태 (PR #58) — 의존성 해소 |
| 새 페이지 추가 시 PageShell/PageHeader 미사용 | code review 시 안내. 자동 강제 불가 (정적 분석 한계) |

---

# Rollback

- 신규 파일 4개 (PageShell/PageHeader + 테스트 2)
- 호출처 13 페이지 파일 + 헤더 4 페이지 파일 = 17 파일 마이그레이션
- Rollback: 신규 파일 삭제 + 호출처 17 파일 `git revert` (단일 PR revert)
- RiskProfile: 낮음 — wrapper 추가는 호출처 동작 변경 0, 시각 변경 0 (className 1:1 매핑)

---

# Cross-Plan Integration

## Upstream

- **Plan-G1** (SettingsSection/SettingsRow): 머지 완료 (PR #58). PageShell/SettingsSection 결합 시 Settings 페이지 자연스럽게 통합
- **Plan-F1** (Input): 머지 완료. PageShell과 무관
- **Plan-B** (Button): 머지 완료. PageHeader actions 슬롯이 Button 사용

## Downstream

- **Plan-G3** (tracking 토큰화): PageShell/PageHeader className의 tracking 토큰 사용 가능 — G3와 독립 진행
- **Plan-G4** (PasswordField): PageShell 영향 없음 (Accounts/* 페이지 내부 컴포넌트)
- **Plan-G5** (TagChip/FieldCard): PageShell 영향 없음

---

# Verification Checklist

- [ ] `src/components/PageShell.tsx` 신규 작성
- [ ] `src/components/PageHeader.tsx` 신규 작성
- [ ] `src/components/PageShell.test.tsx` 신규 작성 — 5 케이스
- [ ] `src/components/PageHeader.test.tsx` 신규 작성 — 5 케이스
- [ ] 13 페이지 셸 마이그레이션 (Home/Auth/AutofillTestLogin/Accounts/index(×2)/AccountDetail(×2)/AccountEdit/Templates/index(×2)/TemplateEdit/Settings/CreateVault)
- [ ] 4 페이지 헤더 마이그레이션 (Settings/Templates/TemplateEdit/AccountEdit — Home 제외)
- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` (우리 변경 파일 에러 0) 통과
- [ ] `npm run test` 통과 (신규 단위 테스트 10개 포함)
- [ ] `npm run build` 통과
- [ ] Android compile+unitTest 통과
- [ ] git commit + push + PR 개설 (dev base)

---

# Output

1. **Plan 파일 경로**: `docs/plans/2026-09-01-plan-g2-page-shell-header.md` (본 문서)
2. **변경 파일**: 17 (신규 4 + 마이그레이션 13)
3. **테스트 추가**: 10개 단위 테스트
4. **주요 리스크**: `<main>` 통일 시 landmark 회귀 (마이그레이션 시 신중)
5. **구현 가능 여부**: ✅ 가능