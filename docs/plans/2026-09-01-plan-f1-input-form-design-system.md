# Plan-F1 — Input/Form Design System (Input + Select + Textarea + Checkbox)

- Date: 2026-09-01
- Source: [brainstorm 2026-09-01-input-form-design-system](../brainstorms/2026-09-01-input-form-design-system.md) §8 (Plan 분할 결정: **F1 이 plan, F2 후속**)
- 선행: Plan-B-1/2/3 (Button 통일), Plan-A1 (mapError + SyncErrorBanner), Plan-D PR 1
- 후속: **Plan-F2** (Search input + Range slider + rightSlot input + label-wrapping input, 별도 brainstorm 예정)
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- 결정 사항: §결정 (모든 Q 확정) + §F2 분리
- **신규 plan** — Track 3 brainstorm §7/§8 Input/Form Design System을 단일 plan으로 분리

---

# Goal

**Input/Select/Textarea/Checkbox 디자인 시스템 통일** 완료 시 다음이 참:

1. `src/components/inputs/Input.tsx` + `Checkbox.tsx` 신규 컴포넌트
2. 호출처 25곳 (10페이지/컴포넌트) 단일 PR 마이그레이션
3. 7가지 className 변종 → 1가지 통일 패턴
4. 회귀 게이트: `typecheck` / `lint` / `test` / `build` / Android compile+unitTest / **Playwright E2E 44/44** 모두 통과
5. a11y 기본 내장: `aria-invalid` + `aria-describedby` + `aria-readonly` + `aria-disabled` 표준화

**범위 밖 (Plan-F2 — 후속 brainstorm 예정)**:
- Search input (icon overlay) — `Accounts/index.tsx:212`, `WebsiteSelector.tsx:148`
- Range slider — `PasswordGenerator.tsx:144`
- Input with right slot (button inside) — `PasswordFieldEdit.tsx:15`, `PasswordGenerator.tsx:196`
- Label-wrapping input — `AccountTitleSection.tsx` (label 안에 input 구조)

---

# Current State (2026-09-01 인스펙션)

## 컴포넌트 현황

| 컴포넌트 | 상태 |
|---|---|
| `Button.tsx` | ✅ 통일 완료 (Plan-B-1/2/3) |
| `Spinner.tsx` | ✅ 통일 완료 (Plan-A2) |
| `SyncErrorBanner.tsx` | ✅ 통일 완료 (Plan-A1) |
| `PinStrengthMeter.tsx` | ✅ 컴포넌트 (Plan-4) |
| `Input.tsx` | ❌ 없음 |
| `Checkbox.tsx` | ❌ 없음 |

## 인라인 input/select/textarea 25개 사용처 (7가지 className 변종)

| # | 파일 | input/select 개수 | 변종 | 비고 |
|---|---|---|---|---|
| 1 | `FieldEditor.tsx` (Accounts) | 6 input + 1 select | A1 (8) | Account 필드 편집 |
| 2 | `TemplateFieldEditor.tsx` (Templates) | 4 input + 1 select + 1 textarea | A1/A2/A3 (6) | 템플릿 필드 편집, A2 error + A3 readonly |
| 3 | `AccountTitleSection.tsx` (Accounts) | 4 input | A1 (4) | label-wrapping input 구조 — F1에서 처리 (label prop) |
| 4 | `Templates/TemplateEdit/index.tsx` | 1 input + 1 textarea | A1 변형 (2) | 템플릿 이름 + 설명, `text-sm` 누락 |
| 5 | `UISection.tsx` (Settings) | 1 select | B2 (1) | font-size, `rounded-lg` + `py-1.5` |
| 6 | `SecuritySection.tsx` (Settings) | 1 select | B2 (1) | auto-lock, `rounded-lg` + `py-1.5` + disabled state |
| 7 | `NameStep.tsx` (CreateVault) | 1 input | C (1) | aria-invalid + error 메시지 |
| 8 | `PinStep.tsx` (CreateVault) | 1 input | C (1) | PIN 입력 |
| 9 | `Auth.tsx` | 1 input | D (1) | PIN, `text-base` + `py-3` (lg) |
| 10 | `PinChangeDialog.tsx` | 3 input | B1 (3) | PIN 3개 |
| 11 | `FileOpenDialog.tsx` | 1 input | C (1) | PIN |
| 12 | `FileCreateDialog.tsx` | 2 input + 1 checkbox | C + inline (3) | 파일명 + PIN + checkbox |

**변종 7가지**:
- **A1** — `rounded-2xl border px-3 py-2 text-sm ... focus:border-accent` (가장 흔함, FieldEditor/TemplateFieldEditor/AccountTitleSection)
- **A2** — A1 + `border-[var(--color-error)]` (TemplateFieldEditor label)
- **A3** — A1 + `bg-code-bg text-muted` readonly (TemplateFieldEditor readonly)
- **B1** — `rounded-lg border px-3 py-2 text-sm focus:border-accent + focus:ring/20` (PinChangeDialog)
- **B2** — `rounded-lg border px-3 py-1.5 text-sm focus:ring-2 + focus:border-transparent` (UISection/SecuritySection)
- **C** — `rounded-2xl border px-4 py-3 text-sm bg-code-bg focus:border-accent` (NameStep/PinStep/FileOpenDialog/FileCreateDialog)
- **D** — `rounded-lg border px-4 py-3 text-base focus:border-accent + focus:ring/20` (Auth)

## Checkbox 1개 (FileCreateDialog) — `accent-[var(--color-accent)]`

## 기존 E2E 셀렉터 (Playwright)

```ts
// placeholder 기반
page.getByPlaceholder('항목 이름')
page.getByPlaceholder('입력하세요')
page.getByPlaceholder('https://www.example.com/login')
page.getByPlaceholder('제목이나 이메일로 검색...')

// label 기반
page.getByLabel('제목')
page.getByLabel('이메일')

// data-testid (CreateVault 전용)
page.locator('[data-testid="create-vault-name-input"]')
```

**마이그레이션 시 영향 0 가능**: `placeholder`와 `label` prop을 Input에 그대로 전달하면 기존 셀렉터 모두 유지. **단, `getByLabel` 사용 케이스**는 `<label htmlFor>` + `<input id>` 연결이 명시적이어야 함 (현재 일부 inline input은 label-input 연결 미흡 → 마이그레이션 시 보강).

## 호출처 검색 결과 (cross-check 완료)

`grep -rE "<input|<textarea|<select" src/ --include="*.tsx" -l`:
- **18 파일** (테스트 제외 17)
- 인라인 input/select/textarea **34개** (F1: 25 + F2: 9 — search/slider/rightSlot)
- Checkbox **2개** (F1: 1 + F2: 1 — PasswordGenerator checkbox + FileCreateDialog)

F1이 흡수하는 25 호출처 (위 표 1~12의 합) + 4 checkbox = **25개 input/select/textarea + 1 checkbox** = **26개 컴포넌트 사용**.

---

# Relevant Files

| 파일 | 역할 | 변경 |
|---|---|---|
| `src/components/inputs/Input.tsx` (신규) | 단일 input/select/textarea 컴포넌트 (as prop) | 신규 |
| `src/components/inputs/Checkbox.tsx` (신규) | 단일 checkbox 컴포넌트 | 신규 |
| `src/components/inputs/index.ts` (신규) | barrel export | 신규 |
| `src/components/inputs/Input.test.tsx` (신규) | 단위 테스트 | 신규 |
| `src/components/inputs/Checkbox.test.tsx` (신규) | 단위 테스트 | 신규 |
| `src/pages/Accounts/AccountEdit/components/FieldEditor.tsx` | Account 필드 편집 | 마이그레이션 |
| `src/pages/Accounts/AccountEdit/components/AccountTitleSection.tsx` | Account 제목/URL/패키지/태그 | 마이그레이션 |
| `src/pages/Accounts/AccountEdit/components/PasswordFieldEdit.tsx` | 비밀번호 필드 (F2 — rightSlot) | **변경 0** (F1) |
| `src/pages/Accounts/AccountEdit/components/WebsiteSelector.tsx` | 사이트 선택 (F2 — search) | **변경 0** (F1) |
| `src/pages/Accounts/AccountEdit/components/PasswordGenerator.tsx` | 비밀번호 생성기 (F2 — slider/rightSlot/checkbox) | **변경 0** (F1) |
| `src/pages/Accounts/index.tsx` | Account 리스트 (F2 — search input) | **변경 0** (F1) |
| `src/pages/Auth.tsx` | PIN 인증 | 마이그레이션 |
| `src/pages/AutofillTestLogin.tsx` | autofill 테스트 페이지 | 마이그레이션 (Playwright 회귀 확인) |
| `src/pages/AutofillTestLogin.tsx` | F2 — 추가 input 존재 시 | cross-check 필요 |
| `src/pages/CreateVault/steps/NameStep.tsx` | 새 파일 이름 (error 상태) | 마이그레이션 |
| `src/pages/CreateVault/steps/PinStep.tsx` | PIN 설정 | 마이그레이션 |
| `src/pages/Settings/components/PinChangeDialog.tsx` | PIN 변경 | 마이그레이션 |
| `src/pages/Settings/components/SecuritySection.tsx` | 보안 설정 (auto-lock select) | 마이그레이션 |
| `src/pages/Settings/components/UISection.tsx` | UI 설정 (font-size select) | 마이그레이션 |
| `src/pages/Templates/TemplateEdit/index.tsx` | 템플릿 편집 (이름/설명) | 마이그레이션 |
| `src/pages/Templates/TemplateEdit/components/TemplateFieldEditor.tsx` | 템플릿 필드 | 마이그레이션 |
| `src/components/dialogs/FileCreateDialog.tsx` | 파일 생성 (filename + PIN + checkbox) | 마이그레이션 |
| `src/components/dialogs/FileOpenDialog.tsx` | 파일 열기 (PIN) | 마이그레이션 |

---

# Architecture

```
[사용자 입력]
   ↓
[Input/Checkbox 컴포넌트]
   ├─ Input: as="input" | "select" | "textarea"
   │        size="sm" | "md" | "lg"
   │        variant="default" | "readonly" | "error" | "disabled"
   │        label? + errorId? + helperText? + a11y 자동
   └─ Checkbox: label? + errorId? + a11y 자동
   ↓
[FormDialog/자체 form] (변경 0)
   ↓
[store mutation] (변경 0)
   ↓
[암호화/DB] (변경 0)
```

**F1 책임 범위**: 컴포넌트 신규 + 호출처 25곳 마이그레이션. **store/FormDialog/Database/encryption 0 변경**.

---

# Proposed Changes

## 1. `src/components/inputs/Input.tsx` (신규)

```tsx
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

export type InputSize = "sm" | "md" | "lg";
export type InputVariant = "default" | "readonly" | "error" | "disabled";

interface BaseProps {
  as?: "input" | "select" | "textarea";
  size?: InputSize;
  variant?: InputVariant;
  label?: string;
  errorId?: string;
  helperText?: string;
}

const sizeStyles: Record<InputSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-3 py-2 text-sm",  // default
  lg: "px-3 py-3 text-base",
};

const variantStyles: Record<InputVariant, string> = {
  default: "bg-[var(--color-bg)] text-[var(--color-text-h)] border-[var(--color-border)]",
  readonly: "bg-[var(--color-code-bg)] text-[var(--color-text-muted)] border-[var(--color-border)] cursor-default",
  error: "bg-[var(--color-bg)] text-[var(--color-text-h)] border-[var(--color-error)]",
  disabled: "bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-border)] opacity-50 cursor-not-allowed",
};

const baseStyles =
  "w-full rounded-lg border outline-none transition focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed";

type InputProps =
  & BaseProps
  & Omit<InputHTMLAttributes<HTMLInputElement>, "size">  // 충돌 방지
  & Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">
  & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size">;

export const Input = forwardRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, InputProps>(
  ({ as = "input", size = "md", variant = "default", label, errorId, helperText, className = "", ...props }, ref) => {
    const cn = `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`;

    const ariaProps = {
      ...(variant === "error" && { "aria-invalid": true as const, "aria-describedby": errorId }),
      ...(variant === "readonly" && { "aria-readonly": true as const }),
      ...(variant === "disabled" && { "aria-disabled": true as const }),
    };

    const Element = as;

    const inputEl = (
      <Element
        ref={ref as any}
        className={cn}
        disabled={variant === "disabled" || (props as any).disabled}
        readOnly={variant === "readonly" || (props as any).readOnly}
        {...ariaProps}
        {...(props as any)}
      />
    );

    if (!label && !helperText) return inputEl;

    return (
      <div>
        {label && <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{label}</label>}
        {inputEl}
        {helperText && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{helperText}</p>}
      </div>
    );
  }
);
```

**a11y 자동 처리**:
- `variant="error"` → `aria-invalid="true"` + `aria-describedby={errorId}` 자동
- `variant="readonly"` → `aria-readonly="true"` 자동
- `variant="disabled"` → `aria-disabled="true"` + `disabled` 자동

**E2E 호환**:
- `placeholder`, `value`, `onChange`, `id` 등 모든 표준 props 그대로 전달
- 기존 `getByPlaceholder('항목 이름')` 셀렉터 그대로 동작

## 2. `src/components/inputs/Checkbox.tsx` (신규)

```tsx
import type { InputHTMLAttributes, ReactNode } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label: ReactNode;  // required
  checked: boolean;
  errorId?: string;
}

export const Checkbox = ({ label, errorId, className = "", ...props }: CheckboxProps) => {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        className={`h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 ${className}`}
        aria-describedby={errorId}
        {...props}
      />
      <span className="text-sm text-[var(--color-text)]">{label}</span>
    </label>
  );
};
```

## 3. `src/components/inputs/index.ts` (신규)

```ts
export { Input } from "./Input";
export type { InputSize, InputVariant } from "./Input";
export { Checkbox } from "./Checkbox";
```

## 4. 호출처 마이그레이션 (25 호출처)

### 매핑 규칙

| 변종 | Input prop 매핑 |
|---|---|
| A1 | `<Input size="md" />` |
| A2 (error) | `<Input variant="error" errorId="..." />` + error 메시지 |
| A3 (readonly) | `<Input variant="readonly" value={...} readOnly />` |
| B1 | `<Input size="md" />` (focus style 자동 통일) |
| B2 | `<Input size="sm" />` |
| C | `<Input size="md" />` (size는 md, padding 통일) |
| D (Auth) | `<Input size="lg" />` |

### 마이그레이션 순서 (단일 PR)

1. **FieldEditor.tsx** (7개) — `variant="error"` 케이스 1개
2. **TemplateFieldEditor.tsx** (6개) — A2 error + A3 readonly 케이스 포함
3. **AccountTitleSection.tsx** (4개) — label prop 사용
4. **Templates/TemplateEdit/index.tsx** (2개) — `<Input as="textarea">` 케이스
5. **UISection.tsx** (1개) — size="sm"
6. **SecuritySection.tsx** (1개) — size="sm" + variant="disabled"
7. **NameStep.tsx** (1개) — `variant="error"` + errorId
8. **PinStep.tsx** (1개)
9. **Auth.tsx** (1개) — size="lg"
10. **PinChangeDialog.tsx** (3개)
11. **FileOpenDialog.tsx** (1개)
12. **FileCreateDialog.tsx** (2개 input + 1 checkbox)
13. **AutofillTestLogin.tsx** (2개) — E2E 0 영향 (test 미사용), D 변형 (`text-base` + `py-3`) → `size="lg"`

각 호출처에서:
- 기존 `<input className="..." />` → `<Input ... />`
- 기존 `<select className="..." />` → `<Input as="select" ... />`
- 기존 `<textarea className="..." />` → `<Input as="textarea" ... />`
- 기존 inline `<input type="checkbox" />` → `<Checkbox ... />`
- 기존 `<label>제목<input .../></label>` → `<Input label="제목" id="title" .../>` (자동 연결)

---

# Tests

## 단위 테스트

### `Input.test.tsx` (≥ 30 케이스)

```tsx
describe("Input", () => {
  // size (3)
  it("sm 사이즈 렌더", () => expect(...));
  it("md 사이즈 렌더 (default)", ...);
  it("lg 사이즈 렌더", ...);
  
  // variant (4)
  it("default variant 렌더", ...);
  it("readonly variant → aria-readonly + bg-code-bg", ...);
  it("error variant → aria-invalid + aria-describedby", ...);
  it("disabled variant → aria-disabled + opacity-50", ...);
  
  // as (3)
  it('as="input" → <input>', ...);
  it('as="select" → <select>', ...);
  it('as="textarea" → <textarea>', ...);
  
  // focus 스타일 (1)
  it("focus ring/border 적용", ...);
  
  // a11y (4)
  it("label prop이 있으면 <label> 렌더", ...);
  it("helperText prop이 있으면 <p> 렌더", ...);
  it("errorId가 aria-describedby로 연결", ...);
  it("placeholder/type 등 표준 HTML attribute 전달", ...);
  
  // 회귀 방지 (3)
  it("focus style (border + ring) 일관 적용", ...);
  it("rounded-lg 일관 적용 (Plan-F1 Q4)", ...);
  it("color 토큰 (var(--color-*)) 일관 사용", ...);
});
```

### `Checkbox.test.tsx` (5 케이스)

```tsx
describe("Checkbox", () => {
  it("checked=true → 체크 표시", ...);
  it("checked=false → 미체크", ...);
  it("disabled → 회색 + 클릭 불가", ...);
  it("label prop 렌더", ...);
  it("errorId가 aria-describedby로 연결", ...);
});
```

## 회귀 게이트

```bash
npm run typecheck       # 통과 필수
npm run lint            # (우리 변경 파일 에러 0)
npm run test            # 444/444+ (Input/Checkbox 단위 포함)
npm run build           # 통과
cd android && ./gradlew compileDebugKotlin testDebugUnitTest  # 통과
npx playwright test     # 44/44
```

**E2E 회귀 0 명시**: 기존 9 spec (`e2e/01`, `02`, `03`, `05`, `07`, `08`, `09`, `10`, `11`) 모두 `placeholder`/`getByLabel`/`data-testid` 셀렉터 유지 → 마이그레이션 시 셀렉터 변경 0. 단, `getByLabel` 사용 케이스에서 `<label htmlFor>` + `<input id>` 명시적 연결 보강 (AccountTitleSection).

**Android 영향 0**: webview 내 UI 변경 — native path 0 변경, Android E2E 0 영향.

---

# Risks

| 리스크 | 완화 |
|---|---|
| `as` prop 타입 안전성 (`forwardRef<HTMLInputElement \| HTMLSelectElement \| HTMLTextAreaElement>`) | `as any` 캐스트 사용 — 표준 패턴. 런타임 검증 없으니 호출자 주의. Plan-F1 한정으로 안전 (단일 파일, 호출처 명시적) |
| `getByLabel` 사용 E2E 케이스 (`Accounts/AccountTitleSection`) — 현재 `<label>제목<input/></label>` 구조 | 마이그레이션 시 `<Input label="제목" id="title" />` (자동 `<label htmlFor>` 생성). `e2e/05/09` "제목" 라벨 셀렉터 그대로 동작 |
| `getByPlaceholder` 사용 E2E 케이스 — 9개 spec 다수 | `Input`이 `placeholder` prop 그대로 전달 → 0 영향 |
| 기존 inline `<select>` 의 `className`에 `opacity-50 cursor-not-allowed` (SecuritySection) | `variant="disabled"` 매핑으로 흡수 |
| `PasswordGenerator.tsx` slider/readonly/checkbox — F1 범위 아님 (F2 후속) | 본 plan에서 변경 0 — 회귀 위험 0. 단, `PasswordGenerator.tsx` import에 Input/Checkbox 추가 안 함 (F1) |
| `AccountTitleSection.tsx`의 label-wrapping input 구조 | `Input`의 `label` prop이 자동으로 `<label htmlFor>` + `<input id>` 연결. F1에서 처리. F2의 "label-wrapping input" 항목은 AccountTitleSection의 다른 패턴 (예: 자체 wrapper) 이 있을 경우에만 |
| `disabled` HTML attribute vs `aria-disabled` 차이 | F1은 **둘 다 적용** — `variant="disabled"`일 때 native `disabled` + `aria-disabled="true"`. Form 제출/탭 순서에서 정확히 비활성화 |
| `readonly` vs `disabled` 차이 | `readonly`는 값은 보이지만 편집 불가 (submit 포함). `disabled`는 모든 상호작용 차단. F1은 두 variant 분리. `TemplateFieldEditor.tsx:111` readonly 자리 → `variant="readonly"` (값은 보임, password 생성 버튼 등 자식 컨트롤은 동작) |

---

# Out of Scope (Plan-F2 — 후속 brainstorm)

**F1은 25 호출처만 처리. F2 (별도 brainstorm 예정)**:
- Search input (icon overlay) — `Accounts/index.tsx:212`, `WebsiteSelector.tsx:148` → `Input`의 `leftIcon`/`rightIcon` API 확장 필요
- Range slider — `PasswordGenerator.tsx:144` → 별도 `Slider` 컴포넌트 또는 `Input`의 `type="range"` 지원 결정
- Input with right slot (button inside) — `PasswordFieldEdit.tsx:15`, `PasswordGenerator.tsx:196` → `Input`의 `rightSlot` API 확장 필요
- Label-wrapping input 구조 (AccountTitleSection 외 다른 사례) — F1의 `label` prop으로 흡수되지 않는 경우
- PasswordGenerator의 checkbox 1개 (F2) — FileCreateDialog의 checkbox는 F1

**Cross-Plan Integration**:
- **Plan-A1 (mapError)**: `Input`이 `errorId` + `aria-invalid` 자동 처리 → A1의 `SyncErrorBanner` 패턴과 정합. A1 영향 0
- **Plan-B-1/2/3 (Button)**: Button API (`label` prop 필수, 3 variant, 3 size) → Input API가 같은 패턴 차용. 영향 0
- **Plan-D PR 1 (RootRedirect)**: autofill UI 영향 0. 영향 0
- **Plan-7a (다단계 페이지)**: `NameStep`/`PinStep` 호출처가 F1에 포함. 영향 0

---

# Rollback

**단일 PR이므로 revert 1 커밋**:
```bash
git revert <merge-commit>  # 또는 rebase
```

**데이터 영향 0**: store/DB/FormDialog 0 변경 — 마이그레이션은 className → prop 매핑만. 컴포넌트만 제거하면 inline input으로 복귀.

**E2E 영향 0**: 셀렉터 유지 — 컴포넌트만 원복 시 E2E도 자동 복귀.

---

# 결정 (2026-09-01 brainstorm Q-table)

| Q | 결정 | 출처 |
|---|---|---|
| Q1 | Input + Select + Textarea + Checkbox 모두 통합 | 사용자 `c` |
| Q2 | 3 size (`sm`/`md`/`lg`) | 사용자 "그래" |
| Q3 | focus `border + ring/20` (B1 변형) | 사용자 "ㅁ" |
| Q4 | `rounded-lg` (4px) 통일 | 사용자 "이왕이면 lg 이정도만 사용해" |
| Q5 | 4 variant (default/readonly/error/disabled) — disabled는 별도 | 사용자 "native 말고 만들어따로" |
| Q6 | 단일 Input + as prop + 별도 Checkbox | 사용자 `b` |
| Q7 | 단일 PR 전체 (25 호출처) | 사용자 `b` |
| Q8 | 단위 + 기존 E2E 회귀 | 사용자 `b` |
| Plan 분할 (F1 메인 + F2 특수) | 사용자 `a` |

---

# Verification Checklist

- [ ] `Input.tsx` + `Checkbox.tsx` + `index.ts` 작성
- [ ] `Input.test.tsx` 30+ 케이스 통과
- [ ] `Checkbox.test.tsx` 5 케이스 통과
- [ ] 호출처 25곳 마이그레이션 완료
- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` (우리 변경 파일 에러 0)
- [ ] `npm run test` 444/444+ (신규 단위 포함)
- [ ] `npm run build` 통과
- [ ] Android `compileDebugKotlin` + `testDebugUnitTest` 통과
- [ ] Playwright E2E 44/44 통과
- [ ] commit + push + PR 개설
- [ ] Track 3 brainstorm cross-link 추가

---

# Status

- **2026-09-01**: Plan-F1 작성, Q1~Q8 확정, Plan 분할 결정 (`a`). 구현 미착수.
