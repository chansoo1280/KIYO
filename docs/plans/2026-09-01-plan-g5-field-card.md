# Plan-G5 — FieldCard 통합 (AccountDetail 필드 카드 + TemplateFieldEditor 컨테이너)

- Date: 2026-09-01
- Source: [brainstorm 2026-09-01-component-unification-patterns](../brainstorms/2026-09-01-component-unification-patterns.md) §7.G + §9 G5 결정
- 선행: Plan-G1/G2/G3/G4
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- 결정 사항: Q11=(b) Plan-G5 단일 PR 흡수, 사용자 답변 없는 권장 기본값

---

# Goal

**FieldCard** 단일 컴포넌트로 AccountDetail 필드 카드 + TemplateFieldEditor 컨테이너 통합.

완료 시 다음이 참:

1. `src/components/FieldCard.tsx` 신규 컴포넌트 (`label` + `children` + `density?: "compact" | "comfy"`)
2. AccountDetail.tsx의 필드 카드 인라인 → `<FieldCard label={field.label}>`
3. TemplateFieldEditor.tsx의 컨테이너 인라인 → `<FieldCard label="..." density="comfy">`
4. 단위 테스트 5 케이스
5. 회귀 게이트 통과

**범위 밖 (Plan-G5 후속)**:
- TagChip 통합 — AccountDetail(`<span>` chip) + AccountList(`<button>` toggle button) 모양/의미 다름. 별도 결정 필요

---

# Current State (2026-09-01 인스펙션)

## 2 호출처 인스펙션

### AccountDetail.tsx (line 149-161) — 필드 카드

```tsx
<div
  key={field.id}
  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-4 py-3"
>
  <p className="text-xs font-semibold uppercase tracking-label text-[var(--color-text)]">
    {field.label}
  </p>
  <div className="mt-1">{renderFieldValue(field)}</div>
</div>
```

**구조**: `<div>` wrapper + label `<p>` + children

### TemplateFieldEditor.tsx (line 46) — 필드 컨테이너

```tsx
<div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] p-4">
  <div className="flex items-start justify-between gap-3 mb-3">
    {/* 라벨 input + 순서 버튼 + 삭제 버튼 */}
  </div>
  <div className="grid gap-3 sm:grid-cols-2">
    {/* 필드 상세 입력 (타입, 플레이스홀더, 기본값, 옵션) */}
  </div>
</div>
```

**구조**: `<div>` wrapper (라벨/액션 영역 + 본문 영역) — 본문 자유

**차이점**:
- padding: AccountDetail `px-4 py-3` (compact) vs TemplateFieldEditor `p-4` (comfy)
- label 위치: AccountDetail 상단 + children vs TemplateFieldEditor는 자식에 포함

→ **`density` prop**으로 분리 (compact: AccountDetail / comfy: TemplateFieldEditor)

---

# Architecture

```tsx
// AccountDetail
<FieldCard label={field.label}>
  {renderFieldValue(field)}
</FieldCard>

// TemplateFieldEditor
<FieldCard density="comfy">
  <div className="flex items-start justify-between gap-3 mb-3">...</div>
  <div className="grid gap-3 sm:grid-cols-2">...</div>
</FieldCard>
```

**API**:
```tsx
interface FieldCardProps {
  /** 상단 label (AccountDetail 패턴). 미지정 시 미렌더. */
  label?: string;
  /** "compact" (AccountDetail: px-4 py-3) | "comfy" (TemplateFieldEditor: p-4). default = compact. */
  density?: "compact" | "comfy";
  children: ReactNode;
}
```

---

# Proposed Changes

### 1. `src/components/FieldCard.tsx` (신규)

```tsx
import type { ReactNode } from "react";

interface FieldCardProps {
  /** 상단 label. 미지정 시 미렌더 (TemplateFieldEditor 패턴). */
  label?: string;
  /** "compact" (default, AccountDetail px-4 py-3) | "comfy" (TemplateFieldEditor p-4). */
  density?: "compact" | "comfy";
  children: ReactNode;
}

/**
 * Plan-G5: 필드 카드 단일 컴포넌트.
 *
 * 기존 2 호출처 (AccountDetail 필드 카드 + TemplateFieldEditor 컨테이너)의 동일
 * className "rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)]" 흡수.
 *
 * density:
 * - compact (default): AccountDetail — px-4 py-3 (작은 메타 표시)
 * - comfy: TemplateFieldEditor — p-4 (여러 입력/액션 묶음)
 */
export function FieldCard({ label, density = "compact", children }: FieldCardProps) {
  const paddingClass = density === "comfy" ? "p-4" : "px-4 py-3";
  return (
    <div
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] ${paddingClass}`}
    >
      {label && (
        <p className="text-xs font-semibold uppercase tracking-label text-[var(--color-text)]">
          {label}
        </p>
      )}
      {label && <div className="mt-1">{children}</div>}
      {!label && children}
    </div>
  );
}

export default FieldCard;
```

### 2. `src/components/FieldCard.test.tsx` (신규) — 5 케이스

1. ① label + children 렌더 (AccountDetail 패턴)
2. ② label 미지정 시 본문만 렌더 (TemplateFieldEditor 패턴)
3. ③ density="compact" (default) → px-4 py-3
4. ④ density="comfy" → p-4
5. ⑤ label className 보존 (tracking-label 토큰 정확)

### 3. 호출처 마이그레이션

**AccountDetail.tsx line 149-161**:
```tsx
// Before
<div
  key={field.id}
  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-4 py-3"
>
  <p className="text-xs font-semibold uppercase tracking-label text-[var(--color-text)]">
    {field.label}
  </p>
  <div className="mt-1">{renderFieldValue(field)}</div>
</div>

// After
<FieldCard key={field.id} label={field.label}>
  {renderFieldValue(field)}
</FieldCard>
```

**TemplateFieldEditor.tsx line 46**:
```tsx
// Before
<div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] p-4">
  <div className="flex items-start justify-between gap-3 mb-3">
    {/* (라벨 input + 순서 + 삭제) */}
  </div>
  <div className="grid gap-3 sm:grid-cols-2">
    {/* (필드 상세 입력) */}
  </div>
</div>

// After
<FieldCard density="comfy">
  <div className="flex items-start justify-between gap-3 mb-3">
    {/* (라벨 input + 순서 + 삭제) */}
  </div>
  <div className="grid gap-3 sm:grid-cols-2">
    {/* (필드 상세 입력) */}
  </div>
</FieldCard>
```

---

# Tests

## 신규

| 테스트 파일 | 케이스 |
|---|---|
| `src/components/FieldCard.test.tsx` | 5 케이스 |

## 기존 회귀

- typecheck / lint / test / build / Android

---

# Risks

| 리스크 | 완화 |
|---|---|
| TemplateFieldEditor의 wrapper 내부 구조 변경 시 레이아웃 회귀 | wrapper className 동일 (rounded-2xl border bg-code-bg + density padding만 차이). 본문은 그대로 |
| AccountDetail의 `key={field.id}` 위치 변경 | FieldCard에 전달하면 동일 |

---

# Verification Checklist

- [ ] `src/components/FieldCard.tsx` 신규
- [ ] `src/components/FieldCard.test.tsx` 신규 — 5 케이스
- [ ] AccountDetail.tsx — inline `<div>` → `<FieldCard label={field.label}>` (key 그대로)
- [ ] TemplateFieldEditor.tsx — inline `<div>` → `<FieldCard density="comfy">`
- [ ] 회귀 게이트 통과
- [ ] git commit + push + PR #58 누적

---

# Output

1. **Plan 파일 경로**: `docs/plans/2026-09-01-plan-g5-field-card.md` (본 문서)
2. **변경 파일**: 4 (신규 2 + 마이그레이션 2)
3. **테스트 추가**: 5건
4. **구현 가능 여부**: ✅ 가능