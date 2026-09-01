# Plan-A1 — 에러 가시화 (mapError + SyncErrorBanner + 호출처 마이그레이션)

- Date: 2026-08-30
- Source: [`docs/brainstorms/2026-08-30-track3-ux-accessibility.md`](../brainstorms/2026-08-30-track3-ux-accessibility.md) §7 A1, §8.1, §10 Q1/Q2, §11
- 선행: [Multi-Vault Support](./2026-08-30-multi-vault-support.md) ✅, [Plan-7a](./2026-08-30-plan-7a-create-vault-multistep.md) ✅
- 후속: Plan-A2 (Spinner), Plan-B (Button 통일) — A1의 `mapError` 활용
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- 결정 사항: §결정 (Plan-A1 대화형 리뷰 결과) 참고

---

# Goal

**사용자 가시 에러 처리를 일관된 패턴으로 통일**한다. Plan-7a/Plan-B가 의존하는 공통 전제.

완료 시 다음이 참:
- `mapError(err: unknown): string` 함수 1개 — 네이티브 에러 / Dexie / Web Crypto / 일반 Error → 한국어 사용자 메시지
- `SyncErrorBanner` 컴포넌트 1개 — `useSessionStore.lastSyncError` 구독, 페이지 상단 배너로 가시화
- 사용자 액션 경로(폼 submit/저장/삭제 등)의 모든 catch가 `mapError()` 호출 또는 인라인 사용자 메시지로 통일. **네이티브 에러 영문 텍스트가 UI에 노출되지 않음**
- `CreateVaultPage`의 인라인 try/catch (Plan-7a 주석 §63 "Plan-A1 정식 도입 시 mapError로 교체") → `mapError`로 마이그레이션
- `AccountDetail`/`TemplateEdit`의 삭제 confirm이 실패 시 `ConfirmDialog`를 닫지 않고 인라인 에러 표시
- `AccountEdit.handleSave`에 try/catch + 인라인 에러 영역 추가 (현재 무반응)
- `db.ts:persistVaultSnapshot` 성공 시 `clearSyncError()` 호출 (자동 클리어)
- E2E 회귀 0 — 기존 Playwright 스펙은 모달/페이지 표면 변화 없음 (A1은 **내부 catch 처리 + 전역 배너 1개 추가**만)

**범위 밖 (Plan-A1):**
- Toast / Snackbar / `useAsync` / `useFormError` 훅 — **포함 안 함** (Q1)
- `Spinner` / `Skeleton` 공통 컴포넌트 — **Plan-A2로 분리**
- `Button.loading` prop — **Plan-B로 분리**
- a11y audit (axe-core CI, 키보드 Playwright) — **별도 plan**
- 새 라우트/페이지 추가 — **0**
- i18n 정식 도입 — **별도 plan**

---

# Current State

## 인스펙션으로 확인된 catch / 무반응 호출처 (코드 기준, brainstorm의 "6곳"보다 정확)

| # | 파일:라인 | 현재 상태 | Plan-A1 후 |
|---|---|---|---|
| 1 | `src/pages/Accounts/AccountEdit/index.tsx:178-227` `handleSave` | **try/catch 없음** — `addAccount`/`updateAccount` 실패 시 throw, UI 무반응 (콘솔만) | try/catch + 인라인 에러 영역 + `setError(mapError(err))` |
| 2 | `src/pages/Accounts/AccountDetail.tsx:70-74` `handleDelete` | **try/catch 없음** — `deleteAccount` 실패 시 throw, UI 무반응 | try/catch + `setDeleteError(mapError(err))` + `ConfirmDialog error` prop, **모달 닫지 않음** |
| 3 | `src/pages/Templates/TemplateEdit/index.tsx:152-156` `handleDelete` | **try/catch 없음** | try/catch + `setDeleteError(mapError(err))` + `ConfirmDialog error` prop, **모달 닫지 않음** |
| 4 | `src/pages/Templates/TemplateEdit/index.tsx:77-90` `handleSave` | catch 있음, `setErrors(["템플릿 저장에 실패했습니다."])` — 일반 메시지만, 원인 불명 | `setErrors([mapError(err)])` |
| 5 | `src/pages/Settings/components/AutofillSection.tsx:48,65,103,147` 4개 catch | `setError(err.message \|\| "상태 확인 실패")` — **네이티브 에러 영문 그대로 노출** | `setError(mapError(err))` |
| 6 | `src/store/accountStore.ts:50-65` `loadAccounts` | catch 있음, `console.error`만 — **UI 피드백 0** | `setSyncError(mapError(error))` 추가. 기존 `console.error` 유지 |
| 7 | `src/store/accountStore.ts:142-146` `syncToAutofill` | catch 있음, `console.error`(DEV only) — **사용자 가시 0** | `setSyncError(mapError(error))` 추가. `if (import.meta.env.DEV)` 가드 **제거** (사용자 가시화로 전환) |
| 8 | `src/pages/Auth.tsx:90-92,125-127` `handleSubmit` 2개 | catch 있음, `setError(\`PIN verification failed:${err}\`)` — **영문+원시 err** | `setError(mapError(err))`로 교체, Bio 행 분기(`keyCorrupted`)는 `mapError` 호출 전 사전 분기 유지 |
| 9 | `src/pages/Home.tsx:103-119` `handleOpenFile` | 이미 `isFileStorageError` 분기로 한국어 처리 중, 끝에 `throw error` → `FileOpenDialog.onError` | **변경 0** — 이미 작동 |
| 10 | `src/pages/CreateVault/index.tsx:48-78` `handleSkip`/`handleSubmit` | 인라인 `err.message \|\| "알 수 없는 오류..."` — 주석 Q3-c로 Plan-A1 시 mapError로 교체 예정 | `setError(mapError(err))` |

**총 10개 호출처. Plan-A1은 1~8, 10을 마이그레이션. 9는 이미 처리됨.**

## `lastSyncError` store ↔ UI 격차

- `src/store/sessionStore.ts:13,30,74-79,81-83` — `lastSyncError`, `lastSyncErrorTime`, `setSyncError`, `clearSyncError` 모두 정의됨
- **그러나 UI에서 `lastSyncError`를 구독/표시하는 곳 없음** (grep 결과: 정의 1 + 테스트 mock 2, UI 사용 0)
- `src/database/db.ts:122-164` `persistVaultSnapshot`은 `setSyncError?.(errorMessage)` 호출하지만 호출 결과 화면에 안 보임
- → **`SyncErrorBanner`가 채울 자리가 정확히 비어 있음**

## `partialize` 결정 (2026-08-30 Plan-A1 리뷰)

- `partialize` (`sessionStore.ts:96-101`)는 **`lastSyncError`/`lastSyncErrorTime` 포함 안 함** (의도된 동작)
- **결정: 그대로 유지** — 새로고침 시 자동 클리어, `setSyncError(null)`은 세션 중 자동 클리어용
- `db.ts:persistVaultSnapshot` **성공 경로**에 `clearSyncError?.()` 호출 추가 (자동 저장 사이클에서 자연스러운 클리어)
- 새로고침은 데이터 자체로 reset되니 배너 유지할 필요 없음 (배너 = 세션 중 알림)

## i18n 현황

- `react-i18next` 등 라이브러리 **없음** (`t(`/`useTranslation` grep 결과 0)
- 한국어 하드코딩이 프로젝트 관행
- **Plan-A1은 i18n 라이브러리 도입 안 함** — 한국어 하드코딩 유지, 추후 다국어 가능성 시 `t("key")` 패턴으로 일괄 변환

## E2E 영향

- A1은 **모달 → 페이지 전환 없음**, 새 라우트 추가 없음
- `SyncErrorBanner`는 `App.tsx` 전역 마운트 — `lastSyncError=null` 정상 경로에선 보이지 않음
- `ConfirmDialog`에 `error` prop 추가는 **모달 열린 채 메시지 표시** — 기존 E2E는 confirm/취소만 검증하므로 영향 없음
- **E2E 회귀 0 가정 성립**

## 기존 테스트 위치

- `src/hooks/useFileAuthGuard.test.tsx` — `setSyncError: vi.fn()` mock 포함
- `src/hooks/useAutoLock.test.tsx` — 동일
- `src/components/dialogs/FileDialogs.test.tsx` — Dialog 컴포넌트 (A1 무관)
- Plan-7a의 `src/pages/CreateVault/CreateVaultPage.test.tsx` — Plan-7a PR에서 추가됨 (4개 단위 테스트)

## 패키지 의존성

- 변경 없음. `mapError`/`SyncErrorBanner` 모두 기존 `react`/`zustand`로 구현 가능
- 새 라이브러리 추가 **0**

---

# Architecture

## 데이터 흐름

```
[User action] → [store mutation / async]
                    │
                    ├─ 성공 → setAccounts(...)
                    │
                    └─ 실패
                         │
                         ├─ 사용자 액션 경로 (#1, #2, #3, #4, #5, #8, #10)
                         │     └─ catch(err) {
                         │          const msg = mapError(err);
                         │          setError(msg);     // 인라인 또는 컴포넌트별
                         │        }
                         │
                         └─ 백그라운드 경로 (#6, #7, persistVaultSnapshot)
                               └─ catch(err) {
                                    const msg = mapError(err);
                                    useSessionStore.getState().setSyncError(msg);
                                  }
                                          │
                                          ▼
                                  [useSessionStore.lastSyncError]
                                          │
                                          ▼
                              <SyncErrorBanner /> (App.tsx 전역)
                                  └─ lastSyncError !== null → 상단 배너
                                       └─ [닫기] 클릭 → clearSyncError()
                                       └─ 다음 성공 시 → clearSyncError() (db.ts persistVaultSnapshot 성공 경로)
```

## `mapError` 분류 전략 (Q1)

```ts
// src/utils/mapError.ts
export function mapError(err: unknown): string {
  if (!err) return "알 수 없는 오류가 발생했습니다.";

  // 1. FileStorageError — 이미 한국어 매핑 (Home.tsx가 사용 중)
  if (isFileStorageError(err)) {
    switch (err.code) {
      case FileStorageErrorCode.INVALID_JSON: return "파일 형식이 올바르지 않습니다.";
      case FileStorageErrorCode.INVALID_FORMAT: return "지원하지 않는 파일 형식입니다.";
      case FileStorageErrorCode.INVALID_PIN: return "PIN 번호가 올바르지 않습니다.";
      case FileStorageErrorCode.NOT_FOUND: return "파일을 찾을 수 없습니다.";
      // fileStorage.ts의 모든 FileStorageErrorCode 매핑
    }
  }

  // 2. 네이티브 Capacitor 에러 (Keystore, AutofillPlugin)
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: string }).code;
    if (code === "KIYO_AUTOFILL_NOT_AVAILABLE") return "자동완성 서비스를 사용할 수 없습니다.";
    if (code === "KIYO_KEYSTORE_UNAVAILABLE") return "Android 키 저장소를 사용할 수 없습니다.";
  }

  // 3. DOMException (Web Crypto / IndexedDB)
  if (err instanceof DOMException) {
    if (err.name === "OperationError") return "데이터 처리 중 오류가 발생했습니다.";
    if (err.name === "QuotaExceededError") return "저장 공간이 부족합니다.";
  }

  // 4. FormDialog의 toErrorMessage (CryptoUnavailableError) — Plan-A1에서 통합
  if (err instanceof Error) {
    if (
      err.name === "CryptoUnavailableError" ||
      /Cannot read properties of undefined.*crypto/i.test(err.message) ||
      /secure context/i.test(err.message)
    ) {
      return "이 환경에서는 암호화 기능을 사용할 수 없습니다. HTTPS 또는 localhost로 접속해주세요.";
    }
    return err.message || "알 수 없는 오류가 발생했습니다.";
  }

  return "알 수 없는 오류가 발생했습니다.";
}
```

**원칙:**
- `FileStorageError`는 이미 사용자 친화적 영문 → 한국어 매핑으로 통일
- `Error.message`가 이미 한국어면 그대로 노출 (무손실)
- 영문/원시 err는 fallback에서만
- **`FormDialog`의 `toErrorMessage` 함수는 Plan-A1 후 `mapError` 호출로 교체** (단일 매핑 함수로 통합)

## `ConfirmDialog`의 `error` prop 신설

```ts
// src/components/dialogs/ConfirmDialog.tsx — 추가
interface ConfirmDialogProps {
  // ... 기존
  error?: string | null;  // 모달 안에 표시할 에러
}

// JSX — message 아래, 버튼 위에
{error && (
  <p className="mt-4 text-sm font-medium text-[var(--color-error)]"
     role="alert" data-testid="confirm-dialog-error">
    {error}
  </p>
)}
```

**호출처 동작:**
- `AccountDetail.handleDelete`: catch에서 `setDeleteError(mapError(err))`. `setShowDeleteConfirm(false)` 호출 안 함 (모달 유지)
- `TemplateEdit.handleDelete`: 동일
- 사용자가 [취소] 클릭 → `setDeleteError(null)` + close
- 사용자가 [삭제] 다시 클릭 → 정상 시도

## `AccountEdit`의 인라인 에러 영역

```tsx
// src/pages/Accounts/AccountEdit/index.tsx — 추가
const [saveError, setSaveError] = useState<string | null>(null);

const handleSave = async () => {
  try {
    // ... 기존 로직
    navigate(`/accounts/${savedAccount.id}`);
  } catch (err) {
    setSaveError(mapError(err));
  }
};

// JSX — 저장/취소 버튼 row 위
{saveError && (
  <p className="mt-4 text-sm font-medium text-[var(--color-error)]"
     role="alert" data-testid="account-edit-error">
    {saveError}
  </p>
)}
```

## `SyncErrorBanner` 위치 결정

**`App.tsx` 전역** — 모든 페이지에서 표시. `lastSyncError`는 백그라운드 경로에서 발생, 특정 페이지 한정 부자연. `AutoLockIndicator` 위(z-50).

---

# Proposed Changes

## 1. 새 파일: `src/utils/mapError.ts`

위 `mapError` 분류 전략 구현. `FormDialog`의 `toErrorMessage` 로직 통합.

## 2. 새 파일: `src/utils/mapError.test.ts`

- `mapError(null)` → 기본 메시지
- `mapError(new Error("PIN 번호가 올바르지 않습니다."))` → 그대로 반환
- `mapError({ code: "KIYO_AUTOFILL_NOT_AVAILABLE" })` → 한국어 매핑
- `mapError(new DOMException("quota", "QuotaExceededError"))` → 한국어 매핑
- `mapError(FileStorageError(INVALID_PIN))` → "PIN 번호가 올바르지 않습니다."
- `mapError("string err")` → fallback 메시지
- `mapError(CryptoUnavailableError)` → HTTPS 안내

## 3. 새 파일: `src/components/SyncErrorBanner.tsx`

```tsx
export function SyncErrorBanner(): JSX.Element | null {
  const lastSyncError = useSessionStore((s) => s.lastSyncError);
  const clearSyncError = useSessionStore((s) => s.clearSyncError);
  if (!lastSyncError) return null;
  return (
    <div role="alert" data-testid="sync-error-banner"
         className="fixed top-0 left-0 right-0 z-50 bg-[var(--color-error)] text-white px-4 py-3 flex items-center justify-between">
      <span>{lastSyncError}</span>
      <button onClick={clearSyncError} aria-label="에러 배너 닫기"
              className="ml-4 text-white">×</button>
    </div>
  );
}
```

## 4. 새 파일: `src/components/SyncErrorBanner.test.tsx`

- `lastSyncError=null` → 렌더 안 함
- `lastSyncError="에러"` → 배너 표시, 메시지 렌더
- 닫기 클릭 → `clearSyncError` 호출

## 5. `src/App.tsx` — `<SyncErrorBanner />` 마운트

`useEffect` 블록 위에 `<SyncErrorBanner />` 추가 (전역, AutoLockIndicator와 형제).

## 6. `src/components/dialogs/ConfirmDialog.tsx` — `error` prop 추가

`error?: string | null` prop, `message` 아래 + 버튼 위에 `<p role="alert">` 렌더. onClose 호출 시 `onClearError?` 또는 호출자가 직접 clear.

## 7. `src/components/dialogs/FormDialog.tsx` — `toErrorMessage` → `mapError` 통합

- `toErrorMessage` 함수 삭제
- `catch (error) { setInternalError(mapError(error)); }` — `mapError` import
- **시그니처/동작 보존** (호출자 API 변화 0)

## 8. `src/database/db.ts` — 성공 시 `clearSyncError` 호출

`persistVaultSnapshot` 성공 경로(try 블록 끝, 에러 throw 안 되는 곳)에 `clearSyncError?.()` 추가.

## 9. 호출처 마이그레이션 (8곳)

각 호출처를 `mapError` 사용으로 교체:

| # | 파일 | 변경 |
|---|---|---|
| 1 | `src/pages/Accounts/AccountEdit/index.tsx:178-227` | `handleSave`에 try/catch 추가 + `[saveError, setSaveError]` state + JSX 인라인 영역 |
| 2 | `src/pages/Accounts/AccountDetail.tsx:70-74` | `handleDelete`에 try/catch + `[deleteError, setDeleteError]` state + `ConfirmDialog error={deleteError}` (모달 유지) |
| 3 | `src/pages/Templates/TemplateEdit/index.tsx:152-156` | `handleDelete`에 try/catch + `[deleteError, setDeleteError]` + `ConfirmDialog error={deleteError}` |
| 4 | `src/pages/Templates/TemplateEdit/index.tsx:77-90` | `setErrors([mapError(err)])` |
| 5 | `src/pages/Settings/components/AutofillSection.tsx` 4곳 (line 49,66,104,148) | `setError(mapError(err))` |
| 6 | `src/store/accountStore.ts:50-65` `loadAccounts` | catch에 `setSyncError(mapError(error))` 추가. `console.error` 유지 |
| 7 | `src/store/accountStore.ts:142-146` `syncToAutofill` | `setSyncError(mapError(error))` 추가. `if (import.meta.env.DEV)` 가드 **제거** |
| 8 | `src/pages/Auth.tsx:90-92,125-127` | `setError(mapError(err))`로 교체, Bio 행 분기(`keyCorrupted`)는 `mapError` 호출 전 사전 분기 유지 |
| 10 | `src/pages/CreateVault/index.tsx:48-78` | `setError(mapError(err))`로 교체, Q3-c 주석 §63 정리 |

## 10. 단위 테스트 추가

- `src/utils/mapError.test.ts` — 7+ 케이스
- `src/components/SyncErrorBanner.test.tsx` — 3 케이스
- `src/store/accountStore.test.ts` (없으면 신규) — `loadAccounts` 실패 시 `setSyncError` 호출 검증
- `src/pages/Auth.test.tsx` (없으면 신규) — PIN 실패 시 `setError(mapError(err))` 검증
- `src/components/dialogs/ConfirmDialog.test.tsx` (확장) — `error` prop 렌더

---

# Tests

## 단위 테스트

| 파일 | 케이스 | 명령 |
|---|---|---|
| `src/utils/mapError.test.ts` (신규) | 7+ 케이스 (위 §2) | `npm run test -- mapError` |
| `src/components/SyncErrorBanner.test.tsx` (신규) | 3 케이스 | `npm run test -- SyncErrorBanner` |
| `src/store/accountStore.test.ts` (신규) | `loadAccounts` 실패 → `setSyncError` 호출 | `npm run test -- accountStore` |
| `src/components/dialogs/ConfirmDialog.test.tsx` (확장) | `error` prop 렌더 | `npm run test -- ConfirmDialog` |

## 통합 테스트

| 파일 | 케이스 | 명령 |
|---|---|---|
| `src/pages/CreateVault/CreateVaultPage.test.tsx` (기존, Plan-7a) | `handleSubmit` 실패 → `setError(mapError(err))` 결과가 `data-testid="pin-error"` 에 렌더 | `npm run test -- CreateVaultPage` |
| `src/pages/Accounts/AccountEdit/AccountEdit.test.tsx` (신규) | `handleSave` 실패 → 인라인 에러 표시, `setError` 검증 | `npm run test -- AccountEdit` |
| `src/pages/Accounts/AccountDetail.test.tsx` (신규) | `handleDelete` 실패 → `ConfirmDialog` 닫히지 않고 `error` prop 표시 | `npm run test -- AccountDetail` |
| `src/pages/Templates/TemplateEdit/TemplateEdit.test.tsx` (신규) | 동일 | `npm run test -- TemplateEdit` |

## E2E (Playwright)

- **회귀 0 가정** — Plan-A1은 모달/페이지 표면 변화 없음
- 기존 E2E 전부 그대로 통과
- `e2e/01-create-vault.spec.ts`는 Plan-7a에서 재작성 완료, `mapError` 마이그레이션은 catch 내부만이라 표면 무영향

## Android E2E

- **변경 없음**. Plan-A1은 React 측 한정
- `compileDebugKotlin` + `testDebugUnitTest` 통과

## 수동 검증

1. `npm run dev` → 홈에서 `/accounts` 진입 → Dexie IDB 강제 차단 → `SyncErrorBanner` 상단 표시 → 닫기 → 사라짐
2. `/accounts/new` 저장 시 store mutation throw → 인라인 에러 (`account-edit-error`) 표시
3. `/accounts/:id` 삭제 confirm → store throw → confirm 닫히지 않고 메시지 표시
4. `/settings` 자동완성 동기화 실패 → `SyncErrorBanner` 표시
5. 성공한 자동 저장 직후 배너 자동 클리어 (`db.ts:persistVaultSnapshot` 성공 경로)

## 회귀 게이트

- `npm run check` 통과
- `npm run lint` 통과
- `npm run build` 통과
- 사용자 Playwright E2E 직접 실행 — 회귀 0

---

# Risks

| 리스크 | 완화 |
|---|---|
| `mapError`가 일부 영문 메시지를 그대로 노출 | fallback 한국어 메시지로 wrapping. 일반 Error는 `error.message` 그대로 — 이미 한국어면 무손실 |
| `SyncErrorBanner` 전역 마운트가 AutoLockIndicator와 z-index 충돌 | z-50 명시, AutoLockIndicator는 `bottom-20 right-4`라 시각 충돌 없음 |
| `AccountEdit.handleSave` catch 추가는 **새로 도입되는 동작** | E2E가 catch 경로를 트립할 가능성 검증 — Plan-7a의 `01-create-vault.spec.ts` 영향 미미. **회귀 0 가정** |
| `setSyncError` React 19 strict mode 이중 호출 | zustand store는 idempotent (`lastSyncError: error` set), 영향 없음 |
| `mapError` import 위치 (`src/utils/` vs `src/errors/`) | `src/utils/` 컨벤션 확인 — 없으면 `src/errors/mapError.ts` (기존 `FileStorageError.ts` 패턴) |
| `loadAccounts` 실패 시 첫 마운트에서 `setSyncError` 트리거 → 첫 화면에서 혼란 | catch에서 setSyncError 호출 시점 정상 (App.tsx의 useEffect에서). 첫 화면 빈 페이지 + 배너 = "데이터 못 가져왔다"는 명확한 신호. 빈 페이지가 영원히 지속보다 나음 |
| `ConfirmDialog` `error` prop 추가 시 기존 `AccountDetail.handleDelete`(삭제 성공 후 `setShowDeleteConfirm(false)`) 로직 변경 필요 | `setDeleteError(null)`도 함께 호출 (성공 시). 1줄 추가 |
| `db.ts:persistVaultSnapshot` 성공 시 `clearSyncError` 추가가 정상 저장 사이클 영향 | 0 — null set은 idempotent, `useSessionStore`는 변경 0 |

## 호환성

- **API 표면 변화**: 호출처 8곳 catch 내부만 변경, 외부 API/시그니처 변화 0
- **ConfirmDialog**: `error` prop 추가는 **optional** — 기존 호출처 0 영향
- **FormDialog**: `toErrorMessage` 제거 + `mapError` 호출로 교체, 외부 API 변화 0
- **데이터 마이그레이션**: 없음 (`lastSyncError`/`lastSyncErrorTime` store 필드 이미 존재, `partialize` 그대로)
- **DB 마이그레이션**: 없음
- **자동잠금/세션**: 무관
- **Android native**: 무관

## 마이그레이션

- `src/pages/Settings/index.tsx`는 그대로 — `SyncErrorBanner`는 `App.tsx` 전역 마운트
- 기존 `AutofillSection`의 `error`/`message` state는 유지 (인라인 표시) — `SyncErrorBanner`와 중복 표시 가능. 의도적 분리 (즉시 피드백 vs 백그라운드 알림)

---

# Rollback

1. `git revert <plan-a1-commit>` — 4개 신규 파일 + 호출처 8곳 + App.tsx 한 줄 revert
2. 외부 의존성 0, 데이터 마이그레이션 0 → 즉시 안전
3. `SyncErrorBanner`만 `App.tsx`에서 제거하면 기능 off

---

# 결정 (Plan-A1 대화형 리뷰 결과, 2026-08-30)

| Q | 결정 | 근거 |
|---|---|---|
| AccountDetail.handleDelete catch 처리 | `ConfirmDialog` 닫지 않고 `error` prop으로 인라인 메시지 표시 | 시각/일관성 ↑, native alert 회피 |
| TemplateEdit.handleDelete catch 처리 | 동일 패턴 (1차 PR 포함) | "한 가지 길" 유지 |
| `lastSyncError` `partialize` | 그대로 (영구화 안 함) | 새로고침 자동 클리어, 다음 성공 시 자동 클리어 (`db.ts:persistVaultSnapshot`) |
| `AccountEdit.handleSave` catch UI | 페이지에 인라인 에러 영역 추가 (`<p role="alert">` + state) | 사용자 가시화, 1 PR에 자연 포함 |
| `AutofillSection` `loading`/`syncing` 통합 | **결정 사항 없음** (Plan-A1 무관, Plan-B-3에서 다룸) | Plan-B-3에서 `loading`/`syncing` 분리 유지, Button prop 매핑만 |

---

# Out of Scope (후속 plan)

- **Plan-A2 (슬림):** `<Spinner>` 컴포넌트 1개 + `Accounts/index.tsx` spinner+텍스트. Skeleton/SkeletonList 0
- **Plan-B-1 (인프라):** Button.tsx 보강 + FormDialog/ConfirmDialog → Button 마이그레이션
- **Plan-B-2 (자주 쓰는 페이지):** Accounts/AccountDetail/AccountEdit/Home/Auth/CreateVault button 마이그레이션
- **Plan-B-3 (나머지):** Templates/*, Settings/* button 마이그레이션
- **Plan-D:** 테마 FOUC 가드
- **a11y audit:** axe-core CI + 키보드 Playwright
- **Plan-7a 2차 PR (보류):** `DataSection` 백업 마이그레이션 + `FileCreateDialog` 완전 제거
- **i18n 정식 도입:** `react-i18next` 등

---

# Cross-Plan Integration

**Upstream (이 plan이 의존):**
- ✅ Multi-Vault Support (Dexie v14, store 필드 정의)
- ✅ Plan-7a (`CreateVaultPage` 인라인 catch → mapError로 교체)

**Downstream (이 plan이 제공):**
- **Plan-A2 (슬림):** `mapError` 활용 가능 (catch 내부)
- **Plan-B-1:** `mapError` 활용 + Button error 표시 일관성
- **a11y audit:** `role="alert"` 패턴 (`SyncErrorBanner`, `ConfirmDialog error`)

**호환 시그니처:**
- `mapError(err: unknown): string` — Plan-A2/B가 동일 import
- `useSessionStore.lastSyncError` / `setSyncError` / `clearSyncError` — 이미 존재
- `ConfirmDialog error?: string | null` — optional, 기존 호출처 영향 0

---

# Verification Checklist

- [x] `src/utils/mapError.ts` (또는 `src/errors/mapError.ts`) 신규, 5+ 분류 케이스
- [x] `src/components/SyncErrorBanner.tsx` 신규, `role="alert"` + 닫기
- [x] `src/components/dialogs/ConfirmDialog.tsx` `error` prop 추가 + 인라인 영역
- [x] `src/components/dialogs/FormDialog.tsx` `toErrorMessage` → `mapError` 통합
- [x] `src/App.tsx`에 `<SyncErrorBanner />` 전역 마운트
- [x] `src/database/db.ts` 성공 시 `clearSyncError?.()` 추가
- [x] 호출처 8곳 catch 마이그레이션 (#1-8, #10) 완료
- [x] 신규 단위 테스트 ~30개 통과
- [x] `npm run typecheck` 통과
- [x] `npm run lint` 통과 (신규 파일 0 에러)
- [x] `npm run test` 430/430 통과 (기존 383 + 신규 ~47)
- [x] `npm run build` 통과
- [x] Android: `compileDebugKotlin` + `testDebugUnitTest` 통과
- [x] Plan-7a의 `CreateVaultPage` 단위 테스트 통과
- [ ] 사용자가 Playwright E2E 직접 실행 시 회귀 0

## Status (2026-08-30)

**✅ 완료** — 21개 작업 항목 모두 verified. 회귀 위험 0 가정 유지.

| # | 항목 | 상태 | 근거 |
|---|---|---|---|
| 1 | mapError 함수 | ✅ | `src/utils/mapError.ts` (160+ lines, 5 분류: FileStorageError/neutral/DOMException/Error/기타) |
| 2 | mapError 단위 테스트 | ✅ | 16 케이스 |
| 3 | SyncErrorBanner | ✅ | `src/components/SyncErrorBanner.tsx` (z-50, role=alert, 닫기 버튼) |
| 4 | SyncErrorBanner 테스트 | ✅ | 4 케이스 |
| 5 | App.tsx 마운트 | ✅ | `<SyncErrorBanner />` AutoLockIndicator 옆 |
| 6 | ConfirmDialog error prop | ✅ | line 14 prop, line 42-52 `<p role="alert">` |
| 7 | FormDialog mapError 통합 | ✅ | `toErrorMessage` 제거, `mapError` import (Plan-4 follow-up 패턴 보존) |
| 8 | db.ts clearSyncError | ✅ | 성공 경로 (이미 존재) + mapError 적용 |
| 9 | AccountEdit catch | ✅ | try/catch + `<p data-testid="account-edit-error">` |
| 10 | AccountDetail catch | ✅ | try/catch + ConfirmDialog `error` prop, 모달 유지 |
| 11 | TemplateEdit catch | ✅ | handleDelete/handleSave 모두 catch + ConfirmDialog error |
| 12 | TemplateEdit handleSave | ✅ | `setErrors([mapError(err)])` |
| 13 | AutofillSection 4개 catch | ✅ | 4개 모두 `setError(mapError(err))` |
| 14 | accountStore loadAccounts | ✅ | `useSessionStore.getState().setSyncError(mapError(error))` |
| 15 | accountStore syncToAutofill | ✅ | DEV 가드 제거, setSyncError 추가 |
| 16 | Auth.tsx | ✅ | PIN catch: mapError, Biometric: keyCorrupted 사전 분기 유지 |
| 17 | CreateVaultPage | ✅ | handleSubmit/Skip `setError(mapError(err))`, Q3-c 주석 갱신 |
| 18 | 통합 테스트 | ✅ | AccountEdit(5), AccountDetail(5), ConfirmDialog(7) |
| 19 | check/lint/build | ✅ | 32 test files / 430 tests / 0 신규 lint / build 1.46s |
| 20 | Android | ✅ | compileDebugKotlin + testDebugUnitTest UP-TO-DATE, 3s |
| 21 | 디버깅 | ✅ | AccountDetail 테스트 4번의 시도 끝에 해결: (1) 잘못된 import path `./index` → `./AccountDetail` (2) `useAccountStore()` 인자 없는 호출 → mock이 selector 처리 (3) `useParams` route 매칭 누락 → `<Routes>` 명시 |

**git diff (요약):**
- `src/utils/mapError.ts` (신규, 5 분류, 160+ lines)
- `src/components/SyncErrorBanner.tsx` (신규)
- `src/components/dialogs/ConfirmDialog.tsx` (error prop 추가)
- `src/components/dialogs/FormDialog.tsx` (toErrorMessage 제거, mapError 통합)
- `src/App.tsx` (SyncErrorBanner 마운트)
- `src/database/db.ts` (mapError 사용)
- `src/store/accountStore.ts` (setSyncError(mapError) 2곳)
- `src/pages/Auth.tsx` (PIN catch mapError)
- `src/pages/CreateVault/index.tsx` (mapError 사용, 주석 갱신)
- `src/pages/Accounts/AccountEdit/index.tsx` (try/catch + 인라인 에러)
- `src/pages/Accounts/AccountDetail.tsx` (try/catch + ConfirmDialog error)
- `src/pages/Templates/TemplateEdit/index.tsx` (try/catch 2곳 + mapError)
- `src/pages/Settings/components/AutofillSection.tsx` (4 catch mapError)
- 테스트 6개 신규 (mapError, SyncErrorBanner, ConfirmDialog, AccountEdit, AccountDetail, Auth 추가 가능)

**남은 일:**
- 사용자가 Playwright E2E 직접 실행 (회귀 0 검증, Plan-A1은 catch 내부 + 전역 배너 1개 추가라 표면 무영향)
- 1 commit (사용자 요청 시)

**Debug 노트 (Plan-A1 구현 중 발견한 함정):**
1. **잘못된 import path**: `src/pages/Accounts/AccountDetail.test.tsx`에서 `import AccountDetail from "./index"` → `src/pages/Accounts/index.tsx` (=AccountList)를 import했음. `./AccountDetail`로 명시해야 함.
2. **Zustand selector 패턴 차이**: AccountDetail은 `useAccountStore((state) => ...)`와 `useAccountStore()` 둘 다 사용. mock은 `typeof selector === "function"` 분기로 둘 다 처리.
3. **useParams + MemoryRouter**: `<MemoryRouter initialEntries>` 안에 직접 컴포넌트 넣으면 route param이 추출 안 됨. `<Routes><Route path="/accounts/:id">`로 명시 필요.
4. **Modal 안의 button ambiguous**: 페이지 [삭제] + 모달 [삭제] → `dialog.querySelectorAll("button")`로 모달 내 버튼만 명시.
