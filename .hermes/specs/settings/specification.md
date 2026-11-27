# Specification: 앱 설정(Settings) 요구사항

## Goal
KIYO 앱의 앱 설정(테마, 폰트, 자동 잠금, 자동백업, Autofill 활성화 등)을 정의한다. 설정은 Zustand `useSettingsStore`가 관리하며, localStorage에 평문으로 persist된다.

## Context / Assumptions

### 현재 상태 (Current State)
앱 설정은 다음 저장 공간에 존재한다.

1. **Active 스토어 (Zustand `useSettingsStore`)**: 현재 앱 설정을 메모리 상에 유지한다. `partialize`를 통해 localStorage에 평문 persist된다.
2. **localStorage**: 테마, 폰트, 자동 잠금 설정 등이 평문으로 저장된다.

--|--
| 항목 | 현황 | 소스 |
|------|------|------|
| 설정 스토어 | `useSettingsStore` Zustand 스토어, `partialize`로 localStorage persist | `src/store/settingsStore.ts` |
| 자동 잠금 타입 | `none` / `1m` / `10m` / `30m` | `src/store/settingsStore.ts` `AutoLockTimeout` |
| 자동백업 | `autoBackupEnabled`, `autoBackupUri` 필드 존재 | `src/store/settingsStore.ts`, `src/persistence/vaultPersistence.ts` |
| Autofill 활성화 | `autofillEnabled` 필드 존재 | `src/store/settingsStore.ts` |
| 설정 persist | localStorage에 평문 저장 (암호화 아님) | `src/store/settingsStore.ts` |
| 자동백업 비활성화 | SAF URI 권한 해지 시 `vaultPersistence.saveVault`에서 `setAutoBackupEnabled(false)` 호출 | `src/persistence/vaultPersistence.ts` |

--|--

### 전제 조건 (Assumptions)
1. 타겟 플랫폼은 Android (API 26+) WebView 기반 Capacitor 앱이다.
2. 앱 설정은 암호화되지 않은 평문으로 localStorage에 저장된다 (민감 정보 아님).
3. 네트워크 전송은 전혀 발생하지 않음 (오프라인 전용).

## Functional Requirements

### FR-1: 설정 모델 정의
설정은 다음 필드를 가져야 한다.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `theme` | `"light" \| "dark"` | Y | 앱 테마 |
| `fontSize` | `FontSize` ("small" \| "medium" \| "large") | Y | 글자 크기 |
| `autoLockTimeout` | `AutoLockTimeout` | Y | 자동 잠금 시간 (none/1m/10m/30m) |
| `autofillEnabled` | boolean | Y | Android Autofill 서비스 활성화 여부 |
| `autoBackupEnabled` | boolean | Y | 자동백업 활성화 여부 |
| `autoBackupUri` | string \| null | N | 자동백업 대상 SAF URI |

### FR-2: 설정 조회 (Read)
**Given** 앱 설정이 로드된 상태  
**When** 설정 전체 또는 특정 키를 조회한다  
**Then** 설정 값을 반환한다.

### FR-3: 설정 수정 (Update)
**Given** 특정 설정 키가 존재한다  
**When** 설정 값이 수정된다  
**Then** 수정 후 localStorage에 즉시 persist된다.

### FR-4: 테마 설정
**Given** 사용자가 테마를 변경한다  
**When** `setTheme(theme)`가 호출된다  
**Then** 테마가 변경되며, document의 클래스에 즉시 적용된다.

### FR-5: 글자 크기 설정
**Given** 사용자가 글자 크기를 변경한다  
**When** `setFontSize(fontSize)`가 호출된다  
**Then** 글자 크기가 변경되며, document의 텍스트 사이즈 클래스에 즉시 적용된다.

### FR-6: 자동 잠금 시간 설정
**Given** 사용자가 자동 잠금 시간을 변경한다  
**When** `setAutoLockTimeout(timeout)`가 호출된다  
**Then** 자동 잠금 시간이 변경되어 localStorage에 persist된다.

### FR-7: Autofill 활성화 설정
**Given** 사용자가 Autofill 활성화를 변경한다  
**When** `setAutofillEnabled(enabled)`가 호출된다  
**Then** Autofill 활성화 상태가 변경되어 localStorage에 persist된다.

### FR-8: 자동백업 설정
**Given** 사용자가 자동백업을 활성화한다  
**When** `setAutoBackupEnabled(true)`와 SAF URI가 설정된다  
**Then** 자동백업이 활성화되며, 볼트 변경 시 외부 백업 파일에 미러링된다.

**Given** SAF URI 권한이 해지된다  
**When** `PERMISSION_REVOKED` 에러가 발생한다  
**Then** `vaultPersistence.saveVault`에서 자동 비활성화(`setAutoBackupEnabled(false)`)를 처리한다.

## Non-Functional Requirements

| 카테고리 | 요구사항 | 측정/검증 방법 |
|----------|----------|---------------|
| **보안** | 설정에는 민감 정보(PIN, 키, 계정 데이터)를 포함하지 않는다 | 코드 리뷰 |
| **오프라인 우선** | 네트워크 권한 미사용, 모든 설정 데이터 기기 로컬 저장 | 정적 분석, 빌드 검증 |
|| **TypeScript 개별 strict 플래그 준수** | ESM only, `@/` → `src/` import 경로 준수, `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch` 준수 | `npm run typecheck` |
| **테스트** | `npm run typecheck`, `npm run lint`, `npm run test` 모두 통과 | CI 검증 |

## Out of Scope (명시적 제외)
다음 항목은 본 앱 설정 스펙의 범위에 포함하지 않는다. 실제 구현이 존재하더라도 '나중에 구현 예정'으로 명시한다.

1. **암호화 볼트 데이터**: 별도 `vault-session`, `account-crud` 스펙 참조.
2. **Android Keystore / 생체인증 설정**: 별도 `android-security` 스펙 참조.
3. **클라우드 동기화 / 백업 서버**: 모든 데이터는 기기 로컬에만 저장.
4. **Android 네이티브(Kotlin) 코드**: 본 스펙은 React/WebView 측에 집중.

## Acceptance Criteria
이 spec이 완료됐다고 판단할 조건:

1. **AC-1**: 설정 모델(SettingsState)이 `src/store/settingsStore.ts`에 정의되고, 헌법 §3에 따라 개별 strict 플래그로 타입 안전성이 보장된다.
2. **AC-2**: `useSettingsStore`가 설정 조회/수정 연산을 모두 제공한다.
3. **AC-3**: 설정 변경 시 localStorage에 평문으로 persist된다.
4. **AC-4**: 자동백업 URI 권한 해지 시 `vaultPersistence.saveVault`가 자동 비활성화를 처리한다.
5. **AC-5**: `npm run typecheck`, `npm run lint`, `npm run test`가 모두 통과한다.

## Open Questions (미결정 사항 — 추측하지 않음)

| 항목 | 현황 |
|------|------|
- **설정 마이그레이션**: **결정 완료: 기본적으로 지원** (버전 업 시 기존 localStorage 설정과의 호환성 전략을 설정 스토어에 명시)
| **설정 값 검증 스키마**: **결정 완료: 도입** (설정 값 유효성 검증 스키마를 설정 스토어에 명시) |

--|--
## 참고 문서
- `CONSTITUTION.md` — 프로젝트 헌법, §5 보안 규칙, §8 위반 체크리스트
- `.hermes/specs/vault-persistence/specification.md` — Vault 저장 구조 아키텍처 (자동백업 연계)
- `src/store/settingsStore.ts` — `useSettingsStore` 구현
- `src/persistence/vaultPersistence.ts` — `saveVault` 자동백업 로직
--|--