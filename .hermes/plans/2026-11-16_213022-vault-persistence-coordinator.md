
# Plan: Vault Persistence Coordinator 도입 (Store–FileStorage 순환 의존 제거)

## Goal

Store 계층(Zustand store)과 FileStorage 계층(Dexie IndexedDB 기반 파일 저장소) 간의 순환 의존을 제거하고, 두 계층을 중재하는 Vault Persistence Coordinator를 도입한다.

## Architecture

Persistence Coordinator 패턴을 인터페이스 추상화(persistencePort) 방식으로 적용한다.

```
accountStore ──────→ persistencePort
                           ▲
                           │ 구현 등록 (registerSaveHandler)
                    vaultPersistence
                      /          \
                     ▼            ▼
                  Stores      fileStorage
```

- `accountStore`, `templateStore` 등 Store는 `persistencePort.requestSave()`로 자동 저장 요청만 보냄 (FileStorage 모름)
- `persistencePort`는 저장 요청 인터페이스(`registerSaveHandler`, `requestSave`)만 제공
- `vaultPersistence`가 Store 상태를 수집(스냅샷 구성)하고 `fileStorage`를 호출하여 실제 저장/복원 조율
- `fileStorage`는 데이터 입출력만 담당하고 Store를 직접 알지 않음

## Tech Stack

- TypeScript (~6.0.2, strict, ESM only)
- Zustand (인메모리 상태 관리)
- Dexie.js (IndexedDB, 영구 저장소)
- Web Crypto API (AES-GCM, PBKDF2)
- Vitest (단위/통합 테스트)

## Files

### Create

- `.hermes/specs/vault-persistence/specification.md` — 이미 작성됨 (spec 단계 산출물)
- `src/persistence/persistencePort.ts` — 저장 요청 인터페이스
- `src/persistence/persistencePort.test.ts` — 인터페이스 테스트
- `src/persistence/vaultPersistence.ts` — Vault Persistence Coordinator (스텁 → 구현)

### Modify

- `src/store/accountStore.ts` — `saveStoresToFile` import 제거, `requestSave()` 호출로 변경
- `src/store/templateStore.ts` — `saveStoresToFile` import 제거, `requestSave()` 호출로 변경
- `src/database/fileStorage.ts` — 모든 Zustand store import 제거, 데이터 입출력만 담당

## Tasks

각 task는 2~5분 단위로 분해하며, 순차적으로 의존성을 가진다.

1. [x] `src/persistence/vaultPersistence.ts` 파일 생성 (스텁 인터페이스: saveVault, loadVault, lockVault, unlockVault)
2. [x] `src/persistence/persistencePort.ts` 생성 (registerSaveHandler, requestSave)
3. [x] `src/persistence/persistencePort.test.ts` 작성 및 테스트 통과
4. [ ] `src/database/fileStorage.ts`에서 모든 store import 제거, 데이터 입출력 함수만 남김
5. [ ] `src/persistence/vaultPersistence.ts`에 스냅샷 구성 및 저장 로직 구현, `registerSaveHandler` 등록
6. [ ] `src/store/accountStore.ts`에서 `saveStoresToFile` import 제거, `requestSave()` 호출로 변경
7. [ ] `src/store/templateStore.ts`에서 `saveStoresToFile` import 제거, `requestSave()` 호출로 변경
8. [ ] `npm run typecheck` 통과
9. [ ] `npm run lint` 통과 (수정 파일 기준)
10. [ ] `npm run test` 통과 (기존 행위 유지)

### 의존성 순서

Tasks 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

## Tests / Validation

- `npm run typecheck` — TypeScript 컴파일 오류 없음
- `npm run lint` — 수정한 파일에 새로운 lint 오류 없음 (기존 코드 에러는 제외)
- `npm run test` — Vitest 단위/통합 테스트 모두 통과

## Risks / Tradeoffs / Open Questions

- **Risk**: zustand subscribe 기반 자동 저장 시 store 변경 감지 타이밍에 따라 저장 누락 또는 중복 저장 가능성 → 현재는 명시적 `requestSave()` 호출 방식으로 구현
- **Tradeoff**: `persistencePort`라는 인터페이스 계층이 하나 추가되며, 모듈 간 의존성이 더 명확해짐
- **Open Question**: 볼트 스냅샷 구성을 `vaultPersistence`에서 담당할지, Store에서 넘겨받을지 (현재: `vaultPersistence`에서 `useAccountStore.getState()` 등 직접 호출)
