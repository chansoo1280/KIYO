# Plan: AutofillE2ETest 독립성 리팩토링 — 환경 준비와 시나리오 분리

**Date:** 2026-08-25
**Branch:** `feature/autofill-reliability`
**Topic:** E2E 테스트 파일 생성(환경 준비)과 검증 시나리오의 분리 — 임의 조합 실행 가능

## 디버깅 워크플로우 (설계 의도)

테스터가 **고정 볼트 파일명을 지정**해서 실행한다:

```
# 1회: 준비 (파일명을 테스터가 지정 — 재사용 가능한 고정 이름)
run-autofill-e2e.ps1 -TestMethod prepareVault -VaultName debug-vault

# 이후 반복: 준비된 파일을 그대로 사용 (새 파일 생성 없이)
run-autofill-e2e.ps1 -TestMethod processDeathFill -VaultName debug-vault
```
> 참고: prepareVault은 sync를 하지 않는다. 각 검증 테스트가 자기 시나리오에 맞게 sync를 수행한다 (비암호화 최초 sync → PIN → 재동기화 재래핑 등).

- 테스트명은 간결한 시나리오명 사용: `prepareVault`(준비), `noAuthFill`, `authResync`, `processDeathFill`, `downgradeReset` — 번호·순서 의존 없음, 모든 테스트가 자기완결

- `ensureBaseEnvironment()`는 **지정된 파일명과 동일한 볼트가 이미 활성 상태인지 화면에서 확인**하고, 같으면 구축을 건너뛴다 → 새 파일이 계속 쌓이지 않음
- 파일명 미지정 시에만 유니크 이름 생성(기존 동작) — CI 전체 실행은 변경 없음
- 계정 정보도 볼트 파일명에서 결정적(deterministic)으로 도출 (`debug-vault` → username `user@debug-vault` 등) → 세션 간 sharedAccount 불일치 문제 원천 제거

## Goal

1. **환경 준비(볼트 생성 + 계정 생성 + autofill toggle ON + sync 포함)를 사전준비 전용 파일(`AutofillE2EPrepareTest.kt`)로 분리**한다.
2. 검증 시나리오(noAuthFill, authResync, processDeathFill, downgradeReset)는 **준비 상태가 있으면 그대로, 없으면 스스로 구축한 후** 실행 가능해야 한다 ("확인 후 구축" 패턴 표준화).
3. 다음 조합이 모두 동작해야 한다:
   - 전체 실행: 스크립트가 `PrepareTest`(prepareVault) 먼저, 이어서 `AutofillE2ETest`(나머지 4개)를 2회 instrument 호출 (클래스 내부 순서는 JUnit 기본 — 순서 의존 없음)
   - 개별 실행: 어느 테스트든 단독 실행 가능 (자기완결 — 환경/잠금화면/sync를 스스로 확보)
   - 스크립트: `-TestMethod <이름>` 단일 메서드 지정이 계속 동작

## Current State (문제)

`AutofillE2ETest.kt`(512줄)의 4개 테스트가 **암묵적 순서 의존**을 갖는다:

- 테스트 1(`autofillEnableSyncAndFill_unencryptedVault_noAuth`)이 볼트 생성 + 계정 생성 + autofill enable/sync까지 수행하며 그 결과를 companion static 필드(`initialized`, `sharedAccount`)로 이후 테스트에 전달
- setup()이 `initialized` 플래그로 두 벌 복사되어 있음 (91~101 vs 105~153)
- 테스트 단독 실행 시 사전 상태가 없어 실패 — 현재는 스크립트/수동 순서에만 의존
- 테스트명이 실행 순서(1→4)와 직관적으로 대응하지 않음 (`step3_`, `step4_`만 접두사 있음)
- 환경 조작(PIN set/clear, 프로세스 kill, 앱 재기동, logcat 읽기)이 테스트 메서드에 인라인

## Design: 두 레이어 분리

```
┌─ PreparationLayer (AutofillE2EPrepareTest.kt — NEW 파일) ── "사전준비" (테스트라기보다 픽스처)
│    prepareVault                     ← 볼트 생성+계정+autofill toggle ON (sync는 미포함)
│    ※ 단독 실행 가능한 진입점이자, 전체 실행 시 스크립트가 먼저 구동하는 사전준비
│
├─ ScenarioLayer (AutofillE2ETest.kt — 검증 시나리오만) ── "무엇을 검증하는가"
│    noAuthFill                       ← sync 실행 + no-auth fill 동작 확인
│    authResync                       ← auth-required 재래핑 검증
│    processDeathFill                 ← 인증 캐시 생존 검증
│    downgradeReset                   ← 다운그레이드 리셋 검증
│    ※ 모두 자기완결: 필요한 환경/잠금화면을 스스로 확보하고 finally에서 정리.
│      테스트 간 실행 순서 의존 없음 (@FixMethodOrder 제거)
│
├─ EnvironmentGuard (E2EEnv 오브젝트 — 두 테스트 클래스 공유)
│    ensureBaseEnvironment(): BaseEnv ← 볼트+계정+toggle 유무 화면 실측, 없으면 구축
│    ensureSynced()                   ← sync 버튼 클릭 (멱등)
│    ensureRewrapped()               ← 재래핑 멱등 수행 (단독 실행 대비)
│    ensureDeviceSecure(pin)          ← isDeviceSecure 실측, 없으면 setPin
│    state: rewrapped                 ← static volatile 필드 (전체 실행 시 중복 방지 힌트;
│    │                                    단독 실행 시엔 판단 없이 항상 멱등 수행)
│    ※ companion을 별도 오브젝트(예: E2EEnv)로 추출해 공유
│
└─ DeviceOpsHelper (신규 testutil) ── "기기 조작 프리미티브"
     setPin(pin) / clearPin(pin)      ← 기존 setDevicePin/clearDevicePin 이동
     killProcess(packageName): String pid
     readLogcat(lines: Int): String
     bringAppToForeground(pkg)        ← 재기동+WebViewReady 대기 포함
```

### 핵심 규칙

1. **모든 시나리오는 첫 줄에서 `ensureBaseEnvironment()` 호출.**
   - 이미 구축됐으면 **화면 실측(활성 볼트 파일명/헤더 텍스트)만으로 판별**해 즉시 통과
   - 없으면 기존 테스트 1의 준비 절차 중 **볼트 생성 → 계정 생성 → autofill toggle ON**까지만 수행한다. **동기화(sync)는 준비에 포함하지 않고 각 검증 테스트가 스스로 실행한다** (sync 시점이 시나리오 의미의 일부이므로). 특히 authResync/processDeathFill/downgradeReset은 **재래핑 전 최초 sync를 스스로 수행**해야 한다 — prepareVault은 더 이상 sync를 하지 않으므로, auth-required 재래핑은 "no-auth 상태에서 1회 이상 sync된 뒤"에만 의미 있게 발생하기 때문. (기존에는 prepareVault=구 step1이 sync까지 해줬으나, 분리 후 그 책임이 각 시나리오로 이동)
   - 반환된 `BaseEnv(account 정보)`를 사용 — `sharedAccount` 접근은 이 헬퍼 안으로 캡슐화
2. **순서 의존 제거**: 모든 테스트가 자기완결이므로 `@FixMethodOrder`/`stepN_` 접두사를 **제거**한다. 클래스 내 실행 순서는 JUnit 기본(무순서)으로 두고, 전체 실행 순서가 필요한 준비→검증 흐름은 스크립트의 2회 instrument 호출로 보장한다.
3. **볼트 파일명 불일치 규칙**: 활성 볼트의 화면 파일명이 지정 이름과 다르면 → 지정 이름으로 새 볼트를 생성한다. 기존(다른 이름) 볼트 파일은 **삭제하지 않고 그대로 둔다** (정리 책임은 테스터 — 목표는 "같은 이름 재실행 시 파일이 계속 쌓이지 않음"이지 자동 청소가 아님).
4. **잠금화면 PIN은 각 테스트가 자기완결적으로 관리**: 잠금화면이 필요한 테스트(authResync, downgradeReset 등)는 **시작 시 `KeyguardManager.isDeviceSecure` 실측 → 없으면 `setPin()`**, **종료 시(finally에서 성공/실패 무관) 기존 종료 처리와 동일하게 `clearPin()`으로 해제**한다. 테스트 간 PIN 상태 의존을 원천 제거하고, 단독 실행 후에도 기기가 항상 깨끗한 상태로 남는다.
   - 이에 따라 `pinSet` static 플래그는 불필요 — 실측으로만 판별
5. **상태 플래그는 최소한으로, 실측 우선**: static 플래그는 "이 instrumentation 세션에서 이미 했다"의 힌트일 뿐, 실제 상태는 가능한 한 실측으로 판별한다.
   - `rewrapped`: static 플래그 1개만 유지. 단, **단독 실행 시에는 판단 근거로 쓰지 않는다** — instrumentation 프로세스마다 초기화되므로, processDeathFill/downgradeReset 단독 실행 시에는 재래핑을 **항상 멱등 수행**한다. 플래그는 전체 실행(같은 프로세스)에서 중복 방지 힌트로만 사용
   - `prepared`: `ensureBaseEnvironment()`의 화면 실측으로 대체 — 플래그 불필요
6. **각 시나리오의 단독 실행 조건 (모두 자기완결, sync 포함)**:
   - prepareVault: 준비(볼트+계정+toggle ON)만 하고 끝 — **sync 미포함** (fill 검증은 noAuthFill 소관)
   - noAuthFill: `ensureBaseEnvironment()` 후 **sync 실행** + no-auth fill 검증
   - authResync: 잠금화면 확보(규칙 4) → **최초 sync(비암호화 상태, 멱등)** → PIN 설정 → **재동기화 sync(재래핑 유발)** → kill → fill → **finally에서 clearPin**
     - ※ 최초 sync가 이미 됐어도 재클릭은 무해(멱등) — 단독 실행/전체 실행 모두 동일 흐름
   - processDeathFill: 선두 ensureBaseEnvironment → **최초 sync(비암호화, 멱등)** → PIN 확보 → 재동기화 → **kill → 즉시 fill** (인증 캐시 신선도 확보를 위해 kill 직전 인증 이벤트를 테스트 내부에서 만듦 — debug 30초 유효시간 제약을 자기완결로 해결) → finally에서 clearPin
   - downgradeReset: 잠금화면 확보 → 최초 sync + 재래핑 선행(멱등) → 잠금화면 제거 → sync → reset 로그 확인 → **finally에서 clearPin**
   - ※ sync 버튼 클릭은 이미 동기화된 상태에서도 안전(멱등)해야 하며, 공유 헬퍼로 캡슐화

## Proposed Changes

**실행 순서 (구현 순서 ≠ 번호)**: #5(DeviceOpsHelper) → #9(공유 E2EEnv 오브젝트 추출) → #2(setup 통합) → #3/#4/#8(ensureBaseEnvironment 기반 재구성) → #7(ps1 계약) → #1(테스트명·파일 분리 — 스크립트·문서와 동시) → #6(반복 패턴 캡슐화)

| # | File | Component | Change | Reason |
|---|------|-----------|--------|--------|
| 1 | `AutofillE2ETest.kt` / `AutofillE2EPrepareTest.kt` (NEW) | 파일 분리 + 테스트명 | 기존 테스트1의 준비 부분(볼트+계정+toggle ON, **sync 제외**) → `AutofillE2EPrepareTest.prepareVault`; fill 검증 부분(sync 포함)은 검증 시나리오로서 `AutofillE2ETest.noAuthFill`에 배치; 기존 `resyncAfterDeviceCredentialAdded_authRequired` → `authResync`, 기존 step3/step4 → `processDeathFill`, `downgradeReset`. **모든 `stepN_` 접두사·`@FixMethodOrder` 제거**; 전체 실행 시 스크립트가 PrepareTest를 먼저 구동 (am instrument는 클래스 단위 실행이므로 2회 호출) | 사전준비(픽스처)와 검증 시나리오의 물리적 분리; sync는 시나리오 의미의 일부이므로 각 테스트 소관 |
| 2 | `AutofillE2ETest.kt`, `AutofillE2EPrepareTest.kt` | setup() | 중복 초기화 블록을 `bindFreshInstances()` 하나로 통합; `initialized` 플래그 분기 축소 (두 클래스가 공유 오브젝트 사용) | 두 벌 복사 제거 |
| 3 | `E2EEnv`(신규 오브젝트, testutil) | 신규 `ensureBaseEnvironment(vaultName): AccountInfo` | 지정 파일명의 볼트가 활성 상태인지 화면 실측(파일명/헤더 텍스트) → 동일하면 건너뛰고, 없으면 준비 절차 수행, **이름이 다르면 지정 이름으로 새 볼트 생성(기존 파일 보존)** (핵심 규칙 3). 기존 테스트1의 companion 상태(`initialized`, `sharedAccount`)를 이 오브젝트로 이동 | 두 테스트 클래스가 환경 가드를 공유 |
| 4 | 각 테스트 첫 줄 | `val account = ensureBaseEnvironment(vaultName)` 로 시작하도록 통일 (vaultName은 instrumentation extra에서 읽음; 미지정 시 유니크 이름 생성 — CI 동작 유지) | prepareVault 없이도 나머지 테스트 단독 실행 가능 |
| 5 | `testutil/DeviceOpsHelper.kt` (NEW) | 위 Design 표의 프리미티브 | 기존 setDevicePin/clearDevicePin/bringKiyoAppToForeground/PID kill/logcat read를 이동 | 테스트 메서드에서 환경 조작 노이즈 제거, 재사용 |
| 6 | 양쪽 테스트 클래스 | 반복 패턴 | `recoverAppToForegroundReady()`, auth dataset 탭→PIN keycode→드롭다운 대기 시퀀스, **PIN set/clear finally 래퍼**를 공유 헬퍼로 캡슐화 | "검증됨 2026-08" 교훈(재클릭 금지 등) 한 곳에 응집 |
| 7 | `run-autofill-e2e.ps1` | 파라미터 | `-VaultName` 파라미터 신설 → instrumentation extra(`-e vaultName <이름>`)로 전달. **전체 실행 시 PrepareTest 먼저 → AutofillE2ETest 순으로 2회 instrument 호출**. 시작/종료 PIN 자동 처리 제거(테스트 내부 관리로 대체). 주석/예시에 새 테스트명·VaultName 반영. `-TestMethod`는 am instrument 문법상 단일 메서드만 지원 (제약 문서화) | 스크립트-테스트 계약 동기화 |
| 8 | `E2EEnv` | 신규 `ensureSynced()` / `ensureRewrapped()` | `ensureSynced()`: autofill 화면의 sync 버튼 클릭(멱등 — 이미 동기화돼도 안전). `ensureRewrapped()`: PIN 확보 후 재동기화 멱등 수행. noAuthFill/authResync/processDeathFill/downgradeReset이 각자 호출 — sync는 준비가 아니라 각 테스트의 소관 | 자기완결 보장의 핵심 프리미티브 |
| 9 | `E2EEnv`(또는 별도 오브젝트) | companion 상태 추출 | 기존 `AutofillE2ETest` companion의 static 필드/헬퍼를 공유 오브젝트로 이동해 두 테스트 클래스에서 접근 | 파일 분리 시 상태 공유 보장 |
| 10 | `AutofillSyncManager.kt` | **프로덕션 수정** — sync 시 `DatabaseKeyManager.getKey(context)` 강제 호출 | `KiyoAutofillPlugin.ensureRepositoryInitialized()`가 리포지토리를 캐싱하여, PIN 추가 후 첫 sync에서 `getKey()`가 호출되지 않고 재래핑이 누락되는 버그 수정. getKey()는 멱등이라 중복 호출 안전. | 프로덕션 코드 버그 수정 (테스트 과정에서 발견) |

**변경하지 않는 것**: pageobjects(HomePage 등), 프로덕션 코드, WebViewTestHelper, 타이밍 민감 로직(35초 대기, 30초 budget), BiometricPrompt keycode 입력 방식.

## Tests

| 항목 | 방법 | Pass 기준 |
|------|------|----------|
| 전체 회귀 | `npm run test:e2e:android` | 5/5 green (PrepareTest: prepareVault, AutofillE2ETest: noAuthFill/authResync/processDeathFill/downgradeReset) |
| prepare 단독 | `run-autofill-e2e.ps1 -TestMethod prepareVault` | green, fill 검증 없이 준비만 수행하고 종료 |
| noAuthFill 단독 (기존 파일 재사용) | `-TestMethod noAuthFill -VaultName debug-vault` | green, 새 볼트 파일 생성 없이 기존 `debug-vault` 사용 |
| authResync 단독 | `-TestMethod authResync -VaultName debug-vault` | green — 잠금화면 확보 → sync(재래핑) → kill → fill, finally에서 PIN 해제 |
| processDeathFill 단독 (기존 파일 재사용) | `-TestMethod processDeathFill -VaultName debug-vault` | green, 새 볼트 파일 생성 없이 기존 `debug-vault` 사용 |
| prepare 단독 반복 | `-TestMethod prepareVault -VaultName debug-vault` 2회 연속 | 두 번째 실행은 기존 파일 인식하고 구축 건너뜀 |
| downgradeReset 단독 | `-TestMethod downgradeReset -VaultName debug-vault` | green — 재래핑 항상 멱등 선행 후 reset 로그 확인 |
| JVM 빌드 | `./gradlew :app:compileDebugAndroidTestKotlin` | compile clean |

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| 리팩토링 중 타이밍/sleep 구조 변경으로 flaky 재발 | E2E 신뢰성 저하 | sleep 값과 순서 그대로 이동만 허용; 구조 변경 금지. 3회 연속 실행으로 검증 |
| downgradeReset 단독 실행 시 auth-required 키가 아니라 reset이 발화 안 함 | 오탐(fail 아님, 미검증) | ✅ 해결: downgradeReset은 재래핑을 **항상 멱등 선행 수행** (Open Questions #1 결정). static 플래그는 전체 실행 시 중복 방지 힌트로만 사용 |
| 클래스 분리로 전체 실행이 2회 instrument 호출이 되어 세션 간 상태 단절 | 나머지 테스트가 준비 상태를 못 찾을 수 있음 | 모든 테스트가 자기완결(ensureBaseEnvironment 화면 실측) — 프로세스 경계와 무관하게 동작. Tests의 각 단독 실행 항목으로 검증 |
| static 플래그와 실제 기기 상태 불일치 (외부에서 PIN 제거 등) | 잘못된 skip | 판별을 모두 실측(isDeviceSecure, 화면 텍스트)으로 — 플래그는 재래핑 1개만 |
| 테스트명 변경으로 기존 문서/위키 불일치 | 혼란 | run-autofill-e2e.ps1 주석 + .hermes.md E2E 섹션 갱신 포함 |

## Rollback

커밋 단위 되돌리기. 테스트 코드 전용 변경이므로 프로덕션 영향 없음. 기존 테스트명은 git history로 보존.

## Security Invariants

**원칙 위반 기록 (2026-08-26 업데이트)**: 본 계획은 "프로덕션 코드 변경 없음"을 전제했으나,
독립성 리팩토링 과정에서 테스트 assertion을 실측 기반으로 강화하면서 프로덕션 결함 3건이 발견되었고
수정이 불가피했다. 각 변경의 근거는 아래 "Plan 외 프로덕션 변경 내역(E2E 과정 발견)" 참조.
Keystore/DB_KEY/인증 흐름의 **보안 속성 자체는 불변**이다 (유효시간, auth-required 조건, 리셋 정책 무변경).

## Plan 외 프로덕션 변경 내역 (E2E 강화 과정 발견, 2026-08-26)

| # | File | 변경 | 발견 경위 | 근거 |
|---|------|------|-----------|------|
| 1 | `AutofillSyncManager` + `KiyoAutofillPlugin` + `DatabaseKeyManager` | 보안 리셋 후 캐시된 repository 폐기 (`invalidateRepository` 콜백 + `wasStateReset()` 1회성 플래그) | downgradeReset: 리셋 직후 재구축 sync가 `SQLiteReadOnlyDatabaseException`(죽은 파일 핸들에 대한 DELETE)으로 실패. **기존 step4는 로그 문자열+정적 텍스트만 검증해서 미발견** | 리셋이 DB 파일·키를 삭제해도 열린 SQLCipher 커넥션은 예전 키 세션에 남는다 → 재생성 필수 |
| 2 | `KeystoreManager.createKey()` 신설 (사용자 추가, 리팩토링: `loadKeyStoreEntry` 헬퍼 통합) | 재래핑 시 새 auth-required 키 생성 전용 API. getOrCreateKey와 중복 본문 통합 | rewrapDbKey에서 getOrCreateKey 재사용 시 "키가 이미 있으면 생성 생략" 분기가 재래핑 의미와 충돌 | 키 생성 정책(30s debug/30min release, 잠금화면 분기)은 generateNewKey 단일 지점에서 적용되므로 보안 속성 불변 |
| 3 | `DatabaseKeyManager.getKey()` — 재래핑 try/catch(fallback) 제거 확정 | 재래핑 실패 예외를 삼키지 않고 전파 | 사용자 지적: catch가 `UserNotAuthenticatedException`을 삼키면 fill/sync 경로의 **사용자 인증 요청이 발화하지 않음** | 인증 프롬프트 유발은 이 테스트 스위트의 핵심 검증 대상 — 예외 전파는 계약 |
| 4 | `AutofillSection.tsx` showMessage 렌더링 | no-op였던 showMessage를 화면 `<p>` 표시로 구현 | 수동 점검 중 발견 (사용자 지시) | sync 결과의 사용자 피드백 부재 + E2E가 성공 메시지로 sync 완료를 명시 검증할 수 있게 됨 |

### 교훈 (compound)
- "프로덕션 무변경" 원칙은 **기존 테스트 assertion 강도를 전제**한 것이었다. assertion을 실측(UI 메시지, DB 상태, 예외 전파)으로 강화하는 순간 숨은 결함이 드러난다.
- Keystore 인증 캐시 실험 결과(2026-08): ① 앱 프로세스 사망 시 인증 캐시 소멸(시간 경과와 무관) ② setPin 직후에는 크리덴셜 등록 자체가 인증으로 인정되어 즉시 재래핑해도 프롬프트 미발화 → 재래핑 유발엔 시간 경과, fill 만료엔 kill.
- processDeathFill 시나리오("명시적 인증 없는 재래핑 후 kill 생존")는 현 Keystore 설계에서 성립하지 않아 삭제하고 authResync에 통합함.

프로덕션 코드 변경 없음. Keystore/DB_KEY/인증 흐름 무변경. 테스트가 기기 PIN을 설정하는 행위는 기존과 동일 (에뮬레이터 전용).

## Open Questions (결정 완료 2026-08-25)

1. **downgradeReset 단독 실행 정책** → ✅ **결정**: downgradeReset 내부에서 재래핑 절차 선행. 단, `-TestMethod` 단독 실행 시마다 새 instrumentation 프로세스가 떠서 static 플래그(`rewrapped`)는 초기화되므로 **단독 실행 시에는 판단 없이 항상 재래핑을 멱등 수행** (플래그는 전체 실행 시 중복 방지 힌트로만 사용).
2. **준비 테스트의 fill 검증 포함 여부** → ✅ **결정: 분리**: prepareVault은 준비만 전담하고, fill 검증은 `AutofillE2ETest.noAuthFill`로 분리.
3. **잠금화면 PIN 관리** → ✅ **결정 (2026-08-25)**: 스크립트 레벨 set/clear가 아니라 **각 테스트가 자기완결적으로 관리** — 시작 시 `isDeviceSecure` 실측 후 필요하면 `setPin()`, 종료 시 finally에서 `clearPin()` (핵심 규칙 4). run-autofill-e2e.ps1의 기존 시작/종료 PIN 자동 처리는 제거 또는 no-op으로 정리 대상.

## Verification Structure

| 항목 | Status | 근거 |
|------|--------|------|
| 전체 5/5 green (prepareVault + noAuthFill/authResync/processDeathFill/downgradeReset) | ⬜ | `npm run test:e2e:android` 실행 로그 |
| prepareVault/noAuthFill/authResync/processDeathFill 단독 green (기존 파일 재사용) | ⬜ | `-TestMethod … -VaultName debug-vault` 각 실행 + 새 볼트 파일 미생성 확인(화면 파일 리스트) |
| downgradeReset 단독 green (재래핑 선행 포함) | ⬜ | `-TestMethod downgradeReset -VaultName debug-vault` 실행 + reset 로그 라인 확인 (`adb logcat -d \| grep DatabaseKeyManager`) |
| 컴파일 clean | ⬜ | `./gradlew :app:compileDebugAndroidTestKotlin` exit 0 |
| 스크립트·문서 동기화 | ⬜ | run-autofill-e2e.ps1 주석 예시 + .hermes.md E2E 섹션에 새 테스트명·-VaultName 반영 |
