# Specification: 볼트 메타데이터(Metadata) 요구사항

## Goal
KIYO 앱에서 볼트 메타데이터(FileMetadata)의 생성·조회·수정·삭제(CRUD) 기능을 정의한다. 메타데이터는 볼트 버전, 생성 시각 등 볼트 파일 자체에 대한 정보를 담는다.

## Context / Assumptions
### 현재 상태 (Current State)
볼트 메타데이터는 다음 세 저장 공간에 분산되어 존재한다.

1. **앱 내부 DB (Dexie IndexedDB)**: `KiyoVaultData` 전체 객체의 일부로 `metadata` 배열을 저장한다.
2. **Active 스토어 (Zustand `useMetadataStore`)**: 현재 열린 볼트의 메타데이터 목록을 메모리 상에 유지한다.
3. **외부 JSON 볼트 (파일 시스템)**: 암호화된 볼트의 일부로 저장된다.

| 항목 | 현황 | 소스 |
|------|------|------|
| 메타데이터 모델 | `FileMetadata` 인터페이스 정의됨 | `src/models/vault.ts` |
| 메타데이터 스토어 | `useMetadataStore` Zustand 스토어 (init, getAll, clearMetadata 구현됨) | `src/store/metadataStore.ts` |
| 메타데이터 암호화 | 볼트 전체 단일 AES-GCM, 개별 레코드 암호화 아님 | `src/crypto/encryption.ts` |

### 전제 조건 (Assumptions)
1. 타겟 플랫폼은 Android (API 26+) WebView 기반 Capacitor 앱이다.
2. 메타데이터는 볼트 전체 객체와 함께 PIN → PBKDF2(100,000 iterations, SHA-256) → AES-GCM-256로 암호화된다.
3. 인메모리 상태는 Zustand `useMetadataStore`가 관리한다. Store는 FileStorage를 직접 import하거나 호출하지 않는다. 자동 저장은 계정 스토어(`useAccountStore`)에서만 수행되며, 메타데이터는 별도 트리거로 처리된다.
4. 네트워크 전송은 전혀 발생하지 않음 (오프라인 전용).

## Functional Requirements

### FR-1: 메타데이터 모델 정의
메타데이터는 다음 필드를 가져야 한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | number | Y | 메타데이터 고유 식별자 |
| `version` | string | Y | 볼트 버전 |
| `createdAt` | number | Y | 생성 타임스탬프 (epoch ms) |

### FR-2: 메타데이터 생성 (Create)
**Given** 새 볼트가 생성된다  \n**When** `createDataFile()`가 호출된다  \n**Then** 초기 메타데이터가 자동 생성된다. 생성 시 `id`, `createdAt`이 자동 할당된다.

### FR-3: 메타데이터 조회 (Read)
**Given** 볼트에 메타데이터가 로드된 상태  \n**When** `getAll()`이 호출된다  \n**Then** 전체 메타데이터 목록을 반환한다.

### FR-4: 전체 삭제 (Clear)
**Given** 현재 볼트에 여러 메타데이터가 존재한다  \n**When** `clearMetadata()`가 호출된다  \n**Then** 모든 메타데이터가 삭제된다. ✅ 구현됨 (동기 `() => void`, Promise 반환 아님)

## Non-Functional Requirements

| 카테고리 | 요구사항 | 측정/검증 방법 |
|----------|----------|---------------|
| **보안** | 메타데이터는 볼트 전체 객체와 함께 암호화된다. 개별 암호화는 수행하지 않음 | `encryption.ts` 코드 리뷰 |
| **오프라인 우선** | 네트워크 권한 미사용, 모든 메타데이터 기기 로컬 저장 | 정적 분석, 빌드 검증 |
| **TypeScript strict** | ESM only, `@/` → `src/` import 경로 준수 | `npm run typecheck` |
| **테스트** | `npm run typecheck`, `npm run lint`, `npm run test` 모두 통과 | CI 검증 |

## Out of Scope (명시적 제외)
다음 항목은 본 볼트 메타데이터 스펙의 범위에 포함하지 않는다.

1. **메타데이터 개별 내보내기/가져오기**: 별도 `vault-export-import` 스펙 참조.
2. **메타데이터 버전 관리 / 마이그레이션**: 추후 논의.
3. **Android 네이티브(Kotlin) 코드**: 본 스펙은 React/WebView 측에 집중.
4. **메타데이터 자동 저장 연동**: 메타데이터 변경 시 자동 저장(requestSave)은 별도 트리거로 처리되며, 본 스펙의 자동 저장 연동 범위에는 포함하지 않음.

## 의존 함수 인터페이스 스펙 (Dependency Function Interface Spec)

템플릿 CRUD 스펙과 동일한 인터페이스 패턴을 따른다.

#### metadataStore (Zustand Store, 인메모리 상태 관리)

| 함수 | 시그니처 | 설명 | 부작용 | 구현 상태 |
|------|----------|------|--------|-----------|
| `init` | `(metadata: FileMetadata[]) => void` | 볼트 로드 시 메타데이터 목록을 초기화한다. | Store 상태 변경 | ✅ 구현됨 |
| `getAll` | `() => FileMetadata[]` | 전체 메타데이터 목록을 반환한다. | 읽기 전용 | ✅ 구현됨 |
| `clearMetadata` | `() => void` | 모든 메타데이터를 삭제한다. (동기 함수, Promise 반환 아님) | Store 상태 변경 | ✅ 구현됨 (반환 타입 다름) |

## Acceptance Criteria
이 spec이 완료됐다고 판단할 조건:

1. **AC-1**: 메타데이터 모델(FileMetadata)이 `src/models/vault.ts`에 정의되고, TypeScript strict로 타입 안전성이 보장된다.
2. **AC-2**: `useMetadataStore`가 `init`/`getAll`/`clearMetadata`를 제공한다.
3. **AC-3**: Store는 FileStorage를 직접 import하지 않는다. (Persistence Coordinator 경유)
4. **AC-4**: `npm run typecheck`, `npm run lint`, `npm run test`가 모두 통과한다.

## Open Questions (미결정 사항 — 추측하지 않음)

| 항목 | 현황 |
|------|------|
| 메타데이터 필드 확장 | 수정 시각, 마지막 접근 시각 등 필드 확장 필요성 |
| 메타데이터 단일 인스턴스 보장 | 싱글톤 패턴 적용 여부 |

--|--
## 참고 문서
- `CONSTITUTION.md` — 프로젝트 헌법, §5 보안 규칙, §8 위반 체크리스트
- `.hermes/specs/vault-persistence/specification.md` — Vault 저장 구조 아키텍처
- `.hermes/specs/template-crud/specification.md` — 템플릿 CRUD 스펙 (인터페이스 패턴 참조)
- `src/models/vault.ts` — `FileMetadata`, `KiyoVaultData` 인터페이스
- `src/store/metadataStore.ts` — `useMetadataStore` 구현
--|--
