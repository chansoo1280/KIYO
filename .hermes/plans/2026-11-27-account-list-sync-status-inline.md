# Plan — 계정 리스트 페이지 동기화 상태 인라인 표시 (FR-4.5)

- Date: 2026-11-27
- Worktree: `dev` (base `origin/dev`)
- Spec ref: `.hermes/specs/ui-ux/specification.md` (FR-4.5 저장 상태 안내 - 자동 저장)
- Scope: **계정 리스트 페이지(`Accounts/index.tsx`)에만** 동기화 상태 인라인 메시지 표시 (`autoBackupEnabled` 활성화 시에만)
- Status: **Planning**

---

## 1. Goal

계정 리스트 페이지(`Accounts/index.tsx`)에서 계정 생성·수정·삭제 시, `autoBackupEnabled` 설정이 활성화된 경우에만 동기화 상태(`동기화중…` / `동기화됨` / `동기화 실패`)를 **인라인 메시지**로 표시하여 사용자가 데이터 persistence 상태를 항상 인지할 수 있도록 한다.

> 스펙 문서(`.hermes/specs/ui-ux/specification.md`) FR-4.5: "앱은 `autoBackupEnabled` 설정이 활성화된 경우에만 '동기화중…' / '동기화됨' / '동기화 실패'를 인라인 메시지로 명시적으로 표시하며, '동기화됨' 메시지는 일정 시간 후 자동으로 사라진다. `autoBackupEnabled`가 비활성화된 경우 인라인 메시지를 표시하지 않는다."

---

## 2. Current State

### 2.1 Zustand Store (`src/store/accountStore.ts`)

- `accounts` 배열, `init`, `getAll`, `addAccount`, `updateAccount`, `deleteAccount`, `clearAccounts`, `syncToAutofill`, `getAutofillAccounts` 제공
- **동기화 상태(`syncStatus`) 필드 없음** — 자동 저장/동기화 진행/완료/실패 상태를 추적할 수 없음
- 각 CRUD 연산 후 `requestSave()` 호출로 자동 저장 트리거

### 2.2 앱 설정 (`src/store/settingsStore.ts`)

- `autoBackupEnabled: boolean` 필드 존재 — 자동 백업(외부 파일 미러링) 활성화 여부
- **자동 저장(계정/템플릿 수정 시 즉시 파일 저장)은 항상 수행**되며, `autoBackupEnabled`는 외부 파일 백업 여부만 제어
- `autoBackupEnabled`가 `false`인 경우에도 계정/템플릿 CRUD 후 `requestSave()`는 호출됨

### 2.3 자동 저장/동기화 흐름 (`src/persistence/vaultPersistence.ts` + `src/persistence/persistencePort.ts`)

- `persistencePort.registerSaveHandler()`로 `vaultPersistence.ts`의 `handleSave`가 등록됨
- `requestSave()` → `handleSave()` → `saveVault()` → `fileTable.upsertFileRecord()` 순으로 Dexie IndexedDB에 upsert
- `saveVault` 성공/실패는 현재 UI에 반영되지 않음

### 2.4 계정 리스트 페이지 (`src/pages/Accounts/index.tsx`)

- 계정 목록, 검색, 태그 필터, 정렬, 템플릿 선택 모달(`TemplatePicker`) 구현됨
- 상단 헤더 영역에 "계정 불러오는 중…" 스피너(`Spinner`)가 초기 로딩 시 표시됨
- **동기화 상태 인라인 메시지 영역 없음** — 계정 CRUD 후 동기화 진행/완료/실패 여부를 사용자가 인지할 수 없음

### 2.5 관련 컴포넌트

| 컴포넌트 | 경로 | 역할 |
|----------|------|------|
| Spinner | `src/components/feedback/Spinner.tsx` | 로딩 상태 표시 (초기 로딩용) |
| SyncErrorBanner | `src/components/SyncErrorBanner.tsx` | Autofill 동기화 에러 배너 (계정 리스트 동기화 상태와는 별도) |
| Button | `src/components/Button.tsx` | 공통 버튼 컴포넌트 |

---

## 3. Relevant Files

| 파일 | 역할 | 변경 필요성 |
|------|------|-------------|
| `src/store/accountStore.ts` | Zustand store, 계정 CRUD 및 자동 저장 연동 | **높음** — `syncStatus`, `syncError` 필드 신규 추가, CRUD 연산에서 동기화 상태 제어 |
| `src/store/settingsStore.ts` | 앱 설정 (`autoBackupEnabled` 등) | **높음** — `autoBackupEnabled`를 참조하여 표시 여부 결정 |
| `src/pages/Accounts/index.tsx` | 계정 리스트 페이지 UI | **높음** — `autoBackupEnabled`가 `true`일 때만 동기화 상태 인라인 메시지 영역 신규 추가 |
| `src/persistence/persistencePort.ts` | Store → Coordinator 인터페이스 (`requestSave`) | 낮음 — 기존 인터페이스 그대로 사용 |
| `src/persistence/vaultPersistence.ts` | Persistence Coordinator 실제 구현 (`saveVault`) | 낮음 — 기존 로직 그대로 사용, 에러 전파만 활용 |
| `src/store/sessionStore.ts` | 세션 상태 (`partialize` 등) | 없음 — 관련 없음 |

---

## 4. Architecture / Data Flow

```text
사용자 계정 CRUD (addAccount/updateAccount/deleteAccount/clearAccounts)
    │
    ├─▶ useSettingsStore.getState().autoBackupEnabled 확인
    │       ├─ false → 동기화 상태 표시 생략, CRUD만 처리
    │       └─ true  → 다음 단계로 진행
    │
    ├─▶ useAccountStore.set({ syncStatus: 'syncing', syncError: null })
    │
    ├─▶ requestSave()  (persistencePort)
    │       │
    │       ├─▶ vaultPersistence.handleSave()
    │       │       └─▶ saveVault() → fileTable.upsertFileRecord()
    │       │               │
    │       │               ├─▶ 성공 → set({ syncStatus: 'synced', syncError: null })
    │       │               │           └─▶ 3초 후 set({ syncStatus: 'idle' })
    │       │               │
    │       │               └─▶ 실패 → set({ syncStatus: 'failed', syncError: <에러 메시지> })
    │
    └─▶ UI: autoBackupEnabled=true이고 syncStatus에 따라 인라인 메시지 표시
```

---

## 5. Proposed Changes

### 5.1 `src/store/accountStore.ts` — Zustand store 상태 및 로직 추가

**신규 상태 필드:**
- `syncStatus: 'idle' | 'syncing' | 'synced' | 'failed'` — 동기화 상태
- `syncError: string | null` — 동기화 실패 시 에러 메시지

**수정할 연산:**
- `addAccount`: 호출 전 `set({ syncStatus: 'syncing' })`, `requestSave()` 완료 후 `synced`, 실패 시 `failed`
- `updateAccount`: 동일
- `deleteAccount`: 동일
- `clearAccounts`: 동일

**`synced` → `idle` 자동 해제:**
- `syncStatus === 'synced'` 상태에서 3초 후 `set({ syncStatus: 'idle' })` (setTimeout 사용)

### 5.2 `src/pages/Accounts/index.tsx` — 인라인 메시지 UI 추가

**표시 조건:** `useSettingsStore((state) => state.autoBackupEnabled)`가 `true`인 경우에만 표시

**표시 위치:** PageShell 내부, 헤더 아래, 검색/태그 필터 위

**메시지별 스타일:**
| syncStatus | 메시지 | 스타일 |
|------------|--------|--------|
| `syncing` | "동기화중…" | 회색/파란색, 작게 |
| `synced` | "동기화됨" | 녹색, 3초 후 자동 사라짐 |
| `failed` | "동기화 실패: {에러 메시지}" | 빨간색, "다시 시도" 버튼 (클릭 시 해당 CRUD 재실행) |

**UI 구조 예시:**
```tsx
{autoBackupEnabled && syncStatus === 'syncing' && (
  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-2">
    <Spinner size="sm" /> 동기화중…
  </div>
)}
{autoBackupEnabled && syncStatus === 'synced' && (
  <div className="flex items-center gap-2 text-xs text-[var(--color-success)] mb-2">
    동기화됨
  </div>
)}
{autoBackupEnabled && syncStatus === 'failed' && (
  <div className="flex items-center gap-2 text-xs text-[var(--color-error)] mb-2">
    동기화 실패: {syncError}
    <Button size="sm" onClick={retryLastOperation}>다시 시도</Button>
  </div>
)}
```

---

## 6. Tests / Validation

| 테스트 | 대상 | 명령어 |
|--------|------|--------|
| TypeScript 타입 체크 | 전체 프로젝트 | `npm run typecheck` |
| ESLint | 전체 프로젝트 | `npm run lint` |
| Vitest 단위/통합 테스트 | 전체 프로젝트 | `npm run test` |
| 수동 검증 | `autoBackupEnabled` 켬/끔에 따른 표시 여부 확인 | 브라우저에서 설정 토글 변경 후 계정 생성/수정/삭제 시 인라인 메시지 표시 여부 확인 |

---

## 7. Risks / Tradeoffs / Open Questions

| 위험 | 완화 |
|------|------|
| `autoBackupEnabled`가 `false`인 경우 동기화 상태를 전혀 표시하지 않음 | 스펙 요구사항에 의함 (설정 기반 표시) |
| `syncStatus`가 여러 CRUD 연산 간 경합 상태 생성 | 계정 리스트 페이지는 단일 페이지이므로 연쇄 호출 가능성 낮음. 마지막 연산의 상태만 유지 |
| "실패" 시 사용자가 어떤 작업을 재시도해야 하는지 모호함 | 에러 메시지에 작업 유형 포함, "다시 시도" 버튼으로 해당 연산 재실행 |
| `syncStatus`가 페이지 언로드 후 잔존 | 페이지 언로드 시 Zustand store가 재생성되므로 자동 초기화 |

---

## 8. Rollback

- `src/store/accountStore.ts`에서 `syncStatus`, `syncError` 필드 제거 및 CRUD 연산 원상복구
- `src/pages/Accounts/index.tsx`에서 인라인 메시지 UI 제거
- DB 스키마 변경 없음 → 마이그레이션 불필요

---

## 9. Implementation Order

| 순서 | 작업 | 예상 소요 |
|------|------|-----------|
| 1 | `src/store/accountStore.ts`에 `syncStatus`, `syncError` 필드 추가 | 10분 |
| 2 | `addAccount`/`updateAccount`/`deleteAccount`/`clearAccounts`에서 동기화 상태 제어 로직 추가 | 15분 |
| 3 | `synced` 상태에서 3초 후 `idle`로 자동 복귀 (setTimeout) | 10분 |
| 4 | `src/pages/Accounts/index.tsx`에 `autoBackupEnabled` 조건부 인라인 메시지 UI 추가 | 15분 |
| 5 | `npm run typecheck`, `npm run lint`, `npm run test` 실행 및 통과 확인 | 10분 |

---

## 10. Open Questions

| 항목 | 현황 |
|------|------|
| "실패" 시 "다시 시도" 버튼 클릭 시 어떤 연산을 재실행할지 | 사용자가 마지막으로 수행한 CRUD 연산을 추적해야 함 (예: 마지막 연산 타입 저장) |
| "동기화됨" 메시지 자동 사라짐 시간 | 3초 (임시, 추후 조정 가능) |
| `autoBackupEnabled`가 `false`인 경우에도 "저장 완료"를 보여줄지 여부 | 현재 스펙은 `autoBackupEnabled`가 `true`일 때만 표시 |

---

## 11. Output

- Plan 문서: `.hermes/plans/2026-11-27-account-list-sync-status-inline.md` (본 문서)
- 코드 변경: `src/store/accountStore.ts`, `src/pages/Accounts/index.tsx`
- 검증: `npm run typecheck`, `npm run lint`, `npm run test` 모두 통과
- 스펙 문서: `.hermes/specs/ui-ux/specification.md` FR-4.5 이미 업데이트 완료 (`autoBackupEnabled` 조건부 표시)
