
# Specification: 암호화 Vault 저장 구조 아키텍처 요구사항

## Goal

KIYO의 암호화 Vault 저장 구조가 만족해야 할 아키텍처 요구사항과 제약 조건을 명세한다.

## Context / Assumptions

- KIYO는 오프라인 우선, 프라이버시 중심의 안드로이드 비밀번호 관리자이다.
- 볼트 데이터는 PIN 기반 PBKDF2 + AES-GCM로 암호화되어 로컬 파일 시스템에 저장된다.
- Zustand store(account, template, metadata, session, 설정)가 볼트 데이터의 인메모리 상태를 관리한다.
- Dexie IndexedDB가 볼트 파일의 작업용 영구 저장소를 제공한다. 백업/복원의 직접 대상은 외부 JSON 볼트 파일이다.
- 헌법(CONSTITUTION.md)의 보안 규칙과 아키텍처 제약을 준수해야 한다.

## Current Storage (현재 저장 공간)

KIYO의 볼트 데이터는 다음 세 저장 공간에 분산되어 존재한다.

1. **앱 내부 DB (Dexie IndexedDB)**: 볼트 파일의 작업용 영구 저장소. 암호화된 볼트 JSON 데이터와 파일 메타데이터(fileName, salt, encrypted 여부 등)를 IndexedDB에 저장한다. 앱 실행 중 현재 볼트의 읽기/쓰기 저장소로 사용되며, 백업/복원의 직접 대상이 되지는 않는다.
2. **Active 스토어 (Zustand 인메모리 상태)**: 현재 열린 볼트의 계정, 템플릿, 메타데이터, 세션 정보를 메모리 상에 유지한다. `cryptoKey`(암호화 키)는 메모리에만 존재하며 디스크에 persist되지 않는다. 사용자의 CRUD 연산은 우선 이 스토어를 대상으로 수행된다.
3. **외부 JSON 볼트 파일 (파일 시스템)**: 사용자가 선택한 파일 시스템 경로(Documents 등)에 저장되는 암호화된 볼트 파일. **백업/복원의 직접 대상**이며, 외부 볼트 파일과 앱 내부 DB 간 데이터를 교환하는 역할도 한다.

## Functional Requirements

### FR-1: 저장 계층의 상호 독립성

볼트 저장 구조는 다음 세 계층으로 분리되어야 하며, 인접하지 않은 두 계층은 서로를 직접 참조하지 않아야 한다.

1. **Store 계층**: Zustand store들(account, template, metadata, session 등). 볼트 데이터의 인메모리 상태와 CRUD 연산을 담당한다.
2. **FileStorage 계층**: Dexie IndexedDB 기반의 볼트 파일 영구 저장소. 암호화된 볼트 데이터의 읽기/쓰기를 담당한다.
3. **Persistence Coordinator**: Store 계층과 FileStorage 계층 사이를 중재하는 조정 계층. 볼트 저장, 불러오기, 잠금, 해제 요청을 조정한다.

- **Store는 FileStorage를 직접 import하거나 호출하지 않아야 한다.**
- **FileStorage는 Store를 직접 import하거나 호출하지 않아야 한다.**
- **Store와 FileStorage 간의 모든 상호작용은 Persistence Coordinator를 통해 수행되어야 한다.**

### FR-2: 자동 저장 기능

볼트 데이터가 변경(계정/템플릿/메타데이터 추가·수정·삭제)될 때, 변경 사항은 Persistence Coordinator를 통해 Dexie IndexedDB(앱 내부 DB)에 자동 저장된다. 외부 JSON 볼트 파일은 사용자가 파일 저장 경로 권한을 부여한 경우에만 백업된다.

### FR-3: 세션 잠금 및 해제

볼트 잠금 시 암호화 키는 메모리에서 제거되어야 하며, 볼트 해제 시 PIN 기반으로 키를 유도하여 메모리에 로드해야 한다. 세션 메타데이터(fileName, salt 등)만 디스크에 persist될 수 있다.

### FR-4: 암호화된 볼트 저장

디스크에 저장되는 볼트 데이터는 `KiyoVaultData` 전체 객체를 하나의 AES-GCM 블록으로 암호화한 형태여야 한다.

### FR-5: 키 디스크 저장 금지

암호화 키(cryptoKey)는 반드시 메모리(SecuritySession)에만 보관되어야 하며, 디스크에 영구 저장되어서는 안 된다. 디스크에 persist될 수 있는 정보는 fileName과 salt에 한정된다.

## Non-Functional Requirements

- **보안**: PIN → PBKDF2(100,000 iterations, SHA-256) → AES-GCM-256 키 유도를 준수해야 한다.
- **오프라인 우선**: 네트워크 권한을 사용하지 않으며, 모든 데이터는 기기 로컬에만 저장된다.
- **TypeScript**: strict 모드, ESM only, `@/` → `src/` import 경로를 준수해야 한다.
- **테스트**: `npm run typecheck`, `npm run lint`, `npm run test` 모두 통과해야 한다.

## Out of Scope

- Android Keystore / 생체인증 볼트 언락 로직
- Android 네이티브(Kotlin) 코드
- UI 컴포넌트
- 앱 설정(localStorage 저장) 구조

### 의존 함수 인터페이스 스펙 (Dependency Function Interface Spec)

Store–FileStorage 순환 의존 제거를 위해, Persistence Coordinator를 경유하여 호출되는 각 함수의 계약(인터페이스)을 정의한다. 본 섹션은 "무엇을(What)"만 명시하며, "어떻게(How)"는 Plan/Tasks 단계에서 다룬다.

#### persistencePort (Store → Coordinator 인터페이스)

| 함수 | 시그니처 | 설명 | 부작용 |
|------|----------|------|--------|
| `registerSaveHandler` | `(handler: () => Promise<void>) => void` | Store가 자동 저장 요청 핸들러를 등록한다. vaultPersistence에서 한 번만 등록된다. | 모듈 내부 핸들러 상태 변경 |
| `requestSave` | `() => Promise<void>` | Store가 볼트 데이터 변경 시 자동 저장 요청을 Coordinator에 전달한다. 핸들러 미등록 시 no-op. | 등록된 저장 핸들러 실행 |

#### vaultPersistence (Persistence Coordinator 실제 구현)

| 함수 | 시그니처 | 설명 | 부작용 |
|------|----------|------|--------|
| `saveVault` | `(fileName: string, snapshot: KiyoVaultData) => Promise<void>` | 볼트 스냅샷을 Dexie IndexedDB에 암호화하여 저장한다. 외부 JSON 백업 파일은 autoBackup 조건 시 별도로 처리된다. | IndexedDB 파일 레코드 upsert, 선택적 외부 백업 미러링 |
| `loadVault` | `(fileName: string) => Promise<KiyoVaultData \| null>` | IndexedDB에서 볼트 데이터를 읽어온다. 파일이 없으면 null을 반환한다. | 읽기 전용 (상태 변경 없음) |
| `lockVault` | `() => Promise<void>` | 현재 볼트를 잠근다. 메모리에서 암호화 키를 제거한다. | sessionStore의 cryptoKey/salt 클리어 |
| `unlockVault` | `() => Promise<void>` | 현재 볼트의 잠금을 해제한다. PIN 기반 키 유도로 메모리에 로드한다. | sessionStore에 cryptoKey/salt 설정 |

#### fileStorage (Dexie IndexedDB 데이터 입출력, Store 미참조)

| 함수 | 시그니처 | 설명 | 부작용 |
|------|----------|------|--------|
| `saveStoresToFile` | `() => Promise<void>` | 스토어 상태를 KiyoVaultData 스냅샷으로 구성해 IndexedDB에 upsert한다. (vaultPersistence가 호출) | IndexedDB 파일 레코드 upsert |
| `buildSnapshotFromStores` | `(fileName: string) => KiyoVaultData` | 각 스토어의 getAll()로 KiyoVaultData 스냅샷을 구성한다. (vaultPersistence가 호출) | 부작용 없음 (순수 함수) |
| `loadVaultToStores` | `(decrypted: KiyoVaultData) => Promise<void>` | 복호화된 볼트 데이터를 각 스토어에 init하여 분배한다. (vaultPersistence가 호출) | 각 스토어 상태 변경 (init 호출) |

**제약**:
- Store는 FileStorage를 직접 import하거나 호출하지 않는다. (persistencePort만 의존)
- FileStorage는 Store를 직접 import하거나 호출하지 않는다. (스냅샷 구성/분배 함수는 Coordinator가 호출)
- 암호화 키(cryptoKey)는 메모리(SecuritySession)에만 보관되며, 디스크에 persist되지 않는다. (fileName/salt만 persist 가능)
- 볼트 데이터는 KiyoVaultData 전체 객체를 하나의 AES-GCM 블록으로 암호화한다. (개별 레코드 단위 암호화 아님)

## Acceptance Criteria

이 spec이 완료됐다고 판단할 조건:

1. Store 계층과 FileStorage 계층이 서로를 직접 import하지 않는다.
2. Persistence Coordinator가 Store와 FileStorage 간의 모든 상호작용을 중재한다.
3. 볼트 데이터 변경 시 자동 저장 기능이 Persistence Coordinator를 통해 동작한다.
4. 암호화 키는 메모리에만 존재하며 디스크에 persist되지 않는다.
5. `npm run typecheck`, `npm run lint`, `npm run test`가 모두 통과한다.

## Open Questions

- Persistence Coordinator를 zustand subscribe 기반 자동 저장으로 구현할지, 명시적 함수 호출로 구현할지.
- 볼트 스냅샷 구성을 Coordinator에서 담당할지, Store에서 넘겨받을지.
- 기존 `saveStoresToFile` 함수 인터페이스를 유지할지 새로 설계할지.
