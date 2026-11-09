# Brainstorm — 컴포넌트 통일 패턴 (Track 3 §3 후속)

- Date: 2026-09-01
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- Source: STRATEGY §3 (Track 3 UX·접근성·인터랙션 품질) — Plan-B/Plan-E/Plan-F1 후속
- Status: Brainstorm (no code changed)
- Scope: **레이아웃 패턴**(페이지 셸 / 헤더 / Settings 행) + **비밀번호 액션 묶음** + **Tag/Field 카드** 의 공통 컴포넌트화 후보를 다룬다. **입력/폼 자체는 Plan-F1 완료, 보안·암호화·자동잠금은 §4 범위.**

---

## 1. Problem

Track 3의 Plan-A1/A2/Plan-B 3-PR/Plan-E/Plan-F1이 Button/Input/Spinner/ErrorMessage를 잘 통일시켰으나, **레이아웃/반복 행 패턴**은 여전히 인라인 복붙이 다수 남아 있다. 이번 분석에서 발견한 구체적 중복은 4개 영역:

1. **페이지 셸 (`min-h-svh bg-[var(--color-bg)] px-5 py-8 [pb-28]`)** — 13곳
2. **페이지 헤더 (`<header><h1>` + 우측 액션 버튼)** — 11곳
3. **Settings 행 (`flex items-center justify-between ... rounded-2xl border ...`)** — 14곳 (4개 섹션 + Settings + Home)
4. **비밀번호 보기/숨기기 + 복사 버튼 묶음** — 2곳 (PasswordFieldView/Edit)

각각을 인라인으로 두면:

- **시각 일관성 깨짐**: 같은 역할인데 `max-w-{2xl|3xl|4xl}`, `pb-28` 유무, `<main>` vs `<section>` 등이 페이지마다 다름
- **BottomTabs 정보 은닉**: `pb-28`은 BottomTabs 있는 페이지에만 필요 — 표현 의도가 코드에 없음
- **수정 비용 누적**: 디자인 토큰(예: row padding) 변경 시 14곳 모두 손대야 함
- **a11y 결함 가능성**: Settings 4개 섹션 헤더(`<h3 text-sm uppercase tracking-[0.18em]>`)는 정확히 같은 className 복붙 4건

> **STRATEGY §3의 "공통 디자인 시스템 / 재사용 가능한 컴포넌트" 항목과 직접 연결.** Plan-B가 Button을, Plan-F1이 Input을, 이번 brainstorm이 **레이아웃 패턴**을 다룬다.

## 2. Goal

1. **레이아웃 공통 컴포넌트 후보 식별** — PageShell / PageHeader / SettingsSection+SettingsRow
2. **호출처 영향 범위 정확 매핑** — 각 후보마다 실제 적용될 파일/라인 카운트
3. **ROI 우선순위** — 임팩트(중복 제거량) vs 부담(변경 파일 수) 매트릭스
4. **Plan-F2 후속 위치 결정** — Plan-F1(Input 통일)의 F2 분할 패턴과 일관
5. **Open Questions 식별** — 사용자 결정이 필요한 항목만

## 3. Context

### 3.1 인스펙션한 파일/모듈

| 페이지/섹션 | 파일 | PageShell | PageHeader | SettingsRow | PasswordField |
|---|---|---|---|---|---|
| Home | `src/pages/Home.tsx` | ✓ | ✓ | (Files 목록) | — |
| Auth | `src/pages/Auth.tsx` | ✓ | — | — | — |
| Accounts 리스트 | `src/pages/Accounts/index.tsx` | ✓ | ✓ (eyebrow+h2) | — | (Card 우측) |
| Account 상세 | `src/pages/Accounts/AccountDetail.tsx` | ✓ | ✓ (뒤로+수정/삭제) | — | ✓ (PasswordFieldView) |
| Account 편집 | `src/pages/Accounts/AccountEdit/index.tsx` | ✓ | ✓ (취소/저장) | — | (PasswordFieldEdit) |
| Templates 리스트 | `src/pages/Templates/index.tsx` | ✓ | ✓ | — | — |
| Template 편집 | `src/pages/Templates/TemplateEdit/index.tsx` | ✓ | ✓ | — | — |
| Settings | `src/pages/Settings/index.tsx` | ✓ | ✓ | ✓ (2) | — |
| Settings 섹션 | `SecuritySection.tsx` / `UISection.tsx` / `DataSection.tsx` / `AutofillSection.tsx` | — | — | ✓ (4/2/3/4 = 13) | — |
| CreateVault | `src/pages/CreateVault/index.tsx` | ✓ | ✓ (뒤로+Stepper) | — | — |
| AutofillTestLogin | `src/pages/AutofillTestLogin.tsx` | ✓ | — | — | — |

### 3.2 인라인 패턴 발견 통계

`rg` 명령으로 추출한 정확한 인스턴스 수:

| 패턴 | 인스턴스 | 위치 |
|---|---|---|
| `min-h-svh bg-[var(--color-bg)] px-5 py-8` | **13** | Home/Auth/Accounts(×2)/AccountDetail(×2)/AccountEdit/Templates(×2)/TemplateEdit/AutofillTestLogin/CreateVault/Settings |
| `flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4` | **14** | Settings(2) + SecuritySection(3) + UISection(2) + DataSection(3) + AutofillSection(4) |
| `<h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">` | **4** | SecuritySection/UI/Data/Autofill |
| `<h1 className="text-3xl font-semibold text-[var(--color-text-h)]">` (또는 h2 변형) | **8** | Templates(×2)/TemplateEdit/Settings/CreateVault/AccountEdit + AccountList eyebrow+title |
| `rounded-full bg-[var(--color-accent-bg)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)]` | **2** | AccountList tag filter / PasswordFieldView 복사 버튼 |
| `tracking-[0.0Xem]` 변종 | 4종 (`0.08`/`0.16`/`0.18`/`0.24`) | 26+ 파일 |
| `max-w-{2xl\|3xl\|4xl}` 변종 | 3종 | Home(3xl)/Templates(3xl)/Settings(3xl)/CreateVault(2xl)/AccountList(4xl) |

### 3.3 기존 컴포넌트 재사용 자산

- **Button** (Plan-B): 4 variants × 3 sizes, `loading`/`disabled`/`aria-busy` 일관 처리
- **Input** (Plan-F1): 3 sizes × 4 variants × 3 `as` (input/select/textarea), `aria-invalid`/`describedby`/`readonly`/`disabled` 기본 내장
- **Spinner** (Plan-A2): size + `aria-hidden` + `label`
- **ErrorMessage** (Plan-E): 단일/배열 에러 흡수, `var(--color-error)` 토큰 통일
- **ConfirmDialog / FormDialog / BaseDialog** (Plan-B-1)
- **PinStrengthMeter** (Plan-4)
- **AutoLockIndicator** (a11y 모범 사례)

### 3.4 STRATEGY ↔ 코드 매칭 (ce-brainstorm 규칙)

| 항목 | 표면 증거 | 실제 동작 | 진짜 상태 |
|---|---|---|---|
| 페이지 셸 일관성 | 동일 className 13곳 | `<main>` vs `<section>` vs `<div>` 혼용, `pb-28`/`max-w-{2xl|3xl|4xl}` 변종 | ❌ 미통일 |
| Settings 행 일관성 | 동일 className 14곳 | `<h3>` 섹션 헤더도 동일 className 4건 복붙 | ❌ 미통일 |
| 비밀번호 보기/숨기기 | `PasswordFieldView` / `PasswordFieldEdit` 분리 | 액션 모음(Eye 토글 + 복사) 중복, EYE_OPEN/CLOSED_SVG import도 양쪽 | ⚠️ 부분 분리 (Plan-F1 이후 개선 여지) |
| 페이지 헤더 | 인라인 `<header>` 8+곳 | `<h1>` vs `<h2>`, eyebrow 유무, justify-between 유무 변종 | ⚠️ 부분 통일 |

## 4. Constraints

- **cryptoKey lifecycle**: UI 변경이 메모리 키에 영향 없음 (레이아웃 컴포넌트는 무관)
- **자동잠금/세션 만료**: `BottomTabs`가 있는 페이지/없는 페이지 구분은 의미 있는 정보로 보존
- **React 19 + TS strict**: 타입 안전성 필수
- **Tailwind 4 + Ionic**: 기존 토큰(`var(--color-*)`) 유지
- **Capacitor 8**: webview 내 UI 변경은 native 영향 없음
- **Playwright E2E**: 기존 셀렉터(`data-testid`, `placeholder`, `getByText`, `getByRole`) 호환 필수
- **Plan-E의 "한 가지 길" 원칙**: 기존 컴포넌트와 동등한 명확한 사용 패턴
- **i18n 향후**: 모든 사용자 문구 prop/key로 분리

## 5. Existing Architecture (요약)

```
[App]
 ├─ BrowserRouter (10+1 라우트)
 │   └─ 각 Page:
 │        ├─ <main|section> min-h-svh bg-[var(--color-bg)] px-5 py-8 [pb-28]   ← PageShell 후보
 │        │   └─ <div mx-auto max-w-{N}>                                        ← 컨테이너
 │        │        ├─ <header> <h1|h2> ... </header>                            ← PageHeader 후보
 │        │        ├─ <section> ... SettingsSection+SettingsRow 후보
 │        │        └─ <article|section> 본문
 │        └─ [<BottomTabs />, <ConfirmDialog /> 등]
 │
 ├─ Settings (4 sections, 모두 동일 row 패턴):
 │        ├─ <h3 mb-3 text-sm uppercase tracking-[0.18em]> 섹션명
 │        └─ <div flex justify-between ... rounded-2xl border ...> 행
 │             ├─ <span> 라벨
 │             └─ [<Button> | <Input as="select"> | 커스텀 토글]
```

```
[PasswordFieldView]   ← AccountDetail (View 모드, read-only 표시 + 복사)
[PasswordFieldEdit]   ← AccountEdit/FieldEditor (Edit 모드, input + 생성)
    공통: EyeOpen/EyeClosed 토글
    View 만: 복사
    Edit 만: 비밀번호 생성(GENERATE_SVG)
```

## 6. Relevant Previous Knowledge

| 문서 | 내용 |
|---|---|
| STRATEGY §3 Track 3 | 8개 plan 완료 + Plan-D PR 1 완료. 본 brainstorm은 **Track 3 §3의 후속 디자인 시스템 통합** 단계 |
| `docs/brainstorms/2026-08-30-track3-ux-accessibility.md` | §11 리스크표 "Plan-B-3 시작 시 inline `<button>` 잔존 범위 정확히 파악 필요" — 본 brainstorm의 "패턴 정확히 파악" 패턴 일관 |
| `docs/brainstorms/2026-09-01-input-form-design-system.md` | **Plan-F1/F2 분할 결정**(F1=Input/Select/Textarea/Checkbox, F2=Search/slider/rightSlot 등 특수 input). 본 brainstorm은 F2와 다른 차원(F2 = 입력 변종, 본 brainstorm = 레이아웃/행) — 별도 plan으로 진행 |
| `docs/plans/2026-09-01-plan-e-accountedit-templateedit-unification.md` | "범위 확정" + "한 가지 길" 원칙. 헤더/에러 통일 + 색상 토큰 sed. 본 brainstorm은 Plan-E의 "헤더 통일감을 다른 페이지로 확장" 후보 |
| `docs/plans/2026-09-01-plan-f1-input-form-design-system.md` | Plan-F1 완료. 단일 PR + 25 호출처 마이그레이션 패턴. 본 brainstorm도 동일 패턴 적용 가능 |
| Plan-B brainstorm | Button 통일 3-PR 분할 패턴(Plan-B-1 인프라 → Plan-B-2 자주 → Plan-B-3 나머지). 본 brainstorm도 적용 가능 여지 |
| Plan-A brainstorm | A1/A2 분리 패턴(A1=전제, A2=독립). 본 brainstorm의 후보들도 의존성 관계로 분리 가능 |
| Track 3 §8.2 권장 분할 | a11y 별도 plan, Plan-D PR 2 보류, Plan-7b 후속 — 본 brainstorm은 §3 디자인 시스템 통합의 Plan-F2와 다른 슬롯 |

## 7. Options (후보 식별 + 비교)

### Option A. PageShell 도입

**목적**: 13곳 페이지 셸 일관화

```tsx
<PageShell maxWidth="md" withBottomTabs>
  ...
</PageShell>
```

| 항목 | 평가 |
|---|---|
| 적용 파일 | 11개 (페이지 + Settings/CreateVault/TemplateEdit/AccountEdit/Home/Accounts/AccountDetail/Templates/Auth/AutofillTestLogin) |
| 임팩트 | 🟡 중간 — `<main>` vs `<section>` 의미론 결정 필요, `pb-28` 명시화, `max-w` 표준화 |
| 부담 | 🟡 중간 — 컨테이너 의미론 통일, `BottomTabs` prop 추가 |
| E2E 영향 | 낮음 — 셀렉터는 본문에서 매칭 |
| 의존성 | 없음 (독립) |

### Option B. PageHeader 도입

**목적**: 11곳 페이지 헤더 일관화

```tsx
<PageHeader
  eyebrow="Accounts"
  title="My accounts"
  fileName={fileName}
  actions={<><Button .../><Button .../></>}
/>
```

| 항목 | 평가 |
|---|---|
| 적용 파일 | 8개 (Home/Templates/TemplatesEdit/Settings/CreateVault/AccountEdit/AccountDetail/Accounts) |
| 임팩트 | 🟢 높음 — `<h1>` vs `<h2>` 통일 + eyebrow 슬롯 + fileName 슬롯 + actions 슬롯 |
| 부담 | 🟢 낮음 — 단일 wrapper |
| E2E 영향 | 중간 — `getByRole('heading')` 사용 시 영향 가능, data-testid 없음 |
| 의존성 | Option A와 결합하면 좋음 (둘 다 셸 패턴) |

### Option C. SettingsSection + SettingsRow 도입

**목적**: 4개 Settings 섹션의 14개 행 통일 + 섹션 헤더 일관화

```tsx
<SettingsSection title="Security">
  <SettingsRow label="PIN">
    <Button variant="primary" onClick={...} label={...} />
  </SettingsRow>
  <SettingsRow label="자동잠금">
    <Input as="select" .../>
  </SettingsRow>
</SettingsSection>
```

| 항목 | 평가 |
|---|---|
| 적용 파일 | 4개 섹션 (SecuritySection/UI/Data/AutofillSection) + Settings/index.tsx (자체 2 row) |
| 임팩트 | 🟢 높음 — 14 row + 4 section header 인라인 → wrapper 1~2개로 흡수 |
| 부담 | 🟢 낮음 — 단순 wrapper + children 슬롯 |
| E2E 영향 | 낮음 — data-testid/text 유지 |
| 의존성 | 없음 (독립, Option A/B와 무관) |

### Option D. PasswordField 묶음 (PasswordFieldActions 추출)

**목적**: View/Edit 양쪽의 Eye 토글 + 복사/생성 액션 묶음

```tsx
// PasswordFieldActions (View 모드, 값 표시 + 복사)
<PasswordFieldActions
  value={field.value}
  mode="view"
  onCopy={copy}
/>

// PasswordFieldEdit (input + Eye + 생성)
<PasswordFieldEdit
  value={field.value}
  onChange={...}
  onGenerate={...}
/>
```

| 항목 | 평가 |
|---|---|
| 적용 파일 | PasswordFieldView, PasswordFieldEdit (각 1개씩) |
| 임팩트 | 🟡 중간 — 내부 액션 모음 통일, but Edit은 input+actions라 분리 어려움 |
| 부담 | 🟢 낮음 — 단순 추출 |
| E2E 영향 | 낮음 |
| 의존성 | Plan-F1의 Input 일관성 확인 필요 |

### Option E. TagChip 통일 (chip vs toggle 통합)

**목적**: AccountDetail의 tag 표시 chip + AccountList의 tag 필터 toggle button을 단일 컴포넌트로

```tsx
<TagChip selected={isSelected} onToggle={...} label={tag} />
// or
<TagChip label={tag} /> // display only
```

| 항목 | 평가 |
|---|---|
| 적용 파일 | AccountDetail(1) + AccountList(1) + PasswordFieldView(복사 버튼과 유사) |
| 임팩트 | 🟡 중간 — 두 곳에서 사용 패턴 다름(단순 표시 vs 선택 토글), 일관성 가치 ↓ |
| 부담 | 🟢 낮음 |
| E2E 영향 | 중간 — AccountList의 tag 필터는 정렬·다중선택·AND 검색과 결합 |
| 의존성 | 없음 |

### Option F. tracking-[0.0Xem] 토큰화

**목적**: 4종 tracking 값을 디자인 토큰화 (`tracking-eyebrow` / `tracking-section` / `tracking-chip` / `tracking-meta`)

| 항목 | 평가 |
|---|---|
| 적용 파일 | 26+ 파일 |
| 임팩트 | 🟡 중간 — 디자인 의도 명시화, sed로 일괄 교체 가능 |
| 부담 | 🟡 중간 — tailwind theme 수정 + sed |
| E2E 영향 | 낮음 |
| 의존성 | 없음, 단독 진행 가능 |

### Option G. FieldCard 통일 (AccountDetail의 필드 카드 + TemplateFieldEditor의 필드 컨테이너)

**목적**: read-only / editable 두 variant로 통합

| 항목 | 평가 |
|---|---|
| 적용 파일 | AccountDetail(1 호출 × N 필드) + TemplateFieldEditor(1) |
| 임팩트 | 🟡 중간 — 비슷한 모양 통합 |
| 부담 | 🟡 중간 — 컨테이너 사이즈/패딩 통일 결정 필요 |
| E2E 영향 | 중간 |
| 의존성 | Plan-F1 Input과의 경계 명확화 필요 |

## 8. Recommended Direction (사용자 결정 전)

> §7 Option 중 **임팩트/부담 비율이 가장 좋은 것은 C (SettingsSection+SettingsRow)**. 가장 영향 범위가 큰 것은 **B (PageHeader)**. 가장 단순한 것은 **F (tracking 토큰화)**.

**권장 우선순위 (사용자 확정 전 가설)**:

1. **Plan-G1 (1순위)**: SettingsSection + SettingsRow 도입 — Option C. 4개 섹션 + Settings 자체 row 14개를 wrapper로 흡수. 임팩트/부담 최적
2. **Plan-G2 (2순위)**: PageHeader 도입 — Option B. 11곳 페이지 헤더 통일. Option A와 결합 가능
3. **Plan-G3 (3순위)**: tracking 토큰화 — Option F. 디자인 의도 명시화, sed 일괄
4. **Plan-G4 (후속)**: PasswordField 묶음, TagChip 통일, FieldCard 통합 — 개별 결정

**분기 옵션**:
- (a) **G1~G4 모두 별도 plan** — Plan-F1/F2 분할 패턴과 일관, 각 plan 검증된 패턴으로 만들기 좋음
- (b) **G1+G2 단일 PR** — 둘 다 layout wrapper, 결합도 높음
- (c) **G1+G2+G3 단일 PR** — 디자인 시스템 통일 일괄

> **사용자 결정 필요**: (a/b/c) 분기 + G 우선순위 + tracking 토큰화 정책(8종 의미 정의 필요)

## 9. Plan 분할 + Open Questions (Q-table)

### Plan-G1 확정 (Q1/Q6/Q7/Q8/Q12/Q13 모두 결정)

| Q | 질문 | 옵션 | 권장 | 상태 |
|---|---|---|---|---|
| Q1 | 첫 plan 범위 | (a) SettingsSection+SettingsRow만 (b) PageHeader만 (c) 둘 다 (d) 셋 다 + tracking | **(a) SettingsSection+SettingsRow** | ✅ 확정 (2026-09-01) — 14 row 임팩트, wrapper 2개로 흡수, Plan-F1 패턴 일관 |
| Q6 | SettingsSection의 title 위치 | (a) h3 (현재) (b) h2 (위계 정정) (c) 페이지 prop | **(b) h2로 위계 정정** | ✅ 확정 (2026-09-01) — `Settings/index.tsx`가 `<h1>Settings</h1>` 단일, TemplateEdit은 `<h1> + <h2> + <h2>` 패턴 이미 적용. Settings도 `<h1>Settings</h1> + <h2>Security/UI/Data/Autofill</h2>`로 일관 |
| Q7 | SettingsRow의 layout 자유도 | (a) label + children (단일 children 슬롯) (b) label + left + right (c) 자유 (children + asChild) | **(a) label + children (ReactNode)** | ✅ 확정 (2026-09-01) — 12/14 호출처 단일 children, 2/14 AutofillSection은 label에 보조 텍스트 — label을 ReactNode로 흡수. Plan-F1 Input API 일관 |
| Q8 | SettingsRow의 disabled 상태 표현 | (a) children에 위임 (b) row 자체가 disabled prop (c) opacity + pointer-events-none | **(a) children에 위임** | ✅ 확정 (2026-09-01) — Input의 `variant="disabled"` / Button의 `disabled` prop이 이미 Plan-F1/Plan-B로 흡수됨, wrapper는 컨테이너 역할만. 철학 일관 |
| Q12 | 마이그레이션 전략 | (a) 단일 PR (b) plan별 PR (c) wrapper만 먼저 → 점진적 호출처 마이그레이션 | **(a) 단일 PR (wrapper 2개 + 6 파일 동시)** | ✅ 확정 (2026-09-01) — 6 파일은 단일 PR 관리 가능, Plan-F1 패턴 일관, Plan-B 3-PR은 21개 inline button의 변경 폭 때문이었음 |
| Q13 | PR 분할 패턴 (= Q12와 중복) | (a) Plan-F1처럼 단일 PR (b) Plan-B처럼 3-PR 분할 | **(a) Plan-F1 단일 PR** | ✅ 종결 (Q12 결정으로) |
| Q-신규 | 회귀 게이트 | (a) 신규 단위 테스트 + 기존 E2E (b) 기존 E2E만 (c) wrapper 스냅샷 테스트 | **(a) 신규 단위 테스트 + 기존 E2E** | ✅ 확정 (2026-09-01) — Plan-F1/Plan-B 패턴 일관. `SettingsSection.test.tsx` (title/h2/children) + `SettingsRow.test.tsx` (label string/ReactNode/children 컨테이너). Playwright React E2E 회귀 |

### Plan-G2~G5 (Plan-G1과 동일 패턴, 사용자 답변 없는 권장안 기본값 채택)

| Plan | Q | 결정 | 근거 |
|---|---|---|---|
| **G2** (PageShell + PageHeader) | Q2 eyebrow | **(c) 없음** — title만. eyebrow는 Home KIYO 로고에서만 사용, 페이지 헤더로는 흡수 안 함 | 단순화, Plan-G1 SettingsSection의 `<h2>` 단일 패턴 일관 |
| **G2** | Q3 actions 슬롯 | **(c) 자유** — `title` + `actions: ReactNode` + optional `fileName: string` | 11 호출처 중 8개가 우측 actions 보유, 자유 prop이 패턴 흡수에 충분 |
| **G2** | Q4 max-width | **(c) 의도 보존** — `maxWidth?: "md" \| "lg"` prop, default 없음 | max-w-3xl/4xl의 디자인 의도가 다름 (AccountList 4xl vs 나머지 3xl). 강제 통일은 의도 훼손 |
| **G2** | Q5 main vs section | **(a) `<main>` 통일** — AccountList/Detail/Edit의 `<section>` → `<main>` 정정 | landmark 표준화, a11y 측면 `<main>`이 페이지 유일 main 역할 |
| **G3** (tracking) | Q9 | **(a) 별도 plan** | Plan-G3 = tracking 토큰화 단일 plan |
| **G4** (PasswordField) | Q10 | **(b) Plan-G4 단일 PR 흡수** | 2 호출처 단일 PR 충분, brainstorm 불필요 |
| **G5** (TagChip/FieldCard) | Q11 | **(b) Plan-G5 단일 PR 흡수** | 호출처 적고 sub-decisions 명확, brainstorm 불필요 |

## 10. Current Decision State

| # | 결정 | 상태 |
|---|---|---|
| Q1 | Plan-G1 범위: **SettingsSection + SettingsRow 도입** | ✅ 확정 (2026-09-01) |
| Q6 | SettingsSection title: **`<h2>`로 위계 정정** (TemplateEdit의 `<h1>+<h2>+<h2>` 패턴 일관) | ✅ 확정 (2026-09-01) |
| Q7 | SettingsRow API: **`label` (ReactNode) + `children`** | ✅ 확정 (2026-09-01) |
| Q8 | SettingsRow disabled: **children에 위임** (Input `variant="disabled"` / Button `disabled` prop) | ✅ 확정 (2026-09-01) |
| Q12 | 마이그레이션: **단일 PR** (wrapper 2개 + 6 파일 동시) | ✅ 확정 (2026-09-01) |
| Q13 | PR 분할: **Plan-F1 단일 PR 패턴** (= Q12와 종결) | ✅ 종결 (Q12 결정으로) |
| Q-신규 | 회귀 게이트: **신규 단위 테스트 + 기존 Playwright E2E** | ✅ 확정 (2026-09-01) |

## 11. Risks

| 리스크 | 완화 |
|---|---|
| wrapper 도입 후 시각 회귀 | 인라인 → wrapper 마이그레이션 시 동일 className 유지, sed로 인스턴스 단위 검증 |
| `<main>` vs `<section>` 통일 시 a11y 영향 | 둘 다 block-level landmark. `<main>`은 페이지 유일 main. AccountList/AccountDetail/AccountEdit의 `<section>` → `<main>` 변환 시 영향 확인 |
| `pb-28` BottomTabs 조건부 처리 누락 | PageShell `withBottomTabs` prop으로 명시, 누락 시 BottomTabs 가림 |
| max-width 표준화 시 AccountList 4xl→3xl 축소 | AccountList가 좁아져 카드 가독성 저하 가능 → 사용자 결정 대기 (Q4-c 권장) |
| Plan-F1과의 경계 | PageShell/PageHeader는 layout, Input은 form field — 영역 분리 명확. Plan-G는 F1과 무관하게 진행 가능 |
| E2E 셀렉터 회귀 | data-testid 유지, getByText 기반 셀렉터는 마이그레이션 후 회귀 테스트로 확인 |
| Settings 4개 섹션 동시 마이그레이션 시 변경 폭 | Plan-G1 단일 PR이지만 4개 파일 동시 수정 → PR 리뷰 부담 ↑. 사용자 결정 시 (a) PR 분할 옵션 권장 |

## 12. Next Action

**본 brainstorm은 Q1~Q13 미확정 상태로 종료. 다음 단계 결정 흐름:**

1. **사용자 Q1 답변** — 첫 plan 범위 (a/b/c/d) — 이 결정이 후속 Q의 우선순위 결정
2. Q2~Q8: Q1 답변이 pageheader/sectionshell을 포함하는 경우에만 답변
3. Q9~Q13: Q1에 따라 답변 여부 결정
4. **Q-table 완료 시**: `ce-plan` 개설 → `docs/plans/2026-09-01-plan-g<번호>-<short>.md`
5. **구현 착수**: 단일 PR 또는 PR 분할 (Q13 결정)
6. **회귀 게이트**: typecheck/lint/test/build/Android/Playwright React E2E 44/44

## 13. Re-sequencing Impact

- Track 3 §7/§8에서 Plan-D PR 2(보류) / a11y audit / Plan-7a 2차 / Plan-7b / Plan-F2(특수 input) 후속으로 밀림
- 본 brainstorm이 **Track 3의 Plan-G 시리즈**로 삽입됨
- **Plan-G1** (SettingsSection+SettingsRow) → 가장 임팩트/부담 비율 좋음
- **Plan-G2** (PageHeader) → Option A(PageShell)와 결합 권장
- **Plan-G3** (tracking 토큰화) → 디자인 의도 명시 + sed 일괄

## 14. Decision Provenance

| 결정 | 날짜 | 출처 |
|---|---|---|
| Q1: 첫 plan 범위 = SettingsSection+SettingsRow만 | 2026-09-01 | 사용자 직접 "A" 선택 |
| Q6: SettingsSection title = `<h2>`로 위계 정정 | 2026-09-01 | 사용자 직접 "b" 선택 |
| Q7: SettingsRow API = `label` (ReactNode) + `children` | 2026-09-01 | 사용자 직접 "a" 선택 |
| Q8: SettingsRow disabled = children에 위임 | 2026-09-01 | 사용자 직접 "a" 선택 |
| Q12: 마이그레이션 = 단일 PR (wrapper 2개 + 6 파일 동시) | 2026-09-01 | 사용자 직접 "a" 선택 |
| Q-신규: 회귀 게이트 = 신규 단위 테스트 + 기존 E2E | 2026-09-01 | 사용자 직접 "a" 선택 |