# Brainstorm — Files-Only Vault (accountTable/templateTable 제거)

- Date: 2026-09-02
- Worktree: `feat/vault-integrity` (base `origin/dev`)
- Source: 사용자 직접 요청 (`/ce-brainstorm`) — "React에서 어카운트 테이블하고 템플릿 테이블을 없애버리고, files 테이블이랑 스토어만 사용하도록 수정" + 후속 확정 "db.metadata, db.settings 도 정리하도록 추가해줘. **물론 지금 저장하는 파일의 형식이 변경되면 안돼**"
- Status: Brainstorm (no code changed). **사용자 확정**: Q1=A (record 테이블 완전 제거), Q2=a (`syncQueue` 같이 단순화/제거), Q5=✅ (db.metadata/schema 정리), Q6=✅ (db.settings 정리)
- Scope: `db.accounts`/`db.templates`/`db.metadata`/`db.settings` 테이블 + `accountTable`/`templateTable`/`recordEncryption.ts`/`syncQueue`/`db.metadata.write/read` 코드 제거. **사용자 파일 형식 절대 불변** — `KiyoVaultData` JSON 스키마는 그대로 (`version:1`, `accounts[]`, `templates[]`, `metadata[]` 4 필드 유지). snapshot 안에서 metadata 배열은 유지하되, **Dexie에 materialized table로 보관하지 않고 항상 `db.files.fileData` JSON 안에서만 존재**하도록 source of truth 변경. `files` 테이블 + `accountStore`/`templateStore`만으로 vault 상태를 표현.

---

## 1. Problem

KIYO는 같은 vault 데이터를 두 군데에 저장한다:

1. **record-by-record 테이블** — `db.accounts` (PK=`++id`), `db.templates` (PK=string UUID). 각각 AES-GCM으로 row 단위 암호화. CRUD의 source of truth.
2. **snapshot 테이블** — `db.files` (PK=fileName). `KiyoVaultData` 통째로 (평문 or `EncryptedKiyoVaultData`). autosave 결과물.

CRUD 한 번에 `db.accounts` write + `enqueuePersistVaultSnapshot` (`db.files` upsert) = 두 번 write. `replaceDatabaseData` (import/unlock/changePin 경로)는 트랜잭션 내에서 두 테이블 모두 `clear + bulkPut`로 다시 채움. 결과:

- **이중 암호화** — encrypted vault의 경우 `db.accounts` row는 AES-GCM(AES-GCM(KiyoVaultData))로 두 번 감싸짐. 메타데이터/타입 정보는 row 안에서만, 평문은 snapshot에서만 노출.
- **lock race 가드 코드** — `templateTable.getAll`은 `cryptoKey === null`이면 encrypted row를 `null`로 skip하고 sort. `accountTable.getAll`은 placeholder 반환. 이 분기는 record 테이블이 unlocked snapshot과 별개로 존재해서 생긴 인공 분기.
- **Dexie v15 migration 부담** — 이미 v13 (`id` → `ACTIVE_FILE_ID` 승계), v14 (`ACTIVE_FILE_ID` → fileName PK) 마이그레이션이 누적. record 테이블까지 들고 schema bump가 또 누적됨.
- **테스트 표면** — `accountTable.integration.test.ts` (306줄) + `templateTable.integration.test.ts` (277줄) + `recordEncryption.test.ts` (180줄) + 3개 lifecycle/encryption/changePin integration test가 record-by-record 경로를 두텁게 검증. 변경 시 모두 손대야 함.

STRATEGY Boundary #4 ("멀티 볼트는 로컬 파일 단위로만")는 이미 `afff2e1f`로 multi-vault 지원되었고, **이제 single source of truth = files 스냅샷** 으로 좁히는 게 다음 단계. record 테이블은 진부한 잔재.

## 2. Goal

1. `db.accounts` / `db.templates` / `db.metadata` / `db.settings` 테이블 + `accountTable` / `templateTable` 모듈 + record-by-record 암호화 (`recordEncryption.ts`) + `syncQueue`를 제거. **`KiyoVaultData` JSON 스키마는 불변** — `version:1` / `accounts[]` / `templates[]` / `metadata[]` 4 필드 그대로 유지. snapshot 안의 `metadata: FileMetadata[]`는 항상 `db.files.fileData` 안에 살아있고 외부 JSON 파일/import에도 동일하게 보임.
2. `db.version(15)` 마이그레이션에서 4개 테이블 모두 `drop()` (data 손실 0 — `db.files.fileData` 안에 이미 모든 정보 있음; `db.settings`는 어차피 localStorage로 가서 무관).
3. `accountStore` / `templateStore`는 그대로 두되 source of truth를 `files.fileData` (parsed JSON) 로 전환. `addAccount/updateAccount/deleteAccount/createTemplate/...`는 즉시 메모리 set + `persistVaultSnapshot`을 직접 호출. (중간 record 테이블 write 없음.)
4. `syncQueue` 단순화 또는 제거 — Dexie 자체가 transaction 직렬화를 보장하고 files snapshot은 항상 통째로 덮어쓰기라 burst-coalesce 의미가 약해짐.
5. 모든 통합 테스트 (`fileStorage.lifecycle/encryption/changePin`) 와 `RootRedirect.test` / `AccountList.test` 등 store mocking이 files-only 모델에 맞게 갱신.
6. 기존 vault 파일 (v1 format, 평문 + 암호화 모두) 호환 100% — `KiyoVaultData` 타입은 그대로, `files.fileData`만 source of truth. **사용자 파일 형식 불변** (hard constraint).
7. `db.settings` 제거와 함께 `useSettingsStore`에 dead field로 남는 `AppSettings` 모델/타입 정의도 같이 정리 (grep 검증 — `models/account.ts`의 `AppSettings`/`Setting` export는 런타임/테스트에서 0 import).

## 3. Context

### 3.1 인스펙션한 파일/모듈

| 영역 | 파일 | 메모 |
|---|---|---|
| 스키마 | `src/database/db.ts:28-83` | `accounts/templates/files/metadata/settings` 5 테이블. v13 → v14 마이그레이션 누적. **v15 = accounts/templates/metadata/settings 4개 모두 drop** |
| Record table | `src/database/accountTable.ts:1-218` (218줄) | `getAll/getById/create/update/delete/clear/initializeDevData` 7개. 모두 `db.accounts` 직접 접근 |
| Record table | `src/database/templateTable.ts:1-161` (161줄) | `getAll`이 cryptoKey 없으면 encrypted row `null` skip 후 sort (lock race 가드) |
| Record 암호화 | `src/crypto/recordEncryption.ts:1-152` (152줄) | `encryptRecord/decryptRecord/createEncryptedRecord/createPlaintextRecord/updateEncryptedRecord/isEncryptedRecord/generateUUID`. generateUUID는 `db.templates` PK로 쓰였음 — 제거 시 같이 검토 |
| Snapshot builder | `src/database/db.ts:88-107` (`getDatabaseSnapshot`) | `accountTable.getAll + templateTable.getAll + db.metadata.toArray → accounts/templates/metadata` JSON 구성. **메타데이터는 snapshot 안으로 흡수** (이미 JSON 안에 있음) |
| Snapshot writer | `src/database/db.ts:121-178` (`persistVaultSnapshot` + `tryTriggerAutoBackup`) | snapshot을 `files.fileData`로 upsert |
| Sync queue | `src/database/syncQueue.ts:1-49` (49줄) | `enqueuePersistVaultSnapshot` 직렬화/coalesce. files-only 모델에서 의미 재검토 |
| Account store | `src/store/accountStore.ts:1-228` | CRUD 5개 모두 `accountTable.X` 호출 + `_persistAccounts`. `syncToAutofill`/`getAutofillAccounts`는 record 테이블 무관 |
| Template store | `src/store/templateStore.ts:1-133` | CRUD 4개 + `loadTemplates` 모두 `templateTable.X` 호출 |
| Vault lifecycle | `src/database/fileStorage.ts:1-512` | `createDataFile`/`unlockFile`/`openImportedDataFile`/`changePin`/`closeDataFile`/`lockDataFile` 모두 `replaceDatabaseData` 호출 (트랜잭션에서 record 테이블 clear + bulkPut). 모두 제거 대상 |
| Replace data | `src/database/db.ts:194-284` (`replaceDatabaseData`) | 3단계 (암호화 → 트랜잭션) — 2단계에서 record 테이블 clear + bulkPut + metadata clear + bulkPut. **files-only에서는 bulkPut 블록 전부 제거**, 트랜잭션은 `fileTable.upsertFileRecord`만 |
| Init flow | `src/database/fileStorage.ts:123-127` (`initializeStores`) | `useAccountStore.setState({initialized:false}) + useTemplateStore.setState({initialized:false}) + loadAccounts + loadTemplates` 병렬 |
| Dev seed | `src/database/fileStorage.ts:278` (`accountTable.initializeDevData`) | `VITE_E2E` 아닐 때만 dev용 account seed — files-only 모델에선 snapshot 직접 upsert로 대체 |
| **db.metadata 사용처** | `src/database/db.ts:103` (`getDatabaseSnapshot`), `:272` (`replaceDatabaseData` clear), `:280` (bulkPut), `:299` (`initializeDatabase` put) + `closeDataFile` line 196 | **테이블은 drop 대상**이지만 `KiyoVaultData.metadata: FileMetadata[]` 필드는 snapshot 안에 살아있음 — `files.fileData` JSON에서 직접 read/write |
| **db.settings 사용처** | **grep 0건** (runtime에서 import/read/write 모두 없음) | `useSettingsStore`는 zustand `persist` middleware로 `localStorage` (`name: "kiyo-settings"`)에 저장. `db.settings`는 **dead table**. **테이블 + `AppSettings` 모델은 settings 부분에서만** 안전하게 drop. 단, `AppSettings`는 `models/account.ts`에 정의되어 있고 다른 곳에서 import되지 않음 — 같이 drop |
| Settings store | `src/store/settingsStore.ts` | zustand `persist` (localStorage) — **변경 없음** |
| Tests (record table) | `src/database/accountTable.integration.test.ts` (306줄), `templateTable.integration.test.ts` (277줄) | **둘 다 삭제** |
| Tests (record crypto) | `src/crypto/recordEncryption.test.ts` (180줄) | **삭제** (모듈 자체 제거) |
| Tests (lifecycle) | `src/database/fileStorage.lifecycle.integration.test.ts` (812줄), `encryption.integration.test.ts`, `changePin.integration.test.ts` | `db.accounts.clear()`/`db.templates.clear()`/`db.settings.clear()`/`db.metadata.clear()` + `db.metadata.bulkPut(metadata)` 패턴 — 모두 `files.fileData` 직접 시드로 전환 |
| Tests (page) | `src/pages/AccountList.test.tsx`, `RootRedirect.test.tsx` | store mock에서 record-table API 제거, file-table API는 그대로 |
| Tests (settings) | `src/store/settingsStore.test.ts` | **변경 없음** — zustand persist mock만 사용, `db.settings` 무관 |
| Common setup | `src/test/common.setup.ts` | record-table 사용처 없음 — 변경 없음 |
| Autofill sync | `src/store/accountStore.ts:111-156` (`syncToAutofill`) | `getAutofillAccounts`가 `accounts` 메모리 상태에서 직접 도출. record 테이블 무관 — **변경 없음** |
| Multi-vault 가정 | `docs/brainstorms/2026-08-30-multi-vault-support.md` §1 | `afff2e1f`로 files PK=fileName 이미 적용. 본 brainstorm의 전제 |
| Crypto boundary | `STRATEGY §2` Boundary #1, #3, #4 | 네트워크 0, 클라우드 0, 멀티볼트는 로컬 파일 단위로만 — files-only와 직접 정합 |

### 3.2 호출처 그래프 (현재 → 이후)

```
[현재: mutation 한 번에 write 두 번 + metadata 보조 write]

addAccount(acct)
  └─ accountTable.create(acct, key)            // → db.accounts (record-by-record 암호화)
  └─ set({ accounts: [acct, ...] })
  └─ _persistAccounts → enqueuePersistVaultSnapshot → persistVaultSnapshot
        ├─ getDatabaseSnapshot (accountTable.getAll + templateTable.getAll + db.metadata.toArray → JSON)
        ├─ encryptData → fileTable.upsertFileRecord → db.files

[Initialize / replaceDatabaseData]
  └─ db.transaction("rw", db.accounts, db.templates, db.metadata, db.files, ...)
        ├─ db.accounts.clear() + db.templates.clear() + db.metadata.clear()
        ├─ db.accounts.bulkPut + db.templates.bulkPut + db.metadata.bulkPut
        └─ fileTable.upsertFileRecord

[closeDataFile]
  └─ db.metadata.clear()        // 직접 clear (별도 store 없음)
  └─ clearAccounts() + clearTemplates() → accountTable.clear + templateTable.clear
```

```
[이후: mutation 한 번에 write 한 번 — files 단독]

addAccount(acct)
  └─ set({ accounts: [acct, ...] })           // 메모리 only
  └─ persistVaultSnapshot                      // → db.files (snapshot 통째로)
        ├─ getDatabaseSnapshot (files.fileData JSON parse → accounts/templates/metadata — record 테이블 의존 0)
        ├─ encryptData → fileTable.upsertFileRecord

[Initialize / replaceDatabaseData]
  └─ 트랜잭션 없음 — fileTable.upsertFileRecord(fileName, fileDataToSave) 단일 호출
        └─ record 테이블 / metadata 테이블 clear + bulkPut 블록 전부 제거

[closeDataFile]
  └─ session.clearSession (activeFileName null)
  └─ clearAccounts() + clearTemplates() → 메모리 store reset만 (record 테이블 clear 불필요, 테이블 자체가 없음)
```

load path는 record 테이블 read가 사라지므로 `files.fileData` parse 한 번으로 끝남. lock race 가드 (`cryptoKey === null`이면 row skip) 도 files 스냅샷이 이미 locked/unlocked 단일 상태라 자연스럽게 해소.

### 3.3 syncQueue 의미 재평가 (Q2=a 근거)

현재 `syncQueue`는 `enqueuePersistVaultSnapshot` burst를 직렬화/coalesce:
- **직렬화**: 동시에 여러 mutation이 들어와도 `persistVaultSnapshot`이 한 번에 하나씩 실행되도록 락. Dexie 자체가 transaction 안에서 직렬화하므로 동시 호출은 어차피 serialized. 하지만 `persistVaultSnapshot`은 트랜잭션 없이 `getDatabaseSnapshot → encryptData → upsertFileRecord` 순으로 await — Dexie write는 마지막 upsertFileRecord만 트랜잭션.
- **coalesce**: getter를 실행 시점에 평가해서 최신 세션 상태를 읽음. mutation burst에서 마지막 mutation의 `activeFileName`/`cryptoKey`/`salt`를 보장.

files-only 모델에서:
- **직렬화**: `persistVaultSnapshot` 전체가 await 흐름이라 JS 단일 스레드 + `await` 체인에서 자연 직렬화. 추가 락 불필요.
- **coalesce**: getter를 호출 시점에 평가하는 패턴은 여전히 유효 — mutation A가 enqueue 후 mutation B가 enqueue해도 실행 시점에 B의 세션 상태를 읽음. 다만 burst 폭(coalesce window)이 짧아짐 (Dexie write 직렬화로 queue가 자연스럽게 짧음).

**결론**: syncQueue는 안전망으로 의미가 약해지지만, **burst 폭이 줄고 getter 평가 패턴은 유지 가능**. 옵션:
- **(a-1) 동기화 제거** — 각 mutation이 직접 `persistVaultSnapshot` 호출. `accountStore`의 `_persistAccounts`가 `enqueuePersistVaultSnapshot` 대신 직접 await. 가장 단순.
- **(a-2) queue는 살리되 단순화** — getter 평가 패턴만 유지, 내부 로직은 `while + shift` 한 줄로 축소. `waitForQueueDrain`/`isQueueProcessing`/`getQueueLength` 테스트 헬퍼는 유지.

사용자 확정 **Q2=a** — 본 brainstorm은 (a-1) (제거) 권장. 단, 후속 plan에서 (a-2)도 검토 가능 (보수 옵션).

### 3.4 STRATEGY ↔ 코드 매칭 (ce-brainstorm §8 규칙)

| STRATEGY 원문 | 표면 증거 | 실제 동작 | 진짜 상태 |
|---|---|---|---|
| Boundary #4: "멀티 볼트는 로컬 파일 단위로만" | `db.files` multi-row PK=fileName (v14) | record-by-record 테이블이 추가로 active vault의 CRUD 소스 | ⚠️ 부분 — files는 multi-row OK지만 source of truth 아님 |
| "오프라인 단일 JSON 파일" (README/STRATEGY) | files.fileData = `KiyoVaultData` 스냅샷 | record 테이블이 snapshot과 분리된 CRUD 소스 | ⚠️ 부분 — JSON은 있지만 record 테이블이 또 다른 소스 |
| "모든 데이터 로컬 저장, 클라우드 0" | record + files 모두 로컬 | 동일 | ✅ |
| "PIN → PBKDF2 → AES-GCM 레코드 단위 암호화" | `recordEncryption.ts` AES-GCM row 단위 | vault snapshot AES-GCM도 존재 (이중 암호화) | ⚠️ — "레코드 단위"가 snapshot과 중복 |

본 brainstorm은 ⚠️ → ✅ 전환.

### 3.5 기존 결정과의 정합 (이전 brainstorm/plan 발췌)

- [2026-08-30-multi-vault-support.md](2026-08-30-multi-vault-support.md) §1 — "DB schema는 multi-row 가능, 비즈니스 로직이 단일 강제" 였던 문제를 v14 PK 승격으로 해결. 본 brainstorm은 **그 다음 단계** — source of truth 자체를 좁힘. **순서 정합**: 본 brainstorm은 multi-vault plan 이후 실행되어야 함 (이미 ✅).
- [2026-08-29-vault-file-integrity.md](2026-08-29-vault-file-integrity.md) §3.3 — autosave 의미 변경 (외부 `/Documents` 자동 export 제거, `db.files` upsert만). 본 brainstorm은 그 위에서 record 테이블도 제거. **정합**.
- Plan-D (FOUC 가드 + 라우팅) — `RootRedirect.tsx`가 `initializeStores` 호출. `initializeStores`는 그대로 두되 내부 구현만 files-only에 맞게 변경. **영향 최소**.

### 3.6 Caller 흐름 — read/write 단일 진입점 (핵심 설계)

**원칙**:
- **`db.files → 스토어`** (read 방향) 진입점은 **`loadVaultToStores(decrypted: KiyoVaultData)`** 한 함수에 수렴. **caller가 미리 decrypt한 결과를 명시적으로 전달** — `unlockFile`/`openImportedDataFile`/`activatePlaintextVault`/`RootRedirect.initializeStores` 모두 이미 흐름에서 한 번 복호화/parse한 데이터를 가지고 있어서 **중복 decrypt 0**. **fileName 인자 불필요** — 모든 caller가 호출 직전에 `useSessionStore.getState().setSession({ fileName })`으로 session에 등록하므로, `loadVaultToStores`는 session state만 읽으면 됨. caller가 매번 같은 값 두 번 넘기는 부담 제거.
- **`스토어 → db.files`** (write 방향) 진입점은 **`saveStoresToFile()`** 한 함수에 수렴.
- `replaceDatabaseData` (현재 91줄, 6곳에서 호출) 는 두 진입점 사이에 끼어 있던 "DB 갈아끼우기 어댑터" — record 테이블 drop 후 어댑터 자체가 필요 없어져 **삭제 대상**.

#### 현재 흐름 vs 목표 흐름 — caller별

| Caller | 현재 (요약) | 목표 (요약) |
|---|---|---|
| `createDataFile(fileName, pin?)` | dev seed + builtin templates write → setupVaultSession → initializeStores → getDatabaseSnapshot → persistVaultRecord | setupVaultSession → store 직접 set (dev seed + builtin) → **saveStoresToFile** (※ **loadVaultToStores 호출 안 함** — 이미 store에 데이터 있음, 불필요한 read 회피) |
| `unlockFile(fileName, pin)` | getFileInfo → decrypt → setupVaultSession → **replaceDatabaseData** (트랜잭션: 5테이블 clear + bulkPut) → initializeStores | getFileInfo → decrypt → setupVaultSession → **loadVaultToStores(decrypted)** (이미 decrypt한 결과 전달, 중복 decrypt 0) |
| `openImportedDataFile(data, pin, fileName)` (encrypted 분기) | parse → decrypt → setupVaultSession → **replaceDatabaseData** → initializeStores | parse → decrypt → setupVaultSession → **loadVaultToStores(decrypted)** |
| `openImportedDataFile(data, pin, fileName)` (plaintext 분기) | parse → setupVaultSession → **replaceDatabaseData** → initializeStores | parse → setupVaultSession → **loadVaultToStores(parsedData)** (plaintext도 `KiyoVaultData` shape 그대로) |
| `changePin(fileName, newPin)` | getFileInfo → getDatabaseSnapshot → encryptData → **replaceDatabaseData** → initializeStores | getFileInfo → setupVaultSession (newKey) → **saveStoresToFile** (현재 메모리 상태 재암호화 write, load 없음) |
| `Home.handleSelectFile` (plaintext 분기) | getFileInfo → setupVaultSession → **replaceDatabaseData** → initializeStores | **activatePlaintextVault(fileName)** 호출 — 내부에서 getFileInfo + setupVaultSession + loadVaultToStores 통합 (caller는 `navigate("/accounts")`만) |
| `Home.handleSelectFile` (encrypted 분기) | getFileInfo → setupVaultSession → navigate("/auth") (load 안 함) | **변경 없음** — encrypted + cryptoKey 없는 경로는 `/auth`로 보내고 load 안 함. `/auth`에서 unlock 완료 후 `unlockFile` 경로로 진입 |
| `RootRedirect.initializeStores` (plaintext active 도달 시) | initializeStores → loadAccounts + loadTemplates (record 테이블 read) | **loadVaultToStores(parsedData)** — plaintext active 시 `info.fileData`를 미리 확보해서 인자로 전달 (fileName은 effect 1에서 setSession으로 등록) |
| `addAccount` / `updateAccount` / `deleteAccount` | `accountTable.X` (record write) → enqueuePersistVaultSnapshot → persistVaultSnapshot | `set({ accounts: [...] })` (메모리만) → **saveStoresToFile** |
| `createTemplate` / `updateTemplate` / `deleteTemplate` | `templateTable.X` (record write) → enqueuePersistVaultSnapshot → persistVaultSnapshot | `set({ templates: [...] })` (메모리만) → **saveStoresToFile** |
| `lockDataFile` | session.clearCryptoKey | session.clearCryptoKey (동일) |
| `closeDataFile` | session.clearSession + db.metadata.clear + clearAccounts + clearTemplates + autofill clear | session.clearSession + accountStore.setState({accounts:[], initialized:false}) + templateStore.setState({templates:[], initialized:false}) + autofill clear |

### Store 책임 재정의 (init 패턴)

**원칙**: 각 store는 자기 source를 모른다 — caller(`loadVaultToStores`/`saveStoresToFile`)가 orchestration. store는 **get/set(init)만** 담당.

**store 메서드 (목표)**:

| Store | 상태 | 메서드 |
|---|---|---|
| `accountStore` | `accounts: Account[]` | `init(accounts: Account[])`, `getAll(): Account[]`, `addAccount`/`updateAccount`/`deleteAccount` (CRUD — 메모리 set + `saveStoresToFile`) |
| `templateStore` | `templates: Template[]` | `init(templates: Template[])`, `getAll(): Template[]`, `createTemplate`/`updateTemplate`/`deleteTemplate` |
| `metadataStore` (신규) | `metadata: FileMetadata[]` | `init(metadata: FileMetadata[])`, `getAll(): FileMetadata[]` (CRUD 없음 — 초기 1회 seed 후 거의 불변) |

**`loadVaultToStores` 본체**:
```ts
loadVaultToStores(decrypted):
  // session check (invariant)
  accountStore.init(decrypted.accounts)
  templateStore.init(decrypted.templates)
  metadataStore.init(decrypted.metadata)
```

**`saveStoresToFile` 본체**:
```ts
saveStoresToFile():
  const session = useSessionStore.getState()
  if (!session.activeFileName) return
  const data: KiyoVaultData = {
    version: 1,
    fileName: session.activeFileName,
    updatedAt: Date.now(),
    accounts: accountStore.getAll(),
    templates: templateStore.getAll(),
    metadata: metadataStore.getAll(),
  }
  // encrypt + upsert
```

**삭제 대상 메서드** (files-only 모델에서 source가 없음):
- `accountStore.loadAccounts` — record 테이블 read 의존 → 제거
- `templateStore.loadTemplates` — record 테이블 read 의존 → 제거
- `templateStore.getTemplate(id)` — store에 data 있으므로 동작 가능, **유지** (CRUD helper)

**호출처 영향**:
- `RootRedirect.initializeStores` → `loadVaultToStores(decrypted)`로 흡수
- `useFileAuthGuard.onInitialized` → 동일하게 `loadVaultToStores`로 흡수 (caller가 decrypted 확보)
- `AccountList`/`Templates` 페이지의 `useAccountStore.loadAccounts`/`useTemplateStore.loadTemplates` 사용 → **store에서 메서드 제거 시 컴파일 에러**. 후속 plan에서 제거 처리 (사용처 0이 되도록).

**invariant**: store에 데이터가 있는데 `initialized: false`인 상태는 발생하지 않음. `init()` 호출 = `initialized: true` set. `closeDataFile`/`lockDataFile`은 session만 정리하고 store 데이터는 유지 (재진입 시 빈 화면 방지를 위해 데이터 유지 정책; 또는 명확히 reset 정책 — 후속 plan 결정).

**중요 — `activatePlaintextVault` 신규 도입**: `Home.handleSelectFile`의 plaintext 분기(5단계: getFileInfo → setupVaultSession → replaceDatabaseData → initializeStores → navigate)를 `src/database/fileStorage.ts`에 명시적 함수로 추출. `unlockFile`(encrypted)과 짝을 이루는 진입점:

```ts
export async function activatePlaintextVault(fileName: string): Promise<void> {
  const info = await fileTable.getFileInfo(fileName);
  if (!info.activeFileName) throw new Error(`File not found: ${fileName}`);
  if (info.encrypted) {
    throw new Error("activatePlaintextVault: vault is encrypted, use unlockFile");
  }
  await useSessionStore.getState().setSession({ fileName });
  await loadVaultToStores(info.fileData as KiyoVaultData);
}
```

→ Home의 plaintext 분기는 `await activatePlaintextVault(fileName); navigate("/accounts", { replace: true });` 두 줄로 단축. **caller가 `replaceDatabaseData`/`initializeStores`를 직접 만지지 않음** — read 진입점은 `loadVaultToStores` / `activatePlaintextVault` / `unlockFile` 셋만 알면 됨.

**중요 — 모든 `loadVaultToStores` caller는 이미 `decrypted`/`parsedData`를 확보한 상태로 진입** — 흐름상 중복 decrypt 0. 다음 invariant 보장:
- `unlockFile`: `decryptVaultData` 결과 (이미 `decrypted` 보유) → 인자로 전달
- `openImportedDataFile`: encrypted는 `decryptVaultData` 결과, plaintext는 `JSON.parse` 결과 → 둘 다 `KiyoVaultData` shape
- `activatePlaintextVault`: 내부에서 `getFileInfo` 호출 → 결과의 `info.fileData`를 `loadVaultToStores`에 전달
- `Home.handleSelectFile` plaintext: 위 `activatePlaintextVault` 호출로 흡수
- `RootRedirect.initializeStores`: plaintext active vault만 진입 — `getFileInfo` 결과의 `parsedData`를 인자로 전달. encrypted + cryptoKey 없으면 `/auth`로 navigate (load 없음)

→ `loadVaultToStores` 내부에서 다시 `getFileInfo`/`decryptData`를 호출할 일 0. **단일 책임 = "주어진 KiyoVaultData로 store만 채운다"**.

**중요 — `createDataFile` 비대칭**: 새 vault를 만드는 경로라 **store는 이미 채워진 상태**로 끝남. `loadVaultToStores`를 또 호출하면 불필요한 read가 발생하고 (방금 write한 fileData를 다시 parse) 동기는 "load"가 아니라 "save"가 끝난 상태. 따라서 **createDataFile → saveStoresToFile만** 호출하고 loadVaultToStores는 호출 안 함.

**read/write 비대칭 정리**:
- **write only** (load 없음): `createDataFile` — store 채워진 상태로 시작 → `saveStoresToFile`
- **read only** (`loadVaultToStores`): `unlockFile`, `openImportedDataFile` (encrypted/plaintext), `Home.handleSelectFile` (plaintext), `RootRedirect.initializeStores` (plaintext) — caller가 미리 decrypt/parse한 데이터를 인자로 전달
- **both** (re-key 등): `changePin` — cryptoKey 갱신이라 store는 그대로, file만 재암호화 → `saveStoresToFile`
- **store mutation**: `addAccount`/... — store set + `saveStoresToFile` (file read 없음)

#### `replaceDatabaseData`가 사라지는 이유

1. **record 테이블이 없음** — `db.accounts`/`db.templates`/`db.metadata` 모두 drop. clear + bulkPut 블록 자체가 코드가 됨.
2. **트랜잭션도 필요 없음** — `fileTable.upsertFileRecord` 단일 호출이 곧 진실. 트랜잭션 안에 묶을 다른 테이블이 없음.
3. **암호화 단계가 caller로 올라감** — 현재 `replaceDatabaseData`가 트랜잭션 밖에서 `createEncryptedRecord`/`createPlaintextRecord`로 row를 빌드하는 1단계를 둠. files-only에서는 `saveStoresToFile()`이 그 역할을 흡수 (memory store → KiyoVaultData → encryptData → upsertFileRecord).
4. **"replace"라는 의미가 사라짐** — 더 이상 갈아끼울 record 테이블이 없으니 단순 "upsert file" 한 줄로 끝남. 함수명은 `replaceDatabaseData`가 아니라 `upsertVaultFile(fileName, fileData)` 또는 `saveStoresToFile()`가 됨.
5. **Q4 (signature 단일화) 자동 해소** — 이전 brainstorm §9 Q4 "replaceDatabaseData 4-인자 단일화 검토" → **함수 자체가 사라지므로 Q4도 자동 해결**.

#### 핵심 진입점 함수 — 예상 시그니처

```ts
// db.files → 스토어 (read only, vault 활성화 시점)
// decrypted는 caller가 미리 확보한 KiyoVaultData. 함수 내부에서 getFileInfo/decryptData 호출 0.
// fileName은 sessionStore.activeFileName에서 읽음 — caller가 setSession 직후 호출하는 invariant.
// 모든 store에 init()을 호출해 명시적으로 데이터 분배 (각 store는 자기 source를 모름).
export async function loadVaultToStores(
  decrypted: KiyoVaultData,
): Promise<void> {
  const { activeFileName } = useSessionStore.getState();
  if (!activeFileName) throw new Error("loadVaultToStores: no activeFileName in session");

  useAccountStore.getState().init(decrypted.accounts);
  useTemplateStore.getState().init(decrypted.templates);
  useMetadataStore.getState().init(decrypted.metadata);
}

// 스토어 → db.files (write only, mutation 발생 시)
// 각 store의 getAll()로 snapshot 구성. store는 source를 모르고 caller만 orchestration.
export async function saveStoresToFile(): Promise<void> {
  const session = useSessionStore.getState();
  if (!session.activeFileName) return; // no-op
  const data: KiyoVaultData = {
    version: 1,
    fileName: session.activeFileName,
    updatedAt: Date.now(),
    accounts: useAccountStore.getState().getAll(),
    templates: useTemplateStore.getState().getAll(),
    metadata: useMetadataStore.getState().getAll(),
  };
  if (session.cryptoKey && session.salt) {
    const encrypted = await encryptData(data, session.cryptoKey, session.salt);
    await fileTable.upsertFileRecord(session.activeFileName, encrypted);
  } else {
    await fileTable.upsertFileRecord(session.activeFileName, data);
  }
  // auto-backup은 persistVaultSnapshot의 트리거처럼 별도 옵션
}
```

**caller별 호출 예시**:

```ts
// unlockFile (encrypted)
const { encrypted, fileData, salt } = await fileTable.getFileInfo(fileName);
const { decrypted, cryptoKey } = await decryptVaultData(fileData, pin, salt);
await useSessionStore.getState().setSession({ fileName, cryptoKey, salt });
await loadVaultToStores(decrypted); // setSession 직후 호출, fileName은 session에서 읽음

// activatePlaintextVault (Home plaintext 진입점)
const info = await fileTable.getFileInfo(fileName);
if (info.encrypted) throw new Error("..."); // 또는 caller가 분기 — navigate("/auth")
await useSessionStore.getState().setSession({ fileName });
await loadVaultToStores(info.fileData as KiyoVaultData);

// Home.handleSelectFile caller 코드 (목표)
// await activatePlaintextVault(fileName);
// navigate("/accounts", { replace: true });

// openImportedDataFile (encrypted)
const { decryptedVaultData, cryptoKey } = await decryptVaultData(parsedData, pin, salt);
await useSessionStore.getState().setSession({ fileName: resolvedFileName, cryptoKey, salt });
await loadVaultToStores(decryptedVaultData);

// openImportedDataFile (plaintext)
await useSessionStore.getState().setSession({ fileName: resolvedFileName });
await loadVaultToStores(parsedData as KiyoVaultData);

// RootRedirect (plaintext active 도달 시)
// session.activeFileName은 이미 effect 1에서 동기화됨 (sessionStore는 caller가 setSession하지 않음 —
// effect가 직접 setActiveFileName 호출 후, decrypted는 info.fileData에서 직접 가져옴)
const activeFileName = useSessionStore.getState().activeFileName;
const info = await fileTable.getFileInfo(activeFileName!); // 이미 effect 1에서 호출됨
// effect 안에서 activeFileName 변경 시점에 setSession도 같이 호출하도록 rootRedirect 로직 보강 필요 (후속 plan 결정)
await loadVaultToStores(info.fileData as KiyoVaultData);

// createDataFile (write only, load 없음)
await useSessionStore.getState().setSession({ fileName: resolvedFileName, cryptoKey, salt });
// store는 이미 채워진 상태 (dev seed + builtin templates)
await saveStoresToFile();

// addAccount (mutation)
useAccountStore.setState({ accounts: [newAccount, ...state.accounts] });
await saveStoresToFile();
```

#### Read 진입점 함수 정리

| 함수 | 책임 | caller |
|---|---|---|
| `loadVaultToStores(decrypted)` | 주어진 `KiyoVaultData`로 store만 채움. `getFileInfo`/`decryptData` 호출 0. fileName은 `session.activeFileName`에서 읽음. | `unlockFile`, `openImportedDataFile`, `activatePlaintextVault`, `RootRedirect.initializeStores` (직접) |
| `activatePlaintextVault(fileName)` | `getFileInfo` → 평문 확인 → session 설정 → `loadVaultToStores` 호출. encrypted면 throw. | `Home.handleSelectFile` (plaintext 분기) |
| `unlockFile(fileName, pin)` | `getFileInfo` → decrypt → session 설정 → `loadVaultToStores(decrypted)` | `Auth.handleVerifyPin`, `Auth.handleBiometricLogin` 후속 |

→ caller는 **read 진입점 셋 중 하나만 알면 됨**. `replaceDatabaseData`/`initializeStores`/record 테이블 API는 caller가 직접 만지지 않음.

## 4. Constraints

- **STRATEGY Boundary #1, #3, #4** — 네트워크 0, 클라우드 0, 멀티볼트 로컬 파일 단위. 모두 정합.
- **cryptoKey는 메모리 only** — record 테이블 제거 후에도 유지. `files.fileData` 암호화는 여전히 메모리 key.
- **PBKDF2 100k + AES-GCM 256** — 변경 없음. snapshot 통째로 한 번 암호화.
- **Android Keystore autofill 인증** — React 측 record 테이블 제거와 완전 무관. autofill DB_KEY는 Android native. **영향 0**.
- **E2E (Android Autofill / Biometric / Autosave)** — 모두 `db.accounts`/`db.templates`가 아니라 `kiyo_autofill.db` (native SQLite) 사용. 단, `AutosaveE2E`는 React 사이드 `db.files` upsert 검증 — `persistVaultSnapshot` signature 유지하면 통과.
- **Web Playwright E2E** — `RootRedirect.test.tsx`, `AccountList.test.tsx` 등에서 store mock 패턴. record-table API mock 제거, file-table API는 그대로.
- **Dexie schema migration** — v15 추가: `upgrade(async (tx) => { await tx.table("accounts").drop(); await tx.table("templates").drop(); })`. `db.files`는 유지 (PK=fileName). 기존 사용자 vault 데이터 손실 0 (snapshot이 이미 모든 정보 보관).
- **cryptoKey 무효화 race** — `lockDataFile` → `clearCryptoKey` → 다음 mutation 시도 시 snapshot read가 encrypted JSON을 그대로 반환 (lock 후 다음 mutation은 AccountList가 read를 막지만 store load는 snapshot을 parse해 placeholder 반환 정책 필요). 별도 sub-decision (Q3).
- **syncQueue 제거 시 race window** — `addAccount` burst가 동시에 들어와도 JS 단일 스레드라 `set`이 동기, `persistVaultSnapshot`은 await. `persistVaultSnapshot`이 in-flight일 때 다른 mutation이 들어오면 snapshot이 stale 가능. (a-2 유지 시 자동 흡수.)
- **테스트 분해** — record-table 3개 test 파일 + recordEncryption 1개 = 4개 파일 삭제. lifecycle 3개 + page 2개 + RootRedirect 1개 = 6개 파일 갱신.

## 5. Existing Architecture (현재 → 목표)

```
[현재]

[User mutation]
  └─ accountStore / templateStore (Zustand)
       ├─ accountTable.create/update/delete (db.accounts write — record-by-record AES-GCM)
       └─ _persistAccounts → enqueuePersistVaultSnapshot → persistVaultSnapshot
            ├─ getDatabaseSnapshot (accountTable.getAll + templateTable.getAll + db.metadata.toArray)
            ├─ encryptData (snapshot AES-GCM)
            └─ fileTable.upsertFileRecord (db.files upsert)

[Lock race]
  └─ templateTable.getAll: cryptoKey 없으면 encrypted row → null skip 후 sort
  └─ accountTable.getAll: cryptoKey 없으면 placeholder 반환

[Initialize]
  └─ createDataFile/unlockFile/openImportedDataFile/changePin
       └─ replaceDatabaseData: db.accounts.clear + db.templates.clear + db.metadata.clear + bulkPut (트랜잭션)

[Settings]
  └─ useSettingsStore (zustand persist → localStorage "kiyo-settings")
       └─ db.settings: dead (import/read/write 0)
```

```
[목표]

[User mutation]
  └─ accountStore / templateStore (Zustand)
       ├─ set({ accounts: [...new, ...] }) (메모리 only)
       └─ persistVaultSnapshot (직접 await, queue 없음)
            ├─ getDatabaseSnapshot (files.fileData JSON parse → accounts/templates)
            ├─ encryptData
            └─ fileTable.upsertFileRecord

[Lock race]
  └─ getDatabaseSnapshot: cryptoKey 없으면 encrypted snapshot 그대로 파싱 (placeholder accounts 반환, templates는 throw → store catch)
  └─ 또는: loadAccounts/loadTemplates가 cryptoKey 상태 보고 placeholder 반환 정책 명시 (Q3)

[Initialize]
  └─ createDataFile/unlockFile/openImportedDataFile/changePin
       └─ replaceDatabaseData: db.metadata.clear + fileTable.upsertFileRecord (record 테이블 clear 블록 삭제)
```

## 6. Options

### Option A — Record 테이블 완전 제거 + syncQueue 제거 (권장)

**범위**: 사용자 확정 Q1=A, Q2=a. Dexie schema v15에서 `accounts`/`templates` drop, 5개 모듈/파일 삭제, store는 snapshot 참조로 전환, `syncQueue.ts` 제거 (또는 한 줄 wrapper로 축소).

| 장점 | 단점 |
|---|---|
| source of truth 명확화 — files snapshot 단일 | schema migration 1회 부담 (v15) |
| lock race 가드 코드 자연 소멸 | mutation burst 시 snapshot stale 가능 (단, JS 단일 스레드라 마지막 await 결과는 최신) |
| 테스트 4개 파일 삭제 (record-table 2 + recordEncryption 1, 나머지 1개는 recordEncryption이 함께 정리) | lifecycle integration test 시드 헬퍼 교체 필요 |
| Dexie schema 단순화 — 5 → 3 테이블 | (없음) |
| record-by-record AES-GCM 비용 0 | (없음) |
| store mocking 단순화 — `accountTable`/`templateTable` mock 제거 | (없음) |

| 복잡도 | 보안 | 테스트 | 마이그레이션 |
|---|---|---|---|
| 중간 (schema + 5개 모듈 + 테스트 6개 갱신) | 유지 (snapshot AES-GCM 동일) | 중대 — 6개 파일 갱신, 4개 삭제 | v15 한 번, 기존 사용자 데이터 손실 0 |

**보안 영향**: record-by-record AES-GCM 제거 → snapshot AES-GCM만 유지. 보안 모델 동일 (vault 단위 1회 암호화). 단, **row 단위 검색이 불가능**해짐 — 이미 안 하므로 무관.

**구현 규모 추정**: ~15 files touched, +500/-800 LOC (record/queue 제거로 -800 압도적 우세).

### Option B — Schema 보존 + 런타임만 files로 전환

**범위**: `db.accounts`/`db.templates`는 Dexie에 남기되 `accountTable`/`templateTable`을 thin wrapper로 만들어 `files.fileData`에서 읽기/쓰기 redirect. `recordEncryption.ts`는 그대로 유지 (다른 용도로 잠재 활용 가능).

| 장점 | 단점 |
|---|---|
| schema 변경 0 — Dexie 호환성 우려 0 | dead code (record 테이블은 영원히 빈 채로 남음) |
| 점진적 롤백 가능 | 이중 쓰기 위험 — store가 record 테이블도 우연히 채우면 디버깅 어려움 |
| (비교적 작은 변경) | STRATEGY ↔ 코드 불일치 잔존 |

**결론: 비권장** — dead table이 영구 잔존하고 점진적 롤백 가능성은 그 자체로 anti-pattern. Option A가 cleaner.

### Option C — record 테이블만 제거 + syncQueue는 유지

**범위**: Q1=A만 적용, Q2는 사용자 결정에 따르지만 보수적 선택. `syncQueue.ts`는 `while + shift` 한 줄로 축소만.

| 장점 | 단점 |
|---|---|
| Option A + burst 안전망 | queue 인스턴스가 1줄만 남으면 dead abstraction |
| getter 평가 패턴 유지 | mutation 순서 보장 한 줄로 표현하기 애매 |

**결론**: 사용자 Q2=a 확정으로 Option A 채택. 본 옵션은 fallback.

## 7. Recommended Direction

**Option A 채택 (사용자 확정 Q1=A, Q2=a, Q5=✅, Q6=✅).**

### 파일 형식 불변 보장 (hard constraint)

- `KiyoVaultData` JSON 스키마 4 필드 그대로: `version:1` / `fileName: string` / `updatedAt: number` / `accounts: Account[]` / `templates: Template[]` / `metadata: FileMetadata[]`.
- `EncryptedKiyoVaultData` 그대로.
- `isKiyoFile` / `isEncryptedKiyoVaultData` 가드 그대로.
- 외부 export (.json / SAF) / import 모두 동일.
- **Dexie에서 테이블을 drop해도 snapshot JSON은 무관** — drop은 Dexie storage 최적화일 뿐 사용자 파일에는 영향 없음.

### 구현 단계 (후속 plan에서 분해)

### PR 1 — Read/write 진입점 도입 + record 모듈 정리
1. `src/database/fileStorage.ts` (또는 신규 `src/database/vault.ts`) — `loadVaultToStores(decrypted: KiyoVaultData)`, `activatePlaintextVault(fileName)`, `saveStoresToFile()` 신규 함수 도입. §3.6 시그니처 그대로 — `loadVaultToStores`는 fileName 인자 없이 session.activeFileName에서 읽음 (caller가 setSession 직후 호출하는 invariant). 내부에서 `getFileInfo`/`decryptData` 호출 0. `activatePlaintextVault`는 `getFileInfo` + `setSession` + `loadVaultToStores` 통합 wrapper. `loadVaultToStores` 본체는 store 3개의 `init()`을 호출.
2. `src/database/db.ts` — `db.version(15).stores({ files: "id, fileName, createdAt, updatedAt" }).upgrade(async (tx) => { await tx.table("accounts").drop(); await tx.table("templates").drop(); await tx.table("metadata").drop(); await tx.table("settings").drop(); })`. `KiyoDatabase` 클래스에서 `accounts!`/`templates!`/`metadata!`/`settings!` 타입 선언 제거. `getDatabaseSnapshot`/`replaceDatabaseData`는 **삭제** — 두 함수 모두 `loadVaultToStores`/`saveStoresToFile`에 흡수됨.
3. `src/database/syncQueue.ts` 삭제. `enqueuePersistVaultSnapshot` import는 `accountStore`/`templateStore`에서 직접 `saveStoresToFile` 호출로 교체.
4. `src/database/accountTable.ts`, `src/database/templateTable.ts`, `src/crypto/recordEncryption.ts`, `src/crypto/recordEncryption.test.ts`, `src/database/accountTable.integration.test.ts`, `src/database/templateTable.integration.test.ts` 삭제.
5. `src/database/fileStorage.ts` — 모든 caller (`createDataFile`, `unlockFile`, `openImportedDataFile`, `changePin`, `closeDataFile`, `lockDataFile`) 흐름을 §3.6 caller 표 기준으로 정리. `closeDataFile`의 `db.metadata.clear()` 라인 제거. `unlockFile`/`openImportedDataFile`는 이미 확보한 `decrypted`/`parsedData`를 `loadVaultToStores(decrypted)`에 전달 (fileName 인자 없이). `createDataFile`은 `saveStoresToFile`만 호출.
6. `src/store/accountStore.ts` — CRUD 5개 모두 `accountTable.X` 호출 → 메모리 set + `saveStoresToFile` 직접 호출. **`loadAccounts` 메서드 삭제** (source 없음). **`init(accounts)` 메서드 추가** — store에 데이터 주입 + `initialized: true`. **`getAll()` 메서드 추가** — `saveStoresToFile`에서 사용. `syncToAutofill`/`getAutofillAccounts`는 메모리 store에서 도출 (변경 없음).
7. `src/store/templateStore.ts` — CRUD 4개 모두 `templateTable.X` 호출 → 메모리 set + `saveStoresToFile`. **`loadTemplates` 메서드 삭제**. **`init(templates)` / `getAll()` 메서드 추가** (accountStore와 동일 패턴). `getTemplate(id)` 유지 (CRUD helper).
8. `src/store/metadataStore.ts` (신규) — `metadata: FileMetadata[]` + `init(metadata: FileMetadata[])` + `getAll(): FileMetadata[]`. CRUD 없음. dev/initial seed 정책 — `createDataFile`이 `metadata: [initializeDatabase()]` 1 row로 초기화. 후속 mutation 정책 결정 (Q-후보).
9. `src/store/accountStore.ts`/`templateStore.ts`의 `initialized: false` 가드는 `init()` 내부에서 reset. `isLoading` flag는 init 단일 호출이므로 삭제 (또는 deprecated) — 후속 plan 결정.
10. `src/pages/Home.tsx`의 `handleSelectFile` plaintext 분기 (lines 41-58의 `replaceDatabaseData` + `initializeStores` 호출) → `activatePlaintextVault(fileName)` 호출로 교체. encrypted 분기 (`navigate("/auth")`)는 변경 없음. Home에서 `replaceDatabaseData`/`initializeStores`/`db` import 모두 제거.
11. `src/pages/RootRedirect.tsx`의 `initializeStores()` 호출 → `loadVaultToStores(info.fileData as KiyoVaultData)`로 교체. **effect 1에서 `getFileInfo` 결과를 받는 시점에 `setSession({fileName: activeFileName})`도 함께 호출하도록 보강** (loadVaultToStores의 invariant 충족). encrypted active면 `initializeStores` 자체를 호출 안 함 (`/auth`로 navigate).
12. `src/hooks/useFileAuthGuard.ts`의 `onInitialized` 콜백 — `RootRedirect`와 동일하게 `loadVaultToStores` 호출로 흡수 (plaintext active만 진입). 또는 `RootRedirect`와 동일 helper 사용.
13. `src/models/account.ts`에서 `AppSettings` / `Setting` 타입 export 제거 (grep 검증 — 0 import). `FileMetadata` / `Metadata` 타입은 `KiyoVaultData`에서 여전히 쓰므로 **유지**.

### PR 2 — Test 갱신
1. `src/database/fileStorage.lifecycle.integration.test.ts` — `db.accounts.clear()`/`db.templates.clear()`/`db.metadata.clear()`/`db.settings.clear()` → `db.files.clear()`. `populateTestData`는 `fileTable.upsertFileRecord`로 snapshot 직접 시드. `accountTable.create`/`templateTable.create` 호출은 `useAccountStore.addAccount`/`useTemplateStore.createTemplate`로 교체 (또는 더 단순히 메모리 store 직접 set + `persistVaultSnapshot`). `db.metadata.bulkPut(metadata)` 라인 전부 제거 — snapshot의 `metadata` 필드로 흡수.
2. `src/database/fileStorage.encryption.integration.test.ts` — 동일.
3. `src/database/fileStorage.changePin.integration.test.ts` — 동일.
4. `src/database/fileTable.integration.test.ts` — 동일.
5. `src/pages/AccountList.test.tsx` — store mock에서 `accountTable` API 제거, store 자체의 mutation 직접 호출.
6. `src/pages/RootRedirect.test.tsx` — 동일.

### PR 3 (선택) — Openwiki/STRATEGY 업데이트
1. `openwiki/architecture/data-flow.md` — "Vault CRUD → Auto-Save" 다이어그램에서 `accountTable.create/update/delete with cryptoKey` + `Dexie: accounts table` 라인 제거. `getDatabaseSnapshot` 시퀀스를 `fileTable.getFileInfo → JSON.parse → accounts/templates/metadata` 로 갱신. "Data Consistency Invariants" 표에서 `db.accounts`/`db.templates` 언급 제거.
2. `openwiki/data-models/account.md`, `openwiki/data-models/template.md` — "Stored in `db.accounts`/`db.templates`" 문구 → "Stored in `db.files.fileData` snapshot" 로 갱신. `metadata.md` 문서가 있다면 "Stored in `db.metadata`" → "Stored in `KiyoVaultData.metadata` field of `db.files.fileData`".
3. `openwiki/data-models/vault.md` §Flow — `E: accountTable.getAll + templateTable.getAll` 박스 갱신.
4. STRATEGY.md §1 (Vault Storage) — "PIN → PBKDF2 → AES-GCM **레코드 단위** 암호화" → "PIN → PBKDF2 → AES-GCM (snapshot 통째로)" 로 정합. Boundary #4 진짜 상태 ✅.
5. `openwiki/data-models/account.md` — `AppSettings` 섹션이 별도라면 "settings table" 언급 제거 (zustand localStorage로만 표현).

## 8. Q&A (확정된 결정)

| # | 결정 | 옵션 | 확정 | 비고 |
|---|---|---|---|---|
| Q1 | `db.accounts`/`db.templates` Dexie schema 처리 | **A 완전 제거** | ✅ 2026-09-02 사용자 직접 | "두 테이블 다 없애버리고" 문구 매칭 |
| Q2 | `syncQueue` 처리 | **a 단순화/제거** | ✅ 2026-09-02 사용자 직접 | getter 평가 패턴은 store 자체에 흡수 가능 |
| Q3 | Lock race 시 `getDatabaseSnapshot` 정책 | 미확정 | ⏸ | cryptoKey 없으면 encrypted snapshot은 parse 못함 → store catch 후 placeholder 반환? 또는 loadAccounts를 `useSessionStore.cryptoKey` 가드로 gate? |
| Q4 | `replaceDatabaseData` signature 축소 | 미확정 | ⏸ | 4-인자 → 후속 plan에서 단일화 검토 |
| Q5 | `db.metadata` 정리 | **✅ drop** | ✅ 2026-09-02 사용자 후속 확정 | `KiyoVaultData.metadata: FileMetadata[]` 필드는 snapshot 안에 살아있음 (사용자 파일 형식 불변) |
| Q6 | `db.settings` 정리 | **✅ drop** | ✅ 2026-09-02 사용자 후속 확정 | dead table (runtime 0 import/read/write); `useSettingsStore`는 zustand persist localStorage 사용 |

### Q3 후보 (후속 plan에서 결정)

현재: `templateTable.getAll`이 `cryptoKey === null`이면 encrypted row를 `null` skip. `accountTable.getAll`은 placeholder 반환.

files-only 모델:
- **A**: `getDatabaseSnapshot(activeFileName)` → cryptoKey 있으면 decrypt + parse, 없으면 placeholder accounts + templates 빈 배열 반환. store load는 그대로 통과. 단점: encrypted vault를 잠근 상태에서 AccountList 진입 시 빈 화면 (placeholder 없으면 throw → ErrorScreen).
- **B**: store load 자체를 `useSessionStore.getState().cryptoKey ?? encrypted ? skip : proceed` 로 gate. `useFileAuthGuard`와 중복되지만 명시적. 단점: lock 후 즉시 navigate(`/auth`) 보장.
- **권장**: A + `getDatabaseSnapshot`이 placeholder 분기를 단일 진실 소스로. Q3는 후속 plan에서 단일 Q로 처리.

### 사용자 파일 형식 불변 검증 (hard constraint 체크리스트)

PR 1~2 완료 후 다음 invariants 회귀 테스트 통과해야 함:

1. **Plaintext vault JSON 호환** — `v1 vault` (이전 multi-vault support 적용 사용자) 를 SAF로 export → 다시 import → accounts/templates/metadata 0 손실.
2. **Encrypted vault JSON 호환** — PIN 기반 vault export → 다시 import (PIN 일치) → `decryptData` 성공 + accounts/templates/metadata 0 손실.
3. **`isKiyoFile` 가드 통과** — 기존 v1 file은 모두 통과.
4. **`EncryptedKiyoVaultData` 4 필드 (version/encrypted/salt/iv/ciphertext) 그대로** — `encryption.ts`의 `encryptData`/`decryptData` 시그니처 무변경.
5. **외부 SAF export/import 동작 무변경** — `fileExport.ts`의 `exportBackupFile`/`importBackupFile`/`writeBackupToUri`/`readBackupFromUri` 시그니처 무변경.
6. **`KiyoVaultData.metadata: FileMetadata[]` field** — `KiyoVaultData` type 그대로, file format 그대로.

### 흡수/분리 노트

- `Plan-7a` (다단계 페이지) — 본 brainstorm 범위 밖, 변경 없음.
- `Plan-D` PR 1 (라우팅/FOUC) — `RootRedirect.tsx`의 `initializeStores`는 signature 유지, 내부만 files-only. 변경 폭 최소.
- `Plan-A1` (에러 가시화) — `accountTable.clear` catch에서 throw 보던 부분이 `replaceDatabaseData` catch로 이동. 단일 store 에러 매핑이라 자연 정합.
- **별도 정리** (Q-후보): `recordEncryption.ts` 안의 `generateUUID`는 template PK용이었음 — 본 brainstorm에서 같이 삭제. 다른 곳에서 사용 안 함 (grep 확인됨).

## 9. Open Questions / Risks

- **Q3**: Lock race 시 snapshot placeholder 정책 — 후속 plan에서 단일 결정으로 흡수.
- **Q4**: `replaceDatabaseData` 4-인자 signature 단일화 — 후속 plan에서 흡수 가능.
- **리스크 — Dexie v15 마이그레이션 안전성**: 사용자가 v14 → v15로 업그레이드 시 4개 테이블 drop이 사용자 데이터를 망치지 않는지.
  - `db.accounts`/`db.templates` → snapshot 안에 이미 모든 정보 (이전 multi-vault brainstorm `afff2e1f` 보장). 손실 0.
  - `db.metadata` → snapshot 안에 `metadata: FileMetadata[]` 필드로 살아있음. 손실 0.
  - `db.settings` → 런타임에 0 import/read/write. `useSettingsStore`는 zustand localStorage. 손실 0.
- **리스크 — 사용자 파일 형식 (hard)**: PR 1~2 적용 후 다음 invariant가 무조건 유지되어야 함 (체크리스트 §8 참조). 회귀 시 plan-A1 (에러 가시화) 같은 user-facing 메시지로 노출됨.
- **리스크 — `metadata` 필드가 비어있을 때 snapshot 동작**: `initializeDatabase()`는 `{id:1, version:"1.0.0", createdAt}` row 1개를 put → snapshot에 항상 `metadata.length >= 1`. files-only 모델에선 `replaceDatabaseData`가 `data.metadata`를 그대로 snapshot에 넣음. **invariant**: 새 vault 생성 시 `metadata: [initializeDatabase()]` 가 `createDataFile`의 `baseData`에 항상 포함되어야 함 (이미 `fileStorage.ts:298-304`에서 처리 중).
- **리스크 — Web E2E의 store mock 갱신**: `AccountList.test.tsx`, `RootRedirect.test.tsx`가 store mock에 의존. mock 객체가 `accountTable`/`templateTable` API를 expose했다면 제거 필요. 실제 mock 코드는 추후 grep.
- **리스크 — `db.metadata.bulkPut(metadata)` 테스트 라인 제거 시 회귀**: lifecycle 4 integration test가 `db.metadata.bulkPut([{id:1,version:"1.0.0"}])` 등으로 snapshot 시드. PR 2에서 snapshot JSON의 `metadata` 필드에 직접 포함시키는 방식으로 변경 — **`getDefaultMetadata`/`createTestMetadata` 헬퍼는 유지** (snapshot JSON 내 `metadata` 필드 구성에 사용).

## 10. Reusable Knowledge (sub-decision 등)

### 사용자 직접 결정 provenance

본 brainstorm의 핵심 결정은 모두 사용자 직접 메시지로 확정 (코드/STRATEGY 추론 아님):

- **2026-09-02 메시지 1**: "React에서 어카운트 테이블하고 템플릿 테이블을 없애버리고, files 테이블이랑 스토어만 사용하도록 수정" → Q1=A (record 테이블 완전 제거) + Q2=a (`syncQueue` 같이 단순화/제거) — 후속 답변 "a, a"
- **2026-09-02 메시지 2**: "db.metadata, db.settings 도 정리하도록 추가해줘. **물론 지금 저장하는 파일의 형식이 변경되면 안돼**" → Q5=✅ drop, Q6=✅ drop + **hard constraint: KiyoVaultData JSON 스키마 절대 불변**
- **2026-09-02 메시지 3**: "`fileStorage.ts` 관련해서 흐름 정리해서 보고해봐. 중요한 점은 1. db.files -> 스토어, 2. 스토어 -> db.files 이게 명확해야 한다는 거야. 이제 replaceDatabaseData 는 필요 없어 지는거지" → §3.6 신규 작성 (read/write 단일 진입점 원칙 + caller별 흐름 표 + replaceDatabaseData 제거 사유 5가지)
- **2026-09-02 메시지 4**: "createDataFile 에서는 이미 스토어 저장하고 saveStoresToFile 이거 하는 거니까 loadVaultToStores 이걸 또 할 필요는 없지" → §3.6 caller 표에 createDataFile 비대칭 명시 (write only, loadVaultToStores 호출 안 함)
- **2026-09-02 메시지 5**: "loadVaultToStores 는 명시적으로 decrypt 한 데이터를 넣도록 했으면 좋겠어. 이미 흐름에서 한번 복호화하잖아" → §3.6 원칙 + 시그니처에 `loadVaultToStores(fileName, decrypted: KiyoVaultData)` 확정 (내부에서 getFileInfo/decryptData 호출 0)
- **2026-09-02 메시지 6**: "RootRedirect 는 plaintext → parsedData 확보 가능 이경우에만 로드하잖아" → §3.6 caller 표에 `RootRedirect.initializeStores` 추가 (plaintext active만 진입, encrypted+cryptoKey 없으면 `/auth`로 navigate) + §7 PR 1 step 10에 RootRedirect 마이그레이션 항목 추가
- **2026-09-02 메시지 7**: "Home.handleSelectFile 이것도 unlock 처럼 명시적으로 함수 만들어줘. 평문 파일 여는 걸로" → §3.6 caller 표에 `activatePlaintextVault(fileName)` 신규 진입점 추가 (Home plaintext 분기 흡수), §3.6 시그니처 코드 블록 + caller 예시 + Read 진입점 함수 정리 표 + §7 PR 1 step 1/step 9 갱신
- **2026-09-02 메시지 8**: "loadVaultToStores(fileName, decrypted) 여기서 fileName은 필요 없지 않아?" → `loadVaultToStores(fileName, decrypted)` → `loadVaultToStores(decrypted)`로 시그니처 단순화. caller는 호출 직전 `setSession({fileName})`으로 session에 등록하는 invariant로 통일. §3.6 원칙/시그니처/caller 예시/Read 진입점 함수 정리 표/§7 PR 1 step 1, 5, 10 갱신. RootRedirect step 10에 "effect 1에서 setSession 보강" 항목 추가.
- **2026-09-02 메시지 9**: "각 스토어에서 로드하고 있는 것들은 db.files 에서 파일 열때 명시적으로 init 하는 식으로 했으면 좋겠어" → §3.6 Store 책임 재정의 (init 패턴) 신규 섹션 작성. store에 `init(data)` + `getAll()` 메서드 추가, `loadAccounts`/`loadTemplates` 삭제, `metadataStore` 신규 추가. §3.6 시그니처 코드 블록에서 `loadVaultToStores` 본체 = `accountStore.init + templateStore.init + metadataStore.init`, `saveStoresToFile` 본체 = `accountStore.getAll + templateStore.getAll + metadataStore.getAll`로 갱신. §7 PR 1 step 6-9 갱신 (accountStore/templateStore/metadataStore 패턴 명시), step 12 신규 추가 (useFileAuthGuard 흡수).
- **2026-09-02 메시지 10**: "이상한거 있으면 물어봐바" (ce-plan-review skill 호출) → `/docs/plans/2026-09-02-files-only-vault-pr1.md` 10개 finding 패치. #1 line 6 링크 오타, #2-#3 Auth.tsx + 5개 페이지 caller 추가 (총 8개 caller로 확장), #4 useFileAuthGuard line drift, #5 backupDataFile dead code 확인 (production 1건 사용 확인) + PR 1에서 재작성 결정, #6-#7 결정 표에 Q15 (devAccounts id 동적 할당), Q16 (isLoading UX + initialized sessionStore 통합), Q17 (Auth handleBiometricLogin 1회 추가 decrypt 감수) 추가. Risks 섹션 동기화. Verification Checklist Step 9 동기화.
- **2026-09-02 메시지 11**: "a" (Q15 a 확정: devAccounts id 동적 할당) → Step 7 CRUD에 `nextAccountId` 헬퍼 추가
- **2026-09-02 메시지 12**: "a, initialized 이것도 세션스토어에서 전부 통합으로 관리하도록 수정해" (Q16 a + initialized sessionStore 통합 확정) → Step 1-2 store 스키마에서 initialized 삭제, sessionStore 통합, Step 3-6-9 caller 마이그레이션 동기화
- **2026-09-02 메시지 13**: "a" (Q17 a 확정: Auth.handleBiometricLogin 1회 추가 decrypt 감수) → Q17 확정, Q-후보 c) helper 추출 PR 1 후속
- **2026-09-02 메시지 14**: "a" (Q18 a 확정: buildSnapshotFromStores helper 추출) → Step 3 helper 추가, backupDataFile 재작성 패턴 갱신
- **2026-09-02 메시지 15**: "a" (Q19 a 확정: PR 1 단일 PR 유지) → Q19 확정, 단일 PR 권장 유지
- **2026-09-02 메시지 16**: "a" (Q20 a 확정: PR 2 통합 test 범위 모두 포함) → PR 2 hard constraint 명시, Q20 확정

후속 세션이 이 brainstorm을 재독해할 때 "drop 권장 = 코드/grep 추론" vs "drop 확정 = 사용자 직접 결정"을 구분할 수 있도록 기록.

## 11. Output

- **Problem understood**: 5개 Dexie 테이블 중 `accounts`/`templates`/`metadata`/`settings` 4개가 files snapshot 또는 zustand와 source of truth가 겹쳐 lock race 가드, 이중 write, dead storage, schema 마이그레이션 부담을 만듦. `settings`는 dead table.
- **Recommended direction**: Option A — 4개 테이블 모두 drop (Q1=A, Q5=✅, Q6=✅) + `syncQueue` 제거 (Q2=a) + `recordEncryption` 모듈 삭제. **사용자 파일 형식 (KiyoVaultData JSON + EncryptedKiyoVaultData) 절대 불변** — hard constraint 체크리스트 §8.
- **Important unknowns**: Q3 (lock race placeholder 정책), Q4 (`replaceDatabaseData` signature 단일화).
- **Plan 가능 여부**: ✅ 본 brainstorm만으로 PR 1 (schema + 6개 모듈 삭제) + PR 2 (test 6개 갱신) + PR 3 (openwiki·STRATEGY) 분해 가능. 후속 `ce-plan`에서 PR 1 작성 가능.