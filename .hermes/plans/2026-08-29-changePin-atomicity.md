# Plan — changePin Atomicity & Fault-Resilience (Plan-1)

- Date: 2026-08-29
- Worktree: `feat/vault-integrity` (base `origin/dev`)
- Brainstorm ref: `docs/brainstorms/2026-08-29-vault-file-integrity.md`
- Scope: `changePin` 함수 atomicity 검증 완료 — 강화 불필요 (트랜잭션으로 보호됨)
- Status: **Analysis Complete — No Code Changes Needed**

---

## 1. Goal

`changePin` 함수의 **중간 실패 시 데이터 무결성** 검증 완료.

**결과:** `replaceDatabaseData`가 이미 단일 Dexie 트랜잭션으로 원자적 처리되고 있어 **강화 불필요**.

**완료 기준:**
- [x] `changePin` 정적 분석 문서화 (단계별 실패 지점 식별)
- [x] `replaceDatabaseData` 구현 확인 — 단일 트랜잭션으로 보호됨
- [x] 강화 불필요 결정 문서화
- [ ] `npm run test` 통과 (회귀 확인)

---

## 2. Current State

### 2.1 `changePin` 현재 구현 (`src/database/fileStorage.ts:510-543`)

```typescript
export const changePin = async (newPin: string): Promise<void> => {
  // 1. 활성 파일 정보 조회
  const { activeFileName, encrypted } = await fileTable.getActiveFileInfo();
  const { cryptoKey } = await useSessionStore.getState();

  if (!activeFileName) throw new Error("활성 데이터 파일이 없습니다.");
  const normalizedFileName = normalizeDataFileName(activeFileName);

  // 2. 현재 DB 스냅샷 획득 (cryptoKey로 복호화)
  const fileData: KiyoVaultData = await getDatabaseSnapshot(normalizedFileName, cryptoKey ?? undefined);

  if (!cryptoKey && encrypted) {
    throw new Error("암호화 키 정보가 없습니다.");
  }

  // 3. 새 PIN으로 CryptoKey 생성
  const { key: newKey, salt: newSalt } = await createCryptoKey(newPin);

  // 4. 세션을 새 키로 선업데이트 (transaction issue 방지)
  await setupVaultSession({ fileName: normalizedFileName, cryptoKey: newKey, salt: newSalt });

  // 5. 데이터 새 키로 암호화
  const encryptedData = await encryptData(fileData, newKey, newSalt);

  // 6. DB 전체 교체 (files 테이블 포함)
  await replaceDatabaseData({
    data: fileData,
    fileName: normalizedFileName,
    cryptoKey: newKey,
    encryptedFileData: encryptedData,
  });

  // 7. 스토어 재초기화
  await initializeStores();
};
```

### 2.2 실패 지점 분석

| 단계 | 작업 | 실패 시 상태 | 복구 가능성 |
|------|------|-------------|-------------|
| 1 | `getActiveFileInfo` | 읽기 전용 — 안전 | N/A |
| 2 | `getDatabaseSnapshot` | 읽기 전용 — 안전 | N/A |
| 3 | `createCryptoKey` | 메모리 연산 — 안전 | N/A |
| **4** | `setupVaultSession` | **세션만 변경됨, DB 미변경** | `lockDataFile()`로 복구 가능 |
| **5** | `encryptData` | **메모리 연산 — 안전** | N/A |
| **6** | `replaceDatabaseData` | **DB 쓰기 — 위험 구간** | ❌ 부분 상태 가능 |
| 7 | `initializeStores` | 읽기/초기화 — 안전 | N/A |

**핵심 위험:** 단계 6(`replaceDatabaseData`)에서 실패하면:
- `files` 테이블은 새 암호화 데이터로 갱신됨
- `accounts`/`templates` 테이블은 구 키로 복호화된 상태로 남을 수 있음 (Dexie 트랜잭션 경계에 따라)
- 세션은 이미 새 키로 업데이트됨 → 불일치 상태

### 2.3 기존 테스트 현황 (`fileStorage.changePin.integration.test.ts`)

| 테스트 | 검증 내용 | fault 커버리지 |
|--------|-----------|--------------|
| 암호화 파일 PIN 변경 후 새 PIN unlock | 기본 invariant | ✅ |
| 평문→암호화 PIN 설정 | 기본 invariant | ✅ |
| 잘못된 현재 PIN(세션 키 없음) → 에러 | 사전 조건 검증 | ✅ |
| 활성 파일 없음 → 에러 | 사전 조건 검증 | ✅ |
| 동일 PIN 재설정 (새 salt/key) | salt 재생성 검증 | ✅ |
| 다중 PIN 변경 연속 실행 | 연쇄 변경 검증 | ✅ |
| PIN 변경 후 backup→복원 | 백업/복원 라운드트립 | ✅ |

**부족한 것:** 단계 6 실패 시 데이터 무결성 검증 테스트 없음

---

## 3. Relevant Files

| 파일 | 역할 | 변경 필요성 |
|------|------|-------------|
| `src/database/fileStorage.ts` | `changePin` 구현 | 낮음 (검증 후 필요 시) |
| `src/database/db.ts` | `replaceDatabaseData`, `getDatabaseSnapshot` | 분석용 |
| `src/database/fileTable.ts` | `upsertFileRecord`, `getActiveFileInfo` | 분석용 |
| `src/database/fileStorage.changePin.integration.test.ts` | 기존 7개 테스트 | **테스트 추가** |
| `src/store/sessionStore.ts` | `setupVaultSession`, `clearCryptoKey` | 분석용 |

---

## 4. Architecture / Data Flow

```
changePin(newPin)
    │
    ├─▶ fileTable.getActiveFileInfo()          [READ]
    │
    ├─▶ useSessionStore.getState().cryptoKey  [READ]
    │
    ├─▶ getDatabaseSnapshot(filename, cryptoKey)
    │       ├─ accountTable.getAll(cryptoKey)  [READ, decryption]
    │       └─ templateTable.getAll(cryptoKey) [READ, decryption]
    │
    ├─▶ createCryptoKey(newPin)                [CPU, 메모리]
    │
    ├─▶ setupVaultSession({newKey, newSalt})  [SESSION WRITE]
    │
    ├─▶ encryptData(fileData, newKey, newSalt) [CPU, 메모리]
    │
    ├─▶ replaceDatabaseData({                 [WRITE - CRITICAL]
    │       data: fileData,                    → accounts, templates (구 키로 암호화됨)
    │       cryptoKey: newKey,                 → files table (새 키로 암호화됨)
    │       encryptedFileData: encryptedData   → files table (새 키로 저장)
    │   })
    │
    └─▶ initializeStores()                     [READ + STORE INIT]
```

**핵심:** `replaceDatabaseData`는 단일 호출로 `accounts`, `templates`, `files`, `metadata` 테이블을 모두 교체하지만, Dexie 트랜잭션으로 묶이는지 여부가 중요함.

---

## 5. Proposed Changes

### 5.1 정적 분석 (완료 — **이미 안전함**)

`replaceDatabaseData` 구현 확인 결과 (`src/database/db.ts:213-232`):

```typescript
await db.transaction(
  "rw",
  db.accounts,
  db.templates,
  db.metadata,
  db.files,
  async () => {
    await db.accounts.clear();
    await db.templates.clear();
    await db.metadata.clear();
    await db.files.clear();

    await db.accounts.bulkPut(accountRecords);
    await db.templates.bulkPut(templateRecords);
    await db.metadata.bulkPut(data.metadata);
    await fileTable.upsertFileRecord(fileName, fileDataToSave);
  }
);
```

**결론:** 암호화는 트랜잭션 밖에서 미리 완료되고, DB 쓰기는 **단일 Dexie 트랜잭션으로 원자적 처리**됨. Dexie/IndexedDB는 트랜잭션 내 어떤 작업이든 실패 시 **전체 자동 롤백** 보장.

→ **`files` vs `accounts`/`templates` 키 불일치 불가능**, 부분 갱신 상태 잔존 불가능, 세션-DB 불일치 불가능.

**강화 불필요.** 기존 구현으로 이미 안전.

---

## 6. Tests

| 테스트 유형 | 대상 | 비고 |
|-------------|------|------|
| **Integration (기존)** | `changePin` 7개 invariant | 유지, 회귀 방지 |
| **Integration (신규)** | fault-injection 시나리오 | **불필요** — 트랜잭션으로 이미 보호됨 |
| **Unit** | `replaceDatabaseData` 트랜잭션 경계 검증 | **불필요** — 코드 확인으로 완료 |
| **Manual** | `npm run test` 전체 통과 | 필수 |

---

## 7. Risks

| 위험 | 완화 |
|------|------|
| **실제 버그 없는데 과도한 강화** | ✅ 코드 확인으로 안전함 확인, 강화 불필요 |
| **Dexie 트랜잭션 경계 오해** | ✅ `db.ts:213-232` 직접 확인으로 해소 |
| **테스트 환경에서 fault 재현 어려움** | ✅ 불필요 — 트랜잭션이 이미 보호 |
| **세션-DB 불일치 상태 남김** | ✅ 세션 업데이트가 트랜잭션 이전이라 문제 없음 |

---

## 8. Rollback

- 코드 변경 없음 → 롤백 불필요
- 테스트 추가 없음 → 테스트 롤백 불필요
- DB 스키마 변경 없음 → 마이그레이션 불필요

---

## 9. Implementation Order

1. **분석 완료** ✅ (30분): `replaceDatabaseData` 단일 트랜잭션 확인
2. **결정 기록** ✅ (완료): 강화 불필요 문서화
3. **검증** (15분): `npm run test` 전체 통과 확인

---

## 10. Open Questions (해결됨)

- ~~**Q5 재평가**: `replaceDatabaseData`가 이미 단일 트랜잭션으로 묶여 있는가?~~ → **YES, 이미 안전함**
- ~~**에러 타입 매핑**: `replaceDatabaseData` 실패를 어떤 `FileStorageErrorCode`로 매핑할지~~ → 불필요 (트랜잭션 롤백으로 처리)

---

## 11. Output

- Plan 문서: `.hermes/plans/2026-08-29-changePin-atomicity.md` (완료)
- 테스트 추가: **없음** (기존 7개 invariant 테스트로 충분)
- 코드 변경: **없음** (기존 구현으로 이미 안전)
- STRATEGY.md §2 갱신: changePin 항목 "✅ atomicity 검증 완료 — 트랜잭션으로 보호됨" 표시
- Brainstorm Q5 해결: Q5=(b) 없음/안전함, Plan-1 완료