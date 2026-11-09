# Plan — Files-Only Vault (PR 1: 진입점 도입 + record 모듈 정리)

- Date: 2026-09-02
- **업데이트 (2026-09-02, ce-plan-review 보정):** 10개 finding 패치 적용 + 1개 추가 보정 (mid-flight `backupDataFile` 호출처 발견: `Settings/DataSection.tsx:54` — production 1건 사용 확인, plan의 "0건" claim 수정). Auth.tsx + 5개 페이지 + Settings/DataSection caller 추가, Q15/Q16/Q17 결정 추가, backupDataFile 재작성 결정 (PR 1에서 유지), line 6 링크 오타 수정. **코드 변경 0** (문서 보정만).
- Source: [`docs/brainstorms/2026-09-02-files-only-vault.md`](../brainstorms/2026-09-02-files-only-vault.md) §3.6, §7
- Worktree: `feat/vault-integrity` (base `origin/dev`)
- 선행: [`docs/plans/2026-08-30-multi-vault-support.md`](./2026-08-30-multi-vault-support.md) ✅ (`afff2e1f`)
- 의존: 없음
- 결정: 사용자 확정 (메시지 provenance §10 brainstorm 참조)
  - Q1=A record 테이블 완전 제거
  - Q2=a syncQueue 제거
  - Q5=✅ db.metadata 정리 (테이블 drop, JSON 스키마는 유지)
  - Q6=✅ db.settings 정리 (dead table drop + AppSettings 타입 정리)
  - 추가: store는 `init(data)`/`getAll()` API + `metadataStore` 신규 + `loadAccounts`/`loadTemplates` 삭제 (메시지 9)

---

# Goal

**PR 1 완료 시 다음이 참:**

- `db.accounts` / `db.templates` / `db.metadata` / `db.settings` 테이블 — Dexie schema에서 완전 제거 (v15 drop)
- `accountTable.ts` / `templateTable.ts` / `recordEncryption.ts` / `syncQueue.ts` / `getDatabaseSnapshot` / `replaceDatabaseData` / `initializeDatabase` — **모두 삭제**
- 새 진입점 함수 3개 도입:
  - `loadVaultToStores(decrypted: KiyoVaultData)` — caller가 미리 확보한 `decrypted`를 받아 store 3개에 `init()` 호출. 내부 `getFileInfo`/`decryptData` 호출 0.
  - `activatePlaintextVault(fileName: string)` — Home plaintext 진입 wrapper (`getFileInfo` + `setSession` + `loadVaultToStores`)
  - `saveStoresToFile()` — store 3개의 `getAll()`로 snapshot 구성 + encrypt + `fileTable.upsertFileRecord`
- store 재정의:
  - `useAccountStore` — `init(accounts)` / `getAll()` 추가, `loadAccounts` 삭제, CRUD 5개는 메모리 set + `saveStoresToFile`
  - `useTemplateStore` — `init(templates)` / `getAll()` 추가, `loadTemplates` 삭제, CRUD 4개 동일
  - `useMetadataStore` (신규) — `init(metadata)` / `getAll()` 만
- caller 마이그레이션:
  - `unlockFile` / `openImportedDataFile` (encrypted+plaintext) — `decryptVaultData`/`parseFileData` 결과 → `loadVaultToStores(decrypted)`
  - `Home.handleSelectFile` plaintext 분기 → `activatePlaintextVault(fileName)` + `navigate("/accounts")`
  - `RootRedirect.initializeStores` → `loadVaultToStores(info.fileData)` (effect 1에서 setSession 보강)
  - `useFileAuthGuard.onInitialized` → `loadVaultToStores` 호출
  - **`Auth.handleBiometricLogin`** → `setCryptoKeyFromBase64` + `loadVaultToStores(decrypted)` (생체인증 unlock 경로)
  - **`AccountList`/`AccountEdit`/`TemplatePicker`/`Templates`** 페이지의 store 직접 호출 `loadAccounts`/`loadTemplates` 제거 — `useFileAuthGuard.onInitialized`만 사용
  - `createDataFile` — store 직접 set (dev seed + builtin) → `saveStoresToFile` (load 없음)
  - `changePin` — `getFileInfo` + `setSession(newKey)` + `saveStoresToFile` (load 없음)
- `KiyoVaultData` JSON 스키마 **불변** (hard constraint):
  - `version: 1` / `fileName: string` / `updatedAt: number` / `accounts: Account[]` / `templates: Template[]` / `metadata: FileMetadata[]`
  - `EncryptedKiyoVaultData` 4 필드 그대로
  - 외부 export/import 무변경

**PR 1 범위 밖** (별도 PR 또는 후속):
- PR 2 — Test 갱신 (lifecycle/encryption/changePin integration + AccountList/RootRedirect page mock)
- PR 3 — Openwiki/STRATEGY 문서 갱신

---

# Current State (2026-09-02 인스펙션)

## DB / store / crypto

| 항목 | 위치 | 메모 |
|---|---|---|
| Dexie schema (5 테이블) | `src/database/db.ts:28-83` | v13, v14 마이그레이션 누적. **v15 = accounts/templates/metadata/settings 4개 drop** 예정 |
| Record table API | `src/database/accountTable.ts:1-218` (218줄), `src/database/templateTable.ts:1-161` (161줄) | CRUD 11개 메서드 + `initializeDevData`. 모두 `db.accounts`/`db.templates` 직접 접근 |
| Record 암호화 | `src/crypto/recordEncryption.ts:1-152` (152줄) | `encryptRecord`/`decryptRecord`/`createEncryptedRecord`/`createPlaintextRecord`/`updateEncryptedRecord`/`isEncryptedRecord`/`generateUUID` |
| Snapshot builder | `src/database/db.ts:88-107` (`getDatabaseSnapshot`) | `accountTable.getAll + templateTable.getAll + db.metadata.toArray` → JSON |
| Replace data | `src/database/db.ts:194-284` (`replaceDatabaseData`) | 91줄, **6 호출처** (`unlockFile`, `openImportedDataFile` ×2, `changePin`, `Home`, `replaceDatabaseData` 내부 생성 메서드) |
| Sync queue | `src/database/syncQueue.ts:1-49` (49줄) | `enqueuePersistVaultSnapshot`/`waitForQueueDrain`/`getQueueLength`/`isQueueProcessing` |
| Initialize helper | `src/database/db.ts:286-303` (`initializeDatabase`) | `{id:1, version:"1.0.0", createdAt}` row put — **db.metadata가 사라지면 dead** |
| Account store | `src/store/accountStore.ts:30-228` | CRUD 5 + `loadAccounts` + `_persistAccounts` + `syncToAutofill` + `getAutofillAccounts` |
| Template store | `src/store/templateStore.ts:20-133` | CRUD 4 + `loadTemplates` |
| Settings store | `src/store/settingsStore.ts:1-126` | zustand `persist` (localStorage) — **변경 없음** (PR 1 범위 밖) |
| Metadata store | (없음) | `KiyoVaultData.metadata: FileMetadata[]` 보관처 없음. **신규 추가 필요** |

## 파일 호출처 (cross-check 완료)

| 호출 | 파일:line | 현재 → 목표 |
|---|---|---|
| `unlockFile` | `fileStorage.ts:215-260` | replaceDatabaseData → loadVaultToStores(decrypted) |
| `openImportedDataFile` encrypted | `fileStorage.ts:457-468` | replaceDatabaseData → loadVaultToStores(decryptedVaultData) |
| `openImportedDataFile` plaintext | `fileStorage.ts:402-410` | replaceDatabaseData → loadVaultToStores(parsedData) |
| `changePin` | `fileStorage.ts:483-512` | replaceDatabaseData → saveStoresToFile (load 없음) |
| `createDataFile` | `fileStorage.ts:268-338` | persistVaultRecord + initializeStores → saveStoresToFile만 (load 없음) |
| `Home.handleSelectFile` plaintext | `Home.tsx:41-58` | replaceDatabaseData + initializeStores → activatePlaintextVault |
| `RootRedirect.initializeStores` | `RootRedirect.tsx:107-166` | initializeStores → loadVaultToStores(info.fileData) + setSession 보강 |
| `useFileAuthGuard.onInitialized` | `useFileAuthGuard.ts:32-69` | caller 자유 → loadVaultToStores 호출 |
| `accountTable.create` ×6 | `fileStorage.ts:284,313,278` | → store action 직접 호출 |
| `templateTable.create` ×2 | `fileStorage.ts:284,313` | → store action 직접 호출 |
| `db.metadata.clear` ×2 | `fileStorage.ts:196`, `db.ts:272,280,299` | → 삭제 |

## store 사용처 (loadAccounts/loadTemplates/initializeStores grep 완료)

| 호출처 | 사용 메서드 | 영향 |
|---|---|---|
| `src/pages/Accounts/index.tsx:18-19,30-37` | `loadAccounts`, `useFileAuthGuard({ onInitialized: loadAccounts })` | `loadAccounts` 직접 호출 제거. `onInitialized`도 정리 (`loadVaultToStores`로 흡수) |
| `src/pages/Accounts/AccountEdit/index.tsx:26,32,37` | `loadTemplates`, `useFileAuthGuard({ skipRedirect: false })` | 동일 |
| `src/pages/Accounts/components/TemplatePicker.tsx:25,29` | `loadTemplates` | `loadTemplates` 직접 호출 제거 — mount 시 `useTemplateStore.getState().templates`로 충분 (이미 loaded 가정) |
| `src/pages/Templates/index.tsx:11,15-18` | `loadTemplates`, `isLoading`, `useFileAuthGuard({ onInitialized: loadTemplates })` | `loadTemplates` + `isLoading` selector 제거 (Q16 — UX 정책 결정) |
| `src/pages/RootRedirect.tsx:47-48,124,166` | `loadAccounts`, `loadTemplates`, `initializeStores` | `loadAccounts`/`loadTemplates` selector 제거, `initializeStores` → `loadVaultToStores(info.fileData)` |
| `src/pages/Auth.tsx:108-122` | `SecureKey.unlockKeyWithBiometric` + `setCryptoKeyFromBase64` + `initializeStores` | **인증 critical — store 직접 호출 없음, `initializeStores`만 `loadVaultToStores`로 교체**. `decrypted`는 cryptoKey set 후 session에서 확보 (자세한 시퀀스는 Step 9 참조) |
| `src/hooks/useFileAuthGuard.ts:25-69` | `useFileAuthGuard` hook | hook 자체는 유지하되 `onInitialized` 시그니처는 (caller가 decrypted를 어디서 가져오는지 모름) — Step 9에서 hook 내부 helper로 흡수 또는 caller별 처리 |
| `src/database/fileStorage.ts:123-127,258,292,321` | `initializeStores` 함수 + 3 호출처 | Step 6에서 함수 삭제 (loadVaultToStores가 흡수) |

---

# Relevant Files (PR 1 변경 대상)

## 신규 생성 (1개)

- `src/store/metadataStore.ts` — `metadata: FileMetadata[]` + `init(metadata)` + `getAll()` + `initialized: boolean` (CRUD 없음)

## 삭제 (6개 파일 + 2개 함수)

- `src/database/accountTable.ts` (218줄)
- `src/database/templateTable.ts` (161줄)
- `src/crypto/recordEncryption.ts` (152줄)
- `src/crypto/recordEncryption.test.ts` (180줄)
- `src/database/accountTable.integration.test.ts` (306줄)
- `src/database/templateTable.integration.test.ts` (277줄)
- `src/database/syncQueue.ts` (49줄) — 본 PR에서 삭제
- `src/database/db.ts`의 `getDatabaseSnapshot`/`replaceDatabaseData`/`initializeDatabase` 함수 3개 — 본 PR에서 삭제

## 수정 (~10개 파일)

- `src/database/fileStorage.ts` — `loadVaultToStores`/`activatePlaintextVault`/`saveStoresToFile` 도입, `createDataFile`/`unlockFile`/`openImportedDataFile`/`changePin`/`closeDataFile`/`lockDataFile` caller 표대로 재작성. `initializeStores` 제거
- `src/database/db.ts` — Dexie v15 schema drop, `KiyoDatabase` 클래스 타입 축소
- `src/store/accountStore.ts` — `init`/`getAll` 추가, `loadAccounts` 삭제, CRUD가 `saveStoresToFile` 직접 호출
- `src/store/templateStore.ts` — 동일 패턴
- `src/models/account.ts` — `AppSettings`/`Setting` 타입 export 제거
- `src/pages/Home.tsx` — `handleSelectFile` plaintext 분기를 `activatePlaintextVault`로 교체, import 정리
- `src/pages/RootRedirect.tsx` — `initializeStores` → `loadVaultToStores` + effect 1 setSession 보강
- `src/hooks/useFileAuthGuard.ts` — `onInitialized` 콜백에서 `loadVaultToStores` 호출

---

# Architecture

## 데이터 흐름 (목표)

```
[createDataFile]                              [unlockFile / openImportedDataFile / Home plaintext]
  setSession                                   setSession
  accountStore.init / templateStore.init       decrypt/parse (caller)
  metadataStore.init                           ↓
  saveStoresToFile                             loadVaultToStores(decrypted)
                                                     ↓
                                            accountStore.init(decrypted.accounts)
                                            templateStore.init(decrypted.templates)
                                            metadataStore.init(decrypted.metadata)

[changePin]                                   [addAccount / updateAccount / deleteAccount]
  getFileInfo (현재 vault read)                   accountStore.set({accounts:[...]})
  setSession(newKey, newSalt)                   saveStoresToFile
  saveStoresToFile (메모리 상태로 재암호화 write)        ↓
  ↓                                          accountStore.getAll()
fileTable.upsertFileRecord                   templateStore.getAll()
                                            metadataStore.getAll()
                                            encryptData → fileTable.upsertFileRecord

[lockDataFile]                                [closeDataFile]
  session.clearCryptoKey (메모리만)                session.clearSession
                                              accountStore.reset({accounts:[]})
                                              templateStore.reset({templates:[]})
                                              metadataStore.reset({metadata:[]})
                                              autofill clear
```

## 단일 source of truth invariant

- `db.files.fileData` (JSON) = vault의 **유일** 영속 source
- 메모리 store = `db.files.fileData`의 projection (mutable mirror)
- `loadVaultToStores` = JSON → store 동기화
- `saveStoresToFile` = store → JSON 동기화
- 두 함수는 **각각 read/write 진입점 1개씩** — 다른 경로 없음

## Store 상태 머신

- **uninitialized**: `accounts: []`, `initialized: false` (앱 시작 시 기본값)
- **initialized**: `accounts: [...]`, `initialized: true` (loadVaultToStores 호출 후)
- **invariant**: `initialized: true` ↔ `accounts.length > 0` OR caller가 의도적으로 빈 vault를 init 가능 (안전)

---

# Proposed Changes

## Step 0: 사전 검증 (PR 시작 전 grep)

```bash
# 1. loadAccounts/loadTemplates의 사용처 정확히 파악 (PR Step 1에서 사용)
grep -rn "loadAccounts\|loadTemplates" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules

# 2. recordEncryption의 export 사용처 (모두 삭제 가능 확인)
grep -rn "createEncryptedRecord\|createPlaintextRecord\|decryptRecord\|encryptRecord\|generateUUID" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules

# 3. db.metadata / db.settings 사용처 (record 테이블 외)
grep -rn "db\.metadata\|db\.settings" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules

# 4. AppSettings/Setting 타입 사용처
grep -rn "AppSettings\|Setting\b" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

기대 결과:
- (1) 위 cross-check 표의 6개 사용처 외에 0개여야 함
- (2) 모두 `accountTable.ts`/`templateTable.ts`/`db.ts`/`recordEncryption.test.ts` 안에서만 사용
- (3) 모두 `db.ts`/`accountTable.ts`/`templateTable.ts`/테스트 파일에서만
- (4) 0개 (dead type) — `models/account.ts` 정의만 존재

## Step 1: Store 메서드 추가 (`init`/`getAll`)

`src/store/accountStore.ts`, `src/store/templateStore.ts` — **`initialized: boolean` flag 삭제** (Q16 결정, sessionStore로 통합). store는 `accounts`/`templates`/`metadata` array만 보관. `src/store/metadataStore.ts` (신규):

```ts
// accountStore (변경 부분)
interface AccountState {
  accounts: Account[];
  // initialized 삭제 (Q16)
  init: (accounts: Account[]) => void;          // 신규
  getAll: () => Account[];                       // 신규
  addAccount / updateAccount / deleteAccount    // CRUD 5개는 유지하되 내부에서 saveStoresToFile 호출
  clearAccounts: () => void;                     // closeDataFile용
  syncToAutofill / getAutofillAccounts          // 유지 (변경 없음)
}

init: (accounts) => set({ accounts }),  // initialized flag 없음
```

**주의**:
- `isLoading` flag는 **삭제** — init이 단일 호출이므로 비동기 추적 불필요 (Q16)
- `initialized` flag는 **sessionStore로 통합** (Q16). `useSessionStore((s) => s.initialized)`로 spinner 분기
- `clearAccounts`는 `init`과 다름 — closeDataFile에서 빈 배열 reset용
- `syncToAutofill`은 **메모리 store에서도에서 도출**이라 변경 없음

## Step 2: `metadataStore` 신규

```ts
// src/store/metadataStore.ts (신규)
interface MetadataState {
  metadata: FileMetadata[];
  // initialized 삭제 (Q16)
  init: (metadata: FileMetadata[]) => void;
  getAll: () => FileMetadata[];
  clearMetadata: () => void;  // closeDataFile용
}
```

- 초기값: `metadata: []`. CRUD 메서드 없음 — vault 메타데이터는 초기 1회 seed 후 거의 불변
- seed 정책: `createDataFile`이 `[initializeDatabase()]` 1 row로 초기화 (현재 `db.ts:286-303`의 `initializeDatabase`가 `{id:1, version:"1.0.0", createdAt}` 반환 — 본 PR에서 `initializeDatabase` 함수는 삭제하고 이 값을 `metadataStore.init([{...}])`에 직접 주입)

## Step 3: 진입점 함수 3개 신규

`src/database/fileStorage.ts` (또는 신규 `src/database/vault.ts`)에 추가:

```ts
import { useAccountStore } from "@/store/accountStore";
import { useTemplateStore } from "@/store/templateStore";
import { useMetadataStore } from "@/store/metadataStore";

// db.files → 스토어 (read only, vault 활성화 시점)
// decrypted는 caller가 미리 확보한 KiyoVaultData. 함수 내부에서 getFileInfo/decryptData 호출 0.
// fileName은 sessionStore.activeFileName에서 읽음 — caller가 setSession 직후 호출하는 invariant.
export async function loadVaultToStores(decrypted: KiyoVaultData): Promise<void> {
  const { activeFileName } = useSessionStore.getState();
  if (!activeFileName) throw new Error("loadVaultToStores: no activeFileName in session");
  useAccountStore.getState().init(decrypted.accounts);
  useTemplateStore.getState().init(decrypted.templates);
  useMetadataStore.getState().init(decrypted.metadata);
  // Q16: initialized는 sessionStore로 통합 — loadVaultToStores 완료 시 true set
  useSessionStore.setState({ initialized: true });
}

// 평문 vault 활성화 wrapper (Home plaintext 진입점)
export async function activatePlaintextVault(fileName: string): Promise<void> {
  const info = await fileTable.getFileInfo(fileName);
  if (!info.activeFileName) throw new Error(`File not found: ${fileName}`);
  if (info.encrypted) throw new Error("activatePlaintextVault: vault is encrypted, use unlockFile");
  await useSessionStore.getState().setSession({ fileName });
  await loadVaultToStores(info.fileData as KiyoVaultData);
}

// 스토어 → KiyoVaultData JSON 구성 (read-only snapshot builder)
// Q18: saveStoresToFile + backupDataFile 공용 helper. fileName은 caller 책임 (session 또는 인자).
// 각 store의 getAll()로 snapshot 구성. store는 source를 모르고 caller만 orchestration.
function buildSnapshotFromStores(fileName: string): KiyoVaultData {
  return {
    version: 1,
    fileName,
    updatedAt: Date.now(),
    accounts: useAccountStore.getState().getAll(),
    templates: useTemplateStore.getState().getAll(),
    metadata: useMetadataStore.getState().getAll(),
  };
}

// 스토어 → db.files (write only, mutation 발생 시)
// 각 store의 getAll()로 snapshot 구성. store는 source를 모르고 caller만 orchestration.
export async function saveStoresToFile(): Promise<void> {
  const session = useSessionStore.getState();
  if (!session.activeFileName) return; // no-op
  const data = buildSnapshotFromStores(session.activeFileName);
  if (session.cryptoKey && session.salt) {
    const encrypted = await encryptData(data, session.cryptoKey, session.salt);
    await fileTable.upsertFileRecord(session.activeFileName, encrypted);
  } else {
    await fileTable.upsertFileRecord(session.activeFileName, data);
  }
}
```

## Step 4: record 테이블 5개 모듈 삭제

삭제 대상 (Step 0 grep으로 0개 확인 후):
- `src/database/accountTable.ts`
- `src/database/templateTable.ts`
- `src/crypto/recordEncryption.ts`
- `src/crypto/recordEncryption.test.ts`
- `src/database/accountTable.integration.test.ts`
- `src/database/templateTable.integration.test.ts`
- `src/database/syncQueue.ts` (49줄)

## Step 5: `src/database/db.ts` Dexie v15 마이그레이션

```ts
// 변경 부분
this.version(15)
  .stores({
    files: "id, fileName, createdAt, updatedAt",
    // accounts/templates/metadata/settings 완전 제거
  })
  .upgrade(async (transaction) => {
    await transaction.table("accounts").drop();
    await transaction.table("templates").drop();
    await transaction.table("metadata").drop();
    await transaction.table("settings").drop();
  });

// KiyoDatabase 클래스 타입 축소
class KiyoDatabase extends Dexie {
  files!: Table<FileRecord, string>;
  // accounts/templates/metadata/settings 타입 제거
}

// 삭제 대상:
// - getDatabaseSnapshot 함수 (91줄)
// - replaceDatabaseData 함수 (91줄)
// - initializeDatabase 함수 (lines 286-303) — metadataStore.init에 직접 주입
// - SyncDatabaseParams 타입
```

**마이그레이션 안전성** (4개 테이블 모두 drop, 사용자 데이터 손실 0):
- `db.accounts`/`db.templates` → snapshot에 이미 모든 정보 (`afff2e1f` 이후 multi-vault 모델 보장)
- `db.metadata` → snapshot의 `metadata: FileMetadata[]` 필드로 흡수
- `db.settings` → 런타임 0 import/read/write, `useSettingsStore`는 zustand localStorage

## Step 6: `src/database/fileStorage.ts` caller 재작성

`unlockFile`, `openImportedDataFile`, `createDataFile`, `changePin`, `closeDataFile`, `lockDataFile` 흐름을 brainstorm §3.6 caller 표 기준으로 재작성:

> **`backupDataFile`은 production code에서 1건 사용 중 (`src/pages/Settings/components/DataSection.tsx:54`, `handleBackup` 내부)** — 단순 export-only 함수로 session state 변경 없이 read-only snapshot 추출. `getDatabaseSnapshot`가 사라지므로 `backupDataFile`도 재작성 필요. **권장 패턴**: `backupDataFile` 내부에서 `buildSnapshotFromStores(fileName)` (Q18 helper) 호출 + `exportBackupFile`로 SAF export. session store / memory store 양쪽 건드리지 않음.
>
> ```ts
> // backupDataFile (변경 후 — 새 패턴, Q18 helper 사용)
> export const backupDataFile = async (fileName: string, pin?: string): Promise<KiyoVaultData> => {
>   const session = useSessionStore.getState();
>   if (!session.activeFileName) throw new Error("활성 데이터 파일이 없습니다.");
>
>   const data = buildSnapshotFromStores(fileName);  // Q18 helper
>
>   if (pin) {
>     const { encryptedVaultData } = await createEncryptedVault(data, pin);
>     await exportBackupFile(fileName, encryptedVaultData);
>   } else {
>     await exportBackupFile(fileName, data);
>   }
>   return data;
> };
> ```
>
> → `backupDataFile`은 **PR 1에서 유지** (호출처 1건 존재, 단순 read-only). Step 6 caller 재작성에 포함.

```ts
// unlockFile (변경 후)
export const unlockFile = async (fileName: string, pin: string): Promise<KiyoVaultData | null> => {
  const { encrypted, fileData, salt } = await fileTable.getFileInfo(fileName);
  if (!fileData) throw new Error(`File not found: ${fileName}`);
  if (!encrypted) throw new Error(`Salt missing for encrypted file: ${fileName}`);  // ← encrypted false는 plaintext 경로로 분기
  const { decryptedVaultData, cryptoKey } = await decryptVaultData(fileData, pin, salt);
  await useSessionStore.getState().setSession({ fileName, cryptoKey, salt });
  await loadVaultToStores(decryptedVaultData);
  return decryptedVaultData;
};

// openImportedDataFile encrypted (변경 후)
// ... decrypt + setSession + loadVaultToStores(decryptedVaultData)

// openImportedDataFile plaintext (변경 후)
// ... parse + setSession + loadVaultToStores(parsedData as KiyoVaultData)

// createDataFile (변경 후) — load 없음
export const createDataFile = async (fileName: string, pin?: string): Promise<KiyoVaultData> => {
  const normalizedFileName = normalizeDataFileName(fileName);
  const resolvedFileName = await fileTable.resolveFileName(normalizedFileName);

  if (pin) {
    const { key: cryptoKey, salt } = await createCryptoKey(pin);
    // builtin templates를 직접 메모리 set (templateStore에 init)
    const builtinTemplates = BUILTIN_TEMPLATES.map(t => ({ ...t, id: generateUUID(), createdAt: Date.now(), updatedAt: Date.now() }));
    // dev seed: accountStore.init(devAccounts) if DEV && !VITE_E2E
    const initialAccounts = (import.meta.env.DEV && !import.meta.env.VITE_E2E) ? devAccounts : [];
    const initialMetadata: FileMetadata[] = [{ id: 1, version: "1.0.0", createdAt: Date.now() }];

    await useSessionStore.getState().setSession({ fileName: resolvedFileName, cryptoKey, salt });
    useTemplateStore.getState().init(builtinTemplates);
    useAccountStore.getState().init(initialAccounts);
    useMetadataStore.getState().init(initialMetadata);

    const baseData: KiyoVaultData = {
      version: 1, fileName: resolvedFileName, updatedAt: Date.now(),
      accounts: initialAccounts, templates: builtinTemplates, metadata: initialMetadata,
    };
    const encryptedVaultData = await encryptData(baseData, cryptoKey, salt);
    await fileTable.upsertFileRecord(resolvedFileName, encryptedVaultData);
    return baseData;
  } else {
    // plaintext: 동일 패턴 (cryptoKey/salt 없이)
    // ...
    await saveStoresToFile();
  }
};

// changePin (변경 후) — load 없음
export const changePin = async (fileName: string, newPin: string): Promise<void> => {
  const { cryptoKey: oldKey } = await useSessionStore.getState();
  // 현재 메모리 상태를 새 키로 재암호화
  const { key: newKey, salt: newSalt } = await createCryptoKey(newPin);
  await useSessionStore.getState().setSession({ fileName, cryptoKey: newKey, salt: newSalt });
  await saveStoresToFile();
};

// closeDataFile (변경 후)
export const closeDataFile = async (): Promise<void> => {
  await useSessionStore.getState().clearSession();  // session 전부 clear — initialized:false 포함 (Q16)
  useAccountStore.getState().clearAccounts();  // accounts:[]
  useTemplateStore.getState().clearTemplates();
  useMetadataStore.getState().clearMetadata();
  if (Capacitor.getPlatform() === "android") {
    try { await KiyoAutofill.clearAllAccounts(); } catch (e) { /* ignore */ }
  }
};

// lockDataFile (변경 없음)
export const lockDataFile = async (): Promise<void> => {
  await useSessionStore.getState().clearCryptoKey();
};

// initializeStores 함수 삭제 (loadVaultToStores가 흡수)
```

**generateUUID**: `recordEncryption.ts`에서 가져오던 것 — 별도 유틸 (`src/crypto/uuid.ts` 또는 inline)으로 추출. builtin templates의 `id` 생성에 필요.

## Step 7: `src/store/accountStore.ts` CRUD 재작성

```ts
// 변경 후 (CRUD 부분)
const nextAccountId = (accounts: Account[]): number => {
  if (accounts.length === 0) return 1;
  return Math.max(...accounts.map((a) => a.id)) + 1;
};

addAccount: async (account) => {
  // dev seed (id=1) 또는 사용자 추가 모두 무관 — store의 현재 max + 1로 할당
  const newAccount = { ...account, id: nextAccountId(get().accounts) };
  set((state) => ({ accounts: [newAccount, ...state.accounts] }));
  await saveStoresToFile();  // 직접 호출
  return newAccount;
},

updateAccount: async (account) => {
  const updated = { ...account, updatedAt: Date.now() };
  set((state) => ({
    accounts: state.accounts.map((a) => a.id === updated.id ? updated : a),
  }));
  await saveStoresToFile();
},

deleteAccount: async (id) => {
  set((state) => ({ accounts: state.accounts.filter((a) => a.id !== id) }));
  await saveStoresToFile();
},

clearAccounts: () => set({ accounts: [], initialized: false }),

// isLoading, loadAccounts, _persistAccounts, enqueuePersistVaultSnapshot 모두 삭제
```

**Q15 결정 반영**: `nextAccountId` 헬퍼로 단일 진입점에서 ID 할당. dev seed(`data/devAccounts.ts`)의 `id: 1`은 init 시점 한 번만 set, 그 이후 `addAccount`는 자동으로 2, 3, ... 할당.

**`syncToAutofill`/`getAutofillAccounts`**: 변경 없음 (메모리 store 도출).

## Step 8: `src/store/templateStore.ts` 동일 패턴

## Step 9: caller 마이그레이션

> **Step 9는 PR 1에서 가장 범위가 큰 단계.** store의 `loadAccounts`/`loadTemplates`/`initializeStores`가 사라지므로 **8개 파일**에서 호출처 정리 필요. `useFileAuthGuard`의 `onInitialized` 시그니처는 caller가 `decrypted`를 어디서 가져오는지 모름 — caller별 `loadVaultToStores` 직접 호출 + hook의 `onInitialized`는 deprecated 경로.

### `src/pages/Home.tsx`

```ts
// 변경 후
import { activatePlaintextVault } from "@/database/fileStorage";

const handleSelectFile = async (fileName: string) => {
  const info = await fileTable.getFileInfo(fileName);
  if (!info.activeFileName) throw new Error(`File not found: ${fileName}`);
  if (info.encrypted) {
    await setupVaultSession({ fileName });
    navigate("/auth", { replace: true });
  } else {
    await activatePlaintextVault(fileName);  // ← getFileInfo + setSession + loadVaultToStores 통합
    navigate("/accounts", { replace: true });
  }
};

// db / replaceDatabaseData / initializeStores import 모두 제거
```

### `src/pages/RootRedirect.tsx`

```ts
// 변경 후 — effect 1에 setSession 보강
useEffect(() => {
  let cancelled = false;
  if (!activeFileName) {
    setInfo(null);
    setStatus({ kind: "redirecting", target: "/home" });
    return;
  }
  (async () => {
    try {
      const result = await fileTable.getFileInfo(activeFileName);
      if (cancelled) return;
      // ★ NEW: session에 fileName 등록 (loadVaultToStores invariant 충족)
      await useSessionStore.getState().setSession({ fileName: activeFileName });
      setInfo(result);
    } catch (err) {
      if (cancelled) return;
      setStatus({ kind: "error", error: err });
    }
  })();
  return () => { cancelled = true; };
}, [activeFileName]);

// effect 3 (preload) 변경
useEffect(() => {
  if (status.kind !== "preloading") return;
  // ... (timeout 3초 + 1회 재시도 로직 동일)
  try {
    await loadVaultToStores(info.fileData as KiyoVaultData);  // ← initializeStores 대체
    setStatus({ kind: "redirecting", target: "/accounts" });
    return;
  } catch (error) {
    // retry 로직 동일
  }
}, [status.kind]);

// useAccountStore.loadAccounts / useTemplateStore.loadTemplates 사용 제거 (line 47-48 selector 삭제)
```

### `src/pages/Auth.tsx` (생체인증 unlock 경로 — 보강 항목)

`Auth.handleBiometricLogin`은 **store 메서드를 직접 호출하지 않음** (`setCryptoKeyFromBase64`은 sessionStore 메서드). 변경 폭이 작지만, 후속 호출인 `initializeStores`를 `loadVaultToStores`로 교체해야 함.

```ts
// 변경 후 — handleBiometricLogin (lines 98-139)
const handleBiometricLogin = async () => {
  if (!fileName) {
    setError("파일 정보가 없습니다.");
    return;
  }

  setIsVerifying(true);
  setError("");

  try {
    const result = await SecureKey.unlockKeyWithBiometric({ vaultId: fileName });
    const cryptoKeyBase64 = result.key;

    const { salt } = await fileTable.getFileInfo(useSessionStore.getState().activeFileName!);
    if (!salt) {
      throw new Error("Salt not found for encrypted file");
    }

    // cryptoKey set (session)
    await useSessionStore.getState().setCryptoKeyFromBase64(cryptoKeyBase64, salt);

    // ★ NEW: decrypted를 session에서 확보 후 loadVaultToStores
    //   cryptoKey가 session에 set된 직후이므로, fileTable.getFileInfo + decrypt로
    //   KiyoVaultData를 한 번 더로 읽어서 store에 분배. 잠금 후 첫 진입 시점이라
    //   추가 비용은 1회 decrypt (< 50ms).
    const session = useSessionStore.getState();
    const { fileData } = await fileTable.getFileInfo(fileName);
    if (!fileData) throw new Error("File not found");
    const { decrypted } = await decryptVaultData(fileData, pin, salt);
    await loadVaultToStores(decrypted);  // ← initializeStores() 대체

    navigate("/accounts", { replace: true });
  } catch (err) {
    // ... 기존 에러 처리 동일
  } finally {
    setIsVerifying(false);
  }
};
```

**`Auth.handleVerifyPin` (PIN unlock)**: 현재 `unlockFile(fileName, pin)`을 호출하므로 `unlockFile`이 `loadVaultToStores(decrypted)`를 흡수하면 자동으로 동작 — 변경 없음.

### `src/pages/Accounts/index.tsx`

```ts
// 변경 후 (line 14-37 정리)
const accounts = useAccountStore((state) => state.accounts);
const { loadTemplates } = useTemplateStore(); // templates는 AccountEdit이 아님 — accounts 페이지에서는 불필요
// loadAccounts selector 제거
// initialized selector 제거 — Q16: useSessionStore((s) => s.initialized)로 단일화

useFileAuthGuard({
  // onInitialized 제거 — RootRedirect가 이미 loadVaultToStores를 호출했음.
  // useFileAuthGuard는 guard 역할만 (active file 없으면 /로, encrypted + cryptoKey 없으면 /auth로).
});
```

**Q16 적용**: 페이지에서 `initialized` 분기 필요 시 `useSessionStore((s) => s.initialized)` 사용. `useAccountStore.initialized` / `useTemplateStore.initialized` selector는 PR 1에서 모두 제거.

### `src/pages/Accounts/AccountEdit/index.tsx`

```ts
// 변경 후
const updateAccount = useAccountStore((state) => state.updateAccount);
const addAccount = useAccountStore((state) => state.addAccount);
const templates = useTemplateStore((state) => state.templates);
// loadTemplates selector + useEffect 제거 — RootRedirect가 templates까지 한 번에 init

useFileAuthGuard({ skipRedirect: false });  // onInitialized 콜백 제거
// useEffect에서 loadTemplates() 호출 라인 제거
```

### `src/pages/Accounts/components/TemplatePicker.tsx`

```ts
// 변경 후
const { templates } = useTemplateStore();
// loadTemplates + useEffect 제거 — store에 이미 채워져 있음 (loadVaultToStores가 처리)
```

### `src/pages/Templates/index.tsx`

```ts
// 변경 후 (line 11-22)
const { templates } = useTemplateStore();
// loadTemplates + isLoading selector + useFileAuthGuard onInitialized 콜백 제거
// isLoading 정책은 Q16에서 결정 (아래)

useFileAuthGuard({ /* onInitialized 없음 */ });
```

### `src/hooks/useFileAuthGuard.ts`

```ts
// 변경 후 — onInitialized 옵션 deprecated (호환 0개로 안전 제거)
export function useFileAuthGuard(options: {
  skipRedirect?: boolean;
} = {}) {
  // onInitialized 옵션 제거 — caller가 필요하면 useEffect로 loadVaultToStores 직접 호출
  // (실제로 RootRedirect가 이미 처리하므로 caller에서 loadVaultToStores 호출 자체가 불필요)
}
```

**Caller별 변경 요약**:

| 파일 | 제거 | 추가 |
|---|---|---|
| `Accounts/index.tsx` | `loadAccounts` selector, `onInitialized: loadAccounts` | — |
| `Accounts/AccountEdit/index.tsx` | `loadTemplates` selector, `useEffect([...loadTemplates])`, `onInitialized: loadTemplates` | — |
| `Accounts/components/TemplatePicker.tsx` | `loadTemplates` + `useEffect | — |
| `Templates/index.tsx` | `loadTemplates`, `isLoading` selector, `onInitialized` | — (Q16 — isLoading UX 정책 결정 후 후속) |
| `RootRedirect.tsx` | `loadAccounts`/`loadTemplates` selector, `initializeStores` 호출 | effect 1에 `setSession` 보강, effect 3에 `loadVaultToStores(info.fileData)` |
| `Auth.tsx` | `initializeStores()` 호출 | `loadVaultToStores(decrypted)` (handleBiometricLogin 내부) |
| `useFileAuthGuard.ts` | `onInitialized` 옵션 | — (deprecated, 호출처 0개로 안전 제거) |
| `Settings/components/DataSection.tsx` (line 54) | (변경 없음 — `backupDataFile` 호출만) | Step 6의 `backupDataFile` 재작성 결과에 의존. 컴파일 통과 확인 |

## Step 10: `src/models/account.ts` 타입 정리

```ts
// 삭제
export interface AppSettings { ... }
export type Setting = AppSettings;
// export type FontSize 유지 (settingsStore가 사용)
```

## Step 11: `tsc -b --noEmit` / `npm run check` 통과 확인

Step 1-11 완료 후:

```bash
npm run typecheck
npm run lint
npm run test
```

기대 결과:
- `tsc` 에러 0 (사용처 0인 메서드/타입 제거로 인한 에러만 발생하면 Step 0 grep 결과로 사전 차단)
- `eslint` 에러 0
- `vitest` 단위 테스트 통과 (record-table 4개 테스트 파일은 이미 삭제됨, integration test는 PR 2에서 갱신)
- Step 9 호출처 8개 파일 (`Accounts/index`, `AccountEdit`, `TemplatePicker`, `Templates/index`, `RootRedirect`, `Auth`, `useFileAuthGuard`, `Home`) 모두 컴파일 통과

---

# 결정 표 (사용자 인지 가능 surface)

| Q | 결정 | default | 비고 |
|---|---|---|---|
| Q1 | `db.accounts`/`db.templates` schema 처리 | **A: 완전 제거** | 사용자 확정 메시지 1 |
| Q2 | `syncQueue` 처리 | **a: 제거** | 사용자 확정 메시지 1 |
| Q3 | Lock race placeholder 정책 | 미확정 — **Q-후보** | encrypted + cryptoKey 없으면 caller가 /auth로 navigate (store 진입 안 함) — placeholder 분기 불필요 |
| Q4 | `replaceDatabaseData` signature | **삭제** (함수 자체 제거) | loadVaultToStores/saveStoresToFile 흡수 |
| Q5 | `db.metadata` | **✅ drop** | 사용자 확정 메시지 2 |
| Q6 | `db.settings` | **✅ drop** | 사용자 확정 메시지 2 |
| Q7 | store API | **init(data) + getAll()** | 사용자 확정 메시지 9 |
| Q8 | metadataStore 신규 | **✅ 추가** | 사용자 확정 메시지 9 |
| Q9 | loadAccounts/loadTemplates | **✅ 삭제** | 사용자 확정 메시지 9 (사용처 6개 정리) |
| Q10 | `isLoading` flag | **삭제** | init 단일 호출 비동기 추적 불필요 |
| Q11 | generateUUID | **별도 유틸로 추출** (recordEncryption 삭제 후) | builtin templates ID 생성에 필요 |
| Q12 | dev seed 정책 | **createDataFile 내부에서 직접 set** (DEV && !VITE_E2E) | 기존 `accountTable.initializeDevData` 호출 패턴 대체 |
| Q13 | closeDataFile 시 store reset 정책 | **메모리 store 비움** (accounts/templates/metadata: []) | lock은 store 유지, close는 비움 |
| Q14 | PR 1에 lockDataFile/store reset 포함? | **lockDataFile은 store 유지, closeDataFile만 reset** | brainstorm §3.6 invariant 참고 |
| Q15 | `devAccounts.id=1` 하드코딩 충돌 처리 | ✅ **a: `Math.max(...accounts.map(a => a.id)) + 1` 동적 할당** (2026-09-02 사용자 확정) | record 테이블의 `++id` 자동증가 제거 후 ID 생성 정책. dev seed는 init 시점에 1번만 set. accountStore CRUD가 자체 ID 생성. PR 1 본 PR에서 처리 |
| Q16 | `isLoading` flag 제거 후 UX 정책 | ✅ **a: spinner 제거 + store의 `initialized` flag도 sessionStore로 통합** (2026-09-02 사용자 확정) | `accountStore`/`templateStore`/`metadataStore`의 `initialized: boolean` 삭제, `sessionStore.initialized`로 단일화. `useSessionStore((s) => s.initialized)`로 loading 분기 |
| Q17 | `Auth.handleBiometricLogin`에서 decrypted 재조회 비용 | ✅ **a: 1회 추가 decrypt (< 50ms) 감수, 단순화 우선** (2026-09-02 사용자 확정) | session cryptoKey set 후 fileTable.getFileInfo + decryptVaultData 호출. unlock 직후 1회만 발생하므로 누적 비용 없음. **Q-후보**: c) PIN/biometric 공용 `unlockWithCryptoKey(fileName, cryptoKey, salt)` helper 추출 (PR 1 후속) |
| Q18 | `buildSnapshotFromStores` helper 추출 | ✅ **a: `fileStorage.ts` 내부에 `buildSnapshotFromStores(fileName)` helper, `saveStoresToFile` + `backupDataFile` 공용** (2026-09-02 사용자 확정) | store 3개 `getAll()`로 snapshot 구성하는 로직을 1개 helper로 단일화. fileName은 caller 책임 (session 또는 인자). helper 자체는 export 안 함 (내부 전용) |
| Q19 | PR 1 sub-PR 분할 vs 단일 PR | ✅ **a: 단일 PR 권장 유지** (2026-09-02 사용자 확정) | v15 schema migration이 PR 사이에 끼면 사용자 위험. PR 1a/1b/1c 3개 분리 검토 후 단일 PR이 가장 안전하다고 결론. (사용자 데이터 손실 0 invariant 유지) |
| Q20 | PR 2 통합 test 갱신 범위 | ✅ **a: 4개 통합 test + 2개 page mock 모두 포함** (2026-09-02 사용자 확정) | `fileStorage.lifecycle/encryption/changePin/fileTable` integration test + `AccountList.test` + `RootRedirect.test` 갱신. PR 1에서 삭제된 API 호출 모두 정리. PR 2 hard constraint: JSON 호환 invariant 검증 |

---

# Tests (PR 1 범위)

**PR 1 완료 시점의 테스트 상태**:
- **Vitest 단위 테스트**: 6개 파일 삭제 (`accountTable.*.test.ts`, `templateTable.*.test.ts`, `recordEncryption.test.ts`) → 모두 깨끗이 통과 (해당 import 없음)
- **Vitest integration 테스트**: 3개 파일 (`fileStorage.lifecycle/encryption/changePin`) + 1개 (`fileTable`) — **PR 1에서 컴파일 실패 예상** (record 테이블 API / `replaceDatabaseData` / `initializeStores` 사용). PR 2에서 갱신. **PR 1은 컴파일 통과까지만 목표**
- **Playwright E2E**: **변경 없음** — 내부 layer 변경, user-visible surface (button/dialog) 무변경
- **Android E2E**: **변경 없음** — React 앱이 WebView에서 동작, React 내부 store 변경은 영향 0

**PR 1 verification**:

```bash
npm run typecheck    # tsc -b --noEmit — 컴파일 0 에러 목표
npm run lint         # ESLint — 0 에러 목표
npm run test         # vitest run --typecheck — unit 테스트 0 실패 + integration은 PR 2에서
```

**PR 2 (별도)**: lifecycle/encryption/changePin integration test + AccountList/RootRedirect.test mock 갱신.

**E2E 회귀 위험 0** — `KiyoVaultData` JSON 스키마 무변경 + user-visible entry point (button/dialog/route) 무변경 + autofill sync path는 메모리 store에서 도출 (record 테이블 무관).

---

# Risks

## 보안

- **record-by-record AES-GCM 제거 → snapshot AES-GCM만 유지** — 보안 모델 동일 (vault 단위 1회 암호화). 단, **row 단위 검색 불가**해지지만 이미 안 하므로 무관.
- **cryptoKey는 메모리 only** — 유지. snapshot AES-GCM 키는 sessionStore에 보관 (메모리).
- **Dexie v15 마이그레이션 (4 테이블 drop)** — 기존 vault 데이터 손실 0 (snapshot이 source of truth).
- **autofill DB_KEY와 무관** — Android native, React 변경 무관.

## 호환성

- **`KiyoVaultData` JSON 스키마 절대 불변** (hard constraint) — `version:1`/`fileName`/`updatedAt`/`accounts`/`templates`/`metadata` 5 필드 그대로. 회귀 시 user-facing message (plan-A1 패턴).
- **`EncryptedKiyoVaultData` 5 필드 그대로** — `version`/`encrypted`/`salt`/`iv`/`ciphertext`.
- **`isKiyoFile`/`isEncryptedKiyoVaultData` 가드 그대로**.
- **외부 export/import (SAF) 동작 무변경** — `fileExport.ts`의 `exportBackupFile`/`importBackupFile`/`writeBackupToUri`/`readBackupFromUri` 무변경.

## Lifecycle / Race

- **Dexie close race** (RootRedirect effect 3, 기존 코드에 명시): `loadVaultToStores`는 1개 await (initializeStores는 `Promise.all([loadAccounts, loadTemplates])`) — 단일 await로 단순화. timeout 3초 + 1회 재시도 로직은 유지.
- **mutation burst race**: `addAccount` burst가 동시에 들어와도 JS 단일 스레드라 `set`이 동기, `saveStoresToFile`은 await. `saveStoresToFile`이 in-flight일 때 다른 mutation이 들어오면 직렬화 (queue 없이도 await chain으로 자연 처리).
- **lockDataFile 후 saveStoresToFile 호출**: `saveStoresToFile`은 `session.activeFileName`이 null이면 no-op. cryptoKey가 없는 상태에서 mutation이 시도되면 plaintext write로 fallback (현재 encrypted vault 잠긴 상태에서 mutation 시도 자체가 RootRedirect / useFileAuthGuard로 차단됨).

## Migration

- **v14 → v15 사용자 업그레이드**: `db.accounts`/`db.templates`/`db.metadata`/`db.settings` 4 테이블 drop. snapshot이 모든 정보 보관 (data loss 0). `db.settings`는 어차피 localStorage로 가서 무관.
- **PR 2에서 회귀 테스트 추가** — Plaintext/Encrypted vault JSON 호환 invariant.

## Architecture / 회귀

- **`loadAccounts`/`loadTemplates` 제거 시 8개 사용처** (Step 9에서 정리) — Step 1 `init` API 흡수 + Step 9 caller 마이그레이션. PR 1 완료 시점에 컴파일 에러로 남아있으면 안 됨.
- **`isLoading` flag + store의 `initialized` flag 제거** (Q16) — `accountStore`/`templateStore`/`metadataStore` 모두 `accounts`/`templates`/`metadata` array만 보관. `initialized`는 `sessionStore`로 통합 (`useSessionStore((s) => s.initialized)`로 spinner 분기). `Templates/index.tsx:11`의 `isLoading` selector 제거 → spinner 표시 정책 변경. UX 영향 검토 필요. PR 1은 단순 제거만, UX 보강은 후속 plan.
- **`Auth.handleBiometricLogin` 1회 추가 decrypt** — Q17 감수 결정 (단일 진입점 비용, 단순화 우선).
- **`replaceDatabaseData` 6 호출처** — Step 6에서 모두 새 함수로 마이그레이션.
- **`backupDataFile` 함수** — production code 1건 사용 (`Settings/components/DataSection.tsx:54 handleBackup`). PR 1에서 **유지 + 재작성** (store `getAll()` 기반 새 패턴으로). 단순 read-only라 회귀 위험 낮음.

---

# Rollback

PR 1은 schema v15 migration을 포함하므로 **롤백 = v14 schema 복원 + record 테이블/모듈 복원**. 단, 사용자 vault 데이터 자체는 snapshot (`db.files`)에 그대로 남아있어 복원 가능.

**단계별 롤백** (PR 1 작업 중 부분 롤백):
1. **Step 1-3 (store 신규 API 도입)만 머지** → record 테이블/모듈은 유지. **사용자 데이터 손실 0**. Step 4-10 revert 자유.
2. **Step 1-3 + Step 4-5 (record 모듈 삭제 + v15 drop)**: v15 drop은 되돌리려면 schema bump 1회 추가 (`v16.upgrade(async tx => { for each table: db.create(...) })`) 필요. PR 2 이후엔 rollback 복잡.

**권장**: PR 1을 3개 sub-PR로 분할 (PR 1a: store API + 진입점 함수, PR 1b: record 모듈 삭제 + v15, PR 1c: caller 마이그레이션 + dead code 정리) — 각 sub-PR은 독립 머지/롤백 가능.

---

# Verification Checklist (PR 1 완료 시)

```bash
# Step 0 검증
[ ] grep "loadAccounts|loadTemplates" — 사용처 0개
[ ] grep "createEncryptedRecord|createPlaintextRecord|decryptRecord|encryptRecord|generateUUID" — recordEncryption 외 0개
[ ] grep "db.metadata|db.settings" — record 테이블 외 0개
[ ] grep "AppSettings|Setting" — 0개 (settingsStore는 "Setting" 타입 안 씀)

# Step 1-2 검증
[ ] npm run typecheck → 0 error
[ ] useAccountStore.getState().init([...]) → accounts state에 반영 + initialized:true
[ ] useTemplateStore.getState().init([...]) → 동일
[ ] useMetadataStore.getState().init([...]) → 동일

# Step 3 검증
[ ] loadVaultToStores({accounts:[], templates:[], metadata:[]}) → 3개 store 모두 init
[ ] activatePlaintextVault("plain.json") → session setSession + 3개 store init
[ ] saveStoresToFile() → fileTable.upsertFileRecord 호출 확인 (cryptoKey 있을 때 encryptData 경유)

# Step 4-5 검증
[ ] recordEncryption/accountTable/templateTable/syncQueue 6개 파일 삭제 확인
[ ] db.ts version(15) + 4 테이블 drop 확인
[ ] db.ts의 getDatabaseSnapshot/replaceDatabaseData/initializeDatabase 함수 0개

# Step 6 검증
[ ] unlockFile("enc.json", "1234") → setSession + loadVaultToStores(decrypted)
[ ] openImportedDataFile(...) → setSession + loadVaultToStores
[ ] createDataFile("new.json") → saveStoresToFile (load 없음)
[ ] changePin("enc.json", "5678") → setSession(newKey) + saveStoresToFile
[ ] closeDataFile() → session.clearSession + 3개 store clearAccounts
[ ] backupDataFile("enc.json", "1234") → store 3개 getAll() + exportBackupFile (Settings DataSection에서 호출 정상)

# Step 7-8 검증
[ ] accountStore.addAccount() → set + saveStoresToFile
[ ] templateStore.createTemplate() → set + saveStoresToFile
[ ] store mutation 9개 메서드 모두 saveStoresToFile 호출

# Step 9 검증
[ ] Home.handleSelectFile plaintext → activatePlaintextVault + navigate
[ ] RootRedirect effect 3 → loadVaultToStores(info.fileData)
[ ] Auth.handleBiometricLogin → setCryptoKeyFromBase64 + loadVaultToStores(decrypted) (생체인증 unlock 정상)
[ ] Accounts/index.tsx → loadAccounts selector/onInitialized 제거, 컴파일 통과
[ ] Accounts/AccountEdit/index.tsx → loadTemplates selector/useEffect 제거
[ ] Accounts/components/TemplatePicker.tsx → loadTemplates + useEffect 제거
[ ] Templates/index.tsx → loadTemplates + isLoading selector 제거 (Q16 UX 정책 결정 후속)
[ ] useFileAuthGuard.ts → onInitialized 옵션 제거, callers 0개 컴파일 통과

# Step 10-11 검증
[ ] models/account.ts에서 AppSettings/Setting export 0개
[ ] npm run typecheck 0 error
[ ] npm run lint 0 error
[ ] npm run test (unit test 통과, integration test 컴파일 에러는 PR 2에서)
[ ] git diff --stat (변경 라인 수 검증: +500/-800 LOC 예상)
```

---

# Cross-Plan Integration

## Upstream (선행)
- [`docs/plans/2026-08-30-multi-vault-support.md`](./2026-08-30-multi-vault-support.md) ✅ (`afff2e1f`) — PK=fileName 승계, multi-vault 모델 기반. 본 plan은 그 다음 단계.
- [`docs/plans/2026-08-30-plan-d-theme-fouc.md`](./2026-08-30-plan-d-theme-fouc.md) ✅ (`15e2e870`) — `RootRedirect.tsx` 도입. 본 plan의 Step 9에서 RootRedirect 호출을 loadVaultToStores로 흡수.
- [`docs/plans/2026-08-30-plan-a1-error-visibility.md`](./2026-08-30-plan-a1-error-visibility.md) ✅ (`19341aec`) — `mapError` + `setSyncError`. PR 1의 `saveStoresToFile` catch에서 동일하게 사용.

## Downstream (후속)
**PR 2 (별도)**: `fileStorage.lifecycle/encryption/changePin/fileTable` integration test + `AccountList.test` + `RootRedirect.test` 갱신. `db.metadata.bulkPut(metadata)` 라인 제거, `fileTable.upsertFileRecord` 직접 시드. **PR 2 hard constraint**: Plaintext/Encrypted vault JSON 호환 invariant 검증 (PR 1의 JSON 스키마 불변 명시 기반).
- **PR 3** — `openwiki/architecture/data-flow.md` 다이어그램 갱신, `openwiki/data-models/{account,template,vault}.md` "Stored in `db.accounts`" 문구 → "Stored in `db.files.fileData` snapshot" 갱신, STRATEGY §1 "PIN → PBKDF2 → AES-GCM 레코드 단위" → "snapshot 통째로" 정합.
- **Q-후보 (별도 brainstorm)** — `db.metadata` mutation 정책 결정 (Q5 후속). `metadataStore` CRUD 추가 여부.

## 영향 분석
- Android E2E (`androidTest/`) — React WebView DOM 셀렉터 기반. Record 테이블 API는 React 내부에 격리되어 영향 0. Step 9에서 RootRedirect의 `initializeStores` 호출만 변경 (컴포넌트 구조는 무변경, pageobject 셀렉터 무영향).
- Autofill sync — `accountStore.syncToAutofill`/`getAutofillAccounts`는 메모리 store 도출. 변경 0.

---

# Output

1. **Plan 파일 경로**: `/docs/plans/2026-09-02-files-only-vault-pr1.md`
2. **변경 파일**:
   - 신규 1개: `src/store/metadataStore.ts`
   - 삭제 6개 파일 (record 테이블/모듈) + db.ts의 3개 함수
   - 수정 ~10개 파일 (fileStorage, db, accountStore, templateStore, models/account, Home, RootRedirect, useFileAuthGuard 등)
3. **테스트**:
   - 단위 테스트: 변경 없음 (record-table 4개 파일 삭제 완료)
   - Integration 테스트: PR 2에서 갱신 (PR 1은 컴파일 통과까지만)
   - Playwright E2E: 변경 없음
   - Android E2E: 변경 없음
4. **주요 리스크**:
   - Dexie v15 마이그레이션 (4 테이블 drop) — 손실 0 (snapshot 보호)
   - `KiyoVaultData` JSON 스키마 절대 불변 — hard constraint 체크리스트로 PR 2에서 검증
   - `loadAccounts`/`loadTemplates` 제거 시 6개 사용처 — Step 1 + Step 9 caller 마이그레이션으로 흡수
5. **구현 가능**: ✅ 본 plan + brainstorm §3.6 caller 표 + 결정 표로 다른 엔지니어가 독립 실행 가능

**Sub-PR 분할 권장** (현실적 분할 검토 후 결정):
- **PR 1a** — Step 1-3 (store 신규 API + 진입점 함수 3개) — record 테이블/모듈은 유지, 컴파일 통과가 어려움 (사용처 8개 즉시 정리 필요) → **Step 7-9와 함께 머지** 권장
- **PR 1b** — Step 4-5 (record 모듈 삭제 + v15 schema drop) — Step 1-3, 7-9와 함께 머지 권장 (v15 마이그레이션은 단일 commit이 안전)
- **PR 1c** — Step 6 (fileStorage caller 재작성 + Step 7-10 (store CRUD 재작성, models 정리) — 동일 PR 권장

→ **현실적 분할 결정**: **Q19 = a, PR 1 = PR 1a + 1b + 1c 통합 (1 PR)** (2026-09-02 사용자 확정). 너무 작게 쪼개면 v15 schema bump이 PR 사이에 들어가 사용자 위험. 단일 PR이 가장 안전.