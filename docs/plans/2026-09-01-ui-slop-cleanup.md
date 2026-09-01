# KIYO UI Slop Cleanup (2026-09-01)

## Goal

KIYO `src/` 사용자 노출 React UI에서 "설계 결정 부재"로 보이는 AI-default 텔(Tells) 6개를 정리한다.

성공 기준:
- `gradient → solid accent` 1건 — 유일했던 `bg-linear-to-br from-[var(--color-accent)] to-[#7c3aed]` 제거
- `font-mono → sans` 1건 — UI 라벨/힌트 텍스트에서 제거
- `rounded-full → small radius` 5건 (Button 기본 + chip 4건)
- `shadow-xl → shadow-sm / hairline` 1건 (IconPicker 드롭다운)
- `rounded-2xl → inner radius math` 중첩 3건
- `transition-all → transition-colors / transition-[width]` 3건

대상에서 **명시적으로 제외**:
- `slop 10` (kicker 위 heading) — `--tracking-eyebrow: 0.24em` 토큰 + Plan-G2 의도된 시스템
- `slop 12` (flat type hierarchy) — 의도된 위계 (`h1` 2rem / `h2` 24px / `text-sm` sub-header)
- `slop 19` chip/Tag 류 — `--tracking-chip` 브랜드 마크
- `slop 24/27` Spinner — 표준 Heroicons, wobble 없음
- `.agent/`, `.hermes/`, `openwiki/` — AI 리서치/문서, shipped UI 아님

## Current State

`feat/ux-accessibility` 브랜치는 UI 통합 작업 일괄 진행 중 (Plan-G1~G5, Plan-F1, Plan-X 모두 머지 또는 머지 직전). 디자인 시스템 토큰은 이미 안정화됨:
- `src/index.css:43-72` — accent `#aa3bff`, bg/border/code-bg, `--radius: 0.5rem`, `--tracking-{chip,label,section,eyebrow}` 4-tier scale
- 모든 페이지 헤더는 `PageHeader` 또는 Plan-G2 인라인 패턴 (eyebrow + h1) 사용

현재 코드에서 발견된 실제 slop (kill-ai-slop scanner 결과 + 수동 트리아지):

| Tell | 위치 | 현재 | 문제 |
|------|------|------|------|
| 01 indigo→violet gradient | `src/pages/Home.tsx:115`, `src/pages/AutofillTestLogin.tsx:20` | `bg-linear-to-br from-[var(--color-accent)] to-[#7c3aed]` on K 아이콘 | 코드베이스에서 유일한 두 gradient. `#7c3aed`는 토큰 시스템에 없는 하드코딩 |
| 34 mono for non-code | `src/pages/Auth.tsx:186` | `<p className="... font-mono ...">{fileName}</p>` | fileName은 사용자 라벨, mono 아님 |
| 34 mono for non-code | `src/pages/AutofillTestLogin.tsx:100` | `<ul className="... font-mono">` 외곽 | 내 `<code>`만 mono면 충분, 리스트 전체 mono 과함 |
| 19 max-radius Button | `src/components/Button.tsx:42` | `rounded-full` 모든 버튼 base style | 모든 variant/CTA가 pill. 토큰 `--radius: 0.5rem`과 불일치 |
| 19 chip rounded-full | `src/components/PasswordField.tsx:65` + `AccountFieldsSection.tsx:26` + `AccountTitleSection.tsx:98` + `FieldEditor.tsx:166` | `rounded-full ... px-3 py-1.5 ... uppercase` chip들 | chip은 합리적이지만 `rounded-full`은 `rounded-md`로 통일하는 게 일관 |
| 19 ErrorScreen 아이콘 | `src/components/ErrorScreen.tsx:25, 60` | `rounded-full h-12 w-12` 상태 아이콘 | tile 효과가 의도였으면 `rounded-md`, halo 아니면 그냥 사각 |
| 19 SyncErrorBanner close | `src/components/SyncErrorBanner.tsx:21` | `rounded-full h-7 w-7` close X | 배너 자체가 사각, close는 square가 일관 |
| 20 oversized shadow | `src/pages/Templates/TemplateEdit/components/IconPicker.tsx:45` | `shadow-xl` 드롭다운 | dropdown이 `rounded-2xl ... border` 보유 → border가 separator, shadow-xl 과함 |
| 21 corners don't nest | `src/pages/Accounts/AccountDetail.tsx:122` (`rounded-3xl p-6`) 안에 `AccountTitleSection.tsx:75` (`rounded-2xl px-4 py-3`) | outer 24px − inner 16px 미일치 | inner는 12px 또는 outer−padding(6) |
| 21 corners don't nest | `src/pages/Accounts/AccountEdit/components/WebsiteSelector.tsx:168` (`rounded-2xl p-4`) 안에 `:201/:244` (`rounded-2xl p-3`) | outer 16px − inner 16px | inner는 12px 또는 사각 |
| 21 corners don't nest | `src/pages/Accounts/AccountEdit/components/AccountTitleSection.tsx:75` (`rounded-2xl px-4 py-3`) 안에 `:83` (`rounded-2xl px-3 py-2`) | outer 16px − inner 16px | inner는 12px 또는 사각 |
| 26 transition-all | `src/components/inputs/PinStrengthMeter.tsx:58` | `transition-all duration-200` on width bar | width만 변화 → `transition-[width]` |
| 26 transition-all | `src/pages/Accounts/AccountEdit/components/WebsiteSelector.tsx:201, 244` | `transition-all` on hover bg | `transition-colors`로 충분 |

## Relevant Files

| File | Role |
|------|------|
| `src/index.css` | 디자인 토큰 정의 (`--radius`, `--color-*`, `--tracking-*`) — 이번 PR에서 **변경 없음** (radius 추가 토큰 불필요; `rounded-full` → `rounded-md` 직접 매핑) |
| `src/components/Button.tsx` | 모든 CTA/액션 버튼 — base style의 `rounded-full` → `rounded-md` |
| `src/components/SettingsRow.tsx` | 의도된 leaf row — 변경 없음 (slop 21 중첩에서 호출처 확인만) |
| `src/components/FieldCard.tsx` | 의도된 leaf row — 변경 없음 |
| `src/components/ErrorScreen.tsx` | 상태 아이콘 tile — `rounded-full` → `rounded-md` |
| `src/components/SyncErrorBanner.tsx` | close 버튼 — `rounded-full` → `rounded` (또는 사각) |
| `src/components/PasswordField.tsx` | copy chip — `rounded-full` → `rounded-md` |
| `src/components/inputs/PinStrengthMeter.tsx` | strength bar — `transition-all` → `transition-[width]` |
| `src/pages/Accounts/AccountEdit/components/AccountFieldsSection.tsx` | chip | 
| `src/pages/Accounts/AccountEdit/components/AccountTitleSection.tsx` | chip + 외부/내부 카드 중첩 | 
| `src/pages/Accounts/AccountEdit/components/FieldEditor.tsx` | chip | 
| `src/pages/Accounts/AccountDetail.tsx` | 외부 컨테이너 + 내부 card 중첩 | 
| `src/pages/Accounts/AccountEdit/components/WebsiteSelector.tsx` | dropdown panel + 내부 row card 중첩 + transition-all | 
| `src/pages/Templates/TemplateEdit/components/IconPicker.tsx` | dropdown — `shadow-xl` → `shadow-sm` | 
| `src/pages/Home.tsx` | K 아이콘 gradient → 단색 | 
| `src/pages/AutofillTestLogin.tsx` | K 아이콘 gradient → 단색 + `<ul>`에서 font-mono 제거 | 
| `src/pages/Auth.tsx` | fileName 표시에서 font-mono 제거 | 

## Architecture

이번 PR은 **시각 토큰 변경만** 하며, 다음은 **변경하지 않음**:
- 컴포넌트 시그니처 (`data-testid` 추가/제거, prop 추가)
- 라우팅, store, 암호화, Auth 흐름
- Playwright E2E selector (Plan-X 통과)
- Android UiAutomator selector
- i18n / copy 텍스트

따라서 **E2E 회귀 = 0** 가정 (visual 토큰만 변경, 마크업 구조 동일). 단, 다음 케이스는 예외:
- `PasswordField.tsx:65` chip 변경은 AccountDetail 표시에 영향 — **Playwright `account-detail-*` selector가 chip을 직접 타겟하는지 grep 필수**
- `Auth.tsx:186` font-mono 제거는 fileName element의 computed style 변경 — **selector가 class string 의존이면 영향**

## Proposed Changes

### 변경 1: gradient → solid accent (2건)

**파일:**
- `src/pages/Home.tsx:115`
- `src/pages/AutofillTestLogin.tsx:20`

**변경:**
```diff
- <div className="grid h-14 w-14 place-items-center rounded-3xl bg-linear-to-br from-[var(--color-accent)] to-[#7c3aed] text-3xl font-bold text-white shadow-sm">
+ <div className="grid h-14 w-14 place-items-center rounded-3xl bg-[var(--color-accent)] text-3xl font-bold text-white shadow-sm">
```

**이유:** 코드베이스의 유일한 두 gradient. `#7c3aed`는 토큰 외 하드코딩. 단색 accent이 `--color-accent` 토큰과 일관.

**위험:** Home은 login 전 첫 화면 — gradient는 의도적 "welcoming" 시그널일 수 있음. 단, Plan-G2가 "Plan-G2 범위 밖 (eyebrow/h1 인라인 유지)" 라고 명시한 Home 헤더 자체가 이미 의도적 디자인 결정이므로, gradient도 사용자 결정일 가능성. → **사용자 확인 필수** (Q1).

### 변경 2: font-mono → sans (2건)

**파일:**
- `src/pages/Auth.tsx:186` — fileName 표시
- `src/pages/AutofillTestLogin.tsx:100` — 외곽 `<ul>`

**변경 A (Auth.tsx):**
```diff
- <p className="mt-1 text-sm font-mono text-[var(--color-text-h)] truncate">
+ <p className="mt-1 text-sm text-[var(--color-text-h)] truncate">
```

**변경 B (AutofillTestLogin.tsx):**
```diff
- <ul className="mt-2 space-y-1 text-xs text-[var(--color-text)] font-mono">
+ <ul className="mt-2 space-y-1 text-xs text-[var(--color-text)]">
```
(내부 `<code>` 태그는 그대로 mono 유지 — 실제 코드 표시)

**이유:** fileName과 UI 힌트 bullet은 코드가 아님. `font-mono`는 `<code>`에만 적용.

### 변경 3: Button base rounded-full → rounded-md

**파일:** `src/components/Button.tsx:42`

**변경:**
```diff
- "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition ..."
+ "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition ..."
```

**이유:** `--radius: 0.5rem` (rounded-md)과 일관. 모든 CTA pill 아님.

**위험:** 모든 버튼 영향 (Accounts, Auth, Settings, Templates, AccountEdit, TemplateEdit). 시각 변경 큼. **`Button.test.tsx`에 className 문자열 assertion 있는지 확인** (있으면 갱신).

### 변경 4: chip rounded-full → rounded-md (4건)

**파일:**
- `src/components/PasswordField.tsx:65`
- `src/pages/Accounts/AccountEdit/components/AccountFieldsSection.tsx:26`
- `src/pages/Accounts/AccountEdit/components/AccountTitleSection.tsx:98`
- `src/pages/Accounts/AccountEdit/components/FieldEditor.tsx:166`

**변경:** 각 위치의 `rounded-full` → `rounded-md`

**이유:** `--tracking-chip`은 chip 형태의 의도된 시스템이지만, `rounded-full`은 모든 chip이 pill이라는 의미. `rounded-md`가 디자인 토큰과 일관.

**위험:** chip 시각 변경. **E2E selector가 class 일부 매칭하는지 grep** — 영향 있으면 data-testid 패턴으로 마이그레이션.

### 변경 5: 상태 아이콘/close 버튼 (3건)

**파일:**
- `src/components/ErrorScreen.tsx:25` — 아이콘 tile `rounded-full` → `rounded-md`
- `src/components/ErrorScreen.tsx:60` — 동일
- `src/components/SyncErrorBanner.tsx:21` — close X `rounded-full` → `rounded` (또는 `rounded-sm`)

**이유:** 상태 표시는 사각/작은 모서리가 정직. halo 같은 max-radius 효과 제거.

### 변경 6: IconPicker dropdown shadow-xl → shadow-sm

**파일:** `src/pages/Templates/TemplateEdit/components/IconPicker.tsx:45`

**변경:**
```diff
- className="absolute z-50 mt-2 w-full max-w-md rounded-2xl bg-[var(--color-bg)] p-4 shadow-xl border border-[var(--color-border)]"
+ className="absolute z-50 mt-2 w-full max-w-md rounded-2xl bg-[var(--color-bg)] p-4 shadow-sm border border-[var(--color-border)]"
```

**이유:** border가 이미 있고, `shadow-xl`은 오버. `shadow-sm`이 dropdown의 z-50만으로 충분.

### 변경 7: 중첩 라운드 정리 (3건) — 구현 시 재평가 결과, **적용 0건**

**계획:** 3건의 nested corner 충돌을 수정하려 했음.

**구현 시 발견:** 실제 코드 구조 재분석 결과, 모든 경우가 **sibling 카드 또는 self-contained 컴포넌트**이지 nested가 아님:

- 케이스 A: `AccountDetail.tsx:122` (`rounded-3xl p-6`) 안에 있는 자식들은 모두 leaf — tag chip (이미 `rounded-md`), `<FieldCard>` (자체 leaf), `<Button>` override (이미 `!rounded-full`). **nested corner 충돌 없음.**
- 케이스 B: `WebsiteSelector.tsx:168` (추천 카드) 안에 `:201/:244`가 nested 아니라 dropdown panel 내부 **sibling 카드** (들여쓰기로 확인됨).
- 케이스 C: `AccountTitleSection.tsx:75` (self-contained button) 안에 `:83`이 nested가 아니라 sibling div (조건부 렌더).

**결론:** 변경 7은 plan 작성 시 nested 관계를 잘못 분석한 결과. **적용하지 않음.** 사용자에게 보고 (todo 7 cancelled).

**대안 식별된 중첩 라운드 (현재 코드):** `<AccountDetail>` article(`rounded-3xl`) 안의 `<FieldCard>`(`rounded-2xl`)는 의도된 leaf card 패턴이므로 OK — `rounded-3xl` 컨테이너 안에 `rounded-2xl` leaf는 시각적으로 자연스러움 (16px가 24px 안에서 둥글게 처리됨).

### 변경 8: transition-all → 구체적 속성 (3건)

**파일:**
- `src/components/inputs/PinStrengthMeter.tsx:58` — `transition-all` → `transition-[width]`
- `src/pages/Accounts/AccountEdit/components/WebsiteSelector.tsx:201` — `transition-all` → `transition-colors`
- `src/pages/Accounts/AccountEdit/components/WebsiteSelector.tsx:244` — 동일

**이유:** 어떤 속성이 변하는지 명시. width만 변하면 `transition-[width]`, bg만 변하면 `transition-colors`.

## 결정 표 (확정: 2026-09-01)

| Q | 항목 | 결정 | 비고 |
|---|------|------|------|
| Q1 | 변경 1 (gradient 제거) | **둘 다 제거** (Home + AutofillTestLogin) | 단색 `--color-accent` + `#7c3aed` 하드코딩 정리 |
| Q2 | 변경 3 (Button base) | **`rounded-full` → `rounded-md` 전체 적용** | 모든 variant, 모든 size |
| Q3 | 변경 4 (chip 4곳) | **`rounded-full` → `rounded-md`** | Button과 일관 토큰 |
| Q4 | 변경 7 (중첩 라운드 inner) | **inner = `rounded-md`** | 3건 모두 |
| Q5 | 변경 5 (상태 아이콘/close) | **모두 `rounded-md`** | ErrorScreen ×2, SyncErrorBanner |

## 사전 grep 검증 (2026-09-01, 매칭 0 = 안전)

| 영역 | grep 명령 | 결과 |
|------|----------|------|
| Vitest className assertion | `grep -rEn "rounded-full" src/components/**/*.test.tsx` | **0건** — Button/PasswordField/ErrorScreen test 갱신 불필요 |
| Playwright e2e selector | `grep -rEn "rounded-full\|rounded-2xl" e2e/` | **0건** — E2E 회귀 0 |
| Android UiAutomator xpath | `grep -rEn "rounded-full\|rounded-2xl" android/app/src/androidTest/` | **0건** — WebView DOM selector 영향 0 |
| `transition-all` selector | `grep -rEn "transition-all" e2e/ android/app/src/androidTest/ src/components/**/*.test.tsx` | **0건** — 변경 8도 안전 |

**결론:** 변경 3/4/7/8 모두 grep 영향 0. test/pageobject 마이그레이션 작업 불필요.

## 결정 대기 항목

없음 — 모든 결정 확정. 사전 grep도 통과. 구현 진행 가능.

## Tests

### 변경 없음

- **Vitest 단위/통합:** UI 토큰 변경은 시각 영향만. 사전 grep으로 `rounded-full` 매칭 0 확인 (Vitest test, Playwright, Android). 결과: 영향 0.
- **E2E (Playwright):** 회귀 0 — 매칭 0으로 확인. `transition-all`도 매칭 0.

### 추가 (manual verification)

1. `npm run dev` 후 다음 화면 시각 확인:
   - Home: K 아이콘이 단색 accent인지
   - Auth: fileName이 sans인지, mono 잔존 없음
   - AutofillTestLogin: K 아이콘 단색, `<ul>` sans, 내부 `<code>`만 mono
   - Accounts > AccountDetail: 외부 컨테이너 + 내부 카드 코너 정합
   - Accounts > AccountEdit > WebsiteSelector: 드롭다운 shadow-sm, 카드 코너 정합
   - Templates > TemplateEdit > IconPicker: 드롭다운 shadow-sm
   - Settings > UISection: 토글, 행 정렬 (Button 영향 시 size)
2. 다크/라이트 모두 확인 (`prefers-color-scheme: dark` + `.dark` 명시 토글)
3. 모바일 viewport (≤1024px) 확인 — `index.css:83-85` base font 변경 영역

### Android 영향

- **WebView DOM 영향 0** 가정 (class token만 변경, role/data-testid 동일). 단, `rounded-*` class가 E2E selector에 매칭된다면 영향. pre-merge grep:
  ```
  grep -rEn 'rounded-full|rounded-2xl' android/app/src/androidTest/
  ```
  매칭 0이어야 안전. 매칭 있으면 별도 PR로 분리.

## Risks

### 시각 회귀 (중)

- **Button base 변경은 모든 화면 영향.** 의도가 pill이었다면 전체 UI 톤이 변함. 변경 전 git status에 변경 안 된 상태로 스크린샷 확보 추천 (Playwright `npx playwright test --update-snapshots` 대신 manual).
- **중첩 라운드 정리는 leaf card 시각 무게가 살짝 줄어듦.** "outer = 24px, inner = 8px" 비율이 일부 사용자/디자이너에게 "너무 작아" 보일 수 있음. 변경 7은 사용자 확인 권장.

### E2E 회귀 (낮음, 단 확인 필요)

- 변경 4 (chip) 적용 전 grep으로 영향 받는 pageobject 식별. 없으면 0.
- 변경 3 (Button) 적용 전 `Button.test.tsx`의 `rounded-full` assertion 갱신.

### 기능 회귀 (0)

- 모든 변경이 className 속성 변경만. 마크업 구조, 시그니처, 동작 동일.
- `transition-all → transition-colors/[width]`는 시각 효과 보존 (애니메이션 대상 속성만 좁힘).

### 데이터/보안 (0)

- 색상/모서리/transition만. 암호화, 인증, store 무관.

### 호환 (0)

- 토큰 추가 없음. 기존 `--radius: 0.5rem` 그대로.

## Rollback

- **변경 단위별 revert 가능.** 각 파일이 작고 self-contained. `git revert <sha>` 시 시각만 이전 상태로.
- **단, Button base 변경은 광범위 → revert 시 다른 PR과 충돌 가능.** 머지 전 squash commit 유지 권장.

## Verification Checklist

머지 전:
- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` 통과 (E2E selector 영향 시 rule 갱신)
- [ ] `npm run test` 통과 (Button/PasswordField/ErrorScreen test 갱신 포함)
- [ ] `grep -rEn 'rounded-full' e2e/` 매칭 0
- [ ] `grep -rEn 'rounded-full|rounded-2xl' android/app/src/androidTest/` 매칭 0
- [ ] 위 결정 표 Q1~Q5 사용자 확정
- [ ] Home / Auth / AutofillTestLogin / Accounts / Templates 화면 시각 확인 (light + dark)
- [ ] Playwright E2E suite 통과 (회귀 0 확인)
- [ ] Android E2E suite 미실행 (사용자가 직접 — `npm run test:e2e:android`은 사용자 영역)

## Cross-Plan Integration

**Upstream:**
- Plan-G1 (`docs/plans/2026-09-01-plan-g1-settings-section-row.md`) — SettingsRow의 `rounded-2xl`은 leaf라 변경 없음
- Plan-G3 (`docs/plans/2026-09-01-plan-g3-tracking-tokens.md`) — tracking 토큰은 이번 PR과 무관 (eyebrow/label/section/chip)
- Plan-G4 (`docs/plans/2026-09-01-plan-g4-password-field.md`) — PasswordField의 chip은 이번 변경 4에 포함
- Plan-G5 (`docs/plans/2026-09-01-plan-g5-field-card.md`) — FieldCard는 leaf라 변경 없음

**Downstream:**
- 없음 (시각 토큰 cleanup은 다른 plan의 upstream이 아님)

**체크리스트:**
- [ ] Plan-G4 머지 상태 확인 (PasswordField.test.tsx 영향)
- [ ] Plan-G1 머지 상태 확인 (SettingsRow는 leaf, 무영향)

## See Also

- skill: `kill-ai-slop` (taxonomy + detection + fixes 참조)
- taxonomy 01 (gradient), 19 (max-radius), 20 (oversized shadow), 21 (corners don't nest), 26 (springy hover), 34 (mono for non-code)