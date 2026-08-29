# Brainstorm — Vault File Integrity (STRATEGY §2 통합)

- Date: 2026-08-29
- Worktree: `feat/vault-integrity` (base `origin/dev`)
- Source: STRATEGY.md §2
- Status: Brainstorm (no code changed)
- Scope: §2의 모든 하위 항목을 단일 문서로 정리. 실제 구현 범위는 후속 plan에서 결정.

---

## 1. Problem

STRATEGY §2(볼트 파일 안정성)는 6개 요구사항으로 구성되며, 일부는 이미 코드에 구현되어 있고 일부는 미구현/부분 구현 상태. 어떤 항목이 실제로 작업 대상인지 정렬되지 않은 채로 남아 있어, plan 작성 전에 무엇이 진짜 "남은 일"인지 한 화면에서 판단할 수 있도록 통합 정리가 필요함.

## 2. Goal

1. §2의 6개 요구사항 각각에 대해 "현재 상태 / 남은 일 / 의존성 / 리스크"를 단일 문서로 매핑.
2. 우선순위 결정에 필요한 open questions만 남기고, 나머지는 옵션으로 압축.
3. 후속 `ce-plan`이 본 문서를 기준으로 작업 범위를 좁힐 수 있도록 함.

## 3. Context

### 3.1 인스펙션한 파일/모듈

| 영역 | 파일 | 메모 |
|---|---|---|
| Autosave 진입점 | `src/store/accountStore.ts`, `src/store/templateStore.ts` | 모든 mutation 후 `syncDatabaseToFile` 호출 |
| Autosave 코어 | `src/database/db.ts` (`persistVaultSnapshot`) | native only, 에러 시 `setSyncError`로 UI 노출 |
| 볼트 파이프라인 | `src/database/fileStorage.ts` (`createEncryptedVault`, `persistVaultRecord`, `setupVaultSession`, `changePin`, `backupDataFile`, `openImportedDataFile`) | pipeline 함수로 분리되어 있음 |
| SAF 백업/복원 | `src/database/fileExport.ts` + `android/.../KiyoFilePlugin.kt` | `ACTION_CREATE_DOCUMENT` / `ACTION_OPEN_DOCUMENT` 사용 |
| PIN 다이얼로그 | `src/pages/Settings/components/PinChangeDialog.tsx` | 4~6자리 숫자만 허용 |
| Crypto | `src/crypto/encryption.ts` | PBKDF2 100k, AES-GCM 256, salt 16B, IV 12B |
| 기존 invariant 테스트 | `src/database/fileStorage.changePin.integration.test.ts` | 핵심 PIN 변경 invariant는 이미 검증됨 |

### 3.2 STRATEGY §2 원문 (요약 매핑)

| STRATEGY 항목 | 코드 상태 | 비고 |
|---|---|---|
| 암호화 볼트 생성/열기/백업/복원/마이그레이션 무결성 | ✅ 구현 + 일부 테스트 | SAF 백업/복원의 자동 회귀 테스트 부재 |
| PIN/패스프레이즈 변경 시 데이터 손실 0, salt 재사용 방지 | ✅ invariant 테스트됨 | fault-injection 부재 |
| SAF 기반 파일 선택·복원 신뢰도 | ✅ 구현 | JVM/E2E 회귀 테스트 부재 |
| **파일 자동 저장(autosave)** | ⚠️ **부분 구현 — 의미 변경됨** | 외부 파일(Documents) 자동 export는 의도적으로 제거됨. IndexedDB `files` 테이블 upsert만 잔존. 결정: `e8385826` (`.hermes/plan_old/separate-internal-autosave-from-external-backup.md`) |
| **숫자 PIN(6자리) → 텍스트 패스프레이즈 + zxcvbn** | ❌ **미구현** | 가장 큰 사용자 모델 변경 |
| **크로스플랫폼 볼트 파일 포맷 표준화** | ⚠️ 부분 충족 (v1 포맷 존재) | iOS/Web 데스크톱 확장 시 본격 작업 |

### 3.3 autosave 의미 변경 (중요)

- **과거:** CRUD → `syncDatabaseToFile()` → IndexedDB `files` 테이블 **+ `/Documents/kiyo-*.json` 외부 쓰기**
- **현재:** CRUD → `persistVaultSnapshot()` → IndexedDB `files` 테이블 **만** 갱신
- **이유 (commit `e8385826`, 2026-08-23):** Android 11+ Scoped Storage로 인해 모든 mutation에서 사용자 개입 없이 외부 파일 쓰기가 불가. 외부 저장은 **사용자 명시적 백업(SAF)** 으로만.
- **잔존:** `fileExport.ts`에 `writeBackupToUri` / `readBackupFromUri` 함수가 정의되어 있으나 현재 호출처 없음. STRATEGY의 "autosave" 의미를 그대로 살리려면 **SAF URI 영구 권한(takePersistableUriPermission) 기반 자동 백업**을 별도 plan으로 추가하는 옵션이 있음.

### 3.4 Plan-3 (포맷 진화) 보류 평가

**Plan-3 후보 작업이 무엇이었나:**
- `isKiyoFile`의 `version === 1` 하드코딩(`fileStorage.ts:37`) 제거 → `migrate(v1→v2)` 함수 자리 만들기
- `EncryptedKiyoVaultData.version: 1` literal(`encryption.ts:12,27,87`) → 식별 가능한 enum/상수 분리
- salt 무결성 검증(길이 외) 추가

**현 시점에 보류 권장 근거:**
1. **YAGNI** — v2로 가야 할 구체적 요구(필드 추가, KDF 강화, 알고리즘 변경)가 **없음**
2. **iOS/데스크톱 확장 미결정** — STRATEGY의 "크로스플랫폼 표준화"는 슬로건일 뿐, 실제 플랫폼 추가 일정이 없음
3. **죽은 코드 위험** — `migrate(v1→v2)` 자리만 만들어도 호출 경로가 없으면 dead code가 됨
4. **현 v1 hardcoding이 당장은 안전** — v2 도입 시점에 그때 만들면 됨
5. **STRATEGY 우선순위** — 사용자가 §2에서 패스프레이즈(Plan-4)보다 뒤로 미뤘고, Plan-3은 그것보다도 추상적

**v2 도입이 정당화되는 시점 (후속 plan 트리거):**
- (a) 패스프레이즈(Plan-4)로 가면서 KDF iterations 변경 필요
- (b) record encryption 필드 스키마 변경 (예: `Account` 모델에 새 필수 필드)
- (c) iOS/데스크톱 확장 결정 + Web Crypto 호환성 이슈
- (d) KDF 강화 결정 (PBKDF2 100k → 600k 등)

**현재 결정:** Q6 = (c) 보류. 위 트리거 중 하나라도 발생 시 별도 brainstorm.

## 4. Constraints

- **네트워크 권한 0, 클라우드 동기화 없음** (STRATEGY Boundary #1, #3) — 모든 신뢰성 보강은 로컬 전제.
- **cryptoKey는 메모리 only** — persist 금지. salt는 persist 허용(이미 localStorage에 저장 중).
- **PBKDF2 100k + AES-GCM 256** 유지 (encryption.ts:51). 패스프레이즈 도입 시에도 iterations 변경은 별도 결정.
- **Android Keystore 기반 autofill 인증**과 분리 — autofill DB 키/복호화에 영향 주지 않음.
- **Autofill은 Keystore 전제, React 토큰 sync 없음** — vault 변경이 autofill 경로를 깨면 안 됨.
- 기존 6자리 PIN 사용자가 있는 마이그레이션 시나리오(있다면) 호환.

## 5. Existing Architecture (요약)

```
[User mutation]
  └─ accountStore / templateStore (Zustand)
       └─ syncDatabaseToFile / persistVaultSnapshot
            ├─ getDatabaseSnapshot (Dexie → KiyoVaultData)
            ├─ encryptData (PBKDF2 → AES-GCM)
            └─ fileTable.upsertFileRecord (Dexie files 테이블, native only)

[User backup/restore]
  └─ DataSection (UI)
       ├─ backupDataFile → exportBackupFile → KiyoFile.saveFile (SAF ACTION_CREATE_DOCUMENT)
       └─ openImportedDataFile ← importBackupFile ← KiyoFile.openFile (SAF ACTION_OPEN_DOCUMENT)

[changePin]
  └─ PinChangeDialog → changePin
       └─ getDatabaseSnapshot → encryptData(new) → replaceDatabaseData → initializeStores
```

autosave는 사실상 in-app(단일 디바이스) 신뢰성 경로이고, SAF backup/restore은 외부 보관/이전을 위한 경로. 두 경로의 invariant는 분리되어 다뤄야 함.

## 6. Relevant Previous Knowledge

- **AGENTS.md / .hermes.md** — Pipeline functions 사용 규칙 (`createEncryptedVault`, `persistVaultRecord`, `setupVaultSession`, `exportVaultFile` 등), React 19 + TS strict, Android 변경 후 `npx cap sync android`.
- **STRATEGY §1 (autofill)** — autofill은 Keystore 기반, React 토큰 sync 없음 — §2 작업이 autofill 경로를 깨지 않도록 격리.
- **기존 plan 패턴** — `.hermes/plans/*.md` (autofill reliability 등)와 동일한 형식 사용 예정.
- **테스트 규약** — Vitest (unit/integration) + JUnit/JVM (Android), 사용자가 E2E는 직접 실행.

## 7. Options (후속 plan 후보)

각 옵션은 독립적으로 plan 가능하며, 우선순위는 §8 Open Questions에서 결정.

### A. autosave 안정화 테스트 (Plan-6)
- 신규 파일이 아닌 **기존 `fileStorage.changePin.integration.test.ts` + `fileStorage.lifecycle.integration.test.ts`에 시나리오 추가** 형태로 접근
- 검증: add/update/delete/account race (직렬화 큐로 순차 보장), 연속 mutation 시 마지막 스냅샷 일관성, lock→unlock 후 스냅샷 보존
- 의존: 없음
- 리스크: 낮음
- 비고: §3.3 autosave 의미 변경 이후 "autosave 신뢰성"은 **Dexie 트랜잭션 경계 + 동시성** 쪽으로 무게가 이동함. 외부 export는 §3.3 + Plan-5에서 다룸. (실제 동시성 제어는 옵션 E 참조)

### A2. SAF 영구 URI 기반 자동 백업 (STRATEGY 원문 autosave 복원 옵션)
- `writeBackupToUri` / `readBackupFromUri`는 정의되어 있으나 호출처 없음. Settings에 "자동 백업 위치" 토글 추가 → 사용자가 SAF로 폴더 선택 → `takePersistableUriPermission`으로 영구 권한 획득 → `persistVaultSnapshot` 성공 시 동일 스냅샷을 해당 URI에 추가 저장
- native: `KiyoFilePlugin`에 `takePersistableUri(uri)` 추가 (선택)
- 의존: A 권장 (테스트 기반)
- 리스크: 중간 (영구 권한 라이프사이클, 사용자가 폴더를 지웠을 때 처리)
- 비고: STRATEGY의 "autosave" 의미를 가장 충실하게 살리는 옵션. 단, Android 11+ Scoped Storage 정책상 "사용자 위치 1회 선택 + 그 이후 자동" 모델이 적절.

### B. SAF 백업/복원 회귀 테스트 (Plan-2)
- **현황:** SAF 데이터 경로(`backupDataFile`/`openImportedDataFile`)는 이미 ~12개 통합 테스트로 round-trip/PIN/평문/암호화/파일명 정규화 등 검증됨 (`lifecycle`/`encryption`/`changePin`/`error`).
- **Plan-2 범위:** **`KiyoFile.saveFile` mock 기반 "사용자 picker 취소" 분기 회귀 테스트 1건 추가** — `cancelled: true` 반환 시 `exportBackupFile`이 "User cancelled backup" 던지는지 (`fileStorage.error.integration.test.ts`에 추가). 이게 기존 12개로 안 잡힌 **유일하게 의미 있는 SAF 경로** (Filesystem 실패는 이미 검증됨).
- **Plan-2 범위 밖:**
  - `writeBackupToUri` / `readBackupFromUri` 단위 테스트 → **Plan-5로 이관** (호출처 0에서 만드는 건 dead code 위험, Plan-5 진입 시 자연스럽게 검증됨)
  - Android JVM 단위 (`KiyoFilePlugin.kt`) → Android E2E 영역, 사용자가 직접 실행
- 의존: 없음
- 리스크: 낮음
- 비고: Plan-2는 **"진짜 빠진 단일 경로"**에 집중. 1개 시나리오 추가 + Plan-2 plan 문서 분량 최소.

### C. 텍스트 패스프레이즈 + zxcvbn
- 영향: `PinChangeDialog`, `Auth.tsx` (PIN 입력 화면), `createCryptoKey` (호환성 검토), `verifyPin`, Settings UX
- 신규 의존: `@zxcvbn-ts/core` (또는 `zxcvbn`) + i18n (한국어 wordlist)
- 마이그레이션: 기존 PIN 파일은 그대로 unlock되어야 함(숫자만 입력하면 통과). 패스프레이즈는 신규/변경 시점부터 적용.
- 가이드라인: 최소 강도(zxcvbn score ≥ 2 또는 3), 실시간 표시
- 리스크: **높음** (사용자 모델 변경, 마이그레이션, UX)

### D. changePin atomicity / fault-injection (Plan-1)
- 문제: 현재 `changePin`은 `getDatabaseSnapshot` → `replaceDatabaseData` 두 단계. 중간 실패 시 부분 상태 가능성.
- 접근: (1) 새 키/새 salt로 미리 encrypt → (2) `replaceDatabaseData`로 atomic하게 files 테이블까지 교체 → (3) 실패 시 롤백 가능한 shadow record 또는 두 단계 커밋
- **Plan-1 진입 시 code review로 평가** (Q5): 실제 재현 시나리오 정의 가능하면 Plan-1 scope에 포함, 아니면 보류
- 의존: 없음
- 리스크: 중간 (Dexie 트랜잭션 경계 설계 필요)

### E. autosave 동시성 / debounce (Plan-6)
- 문제: 짧은 시간에 여러 mutation이 발생하면 각자 `persistVaultSnapshot` 호출 → Dexie/encrypt 중복 비용 + race 가능성
- **결정: 직렬화 큐 (`src/database/syncQueue.ts`)** — debounce 불필요
- 접근: `enqueuePersistVaultSnapshot(getParamsFn)`로 연결, 에러 시 `resolve()`로 다음 작업 진행, 세션 최신값 getter로 읽기
- 의존: 없음
- 리스크: 낮음

### F. salt 무결성 + version migration (Plan-3 보류)
- §3.4 참조 — 현 시점 YAGNI. KDF 변경/필드 추가/iOS 확장 트리거 발생 시 후속 brainstorm

### G. STRATEGY 문서 정합화
- `autosave` 항목의 ✅/구현 표시로 갱신, "남은 일" 명시
- 의존: 없음
- 리스크: 없음 (문서만)

## 8. Recommended Direction

**단일 plan이 아닌, 우선순위 기반 다 plan 분할을 권장.** 이유:

1. §2 항목들은 의존성이 거의 없는 독립 작업들임(autosave, SAF, changePin, salt).
2. **C(패스프레이즈)**는 별도 사용자 결정 + 별도 호환성 검토가 필요한 큰 작업. 다른 항목과 묶으면 plan이 비대해지고 review가 어려워짐.
3. **changePin(Plan-1)과 autosave(Plan-6)는 영역이 다름** — changePin은 PIN 변경 시점의 단발성 atomicity, autosave는 모든 mutation의 빈번한 저장 경로. 함께 묶으면 plan scope가 흐려짐.
4. Plan-3(포맷 진화)는 현 시점 YAGNI로 보류(§3.4).

### 권장 plan 분할 (안)

**Plan-1~3 (동시/순차 진행) → Plan-5 → Plan-4 (맨 마지막)**

| 순서 | Plan | 포함 옵션 | 설명 | 크기 |
|---|---|---|---|---|
| 1 | **Plan-1: changePin atomicity** | D | **완료 — 분석만, 강화 불필요** | `replaceDatabaseData` 단일 Dexie 트랜잭션 확인 (`db.ts:213-232`). `files` vs `accounts`/`templates` 키 불일치 불가능. 기존 7개 invariant 테스트로 충분. 코드 변경 없음. | 소 |
| 1 | **Plan-2: SAF picker 취소 분기 회귀 테스트** | B | `KiyoFile.saveFile` mock으로 `cancelled: true` 반환 시 `exportBackupFile`이 "User cancelled backup" 던지는 시나리오 1건 (`fileStorage.error.integration.test.ts`에 추가). **기존 12개 시나리오 회귀 안 깨는 범위**, **Android E2E 영역은 Plan-2 범위 밖**, **`writeBackupToUri` 테스트는 Plan-5로 이관** | 소 |
| 1 | **Plan-6: autosave 안정화 & 동시성** | A + E | **(1)** 기존 `fileStorage.lifecycle.integration.test.ts`에 race/lock→unlock 시나리오 추가, (2) `src/database/syncQueue.ts` 직렬화 큐 구현 (`enqueuePersistVaultSnapshot(getParamsFn)`), `accountStore`/`templateStore` 연결 변경, 에러 시 `resolve()`로 다음 작업 진행, 세션 최신값 getter로 읽기, (3) 연속 mutation 시 마지막 스냅샷 일관성 검증 | 중 |
| 2 | **Plan-5: SAF 영구 URI 자동 백업** | A2 | Settings에 "자동 백업 위치" 토글 → `takePersistableUriPermission` → `persistVaultSnapshot` 성공 시 URI 추가 저장. **Plan-2 의존** | 중~대 |
| 3 | **Plan-4: 패스프레이즈 도입** | C | zxcvbn + 입력 모델 + 마이그레이션 가드. **가장 마지막, 별도 트랙** | **대** |
| (인라인) | G | STRATEGY.md §2 진행 상태 갱신 | trivial |

## 9. Open Questions (사용자 결정 필요)

| # | 질문 | 선택지 | 결정 | 메모 |
|---|---|---|---|---|
| Q1 | Plan-5 (SAF 영구 URI 자동 백업) 포함? | (a) 포함 / (b) 미포함 / (c) 미정 | **✅ (a) 포함** | Plan-1~5 풀세트 |
| Q2 | 패스프레이즈 (Plan-4) 우선순위 | (a) Plan-1/2 동시 / (b) Plan-3 이후 / (c) 후속 별도 트랙 | **✅ (c) 후속** | Plan-4는 가장 마지막. Plan-6 완료 후 별도 트랙으로 진행 |
| Q3 | autosave 동시성 (옵션 E) 처리 위치 | (a) Plan-1 포함 / (b) Plan-1 이후 별도 / (c) 보류 | **✅ Plan-6 — 직렬화 큐** | `src/database/syncQueue.ts` 신규, `accountStore`/`templateStore` 연결 변경, 에러 시 `resolve()`로 다음 작업 진행, 세션 최신값 getter로 읽기. debounce 불필요. |
| Q4 | SAF 테스트 깊이 (옵션 B) | (a) React 통합만 / (b) + Android JVM (`KiyoFilePlugin`) / (c) + E2E | **✅ (a) React 통합만** (사용자 결정) | Android E2E는 사용자가 직접 실행. JVM 단위는 §3.3 영역 밖. Plan-2는 React 단에 집중 |
| Q5 | changePin atomicity (옵션 D) — 실제 버그 재현 사례? | (a) 있음 / (b) 없음, 예방적 / (c) 보류 | **✅ (b) 없음, 예방적 — 분석으로 안전함 확인** | `replaceDatabaseData` 단일 트랜잭션 확인 (`db.ts:213-232`). Plan-1 완료. |
| Q6 | 크로스플랫폼 포맷 (옵션 F) 시점 | (a) 지금 v1 골격 / (b) iOS/Web 데스크톱 결정 후 / (c) 보류 | **✅ (c) 보류** | §3.4 — YAGNI. v2 트리거(KDF 변경, 필드 추가, iOS 확장) 발생 시 후속 brainstorm |
| Q7 | Plan-2 (SAF picker 취소 분기 회귀 테스트) — 비용 대비 효과? | (a) 그대로 구현 / (b) 보류 | **✅ (b) 보류** | §11 참조 — mock 검증 대상이 5줄 삼항 분기의 메시지 문자열에 한정, 회귀 가치가 낮음. 트리거 기반 재방문. |

**현재 상태:** Q1~Q7 **모두 결정 완료**. **Plan-1/Plan-6 완료, Plan-2는 보류(Q7)**, **Plan-3도 보류** (Q6, §3.4).

**진행 순서 (사용자 결정 기반):**
```
Plan-1 (changePin atomicity)        ──┐
Plan-6 (autosave 안정화 & 동시성)    ──┘  ← 1차 둘 다 완료
            ↓
Plan-5 (SAF 영구 URI 자동 백업) — 2차 (독자 진행 가능)
            ↓
Plan-4 (패스프레이즈) — 가장 마지막, 별도 트랙

(보류) Plan-2: §11 참조 — 트리거 기반
(보류) Plan-3: §3.4 참조
```

## 10. Output

- Problem understood ✅
- Recommended direction: §2를 **Plan-1/Plan-6 완료, Plan-5 (2차) → Plan-4 (3차, 맨 마지막)** + 인라인 STRATEGY 갱신으로 분할. **Plan-2/Plan-3는 보류** (Q7 §11, Q6 §3.4)
- 결정 완료: Q1=(a) Plan-5 포함, Q2=(c) Plan-4는 가장 마지막, Q3=(Plan-6 — 직렬화 큐), Q4=(a) React 통합만, Q5=(b) 없음/안전함, Q6=(c) Plan-3 보류, **Q7=(b) Plan-2 보류**
- 결정 보류: 없음 (모든 Q 해결)
- Plan 상태: **Plan-1/Plan-6 완료, Plan-5 미착수, Plan-4 미착수** | **Plan-2/Plan-3 보류**
- 다음 액션: `ce-plan`으로 **Plan-5 (SAF 영구 URI 자동 백업)** 진입 가능. Plan-2는 트리거 발생 시 재방문 (§11).

---

## 11. Plan-2 Post-hoc Review (보류 결정 근거)

**작성일:** 2026-08-29 (Plan-2 docs-only 커밋 `9278a596` 직후, 사용자 판단 기반)

### 11.1 검토 대상
`.hermes/plans/2026-08-29-saf-picker-cancellation-test.md` — `exportBackupFile` → `KiyoFile.saveFile`이 `cancelled: true`를 반환할 때 `"User cancelled backup"` 메시지로 `FileStorageError(WRITE_FAILED)`를 던지는지 검증하는 mock 기반 통합 테스트 1~2건.

### 11.2 비용 대비 효과 재평가

**검증 대상 코드 (`fileExport.ts:45-51`):**
```ts
if (!result.success) {
  throw FileStorageError.create(
    FileStorageErrorCode.WRITE_FAILED,
    result.cancelled ? "User cancelled backup" : "Failed to save backup file",
    { operation: "exportBackupFile", fileName: normalizedFileName },
  );
}
```

분기 자체가 **5줄 삼항 연산자**이며, 검증 가치는 다음과 같이 한정됨:

| 회귀 시나리오 | Plan-2 mock 테스트가 잡는가? |
|---|---|
| 메시지 문자열 오타/변경 | ✅ (직접 검증) |
| `WRITE_FAILED` 코드 누락 | ✅ |
| **`KiyoFile.saveFile`이 `cancelled: true`를 안 보내는 native 회귀** | ❌ (native는 mock 우회) |
| **SAF `ACTION_CREATE_DOCUMENT` 결과 매핑 오류 (Android Kotlin)** | ❌ (JVM 영역) |
| 픽커 UX에서 시스템 back / 명시적 취소의 cancelled 분기 정확성 | ❌ (E2E 영역) |
| SAF URI 권한 만료/거부, storage full, 다른 분기 추가 | ❌ (분기 자체만 검증) |
| `exportBackupFile`이 `cancelled` 외 새 분기를 추가 | ✅ (메시지 회귀는 잡지만 신규 분기 자체는 검증 대상이 아님) |

즉 **테스트는 React 함수 한 곳의 메시지 문자열 회귀만** 막고, SAF 경로의 본질적 리스크(native `cancelled` 매핑, E2E 흐름)는 커버하지 못함.

### 11.3 기존 SAF 커버리지
`fileStorage.lifecycle.integration.test.ts` (13건) + `fileStorage.error.integration.test.ts` (9건) + `fileStorage.encryption.integration.test.ts` (5건) + `fileStorage.changePin.integration.test.ts` (7건)이 이미 다음을 검증:
- SAF round-trip 정상/실패/PIN 불일치/평문·암호화/파일명 정규화
- `openImportedDataFile` JSON 파싱/salt 검증
- `exportDataFile` (Capacitor Filesystem) 실패
- `changePin` invariant

남은 SAF 고유 분기는 **`cancelled` 메시지 한 줄**뿐. "0건 → 1건"의 가치보다 "1건으로 무엇을 보장하나?"가 더 중요한데, 위 표 기준 보장 범위가 좁음.

### 11.4 비용
- mock 1~2건 + `Capacitor.isNativePlatform` spy + import 추가 + describe 블록 (~30~40줄)
- 테스트 코드 리뷰 + `npm run test` 회귀 확인
- 브레인스토밍/플랜 문서 갱신 (이미 비용 소진)

### 11.5 결정
**보류.** Plan-2 plan 문서(`9278a596`)는 작성되어 있으나 **구현하지 않음**. 코드는 변경 0.

### 11.6 재방문 트리거
다음 중 **하나라도** 발생 시 Plan-2 또는 동등한 JVM/E2E 테스트로 재방문:

1. `exportBackupFile`이 `cancelled` 외 새 분기(권한 에러, URI 만료, storage full 등)를 추가
2. `KiyoFile.saveFile` 인터페이스 또는 반환 필드 변경
3. `android/.../KiyoFilePlugin.kt`의 `ACTION_CREATE_DOCUMENT` → `cancelled` 매핑 로직 변경
4. SAF UX 변경(Web fallback → native 강제, multi-document 등)
5. SAF 신뢰성에 대한 새로운 사용자/이슈 보고

이 시점에는 **mock 단독이 아니라 native JVM 단위 또는 React+JVM+ESPRESSO 조합**으로 재설계 (브레인스토밍 §7-B "Plan-2는 진짜 빠진 단일 경로" 전제 자체가 무너질 수 있음).

### 11.7 관련 커밋
- `9278a596` docs(vault): plan SAF picker cancellation regression test (Plan-2) — plan 문서만, 구현 없음
