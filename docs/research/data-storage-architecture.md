# KIYO 데이터 저장 아키텍처

## 개요
오프라인 퍼스트, 로컬 전용 비밀번호 관리자. 네트워크 권한 없음, 클라우드 동기화 없음.

---

## 1. 저장소 계층

### IndexedDB (Dexie.js) - `src/database/db.ts`
| 테이블 | 키 | 용도 | 암호화 |
|--------|-----|------|--------|
| `accounts` | `++id` | 계정 레코드 | 레코드 단위 (recordEncryption) |
| `templates` | `++id` | 템플릿 레코드 | 레코드 단위 (recordEncryption) |
| `settings` | `++id` | 앱 설정(테마, 잠금 등) | 평문 |
| `metadata` | `id` | 파일 메타데이터 | 평문 |
| `files` | `++id` | 활성 볼트 파일 참조 | 볼트 단위 (encryption.ts) |

### 로컬 파일 시스템 (Capacitor Filesystem)
- **위치**: `Documents/` 디렉토리
- **형식**: JSON (`.json`)
- **용도**: 볼트 백업/가져오기/내보내기
- **암호화**: 볼트 단위 AES-GCM (파일 전체 암호화)

---

## 2. 상태 관리 (Zustand)

| 스토어 | 지속성 | 주요 상태 |
|--------|--------|-----------|
| `accountStore` | 메모리 | `accounts: Account[]`, `initialized` |
| `templateStore` | 메모리 | `templates: Template[]`, `isLoading` |
| `sessionStore` | **localStorage** (부분) | `activeFileName`, `salt`, `lastSyncTime`, `cryptoKey`(메모리만) |
| `settingsStore` | **localStorage** | `theme`, `fontSize`, `autoLockTimeout` |

> **핵심**: `cryptoKey`는 **절대 디스크에 저장 안 함** — `sessionStore`는 `salt`만 persist, 키는 메모리(`SecuritySession`)에만 보관

---

## 3. 암호화 체계

### 볼트 단위 (파일/백업용) - `src/crypto/encryption.ts`
- **알고리즘**: PBKDF2 (100,000 iter, SHA-256) → AES-GCM 256-bit
- **입력**: PIN + salt(16바이트)
- **출력**: `EncryptedKiyoFile` { version, encrypted: true, salt, iv, ciphertext }
- **적용**: `fileStorage.ts` → `writeDataFile`, `openImportedDataFile`, `backupDataFile`

### 레코드 단위 (IndexedDB용) - `src/crypto/recordEncryption.ts`
- **알고리즘**: AES-GCM (동일 키 재사용)
- **단위**: 개별 `AccountRecord` / `TemplateRecord`
- **구조**: `EncryptedRecord` { version, algorithm, encryptedData, iv, createdAt, updatedAt, encrypted }
- **적용**: `accountTable.ts`, `templateTable.ts` — `cryptoKey` 있을 때만 암호화 저장

### Autofill 토큰 - `src/crypto/autofillToken.ts`
- 32바이트 랜덤 토큰, 30분 TTL
- 네이티브 AutofillService와 공유 (Kotlin `SecuritySession` ↔ Web `sessionStore`)

---

## 4. 데이터 플로우

```
사용자 PIN 입력
      │
      ▼
createCryptoKey(pin) → CryptoKey + Salt (메모리)
      │
      ├─► IndexedDB: recordEncryption으로 각 레코드 암호화 저장
      │
      └─► 파일 저장: encryption.ts로 전체 볼트 암호화 → Filesystem.writeFile
      
세션 복원 시:
localStorage의 salt 읽기 → PIN으로 CryptoKey 재생성 → IndexedDB 복호화 읽기
```

---

## 5. 볼트 파일 구조

### 평문 (`KiyoDataFile`)
```ts
{ version: 1, fileName, updatedAt, accounts: Account[], templates: Template[], metadata: FileMetadata[] }
```

### 암호화 (`EncryptedKiyoFile`)
```ts
{ version: 1, encrypted: true, salt: base64, iv: base64, ciphertext: base64 }
```

---

## 6. 주요 타입 (간략)

| 타입 | 위치 | 설명 |
|------|------|------|
| `Account` | `models/account.ts` | id, templateId, title, fields[], websiteUrl, domain, packageName |
| `AccountField` | `models/account.ts` | id, label, type(FieldType), value, order |
| `Template` | `models/template.ts` | id, name, description, icon, sortOrder, fields[] |
| `AppSettings` | `models/account.ts` | theme, autoLockTime, lockEnabled, fontSize, biometricEnabled |
| `FileMetadata` | `models/account.ts` | id, version, createdAt |
| `EncryptedRecord` | `crypto/recordEncryption.ts` | 암호화된 레코드 공통 구조 |
| `EncryptedKiyoFile` | `crypto/encryption.ts` | 암호화된 볼트 파일 구조 |
| `AutofillToken` | `crypto/autofillToken.ts` | 네이티브 브리지용 토큰 |

---

## 8. 스토어 ↔ DB 연동 흐름

### 초기화 (`accountStore.initialize`, `templateStore.loadTemplates`)
```
store.initialize()
  │
  ├─► sessionStore.getState().cryptoKey 읽기
  │
  └─► accountTable.getAll(cryptoKey) / templateTable.getAll(cryptoKey)
        │
        ├─► cryptoKey 있으면: 레코드 복호화 후 Account[] 반환
        └─► cryptoKey 없으면: 평문 레코드 파싱 또는 최소 객체 반환
        │
        ▼
  set({ accounts: [...], initialized: true })
```

### 생성/수정/삭제 (`addAccount`, `updateAccount`, `deleteAccount` 등)
```
store.addAccount(account)
  │
  ├─► sessionStore.getState().cryptoKey 읽기
  │
  ├─► accountTable.create(account, cryptoKey)  // 암호화 저장
  │
  ├─► set({ accounts: [newAccount, ...state.accounts] })  // 즉시 UI 반영
  │
  └─► syncDatabaseToFile({ activeFileName, cryptoKey, salt })  // 비동기 파일 동기화
        │
        ├─► getDatabaseSnapshot() → accountTable.getAll(cryptoKey) + templateTable.getAll(cryptoKey)
        │
        ├─► encryption.ts로 전체 볼트 암호화 (cryptoKey 있는 경우)
        │
        └─► Filesystem.writeFile() → Documents/파일.json
```

### 파일 동기화 (`syncDatabaseToFile` - `src/database/db.ts`)
- **트리거**: **계정 변경 시마다** 자동 호출 (`accountStore`의 add/update/delete에서)
- **템플릿 변경 시**: **호출 안 함** (`templateStore`에는 동기화 로직 없음)
- **입력**: `sessionStore`의 `activeFileName`, `cryptoKey`, `salt`
- **처리**: 
  1. DB에서 전체 데이터 읽기 (복호화됨)
  2. `cryptoKey` 있으면 전체 볼트 암호화 (`encryption.ts`)
  3. IndexedDB `files` 테이블 + 로컬 파일시스템 양쪽에 저장
- **에러 처리**: 실패해도 앱 크래시 안 함 (`setSyncError`로 UI만 알림)

### 세션 복원 (`fileStorage.ts` → `replaceDatabaseData`)
```
openImportedDataFile(파일, PIN)
  │
  ├─► 파일에서 salt 추출 → createCryptoKey(PIN, salt) → cryptoKey 생성
  │
  ├─► decryptData()로 볼트 전체 복호화 → KiyoDataFile
  │
  ├─► sessionStore.setSession({ fileName, cryptoKey, salt })  // 메모리에 키 보관
  │
  └─► replaceDatabaseData() 트랜잭션
        ├─► accounts, templates, settings, metadata, files 테이블 clear
        ├─► accountTable.bulkRestore(accounts, cryptoKey)  // 암호화 저장
        ├─► templateTable.bulkRestore(templates, cryptoKey)
        └─► fileTable.create()로 암호화된 파일 데이터 저장
```

### 핵심 포인트
| 구분 | 설명 |
|------|------|
| **단방향 흐름** | Store → Table (쓰기) → FileSync (비동기) |
| **키 전달** | `sessionStore`가 유일한 `cryptoKey` 공급원, 모든 Table 함수에 `cryptoKey?`로 전달 |
| **즉시 반영** | DB 쓰기 후 Store 상태 즉시 업데이트 (낙관적 UI) |
| **파일 동기화** | 별도 비동기 작업, 실패해도 메모리/DB 상태는 유지 |
| **평문 모드** | `cryptoKey` 없으면 모든 암호화 단계 스킵, 평문 저장 |

---

## 9. 보안 원칙 요약

1. **키 분리**: 마스터 키(`cryptoKey`)는 메모리만, `salt`만 localStorage
2. **이중 암호화**: IndexedDB 레코드별 + 볼트 파일 전체
3. **PBKDF2 100k**: 브루트포스 지연
4. **AES-GCM**: 인증된 암호화 (무결성 보장)
5. **평문 폴백**: PIN 없으면 평문 저장 (암호화 미사용 모드 지원)

---

## 10. 개선점

### 템플릿 변경 후 파일 동기화 누락

**문제**
- `templateStore`의 `createTemplate`, `updateTemplate`, `deleteTemplate` 수행 후 `syncDatabaseToFile()` 호출이 없음.
- IndexedDB의 템플릿 데이터와 export 대상 파일 데이터가 불일치하는 문제 발생.
- 앱 종료 또는 백업 시 최신 템플릿 변경 사항이 반영되지 않음.

**해결**
- `accountStore`와 동일하게 템플릿 CRUD 완료 후 파일 동기화 수행.
- 반복되는 동기화 호출은 공통 함수로 추출하여 일관성 유지.

---

## 11. 구조적 문제 분석 (`db.ts`, `fileTable.ts`)

### 11.1 계층 위반: DB 레이어에서 Store 직접 참조 (`db.ts:61-62`) ✅ **해결됨**
**문제**: `getDatabaseSnapshot` 내부에서 `useSessionStore.getState()` 호출. 데이터베이스 레이어가 상태 관리 레이어를 import → 순환 의존 위험, 테스트 어려움, 관심사 분리 위반.

**해결**: `cryptoKey`를 파라미터로 전달받게 수정. `syncDatabaseToFile`은 이미 파라미터로 받으므로 일관성 있게 변경.
```typescript
// 변경 전
export const getDatabaseSnapshot = async (filename: string): Promise<KiyoDataFile>

// 변경 후
export const getDatabaseSnapshot = async (filename: string, cryptoKey?: CryptoKey): Promise<KiyoDataFile>
```

**수정 완료**: `db.ts`, `fileStorage.ts`, 관련 테스트 파일들 수정. 타입체크/테스트 모두 통과.

---

### 11.2 이중 세션 읽기 (`syncDatabaseToFile` → `getDatabaseSnapshot`) ✅ **해결됨 (11.1로 자동 해결)**
**문제**: `accountStore`에서 `sessionStore` 읽어 파라미터 전달 → `syncDatabaseToFile` 내부에서 `getDatabaseSnapshot` 호출 → `getDatabaseSnapshot`이 다시 `useSessionStore.getState()` 호출. 같은 값 두 번 읽음.

**해결**: 11.1 해결 시 자동 해결됨. `syncDatabaseToFile`에서 받은 `cryptoKey`를 `getDatabaseSnapshot`에 전달.

---

### 11.3 `replaceDatabaseData`가 `settings` 테이블 클리어 (`db.ts:163`) ✅ **해결됨**
**문제**: `await db.settings.clear()` 실행. `settings`는 앱 전역 설정(테마, 폰트, 자동잠금 등)으로 볼트별 데이터가 아님. 볼트 전환/복원 시 지워지면 안 됨. `getDatabaseSnapshot`도 settings 제외함(주석: "intentionally excluded") — 불일치.

**해결**: `db.settings.clear()` 라인 제거. settings는 볼트 데이터에 포함하지 않음.

**수정 완료**: `db.ts`에서 `db.settings.clear()` 및 트랜잭션 포함 제거.

---

### 11.4 `fileTable.create` 중복/모순 로직 ✅ **해결됨**
**문제점들**:
1. **`++id` 자동 증가 키 사용**: 다중 파일 지원처럼 보이지만 실제론 1개만 저장. `clear()` + `add()` 매번 실행 비효율.
2. **`salt` 이중 전달**: `EncryptedKiyoFile`에 이미 `salt` 필드 있음. 파라미터로 또 전달.
3. **평문/암호화 분기 중복**: 호출부에서 분기(`db.ts:105` 평문, `db.ts:114` 암호화)하나 `fileTable.create` 내부에서도 `isEncryptedKiyoFile`로 판단.

**해결**: 
- **기본키를 고정값 `ACTIVE_FILE_ID = "active"`로 변경** (단일 활성 볼트 명시, 상수화)
- `clear()` 제거, `db.files.put({ id: ACTIVE_FILE_ID, ... })`로 **upsert** 처리
- `salt` 파라미터 제거 (데이터 내장 `encryptedFile.salt` 사용)
- 호출부 분기 제거, `fileTable.create(fileName, fileData)` 단일 호출로 통일
- `fileTable.get()` → `db.files.get(ACTIVE_FILE_ID)` 직접 조회

**수정 완료**: `fileTable.ts`, `db.ts`, `fileStorage.ts`, 테스트 픽스처, 관련 테스트 파일들. Dexie 버전 13으로 마이그레이션 포함.

---

### 11.5 `writeDataFile` + `fileTable.create` 이중 호출 네이밍 혼동 ✅ **해결됨**
**문제**: 두 함수가 연속 호출되나 네이밍상 `fileTable.create`가 파일시스템도 쓰는 줄 알기 쉬움. 책임 분리 불명확.

**해결**: 네이밍 명확화로 책임 분리 명시.

| 기존 | 변경 후 | 이유 |
|------|---------|------|
| `fileTable.create` | `fileTable.upsertFileRecord` | 고정 키 `put` = upsert |
| `fileTable.get` | `fileTable.getActiveFileRecord` / `getActiveFileInfo` | 단일 활성 레코드 조회 명시 |
| `fileTable.delete` | `fileTable.deleteFileRecord` | 동작 명확화 |
| `writeDataFile` | `fileStorage.exportDataFile` | 파일시스템으로 **내보내기** |
| `openImportedDataFile` | `fileStorage.importDataFile` | 파일시스템에서 **가져오기** (export 대칭) |
| (신규) | `fileStorage.parseFileData` | JSON 파싱 + 암호화 여부 판별 |

> **export/import 페어**로 백업/복원 흐름이 직관적: `exportDataFile` → 파일 저장, `importDataFile` → 파일 읽기 → DB 복원

---

### 11.6 `fileTable.save` 네이밍 오해 ✅ **해결됨**
**문제**: `save`라는 이름이지만 `fileData` 저장 안 하고 `salt`만 갱신.

**해결**: `updateFileRecord`로 rename. 동작(레코드 부분 갱신)과 일치.

| 기존 | 변경 후 | 이유 |
|------|---------|------|
| `fileTable.save` | `fileTable.updateFileRecord` | `fileData` 아닌 `salt`/`updatedAt`만 갱신함을 명시 |

> `upsertFileRecord`(전체 저장) / `updateFileRecord`(부분 갱신) / `getActiveFileRecord` / `getActiveFileInfo` / `deleteFileRecord` — CRUD 접두어 통일

---

### 11.7 `fileTable.get` 반환 타입 모호 ✅ **제안됨 (일부 반영)**
**문제**: `JSON.parse`로 파싱 후 `KiyoDataFile | EncryptedKiyoFile | null`로 단언. 호출부에서 타입 가드 필요.

**해결**: `getActiveFileRecord()`는 원시 `FileData | null` 반환, `getActiveFileInfo()`는 파싱된 데이터 반환. `parseFileData` 유틸로 타입 안전성 확보.

```typescript
// 변경 전
async get(): Promise<ActiveFileInfo> { ... }

// 변경 후
async getActiveFileRecord(): Promise<FileData | null> {  // 원시 레코드 반환 }
async getActiveFileInfo(): Promise<{...}> {  // 파싱된 데이터 반환 }
```

> `parseFileData(rawData: string): KiyoDataFile | EncryptedKiyoFile`로 타입 안전 파싱 제공

---

### 11.8 `syncDatabaseToFile`의 네이티브 체크 3중 중복 ✅ **해결됨**
**문제**: `db.ts:97`, `fileTable.create` 내부, `writeDataFile` 내부에서 각각 `isNativeFileStorageAvailable()` 체크.

**해결**: 진입점(`syncDatabaseToFile`)에서 한 번만 체크, 하위 함수(`fileTable.upsertFileRecord`, `fileStorage.exportDataFile`)는 **네이티브만 호출된다고 가정**하고 체크 제거. 웹 환경 분기는 진입점에서 처리.

```typescript
// syncDatabaseToFile 진입점
if (!isNativeFileStorageAvailable()) return;  // 여기서만 체크

await fileTable.upsertFileRecord(...);       // 체크 없음
await fileStorage.exportDataFile(...);       // 체크 없음
```

> 단일 책임: 네이티브 감지는 **오케스트레이터**(syncDatabaseToFile)가, 하위 함수는 **실행만** 담당

---

### 11.9 `replaceDatabaseData`의 `fileDataToSave` 로직 타입 안전성 부족 ✅ **제안됨**
**문제**: `cryptoKey` 있을 때 `encryptedFileData` 필수이나 optional로 선언. 런타임에 에러 던짐.

**해결**: 판별된 유니언(Discriminated Union)으로 타입 강제 — `cryptoKey` 있을 때 `encryptedFileData` required. `salt`는 `EncryptedKiyoVaultData` 내장(base64 string)이므로 별도 파라미터 불필요.

```typescript
type ReplaceDatabaseDataParams =
  | {
      data: KiyoVaultData;
      fileName: string;
      cryptoKey?: undefined;
      encryptedFileData?: undefined;
    }
  | {
      data: KiyoVaultData;
      fileName: string;
      cryptoKey: CryptoKey;
      encryptedFileData: EncryptedKiyoVaultData;  // salt는 데이터 내장 (base64 string)
    };
```