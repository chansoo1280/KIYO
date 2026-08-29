# Plan: Biometric Vault Unlock Verification

**Date:** 2026-08-26 (rewrite of 2026-08-24 autofill-auth-ux plan)
**Branch:** `feature/autofill-reliability`
**Related:** STRATEGY.md Track 1 — 자동완성 신뢰도
**Topic:** 생체인증(지문) 볼트 잠금 해제 전체 흐름 검증 + 신규 생체인증 E2E 추가

## Goal

생체인증 볼트 언락의 **저장(storeKey) → 잠금 해제(unlockKeyWithBiometric) → 실패/취소 폴백 → 키 삭제** 전체 수명주기가 실제 기기 동작과 일치하는지 검증한다. 핵심 산출물은 **신규 생체인증 E2E 테스트(`BiometricUnlockE2ETest`)** 이며, 코드 변경은 결함 발견 시 최소한으로만 수행한다.

## Current Implementation Under Verification (변경 대상 아님 — 검증 대상)

| 구성 요소 | 파일 | 역할 |
|---|---|---|
| 키 저장 | `src/pages/Settings/components/SecuritySection.tsx:104` (`handleBiometricSetupConfirm`) | cryptoKey → base64 export → `SecureKey.storeKey(vaultId, key)` |
| Keystore 저장 | `android/.../securekey/BiometricAuthHelper.kt:44` (`storeKey`) | Cipher.init(ENCRYPT) + CryptoObject → 생체인증 성공 시 암호화 → `kiyo_secure_prefs` SharedPreferences 저장 |
| 언락 UI | `src/pages/Auth.tsx:87` (`handleBiometricLogin`) | `hasKey`+`isBiometryAvailable` 조건부 버튼 표시 → `unlockKeyWithBiometric` |
| Keystore 언락 | `BiometricAuthHelper.kt:115` (`unlockKeyWithBiometric`) | Cipher.init(DECRYPT, IV) + CryptoObject → 성공 시 base64 key 반환 |
| 세션 복원 | `Auth.tsx:107` (`setCryptoKeyFromBase64(key, salt)`) | React cryptoKey 재구성 후 `/accounts` 진입 |
| 키 삭제 | `SecuritySection.tsx:93` (`deleteKey`) | 생체인증 비활성화 |

보안 속성 (변경 금지): `kiyo_secure_master_key`(autofill용 `kiyo_master_key`와 분리), `BIOMETRIC_STRONG` only, `setInvalidatedByBiometricEnrollment(true)`, IV+ciphertext만 prefs 저장.

## Changes

> 구현 순서: ① Page Object/E2EEnv 확장 → ② BiometricUnlockE2ETest 작성 → ③ 실행 스크립트(호스트 협력 주입 포함) → ④ 실행·검증. ②가 ①의 메서드에, ③이 ②의 logcat 마커 프로토콜에 의존하므로 번호 순서 = 실행 순서.

### 1. Page Object / E2EEnv 확장 (선행 작업)

지문 잠금 해제는 **볼트가 암호화된 경우에만** 의미 있음(`Auth.tsx`는
`fileTable.getActiveFileInfo().encrypted`일 때만 생체인증 버튼 노출). 따라서
생체인증 E2E는 암호화 볼트를 전제로 하며, 기존 인프라는 비암호화 볼트 기준이라
다음 보강이 필요하다.

**파일:** `android/app/src/androidTest/java/com/kiyo/app/autofill/pageobjects/SettingsPage.kt`

기존 패턴 준수(`clickSyncAccountsWithPinAuth`의 키코드 방식, `helper` 유틸 사용):

1. `ensureEncryptedVault()` — **Auth 페이지 도달 여부로 빠른 경로 판정**:
   Auth.tsx는 `activeFileName && encrypted`일 때만 Auth 화면에 머무르고
   비암호화면 홈으로 이동하므(Auth.tsx:23-27), **"Auth 페이지에 있다 = 활성
   암호화 볼트 존재"가 보장된다.** Auth 페이지면 createEncryptedVault 스킵.
   아니면 `VaultCreateDialog.createEncryptedVault(fileName, TEST_PIN)`으로 생성
   (테스트마다 고유 vaultName 사용).
   ⚠️ 단, Auth 페이지 감지는 "볼트 존재" 판정일 뿐 — 생체인증 활성화(Settings)
   은 언락된 cryptoKey가 필요하므로(SecuritySection.tsx:105 "PIN으로 먼저
   잠금 해제하세요") 시나리오 1은 PIN 입력으로 1회 언락 후 진행한다.
   ⚠️ 참고: KIYO에는 볼트 암호화를 **해제**하는 기능이 없다 (`changePin`은
   평문→암호화 / PIN→PIN 변경만 지원, fileStorage.ts:510). 이번 계획에서는
   **신규 생성(①) 경로만 사용**한다 — 테스트마다 고유 vaultName을 쓰므로 충분.
   (비암호화 잔여 볼트에 changePin으로 암호화 전환하는 ② 최적화는
   E2E 테스트 최적화 시 후속 과제로 미룸)
2. `enableBiometric()` — Security 섹션의 생체인증 활성화 버튼 클릭 →
   **프롬프트 대기 후 logcat 마커 출력**(아래 "지문 주입 아키텍처" 참조) →
   성공 메시지("생체인증이 활성화되었습니다.") 확인
3. `disableBiometric()` — "비활성화" 클릭 → "저장된 키가 삭제되었습니다." 메시지 확인.
   각 테스트 finally에서도 호출해 biometric 키 정리 (스크립트에서 직접 삭제 불가 —
   deleteKey는 Capacitor bridge 경로이므로)
4. `lockVaultAndReturnToAuth()` — 앱을 백그라운드 → Auth 화면 진입 확인 ("KIYO 잠금 해제" 헤더)
5. `tapBiometricLoginButton()` — Auth 화면의 지문 버튼(Fingerprint 아이콘 + "지문으로 로그인") 클릭
6. `awaitFingerprintInjection(marker: String)` — logcat에 고유 마커 출력 후,
   호스트가 `adb -e emu finger touch`를 보낼 시간 동안 대기(완료 신호는 인증 결과로 판단)

**파일:** `androidTest/.../testutil/E2EEnv.kt`
- 암호화 볼트 ensure 경로 추가 (encrypted=true 변형 — 기존 `ensureBaseEnvironment`는
  `createVault(vaultName, encrypted = false)` 하드코딩)

**전제 조건**: 기기 PIN이 설정되어 있어야 생체인증 등록 가능 (`DeviceOpsHelper.setPin`).
기기 자격증명/지문은 **스크립트 생애주기로 관리**한다 — PIN 제거 시 등록 지문도
함께 소멸하는 프레임워크 동작 때문에 테스트별 clearPin은 하지 않는다.

| 단계 | 작업 |
|---|---|
| 스크립트 setup (1회) | `setPin` → 지문 등록 (이미 등록돼 있으면 재사용/스킵) |
| 각 테스트 finally | **disableBiometric만 수행** (Settings 진입 → 생체인증 사용 안함 → biometric 키 삭제). 호스트에서 deleteKey 직접 호출 불가. clearPin 안 함 |
| 스크립트 종료 (모든 테스트 후, 1회) | clearPin — 마지막 자격증명 제거로 등록 지문도 함께 소멸, 깨끗한 종료 |

### 2. 신규 E2E: `BiometricUnlockE2ETest.kt`

**파일:** `android/app/src/androidTest/java/com/kiyo/app/biometric/BiometricUnlockE2ETest.kt`

기존 `AutofillE2ETest` 인프라 재사용: `E2EEnv`, `WebViewTestHelper`, `DeviceOpsHelper`,
failure watcher(screenshot/hierarchy dump), 자기완결 + finally 정리 패턴.

**⚠️ 실행 방식 제약 — 반드시 `run-biometric-e2e.ps1`로 실행:**

이 테스트들은 기기 PIN + 등록된 지문을 **스크립트 setup 전제**로 한다
(기기 자격증명은 스크립트 생애주기로 관리 — 위 표 참조). 스크립트 없이
`gradle connectedAndroidTest` 단독 실행 시 환경이 없어 실패한다. 이를 조용한
실패가 아니라 즉각적·명시적 실패로 만들기 위해 모든 테스트의 `@Before`에 가드 추가:

```kotlin
@Before
fun requireScriptEnvironment() {
    val km = context.getSystemService(KeyguardManager::class.java)
    assertTrue(
        "이 테스트는 run-biometric-e2e.ps1(또는 동등한 setup: setPin+지문등록)을 " +
            "통해 실행되어야 합니다",
        km.isDeviceSecure,
    )
}
```

- 테스트 클래스 KDoc 최상단에도 `run-biometric-e2e.ps1` 실행 안내 명기

**에뮬레이터 지문 자동화 (전제 조건 + 원리):**

> **왜 에뮬레이터에서 지문이 가능한가:** Android Emulator는 가상 fingerprint HAL을 제공한다.
> 실제 센서/손가락이 필요 없다. `adb -e emu finger touch 1`은 가상 HAL에
> "등록된 fingerprint ID 1 인증 성공"을 전달하고, 이것이 BiometricPrompt의
> `onAuthenticationSucceeded()`로 이어진다. 등록(enrollment)도 실제 손가락 스캔 없이
> 에뮬레이터의 가상 biometric 환경에 enrollment 레코드를 만드는 것일 뿐이다.

- ⚠️ `emu finger enroll`은 공식 emulator console 명령이 **아니다**. 지문 등록은
  **테스트 시작 전 스크립트 setup 단계에서 1회 수행한다**: 설정 앱의
  등록 화면(Settings → Security & privacy → Device unlock → Fingerprint,
  또는 `ACTION_FINGERPRINT_ENROLL` intent로 직접 호출)을 운전하는 도중에
  `adb -e emu finger touch <fingerId>`를 반복 전송하면 각 터치가
  "스캔 1회"로 처리되어 enrollment가 완료된다. 등록 완료 판정:
  설정 화면에서 등록된 지문 항목 존재 실측.
- 인증 성공 주입(테스트 중): 프롬프트 표시 상태에서 `adb -e emu finger touch <fingerId>`
  흐름: finger touch → 가상 Fingerprint HAL → BiometricPrompt → onAuthenticationSucceeded
- 취소 주입: 프롬프트 음성/버튼 탭 또는 `KEYCODE_BACK`
- ⚠️ 알려진 제약(autofill E2E와 동일): BiometricPrompt 창은 접근성 트리에 노출되지 않음 → 프롬프트 존재 확인은 logcat(`BiometricPrompt` 태그) 또는 화면 스냅샷 픽셀로 우회

**지문 주입 아키텍처 (호스트-기기 협력):**

> `emu finger touch`는 adb 클라이언트가 에뮬레이터 콘솔로 전달하는 **호스트 측 명령**이다.
> 기기 내부 shell에는 `emu` 명령이 없으므로 `uiAutomation.executeShellCommand()`로는
> 실행할 수 없다. 따라서 주입은 반드시 호스트(ps1 스크립트)에서 수행하며, 타이밍 맞춤은
> 다음 프로토콜로 한다:
>
> 1. 테스트(기기)가 프롬프트 표시를 확인한 뒤 logcat에 고유 마커 출력
>    (예: `BIOMETRIC_E2E: AWAIT_FINGER <scenario>-<seq>`)
> 2. 호스트 ps1이 logcat을 폴링하다가 마커를 감지하면 `adb -e emu finger touch 1` 전송
>    (취소 시나리오는 `BIOMETRIC_E2E: CANCEL_FINGER` 마커에 back 키 전송)
> 3. 테스트는 인증 결과(성공 메시지/오류 메시지)로 완료를 판단 — 타이밍 가정 없음
> 4. 마커 감지 타임아웃(예: 30초) 시 호스트가 실패 처리

**에뮬레이터 vs 실기기 검증 경계:** 에뮬레이터의 가상 HAL은 biometric API 레벨의
동작만 검증한다. 실기기의 fingerprint 센서·TEE·Keystore 통합 동작(특히
CryptoObject 바인딩 하드웨어 경로)은 별개이며, Android 공식 문서도 최종 확인은
실기기를 권장한다. 따라서 본 계획은 "에뮬레이터 = E2E 자동화 / 실기기 = 최종 통합
검증(별도 일정)"으로 나눈다.

**시나리오 (각 테스트 자기완결, 순서 의존 없음):**

| # | 테스트 | 절차 | 검증 |
|---|---|---|---|
| 1 | `storeKey_enrollsBiometricProtection` | 암호화 볼트 준비 → 설정 > Security > 생체인증 활성화 → 프롬프트 통과 | 활성화 성공 메시지 표시, `hasKey == true`, 앱 재시작 후 Auth 화면에 지문 버튼 노출 |
| 2 | `unlockWithBiometric_restoresSession` | 암호화 볼트 준비 + 생체인증 활성화(공통 헬퍼 `setupBiometricVault()`) → 앱 잠금(프로세스 유지, Auth 화면 진입) → 지문 버튼 탭 → 프롬프트 통과 | `/accounts` 진입 + 실제 계정 목록 렌더링 (세션/cryptoKey 정상 복원 증명) |
| 3 | `cancelBiometric_fallsBackToPin` | `setupBiometricVault()` → 지문 버튼 탭 → 프롬프트 취소 | 오류 메시지("PIN으로 로그인해 주세요") 표시 + PIN 입력으로 정상 언락 |
| 4 | `deleteKey_disablesBiometricButton` | `setupBiometricVault()` → 생체인증 비활성화 → Auth 화면 재진입 | `hasKey == false`, 지문 버튼 미노출, PIN만 표시 |

(모든 시나리오는 `ensureEncryptedVault`로 시작. "#N 상태 구축"은 테스트 간 의존이 아니라
각 테스트가 독자적으로 호출하는 공통 헬퍼 함수를 뜻함 — 순서 의존 없음)

### 3. E2E 실행 스크립트 확장

**파일:** `android/run-autofill-e2e.ps1` (또는 병렬 신규 `run-biometric-e2e.ps1`)
- 시작 시(setup): 기기 PIN 설정(`setPin`) + 에뮬레이터 지문 하드웨어 확인 +
  **지문 등록** — 이미 등록돼 있으면 재사용(스킵), 없을 때만 설정 앱 지문 등록 화면
  운전 중 `adb -e emu finger touch <fingerId>` 반복 전송, 등록 항목 존재 실측으로
  완료 판정. (테스트 본문은 등록 없이 인증 주입만 사용)
- 실행 중: logcat 폴링 → `BIOMETRIC_E2E:` 마커 감지 시 `adb -e emu finger touch 1` 전송 (위 프로토콜)
- 종료 시: clearPin 1회 — 마지막 자격증명 제거로 등록 지문도 함께 소멸.
  biometric 키(KIYO 앱 상태) 정리는 각 테스트 finally의 `disableBiometric()`이 담당
  (deleteKey는 Capacitor bridge 경로라 호스트에서 직접 호출 불가)
- `-TestClass BiometricUnlockE2ETest` 필터 추가

### 4. 결함 수정 (발견 시에만)

검증 중 발견되는 결함만 수정하며, 각 수정은 원인 분석 문서화 + 대응 테스트 반복 실행으로 검증. 사전 리팩토링 없음.

### 수정 필요 파일 목록 (요약)

| 파일 | 변경 유형 |
|---|---|
| `androidTest/.../pageobjects/SettingsPage.kt` | 확장: ensureEncryptedVault/enableBiometric/disableBiometric/잠금→Auth 진입/지문 버튼 탭/마커 출력 |
| `androidTest/.../testutil/E2EEnv.kt` | 확장: 암호화 볼트 ensure 경로 (encrypted=true) |
| `androidTest/.../biometric/BiometricUnlockE2ETest.kt` | 신규 (시나리오 1~4 + 스크립트 전제 가드 @Before) |
| `run-biometric-e2e.ps1` 또는 기존 ps1 확장 | 신규/확장: HAL 확인 + logcat 마커 폴링 + `finger touch` 주입 + `-TestClass` 필터 |

## Tests — Verification Matrix

| 검증 항목 | 방법 | 명령/단계 |
|---|---|---|
| 시나리오 1~4 | Android Instrumentation | `npm run test:e2e:android:fast` + `-TestClass BiometricUnlockE2ETest` |
| 기존 autofill 회귀 없음 | 기존 E2E 2개 | `npm run test:e2e:android:fast` (AutofillE2ETest green 유지) |
| 웹 유닛 회귀 없음 | vitest | `npm run check` |
| storeKey/unlockKeyWithBiometric 로직 | ❌ JVM 불가 (Keystore·BiometricPrompt·FragmentActivity 필요) → E2E로 대체 | 위 Instrumentation 행 |

## Verification Criteria

- [ ] `BiometricUnlockE2ETest` 4개 시나리오 모두 green
- [ ] `AutofillE2ETest` 기존 2개 green (회귀 없음)
- [ ] `npm run check` green

## Follow-up (이번 범위 제외)

| 항목 | 내용 | 이유 |
|---|---|---|
| 시나리오 5 분리: `newFingerprintEnrollment_invalidatesStoredKey` | 에뮬레이터 설정 앱의 지문 등록 UI를 UIAutomator로 자동 운전해야 함 — 기기/버전별 설정 화면 차이 리스크가 커서 본체 E2E 안정화와 분리 | 후속 계획에서 별도 구현. 먼저 시나리오 1~4 green 확인 |
| E2E 암호화 볼트 준비 최적화 (② 경로) | 비암호화 잔여 볼트를 `changePin(TEST_PIN)`으로 전환하는 재사용 경로 추가 — 현재는 매번 신규 생성(①)만 사용 | E2E 테스트 최적화 시 별도 작업 |
| 실기기 통합 검증 (Face 포함) | 에뮬레이터 가상 HAL은 실기기 센서·TEE·Keystore 통합 경로를 대변하지 못함 — 자동 E2E 완료 후 별도 검증 필요 | 별도 일정 |

## 검증 중 발견 결함/교훈 (2026-08-27)

### D1. 깨진 지문 등록(껍데기 레코드) 오판 — 스크립트 수정됨

**현상**: 이전 세션의 잔여 등록이 `fingerprint_enrolled_user_keys=1`로 남아 있었으나
`dumpsys fingerprint` 실측 시 `prints:[{"id":0,"count":0,"accept":0,"acquire":0,...}]` —
유효 스캔이 전혀 없는 **깨진 껍데기 등록** 상태였다. 사용자가 직접 잠금 화면에서
"지문이 아니라 PIN을 요구한다"고 제보하여 발견.

**원인**: `Test-FingerprintEnrolled`가 settings 키만 보고 판정 → 깨진 등록도
등록돼 있다고 오판 → `Invoke-FingerprintEnrollment` 스킵 → 지문 인증 불가 상태로
시나리오 진입 실패 예정이었음.

**복구 절차 (실측 완료)**:
1. `locksettings clear --old <pin>` → 자격증명 제거 (깨진 등록도 프레임워크가 소멸)
2. `locksettings set-pin <pin>` 재설정
3. Settings 앱에서 잔여 Fingerprint 항목 경유 재등록:
   `am start -a android.settings.FINGERPRINT_ENROLL` → PIN 재확인(`input text` + ENTER)
   → Pixel Imprint MORE/I AGREE (탭 911,2266 반복) → "Touch the sensor" 도달
   → `adb emu finger touch 1` ×8회 (1.2s 간격) → "Fingerprint added" 확인 → DONE
4. 건강성 검증: `dumpsys fingerprint` prints JSON에 `"count">0` 확인 +
   실제 언락 실측(화면 끔→wake→`emu finger touch`→`isKeyguardShowing=false`)

**스크립트 대응 (run-biometric-e2e.ps1)**: `Test-FingerprintEnrolled`를
settings 키 + `dumpsys fingerprint` prints JSON(`"count":N`) 병합 판정으로 교체.
settings 키만 있고 dumpsys count==0이면 미등록으로 간주해 재등록 플로우 진입.

**알려진 제약**: `"count"`의 정확한 의미(acquisition 수 vs 등록 인식 수)는
플랫폼 버전별로 다를 수 있어 보수적 휴리스틱이다. false-positive(깨진데도 통과) 가능성은
낮지만, 등록 직후 count가 0인 변형 환경이 나오면 이 함수 재점검이 필요하다.
동일 에뮬레이터 스냅샷을 오래 재사용하는 경우 특히 주의.

### D2. watcher 정규식 콜론 버그 — 스크립트 수정됨

`Start-FingerprintWatcher`의 마커 정규식이 `$tag\s+...`였는데 logcat 출력은
`BIOMETRIC_E2E: <marker> AWAIT_FINGER`처럼 태그 뒤 **콜론**이 붙어 매칭이
절대 실패 → 지문 주입이 한 번도 일어나지 않았다. `$tag`:?\s+`로 수정.

### D2b. watcher 마커 유실 — 스크립트 수정됨

watcher가 마커 처리 후 `logcat -c`로 버퍼를 비웠는데, `-d`(읽기)와 `-c`(클리어)
사이에 출력된 새 마커가 유실될 수 있다 (실측: 활성화 AWAIT 마커 처리 직후
뒤이은 CANCEL 마커가 유실 — 시나리오 3이 호스트 BACK 주입을 못 받고 타임아웃).
→ 버퍼 클리어 폐기, 마커 id(시나리오별 고유값) 해셋으로 중복 처리만 방지.
버퍼를 안 지우면 폴링 사이 로그가 사라지지 않고, 링 버퍼가 넘쳐 오래된 마커가
밀려나도 이미 처리된 것이라 무시하면 된다.

### D3/D4. BiometricAuthHelper 크래시 2건 — 앱 코드 수정됨

**D3 메인 스레드 위반**: `BiometricPrompt.authenticate()`는 Fragment 트랜잭션을
실행하므로 메인 스레드 전용. `Dispatchers.IO` 코루틴에서 직접 호출해
`IllegalStateException: Must be called from main thread of fragment host` 발생.
→ `authenticate()` 호출을 `withContext(Dispatchers.Main)`으로 감쌈.

**D4 "Crypto primitive not initialized"**: Keystore2에서 `cipher.init()`이
`UserNotAuthenticatedException` 없이 성공해도 op handle이 지연 생성/정리되어
`BiometricPrompt.authenticate(CryptoObject)` 시점에 `getOpId()`가 크래시남.
→ **CryptoObject 경로 완전 폐기**. non-crypto 프롬프트로 사용자 인증(키 30분
유효창 오픈) 후 `cipher.init + doFinal`. auth-required 키는 `doFinal`이
`UserNotAuthenticatedException`을 강제하므로 보안 등가 (유효창이 닫혔으면 실패).
보안 속성 변화 없음: 키는 여전히 `setUserAuthenticationRequired(true)` +
`BIOMETRIC_STRONG` + enrollment 무효화. 다만 인증-암호 바인딩(CryptoObject)이
"인증 후 유효창 내 연산" 모델로 바뀌었음을 명시한다.

### D4b. SecureKeyPlugin 미등록 — MainActivity.java 수정됨

`SecureKeyPlugin`(storeKey/unlockKeyWithBiometric/deleteKey/hasKey/
isBiometryAvailable)이 **Capacitor에 registerPlugin으로 등록돼 있지 않았다**.
순수 Java/Kotlin 클래스만 존재하고 브리지에 올라가지 않으면 JS 호출이
"plugin not implemented"로 실패한다. 기존 `KiyoAutofillPlugin`/
`KiyoFilePlugin`과 동일하게 `MainActivity` 생성자에서
`registerPlugin(SecureKeyPlugin.class)` 추가. (생체인증 E2E 최초 실행 시
JS→Native 호출이 아예 안 되는 1차 원인으로 발견)

### D5. 언락 후 계정 스토어 미리로드 — Auth.tsx 수정됨

`accountStore.accounts`는 App 마운트 시 1회 `loadAccounts()`로만 채워진다.
앱 재시작 직후엔 cryptoKey가 없어 암호화 레코드가 빈 스텁(title="")으로 로드되고,
언락(PIN/생체인증 모두)이 스토어를 재로드하지 않아 계정 리스트가 비어 보였다.
생체인증 E2E가 최초로 이 경로의 렌더링을 검증해 노출됨.
→ `Auth.tsx`의 두 언락 경로 모두에서 세션 키 설정 후 `initializeStores()` 호출.
(autofill E2E가 이걸 못 잡은 건 계정 리스트 렌더링을 검증하지 않기 때문)

### D6. 화면 꺼짐 시 지문 주입 무시 — 스크립트 수정됨

에뮬레이터 화면이 꺼진 상태에선 가상 HAL이 `emu finger touch`를 무시한다
(시스템 로그 실측: auth client 시작 후 acquire 이벤트 0건).
→ watcher가 마커 감지 시 `KEYCODE_WAKEUP` 후 주입하도록 수정.
테스트 수동 실행 시에도 `svc power stayon true` 권장.

### D7. 생체인증 취소 메시지 분기 실패 — Auth.tsx 수정됨

취소 시 `err.message.includes("biometric")`(소문자)로 PIN 폴백 안내를 분기했는데
Capacitor 에러 메시지는 `Biometric authentication failed: ...`(**대문자 B**)라
분기가 항상 실패 → 원문 에러("...canceled by user")가 그대로 노출. 취소 자체는
기능적으로 정상 동작(에러 → Auth 화면 유지).
→ 문자열 매칭 제거, 생체인증 실패/취소 모두 "생체인증에 실패했습니다.
PIN으로 로그인해 주세요."로 통일 (SecureKeyPlugin의 biometricError 플래그는
메시지 대소문자가 버전별로 달라 문자열 매칭은 불안정).

### 실제 소스 코드 수정 요약 (프로덕션 변경)

| 파일 | 변경 | 이유 (결함 번호) |
|---|---|---|
| `android/.../securekey/BiometricAuthHelper.kt` | `authenticate()`를 `withContext(Dispatchers.Main)`으로; CryptoObject 폐기 → non-crypto 프롬프트 후 `cipher.init+doFinal`; 공용 `authenticateWithPrompt` 헬퍼 | D3 메인 스레드 위반 크래시, D4 "Crypto primitive not initialized" 크래시 |
| `android/.../MainActivity.java` | `registerPlugin(SecureKeyPlugin.class)` 추가 | D4b 플러그인 미등록 — JS→Native 브리지 부재 |
| `src/pages/Auth.tsx` | 언락 성공 후 `initializeStores()` 호출 (PIN/생체인증 양쪽); 취소 에러 메시지 통일 | D5 언락 후 계정 리스트 빈 스텁, D7 취소 메시지 분기 실패 |

보안 산책: 세 파일 모두 인증 요구 강도·키 저장 위치·프로세스 경계 가정을
변경하지 않는다. D4의 CryptoObject 제거는 인증-암호 직접 바인딩을 "인증 후
유효창 내 연산"으로 바꾸지만 auth-required 키의 `doFinal` 게이트가 유지되므로
보안 등가 (D4 항목 참조).

### 검증 인프라 리팩토링 (프로덕션 아님 — androidTest/스크립트만)

- `AppScreenState.kt` 신규: 페이지 경계 밖 화면 상태 판별/이동을 HomePage에서 분리
- `AuthPage.kt` 신규 + `SettingsPage` 생체인증 섹션: 테스트 클래스가 직접
  운전하던 Auth/Settings UI 조작을 페이지 객체로 이관 (BiometricUnlockE2ETest는
  시나리오 오케스트레이션+마커 프로토콜만 담당)
- watcher wake+touch, 마커 해셋 중복 방지, vault 이름 고정(`e2e-vault-enc`)

## Risks

1. **에뮬레이터 지문 안정성** — `emu finger touch` 타이밍 민감(프롬프트 표시 전 입력 시 무시). 완화: logcat 마커 프로토콜로 프롬프트 표시 후 주입 보장 + 실패 시 재시도(최대 3회).
2. **BiometricPrompt 감지 불가** — AX tree 미노출. 완화: logcat 기반 감지 + failure watcher 스크린샷.
3. **logcat 마커 폴링 지연** — 호스트 폴링 간격(500ms~1s)만큼 테스트 대기 시간 증가. 완화: 마커 감지 타임아웃 명시(30초), 폴링 간격 문서화.
4. **30분 인증 유효시간** — `kiyo_secure_master_key`는 30분 캐시가 있으나 CryptoObject 패턴은 매 요청 프롬프트를 띄우므로 테스트 타이밍 영향 없음. debug 빌드 30초 단축은 autofill용 키에만 적용되므로 혼동 금지.
5. **프로세스 사망** — autofill auth 캐시와 달리 생체인증 키는 prefs에 영속되므로 프로세스 사망 후에도 언락 가능해야 함. 시나리오 2에서 앱 강제 재시작 변형으로 선택 검증 가능.
