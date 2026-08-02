# KIYO React 코드 리뷰: 데이터 저장 구조 관련 이슈

> 작성일: 2026-08-02  
> 대상: React/TypeScript 프론트엔드 (Android 네이티브 제외)  
> 기준 커밋: `1eb5276d` (refactor: 데이터 저장 구조 개선 11.1~11.9)

---

## 요약

| 심각도 | 개수 |
|--------|------|
| 🔴 높음 | 2 |
| 🟡 중간 | 4 |
| 🟢 낮음 | 6 |
| **총계** | **12** |

---

## 🔴 높음

### 1. `saveDataFile` - 거대 내부 함수 (단일 책임 위반)
**위치**: `src/database/fileStorage.ts:54-181` (127줄)

```typescript
const saveDataFile = async (
  data: KiyoVaultData,
  normalizedFileName: string,
  pin?: string,
  shouldSetActiveFile: boolean = true,
  isInit: boolean = false
): Promise<KiyoVaultData> => {
  // DB 초기화 (isInit 시)
  // 암호화/평문 분기
  // 세션 스토어 저장 (cryptoKey, salt, fileName)
  // 오토필 토큰 관리 (암호화/평문 각각 다른 토큰)
  // fileTable.upsertFileRecord 호출
  // exportDataFile로 파일시스템 내보내기
  // accountStore, templateStore 업데이트
  // 반환값 구성
}
```

**문제점**
- `createDataFile`, `backupDataFile`, `changePinDataFile`, `openImportedDataFile` 4개 공개 함수의 공통 로직이 한 내부 함수에 집중
- `pin` 유무 + `isInit` 플래그로 4가지 실행 경로 분기 → 인지 부하 높음
- 내부 함수라 직접 단위 테스트 불가 (공개 함수를 통해 간접 테스트만 가능)
- 오토필 토큰 로직이 파일 저장 로직과 섞여 있음 (관심사 분리 위반)

**제안: 5단계 파이프라인으로 분해 (단일 책임 원칙)**

| 단계 | 함수 | 책임 |
|------|------|------|
| 1 | `createEncryptedVault(vaultData, pin)` | PIN → CryptoKey 생성 → EncryptedKiyoVaultData 반환 (+ cryptoKey, salt) |
| 2 | `persistVaultRecord(fileName, vaultData)` | Vault 데이터 → FileRecord 생성 → fileTable.upsertFileRecord (DB 저장) |
| 3 | `setupVaultSession({ fileName, cryptoKey?, salt? })` | 세션 스토어에 cryptoKey, salt, fileName, active 상태 저장 |
| 4 | `syncAutofillToken(isEncrypted, cryptoKey?)` | 암호화 여부 확인 → 토큰 생성/삭제 (Autofill 연동) |
| 5 | `exportVaultFile(fileName, vaultData)` | Vault 데이터 → 파일 시스템 export (Filesystem.writeFile) |

**리팩토링 전략: 단계적 이전 (Strangler Fig 패턴)**

```typescript
// 1단계: 파이프라인 함수들 새로 추가 (saveDataFile 옆이나 별도 파일)
// 2단계: 공개 함수들(createDataFile 등)을 새 파이프라인으로 점진적 이전
// 3단계: saveDataFile에 deprecated 표시 및 호출부 전환 완료 후 제거

// TODO: replace with pipeline functions
const saveDataFile = async (...) => { ... }  // deprecated, 점진적 제거 예정
```

**합성 예시 (`createDataFile` 리팩토링 후)**
```typescript
export const createDataFile = async (fileName: string, pin?: string) => {
  const normalizedFileName = normalizeDataFileName(fileName);
  const baseData: KiyoVaultData = { version: 1, fileName: normalizedFileName, updatedAt: Date.now(), accounts: [], templates: [], metadata: [] };

  if (pin) {
    const { encryptedVaultData, cryptoKey, salt } = await createEncryptedVault(baseData, pin);
    await persistVaultRecord(normalizedFileName, encryptedVaultData);
    await setupVaultSession({ fileName: normalizedFileName, cryptoKey, salt });
    await syncAutofillToken(true, cryptoKey);
    await exportVaultFile(normalizedFileName, encryptedVaultData);
  } else {
    await persistVaultRecord(normalizedFileName, baseData);
    await setupVaultSession({ fileName: normalizedFileName });
    await syncAutofillToken(false);
    await exportVaultFile(normalizedFileName, baseData);
  }
  // store 업데이트 등...
};
```

**추가 고려사항**
- 에러 처리: 각 함수에서 에러 던지고 호출부에서 try/catch로 통합
- 위치: `fileStorage.ts` 내부에 private 함수로 두거나 별도 `vaultPersistence.ts` 유틸 파일로 분리
- 테스트: 각 함수별 독립 테스트 가능
- 기존 `saveDataFile`: deprecated 표시 후 점진적 제거

**우선순위**
1. `createEncryptedVault` / `persistVaultRecord` / `setupVaultSession` 먼저 추출 (핵심 3개)
2. `syncAutofillToken` 은 기존 `accountStore.syncToAutofill` 등과 중복 확인 후 병합 고려

---

### 2. `isVerifyPin` 네이밍 컨벤션 위반
**위치**: `src/crypto/encryption.ts:109`

```typescript
export const isVerifyPin = async (
  data: KiyoVaultData | EncryptedKiyoVaultData,
  pin: string
): Promise<boolean>
```

**문제점**
- `is*` 접두사는 **동기 boolean 반환** 함수 관례 (예: `isEncryptedKiyoVaultData`, `isKiyoFile`)
- 실제로는 `async` 함수로 `Promise<boolean>` 반환
- 호출부에서 `await isVerifyPin(...)` 써야 하는데 네이밍상 동기로 착각하기 쉬움

**제안**
- `verifyPin` 또는 `verifyPinMatches`로 rename
- 타입: `(data, pin) => Promise<boolean>`

---

## 🟡 중간

### 3. `createPlaintextRecord` 반환 타입 모순
**위치**: `src/crypto/recordEncryption.ts:78-93`

```typescript
export const createPlaintextRecord = async <T>(
  data: T
): Promise<EncryptedRecord>  // ← 타입명이 EncryptedRecord인데 평문 생성

// 실제 반환값:
{
  version: 1,
  algorithm: "AES-GCM",
  encryptedData: plaintextData,  // 실제론 평문
  iv: new Uint8Array(12),        // 더미 IV
  createdAt: now,
  updatedAt: now,
  encrypted: false,              // ← 여기가 핵심: false
}
```

**문제점**
- 함수명은 `createPlaintextRecord`인데 반환 타입이 `EncryptedRecord`
- `EncryptedRecord` 타입명에 "Encrypted"가 들어가 평문 레코드에도 쓰기 혼란
- `encrypted: false`인 레코드도 `EncryptedRecord` 타입을 쓰므로 타입 안전성 저하

**제안**
- 별도 `PlaintextRecord` 타입 도입하거나
- 함수명을 `createUnencryptedRecord`로 변경, 반환 타입을 유니온 `EncryptedRecord | PlaintextRecord`로
- 또는 `EncryptedRecord` → `StoredRecord` 등으로 일반화

---

### 4. 중복 타입 정의: `EncryptedKiyoVaultData`
**파일 비교**

| 파일 | 내용 |
|------|------|
| `src/crypto/encryption.ts:7-13` | `interface EncryptedKiyoVaultData` + `isEncryptedKiyoVaultData` type guard |
| `src/models/vault.ts:14-20` | `interface EncryptedKiyoVaultData` **중복 정의** (type guard 없음) |

**문제점**
- 동일 인터페이스가 두 파일에 정의됨 → 동기화 안 되면 버그 위험
- `vault.ts`는 `encryption.ts`에서 import해서 쓰면 됨

**제안**
- `vault.ts`에서 `import { type EncryptedKiyoVaultData } from "@/crypto/encryption"` 사용
- `vault.ts`의 중복 정의 제거

---

### 5. 프로덕션 코드에 `console.log` 남음
**위치**: `src/crypto/encryption.ts:21`

```typescript
export const isEncryptedKiyoVaultData = (value: unknown): value is EncryptedKiyoVaultData => {
  const file = value as Partial<EncryptedKiyoVaultData>;
  console.log(JSON.stringify(file));  // ← 삭제 필요
  return file.version === 1 && ...
}
```

**제안**: 즉시 제거

---

### 6. `fileTable.upsertFileRecord` 불필요한 salt 체크
**위치**: `src/database/fileTable.ts:92`

```typescript
salt: isEncrypted && "salt" in fileData ? fileData.salt : undefined,
```

**문제점**
- `EncryptedKiyoVaultData` 인터페이스에서 `salt: string`이 **필수 필드**
- `"salt" in fileData`는 암호화된 데이터면 항상 `true`
- `isEncrypted`만 체크하면 됨

**제안**
```typescript
salt: isEncrypted ? fileData.salt : undefined,
```

---

### 7. `syncDatabaseToFile` 평문 분기에서 `salt` 파라미터 불필요
**위치**: `src/database/db.ts:101-105`

```typescript
if (!cryptoKey || !salt) {
  await fileTable.upsertFileRecord(activeFileName, data);  // data는 KiyoVaultData (평문)
  await exportDataFile(data, activeFileName);
  return;
}
```

**문제점**
- `cryptoKey` 없으면 논리상 `salt`도 없음 (키 생성 시점에 같이 생성됨)
- 파라미터로 받은 `salt`를 무시하고 동작 → 타입 시그니처와 실제 로직 불일치

**제안**
- `SyncDatabaseParams`에서 `salt`를 `cryptoKey` 있을 때만 필수로 (판별된 유니언)
- 또는 진입점에서 분기 후 각각 별도 헬퍼 호출

---

## 🟢 낮음

### 8. `isNativeFileStorageAvailable` 중복 정의
| 파일 | 위치 |
|------|------|
| `src/database/db.ts:202` | `export const isNativeFileStorageAvailable = () => Capacitor.isNativePlatform();` |
| `src/database/fileStorage.ts:34` | `export const isNativeFileStorageAvailable = () => Capacitor.isNativePlatform();` |

**제안**: 한 파일(예: `db.ts` 또는 별도 `platform.ts`)에서 정의하고 export 공유

---

### 9. `accountTable` / `templateTable` 암호화 분기 로직 중복
**공통 패턴** (두 파일 모두 동일하게 존재):
- `getAll(cryptoKey?)`: 암호화 레코드면 복호화, 평문이면 파싱, 키 없으면 최소 객체 반환
- `getById(id, cryptoKey?)`: 동일
- `create(data, cryptoKey?)`: 키 있으면 `createEncryptedRecord`, 없으면 `createPlaintextRecord`
- `update(data, cryptoKey?)`: 동일
- `restore(data, cryptoKey?)`: 동일
- `bulkRestore(items, cryptoKey?)`: 동일

**제안**
- 제네릭 `TableCRUD<TRecord, TModel>` 클래스/함수로 추출
- `encryptRecord`, `decryptRecord`, `createPlaintextRecord`를 전략으로 주입

---

### 10. `backupDataFile` / `changePinDataFile` 구현 중복
**위치**: `src/database/fileStorage.ts:198-217`

```typescript
export const backupDataFile = async (fileName: string, pin: string) => {
  const cryptoKey = useSessionStore.getState().cryptoKey ?? undefined;
  const data = await getDatabaseSnapshot(normalizedFileName, cryptoKey);
  return saveDataFile(data, normalizedFileName, pin, false);
};

export const changePinDataFile = async (fileName: string, pin: string) => {
  const cryptoKey = useSessionStore.getState().cryptoKey ?? undefined;
  const data = await getDatabaseSnapshot(normalizedFileName, cryptoKey);
  return saveDataFile(data, normalizedFileName, pin, false);
};
```

**문제점**
- 구현이 **완전 동일**
- `backupDataFile`: 백업용 파일 생성 (기존 파일 유지하며 별도 파일로 저장)
- `changePinDataFile`: PIN 변경 후 재암호화 (같은 파일 덮어쓰기)
- 용도가 다른데 구현이 같음 → 한쪽이 잘못됐거나 미사용 코드 의심
- 별도 `changePin` 함수(fileStorage.ts:385)는 제대로 동작 중

**제안**: `changePinDataFile` 사용처 확인 후 제거 또는 용도 명확화

---

### 11. `isKiyoFile` 검증 느슨함
**위치**: `src/database/fileStorage.ts:41-51`

```typescript
export const isKiyoFile = (value: unknown): value is KiyoVaultData => {
  const data = value as Partial<KiyoVaultData>;
  return (
    data.version === 1 &&
    (data.fileName === undefined || typeof data.fileName === "string") &&  // undefined 허용
    Array.isArray(data.accounts) &&
    Array.isArray(data.templates) &&
    Array.isArray(data.metadata)
  );
};
```

**문제점**
- `KiyoVaultData` 타입에서 `fileName: string` (필수)인데 `undefined` 허용
- `updatedAt: number` 필수 필드 미체크
- `version`만 체크하고 다른 필수 속성 검증 누락

**제안**
```typescript
export const isKiyoFile = (value: unknown): value is KiyoVaultData => {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    data.version === 1 &&
    typeof data.fileName === "string" &&
    typeof data.updatedAt === "number" &&
    Array.isArray(data.accounts) &&
    Array.isArray(data.templates) &&
    Array.isArray(data.metadata)
  );
};
```

---

### 12. `fileTable.getActiveFileInfo` 반환 타입 union 불편
**위치**: `src/database/fileTable.ts:53-58`

```typescript
async getActiveFileInfo(): Promise<{
  activeFileName: string | null;
  salt: Uint8Array | null;
  encrypted: boolean;
  fileData: KiyoVaultData | EncryptedKiyoVaultData | null;  // ← union
}> {
```

**문제점**
- 호출부에서 반드시 `isEncryptedKiyoFile(fileData)`로 분기해야 타입 좁히기 가능
- `encrypted` 플래그랑 `fileData` 타입이 연동 안 됨

**제안**
- 판별된 유니언으로 변경:
```typescript
type ActiveFileInfo =
  | { encrypted: true; fileData: EncryptedKiyoVaultData; salt: Uint8Array; activeFileName: string }
  | { encrypted: false; fileData: KiyoVaultData; salt: null; activeFileName: string }
  | { encrypted: false; fileData: null; salt: null; activeFileName: null };
```
- 또는 `getActiveFileRecord`(원시) / `getActiveFileInfo`(파싱+타입안전) 분리 유지하되 타입 개선

---

### 13. `replaceDatabaseData`에서 `fileDataToSave` 로직 타입 안전성 개선 여지
**위치**: `src/database/db.ts:146-149`

```typescript
const fileDataToSave = cryptoKey ? encryptedFileData : data;
if (cryptoKey && !encryptedFileData || !fileDataToSave) {
  throw new Error("저장할 파일 데이터가 없습니다.");
}
```

**현황**: 11.9에서 판별된 유니언(`ReplaceDatabaseDataParams`)으로 타입 레벨에서 강제 중
**추가 개선**: 런타임 체크는 방어적 코드로 남겨두되, 타입만으로도 커버되므로 주석으로 명시

---

### 14. `sessionStore` persist 설정에서 `cryptoKey` 제외 확인됨 (정상)
**위치**: `src/store/sessionStore.ts:77-81`

```typescript
partialize: (state) => ({
  activeFileName: state.activeFileName,
  salt: state.salt,
  lastSyncTime: state.lastSyncTime,
  // cryptoKey는 의도적으로 제외 (메모리만 보관)
}),
```

**상태**: 정상 동작 중. 문서화만 잘 되어 있으면 됨.

---

## 수정 우선순위 로드맵

### Phase 1: 즉각 수정 (높음 + 쉬운 것)
1. ✅ `console.log` 제거 (encryption.ts:21)
2. ✅ `isVerifyPin` → `verifyPin` rename
3. ✅ `fileTable.upsertFileRecord` salt 체크 단순화
4. ✅ 중복 `EncryptedKiyoVaultData` 타입 정리 (vault.ts에서 import)

### Phase 2: 구조 개선 (중간)
5. `saveDataFile` 분해 및 기능별 분리
6. `createPlaintextRecord` 네이밍/타입 정리
7. `isNativeFileStorageAvailable` 중복 제거
8. `isKiyoFile` 검증 강화

### Phase 3: 리팩토링 (낮음, 시간 날 때)
9. `accountTable` / `templateTable` 공통 CRUD 추출
10. `backupDataFile` / `changePinDataFile` 중복 정리
11. `syncDatabaseToFile` 파라미터 타입 개선
12. `fileTable.getActiveFileInfo` 반환 타입 판별된 유니언으로

---

## 관련 문서

- `docs/research/data-storage-architecture.md` — 전체 아키텍처 문서 (11.1~11.9 반영됨)
- `src/database/db.ts` — DB 스키마, 스냅샷, 동기화, 교체 로직
- `src/database/fileTable.ts` — 파일 테이블 CRUD (ACTIVE_FILE_ID 기반)
- `src/database/fileStorage.ts` — 파일 생성/백업/가져오기/PIN변경/잠금/해제
- `src/crypto/encryption.ts` — 볼트 단위 암호화 (PBKDF2 + AES-GCM)
- `src/crypto/recordEncryption.ts` — 레코드 단위 암호화 (IndexedDB용)
- `src/store/sessionStore.ts` — 세션 상태 (cryptoKey 메모리 전용, salt만 persist)
- `src/store/accountStore.ts` / `templateStore.ts` — 계정/템플릿 상태 + 자동 동기화

---

*이 문서는 코드 리뷰 결과를 기록용으로 저장한 것입니다. 실제 수정은 별도 PR/커밋으로 진행하세요.*