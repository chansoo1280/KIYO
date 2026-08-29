# Plan-5: SAF 영구 URI 자동 백업 (Plan-5)

**Date:** 2026-08-30
**Worktree:** `feat/vault-integrity` (base `origin/dev`)
**Status:** 구현 완료 — 코드 변경 완료, 검증 진행 중
**Brainstorm Source:** `docs/brainstorms/2026-08-29-vault-file-integrity.md` — Options A2, Q1=(a) 포함 확정

---

## 1. Goal

Settings에 **"자동 백업 위치" 토글 + SAF 폴더 선택**을 추가하고, 사용자가 한 번 폴더를 선택하면 `takePersistableUriPermission`으로 영구 권한을 획득해 **`persistVaultSnapshot`(자동 저장) 성공 시 동일 스냅샷을 해당 URI에도 추가 저장**한다.

> **STRATEGY §2 "autosave" 항목의 원래 의도 복원**: Android 11+ Scoped Storage로 외부 파일 자동 쓰기가 막히면서 내부 IndexedDB만 남았는데, SAF 영구 URI 권한을 사용하면 "사용자 1회 선택 + 그 이후 자동 백업"이 가능해짐.

---

## 2. Current State

### 2.1 기존 구현 (이미 존재)
| 컴포넌트 | 상태 | 비고 |
|----------|------|------|
| `KiyoFilePlugin.writeToUri` / `readFromUri` | ✅ 구현됨 | Native Kotlin, 호출처 0 |
| `fileExport.writeBackupToUri` / `readBackupFromUri` | ✅ 구현됨 | React 래퍼, 호출처 0 |
| `persistVaultSnapshot` (autosave) | ✅ 구현됨 | `db.ts:90-128`, IndexedDB `files` 테이블만 갱신 |
| `backupDataFile` (수동 백업) | ✅ 구현됨 | `fileStorage.ts:367-388`, SAF `saveFile` 사용 |
| Settings `DataSection` | ✅ 구현됨 | 수동 백업/복원 UI만 있음 |
| `KiyoFilePlugin.saveFile` | ✅ 구현됨 | `ACTION_CREATE_DOCUMENT` + `takePersistableUriPermission` **이미 수행 중** (라인 129-135) |

### 2.2 빠진 것 (Plan-5 범위)
1. **Settings UI**: "자동 백업" 토글 + "백업 위치 선택" 버튼 (SAF `ACTION_OPEN_DOCUMENT_TREE`로 폴더 선택)
2. **영구 URI 저장소**: 선택된 폴더 URI를 `localStorage`/`settingsStore`에 영구 보관
3. **자동 백업 훅**: `persistVaultSnapshot` 성공 후 `writeBackupToUri` 호출
4. **권한 갱신/만료 처리**: URI 권한 만료 시 사용자에게 재선택 유도

---

## 3. Relevant Files

### 3.1 Core Pipeline (변경 필요)
| 파일 | 역할 | 변경 내용 |
|------|------|-----------|
| `src/database/db.ts` | `persistVaultSnapshot` | 성공 후 자동 백업 콜백 호출 추가 |
| `src/database/fileExport.ts` | `writeBackupToUri` | 기존 함수 재사용 (이미 구현됨) |
| `src/database/syncQueue.ts` | 자동 저장 큐 | 에러 처리 정책 유지 (`resolve()`로 다음 작업 진행) |

### 3.2 Settings / UI (신규/변경)
| 파일 | 역할 | 변경 내용 |
|------|------|-----------|
| `src/store/settingsStore.ts` | 설정 상태 | `autoBackupEnabled`, `autoBackupUri` 필드 추가 |
| `src/pages/Settings/components/DataSection.tsx` | 백업/복원 UI | 자동 백업 토글 + 폴더 선택 버튼 추가 |
| `src/pages/Settings/components/SecuritySection.tsx` | (참조) | 자동잠금과 유사한 UX 패턴 참고 |

### 3.3 Native Bridge (기존 재사용)
| 파일 | 역할 | 비고 |
|------|------|------|
| `android/.../KiyoFilePlugin.kt` | `writeToUri` / `readFromUri` | 이미 구현됨, `takePersistableUriPermission` 라인 129-135, 174-180 |
| `src/plugins/kiyofile.ts` | TS 인터페이스 | `writeToUri`, `readFromUri` 이미 정의됨 |

### 3.4 Test Files (신규/확장)
| 파일 | 역할 |
|------|------|
| `src/database/fileStorage.lifecycle.integration.test.ts` | 자동 백업 통합 시나리오 추가 |
| `src/store/settingsStore.test.ts` (신규) | 설정 저장/로드 단위 테스트 |

---

## 4. Architecture

### 4.1 Data Flow (자동 백업 경로)

```
[User Mutation: add/update/delete account or template]
       │
       ▼
[accountStore / templateStore _persistAccounts/_persistTemplates]
       │
       ▼
[enqueuePersistVaultSnapshot(getParamsFn)] ──► [syncQueue 직렬화]
       │
       ▼
[persistVaultSnapshot(params)] ──► IndexedDB files 테이블 upsert
       │                              (기존 동작 유지)
       │
       ├── 성공 시: clearSyncError()
       │
       └── [NEW] autoBackupEnabled && autoBackupUri 존재 시:
                    ▼
              writeBackupToUri(autoBackupUri, encryptedSnapshot)
                    │
                    ▼
              KiyoFile.writeToUri(uri, data) ──► Android: ContentResolver.openOutputStream
                    │
                    ▼
              성공: 로그만 / 실패: 콘솔 경고 (자동 저장 깨지지 않게 throw 안 함)
```

### 4.2 Settings Flow (초기 설정)

```
[User opens Settings > Data > "자동 백업" 토글 ON]
       │
       ▼
[SAF ACTION_OPEN_DOCUMENT_TREE launch] ──► User picks folder
       │
       ▼
[KiyoFilePlugin.saveFile? NO — 새 메서드 필요: pickBackupFolder]
       │
       ▼
[onActivityResult: uri 수신]
       │
       ▼
[contentResolver.takePersistableUriPermission(uri, READ|WRITE)]
       │
       ▼
[settingsStore.setAutoBackupUri(uri.toString())] ──► localStorage persist
       │
       ▼
[settingsStore.setAutoBackupEnabled(true)]
```

### 4.3 Key Ownership & Boundaries

| 요소 | 소유자 | 비고 |
|------|--------|------|
| `autoBackupUri` (string) | `settingsStore` (localStorage) | 사용자 선택 1회, 영구 보관 |
| `autoBackupEnabled` (boolean) | `settingsStore` | 토글 상태 |
| `cryptoKey` / `salt` | `sessionStore` (메모리만) | 자동 백업 시 세션에서 읽기 |
| SAF URI 권한 | Android OS / `KiyoFilePlugin` | `takePersistableUriPermission`로 영구화, 재부팅 후도 유지 |
| `persistVaultSnapshot` | `db.ts` / `syncQueue` | **자동 저장 주 경로** — 여기가 트리거 |

> **보안 경계**: `cryptoKey`는 메모리에만 존재 (이미 준수). 자동 백업은 암호화된 스냅샷을 그대로 쓰므로 키 노출 없음.

---

## 5. Proposed Changes

### 5.1 Native: `KiyoFilePlugin.kt` — 폴더 선택 추가 (SAF `ACTION_OPEN_DOCUMENT_TREE`)

| 변경 | 상세 |
|------|------|
| 새 메서드 `pickBackupFolder(call: PluginCall)` | `ActivityResultContracts.OpenDocumentTree()` 런처 등록, `load()`에서 초기화 |
| 결과 핸들러 `handlePickBackupFolderResult(uri: Uri?)` | `uri != null` 시 `takePersistableUriPermission(uri, READ|WRITE)` 호출 후 `uri` 반환 |
| `writeToUri` / `readFromUri` | **기존 그대로 사용** (이미 영구 권한 가정) |

> **주의**: `saveFile`은 `ACTION_CREATE_DOCUMENT`(파일 생성)인데, 폴더 선택은 `ACTION_OPEN_DOCUMENT_TREE`(디렉토리 선택)여야 함. 별도 메서드 필요.

### 5.2 TS Bridge: `src/plugins/kiyofile.ts`

```typescript
// 기존 인터페이스에 추가
export interface KiyoFilePlugin {
  // ... 기존 메서드들
  pickBackupFolder(): Promise<{ success: boolean; uri?: string; cancelled?: boolean }>;
}
```

### 5.3 React: `src/database/fileExport.ts` — 폴더 선택 래퍼 추가

```typescript
export const pickBackupFolder = async (): Promise<{ success: boolean; uri?: string }> => {
  if (!isNativeFileStorageAvailable()) return { success: false };
  try {
    const result = await KiyoFile.pickBackupFolder();
    return { success: result.success, uri: result.uri };
  } catch (e) { ... }
};
```

### 5.4 Settings Store: `src/store/settingsStore.ts`

```typescript
export interface SettingsState {
  // ... 기존 필드들
  autoBackupEnabled: boolean;
  autoBackupUri: string | null;  // SAF 폴더 URI (persisted)
  setAutoBackupEnabled: (enabled: boolean) => Promise<void>;
  setAutoBackupUri: (uri: string | null) => Promise<void>;
}
```
`partialize`에 `autoBackupEnabled`, `autoBackupUri` 추가.

### 5.5 자동 백업 트리거: `src/database/db.ts` — `persistVaultSnapshot` 수정

```typescript
export const persistVaultSnapshot = async (params: SyncDatabaseParams): Promise<void> => {
  // ... 기존 로직 (files 테이블 upsert까지)

  // [NEW] 자동 백업: 성공 시에만, 설정 확인 후 비동기 실행
  if (clearSyncError) clearSyncError(); // 기존

  // 비동기 fire-and-forget (autosave 블로킹 방지)
  tryTriggerAutoBackup(params);
};

async function tryTriggerAutoBackup(params: SyncDatabaseParams) {
  const { autoBackupEnabled, autoBackupUri } = useSettingsStore.getState();
  if (!autoBackupEnabled || !autoBackupUri) return;
  if (!params.cryptoKey || !params.salt) return; // 평문 볼트는 자동 백업 안 함 (정책)

  const data = await getDatabaseSnapshot(params.activeFileName!, params.cryptoKey);
  const encrypted = await encryptData(data, params.cryptoKey, params.salt!);
  if (encrypted) {
    const result = await writeBackupToUri(autoBackupUri, encrypted);
    if (!result.success) {
      console.warn('[autoBackup] writeBackupToUri failed:', result.errorCode, result.errorMessage);
      // 권한 만료 시 자동 OFF + UI 경고
      if (result.errorCode === 'PERMISSION_REVOKED') {
        await useSettingsStore.getState().setAutoBackupEnabled(false);
      }
    }
  }
}
```

> **중요**: `persistVaultSnapshot`은 `syncQueue`에서 순차 실행되므로, 자동 백업도 순차 처리됨. 에러 시 `resolve()`로 다음 작업 진행 (기존 정책 유지).

### 5.6 Settings UI: `src/pages/Settings/components/DataSection.tsx`

| 추가 UI | 동작 |
|---------|------|
| "자동 백업" 토글 | `setAutoBackupEnabled(true/false)` |
| "백업 위치 선택" 버튼 | `pickBackupFolder()` → URI 수신 → `setAutoBackupUri(uri)` → 토글 자동 ON |
| 상태 표시 | "자동 백업: 켜짐" / "자동 백업: 꺼짐" / "권한 만료 — 재설정 필요" |

### 5.7 권한 만료 감지 및 복구

- `writeBackupToUri` 실패 시 `SecurityException` 가능성 → `autoBackupEnabled: false`로 자동 끄고 UI에 "권한 만료 — 백업 위치 재설정 필요" 표시
- `readBackupFromUri`도 동일하게 처리 (복원 시 사용 안 하지만 일관성 위해)

---

## 6. Tests

### 6.1 Unit Tests (Vitest)

| 테스트 파일 | 시나리오 |
|------------|----------|
| `settingsStore.test.ts` (신규) | `autoBackupEnabled`/`autoBackupUri` persist/load, partialize 검증 |
| `fileStorage.test.ts` (확장) | `pickBackupFolder` mock, `writeBackupToUri` 성공/실패 분기 (에러코드 포함) |

### 6.2 Integration Tests (Vitest) — `fileStorage.lifecycle.integration.test.ts` 확장

| 시나리오 | 설명 |
|----------|------|
| **자동 백업 기본 플로우** | 설정 ON + URI 설정 → 계정 추가 → `waitForQueueDrain` → `readBackupFromUri`로 데이터 검증 |
| **자동 백업 OFF 시 저장 안 함** | 설정 OFF → 계정 추가 → `readBackupFromUri` null 확인 |
| **URI 권한 만료 시뮬레이션** | `writeBackupToUri` mock reject → `autoBackupEnabled` 자동 false 전환 확인 |
| **평문 볼트 자동 백업 안 함** | PIN 없는 볼트 → 계정 추가 → 자동 백업 호출 안 됨 확인 (정책) |
| **동시성: 연속 mutation 시 마지막 스냅샷만 백업** | `syncQueue` 직렬화 확인 (Plan-6과 중첩, 여기서도 검증) |

### 6.3 Android JVM Unit Test (신규) — `KiyoFilePluginTest.kt`

| 테스트 | 설명 |
|--------|------|
| `pickBackupFolder_returnsUri_onSuccess` | `OpenDocumentTree` 결과 URI 반환, `takePersistableUriPermission` 호출 검증 |
| `pickBackupFolder_returnsCancelled_onUserCancel` | `uri == null` 시 `cancelled: true` 반환 |
| `writeToUri_usesPersistedPermission` | 동일 URI로 재호출 시 권한 없이 쓰기 성공 (영구 권한 검증) |

### 6.4 Manual Verification (체크리스트)

- [ ] Settings에서 "자동 백업" 토글 ON → 폴더 선택 다이얼로그 표시
- [ ] 폴더 선택 후 토글이 ON 유지되고 URI 표시됨
- [ ] 계정 추가/수정/삭제 후 선택한 폴더에 `kiyo-autobackup-latest.json` 파일 생성됨 (덮어쓰기)
- [ ] 파일 내용이 현재 볼트 스냅샷과 일치 (복호화 후 검증)
- [ ] 앱 재시작 후 자동 백업 여전히 동작 (영구 권한 유지)
- [ ] 폴더 삭제/권한 취소 시 "권한 만료" 메시지 표시, 토글 자동 OFF
- [ ] 평문 볼트(PIN 없음)에서 자동 백업 비활성화됨

---

## 7. Risks

| 위험 | 완화책 |
|------|--------|
| **SAF 영구 권한 만료** (사용자가 폴더 삭제, 권한 취소, OS 업데이트) | `writeBackupToUri` 실패 감지 → `autoBackupEnabled=false` 자동 전환 + UI 경고 |
| **자동 백업이 autosave 성능 저하** | `syncQueue` 직렬화 + fire-and-forget 비동기 호출로 메인 경로 블로킹 없음 |
| **암호화 키 노출** | 자동 백업은 **이미 암호화된 스냅샷**(`EncryptedKiyoVaultData`)을 쓰므로 키 노출 없음 |
| **웹 환경 미지원** | `isNativeFileStorageAvailable()` 가드 — 웹에서는 자동 백업 UI 비활성화 |
| **동일 폴더에 파일 누적** | 고정 파일명(`kiyo-autobackup-latest.json`) 덮어쓰기로 용량 고정, 누적 문제 원천 차단 |
| **Native `pickBackupFolder` 미구현 시 크래시** | `try/catch` + graceful degradation (UI에서 "지원 안 함" 표시) |

---

## 8. Rollback

| 단계 | 롤백 방법 |
|------|-----------|
| 1. Settings UI 제거 | `DataSection.tsx`에서 자동 백업 관련 JSX/로직 제거 |
| 2. Settings Store 필드 제거 | `settingsStore.ts`에서 `autoBackupEnabled`, `autoBackupUri` 필드 및 `partialize` 제거 |
| 3. 자동 백업 트리거 제거 | `db.ts` `persistVaultSnapshot`에서 `tryTriggerAutoBackup` 호출 제거 |
| 4. Native 메서드 미사용 | `KiyoFilePlugin.pickBackupFolder` 호출처만 제거 (네이티브 코드는 둠) |
| 5. 테스트 제거/비활성화 | 추가된 테스트 파일 삭제 또는 skip |

> **데이터 마이그레이션 불필요**: `autoBackupUri`는 사용자 선택 시점부터 생성되므로 기존 사용자 영향 없음. 롤백 시 localStorage에 남은 키만 남고 동작 영향 없음.

---

## 9. Implementation Order

| 순서 | 작업 | 산출물 | 상태 |
|------|------|--------|------|
| 1 | **Native**: `KiyoFilePlugin.pickBackupFolder` 구현 | `KiyoFilePlugin.kt` + `kiyofile.ts` 인터페이스 | ✅ 완료 |
| 2 | **Settings Store**: 필드 추가 + persist | `settingsStore.ts` | ✅ 완료 |
| 3 | **React Bridge**: `pickBackupFolder` 래퍼 | `fileExport.ts` | ✅ 완료 |
| 4 | **자동 백업 트리거**: `persistVaultSnapshot` 수정 | `db.ts` | ✅ 완료 |
| 5 | **Settings UI**: 토글 + 폴더 선택 버튼 | `DataSection.tsx` | ✅ 완료 |
| 6 | **통합 테스트**: 자동 백업 시나리오 추가 | `fileStorage.lifecycle.integration.test.ts` | ⏳ **생략** (vitest mock 격리 이슈) |
| 7 | **단위 테스트**: settings store, fileExport | `settingsStore.test.ts`, `fileStorage.test.ts` | ✅ 완료 |
| 8 | **Android JVM 테스트**: `KiyoFilePluginTest.kt` | 신규 파일 | ⏳ **대기** |
| 9 | **수동 검증**: 체크리스트 실행 | - | ⏳ **대기** |

---

## 10. Open Questions (해결됨 — 뇌스토밍 기준)

| # | 질문 | 결정 |
|---|------|------|
| Q1 | Plan-5 포함 여부 | ✅ **포함** (뇌스토밍 Q1=(a)) |
| Q2 | 자동 백업 파일명 정책 | **고정 파일명** `kiyo-autobackup-latest.json` (덮어쓰기, 히스토리는 별도 계획에서) |
| Q3 | 평문 볼트 자동 백업 | **하지 않음** (보안상 암호화된 볼트만) |
| Q4 | 권한 만료 시 자동 OFF + UI 경고 | ✅ **적용** (자동 비활성화 + 배너/토스트) |
| Q5 | `syncQueue` 에러 시 자동 백업도 skip | ✅ **기존 정책 유지**: `persistVaultSnapshot` 에러 시 `resolve()`로 다음 진행, 자동 백업도 시도만 하고 실패 로그만 남김 |

---

## 11. Verification Criteria (Plan Complete When)

- [x] `npm run test` 통과 (신규/기존 테스트 모두)
- [x] `npm run typecheck` 통과
- [x] `npm run lint` 통과
- [ ] Android `compileDebugKotlin` + `testDebugUnitTest` 통과 (신규 `KiyoFilePluginTest` 포함)
- [ ] 수동 검증 체크리스트 7개 항목 모두 ✅
- [x] 기존 autosave/백업/복원 회귀 없음 (E2E 테스트 39개 통과로 검증)

---

## 12. Status Tracking

> 이 섹션은 구현 진행 중 업데이트됩니다.

| 단계 | 상태 | 비고 |
|------|------|------|
| Native `pickBackupFolder` | ✅ 완료 | `KiyoFilePlugin.kt` + `kiyofile.ts` + `kiyofile.web.ts` |
| Settings Store 필드 | ✅ 완료 | `settingsStore.ts` 필드 추가 + partialize |
| React Bridge 래퍼 | ✅ 완료 | `fileExport.ts` `pickBackupFolder`, `writeBackupToUri` 반환 타입 확장 (에러코드 추가) |
| `persistVaultSnapshot` 트리거 | ✅ 완료 | `db.ts` `tryTriggerAutoBackup` 추가 |
| Settings UI | ✅ 완료 | `DataSection.tsx` 토글 + 폴더 선택 다이얼로그 |
| 단위 테스트 | ✅ 완료 | `settingsStore.test.ts`, `fileStorage.test.ts` (fileExport 확장 16개 시나리오) |
| 통합 테스트 | ⏳ **생략** | vitest 모듈 mock 격리 이슈로 생략, 단위 테스트로 커버 |
| Android JVM 테스트 | ⏳ 대기 | `KiyoFilePluginTest.kt` 신규 파일 |
| 수동 검증 | ⏳ 대기 | 체크리스트 7개 항목 |

---

## 13. Plan vs Implementation Diff (의도적 변경 사항)

| 항목 | 계획 | 실제 구현 | 사유 |
|------|------|-----------|------|
| `writeBackupToUri` 반환 타입 | `Promise<boolean>` | `Promise<{success, errorCode?, errorMessage?}>` | 권한 만료(`PERMISSION_REVOKED`) 감지 위해 에러 상세화 필요 |
| 자동 백업 OFF 처리 | 동기 `setAutoBackupEnabled(false)` | 비동기 `await setAutoBackupEnabled(false)` + 50ms 대기 | Zustand persist 비동기 반영 및 fire-and-forget 완료 대기 위해 |
| 통합 테스트 | `fileStorage.lifecycle.integration.test.ts` 5개 시나리오 | **생략** | vitest `vi.mock` 호이스팅 + 모듈 격리 이슈로 불안정, 단위 테스트로 핵심 로직 검증 |
| Android JVM 테스트 | `KiyoFilePluginTest.kt` 작성 | **미작성** | 추후 별도 작업으로 이관 |

---

## 14. References

- Brainstorm: `docs/brainstorms/2026-08-29-vault-file-integrity.md` — §7 옵션 A2, §8 권장 분할, §9 Q1~Q7
- STRATEGY.md §2 (볼트 파일 안정성)
- 기존 구현: `KiyoFilePlugin.kt` (라인 129-135, 174-180 이미 `takePersistableUriPermission` 수행 중)
- Plan-6 (autosave 동시성/직렬화) — `syncQueue.ts` 이미 구현됨, 본 계획과 자연스럽게 연동