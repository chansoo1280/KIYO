# Specification: 계정(Account) CRUD 요구사항

## Goal
KIYO 앱에서 볼트 내 계정(Account)의 생성·조회·수정·삭제(CRUD) 기능을 정의한다. 계정은 사용자의 로그인 정보(제목, 사용자명/비밀번호 필드, URL, 패키지명 등)를 담는 단위 데이터로, 볼트 단위로 관리되며 PIN 기반 암호화로 보호된다.

## Context / Assumptions

### 현재 상태 (Current State)
KIYO의 계정 데이터는 다음 세 저장 공간에 분산되어 존재한다.

1. **앱 내부 DB (Dexie IndexedDB)**: 볼트의 작업용 영구 저장소. `KiyoVaultData` 전체 객체(accounts, templates, metadata 포함)를 하나의 암호화된 볼트 레코드로 저장한다. `accounts` 전용 테이블은 존재하지 않음 (db.ts v15 기준).
2. **Active 스토어 (Zustand `useAccountStore`)**: 현재 열린 볼트의 계정 목록을 메모리 상에 유지한다. `accounts` 배열과 `init`/`addAccount`/`updateAccount`/`deleteAccount`/`getAccountById`/`getAll`/`clearAccounts`/`syncToAutofill` 연산을 제공한다.
3. **외부 JSON 볼트 (파일 시스템)**: 사용자가 선택한 파일 시스템 경로에 저장되는 암호화된 볼트. 백업/복원의 직접 대상이다.

### 전제 조건 (Assumptions)
1. 타겟 플랫폼은 Android (API 26+) WebView 기반 Capacitor 앱이다.
2. 계정 데이터는 볼트 전체 객체와 함께 PIN → PBKDF2(100,000 iterations, SHA-256) → AES-GCM-256로 암호화된다. 계정 단위 개별 암호화는 수행하지 않는다.
3. 인메모리 상태는 Zustand `useAccountStore`가 관리한다. Store는 FileStorage를 직접 import하거나 호출하지 않으며, Persistence Coordinator(`vaultPersistence.ts`)를 통해 자동 저장된다.
4. `syncAutofillToken()`은 deprecated/no-op이며, Android Autofill 동기화는 순수 Keystore 기반 인증만 사용한다.
5. 네트워크 전송은 전혀 발생하지 않음 (오프라인 전용).

--|--
| 항목 | 현황 | 소스 |
|------|------|------|
| 계정 모델 | `Account` 인터페이스 정의됨 (id: number, fields 배열 등) | `src/models/account.ts` |
| 계정 스토어 | `useAccountStore` Zustand 스토어 존재 | `src/store/accountStore.ts` |
| 계정 암호화 | 볼트 전체 단일 AES-GCM, 개별 레코드 암호화 아님 | `src/crypto/encryption.ts` |
| 자동 저장 | Persistence Coordinator 경유 (`registerSaveHandler`/`requestSave`) | `src/persistence/vaultPersistence.ts` |
| Autofill 연동 | `syncToAutofill()`로 Android Autofill DB에 계정 동기화 | `src/store/accountStore.ts` |

--|--

## Functional Requirements

### FR-1: 계정 모델 정의
계정은 다음 필드를 가져야 한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | number | Y | 계정 고유 식별자 (자동 할당, 1부터 시작) |
| `templateId` | string | Y | 연동된 템플릿 ID |
| `title` | string | Y | 계정 표시명 (예: 사이트명, 앱명) |
| `description` | string | N | 계정 설명 |
| `tags` | string[] | Y | 태그 목록 |
| `favorite` | boolean | Y | 즐겨찾기 여부 |
| `fields` | AccountField[] | Y | 계정 필드 목록 (사용자명, 비밀번호 등) |
| `createdAt` | number | Y | 생성 타임스탬프 (epoch ms, 호출자가 제공) |
| `updatedAt` | number | Y | 마지막 수정 타임스탬프 (epoch ms, 호출자가 제공) |
| `websiteUrl` | string | N | 사용자 입력 URL |
| `domain` | string | N | 정규화된 도메인 (웹 자동완성 매칭용) |
| `packageName` | string | N | Android 패키지명 (앱 자동완성 매칭용) |
| `packageNames` | string[] | N | 다중 Android 패키지명 |

AccountField는 다음 필드를 가져야 한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | N | 필드 고유 식별자 |
| `accountId` | number | N | 소속 계정 ID |
| `label` | string | Y | 필드 라벨 (예: "아이디", "비밀번호") |
| `type` | FieldType | Y | 필드 타입 (text/email/password 등) |
| `value` | string | Y | 필드 값 |
| `order` | number | Y | 필드 표시 순서 |
| `options` | string[] | N | 선택 타입 옵션 목록 |

### FR-2: 계정 생성 (Create)
**Given** 사용자가 계정 생성 정보를 입력한다  
**When** `addAccount(account)`가 호출된다  
**Then** `id`가 자동 할당되며(`nextAccountId`: 기존 최대 id + 1, 없으면 1), `createdAt`과 `updatedAt`은 호출자가 제공한 값을 사용한다. 생성 후 볼트 스냅샷이 Persistence Coordinator를 통해 자동 저장된다. 생성된 계정 객체를 반환한다.

**Given** 동일한 이름/사용자명의 계정이 이미 존재한다  
**When** 새 계정을 생성한다  
**Then** 중복 검사는 수행되지 않으며, 동일 정보의 계정 다수 생성이 허용된다.

### FR-3: 계정 조회 (Read)
**Given** 볼트에 계정 데이터가 로드된 상태  
**When** `getAll()`이 호출된다  
**Then** 전체 계정 목록을 반환한다.

**Given** 특정 `id`(number)가 주어진다  
**When** `getAccountById(id)`가 호출된다  
**Then** 해당 계정을 반환한다. 존재하지 않는 id면 `undefined`를 반환한다.

### FR-4: 계정 수정 (Update)
**Given** 특정 `id`의 계정이 존재한다  
**When** `updateAccount(account)`가 호출된다  
**Then** 전체 계정 객체를 전달받아 해당 id의 계정을 교체하며, `updatedAt`이 현재 시각(`Date.now()`)으로 자동 갱신된다. 수정 후 자동 저장(requestSave)이 호출된다.

**Given** 존재하지 않는 `id`가 주어진다  
**When** `updateAccount(account)`가 호출된다  
**Then** 해당 id의 계정이 없어도 상태 변경 없이 처리된다 (silently no-op).

### FR-5: 계정 삭제 (Delete)
**Given** 특정 `id`(number)의 계정이 존재한다  
**When** `deleteAccount(id)`가 호출된다  
**Then** 계정이 삭제되며, 삭제 후 자동 저장(requestSave)이 호출된다.

**Given** 존재하지 않는 `id`가 주어진다  
**When** `deleteAccount(id)`가 호출된다  
**Then** silently no-op.

### FR-6: 전체 삭제 (Clear)
**Given** 현재 볼트에 여러 계정이 존재한다  
**When** `clearAccounts()`가 호출된다  
**Then** 모든 계정이 삭제된다. (볼트 재설정 시 사용) 삭제 후 자동 저장(requestSave)이 호출된다.

### FR-7: 자동 저장 연동
**Given** 계정 CRUD 연산(추가·수정·삭제·전체 삭제)이 발생한다  
**When** Store 상태가 변경된다  
**Then** Persistence Coordinator의 자동 저장 핸들러가 호출되어 변경된 볼트 스냅샷이 Dexie IndexedDB에 upsert된다. Store는 `requestSave()`(persistencePort)를 통해 저장 요청만 보낼 뿐, 직접 FileStorage를 호출하지 않는다.

## Non-Functional Requirements

| 카테고리 | 요구사항 | 측정/검증 방법 |
|----------|----------|---------------|
| **보안** | 계정 데이터는 볼트 전체 객체와 함께 PIN → PBKDF2(100,000 iterations, SHA-256) → AES-GCM-256로 암호화 | `encryption.ts` 코드 리뷰 + 단위 테스트 |
| **보안** | 계정 단위 개별 암호화는 수행하지 않음 | `encryptData` 출력 형태 검증 |
| **오프라인 우선** | 네트워크 권한 미사용, 모든 계정 데이터 기기 로컬 저장 | 정적 분석, 빌드 검증 |
| **TypeScript strict** | ESM only, `@/` → `src/` import 경로, strict 모드 준수 | `npm run typecheck` |
| **테스트** | `npm run typecheck`, `npm run lint`, `npm run test` 모두 통과 | CI 검증 |
| **성능** | 계정 목록 인메모리 배열 관리, 조회 연산 O(1)~O(n) | 측정 |

## Out of Scope (명시적 제외)
다음 항목은 본 계정 CRUD 스펙의 범위에 포함하지 않는다. 실제 구현이 존재하더라도 '나중에 구현 예정'으로 명시한다.

1. **계정 가져오기/내보내기 (개별 계정 파일 단위)**: 별도 `vault-export-import` 스펙 참조.
2. **계정 공유 또는 동기화**: 클라우드 없음, 모든 데이터 기기 로컬 저장.
3. **Android Keystore / 생체인증 연동**: 별도 `android-security` 스펙 참조.
4. **Android 네이티브(Kotlin) 코드**: 본 스펙은 React/WebView 측에 집중.
5. **계정 비밀번호 개별 암호화**: 계정 값은 볼트 전체 암호화의 일부로 보호됨.
6. **계정 버전 관리 / 마이그레이션**: 추후 논의.

## 의존 함수 인터페이스 스펙 (Dependency Function Interface Spec)

템플릿 CRUD 스펙과 동일한 인터페이스 패턴을 따른다.

#### accountStore (Zustand Store, 인메모리 상태 관리)

| 함수 | 시그니처 | 설명 | 부작용 |
|------|----------|------|--------|
| `init` | `(accounts: Account[]) => void` | 볼트 로드 시 계정 목록을 초기화한다. | Store 상태 변경 |
| `getAll` | `() => Account[]` | 전체 계정 목록을 반환한다. | 읽기 전용 |
| `getAccountById` | `(id: number) => Account \| undefined` | 특정 id의 계정을 반환한다. 없으면 undefined. | 읽기 전용 |
| `addAccount` | `(account: Omit<Account, "id">) => Promise<Account>` | 새 계정을 추가한다. id만 자동 할당, `createdAt`/`updatedAt`은 호출자가 제공. 자동 저장(requestSave) 호출. | Store 상태 변경 + 자동 저장 트리거 |
| `updateAccount` | `(account: Account) => Promise<void>` | 특정 id의 계정을 전체 객체로 교체한다. `updatedAt`은 내부로 `Date.now()` 자동 갱신. 자동 저장(requestSave) 호출. | Store 상태 변경 + 자동 저장 트리거 |
| `deleteAccount` | `(id: number) => Promise<void>` | 특정 id의 계정을 삭제한다. 자동 저장(requestSave) 호출. | Store 상태 변경 + 자동 저장 트리거 |
| `clearAccounts` | `() => Promise<void>` | 모든 계정을 삭제한다. 자동 저장(requestSave) 호출. | Store 상태 변경 + 자동 저장 트리거 |
| `syncToAutofill` | `() => Promise<void>` | Android 플랫폼에서 계정을 Autofill DB에 동기화한다. | Android Autofill 서비스 연동 |
| `getAutofillAccounts` | `() => Promise<{username, password, domain, title?, packageName?, packageNames?}[]>` | Autofill용 계정 목록을 반환한다. | 읽기 전용 |

#### persistencePort (Store → Persistence Coordinator 인터페이스)

| 함수 | 시그니처 | 설명 | 부작용 |
|------|----------|------|--------|
| `requestSave` | `() => Promise<void>` | Store가 볼트 데이터 변경 시 자동 저장 요청을 Coordinator에 전달한다. 핸들러 미등록 시 no-op. | 등록된 저장 핸들러 실행 |
| `registerSaveHandler` | `(handler: () => Promise<void>) => void` | 자동 저장 핸들러를 등록한다. vaultPersistence에서 한 번만 등록된다. | 모듈 내부 핸들러 상태 변경 |

**제약**:
- Store는 FileStorage를 직접 import하거나 호출하지 않는다. (persistencePort만 의존)
- FileStorage는 Store를 직접 import하거나 호출하지 않는다. (스냅샷 구성/분배 함수는 Coordinator가 호출)
- 암호화 키(cryptoKey)는 메모리(SecuritySession)에만 보관되며, 디스크에 persist되지 않는다. (fileName/salt만 persist 가능)
- 볼트 데이터는 KiyoVaultData 전체 객체를 하나의 AES-GCM 블록으로 암호화한다. (개별 레코드 단위 암호화 아님)

## Acceptance Criteria
이 spec이 완료됐다고 판단할 조건:

1. **AC-1**: 계정 모델(Account)이 `src/models/account.ts`에 정의되고, TypeScript strict로 타입 안전성이 보장된다.
2. **AC-2**: `useAccountStore`가 `init`/`getAll`/`getAccountById`/`addAccount`/`updateAccount`/`deleteAccount`/`clearAccounts`/`syncToAutofill`/`getAutofillAccounts`를 모두 제공한다.
3. **AC-3**: 계정 생성·수정·삭제 후 자동 저장(requestSave → Persistence Coordinator → IndexedDB upsert)이 동작한다.
4. **AC-4**: Store는 FileStorage(`fileStorage.ts` 등)를 직접 import하지 않는다. (Persistence Coordinator 경유)
5. **AC-5**: 암호화 키는 메모리에만 존재하며, 디스크에 persist되지 않는다.
6. **AC-6**: `npm run typecheck`, `npm run lint`, `npm run test`가 모두 통과한다.
7. **AC-7**: 헌법 §8 위반 체크리스트 전 항목 통과.

## Open Questions (미결정 사항 — 추측하지 않음)

| 항목 | 현황 |
|------|------|
| 계정 이름/사용자명 중복 허용 여부 | **결정 완료: 모두 중복 허용** (볼트명만 안 겹치면 됨) |
| 계정 삭제 시 참조 데이터 확인 | **결정 완료: 불필요** (계정과 템플릿은 완전히 분리됨, 참조 무결성 체크 없음) |
| 계정 목록 정렬 기준 | **결정 완료: 구현 완료** (`Accounts/index.tsx`에서 `sortOrder` asc/desc 상태로 제목 기준 정렬) |
| **계정 값 검증 스키마** | **결정 완료: 도입** (계정 모델 및 입력 값 유효성 검증 스키마 도입) |

--|--
## 참고 문서
- `CONSTITUTION.md` — 프로젝트 헌법, §5 보안 규칙, §8 위반 체크리스트
- `.hermes/specs/vault-persistence/specification.md` — Vault 저장 구조 아키텍처
- `.hermes/specs/template-crud/specification.md` — 템플릿 CRUD 스펙 (인터페이스 패턴 참조)
- `src/store/accountStore.ts` — `useAccountStore` 구현
- `src/models/account.ts` — `Account`, `AccountField` 인터페이스
- `src/persistence/vaultPersistence.ts` — Persistence Coordinator 구현
--|--