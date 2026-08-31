# Brainstorm — Input/Form Design System 통일 (Track 3 후속)

- Date: 2026-09-01
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- Source: STRATEGY §3 (Track 3 UX·접근성·인터랙션 품질)
- Status: Brainstorm (no code changed)
- Scope: STRATEGY §3의 "더블클릭/중복 제출 방지" 완료(Plan-B-1/2/3) 후속으로, **Input/Select/Textarea/Checkbox 컴포넌트 통일**만 다룸. 보안·암호화·자동잠금은 §4 범위.

---

## 1. Problem

Track 3 Plan-B (Plan-B-1/2/3)는 **Button.tsx** + `FormDialog`/`ConfirmDialog` + 21개 inline `<button>` → `<Button>` 마이그레이션으로 **버튼 일관성**은 완료. 하지만 **input/textarea/select/checkbox**는 여전히 **7가지 className 변종**으로 흩어져 있음.

| 변종 | rounded | padding | text-size | focus 스타일 | 사용처 |
|---|---|---|---|---|---|
| A1 | `rounded-2xl` | `px-3 py-2` | `text-sm` | `focus:border-accent` | FieldEditor(6), TemplateFieldEditor(4) |
| A2 | A1 | A1 | A1 | A1 + `border-error` | TemplateFieldEditor label |
| A3 | A1 | A1 | A1 + `text-muted` + `bg-code-bg` | — | TemplateFieldEditor readonly |
| B1 | `rounded-lg` | `px-3 py-2` | `text-sm` | `focus:border-accent + focus:ring/20` | PinChangeDialog(3) |
| B2 | `rounded-lg` | `px-3 py-1.5` | `text-sm` | `focus:ring-2 + focus:border-transparent` | UISection select, SecuritySection select |
| C | `rounded-2xl` | `px-4 py-3` | `text-sm` | `focus:border-accent` + `bg-code-bg` | FileOpenDialog, FileCreateDialog, NameStep, PinStep |
| D | `rounded-lg` | `px-4 py-3` | `text-base` | `focus:border-accent + focus:ring/20` | Auth PIN |

**총 20+ input/select/textarea + 1 checkbox = 7 변종**. Button은 Plan-B로 통일됐으나 **Input/Form만 방치**.

---

## 2. Goal

1. **단일 Design System**: `Input` + `Select` + `Textarea` + `Checkbox` 4종 통일 컴포넌트
2. **Props 표준화**: `size`(3) + `variant`(3) + `as`(`input`/`select`/`textarea`) + `disabled`/`readonly`/`error` 상태
3. **a11y 기본 내장**: `aria-invalid` + `aria-describedby`(에러), `aria-readonly`, `aria-disabled`
3. **마이그레이션**: 16개 호출처(6페이지 + 4다이얼로그) 단일 PR로 교체
4. **회귀 0**: 기존 Playwright E2E 44/44 + 단위 테스트 통과

---

## 3. Context

### 3.1 인스펙션한 파일/모듈

| 영역 | 파일 | input/select 개수 | 비고 |
|---|---|---|---|
| Accounts | `FieldEditor.tsx` | 6(input) + 1(select) | Account 필드 편집 |
| Templates | `TemplateFieldEditor.tsx` | 4(input) + 1(select) + 1(textarea) | 템플릿 필드 편집 |
| Settings | `UISection.tsx` | 1(select) | font-size |
| Settings | `SecuritySection.tsx` | 1(select) | auto-lock (disabled 상태 있음) |
| 다이얼로그 | `PinChangeDialog.tsx` | 3(input PIN) | |
| 다이얼로그 | `FileOpenDialog.tsx` | 1(input PIN) + 1(file) | file은 hidden |
| 다이얼로그 | `FileCreateDialog.tsx` | 2(input) + 1(checkbox) | |
| CreateVault | `NameStep.tsx` | 1(input) | 에러 상태 표시(aria-invalid) |
| CreateVault | `PinStep.tsx` | 1(input PIN) | |
| Auth | `Auth.tsx` | 1(input PIN) | |

**총 20 input/select/textarea + 1 checkbox = 7 변종**

### 3.2 기존 아키텍처

```
src/components/
├── Button.tsx           ✅ 통일 완료 (Plan-B)
├── Spinner.tsx          ✅ 통일 완료 (Plan-A2)
├── SyncErrorBanner.tsx  ✅ 통일 완료 (Plan-A1)
├── dialogs/
│   ├── BaseDialog.tsx
│   ├── FormDialog.tsx
│   ├── ConfirmDialog.tsx
│   ├── FileOpenDialog.tsx
│   ├── FileCreateDialog.tsx
│   └── PinChangeDialog.tsx
├── inputs/
│   └── PinStrengthMeter.tsx  (기존 유일 input 계열)
└── dialogs/
```

**신규 필요**: `inputs/Input.tsx`, `inputs/Checkbox.tsx`, `inputs/index.ts`

---

## 4. Constraints

| 제약 | 내용 |
|---|---|
| cryptoKey lifecycle | UI 변경이 메모리 키에 영향 없음 |
| 자동잠금/세션 만료 | UI 변경과 충돌 없음 |
| React 19 + TS strict | 타입 안전성 필수 |
| Tailwind 4 + Ionic | 기존 토큰(`var(--color-*)`) 사용 |
| Capacitor 8 | webview 내 UI 변경은 native 영향 없음 |
| Playwright E2E | 기존 셀렉터(`placeholder`, `data-testid`) 유지 필요 |
| i18n 향후 | 모든 사용자 문구 prop/key로 분리 |

---

## 5. Existing Architecture (요약)

```
[사용자 입력] → [Input/Select/Textarea/Checkbox 컴포넌트] → [FormDialog/자체 form] → [store mutation] → [암호화/DB]
```

- `FormDialog`는 children으로 input을 받음 (자체 input X)
- `PinStrengthMeter`는 input 옆 표시용 (이미 컴포넌트화됨)
- 색상 토큰은 `var(--color-*)`로 통일됨 — 그대로 재사용

---

## 6. Relevant Previous Knowledge

| 문서 | 내용 |
|---|---|
| STRATEGY §3 Track 3 | "더블클릭/중복 제출 방지" 완료(Plan-B), "에러 토스트/인라인 에러" 완료(Plan-A1) |
| Plan-B brainstorm | Button 통일 3-PR 분할 완료, `label` prop 필수 패턴 확립 |
| Plan-A1 brainstorm | `mapError()` + `SyncErrorBanner` + 호출처 8곳 try/catch — 인라인 에러 표시 패턴 |
| `docs/brainstorms/2026-08-30-track3-ux-accessibility.md` | Track 3 전체 진행 현황, §7/§8 Options 참조 |
| `docs/plans/2026-08-30-plan-b3-settings-templates-buttons.md` | Plan-B-3 완료, 21개 inline button → Button 마이그레이션 패턴 |

---

## 7. Options (결정 필요한 Q-table)

| Q | 질문 | 옵션 | 권장 | 상태 |
|---|---|---|---|---|
| Q1 | 통합 컴포넌트 범위 | (a) Input만 (b) Input+Select (c) Input+Select+Textarea+Checkbox | **(c) 모두** | ✅ 확정 (2026-09-01 사용자 `c`) |
| Q2 | Size variants 정책 | (a) 1 size 고정 (`md`) (b) 2 size (`sm`/`md`) **(c) 3 size `sm`/`md`/`lg`** | **(c) 3 size** | ✅ 확정 (2026-09-01) — `sm: py-1.5 text-sm`, `md: py-2 text-sm` (기본값), `lg: py-3 text-base`. 사용처: Auth `lg`, SecuritySection/UISection `sm`, 나머지 `md` |
| Q3 | Focus 스타일 | (a) A1 순수 `focus:border-accent` (b) B2 `focus:ring-2 + border-transparent` **(c) B1 `focus:border-accent + focus:ring/20`** | **(c) B1 변형** | ✅ 확정 (2026-09-01) — `focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]` |
| Q4 | Border radius | **(a) `rounded-lg` (4px)** (b) `rounded-2xl` (8px) | **(a) rounded-lg** | ✅ 확정 (2026-09-01) — Button은 `rounded-full` (완전 둥글게) 유지, Input은 `rounded-lg` (4px)로 의도적 분리. 7변종 중 A1/A2/A3/C `rounded-2xl` → `rounded-lg`로 마이그레이션 |
| Q5 | Variant/상태 정책 | (a) default만 (b) default/readonly/error + disabled native **(c) default/readonly/error/disabled 4 variant** | **(c) 4 variant** | ✅ 확정 (2026-09-01) — `default` (기본), `readonly` (`bg-code-bg + text-muted` + `aria-readonly`), `error` (`border-error + aria-invalid + aria-describedby` 자동 연결), `disabled` (`opacity-50 cursor-not-allowed` + `aria-disabled`). variant 4개로 모두 명시적 처리 |
| Q6 | 컴포넌트 구조 | (a) 별도 Input/Select/Textarea 3개 **(b) 단일 `Input` + `as` prop + 별도 Checkbox** | **(b) 단일 + as prop** | ✅ 확정 (2026-09-01) — `Input` props: `as?="input"\|"select"\|"textarea"`, `size?="sm"\|"md"\|"lg"`, `variant?="default"\|"readonly"\|"error"\|"disabled"`, `label?`, `errorId?`, `helperText?`. `Checkbox`는 별도 (구조 다름 — `<input type="checkbox">` + label wrapping) |
| Q7 | 마이그레이션 전략 | (a) 단계적 PR 분할 **(b) 단일 PR 전체** | **(b) 단일 PR** | ✅ 확정 (2026-09-01) — 16 호출처 + Input/Checkbox 컴포넌트 신규 모두 단일 PR. Plan-B-3 (21 inline button) 단일 PR 패턴 일관. 회귀 게이트: typecheck / lint / test / build / Android compile+unitTest / Playwright E2E 44/44 |
| Q8 | Tests/회귀 게이트 | (a) 단위만 **(b) 단위 + 기존 E2E snapshot 회귀** | **(b) 단위 + 기존 E2E** | ✅ 확정 (2026-09-01) — `Input.test.tsx`: size 3 × variant 4 × as 3 = 36 케이스 + a11y (aria-invalid/describedby/readonly/disabled). `Checkbox.test.tsx`: checked/unchecked/disabled/label 4 케이스. 기존 Playwright E2E 44/44 통과 확인 (placeholder/data-testid 셀렉터 유지). Android 영향 0 (webview 내 UI) |

---

## 8. Recommended Direction

**Q1~Q8 모두 확정 (2026-09-01)** + **Plan 분할 (2026-09-01 사용자 결정 `a`)**:

- **Q1**: Input + Select + Textarea + Checkbox 모두 통합
- **Q2**: 3 size (`sm`/`md`/`lg`) — `sm: py-1.5 text-sm`, `md: py-2 text-sm` (기본), `lg: py-3 text-base`
- **Q3**: `focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)]`
- **Q4**: `rounded-lg` (4px) — Button `rounded-full`와 의도적 분리
- **Q5**: 4 variant (`default`/`readonly`/`error`/`disabled`)
- **Q6**: 단일 `Input` + `as` prop + 별도 `Checkbox`
- **Q7**: 단일 PR 전체 (16 호출처 + 컴포넌트)
- **Q8**: 단위 테스트 + 기존 Playwright E2E 회귀

**Plan 분할 (사용자 2026-09-01 `a` 결정)**:
- **Plan-F1 (이 plan)**: 일반 Input/Select/Textarea/Checkbox
  - 호출처 25개 (16 + 추가 9)
  - 호출처 매핑: FieldEditor/TemplateFieldEditor/UISection/SecuritySection/NameStep/PinStep/PinChangeDialog/FileOpenDialog/FileCreateDialog/Auth/AccountTitleSection/Templates/TemplateEdit
  - 회귀 게이트: typecheck / lint / test / build / Android / Playwright E2E 44/44
- **Plan-F2 (후속, 별도 brainstorm)**: 특수 input
  - Search input (icon overlay) — `Accounts/index.tsx:212`, `WebsiteSelector.tsx:148`
  - Range slider — `PasswordGenerator.tsx:144`
  - Input with right slot (icon/button) — `PasswordFieldEdit.tsx:15`, `PasswordGenerator.tsx:196`
  - Label-wrapping input — `AccountTitleSection.tsx`
  - 5개 호출처, sub-decisions: `leftIcon`/`rightIcon`/`rightSlot`/`leftSlot` API, slider 시각 정책
  - F1 완료 + 사용자 결정 후 진행

**F1 구현 요약**:
1. `src/components/inputs/Input.tsx` 신규 — `as?`/`size?`/`variant?` props
2. `src/components/inputs/Checkbox.tsx` 신규
3. `src/components/inputs/index.ts` export
4. 호출처 25곳 마이그레이션 (F2 범위 제외)
5. 회귀 게이트 통과 → PR 개설

**이유**:
- Plan-A → A1/A2, Plan-7 → 7a/7b 분할 패턴과 일관
- F1은 25 호출처로 충분한 작업량 — 단일 plan으로 관리 가능
- F2의 sub-decisions (icon overlay API, slider 정책)은 별도 design 결정 필요 — 함께 흡수 시 plan body 비대 + 결정 복잡도 ↑
- E2E 회귀 0 가능: F1은 `placeholder`/`getByLabel` 셀렉터 유지 (단, `getByLabel` 사용 시 `htmlFor`+`id` 연결 확인)

---

## 9. Plan 분할 + Open Questions (F1 확정, F2 후속)

**F1 (이 plan) — Q1~Q8 모두 확정, Plan 분할 (2026-09-01 사용자 `a`)**.

다음 단계:
1. `ce-plan` 개설 → `docs/plans/2026-09-01-plan-f1-input-form-design-system.md`
2. `Goal` / `Current State` (인스펙션) / `Proposed Changes` / `Tests` / `Risks` / `Verification Checklist` 작성
3. 구현 착수 (단일 PR)
4. 회귀 게이트 통과 → PR 개설
5. brainstorm §12에 `Decision Provenance` 추가 → Track 3 brainstorm과 cross-link

**F2 (후속 brainstorm 예정)**:
- Search input (icon overlay) — `leftIcon`/`rightIcon` API
- Range slider — 별도 컴포넌트 또는 변형 variant
- Input with right slot (button inside) — `rightSlot` API
- Label-wrapping input 구조
- 5개 호출처
- F1 완료 + 사용자 결정 후 진행

---

## 10. 다음 단계

Q2부터 1개씩 대화형으로 확정 → 확정 시마다 brainstorm 문서 갱신 → Q8까지 완료되면 `ce-plan` 개설 → 구현 착수.

---

## 11. Re-sequencing Impact

- Track 3 §7/§8에서 Plan-D PR 2(보류) / a11y audit / Plan-7a 2차 / Plan-7b 이후로 밀림
- 본 brainstorm이 **Track 3의 다음 plan(Plan-F)**으로 삽입됨

---

## 12. Decision Provenance

| 결정 | 날짜 | 출처 |
|---|---|---|
| Q1: Input+Select+Textarea+Checkbox 모두 통합 | 2026-09-01 | 사용자 직접 `c` 선택 |
| Q2: 3 size (`sm`/`md`/`lg`) | 2026-09-01 | 사용자 "그래" (확인) |
| Q3: focus `border + ring/20` (B1 변형) | 2026-09-01 | 사용자 "ㅁ" (한국어 자판 자음 'c' 위치) |
| Q4: `rounded-lg` (4px) 통일 | 2026-09-01 | 사용자 "이왕이면 lg 이정도만 사용해" |
| Q5: 4 variant (default/readonly/error/disabled) — disabled는 별도 | 2026-09-01 | 사용자 "native 말고 만들어따로" |
| Q6: 단일 Input + as prop + 별도 Checkbox | 2026-09-01 | 사용자 "b" |
| Q7: 단일 PR 전체 | 2026-09-01 | 사용자 "b" |
| Q8: 단위 + 기존 E2E 회귀 | 2026-09-01 | 사용자 "b" |
| Plan 분할 (F1 메인 + F2 특수) | 2026-09-01 | 사용자 "a" — Plan-A → A1/A2, Plan-7 → 7a/7b 분할 패턴과 일관, F1 충분한 작업량, F2 sub-decisions 분리 |
| 호출처 추가 9곳 (AccountTitleSection/PasswordFieldEdit/WebsiteSelector/Accounts/index/Templates/TemplateEdit/PasswordGenerator slider/PasswordGenerator checkbox/Templates/TemplateEdit textarea) | 2026-09-01 | 인스펙션 cross-check (brainstorm 16 → 실제 25 호출처) |