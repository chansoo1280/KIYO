# Specification: 볼트 생명주기 및 세션 관리 요구사항

## Goal
KIYO 앱에서 암호화 볼트의 생성·잠금·해제·닫기 전 생명주기와, 볼트 세션(암호화 키 메모리 관리)을 정의한다. 세션은 PIN 기반 키 유도 결과를 메모리에만 보관하며, 디스크에는 activeFileName과 salt만 persist한다.

## Context / Assumptions

### 현재 상태 (Current State)
볼트 데이터는 다음 세 저장 공간에 분산되어 존재한다.

1. **앱 내부 DB (Dexie IndexedDB)**: 암호화된 볼트 JSON 데이터와 파일 메타데이터(activeFileName, salt, encrypted 여부 등)를 IndexedDB에 저장한다.
2. **Active 스토어 (Zustand 인메모리 상태)**: 현재 열린 볼트의 계정, 템플릿, 메타데이터, 세션 정보를 메모리 상에 유지한다. `cryptoKey`(암호화 키)는 메모리에만 존재하며 디스크에 persist되지 않는다.
3. **외부 JSON 볼트 (파일 시스템)**: 사용자가 선택한 파일 시스템 경로에 저장되는 암호화된 볼트. 백업/복원의 직접 대상이다.

--|--
| 항목 | 현황 | 소스 |
|------|------|------|
| 세션 스토어 | `useSessionStore` Zustand 스토어, `activeFileName`/`cryptoKey`/`salt`/`initialized` 등 관리 | `src/store/sessionStore.ts` |
| 자동 잠금 | `none` / `1m` / `10m` / `30m`, 활동 감지 시 리셋 | `src/hooks/useAutoLock.ts`, CONSTITUTION §5 |
| 볼트 생성 | `createDataFile()`로 파일 생성 및 초기 데이터 주입 | `src/persistence/vaultPersistence.ts` |
| 볼트 잠금 해제 | `unlockVault()`로 PIN 기반 복호화 | `src/persistence/vaultPersistence.ts` |
| 볼트 잠금 | `lockVault()`로 cryptoKey 제거 | `src/persistence/vaultPersistence.ts` |
| 볼트 닫기 | `closeDataFile()`로 세션 및 스토어 클리어 | `src/persistence/vaultPersistence.ts` |
| 세션 세팅 | `setupVaultSession()`로 세션 정보 저장 | `src/persistence/vaultPersistence.ts` |
| 키 디스크 저장 금지 | `cryptoKey`는 메모리만, `activeFileName`/`salt`만 persist | `src/store/sessionStore.ts` `partialize` |

--|--

### 전제 조건 (Assumptions)
1. 타겟 플랫폼은 Android (API 26+) WebView 기반 Capacitor 앱이다.
2. Web Crypto API(`crypto.subtle`)는 secure context (HTTPS/localhost/127.0.0.1 또는 Android WebView)에서만 사용 가능하다.
3. PIN은 사용자가 설정하는 기억식 지식 기반 인증 요소이다.
4. 네트워크 전송은 전혀 발생하지 않음 (오프라인 전용).
5. 볼트 파일은 기기 로컬 파일 시스템 / IndexedDB에만 저장되며, 클라우드 동기화는 없다.
6. 자동 잠금 설정은 `none` / `1m` / `10m` / `30m` 중 하나이며, 활동 감지 시 타이머가 리셋된다.

## Functional Requirements

### FR-1: 볼트 생성 (Create)
**Given** 사용자가 파일명과 선택적 PIN을 입력한다  
**When** `createDataFile(fileName, pin?)`가 호출된다  
**Then** 새 볼트가 생성된다. PIN이 제공되면 PBKDF2(100,000 iterations, SHA-256)로 cryptoKey를 유도하고 salt와 함께 세션에 저장한다. 생성 후 볼트 데이터는 암호화된 형태로 Dexie IndexedDB에 저장된다. PIN이 제공되지 않으면 평문 볼트로 생성되며, cryptoKey는 메모리에 로드되지 않는다.

### FR-2: 볼트 잠금 해제 (Unlock)
**Given** 암호화된 볼트가 존재한다  
**When** 사용자가 PIN을 입력하여 `unlockVault(fileName, pin)`이 호출된다  
**Then** PIN 기반으로 cryptoKey를 유도하여 메모리(SecuritySession)에 로드한다. 복호화 성공 시 볼트 데이터(accounts, templates, metadata)가 각 스토어에 로드된다.

**Given** 잘못된 PIN이 입력된다  
**When** 복호화가 실패한다  
**Then** cryptoKey는 메모리에 남기지 않으며, 구체적 실패 이유는 외부에 노출하지 않는다 (오라클 방지).

### FR-3: 볼트 잠금 (Lock)
**Given** 볼트가 잠금 해제된 상태(cryptoKey가 메모리에 있음)  
**When** `lockVault()`가 호출된다  
**Then** cryptoKey는 메모리에서 즉시 제거된다. 세션 메타데이터(activeFileName, salt)는 유지될 수 있으며, 재해제 시 PIN 재입력이 필요하다.

### FR-4: 볼트 닫기 (Close)
**Given** 볼트가 열려 있는 상태  
**When** `closeDataFile()`가 호출된다  
**Then** 세션이 완전히 초기화된다. activeFileName, cryptoKey, salt가 메모리에서 제거되고, 각 스토어(계정, 템플릿, 메타데이터)는 클리어된다. Android 플랫폼에서는 Autofill 계정과 SecureKey도 함께 클리어된다.

### FR-5: 자동 잠금 (Auto-lock)
**Given** 자동 잠금 설정이 `1m` / `10m` / `30m` 중 하나로 설정되어 있다  
**When** 설정된 시간 동안 사용자 활동이 감지되지 않는다  
**Then** 세션이 자동으로 잠금(lock)되어 `cryptoKey`가 메모리에서 제거되어야 한다.

**Given** 사용자 활동이 감지된다  
**When** 자동 잠금 타이머가 실행 중이다  
**Then** 타이머가 리셋되어야 한다.

**Given** 키가 상실(제거)된다  
**When** 어떤 트리거로든 `cryptoKey`가 `null`이 된다  
**Then** 즉시 잠금 상태가 되어야 하며, 볼트 재해제 시 PIN 재입력이 필요하다.

### FR-6: 세션 상태 관리
**Given** 세션이 구성된다  
**When** 세션 상태를 확인한다  
**Then** 세션 상태는 `activeFileName`, `salt`, `cryptoKey`, `initialized`를 포함한다. `cryptoKey`는 메모리만, 디스크에 persist되지 않는다. `activeFileName`과 `salt`만 localStorage에 persist될 수 있다 (Zustand `partialize`).

**Given** 앱이 재시작되어 localStorage에서 세션이 복원된다  
**When** `cryptoKey`가 복원된 상태에서 확인한다  
**Then** `cryptoKey`는 `null`이어야 하며, 사용자는 반드시 PIN으로 재해제(unlock)해야 한다.

## Non-Functional Requirements

| 카테고리 | 요구사항 | 측정/검증 방법 |
|----------|----------|---------------|
| **보안** | 암호화 키는 메모리만, 디스크 persist 금지 (헌법 §5) | `sessionStore.partialize` 검토, 테스트 |
| **보안** | PIN → PBKDF2(100k) → AES-GCM-256 키 유도 고정 | `encryption.ts` 코드 리뷰 + 단위 테스트 |
| **보안** | 볼트 전체 객체 단일 AES-GCM 암호화 (개별 레코드 단위 아님) | `encryptData` 출력 형태 검증 |
| **오프라인 우선** | 네트워크 권한 미사용, 모든 데이터 기기 로컬 저장 | 정적 분석, 빌드 검증 |
| **TypeScript strict** | ESM only, `@/` → `src/` import 경로 준수 | `npm run typecheck` |
| **테스트** | `npm run typecheck`, `npm run lint`, `npm run test` 모두 통과 | CI 검증 |
| **성능** | PBKDF2 100k 실행 시 사용자 체감 지연 최소화 (unlock 시 1초 이내 완료 목표) | 측정 |

## Out of Scope (명시적 제외)
다음 항목은 본 볼트 생명주기/세션 스펙의 범위에 포함하지 않는다. 실제 구현이 존재하더라도 '나중에 구현 예정'으로 명시한다.

1. **Android Keystore / 생체인증 볼트 언락 로직**: 별도 `android-security` 스펙 참조.
2. **Android 네이티브(Kotlin) 코드**: 본 스펙은 React/WebView 측에 집중.
3. **UI 컴포넌트**: 잠금/해제 화면 등 UI는 별도 스펙.
4. **앱 설정(localStorage 저장) 구조**: 별도 `settings` 스펙 참조.
5. **클라우드 동기화 / 백업 서버**: 모든 데이터는 기기 로컬에만 저장.

## Acceptance Criteria
이 spec이 완료됐다고 판단할 조건:

1. **AC-1**: 볼트 생성·잠금 해제·잠금·닫기 전 생명주기가 정의되고, 각 단계의 상태 전이가 명확하다.
2. **AC-2**: `sessionStore`의 `partialize`에서 `cryptoKey`가 제외되고 `activeFileName`/`salt`만 persist된다. (단위 테스트)
3. **AC-3**: 앱 재시작 시 `cryptoKey`는 `null`이며, 사용자가 PIN으로 재해제해야 볼트에 접근 가능하다. (통합 테스트)
4. **AC-4**: 자동 잠금 시간 경과 시 `cryptoKey`가 메모리에서 제거되고 앱이 잠금 화면으로 이동한다. (통합/E2E 테스트)
5. **AC-5**: 활동 감지 시 자동 잠금 타이머가 리셋된다. (단위/통합 테스트)
6. **AC-6**: 볼트 닫기 시 이전 볼트의 계정/템플릿/메타데이터가 잔류하지 않는다. (통합 테스트)
7. **AC-7**: `npm run typecheck`, `npm run lint`, `npm run test`가 모두 통과한다.
8. **AC-8**: 헌법 §8 위반 체크리스트 전 항목 통과.

## Open Questions (미결정 사항 — 추측하지 않음)

| 항목 | 현황 |
|------|------|
| 자동 잠금 타이머 구현 방식 | zustand subscribe 기반 자동 저장으로 구현할지, `useAutoLock` 훅 기반으로 구현할지 |
| 볼트 잠금 시 스토어 데이터 클리어 범위 | 잠금 시 각 스토어 데이터를 함께 클리어할지, 세션만 클리어할지 |
| 백그라운드→포어그라운드 자동 잠금 | 경과 시간에 따른 자동 잠금 처리 로직 (보안 스펙의 미정 항목과 연계) |

--|--
## 참고 문서
- `CONSTITUTION.md` — 프로젝트 헌법, §5 보안 규칙, §8 위반 체크리스트
- `.hermes/specs/security/specification.md` — React/WebView 측 보안 스펙 (FR-4 자동잠금)
- `.hermes/specs/vault-persistence/specification.md` — Vault 저장 구조 아키텍처
- `src/store/sessionStore.ts` — `SecuritySession`, `partialize`, `clearCryptoKey`
- `src/hooks/useAutoLock.ts` — 자동 잠금 훅 구현
- `src/persistence/vaultPersistence.ts` — `createDataFile`, `unlockVault`, `lockVault`, `closeDataFile`
--|--