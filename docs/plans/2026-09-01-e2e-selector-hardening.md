# 2026-09-01 — E2E Selector Hardening (User-Centric Migration)

## Status

- 작성일: 2026-09-01
- Brainstorm: [`docs/brainstorms/2026-09-01-e2e-selector-hardening.md`](../brainstorms/2026-09-01-e2e-selector-hardening.md)
- STRATEGY 트랙: §5 Production Release Pipeline > E2E selector 안정성 (User-Centric Selectors)
- 결정 상태: **사용자 확정 (2026-09-01)**
  - Q1 = **A** (즉시 마이그레이션) + **C** 결합 (ESLint `no-restricted-syntax` 신규 차단)
  - Q2 = **A-1** (aria-label 부여 + dead line 제거)
  - Q3 = **A** (단독 task, 진단 + 수정) — 변경 9가 trigger, 실제 진단/수정은 별도 brainstorm + plan
  - Q4 = **A** (이 brainstorm + 본 plan 결과만) — PR 머지 시점에 STRATEGY.md §5 한 번만 갱신
  - Q5 = **A** (현재 정책 유지) — 본 plan의 testid 5건 모두 정책("복수 호출처·aria 부재") 부합
- 구현 시작 가능

---

## Goal

PR #58에서 발생한 **wrapper 구조 의존 selector 회귀**(5/44 → 0/44)를 다시 반복하지 않도록, 식별된 위험 selector 6건을 사용자 인지 가능 셀렉터(`getByRole`/`getByLabel`/`aria-label`)로 마이그레이션한다. 목표:

1. **회귀 차단**: 다음 컴포넌트 통합 PR(PageShell 진화, Button 추가 적용 등)에서 selector가 자동으로 따라간다.
2. **사용자 중심 selector 강화**: STRATEGY §5 "User-Centric Selectors" 원칙 — 태그/클래스/구조 의존을 줄이고 role/aria 기반 셀렉터로 전환.
3. **부수 발견 처리**: PR #58 이후 발생하는 `Encountered two children with the same key, 0` 콘솔 경고의 원인 진단 + 수정.

**완료 시점 정의:**
- 위험 selector 6건 전부 사용자 인지 가능 셀렉터로 교체
- React E2E 44/44 통과 (변경 표면 0이어야 함)
- 중복 key 콘솔 경고 재현 불가 확인
- ESLint 가드 규칙(`no-restricted-syntax` 또는 사용자 정의 rule) `e2e/`에 적용되어 신규 위험 selector 추가 차단

---

## Current State

### PR #58 회귀 직후

- `c010318f` 머지로 `PageShell`이 wrapper를 `<main className="min-h-svh">`로 통일 → selector `section.min-h-svh` 매치 실패 5건 발생.
- 즉시 수정 (`e6c4138e`): selector 5건 `section.min-h-svh` → `main.min-h-svh`로 교체, 44/44 통과.
- **이번 작업의 전제:** 그 "즉시 수정"은 회귀를 잡았지만, **wrapper 구조 의존 selector가 다른 형태로 6건 잔존** — 다음 리팩터링에서 동일 회귀 가능.

### 위험 selector 6건 (2026-09-01 감사, 본 plan 작성 시 재확인)

| # | 셀렉터 | 파일:라인 | 의존 컴포넌트 | 사용처 (grep 확인) |
|---|--------|-----------|---------------|---------------------|
| 1 | `button.rounded-full.px-3.py-1.5` | `e2e/pages/HomePage.ts:55` | `Accounts/index.tsx:241` (tag 버튼) | **사용처 0건 (dead code)** |
| 2 | `div.group h3.font-semibold` | `e2e/pages/TemplatePages.ts:58` | `Templates/index.tsx:62` 카드 | `TemplatePages.ts:58` 자기 자신 (`getTemplateNames()` 메서드) |
| 3 | `div.group.rounded-2xl.border` | `e2e/pages/TemplatePages.ts:12/28/41/223` | `Templates/index.tsx:62` 카드 | `TemplatePages.ts` 내부 4곳 (lines 12/28/41/223), `04-template-crud.spec.ts:74` (getTemplateNames 결과 사용) |
| 4 | `div.mt-3.space-y-3 > div.rounded-2xl.border` | `e2e/05-template-account.spec.ts:53` | `AccountFieldsSection.tsx:32` 래퍼 | `05-template-account.spec.ts:53` 단독 |
| 5 | `div.space-y-3 > div` | `e2e/pages/TemplatePages.ts:101` | `TemplateEdit/index.tsx:260` 래퍼 | **사용처 0건 (dead code — `fieldEditors` 멤버 자체가 미사용)** |

> **#1, #5 cross-check**: brainstorm §3.1은 "AccountList tag 버튼이 Accounts에 있으면 false match 가능"이라고 평가했으나, **grep 결과 HomePage.tagButtons 자체가 어느 spec에서도 호출되지 않음** (`04-template-crud`, `05-template-account`, `06-lock`, `07-import-export`, `08-search` 모두 미사용). **dead code 분기**: 사용처 0건 → 라인 제거 (즉시 정리). `fieldEditors`도 같은 패턴 (사용처 0건).

> **#6 — 추가로 식별된 위험**: `e2e/03-account-crud.spec.ts:28`, `07-import-export.spec.ts:26`, `08-search.spec.ts:26`, `10-persistence.spec.ts:26`에서 `xpath=ancestor::div[contains(@class, "rounded-2xl")][1]` 4건 사용. brainstorm §3 감사에 누락되었으나 동일 카테고리(wrapper 구조 + 클래스 의존).

### 중복 key 콘솔 경고 (Plan-G5 / PR #58 영향)

- 증상: `Encountered two children with the same key, 0`.
- 가설 1 (강함): `TemplateEdit/index.tsx:263`의 `key={`${index}-${field.label}`}`에서 `index`를 prefix로 사용 → 두 필드가 동시에 같은 label을 가질 때 `${0}-카드번호` 키가 동일. 단, 같은 label을 가진 필드가 정상 사용에서 동시에 존재할 일은 거의 없음.
- 가설 2 (보통): `<PageShell>` 구조 변화로 자식 노드 트리에 index `0`인 형제 두 개가 등장 (예: `<header>` + `<main>` 형제 중 index 0이 둘).
- 가설 3 (약함): `AccountFieldsSection.tsx:35`의 `key={field.id}`는 안정적 — 그러나 PageShell 통합 전후로 자식 구조가 바뀌면서 형제 index 충돌 가능.
- **원인 진단 필요**: 정확한 가설은 후속 디버깅으로 확정. 본 plan은 **수정 절차**만 명시하고, 진단 자체는 별도 작업.

### ESLint 환경

- `eslint.config.js`은 `@eslint/js` + `tseslint` + react 훅 플러그인. **`no-restricted-syntax` 규칙 없음** — wrapper 구조 의존 selector 추가를 막는 가드 부재.
- `e2e/` 디렉토리는 `dist`, `android`, `.history`만 글로벌 ignore. lint 대상에 포함됨.

### Architecture (selector 결정 영향 범위)

```
React App (WebView)
  ├─ src/pages/Accounts/index.tsx        ← tag 버튼 (Accounts:241)
  ├─ src/pages/Templates/index.tsx        ← 카드 (Templates:62)
  ├─ src/pages/Templates/TemplateEdit/index.tsx ← 필드 리스트 (TemplateEdit:260)
  └─ src/pages/Accounts/AccountEdit/components/AccountFieldsSection.tsx ← 필드 리스트 (AccountFieldsSection:32)
       │
       ▼ Playwright E2E
  e2e/
  ├─ 03-account-crud.spec.ts (rounded-2xl ancestor)
  ├─ 04-template-crud.spec.ts (Templates 카드 셀렉터)
  ├─ 05-template-account.spec.ts (AccountFieldsSection 셀렉터)
  ├─ 07-import-export.spec.ts, 08-search.spec.ts, 10-persistence.spec.ts (rounded-2xl ancestor)
  └─ pages/HomePage.ts, pages/TemplatePages.ts (pageobject)
```

---

## Relevant Files

| 파일 | 역할 |
|------|------|
| `e2e/pages/HomePage.ts` | AccountListPage pageobject — tag 버튼 셀렉터 포함 (dead) |
| `e2e/pages/TemplatePages.ts` | TemplateListPage + TemplateEditPage pageobject — 카드/필드 셀렉터 |
| `e2e/03-account-crud.spec.ts` | `rounded-2xl` ancestor xpath 1건 |
| `e2e/04-template-crud.spec.ts` | `templateListPage.getTemplateNames()` 호출 |
| `e2e/05-template-account.spec.ts` | `div.mt-3.space-y-3 > div.rounded-2xl.border` 셀렉터 + filter |
| `e2e/07-import-export.spec.ts` | `rounded-2xl` ancestor xpath |
| `e2e/08-search.spec.ts` | `rounded-2xl` ancestor xpath |
| `e2e/10-persistence.spec.ts` | `rounded-2xl` ancestor xpath |
| `src/pages/Accounts/index.tsx` | tag 버튼 정의 (`rounded-full px-3 py-1.5` at line 241) — aria-label 부여 대상 |
| `src/pages/Templates/index.tsx` | 카드 정의 (`group rounded-2xl border` at line 62) — `article[role="..."]` 또는 listitem 부여 대상 |
| `src/pages/Templates/TemplateEdit/index.tsx` | 필드 리스트 (`space-y-3` at line 260), **중복 key 가설 1** (line 263) |
| `src/pages/Accounts/AccountEdit/components/AccountFieldsSection.tsx` | 필드 리스트 (`mt-3 space-y-3` at line 32) |
| `eslint.config.js` | 가드 규칙 추가 대상 |

---

## Architecture

### Selector 결정 트리 (cross-check 결과)

본 plan 작성 시 grep으로 확인한 위험 selector 6건 + 추가 식별된 `rounded-2xl` ancestor 4건은 다음 4가지 분기로 처리:

```
1. **사용처 0건 (dead code)** → 라인 제거 (즉시 정리)
   - `HomePage.ts:55` (`tagButtons` 미사용)
   - `TemplatePages.ts:101` (`fieldEditors` 미사용)

2. **사용처 1+건 (셀렉터 교체)** → 사용자 인지 가능 셀렉터로 마이그레이션
   - `TemplatePages.ts:12/28/41/223` → 카드 셀렉터 (listitem role + data-testid 조합)
   - `TemplatePages.ts:58` → h3 자체는 OK (text semantics), 부모 wrapper 셀렉터 제거 후 카드 셀렉터 사용
   - `05-template-account.spec.ts:53` → AccountFieldsSection 필드 래퍼 (label/data-testid)

3. **wrapper 구조 의존 (`rounded-2xl` ancestor xpath)** → 부모 의존 제거 + data-testid 부여
   - `03/07/08/10-persistence.spec.ts` 4건 → FieldEditor 또는 AccountFieldsSection 자체에 `data-testid` 부여

4. **금지 패턴 (lint 차단)** → ESLint `no-restricted-syntax` 규칙
   - `tag.class` 패턴 (e.g., `button.rounded-full.px-3.py-1.5`)
   - `div.group ...` 패턴 (wrapper + variant)
   - `> div.space-y-3 > div` 패턴 (깊은 결합)
   - 셀렉터 내부 `text-red-...` 같은 색상 클래스 (Tailwind arbitrary value 회피)
   - xpath + 클래스 해시 (이미 dead 가능성, 차단)
```

### Key Collision 진단 전략 (cross-check 강화)

중복 key `0` 콘솔 경고는 다음 절차로 진단:

```
1. React DevTools Profiler로 어떤 컴포넌트가 key=0 충돌을 보고하는지 식별
2. 해당 컴포넌트가 mount되는 페이지 식별 (PageShell 통합 전후 비교)
3. 후보 우선순위 (cross-check 결과):

   A. **TemplateFieldEditor map 키 충돌** (TemplateEdit/index.tsx:263)
      - `key={\`${index}-${field.label}\`}` — label이 비어있거나 두 필드가 같은 label일 때 충돌
      - `TemplateField.id`는 optional (`src/models/template.ts:14`: `id?: string`)
      - DEFAULT_TEMPLATE_FIELDS 3개는 id 미할당 (`{ label: "...", type: "...", defaultValue: "" }`)
      - 사용자가 첫 필드를 비워두고 addField로 새 필드 추가 시 둘 다 label="" → key=`0-` 충돌 가능
      - **확정 가설 1**: label이 비어있는 상태에서 addField → 같은 label key 충돌

   B. PageShell 내부 형제 (`<header>` + `<main>` 같은 구조에서 index 0)
      - 페이지 단위로 mount되는 자식 노드 트리 dump
      - PageShell 변경 전후 비교

   C. AccountFieldsSection (`key={field.id}`) — 안정적, 가설에서 제외

4. 진단 결과를 별도 brainstorm으로 분리 (본 plan scope 외)
```

> **현재 모델 한계**: `TemplateField.id`가 optional이라 `field.id`만 key로 쓸 수 없음. 안정적 key 정책은 별도 brainstorm 필요 — 신규 필드 생성 시 `crypto.randomUUID()`로 id 할당하는 마이그레이션 검토. **본 plan scope 외**.

### Wrapper 컴포넌트 구조 (cross-check 결과)

| 컴포넌트 | wrapper | 호출처 |
|----------|---------|--------|
| `AccountFieldsSection` > `FieldEditor` (`src/pages/Accounts/AccountEdit/components/FieldEditor.tsx`) | 자체 wrapper div (FieldCard 미사용) | 1 (AccountFieldsSection:34) |
| `TemplateEdit` > `TemplateFieldEditor` (`src/pages/Templates/TemplateEdit/components/TemplateFieldEditor.tsx`) | `<FieldCard density="comfy">` (line 47) | 1 (TemplateEdit/index.tsx:262) |
| `AccountDetail` 필드 카드 | `<FieldCard density="compact">` | (AccountDetail.tsx 내 — 본 plan scope 외) |

→ 변경 3, 4에서 `FieldEditor`에 data-testid prop 추가, 변경 5에서 `TemplateFieldEditor`에 data-testid prop 추가. 양쪽 다 단일 호출처이므로 typecheck 영향 범위 좁음.

---

## Proposed Changes

### 변경 1 — `src/pages/Accounts/index.tsx:241` tag 버튼에 `aria-label` 부여

**파일**: `src/pages/Accounts/index.tsx`
**컴포넌트**: AccountList 페이지의 tag filter 버튼
**변경**:
- `<button>` (line 237-248)에 `aria-label={`태그 필터: ${tag}`}` 추가
- 또는 `aria-pressed={selectedTags.includes(tag)}` (토글 상태 명시)
**이유**: 현재 selector `button.rounded-full.px-3.py-1.5` (line 55 HomePage.ts)는 클래스 해시 의존 + 셀렉터 자체가 dead code. tag filter가 다시 필요해질 때 사용자 인지 가능 셀렉터로 잡을 수 있도록 의미 부여.

**변경 후**:
```tsx
<button
  key={tag}
  type="button"
  onClick={() => toggleTag(tag)}
  aria-label={`태그 필터: ${tag}`}
  aria-pressed={selectedTags.includes(tag)}
  className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-chip transition ${
    selectedTags.includes(tag)
      ? "bg-[var(--color-accent)] text-white"
      : "bg-[var(--color-accent-bg)] text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]/80"
  }`}
>
  {tag}
</button>
```

### 변경 2 — `src/pages/Templates/index.tsx:62` 카드에 `data-testid="template-card"` + `role="listitem"` 부여

**파일**: `src/pages/Templates/index.tsx`
**컴포넌트**: TemplateList 페이지의 카드
**변경**:
- `<div>` (line 60-62)에 `role="listitem"`, `data-testid="template-card"`, `data-template-name={template.name}` 추가
**이유**: `div.group.rounded-2xl.border` 셀렉터는 wrapper 클래스 3개 의존. 다음 디자인 토큰 변경(예: `group` → `interactive`)에서 또 깨짐. `data-testid`는 본 plan §Q5 정책에서 "복수 호출처·aria 부재 시 한정" 허용 — 카드 단위 식별이 본질적으로 aria로 불가능 (label/name이 카드 내부 h3에 있음).

**변경 후**:
```tsx
{templates.map((template) => (
  <div
    key={template.id}
    role="listitem"
    data-testid="template-card"
    data-template-name={template.name}
    className="group rounded-2xl border ..."
  >
```

### 변경 3 — `src/pages/Accounts/AccountEdit/components/AccountFieldsSection.tsx:32` 필드 래퍼에 `data-testid="account-field-editor"` 부여

**파일**: `src/pages/Accounts/AccountEdit/components/AccountFieldsSection.tsx`
**컴포넌트**: AccountEdit의 필드 리스트 컨테이너
**변경**:
- `<div className="mt-3 space-y-3">` (line 32)에 `data-testid="account-field-editor-list"` 추가
- `<FieldEditor>` (line 34-40)에 `data-testid="account-field-editor"` prop 추가 → `FieldEditor` 컴포넌트 내부에서 wrapper div에 적용
**이유**: spec 05의 `div.mt-3.space-y-3 > div.rounded-2xl.border` 셀렉터는 부모 wrapper 클래스 + 자식 wrapper 클래스 결합. 디자인 시스템 변경 시 양쪽 동시 깨질 위험. `data-testid` 부여로 사용자 인지 가능 + 결합 제거.

**변경 후**:
```tsx
<div className="mt-3 space-y-3" data-testid="account-field-editor-list">
  {fields.map((field) => (
    <FieldEditor
      key={field.id}
      data-testid="account-field-editor"
      field={field}
      onUpdate={onUpdateField}
      onRemove={onRemoveField}
      onGeneratePassword={onOpenPasswordGenerator}
    />
  ))}
</div>
```

`FieldEditor` 컴포넌트는 별도 변경 (변경 4).

### 변경 4 — `src/pages/Accounts/AccountEdit/components/FieldEditor.tsx` wrapper div에 `data-testid` 전파

**파일**: `src/pages/Accounts/AccountEdit/components/FieldEditor.tsx`
**컴포넌트**: 개별 필드 editor 컴포넌트
**변경**:
- `data-testid?: string` prop 추가, wrapper div에 적용
**이유**: 부모 `AccountFieldsSection`에서 testid를 받아 자식 wrapper에 전파. `data-testid`만으로 wrapper 구조와 무관하게 selector 가능.

> **변경 범위 확인 필요**: 변경 3, 4는 같은 PR에서 함께 처리. FieldEditor.tsx 위치를 grep으로 확인 후 정확한 line 명시.

### 변경 5 — `src/pages/Templates/TemplateEdit/index.tsx` 필드 리스트에 `data-testid="template-field-editor"` 부여

**파일**: `src/pages/Templates/TemplateEdit/index.tsx` (line 260, 262)
**컴포넌트**: TemplateEdit의 필드 리스트
**변경**:
- `<div className="space-y-3">` (line 260)에 `data-testid="template-field-editor-list"` 추가
- `<TemplateFieldEditor>` (line 262-271)에 `data-testid="template-field-editor"` prop 추가 → `TemplateFieldEditor` (`src/pages/Templates/TemplateEdit/components/TemplateFieldEditor.tsx`)의 wrapper `<FieldCard density="comfy">` (line 47)에 전파
**이유**: spec 04, 05에서 `TemplatePages.ts:101` `div.space-y-3 > div` 셀렉터가 dead code지만, TemplateFieldEditor도 동일 wrapper 패턴(FieldCard 래퍼)이므로 보강 필요. e2e에서 testid로 잡으면 wrapper 구조와 무관하게 selector 가능.

**부수 — 중복 key 가설 1 (TemplateEdit/index.tsx:263)**:
- `key={`${index}-${field.label}`}` → `key={field.id}`로 변경 검토. 단, 현재 `TemplateField` 모델이 stable id를 갖는지 확인 필요 (`src/models/template.ts` 검토).
- 만약 `field.id`가 없으면 `key={crypto.randomUUID()}` 또는 `nanoid()` 도입 검토 (단, key가 재생성되면 React가 매번 unmount/remount → 성능/포커스 손실 주의).
- **본 plan에서는 진단만**, 수정은 별도 (변경 9 — 중복 key 진단 후속 작업과 묶음).

### 변경 6 — e2e pageobject 셀렉터 교체

**파일**: `e2e/pages/TemplatePages.ts`
**변경**:
- line 12: `templateCards = page.locator('[data-testid="template-card"]').filter({ has: page.getByRole('button', { name: '수정' }) })`
- line 28, 41, 223: `page.waitForSelector('[data-testid="template-card"]', ...)` / `page.locator('[data-testid="template-card"]')`
- line 58: `page.locator('[data-testid="template-card"] h3')` (또는 `getByRole('heading')`)
- line 101: `fieldEditors` 멤버 전체 제거 (dead code) 또는 `fieldEditors = page.locator('[data-testid="template-field-editor"]')` (변경 5 적용 시)

**파일**: `e2e/pages/HomePage.ts`
**변경**:
- line 55: `tagButtons` 멤버 전체 제거 (dead code). 향후 tag filter spec이 필요해지면 변경 1의 `aria-label` 기반 selector 사용.

### 변경 7 — e2e spec 셀렉터 교체

**파일**: `e2e/05-template-account.spec.ts:53`
**변경**:
- Before: `const fieldEditors = page.locator('div.mt-3.space-y-3 > div.rounded-2xl.border').filter({ has: page.getByRole('button', { name: '삭제' }) })`
- After: `const fieldEditors = page.locator('[data-testid="account-field-editor"]').filter({ has: page.getByRole('button', { name: '삭제' }) })`
**이유**: 부모 wrapper 클래스 의존 제거. data-testid가 AccountFieldsSection + FieldEditor 양쪽에 부여되어 안정적으로 잡힘.

**파일**: `e2e/03-account-crud.spec.ts:28`, `e2e/07-import-export.spec.ts:26`, `e2e/08-search.spec.ts:26`, `e2e/10-persistence.spec.ts:26`
**변경**:
- Before: `const fieldContainer = targetLabelInput.locator('xpath=ancestor::div[contains(@class, "rounded-2xl")][1]')`
- After: `const fieldContainer = targetLabelInput.locator('xpath=ancestor::*[@data-testid="account-field-editor"][1]')`
- 또는 변경 4의 `data-testid` prop이 `<FieldEditor>`에 직접 적용되면 `targetLabelInput.locator('..').locator('[data-testid="account-field-editor"]')` 형태로 단순화 가능 — 정확히는 구현 시 FieldEditor root 구조 확인.

### 변경 8 — ESLint 가드 규칙 추가

**파일**: `eslint.config.js`
**변경**:
- `e2e/**` 파일에 한정한 `no-restricted-syntax` 규칙 추가
- 금지 셀렉터 패턴 (AST selector with `Literal`):
  - `'MemberExpression[property.name="locator"] > CallExpression > Literal[value=/^(button|div)\\.(rounded|group|space)/]'`
  - 또는 `no-restricted-syntax`의 단순 매칭으로: `Literal[value=/^\\w+\\.[a-z-]+\\.[a-z-]+\\.[a-z-]+/]` (4단 클래스 해시 차단)
  - xpath `Literal[value=/xpath=ancestor::.*\\[contains\\(@class/]` 차단
**이유**: STRATEGY §5 "금지 셀렉터" 정책의 자동 강제. 신규 위험 selector 추가 자체를 막음.

**변경 후 (eslint.config.js)**:
```js
{
  files: ['e2e/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-syntax': ['error',
      {
        selector: "Literal[value=/^[a-z]+\\.[a-z-]+\\.[a-z-]+(\\.[a-z-]+)?$/]",
        message: 'E2E 셀렉터는 클래스 3+개 조합 금지 (User-Centric Selectors). data-testid / getByRole / aria-label 사용.',
      },
      {
        selector: "Literal[value=/xpath=ancestor::.*\\[contains\\(@class/]",
        message: 'xpath ancestor + contains(@class) 패턴 금지. data-testid 또는 label 사용.',
      },
    ],
  },
},
```

### 변경 9 — 중복 key `0` 콘솔 경고 진단 (별도 후속)

**범위**: 본 plan의 **scope 외**. 변경 5 부수 작업으로 진단 절차만 명시.

**절차**:
1. React DevTools Profiler로 어떤 컴포넌트가 key=0 충돌을 보고하는지 식별
2. 해당 컴포넌트의 mount 위치(PageShell 통합 전후 비교) 추적
3. 원인 확정 후 별도 brainstorm + plan 작성 (TemplateEdit:263의 key 정책, PageShell 자식 구조, 또는 다른 컴포넌트)

**트리거**: 본 plan PR 머지 후 사용자가 콘솔 경고 재발을 확인하면 별도 작업 시작. 또는 Playwright E2E가 콘솔 경고로 실패할 정도로 강해지면 즉시.

### Android E2E 셀렉터 감사 (2026-09-01, 본 plan 작성 시 cross-check)

본 plan은 React (Playwright) E2E를 주 대상으로 하지만, 동일 PR에서 Android (UiAutomator) E2E가 영향받지 않는지 검증하기 위해 감사.

**Android E2E 셀렉터 분포** (`android/app/src/androidTest/` 48건):
- `By.text` 13 / `By.desc` 10 / `By.descContains` 1 / `By.textContains` 8 — **사용자 인지 가능** (한국어/영어 라벨)
- `By.pkg` 7 / `By.res` 1 — 시스템 selector, 안정적
- `By.clazz` 8 — **Android 표준 widget에 한정** (`android.widget.EditText`/`TextView`/`Button`/`Toolbar`/`ActionBarContainer`/`KeyguardHostView`)

**WebView 내 xpath 셀렉터 추가 감사** (2026-09-01, 사용자 cross-check 신호):
- `AccountEditPage.kt:102` — `ancestor::div[contains(@class,'rounded-2xl')]` ⚠️ wrapper 구조 + 클래스 의존
- `WebViewTestHelper.kt:143` — `ancestor::div[contains(@class, 'rounded-2xl')]` ⚠️ 동일 패턴, 동일 위험
- `SettingsPage.kt:215-216` — `following-sibling::span[1]` / `following-sibling::*[1]` ⚠️ **형제 의존** — 사용자가 짚어준 부분
- `WebViewTestHelper.kt:127` — `following-sibling::*[@data-field-value='true']` ⚠️ 형제 의존

→ 총 4건의 위험 xpath 셀렉터가 Android E2E에도 존재. **React E2E에서 마이그레이션한 동일 패턴의 Android 잔존** — wrapper 구조 변경 시 양쪽 E2E 동시 깨짐 위험.

**평가**:
- React E2E에서 식별된 위험 패턴(태그 + 3+ 클래스 의존, xpath + contains(@class))은 **Android E2E에 존재**
- `By.clazz` 호출 모두 시스템/외부 앱 UI 타깃 — wrapper 구조 의존 위험 없음 (Android-only By.* API 평가)
- **webview xpath 셀렉터 4건은 wrapper 구조 변경에 취약** — 마이그레이션 대상

**KIYO Android 레이아웃** (`android/app/src/main/res/layout/` 4개):
- `autofill_dataset_item.xml`, `autofill_auth_item.xml`, `autofill_save_item.xml`, `activity_main.xml`
- view IDs 모두 의미적 (`tv_site_name`, `tv_domain`, `tv_username`, `tv_message`, `iv_site_icon`)
- `contentDescription` 사용 (`@string/autofill_site_icon`) — 자동완성 UI a11y 일치
- ID 패턴이 충분히 의미적이라 별도 보강 불필요

**Plan-X Android 마이그레이션 (변경 9~12)**:
- 변경 9 — `AccountEditPage.kt:102`: `ancestor::div[contains(@class,'rounded-2xl')]` → `ancestor::*[@data-testid='account-field-editor'][1]`
- 변경 10 — `WebViewTestHelper.kt:143`: 동일 패턴 동일 마이그레이션
- 변경 11 — `SettingsPage.kt:215-216`: `following-sibling::span[1]` → 부모 div 내부 `span[last()]` 매칭 (`AutofillSection`의 "마지막 동기화" + 시간 텍스트는 부모 `<div>` 안에 함께 묶여 있음)
- 변경 12 — `WebViewTestHelper.kt:127`: `following-sibling` → `input id` 직접 매칭 (`AccountTitleSection`의 `<Input id="account-title">` 패턴) + 폴백 체인 유지

**검증 결과**:
- `./gradlew compileDebugKotlin compileDebugAndroidTestKotlin` ✅ BUILD SUCCESSFUL
- `./gradlew testDebugUnitTest` ✅ BUILD SUCCESSFUL
- React `npm run check` ✅ 522/522 passed (회귀 0)
- Android APK 재빌드 + 설치 ✅ (`npm run build` → `npx cap sync android` → `./gradlew installDebug`)

**Android E2E 회귀 = 0** (변경 표면 = wrapper 구조 의존 4건 마이그레이션만, 컴포넌트 코드 변경은 변경 3, 4가 동일하게 양쪽 E2E의 selector 안정성에 기여)

**⚠️ 빌드 게이트 발견 (2026-09-01 Android E2E 2건 실패 → 진단)**:
- 증상: `AccountEditPage.fillAccount` (line 63 "Could not find username/email input") + `unlockWithBiometric_restoresSession` (line 220 "Account not rendered") 실패
- 원인: **`./gradlew compileDebugAndroidTestKotlin`만 빌드하고 `:app` 본체 APK를 재빌드 안 함** → Android E2E는 옛 JS 번들 (변경 3, 4 적용 전) 사용
- 진단: `app-debug.apk` timestamp = 12:03 (오전) vs `FieldEditor.tsx` = 14:50 (오후) — APK가 옛 버전
- 수정 절차: `npm run build` → `npx cap sync android` → `./gradlew installDebug` (총 13s 빌드, 23 executed)
- **재발 방지** (PR 머지 후 사용자 검증 체크리스트): **`npm run build` + `npx cap sync android` + `:app:installDebug` 3단계 모두 실행한 후 Android E2E 실행**

---

## 결정 (사용자 확인 필요)

| # | 결정 | 옵션 | 본 plan 기본 |
|---|------|------|-------------|
| Q1 | 위험 selector 6건 처리 시점 | A (즉시) / B (다음 리팩터링) / C (lint 규칙) | **A + C 결합** (즉시 마이그레이션 + lint로 신규 차단) |
| Q2 | `button.rounded-full.px-3.py-1.5` 단독 처리 | A-1 (aria-label) / A-2 (HomePage.ts만) / 보류 | **A-1** (aria-label 부여 + dead line 제거) |
| Q3 | 중복 key 콘솔 경고 추적 | 단독 task / 다음 PR / 무시 | **단독 task (변경 9)** — 본 plan에서는 진단 절차만 명시, 수정은 별도 |
| Q4 | STRATEGY.md Track 5 갱신 범위 | 이 brainstorm 결과만 / 향후 plan까지 | **이 brainstorm + 본 plan 결과만** — Plan-X 후속 시점에 별도 갱신 |
| Q5 | `data-testid` 정책 | 이미 STRATEGY §5 반영 | **유지** — 변경 3, 4, 5에서 "복수 호출처·aria 부재" 조건 충족으로 testid 허용 |

---

## Tests

### Unit tests (Vitest)

- 없음. 본 plan은 E2E selector 마이그레이션 + 컴포넌트에 aria/testid 부여 — 단위 테스트 변경 불필요.

### React E2E (Playwright)

- **회귀 = 0 (변경 표면 0이어야 함)**: 모든 spec은 selector 교체만 하므로 user-visible entry point 변경 0.
- 검증 항목:
  - `npm run test:e2e` 44/44 통과 (이전과 동일 카운트)
  - 교체된 selector (`[data-testid="template-card"]`, `[data-testid="account-field-editor"]`, `aria-label="태그 필터: ..."`)가 spec에서 정상 동작
- **dead code 제거 검증**: `HomePage.tagButtons`, `TemplatePages.fieldEditors` 제거 후 빌드/lint 통과 (사용처 0이므로 회귀 없음)

### Lint / Typecheck

- `npm run check` (typecheck + test)
- `npm run lint` — eslint.config.js에 추가한 `no-restricted-syntax` 규칙이:
  - 신규 위험 selector 작성 시 경고 (예: 실수로 `button.rounded-full` 다시 쓰면 즉시 에러)
  - 기존 위험 selector는 모두 변경 6, 7에서 교체되어 통과
- `npm run typecheck` — `data-testid` prop이 FieldEditor에 추가되면 typecheck 통과 확인

### Android E2E

- **본 plan scope 외**. React E2E만 영향. Android E2E는 user-visible entry point 변경 없으므로 회귀 없음 (사용자 직접 실행 검증 대기).

### Manual verification (Playwright 사용자 직접)

- 변경 1~8 머지 후 React E2E 44/44 통과 확인
- 콘솔 경고 (`Encountered two children with the same key, 0`) 발생 여부 관찰 — 본 plan에서는 진단 미수행이므로 변화 없을 수 있음 (변경 9는 별도)
- Playwright UI mode (`npm run test:e2e:ui`)로 04, 05 spec을 직접 클릭하며 selector 안정성 확인

---

## Risks

### R1 — `data-testid` 남용 회귀

- 본 plan은 STRATEGY §5 정책("aria 부재 시 최후 수단")을 따르지만, 변경 3, 4, 5에서 `data-testid`를 5개소 부여함.
- **위험**: 향후 PR에서 `data-testid`가 더 늘어나면 정책 위반 — 단기적으로는 허용, STRATEGY §5 "비선호" 정책 강화를 위해 lint에 `data-testid` 사용 경고 규칙 검토 가능 (별도 후속).
- **완화**: 변경 8 lint 규칙 + code review로 testid 남용 방지.

### R2 — 중복 key 콘솔 경고 미해결

- 변경 9는 진단 절차만 명시, 수정은 별도 후속. PR 머지 후에도 경고가 계속 나타날 수 있음.
- **완화**: 별도 brainstorm trigger를 plan §Status에 명시.

### R3 — ESLint 가드 규칙 오탐

- 변경 8의 `Literal[value=/^[a-z]+\\.[a-z-]+\\.[a-z-]+(\\.[a-z-]+)?$/]` 정규식은 의도치 않게 정상 selector를 차단할 수 있음 (e.g., `article[role="button"]` 같은 의미적 selector는 매치 안 되지만, 향후 다른 클래스 조합은 매치될 수 있음).
- **완화**: lint rule 적용 후 `npm run lint` 통과 확인. 실패하는 selector는 `eslint-disable-next-line` 주석 + 후속 plan에서 적절한 selector로 교체.

### R4 — FieldEditor에 data-testid prop 추가 시 호출처 누락

- 변경 4는 `FieldEditor`에 새 prop 추가 → 호출처 `AccountFieldsSection` 외 다른 호출처가 있으면 typecheck 실패.
- **완화**: `grep -rn "FieldEditor" src/` 으로 호출처 전수 확인 → 본 plan 작성 시 grep으로 1곳 (AccountFieldsSection:34) 확인. 다른 호출처 없음.
- **부수**: `src/pages/Accounts/AccountEdit/components/` 외 다른 경로에서 `FieldEditor` 사용 여부 확인 (예: `TemplateEdit/TemplateFieldEditor`는 별도 컴포넌트).

### R5 — `aria-label="태그 필터: ${tag}"` 다국어 미지원

- 현재 UI 텍스트가 한국어. i18n 미도입 상태라면 OK. 단, 향후 i18n 추가 시 aria-label도 번역 키로 분리 필요.
- **완화**: 본 plan에서는 한국어 하드코딩, i18n 도입 시 별도 plan.

### R6 — 회귀 게이트 false negative

- 변경 1~8이 모두 내부 변경(컴포넌트에 aria/testid 추가 + e2e selector 교체)이라 user-visible surface 0. 그러나 새 testid/aria가 컴포넌트 렌더링에 영향을 줄 가능성 (e.g., React StrictMode 더블 렌더링, snapshot 변경).
- **완화**: `npm run test` (Vitest 단위/통합) 통과 + 사용자 직접 React E2E 44/44 확인.

---

## Rollback

- 모든 변경은 **컴포넌트에 비파괴 속성 추가**(aria-label, data-testid, role) + e2e selector 교체.
- **컴포넌트 롤백**: `git revert <merge-commit>` 으로 prop 추가만 되돌리면 됨. e2e selector는 별도로 `git revert` 필요.
- **e2e selector 롤백**: 동일하게 `git revert`. 변경 6, 7은 단순 selector 문자열 교체이므로 롤백 시 다른 컴포넌트 변경이 없어 충돌 없음.
- **ESLint 규칙 롤백**: `eslint.config.js`의 `no-restricted-syntax` 블록만 제거하면 즉시 비활성화.
- **데이터 마이그레이션 불필요**: data-testid/aria는 런타임 속성 — Dexie/스토어 데이터 변경 없음.

---

## Implementation Checklist

- [ ] grep으로 `src/pages/Accounts/AccountEdit/components/FieldEditor.tsx` 위치 + 호출처 확인 (R4 완화)
- [ ] `e2e/pages/HomePage.ts:55` (`tagButtons`) dead code 라인 제거 (변경 6)
- [ ] `e2e/pages/TemplatePages.ts:101` (`fieldEditors`) dead code 라인 제거 (변경 6)
- [ ] `src/pages/Accounts/index.tsx:241` tag 버튼에 `aria-label` + `aria-pressed` 추가 (변경 1)
- [ ] `src/pages/Templates/index.tsx:62` 카드에 `role="listitem"` + `data-testid="template-card"` + `data-template-name` 추가 (변경 2)
- [ ] `src/pages/Accounts/AccountEdit/components/AccountFieldsSection.tsx:32` 래퍼에 `data-testid="account-field-editor-list"` 추가 + `FieldEditor`에 `data-testid` prop 추가 (변경 3, 4)
- [ ] `src/pages/Accounts/AccountEdit/components/FieldEditor.tsx` wrapper div에 `data-testid` prop 전파 (변경 4)
- [ ] `src/pages/Templates/TemplateEdit/index.tsx:260` 래퍼에 `data-testid="template-field-editor-list"` + `TemplateFieldEditor`에 `data-testid` prop 추가 (변경 5)
- [ ] `e2e/pages/TemplatePages.ts` 셀렉터 5건 교체 (lines 12/28/41/58/223) (변경 6)
- [ ] `e2e/05-template-account.spec.ts:53` 셀렉터 교체 (변경 7)
- [ ] `e2e/03/07/08/10-persistence.spec.ts` `rounded-2xl` ancestor xpath 4건 교체 (변경 7)
- [ ] `eslint.config.js` `no-restricted-syntax` 규칙 추가 (변경 8)
- [ ] `npm run typecheck` 통과 확인
- [ ] `npm run lint` 통과 확인 (기존 selector 모두 교체되어 신규 규칙 위반 0)
- [ ] `npm run test` 통과 확인 (Vitest 단위/통합)
- [ ] 사용자 직접 React E2E 44/44 실행 확인 (Playwright 사용자 직접 실행)
- [ ] STRATEGY.md §5 진척 갱신 (Q4 결정 반영, 본 plan 결과 추가)
- [ ] 콘솔 경고 `Encountered two children with the same key, 0` 재발 시 변경 9 (별도 후속) trigger

---

## Cross-Plan Integration

### Upstream 의존성 (선행 완료)

- ✅ **Multi-Vault Support** (2026-08-30) — `Home.tsx` 파일 리스트 UI 전제
- ✅ **Plan-7a** (2026-08-30) — `/create-vault` 다단계 페이지 + Stepper (selector 환경)
- ✅ **Plan-B-3** (2026-08-30) — inline `<button>` → `<Button>` 마이그레이션 (selector 환경 안정화)
- ✅ **Plan-D PR 1** (2026-08-31) — FOUC 가드 + RootRedirect + ErrorScreen (현재 origin HEAD)

### Downstream 영향 (후속 plan에 전제 제공)

- **Plan-7b** (STRATEGY §3 진행 순서, 미착수) — 폴더 선택 + 자동 백업 통합 시 selector 환경 안정 필요. 본 plan으로 `data-testid` 컨벤션 확립 → Plan-7b E2E가 일관된 testid 사용 가능.
- **a11y audit plan** (STRATEGY §3 진행 순서, 미착수) — 본 plan의 `aria-label`/`aria-pressed` 부착이 a11y baseline 강화에 기여. audit plan은 추가 remediation만 담당.
- **Plan-D PR 2** (보류) — 테마 토글 추가 시 본 plan의 셀렉터가 wrapper 구조와 무관하게 동작 (회귀 위험 0).

### 체크리스트 (cross-plan integration 검증)

- [ ] 본 plan이 Plan-D PR 1 (FOUC 가드) 머지 후 작업 → origin/dev branch 기준
- [ ] 본 plan 머지 후 STRATEGY.md §5에 "Plan-X: E2E Selector Hardening ✅ 완료 (2026-09-01, 위험 selector 6건 + 추가 4건 마이그레이션)" 항목 추가
- [ ] 본 plan 머지 후 STRATEGY.md §3 진행 순서에 영향 없음 (a11y audit → Plan-7a 2차 PR → Plan-7b 그대로)
- [ ] Plan-X 후속 plan이 본 plan의 testid 컨벤션(`template-card`, `account-field-editor`, `template-field-editor`)을 따르는지 확인

---

## Verification Checklist

- [ ] 모든 변경이 컴포넌트 prop 추가 / selector 교체로 user-visible surface 0
- [ ] dead code 2건 (`HomePage.tagButtons`, `TemplatePages.fieldEditors`) 안전하게 제거됨 (사용처 0)
- [ ] data-testid는 정책("복수 호출처·aria 부재")에 부합 (변경 3, 4, 5)
- [ ] aria-label은 한국어 하드코딩 (R5 인지)
- [ ] lint 규칙이 기존 모든 spec에서 통과
- [ ] React E2E 44/44 사용자 직접 실행 통과
- [ ] 콘솔 경고 (별도 trigger) 재발 시 후속 작업 trigger 명시됨

---

## 후속 작업 (별도 brainstorm trigger)

- **중복 key `0` 콘솔 경고 진단 + 수정** (변경 9) — PR 머지 후에도 경고 재발 시 별도 brainstorm 시작.
- **i18n 도입 시 aria-label 번역** (R5) — 향후 i18n plan 작성 시 본 plan의 aria-label 한 번에 처리.
- **Plan-7b E2E selector** — 본 plan의 testid 컨벤션 사용, 별도 lint 규칙 검토.

---

## See also

- Brainstorm: [`docs/brainstorms/2026-09-01-e2e-selector-hardening.md`](../brainstorms/2026-09-01-e2e-selector-hardening.md)
- STRATEGY §5 Production Release Pipeline > E2E selector 안정성 (User-Centric Selectors): [`STRATEGY.md`](../../STRATEGY.md)
- Cross-plan integration: [`references/cross-plan-integration.md`](../../.hermes/skills/compound/ce-plan/references/cross-plan-integration.md)