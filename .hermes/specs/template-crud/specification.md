# Specification: 계정 템플릿 CRUD 요구사항

## Goal

KIYO 앱에서 계정 템플릿의 생성·조회·수정·삭제(CRUD) 기능을 정의한다. 템플릿은 계정 생성 시 필드 구조(라벨, 타입, 기본값, 옵션, 순서)를 제공하는 설계도 역할을 하며, 볼트 단위로 관리된다.

## Context / Assumptions

- KIYO는 오프라인 우선, 프라이버시 중심의 안드로이드 비밀번호 관리자이다.
- 템플릿 데이터는 볼트 데이터(KiyoVaultData)의 일부로, 계정·메타데이터와 함께 하나의 AES-GCM 블록으로 암호화되어 Dexie IndexedDB(앱 내부 DB)에 저장된다.
- 템플릿의 인메모리 상태는 Zustand `useTemplateStore`가 관리한다. Store는 FileStorage를 직접 import하거나 호출하지 않으며, Persistence Coordinator(`vaultPersistence.ts`)를 통해 자동 저장된다.
- 내장 템플릿(`BUILTIN_TEMPLATES`)은 볼트 생성 시(`createDataFile`) 초기 템플릿으로 주입되며, 실행 중에도 CRUD 대상이 될 수 있다.
- 헌법(speckit-constitution)의 보안 규칙과 아키텍처 제약을 준수해야 한다. (Store–FileStorage 순환 의존 제거, 암호화 키 메모리 전용, vault data 전체 객체 암호화)

## Current Storage (현재 저장 공간)

KIYO의 템플릿 데이터는 다음 세 저장 공간에 분산되어 존재한다.

1. **앱 내부 DB (Dexie IndexedDB)**: 볼트 파일의 작업용 영구 저장소. `KiyoVaultData` 전체 객체(accounts, templates, metadata 포함)를 하나의 암호화된 파일 레코드로 저장한다. `templates` 전용 테이블은 존재하지 않음 (db.ts v15 기준).
2. **Active 스토어 (Zustand `useTemplateStore`)**: 현재 열린 볼트의 템플릿 목록을 메모리 상에 유지한다. `templates` 배열과 `init`/`addTemplate`/`updateTemplate`/`deleteTemplate`/`getTemplate`/`getAll`/`clearTemplates` 연산을 제공한다. 정렬은 `sortOrder` 기준 오름차순.
3. **외부 JSON 볼트 파일 (파일 시스템)**: 사용자가 선택한 파일 시스템 경로에 저장되는 암호화된 볼트 파일. 백업/복원의 직접 대상이며, 외부 볼트 파일과 앱 내부 DB 간 데이터를 교환하는 역할도 한다.

## Functional Requirements

### FR-1: 템플릿 모델 정의

템플릿은 다음 필드를 가져야 한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | Y | 템플릿 고유 식별자 |
| `name` | string | Y | 템플릿 표시명 (예: "로그인", "API 키") |
| `description` | string | N | 템플릿 설명 (선택) |
| `icon` | string | Y | 템플릿 아이콘 이모지 |
| `sortOrder` | number | Y | 정렬 순서 (낮은 값이 앞쪽) |
| `fields` | TemplateField[] | Y | 템플릿이 정의하는 입력 필드 목록 |
| `createdAt` | number | Y | 생성 타임스탬프 (epoch ms) |
| `updatedAt` | number | Y | 마지막 수정 타임스탬프 (epoch ms) |

TemplateField는 다음 필드를 가져야 한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | N | 필드 고유 식별자 (선택) |
| `label` | string | Y | 필드 라벨 (예: "아이디/이메일") |
| `type` | FieldType | Y | 필드 타입 (text/email/password/textarea/url/number/totp/select/date 등) |
| `defaultValue` | string | N | 기본값 |
| `options` | string[] | N | 선택 타입(select 등)의 옵션 목록 |
| `order` | number | N | 필드 내 표시 순서 |

### FR-2: 템플릿 생성 (Create)

- 사용자 정의 템플릿을 생성할 수 있다.
- 생성 시 `id`, `createdAt`, `updatedAt`이 자동 할당된다.
- 생성 후 볼트 스냅샷이 Persistence Coordinator를 통해 자동 저장된다.
- 생성 성공 시 생성된 템플릿 객체(포함된 id/타임스탬프)를 반환한다.
- 이름 중복 검사는 수행하지 않음 (동일한 이름의 템플릿 다수 생성 허용).

### FR-3: 템플릿 조회 (Read)

- 전체 템플릿 목록을 `sortOrder` 오름차순으로 조회할 수 있다.
- 특정 `id`로 단일 템플릿을 조회할 수 있다. 존재하지 않는 id면 undefined를 반환한다.
- 내장 템플릿(`BUILTIN_TEMPLATES`)과 사용자 정의 템플릿을 구분할 수 있어야 한다.

### FR-4: 템플릿 수정 (Update)

- 특정 `id`의 템플릿을 부분 수정할 수 있다. (patch 방식: 변경할 필드만 전달)
- 수정 시 `updatedAt`이 현재 시각으로 갱신된다.
- 존재하지 않는 `id`에 대한 수정은 silently no-op (에러 미발생, 상태 변경 없음).
- 수정 후 볼트 스냅샷이 Persistence Coordinator를 통해 자동 저장된다.

### FR-5: 템플릿 삭제 (Delete)

- 특정 `id`의 템플릿을 삭제할 수 있다.
- 존재하지 않는 `id`에 대한 삭제는 silently no-op.
- 삭제 후 볼트 스냅샷이 Persistence Coordinator를 통해 자동 저장된다.
- 사용 중인 계정이 템플릿을 참조하더라도 템플릿 삭제를 막지 않음 (참조 무결성 강제 아님).

### FR-6: 전체 삭제 (Clear)

- 현재 볼트의 모든 템플릿을 삭제할 수 있다. (볼트 재설정 시 사용)
- 내장 템플릿도 함께 삭제된다. 삭제된 내장 템플릿은 볼트 재생성 시에만 자동으로 복원되며, 실행 중에는 자동 복원되지 않는다.

### FR-7: 내장 템플릿 분리

- 내장 템플릿(`BUILTIN_TEMPLATES`)은 상수 정의(`src/constants/builtinTemplates.ts`)로 제공되며, 볼트 생성 시(`createDataFile`) 초기 템플릿으로 주입된다.
- 실행 중에는 내장 템플릿도 `useTemplateStore`의 CRUD 대상이 될 수 있다. (수정·삭제 제한 없음)
- 내장 템플릿과 사용자 정의 템플릿을 식별할 수 있어야 한다. (구현에서 식별 가능한 id 스키마를 사용)
- 내장 템플릿의 수정·삭제는 볼트 생성 시점에만 수행되는 것은 아니며, 실행 중에도 가능함.

### FR-8: 자동 저장 연동

- 템플릿 CRUD 연산(추가·수정·삭제·전체 삭제) 후, Persistence Coordinator의 자동 저장 핸들러가 호출되어 변경된 볼트 스냅샷이 Dexie IndexedDB에 upsert된다.
- Store는 `requestSave()`(persistencePort)를 통해 저장 요청만 보낼 뿐, 직접 FileStorage를 호출하지 않는다.

## Non-Functional Requirements

- **보안**: 템플릿 데이터는 볼트 전체 객체와 함께 PIN → PBKDF2(100,000 iterations, SHA-256) → AES-GCM-256로 암호화된다. 템플릿 단위 개별 암호화는 수행하지 않는다.
- **오프라인 우선**: 네트워크 권한을 사용하지 않으며, 모든 템플릿 데이터는 기기 로컬에만 저장된다.
- **TypeScript 개별 strict 플래그 준수**: ESM only, `@/` → `src/` import 경로, `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch`를 준수한다.
- **테스트**: `npm run typecheck`, `npm run lint`, `npm run test`가 모두 통과해야 한다.
- **성능**: 템플릿 목록은 인메모리 배열로 관리되므로 조회 연산은 O(1)~O(n) 수준이어야 한다.

## Out of Scope

- **템플릿 기반 계정 자동 생성 UI (템플릿 Picker/템플릿 선택 화면)**: **결정 완료: 구현 완료** (`TemplatePicker.tsx` 구현, `Accounts/index.tsx`에서 사용, `AccountEdit`에서 템플릿 ID 기반 필드 생성 처리)
- Android Keystore / 생체인증 연동
- Android 네이티브(Kotlin) 코드
- 계정 필드 값 암호화/복호화 (템플릿은 필드 구조 정의만 담당, 실제 값은 Account 모델이 담당)

## 의존 함수 인터페이스 스펙 (Dependency Function Interface Spec)

템플릿 CRUD 구현에 연관되는 함수들의 계약을 정의한다. "무엇을(What)"만 명시하며, "어떻게(How)"는 Plan/Tasks 단계에서 다룬다.

#### templateStore (Zustand Store, 인메모리 상태 관리)

| 함수 | 시그니처 | 설명 | 부작용 |
|------|----------|------|--------|
| `init` | `(templates: Template[]) => void` | 볼트 로드 시 템플릿 목록을 초기화한다. sortOrder 오름차순 정렬. | Store 상태 변경 |
| `getAll` | `() => Template[]` | 전체 템플릿 목록을 반환한다. | 읽기 전용 |
| `getTemplate` | `(id: string) => Template \| undefined` | 특정 id의 템플릿을 반환한다. 없으면 undefined. | 읽기 전용 |
| `addTemplate` | `(t: Omit<Template, "id" \| "createdAt" \| "updatedAt">) => Promise<Template>` | 새 템플릿을 추가한다. id/타임스탬프 자동 할당. 자동 저장(requestSave) 호출. | Store 상태 변경 + 자동 저장 트리거 |
| `updateTemplate` | `(id: string, patch: Partial<Template>) => Promise<void>` | 특정 id의 템플릿을 부분 수정한다. updatedAt 갱신. 자동 저장(requestSave) 호출. | Store 상태 변경 + 자동 저장 트리거 |
| `deleteTemplate` | `(id: string) => Promise<void>` | 특정 id의 템플릿을 삭제한다. 자동 저장(requestSave) 호출. | Store 상태 변경 + 자동 저장 트리거 |
| `clearTemplates` | `() => Promise<void>` | 모든 템플릿을 삭제한다. 자동 저장(requestSave) 호출. | Store 상태 변경 + 자동 저장 트리거 |

#### persistencePort (Store → Persistence Coordinator 인터페이스)

| 함수 | 시그니처 | 설명 | 부작용 |
|------|----------|------|--------|
| `requestSave` | `() => Promise<void>` | Store가 볼트 데이터 변경 시 자동 저장 요청을 Coordinator에 전달한다. 핸들러 미등록 시 no-op. | 등록된 저장 핸들러 실행 |
| `registerSaveHandler` | `(handler: () => Promise<void>) => void` | 자동 저장 핸들러를 등록한다. vaultPersistence에서 한 번만 등록된다. | 모듈 내부 핸들러 상태 변경 |

#### vaultPersistence (Persistence Coordinator, Store–FileStorage 중재)

| 함수 | 시그니처 | 설명 | 부작용 |
|------|----------|------|--------|
| `saveStoresToFile` | `() => Promise<void>` | Store 상태를 KiyoVaultData 스냅샷으로 구성해 IndexedDB에 upsert한다. | IndexedDB 파일 레코드 upsert |
| `buildSnapshotFromStores` | `(fileName: string) => KiyoVaultData` | 각 스토어의 getAll()로 KiyoVaultData 스냅샷을 구성한다. (순수 함수) | 부작용 없음 |
| `loadVaultToStores` | `(decrypted: KiyoVaultData) => Promise<void>` | 복호화된 볼트 데이터를 각 스토어에 init하여 분배한다. | 각 스토어 상태 변경 (init 호출) |

**제약**:

- Store는 FileStorage를 직접 import하거나 호출하지 않는다. (persistencePort만 의존)
- FileStorage는 Store를 직접 import하거나 호출하지 않는다. (스냅샷 구성/분배 함수는 Coordinator가 호출)
- 암호화 키(cryptoKey)는 메모리(SecuritySession)에만 보관되며, 디스크에 persist되지 않는다. (fileName/salt만 persist 가능)
- 볼트 데이터는 KiyoVaultData 전체 객체를 하나의 AES-GCM 블록으로 암호화한다. (템플릿 개별 암호화 아님)

## Acceptance Criteria

이 spec이 완료됐다고 판단할 조건:

1. 템플릿 모델(Template, TemplateField)이 `src/models/template.ts`에 정의되고, 헌법 §3에 따라 개별 strict 플래그로 타입 안전성이 보장된다.
2. `useTemplateStore`가 `init`/`getAll`/`getTemplate`/`addTemplate`/`updateTemplate`/`deleteTemplate`/`clearTemplates`를 모두 제공한다.
3. 템플릿 생성·수정·삭제 후 자동 저장(requestSave → Persistence Coordinator → IndexedDB upsert)이 동작한다.
4. 내장 템플릿(`BUILTIN_TEMPLATES`)은 볼트 생성 시 초기 데이터로 주입되며, 실행 중에도 CRUD 대상이 될 수 있다. 내장 템플릿 식별 기능을 지원해야 한다.
5. Store는 FileStorage(`fileStorage.ts` 등)를 직접 import하지 않는다. (Persistence Coordinator 경유)
6. 암호화 키는 메모리에만 존재하며, 디스크에 persist되지 않는다.
7. `npm run typecheck`, `npm run lint`, `npm run test`가 모두 통과한다.

## Open Questions

- **템플릿 이름 중복 허용 여부**: **결정 완료: 모두 중복 허용** (볼트명만 안 겹치면 됨)
- **템플릿 삭제 시 참조 계정 경고**: **결정 완료: 불필요** (계정과 템플릿은 완전히 분리됨, 참조 무결성 체크 없음)
- **템플릿 필드 타입(FieldType) 확장**: **결정 완료: 커스텀 타입 추가 불가** (기존 정의된 타입만 사용)
- **템플릿 값 검증 스키마**: **결정 완료: 도입** (템플릿 모델 및 입력 값 유효성 검증 스키마 도입)
