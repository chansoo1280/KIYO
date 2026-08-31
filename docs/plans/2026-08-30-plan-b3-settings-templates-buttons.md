# Plan-B-3 — 나머지 페이지 inline `<button>` → `<Button>` 마이그레이션 (Templates/Settings)

- Date: 2026-08-30
- Source: [`docs/brainstorms/2026-08-30-track3-ux-accessibility.md`](../brainstorms/2026-08-30-track3-ux-accessibility.md) §7 B, §8.1, §10 Q2, §11
- Source: [`docs/plans/2026-08-30-plan-b-button-loading-consistency.md`](./2026-08-30-plan-b-button-loading-consistency.md) §327-364 (Plan-B-3 상세, 분리 작성)
- 선행: [Multi-Vault Support](./2026-08-30-multi-vault-support.md) ✅, [Plan-7a](./2026-08-30-plan-7a-create-vault-multistep.md) ✅, [Plan-A1](./2026-08-30-plan-a1-error-visibility.md) ✅, [Plan-A2](./2026-08-30-plan-a2-spinner-loading.md) ✅, [Plan-B-1](./2026-08-30-plan-b-button-loading-consistency.md) ✅, [Plan-B-2](./2026-08-30-plan-b-button-loading-consistency.md) ✅
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- 결정 사항: §결정 (사용자 결정 대기 항목 포함) 참고
- **순수 범위 (Q4-a 후속 미포함)** — 2026-08-30 사용자 결정: `DataSection.tsx:197`의 `FileCreateDialog` 잔존은 Plan-B-3과 결합하지 않음, 보류

---

# Goal

**Plan-B-1/2와 동일 패턴**으로 빈도가 낮은 페이지(Templates/Settings)의 inline `<button>`을 `<Button>` 컴포넌트로 일관화. in-flight 시 `loading`/`disabled`/`aria-busy` 일관 처리 보장. **Q2 (throw 유지) / Q4 (FileCreateDialog 보류)** 사용자 결정 반영.

완료 시 다음이 참:
- `Templates/index.tsx`, `Templates/TemplateEdit/index.tsx`의 모든 inline `<button>`이 `<Button>` 사용
- `Settings/index.tsx`, `Settings/components/AutofillSection.tsx`, `DataSection.tsx`, `SecuritySection.tsx`의 모든 inline `<button>`이 `<Button>` 사용 (단, **Plan-7a 2차 PR (Q4-a) 보류로 `DataSection.tsx:197`의 FileCreateDialog 잔존은 그대로 유지**)
- `TemplateEdit`의 저장/삭제 catch는 이미 Plan-A1 머지 시점에 `mapError()` 적용 완료 — Plan-B-3-A는 catch 결합 추가 작업 없이 인라인 `<button>` 마이그레이션만
- 기존 `loading`/`syncing` state 분리 유지 (AutofillSection, Plan-B 리뷰 결정)
- 사용자는 "한 번만 누르면 됨" 체감 (Plan-B-2와 동일)

**범위 밖 (Plan-B-3):**
- `useFormSubmit` / `useAsync` wrapper hook — 포함 안 함 (Q2)
- `FileCreateDialog` 완전 제거 (Plan-7a 2차 PR, Q4-a) — **2026-08-30 사용자 결정으로 보류**, Plan-B-3와 결합 안 함
- **`src/pages/Settings/index.tsx:22-24`의 `useFileAuthGuard` 호출** — Plan-B-3 범위 밖 (Button 마이그레이션만, hook 호출/시그니처 변경 없음). ce-plan-review 2026-08-30 F4 결정: 작업자가 Settings 진입 시 hook 존재를 모르고 제거하지 않도록 명시
- Settings 내 신규 토글 UI 추가 — 별도 plan
- i18n 정식 도입 — 별도 plan

---

# Current State (2026-08-30 인스펙션)

## 인라인 `<button>` 사용 페이지 (Plan-B-3 범위)

| 파일 | 라인 | 컨텍스트 | 비고 |
|---|---|---|---|
| `src/pages/Templates/index.tsx` | 49 | 신규 템플릿 생성 | `type="button"` 명시, 단순 클릭 |
| `src/pages/Templates/index.tsx` | 63 | (카드/리스트 FAB 추정) | 신규 템플릿 |
| `src/pages/Templates/index.tsx` | 95 | 템플릿 편집 (per-item) | `onClick={() => handleEditTemplate(template.id)}` |
| `src/pages/Templates/TemplateEdit/index.tsx` | 182 | 삭제 confirm 트리거 | `setShowDeleteConfirm(true)` |
| `src/pages/Templates/TemplateEdit/index.tsx` | 190 | 취소 (`handleCancel`) | navigate back |
| `src/pages/Templates/TemplateEdit/index.tsx` | 197 | 저장 (`handleSave`) | **Plan-A1 catch 이미 적용됨** (19341aec, `TemplateEdit/index.tsx:89-92`) |
| `src/pages/Templates/TemplateEdit/index.tsx` | 264 | 필드 추가 (`addField`) | 동적 필드 추가 |
| `src/pages/Settings/index.tsx` | 44 | 파일 변경 (`handleFileChange`) | button text: "이동" |
| `src/pages/Settings/index.tsx` | 55 | 앱 정보 다이얼로그 (`setShowAppInfoDialog`) | button text: "보기" |
| `src/pages/Settings/components/AutofillSection.tsx` | 212 | **자동완성 토글 (role=switch)** | 시각적 토글 스위치 (CSS 구현), `<Button>` 적용 **부적합** — Plan-B-3 범위 **제외** |
| `src/pages/Settings/components/AutofillSection.tsx` | 254 | "설정" (autofill enabled 시) | `disabled={loading}` |
| `src/pages/Settings/components/AutofillSection.tsx` | 263 | "활성화" | `disabled={loading}`, 라벨 분기 (`loading ? "확인 중..." : "활성화"`) |
| `src/pages/Settings/components/AutofillSection.tsx` | 296 | "동기화" (`syncAccounts`) | `disabled={syncing \|\| loading}`, 라벨 분기 (`syncing ? "동기화 중..." : "동기화"`) |
| `src/pages/Settings/components/DataSection.tsx` | 157 | 백업 (`handleBackupClick`) | button text: "저장" |
| `src/pages/Settings/components/DataSection.tsx` | 167 | 복원 (`handleRestoreClick`) | button text: "불러오기" |
| `src/pages/Settings/components/DataSection.tsx` | 177 | 자동 백업 토글 (`handleAutoBackupToggle`) | button text: "켜기"/"해제" |
| `src/pages/Settings/components/DataSection.tsx` | 219 | 자동 백업 폴더 다이얼로그 취소 | — |
| `src/pages/Settings/components/DataSection.tsx` | 226 | 자동 백업 폴더 확정 (`handlePickFolderConfirm`) | button text: "폴더 선택" |
| `src/pages/Settings/components/SecuritySection.tsx` | 144 | PIN 변경 (`handlePinChangeClick`) | button text: "변경"/"설정" |
| `src/pages/Settings/components/SecuritySection.tsx` | 186 | 생체 인증 토글 (`handleBiometricToggle`) | button text: "사용 중"/"사용 안 함" |
| `src/pages/Settings/components/SecuritySection.tsx` | 225 | 생체 인증 설정 다이얼로그 취소 | — |
| `src/pages/Settings/components/SecuritySection.tsx` | 232 | 생체 인증 설정 확정 (`handleBiometricSetupConfirm`) | button text: "등록하기" |

**총 인라인 `<button>`: 22개** (AutofillSection line 212 toggle switch 제외 시 21개)

## 인스펙션 노트

- **AutofillSection line 212 (toggle switch)**: `role="switch"` + `aria-checked` + 시각적 토글 UI (Tailwind rounded-full, w-11/h-6). `<Button>` 컴포넌트와 의미적/시각적으로 다르므로 **Plan-B-3 범위 제외**. a11y audit plan에서 별도 점검.
- **`loading`/`syncing` state 분리 유지** (Plan-B 결정, line 16/19 AutofillSection): 두 state의 disabled OR 패턴 (line 299 `syncing || loading`)이 이미 busy 신호 효과 제공. 통합은 Plan-B 무관.
- **`DataSection.tsx:197`의 `FileCreateDialog` 사용**: Q4-a 후속이지만 Plan-B-3와 결합 안 함 (2026-08-30 사용자 결정 보류). Plan-B-3는 인라인 `<button>` 마이그레이션만.
- **TemplateEdit `handleSave`**: Plan-A1 catch 결합 필요 — `setErrors([mapError(err)])` (Plan-A1 §3 패턴).
- **TemplateEdit `handleDelete`**: Plan-A1 catch 결합 필요 — `setShowDeleteConfirm(false)` 호출 안 함 (Plan-A1 §3 패턴).

---

# Proposed Changes

## Plan-B-3-A: Templates 페이지

### 1. `src/pages/Templates/index.tsx` (3개 버튼)

```tsx
// line 49 (신규 템플릿 - 헤더)
<Button variant="primary" onClick={handleNewTemplate} label="+ 새 템플릿" />

// line 63 (FAB 또는 빈 상태 CTA)
<Button variant="primary" onClick={handleNewTemplate} label="새 템플릿 만들기" />

// line 95 (per-item 편집)
<Button variant="ghost" size="sm" onClick={() => handleEditTemplate(template.id)} label="수정" />
```

### 2. `src/pages/Templates/TemplateEdit/index.tsx` (4개 버튼)

> **Note**: Plan-A1 catch 결합(`mapError` + `setShowDeleteConfirm(false)` 호출 안 함)은 Plan-A1 머지(19341aec) 시점에 이미 적용됨 (`TemplateEdit/index.tsx:5,89-92,154-165,299`). Plan-B-3에서는 인라인 `<button>` 4개만 `<Button>`으로 교체.

```tsx
// line 182 — 삭제 confirm 트리거
<Button variant="ghost" onClick={() => setShowDeleteConfirm(true)} label="삭제" />

// line 190 — 취소
<Button variant="ghost" onClick={handleCancel} label="취소" />

// line 197 — 저장
<Button variant="primary" type="submit" loading={isSaving} label="저장" />
{saveError && <p role="alert" data-testid="template-edit-error">{saveError}</p>}

// line 264 — 필드 추가
<Button variant="secondary" size="sm" onClick={addField} label="+ 필드 추가" />
```

## Plan-B-3-B: Settings 페이지

### 3. `src/pages/Settings/index.tsx` (2개 버튼)

```tsx
// line 44 — 파일 변경 (실제 button text: "이동")
<Button variant="primary" onClick={handleFileChange} label="이동" />

// line 55 — 앱 정보 (실제 button text: "보기")
<Button variant="ghost" onClick={() => setShowAppInfoDialog(true)} label="보기" />
```

### 4. `src/pages/Settings/components/AutofillSection.tsx` (3개 버튼, toggle switch 제외)

```tsx
// line 212 — toggle switch는 Plan-B-3 범위 제외 (role=switch + 시각적 토글)

// line 254 — 설정 (autofill enabled 시)
<Button variant="ghost" onClick={openAutofillSettings} disabled={loading} label="설정" />

// line 263 — 활성화 (autofill disabled 시)
<Button
  variant="primary"
  onClick={requestEnable}
  loading={loading}
  disabled={loading}
  label={loading ? "확인 중..." : "활성화"}
/>

// line 296 — 동기화
<Button
  variant="ghost"
  onClick={syncAccounts}
  loading={syncing}
  disabled={syncing || loading}
  label={syncing ? "동기화 중..." : "동기화"}
/>
```

**Note**: 라벨 분기 (`{loading ? "확인 중..." : "활성화"}`)는 Plan-B-1 결정(§167-178) 따라 유지 — spinner는 in-flight 시각, 라벨은 사용자가 기다리는 액션 명시.

### 5. `src/pages/Settings/components/DataSection.tsx` (5개 버튼, FileCreateDialog는 보류)

```tsx
// line 157 — 백업 (실제 button text: "저장")
<Button variant="primary" onClick={handleBackupClick} label="저장" />

// line 167 — 복원 (실제 button text: "불러오기")
<Button variant="ghost" onClick={handleRestoreClick} label="불러오기" />

// line 177 — 자동 백업 토글 (실제 button text: "켜기"/"해제")
<Button
  variant="ghost"
  onClick={() => handleAutoBackupToggle(!autoBackupEnabled)}
  disabled={!nativeAvailable || !isEncryptedVault}
  label={autoBackupEnabled ? "해제" : "켜기"}
/>

// line 219 — 자동 백업 폴더 다이얼로그 취소
<Button variant="ghost" onClick={() => setShowAutoBackupFolderDialog(false)} label="취소" />

// line 226 — 자동 백업 폴더 확정 (실제 button text: "폴더 선택")
<Button variant="primary" onClick={handlePickFolderConfirm} label="폴더 선택" />

// line 197 — FileCreateDialog 사용처 (Q4-a 보류, 변경 안 함)
// <FileCreateDialog ... /> 그대로
```

### 6. `src/pages/Settings/components/SecuritySection.tsx` (4개 버튼)

```tsx
// line 144 — PIN 변경 (실제 button text: "변경"/"설정")
<Button
  variant="primary"
  onClick={handlePinChangeClick}
  label={isEncrypted ? "변경" : "설정"}
/>

// line 186 — 생체 인증 토글 (실제 button text: "사용 중"/"사용 안 함")
<Button
  variant="ghost"
  onClick={() => handleBiometricToggle(!biometricEnabled)}
  disabled={!isEncrypted}
  label={biometricEnabled ? "사용 중" : "사용 안 함"}
/>

// line 225 — 생체 인증 설정 다이얼로그 취소
<Button variant="ghost" onClick={() => setShowBiometricSetupDialog(false)} label="취소" />

// line 232 — 생체 인증 설정 확정 (실제 button text: "등록하기")
<Button variant="primary" onClick={handleBiometricSetupConfirm} label="등록하기" />
```

---

# 결정 (사용자 결정 대기 포함, 2026-08-30)

| Q | 결정 | 근거 / 상태 |
|---|---|---|
| 1차 PR 범위 | **Plan-B-3 1 PR로 진행** (Templates + Settings 통합) | 2026-08-30 사용자 결정: (a). 인스펙션 결과상 21개 버튼 (Templates 7 + Settings 14, AutofillSection toggle switch 1 제외), 모두 동일 패턴. Plan-B-2 (6 페이지 ~15개 버튼) 1 PR 통과 사례 |
| AutofillSection `loading`/`syncing` 통합 | **그대로 분리 유지** (Plan-B-1/2 결정 일관) | line 299 `syncing \|\| loading` OR 패턴이 이미 busy 신호 효과 제공. 통합은 별도 리팩토링 |
| AutofillSection line 212 toggle switch | **Plan-B-3 범위 제외** | `role="switch"` + 시각적 토글 (Tailwind rounded-full) — `<Button>`과 의미/시각 다름. a11y audit plan에서 별도 점검 |
| TemplateEdit Plan-A1 catch 결합 | **이미 적용됨 (Plan-A1 머지 19341aec)** | `TemplateEdit/index.tsx:5,89-92,154-165,299`에 `mapError` import + catch 2건 + `setShowDeleteConfirm(false)` 호출 안 함 패턴이 이미 구현됨. Plan-B-3은 catch 결합 추가 코드 불필요, 인라인 `<button>` 마이그레이션만 |
| `DataSection.tsx:197`의 FileCreateDialog | **Plan-B-3에서 분리** (사용자 결정 보류) | Q4-a 후속이지만 2026-08-30 "지금 당장 급하지 않음" 결정. **Plan-B-3는 인라인 버튼만, FileCreateDialog 잔존은 그대로** |
| 라벨 분기 (`{loading ? "확인 중..." : "활성화"}`) | **유지** (Plan-B-1 결정) | spinner는 시각, 라벨은 액션 명시. W3C accname 결정 — 라벨 텍스트가 button의 accessible name |

---

# Tests

## 단위 테스트

| 파일 | 케이스 | 비고 |
|---|---|---|
| `src/pages/Templates/TemplateEdit/index.test.tsx` (신규) | 저장 catch (Plan-A1 `mapError` 경로), 삭제 catch (Plan-A1 `mapError` + `setShowDeleteConfirm(false)` 호출 안 함), Button 4개 마이그레이션 후에도 catch 로직 그대로 회귀 0 | Plan-B-3에서 유일하게 신규 테스트 작성. catch 결합이 Plan-B-3와 *무관*하지만 작업자가 Button 마이그레이션 중 catch 로직을 깨뜨리지 않음을 보장 |

**나머지 페이지(Templates/index, Settings/index, AutofillSection, DataSection, SecuritySection)는 신규 테스트 미작성** — Plan-B-2 패턴 일관 (`e3a4c1ae` Plan-B-2 PR은 6 페이지 ~21개 마이그레이션에 신규 테스트 0개, 기존 테스트 통과 게이트만 사용). 이유: 단순 `onClick={handler}` 호출이라 단위 테스트의 분기 가치가 낮음. Settings는 `useFileAuthGuard` 진입 게이트가 있어 Button 마이그레이션 테스트가 사실상 Auth gate 테스트로 변질 — Plan-B-3 범위 밖.

## E2E (Playwright)

- **회귀 0 가정** — Button 마이그레이션은 시각/동작 동등
- 기존 11개 spec 통과 확인 (사용자 직접 실행)
- **신규 spec 없음** — 빈도가 낮은 페이지, 기존 spec으로 검증 충분 (Plan-B-2 결정 일관)

## Android E2E

- **변경 없음** — Plan-B-3는 React 측 한정. `compileDebugKotlin` + `testDebugUnitTest` 회귀 게이트만

## 회귀 게이트

- `npm run typecheck` 통과
- `npm run lint` 통과 (신규 0 에러)
- `npm run test` 통과 (신규/확장 테스트 포함)
- `npm run build` 통과
- Android: `compileDebugKotlin` + `testDebugUnitTest` 통과
- 사용자가 Playwright E2E 직접 실행 — 회귀 0

---

# Risks

| 리스크 | 완화 |
|---|---|
| TemplateEdit Plan-A1 catch 결합 | **이미 적용됨** — Plan-A1 머지 시점에 완료 (19341aec, `TemplateEdit/index.tsx:89-92,154-165`). Plan-B-3은 catch 결합 추가 작업 불필요 |
| AutofillSection toggle switch를 Plan-B-3에서 제외 | a11y audit plan으로 이관, line 212 명시적 제외 |
| Settings/* 빈도 낮지만 사용자 인터랙션 다양 (백업/복원/생체/PIN) | 단위 테스트로 각 버튼별 매핑 검증, E2E 회귀 게이트 |
| DataSection.tsx:197의 FileCreateDialog 미처리 | **사용자 결정으로 보류**, 회귀 없음 (현재 동작 그대로). Plan-7a 2차 PR(Q4-a)로 후속 |
| Plan-B-1의 Spinner 함정 (`aria-label`이 button accessible name 차지) | Plan-B-1 PR `e99ec404`로 `<Spinner aria-hidden>` 처리 완료. Plan-B-3의 Button은 이미 같은 Spinner 컴포넌트 사용 (`Button.tsx:54`). 라벨 분기 `{loading ? "확인 중..." : "활성화"}`는 Plan-B-1 결정 유지 — spinner는 시각, 라벨 텍스트가 button의 accessible name (W3C accname) |

---

# Out of Scope (후속)

- **Plan-7a 2차 PR (Q4-a)**: `DataSection.tsx:197`의 `FileCreateDialog` 잔존 정리 + 완전 제거 — **사용자 결정으로 보류**, Plan-B-3는 손대지 않음
- **a11y audit plan**: AutofillSection line 212 toggle switch 별도 점검
- **Plan-D**: 테마 FOUC 가드 — 별도 plan
- **`useFormSubmit` / `useAsync`**: Q2 확정으로 포함 안 함
- **`onError` callback**: Q2 확장으로 포함 안 함

---

# Cross-Plan Integration

**Upstream (이 plan이 의존):**
- ✅ Plan-A1 (`mapError` — TemplateEdit의 handleSave/handleDelete에서 catch 추가 시 활용)
- ✅ Plan-A2 (`<Spinner>` 컴포넌트 — AutofillSection 동기화 버튼에서 활용)
- ✅ Plan-B-1 (`<Button>` API, variant, size, loading, aria-busy, inline SVG spinner)
- ✅ Plan-B-2 (`<Button>` 마이그레이션 패턴 + Plan-A1 catch 결합 패턴)

**Downstream (이 plan이 제공):**
- **a11y audit plan**: Button a11y 레퍼런스 (variant별 focus ring, aria-busy 일관성)
- **Plan-7a 2차 PR (Q4-a)**: DataSection 백업 흐름 정리 시 Button 매핑 패턴 활용

**호환 시그니처:**
- `<Button label variant size loading disabled type ...ButtonHTMLAttributes />`
- `mapError(err: unknown): string` (Plan-A1 §)
- 호출자 API 변화 0 (Plan-B-1/2 일관)

---

# Verification Checklist (Plan-B-3 완료 시)

- [ ] `Templates/index.tsx` 3개 inline `<button>` → `<Button>` 마이그레이션
- [ ] `Templates/TemplateEdit/index.tsx` 4개 inline `<button>` → `<Button>` (Plan-A1 catch는 이미 적용됨, 별도 변경 불필요)
- [ ] `Settings/index.tsx` 2개 inline `<button>` → `<Button>` 마이그레이션
- [ ] `AutofillSection.tsx` 3개 inline `<button>` → `<Button>` (toggle switch 제외)
- [ ] `DataSection.tsx` 5개 inline `<button>` → `<Button>` (FileCreateDialog line 197은 보류)
- [ ] `SecuritySection.tsx` 4개 inline `<button>` → `<Button>` 마이그레이션
- [ ] `Templates/TemplateEdit/index.test.tsx` 신규 작성 통과 (저장 catch + 삭제 catch 회귀 0). 나머지 페이지는 신규 테스트 미작성 (Plan-B-2 패턴 일관)
- [ ] `npm run typecheck` 통과
- [ ] `npm run lint` 통과 (신규 0 에러)
- [ ] `npm run test` 전체 통과
- [ ] `npm run build` 통과
- [ ] Android: `compileDebugKotlin` + `testDebugUnitTest` 통과
- [ ] 사용자가 Playwright E2E 직접 실행 시 회귀 0
- [ ] Q4-a (FileCreateDialog 제거)는 **미처리**, 별도 트리거 대기