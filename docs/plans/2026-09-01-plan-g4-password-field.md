# Plan-G4 — PasswordField 묶음 (PasswordFieldView + PasswordFieldEdit 통합)

- Date: 2026-09-01
- Source: [brainstorm 2026-09-01-component-unification-patterns](../brainstorms/2026-09-01-component-unification-patterns.md) §7.D + §9 G4 결정
- 선행: Plan-G1/G2/G3
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- 결정 사항: Q10=(b) Plan-G4 단일 PR 흡수, 사용자 답변 없는 권장 기본값

---

# Goal

**PasswordField 단일 컴포넌트**로 View/Edit 양쪽을 흡수. 비밀번호 표시/숨기기 + 복사/생성 액션 묶음을 통일.

완료 시 다음이 참:

1. `src/components/PasswordField.tsx` 신규 컴포넌트 (mode="view" | "edit" + actions 슬롯)
2. `src/pages/Accounts/components/PasswordFieldView.tsx` 삭제 (또는 deprecated wrapper)
3. `src/pages/Accounts/AccountEdit/components/PasswordFieldEdit.tsx` 삭제
4. 호출처 2곳 마이그레이션 (AccountDetail + AccountEdit/FieldEditor)
5. 단위 테스트 5 케이스
6. 회귀 게이트: typecheck / lint / test / build / Android compile+unitTest 모두 통과

---

# Current State (2026-09-01 인스펙션)

## 2 호출처 인스펙션

### PasswordFieldView (`src/pages/Accounts/components/PasswordFieldView.tsx`)

```tsx
// AccountDetail.tsx:28-49에서 호출
{field.type === "password" ? (
  <PasswordFieldView value={field.value} />
) : ...}
```

**현재 구조**:
- `useState(isVisible)` — 눈 토글
- `useClipboard().copy` — 복사
- 표시값 (`••••••••` / 실제 값)
- 액션: Eye 토글 + 복사 버튼 (inline `<button>`)

### PasswordFieldEdit (`src/pages/Accounts/AccountEdit/components/PasswordFieldEdit.tsx`)

```tsx
// AccountEdit/FieldEditor.tsx:40-44에서 호출
<PasswordFieldEdit
  value={field.value}
  onChange={(v) => onUpdate(field.id, { value: v })}
  onGenerate={onGeneratePassword ? () => onGeneratePassword(field.id) : undefined}
/>
```

**현재 구조**:
- `useState(isVisible)` — 눈 토글
- input + onChange
- 액션: Eye 토글 + 생성 버튼 (`onGenerate` optional)

## 중복 패턴

| 중복 | View (line) | Edit (line) |
|---|---|---|
| `useState(isVisible)` + Eye 토글 버튼 | 11, 19-26 | 11, 23-30 |
| EYE_OPEN/CLOSED_SVG import | 3 | 2 |
| 동일 button className | 22 | 26, 35 |
| 동일 aria-label | 23, 27 | 27, 36 |

→ **눈 토글 로직 완전 동일**. 차이는 (1) input 표시 vs 값 표시, (2) 복사 vs 생성 액션.

---

# Architecture

```tsx
<PasswordField
  mode="view"
  value={field.value}
/>
<PasswordField
  mode="edit"
  value={field.value}
  onChange={(v) => onUpdate(field.id, { value: v })}
  onGenerate={onGeneratePassword ? () => onGeneratePassword(field.id) : undefined}
/>
```

**API**:
```tsx
interface PasswordFieldProps {
  mode: "view" | "edit";
  value: string;
  onChange?: (value: string) => void;  // mode="edit" 필수
  onGenerate?: () => void;             // mode="edit" optional
  onCopy?: (value: string) => void;    // mode="view" optional (default = navigator.clipboard)
}
```

**내부**:
- `useState(isVisible)` 공유
- mode 분기:
  - `view`: 값 표시 (`••••••••` or value) + Eye 토글 + 복사 버튼
  - `edit`: `<input>` + Eye 토글 + 생성 버튼 (onGenerate 있으면)

**AccountDetail 호출처**:
- 복사 콜백이 기본 `navigator.clipboard`이면 `onCopy` optional — 기본 구현 포함

**AccountEdit 호출처**:
- onChange + onGenerate 사용

---

# Proposed Changes

### 1. `src/components/PasswordField.tsx` (신규)

```tsx
import { useState } from "react";
import { useClipboard } from "@/hooks/useClipboard";
import { EYE_OPEN_SVG, EYE_CLOSED_SVG, GENERATE_SVG } from "@/components/icons";

interface PasswordFieldProps {
  mode: "view" | "edit";
  value: string;
  /** mode="edit" 필수 */
  onChange?: (value: string) => void;
  /** mode="edit" optional */
  onGenerate?: () => void;
  /** mode="view" optional (default = useClipboard) */
  onCopy?: (value: string) => void;
}

/**
 * Plan-G4: PasswordField 단일 컴포넌트 (View/Edit 통합).
 *
 * 결정 사항:
 * - PasswordFieldView/Edit 2 컴포넌트 → 단일 PasswordField + mode prop
 * - useState(isVisible) + Eye 토글 로직 공유
 * - Plan-G1 SettingsRow의 label=ReactNode 패턴과 동일 — 하나의 컴포넌트로 두 변종 흡수
 */
export function PasswordField({
  mode,
  value,
  onChange,
  onGenerate,
  onCopy,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { copy } = useClipboard();
  const handleCopy = onCopy ?? ((v: string) => copy(v));

  if (mode === "view") {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-[var(--color-text-h)] flex-1">
          {isVisible ? value : "••••••••"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsVisible(!isVisible)}
            className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
            aria-label={isVisible ? "비밀번호 숨기기" : "비밀번호 보이기"}
          >
            {isVisible ? EYE_CLOSED_SVG : EYE_OPEN_SVG}
          </button>
          <button
            type="button"
            onClick={() => handleCopy(value)}
            className="rounded-full bg-[var(--color-accent-bg)] px-3 py-1.5 text-xs font-semibold uppercase tracking-chip text-[var(--color-accent)]"
          >
            복사
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 relative">
      <input
        type={isVisible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 pr-12 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
        data-field-value="true"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
          aria-label={isVisible ? "비밀번호 숨기기" : "비밀번호 보이기"}
        >
          {isVisible ? EYE_CLOSED_SVG : EYE_OPEN_SVG}
        </button>
        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
            aria-label="비밀번호 생성"
          >
            {GENERATE_SVG}
          </button>
        )}
      </div>
    </div>
  );
}

export default PasswordField;
```

### 2. `src/components/PasswordField.test.tsx` (신규) — 5 케이스

1. ① mode="view" 렌더 (값 표시 + Eye + 복사)
2. ② mode="edit" 렌더 (input + Eye + 생성 버튼 onGenerate 있으면)
3. ③ Eye 토글 — display state 변경
4. ④ 복사 버튼 클릭 → onCopy 콜백 호출
5. ⑤ mode="edit" + onGenerate 없을 때 — 생성 버튼 미렌더

### 3. 호출처 마이그레이션

**AccountDetail.tsx**: `PasswordFieldView` → `<PasswordField mode="view" value={field.value} />`
**AccountEdit/FieldEditor.tsx**: `PasswordFieldEdit` → `<PasswordField mode="edit" value={field.value} onChange={...} onGenerate={...} />`

### 4. 기존 컴포넌트 삭제

- `src/pages/Accounts/components/PasswordFieldView.tsx` 삭제
- `src/pages/Accounts/AccountEdit/components/PasswordFieldEdit.tsx` 삭제
- `src/pages/Accounts/AccountEdit/components/PasswordFieldEdit.test.tsx` 삭제 (있다면)

---

# Tests

## 신규

| 테스트 파일 | 케이스 |
|---|---|
| `src/components/PasswordField.test.tsx` | 5 케이스 |

## 기존 회귀

- typecheck / lint / test / build / Android

---

# Risks

| 리스크 | 완화 |
|---|---|
| AccountDetail/AccountEdit 호출처 import 누락 | rg 'PasswordField(View\|Edit)' sed로 import 일괄 교체 |
| 기존 PasswordFieldEdit.test.tsx 마이그레이션 누락 | 마이그레이션 후 rg 'PasswordField' src/ --glob '*.test.tsx' 결과 단일 file |
| 복사 버튼 기본 동작 변경 (navigator.clipboard vs useClipboard) | onCopy 미지정 시 기존 useClipboard().copy 호출 — 동작 동일 |

---

# Verification Checklist

- [ ] `src/components/PasswordField.tsx` 신규
- [ ] `src/components/PasswordField.test.tsx` 신규 — 5 케이스
- [ ] AccountDetail.tsx — PasswordFieldView → PasswordField mode="view"
- [ ] AccountEdit/FieldEditor.tsx — PasswordFieldEdit → PasswordField mode="edit"
- [ ] `src/pages/Accounts/components/PasswordFieldView.tsx` 삭제
- [ ] `src/pages/Accounts/AccountEdit/components/PasswordFieldEdit.tsx` 삭제
- [ ] `src/pages/Accounts/AccountEdit/components/PasswordFieldEdit.test.tsx` 삭제 (있다면)
- [ ] 회귀 게이트 통과
- [ ] git commit + push + PR #58 누적

---

# Output

1. **Plan 파일 경로**: `docs/plans/2026-09-01-plan-g4-password-field.md` (본 문서)
2. **변경 파일**: 5 (신규 2 + 마이그레이션 2 + 삭제 2~3)
3. **테스트 추가**: 5건
4. **구현 가능 여부**: ✅ 가능