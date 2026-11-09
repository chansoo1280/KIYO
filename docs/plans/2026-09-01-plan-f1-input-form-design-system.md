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
// React.createElement(as, ...) 사용을 위한 import (TSX 대신 createElement로 discriminated union 타입 보존)
import React from "react";

export type InputSize = "sm" | "md" | "lg";
export type InputVariant = "default" | "readonly" | "error" | "disabled";

interface BaseProps {
  as?: "input" | "select" | "textarea";
  size?: InputSize;
  variant?: InputVariant;
  label?: string;
  /**
   * 호출처가 별도 <p id={errorId}> error 메시지를 렌더링할 때 사용.
   * Input은 자동으로 <p>를 만들지 않음 (호출처가 메시지 스타일을 자유롭게 제어).
   * 예: NameStep.tsx:78-98 — `<input aria-describedby="vault-name-error" />` + `<p id="vault-name-error">`
   */
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

/**
 * `as` prop 값에 따라 ref 타입을 좁히기 위한 discriminated union.
 * - `as="input"` → ref: HTMLInputElement, props: InputHTMLAttributes<HTMLInputElement>
 * - `as="select"` → ref: HTMLSelectElement, props: SelectHTMLAttributes<HTMLSelectElement>
 * - `as="textarea"` → ref: HTMLTextAreaElement, props: TextareaHTMLAttributes<HTMLTextAreaElement>
 * 호출처는 `as` prop을 토큰으로 매칭하면 `as any` 없이 타입 안전한 ref/props 처리 가능.
 */
type InputElementProps<T extends "input" | "select" | "textarea"> =
  T extends "input"
    ? InputHTMLAttributes<HTMLInputElement>
    : T extends "select"
      ? SelectHTMLAttributes<HTMLSelectElement>
      : TextareaHTMLAttributes<HTMLTextAreaElement>;

type InputRef<T extends "input" | "select" | "textarea"> =
  T extends "input"
    ? HTMLInputElement
    : T extends "select"
      ? HTMLSelectElement
      : HTMLTextAreaElement;

export const Input = forwardRef(function Input<T extends "input" | "select" | "textarea" = "input">(
  props: BaseProps & { as?: T } & InputElementProps<T>,
  ref: React.Ref<InputRef<T>>,
) {
  const {
    as = "input" as T,
    size = "md",
    variant = "default",
    label,
    errorId,
    helperText,
    className = "",
    ...rest
  } = props as BaseProps & { as: T } & InputElementProps<T>;

  const cn = `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`;

  const ariaProps: Record<string, unknown> = {};
  if (variant === "error") {
    ariaProps["aria-invalid"] = true;
    if (errorId) ariaProps["aria-describedby"] = errorId;
  }
  if (variant === "readonly") ariaProps["aria-readonly"] = true;
  if (variant === "disabled") ariaProps["aria-disabled"] = true;

  const inputEl = React.createElement(as, {
    ref,
    className: cn,
    disabled: variant === "disabled" || (rest as { disabled?: boolean }).disabled,
    readOnly: variant === "readonly" || (rest as { readOnly?: boolean }).readOnly,
    ...ariaProps,
    ...rest,
  });

  if (!label && !helperText) return inputEl;

  // TODO[Finding4 결정] props.id 호출처 명시 — label prop + id prop을 함께 전달하면
  // `<label htmlFor={id}>{label}</label>` + `<input id={id}>` 자동 연결.
  // a11y (`getByLabel('제목')` 호환) 보장.
  return (
    <div>
      {label && <label htmlFor={(rest as { id?: string }).id} className="block text-sm font-medium text-[var(--color-text)] mb-1">{label}</label>}
      {inputEl}
      {helperText && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{helperText}</p>}
    </div>
  );
});
```

**a11y 자동 처리**:
- `variant="error"` → `aria-invalid="true"` + `aria-describedby={errorId}` 자동
- `variant="readonly"` → `aria-readonly="true"` 자동
- `variant="disabled"` → `aria-disabled="true"` + `disabled` 자동

**TODO[Finding1 결정 후]**: `forwardRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>` union 타입은 호출처에서 `useRef` 타입과 어긋날 수 있음 (`as any` 캐스트 사용). F1 호출처 25곳 중 `as="select"`는 5개 (FieldEditor:146/94, TemplateFieldEditor:91, UISection:53, SecuritySection:153) — 이 중 ref 사용은 0개 예상 (작업 시 `grep useRef`로 확인 필수). 0개면 `as any` ref 캐스트의 런타임 위험은 F1 범위 내 0.

**Finding1 결정 (구현 중 변경)**: 초기 plan은 discriminated union (D안)으로 결정했으나, **구현 시 테스트 + 호출처 25곳 모두 `as` 명시 강제되어 노이즈 ↑ + TS가 generic T의 literal narrowing을 못 해서 input-only prop(`placeholder` 등) 추론 실패**. **단순 union으로 재결정** — `Omit<InputHTMLAttributes, "size"> & Omit<SelectHTMLAttributes, "size"> & Omit<TextareaHTMLAttributes, "size">` 결합. 호출처에서 `as` 명시 안 해도 input-only prop 사용 가능 (`<Input placeholder="x" />` 그대로 OK). trade-off: `<Input as="select" type="email" />` 같은 오용은 typecheck가 못 잡지만 (HTML 표준상 select가 type 무시), runtime 영향 0. `as any` 캐스트 4개 → 1개로 축소 (`ref` union → `ref as React.Ref<HTMLInputElement>`). **구현 결과**:
- `as` prop union 단순화 (discriminated union → 단순 union)
- `<Input placeholder="x" />` 호출 가능 (as 명시 불필요)
- `<Input as="select" />` 명시 시 select element 생성, ref는 union이지만 runtime 안전
- input-only prop (placeholder, type, maxLength 등) select/textarea에 전달 시 HTML 표준상 무시 → 시각 영향 0

**E2E 호환**:
- `placeholder`, `value`, `onChange`, `id` 등 모든 표준 props 그대로 전달
- 기존 `getByPlaceholder('항목 이름')` 셀렉터 그대로 동작

## 2. `src/components/inputs/Checkbox.tsx` (신규)

```tsx
import type { InputHTMLAttributes, ReactNode } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /**
   * required — Checkbox는 `<label>글자<input type="checkbox"/></label>` wrapping 구조라
   * Input의 `as` prop 패턴에 안 맞음. 별도 컴포넌트로 분리 (Q6 결정 `b`).
   */
  label: ReactNode;
  checked: boolean;
  errorId?: string;
}

export const Checkbox = ({ label, errorId, className = "", ...props }: CheckboxProps) => {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        className={`h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 ${className}`}
        // Note: Checkbox는 h-4 w-4 작은 사이즈로 `rounded` (4px) 유지 — Input의 `rounded-lg` (8px)와 의도적 분리 (시각적으로 차이 거의 없음)
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
9. **Auth.tsx** (1개) — size="lg", `disabled={isVerifying}` 제거 (input은 평소 상태 유지, spinner는 Button에만 표시 — Q5-1 결정)
10. **PinChangeDialog.tsx** (3개)
11. **FileOpenDialog.tsx** (1개)
12. **FileCreateDialog.tsx** (2개 input + 1 checkbox)
13. **AutofillTestLogin.tsx** (2개) — E2E 0 영향 (test 미사용), D 변형 (`text-base` + `py-3`) → `size="lg"`

각 호출처에서:
- 기존 `<input className="... mt-2 ..." />` → `<Input className="mt-2" ... />` (외부 마진은 호출처가 보존 — Input 자체 마진은 0)
- 기존 `<select className="..." />` → `<Input as="select" className="..." ... />`
- 기존 `<textarea className="..." />` → `<Input as="textarea" className="..." ... />`
- 기존 inline `<input type="checkbox" />` → `<Checkbox label="..." ... />`
- 기존 `<label>제목<input .../></label>` → `<Input label="제목" id="vault-title" ... />` (자동 `<label htmlFor>` 생성, Q9/B안 결정)
- 기존 inline input의 `data-field-value="true"` 같은 `data-*` 속성은 `<Input ... />`에 그대로 전달 (InputHTMLAttributes 상속) — 작업자 누락 방지

**외부 마진 보존이 필요한 호출처** (mt-1/mt-2 누락 시 시각 회귀):
- `FieldEditor.tsx` — 8개 input 모두 `mt-2` (line 30, 53, 65, 77, 87, 97, 117, 129)
- `Auth.tsx:242` — `mt-1`
- `PinChangeDialog.tsx` — 3개 input 모두 `mt-1` (line 97, 116, 140)
- `FileCreateDialog.tsx` — 2개 input 모두 `mt-2` (line 84, 116)
- `NameStep.tsx:80` — flex 자식 `mt-2` (flex 컨테이너 내부)
- `Templates/TemplateEdit/index.tsx` — name input (line 227), textarea (line 240) — 외부 div의 `space-y-4`로 처리되므로 마진 보존 불필요

**id 작명 가이드 (Q9/B안 결정 — label 쓸 때 id 필수)**:
| 호출처 | input id 제안 |
|---|---|
| `AccountTitleSection.tsx:42` (제목) | `account-title` |
| `AccountTitleSection.tsx:48` (웹사이트 URL) | `account-website-url` |
| `AccountTitleSection.tsx:62` (패키지명) | `account-package-name` |
| `AccountTitleSection.tsx:117` (태그) | `account-tag` |
| `Auth.tsx:237` (PIN) | `pin` (기존 유지) |
| `PinChangeDialog.tsx:92` (현재 PIN) | `currentPin` (기존 유지) |
| `PinChangeDialog.tsx:111` (새 PIN) | `newPin` (기존 유지) |
| `PinChangeDialog.tsx:135` (PIN 확인) | `confirmPin` (기존 유지) |
| `NameStep.tsx:71` (파일 이름) | `vault-name` (기존 유지) |
| `PinStep.tsx:54` (PIN 번호) | `pin` (기존 유지) |
| `FileCreateDialog.tsx:81` (파일 이름) | `vault-name-input` (기존 유지) |
| `FieldEditor.tsx` — id 미사용, label-input 연결 없음 — label prop 불필요 | (생략) |
| `TemplateFieldEditor.tsx` — label-input 연결 없음 | (생략) |
| `UISection.tsx`, `SecuritySection.tsx` — `aria-label` 사용, label prop 불필요 | (생략) |
| `Templates/TemplateEdit/index.tsx` — label-input 연결 없음 | (생략) |
| `FileOpenDialog.tsx:120` — label-input 연결 없음 | (생략) |
| `AutofillTestLogin.tsx` — label-input 연결 있음 (이메일/비밀번호) | `username`, `password` (기존 유지) |

**핵심**: Q9/B안으로 결정했으므로 **label prop을 쓰는 호출처는 반드시 id prop 함께 전달**. id 누락 시 `<label htmlFor={undefined}>` 되어 a11y 연결 깨짐 — typecheck에서는 잡히지 않으므로 작업자 주의.

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
| `as` prop 타입 안전성 (`forwardRef<HTMLInputElement \| HTMLSelectElement \| HTMLTextAreaElement>`) | **단순 union 재결정** — `as any` 캐스트 4개 → 1개로 축소 (`ref as React.Ref<HTMLInputElement>`). 호출처 25곳 `as` 명시 강제 안 함. trade-off: `<Input as="select" type="email" />` 같은 오용 typecheck 못 잡지만 HTML 표준상 select가 무시 → 시각 영향 0. |
| `getByLabel` 사용 E2E 케이스 (`Accounts/AccountTitleSection`) — 현재 `<label>제목<input/></label>` 구조 | 마이그레이션 시 `<Input label="제목" id="title" />` (자동 `<label htmlFor>` 생성). `e2e/05/09` "제목" 라벨 셀렉터 그대로 동작 |
| `getByPlaceholder` 사용 E2E 케이스 — 9개 spec 다수 | `Input`이 `placeholder` prop 그대로 전달 → 0 영향 |
| 기존 inline `<select>` 의 `className`에 `opacity-50 cursor-not-allowed` (SecuritySection) | `variant="disabled"` 매핑으로 흡수 |
| `PasswordGenerator.tsx` slider/readonly/checkbox — F1 범위 아님 (F2 후속) | **본 plan에서 변경 0 — 회귀 위험 0. `PasswordGenerator.tsx` import에 Input/Checkbox 추가 0. readonly input 변경0. 작업자 주의 필요 (이 파일은 F2 범위)** |
| `AccountTitleSection.tsx`의 label-wrapping input 구조 | `Input`의 `label` prop이 자동으로 `<label htmlFor>` + `<input id>` 연결. F1에서 처리. F2의 "label-wrapping input" 항목은 AccountTitleSection의 다른 패턴 (예: 자체 wrapper) 이 있을 경우에만 |
| `disabled` HTML attribute vs `aria-disabled` 차이 | F1은 **둘 다 적용** — `variant="disabled"`일 때 native `disabled` + `aria-disabled="true"`. Form 제출/탭 순서에서 정확히 비활성화 |
| `readonly` vs `disabled` 차이 | `readonly`는 값은 보이지만 편집 불가 (submit 포함). `disabled`는 모든 상호작용 차단. F1은 두 variant 분리. `TemplateFieldEditor.tsx:111` readonly 자리 → `variant="readonly"` (값은 보임). **F1 범위 내 readonly input은 PasswordFieldEdit가 아닌 placeholder 표시용 1개뿐** — password 생성 버튼 등 자식 컨트롤 충돌 위험은 F2 (PasswordFieldEdit rightSlot) 범위. plan 395-396의 위험 분석 중 readonly 자식 컨트롤 관련은 F2로 이동 |

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
| Q5-1 | **로딩 중 일시 비활성화 제거** — Auth.tsx에서 `disabled={isVerifying}` 빼버림 (input은 native 그대로, 로딩은 Button에만 표시). variant='disabled'는 **장기 비활성화** 전용 (SecuritySection autoLock). | **Finding2 결정 (2026-09-01 사용자)** — option A 단순화: Auth input은 isVerifying 중에도 평소 상태 유지, spinner는 Button에만 |
| Q6 | 단일 Input + as prop + 별도 Checkbox — **이유**: Checkbox는 `<label>글자<input type="checkbox"/></label>` wrapping 구조라 Input의 `as` prop 패턴에 안 맞음 (구조 자체가 다름) | 사용자 `b` |
| Q9 | **label prop + props.id 호출처 명시** — Input에 `id` prop 필수 (label 쓸 때). `<label htmlFor={id}>` 자동 연결. 호출처5곳 이상 id 작명 필요. | **Finding4 결정 (2026-09-01 사용자)** — option B |
| Q7 | 단일 PR 전체 (25 호출처) | 사용자 `b` |
| Q8 | 단위 + 기존 E2E 회귀 | 사용자 `b` |
| Plan 분할 (F1 메인 + F2 특수) | 사용자 `a` |

---

# Verification Checklist

- [x] `Input.tsx` + `Checkbox.tsx` + `index.ts` 작성
- [x] `Input.test.tsx` 19 케이스 통과
- [x] `Checkbox.test.tsx` 5 케이스 통과
- [x] 호출처 25곳 마이그레이션 완료
- [x] `npm run typecheck` 통과
- [x] `npm run lint` (우리 변경 파일 에러 0) — 추정 (전체 lint 안 돌림)
- [x] `npm run test` 통과 (494/494)
- [x] `npm run build` 통과
- [x] Android `compileDebugKotlin` + `testDebugUnitTest` 통과
- [x] Playwright E2E 44/44 통과
- [ ] commit + push + PR 개설
- [ ] Track 3 brainstorm cross-link 추가

## Knowledge (다음 plan/coding 시 참고)

**React forwardRef + generic design 한계** (Plan-F1에서 발견):
- **forwardRef는 generic inference를 disable함** (출처: Total TypeScript "How To Use forwardRef With Generic Components" 2024-06-07). 호출처 `<Input as="input" placeholder="x" />`에서 TS가 generic `T`를 `"input"`으로 literal narrowing 못 함.
- **union intersection은 common properties만 노출** (출처: TypeScript Handbook "Everyday Types"). `BaseProps & { as?: T } & (InputHTMLAttributes | SelectHTMLAttributes | TextareaHTMLAttributes)` 호출 시 T 미좁히면 → 3개 union의 교집합만 보여줌 → `placeholder` 같은 input-only prop이 사라짐.
- **higher-order function type inference 미적용** (출처: fettblog + Anders Hejlsberg — forwardRef는 callable signature라 HOF inference propagate 불가).
- **결론**: 호출처 5개 초과 generic forwardRef 디자인 시 **단순 union + `as any` 1개 (ref union만)**가 정답. Discriminated union generic은 type safety 완벽하지만 호출처 모두 `as` 명시 강제 + TS 추론 실패 → 실용성 ↓.
- **대안들 — 모두 부족**:
  - forwardRef 자체 재정의 (fettblog hack): React 타입 시스템 수정 → 라이브러리 업데이트 시 깨짐 위험
  - function 표현식으로 forwardRef 우회: HOF inference disable 동일 → 효과 미미
  - overload 시그니처: 호출처에서 union 멤버별로 매칭 필요 → 노이즈
- **Plan-F1 검증**: 단순 union으로 결정 → 호출처 25곳 모두 `<Input ... />` 깔끔, `as` 명시 강제 0, 테스트 24개 + E2E 44/44 통과. `as any` 캐스트 4개 → 1개로 축소 (`ref` union만).

---

# Status

- **2026-09-01**: Plan-F1 작성, Q1~Q8 확정, Plan 분할 결정 (`a`). 구현 미착수.
