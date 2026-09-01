# Plan-G3 — tracking 토큰화 (tracking-[N.NNem] → tracking-{chip|label|section|eyebrow})

- Date: 2026-09-01
- Source: [brainstorm 2026-09-01-component-unification-patterns](../brainstorms/2026-09-01-component-unification-patterns.md) §7.F + §9 G3 결정
- 선행: Plan-G1 (PR #58), Plan-G2 (PR #58 누적)
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- 결정 사항: Q9=(a) 별도 plan, 의미 라명은 사용자 답변 없는 권장 기본값

---

# Goal

`tracking-[0.08em]` / `[0.16em]` / `[0.18em]` / `[0.24em]` 4종을 `tracking-chip` / `tracking-label` / `tracking-section` / `tracking-eyebrow` 토큰으로 교체.

완료 시 다음이 참:

1. `src/index.css` @theme 블록에 4개 토큰 추가
2. 호출처 22건 sed 일괄 교체
3. 단위 테스트는 변경 0 (시각 동일, wrapper 추상화 없음)
4. 회귀 게이트: typecheck / lint / test / build / Android compile+unitTest 모두 통과
5. 시각 회귀 0 (값 동일 — Plan-E `var(--error)` → `var(--color-error)` sed 패턴)

---

# Current State (2026-09-01 인스펙션)

## tracking-[0.NNem] 변종 (22건, 11 파일)

| 값 | 토큰 이름 (Plan-G3) | 인용 수 | 호출처 |
|---|---|---|---|
| `tracking-[0.08em]` | `tracking-chip` | 4 | AccountList tag / PasswordFieldView 복사 / AccountDetail tag / AccountDetail favorite |
| `tracking-[0.16em]` | `tracking-label` | 2 | AccountDetail field label / TemplatePicker eyebrow |
| `tracking-[0.18em]` | `tracking-section` | 4 | SettingsSection 2 + SettingsSection.test 2 |
| `tracking-[0.24em]` | `tracking-eyebrow` | 12 | Home (3) / AutofillTestLogin (2) / Auth (2) / AccountList (2) / CreateVault (3) |

**rg 결과**:
- 11 .tsx 파일 (SettingsSection.test.tsx 포함) + 22 인스턴스
- `tracking-[0.18em]` 4건 모두 SettingsSection — Plan-G1 wrapper 내부 (Plan-G1 단일 PR에서 함께 흡수 가능했으나 의미 토큰화로 후속 분리)
- `tracking-[0.08em]` (AccountList tag filter) — Plan-G5 TagChip과 결합 가능 (후속)

## @theme 블록 (`src/index.css:3-22`)

```css
@theme {
  --color-text: var(--text);
  --color-text-h: var(--text-h);
  ...
  --text-size-sm: 14px;
  --text-size-base: 16px;
  --text-size-lg: 18px;
}
```

→ Plan-G3: `--tracking-chip` / `--tracking-label` / `--tracking-section` / `--tracking-eyebrow` 4개 추가.

---

# Architecture

```css
@theme {
  --color-*: ...;
  --text-size-*: ...;
  /* Plan-G3: tracking 토큰 */
  --tracking-chip: 0.08em;
  --tracking-label: 0.16em;
  --tracking-section: 0.18em;
  --tracking-eyebrow: 0.24em;
}
```

**Tailwind 4 자동 매핑**: `--tracking-{name}` → `tracking-{name}` utility 자동 생성 (Plan-F1의 `--text-size-sm` → `text-size-sm`과 동일 패턴, `src/index.css:19-21`).

호출처:
```tsx
// Before
className="text-xs font-semibold uppercase tracking-[0.08em]"

// After
className="text-xs font-semibold uppercase tracking-chip"
```

**시각 회귀 0**: 값 동일 (`0.08em` → `tracking-chip` utility는 `letter-spacing: var(--tracking-chip)` = `0.08em`).

---

# Proposed Changes

### 1. `src/index.css` — @theme에 tracking 토큰 4개 추가

```css
@theme {
  --color-*: ...;
  --text-size-*: ...;

  /* Plan-G3: tracking tokens (visual spacing scale) */
  --tracking-chip: 0.08em;     /* 미니 라벨 (AccountList tag, AccountDetail tag, PasswordFieldView 복사) */
  --tracking-label: 0.16em;    /* 서브 라벨 (AccountDetail field, TemplatePicker) */
  --tracking-section: 0.18em;  /* 섹션 헤더 (SettingsSection h2) */
  --tracking-eyebrow: 0.24em;   /* 페이지 eyebrow (Home, Auth, CreateVault, Accounts, AutofillTestLogin) */
}
```

### 2. 호출처 22건 sed 일괄 교체

| Before | After | 호출처 수 |
|---|---|---|
| `tracking-[0.08em]` | `tracking-chip` | 4 |
| `tracking-[0.16em]` | `tracking-label` | 2 |
| `tracking-[0.18em]` | `tracking-section` | 4 |
| `tracking-[0.24em]` | `tracking-eyebrow` | 12 |

호출처 파일:
- `src/pages/Home.tsx` (3건 — 모두 0.24em)
- `src/pages/Auth.tsx` (2건)
- `src/pages/AutofillTestLogin.tsx` (2건)
- `src/pages/CreateVault/index.tsx` (1건)
- `src/pages/CreateVault/steps/NameStep.tsx` (1건)
- `src/pages/CreateVault/steps/PinStep.tsx` (1건)
- `src/pages/Accounts/index.tsx` (4건 — 0.24em + 0.08em 혼합)
- `src/pages/Accounts/AccountDetail.tsx` (2건 — 0.16em + 0.08em)
- `src/pages/Accounts/components/TemplatePicker.tsx` (1건 — 0.16em)
- `src/pages/Accounts/components/PasswordFieldView.tsx` (1건 — 0.08em)
- `src/components/SettingsSection.tsx` (2건 — 0.18em)
- `src/components/SettingsSection.test.tsx` (2건 — 0.18em, 테스트도 sed)

### 3. 신규 단위 테스트 — 변경 0

본 plan은 토큰화 (값 동일) — wrapper 추상화 없음. 신규 단위 테스트 0. 기존 SettingsSection.test.tsx는 토큰 문자열 변경 시 함께 sed.

---

# Tests

## 신규 — 0건 (Plan-G3은 sed 일괄)

## 기존 회귀

- **단위 테스트**: `npm run test` — 모든 기존 + 토큰 sed 일관성 통과
- **TypeScript**: `npm run typecheck` — sed 후 회귀 0
- **ESLint**: `npm run lint` — 우리 변경 파일 에러 0
- **빌드**: `npm run build` — Tailwind 4가 @theme 토큰을 자동 utility로 생성
- **Android 단위**: `compileDebugKotlin` + `testDebugUnitTest` — React 측 한정, Android 영향 0
- **Playwright E2E**: 회귀 0 (시각 동일, 사용자 직접 실행)

---

# Risks

| 리스크 | 완화 |
|---|---|
| Tailwind 4가 @theme 토큰을 자동 utility로 변환하지 않을 가능성 | Plan-F1이 이미 `--text-size-sm` → `text-size-sm` 자동 변환 확인 (2026-09-01). 동일 패턴 — 검증: `npm run build` 후 dist에 utility 존재 확인 |
| 토큰 이름 의미 불일치 — 사용자 디자인 의도와 다름 | 의미 매핑은 Plan-G3 기본값. 사용자 답변 없음 — 추후 이름 변경 가능 (사용자 의도 발견 시) |
| Plan-E의 `var(--error)` → `var(--color-error)`처럼 토큰 rename 후 외부 selector 영향 | Tailwind utility는 컴파일 단계에서 최종 CSS로 생성. 외부 셀렉터 영향 0 |
| sed 누락 | rg 사후 검증 — `rg 'tracking-\[' src/ --glob '*.tsx'` 결과 0건이어야 함 (Plan-E 검증 패턴) |
| `@theme` 토큰 추가가 다른 토큰과 충돌 | `--tracking-*` 네임스페이스는 기존 color/text-size와 분리. 충돌 0 |

---

# Rollback

- `src/index.css` 변경 (4줄 추가) + 호출처 22건 sed 일괄
- Rollback: `git revert < commit>` — 단일 PR revert로 즉시 롤백
- RiskProfile: 매우 낮음 (값 동일)

---

# Cross-Plan Integration

## Upstream

- **Plan-G1** (SettingsSection): 완료. `tracking-[0.18em]` 2건 흡수
- **Plan-G2** (PageShell/PageHeader): 완료. 본 plan과 무관
- **Plan-F1** (Input): 완료. `--text-size-*` @theme 패턴 선례

## Downstream

- **Plan-G4** (PasswordField): 본 plan과 무관 (PasswordFieldView의 `tracking-[0.08em]` 1건은 본 plan에서 토큰화)
- **Plan-G5** (TagChip/FieldCard): AccountList tag의 `tracking-[0.08em]` 2건 본 plan에서 토큰화

---

# Verification Checklist

- [ ] `src/index.css` @theme에 tracking 4종 추가
- [ ] sed 호출처 22건 (`tracking-[0.08em]` → `tracking-chip`, `[0.16em]` → `tracking-label`, `[0.18em]` → `tracking-section`, `[0.24em]` → `tracking-eyebrow`)
- [ ] rg 사후 검증 — `rg 'tracking-\[' src/` 결과 0건 (Plan-E 검증 패턴)
- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` 통과 (우리 변경 파일 0)
- [ ] `npm run test` 통과 (sed 일관성)
- [ ] `npm run build` 통과 + dist에 4개 utility 확인
- [ ] Android compile+unitTest 통과
- [ ] git commit + push + PR #58 누적

---

# Output

1. **Plan 파일 경로**: `docs/plans/2026-09-01-plan-g3-tracking-tokens.md` (본 문서)
2. **변경 파일**: 12 (1 CSS + 11 TSX)
3. **테스트 추가**: 0건 (sed 일괄)
4. **주요 리스크**: Tailwind 4 자동 utility 미생성 (확인됨 — Plan-F1 선례)
5. **구현 가능 여부**: ✅ 가능