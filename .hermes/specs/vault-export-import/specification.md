# Specification: 볼트 내보내기/가져오기(Export/Import) 요구사항

## Goal
KIYO 앱에서 암호화 볼트의 외부 파일 내보내기(Export)와 가져오기(Import) 기능을 정의한다. 백업/복원의 직접 대상은 외부 JSON 볼트 파일이다.

## Context / Assumptions

### 현재 상태 (Current State)
볼트 내보내기/가져오기는 다음 저장 공간과 연계된다.

1. **앱 내부 DB (Dexie IndexedDB)**: 볼트의 작업용 영구 저장소. 내보내기 전 현재 볼트 스냅샷을 구성하는 데 사용된다.
2. **Active 스토어 (Zustand 인메모리 상태)**: 현재 열린 볼트의 데이터. 내보내기 시 스냅샷 구성에 사용된다.
3. **외부 JSON 볼트 (파일 시스템)**: 사용자가 선택한 파일 시스템 경로에 저장되는 암호화된 볼트. 백업/복원의 직접 대상이다.

--|--
| 항목 | 현황 | 소스 |
|------|------|------|
| 내보내기 함수 | `backupDataFile(fileName, pin?)` | `src/persistence/vaultPersistence.ts` |
| 가져오기 함수 | `openImportedDataFile(data, pin, fileName)` | `src/persistence/vaultPersistence.ts` |
| 파일 내보내기(실행) | `exportBackupFile(fileName, data)` (SAF 또는 웹 다운로드) | `src/database/fileExport.ts` |
| 파일 저장소 | `fileTable` (Dexie IndexedDB) | `src/database/fileTable.ts` |
| 암호화/복호화 | `encryptData`, `decryptVaultData`, `createEncryptedVault` | `src/crypto/encryption.ts`, `src/database/fileStorage.ts` |
| 파일명 정규화 | `normalizeDataFileName(fileName)` | `src/database/fileExport.ts` |

--|--

### 전제 조건 (Assumptions)
1. 타겟 플랫폼은 Android (API 26+) WebView 기반 Capacitor 앱이다.
2. 내보내기/가져오기 파일은 암호화된 형태 또는 평문 형태로 저장될 수 있다.
3. 암호화 키(cryptoKey)는 메모리에만 보관되며, 내보내기 파일에도 포함되지 않는다.
4. 네트워크 전송은 전혀 발생하지 않음 (오프라인 전용).

## Functional Requirements

### FR-1: 볼트 내보내기 (Export)
**Given** 현재 열려 있는 볼트가 존재한다  
**When** `backupDataFile(fileName, pin?)`가 호출된다  
**Then** 현재 볼트의 스냅샷을 구성하여 외부 파일로 내보낼 수 있다. PIN이 제공되면 암호화된 형태로 내보내고, PIN이 없으면 평문 형태로 내보낼 수 있다. 내보내기 성공 시 생성된 파일의 경로/URI를 반환한다. 내보내기 시 암호화 키는 디스크에 persist되지 않는다.

**Given** Android 플랫폼에서 SAF URI를 통해 저장한다  
**When** `exportBackupFile(normalizedFileName, data)`가 호출된다  
**Then** `KiyoFile.saveFile()`를 통해 외부 URI에 JSON 파일을 작성한다. 웹 환경에서는 Blob 다운로드로 폴백된다.

### FR-2: 볼트 가져오기 (Import)
**Given** 외부 JSON 볼트가 존재한다  
**When** `openImportedDataFile(data, pin, fileName)`가 호출된다  
**Then** 외부 파일을 가져올 수 있다. 암호화된 파일인 경우 PIN 입력이 필수적이다. 가져오기 성공 시 볼트 데이터가 각 스토어에 로드되고, Dexie IndexedDB에 저장된다. 잘못된 파일 형식이나 잘못된 PIN 시 적절한 에러(`FileStorageError`)를 반환한다.

### FR-3: 파일 형식 검증
**Given** 가져오기 대상이 주어진다  
**When** 파일 형식을 검증한다  
**Then** 파일이 유효한 `KiyoVaultData` 형식인지(`isKiyoFile`) 검증한다. 암호화된 파일인 경우 salt가 16바이트인지 검증한다.

## Non-Functional Requirements

| 카테고리 | 요구사항 | 측정/검증 방법 |
|----------|----------|---------------|
| **보안** | 암호화 키는 내보내기/가져오기 파일에 포함되지 않는다 | 코드 리뷰 |
| **보안** | 가져오기 시 잘못된 PIN은 구체적 실패 이유를 외부에 노출하지 않는다 (오라클 방지) | 코드 리뷰 + 테스트 |
| **오프라인 우선** | 네트워크 권한 미사용, 모든 데이터 기기 로컬 저장 | 정적 분석, 빌드 검증 |
|| **TypeScript 개별 strict 플래그 준수** | ESM only, `@/` → `src/` import 경로 준수, `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch` 준수 | `npm run typecheck` |
| **테스트** | `npm run typecheck`, `npm run lint`, `npm run test` 모두 통과 | CI 검증 |

## Out of Scope (명시적 제외)
다음 항목은 본 볼트 내보내기/가져오기 스펙의 범위에 포함하지 않는다. 실제 구현이 존재하더라도 '나중에 구현 예정'으로 명시한다.

1. **클라우드 동기화 / 백업 서버**: 모든 데이터는 기기 로컬에만 저장.
2. **개별 계정/템플릿 단위 내보내기/가져오기**: 볼트 전체 단위만 지원.
3. **Android 네이티브(Kotlin) 코드**: 본 스펙은 React/WebView 측에 집중.
4. **파일 공유 (이메일, 메신저 등)**: 파일 시스템 저장만 담당.
5. **`importBackup` 함수**: `fileExport.ts`에 주석 처리된 미완성 함수가 있으나, 기능 자체가 필요 없음. 가져오기는 HTML `<input type="file">`을 통해 외부 파일을 직접 읽어 `openImportedDataFile`로 처리하므로 별도 `importBackup` 함수는 사용하지 않음.

## Acceptance Criteria
이 spec이 완료됐다고 판단할 조건:

1. **AC-1**: 볼트 내보내기(`backupDataFile`)가 현재 볼트 스냅샷을 외부 파일로 저장한다.
2. **AC-2**: 볼트 가져오기(`openImportedDataFile`)가 외부 파일을 읽어 각 스토어에 로드하고 IndexedDB에 저장한다.
3. **AC-3**: 암호화된 가져오기 파일은 PIN 기반 복호화가 필요하며, 복호화 실패 시 에러를 반환한다.
4. **AC-4**: 암호화 키는 내보내기/가져오기 파일에 포함되지 않는다.
5. **AC-5**: `npm run typecheck`, `npm run lint`, `npm run test`가 모두 통과한다.

## Open Questions (미결정 사항 — 추측하지 않음)

| 항목 | 현황 |
|------|------|
| **내보내기 시 PIN 입력 필요 여부**: **결정 완료: 선택 사항 (필수 아님)** (PIN 제공 시 암호화 내보내기, 미제공 시 평문 내보내기 — `backupDataFile(fileName, pin?)`) |
| **가져오기 시 데이터 병합 vs 덮어쓰기**: **결정 완료: 덮어쓰기 (사용자 확인 후)** (같은 파일명이 있는 경우 덮어쓰며, 실행 전 확인 모달 표시) |
| **내보내기 파일명 정규화 규칙**: **결정 완료: 현재 구현대로** (`normalizeDataFileName`에서 trim 후 빈 문자열은 "kiyo-data" 기본값, ".json" 미포함 시 자동 확장자 추가) |

--|--
## 참고 문서
- `CONSTITUTION.md` — 프로젝트 헌법, §5 보안 규칙, §8 위반 체크리스트
- `.hermes/specs/security/specification.md` — React/WebView 측 보안 스펙 (FR-7 볼트 내보내기 별도 암호)
- `.hermes/specs/vault-persistence/specification.md` — Vault 저장 구조 아키텍처
- `src/persistence/vaultPersistence.ts` — `backupDataFile`, `openImportedDataFile` 구현
- `src/database/fileExport.ts` — `exportBackupFile`, `normalizeDataFileName` 구현
--|--