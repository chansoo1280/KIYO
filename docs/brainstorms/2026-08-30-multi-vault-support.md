# Brainstorm — Multi-Vault Support (앱 데이터 내부 다중 파일)

- Date: 2026-08-30
- Worktree: `feat/ux-accessibility` (base `origin/dev`)
- Source: STRATEGY §2 (Boundary #4 "멀티 볼트는 로컬 파일 단위로만") + 사용자 직접 요청
- Status: Brainstorm (no code changed)
- Scope: **앱 데이터(IndexedDB `files` 테이블) 내부에 N개의 볼트 파일이 공존**하도록 변경. 외부 .json 파일 시스템은 자동저장 경로(SAF) 한정으로 격리.
- Prior: [Track 3 brainstorm](2026-08-30-track3-ux-accessibility.md) §8.1 Plan-7(다단계 페이지)과 **의존성/순서 관계** — 본 brainstorm이 Plan-7보다 먼저 처리되어야 Home UX가 자연스러워짐.

---

## 1. Problem

현재 KIYO는 **앱 데이터(IndexedDB `files` 테이블) 내부에 항상 정확히 1개의 활성 볼트**만 유지한다. 사용자가 새 파일을 만들거나 SAF로 외부 .json을 열면 **기존 row를 덮어쓴다** (`ACTIVE_FILE_ID = "active"` 리터럴로 고정 id). 이 제약은 다음 사용 시나리오를 막는다:

1. **용도별 볼트 분리** — "개인" / "업무" / "임시" 등 별도 볼트를 동시에 보관
2. **빈번한 파일 전환** — 현재 `closeDataFile`은 모든 row 삭제, `openImportedDataFile`은 active 교체 — 이전 파일이 사라짐
3. **실수 복구** — 잘못 덮어쓴 파일을 되돌릴 방법 없음 (active 1개 한정)
4. **STRATEGY Boundary #4** ("멀티 볼트는 로컬 파일 단위로만") — STRATEGY는 이미 멀티 볼트를 허용. 코드가 1개로 한정되어 있어 STRATEGY ↔ 코드 불일치

**사용자 결정된 동작 (2026-08-30):**
- 중복 fileName → DB 내부에서는 `(1)`, `(2)` suffix 자동 부여
- SAF 외부 export → 사용자가 선택한 경로에 **덮어쓰기** (현재 `exportBackupFile` 동작)
- import (SAF 파일 선택) → DB에 새 row로 추가 + **active로 만들기**, 원본 .json은 안 건드림
- DB 내부 자동저장 → **항상 활성** 유지
- Settings의 "자동저장 경로" → SAF **외부** 자동저장 의미 (현재 `autoBackupEnabled` + `autoBackupUri` 조건부)
- Home → 파일 **리스트 표시** + 선택 + 생성

## 2. Goal

1. `files` 테이블에 N개 row 공존 가능 — PK 전략을 `ACTIVE_FILE_ID` 리터럴에서 **fileName** 기반으로 변경
2. `createDataFile` / `openImportedDataFile` 시 **중복 이름 자동 suffix 부여** 로직 추가
3. Home에 파일 리스트 UI 추가 + 선택(import + active 전환) / 생성 / (선택) 삭제
4. 외부 자동저장(`tryTriggerAutoBackup`) 동작 변경 0 — 사용자가 명시적으로 "이미 활성화되어 있다"고 확인
5. 기존 `fileTable.integration.test.ts` (358줄) invariants 회귀 + 신규 multi-row invariants 추가

## 3. Context

### 3.1 인스펙션한 파일/모듈

| 영역 | 파일 | 메모 |
|---|---|---|
| DB 스키마 | `src/database/db.ts:19-55` | `FileRecord.id: typeof ACTIVE_FILE_ID` (= `"active"`) — 단일 id 강제. `db.version(13)` + `files: "id, fileName, createdAt, updatedAt"` — `fileName` 인덱스 존재, 다중 row 가능 |
| File table API | `src/database/fileTable.ts:1-121` | 5개 메서드 모두 `ACTIVE_FILE_ID` 하드코딩. `getAllFileNames()` **정의됨, 사용처 0건** |
| 데이터 파일 생성 | `src/database/fileStorage.ts:297-365` (`createDataFile`) | `persistVaultRecord(fileName, encrypted)` 호출 → 항상 active로 put |
| 데이터 파일 열기 | `src/database/fileStorage.ts:390-499` (`openImportedDataFile`) | `persistVaultRecord(fileName, parsedData)` 호출 → 덮어쓰기 |
| 활성 파일 교체 | `src/database/fileStorage.ts:238-253` (`closeDataFile`) | `fileTable.deleteFileRecord()` — **모든 row 삭제** (수정 필요) |
| 자동저장 | `src/database/db.ts:92-155` (`persistVaultSnapshot` + `tryTriggerAutoBackup`) | active 1개 한정 처리. DB 내부 자동저장 항상 활성, SAF 외부 자동저장은 `autoBackupEnabled && autoBackupUri` 조건부. **변경 0** |
| 트랜잭션 atomicity | `src/database/db.ts:240-259` (`replaceDatabaseData`) | 트랜잭션 내 `db.files.clear()` + `upsertFileRecord(fileName, fileDataToSave)` — `clear()`가 **모든 row 삭제** (수정 필요) |
| 세션 | `src/store/sessionStore.ts` | `activeFileName: string \| null` persist (salt/lastSyncTime 함께). cryptoKey/salt 메모리 only. partialize에 activeFileName 포함 — 정상 |
| Home | `src/pages/Home.tsx:17-156` | "파일 생성" / "파일 선택" 두 버튼. **리스트 없음** — `fileTable.getAllFileNames()` 활용처 0 |
| 인증 가드 | `src/hooks/useFileAuthGuard.ts:1-54` | `getActiveFileInfo` 호출. fileName 기반 조회로 변경 시 영향 받음 |
| 외부 export | `src/database/fileExport.ts:18-75` (`exportBackupFile`) | 사용자가 명시한 대로 **덮어쓰기** 동작 유지. 변경 0 |
| 설정 자동저장 | `src/store/settingsStore.ts` (사용자 확인) | `autoBackupEnabled` + `autoBackupUri` 조건부 외부 자동저장. 변경 0 |
| 기존 테스트 | `src/database/fileTable.integration.test.ts` (358줄) | "단일 레코드" 가정이 다수 — 다중 row 가정 추가 시 다수 갱신 필요 |
| 사용 안 함 | `src/database/fileStorage.ts:201-236` (`importDataFile`) | deprecated, 이미 dead code. 변경 0 |

### 3.2 STRATEGY ↔ 코드 매칭 (ce-brainstorm 규칙)

> "STRATEGY가 ✅라고 말하는 것을 코드 presence만으로 검증하지 말 것."

| STRATEGY 원문 | 표면 증거 | 실제 동작 | 진짜 상태 |
|---|---|---|---|
| Boundary #4: "멀티 볼트는 로컬 파일 단위로만" | DB schema는 multi-row 가능 (`fileName` 인덱스) | `ACTIVE_FILE_ID` 단일 id 강제 + 모든 함수가 덮어쓰기 | **⚠️ 부분** — schema는 가능, 비즈니스 로직이 단일 강제 |
| "다중 데이터 파일 — 여러 암호화된 볼트 생성/가져오기/백업/복원" (README) | "다중" 표현 존재 | 생성/가져오기 시 **덮어쓰기** | **❌ 미지원** — README는 ✅라고 하지만 코드는 ❌ |

**중요 시그널:** STRATEGY Boundary #4는 멀티 볼트를 **허용**하지만 "로컬 파일 단위로만" — 즉, **앱 데이터 내부에 N개 공존** 모델을 의미. 현재 코드는 1개로 한정되어 있어 STRATEGY ↔ 코드 불일치. 본 brainstorm은 이 격차를 해소.

### 3.3 Track 3 brainstorm과의 관계

[2026-08-30-track3-ux-accessibility.md](2026-08-30-track3-ux-accessibility.md)는 Plan-A → B → 7 → D 순서로 권장했음. 그러나:

- **Plan-7 (다단계 페이지)**은 본 작업 이후에야 진가가 발휘됨 — 파일 선택 → 1개 파일에 대한 "이 파일을 active로" 또는 "이 파일을 (1)로 새로" 결정 흐름은 1개 파일 모델에선 의미 없음
- **본 작업 (멀티 볼트)**은 Track 2(볼트 무결성)의 후속이지만, **Plan-7보다 선행**되어야 Home UX가 자연스러워짐
- 따라서 **순서 재배치**:
  ```
  (NEW) Multi-Vault Support (본 brainstorm) → Plan-7 → Plan-A → Plan-B → Plan-D
  ```
  - Multi-Vault가 Home의 파일 리스트 UI를 가능하게 함
  - Plan-7(다단계 페이지)이 리스트 위에서 동작 (Step 1 "기존 파일 선택 / 새로 만들기" 분기 추가)
  - Plan-A(공통 UI 인프라)가 Plan-7의 단계 전환 피드백에 활용

**부록 A**에 순서 재배치 정리.

## 4. Constraints

- **STRATEGY Boundary #1, #3** — 네트워크 권한 0, 클라우드 동기화 없음 (변경 영향 0)
- **STRATEGY Boundary #4** — 멀티 볼트는 로컬 파일 단위로만 (앱 데이터 내부 N개 row가 이 모델과 일치)
- **cryptoKey는 메모리 only** — file 전환 시 cryptoKey 교체, persist 금지 (이미 sessionStore partialize가 cryptoKey 제외 — 정상)
- **PBKDF2 100k + AES-GCM 256** — 파일별 독립 salt (이미 `EncryptedKiyoVaultData.salt` 필드 존재 — 정상)
- **autosave E2E** (`AutosaveE2ETest` + `run-autosave-e2e.ps1`) — active 1개 처리 가정. multi-row로 가도 active 처리는 동일 → **영향 최소화**
- **Android Keystore autofill 인증** — React 측 file 전환과 독립. autofill DB_KEY는 별개 (변경 0)
- **자동잠금** — file 전환 시 `clearCryptoKey` 호출됨 (이미 `closeDataFile`이 처리) — 정상
- **E2E/Playwright** — 기존 pageobject 마커 (`/auth`, `/accounts`, ...) 변경 0. Home에 신규 마커 필요
- **web 환경** — SAF 미지원, `getAllFileNames()`는 Dexie 직접 호출이라 web에서도 동작. 단, `importBackupFile` (SAF)는 web에서 `<input type="file">` 사용 (현재 `FileOpenDialog` 패턴) — 변경 0
- **dexie schema migration** — `db.version(13)`에서 `files: "id, fileName, createdAt, updatedAt"` 인덱스 정의됨. PK 변경 시 마이그레이션 필요. **방안**: `id`를 fileName으로 유지하되 `fileName` PK 사용 — schema 변경 최소화 (v14 bump 필요)

## 5. Existing Architecture (현재 단일 파일 모델)

```
[User: 새 파일 생성]
  └─ Home.handleCreateFile (createDataFile)
       ├─ createCryptoKey (PIN → key + salt)
       ├─ BUILTIN_TEMPLATES 암호화 저장
       ├─ setupVaultSession (fileName + cryptoKey + salt)
       └─ persistVaultRecord(fileName, encrypted)
            └─ fileTable.upsertFileRecord (id: ACTIVE_FILE_ID, 덮어쓰기)

[User: 외부 파일 열기]
  └─ Home.handleOpenFile (openImportedDataFile)
       ├─ JSON parse + salt 검증
       ├─ decryptVaultData (PIN → key)
       ├─ persistVaultRecord(fileName, parsedData) ← active row 덮어쓰기
       ├─ setupVaultSession
       └─ replaceDatabaseData (트랜잭션 내 db.files.clear() + upsert)
            └─ fileTable.upsertFileRecord

[User: mutation → autosave]
  └─ persistVaultSnapshot
       ├─ getDatabaseSnapshot
       ├─ encryptData
       ├─ fileTable.upsertFileRecord(activeFileName, encrypted) ← 항상 active 1개
       └─ tryTriggerAutoBackup (SAF 외부, 조건부)

[User: close file]
  └─ closeDataFile
       ├─ clearSession
       ├─ fileTable.deleteFileRecord() ← 모든 row 삭제 (단일 모델)
       ├─ clearAccounts / clearTemplates
       └─ KiyoAutofill.clearAllAccounts
```

**단일 파일 제약이 박힌 정확한 라인:**
- `fileTable.ts:8` — `ACTIVE_FILE_ID = "active"`
- `fileTable.ts:29,46,54,93,120` — 5개 메서드 모두 하드코딩
- `db.ts:50-53` — `v12: files 테이블 키를 ++id에서 고정 "active"로 변경` (마이그레이션 주석, 회귀 위험)
- `db.ts:240-250` — `replaceDatabaseData` 트랜잭션 내 `db.files.clear()` (전부 삭제)
- `fileStorage.ts:240` — `closeDataFile` → `fileTable.deleteFileRecord()` (전부 삭제)

## 6. Relevant Previous Knowledge

- **AGENTS.md / .hermes.md** — Dexie 버전 bump 시 `db.version(N+1).stores(...).upgrade(tx)` 패턴 (이미 v13에서 적용됨)
- **STRATEGY Boundary #4** — "단일 사용자·단일 볼트 모델 유지 (**멀티 볼트는 로컬 파일 단위로만**)" — 본 brainstorm이 정확히 이 모델
- **STRATEGY §2 (Vault File Integrity)** — Plan-5 (SAF 영구 URI 자동 백업), Plan-6 (autosave 안정화) 완료. **본 작업은 §2의 후속 자연스러운 발전** — §3 Plan-7과는 별도 의존성 그래프
- **STRATEGY §3 brainstorm** ([2026-08-30-track3-ux-accessibility.md](2026-08-30-track3-ux-accessibility.md)) — Plan-7(다단계 페이지)이 본 작업 이후에야 진가. **순서 재배치 필요** (부록 A)
- **STRATEGY §4 (Session & Auto-lock)** — file 전환 시 `clearCryptoKey`로 lock 발생 → /auth 리다이렉트 (이미 `useFileAuthGuard`가 처리). 본 작업에서도 동일 동작 유지
- **`.hermes/plans/2026-08-29-autosave-stability-concurrency.md`** — `persistVaultSnapshot`의 race/lock→unlock/연속 mutation 시나리오. 본 작업은 active 1개 처리를 유지하므로 영향 0
- **`.hermes/plans/2026-08-30-saf-persistent-uri-auto-backup.md`** — SAF 자동 백업은 `tryTriggerAutoBackup`에 격리. 본 작업 변경 0
- **메모리 노트** — "Track 3는 사용자가 직접 결정" (UX 작업 사용자 주도), "agent는 React 단위 + Android JVM 단위까지만 담당" — 본 작업은 React 측 DB 스키마 + UI + E2E 영향. Android 네이티브 변경 0 예상 (autofill DB_KEY는 별개)
- **사용자 결정 (2026-08-30, 본 brainstorm §1):** 중복 suffix 정책, import 의미, 자동저장 의미 모두 명시

## 7. Options (PK/식별자 전략)

### Option A: fileName을 Dexie PK로 사용 (fileName unique 보장)

- **설계:** `id` 필드 제거, `fileName` 자체가 PK. `createDataFile` 시 중복 검사로 `(1)`, `(2)` suffix 부여하여 unique 보장.
- **장점:** 자연스러운 unique 식별자, `getActiveFileRecord` → `getFileRecord(fileName)` 단순화
- **단점:** `db.version(14)` migration 필요 (PK 변경). v12에서 `ACTIVE_FILE_ID`로 마이그레이션한 이력이 있어 또 다시 마이그레이션 부담
- **복잡도:** 중. schema bump + suffix 부여 로직
- **테스팅:** "중복 시 (1) 부여" 단위 테스트 + Dexie v14 마이그레이션 테스트
- **마이그레이션:** v13 → v14 upgrade에서 기존 row를 fileName 기반으로 마이그레이션 (단일 row 가정)

### Option B: ++id auto-increment 유지 + fileName에 unique 인덱스 추가

- **설계:** `id: ++id` (auto) + `fileName`에 unique 제약. PK는 numeric, fileName은 unique secondary.
- **장점:** schema 변경 최소. `ACTIVE_FILE_ID` 리터럴 의존에서 점진적 탈피 가능
- **단점:** active를 식별할 때 numeric id와 fileName 둘 다 관리. `getActiveFileInfo`가 `useSessionStore.activeFileName`을 받아 fileName으로 조회
- **복잡도:** 소~중. schema bump + unique 인덱스 추가
- **테스팅:** 중복 insert 거부 단위 테스트
- **마이그레이션:** v13 → v14 upgrade에서 unique 인덱스 추가

### Option C: ACTIVE_FILE_ID 유지 + fileName을 "row 구분 키"로만 사용 (의미론적 변경)

- **설계:** schema는 그대로. `id: "active"` 리터럴을 **첫 번째 row의 fileName**으로 동적 변경. **단, 이건 schema 위반** (Dexie는 id 인덱스를 unique로 가정) — **실행 불가**

### Option D: ACTIVE_FILE_ID 폐기 + fileName을 string PK로 (v14 신규)

- **설계:** `id: string` (fileName 자체). `db.version(14).stores({ files: "id, fileName, createdAt, updatedAt" })`. v13 → v14 upgrade에서 기존 row 마이그레이션
- **장점:** Option A와 동일하되, `id` 필드명 유지 (코드 변경 표면 작음)
- **단점:** 동일
- **복잡도:** 중 (Option A와 사실상 동일)

## 8. Recommended Direction

**Option A (fileName을 Dexie PK로 사용)** 권장.

**근거:**
1. **자연스러운 unique 식별자** — 사용자가 "파일"이라 부르는 것 = fileName. UI 표시도 fileName. PK와 표시명을 일치시키면 코드 단순화
2. **active 식별 단순화** — `getFileRecord(fileName)` 한 줄. sessionStore의 `activeFileName`이 곧 PK
3. **schema 부담은 한 번만** — 이미 v12에서 `ACTIVE_FILE_ID`로 마이그레이션한 이력이 있어, "또 다른 마이그레이션"은 비용이지만 옵션 B도 동일하게 v14 bump 필요
4. **suffix 부여가 명확** — 중복 검사 시 `getFileRecord(fileName)` → 없으면 사용, 있으면 `(1)`, `(2)`, ... 부여
5. **Option B (++id + unique fileName) 대비 trade-off** — B가 schema 변경 적지만, "id로 row 구분 + fileName으로 조회" 이중화가 발생. A는 한 번만 결정하면 끝

**중복 검사 알고리즘 (Option A 기반):**
```ts
async function resolveFileName(desired: string): Promise<string> {
  const existing = await db.files.toArray().then(rows => new Set(rows.map(r => r.id)));
  if (!existing.has(desired)) return desired;
  const base = desired.replace(/\.json$/, "");
  for (let i = 1; ; i++) {
    const candidate = `${base}(${i}).json`;
    if (!existing.has(candidate)) return candidate;
  }
}
```

**데이터 변경 요약:**
- `db.version(14).stores({ files: "id, fileName, createdAt, updatedAt" })` + upgrade에서 기존 row의 id를 fileName으로 변경 (v13 row는 1개 가정)
- `FileRecord.id` 타입: `typeof ACTIVE_FILE_ID` → `string`
- `ACTIVE_FILE_ID` 상수 제거 (또는 deprecated로 유지)
- 신규 `fileTable.resolveFileName(desired: string): Promise<string>`
- 신규 `fileTable.getAllFiles(): Promise<FileRecord[]>` (fileName + createdAt + updatedAt + encrypted 포함)
- `fileTable.upsertFileRecord` 시그니처: `(fileName: string, fileData: ...)` 그대로 유지하되 내부적으로 id = fileName

**API 변경 요약:**
- `fileTable.upsertFileRecord(fileName, fileData)` — 그대로 (fileName = id)
- `fileTable.getActiveFileRecord()` → `fileTable.getFileRecord(fileName: string)` — **시그니처 변경**
- `fileTable.getActiveFileInfo()` → `fileTable.getFileInfo(fileName: string)` — **시그니처 변경**
- `fileTable.deleteFileRecord()` → `fileTable.deleteFileRecord(fileName: string)` — **시그니처 변경**
- `fileTable.getAllFileNames()` — 유지, 구현 단순화
- `fileTable.getAllFiles()` 신규

**호출처 갱신:**
- `useFileAuthGuard` — `useSessionStore.getState().activeFileName`으로 fileName 받아 `getFileInfo(fileName)` 호출
- `Home` — `useFileAuthGuard` + `getAllFiles()`로 리스트 표시
- `replaceDatabaseData` — 트랜잭션 내 `db.files.clear()` 제거, `upsertFileRecord(fileName, fileDataToSave)`만
- `closeDataFile` — `deleteFileRecord(fileName)` (active fileName만 삭제)
- `createDataFile` — 진입 시 `resolveFileName(desired)`로 중복 suffix 부여 후 진행
- `openImportedDataFile` — 동일하게 `resolveFileName(parsedData.fileName)`로 suffix 부여 후 `persistVaultRecord` → active로 만들기
- `fileTable.integration.test.ts` — "단일 레코드" 가정 다수 → multi-row 가정으로 갱신 + suffix 부여 테스트 추가

**Dexie v14 마이그레이션:**
```ts
this.version(14)
  .stores({ files: "id, fileName, createdAt, updatedAt" })  // PK는 string
  .upgrade(async (tx) => {
    // v13 row는 1개(id="active") 가정. fileName으로 id 변경
    const rows = await tx.table("files").toArray();
    for (const row of rows) {
      if (row.id === "active" && row.fileName) {
        row.id = row.fileName;
        await tx.table("files").put(row);
      }
    }
  });
```

**UI 변경 요약 (Home):**
- 파일 리스트 섹션 추가 — 각 row: fileName + 생성일/업데이트일 + (active 표시) + 클릭 시 active 전환
- "파일 생성" 버튼 (현재 모달 → Plan-7 시 다단계 페이지, 본 plan에서는 모달 유지)
- "파일 선택 (가져오기)" 버튼 (현재 `FileOpenDialog` → import 의미 변경: SAF 파일 → DB에 새 row로 추가 + active)
- "파일 삭제" 액션 (active가 아닌 row만 삭제 가능) — 옵션, 본 plan에서는 미포함 가능 (Q)

## 9. Open Questions (다음 단계 결정 필요)

| Q | 질문 | 옵션 | 권장 |
|---|---|---|---|
| Q1 | PK 전략: fileName PK (A) vs ++id + unique (B) | A / B | ✅ **A** (사용자 확정 2026-08-30) — `db.version(14).stores({ files: "id, fileName, createdAt, updatedAt" })` + id = fileName |
| Q2 | `ACTIVE_FILE_ID` 상수: 제거 vs deprecated | (a) 제거 (b) deprecated | ✅ **(a) 제거** (사용자 확정 2026-08-30) — 호출처 전부 fileName 기반으로 갱신 |
| Q3 | import 시 fileName 출처: SAF 파일의 `parsedData.fileName` vs 사용자가 새로 입력 | (a) parsedData.fileName 그대로 (b) 다이얼로그에서 사용자가 재입력 | ✅ **(a) 그대로** (사용자 확정 2026-08-30) — `resolveFileName(parsedData.fileName)` |
| Q4 | file 삭제 UI: 본 plan에 포함 vs 별도 plan | (a) 포함 (b) 별도 | ✅ **(a) 포함** (사용자 확정 2026-08-30) — Home 리스트에 삭제 버튼 |
| Q4-a | active 잠금 조건 | (a-1) 전부 삭제 가능 (a-2) active 잠금 유지 | ✅ **(a-1) 전부 삭제 가능** (사용자 확정 2026-08-30) — `useFileAuthGuard`가 active + 잠금 해제 시 `/accounts`로 보냄 → Home에 보이는 건 active 아닌 row 또는 active 해제된 row. 단순 삭제. **잠금 조건 불필요** |
| Q5 | fileName 변경(rename): 본 plan에 포함 vs 미포함 | (a) 포함 (b) 미포함 | ✅ **(b) 미포함** (사용자 확정 2026-08-30) — 본 plan 범위 밖, **Settings 화면에서 별도 plan으로 후속** (v15 migration 필요, suffix 규칙과 충돌) |
| Q6 | autofill과 multi-vault 상호작용: autofill DB는 단일, multi-vault 선택 시 어떻게? | (a) active file만 autofill sync (현재) (b) 모든 file을 autofill sync | ✅ **(a) 현재 동작 유지** (사용자 확정 2026-08-30) — AutofillRepository SQLCipher DB 1개 = active 1개 의미, autofill 경로 격리 |
| Q7 | Dexie v14 마이그레이션: 기존 사용자(1 row)에 대해 upgrade는? | (a) v13 row 1개를 fileName으로 id 변경 (b) 사용자에게 재설정 요청 | ✅ **(a)** (사용자 확정 2026-08-30) — v12→v13 마이그레이션 패턴 동일, 데이터 손실 0 |
| Q8 | fileTable.integration.test.ts (JVM) 갱신 | (a) multi-row 가정으로 갱신 + suffix 부여 테스트 (b) 단일 + multi 별도 describe | ✅ **(a)** (사용자 확정 2026-08-30) — **단, E2E (Playwright)는 회귀 0** — Home의 "파일 생성" 버튼은 `FileCreateDialog` 그대로 호출, 본 plan은 다이얼로그 UI 변경 0 |

## 10. Current Decision State

| # | 결정 | 상태 |
|---|---|---|
| Q1 | fileName PK (A) | ✅ 확정 2026-08-30 |
| Q2 | `ACTIVE_FILE_ID` 제거 (a) | ✅ 확정 2026-08-30 |
| Q3 | SAF `parsedData.fileName` 그대로 (a) | ✅ 확정 2026-08-30 |
| Q4 | 삭제 UI 포함 (a) | ✅ 확정 2026-08-30 |
| Q4-a | active 잠금 제거, 전부 삭제 가능 (a-1) | ✅ 확정 2026-08-30 |
| Q5 | rename 미포함 (b), 후속 plan (Settings) | ✅ 확정 2026-08-30 |
| Q6 | autofill = active 1개만 sync (a) | ✅ 확정 2026-08-30 |
| Q7 | v14 마이그레이션 id=fileName (a) | ✅ 확정 2026-08-30 |
| Q8 | fileTable.integration.test.ts (JVM) multi-row (a) / E2E 회귀 0 | ✅ 확정 2026-08-30 |
| 부록 A | Track 3 순서 재배치 (Multi-Vault 최우선) | ✅ 확정 2026-08-30 |

**확정된 동작 (사용자 2026-08-30 직접 명시):**
- ✅ 중복 fileName → DB 내부 `(1)`, `(2)` suffix 부여
- ✅ SAF 외부 export → 덮어쓰기 (변경 0)
- ✅ import → DB에 새 row + active 전환
- ✅ DB 내부 자동저장 → 항상 활성 (변경 0)
- ✅ Settings "자동저장 경로" → SAF 외부 자동저장 (변경 0)
- ✅ Home → 파일 리스트 + 선택 + 생성 + 삭제 (active 잠금 조건 0)

## 11. Risks

| 리스크 | 완화 |
|---|---|
| Dexie v14 마이그레이션 실패 → 기존 사용자 데이터 손실 | v12→v13 마이그레이션이 이미 동일 패턴. upgrade(tx)에서 `files.clear()` 후 다시 생성하는 게 아니라 기존 row를 그대로 fileName id로 변경 — **데이터 손실 0** |
| fileName에 emoji/특수문자/공백/슬래시 포함 → Dexie/PBKDF2/salt 검증 회귀 | `normalizeDataFileName`이 이미 trim + `.json` 강제. Plan-7(다단계 페이지)에서 추가 검증 권장 |
| Home 리스트에 100+ row 시 성능 | `fileTable.getAllFiles()` 단일 query, `toArray()` 한 번. 100건 단위 성능 측정 후 pagination 결정 (Q 후속) |
| active 전환 시 `closeDataFile`을 매번 호출 → autofill clear 반복 | active 전환 = `replaceDatabaseData` (clear 안 함) + `setupVaultSession`. **이전 row는 보존**. autofill은 active만 sync — 효율 유지 |
| 기존 단일 row 가정 테스트 다수 깨짐 | (a) v14 마이그레이션 테스트 + (b) multi-row invariants 추가 + (c) 기존 테스트 multi-row 가정으로 점진 갱신 |
| E2E `fileStorage.lifecycle.integration.test.ts` 영향 | Plan-6 (autosave) 테스트가 active 1개 가정. multi-row로 가도 active 처리는 동일 → **영향 최소화**, 단 신규 "active 전환" 시나리오 추가 |
| 자동잠금 + active 전환 race | `useFileAuthGuard`가 `getFileInfo` 실패 시 `/auth` 리다이렉트. 새 row + active 전환 직후 cryptoKey 없으면 자동으로 `/auth` (의도된 동작) |
| 사용자가 잘못 active 전환 → 이전 active 데이터 유실? | **이전 active도 row로 보존**됨. `closeDataFile`이 active fileName만 삭제 (전부 X). Home 리스트에서 다시 선택 가능 |
| "단순화/이전과 같게" 사용자 신호 (메모) | Q1~Q8 권장 옵션이 모두 최소 변경. Dexie v14 마이그레이션은 필요하지만 schema 변경은 PK만 (인덱스 정의 동일) |
| Track 3 Plan-A(공통 UI 인프라)와 충돌 | Home 리스트는 즉시 필요 (Plan-A 전). Plan-A는 Toast/Skeleton 같은 범용 인프라 — 직교. 순서: Multi-Vault → Plan-7 → Plan-A → Plan-B → Plan-D (부록 A) |

## 12. Next Action

**모든 결정 완료 (2026-08-30).** 본 brainstorm 닫고 `ce-plan`을 직접 개설.

**plan 파일:** `docs/plans/2026-08-30-multi-vault-support.md`
**구현 분할 (4-step):**
- **Step 1:** Dexie v14 마이그레이션 + `FileRecord.id: string` + `ACTIVE_FILE_ID` 제거 + `fileTable` API 시그니처 변경 (getFileRecord/getFileInfo/deleteFileRecord 모두 fileName 인자) + `resolveFileName` 신규
- **Step 2:** 호출처 갱신 — `useFileAuthGuard`, `replaceDatabaseData` (트랜잭션 `db.files.clear()` 제거), `closeDataFile` (active fileName 1개만 삭제), `createDataFile` (suffix 부여), `openImportedDataFile` (suffix 부여)
- **Step 3:** Home에 파일 리스트 UI — `getAllFiles()` 표시 + 클릭 시 active 전환 (`replaceDatabaseData` + `setupVaultSession`) + 삭제 버튼 (active 잠금 0, 전부 삭제 가능)
- **Step 4:** 검증 — `fileTable.integration.test.ts` (JVM) multi-row 가정으로 갱신 + suffix 부여 테스트, E2E (Playwright) 회귀 0 확인 (`FileCreateDialog` 변경 0), Android JVM unit 영향 0 (autofill 격리)

---

## 부록 A. Track 3 순서 재배치

| 순서 | Plan | 비고 |
|---|---|---|
| 1 | **Multi-Vault Support (본 brainstorm)** | Home 리스트 UI 가능하게 함. §2 후속 |
| 2 | Plan-7: 파일 생성 다단계 페이지 | 리스트 위에서 분기. Plan-4(완료) 자연 통합 |
| 3 | Plan-A: 공통 UI 인프라 (Spinner, Skeleton, Toast, useAsync) | Plan-7의 단계 전환 피드백 |
| 4 | Plan-B: 버튼/폼 일관성 (Button.loading, useFormSubmit) | Plan-A 의존 |
| 5 | Plan-D: 테마 FOUC 가드 + 시스템 연동 | 독립, 실측 후 작업 |
| 6 | (점진 흡수) a11y — Plan-A/B/D 진행 중 자연 보강 | |

기존 Track 3 brainstorm(2026-08-30) §8.1의 Plan-A 1순위 → Multi-Vault 1순위로 재배치.

## 부록 B. STRATEGY ↔ 코드 갱신 diff (본 brainstorm 채택 시)

```diff
 ## Boundaries
 ...
 | 4. **비밀번호 공유/가족 요금제/조직 기능 안 만듦** — 단일 사용자·단일 볼트 모델 유지 (멀티 볼트는 로컬 파일 단위로만) |
+### 4.1 멀티 볼트 모델 (앱 데이터 내부)
+- IndexedDB `files` 테이블에 N개 row 공존
+- PK: fileName (Dexie v14, suffix `(1)`, `(2)` 자동 부여)
+- Active: sessionStore.activeFileName으로 1개 식별
+- import (SAF): DB에 새 row 추가 + active 전환
+- 외부 자동저장 (SAF URI): 사용자가 경로 설정 시 (덮어쓰기)
+- DB 내부 자동저장: 항상 활성
```

## 부록 C. 호환성 매트릭스 (API 변경)

| 기존 API | 신규 API | 영향 호출처 |
|---|---|---|
| `fileTable.getActiveFileRecord()` | `fileTable.getFileRecord(fileName)` | useFileAuthGuard, Home |
| `fileTable.getActiveFileInfo()` | `fileTable.getFileInfo(fileName)` | useFileAuthGuard, Home, createDataFile, openImportedDataFile, unlockFile |
| `fileTable.deleteFileRecord()` | `fileTable.deleteFileRecord(fileName)` | closeDataFile |
| `fileTable.upsertFileRecord(fileName, fileData)` | `fileTable.upsertFileRecord(fileName, fileData)` | **시그니처 동일** — 내부 id = fileName |
| `fileTable.getAllFileNames()` | `fileTable.getAllFiles()` 확장 | Home (신규) |
| `ACTIVE_FILE_ID` 상수 | 제거 | fileTable.ts, db.ts, FileRecord 타입 |
| `FileRecord.id: typeof ACTIVE_FILE_ID` | `FileRecord.id: string` | db.ts, fileTable.ts |
| `db.version(13)` | `db.version(14)` + upgrade | db.ts |
| `replaceDatabaseData`의 `db.files.clear()` | 제거 (active만 upsert) | db.ts |
| `closeDataFile`의 `deleteFileRecord()` | `deleteFileRecord(activeFileName)` | fileStorage.ts |
| `createDataFile` 진입점 | `resolveFileName(desired)`로 suffix 부여 후 진행 | fileStorage.ts |
| `openImportedDataFile` | `resolveFileName(parsedData.fileName)`로 suffix 부여 후 진행 | fileStorage.ts |
| Home `useFileAuthGuard` | `getAllFiles()`로 리스트 표시 추가 | Home.tsx |
| fileTable 통합 테스트 | multi-row invariants + suffix 부여 테스트 | fileTable.integration.test.ts |

## 부록 D. 본 brainstorm이 기존 결정과 충돌하는 부분 (사용자 확인)

| 기존 결정 | 본 brainstorm 영향 | 사용자 확정 필요 |
|---|---|---|
| `ACTIVE_FILE_ID = "active"` (fileTable.ts:8) | 제거 (Q2 권장) | Q2 |
| `db.version(13)` + `files: "id, fileName, ..."` (db.ts:38) | v14 bump + fileName PK (Q1, Q7) | Q1, Q7 |
| `replaceDatabaseData` 트랜잭션 내 `db.files.clear()` (db.ts:250) | 제거 (active만 upsert) | 확인 |
| `closeDataFile` → `fileTable.deleteFileRecord()` (전부 삭제) (fileStorage.ts:240) | `deleteFileRecord(activeFileName)` (1개만) | 확인 |
| `createDataFile` / `openImportedDataFile`이 `persistVaultRecord` (덮어쓰기) | `resolveFileName` 후 persist (suffix 부여) | 확인 (사용자 명시) |
| autofill: active file만 sync (현재) | 변경 0 | Q6 (권장: 유지) |
| `autoBackupEnabled && autoBackupUri` 조건부 외부 자동저장 | 변경 0 | 확인 (사용자 명시) |
| 자동잠금 + file 전환 → /auth 리다이렉트 | 변경 0 (정상 동작) | 확인 |
| `fileTable.integration.test.ts` 단일 row 가정 (358줄) | multi-row 가정으로 갱신 + suffix 테스트 | Q8 (권장: 갱신) |
| Track 3 §8.1 Plan-A 1순위 | Multi-Vault 1순위로 재배치 (부록 A) | §3.3 |
