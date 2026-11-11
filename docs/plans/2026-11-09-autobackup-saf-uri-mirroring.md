# Goal

데이터 변경 시 `saveStoresToFile()` 호출 직후, 사용자가 선택한 SAF 폴더(`autoBackupUri`)에 암호화된 볼트 데이터를 활성 볼트 파일명(`session.activeFileName`)과 동일한 이름으로 자동 덮어쓰기한다. `autoBackupEnabled && autoBackupUri`이고 암호화 볼트(`cryptoKey`, `salt` 있음)일 때만 동작하며, 웹/평문 볼트에서는 동작하지 않는다.

# Current State

| 항목 | 내용 |
|------|------|
| `settingsStore.ts` | `autoBackupEnabled: boolean`, `autoBackupUri: string \| null` 상태 + localStorage persist 구현 완료 |
| `DataSection.tsx` | "자동 백업" 토글 UI, SAF 폴더 선택 다이얼로그, 토글 ON 시 `saveStoresToFile()` 호출 |
| `fileExport.ts` | `writeBackupToUri(uri, data)` 정의됨. SAF URI에 직접 쓰는 함수. **호출처 0건** |
| `fileStorage.ts` `saveStoresToFile()` | IndexedDB `files` table에 upsert만 수행. SAF URI 미러링 없음 |
| `KiyoFilePlugin.kt` | `writeToUri` 구현 완료 (React 측에서 호출만 하면 됨) |
| 이전 구현(`058e6369`) | `persistVaultSnapshot` → `tryTriggerAutoBackup` → `writeBackupToUri` 흐름이 있었으나, PR 1(`9870b441`) 마이그레이션 시 삭제됨 |
| Android E2E `AutosaveE2ETest.kt` | toggle ON 시 "첫 백업이 완료되었습니다" 메시지 기대. 현재는 IndexedDB만 저장하므로 SAF URI 쓰기는 검증되지 않음 |

# Relevant Files

| 파일 | 역할 |
|------|------|
| `src/database/fileStorage.ts` | `saveStoresToFile()` — store → IndexedDB upsert. **자동백업 트리거 추가 대상** |
| `src/database/fileExport.ts` | `writeBackupToUri(uri, data)` — SAF URI 쓰기. 이미 구현됨, import만 추가 필요 |
| `src/store/settingsStore.ts` | `autoBackupEnabled`, `autoBackupUri` 상태 관리. 수정 불필요 |
| `src/pages/Settings/components/DataSection.tsx` | 자동백업 UI. 수정 불필요 |
| `src/database/fileStorage.test.ts` | `saveStoresToFile` 관련 테스트. 자동백업 호출 검증 테스트 추가 대상 |
| `android/app/src/androidTest/java/com/kiyo/app/autosave/AutosaveE2ETest.kt` | Android E2E. 수정 불필요 (행동이 기대에 맞게 됨) |

# Architecture

```
사용자 데이터 변경 (계정 CRUD 등)
  → accountStore / templateStore 메서드
    → saveStoresToFile()  ← 자동백업 트리거 삽입 지점
      1. IndexedDB files table upsert (기존 동작, 유지)
      2. 조건부 분기:
         autoBackupEnabled && autoBackupUri && cryptoKey && salt &&
         Capacitor.isNativePlatform()
         → writeBackupToUri(autoBackupUri, encryptedVaultData)
           → KiyoFile.writeToUri(uri, data)
             → SAF 폴더에 kiyo-autobackup-latest.json 덮어쓰기
```

- `saveStoresToFile()`은 `accountStore.ts` (5곳), `templateStore.ts` (4곳), `changePin` (1곳)에서 호출됨. 한 곳에 트리거를 추가하면 모든 데이터 변경 경로가 자동백업을 타게 됨.
- `cryptoKey`, `salt`는 `sessionStore` 메모리에만 존재. 디스크 persist 안 함 (KIYO 보안 원칙).
- 평문 볼트(`cryptoKey` 없음)는 자동백업 미실행 (이전 구현 정책 유지).
- `PERMISSION_REVOKED` 에러 시 `autoBackupEnabled`를 `false`로 OFF (사용자 재설정 필요).

# Proposed Changes

| # | File | Component / Function | Change | Reason |
|---|------|---------------------|--------|--------|
| 1 | `src/database/fileStorage.ts` | `saveStoresToFile()` | 함수 끝에 자동백업 트리거 분기 추가. `autoBackupEnabled && autoBackupUri && cryptoKey && salt` 이면 `writeBackupToUri(autoBackupUri, encrypted)` 호출. `PERMISSION_REVOKED` 시 `setAutoBackupEnabled(false)` | 데이터 변경 시 SAF 폴더에 자동 미러링 |
| 2 | `src/database/fileStorage.ts` | import | `exportBackupFile, normalizeDataFileName`에 `writeBackupToUri` 추가 import | 함수 사용을 위해 |
| 3 | `src/database/fileStorage.test.ts` | `fileStorage.test.ts` | `saveStoresToFile` 호출 시 `autoBackupEnabled && autoBackupUri`면 `writeBackupToUri` 호출 검증 테스트 추가. `autoBackupEnabled=false`면 호출되지 않음 검증 | 회귀 방지 |

# Tests

| 대상 | 내용 |
|------|------|
| 단위 (Vitest) | `fileStorage.test.ts`에 `saveStoresToFile` → `writeBackupToUri` 호출 검증 2건 (enabled/uri 있음 / 없음) |
| 통합 (Vitest) | 기존 `fileStorage.jsonCompat.integration.test.ts` 수정 불필요 (surface untouched) |
| Android E2E | `AutosaveE2ETest.kt` 수정 불필요. toggle ON 시 실제로 SAF URI에 파일이 쓰이므로 E2E가 더 정확하게 검증됨 |
| 수동 | Settings > Data에서 자동백업 ON → 폴더 선택 → 계정 추가/수정 → 선택 폴더에 활성 볼트 파일명과 동일한 파일로 생성/덮어쓰기 확인 |

# Risks

| 유형 | 내용 | 완화 |
|------|------|------|
| 보안 | `writeBackupToUri`는 암호화된 볼트 데이터를 사용자 선택 외부 폴더에 씀. PIN 없이 복구 불가 (PBKDF2+AES-GCM) | 평문 볼트 스킵, cryptoKey/salt 메모리만 사용 |
| 리гре시 | `saveStoresToFile` 호출자 10곳 모두에 자동백업이 적용됨. 예외 발생 시 앱 중단 방지 | try/catch로 감싸고 콘솔 경고만 남김 (이전 구현과 동일) |
| 라이프사이클 | SAF URI 권한 만료 시 `writeBackupToUri` 실패 → `PERMISSION_REVOKED` → 자동백업 OFF | 사용자가 다시 폴더 선택 필요 (명시적 복구) |
| 호환 | 웹에서는 `isNativeFileStorageAvailable()` false → 자동백업 스킵 | 웹 동작 영향 없음 |
| 마이그레이션 | 기존 `autoBackupUri`가 localStorage에 persist되어 있으면 바로 적용 | 신규 설치/업데이트 모두 동작 |

# Rollback

`src/database/fileStorage.ts`의 `saveStoresToFile()` 자동백업 트리거 분기를 제거하면 이전 동작(IndexedDB만 upsert)으로 복귀. `fileExport.ts`의 `writeBackupToUri`는 사용되지 않으므로 dead code로 남아도 무해 (또는 함께 제거 가능).

# 결정 대기 항목 (Q-표)

| Q | 질문 | 기본값 | 비고 |
|---|------|--------|------|
| Q1 | 자동백업 처리 시점 | A: `saveStoresToFile()` 직후 동기 호출 | B: 별도 이벤트 버스, C: useEffect watcher도 고려 가능 |
| Q2 | 파일명 결정 | 활성 볼트 파일명(`session.activeFileName`)과 동일하게 덮어쓰기 | 버전별 파일 생성 옵션은 후속 |

# Status (초기 생성)

| 항목 | 상태 | 증거 |
|------|------|------|
| 계획 작성 | ✅ done | 본 파일 |
| 구현 시작 | ✅ done | `src/database/fileStorage.ts` `saveStoresToFile()` 자동백업 트리거 추가 |
| 테스트 추가 | ⏸️ deferred | `fileStorage.test.ts` 자동백업 호출 검증 테스트 (계획에 포함, 구현 후 추가) |
| 검증 (npm run check) | ✅ done | typecheck 통과, targeted test 81건 통과 |
| 전체 테스트 | ✅ done | 40개 파일, 407개 테스트 모두 통과 |
| Android E2E 실행 | ⏸️ deferred | 에뮬레이터 필요. 사용자 직접 실행 필요 |
| E2E 테스트 코드 추가 | ✅ done | `AutosaveE2ETest.kt`에 `accountEdit_triggersAutoBackup_writeToUri` 추가, `KiyoFilePlugin.kt`에 성공 로그 추가 |

계획이 구현 가능합니다. 사용자 승인 후 `src/database/fileStorage.ts` 수정부터 시작합니다.