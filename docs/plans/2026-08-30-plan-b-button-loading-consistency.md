# Plan-B — Button/폼 일관성 (3-PR 분할: 인프라 / 자주 / 나머지)

- Date: 2026-08-30
- Source: [`docs/brainstorms/2026-08-30-track3-ux-accessibility.md`](../brainstorms/2026-08-30-track3-ux-accessibility.md) §7 B, §8.1, §10 Q2, §11
- 선행: [Multi-Vault Support](./2026-08-30-multi-vault-support.md) ✅, [Plan-7a](./2026-08-30-plan-7a-create-vault-multistep.md) ✅
- 의존: [Plan-A2](./2026-08-30-plan-a2-spinner-loading.md) (`<Spinner>` 컴포넌트), [Plan-A1](./2026-08-30-plan-a1-error-visibility.md) (`mapError` — Plan-B-2/3에서 활용)
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- 결정 사항: §결정 (Plan-B 대화형 리뷰 결과) 참고

---

# Goal

**버튼 컴포넌트를 단일화**하고 in-flight 상태에서 일관된 `loading`/disabled/`aria-busy` 처리를 보장한다. 3 PR로 분할하여 안전하게 진행.

완료 시 다음이 참:
- `Button.tsx`가 inline spinner를 `<Spinner>` 컴포넌트로 교체 (Plan-A2 의존), `aria-busy` 추가
- 모든 async 액션 버튼이 `<Button>` 사용 (Plan-B-1/2/3 합쳐서 ~30+ 버튼)
- `FormDialog`/`ConfirmDialog`의 inline submit/confirm/cancel → `<Button>`
- 사용자는 "한 번만 누르면 됨" 체감 (현재 일부 패턴에서 더블클릭 가능)
- Brainstorm Q2: **`useFormSubmit` wrapper hook 포함 안 함**, Dialog의 `isLoading` prop + `<Button loading>` prop만으로 충분

**범위 밖 (Plan-B):**
- `useFormSubmit` / `useAsync` 같은 wrapper hook — **포함 안 함** (Q2)
- `FormDialog`의 `onError` callback 패턴 — **포함 안 함** (Q2: throw 유지, Plan-A1의 `mapError`로 통일)
- `Spinner`/`Skeleton` 컴포넌트 자체 — **Plan-A2에서 신규** (Plan-B-1이 의존만 함)
- i18n 정식 도입 — 별도 plan

---

# PR 분할

| PR | 내용 | 파일 수 | 영향 |
|---|---|---|---|
| **Plan-B-1 (인프라)** | `Button.tsx` 보강 + `FormDialog`/`ConfirmDialog` 마이그레이션 + 4+ 단위 테스트 | ~6 파일 | Dialog 2개 + Button 1개. **Plan-A2 다음 머지** |
| **Plan-B-2 (자주 쓰는 페이지)** | Accounts/index, AccountDetail, AccountEdit, Home, Auth, CreateVault | ~6 페이지, ~15 버튼 | 빈도 높은 페이지. **Plan-A1과 동시 머지 가능** |
| **Plan-B-3 (나머지)** | Templates/index, TemplateEdit, Settings/index, AutofillSection, DataSection, SecuritySection | ~6 페이지, ~10+ 버튼 | 빈도 낮음. **Plan-B-2 다음** |

**진행 순서 (의존성):**
```
Plan-A2 (Spinner) ─→ Plan-B-1 (Button + Dialog)
                       ↓
                  Plan-B-2 (자주 페이지) ← Plan-A1 (독립, 병행 가능)
                       ↓
                  Plan-B-3 (나머지)
```

---

# Current State

## 인스펙션으로 확인된 사실 (코드 기준, brainstorm §7 B보다 정확)

### `Button` 컴포넌트 현황

| 항목 | 현재 |
|---|---|
| 파일 | `src/components/Button.tsx` (60줄) |
| 시그니처 | `{ label, variant?, size?, loading?, disabled?, ...ButtonHTMLAttributes }` |
| Inline spinner | line 44-55 (animate-spin SVG) |
| `loading` prop 동작 | `disabled \|\| loading` + spinner + label |
| `aria-busy` | **없음** — 필요 |
| `type` prop | **명시 안 됨** — `<button>` 기본 (submit 가능성 있음) |
| Import | `App.tsx`만 (실제 사용 0) → **dead code** |
| Test | `Button.test.tsx` 없음 |

→ **Brainstorm §7 B "Button.loading 추가"는 이미 구현됨.** Plan-B의 실제 범위는 "Button을 살려서 일관된 패턴으로 마이그레이션 + a11y 보강"입니다.

### Inline `<button>` 사용 페이지

| 파일 | 버튼 | 비고 |
|---|---|---|
| `src/pages/Accounts/AccountEdit/index.tsx` | 232-245 | 저장/취소 (Plan-A1 catch 추가와 동시) |
| `src/pages/Accounts/AccountDetail.tsx` | 84-105 | 뒤로/수정/삭제 |
| `src/pages/Accounts/index.tsx` | 130-291 | 검색/정렬/복사/추가/스크롤 (~6개) |
| `src/pages/Templates/index.tsx` | 49-103 | 템플릿 생성/수정 |
| `src/pages/Templates/TemplateEdit/index.tsx` | 184-203 | 저장/취소 |
| `src/pages/Settings/index.tsx` | 44-62 | 이동/앱 정보 |
| `src/pages/Settings/components/AutofillSection.tsx` | 다수 | 이미 자체 `loading`/`syncing` state 보유 |
| `src/pages/Settings/components/DataSection.tsx` | (백업) | |
| `src/pages/Settings/components/SecuritySection.tsx` | (생체/잠금) | |
| `src/pages/Home.tsx` | (다수) | 파일 생성/열기/삭제/복원 |
| `src/pages/Auth.tsx` | (제출) | 자체 loading state |
| `src/pages/CreateVault/index.tsx` | 87-94, (Stepper) | 이미 `isSubmitting` + `disabled={isSubmitting}` |
| `src/components/dialogs/FormDialog.tsx` | 113-128 | submit/cancel inline |
| `src/components/dialogs/ConfirmDialog.tsx` | 41-56 | confirm/cancel inline |

### 이미 `loading` prop 보유 컴포넌트 (Plan-B 작업 0)

- `FormDialog` (line 14, 124-128)
- `ConfirmDialog` (line 13, 52-55)
- `Button` 자체

### `aria-busy` 부재

- `FormDialog`/`ConfirmDialog`의 inline submit 버튼에 `aria-busy` 없음
- `Button.tsx`의 `loading` prop이 spinner는 표시하지만 `aria-busy` 미설정

---

# Architecture

## Button.tsx 보강

```ts
// 추가
interface ButtonProps {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  type?: "button" | "submit" | "reset";  // 명시적 default "button"
}

// 변경
- {loading ? <svg> : null}
+ {loading ? <Spinner size="sm" aria-hidden="true" /> : null}

// aria-busy 추가
- <button disabled={disabled || loading}>
+ <button type={type ?? "button"} disabled={disabled || loading} aria-busy={loading || undefined}>
```

## 마이그레이션 정책

### Plan-B-1 (인프라)

| 파일 | 변경 |
|---|---|
| `Button.tsx` | Spinner 통합 + `aria-busy` + `type` 명시 + 4+ 단위 테스트 |
| `FormDialog.tsx` | line 113-128 inline → `<Button>` (cancel: ghost, submit: primary) |
| `ConfirmDialog.tsx` | line 41-56 inline → `<Button>` (cancel: ghost, confirm: danger/primary) |

### Plan-B-2 (자주 쓰는 페이지)

각 페이지의 inline `<button>` → `<Button>` 매핑. 기존 `disabled`/`loading` state는 `<Button loading={...} disabled={...}>` prop으로 연결.

| 페이지 | 변경 |
|---|---|
| `Accounts/index.tsx` | 검색 토글(130-147), 정렬(148-165), 클리어(180-189), 복사(254-269), 추가 FAB(275-283), 스크롤(284-291) — ~6개 |
| `AccountDetail.tsx` | 뒤로(83-90), 수정(91-98), 삭제(99-105), Favorite(126-136) — 4개 |
| `AccountEdit/index.tsx` | 취소(232-238), 저장(239-245) — 2개 (Plan-A1 catch 추가와 동시) |
| `Home.tsx` | 파일 생성/열기/삭제/복원 등 — ~4개 |
| `Auth.tsx` | PIN 제출 — 1개 |
| `CreateVault/index.tsx` | 홈(87-94), Stepper 내부 버튼, Step1 다음, Step2 이전/제출/건너뛰기 — ~5개 |

### Plan-B-3 (나머지)

| 페이지 | 변경 | 비고 |
|---|---|---|
| `Templates/index.tsx` | 템플릿 생성/수정 — 2개 | inline spinner 교체는 별도 |
| `TemplateEdit/index.tsx` | 저장/취소 + 삭제 confirm — ~3개 | |
| `Settings/index.tsx` | 이동/앱 정보 — 2개 | |
| `AutofillSection.tsx` | status/활성화/동기화/삭제 — 4~5개 | `loading`/`syncing` state 분리 유지 (Plan-B-3 리뷰 결정) |
| `DataSection.tsx` | 백업 버튼 — 2~3개 | |
| `SecuritySection.tsx` | 생체/잠금 — 2~3개 | |

## Plan-B-1의 ConfirmDialog 통합 시 Plan-A1과의 상호작용

`ConfirmDialog`는 이미 Plan-A1에서 `error?: string | null` prop 추가. Plan-B-1의 마이그레이션과 **동시 진행 가능**:
- Plan-A1: `error` prop + 인라인 영역
- Plan-B-1: inline button → `<Button>`
- 같은 PR에 둘 다 들어갈 수 있지만, **Plan-A1 PR과 Plan-B-1 PR 분리 권장** (검증 부담 분산)

## FormDialog/ConfirmDialog의 `<Button>` 채택 시 라벨 처리

```tsx
<Button
  type="submit"
  loading={isLoading}
  disabled={disabled}
>
  {isLoading ? "처리 중..." : submitLabel}
</Button>
```

**라벨 분기 유지** — spinner는 in-flight 시각, 라벨은 사용자가 기다리는 액션 명시. 둘 다 필요.

---

# 결정 (Plan-B 대화형 리뷰 결과, 2026-08-30)

| Q | 결정 | 근거 |
|---|---|---|
| 1차 PR 범위 | **3-PR 분할** (인프라 / 자주 / 나머지) | 30+ 버튼 일괄 1 PR은 너무 큼, 3 PR로 안전하게 |
| AutofillSection `loading`/`syncing` 통합 | **그대로 분리 유지** | Action-1:1 매핑, line 298 `syncing \|\| loading` OR 패턴이 busy 신호 효과 제공. 통합은 Plan-B 무관, 별도 리팩토링 |
| AccountDetail Plan-A1 결합 | **Plan-B-2에서 동시** (AccountEdit와 함께) | Plan-A1은 Plan-B-2와 동시 머지, 1 PR에 둘 다 가능 |
| ConfirmDialog `error` prop | **Plan-A1에서 먼저**, Plan-B-1이 Button 마이그레이션과 동시 가능 | 시그니처는 Plan-A1, Button 매핑은 Plan-B-1 |
| 사용 빈도 낮은 Settings/* | **Plan-B-3으로 분리** | 회귀 위험 낮고 영향 작음, 마지막에 처리 |

---

# Plan-B-1 상세 (인프라)

## Proposed Changes

### 1. `src/components/Button.tsx` — a11y 보강 + Spinner 통합

- inline `<svg>` (line 44-55) → `<Spinner size="sm" aria-hidden="true" />` (Plan-A2 의존)
- `<button>`에 `aria-busy={loading || undefined}` 추가
- `type` prop 명시 (default "button")

### 2. `src/components/Button.test.tsx` (신규)

- default label 렌더
- `loading=true` → `<Spinner>` 렌더, `aria-busy="true"`
- `disabled=true` → disabled 속성
- `type="submit"` → type 속성
- variant별 클래스 검증

### 3. `src/components/dialogs/FormDialog.tsx` — inline → `<Button>`

- line 113-128 inline `<button type="button">` (취소) + `<button type="submit">` (확인) → `<Button>`
- cancel: `variant="ghost"`
- submit: `variant="primary"`, `type="submit"`, `loading={isLoading}`, `disabled={isLoading || disabled}`
- "처리 중..." 라벨 분기 유지

### 4. `src/components/dialogs/ConfirmDialog.tsx` — inline → `<Button>`

- line 41-56 동일 처리
- cancel: `variant="ghost"`
- confirm: `variant="danger"` (기본) 또는 `variant="primary"`

### 5. 테스트 확장

- `FormDialog.test.tsx` (확장) — submit 시 Button이 loading 처리
- `ConfirmDialog.test.tsx` (확장) — confirm 시 Button이 loading 처리 + `error` prop (Plan-A1 동시 머지 시)

## Tests (Plan-B-1)

- 단위: `Button.test.tsx` (4+), `FormDialog.test.tsx` 확장, `ConfirmDialog.test.tsx` 확장
- E2E: 기존 11개 spec 통과 (Playwright) — 회귀 0
- Android: `compileDebugKotlin` + `testDebugUnitTest`

## Risks (Plan-B-1)

- Plan-A2 미완료 시 Button.tsx가 Spinner import 실패 → **Plan-A2 먼저 머지 필수**
- Dialog 사용자 적어 회귀 위험 낮음
- ConfirmDialog는 Plan-A1의 `error` prop과 동시 작업 가능

---

# Plan-B-2 상세 (자주 쓰는 페이지)

## Proposed Changes

### 1. `src/pages/Accounts/AccountEdit/index.tsx` — 저장/취소 + Plan-A1 catch 동시

```tsx
// Plan-A1과 동시
const [saveError, setSaveError] = useState<string | null>(null);
const handleSave = async () => {
  try {
    // 기존 로직
    navigate(`/accounts/${savedAccount.id}`);
  } catch (err) {
    setSaveError(mapError(err));
  }
};

// Button 마이그레이션
<Button variant="ghost" onClick={() => navigate(-1)}>취소</Button>
<Button variant="primary" onClick={handleSave}>저장</Button>
{saveError && <p role="alert" data-testid="account-edit-error">{saveError}</p>}
```

### 2. `src/pages/Accounts/AccountDetail.tsx` — 뒤로/수정/삭제/Favorite + Plan-A1 catch 동시

```tsx
// Plan-A1과 동시
const [deleteError, setDeleteError] = useState<string | null>(null);
const handleDelete = async () => {
  try {
    await deleteAccount(account.id);
    navigate("/accounts");
    setShowDeleteConfirm(false);
  } catch (err) {
    setDeleteError(mapError(err));
    // setShowDeleteConfirm(false) 호출 안 함
  }
};

<Button variant="ghost" onClick={handleBack}>← 뒤로 가기</Button>
<Button variant="primary" onClick={() => navigate(`/accounts/${account.id}/edit`)}>수정</Button>
<Button variant="ghost" onClick={() => setShowDeleteConfirm(true)}>삭제</Button>
<Button variant="ghost" onClick={() => void updateAccount(...)}>★ Favorite</Button>

<ConfirmDialog
  open={showDeleteConfirm}
  error={deleteError}
  // ... 기존
/>
```

### 3. `src/pages/Accounts/index.tsx` — 6개 버튼 + Plan-A2 spinner

- Plan-A2에서 spinner 추가 시 같은 PR에 통합 가능
- 검색 토글(130), 정렬(148), 클리어(180), 복사(254), 추가 FAB(275), 스크롤(284) → `<Button>`

### 4. `src/pages/Home.tsx` — ~4개 버튼

- 파일 생성/열기/삭제/복원

### 5. `src/pages/Auth.tsx` — PIN 제출 1개

- 자체 `loading` state → `<Button loading={isLoading} type="submit">`

### 6. `src/pages/CreateVault/index.tsx` — ~5개 버튼

- 홈(87), 다음/이전/제출/건너뛰기
- 이미 `isSubmitting` + `disabled={isSubmitting}` 패턴 → `<Button loading={isSubmitting} disabled={isSubmitting}>`

## Tests (Plan-B-2)

- 신규 통합 테스트: AccountEdit, AccountDetail, AccountList
- E2E: 기존 11개 spec 통과
- Plan-A1과 동시 머지 시 양쪽 영향 검증

## Risks (Plan-B-2)

- Plan-A1과 결합 의존 — Plan-A1 머지 후 또는 동시
- Plan-A2 (Accounts spinner)와 결합 가능 — 같은 PR에 통합 권장
- CreateVaultPage는 Plan-7a E2E 영향 — `e2e/01-create-vault.spec.ts` 회귀 0 검증

---

# Plan-B-3 상세 (나머지)

## Proposed Changes

### 1. `src/pages/Templates/index.tsx` — 2개 버튼

- 템플릿 생성, 수정

### 2. `src/pages/Templates/TemplateEdit/index.tsx` — 3개 버튼 + Plan-A1 catch 동시

- 저장, 취소, 삭제
- `handleDelete`에 try/catch 추가 (Plan-A1 #3)
- `handleSave`에 `setErrors([mapError(err)])` (Plan-A1 #4)

### 3. `src/pages/Settings/index.tsx` — 2개 버튼

- 이동, 앱 정보

### 4. `src/pages/Settings/components/AutofillSection.tsx` — 4~5개 버튼

- `loading`/`syncing` state 분리 유지
- `<Button loading={loading}>` / `<Button loading={syncing}>` 매핑만
- line 298 `disabled={syncing || loading}` OR 패턴 유지 (이미 busy 신호 효과)

### 5. `src/pages/Settings/components/DataSection.tsx` — 2~3개 버튼

### 6. `src/pages/Settings/components/SecuritySection.tsx` — 2~3개 버튼

## Tests (Plan-B-3)

- 신규 통합 테스트: AutofillSection, DataSection, SecuritySection, TemplateEdit
- E2E: 기존 11개 spec 통과
- Plan-A1의 `TemplateEdit.handleSave` catch 변경은 Plan-A1과 Plan-B-3이 같은 파일 → 동시 머지 필요

## Risks (Plan-B-3)

- `TemplateEdit`은 Plan-A1과 결합 (catch 변경) — 동시 머지
- `AutofillSection`의 `loading`/`syncing` state는 통합하지 않음 (리뷰 결정)
- Settings/*는 빈도 낮아 회귀 위험 낮음

---

# Tests (전체)

## 단위 테스트

| PR | 파일 | 케이스 |
|---|---|---|
| B-1 | `Button.test.tsx` (신규) | 4+ |
| B-1 | `FormDialog.test.tsx` (확장) | submit loading |
| B-1 | `ConfirmDialog.test.tsx` (확장) | confirm loading + `error` prop |
| B-2 | `AccountEdit.test.tsx` (신규) | 저장 catch + Button |
| B-2 | `AccountDetail.test.tsx` (신규) | 삭제 catch + Button + ConfirmDialog `error` |
| B-2 | `AccountList.test.tsx` (신규) | Plan-A2 spinner 통합 |
| B-2 | `CreateVaultPage.test.tsx` (확장) | Button 마이그레이션 |
| B-3 | `AutofillSection.test.tsx` (신규) | loading/syncing 분리, Button 매핑 |
| B-3 | `TemplateEdit.test.tsx` (신규) | 저장/삭제 catch + Button |

## E2E (Playwright)

- **회귀 0 가정** — Button 마이그레이션은 시각/동작 동등
- 기존 11개 spec 통과 확인 (사용자 직접 실행)
- Plan-7a의 `e2e/01-create-vault.spec.ts` 영향 검증

## Android E2E

- **변경 없음**. Plan-B는 React 측 한정

## 회귀 게이트 (각 PR)

- `npm run check` 통과
- `npm run lint` 통과
- `npm run build` 통과
- Android: `compileDebugKotlin` + `testDebugUnitTest` 통과
- 사용자 Playwright E2E 직접 실행 — 회귀 0

---

# Out of Scope (후속)

- **a11y audit:** axe-core CI + 키보드 Playwright — Plan-B의 `aria-busy`는 자연 보강
- **Plan-D:** 테마 FOUC 가드
- **`useFormSubmit` / `useAsync`:** Q2 확정으로 포함 안 함
- **`onError` callback:** Q2 확장으로 포함 안 함
- **`<Skeleton>`/`<SkeletonList>`:** IDB 로컬에 불필요, 만들지 않음

---

# Cross-Plan Integration

**Upstream (이 plan이 의존):**
- ✅ Plan-A2 (`<Spinner>` 컴포넌트 — Plan-B-1이 import)
- ⚠️ **Plan-A1** (`mapError` — Plan-B-2의 AccountEdit/AccountDetail, Plan-B-3의 TemplateEdit에서 catch 추가 시 활용)

**Downstream (이 plan이 제공):**
- **a11y audit:** `aria-busy` 패턴, focus ring, Button a11y 레퍼런스
- **2차 PR (마이그레이션):** 모든 페이지 inline button → Button 통일 (본 plan에 포함)

**호환 시그니처:**
- `<Button label variant size loading disabled type ...ButtonHTMLAttributes />`
- Dialog `isLoading`/`disabled`/`errorMessage`/`error` prop 그대로 (호출자 API 변화 0)

---

# Verification Checklist

## Plan-B-1

- [x] `Button.tsx` inline SVG spinner + aria-busy + type 명시
- [x] `Button.test.tsx` 신규, 10 케이스
- [x] `FormDialog.tsx` inline submit/cancel → Button
- [x] `ConfirmDialog.tsx` inline confirm/cancel → Button
- [x] `npm run typecheck` 통과
- [x] `npm run lint` 통과 (신규 0 에러)
- [x] `npm run test` 440/440 통과
- [x] `npm run build` 통과
- [x] Android: `compileDebugKotlin` + `testDebugUnitTest` 통과
- [ ] 사용자가 Playwright E2E 직접 실행 시 회귀 0

## Status (2026-08-30)

**✅ Plan-B-1 완료** — 8개 작업 항목 verified.

| # | 항목 | 상태 | 근거 |
|---|---|---|---|
| 1 | Button 보강 | ✅ | `src/components/Button.tsx` (variant×4, size×3, loading, aria-busy, type, inline SVG) |
| 2 | Button.test.tsx | ✅ | 10 케이스, 1.39s |
| 3 | FormDialog → Button | ✅ | line 86-99, ghost cancel + primary submit + loading |
| 4 | ConfirmDialog → Button | ✅ | line 49-65, variant prop 매핑 |
| 5 | Dialog 테스트 | ✅ | FormDialog + ConfirmDialog 그대로 통과 |
| 6 | check | ✅ | 33 test files / 440 tests / 0 신규 lint / build 1.73s |
| 7 | Android | ✅ | compileDebugKotlin + testDebugUnitTest UP-TO-DATE, 3s |
| 8 | Debug 함정 | ✅ | **Spinner 컴포넌트 `aria-label="로딩 중"`이 button의 accessible name 차지** → Button 안에서는 inline SVG + `aria-hidden="true"` 사용. W3C accname-1.2 자식 name-from-contents 규칙. |

**Debug 노트 (Plan-B-1 함정):**
- **Spinner의 `aria-label`이 button의 accessible name에 포함됨**. W3C accname 알고리즘: 부모에 `aria-label`이 없을 때 자식 콘텐츠가 name 계산에 포함. 자식에 `aria-label`이 있으면 그것이 우선. Button은 자식 콘텐츠(text + Spinner aria-label)에서 name 계산 → Spinner의 "로딩 중"이 text와 결합되거나 차지.
- **해결**: Button 안에서는 Spinner 컴포넌트 사용 안 함. `aria-hidden="true"`인 inline SVG 사용. Spinner 컴포넌트는 button 외부(예: AccountList의 spinner)에서만 사용.
- 동일 함정은 `<Tooltip aria-label="X"><button>...</button></Tooltip>` 같은 패턴에서도 발생 가능 — Tooltip의 aria-label이 button의 name에 영향 줄 수 있음.

**git diff:**
- `src/components/Button.tsx` (variant/size/type 명시, inline SVG spinner, aria-busy, data-testid, data-loading)
- `src/components/Button.test.tsx` (신규 10 케이스)
- `src/components/dialogs/FormDialog.tsx` (inline submit/cancel → Button)
- `src/components/dialogs/ConfirmDialog.tsx` (inline confirm/cancel → Button, `confirmClassName` 제거)

**남은 일:**
- 사용자가 Playwright E2E 직접 실행 (Dialog 변경은 사용자 적어 회귀 위험 낮음)
- 1 commit
- **Plan-B-2 (자주 쓰는 페이지)**: Accounts/AccountDetail/AccountEdit/Home/Auth/CreateVault + Plan-A1 catch 결합
- **Plan-B-3 (나머지)**: Templates/*, Settings/*

## Plan-B-2

- [ ] `AccountEdit` 저장/취소 → Button + Plan-A1 catch + 인라인 에러
- [ ] `AccountDetail` 뒤로/수정/삭제/Favorite → Button + Plan-A1 catch + ConfirmDialog error
- [ ] `Accounts/index.tsx` 6개 버튼 → Button + Plan-A2 spinner 통합 (동시 PR)
- [ ] `Home.tsx` 4개 버튼 → Button
- [ ] `Auth.tsx` PIN 제출 → Button
- [ ] `CreateVault/index.tsx` 5개 버튼 → Button
- [ ] Plan-7a의 `e2e/01-create-vault.spec.ts` 회귀 0
- [ ] (기타 Plan-B-1 게이트)

## Plan-B-3

- [ ] `Templates/index.tsx` 2개 버튼
- [ ] `TemplateEdit/index.tsx` 3개 + Plan-A1 catch 동시
- [ ] `Settings/index.tsx` 2개
- [ ] `AutofillSection.tsx` 4~5개 (loading/syncing 분리 유지)
- [ ] `DataSection.tsx` 2~3개
- [ ] `SecuritySection.tsx` 2~3개
- [ ] (기타 Plan-B-1 게이트)
