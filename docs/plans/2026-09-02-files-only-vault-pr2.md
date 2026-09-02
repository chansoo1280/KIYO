# Plan — Files-Only Vault (PR 2: Test 갱신)

- Date: 2026-09-02
- Source: [`docs/plans/2026-09-02-files-only-vault-pr1.md`](./2026-09-02-files-only-vault-pr1.md) §"PR 2 — Test 갱신" (Q20 결정)
- 선행: PR 1 (Files-Only Vault 진입점 도입) — ✅ production code 변경 완료
- Worktree: `feat/vault-integrity` (base `origin/dev`)
- 의존: 없음

---

# Goal

PR 1에서 변경된 production API에 맞춰 **기존 테스트를 새 아키텍처로 마이그레이션**. PR 1 범위 밖이었던 test 갱신을 단일 PR로 처리:

1. **4개 integration test 갱신** — `db.metadata.clear/bulkPut` 호출부 제거, `db.settings.clear` 제거, `replaceDatabaseData` signature 단순화, `syncQueue` import 제거
2. **2개 page mock 갱신** — `AccountList.test.tsx`, `RootRedirect.test.tsx` — 옛 `loadAccounts`/`loadTemplates` mock → 새 `loadVaultToStores` mock + `useSessionStore.initialized` selector
3. **useFileAuthGuard.test.tsx 갱신** — 제거된 `onInitialized`/`skipRedirect` 파라미터 mock 정리
4. **JSON 호환 invariant 검증 테스트 추가** — 평문/암호화 vault JSON이 새 API로도 정확히 파싱되는지 검증 (파일 형식 hard constraint)

---

# Hard Constraint

`KiyoVaultData` JSON 스키마는 **변경 0**:
- `version: 1` / `fileName: string` / `updatedAt: number` / `accounts: Account[]` / `templates: Template[]` / `metadata: FileMetadata[]`
- `EncryptedKiyoVaultData` 4 필드 그대로
- 기존 사용자 vault 파일이 그대로 읽혀야 함

PR 2가 끝나면:
- `npm run typecheck` ✅ 통과
- `npm run lint` ✅ 통과
- `npm run test` ✅ 통과 (4개 integration + 2개 page mock + useFileAuthGuard + JSON compat test)

---

# Current State (PR 1 이후)

## 삭제된 모듈
- `src/database/accountTable.ts` ✅
- `src/database/templateTable.ts` ✅
- `src/database/syncQueue.ts` ✅
- `src/crypto/recordEncryption.ts` ✅

## 새 진입점 (production)
- `loadVaultToStores(decrypted: KiyoVaultData)` — fileStorage.ts
- `activatePlaintextVault(fileName: string)` — fileStorage.ts
- `saveStoresToFile()` — fileStorage.ts
- `buildSnapshotFromStores(fileName)` — fileStorage.ts

## 새 store API
- `useAccountStore.init(accounts)` / `getAll()` / CRUD 5개 (메모리 set + saveStoresToFile)
- `useTemplateStore.init(templates)` / `getAll()` / CRUD 4개
- `useMetadataStore.init(metadata)` / `getAll()` / `upsert` / `clearMetadata`
- `useSessionStore.initialized: boolean` (Q16 — 3개 store의 initialized 통합)

## 제거된 store API
- ❌ `loadAccounts` / `loadTemplates`
- ❌ `isLoading` flag (각 store)
- ❌ `initialized` flag (각 store)
- ❌ `_persistAccounts` / `enqueuePersistVaultSnapshot`

## 현재 test 실패 (Q20)
| 파일 | 실패 원인 |
|---|---|
| `src/database/fileStorage.lifecycle.integration.test.ts` | `accountTable`/`templateTable`/`syncQueue` import, `db.metadata/settings` 접근 |
| `src/database/fileStorage.encryption.integration.test.ts` | 동일 |
| `src/database/fileStorage.changePin.integration.test.ts` | 동일 |
| `src/database/fileStorage.error.integration.test.ts` | `exportDataFile` 미존재 |
| `src/database/fileTable.integration.test.ts` | `db.metadata/settings` 접근 |
| `src/pages/Accounts/AccountList.test.tsx` | `isLoading`/`initialized` selector 없음 |
| `src/pages/RootRedirect.test.tsx` | 동일 |
| `src/hooks/useFileAuthGuard.test.tsx` | `{ onInitialized }` / `{ skipRedirect }` 인자 제거됨 |
| `src/hooks/useAutoLock.test.tsx` | `SessionState.initialized` 추가됨 |
| `src/pages/Settings/components/DataSection.tsx` | `persistVaultSnapshot` import — production caller 수정 필요 |
| `src/pages/Templates/TemplateEdit/index.tsx` | 옛 `initialized`/`loadTemplates`/`createTemplate` selector |
| `src/pages/Settings/index.tsx` / `Templates/index.tsx` / `AccountEdit/index.tsx` / `AccountDetail.tsx` | `useFileAuthGuard({...})` 인자 제거됨 |
| `src/test/fixtures/databaseFixtures.ts` | `FileMetadata` import from `@/models/account` (이동됨) |

---

# Implementation Steps

## Step 1: Settings DataSection — production caller 수정

**파일**: `src/pages/Settings/components/DataSection.tsx`

`persistVaultSnapshot` import 제거. `backupDataFile(fileName, pin?)` 직접 호출로 변경.

**Invariant**: 기존 production 1건 사용처 (Q18 결정) — `backupDataFile`이 `buildSnapshotFromStores` helper 사용. Settings 페이지에서 변경.

## Step 2: Templates TemplateEdit — 옛 selector 제거

**파일**: `src/pages/Templates/TemplateEdit/index.tsx`

- `useTemplateStore((s) => s.initialized)` 제거
- `useTemplateStore((s) => s.loadTemplates)` 제거
- `useTemplateStore((s) => s.createTemplate)` → `useTemplateStore((s) => s.addTemplate)` rename

**Invariant**: `addTemplate`은 PR 1에서 `createTemplate`을 대체 (메모리 set + saveStoresToFile).

## Step 3: databaseFixtures — FileMetadata import 경로 수정

**파일**: `src/test/fixtures/databaseFixtures.ts`

`FileMetadata` import를 `@/models/account` → `@/models/vault`로 변경 (PR 1에서 이동).

## Step 4: useFileAuthGuard.test.tsx — 새 시그니처 반영

**파일**: `src/hooks/useFileAuthGuard.test.tsx`

- 모든 `useFileAuthGuard({ onInitialized: ... })` / `useFileAuthGuard({ skipRedirect: false })` / `useFileAuthGuard({})` → `useFileAuthGuard()`로 변경
- 9개 test case 검토: `onInitialized` 콜백 시나리오 제거 (Q16에서 `useFileAuthGuard`는 단순 redirect 가드만)
- `skipRedirect` 분기 제거 — production 코드에서도 제거됨

## Step 5: AccountList.test.tsx — 새 store API 반영

**파일**: `src/pages/Accounts/AccountList.test.tsx`

- store mock에 `init()`, `getAll()` 추가
- `useAccountStore((s) => s.initialized)` → `useSessionStore((s) => s.initialized)`로 변경
- `useAccountStore((s) => s.isLoading)` → 제거 (Q16)
- 새 진입점 `loadVaultToStores` mock으로 전환 고려 — 현재 AccountList는 `useFileAuthGuard`로 self-load 흡수되므로 mock 변경 불필요할 수 있음

## Step 6: RootRedirect.test.tsx — 새 진입점 mock

**파일**: `src/pages/RootRedirect.test.tsx`

- `mockLoadAccounts` / `mockLoadTemplates` → 제거 (Q16)
- `mockLoadVaultToStores` (fileStorage mock) 추가
- `isLoading` / `initialized` store selector 사용 제거
- `useSessionStore((s) => s.initialized)` selector로 통합
- 12개 test case 검토 — preload timeout 재시도 로직, store-not-ready 가드 모두 새 진입점에서 동작

## Step 7: fileStorage lifecycle integration test — 마이그레이션

**파일**: `src/database/fileStorage.lifecycle.integration.test.ts` (가장 큰 파일, ~750줄)

변경 사항:
- `db.accounts` / `db.templates` / `db.metadata` / `db.settings` 접근 → 제거
- `accountTable.create/update/delete/clear` → `useAccountStore.getState().addAccount/updateAccount/deleteAccount/clearAccounts`
- `templateTable.create/update/delete/clear` → `useTemplateStore.getState().addTemplate/updateTemplate/deleteTemplate/clearTemplates`
- `accountTable.initializeDevData` → 제거 (PR 1에서 dev seed는 `createDataFile` 내부로 이동)
- `syncQueue.enqueuePersistVaultSnapshot` → 제거 (PR 1에서 `saveStoresToFile`이 직접 호출)
- `db.metadata.toArray` / `db.metadata.put` / `db.metadata.clear` → 제거
- `replaceDatabaseData` → `loadVaultToStores` + `saveStoresToFile`
- `getDatabaseSnapshot` → `buildSnapshotFromStores`

**Test invariant 검증**:
- "평문 vault 생성 → store 메모리 + db.files 동기화"
- "암호화 vault 생성 → store 메모리 + db.files (encrypted)"
- "createDataFile 후 saveStoresToFile → memory와 file 일치"
- "unlockFile (encrypted) → loadVaultToStores 자동 호출"
- "changePin → saveStoresToFile로 새 키 + 새 salt로 재암호화"
- "closeDataFile → store 3개 clear + session clear"

## Step 8: fileStorage encryption integration test — 마이그레이션

**파일**: `src/database/fileStorage.encryption.integration.test.ts`

변경 사항:
- `accountTable` / `templateTable` import 제거
- `db.metadata.toArray` / `db.metadata.put` 제거
- `replaceDatabaseData` → `loadVaultToStores`
- 암호화 → 복호화 round-trip test는 **JSON 호환 invariant 검증**으로 강화

**새 추가 test**: "PR 1 이전 vault JSON 파일 형식이 새 API로도 정확히 파싱된다" — 정적 fixture JSON (평문/암호화) load → store 메모리 검증

## Step 9: fileStorage changePin integration test — 마이그레이션

**파일**: `src/database/fileStorage.changePin.integration.test.ts`

변경 사항:
- `accountTable` / `templateTable` / `db.metadata` / `db.settings` 접근 → 제거
- `syncQueue` import 제거
- `replaceDatabaseData` → `saveStoresToFile` (load 없음)
- "changePin 후 unlockFile (new pin) → 동일한 store 상태" invariant

## Step 10: fileStorage error integration test — 마이그레이션

**파일**: `src/database/fileStorage.error.integration.test.ts`

변경 사항:
- `exportDataFile` → `exportBackupFile` (이름 변경 확인 필요)
- 에러 코드 매핑 유지

## Step 11: fileTable integration test — 마이그레이션

**파일**: `src/database/fileTable.integration.test.ts`

변경 사항:
- `db.metadata` / `db.settings` clear 검증 → 제거
- `db.files` 단일 테이블 검증으로 단순화
- PK = fileName, salt/encrypted/createdAt/updatedAt 필드 검증은 유지

## Step 12: useAutoLock.test.tsx — SessionState.initialized 추가

**파일**: `src/hooks/useAutoLock.test.tsx`

`SessionState` mock에 `initialized: false` 추가 (Q16).

## Step 13: JSON 호환 invariant 신규 테스트

**신규 파일**: `src/database/fileStorage.jsonCompat.integration.test.ts`

테스트 케이스:
1. PR 1 이전 형식 평문 JSON → `loadVaultToStores(parsed)` → 3개 store 정확히 채워짐
2. PR 1 이전 형식 암호화 JSON → `loadVaultToStores(decrypt(parsed))` → 3개 store 정확히 채워짐
3. `buildSnapshotFromStores` 결과 JSON이 PR 1 이전 형식과 호환 (`version`, `fileName`, `updatedAt`, `accounts`, `templates`, `metadata` 필드 모두 보존)
4. `saveStoresToFile` 후 `fileTable.getFileInfo`로 round-trip → JSON.parse 결과 동일

이 테스트가 깨지면 **기존 사용자 vault 파일이 호환되지 않는다는 의미** — hard constraint 검증.

---

# Verification

```bash
npm run typecheck   # 모든 src 파일 typecheck 통과
npm run lint        # ESLint 통과
npm run test        # vitest 모든 suite 통과
```

## Checkpoint
- [ ] Step 1: Settings DataSection production caller 수정
- [ ] Step 2: Templates TemplateEdit selector 갱신
- [ ] Step 3: databaseFixtures FileMetadata import 경로
- [ ] Step 4: useFileAuthGuard.test.tsx 새 시그니처
- [ ] Step 5: AccountList.test.tsx store mock
- [ ] Step 6: RootRedirect.test.tsx loadVaultToStores mock
- [ ] Step 7: fileStorage.lifecycle.integration.test.ts
- [ ] Step 8: fileStorage.encryption.integration.test.ts
- [ ] Step 9: fileStorage.changePin.integration.test.ts
- [ ] Step 10: fileStorage.error.integration.test.ts
- [ ] Step 11: fileTable.integration.test.ts
- [ ] Step 12: useAutoLock.test.tsx SessionState.initialized
- [ ] Step 13: JSON compat invariant test (신규)
- [ ] `npm run typecheck` ✅
- [ ] `npm run lint` ✅
- [ ] `npm run test` ✅

---

# Risk

| Risk | Mitigation |
|---|---|
| `replaceDatabaseData` 테스트 의존도가 높아 단순화 시 invariant 누락 가능 | Step 13 JSON compat test가 hard constraint 보장 |
| 옛 test의 mock 구조가 새 store API와 1:1 매칭되지 않을 수 있음 (예: `addAccount`이 `id` 자동 할당) | mock은 store interface 그대로 따르도록 type-safe |
| `nextAccountId` 동적 할당 (Q15) test invariant — store CRUD가 정확히 작동하는지 | Step 7에서 createDataFile + addAccount 시퀀스 검증 |
| E2E test는 user-driven — PR 2는 unit/integration만 처리 | (PR 1과 동일 정책) |

---

# Out of Scope (별도 PR)

- PR 3 — Openwiki/STRATEGY.md 문서 갱신
- Android 측 마이그레이션 (별도 plan, kiyo_secure_master_key 분리 결정 후)
- E2E Playwright/Android test 갱신 (user가 직접 실행)
- `passwordGenerator` slider 등 Plan-F1~F2 후속 (PR 1과 무관)
