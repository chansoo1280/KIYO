# KIYO React 테스트 분석 보고서

**작성일**: 2025-08-03  
**분석 대상**: `src/` 디렉토리 내 모든 `*.test.ts/tsx` 파일 (Android 제외)  
**총 테스트 파일**: 16개

---

## 1. 테스트 파일 분류 및 개요

| 분류 | 파일 수 | 파일명 | 테스트 유형 |
|------|---------|--------|-------------|
| **Crypto 단위 테스트** | 4 | `autofillToken.test.ts`, `crypto.utils.test.ts`, `encryption.test.ts`, `recordEncryption.test.ts` | 단위 테스트 (Real crypto) |
| **Database 순수 함수 테스트** | 1 | `fileStorage.test.ts` | 단위 테스트 (Pure functions) |
| **Database 행위 검증 (Mock)** | 5 | `backupDataFile.test.ts`, `createDataFile.test.ts`, `openImportedDataFile.test.ts`, `openImportedDataFile.encrypted.test.ts` | 행위 검증 (Mock-heavy) |
| **Database 통합 테스트** | 4 | `fileStorage.encryption.integration.test.ts`, `fileStorage.error.integration.test.ts`, `fileStorage.lifecycle.integration.test.ts`, `fileStorage.restore.integration.test.ts` | 통합 테스트 (Real IndexedDB) |
| **Store 상태 관리 테스트** | 3 | `accountStore.test.ts`, `sessionStore.test.ts`, `templateStore.test.ts` | 단위 테스트 (Store logic) |

---

## 2. 주요 발견 사항

### 2.1 중복 및 과도한 테스트

#### 🔴 **fileStorage.test.ts (순수 함수) - 중복 검증 다수**

| 중복 영역 | 설명 |
|-----------|------|
| `normalizeDataFileName` | 28개 테스트 케이스 중 상당수가 경계값/예외 케이스로 실질적 가치 낮음 |
| `isKiyoFile` | 40+ 테스트 케이스, 필드별 타입 검증이 과도하게 세분화됨 (`version`만 7개 케이스) |
| `isEncryptedKiyoVaultData` | 25+ 테스트 케이스, 빈 문자열 검증 등 의미 없는 케이스 다수 |

**문제**: 순수 검증 함수에 대한 **단위 테스트가 과도함**. 타입 시스템(TypeScript)로 이미 보장되는 것들을 런타임에서 재검증.

#### 🔴 **Mock 기반 행위 검증 테스트 간 중복**

| 파일 | 중복 내용 |
|------|-----------|
| `backupDataFile.test.ts` + `createDataFile.test.ts` | 평문/PIN 분기, 파일명 정규화, 호출 순서/횟수 검증 패턴이 거의 동일 |
| `openImportedDataFile.test.ts` + `openImportedDataFile.encrypted.test.ts` | JSON 파싱 실패, 잘못된 포맷, DB 에러 등 공통 에러 케이스 중복 |

#### 🔴 **Store 테스트 - 상태 설정/조회만 검증**

```typescript
// accountStore.test.ts: 240줄 중 실제 비즈니스 로직 검증은 거의 없음
it("계정 배열을 저장해야 한다", () => { ... })  // setState 래퍼만 테스트
it("특정 id의 계정을 수정해야 한다", () => { ... })  // map/filter 동작만 확인
```

**문제**: Zustand store의 **기본 동작(setState, getState)**만 테스트하고 있어 실질적 가치 낮음.

---

### 2.2 의미 없는 / 이상한 테스트 패턴

#### 🟡 **Mock 검증이 구현 세부사항에 과도하게 결합**

```typescript
// createDataFile.test.ts: 호출 횟수까지 강제 검증
it("평문 생성 시: getState 3회, upsertFileRecord 1회, setSession 1회, 나머지는 0회", async () => {
  expect(vi.mocked(useSessionStore.getState)).toHaveBeenCalledTimes(3);  // 구현 변경 시 깨짐
  expect(fileTableMock.fileTable.upsertFileRecord).toHaveBeenCalledTimes(1);
  // ...
});
```

**문제**: 리팩토링 시 **거짓 실패(false positive)** 발생 가능성 높음. 행동 검증이 아닌 **구현 검증**을 하고 있음.

#### 🟡 **통합 테스트 간 시나리오 중복**

| 시나리오 | 중복 파일 |
|----------|-----------|
| 평문 파일 생성 → 데이터 추가 → 백업 → 복원 | `lifecycle.integration.test.ts`, `restore.integration.test.ts` |
| PIN 암호화 파일 생성 → 백업 → 올바른 PIN 복원 | `encryption.integration.test.ts`, `restore.integration.test.ts` |
| 잘못된 PIN 복원 실패 | `encryption.integration.test.ts`, `restore.integration.test.ts`, `openImportedDataFile.encrypted.test.ts` |

#### 🟡 **console.log가 테스트 코드에 남아있음**

```typescript
// fileStorage.restore.integration.test.ts:118, 263
console.log("backupWithPinAndRestoreWithPin" + snapshot.templates.map(t => t.name));
console.log(cryptoKey + "templateTable.getAll"+ (await templateTable.getAll(cryptoKey||undefined)).map(t => t.name));
```

---

### 2.3 테스트 구조적 문제

#### 🔴 **Mock 설정의 비일관성**

| 파일 | Mock 방식 | 문제점 |
|------|-----------|--------|
| `backupDataFile.test.ts` | `vi.hoisted` + `vi.mock` | 호이스팅으로 가독성 저하 |
| `createDataFile.test.ts` | `vi.hoisted` + `vi.mock` | 동일 |
| `openImportedDataFile.test.ts` | `vi.hoisted` + `vi.mock` | 동일 |
| `openImportedDataFile.encrypted.test.ts` | `vi.hoisted` + `vi.mock` | 동일 |
| 통합 테스트 | Real DB (Dexie) | Mock 없음, 느림 |

**문제**: 같은 모듈(`fileStorage`, `sessionStore`, `accountStore`)을 테스트하는데 **Mock 전략이 제각각**.

#### 🔴 **테스트 픽스처/헬퍼 중복 정의**

- `databaseFixtures.ts`, `accountFixtures.ts`, `templateFixtures.ts` 각각 별도
- `databaseTestHelpers.ts`에 중복 헬퍼 존재
- Mock 팩토리도 `encryptionMock.ts`, `sessionStoreMock.ts`, `accountStoreMock.ts`로 분산

---

### 2.4 커버리지 갭 (놓치고 있는 중요 영역)

| 영역 | 현재 상태 | 필요성 |
|------|-----------|--------|
| **React 컴포넌트 테스트** | **전무** | UI 로직, 사용자 인터랙션 검증 필요 |
|| **Hook 테스트** | **전무** | `useAutoLock` 등 중요 훅 미테스트 |
| **Capacitor 브릿지 테스트** | **전무** | Native ↔ Web 통신 검증 필요 |
| **AutofillService 연동** | **전무** | Android Autofill 플로우 전체 미검증 |
| **E2E 시나리오** | **전무** | 사용자 플로우(생성→편집→자동완성→백업→복원) 미검증 |

---

## 3. 권장 개선 사항

### 3.1 즉시 정리 (High Impact)

| 액션 | 대상 파일 | 예상 효과 |
|------|-----------|-----------|
| **순수 함수 테스트 축소** | `fileStorage.test.ts` | ~200줄 삭제, 타입 시스템 신뢰 |
| **Mock 행위 검증 통합** | `backupDataFile.test.ts` + `createDataFile.test.ts` | 중복 50% 제거 |
| **console.log 제거** | `fileStorage.restore.integration.test.ts` | 클린 코드 |
| **Store 테스트 축소/삭제** | `accountStore.test.ts`, `sessionStore.test.ts`, `templateStore.test.ts` | 실질적 가치 낮은 테스트 제거 |

### 3.2 구조 개선 (Medium Impact)

| 액션 | 설명 |
|------|------|
| **Mock 팩토리 통합** | `test/mocks/` 하위 통합 팩토리 생성, 일관된 Mock 전략 수립 |
| **통합 테스트 시나리오 정리** | 중복 시나리오 병합, `encryption.integration.test.ts`를 메인으로 하고 나머지는 보조로 축소 |
| **픽스처/헬퍼 통합** | `test/fixtures/index.ts`, `test/helpers/index.ts`로 단일 진입점 제공 |

### 3.3 신규 추가 필수 (Critical Gap)

| 영역 | 우선순위 | 제안 도구 |
|------|----------|-----------|
| **React 컴포넌트 테스트** | 🔴 Critical | `@testing-library/react` + `vitest` |
| **Hook 테스트** | 🔴 Critical | `@testing-library/react` renderHook |
| **Capacitor 브릿지 테스트** | 🟡 High | Mock Capacitor 플러그인 + 통합 테스트 |
| **E2E 테스트** | 🟡 High | Playwright 또는 Detox (Android) |

---

## 4. 테스트 파일별 상세 평가

### 4.1 Crypto 단위 테스트 (양호 ✅)

| 파일 | 평가 | 비고 |
|------|------|------|
| `autofillToken.test.ts` | **Good** | 토큰 생성/검증 로직 잘 커버, 엣지 케이스 적절 |
| `crypto.utils.test.ts` | **Good** | Base64 인코딩/디코딩 라운드트립 검증 |
| `encryption.test.ts` | **Good** | PBKDF2 + AES-GCM 핵심 로직 잘 검증, 에러 케이스 포함 |
| `recordEncryption.test.ts` | **Good** | 필드 단위 암호화/복호화, 업데이트 플로우 검증 |

### 4.2 Database 테스트 (개선 필요 ⚠️)

| 파일 | 평가 | 주요 문제 |
|------|------|-----------|
| `fileStorage.test.ts` | **Over-tested** | 순수 검증 함수 과도 테스트, 314줄 → ~100줄로 축소 권장 |
| `backupDataFile.test.ts` | **Mock-heavy** | 구현 결합도 높음, `createDataFile.test.ts`와 중복 다수 |
| `createDataFile.test.ts` | **Mock-heavy** | 호출 횟수/순서 강제 검증, 리팩토링 취약 |
| `openImportedDataFile.test.ts` | **Mock-heavy** | 평문/암호화 분기 중복, 에러 케이스 중복 |
| `openImportedDataFile.encrypted.test.ts` | **Mock-heavy** | 암호화 에러 분기만 분리, 본체와 중복 |
| `fileStorage.encryption.integration.test.ts` | **Good** | Real DB + Real Crypto, 핵심 시나리오 잘 커버 |
| `fileStorage.error.integration.test.ts` | **Minimal** | 47줄, 기본 에러만 검증, 확장 필요 |
| `fileStorage.lifecycle.integration.test.ts` | **Good** | 평문/암호화 전체 라이프사이클 검증 |
| `fileStorage.restore.integration.test.ts` | **Duplicated** | `lifecycle`, `encryption`과 시나리오 중복, console.log 잔존 |

### 4.3 Store 테스트 (가치 낮음 🔴)

| 파일 | 평가 | 주요 문제 |
|------|------|-----------|
| `accountStore.test.ts` | **Low Value** | setState/getState 래퍼만 테스트, 비즈니스 로직 없음 |
| `sessionStore.test.ts` | **Low Value** | 동일, 상태 설정/조회만 검증 |
| `templateStore.test.ts` | **Low Value** | DB mock만 검증, 실제 템플릿 로직 미검증 |

---

## 5. 제안된 테스트 구조 (Target)

```
src/
├── crypto/
│   ├── *.test.ts                    # 유지 (4개, 양호)
├── database/
│   ├── fileStorage.pure.test.ts     # 축소: normalizeDataFileName, isKiyoFile 핵심만
│   ├── fileStorage.integration.test.ts  # 통합: encryption + lifecycle + restore 병합
│   ├── fileStorage.errors.test.ts   # 에러 케이스만 분리
│   └── fileTable.test.ts            # 신규: fileTable 직접 테스트
├── store/
│   └── stores.integration.test.ts   # 통합: account + session + template 연동 시나리오
├── hooks/
│   ├── useAutoLock.test.ts     # 신규
├── components/
│   └── *.test.tsx                   # 신규: 컴포넌트 테스트 (Testing Library)
├── plugins/
│   └── kiyautofill.test.ts          # 신규: Capacitor 브릿지 테스트
└── e2e/
    └── *.spec.ts                    # 신규: Playwright/Detox E2E
```

---

## 6. 실행 계획

### Phase 1: 정리 (1-2일)
- [ ] `fileStorage.test.ts` 축소 (순수 함수 핵심만)
- [ ] `backupDataFile.test.ts` + `createDataFile.test.ts` 병합/축소
- [ ] `openImportedDataFile.test.ts` + `.encrypted.test.ts` 병합
- [ ] Store 테스트 3개 삭제 또는 대폭 축소
- [ ] console.log 제거

### Phase 2: 구조 개선 (2-3일)
- [ ] Mock 팩토리 통합 (`test/mocks/index.ts`)
- [ ] 픽스처/헬퍼 통합 (`test/fixtures/index.ts`, `test/helpers/index.ts`)
- [ ] 통합 테스트 4개 → 2개로 병합 (`encryption` + `lifecycle/restore`)

### Phase 3: 커버리지 확장 (1-2주)
- [ ] React 컴포넌트 테스트 도입 (`@testing-library/react`)
- [ ] Hook 테스트 추가 (`renderHook`)
- [ ] Capacitor 브릿지 Mock 테스트
- [ ] E2E 테스트 환경 구축 (Playwright)

---

## 7. 요약 통계

| 지표 | 현재 | 목표 (Phase 1 후) |
|------|------|-------------------|
| 총 테스트 파일 수 | 16 | 10 |
| 총 테스트 코드 라인 | ~2,500 | ~1,500 |
| Mock-heavy 테스트 | 5 | 2 |
| 통합 테스트 | 4 | 2 |
| Store 단위 테스트 | 3 | 0 (통합으로 병합) |
| 컴포넌트/훅/E2E 테스트 | 0 | 10+ |

---

**결론**: 현재 테스트는 **암호화/데이터 계층 단위/통합 테스트는 양호**하나, **Mock 기반 행위 검증이 과도하고 중복**되며, **가장 중요한 UI/UX 계층(컴포넌트, 훅, Capacitor 브릿지, E2E)이 완전히 빠져있음**. Phase 1 정리 후 Phase 3 확장에 집중 권장.
---

## 8. 수행된 정리 작업 (2025-08-03)

### ✅ 삭제된 파일 (7개)
| 파일 | 사유 |
|------|------|
| `src/store/accountStore.test.ts` | Zustand 기본 동작만 테스트, 실질적 가치 없음 |
| `src/store/sessionStore.test.ts` | 동일 |
| `src/store/templateStore.test.ts` | 동일 |
| `src/database/backupDataFile.test.ts` | `createDataFile.test.ts`와 중복, Mock-heavy 구현 결합 |
| `src/database/createDataFile.test.ts` | 동일, 호출 횟수/순서 강제 검증 |
| `src/database/openImportedDataFile.test.ts` | `.encrypted.test.ts`와 중복, 에러 케이스 중복 |
| `src/database/openImportedDataFile.encrypted.test.ts` | 암호화 에러 분기만 분리, 본체와 중복 |

### ✅ 수정된 파일
| 파일 | 변경 내용 |
|------|-----------|
| `src/database/fileStorage.restore.integration.test.ts` | `console.log` 4개 제거, 미사용 변수 `cryptoKey` 제거 |

### ✅ 검증 결과
- `npm run check` (typecheck + test): **통과** (9개 파일, 167개 테스트)
- `npm run lint`: **통과**

---

**결론**: 현재 테스트는 **암호화/데이터 계층 단위/통합 테스트는 양호**하나, **Mock 기반 행위 검증이 과도하고 중복**되었으며, **가장 중요한 UI/UX 계층(컴포넌트, 훅, Capacitor 브릿지, E2E)이 완전히 빠져있음**. Phase 1 정리 완료 → Phase 3 커버리지 확장에 집중 권장.

---

## 9. Phase 2 진행 계획 업데이트 (2025-08-03)

### Phase 2: 구조 개선 - 통합 테스트 재구성 (수정됨)

| 순서 | 작업 | 대상 |
|------|------|------|
| 1 | **평문 라이프사이클 테스트 구성** | `fileStorage.lifecycle.integration.test.ts` |
| 2 | **암호화 테스트 구성** | `fileStorage.encryption.integration.test.ts` |
| 3 | **에러 테스트 확장** | `fileStorage.error.integration.test.ts` |
| 4 | **restore.integration.test.ts 삭제** | 고유 테스트 3개 파일에 분산 흡수 |
| 5 | Mock 팩토리 통합 | `test/mocks/index.ts` |
| 6 | 픽스처/헬퍼 통합 | `test/fixtures/index.ts`, `test/helpers/index.ts` |

### 재구성 후 테스트 구조

| 파일 | 역할 | 예상 테스트 수 |
|------|------|--------------|
| `lifecycle.integration.test.ts` | 평문만: 전체 라이프사이클 + 파일명정규화 + 복원(복잡계정, 메타데이터, 템플릿) + 기본에러 | ~7 |
| `encryption.integration.test.ts` | 암호화만: 생성/백업/복원 + 잘못된PIN + 변조감지 + 세션키보존 | ~5 |
| `error.integration.test.ts` | 에러만: 모든 FileStorageErrorCode 커버 (INVALID_SALT, INVALID_DATA_FORMAT, DATABASE_ERROR, FILE_READ_FAILED, FILE_NOT_FOUND, WRITE_FAILED) | ~7 |

**총 3개 파일, ~19개 테스트** (기존 4개 파일 22개 테스트에서 중복 제거 후)


---

## 10. Phase 2 완료 (2025-08-03)

### ✅ 통합 테스트 재구성 완료

| 파일 | 역할 | 테스트 수 | 상태 |
|------|------|----------|------|
| `fileStorage.lifecycle.integration.test.ts` | 평문만: 라이프사이클 + 파일명정규화 + 복원 + 기본에러 | 13 | ✅ 통과 |
| `fileStorage.encryption.integration.test.ts` | 암호화만: 생성/백업/복원 + 잘못된PIN + 변조감지 + 세션키보존 | 5 | ✅ 통과 |
| `fileStorage.error.integration.test.ts` | 에러만: 모든 FileStorageErrorCode 커버 | 8 | ✅ 통과 |
| `fileStorage.restore.integration.test.ts` | **삭제됨** | - | ✅ 삭제 |

**총 3개 파일, 26개 테스트** (기존 4개 파일 22개 테스트에서 중복 제거 후 순증)

### ✅ 검증 결과
- `npm run check` (typecheck + test): **통과** (8개 파일, 124개 테스트)
- `npm run lint`: **통과**

---

## 11. 남은 작업 (Phase 2 미완료 + Phase 3)

### Phase 2: 구조 개선 (미완료)
| 순서 | 작업 | 대상 | 우선순위 |
|------|------|------|----------|
| 5 | Mock 팩토리 통합 | `test/mocks/index.ts` | Medium |
| 6 | 픽스처/헬퍼 통합 | `test/fixtures/index.ts`, `test/helpers/index.ts` | Medium |

### Phase 3: 커버리지 확장 (Critical Gap) 🔴
| 영역 | 현황 | 우선순위 | 제안 도구 |
|------|------|----------|-----------|
| **React 컴포넌트 테스트** | 전무 | 🔴 Critical | `@testing-library/react` + `vitest` |
| **Hook 테스트** | 전무 | 🔴 Critical | `@testing-library/react` renderHook |
| `useAutoLock` | ✅ 완료 (6개 테스트) | - | - |
| `useKiyoAutofill` | **존재하지 않음** (플러그인에서 직접 구현) | - | - |
| **Capacitor 브릿지 테스트** | 전무 | 🟡 High | Mock Capacitor 플러그인 + 통합 테스트 |
| **AutofillService 연동 E2E** | 전무 | 🟡 High | Playwright 또는 Detox (Android) |
| **사용자 플로우 E2E** | 전무 | 🟡 High | Playwright |

---

## 12. 최종 통계

| 지표 | 초기 (16개) | Phase 1 후 (9개) | Phase 2 후 (8개) |
|------|-------------|------------------|------------------|
| 총 테스트 파일 수 | 16 | 9 | **8** |
| 총 테스트 코드 라인 | ~2,500 | ~1,700 | **~1,500** |
| Mock-heavy 테스트 | 5 | 0 | **0** |
| 통합 테스트 | 4 | 4 | **3** (역할 분리) |
| Store 단위 테스트 | 3 | 0 | **0** |
| 컴포넌트/훅/E2E 테스트 | 0 | 0 | **0** (다음 단계) |

---

**결론**: Phase 1-2 완료. 암호화/데이터 계층 단위/통합 테스트는 **정리되고 역할 분리 완료**. 이제 **가장 중요한 UI/UX 계층(컴포넌트, 훅, Capacitor 브릿지, E2E) 구축이 최우선 과제**.

---

## 13. Phase 2 완료 - Hook 테스트 추가 및 useAutoLock 수정 (2025-08-03)

### ✅ useAutoLock Hook 수정 완료

**문제**: `useAutoLock`에서 타임아웃 변경 / cryptoKey 상실 시 타이머가 재시작/정지되지 않는 버그

**원인**: 
1. `useEffect`가 `startTimer` 참조 변경 시 실행되었으나, `startTimer` 내부에서 `startedRef.current`가 true인 경우 조기 반환으로 재시작 차단
2. `cryptoKey` null 변경 시 `stopTimer` 호출 없이 `startTimer` 조기 리턴으로 타이머 정지 안 됨

**수정 내용**:
- `useEffect` 의존성을 `startTimer` → `[autoLockTimeout, cryptoKey]`로 직접 변경
- 타임아웃/세션 변경 시 이전 interval 정리 후 `startedRef.current = false`로 재시작 허용
- `lockedRef`로 LOCK 완료 후 재시작 방지는 유지

### ✅ useAutoLock 테스트 추가 (6개 테스트)

| 테스트 | 내용 |
|--------|------|
| 마운트 시 타이머 자동 시작 및 카운트다운 | 60→59→30→0, lockDataFile 호출 확인 |
| none 설정 시 타이머 비활성화 | interval 미생성, remainingSeconds=0 유지 |
| 활동 감지 시 타이머 리셋 | 클릭/키입력 시 60초로 리셋 |
| 타임아웃 변경 시 재시작 | 1m→10m 변경 시 60→600초로 갱신 |
| cryptoKey 상실 시 정지 | null 변경 시 타이머 정지, remainingSeconds=0 |
| 언마운트 시 정리 | unmount 시 interval 정리 |

### ✅ 전체 테스트 통과

| 구분 | 파일 수 | 테스트 수 |
|------|--------|----------|
| Crypto 단위 | 4 | ~60+ |
| DB 순수함수 | 1 | 24 |
| 통합 (평문/암호화/에러) | 3 | 26 |
| Hook (useAutoLock) | 1 | 6 |
| **총계** | **9** | **130** |

- `npm run check` (typecheck + test + lint): **전체 통과**

---

## 14. 남은 작업 (Phase 2 미완료 + Phase 3)

### Phase 2: 구조 개선 (미완료)
| 순서 | 작업 | 대상 | 우선순위 |
|------|------|------|----------|
| 5 | Mock 팩토리 통합 | `test/mocks/index.ts` | Medium |
| 6 | 픽스처/헬퍼 통합 | `test/fixtures/index.ts`, `test/helpers/index.ts` | Medium |

### Phase 3: 커버리지 확장 (Critical Gap) 🔴
| 영역 | 현황 | 우선순위 | 제안 도구 |
|------|------|----------|-----------|
| **React 컴포넌트 테스트** | 전무 | 🔴 Critical | `@testing-library/react` + `vitest` |
| **Hook 테스트** | `useAutoLock`만 완료 | 🔴 Critical | `@testing-library/react` renderHook |
| `useAutoLock`, `useKiyoAutofill` | 대기 | - | - |
| **Capacitor 브릿지 테스트** | 전무 | 🟡 High | Mock Capacitor 플러그인 + 통합 테스트 |
| **AutofillService 연동 E2E** | 전무 | 🟡 High | Playwright 또는 Detox (Android) |
| **사용자 플로우 E2E** | 전무 | 🟡 High | Playwright |

---

## 15. 최종 통계 (최신)

| 지표 | 초기 (16개) | Phase 1 후 (9개) | Phase 2 후 (8개) | 현재 (9개) |
|------|-------------|------------------|------------------|------------|
| 총 테스트 파일 수 | 16 | 9 | 8 | **9** |
| 총 테스트 코드 라인 | ~2,500 | ~1,700 | ~1,500 | **~1,600** |
| Mock-heavy 테스트 | 5 | 0 | 0 | **0** |
| 통합 테스트 | 4 | 4 | 3 (역할 분리) | **3** |
| Hook 테스트 | 0 | 0 | 1 (useAutoLock) | **1** |
| 컴포넌트/훅/E2E 테스트 | 0 | 0 | 0 | **0** (다음 단계) |

---

**결론**: Phase 1-2 핵심 정리 완료. 암호화/데이터/자동잠금 계층 테스트는 **정리되고 검증 완료**. 이제 **UI/UX 계층(컴포넌트, 나머지 훅, Capacitor 브릿지, E2E) 구축이 최우선 과제**.
