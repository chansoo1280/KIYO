# Multi-Vault Support — `files` 테이블 N-row 공존

- Date: 2026-08-30
- Source: [2026-08-30-multi-vault-support.md](../brainstorms/2026-08-30-multi-vault-support.md) (모든 Q1~Q8 결정 완료)
- Related: [STRATEGY.md §2 (Vault File Integrity)](../../STRATEGY.md), [STRATEGY.md §3 Plan-7](../brainstorms/2026-08-30-track3-ux-accessibility.md)
- Target: Track 2 (Vault File Integrity) §2 후속 — STRATEGY Boundary #4 ("멀티 볼트는 로컬 파일 단위로만")를 코드에 정렬

---

# Goal

`files` 테이블에 N개 row가 공존 가능하도록 변경하고, Home에서 파일 리스트 / 선택 / 생성 / 삭제가 가능하도록 한다. "active" 식별은 `sessionStore.activeFileName`(in-memory, persist됨)으로만 수행하며, DB row에 `ACTIVE_FILE_ID` 리터럴이 박혀있던 단일 파일 제약을 제거한다.

작업 완료 시 다음이 참:
1. Dexie v14 migration으로 v13 row(id="active")를 fileName PK로 자동 승계, **사용자 데이터 손실 0**
2. `fileTable` API가 모두 fileName 기반 (`getFileRecord(fileName)`, `getFileInfo(fileName)`, `deleteFileRecord(fileName)`) — `ACTIVE_FILE_ID` 상수 제거
3. `createDataFile` / `openImportedDataFile`이 중복 fileName에 `(1)`, `(2)` suffix 자동 부여 (`resolveFileName` 신규)
4. `closeDataFile`이 `db.files`를 건드리지 않음 — in-memory session/accounts/templates/autofill만 클리어
5. `replaceDatabaseData` 트랜잭션 내 `db.files.clear()` 제거 — active fileName 1개만 `upsertFileRecord`
6. Home에 파일 리스트 섹션 추가: fileName + createdAt/updatedAt + active 표시 + 클릭 시 active 전환 + 삭제 버튼
7. `unlockFile`은 `sessionStore.activeFileName`을 받아 `getFileInfo(fileName)`로 lookup (이전의 "active row literal" 가드 제거)
8. **E2E (Playwright) 갱신 — 11-close-datafile을 multi-vault 시나리오로 재작성** (사용자 확인 2026-08-30). FileCreateDialog/FileOpenDialog 자체는 변경 없음 (호출 시그니처 + 동작 보존)
9. **JVM (Vitest) 갱신 — `fileTable.integration.test.ts` (358줄)와 `fileStorage.lifecycle.integration.test.ts` (711줄)의 단일 row 가정을 multi-row로 갱신**
10. Android Keystore/autofill/SAF 외부 자동저장: **변경 0** (autofill은 active 1개만 sync, 외부 자동저장은 `autoBackupEnabled && autoBackupUri` 조건부 그대로)

---

# Current State

## 단일 파일 모델의 정확한 박힌 위치 (브레인스토밍 §5와 일치 확인)

| 위치 | 코드 | 의미 |
|---|---|---|
| `src/database/fileTable.ts:8` | `export const ACTIVE_FILE_ID = "active" as const;` | 단일 id 리터럴 정의 |
| `src/database/fileTable.ts:24-40` | `updateFileRecord`가 `where("id").equals(ACTIVE_FILE_ID)` | active 1개 한정 |
| `src/database/fileTable.ts:45-48` | `getActiveFileRecord()` — 리터럴 lookup | active 1개 한정 |
| `src/database/fileTable.ts:53-79` | `getActiveFileInfo()` — 리터럴 lookup | active 1개 한정 |
| `src/database/fileTable.ts:85-102` | `upsertFileRecord`가 `id: ACTIVE_FILE_ID` 강제 | **덮어쓰기** |
| `src/database/fileTable.ts:107-110` | `getAllFileNames()` 정의됨, 사용처 0 | dead-ish |
| `src/database/fileTable.ts:119-121` | `deleteFileRecord()` — `where("id").equals(ACTIVE_FILE_ID).delete()` | active 1개 한정 |
| `src/database/db.ts:20-27` | `FileRecord.id: typeof ACTIVE_FILE_ID` | id 리터럴 타입 |
| `src/database/db.ts:38-53` | `db.version(13) + transaction.table("files").clear()` | v12→v13 migration |
| `src/database/db.ts:50` | 주석 "v12: files 테이블 키를 ++id에서 고정 "active"로 변경" | 마이그레이션 이력 |
| `src/database/db.ts:240-258` | `replaceDatabaseData` 트랜잭션 내 `db.files.clear()` | **전부 삭제** |
| `src/database/fileStorage.ts:238-253` | `closeDataFile` → `fileTable.deleteFileRecord()` (전부 삭제) | in-memory 클리어 + DB row 삭제 |
| `src/database/fileStorage.ts:266-269` | `unlockFile`에서 `getActiveFileInfo`로 active fileName을 가져와 인자 fileName과 일치 확인 | active 리터럴 의존 |
| `src/database/fileStorage.ts:297-365` | `createDataFile` — suffix 부여 없음, 항상 active 1개 | 덮어쓰기 |
| `src/database/fileStorage.ts:390-506` | `openImportedDataFile` — suffix 부여 없음, 항상 active 1개 | 덮어쓰기 |
| `src/pages/Home.tsx:17-156` | "파일 생성" / "파일 선택" 두 버튼만, **리스트 없음** | UI 없음 |
| `src/store/sessionStore.ts:9-106` | `activeFileName: string \| null` persist (partialize 포함), cryptoKey/salt 메모리 only | 그대로 (정상) |
| `src/hooks/useFileAuthGuard.ts:23-46` | `fileTable.getActiveFileInfo()` 호출 | API 변경 시 영향 |
| `src/pages/Auth.tsx:24-49` | `fileTable.getActiveFileInfo()` 호출 후 `useSessionStore.activeFileName`과 비교 | API 변경 시 영향 |
| `src/pages/Auth.tsx:108` | `getActiveFileInfo()`로 salt만 조회 | API 변경 시 영향 |
| `src/pages/Settings/components/DataSection.tsx:35-45` | `getActiveFileInfo()`로 현재 activeFileName 조회 후 덮어쓰기 confirm | API 변경 시 영향 |
| `src/pages/Settings/components/PinChangeDialog.tsx:56` | `getActiveFileInfo()`로 fileData 조회 후 verifyPin | API 변경 시 영향 |
| `src/database/fileStorage.ts:510-541` | `changePin`에서 `getActiveFileInfo()`로 activeFileName + fileData 조회 | API 변경 시 영향 |
| `src/database/fileTable.integration.test.ts` (358줄) | 전부 단일 row 가정 (`id: ACTIVE_FILE_ID`, `getActiveFileRecord`) | 갱신 필요 |
| `src/database/fileStorage.lifecycle.integration.test.ts` (711줄) | 단일 row 가정 + `db.files.clear()` 결과 의존 | 갱신 필요 |
| `src/hooks/useFileAuthGuard.test.tsx:1-329` | `getActiveFileInfo` mock 사용 | 갱신 필요 (mock 시그니처) |
| `e2e/11-close-datafile.spec.ts:46-276` | `closeDataFile`이 "모든 row 삭제"에 의존 (vault-one → close → vault-two) | **갱신 필요 (multi-vault 시나리오로)** |

## 외부 표면 (변경 없음 보장)

- `android/.../AutofillRepository.kt` (autofill DB_KEY 격리) — 변경 0
- `android/.../KiyoAutofillService.kt` (active 1개 sync) — 변경 0
- `src/database/fileExport.ts:18-75` (`exportBackupFile` — SAF 덮어쓰기) — 변경 0
- `src/database/fileExport.ts:80-116` (`importBackupFile` — SAF picker) — 변경 0
- `src/store/settingsStore.ts:13-22` (`autoBackupEnabled` + `autoBackupUri`) — 변경 0
- `src/database/db.ts:88-155` (`persistVaultSnapshot` + `tryTriggerAutoBackup`) — 변경 0
- `src/components/dialogs/FileCreateDialog.tsx` (UI 다이얼로그) — **변경 0** (호출자가 defaultValue만 결정)
- `src/components/dialogs/FileOpenDialog.tsx` (UI 다이얼로그) — **변경 0**
- `src/pages/Settings/components/SecuritySection.tsx` (PIN 변경 진입점) — **변경 0**

## 결정된 사항 (브레인스토밍 §10, 모두 사용자 확정 2026-08-30)

- Q1: Dexie v14, `files: "id, fileName, createdAt, updatedAt"` (PK string), id = fileName
- Q2: `ACTIVE_FILE_ID` 상수 **제거** (Q2-a). 모든 호출처 fileName 기반으로 갱신
- Q3: import 시 `parsedData.fileName` 그대로 사용 + suffix 부여
- Q4: 삭제 UI **포함** (Q4-a). active 잠금 조건 **0** (Q4-a-1) — 전부 삭제 가능
- Q5: rename **미포함** (Q5-b) — 후속 plan (Settings)
- Q6: autofill = active 1개만 sync (Q6-a) — **변경 0**
- Q7: v14 마이그레이션 시 기존 row의 id를 fileName으로 승계 (Q7-a) — 데이터 손실 0
- Q8: `fileTable.integration.test.ts` (JVM) 갱신 (Q8-a) / **E2E (Playwright) 갱신 — 11-close-datafile을 multi-vault 시나리오로** (사용자 재확인 2026-08-30, 브레인스토밍의 "회귀 0" 가정을 의도적으로 바꿈)

## 추가 결정 (인스펙션 후 도출, 사용자 확인 2026-08-30)

- **`closeDataFile`은 `db.files`를 건드리지 않는다** — `clearSession` + `clearAccounts` + `clearTemplates` + `KiyoAutofill.clearAllAccounts`만 호출. "active 해제"는 `sessionStore.activeFileName = null`로 표현. 사용자가 Home에서 다시 파일을 선택하면 active 재설정
- **`unlockFile`은 `sessionStore.activeFileName`이 이미 세팅된 상태에서 호출된다** — `getActiveFileInfo(fileName)` 식으로 fileName 직접 lookup. "active row 리터럴 일치" 가드(`fileStorage.ts:267-269`)는 제거 (해당 가드는 v13 모델에서만 의미가 있었음)

---

# Relevant Files

| File | 현재 역할 | 본 plan에서의 역할 |
|------|----------|-------------------|
| `src/database/fileTable.ts` | 5개 메서드 + `ACTIVE_FILE_ID` 상수 | 전부 fileName 기반으로 재작성 + `resolveFileName` / `getAllFiles` 신규 |
| `src/database/db.ts` | `KiyoDatabase` v13 정의, `FileRecord.id: ACTIVE_FILE_ID`, `replaceDatabaseData` 트랜잭션, `persistVaultSnapshot`, `tryTriggerAutoBackup` | v14 bump + `FileRecord.id: string` + `replaceDatabaseData`에서 `db.files.clear()` 제거. `persistVaultSnapshot` / `tryTriggerAutoBackup` 변경 0 |
| `src/database/fileStorage.ts` | `createDataFile` / `openImportedDataFile` / `closeDataFile` / `unlockFile` / `changePin` / pipeline 함수들 | `createDataFile` / `openImportedDataFile` 진입 시 `resolveFileName(desired)` 호출 / `closeDataFile`에서 `deleteFileRecord` 제거 / `unlockFile` 가드 단순화 / `changePin`은 `getFileInfo(activeFileName)`로 변경 |
| `src/store/sessionStore.ts` | `activeFileName` persist, cryptoKey/salt 메모리 | 변경 0 (정상) |
| `src/pages/Home.tsx` | 파일 생성/선택 버튼 | 파일 리스트 + active 전환 + 삭제 추가 |
| `src/pages/Auth.tsx` | `getActiveFileInfo`로 active/salt 조회 | `getFileInfo(fileName)`로 변경, salt는 `getFileInfo` 결과에서 직접 |
| `src/pages/Settings/components/DataSection.tsx` | 백업/복원/자동백업 | `getFileInfo(activeFileName)`로 변경 |
| `src/pages/Settings/components/PinChangeDialog.tsx` | PIN 변경 다이얼로그 | `getFileInfo(activeFileName)`로 변경 |
| `src/hooks/useFileAuthGuard.ts` | `getActiveFileInfo`로 active 조회 | `getFileInfo(activeFileName)`로 변경 |
| `src/hooks/useFileAuthGuard.test.tsx` | `getActiveFileInfo` mock | mock 시그니처 갱신 |
| `src/pages/Settings/components/SecuritySection.tsx` | `getActiveFileInfo` 4회 호출 (line 39, 52, 90, 111) — `changePin` 진입, PIN 변경 후 encrypted 확인, `SecureKey.deleteKey`/`storeKey`의 `vaultId` 인자 | `getFileInfo(activeFileName)` + `useSessionStore.getState().activeFileName`로 갱신. `changePin(fileName, newPin)` 시그니처에 맞춰 `fileName` 명시 전달 |
| `src/database/fileTable.integration.test.ts` (358줄) | 단일 row 가정 | multi-row invariant + suffix 부여 테스트 추가, `ACTIVE_FILE_ID` 의존 제거 |
| `src/database/fileStorage.lifecycle.integration.test.ts` (711줄) | 단일 row 가정 | multi-vault lifecycle 추가 + close 후 row 보존 검증 |
| `e2e/11-close-datafile.spec.ts` | "모든 row 삭제" 의존 시나리오 | **multi-vault 시나리오로 재작성** — close 후 이전 vault 행 보존 + 새 vault가 `(1)` suffix |
| `e2e/fixtures/indexeddb.fixture.ts` | IDB cleanup | 변경 0 (필요시 시나리오별 cleanup 강화) |

---

# Architecture

## 데이터 모델 변경 (Dexie v14)

### v13 → v14 upgrade (db.ts)

```ts
this.version(14)
  .stores({
    accounts: "++id, createdAt, updatedAt",
    templates: "++id, createdAt, updatedAt",
    settings: "++id, theme, lockEnabled, autoLockTime, fontSize, biometricEnabled",
    metadata: "id, version, createdAt",
    files: "id, fileName, createdAt, updatedAt",  // PK: string (fileName)
  })
  .upgrade(async (tx) => {
    // v13 row 1개(id="active")를 fileName PK로 승계 — 데이터 손실 0
    const rows = await tx.table("files").toArray();
    for (const row of rows) {
      if (row.id === "active" && row.fileName) {
        row.id = row.fileName;
        await tx.table("files").put(row);
      }
    }
  });
```

**마이그레이션 안전성** (브레인스토밍 §11 일치):
- v13 row는 항상 1개 (`ACTIVE_FILE_ID` 리터럴 강제). `id="active"`인 row만 `id = fileName`으로 변경
- `db.files.clear()` 호출 안 함 → 기존 데이터 보존
- v14의 `files: "id, ..."` 인덱스 정의는 v13과 동일 (PK type만 string으로 확장). Dexie v3+는 string PK를 지원

### FileRecord 타입

```ts
// Before (v13)
export interface FileRecord {
  id: typeof ACTIVE_FILE_ID;  // "active"
  fileName: string;
  fileData: string;
  encrypted: boolean;
  salt?: string;
  createdAt: number;
  updatedAt: number;
}

// After (v14)
export interface FileRecord {
  id: string;  // = fileName (PK)
  fileName: string;
  fileData: string;
  encrypted: boolean;
  salt?: string;
  createdAt: number;
  updatedAt: number;
}
```

## fileTable API (신규)

```ts
export const fileTable = {
  /** 단일 row 조회 by fileName */
  async getFileRecord(fileName: string): Promise<FileRecord | null> { ... },

  /** 단일 row의 ActiveFileInfo by fileName (fileName 인자 필수) */
  async getFileInfo(fileName: string): Promise<ActiveFileInfo> { ... },

  /** 모든 row 조회 (Home 리스트 표시용) */
  async getAllFiles(): Promise<FileRecord[]> { ... },

  /** fileName 배열 (편의) — getAllFiles().map(f=>f.fileName) */
  async getAllFileNames(): Promise<string[]> { ... },

  /** PK = fileName. createdAt 보존, updatedAt 갱신 */
  async upsertFileRecord(fileName: string, fileData: ...): Promise<void> { ... },

  /** salt + updatedAt만 갱신 (기존 updateFileRecord 시그니처 유지, 내부 id = fileName) */
  async updateFileRecord(fileName: string, salt?: Uint8Array): Promise<void> { ... },

  /** Home에서 명시적 삭제 시. active 잠금 조건 없음 */
  async deleteFileRecord(fileName: string): Promise<void> { ... },

  /** 중복 fileName에 (1), (2) suffix 부여하여 unique 보장 */
  async resolveFileName(desired: string): Promise<string> { ... },
};
```

**`ACTIVE_FILE_ID` 상수 제거.** 모든 호출처 fileName 기반으로 갱신.

## 중복 fileName suffix 알고리즘

```ts
async function resolveFileName(desired: string): Promise<string> {
  const normalized = normalizeDataFileName(desired);
  const existing = await db.files.toArray().then(rows => new Set(rows.map(r => r.id)));
  if (!existing.has(normalized)) return normalized;
  const base = normalized.replace(/\.json$/, "");
  for (let i = 1; ; i++) {
    const candidate = `${base}(${i}).json`;
    if (!existing.has(candidate)) return candidate;
  }
}
```

**동시성 가정**: KIYO는 single-user single-thread 앱. `createDataFile`/`openImportedDataFile`은 모두 UI trigger (Home.handleCreateFile / handleOpenFile) — React 이벤트 루프에서 사용자 액션이 직렬화되어 race window 0. read-then-write 패턴이지만 Dexie 트랜잭션으로 감싸지 않음 (복잡도/성능 비용 > 실질적 위험). **테스트로 race는 검증하지 않음.**

**호출 위치:**
- `createDataFile` 진입 시점: `const fileName = await fileTable.resolveFileName(desired);` — 이후 동일 흐름
- `openImportedDataFile` 진입 시점: `const fileName = await fileTable.resolveFileName(parsedData.fileName);` — 이후 동일 흐름

## "active" 식별 모델

**`sessionStore.activeFileName` (in-memory + persist via partialize)이 active의 단일 출처.**

- `useSessionStore.getState().activeFileName` — 현재 active의 fileName
- "active row" = `db.files.get(activeFileName)` (v14에서 `id === activeFileName`인 row)
- "no active" = `activeFileName === null` 또는 `db.files.get(activeFileName) === undefined`

**`db.files.get(ACTIVE_FILE_ID)` 형태의 호출 전부 제거.** `db.files.get(activeFileName)` 또는 `fileTable.getFileRecord(activeFileName)`로 대체.

## 제어 흐름 변경

### 1. 새 파일 생성 (Home → "파일 생성")

```
[User: 새 파일 생성]
  └─ Home.handleCreateFile (fileName, encrypted, pin)
       └─ createDataFile(fileName, pin)
            ├─ resolveFileName(desired)  ← NEW: 중복 검사 + suffix 부여
            ├─ createCryptoKey (PIN → key + salt)  [PIN 있는 경우]
            ├─ BUILTIN_TEMPLATES 암호화 저장
            ├─ setupVaultSession (resolvedFileName + cryptoKey + salt)
            │   └─ useSessionStore.setSession({ fileName: resolvedFileName, ... })
            └─ persistVaultRecord(resolvedFileName, encrypted)
                 └─ fileTable.upsertFileRecord(resolvedFileName, encrypted)
                      └─ id = resolvedFileName, row put (덮어쓰기 X, 신규 row)
```

### 2. 외부 파일 열기 (Home → "파일 선택")

```
[User: 외부 파일 열기]
  └─ Home.handleOpenFile (file, pin)
       └─ openImportedDataFile(data, pin, file.name)
            ├─ JSON parse + salt 검증
            ├─ resolveFileName(parsedData.fileName)  ← NEW
            ├─ decryptVaultData (PIN → key)
            ├─ persistVaultRecord(resolvedFileName, parsedData)
            ├─ setupVaultSession (resolvedFileName + cryptoKey + salt)
            └─ replaceDatabaseData (resolvedFileName, ...)
                 └─ transaction: db.accounts.clear() + db.templates.clear() + db.metadata.clear()
                                 + db.files (upsertFileRecord만, clear 제거)
```

**이전 vault는 clear되지 않고 Home 리스트에 남는다 (의도된 multi-vault 동작).** 브레인스토밍 Q3 확정 ("import → DB에 새 row + active 전환"). 사용자가 Home에서 이전 vault를 다시 선택하면 새 active로 갈아탈 수 있음. accounts/templates/metadata는 새 vault 데이터로 교체되는데, 이건 단일 vault의 데이터 구조상 정상 (이전 vault의 accounts/templates는 Home active 전환 시 다시 로드됨).

### 3. mutation → autosave (변경 없음)

```
[User: mutation → autosave]
  └─ persistVaultSnapshot
       ├─ getDatabaseSnapshot (activeFileName)
       ├─ encryptData
       ├─ fileTable.upsertFileRecord(activeFileName, encrypted)  ← id = activeFileName
       └─ tryTriggerAutoBackup (SAF 외부, 조건부)
```

**여기서 `upsertFileRecord(activeFileName, ...)`는 같은 id(=activeFileName) row만 갱신** — 다른 row는 영향 없음. multi-row 모델과 호환.

### 4. closeDataFile (변경)

```
// Before (v13)
[User: close file]
  └─ closeDataFile
       ├─ clearSession (activeFileName = null, cryptoKey = null, salt = null)
       ├─ fileTable.deleteFileRecord()  ← 모든 row 삭제
       ├─ clearAccounts / clearTemplates
       └─ KiyoAutofill.clearAllAccounts

// After (v14)
[User: close file]
  └─ closeDataFile
       ├─ clearSession (activeFileName = null, cryptoKey = null, salt = null)
       ├─ clearAccounts / clearTemplates
       └─ KiyoAutofill.clearAllAccounts
       (db.files는 건드리지 않음 — 모든 row 보존)
```

**핵심 차이**: `fileTable.deleteFileRecord()` 호출 제거. "active 해제"는 `sessionStore.activeFileName = null`로 표현. 사용자가 Home에서 다른 row를 선택하면 `getFileInfo(fileName)` → `setupVaultSession({ fileName, cryptoKey, salt })`로 active 재설정.

### 5. unlockFile (변경)

```
// Before (v13)
[User: PIN 입력 → unlockFile]
  └─ unlockFile(fileName, pin)
       ├─ getActiveFileInfo()  ← "active" 리터럴 lookup
       ├─ if (activeFileName !== fileName) throw "File not found"
       ├─ decryptVaultData(fileData, pin, salt)
       └─ setCryptoKey(cryptoKey, salt)

// After (v14)
[User: PIN 입력 → unlockFile]
  └─ unlockFile(fileName, pin)  ← fileName = useSessionStore.activeFileName (Auth가 전달)
       ├─ getFileInfo(fileName)  ← 명시적 fileName lookup
       ├─ if (!fileData) throw "File not found"
       ├─ decryptVaultData(fileData, pin, salt)
       └─ setCryptoKey(cryptoKey, salt)
```

**Auth 화면** (변경):

```ts
// Before
useEffect: getActiveFileInfo() → activeFileName 추출 → useSessionStore.activeFileName과 비교 → ...

// After
// 1. Auth 진입 전 useSessionStore.activeFileName은 이미 setSession/createDataFile/openImportedDataFile 경로로 설정됨
// 2. Auth.useEffect: getFileInfo(useSessionStore.getState().activeFileName!) → fileName 확인
//    - undefined/null이면 /로 navigate (no active file)
//    - 아니면 encrypted/salt/fileData 추출
```

**`unlockFile` 진입 조건** (홈/Auth 책임):
- Home에서 "기존 파일을 active로" 선택 시: `setupVaultSession({ fileName, cryptoKey: undefined, salt: undefined })`로 active 설정 → `/auth`로 navigate (encrypted file이면) 또는 바로 `/accounts`
- Auth에서 PIN 입력 시: `unlockFile(useSessionStore.getState().activeFileName!, pin)` — 이미 active 설정됨

### 6. Home 신규 흐름 (active 전환)

```
[User: Home에서 기존 파일 클릭]
  └─ Home.handleSelectFile(fileName)
       ├─ useSessionStore.getState().clearSession()  // 이전 active 해제
       ├─ getFileInfo(fileName)  // encrypted 여부 + salt 확인
       ├─ if (info.encrypted) {
       │     // encrypted: cryptoKey/salt 없이 active만 설정 → /auth로 navigate
       │     await setupVaultSession({ fileName });  // loadStores: false (Auth에서 unlock 후 initializeStores 호출)
       │     navigate("/auth");
       │   } else {
       │     // plaintext: active 설정 + store reload
       │     await setupVaultSession({ fileName, loadStores: true });  // ← loadStores 옵션
       │     navigate("/accounts");
       │   }

[User: Home에서 기존 파일 삭제]
  └─ Home.handleDeleteFile(fileName)
       ├─ confirm dialog
       ├─ fileTable.deleteFileRecord(fileName)
       └─ getAllFiles() 재조회 → 리스트 갱신
       (active 잠금 조건 0 — Q4-a-1)
```

**plaintext 경로에서 `loadStores: true`**: encrypted는 `unlockFile` → `Auth.handleVerifyPin` → `initializeStores()` (Auth.tsx:82) 호출로 store가 채워짐. plaintext는 cryptoKey가 없으니 `setupVaultSession`이 `loadStores: true`면 직접 `initializeStores()` 호출.

---

# Proposed Changes

## Step 1 — Dexie v14 migration + fileTable API 재작성

### `src/database/db.ts`
- `FileRecord.id: typeof ACTIVE_FILE_ID` → `FileRecord.id: string`
- `db.version(13) + clear()` 블록 유지 + `db.version(14) + upgrade(tx) where id==='active' → id=fileName` 추가
- `replaceDatabaseData` 트랜잭션 (line 240-258): **`db.files.clear()` 제거**, `await fileTable.upsertFileRecord(fileName, fileDataToSave)`만 유지
- `persistVaultSnapshot` / `tryTriggerAutoBackup` — 변경 0

### `src/database/fileTable.ts`
- `export const ACTIVE_FILE_ID = "active" as const;` — **제거**
- `ActiveFileInfo` 타입은 유지 (caller가 분기 처리)
- 메서드 시그니처 변경 (모두 fileName 명시):
  - `getActiveFileRecord()` → `getFileRecord(fileName: string): Promise<FileRecord | null>`
  - `getActiveFileInfo()` → `getFileInfo(fileName: string): Promise<ActiveFileInfo>`
  - `deleteFileRecord()` → `deleteFileRecord(fileName: string): Promise<void>`
  - `getAllFileNames()` — 유지 (구현 단순: `getAllFiles().map(f => f.fileName)`)
- 신규:
  - `getAllFiles(): Promise<FileRecord[]>` — `db.files.toArray()` (정렬은 호출처 결정)
  - `resolveFileName(desired: string): Promise<string>` — suffix 부여
- `upsertFileRecord` (시그니처 동일): 내부에서 `id: fileName` 사용. `createdAt` 보존하려면 기존 row 조회 후 merge
  - 현재는 매번 `createdAt: now`로 덮어씀 (line 98) — multi-row에서 createdAt이 갱신되면 안 됨 → 기존 row 조회 후 `createdAt` 보존 로직 추가
- `updateFileRecord` (시그니처 동일): 내부에서 `id: fileName` 사용

### `src/database/fileStorage.ts`
- `closeDataFile` (line 238-253): **`fileTable.deleteFileRecord()` 호출 제거** (line 240)
- `unlockFile` (line 259-289):
  - `const { encrypted, fileData, salt, activeFileName } = await fileTable.getActiveFileInfo();`
  - → `const { encrypted, fileData, salt } = await fileTable.getFileInfo(fileName);` 로 변경
  - `if (!activeFileName || activeFileName !== fileName) throw ...` 가드 제거
  - `if (!fileData) throw new Error("File not found: ...")` 가드만 유지
- `createDataFile` (line 297-365): 진입 시 `const resolvedFileName = await fileTable.resolveFileName(normalizedFileName);` (line 301 직후). 이후 모든 `normalizedFileName` 참조를 `resolvedFileName`으로 치환
- `openImportedDataFile` (line 390-506): 진입 시 `const resolvedFileName = await fileTable.resolveFileName(parsedData.fileName);` (line 414 직후). 이후 모든 `normalizedFileName` 참조를 `resolvedFileName`으로 치환
- `setupVaultSession` (line 119-130): **`loadStores?: boolean` 옵션 추가**
  ```ts
  export const setupVaultSession = async ({
    fileName,
    cryptoKey,
    salt,
    loadStores = false,  // ← NEW
  }: {
    fileName: string;
    cryptoKey?: CryptoKey;
    salt?: Uint8Array;
    loadStores?: boolean;
  }): Promise<void> => {
    await useSessionStore.getState().setSession({ fileName, cryptoKey, salt });
    // plaintext 경로에서 Home active 전환 시 store reload
    if (loadStores && !cryptoKey) {
      await initializeStores();
    }
  };
  ```
  - `cryptoKey`가 있는 encrypted 경로는 호출자(`unlockFile` 등)가 `initializeStores()`를 명시적으로 처리 — `loadStores` 플래그는 plaintext만 담당
  - 호출처: `Home.handleSelectFile(fileName)` (plaintext) → `setupVaultSession({ fileName, loadStores: true })`
- `changePin` (line 510-541): **시그니처 확정 — `changePin(fileName: string, newPin: string): Promise<void>` (Option B)**
  - 내부에서 `useSessionStore.getState().activeFileName` 대신 인자 `fileName`을 직접 사용
  - `const { activeFileName, encrypted } = await fileTable.getActiveFileInfo();` (line 511)
  - → `const { encrypted } = await fileTable.getFileInfo(fileName);`
  - `if (!activeFileName)` 가드 → `if (!fileName)` 가드
  - `useSessionStore.getState().setSession({...})` 호출 (line 530)의 `fileName: normalizedFileName` → `fileName: fileName` (인자)
  - `getDatabaseSnapshot(normalizedFileName, ...)` (line 519) → `getDatabaseSnapshot(fileName, ...)`

## Step 2 — 호출처 fileName 기반 갱신

### `src/pages/Auth.tsx`
- line 24-49 `useEffect`:
  - `const { activeFileName, encrypted } = await fileTable.getActiveFileInfo();`
  - → `const { activeFileName } = useSessionStore.getState(); if (!activeFileName) { navigate("/"); return; } const { encrypted, salt } = await fileTable.getFileInfo(activeFileName);`
  - `if (!activeFileName || !encrypted)` 가드는 그대로 유지
- line 108 `handleBiometricLogin`:
  - `const { salt } = await fileTable.getActiveFileInfo();`
  - → `const { salt } = await fileTable.getFileInfo(useSessionStore.getState().activeFileName!);`
- line 17 `useSessionStore((state) => state)`의 `activeFileName: fileName` — 그대로 유지

### `src/pages/Settings/components/DataSection.tsx`
- line 35 `handleBackup`:
  - `const { activeFileName: currentActiveFileName } = await fileTable.getActiveFileInfo();`
  - → `const currentActiveFileName = useSessionStore.getState().activeFileName;`
- line 36: `if (!currentActiveFileName) throw new Error("...");` 가드 추가 (이전엔 activeFileName === null이 빈 정보로 매핑됐지만, 이제는 명시적)

### `src/pages/Settings/components/PinChangeDialog.tsx`
- **시그니처 변경**: `fileName: string` prop 추가
  ```ts
  interface PinChangeDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (newPin: string) => Promise<void>;
    isEncrypted?: boolean;
    fileName: string;  // ← NEW
  }
  ```
- line 56:
  - `const { fileData } = await fileTable.getActiveFileInfo();`
  - → `const { fileData } = await fileTable.getFileInfo(fileName);` (prop 사용)
- line 57 가드 `if (!fileData)` — 유지
- line 64 `onConfirm(newPin)` 호출은 그대로 유지 (caller인 SecuritySection이 `changePin(fileName, newPin)` 처리)

### `src/pages/Settings/components/SecuritySection.tsx`
- line 38-54 `handlePinChange`:
  - `const { activeFileName, encrypted } = await fileTable.getActiveFileInfo();`
  - → `const activeFileName = useSessionStore.getState().activeFileName; if (!activeFileName) throw new Error("활성 데이터 파일이 없습니다."); const { encrypted } = await fileTable.getFileInfo(activeFileName);`
  - `changePin(newPin)` (line 48, 50) → `changePin(activeFileName, newPin)` (fileName 인자 명시)
- line 52 `handlePinChange` 마지막:
  - `const { encrypted: newEncrypted } = await fileTable.getActiveFileInfo();`
  - → `const { encrypted: newEncrypted } = await fileTable.getFileInfo(activeFileName);`
- line 90 `handleBiometricToggle(false)`:
  - `const { activeFileName } = await fileTable.getActiveFileInfo();`
  - → `const activeFileName = useSessionStore.getState().activeFileName;`
  - `SecureKey.deleteKey({ vaultId: activeFileName })` 인자는 그대로 유지
- line 111 `handleBiometricSetupConfirm`:
  - `const { activeFileName } = await fileTable.getActiveFileInfo();`
  - → `const activeFileName = useSessionStore.getState().activeFileName;`
  - `SecureKey.storeKey({ vaultId: activeFileName, key })` 인자는 그대로 유지
- `PinChangeDialog` 사용처 (line 200-205): `<PinChangeDialog fileName={...} ... />`로 prop 전달. `fileName`은 `useSessionStore.getState().activeFileName ?? ""` (caller 책임)
- 변경 0: `handleAutoLockChange` (line 25-36), `checkBiometryAvailability` (line 62-70), `handleBiometricToggle(true)` 분기 (line 78-88)

### `src/hooks/useFileAuthGuard.ts`
- line 23-46:
  - `const { activeFileName, encrypted } = await fileTable.getActiveFileInfo();`
  - → `const sessionActiveFileName = useSessionStore.getState().activeFileName; if (!sessionActiveFileName) { onNoFile?.(); if (!skipRedirect) navigate("/"); return; } const { encrypted } = await fileTable.getFileInfo(sessionActiveFileName);`
  - `useSessionStore.getState()` 호출을 먼저 해서 activeFileName을 확인한 후에만 getFileInfo 호출

### `src/hooks/useFileAuthGuard.test.tsx` (mock 시그니처 갱신)
- `vi.mocked(fileTable).getActiveFileInfo` → `getFileInfo`
- mock data factory: `createMockActiveFileInfo(fileName, overrides)` (fileName을 인자로 받음)
- test case 8개 모두 fileName 인자를 명시적으로 전달하도록 수정

## Step 3 — Home에 파일 리스트 UI + active 전환 + 삭제

### `src/pages/Home.tsx`
- 신규 state: `const [files, setFiles] = useState<FileRecord[]>([]);`
- 기존 `useEffect` (line 22-37)에 `getAllFiles()` 호출 추가:
  ```ts
  useEffect(() => {
    const checkAndLoad = async () => {
      const all = await fileTable.getAllFiles();
      setFiles(all);
      // ... 기존 activeFileName 체크
    };
    checkAndLoad();
  }, []);
  ```
- 신규 핸들러: `handleSelectFile(fileName)`, `handleDeleteFile(fileName)`
- UI: "기존 파일" 섹션 추가 (파일 생성/선택 버튼 위 또는 아래). 각 row:
  ```tsx
  <li key={file.id} className="rounded-2xl border ...">
    <button onClick={() => handleSelectFile(file.fileName)}>
      {file.fileName} {file.id === activeFileName && <span>(active)</span>}
    </button>
    <button onClick={() => handleDeleteFile(file.fileName)} aria-label="삭제">
      <Trash2 />
    </button>
  </li>
  ```
- "파일을 선택하세요" 헤더 텍스트는 유지 (브레인스토밍 §1 사용자 결정 — "Home → 파일 리스트 표시 + 선택 + 생성")

## Step 4 — 테스트 갱신

### `src/database/fileTable.integration.test.ts` (JVM)
- `ACTIVE_FILE_ID` import 제거
- describe 블록 재구성:
  - `parseFileData` — 변경 0
  - `getFileRecord` (신규) — multi-row 시나리오
  - `getFileInfo` (신규) — multi-row 시나리오
  - `getAllFiles` (신규) — N-row 시나리오
  - `getAllFileNames` (유지) — multi-row 시나리오
  - `upsertFileRecord` — 동일 id 재호출 시 같은 row 갱신, 다른 id는 별도 row (id=fileName invariant)
  - `updateFileRecord` — 동일
  - `deleteFileRecord` — fileName 인자 받음, multi-row 중 1개만 삭제
  - **`resolveFileName` (신규)** — 중복 suffix 부여:
    - 빈 DB → desired 그대로
    - desired 존재 → `(1)` 부여
    - desired + `(1)` 존재 → `(2)` 부여
    - `normalizeDataFileName` 적용 (`.json` 강제)
  - `경계값/예외` — multi-row 시나리오 추가
  - **Dexie v13 → v14 마이그레이션 (시나리오 B only)**:
    - `Dexie.delete("kiyo-db")` 후 v13 schema로 재오픈, row 1개(id="active", fileName="my.json") 시드
    - v14 schema로 재오픈 (KiyoDatabase v14 인스턴스)
    - 검증: `db.files.toArray()` → `[{ id: "my.json", fileName: "my.json", ... }]`
    - 검증: `db.files.get("my.json")` !== null
    - 검증: `db.files.get("active")` === undefined (v13 id는 사라짐)
  - 시나리오 A (빈 DB) / C (이미 v14) — **별도 테스트 불필요**: A는 trivial, C는 `if (row.id !== row.fileName)` 멱등성 가드(`Architecture` §v13 → v14 upgrade)에 의존

### `src/database/fileStorage.lifecycle.integration.test.ts` (JVM)
- `db.files.clear()` 의존 제거 (multi-row 모델에서 clear는 close 후에도 발생하지 않음)
- 신규 describe: `multi-vault lifecycle`:
  - vault-one 생성 → close → vault-two 생성 → vault-two가 `(1)` suffix로 생성됨
  - vault-one 행은 close 후에도 보존 (db.files.toArray() === 2)

### `e2e/11-close-datafile.spec.ts` (Playwright) — **갱신 (multi-vault 시나리오)**
- 기존 시나리오 5개 중 3개를 multi-vault 의도로 재작성:
  - "Auth에서 첫 화면으로 돌아가기 후 다시 볼트 생성" → **갱신**: vault-one 생성 → close → vault-two 생성 → vault-two가 `(1).json` suffix로 생성됨을 검증 → DB에 vault-one + vault-two 두 row 보존됨 검증
  - "Settings에서 파일변경 후 다시 볼트 생성" → **갱신**: 동일 패턴
  - "expectStoresReset" → 변경 0 (스토어 초기화 자체는 동일)
- **신규 시나리오 1건 — "같은 이름 재시도 → suffix 발동"**:
  - vault-one 생성 → close (Auth → 첫 화면으로 돌아가기) → Home 진입 → 리스트에 `vault-one.json` 1개 보임 확인
  - "파일 생성" → `vault-one` 입력 → 확인 → /accounts 이동
  - 다시 close → Home 진입
  - Home 리스트에 `vault-one.json` + `vault-one(1).json` 두 row 보임 확인 (`page.getByText('vault-one.json')` + `page.getByText('vault-one(1).json')`)
  - `vault-one(1).json`에 active 표시 확인 (현재 라스트 active)
  - DB 검증: `__KIYO_DEBUG__.getFiles()`로 2개 row 존재 확인 (fileName만 노출, encrypted/salt는 제외)
- 신규 마커 필요:
  - Home에 파일 리스트 섹션이 보이는지 (`page.getByText('기존 파일')` 또는 list selector)
  - 삭제 버튼 클릭 시 confirm dialog
  - 파일 클릭 시 active 전환 후 /auth (encrypted) 또는 /accounts (plaintext)
- `expectStoresReset`는 그대로 유지

---

# Tests

## Unit tests (Vitest) — JVM

| 영역 | 변경 |
|------|------|
| `fileTable.integration.test.ts` | 시그니처 갱신 + multi-row invariant + `resolveFileName` 신규 |
| `fileStorage.lifecycle.integration.test.ts` | multi-vault lifecycle 신규 + `db.files.clear()` 의존 제거 |
| `useFileAuthGuard.test.tsx` | mock 시그니처 갱신 (`getActiveFileInfo` → `getFileInfo`) |
| `fileStorage.changePin.integration.test.ts` | 영향 0 (이미 `useSessionStore.getState()`로 activeFileName 조회 중) — **확인 필요** |
| `accountStore` / `templateStore` 테스트 | 영향 0 |

## Integration tests

- 동일 (위 unit tests에 포함)

## Android tests

- 변경 0 (autofill/Keystore 격리)
- `compileDebugKotlin` + `testDebugUnitTest` + `installDebug`로 회귀 없음 확인 (본 plan 범위)

## E2E tests (Playwright)

| 테스트 | 처리 |
|--------|------|
| `e2e/11-close-datafile.spec.ts` | **multi-vault 시나리오로 재작성** (사용자 확인 2026-08-30). 5개 시나리오 중 3개 갱신, 2개 유지 |
| `e2e/01-03-...` (파일 생성/열기 기존 시나리오) | 영향 0 (FileCreateDialog/FileOpenDialog 시그니처 동일) |
| `e2e/04-09-...` (계정/설정 등) | 영향 0 |

**E2E 회귀 = 0 비대상** (브레인스토밍의 가정 변경). 본 plan은 multi-vault의 본질적 동작 변경으로 11-close-datafile의 의도가 바뀜 — 이는 **갱신이 아닌 "올바른 시나리오로 재작성"**.

## Manual verification

- App: 단일 파일 → 다중 파일 시나리오 수동 검증 (에뮬레이터)
- Dexie v14 마이그레이션: v13 DB에서 export한 데이터로 v14 진입 시 row 승계 확인
- Home 리스트: 생성/선택/삭제 UI 흐름
- 자동잠금 + Home active 전환: autoLock 후 PIN 입력 → unlock 정상

---

# Risks

| 리스크 | 심각도 | 완화 |
|--------|------|------|
| Dexie v14 마이그레이션 실패 → 기존 사용자 데이터 손실 | 상 | v12→v13 패턴 동일 (clear 없이 row id 변경만). **테스트 필수**: v13 → v14 upgrade에서 v13 row 1개가 fileName PK로 승계됨을 검증. 회귀 시 `db.files.clear()` fallback은 의도적으로 배제 (데이터 손실보다 마이그레이션 실패가 더 안전한 신호) |
| `unlockFile`에서 `sessionStore.activeFileName`이 null인 채 호출됨 | 중 | Auth 진입 시 `useSessionStore.getState().activeFileName` 명시적 null 체크 → null이면 `/`로 navigate. `unlockFile` 내부에서도 `if (!fileName) throw` 가드 |
| `closeDataFile`이 더 이상 row를 삭제하지 않음 → `useFileAuthGuard`가 "no file" 판정 실패 | 중 | `useFileAuthGuard`가 `sessionStore.activeFileName`을 먼저 체크 (line 30) → null이면 onNoFile. `getFileInfo` 호출은 activeFileName이 존재할 때만. **테스트 필수**: close 후 useFileAuthGuard가 onNoFile 호출 + / 리다이렉트 |
| Home 리스트에 100+ row 시 성능 | 하 | `getAllFiles()` 단일 query, `toArray()` 한 번. 100건 단위 측정 후 pagination 결정 (후속 plan). 본 plan에서는 단순 list |
| fileName에 emoji/특수문자/공백/슬래시 포함 | 중 | `normalizeDataFileName`이 trim + `.json` 강제. PBKDF2/salt는 fileName과 무관 (salt는 EncryptedKiyoVaultData에 저장). **테스트**: 공백/특수문자 fileName으로 생성 + import 시나리오 |
| `getAllFileNames`가 `getAllFiles`로 단순화되어 호출처 영향 | 하 | `getAllFileNames`는 `getAllFiles().map(f => f.fileName)` 위임 (유지) |
| 자동잠금 + active 전환 race | 중 | `useFileAuthGuard`가 `getFileInfo` 실패 시 `/auth` 리다이렉트. 새 row + active 전환 직후 cryptoKey 없으면 자동으로 `/auth` (의도된 동작) |
| 사용자가 잘못 active 전환 → 이전 active 데이터 유실? | 없음 | **이전 active도 row로 보존**됨. `closeDataFile`이 active fileName만 클리어 (DB row 보존). Home 리스트에서 다시 선택 가능 |
| E2E `11-close-datafile` 갱신 누락 | 중 | plan Step 4에서 명시. PR 전 `npm run test:e2e`로 확인 |
| Android Keystore autofill 인증과 multi-vault 상호작용 | 없음 | autofill DB_KEY는 React 측 active와 독립 (Keystore 자체). **변경 0** |
| Track 3 Plan-A(공통 UI 인프라)와 충돌 | 없음 | Home 리스트는 즉시 필요. Plan-A는 Toast/Skeleton 같은 범용 인프라 — 직교 |
| 사용자가 "단순화" 신호 (메모) | — | Q1~Q8 권장 옵션이 모두 최소 변경. Dexie v14 마이그레이션은 PK만 변경 (인덱스 정의 동일). closeDataFile은 호출 1줄 제거 |

---

# Rollback

## 단계적 롤백

1. **Step 1만 롤백** (Dexie v14 + fileTable API): `db.version(14)` 블록 제거, `db.version(13)` + clear() 복원. `ACTIVE_FILE_ID` 상수 복원. 메서드 시그니처 원복. → 데이터 손실 0이지만 multi-vault 기능 소실

2. **Step 2만 롤백** (호출처 갱신): `getFileInfo(fileName)` → `getActiveFileInfo()`로 원복. `getFileRecord(fileName)` → `getActiveFileRecord()`로 원복. → 마이그레이션은 적용되지만 UI는 단일 파일

3. **Step 3만 롤백** (Home UI): Home 파일 리스트 섹션 제거. → DB는 multi-row, UI는 단일 파일 (덮어쓰기). 회귀 위험

4. **Step 4만 롤백** (테스트): 테스트 복원 + multi-row invariant 추가 안 함. → 회귀 위험 (multi-vault 동작 미검증)

## 전체 롤백

Dexie v14 bump이 **persistent schema 변경**이므로, 한 번 배포된 후 v13로 완전 롤백하려면 마이그레이션 역방향(v14 → v13) 코드 필요. **현재 단계(개발 중, 사용자 0명)에서는 Step 1-4 전체를 revert하면 됨.**

## 데이터 손실 시나리오

- v14 마이그레이션 중 `row.id = row.fileName` 변경이 실패 → v14에서 row가 보이지 않음 → 사용자는 "파일이 사라짐" 체감
- 대응: 마이그레이션 자체를 try/catch로 감싸고 실패 시 row 보존. 또는 **마이그레이션이 idempotent하도록 `row.id !== row.fileName` 체크** (이미 코드에 있음)

---

# Implementation Order (예상 작업 분할)

```
Step 1: Dexie v14 + fileTable API 재작성
  - fileTable.ts (ACTIVE_FILE_ID 제거, 6개 메서드 시그니처 변경, 2개 신규)
  - db.ts (v14 migration + FileRecord.id: string + replaceDatabaseData에서 db.files.clear() 제거)
  - duration: ~2-3h

Step 2: 호출처 갱신
  - fileStorage.ts (createDataFile/openImportedDataFile에 resolveFileName, closeDataFile에서 deleteFileRecord 제거, unlockFile 가드 단순화, changePin)
  - Auth.tsx / DataSection.tsx / PinChangeDialog.tsx / useFileAuthGuard.ts
  - useFileAuthGuard.test.tsx mock 갱신
  - duration: ~2-3h

Step 3: Home UI
  - Home.tsx (파일 리스트 + active 전환 + 삭제)
  - duration: ~1-2h

Step 4: 테스트 갱신
  - fileTable.integration.test.ts (multi-row invariant + resolveFileName)
  - fileStorage.lifecycle.integration.test.ts (multi-vault lifecycle)
  - e2e/11-close-datafile.spec.ts (multi-vault 시나리오 재작성)
  - duration: ~2-3h
```

**예상 합계: 7-11h** (1~2일 집중 작업)

**실제 결과**: 위 Step 1-4 모두 완료. `npm run check` (typecheck + Vitest 21 파일 / 334 테스트) + Android `:app:testDebugUnitTest` BUILD SUCCESSFUL. E2E는 사용자 워크플로우로 직접 실행.

---

# Post-Implementation: Dead Code Cleanup (2026-08-30)

본 plan 범위 외 후속 정리. Step 1-4 코드 검증 중 발견된 dead code 4건 제거. **외부 표면 변화 0 / Android Keystore·autofill·SAF 영향 0.**

## 제거 내역

| # | 항목 | 위치 | 처리 |
|---|------|------|------|
| 1 | `changePin` 중복 `if (!fileName)` 가드 | `src/database/fileStorage.ts:540-542` (line 534와 동일, 인자라 변할 수 없음) | 3줄 삭제 |
| 2 | 주석 처리된 `syncAutofillToken` 블록 | `src/database/fileStorage.ts:146-152` | 12줄 삭제 |
| 3 | 주석 처리된 `importDataFile` 블록 (44줄, `@deprecated`) | `src/database/fileStorage.ts:204-247` | 45줄 삭제 |
| 4 | `syncDatabaseToFile = persistVaultSnapshot` 별칭 (deprecated, 호출처 0) | `src/database/db.ts:185-186` | 2줄 삭제 |

총 **62줄** 제거. `case-sensitive grep` 으로 호출처 0 검증 후 진행 (브레인스토밍 문서의 과거 묘사 매치는 case-insensitive 잡음).

## 보존 결정

- **`fileTable.getAllFileNames`** (`src/database/fileTable.ts:108`): `getAllFiles().map(f => f.fileName)` 위임이지만 `fileTable.integration.test.ts:299, 307`에서 사용 중 → 유지. 진짜 정리하려면 테스트 2건 동시 수정 필요 (별도 정리로 분류).
- **`fileTable.activeFileName` 필드** in `ActiveFileInfo` union: caller 분기처리에 사용 (`Home.tsx:35`, `fileStorage.ts` 등) → 활성 식별 정보로 유지.

## 검증

- `npm run check`: ✅ typecheck 통과, Vitest **21 파일 / 334 테스트 통과** (변경 전과 동일)
- `npm run lint`: pre-existing 에러 10건 (WebsiteSelector.tsx 등) — 본 정리와 무관, exit 0
- Android JVM (`:app:testDebugUnitTest`): 영향 없음 (Native 소스 변경 0)

## 관련 메모

- `getAllFileNames`가 진짜 dead 후보가 되면 다음 정리에서 `getAllFiles().map()` 호출처 2곳(`Home.tsx:27` 패턴)과 함께 묶어서 처리 가능.
- autofill/Keystore와 직교하므로 메모리 변경 불필요.
