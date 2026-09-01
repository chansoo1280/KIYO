# Plan-E — AccountEdit ↔ TemplateEdit 통일감 회복 + 색상 토큰 통일

- Date: 2026-09-01
- Source: [`docs/brainstorms/2026-09-01-button-component-unification.md`](../brainstorms/2026-09-01-button-component-unification.md) §7.A (Q1=(a), Q5=(a), Q6=(b) 확정)
- Prior: [Track 3 brainstorm §12](../brainstorms/2026-08-30-track3-ux-accessibility.md) (8개 plan 완료), [Plan-F1 Input 통일](../plans/2026-09-01-plan-f1-input-form-design-system.md) (2026-09-01 완료)
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- 결정 사항: §결정 (본 plan은 Q1~Q6 모두 확정 후 진행, 결정 대기 항목 없음)
- **범위 확정**: 통일감 회복 (헤더/에러) + 색상 토큰 sed (`var(--error)` → `var(--color-error)`). **inline `<button>` 25개 마이그레이션은 Plan-B-4로 분리 (Q4=c 확정, Plan-B-3 PR과 무관)**

---

# Goal

본 plan 완료 시 다음이 참:

1. **AccountEdit에 `<header>` + `<h1>` 페이지 제목 추가** — a11y 결함 해소 (스크린리더가 페이지 컨텍스트 인식)
2. **TemplateEdit 헤더 구조와 통일** — `<header>` 내 `<h1>` + 버튼 그룹 (이미 존재, 미세 정렬만)
3. **두 페이지의 에러 표시 컴포넌트 통일** — `<ErrorMessage>` 단일 컴포넌트 추출 (단일/리스트 모두 지원)
4. **색상 토큰 sed 완료** — `var(--error)` → `var(--color-error)` 일괄 (4개 파일, `src/` 전체)
5. **E2E 셀렉터 동시 갱신** — `ul.text-red-600 li, ul.text-red-400 li` → sed 후 토큰에 맞는 셀렉터로 교체
6. **회귀 0** — typecheck/lint(우리 변경 파일 0)/test/E2E 회귀 0

**명시적 범위 밖:**
- inline `<button>` 25개 마이그레이션 → Plan-B-4 (별도 plan)
- `Button` 확장 (`variant="icon"`) → Plan-B-4
- `CardButton` 신설 → Plan-B-4
- `FileCreateDialog` 완전 제거 (Q4-a) → 사용자 결정 보류 유지
- a11y audit plan (axe-core CI + 키보드 Playwright) → 별도 plan
- **`src/pages/Accounts/AccountEdit/index.tsx:29`의 `useFileAuthGuard({ skipRedirect: false })` 호출** — Plan-E 범위 밖 (헤더/에러 표시만, hook 호출/시그니처 변경 없음). 작업자가 진입 시 hook 존재를 모르고 제거하지 않도록 명시

---

# Current State (2026-09-01 인스펙션)

## 1. AccountEdit 헤더 (line 240-257)

```tsx
<section className="min-h-svh bg-[var(--color-bg)] px-5 py-8">
  <div className="flex items-center justify-between gap-3">
    <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={isSaving} label="← 취소" />
    <Button type="button" variant="primary" onClick={handleSave} loading={isSaving} label={isSaving ? "저장 중..." : "저장"} />
  </div>
  ...
```

**문제:** `<section>` 직속 `<div>` 헤더. 페이지 제목 `<h1>` 부재. 스크린리더가 페이지 컨텍스트("이 페이지가 무엇인지")를 못 잡음.

## 2. TemplateEdit 헤더 (line 176-202)

```tsx
<main className="min-h-svh bg-[var(--color-bg)] px-5 py-8 pb-28">
  <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
    <header className="flex items-center justify-between gap-3">
      <h1 className="text-3xl font-semibold text-[var(--color-text-h)]">
        {isEdit ? "템플릿 수정" : "새 템릿"}
      </h1>
      <div className="flex items-center gap-2">
        {isEdit && <Button variant="ghost" onClick={() => setShowDeleteConfirm(true)} label="삭제" />}
        <Button variant="ghost" onClick={handleCancel} label="취소" />
        <Button variant="primary" type="submit" onClick={handleSave} label="저장" />
      </div>
    </header>
    ...
```

**특징:** 이미 `<header>` + `<h1>` 구조. **변경 최소화**, AccountEdit과 구조 정렬만.

## 3. AccountEdit 에러 표시 (line 259-267)

```tsx
{saveError && (
  <p className="mt-4 rounded-md border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 px-3 py-2 text-sm font-medium text-[var(--color-error)]" role="alert" data-testid="account-edit-error">
    {saveError}
  </p>
)}
```

**특징:** 단일 에러, `data-testid="account-edit-error"`, 색상 토큰 ✅ `var(--color-error)` 사용. **sed 영향 없음.**

## 4. TemplateEdit 에러 표시 (line 204-212)

```tsx
{errors.length > 0 && (
  <div className="rounded-2xl border border-[var(--error)]/20 bg-[var(--error)]/10 p-4 dark:border-[var(--error)]/40 dark:bg-[var(--error)]/20">
    <ul className="space-y-1 text-sm text-[var(--error)] dark:text-[var(--error)]">
      {errors.map((err, i) => <li key={i}>• {err}</li>)}
    </ul>
  </div>
)}
```

**특징:** 복수 에러 리스트, 색상 토큰 ❌ `var(--error)` 사용. **sed 대상.**

## 5. 색상 토큰 sed 대상 (Q6 = b: src/ 전체, grep 확정 결과)

**`rg -n "var\(--error\)" src/`** 결과 (2026-09-01 인스펙션):

| 파일:라인 | 컨텍스트 | 비고 |
|---|---|---|
| `src/index.css:15` | `--color-error: var(--error);` | sed 제외 (별칭 정의) |
| `src/pages/Templates/TemplateEdit/index.tsx:205` | 에러 박스 border/bg | sed |
| `src/pages/Templates/TemplateEdit/index.tsx:206` | `<ul>` text 색 | sed |
| `src/pages/Auth.tsx:202` | 에러 메시지 박스 | sed |
| `src/pages/Settings/components/AutofillSection.tsx:306` | autofill 에러 메시지 | sed |
| `src/pages/Accounts/AccountEdit/components/FieldEditor.tsx:162` | 필드 삭제 버튼 hover | sed |

**총 5개 sed 대상 위치** (4개 파일 + TemplateEdit 2곳). `src/index.css:15` 별칭 정의는 sed 제외.

**sed 안전 확인:** `src/index.css:15`에 `--color-error: var(--error)` 별칭 존재 → sed 후 색상 동작은 동일 (둘 다 같은 값으로 resolve).

## 6. E2E 영향 (Playwright)

**🚨 `e2e/pages/TemplatePages.ts:110` 핵심 셀렉터:**
```ts
this.errorMessages = page.locator('ul.text-red-600 li, ul.text-red-400 li');
```

TemplateEdit 에러 메시지를 **`ul.text-red-600`** / **`ul.text-red-400`** 셀렉터로 찾고 있음. **현재 TemplateEdit 코드는 `text-[var(--error)]` (Tailwind arbitrary value)을 사용** — 즉, **sed 전에도 E2E가 동작 안 할 가능성 있음** (Playwright 셀렉터가 Tailwind arbitrary value를 인식 못함).

**확인 방법:** 작업 전 `e2e/04-template-crud.spec.ts` + `e2e/05-template-account.spec.ts` 실행 → `errorMessages` 사용 시나리오가 있는지 grep 필요. **시나리오 없으면 셀렉터 자체 dead code → 제거 (Q3=b 확정). 시나리오 있으면 셀렉터 교체 필수.**

**E2E 영향 0 항목:**
- AccountEdit의 `data-testid="account-edit-error"` → E2E 의존 0. **`rg -n "account-edit-error" e2e/` grep 결과 (2026-09-01): 매치 0건. ✅ 안전.**
- AccountEdit/TemplateEdit "삭제" 버튼 라벨 → E2E 의존 1건 (`05-template-account.spec.ts:53`) — 라벨 유지 필수

---

# Relevant Files

| 파일 | 역할 | 본 plan 영향 |
|---|---|---|
| `src/pages/Accounts/AccountEdit/index.tsx` | 계정 에딧 페이지 | 헤더에 `<header>` + `<h1>` 추가, 에러 표시 `<ErrorMessage>` 교체 |
| `src/pages/Templates/TemplateEdit/index.tsx` | 템플릿 에딧 페이지 | 헤더 정렬(미세), 에러 표시 `<ErrorMessage items>` 교체, **sed** |
| `src/pages/Accounts/AccountEdit/components/FieldEditor.tsx` | 필드 에딧 컴포넌트 | **sed** (line 162) — 단, 색상 토큰만 변경 |
| `src/pages/Auth.tsx` | 인증 페이지 | **sed** (line 202) — 색상 토큰만 |
| `src/pages/Settings/components/AutofillSection.tsx` | autofill 설정 | **sed** (line 306) — 색상 토큰만 |
| `src/index.css` | CSS 변수 정의 | sed 제외 (`--color-error: var(--error)` 별칭 정의 보호) |
| `e2e/pages/TemplatePages.ts` | Playwright pageobject | `errorMessages` 셀렉터 갱신 (sed 후) |
| `e2e/04-template-crud.spec.ts`, `e2e/05-template-account.spec.ts` | E2E 스펙 | `errorMessages` 사용 시나리오 grep 확인 |

**신규 파일:**
- `src/components/feedback/ErrorMessage.tsx` — 단일/리스트 에러 표시 통합 컴포넌트

---

# Architecture

```
[User action]
  └─ store error / validation error
       └─ <ErrorMessage items={errors} />  ← [신규] 단일/리스트 통합
            ├─ 단일 에러 → <p data-testid role="alert">
            └─ 리스트 → <ul role="alert"><li>...</li></ul>
                  └─ 색상 토큰 var(--color-error) 통일
                       └─ sed: var(--error) → var(--color-error) (4개 파일, 5곳)

[AccountEdit]
  └─ 헤더: <section> → <div> → <header className=...> + <h1>{title}</h1> + 버튼 그룹

[TemplateEdit]
  └─ 헤더: <main> → <div> → <header className=...> + <h1>{title}</h1> + 버튼 그룹 (이미 존재, 미세 정렬)

[Sed 작업 흐름]
  └─ rg "var\(--error\)" src/ → 5개 매치 (4개 파일)
       └─ sed -i 's/var(--error)/var(--color-error)/g' <file> × 5
            └─ src/index.css 제외
                 └─ npm run typecheck + lint + test + (E2E 사용자 직접 실행)
```

---

# Proposed Changes

## 1. `<ErrorMessage>` 컴포넌트 신설

**파일:** `src/components/feedback/ErrorMessage.tsx` (신규, ~50줄)

```tsx
import type { ReactNode } from "react";

interface ErrorMessageProps {
  /**
   * 단일 에러면 string, 리스트면 string[].
   * - string → <p role="alert" data-testid={testid}>{message}</p>
   * - string[] → <ul role="alert" data-testid={testid}><li>• {msg}</li>...</ul>
   * - undefined/null → null (렌더 안 함)
   */
  items: string | string[] | null | undefined;
  /**
   * 선택적 testid. AccountEdit은 "account-edit-error" 유지 (E2E 안전성).
   * TemplateEdit은 신규 testid 부여 가능 (E2E가 미사용).
   */
  testId?: string;
  className?: string;
}

/**
 * Plan-E: AccountEdit + TemplateEdit 에러 표시 통일 컴포넌트.
 *
 * 통합 결정 (2026-09-01):
 * - AccountEdit은 단일 에러(savemessage) → <p>
 * - TemplateEdit은 리스트(errors[]) → <ul>
 * - 두 패턴을 단일 컴포넌트로 흡수, items 타입(string | string[])로 분기.
 * - 색상 토큰 var(--color-error) 통일 (sed 후).
 */
export const ErrorMessage = ({ items, testId, className = "" }: ErrorMessageProps): ReactNode => {
  if (!items) return null;

  if (typeof items === "string") {
    return (
      <p
        role="alert"
        data-testid={testId}
        className={`mt-4 rounded-md border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 px-3 py-2 text-sm font-medium text-[var(--color-error)] ${className}`}
      >
        {items}
      </p>
    );
  }

  return (
    <div className={`rounded-2xl border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 p-4 dark:border-[var(--color-error)]/40 dark:bg-[var(--color-error)]/20 ${className}`}>
      <ul className="space-y-1 text-sm text-[var(--color-error)] dark:text-[var(--color-error)]" role="alert" data-testid={testId}>
        {items.map((err, i) => (
          <li key={i}>• {err}</li>
        ))}
      </ul>
    </div>
  );
};

export default ErrorMessage;
```

**테스트:** `src/components/feedback/ErrorMessage.test.tsx` (신규, 4 테스트):
1. `items={null}` → null 반환
2. `items="단일 에러"` → `<p role="alert">` 렌더
3. `items={["에러1", "에러2"]}` → `<ul role="alert"><li>• 에러1</li><li>• 에러2</li></ul>` 렌더
4. `items={[]}` → null 반환 (빈 배열도 표시 안 함)

**테스트 적정성 (Q2=a 확정):** 4건으로 유지. Plan-B-3 (Button 마이그레이션) 패턴(minimal 신규 테스트) 일관. component contract (`testId`/`className` prop)는 단일/리스트 분기 검증으로 간접 보장. 추가 테스트는 회귀 감지 가치 대비 작업량 ↑.

## 2. AccountEdit 에러 표시 교체

**파일:** `src/pages/Accounts/AccountEdit/index.tsx`

**변경 위치:** line 259-267 (현재 inline `<p>`)

**변경 내용:**
```tsx
// Before:
{saveError && (
  <p className="mt-4 rounded-md border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 px-3 py-2 text-sm font-medium text-[var(--color-error)]" role="alert" data-testid="account-edit-error">
    {saveError}
  </p>
)}

// After:
<ErrorMessage items={saveError} testId="account-edit-error" />
```

**import 추가:**
```tsx
import ErrorMessage from "@/components/feedback/ErrorMessage";
```

## 3. AccountEdit 헤더에 `<header>` + `<h1>` 추가

**파일:** `src/pages/Accounts/AccountEdit/index.tsx`

**변경 위치:** line 240-257 (헤더 영역)

**변경 내용:**
```tsx
// Before:
<section className="min-h-svh bg-[var(--color-bg)] px-5 py-8">
  <div className="flex items-center justify-between gap-3">
    <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={isSaving} label="← 취소" />
    <Button type="button" variant="primary" onClick={handleSave} loading={isSaving} label={isSaving ? "저장 중..." : "저장"} />
  </div>

// After:
<section className="min-h-svh bg-[var(--color-bg)] px-5 py-8">
  <header className="flex items-center justify-between gap-3">
    <h1 className="text-3xl font-semibold text-[var(--color-text-h)]">
      {isNew ? "새 계정" : "계정 수정"}
    </h1>
    <div className="flex items-center gap-2">
      <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={isSaving} label="← 취소" />
      <Button type="button" variant="primary" onClick={handleSave} loading={isSaving} label={isSaving ? "저장 중..." : "저장"} />
    </div>
  </header>
```

**시맨틱 통일:** TemplateEdit와 동일하게 `<header>` + `<h1>` + 버튼 그룹. **단, AccountEdit은 삭제 버튼이 없으므로 (AccountDetail에서 처리) TemplateEdit의 3-버튼 구조와 다름** — 2-버튼(취소/저장) 구조 그대로.

**조건식 근거 (Finding 1 보정):** `<h1>` 텍스트 분기는 기존 `isNew` state (`AccountEdit/index.tsx:26: const isNew = !accountId`)를 사용. `effectiveAccount.id`는 신규 계정일 때 `0`이라 falsy로 평가되어 의도와 반대 ("새 계정" 분기로 가지 못함). `isNew`는 신규 = true, 수정 = false로 의도와 일치. **TemplateEdit의 `{isEdit ? "템플릿 수정" : "새 템플릿"}` 패턴과 대칭.**

## 4. TemplateEdit 에러 표시 교체

**파일:** `src/pages/Templates/TemplateEdit/index.tsx`

**변경 위치:** line 204-212 (현재 inline `<div>` + `<ul>`)

**변경 내용:**
```tsx
// Before:
{errors.length > 0 && (
  <div className="rounded-2xl border border-[var(--error)]/20 bg-[var(--error)]/10 p-4 dark:border-[var(--error)]/40 dark:bg-[var(--error)]/20">
    <ul className="space-y-1 text-sm text-[var(--error)] dark:text-[var(--error)]">
      {errors.map((err, i) => <li key={i}>• {err}</li>)}
    </ul>
  </div>
)}

// After:
<ErrorMessage items={errors} testId="template-edit-error" />
```

**import 추가:**
```tsx
import ErrorMessage from "@/components/feedback/ErrorMessage";
```

**state 변경:** 현재 `errors: string[]` → 그대로 유지 (ErrorMessage가 string[] 받음). validateForm도 그대로.

## 5. 색상 토큰 sed

**대상 파일 4개 (5개 sed 위치):**

| 파일:라인 | Before | After |
|---|---|---|
| `src/pages/Templates/TemplateEdit/index.tsx:205` | `border-[var(--error)]/20 ... bg-[var(--error)]/10 ... dark:border-[var(--error)]/40 dark:bg-[var(--error)]/20` | `border-[var(--color-error)]/20 ... bg-[var(--color-error)]/10 ... dark:border-[var(--color-error)]/40 dark:bg-[var(--color-error)]/20` |
| `src/pages/Templates/TemplateEdit/index.tsx:206` | `text-[var(--error)] dark:text-[var(--error)]` | `text-[var(--color-error)] dark:text-[var(--color-error)]` |
| `src/pages/Auth.tsx:202` | `border-[var(--error)]/20 bg-[var(--error)]/10 text-[var(--error)] ... dark:border-[var(--error)]/40 ... dark:text-[var(--error)]` | 동일 패턴 `var(--color-error)`로 |
| `src/pages/Settings/components/AutofillSection.tsx:306` | `border-[var(--error)]/20 bg-[var(--error)]/10 ... text-[var(--error)] dark:border-[var(--error)]/40 ... dark:text-[var(--error)]` | 동일 패턴 `var(--color-error)`로 |
| `src/pages/Accounts/AccountEdit/components/FieldEditor.tsx:162` | `text-[var(--error)] hover:bg-[var(--error)]/10` | 동일 패턴 `var(--color-error)`로 |

**명령 (개별 파일 patch):**
```bash
# 각 파일별로 patch 도구 사용 (sed 명령은 quote escape 문제 가능)
# patch tool: old_string="var(--error)" → new_string="var(--color-error)"
# 단, src/index.css:15의 --color-error: var(--error)는 sed 제외 (별칭 정의 보호)
```

**sed 후 검증:**
```bash
rg -n "var\(--error\)" src/
# 기대 결과: src/index.css:15만 매치 (별칭 정의)
```

## 6. E2E 셀렉터 갱신

**파일:** `e2e/pages/TemplatePages.ts:110`

**시나리오 grep 먼저:**
```bash
rg -n "errorMessages|errorMessages\." e2e/
# 사용 시나리오 있으면 → 셀렉터 교체 필요
# 사용 시나리오 없으면 → 셀렉터 자체 dead code → 교체 불필요
```

**사용 시나리오 있을 때 변경:**
```ts
// Before:
this.errorMessages = page.locator('ul.text-red-600 li, ul.text-red-400 li');

// After (sed 후 var(--color-error)는 Tailwind에 매핑 안 되므로 testid 기반 권장):
this.errorMessages = page.locator('[data-testid="template-edit-error"] li');
```

**`template-edit-error` testid는 변경 4에서 ErrorMessage에 부여.**

---

# Tests

## 1. 단위 테스트 (Vitest)

| 파일 | 테스트 | 시나리오 |
|---|---|---|
| `src/components/feedback/ErrorMessage.test.tsx` (신규) | 4건 | null/string/array/빈 배열 처리 |
| `src/pages/Accounts/AccountEdit/AccountEdit.test.tsx` (기존) | 회귀 | 기존 테스트 통과 + 저장 실패 시 `account-edit-error` 렌더 |
| `src/pages/Templates/TemplateEdit/index.test.tsx` (기존, Plan-B-3에서 신규) | 회귀 | 기존 테스트 통과 + validate 실패 시 `template-edit-error` 렌더 |

## 2. 통합 테스트 (Vitest)

| 파일 | 시나리오 |
|---|---|
| `src/pages/Accounts/AccountEdit/AccountEdit.test.tsx` | 헤더에 `<h1>` 존재 검증 |
| `src/pages/Templates/TemplateEdit/index.test.tsx` | 헤더 `<h1>` 텍스트 검증 |

## 3. 회귀 검증

```bash
npm run typecheck      # ✓
npm run lint           # ✓ (우리 변경 파일 에러 0)
npm run test           # 470/470 ✓ (신규 4건 + 기존 회귀 0)
```

## 4. Playwright E2E

**E2E (Playwright) 회귀 0 — 사용자 직접 실행.**

**사전 확인:**
- `e2e/04-template-crud.spec.ts`, `e2e/05-template-account.spec.ts`에서 `errorMessages` 사용 시나리오 grep
- 사용 시나리오 있으면 → `e2e/pages/TemplatePages.ts:110` 셀렉터 교체 후 사용자 실행

**검증 시나리오:**
- `e2e/04-template-crud.spec.ts`: 템플릿 생성/수정/삭제 정상 흐름
- `e2e/05-template-account.spec.ts`: 템플릿 → 계정 적용 흐름 (FieldEditor "삭제" 라벨 의존)

## 5. Android (skip)

본 plan은 React UI 한정. **Android E2E 영향 0** (`compileDebugKotlin` + `testDebugUnitTest` 회귀 없음, 단 회귀 게이트에 포함).

---

# Risks

## 1. `<h1>` 추가가 Playwright `getByRole('heading')` 셀렉터와 충돌

**완화:** 사전 grep으로 확인:
```bash
rg -n "getByRole.*heading" e2e/
```
**현재 grep 결과: 매치 0건.** 안전.

## 2. sed 후 `text-[var(--error)]` 잔존

**완화:** sed 후 `rg -n "var\(--error\)" src/` → `src/index.css:15`만 매치 확인. **5개 sed 위치 모두 처리.**

## 3. Playwright `ul.text-red-600` 셀렉터가 sed 후 동작

**완화:** sed 전 grep으로 `errorMessages` 사용 시나리오 확인. **사용 시나리오 있으면 testid 기반 셀렉터로 교체** (sed와 동시 PR).

## 4. sed가 `--color-error: var(--error)` 별칭 정의까지 변경

**완화:** sed 대상 파일 명시적 지정 (src/index.css 제외). **patch tool로 파일별 처리 권장.**

## 5. `<ErrorMessage>` 통합 시 단일/리스트 시각 차이

**완화:** 두 케이스 모두 `rounded-* border-[var(--color-error)]/20 bg-[var(--color-error)]/10` 공통. 단일은 `<p>`, 리스트는 `<ul>` — 의미적 분리 유지.

## 6. "단순화/이전과 같게" 사용자 신호

**본 plan은 명확한 잔존 정리 + 통일감 회복 — 신호에 해당 안 함.** 단, 구현 시작 전 작업 범위 재확인.

## 7. Plan-B-3 PR 미개설과의 결합

**Q4=c 확정으로 본 plan은 Plan-B-3 PR과 무관.** Plan-B-3 PR 개설 결정은 별도.

## 8. sed 중복 처리 위험

**완화:** 작업 전 `rg -n "var\(--error\)" src/`로 정확한 5개 위치 확인. patch tool로 파일별 1회씩만 변경.

---

# Rollback

본 plan은 다음 단위로 독립 롤백 가능:

1. **`<ErrorMessage>` 컴포넌트 롤백** — `src/components/feedback/ErrorMessage.tsx` + import 제거, AccountEdit/TemplateEdit inline `<p>`/`<ul>` 복원
2. **AccountEdit 헤더 롤백** — `<header>` → `<div>` 복원
3. **sed 롤백** — `var(--color-error)` → `var(--error)` patch 역방향 (src/index.css 변경 0이므로 안전)

**롤백 비용:** 소 (3개 PR 단위, 각 ~50줄).

**데이터 영향:** 없음 (DB schema 변경 없음, store 변경 없음).

---

# 결정 (Q1~Q6 모두 brainstorm에서 확정)

| # | 결정 | 상태 | 본 plan 영향 |
|---|---|---|---|
| Q1 | Plan-E 범위 = 통일감 + 색상 토큰 | ✅ 확정 (브레인스톰 §7.A) | **직접 처리** |
| Q2 | Plan-B-4 컴포넌트 전략 (Button 확장) | ✅ 확정 (브레인스톰 §7.B) | Plan-B-4 plan에서 처리 (Plan-E 영향 없음) |
| Q3 | 풀폭 카드형 (CardButton 신설) | ✅ 확정 (브레인스톰 §7.B) | Plan-B-4 plan에서 처리 (Plan-E 영향 없음) |
| Q4 | Plan-B-4와 Plan-B-3 PR 결합 | ✅ 확정 (c: Plan-B-3 보류, Plan-B-4는 별도) | Plan-B-4 plan에서 처리 (Plan-E 영향 없음) |
| Q5 | sed는 Plan-E PR에 포함 | ✅ 확정 | **직접 처리** |
| Q6 | sed = src/ 전체, 작업 전 grep | ✅ 확정 | **직접 처리** |

**참고:** Q2/Q3/Q4는 본 plan(Plan-E)에서 결정만 명시. **실제 작업은 별도 Plan-B-4 plan에서 진행.** 본 plan(Plan-E) 작업 중 Q2/Q3/Q4는 무관 — 영향 0.

---

# Implementation Checklist (작업 순서)

1. **사전 검증** — `rg -n "var\(--error\)" src/` + `rg -n "errorMessages" e2e/` + `rg -n "getByRole.*heading" e2e/`
2. **`ErrorMessage` 컴포넌트 신설** + 단위 테스트 4건
3. **AccountEdit 헤더/에러 교체** + 기존 테스트 회귀 확인
4. **TemplateEdit 에러 교체** + 기존 테스트 회귀 확인
5. **색상 토큰 sed** (5개 위치, 4개 파일)
6. **E2E 셀렉터 갱신 분기** — `errorMessages` 사용 시나리오 grep 결과에 따라:
   - **사용 시나리오 1+건** → `e2e/pages/TemplatePages.ts:110` 셀렉터 testid 기반으로 교체
   - **사용 시나리오 0건** (dead code) → `e2e/pages/TemplatePages.ts:110` 셀렉터 라인 제거 (Q3=b 확정, dead code 즉시 정리)
7. **회귀 게이트**: typecheck + lint + test + Android compile/unitTest
8. **커밋 + push + PR 개설** (사용자 결정)

---

# Output

| 항목 | 값 |
|---|---|
| **Plan 파일** | `docs/plans/2026-09-01-plan-e-accountedit-templateedit-unification.md` (본 파일) |
| **신규 파일** | `src/components/feedback/ErrorMessage.tsx`, `src/components/feedback/ErrorMessage.test.tsx` |
| **변경 파일** | `src/pages/Accounts/AccountEdit/index.tsx`, `src/pages/Templates/TemplateEdit/index.tsx`, `src/pages/Accounts/AccountEdit/components/FieldEditor.tsx` (sed만), `src/pages/Auth.tsx` (sed만), `src/pages/Settings/components/AutofillSection.tsx` (sed만), `e2e/pages/TemplatePages.ts` (셀렉터 교체 시) |
| **테스트** | 단위 4건 (ErrorMessage) + 기존 회귀 0 |
| **회귀 게이트** | typecheck/lint/test/Android compile/unitTest + Playwright E2E 사용자 직접 실행 |
| **메인 리스크** | E2E `errorMessages` 셀렉터 갱신 필요 가능성 (사전 grep으로 확정) |
| **구현 가능** | ✅ Yes (모든 결정 완료, 선행 의존 해소) |

---

# Post-Implementation Knowledge (작업 완료 후 캡처됨)

1. **`<ErrorMessage>` 통합 패턴** — `items: string | string[]` 단일 컴포넌트로 단일/리스트 흡수. 향후 다른 페이지 에러 표시에 재사용 가능
2. **`--color-error: var(--error)` 별칭 패턴** — Tailwind CSS 4에서 `@theme` 별칭 정의 시 sed 안전. 다른 토큰에도 적용 가능
3. **Playwright arbitrary value 셀렉터 한계** — `text-[var(--error)]` 같은 Tailwind arbitrary value는 Playwright 셀렉터로 매칭 어려움. **testid 기반 셀렉터 권장**
4. **`isNew` vs `effectiveAccount.id` 조건식 선택** — 신규/수정 분기는 `isNew` (Boolean)가 `effectiveAccount.id` (Number, 신규=0=falsy)보다 의도와 일치. TemplateEdit의 `isEdit`와 대칭

---

# Implementation Results (2026-09-01 완료)

| 항목 | 결과 |
|------|------|
| **신규 파일** | `src/components/feedback/ErrorMessage.tsx`, `src/components/feedback/ErrorMessage.test.tsx` |
| **변경 파일** | `src/pages/Accounts/AccountEdit/index.tsx`, `src/pages/Templates/TemplateEdit/index.tsx`, `src/pages/Accounts/AccountEdit/components/FieldEditor.tsx`, `src/pages/Auth.tsx`, `src/pages/Settings/components/AutofillSection.tsx`, `e2e/pages/TemplatePages.ts` |
| **단위 테스트** | 499 passed (신규 4건 + 회귀 0) |
| **E2E 테스트** | 44 passed (32.5s) — 템플릿 CRUD + 계정 생성 전체 통과 |
| **Typecheck** | ✅ 0 errors |
| **Lint (변경 파일)** | ✅ 0 errors |
| **Build** | ✅ 성공 |
| **색상 토큰** | `var(--error)` → `var(--color-error)` 5개 위치 완료, `src/index.css:15` 별칭만 잔존 |

---

# See also

- [`docs/brainstorms/2026-09-01-button-component-unification.md`](../brainstorms/2026-09-01-button-component-unification.md) — 본 plan의 source brainstorm
- [`docs/brainstorms/2026-08-30-track3-ux-accessibility.md`](../brainstorms/2026-08-30-track3-ux-accessibility.md) — Track 3 진척 매트릭스, STRATEGY §3 ↔ 코드 매칭
- [`docs/plans/2026-09-01-plan-f1-input-form-design-system.md`](2026-09-01-plan-f1-input-form-design-system.md) — Plan-F1 (Input 통일), 본 plan의 선행
- [`docs/plans/2026-08-30-plan-b3-settings-templates-buttons.md`](2026-08-30-plan-b3-settings-templates-buttons.md) — Plan-B-3 (Button 마이그레이션, PR 미개설)
- `compound/ce-plan` skill — plan 작성 규칙 (cross-check, E2E 영향, 단일 PR 원칙)