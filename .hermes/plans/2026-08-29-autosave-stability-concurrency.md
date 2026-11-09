# Plan — Autosave Stability & Concurrency Control (Plan-6)

- Date: 2026-08-29
- Worktree: `feat/vault-integrity` (base `origin/dev`)
- Brainstorm ref: `docs/brainstorms/2026-08-29-vault-file-integrity.md`
- Scope: `persistVaultSnapshot` 직렬화 큐 구현 + race/lock→unlock 시나리오 테스트 추가
- Status: Ready for implementation

---

## 1. Goal

`persistVaultSnapshot` 호출을 **직렬화 큐**로 순차 처리하여 동시 mutation 시 race condition 방지하고, 기존 autosave invariant 테스트를 강화한다.

**완료 기준:**
- [x] `src/database/syncQueue.ts` 신규 생성 — 직렬화 큐 구현
- [x] `accountStore._persistAccounts`, `templateStore` → `enqueuePersistVaultSnapshot(getParamsFn)`로 연결 변경
- [x] `fileStorage.lifecycle.integration.test.ts`에 race/lock→unlock 시나리오 추가
- [x] `npm run check` 통과 (기존 272개 + 신규 테스트 모두 통과)

---

## 2. Current State

### 2.1 현재 Autosave 흐름

```
addAccount / updateAccount / deleteAccount (accountStore)
createTemplate / updateTemplate / deleteTemplate (templateStore)
    │
    └─▶ _persistAccounts() / _persistTemplates()
           │
           └─▶ syncDatabaseToFile (= persistVaultSnapshot)
                  │
                  ├─▶ getDatabaseSnapshot()  [READ]
                  ├─▶ encryptData()          [CPU]
                  └─▶ fileTable.upsertFileRecord()  [WRITE - Dexie]
```

**문제:** 모든 mutation이 독립적으로 `persistVaultSnapshot`을 **비동기 fire-and-forget** 호출 → 동시 실행 시 race condition 가능

### 2.2 기존 테스트 현황

| 테스트 파일 | 테스트 수 | 비고 |
|------------|-----------|------|
| `fileStorage.lifecycle.integration.test.ts` | 13개 | create/open/backup/restore/lock/unlock 시나리오 |
| `fileStorage.changePin.integration.test.ts` | 7개 | PIN 변경 invariant |
| `fileStorage.error.integration.test.ts` | 9개 | 에러 처리 (방금 2개 추가) |
| `fileStorage.encryption.integration.test.ts` | 5개 | 암호화 라운드트립 |
| `fileStorage.test.ts` | 22개 | 순수 함수 단위 테스트 |

**부족한 것:** 동시 mutation race, lock→unlock 후 스냅샷 보존, 연속 mutation 마지막 스냅샷 일관성

---

## 3. Relevant Files

| 파일 | 역할 | 변경 필요성 |
|------|------|-------------|
| `src/database/syncQueue.ts` | **신규** — 직렬화 큐 구현 | **신규 생성** |
| `src/database/db.ts` | `persistVaultSnapshot`, `getDatabaseSnapshot` | 분석용 |
| `src/store/accountStore.ts` | `_persistAccounts` | **연결 변경** |
| `src/store/templateStore.ts` | create/update/delete/template | **연결 변경** |
| `src/database/fileStorage.lifecycle.integration.test.ts` | Autosave 라이프사이클 테스트 | **테스트 추가** |
| `src/store/sessionStore.ts` | `activeFileName`, `cryptoKey`, `salt` getter | 분석용 |

---

## 4. Architecture / Data Flow

### 변경 전 (Race 가능)
```
Mutation 1 ─▶ persistVaultSnapshot() ──▶ [Dexie write]  ← 동시에 실행!
Mutation 2 ─▶ persistVaultSnapshot() ──▶ [Dexie write]  ← 순서 불명확, race
Mutation 3 ─▶ persistVaultSnapshot() ──▶ [Dexie write]
```

### 변경 후 (직렬화 큐)
```
Mutation 1 ─▶ enqueuePersistVaultSnapshot() ──┐
Mutation 2 ─▶ enqueuePersistVaultSnapshot() ──┤──▶ 큐에서 순차 처리
Mutation 3 ─▶ enqueuePersistVaultSnapshot() ──┘     (완료까지 대기)

큐 내부:
  while (queue.length > 0) {
    const task = queue.shift();
    await task();  // 순차 실행, 에러 시 resolve()로 다음 진행
  }
```

### 세션 최신값 읽기 (중요)
```typescript
// store에서 getter 함수로 전달
await enqueuePersistVaultSnapshot(() => ({
  activeFileName: session.activeFileName,
  cryptoKey: session.cryptoKey,
  salt: session.salt,
  clearSyncError: session.clearSyncError,
  setSyncError: session.setSyncError,
}));
```
→ 큐 처리 시점에 **최신 세션 상태** 읽기 (lock/unlock 사이에도 안전)

---

## 5. Proposed Changes

### 5.1 신규 파일: `src/database/syncQueue.ts`

```typescript
import { persistVaultSnapshot, type SyncDatabaseParams } from "./db";

type ParamsGetter = () => SyncDatabaseParams;
type Task = { getParams: ParamsGetter; resolve: () => void; reject: (e: Error) => void };

const queue: Task[] = [];
let processing = false;

export function enqueuePersistVaultSnapshot(getParams: ParamsGetter): Promise<void> {
  return new Promise((resolve, reject) => {
    queue.push({ getParams, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const { getParams, resolve, reject } = queue.shift()!;
    try {
      const params = getParams();  // 실행 시점에 최신 세션 읽기
      await persistVaultSnapshot(params);
      resolve();
    } catch (e) {
      // 에러 로깅 후 다음 작업 계속 진행 (기존 동작 유지)
      console.error("[syncQueue] persist failed, continuing:", e);
      resolve();  // reject하지 않고 resolve로 다음 작업 진행
    }
  }
  processing = false;
}

// 테스트용 헬퍼
export function waitForQueueDrain(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => (queue.length === 0 && !processing ? resolve() : setTimeout(check, 10));
    check();
  });
}
```

### 5.2 `accountStore.ts` 연결 변경

```typescript
// src/store/accountStore.ts
import { enqueuePersistVaultSnapshot } from "@/database/syncQueue";

// _persistAccounts 변경 전:
_persistAccounts: async () => {
  const sessionState = useSessionStore.getState();
  await syncDatabaseToFile({...});
},

// _persistAccounts 변경 후:
_persistAccounts: async () => {
  await enqueuePersistVaultSnapshot(() => {
    const sessionState = useSessionStore.getState();
    return {
      activeFileName: sessionState.activeFileName,
      cryptoKey: sessionState.cryptoKey,
      salt: sessionState.salt,
      clearSyncError: sessionState.clearSyncError,
      setSyncError: sessionState.setSyncError,
    };
  });
},
```

### 5.3 `templateStore.ts` 연결 변경 (동일 패턴)

```typescript
// src/store/templateStore.ts
import { enqueuePersistVaultSnapshot } from "@/database/syncQueue";

// createTemplate, updateTemplate, deleteTemplate, clearTemplates 내부에서
// syncDatabaseToFile(...) 호출을 enqueuePersistVaultSnapshot(() => ({...}))로 변경
```

---

## 6. Tests

### 6.1 신규 테스트 (`fileStorage.lifecycle.integration.test.ts`)

```typescript
describe("autosave - concurrency & stability", () => {
  it("연속 addAccount 10개 → 큐 순차 처리 후 마지막 스냅샷에 10개 모두 반영", async () => {
    await createDataFile("queue-test.json", "1234");
    const promises = Array.from({ length: 10 }, (_, i) => 
      accountStore.getState().addAccount(makeAccount(`acc${i}`))
    );
    await Promise.all(promises);  // 모든 mutation 발사
    await waitForQueueDrain();    // 큐 비워질 때까지 대기
    const snap = await getDatabaseSnapshot("queue-test.json", cryptoKey);
    expect(snap.accounts).toHaveLength(10);
  });

  it("add/update/delete 혼합 연속 실행 → 마지막 스냅샷 일관성", async () => {
    await createDataFile("mixed-test.json", "1234");
    const a1 = await accountStore.getState().addAccount(makeAccount("a1"));
    await accountStore.getState().updateAccount({ ...a1, title: "a1-updated" });
    await accountStore.getState().deleteAccount(a1.id);
    await waitForQueueDrain();
    const snap = await getDatabaseSnapshot("mixed-test.json", cryptoKey);
    expect(snap.accounts).toHaveLength(0);
  });

  it("lockDataFile → unlockFile 후 스냅샷 보존", async () => {
    await createDataFile("lock-test.json", "1234");
    await accountStore.getState().addAccount(makeAccount("acc1"));
    await waitForQueueDrain();
    
    await lockDataFile();
    const unlocked = await unlockFile("lock-test.json", "1234");
    await waitForQueueDrain();
    
    const snap = await getDatabaseSnapshot("lock-test.json", cryptoKey);
    expect(snap.accounts).toHaveLength(1);
  });

  it("persistVaultSnapshot 에러 주입 → 다음 작업 정상 진행", async () => {
    // encryptData mock reject로 에러 유도
    // 에러 로그만 찍고 큐 계속 진행되는지 검증
  });
});
```

### 6.2 Android E2E (에뮬레이터, `AutosaveE2ETest`)

`android/app/src/androidTest/java/com/kiyo/app/autosave/AutosaveE2ETest.kt` — 자동저장/자동백업 end-to-end 검증. 호스트 스크립트는 `android/run-autosave-e2e.ps1` (2026-08-29 추가, SAF picker 자동화는 비활성 — 사용자가 picker에서 직접 운전).

실행:
```bash
npm run test:e2e:autosave       # full build + install + am instrument
npm run test:e2e:autosave:fast  # 설치된 APK 재사용
```

단일 메서드:
```bash
npm run test:e2e:autosave:fast -- -TestMethod enableAutoBackup_persistsState
```

---

## 7. Risks

| 위험 | 완화 |
|------|------|
| **큐 무한 대기** | `waitForQueueDrain` 타임아웃 추가 (테스트용) |
| **메모리 누적** | 큐 처리 후 배열에서 shift로 제거, 배열 길이 제한 고려 |
| **세션 상태 스테일** | getter 함수로 실행 시점 최신값 읽기로 해결 |
| **에러 시 큐 멈춤** | `resolve()`로 다음 작업 계속 진행 (기존 동작 유지) |
| **기존 테스트 깨짐** | 동작은 동일, 순서만 보장 → 회귀 없음 |

---

## 8. Rollback

- `syncQueue.ts` 삭제
- `accountStore.ts`, `templateStore.ts` → `syncDatabaseToFile` 호출로 복구
- 테스트 파일에서 신규 테스트 제거

---

## 9. Implementation Order

1. **syncQueue.ts 생성** (15분): 큐 로직 + `waitForQueueDrain` export
2. **accountStore 연결 변경** (10분): `_persistAccounts` 변경
3. **templateStore 연결 변경** (10분): 4개 mutation 메서드 변경
4. **기존 테스트 실행** (5분): `npm run test` 회귀 확인
5. **신규 테스트 추가** (20분): `fileStorage.lifecycle.integration.test.ts`에 4개 시나리오
6. **전체 검증** (5분): `npm run check` 전체 통과

---

## 10. Open Questions (해결됨)

- **큐 vs Debounce**: 직렬화 큐로 결정 (Brainstorm Q3)
- **에러 처리**: `resolve()`로 계속 진행 (기존 `setSyncError` UI 알림 유지)
- **세션 최신값**: getter 함수 패턴으로 해결

---

## 11. Output

- 신규 파일: `src/database/syncQueue.ts`
- 변경 파일: `src/store/accountStore.ts`, `src/store/templateStore.ts`
- 테스트 추가: `src/database/fileStorage.lifecycle.integration.test.ts` (4개 시나리오)
- Android E2E: `android/app/src/androidTest/java/com/kiyo/app/autosave/AutosaveE2ETest.kt`, `android/run-autosave-e2e.ps1`
- npm 스크립트: `test:e2e:autosave`, `test:e2e:autosave:fast`
- 검증: `npm run check` 통과

---

## 12. Status Tracking

| 항목 | 상태 | 비고 |
|------|------|------|
| syncQueue.ts 생성 | ✅ 완료 | `src/database/syncQueue.ts` |
| accountStore 연결 변경 | ✅ 완료 | `_persistAccounts` → `enqueuePersistVaultSnapshot` |
| templateStore 연결 변경 | ✅ 완료 | create/update/delete/clear |
| 기존 테스트 회귀 없음 | ✅ 완료 | `npm run test` 통과 |
| 신규 테스트 4개 추가 | ✅ 완료 | lifecycle 파일 describe "autosave - concurrency & stability (Plan-6)" |
| `npm run check` 통과 | ✅ 완료 | typecheck + vitest |
| Android E2E: `AutosaveE2ETest` | ✅ 완료 | 자동저장/자동백업 시나리오 |
| 호스트 스크립트 `run-autosave-e2e.ps1` | ✅ 완료 | SAF picker 자동화 비활성, 사용자 직접 운전 |
| npm 스크립트 `test:e2e:autosave{,fast}` | ✅ 완료 | package.json 등록 |