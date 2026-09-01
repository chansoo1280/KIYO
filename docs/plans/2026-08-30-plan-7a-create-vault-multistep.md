# Plan-7a — 파일 생성 다단계 페이지 (/create-vault, 2단계)

- Date: 2026-08-30
- Source: [`docs/brainstorms/2026-08-30-track3-ux-accessibility.md`](../brainstorms/2026-08-30-track3-ux-accessibility.md) §7 E (Plan-7a), §8.1, §10, §11
- 선행: [Multi-Vault Support](./2026-08-30-multi-vault-support.md) ✅
- 후속: Plan-7b (폴더 선택 + 자동 백업 통합, 별도 brainstorm)
- Worktree: `feat/ux-accessibility` (base `origin/dev`)

---

# Goal

**"파일 생성" 사용자 흐름을 모달 → 단일 라우트 페이지(2단계)로 전환**한다.

완료 시 다음이 참:
- `Home.tsx`의 "파일 생성" 버튼이 `<Link to="/create-vault">`로 변경됨
- `/create-vault` 라우트 신설, `CreateVaultPage` 내부 `useState`로 step/fileName/pin/error 관리
- 2단계 흐름: Step 1 (파일 이름 + 실시간 검증) → Step 2 (PIN + PinStrengthMeter)
- 상단 Stepper (`<ol>` + 양 끝 단계 라벨 + 점선 연결선, `aria-current="step"`)
- 모든 새 파일은 **암호화** (체크박스 제거, Plan-4 정책 통일)
- `FileCreateDialog`는 `DataSection` 백업 경로 마이그레이션 후 **완전 제거** (Q4-a, 2차 PR)
- `Home.tsx`의 "파일 생성" → 2단계 완료 → `/accounts`로 이동, 정상 동작
- Step 2 → Step 1 "이전" 시 PIN 클리어 (Q17-b)
- `createDataFile` 실패 시 Step 2 인라인 에러 표시 (Q14-1)
- `useFileAuthGuard` 호출 안 함 — active file 있어도 진행 (Q1-Q2)

**범위 밖 (Plan-7a):**
- 폴더 선택 Step 3 / SAF URI 저장 / 자동 백업 통합 → **Plan-7b로 분리** (STRATEGY §2 후속, 별도 brainstorm)
- 비암호화 볼트 신규 생성 (체크박스 제거) — 기존 v1 데이터 마이그레이션은 영향 없음
- Plan-A1(`mapError`/에러 가시화), Plan-B(Button.loading) — Plan-7a는 인라인 `err.message` 처리, Plan-A1 정식 도입 시 마이그레이션 (Q3-c, Q10-c)

---

# Current State

## 관련 파일 (인스펙션 완료)

| 파일 | 역할 |
|---|---|
| `src/App.tsx` | `BrowserRouter` + 10개 라우트. `/create-vault` 미존재 |
| `src/components/dialogs/FileCreateDialog.tsx` | **현재 진입점.** 파일명 + 암호화 체크박스 + PIN 한 화면. `onConfirm({fileName, encrypted, pin})` |
| `src/components/dialogs/FormDialog.tsx` | `BaseDialog` 래퍼. `errorMessage` prop 또는 내부 catch 에러 표시 (`data-testid="form-dialog-error"`, `role="alert"`) |
| `src/pages/Home.tsx` | `FileCreateDialog` 호출처 1 (파일 생성). `createDataFile(fileName, pin)` 후 `/accounts`로 navigate |
| `src/pages/Settings/components/DataSection.tsx` | `FileCreateDialog` 호출처 2 (백업 파일 저장). `handleBackupConfirm` → `backupDataFile` |
| `src/database/fileStorage.ts:260-330` | `createDataFile(fileName, pin?)` — **DB만 저장** (이미 OS 파일시스템에 저장 안 함, `persistVaultRecord`로 Dexie). `pin` 인자 받음 |
| `src/database/fileTable.ts` | Dexie v14: `files` 테이블의 PK는 `fileName`. `resolveFileName(desired)`로 중복 시 `(1)`, `(2)` suffix |
| `src/crypto/pinStrength.ts` | `MIN_PIN_LENGTH=4`, `MAX_PIN_LENGTH=20`, `assessPinStrength`, `PinStrengthScore 0~4` (zxcvbn) |
| `src/components/inputs/PinStrengthMeter.tsx` | Plan-4 산출물. `aria-*` 일부 적용, 색/라벨 표시 |
| `src/hooks/useFileAuthGuard.ts` | `activeFileName` 없으면 `/`로 리다이렉트, encrypted인데 `cryptoKey` 없으면 `/auth`로 리다이렉트 |
| `src/hooks/useAndroidBackButton.tsx` | `DOUBLE_BACK_EXIT_PATHS=['/', '/accounts']`. `/create-vault`는 자동으로 `navigate(-1)` |
| `e2e/01-create-vault.spec.ts` | **전면 재작성 필요** (브레인스톰 "E2E 회귀 0" 가정이 틀림). 현재는 다이얼로그 기반 |
| `e2e/utils/vault-helpers.ts:8-43` | `createTestVault()` — `data-testid="pin-create-form"` 또는 `input[type="password"]` 폴링 |
| `e2e/fixtures/test-data.ts:3` | `TEST_PIN = '1234'`, `WRONG_PIN = '4321'` |
| `src/components/dialogs/FileDialogs.test.tsx` | `FileCreateDialog` 단위 테스트 (Component Tests). **마이그레이션 시 삭제 또는 재기록** |

## `createDataFile` 현재 시그니처

```ts
// src/database/fileStorage.ts:260-263
export const createDataFile = async (
  fileName: string,
  pin?: string
): Promise<KiyoVaultData> => { ... }
```

`pin`만 받음, 폴더/SAF 인자 없음. **Plan-7a는 이 시그니처를 변경하지 않음.**

## 현재 E2E `01-create-vault.spec.ts` 핵심 흐름

```ts
// Line 14-51 (요약)
await page.getByRole('button', { name: '파일 생성' }).click();
await expect(page.getByRole('dialog')).toBeVisible();
await expect(page.getByRole('heading', { name: '새 파일 생성' })).toBeVisible();
// text input + checkbox + password input → "생성" 버튼 → /accounts
```

**Plan-7a 후:** `dialog`/`heading "새 파일 생성"`이 사라지고 `/create-vault` 페이지가 됨. E2E 전면 재작성 필수.

## Home.tsx 현재 마크업

```tsx
// src/pages/Home.tsx:158-164
<button
  type="button"
  onClick={() => setShowCreateDialog(true)}
  className="..."
>
  파일 생성
</button>
```

→ Plan-7a 후:
```tsx
<Link to="/create-vault" className="...">파일 생성</Link>
```

---

# Architecture

## 라우트 추가

`src/App.tsx`에 `/create-vault` 1개 라우트 추가. Plan-7a는 단일 라우트, 단계는 컴포넌트 내부 `useState`.

```tsx
<Route path="/create-vault" element={<CreateVaultPage />} />
```

## 새 파일 구조

```
src/
├── pages/
│   └── CreateVault/
│       ├── index.tsx                  # 라우트 진입점, Stepper + Step 컴포넌트 라우팅 + state holder
│       ├── CreateVaultPage.test.tsx   # 페이지 단위 테스트
│       ├── steps/
│       │   ├── NameStep.tsx           # Step 1: 파일 이름 입력 + 실시간 검증
│       │   └── PinStep.tsx            # Step 2: PIN 입력 + PinStrengthMeter + createDataFile 에러
│       └── components/
│           └── Stepper.tsx            # <ol> 시맨틱, 양 끝 단계 라벨 + 연결선
```

## 상태 (`useState`, Q9-b 결정)

`CreateVaultPage` 내부에 `useState`로 step/fileName/pin/error 보관. Zustand store 불필요 — 단일 페이지 + props drilling 1단계라 store는 오버헤드.

```ts
// CreateVaultPage/index.tsx
const [step, setStep] = useState<1 | 2>(1);
const [fileName, setFileName] = useState("");
const [pin, setPin] = useState("");
const [error, setError] = useState<string | null>(null);
```

**Lifecycle (Q19 결정):** 컴포넌트 unmount 시 자동 GC. persist 불필요 (vault 생성은 새로고침 시 처음부터).

## Stepper UI (Q5-c + Q7-c 결정)

`<ol>` 시맨틱, 양 끝에 단계 라벨, 점선 연결선. 2단계:

```tsx
<ol aria-label="파일 생성 단계" className="flex items-center gap-3">
  <li
    className="flex items-center gap-2"
    aria-current={step === 1 ? "step" : undefined}
    data-state={step === 1 ? "current" : step > 1 ? "done" : "pending"}
  >
    <span className="step-circle">{/* ● or ○ */}</span>
    <span>이름</span>
  </li>
  <li aria-hidden="true" className="flex-1 border-t border-dashed border-[var(--color-border)]" />
  <li
    className="flex items-center gap-2"
    aria-current={step === 2 ? "step" : undefined}
    data-state={step === 2 ? "current" : "pending"}
  >
    <span className="step-circle" />
    <span>PIN</span>
  </li>
</ol>
```

- 완료/현재: 채워진 원 (`data-state="done" | "current"`) + 라벨 활성 색상
- 미진행: 빈 원 + 비활성 색상
- `aria-current="step"` 현재 단계 표시 (스크린리더 호환)

## 데이터 흐름

```
[Home.tsx: 파일 생성 클릭]
  → <Link to="/create-vault">
    → <CreateVaultPage>
        → <Stepper step={step} />
        → step === 1 ? <NameStep /> : <PinStep />
        → 다음 버튼: handleNext (validateName 통과 시 setStep(2))
        → 생성 버튼: handleSubmit (createDataFile → navigate("/accounts"))
  → unmount → useState 자동 GC
```

`useFileAuthGuard`는 호출하지 않음 (Q1-Q2 결정). active file이 이미 있어도 `/create-vault`에 머무름. 새 파일 생성 시 `createDataFile`의 `setupVaultSession`이 active를 새 파일로 덮어씀.

## Step 1: NameStep (Q11-c, Q12-a, Q15-b, Q16-a 결정)

```tsx
const NAME_MAX_LENGTH = 50;
const NAME_FORBIDDEN = /[\/\\:*?"<>|\x00]/;

const validateName = (name: string): string | null => {
  const trimmed = name.trim();
  if (!trimmed) return null;  // 빈 문자열은 메시지 표시 안 함 (조용히 disabled)
  if (trimmed.length > NAME_MAX_LENGTH) return `파일 이름은 ${NAME_MAX_LENGTH}자 이하로 입력해주세요.`;
  if (NAME_FORBIDDEN.test(trimmed)) return "파일 이름에 다음 문자를 사용할 수 없습니다: / \\ : * ? \" < > |";
  return null;
};

// NameStep 내부
const validation = validateName(fileName);

<input
  id="vault-name"
  type="text"
  value={fileName}
  onChange={(e) => handleFileNameChange(e.target.value)}
  placeholder="my-accounts"
  aria-invalid={validation !== null}
  aria-describedby={validation ? "name-error" : undefined}
  data-testid="create-vault-name-input"
/>
<span>.json</span>

{validation && (
  <p id="name-error" role="alert" className="text-sm text-[var(--color-error)]">
    {validation}
  </p>
)}

<button onClick={onNext} disabled={validation !== null}>다음</button>
```

**검증 규칙 (Q11-c):**
1. `fileName.trim()` 비어있지 않음 (단, 빈 문자열은 메시지 표시 안 함)
2. 길이 1~50자
3. 위험 문자 차단: `/ \ : * ? " < > | NUL`

**실시간 피드백 (Q12-a, Q16-a):**
- onChange마다 `validateName` 호출 → 메시지 + `aria-invalid`
- 입력 변경 시 `setError(null)` 자동 클리어 (Q16-a)
- 빈 문자열: 메시지 없음, 다음 버튼 disabled (조용히)
- 위험 문자 / 길이 초과: 인라인 에러 메시지 visible

## Step 2: PinStep (Q13-b, Q14-1, Q17-b, D3-a 결정)

```tsx
{/* D3-a: Step 1에서 입력한 파일명 표시 (보안 정보 아님, UX 친화) */}
<p className="text-sm text-[var(--color-text)]" data-testid="create-vault-target-name">
  파일: <span className="font-medium text-[var(--color-text-h)]">{fileName}.json</span>
</p>

<label htmlFor="pin">PIN</label>
<input
  id="pin"
  type="password"
  value={pin}
  onChange={(e) => setPin(e.target.value)}
  maxLength={20}
  placeholder="4~20자 PIN"
  data-testid="create-vault-pin-input"
/>
<PinStrengthMeter pin={pin} />  {/* 실시간 피드백은 PinStrengthMeter가 담당 */}

<button onClick={onBack}>이전</button>
<button onClick={onSubmit} disabled={pin.length < MIN_PIN_LENGTH}>생성</button>

{error && (
  <p role="alert" className="text-sm text-[var(--color-error)]">
    {error}
  </p>
)}
```

**검증:** `pin.length >= MIN_PIN_LENGTH` (= 4, Plan-4 정책). `maxLength={20}`로 상한 가드.

**암호화 체크박스 제거** — Plan-7a는 모든 새 파일을 암호화로 가정. 비암호화 신규 생성은 더 이상 사용자 흐름에 없음. 기존 비암호화 v1 데이터는 영향 없음.

**에러 표시 (Q14-1):** `createDataFile` 실패 시 Step 2 안에 인라인 `role="alert"` 메시지. Step 1에는 표시 안 함 (PIN 문제일 가능성 큼).

## 핸들러 (Q15-b, Q16-a, Q17-b 결정)

```ts
// CreateVaultPage/index.tsx

// Q16-a: 입력 변경 시 에러 자동 클리어
const handleFileNameChange = (value: string) => {
  setFileName(value);
  if (error) setError(null);
};

// Q15-b: 명시적 validateName() 후 통과 시 setStep(2)
const handleNext = () => {
  const validation = validateName(fileName);
  if (validation) {
    setError(validation);
    return;
  }
  setError(null);
  setStep(2);
};

// Q17-b: Step 2 → Step 1 "이전" 시 PIN 클리어 (보안)
const handleBack = () => {
  setPin("");
  setError(null);
  setStep(1);
};

// Q3-c: mapError 안 쓰고 인라인. Plan-A1 정식 도입 시 mapError로 교체
const handleSubmit = async () => {
  try {
    await createDataFile(`${fileName.trim()}.json`, pin);
    navigate("/accounts", { replace: true });
    // 성공 시 state는 unmount로 자동 GC
  } catch (err) {
    setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
  }
};
```

## Android 뒤로가기

`useAndroidBackButton`의 `DOUBLE_BACK_EXIT_PATHS = ['/', '/accounts']` — `/create-vault`는 자동 `navigate(-1)` (useAndroidBackButton.tsx:113-115).

- Step 1에서 뒤로가기 → Home으로 (`/`) 이동
- Step 2에서 뒤로가기 → `navigate(-1)` = Home으로 이동 (Step 1이 history에 없음, setStep(1) 안 됨)

**선택 (Architecture 결정):** `navigate(-1)` 그대로 — `useAndroidBackButton`의 단일 경로 유지, "한 가지 길". Step 2의 "이전" 버튼은 명시적으로 `handleBack` (= PIN 클리어 + setStep(1)) 호출. 사용자가 안드로이드 뒤로가기로 Step 2 → Home으로 가면 state는 unmount로 GC.

---

# Proposed Changes

## 변경 파일

| 파일 | 컴포넌트 | 변경 | 이유 |
|---|---|---|---|
| `src/App.tsx` | App | `<Route path="/create-vault" element={<CreateVaultPage />} />` 추가 | 라우트 신설 |
| `src/pages/Home.tsx` | Home | "파일 생성" button → `<Link to="/create-vault">`로 변경, `showCreateDialog` state 제거, `FileCreateDialog` import/사용 제거 | 다이얼로그 → 페이지 전환 |
| `src/pages/CreateVault/index.tsx` | 신규 | `<CreateVaultPage>` — Stepper + Step 컴포넌트 라우팅 + state holder (`useState`) + 핸들러 4개 | Plan-7a 진입점 |
| `src/pages/CreateVault/steps/NameStep.tsx` | 신규 | Step 1: 파일 이름 입력 + 실시간 검증 (Q11-c, Q12-a, Q15-b, Q16-a) | 단계 1 |
| `src/pages/CreateVault/steps/PinStep.tsx` | 신규 | Step 2: PIN 입력 + PinStrengthMeter + `createDataFile` 에러 표시 (Q13-b, Q14-1) | 단계 2 |
| `src/pages/CreateVault/components/Stepper.tsx` | 신규 | `<ol>` 시맨틱, 양 끝 단계 라벨 + 점선 연결선 (Q5-c, Q7-c) | Q3-b-2-B |
| `src/pages/Settings/components/DataSection.tsx` | DataSection | **변경 없음** — 1차 PR에서 `FileCreateDialog` 그대로 사용 | 1차 PR 범위 밖 (2차 PR에서 마이그레이션) |
| `src/components/dialogs/FileCreateDialog.tsx` | FileCreateDialog | **삭제하지 않음** — `DataSection` 백업이 사용 중 | 1차 PR 범위 밖 (2차 PR에서 제거) |
| `src/components/dialogs/FileDialogs.test.tsx` | FileDialogs.test | **삭제하지 않음** — 1차 PR 범위 밖 | 1차 PR 범위 밖 (2차 PR에서 정리) |
| `e2e/01-create-vault.spec.ts` | E2E | **전면 재작성** — 페이지 기반 시나리오로 변경 | E2E 표면 자체 변경 |
| `e2e/11-close-datafile.spec.ts` | E2E | "같은 이름 재시도 → (1) suffix 부여" 시나리오를 Plan-7a에 맞춰 **페이지 기반으로 재작성** | Multi-Vault에서 작성된 동일 시나리오 (Q21-b 결정) |
| `e2e/utils/vault-helpers.ts:createTestVault` | E2E 헬퍼 | **페이지 기반으로 갱신** — Step 1(이름) → "다음" → Step 2(PIN) → "생성" 흐름 (D2-b 결정) | `auth.fixture.ts` 등 다수 spec이 의존 |
| `e2e/fixtures/auth.fixture.ts` | E2E 픽스처 | 사용처(`authenticatedPage`, `vaultCreatedPage`, `seededPage`)가 `createTestVault` 호출 — 갱신 후 정상 동작 확인 | `createTestVault` 갱신의 연쇄 영향 |

## 신규 파일 (5개)

```
src/pages/CreateVault/index.tsx
src/pages/CreateVault/steps/NameStep.tsx
src/pages/CreateVault/steps/PinStep.tsx
src/pages/CreateVault/components/Stepper.tsx
src/pages/CreateVault/CreateVaultPage.test.tsx     # 단위 테스트
src/pages/CreateVault/components/Stepper.test.tsx # 단위 테스트
src/pages/CreateVault/steps/NameStep.test.tsx     # 단위 테스트
src/pages/CreateVault/steps/PinStep.test.tsx      # 단위 테스트
```

(`src/utils/mapError.ts`는 **신규 작성 안 함** — Q3-c 결정. `mapError`는 Plan-A1 책임. Plan-7a는 인라인 처리.)

## 마이그레이션 전략 — `FileCreateDialog` 완전 제거 (Q4-a)

**순서가 중요합니다.** Q4-a는 "호출처 100% 마이그레이션 후 완전 제거"입니다.

**전략:**

1. **Plan-7a 1차 PR (이번):**
   - `/create-vault` 라우트 신설
   - `Home.tsx` "파일 생성" → `<Link to="/create-vault">`로 변경
   - **`DataSection` 백업은 `FileCreateDialog` 그대로 유지** (Q4-a가 마이그레이션 후 제거 요구)
   - `FileCreateDialog`는 **삭제하지 않음** (DataSection 사용 중)
   - `FileDialogs.test.tsx`도 유지

2. **Plan-7a 2차 PR (후속, 같은 plan 내):**
   - `DataSection.tsx`의 백업 파일 저장을 `FileCreateDialog` → **인라인 폼 또는 새 `BackupFileDialog`**로 마이그레이션
   - 결정은 Plan-7a 1차 PR에서 사용자에게 확인:
     - (a) 인라인 폼 (백업은 단순하니 페이지 불필요)
     - (b) 새 `BackupFileDialog` (분리된 다이얼로그, Plan-7a와 결합도 낮음)
   - `FileCreateDialog` 및 `FileDialogs.test.tsx` **완전 제거**

**이번 plan의 1차 PR 범위**:
- 라우트/페이지/Step 컴포넌트 신설
- `Home.tsx` 마이그레이션
- `DataSection`은 **건드리지 않음** (호출처 잔존)
- `FileCreateDialog` **삭제하지 않음** (잔존)
- E2E 재작성 (Home 파일 생성 시나리오 + 11번 spec의 suffix 시나리오)

**2차 PR은 Plan-7a 완료 후 별도 작업**으로 분리. 이 plan의 "Goal"은 1차 PR까지로 갱신.

## 비-목표 (이번 plan)

- `DataSection` 백업 다이얼로그 마이그레이션 (2차 PR)
- `FileCreateDialog` 완전 제거 (2차 PR)
- **`FileOpenDialog` (Home의 "파일 선택")** — Plan-7a 범위 밖, 별도 plan (D4-b 결정). 현재 모달 그대로 유지
- Plan-7b (폴더 선택 + 자동 백업 통합)
- 자동 종료/잠금/세션 만료 등 다른 흐름

---

# 구현 노트 (1차 PR 머지 후 발견/수정 사항)

## "비밀번호 없이 만들기" 버튼 추가 (Plan-7a 1차 PR e878f85b, plan 문서 외)

- **위치:** `src/pages/CreateVault/steps/PinStep.tsx:78-87`, `src/pages/CreateVault/index.tsx:48-61` (`handleSkip`)
- **행위:** Step 2에서 PIN 입력 대신 텍스트 링크 클릭 → `createDataFile(name)` (PIN 인자 없음) → 평문 JSON 저장 → `/accounts`
- **plan 문서 vs 구현 차이:**
  - plan §"비-목표"는 "비암호화 볼트 신규 생성 UI"라고 명시했으나, 1차 PR 구현은 우회 경로(별도 버튼)를 만들어 비암호화 흐름을 유지
  - 사용자 의견 또는 UX 결정으로 추정 — 정확한 의도는 plan에 기록되지 않음
- **Android E2E 영향:** `CreateVaultPage.createVault(encrypted = false)`는 `비밀번호 없이 만들기` 버튼 클릭으로 매핑. `AutofillE2ETest.kt:84`의 `uniqueVaultName(encrypted = false)` 경로도 동일하게 동작.
- **Plan-7a 2차 PR에서 결정 필요:** (a) "비밀번호 없이 만들기" 유지, (b) Plan-7a 1차 PR의 의도(비암호화 신규 제거)에 맞춰 버튼 제거

## Android E2E 갱신 (Plan-7a 후속, 2026-08-30)

1차 PR 머지 후 `FileCreateDialog` 기반 Android E2E(`VaultCreateDialog.kt`)는 다음 이유로 모두 깨짐:
- input id: `vault-name-input` → `vault-name` (suffix 사라짐)
- 암호화 체크박스(`파일 암호화 사용`) 완전 제거
- PIN placeholder: `6자리 PIN` → `4~20자 PIN` (Plan-4 정책)
- `<form>` wrapper 제거 + `type="submit"` 버튼 미사용
- "취소" 버튼 → 헤더 "홈으로" 버튼 (aria-label)

**갱신 결과:**
- `VaultCreateDialog.kt` → `CreateVaultPage.kt`로 파일명/클래스명 변경 (pageobject 의미 일치)
- 페이지 기반 2단계 흐름: Step 1 입력 → "다음" → Step 2 PIN/skip → "생성"/"비밀번호 없이 만들기" → `/accounts`
- `data-testid` 기반 셀렉터 (React E2E와 동일 전략)
- `HomePage.kt`: `clickCreateVaultButton(): CreateVaultPage` 반환 타입 갱신
- `TestDataFactory.kt`: `.json 자동 부여` 출처 코멘트 갱신 (FileCreateDialog → CreateVaultPage)

**E2E 본 실행:** 사용자 직접 (`run-autofill-e2e.ps1`, `run-autosave-e2e.ps1`, `run-biometric-e2e.ps1`).

**완료 (2026-08-30):**
- `VaultCreateDialog.kt` → `CreateVaultPage.kt` rename + 페이지 기반 재작성
- `HomePage.kt` `clickCreateVaultButton(): CreateVaultPage` 반환 타입 갱신
- `TestDataFactory.kt` 코멘트 갱신
- 빌드 검증: `npm run check` 383/383 통과, `:app:compileDebugAndroidTestKotlin` 성공, `:app:installDebugAndroidTest` 성공
- 사용자 E2E 직접 실행: `BiometricUnlockE2ETest` 포함 Android E2E 전부 성공 (2026-08-30)

**PIN 인증 화면 강도 표시 제거 (2026-08-30, Plan-7a 작업 중 발견):**
- `src/pages/Auth.tsx` (잠금 해제) + `src/components/dialogs/FileOpenDialog.tsx` (파일 열기)에서 `PinStrengthMeter` 제거
- **이유:** 두 화면은 기존 PIN으로 인증하는 화면. 입력값이 vault의 PIN과 일치하는지가 핵심이지, 입력 중 PIN의 "강도"가 의미 있는 정보 아님
- **유지:** `CreateVault/steps/PinStep.tsx` (신규 vault PIN) + `Settings/components/PinChangeDialog.tsx` (PIN 변경) + `FileCreateDialog.tsx` (DataSection 백업용 잔존, 2차 PR에서 제거 예정)
- **검증:** `npm run check` 383/383 통과

---

# Tests

## Unit tests

| 대상 | 파일 | 검증 |
|---|---|---|
| `Stepper` | `src/pages/CreateVault/components/Stepper.test.tsx` (신규) | 1단계/2단계 렌더, `aria-current="step"` 갱신, 점선 연결선 표시 |
| `NameStep` | `src/pages/CreateVault/steps/NameStep.test.tsx` (신규) | (1) `validateName`: 빈 문자열 / 길이 초과 / 위험 문자 / 정상 (2) `handleFileNameChange`가 `setError(null)` 자동 클리어 (3) 위험 문자 입력 시 `role="alert"` 메시지 visible + 다음 버튼 disabled |
| `PinStep` | `src/pages/CreateVault/steps/PinStep.test.tsx` (신규) | (1) PIN 입력 시 `pin` state 업데이트 (2) 4자 미만 시 생성 버튼 disabled (3) `PinStrengthMeter` 렌더 (4) `error` prop 있을 때 `role="alert"` 메시지 visible |
| `CreateVaultPage` | `src/pages/CreateVault/CreateVaultPage.test.tsx` (신규) | (1) `handleNext`: validateName 실패 시 `setError` 호출, 통과 시 `setStep(2)` (2) `handleBack`: `setPin("")` + `setStep(1)` (3) `handleSubmit` 성공 시 `createDataFile` 호출 + navigate (4) `handleSubmit` 실패 시 `setError(err.message)` |

## Integration tests (Vitest)

기존 `FileDialogs.test.tsx`는 **이번 plan에서 삭제하지 않음** (FileCreateDialog 잔존). 2차 PR에서 함께 정리.

## E2E (Playwright) — `e2e/01-create-vault.spec.ts` 전면 재작성 + `e2e/11-close-datafile.spec.ts` 일부 재작성

**기존 E2E는 모달 기반 (role="dialog", heading "새 파일 생성") → 페이지 기반으로 변경.**

| 시나리오 | 검증 |
|---|---|
| **암호화 볼트 생성 (2단계 흐름)** | "파일 생성" 클릭 → `/create-vault` → Stepper 1단계 (이름 active) → "test-vault" 입력 → "다음" → Step 2 → PIN 4자 입력 → "생성" → `/accounts`로 이동, 빈 리스트 |
| **이전 버튼 + PIN 클리어** | Step 2에서 "이전" → Step 1, `fileName`은 유지, `pin`은 클리어 |
| **빈 파일명 다음 버튼 disabled** | Step 1에서 입력 비우고 "다음" → disabled, 에러 메시지 없음 (조용히) |
| **위험 문자 / 길이 초과 인라인 에러** | Step 1에서 `"test/file"` 또는 51자 입력 → `role="alert"` 메시지 visible + 다음 버튼 disabled |
| **입력 수정 시 에러 자동 클리어** | 위험 문자 입력 → 메시지 visible → 정상 문자로 수정 → 메시지 사라짐 |
| **PIN 4자 미만 생성 버튼 disabled** | Step 2에서 PIN 3자 → "생성" disabled |
| **`createDataFile` 실패 시 Step 2 인라인 에러** | (인공 실패 주입 — `createDataFile` mock throw) → `role="alert"` 메시지 visible, Step 2에 머무름 |
| **중복 파일명 자동 suffix** | `e2e/11-close-datafile.spec.ts:311-`의 "같은 이름 재시도 → (1) suffix 부여" 시나리오를 Plan-7a에 맞춰 페이지 기반으로 재작성. Home 파일 리스트에서 `test(1).json` visible 확인 (Q21-b 결정) |
| **취소 (홈으로)** | Step 1에서 "홈으로" 또는 X 버튼 → `/`로 이동 |

`e2e/utils/vault-helpers.ts:createTestVault()`는 **이번 plan에서 변경하지 않음** (다른 E2E에 영향). 단, 새 `01-create-vault.spec.ts`는 자체 step 시나리오로 작성.

**E2E 회귀 = N/A (전면 재작성)**: 표면 자체가 모달 → 페이지로 변경. 기존 시나리오는 새 시나리오로 대체.

## Manual verification

- [ ] Android 에뮬레이터에서 `/create-vault` 직접 진입, Stepper 표시 확인
- [ ] Step 1 → Step 2 전환 시 Stepper `aria-current="step"`이 1→2로 이동
- [ ] Step 2에서 안드로이드 뒤로가기 → Home으로 (취소 의도와 일치)
- [ ] Step 2 "이전" → Step 1, PIN 클리어 확인 (Q17-b)
- [ ] 키보드 Tab 순서: Step 1 (input → 다음 버튼), Step 2 (PIN input → 이전 → 생성)
- [ ] 화면 reader (TalkBack) — Stepper의 `aria-current="step"` 음성 안내 확인
- [ ] active file이 있는 상태에서 `/create-vault` 진입 → 새 파일 생성 가능 (덮어쓰기)

---

# Risks

| 리스크 | 완화 |
|---|---|
| **`DataSection` 백업 마이그레이션 누락** | Plan-7a 1차 PR은 `DataSection` 미변경, `FileCreateDialog` 잔존. 2차 PR에서 마이그레이션 후 제거. README/체크리스트에 명시 |
| E2E 전면 재작성이 다른 시나리오에 영향 | `01-create-vault.spec.ts` + `11-close-datafile.spec.ts` + `vault-helpers.ts:createTestVault` 변경. `02-unlock.spec.ts` 이후 spec은 `auth.fixture.ts` 경유로 `createTestVault` 의존 — 헬퍼 갱신으로 자동 연쇄 처리 |
| Android 뒤로가기가 Step 2에서 `setStep(1)`이 아닌 `navigate(-1)` | §Architecture "Android 뒤로가기" 참조. "한 가지 길" 유지. 사용자는 Step 2 "이전" 버튼으로 명시적 복귀 (PIN 클리어 포함) |
| **Plan-A1 (`mapError` 정식 도입) 시 Plan-7a 호출처 마이그레이션 누락** | Out of Scope에 Plan-A1 작업 항목으로 명시. Plan-A1 ce-plan 작성 시 Plan-7a 호출처 (`CreateVaultPage.handleSubmit`)를 정식 `mapError`로 마이그레이션하는 작업을 포함 |
| 진행 중 다른 plan (Plan-A1/A2) 회귀 | Plan-7a는 Plan-A1 이전에 진행. Plan-7a는 인라인 `err.message` 처리. Plan-A1 작업 시 Plan-7a 호출처도 함께 마이그레이션 (cross-plan 통합) |
| active file이 있는 상태에서 `/create-vault` 진입 시 충돌 | 결정 (Q1-Q2): `useFileAuthGuard` 호출 안 함, active file이 있어도 진행. `createDataFile`의 `setupVaultSession`이 active를 새 파일로 덮어씀. UX 일관성: Home에서만 진입하는 게 정상 흐름 |
| 빈 문자열일 때 메시지 표시 안 함 → 사용자 혼란 가능 | Q12 결정. 빈 문자열은 조용히 disabled, 메시지 없음. 비어있지 않은데 검증 실패한 경우만 메시지 표시. 사용자 입력 시작 → 검증이 의미 생김 |
| **Android autofill E2E (`test:e2e:android`) setup 단계 깨짐** | `noAuthFill`/`authResync` 같은 기존 Android E2E는 `FileCreateDialog` 기반 vault 생성 setup에 의존. Plan-7a 머지 후 `/create-vault` 페이지로 전환되어 setup 단계가 깨질 가능성 있음. Out of Scope에서 후속 작업으로 분리 — Plan-7a-android-e2e 갱신 (별도 작업) |

## KIYO Security

이 plan은 **새 파일 생성 흐름의 UI 변경**으로, crypto/keystore/Autofill 경로에 영향 없음:

- **key ownership:** 변경 없음 (`createDataFile`이 그대로 cryptoKey 생성)
- **authentication boundary:** 변경 없음 — `useFileAuthGuard`는 호출하지 않음 (Q1-Q2 결정). 이 페이지 자체가 "auth가 필요 없는 페이지" (새 파일 생성)
- **process boundary:** 변경 없음 (React 측 한정)
- **failure behavior:** `createDataFile` 실패 시 try/catch → `setError(err.message)` (인라인 처리). Plan-A1 정식 `mapError` 도입 시 교체

**`createDataFile` 호출 근거 (D1-a 결정):** `createDataFile`은 `createEncryptedVault` + `persistVaultRecord` + `setupVaultSession`을 합성한 wrapper (fileStorage.ts:260-330). Plan-7a는 이 wrapper를 직접 호출하며, AGENTS.md의 "Pipeline functions 사용" 원칙 준수. `exportVaultFile`은 Plan-7b 범위 (백업 통합 시 사용).

**중요:** Plan-7a는 OS 파일시스템에 **저장하지 않음** (현재 `createDataFile` 동작 유지). Plan-7b에서 SAF 통합이 추가될 때 별도 security 검토 필요.

---

# Rollback

Plan-7a 1차 PR 롤백:

1. `src/App.tsx`에서 `/create-vault` 라우트 제거
2. `src/pages/Home.tsx`의 `<Link>` → `<button onClick={() => setShowCreateDialog(true)}>` 복원
3. `showCreateDialog` state 복원
4. `FileCreateDialog` import/사용 복원 (이미 잔존)
5. `src/pages/CreateVault/**` 신규 파일 삭제
6. E2E `01-create-vault.spec.ts`를 원래 다이얼로그 기반으로 복원 (git history에서)
7. E2E `11-close-datafile.spec.ts`의 suffix 시나리오를 원래 모달 기반으로 복원 (git history에서)
8. E2E `vault-helpers.ts:createTestVault`를 원래 모달 기반으로 복원 (git history에서) — `auth.fixture.ts` 의존성 정상화

**롤백 비용:** 낮음. 신규 파일만 추가됐고, `Home.tsx` 변경 외 기존 코드 0 변경.

---

# Verification (완료 정의)

다음이 모두 참이어야 plan 완료:

- [ ] `/create-vault` 라우트 신설, `Home.tsx` "파일 생성"이 `<Link to="/create-vault">`로 변경
- [ ] Step 1 (이름) → Step 2 (PIN) → `/accounts` 흐름 동작 (수동 + E2E)
- [ ] Stepper `<ol>` + 양 끝 단계 라벨 + 점선 연결선 2단계 표시, `aria-current="step"` 적용
- [ ] `validateName`: 빈 문자열(조용히 disabled) / 위험 문자(메시지) / 길이 초과(메시지) — 인라인 메시지 + `aria-invalid` + `aria-describedby`
- [ ] `handleFileNameChange`가 `setError(null)` 자동 클리어
- [ ] `handleBack`: PIN 클리어 + setStep(1)
- [ ] `createDataFile` 실패 시 Step 2 안에 `role="alert"` 메시지 visible
- [ ] `FileCreateDialog`는 **잔존** (DataSection 백업용), 1차 PR에서는 삭제 X
- [ ] `DataSection` 백업 동작 그대로 (회귀 0)
- [ ] `e2e/01-create-vault.spec.ts` 페이지 기반으로 재작성, 통과
- [ ] `e2e/11-close-datafile.spec.ts`의 suffix 시나리오 페이지 기반으로 재작성, 통과
- [ ] `e2e/utils/vault-helpers.ts:createTestVault` 페이지 기반으로 갱신, 통과 (D2-b)
- [ ] `e2e/fixtures/auth.fixture.ts` 사용처 정상 동작 확인 (`02-unlock`, `03-account-crud` 등)
- [ ] `npm run check` 통과 (typecheck + test)
- [ ] `npm run build` 통과
- [ ] 수동 verification 7개 항목 통과
- [ ] Android `npx cap sync android` 후 빌드 OK (UI 변경만, native 영향 0)
- [ ] Android E2E (`run-autofill-e2e.ps1`, `run-autosave-e2e.ps1`, `run-biometric-e2e.ps1`) 전부 통과 (Plan-7a-android-e2e 갱신)

**완료 시점이 아닌 plan 작성 시점에 확인 불가한 항목:** 위 [ ] 항목들. 이 plan은 **다른 plan과 동일하게** ce-work가 실제 구현/검증.

---

# Out of Scope (후속)

- **Plan-7a 2차 PR:** `DataSection` 백업 마이그레이션 + `FileCreateDialog` 완전 제거
- **Plan-7b:** 폴더 선택 + 자동 백업 통합 (별도 brainstorm)
- **Plan-A1:** `mapError` 정식 도입, `SyncErrorBanner`, 호출처 6곳 try/catch — **Plan-7a의 `CreateVaultPage.handleSubmit` 인라인 에러 처리를 정식 `mapError`로 마이그레이션** (Q10-c 결정)
- **Plan-A2:** 초기 진입 Skeleton
- **Plan-B:** `Button.loading`
- **a11y audit:** axe-core CI + 키보드 Playwright
- **Plan-7a-android-e2e:** Android autofill E2E (`test:e2e:android`)의 vault 생성 setup이 `FileCreateDialog` → `/create-vault`로 전환됨에 따라 깨질 가능성. `noAuthFill`/`authResync` 등의 setup 단계를 페이지 기반으로 갱신. 별도 작업. **완료 (2026-08-30): `CreateVaultPage.kt`로 페이지 기반 갱신 + `BiometricUnlockE2ETest` 포함 Android E2E 전부 성공 확인.**
- **Plan-7a-auth-pin-meter:** `Auth.tsx` (잠금 해제) + `FileOpenDialog.tsx` (파일 열기)에서 `PinStrengthMeter` 제거. **완료 (2026-08-30, see §구현 노트).** Plan-7a 작업 중 사용자가 발견 — 인증 화면에서 PIN 강도 표시는 의도적으로 부적절.

각 plan이 진행되면 Plan-7a 호출처는 cross-plan 통합으로 갱신 (특히 `mapError` import 교체).
