# Brainstorm — Button 컴포넌트 통일 + AccountEdit ↔ TemplateEdit 통일감 (Track 3 후속)

- Date: 2026-09-01
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- Source: STRATEGY §3 (Track 3 UX·접근성·인터랙션 품질)
- Source: [`docs/brainstorms/2026-08-30-track3-ux-accessibility.md`](2026-08-30-track3-ux-accessibility.md) §11 Risks / §12 Next Action
- Source: [`docs/brainstorms/2026-09-01-input-form-design-system.md`](2026-09-01-input-form-design-system.md) (선행, Plan-F1 Input 통일 완료)
- Status: Brainstorm (no code changed)
- Status: **Brainstorm 결정 완료 (2026-09-01) — Q1~Q6 모두 확정**. 후속: Plan-E → Plan-B-4 (별도 PR 2개)
- Scope: **Plan-B-1/2/3 (Button 일관성) 완료 후속**으로 (a) `components/` 하위 + (b) `index.tsx` 내부에 **잔존하는 inline `<button>` 25개 정리** + (c) AccountEdit/TemplateEdit 통일감 회복. 보안·암호화·자동잠금은 §4 범위.

---

## 1. Problem

Plan-B-1/2/3 ([plan](../plans/2026-08-30-plan-b-button-loading-consistency.md), [`2026-08-30-plan-b3-settings-templates-buttons.md`](../plans/2026-08-30-plan-b3-settings-templates-buttons.md))으로 **버튼 일관성**이 명목상 완료됐으나, 실제 코드 인스펙션 결과 **두 갈래 누락**이 발견됨:

### 1.1 Plan-B-3 점검 범위 누락 — `components/` 하위 inline `<button>` 25개

Plan-B-3 plan §Current State (line 37-60)는 `index.tsx` 위주 인스펙션 표를 작성하고, **각 페이지의 `components/` 하위 폴더를 점검 범위에서 제외**했음. 그 결과 아래 25개 inline `<button>`이 마이그레이션되지 않고 잔존:

| 영역 | 파일:라인 | 용도 | 비고 |
|---|---|---|---|
| AccountEdit/components | `AccountFieldsSection.tsx:23` | "+ 항목 추가" pill | 디자인 (둥근 pill) |
| AccountEdit/components | `AccountTitleSection.tsx:72` | "자주 쓰는 사이트에서 선택" | 풀폭 카드형 |
| AccountEdit/components | `AccountTitleSection.tsx:95` | "선택 취소" X 아이콘 | 아이콘 전용 |
| AccountEdit/components | `FieldEditor.tsx:159` | "삭제" (필드) | 텍스트 pill |
| AccountEdit/components | `PasswordFieldEdit.tsx:23` | 눈(eye) toggle | 아이콘 전용 |
| AccountEdit/components | `PasswordFieldEdit.tsx:32` | generate 아이콘 | 아이콘 전용 |
| AccountEdit/components | `PasswordGenerator.tsx:180` | "새로 생성" | 풀폭 primary |
| AccountEdit/components | `PasswordGenerator.tsx:202` | "복사" | absolute 위치 pill |
| AccountEdit/components | `WebsiteSelector.tsx:177` | "적용" 추천 카드 | 컴팩트 pill |
| AccountEdit/components | `WebsiteSelector.tsx:197` | 검색 결과 카드 | 풀폭 카드형 |
| AccountEdit/components | `WebsiteSelector.tsx:240` | 추천 preset 카드 | 풀폭 카드형 |
| Accounts/components | `PasswordFieldView.tsx:19` | eye toggle | 아이콘 전용 |
| Accounts/components | `PasswordFieldView.tsx:27` | "복사" pill | 컴팩트 pill |
| Accounts/components | `TemplatePicker.tsx:71` | "닫기" X 아이콘 | 아이콘 전용 |
| Accounts/components | `TemplatePicker.tsx:83` | 템플릿 카드 (per-item) | 풀폭 카드형 |
| TemplateEdit/components | `TemplateFieldEditor.tsx:49` | "위로 이동" ↑ | 아이콘 전용 사각 |
| TemplateEdit/components | `TemplateFieldEditor.tsx:58` | "아래로 이동" ↓ | 아이콘 전용 사각 |
| TemplateEdit/components | `TemplateFieldEditor.tsx:75` | 필드 삭제 X | 아이콘 전용 |
| TemplateEdit/components | `TemplateFieldEditor.tsx:134` | "옵션 제거" 링크형 | 텍스트 underline |
| TemplateEdit/components | `IconPicker.tsx:32` | 토글 버튼 (이모지 + 변경) | 풀폭 카드형 |
| TemplateEdit/components | `IconPicker.tsx:49` | 패널 닫기 X | 아이콘 전용 |
| TemplateEdit/components | `IconPicker.tsx:59` | 이모지 그리드 선택 | 정사각 grid |
| Settings/components | `AppInfoDialog.tsx:34` | "닫기" primary | 풀폭 primary |
| Accounts/index | `Accounts/index.tsx:238` | 태그 필터 pill | 데이터 driven |
| AutofillTestLogin | `AutofillTestLogin.tsx:85` | "로그인" primary | 풀폭 primary |

**총 25개 inline `<button>`.** 이 중 일부는 기술적으로 `<Button>`으로 마이그레이션 불가능:

- **아이콘 전용 버튼** (eye, generate, X, ↑↓): `<Button>`은 `rounded-full` 강제 + `label: ReactNode` 필수 → 아이콘-only 미지원
- **풀폭 카드형 버튼** (WebsiteSelector 검색 결과, TemplatePicker 카드, IconPicker 그리드): `<Button>`은 `inline-flex items-center` 패턴 → 풀폭 카드 레이아웃 부적합
- **데이터-driven pill** (Accounts/index.tsx 태그 필터): `className` 동적 분기(`selectedTags.includes`)

→ **컴포넌트 한계가 inline 잔존을 강제하고 있음.** `Button` 확장이 선결 조건.

### 1.2 AccountEdit ↔ TemplateEdit 통일감 부족 (동일 의도, 다른 모양)

**두 페이지는 "필드 추가/삭제/순서 변경"이라는 거의 동일한 사용자 의도를 다루지만**, UI 컴포넌트가 다름:

| 측면 | AccountEdit | TemplateEdit | 차이 |
|---|---|---|---|
| 필드 삭제 | `FieldEditor.tsx:159` — 텍스트 pill "삭제" (`rounded-full border`) | `TemplateFieldEditor.tsx:75` — X 아이콘 사각 (`p-2 rounded-xl`) | 의미 같음, 모양 다름 |
| 필드 추가 | `AccountFieldsSection.tsx:23` — "+ 항목 추가" 둥근 pill | `index.tsx:258` — `<Button variant="secondary" size="sm">` | `<Button>` 사용 불일치 |
| 순서 이동 버튼 | **없음** (AccountField는 order 속성 있지만 UI 없음) | `TemplateFieldEditor.tsx:49,58` — ↑↓ 사각 아이콘 | 의도 다름 (template만 reorder 가능) |
| 페이지 헤더 | `<div>` (시맨틱 없음) | `<header>` + `<h1>` | ⚠️ AccountEdit a11y 결함 |
| 에러 표시 | 라인 259-267 — 단일 빨간 박스 `role="alert"` | 라인 204-212 — `<ul>` 리스트 + `dark:` 색 분기 | ⚠️ 패턴 2종 공존 |
| 색상 토큰 | `var(--color-error)` | `var(--error)` (다른 변수명!) | ⚠️ **잠재 회귀** — Plan-F1 통일 후에도 Token 미통일 |
| 카드 컨테이너 | `rounded-2xl border ... bg-[var(--color-code-bg)] p-3` | `rounded-2xl border ... bg-[var(--color-code-bg)] p-4` | 거의 같음 (p-3 vs p-4) |

**가장 심각:** AccountEdit은 페이지 제목 `<h1>`이 없음 → 스크린리더가 페이지 컨텍스트를 못 잡음. **Track 3 §3 a11y 항목의 명백한 결함.**

### 1.3 색상 토큰 불일치 (잠재 회귀)

인스펙션 중 발견 — 일부 파일은 `var(--color-error)`, 다른 일부는 `var(--error)`를 사용:

- `AccountEdit/index.tsx`, `AccountEdit/components/*`, `Button.tsx` → `var(--color-error)`
- `TemplateEdit/index.tsx`, `Settings/components/UISection.tsx` → `var(--error)` (`dark:` 분기 직접)
- Plan-F1 (Input 통일) 시 `var(--color-error)`로 통합됐다는 메모가 있으나, **TemplateEdit/Settings는 미마이그레이션**

**잠재 회귀:** 테마 변경(예: 에러 색상 토큰 추가/이름 변경) 시 두 그룹이 따로 동작.

### 1.4 STRATEGY ↔ 코드 매칭 (ce-brainstorm 규칙)

> "✅는 코드 존재 + 동작 검증 둘 다 만족. 코드만 있고 STRATEGY가 ✅라고 말하는 것은 ⚠️ 또는 ❓다."

| STRATEGY §3 원문 | 표면 증거 | 실제 동작 | 진짜 상태 |
|---|---|---|---|
| "더블클릭/중복 제출 방지" | Plan-B-1/2/3 완료 보고 | **index.tsx만 마이그레이션, components/ 하위 25개 잔존** | ⚠️ |
| "키보드 네비게이션/포커스 순서" | Button `focus:ring-2` | inline `<button>`은 focus-ring 직접 구현 또는 누락 | ⚠️ |
| "스크린리더 대응" | Plan-B-1 `aria-busy` | AccountEdit에 `<h1>` 부재, 아이콘 전용 버튼 일관성 없음 | ⚠️ |

---

## 2. Goal

1. **inline `<button>` 25개 → 컴포넌트화** (Button 확장 또는 IconButton 분리)
2. **AccountEdit ↔ TemplateEdit 통일감 회복** (필드 추가/삭제 UI, 헤더 시맨틱, 에러 표시)
3. **색상 토큰 통일** (`var(--error)` → `var(--color-error)` 일괄)
4. **회귀 0**: 기존 Plan-A/B/D 통합 테스트 통과 + Playwright E2E 회귀 0

**명시적 범위 밖:**
- `useFormSubmit` / `useAsync` wrapper hook — Track 3 Q2 결정 유지 (포함 안 함)
- Toast / Snackbar / `useFormError` — Track 3 Q1 결정 유지 (포함 안 함)
- `FileCreateDialog` 완전 제거 (Plan-7a 2차 PR Q4-a) — 사용자 결정 보류 유지
- a11y audit plan (axe-core CI + 키보드 Playwright) — 별도 plan으로 분리 (Track 3 Q5)

---

## 3. Context

### 3.1 인스펙션한 파일/모듈

| 영역 | 파일 | 메모 |
|---|---|---|
| 공통 Button | `src/components/Button.tsx` (60줄) | `variant` 4종 + `size` 3종 + `loading`/`disabled`/`aria-busy`. **`rounded-full` 강제 + `label: ReactNode` 필수** → 아이콘 전용 미지원 |
| Plan-F1 Input | `src/components/inputs/Input.tsx` (88줄, Plan-F1) | `as`/`size`/`variant`/`errorId`/`helperText`. **공통 Input은 통일 완료** — 본 brainstorm은 Button 잔존이 핵심 |
| Inline 잔존 | 위 표 1.1 (25개) | components/ 하위 + 일부 index.tsx |
| 색상 토큰 | `src/index.css` (Tailwind) | `--color-error` 정의, `--error` 별칭 존재 가능 |
| Toggle switch | `UISection.tsx:33`, `AutofillSection.tsx:213` | `role="switch"` + 시각적 토글. 의미/시각적 토글로 `<Button>` 부적합 (Plan-B-3 명시 제외) |

### 3.2 기존 아키텍처

```
src/components/
├── Button.tsx                    ✅ 통일 완료, 확장 필요
├── feedback/Spinner.tsx          ✅ 통일 완료
├── SyncErrorBanner.tsx           ✅ 통일 완료
├── inputs/
│   ├── Input.tsx                 ✅ Plan-F1 통일 완료
│   ├── Checkbox.tsx              ⚠️ 정의됨, 호출처 0건 (사용 안 됨)
│   └── PinStrengthMeter.tsx
└── dialogs/                      ✅ 통일 완료
```

**신규 후보:**
- `IconButton.tsx` (아이콘 전용 버튼 — `aria-label` 필수)
- 또는 `Button` 확장 (`variant="icon"` 추가 vs className 오버라이드 허용)

### 3.3 STRATEGY ↔ 코드 매칭 (ce-brainstorm 규칙)

> "✅는 코드 존재 + 동작 검증 둘 다 만족. 코드만 있고 STRATEGY가 ✅라고 말하는 것은 ⚠️ 또는 ❓다."

| STRATEGY §3 원문 | 표면 증거 | 실제 동작 | 진짜 상태 |
|---|---|---|---|
| "더블클릭/중복 제출 방지" | Plan-B-1/2/3 21개 마이그레이션 완료 | **25개 잔존 (components/ 하위)** — 아이콘 전용/풀폭 카드형은 Button 한계로 미처리 | ⚠️ |
| "키보드 네비게이션/포커스 순서" | Button `focus:ring-2 focus:ring-offset-2` | inline `<button>`은 focus-ring 직접 구현 또는 누락 | ⚠️ |
| "스크린리더 대응" | Plan-B-1 `aria-busy`, Plan-F1 `aria-invalid` 등 | AccountEdit에 `<h1>` 부재 (페이지 컨텍스트 못 잡음), 아이콘 전용 버튼 aria-label 일관성 없음 | ⚠️ |
| "에러 토스트/인라인 에러" | Plan-A1 `mapError` + `SyncErrorBanner` | 에러 표시 패턴 2종 (단일 박스 vs ul 리스트), 색상 토큰 2종 (`var(--error)` vs `var(--color-error)`) | ⚠️ |

### 3.4 STRATEGY §3 진척 매트릭스 갱신

[Track 3 brainstorm §3.4](../brainstorms/2026-08-30-track3-ux-accessibility.md#34-strategy--코드-매칭-ce-brainstorm-규칙)의 "더블클릭/중복 제출 방지" 항목은 본 brainstorm 완료 후 ⚠️ → ✅ 후보. "키보드/스크린리더"는 본 brainstorm + a11y audit plan 완료 후 ✅.

---

## 4. Constraints

- **네트워크 권한 0, 클라우드 동기화 없음** (STRATEGY Boundary #1)
- **cryptoKey 메모리 only** — UI 개선이 키 lifecycle에 영향 주면 안 됨
- **자동잠금/세션 만료와 충돌 금지** — 본 brainstorm은 UI 한정
- **Capacitor 8 + React 19** — web 표준 패턴 우선
- **Tailwind CSS 4 + Ionic 컴포넌트** — 기존 스택 위에 구축
- **i18n** — 한국어 위주, 모든 사용자 문구 i18n 키로 분리 (별도 plan)
- **E2E 영향 최소화** — Button 마이그레이션은 Playwright pageobject 영향 (특히 `data-testid="button"` 추가됨 — Plan-B-1에서 이미 적용됨, 회귀 없음)
- **Plan-F1 색상 토큰** — `var(--color-error)` 사용이 표준 (Plan-F1 §3), 본 brainstorm은 `var(--error)` 호출처를 모두 `var(--color-error)`로 통일

---

## 5. Existing Architecture (요약)

```
[User action / async work]
  ├─ store mutation (Zustand)
  │    └─ persistVaultSnapshot / loadAccounts / etc.
  │
  └─ UI
       ├─ <Button>          ← Plan-B-1, 라벨 전용 (loading/disabled/aria-busy 일관)
       ├─ <IconButton>      ← [신규 후보] 아이콘 전용 (aria-label 필수, rouned 옵션화)
       ├─ <Input>           ← Plan-F1, as="input|select|textarea", size/variant
       ├─ <Spinner>         ← Plan-A2, Button 내장 + Accounts 페이지
       ├─ <SyncErrorBanner> ← Plan-A1
       └─ <PinStrengthMeter> ← Plan-4

[Inline 잔존 25개]
  └─ components/ 하위 폴더 + index.tsx 일부
       └─ 아이콘 전용 / 풀폭 카드형 / 데이터-driven pill
            → Button 한계로 마이그레이션 불가
            → IconButton 신설 또는 Button variant 확장 필요
```

---

## 6. Relevant Previous Knowledge

- **AGENTS.md** — `src/` 구조, `@/` alias, React 19 + TS strict, pipeline functions
- **STRATEGY §3 (Track 3 brainstorm)** — 본 brainstorm과 직접 연결. §11 Risks "Track 1/2 회귀 0", §12 Next Action "a11y audit plan"
- **Plan-F1 (Input 통일)** — [`2026-09-01-input-form-design-system.md`](../brainstorms/2026-09-01-input-form-design-system.md) (2026-09-01 완료). Input은 통일됐고, Button 잔존 + AccountEdit/TemplateEdit 통일감이 후속으로 남음. **선행 의존성 해소됨**
- **Plan-B-3 PR 미개설** — origin HEAD = `b148855f`, 커밋 `93e007ed`은 origin history에 포함. Plan-B-3 PR은 사용자 결정 대기. **본 brainstorm 후속 작업은 Plan-B-3 PR과 별도 PR 권장** (코드 리뷰 단순화)
- **Plan-D PR 2 보류** (2026-08-31 사용자 결정) — Plan-B-4/E 작업과 독립, 영향 없음
- **사용자 작업 스타일 메모** — "단순화 / 이전과 같게"는 speculative fix 중단 신호. **본 brainstorm은 명확한 잔존 정리 + 통일감 회복이므로 해당 신호에 해당 안 함**
- **STRATEGY §3 Q5** — a11y: 부산물 흡수 + 별도 audit plan. 본 brainstorm은 부산물 흡수(a11y 자연 보강) 범위, axe-core CI 통합은 별도 audit plan으로 후속

---

## 7. Options

### A. Plan-E: AccountEdit ↔ TemplateEdit 통일감 회복 (좁은 범위) ✅ 확정

**포함 (Q1 = (a) 확정):**
- AccountEdit `index.tsx` 헤더에 `<header>` + `<h1>` 추가 (a11y 결함 해결)
- 두 페이지의 필드 추가/삭제 UI 통일 (공통 `<FieldActions>` 또는 Button 통일)
- 에러 표시 컴포넌트 추출: `<ErrorMessage>` (단일) + `<ErrorList>` (복수) 또는 단일 `<ErrorMessage items={errors}>`
- **색상 토큰 통일 (Q5 = Plan-E PR에 포함, Q6 = src/ 전체, grep 사전 확인):** `var(--error)` → `var(--color-error)` sed
- AccountEdit 저장 에러 표시를 `<p role="alert">` (이미 적용) — TemplateEdit도 동일 형태로 정렬

**범위 밖:**
- inline `<button>` 25개 마이그레이션 (Plan-B-4로 분리)
- Button 컴포넌트 확장 (Plan-B-4에 의존)

**장점:**
- 즉시 체감 가능 (사용자가 "두 페이지가 비슷하다"고 느낌)
- 작업량 소~중 (스타일/시맨틱/토큰 통일만)
- Plan-B-3 PR 미개설 상태에서 별도 PR로 묶기 좋음

**단점:**
- inline `<button>` 25개는 그대로 잔존 → "더블클릭/중복 제출 방지" STRATEGY §3 항목이 여전히 ⚠️

**복잡도:** 소~중. 새 컴포넌트 1~2개 (ErrorMessage/ErrorList), 두 페이지 헤더/에러 표시 수정, 색상 토큰 sed 교체.
**보안:** 영향 없음.
**테스팅:** 단위 테스트 (ErrorMessage/ErrorList) + Playwright 회귀.
**마이그레이션:** 두 페이지 + 색상 토큰 sed (전체 src/).

### B. Plan-B-4: inline `<button>` 25개 → 컴포넌트 마이그레이션 (Plan-B-3 후속)

**포함 (Q2/Q3/Q4 결정 확정 반영):**
- **`Button` 확장 (Q2 = b):** `variant="icon"` 추가 + `label` 옵션화 (string → ReactNode 옵션). 아이콘 전용 버튼 9개는 `<Button variant="icon" label={icon} aria-label="...">` 형태로 마이그레이션. **기존 Plan-B-1/2/3 호출처 21개는 회귀 0 검증 필수**
- **`CardButton` 별도 신설 (Q3 = a):** 풀폭 카드형 버튼 5개 (WebsiteSelector 검색 결과/템플릿 카드/이모지 그리드). 풀폭 레이아웃 + 시각적 의도 보존
- 풀폭 primary/컴팩트 pill/텍스트 pill/텍스트 링크 11개: 기존 `<Button variant="primary|secondary|ghost">` 사용
- 25개 마이그레이션: AccountEdit/components 11개, TemplateEdit/components 7개, Accounts/components 4개, Settings/components 1개, index.tsx 2개

**범위 밖:**
- AccountEdit ↔ TemplateEdit 통일감 회복 (Plan-E에서 완료)
- 색상 토큰 통일 (Plan-E에서 완료)

**장점:**
- "더블클릭/중복 제출 방지" STRATEGY §3 항목을 ✅로 마감
- `loading`/`disabled`/`aria-busy` 일관성 25개에 전파
- Playwright 회귀 흡수 (Button 컴포넌트의 `data-testid="button"` 통일)

**단점:**
- `Button` 확장 시 기존 Plan-B-1/2/3 호출처 21개 회귀 가능성 — **시작 시 단위 테스트 + Playwright 회귀 0 검증 필수** (Q2 = b 확정)
- 풀폭 카드형 버튼의 시각적 의도가 Button 컴포넌트와 충돌 가능 → `CardButton` 별도 신설로 회피 (Q3 = a 확정)

**복잡도:** 중. `Button` 확장 + `CardButton` 신설 + 25개 마이그레이션 + 테스트.
**보안:** 영향 없음.
**테스팅:** `Button variant="icon"` 단위 테스트 + `CardButton` 단위 테스트 + 25개 마이그레이션 통합 테스트 + Playwright 회귀.
**마이그레이션:** 25개 inline `<button>` 호출처 + 기존 Button 호출처 21개 회귀 0 검증.

### C. E + B 통합 (한 PR, 순차)

**포함:**
- Plan-E 모든 항목 (통일감 회복)
- Plan-B-4 모든 항목 (inline 마이그레이션)
- 색상 토큰 통일 (`var(--error)` → `var(--color-error)`)

**장점:**
- 한 PR로 정리 → 사용자 "둘 다 끝났다" 체감
- 작업 흐름이 자연스러움 (색상 토큰 통일 → 통일감 회복 → inline 마이그레이션)

**단점:**
- **PR 크기 큼** (Button 확장 + 25개 마이그레이션 + 통일감 + 색상 토큰) → 리뷰 부담
- 회귀 발생 시 원인 특정 어려움
- Plan-B-3 PR 미개설 상태와 결합 시 PR 시리즈가 복잡해짐

**복잡도:** 중~대. Plan-E + Plan-B-4 통합.
**보안:** 영향 없음.
**테스팅:** 모든 항목 통합 + Playwright 회귀.
**마이그레이션:** Plan-E + Plan-B-4 일괄.

### D. 보류 — 다음 트리거 시 진행

**포함:** 없음.
**장점:** 작업 0.
**단점:** inline `<button>` 25개 + 통일감 결함이 영구 잔존 → Track 3 §3 a11y 항목 ⚠️ 유지.

---

## 8. Recommended Direction

### 8.1 우선순위 권장 (Q1~Q6 모두 확정)

**확정: A → B 순차 (별도 PR 2개)**

| 순서 | Plan | 근거 | 예상 복잡도 | 결정 항목 |
|---|---|---|---|---|
| **1** | **Plan-E (A안)** | 즉시 체감 ↑, 작업량 소, Plan-B-3 PR 미개설과 독립. 색상 토큰 통일은 부산물 | 소~중 | Q1=(a), Q5=(a), Q6=(b) |
| **2** | **Plan-B-4 (B안)** | `Button` 확장 (`variant="icon"`) + `CardButton` 신설 + 25개 마이그레이션. Plan-E 후속으로 분리 → PR 리뷰 단순. Plan-B-3 PR과 무관 | 중 | Q2=(b), Q3=(a), Q4=(c) |

**근거:**
- **Plan-E 먼저**: 색상 토큰 통일 + 통일감 회복은 작업량 대비 효과가 큼. `inline <button>` 25개는 컴포넌트 API 결정(Q2/Q3)이 필요해서 사용자 결정 대기 시간 있음
- **Plan-B-4는 별도 PR**: 25개 마이그레이션은 PR이 충분히 크므로 Plan-E와 분리 → 리뷰 부담 ↓
- **Plan-B-3 PR 미개설 상태와 무관 (Q4 = c)**: Plan-B-4는 Plan-B-3 PR과 결합하지 않고 별도 진행. Plan-B-3 PR은 사용자 결정 시까지 보류 유지
- **STRATEGY §3 진척**: Plan-E 완료 후 "에러 토스트/인라인 에러"가 ✅ 후보, Plan-B-4 완료 후 "더블클릭/중복 제출 방지"가 ✅ 확정

### 8.2 권장 분할

```
Track 3 후속: Button 통일 + AccountEdit↔TemplateEdit 통일감
└─ Plan-E: 통일감 회복 + 색상 토큰 통일
   ├─ AccountEdit/TemplateEdit 헤더 <header> + <h1> 통일
   ├─ 에러 표시 컴포넌트 추출 (<ErrorMessage> + <ErrorList>)
   ├─ 색상 토큰 var(--error) → var(--color-error) sed
   └─ 회귀 0 검증
   ↓
└─ Plan-B-4: inline <button> 25개 → 컴포넌트
   ├─ IconButton 신설 vs Button variant 확장 (Q2/Q3 결정)
   ├─ 25개 마이그레이션 (AccountEdit/components 11 + TemplateEdit/components 7 + ...)
   └─ 회귀 0 검증

후속 (Track 3 §12):
└─ a11y audit plan (별도) — axe-core CI + 키보드 Playwright + remediation
   Plan-B-4 완료 후 또는 트리거 발생 시
```

### 8.3 Plan-7 / Plan-D 영향

- **Plan-7a 2차 PR (Q4-a 후속, 보류)**: 본 brainstorm과 결합 약함. 영향 없음
- **Plan-D PR 2 (보류, 2026-08-31)**: 본 brainstorm과 독립. 영향 없음
- **Plan-7b (폴더 선택 + 자동 백업, 미착수)**: STRATEGY §2 분류, 별도 brainstorm. 영향 없음

---

## 9. Open Questions (모두 확정)

| Q | 질문 | 옵션 | 확정 |
|---|---|---|---|
| **Q1** | Plan-E 범위: 어디까지 풀까? | (a) 통일감 + 색상 토큰 / (b) 통일감만 / (c) 색상 토큰만 | **(a) 통일감 + 색상 토큰** |
| **Q2** | Plan-B-4 컴포넌트 전략: IconButton 신설 vs Button 확장? | (a) `IconButton` 신설 / (b) `Button` 확장 (`variant="icon"`) | **(b) `Button` 확장** |
| **Q3** | 풀폭 카드형 버튼 처리? | (a) `CardButton` 별도 / (b) Button + className / (c) inline 유지 | **(a) `CardButton` 별도 신설** |
| **Q4** | Plan-B-4와 Plan-B-3 PR 미개설 결합? | (a) Plan-B-3 먼저 개설 / (b) 한 PR 통합 / (c) Plan-B-4만, Plan-B-3 보류 | **(c) Plan-B-4만 별도 PR, Plan-B-3 보류** |
| **Q5** | Plan-E sed는 별도 PR? | (a) Plan-E PR에 포함 / (b) sed-only PR | **(a) Plan-E PR에 포함** |
| **Q6** | sed 대상 범위? | (a) Templates+Settings / (b) src/ 전체 / (c) grep 후 점프 | **(b) src/ 전체 (작업 전 grep으로 매치 파일 확정)** |

---

## 10. Current Decision State

| # | 결정 | 상태 |
|---|---|---|
| Q1 | Plan-E 범위 | ✅ 확정 (a) 통일감 + 색상 토큰 |
| Q2 | IconButton 신설 vs Button 확장 | ✅ 확정 (b) `Button` 확장 (`variant="icon"` + `label` 옵션화) |
| Q3 | 풀폭 카드형 버튼 처리 | ✅ 확정 (a) `CardButton` 별도 신설 |
| Q4 | Plan-B-4와 Plan-B-3 PR 결합 | ✅ 확정 (c) Plan-B-4만 별도 PR, Plan-B-3 보류 |
| Q5 | sed 별도 PR 여부 | ✅ 확정 — sed는 Plan-E PR에 포함 (작업량 적음, 검증 동시) |
| Q6 | sed 대상 범위 | ✅ 확정 (b) `src/` 전체 (작업 전 grep으로 매치 파일 목록 확인) |
| §8.1 순서 | Plan-E 먼저, Plan-B-4 후속 | ✅ 확정 (별도 PR 2개) |

**진행 순서 (모두 확정):**
1. **⏳ Plan-E** (Q1/Q5/Q6 확정 후 진행) — 통일감 + 색상 토큰 (Plan-B-3 PR 미개설 상태와 독립)
2. **⏳ Plan-B-4** (Q2/Q3/Q4 확정 후 진행) — `Button` 확장 (`variant="icon"`) + `CardButton` 신설 + 25개 마이그레이션 (Plan-B-3 PR과 무관)
3. **📋 a11y audit plan** (별도, Track 3 Q5) — Plan-B-4 완료 후 또는 트리거 시

---

## 11. Risks

| 리스크 | 완화 |
|---|---|
| ~~Plan-F1 Input 통일 미완~~ | ✅ 해소 (2026-09-01 완료). Plan-F1이 `var(--color-error)` 표준 확립 |
| ~~Track 1(autofill)/Track 2(vault) 회귀~~ | ✅ 해소. 본 brainstorm은 React UI 한정, autofill native 경로와 격리됨 |
| Plan-B-3 PR 미개설 + 본 brainstorm 작업 결합 시 PR 복잡도 | ✅ 해소 (Q4 = c 확정). Plan-B-4는 Plan-B-3과 무관하게 별도 PR로 진행. Plan-B-3 PR은 사용자 결정 시까지 보류 유지 |
| IconButton `aria-label` 강제 누락 시 a11y 결함 | ✅ 회피 (Q2 = b 확정). IconButton 신설 대신 `Button` 확장 (`variant="icon"`) 선택 — `Button`의 기존 `aria-busy`/`disabled` 일관성을 그대로 활용, `aria-label`은 호출처 책임 (TS type은 `aria-label?: string` 옵션) |
| 풀폭 카드형 버튼의 시각적 의도 보존 실패 | ✅ 회피 (Q3 = a 확정). `CardButton` 별도 신설로 풀폭 레이아웃 + 시각 의도 보존. 시각 회귀 테스트는 별도 추가하지 않음 (사용자 결정 단순화) |
| 색상 토큰 sed 누락 (`var(--error)` 잔존) | ✅ 해소 (Q6 = b 확정). 작업 전 `rg -n "var\(--error\)" src/`로 매치 파일 목록 확인 → sed 전후 grep으로 0 매치 검증 |
| Plan-E PR 머지 후 Plan-B-4 회귀 | Plan-B-4 시작 전 Plan-E 머지 확인 + 색상 토큰 통일 검증 (sed 후 grep) |
| "단순화/이전과 같게" 사용자 신호 | 본 brainstorm은 명확한 잔존 정리 + 통일감 회복 — 신호에 해당 안 함. 단, Plan-B-4 시작 전 작업 범위 재확인 |
| `Button` 확장이 기존 호출처(Plan-B-1/2/3)에 회귀 | ⚠️ 잔존. `variant="icon"` 추가 + `label` 옵션화 시 기존 `label: ReactNode` 호출은 그대로 동작해야 함. **Plan-B-4 시작 시 단위 테스트 + Playwright 회귀 0 검증 필수** |
| AccountEdit `<h1>` 추가는 단순 변경이나 Playwright `getByRole("heading")` 셀렉터 영향 | E2E 셀렉터 grep으로 사전 확인 |

---

## 12. Next Action

**Track 3 Q1~Q8 확정 + 8개 plan commit 완료 (2026-08-31) + Plan-F1 Input 통일 완료 (2026-09-01). 본 brainstorm 결정 완료 (Q1~Q6 모두 확정).**

1. **✅ Track 3 8개 plan 완료** — [Track 3 brainstorm](../brainstorms/2026-08-30-track3-ux-accessibility.md) §12
2. **✅ Plan-F1 Input 통일 완료** (2026-09-01) — [brainstorm](../brainstorms/2026-09-01-input-form-design-system.md)
3. **✅ 본 brainstorm Q1~Q6 모두 확정** (2026-09-01):
   - **Q1 = (a)**: Plan-E = 통일감 + 색상 토큰
   - **Q2 = (b)**: Plan-B-4 = `Button` 확장 (`variant="icon"` + `label` 옵션화)
   - **Q3 = (a)**: 풀폭 카드형 = `CardButton` 별도 신설
   - **Q4 = (c)**: Plan-B-4 = Plan-B-3 PR과 무관한 별도 PR (Plan-B-3 보류 유지)
   - **Q5 = (a)**: sed는 Plan-E PR에 포함
   - **Q6 = (b)**: sed = `src/` 전체 (작업 전 grep 사전 확인)
4. **⏳ Plan-E** (다음 단계) — AccountEdit ↔ TemplateEdit 통일감 + 색상 토큰 sed (작업 전 `rg -n "var\(--error\)" src/` grep으로 매치 파일 확정)
5. **⏳ Plan-B-4** (Plan-E 후속) — `Button` 확장 + `CardButton` 신설 + 25개 inline 마이그레이션
6. **📋 a11y audit plan** (별도) — Plan-B-4 완료 후 또는 트리거 시

**본 brainstorm의 ce-plan 직접 개설 보류 사유 해소됨.** §7 Options / §8.1/8.2 / §9 Open Questions (모두 확정) / §11 Risks 모두 정리. STRATEGY.md 갱신은 별도 작업.

---

## 부록 A. inline `<button>` 25개 분류표 (Q2/Q3 결정 반영)

| 분류 | 개수 | 예시 | 마이그레이션 대상 (Q2/Q3 확정) |
|---|---|---|---|
| 아이콘 전용 (eye/generate/X/↑↓) | 9 | `PasswordFieldEdit.tsx:23,32`, `PasswordFieldView.tsx:19`, `AccountTitleSection.tsx:95`, `TemplateFieldEditor.tsx:49,58,75`, `TemplatePicker.tsx:71`, `IconPicker.tsx:49` | **`Button variant="icon"` (Q2-b)** — `label={icon}` + `aria-label="..."` |
| 풀폭 카드형 (검색 결과/템플릿 카드/이모지 그리드) | 5 | `WebsiteSelector.tsx:177,197,240`, `TemplatePicker.tsx:83`, `IconPicker.tsx:32,59` | **`CardButton` 신설 (Q3-a)** |
| 컴팩트 pill (적용/복사/태그 필터) | 5 | `AccountTitleSection.tsx:72`, `PasswordGenerator.tsx:202`, `PasswordFieldView.tsx:27`, `Accounts/index.tsx:238`, `WebsiteSelector.tsx:177` | `<Button variant="secondary" size="sm">` 또는 className |
| 풀폭 primary (생성/닫기/로그인) | 4 | `PasswordGenerator.tsx:180`, `AppInfoDialog.tsx:34`, `AutofillTestLogin.tsx:85` | `<Button variant="primary">` |
| 텍스트 pill (필드 삭제/항목 추가) | 2 | `FieldEditor.tsx:159`, `AccountFieldsSection.tsx:23` | `<Button variant="ghost" size="sm">` |
| 텍스트 링크 (옵션 제거) | 1 | `TemplateFieldEditor.tsx:134` | `<Button variant="ghost" size="sm">` 또는 그대로 inline |

## 부록 B. 색상 토큰 sed 대상 (Q6 결정용 grep)

```bash
# src/ 전체에서 var(--error) (color-error가 아닌) 사용처 확인
rg -n "var\(--error\)" src/

# 예상 매치 (사용자 결정 시 grep으로 확정):
# - TemplateEdit/index.tsx
# - Settings/components/UISection.tsx
# - Settings/components/AutofillSection.tsx
# - Settings/components/AppInfoDialog.tsx
# - 기타 Settings/components/*
# - ConfirmDialog.tsx (Plan-B-1 마이그레이션 시 var(--color-error)로 변경됐을 가능성 — 확인 필요)
```

## 부록 C. STRATEGY §3 업데이트 제안

본 brainstorm 완료 후 STRATEGY §3 갱신 diff:

```diff
-  - 📋 a11y audit plan — 미착수. axe-core CI + 키보드 Playwright + remediation. Plan-B-3/D 완료 후 또는 트리거 시 (Q5-a)
+  - 📋 Plan-E: AccountEdit ↔ TemplateEdit 통일감 — 미착수. 헤더 <header>/<h1> 통일 + 에러 표시 컴포넌트 추출 + 색상 토큰 var(--error) → var(--color-error) 통일. Plan-F1 (Input 통일) 후속
+  - 📋 Plan-B-4: inline `<button>` 25개 마이그레이션 — 미착수. IconButton 신설 + 25개 components/ 하위 + index.tsx 일부. Plan-B-3 후속
+  - 📋 a11y audit plan — 미착수. axe-core CI + 키보드 Playwright + remediation. Plan-B-4 완료 후 또는 트리거 시 (Q5-a)
```