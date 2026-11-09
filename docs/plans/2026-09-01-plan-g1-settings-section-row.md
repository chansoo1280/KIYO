# Plan-G1 — SettingsSection + SettingsRow (Settings 행 디자인 시스템 통일)

- Date: 2026-09-01
- Source: [brainstorm 2026-09-01-component-unification-patterns](../brainstorms/2026-09-01-component-unification-patterns.md) §7/§8 (Plan-G 시리즈: **G1 = 본 plan**, G2~G5 후속)
- 선행: Plan-B-1/2/3 (Button), Plan-F1 (Input/Form 디자인 시스템), Plan-A1 (에러), Plan-E (AccountEdit/TemplateEdit 통일)
- 후속: Plan-G2 (PageHeader/PageShell), Plan-G3 (tracking 토큰화), Plan-G4 (PasswordField 묶음), Plan-G5 (TagChip/FieldCard)
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- 결정 사항: brainstorm Q1=(a), Q6=(b), Q7=(a), Q8=(a), Q12=(a), Q13=종결, Q-신규=(a)
- **신규 plan** — Track 3 디자인 시스템 통합의 Plan-G 시리즈 첫 단계

---

# Goal

**Settings 행 디자인 시스템 통일** 완료 시 다음이 참:

1. `src/components/SettingsSection.tsx` + `SettingsRow.tsx` 신규 wrapper 컴포넌트
2. 호출처 6곳 (1 page + 4 sections) 마이그레이션 — 14 row + 4 section header
3. 4개 Settings 섹션 헤더 `<h3>` → `<h2>`로 위계 정정 (TemplateEdit 패턴 일관)
4. 단위 테스트 2개 (SettingsSection.test.tsx + SettingsRow.test.tsx)
5. 회귀 게이트: `typecheck` / `lint` / `test` / `build` / Android compile+unitTest 모두 통과
6. Playwright E2E 회귀 0 — Settings 화면 사용자 인터랙션은 변경 없음 (wrapper 마이그레이션)

**범위 밖 (Plan-G 시리즈 후속)**:
- PageHeader/PageShell → Plan-G2
- tracking 토큰화 → Plan-G3
- PasswordField 묶음 → Plan-G4
- TagChip/FieldCard 통합 → Plan-G5

---

# Current State (2026-09-01 인스펙션)

## 1. 인라인 row 패턴 (14회) — Settings 6 파일 모두 동일 className 복붙

**row className** (`flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]`):

| # | 파일 | 라인 | 라벨 | 컨트롤 | 비고 |
|---|---|---|---|---|---|
| 1 | `Settings/index.tsx` | 43 | 파일변경 | `<Button primary>` | handleFileChange |
| 2 | `Settings/index.tsx` | 48 | 앱 정보 | `<Button ghost>` | AppInfoDialog |
| 3 | `SecuritySection.tsx` | 144 | PIN | `<Button primary>` | PinChangeDialog |
| 4 | `SecuritySection.tsx` | 152 | 자동잠금 | `<Input as="select" size="sm">` | disabled={!isEncrypted} |
| 5 | `SecuritySection.tsx` | 182 | 생체인증 로그인 | `<Button ghost>` | disabled={!isEncrypted} |
| 6 | `UISection.tsx` | 31 | 다크모드 | 커스텀 토글 button (자체 className) | theme switch |
| 7 | `UISection.tsx` | 52 | 글자크기 | `<Input as="select" size="sm">` | font-size |
| 8 | `DataSection.tsx` | 156 | 백업 | `<Button primary>` | FileCreateDialog |
| 9 | `DataSection.tsx` | 160 | 복원 | `<Button ghost>` | FileOpenDialog |
| 10 | `DataSection.tsx` | 164 | 자동백업 상태 + 켜기/해제 | `<Button ghost>` | disabled={!nativeAvailable \|\| !isEncryptedVault} |
| 11 | `AutofillSection.tsx` | 168 | 자동완성 사용 | custom switch | Capacitor.isNativePlatform 분기 |
| 12 | `AutofillSection.tsx` | 206 | 자동완성 사용 (Android) | `<button role="switch">` (커스텀 토글) | native toggle |
| 13 | `AutofillSection.tsx` | 239 | 자동완성 서비스 상태 | `<Button ghost>` | isEnabled ? "설정" |
| 14 | `AutofillSection.tsx` | 274/287 | 자동완성 상태 추가 | `<Button ghost>` | 2건 |

**확인 완료**: `rg "rounded-2xl border border-\[var\(--color-border\)\] bg-\[var\(--color-bg\)\] px-4 py-4" src/pages/Settings/` → 14건 매칭.

## 2. 인라인 섹션 헤더 (4회) — 정확히 같은 className

**section header className** (`mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]`):

| # | 파일 | 라인 | 텍스트 | 비고 |
|---|---|---|---|---|
| 1 | `SecuritySection.tsx` | 140 | Security | `<h3>` |
| 2 | `UISection.tsx` | 27 | UI | `<h3>` |
| 3 | `DataSection.tsx` | 152 | Data | `<h3>` |
| 4 | `AutofillSection.tsx` | 201 | Autofill | `<h3>` |

## 3. 위계 정상화 근거 (Q6 결정)

- `Settings/index.tsx:31` → `<h1>Settings</h1>` 페이지 단일
- 현재 `h1 → h3` skip은 의도된 것으로 보였으나, `Templates/TemplateEdit/index.tsx`는 이미 `<h1>템플릿 수정</h1> + <h2>기본 정보</h2> + <h2>필드 정의</h2>` 패턴으로 `<h2>` 정정됨
- 동일 페이지 위계 일관 위해 Settings도 `<h1>Settings</h1> + <h2>Security/UI/Data/Autofill</h2>`로 정정

## 4. 기존 컴포넌트 의존성

| 의존 컴포넌트 | 출처 | 사용처 |
|---|---|---|
| `<Button>` | Plan-B | 14 row 중 7 |
| `<Input as="select" size="sm">` | Plan-F1 | 14 row 중 2 (SecuritySection autoLock, UISection fontSize) |
| `<Input as="select" variant="disabled">` | Plan-F1 | SecuritySection autoLock (disabled 상태) |
| `<Button disabled={...}>` | Plan-B | SecuritySection 생체인증, DataSection 자동백업 |
| 커스텀 토글 (`<button role="switch">`) | 인라인 (Plan-B-3에서 `<Button>` 부적합 결정) | UISection 다크모드, AutofillSection 자동완성 토글 |

**주의**: 커스텀 토글 2건(다크모드/자동완성)은 `<Button>` 마이그레이션 시 **시각적/의미적 토글로 `<Button>` 부적합** 결정 — Plan-B-3 노트 유지. Plan-G1은 wrapper 도입이므로 **토글 자체는 그대로 유지**, row 컨테이너만 SettingsRow로 래핑.

## 5. AutofillSection 보조 텍스트 패턴 (Q7 결정 근거)

`AutofillSection.tsx:206-212` — label 자리에 보조 텍스트:
```tsx
<div className="flex flex-col gap-1">
  <span className="font-medium">자동완성 사용</span>
  <span className="text-xs text-[var(--color-text-muted)]">앱에서 자동완성 기능 사용 여부</span>
</div>
```

→ **label을 ReactNode로 받아 흡수**. SettingsRow의 `label` prop은 `ReactNode` (Q7=a).

---

# Relevant Files

| 파일 | 역할 | 변경 |
|---|---|---|
| `src/components/SettingsSection.tsx` (신규) | 섹션 wrapper — `<h2>` 제목 + children | 신규 |
| `src/components/SettingsRow.tsx` (신규) | 행 wrapper — `<div>` 컨테이너 + label + children | 신규 |
| `src/components/SettingsSection.test.tsx` (신규) | 단위 테스트 | 신규 |
| `src/components/SettingsRow.test.tsx` (신규) | 단위 테스트 | 신규 |
| `src/pages/Settings/index.tsx` | 페이지 (자체 2 row 포함) | 마이그레이션 |
| `src/pages/Settings/components/SecuritySection.tsx` | 보안 섹션 (3 row) | 마이그레이션 + `<h3>` → `<h2>` |
| `src/pages/Settings/components/UISection.tsx` | UI 섹션 (2 row) | 마이그레이션 + `<h3>` → `<h2>` |
| `src/pages/Settings/components/DataSection.tsx` | 데이터 섹션 (3 row) | 마이그레이션 + `<h3>` → `<h2>` |
| `src/pages/Settings/components/AutofillSection.tsx` | 자동완성 섹션 (4 row) | 마이그레이션 + `<h3>` → `<h2>` |

---

# Architecture

```
[Settings 페이지]
  <SettingsSection title="Security">
    <SettingsRow label="PIN">
      <Button variant="primary" .../>
    </SettingsRow>
    <SettingsRow label="자동잠금">
      <Input as="select" size="sm" variant={!isEncrypted ? "disabled" : "default"} .../>
    </SettingsRow>
    <SettingsRow label="생체인증 로그인">
      <Button variant="ghost" disabled={!isEncrypted} .../>
    </SettingsRow>
  </SettingsSection>

  <SettingsSection title="UI">
    <SettingsRow label="다크모드">
      <div className="flex items-center gap-3">  ← 토글은 그대로 인라인
        <button role="switch" .../>
      </div>
    </SettingsRow>
    <SettingsRow label="글자크기">
      <Input as="select" size="sm" .../>
    </SettingsRow>
  </SettingsSection>
```

**SettingsSection**: `<div>` + `<h2>` 헤더 + `children` 슬롯. 헤더 className은 기존 4개 섹션이 동일하게 사용하던 `mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]` 그대로 흡수.

**SettingsRow**: `<div>` row 컨테이너 + `<label>` slot + `<children>` 슬롯. row className은 인라인 패턴 14곳의 `flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]` 그대로 흡수.

**API**:
```tsx
interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

interface SettingsRowProps {
  label: ReactNode;  // string 또는 ReactNode (보조 텍스트 패턴 흡수)
  children: ReactNode;
}
```

---

# Proposed Changes

## 신규 컴포넌트

### 1. `src/components/SettingsSection.tsx` (신규)

```tsx
import type { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">
        {title}
      </h2>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

export default SettingsSection;
```

**변경**:
- `<h3>` (현재 4개 섹션 인라인) → `<h2>` (Q6 결정, TemplateEdit의 `<h1>+<h2>+<h2>` 패턴 일관)
- `<div className="space-y-3">` 내부 children 컨테이너로 row 간격 흡수 (4개 섹션 모두 동일 패턴)
- 기존 헤더 className 정확히 보존

### 2. `src/components/SettingsRow.tsx` (신규)

```tsx
import type { ReactNode } from "react";

interface SettingsRowProps {
  label: ReactNode;  // Q7 결정: string 또는 ReactNode (보조 텍스트 패턴)
  children: ReactNode;
}

export function SettingsRow({ label, children }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
      <div>{label}</div>
      {children}
    </div>
  );
}

export default SettingsRow;
```

**변경**:
- 인라인 row className 14곳 그대로 흡수
- `label`은 `<div>`로 래핑 (string이면 text, ReactNode면 그대로 렌더)
- disabled/오버레이는 children에 위임 (Q8 결정 — Input `variant="disabled"` / Button `disabled` prop)

## 호출처 마이그레이션

### 3. `src/pages/Settings/index.tsx` (자체 2 row)

**Before**:
```tsx
<section className="space-y-4">
  <SecuritySection />
  <UISection />
  <DataSection />
  <AutofillSection />

  <div className="flex flex-col gap-3">
    <div className="flex items-center justify-between gap-3 rounded-2xl ...">
      <span>파일변경</span>
      <Button variant="primary" .../>
    </div>
    <div className="flex items-center justify-between gap-3 rounded-2xl ...">
      <span>앱 정보</span>
      <Button variant="ghost" .../>
    </div>
  </div>
</section>
```

**After**:
```tsx
<section className="space-y-4">
  <SecuritySection />
  <UISection />
  <DataSection />
  <AutofillSection />

  <SettingsSection title="파일">
    <SettingsRow label="파일변경">
      <Button variant="primary" .../>
    </SettingsRow>
    <SettingsRow label="앱 정보">
      <Button variant="ghost" .../>
    </SettingsRow>
  </SettingsSection>
</section>
```

**예외 처리 결정**:
- `Settings/index.tsx` 자체 row 2건은 "섹션 제목"이 없음 (파일변경/앱 정보). `<SettingsSection title="파일">`으로 묶는 게 자연스러운가, 아니면 단순 `<div className="flex flex-col gap-3">`로 둘 것인가?
- **권장 (b)**: 별도 wrapper 없이 단순 `<div className="flex flex-col gap-3">` 유지 — 2 row는 섹션이 아니라 "Miscellaneous" 영역. 굳이 wrapper 도입 시 의미 없는 title 부착이 됨. 마이그레이션 시 두 row만 `<SettingsRow>`로 교체하고 컨테이너는 그대로 두기

→ **3번 결정**: SettingsSection으로 묶지 않고 SettingsRow만 적용. 컨테이너 `<div className="flex flex-col gap-3">`는 유지.

### 4. `src/pages/Settings/components/SecuritySection.tsx` (3 row + h3)

**Before**:
```tsx
return (
  <div>
    <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">
      Security
    </h3>
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl ...">
        <span>PIN</span>
        <Button .../>
      </div>
      ...
    </div>
    ...
  </div>
);
```

**After**:
```tsx
import { SettingsSection, SettingsRow } from "@/components/SettingsSection"; // 분리 필요
import { SettingsSection } from "@/components/SettingsSection";
import { SettingsRow } from "@/components/SettingsRow";

return (
  <SettingsSection title="Security">
    <SettingsRow label="PIN">
      <Button .../>
    </SettingsRow>
    <SettingsRow label="자동잠금">
      <Input as="select" size="sm" variant={!isEncrypted ? "disabled" : "default"} .../>
    </SettingsRow>
    <SettingsRow label="생체인증 로그인">
      <Button variant="ghost" disabled={!isEncrypted} .../>
    </SettingsRow>
  </SettingsSection>
);
```

**SecuritySection 내부의 인라인 생체인증 등록 dialog (line 201-222)는 본 plan 범위 밖** — Plan-G1은 wrapper 마이그레이션만. Dialog 자체는 별도 처리 (사용자 결정 시 후속 작업).

### 5. `src/pages/Settings/components/UISection.tsx` (2 row + h3)

**Before**:
```tsx
return (
  <div>
    <h3 className="mb-3 ...">UI</h3>
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl ...">
        <span>다크모드</span>
        <button role="switch" .../>  ← 인라인 토글 그대로
      </div>
      <div className="flex items-center justify-between gap-3 rounded-2xl ...">
        <span>글자크기</span>
        <Input as="select" size="sm" .../>
      </div>
    </div>
    {uiMessage && <p>...</p>}
  </div>
);
```

**After**:
```tsx
import { SettingsSection } from "@/components/SettingsSection";
import { SettingsRow } from "@/components/SettingsRow";

return (
  <SettingsSection title="UI">
    <SettingsRow label="다크모드">
      <button role="switch" .../>  ← 토글 그대로, 컨테이너만 SettingsRow
    </SettingsRow>
    <SettingsRow label="글자크기">
      <Input as="select" size="sm" .../>
    </SettingsRow>
  </SettingsSection>
);
```

**UISection의 uiMessage (`<p>` 토스트성, `<div>` 외부) — SettingsSection children 뒤 형제로 유지**.

### 6. `src/pages/Settings/components/DataSection.tsx` (3 row + h3)

**Before**:
```tsx
return (
  <div>
    <h3 className="mb-3 ...">Data</h3>
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl ...">
        <span>백업</span>
        <Button variant="primary" .../>
      </div>
      ...
    </div>
    {dataMessage && <p>...</p>}
    <FileCreateDialog .../>
    <FileOpenDialog .../>
  </div>
);
```

**After**:
```tsx
import { SettingsSection } from "@/components/SettingsSection";
import { SettingsRow } from "@/components/SettingsRow";

return (
  <>
    <SettingsSection title="Data">
      <SettingsRow label="백업">...</SettingsRow>
      <SettingsRow label="복원">...</SettingsRow>
      <SettingsRow label="...">...</SettingsRow>  {/* getAutoBackupStatus() */}
    </SettingsSection>
    {dataMessage && <p>...</p>}
    <FileCreateDialog .../>
    <FileOpenDialog .../>
  </>
);
```

**Fragment 이유**: 기존 `<div>`는 SettingsSection의 wrapper `<div>`로 대체됨. 외부 dialog는 형제로 유지.

### 7. `src/pages/Settings/components/AutofillSection.tsx` (4 row + h3)

**Before**:
```tsx
return (
  <div className="space-y-3">
    <h3 className="mb-3 ...">Autofill</h3>
    {/* row 1: web 분기 */}
    {Capacitor.getPlatform() !== "android" ? (
      <div className="flex items-center justify-between gap-3 rounded-2xl ...">
        <span>자동완성 서비스</span>
        <span className="text-xs text-[var(--color-text-muted)]">Android에서만 사용 가능</span>
      </div>
    ) : (
      <div className="flex items-center justify-between gap-3 rounded-2xl ...">
        ...
      </div>
    )}
    ...
  </div>
);
```

**After**:
```tsx
import { SettingsSection } from "@/components/SettingsSection";
import { SettingsRow } from "@/components/SettingsRow";

return (
  <SettingsSection title="Autofill">
    {/* row 1: web 분기 */}
    {Capacitor.getPlatform() !== "android" ? (
      <SettingsRow label="자동완성 서비스">
        <span className="text-xs text-[var(--color-text-muted)]">Android에서만 사용 가능</span>
      </SettingsRow>
    ) : (
      <>
        <SettingsRow label="자동완성 사용">
          <button role="switch" .../>
        </SettingsRow>
        {autofillEnabled && (
          <>
            <SettingsRow label="자동완성 서비스">
              <div className="flex items-center gap-2">...</div>
            </SettingsRow>
            <SettingsRow label="...">
              ...
            </SettingsRow>
            ...
          </>
        )}
      </>
    )}
  </SettingsSection>
);
```

**AutofillSection 보조 텍스트 패턴 (Q7 결정 근거)**: `label={<>자동완성 사용<br/><span className="text-xs ...">앱에서 자동완성 기능 사용 여부</span></>}` 형태로 ReactNode 흡수.

## 신규 단위 테스트

### 8. `src/components/SettingsSection.test.tsx` (신규)

테스트 케이스 (Q-신규 = 신규 단위 테스트 + 기존 E2E):
- ① `<h2>`` 렌더 (Q6 위계 정정 회귀 가드)
- ② `title` prop → `<h2>` 텍스트 렌더
- ③ `children` 렌더 (`SettingsRow` 또는 임의 ReactNode)
- ④ 헤더 className 보존 (`uppercase tracking-[0.18em]` 등)
- ⑤ `space-y-3` 내부 컨테이너 렌더

### 9. `src/components/SettingsRow.test.tsx` (신규)

- ① `<div>` row 컨테이너 렌더 (인라인 className 흡수 확인)
- ② `label` string → text 렌더
- ③ `label` ReactNode → 두 번째 줄 (보조 텍스트) 렌더 (AutofillSection 패턴 흡수)
- ④ `children` 컨테이너 위치 (라벨 우측)
- ⑤ row className 보존 (`rounded-2xl border ... bg-[var(--color-bg)]`)

---

# Tests

## 신규 (Plan-G1 범위)

| 테스트 파일 | 케이스 |
|---|---|
| `src/components/SettingsSection.test.tsx` | 5 케이스 (위 8번 참조) |
| `src/components/SettingsRow.test.tsx` | 5 케이스 (위 9번 참조) |

## 기존 회귀

- **단위 테스트**: `npm run test` — 모든 기존 테스트 통과 (Plan-G1은 wrapper 신규 추가 + 마이그레이션, 기존 로직 변경 0)
- **TypeScript**: `npm run typecheck` — wrapper 신규 타입 + 호출처 마이그레이션 후 회귀 0
- **ESLint**: `npm run lint` — 우리 변경 파일 에러 0
- **빌드**: `npm run build` — 통과
- **Android 단위**: `compileDebugKotlin` + `testDebugUnitTest` — 본 plan은 React 측 한정, Android 영향 0
- **Playwright E2E**: `npm run test:e2e` — **회귀 0 (사용자 직접 실행)**. Settings 화면 사용자 인터랙션은 변경 없음 (className wrapper 마이그레이션)

## 사용자 결정 사항 (E2E)

본 plan의 E2E 회귀 0은 Plan-F1과 동일한 패턴 — **사용자가 직접 실행 확인**. agent는 E2E를 background로 실행하지 않음 (ce-work SKILL 명시).

---

# Risks

| 리스크 | 완화 |
|---|---|
| className 미세 차이로 시각 회귀 | 인라인 → wrapper 흡수 시 className 정확히 보존 (sed로도 1:1 매핑 확인 가능) |
| `<h3>` → `<h2>` 변경 시 기존 a11y 도구/외부 스크린리더 영향 | TemplateEdit의 `<h1>+<h2>+<h2>` 패턴 이미 적용되어 표준 관행. a11y 측면에서 `<h2>` 정정이 위계 정상화 |
| Settings/index 자체 row 2건 처리 — Section으로 묶을지 개별 row만 | **3번 결정**: Section 없이 SettingsRow만 적용. 의미 없는 title 부착 회피 |
| AutofillSection의 4 row + web 분기 + 조건부 row 패턴 복잡도 | 마이그레이션 후 동일 패턴 유지, 조건부 row는 `<>` Fragment 또는 개별 row로 분리. 기존 구조 정확히 보존 |
| UISection의 커스텀 토글 + DataSection의 FileCreateDialog — wrapper 외부에 위치 | Plan-G1은 wrapper 마이그레이션만, dialog/토글 자체는 본 plan 범위 밖 |
| `<SettingsSection>`과 `<SettingsRow>` 단일 PR 동시 도입 → 변경 파일 6개 | Plan-F1(25 호출처) 단일 PR 패턴 일관. 6 파일은 단일 PR 관리 가능 |
| SettingsSection의 `space-y-3` 내부 컨테이너가 기존 row 간격을 정확히 보존하는지 | 기존 인라인 `<div className="space-y-3">` 정확히 흡수 |
| 단위 테스트가 Playwright E2E를 완전히 대체하지 못함 | wrapper 신규 → 단위 테스트 + 기존 E2E 회귀 둘 다 수행 (Q-신규=a) |

---

# Rollback

- 신규 파일 4개 (`SettingsSection.tsx`/`.test.tsx` + `SettingsRow.tsx`/`.test.tsx`) + 호출처 5개 파일 마이그레이션
- Rollback: 신규 파일 삭제 + 호출처 5개 파일 `git revert` (단일 PR revert)
- RiskProfile: 낮음 — wrapper 추가는 호출처 동작 변경 0, 시각 변경 0 (className 1:1 매핑)
- 머지 후 회귀 발견 시: PR revert 1 명령으로 즉시 롤백 가능

---

# Cross-Plan Integration

## Upstream (의존하는 선행 plan)

- **Plan-F1**: `<Input as="select" size="sm">` 사용 — Plan-F1 완료 (2026-09-01)
- **Plan-B-1/2/3**: `<Button>` 사용 — Plan-B-3 완료 (2026-09-01)
- **Plan-A1**: 없음 (Settings는 Plan-A1 영향 없음)

## Downstream (본 plan이 의존받는 후속 plan)

- **Plan-G2** (PageHeader/PageShell): 본 plan의 SettingsSection/SettingsRow는 PageShell/PageHeader 도입 시 영향 없음 (별도 wrapper)
- **Plan-G3** (tracking 토큰화): 본 plan의 헤더 className `tracking-[0.18em]`이 G3에서 토큰화될 수 있음 — G1은 G3와 독립 진행 가능

## 후속 (별도 brainstorm)

- **Plan-G4** (PasswordField 묶음): Plan-G1과 무관
- **Plan-G5** (TagChip/FieldCard 통합): Plan-G1과 무관

## 검증 게이트 (Plan-F1 / Plan-B-3과 동일)

| 단계 | 명령 | 통과 조건 |
|---|---|---|
| 1 | `npm run typecheck` | 에러 0 |
| 2 | `npm run lint` | 우리 변경 파일 에러 0 |
| 3 | `npm run test` | 모든 테스트 통과 |
| 4 | `npm run build` | 빌드 성공 |
| 5 | Android `compileDebugKotlin` | 에러 0 |
| 6 | Android `testDebugUnitTest` | 통과 |
| 7 | Playwright React E2E | 회귀 0 (사용자 직접 실행) |

---

# Verification Checklist

- [ ] `src/components/SettingsSection.tsx` 신규 작성 — `<h2>` + `<div className="space-y-3">` + children
- [ ] `src/components/SettingsRow.tsx` 신규 작성 — `<div>` row className + label(ReactNode) + children
- [ ] `src/components/SettingsSection.test.tsx` 신규 작성 — 5 케이스
- [ ] `src/components/SettingsRow.test.tsx` 신규 작성 — 5 케이스
- [ ] `src/pages/Settings/index.tsx` 마이그레이션 — 2 row → SettingsRow (SettingsSection 미사용)
- [ ] `src/pages/Settings/components/SecuritySection.tsx` 마이그레이션 — `<h3>` → `<SettingsSection>`, 3 row → `<SettingsRow>`
- [ ] `src/pages/Settings/components/UISection.tsx` 마이그레이션 — `<h3>` → `<SettingsSection>`, 2 row → `<SettingsRow>` (토글 자체는 인라인 유지)
- [ ] `src/pages/Settings/components/DataSection.tsx` 마이그레이션 — `<h3>` → `<SettingsSection>`, 3 row → `<SettingsRow>` (dialog는 wrapper 외부 유지)
- [ ] `src/pages/Settings/components/AutofillSection.tsx` 마이그레이션 — `<h3>` → `<SettingsSection>`, 4 row → `<SettingsRow>` (label ReactNode 패턴 흡수)
- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` 통과 (우리 변경 파일 에러 0)
- [ ] `npm run test` 통과 (신규 단위 테스트 10개 포함)
- [ ] `npm run build` 통과
- [ ] Android `compileDebugKotlin` + `testDebugUnitTest` 통과
- [ ] Playwright React E2E 회귀 0 (사용자 직접 실행 확인)
- [ ] git diff 검토 완료
- [ ] git commit (Plan-F1/Plan-B-3 컨벤션: `feat(ux): Plan-G1 SettingsSection + SettingsRow 도입`)
- [ ] PR 개설 (단독 PR 권장, Plan-B-3 패턴)

---

# Estimated Effort

- 신규 컴포넌트 2개 + 테스트 2개 = ~120줄
- 호출처 마이그레이션 5개 파일 = ~80줄 (-sed + 미세 조정)
- 검증 게이트 = 5~10분 (typecheck + lint + test + build)
- 총: ~30분 작업 + 5분 검증

---

# Output

1. **Plan 파일 경로**: `docs/plans/2026-09-01-plan-g1-settings-section-row.md` (본 문서)
2. **변경 파일**: 9개 (신규 4 + 마이그레이션 5)
3. **테스트 추가**: 10개 단위 테스트 (5 + 5)
4. **주요 리스크**: 시각 회귀 (className 1:1 매핑으로 완화)
5. **구현 가능 여부**: ✅ 가능