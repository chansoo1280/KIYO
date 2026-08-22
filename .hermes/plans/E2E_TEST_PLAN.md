# KIYO Android E2E 테스트 계획 (업데이트)

## 1. 목적
- 구현된 Android 네이티브 플러그인(보안 키 저장·생체인증, 오토필 서비스, 시스템 설정 연동)에 대해 UI Automator 기반 End‑to‑End 테스트 시나리오를 정의.
- 코드에 존재하지 않는 `SecuritySession` 플러그인 등은 테스트 범위에서 제외.

## 2. 테스트 대상 기능
| 기능 | 관련 클래스/파일 |
|------|------------------|
| 생체인증 기반 키 저장·복원 | `BiometricAuthHelper.kt`, `SecureKeyManager.kt`, `KeystoreManager.kt`, `KiyoBiometricActivity.kt` |
| 오토필 서비스 | `KiyoAutofillService.kt`, `KiyoAutofillPlugin.kt`, `AutofillSettingsActivity.kt` |
| 시스템 설정 연동 | 위 플러그인을 통해 Android 설정 화면 호출 |
| 앱 수명 주기 | 백그라운드 ↔ 포그라운드 전환 시 상태 유지 확인 |
| **오토필 테스트 호스트** | `AutofillTestHostActivity.kt` (네이티브 테스트용 로그인 화면) |

## 3. 테스트 케이스 (간결)

### 3.1 생체인증 · 키 저장/복원 (UI Automator 흐름 + Instrumentation 검증)
| TC-ID | UI Automator 검증 포인트 |
|-------|--------------------------|
| BioKey‑01 | BiometricPrompt 표시 → 올바른 인증 시 키가 저장됨 (저장 여부는 Plugin API로 별도 검증) |
| BioKey‑02 | 동일 별칭 저장 시도 → 인증 **취소** 시 저장되지 않음 |
| BioKey‑03 | 키 복호화 요청 → 올바른 인증 시 원문 데이터 반환 (복호화 결과는 Plugin API로 비교) |
| BioKey‑04 | 복호화 요청 → 인증 **취소** 시 복호화 실패 |
| BioKey‑05 | 키 저장 → 앱 강제 종료 → 재시작 → 같은 인증으로 복호화 성공 (재시작 후 키 유지) |
| BioKey‑06 | 키 삭제 → 동일 별칭 복호화 시도 시 실패 (예외 혹은 null) |

> **Instrumentation 역할**: 키 저장, 삭제, 복호화 결과를 직접 Plugin API 호출로 검증.

### 3.2 오토필 서비스
| TC-ID | 검증 포인트 |
|-------|-------------|
| Auto‑01 | 플러그인으로 오토필 설정 화면 호출 → 설정 화면 표시 |
| Auto‑02 | 설정 화면에서 KIYO Autofill Service 토글이 OFF 상태 |
| Auto‑03 | 토글을 ON → 앱 복귀 후 `AutofillManager.isAutofillEnabled()` = **true** |
| Auto‑04 | 테스트 계정 저장 → `AutofillRepository.syncToAutofillService()` 호출 → **AutofillService가 KIYO 계정 데이터를 정상적으로 조회할 수 있는 상태** 확인 |
| **Auto‑05** | **AutofillTestHost에서 로그인 폼 오픈 → 사용자명 필드 포커스 시 오토필 드롭다운 표시 및 “testuser” 항목 노출** |
| **Auto‑06** | **드롭다운에서 계정 선택 → 사용자명·비밀번호 필드에 자동 입력** |
| **Auto‑07** | **자동 입력된 값으로 폼 제출 → 전송된 사용자명·비밀번호가 입력값과 일치** |
| **Auto‑08** | **존재하지 않는 도메인(nomatch.example.com) 테스트 → 오토필 드롭다운 표시 안 됨 (매칭 실패)** |
| Auto‑09 | 오토필 서비스 OFF 전환 후 동일한 로그인 폼 테스트 → 오토필 드롭다운이 전혀 표시되지 않음 |
| Auto‑10 | 오토필 활성화 상태에서 홈→백그라운드→포그라운드 전환 → 오토필 드롭다운드가 여전히 표시되고 정상 입력 가능 (상태 유지) |

### 3.3 시스템 설정 연동
| TC-ID | 검증 포인트 |
|-------|-------------|
| Sys‑01 | `KiyoAutofillPlugin.openAutofillSettings()` → Android 설정 화면 표시 (제목에 “설정”/“Settings”) |
| Sys‑02 | 설정 화면에서 “KIYO Autofill Service” 항목 찾고 스위치/체크박스 형태 확인 |
| Sys‑03 | 서비스가 OFF이면 ON으로 전환 후 뒤로 가기 → 앱이 이전 화면으로 정상 복원 |
| Sys‑04 | 복귀 후 `AutofillManager.getAutofillService().getComponent().getPackageName()` = `com.kiyo.app` 확인 |
| Sys‑05 | 설정을 다시 열어 서비스가 여전히 ON 상태인지 재확인 |

### 3.4 앱 수명 주기
| TC-ID | 검증 포인트 |
|-------|-------------|
| Life‑01 | 오토필 ON 및 키 저장 상태 → 홈으로 백그라운드 → 최근 앱에서 포그라운드 복귀 → 오토필 활성화 여부 및 키 복호화 가능 확인 |
| Life‑02 | 앱 강제 종료 → 재시작 → **Autofill Service 활성화 상태가 유지되는지** 확인 (앱 프로세스 종료와 서비스 OFF를 동일시하지 않음) |

### 3.5 오류 상황 처리
| TC-ID | 검증 포인트 |
|-------|-------------|
| Err‑01 | 생체인증 프롬프트에서 연속 실패(예: 5회) → 6번째 시도 시 lockout 오류 (`BIOMETRIC_ERROR_LOCKOUT` 또는 정의된 오류 메시지) 발생 |
| Err‑02 | 오토필 서비스 OFF 상태에서 로그인 필드 포커스 → 오토필 드롭다운이 전혀 표시되지 않음 |
| Err‑03 | 오토필 드롭다운에 존재하지 않는 계정 선택 시도 → 입력값 변화 없음 (또는 정의된 토스트/스낵바 피드백) |

### 권장 테스트 구조
```
androidTest/
├── biometric/
│   ├── BioKeyE2ETest.kt          # UI Automator 흐름 (앱→Prompt→복귀)
│   └── BiometricPromptTest.kt    # Instrumentation: 키 저장/삭제/복호화 검증
│
├── autofill/
│   ├── AutofillSettingsE2ETest.kt   # Sys‑01~05, Auto‑01~03
│   ├── AutofillServiceE2ETest.kt    # Auto‑04, Auto‑09~10 (Service 상태 확인)
│   ├── AutofillE2ETest.kt           # Auto‑05~08 (AutofillTestHost 기반 E2E)
│   └── AutofillTestHost/            # 별도 모듈: 네이티브 테스트용 로그인 화면
│
└── lifecycle/
    └── AppLifecycleE2ETest.kt       # Life‑01, Life‑02, Err‑01~03
```

### 도구 구분
| 테스트 유형 | 사용 도구 |
|------------|-----------|
| Keystore 내부 동작 (키 저장/삭제/복호화) | **JUnit / Instrumentation** (Plugin API 직접 호출) |
| Plugin API 동작 (오토필 동기화, 서비스 상태 확인) | **Instrumentation** |
| BiometricPrompt 실제 UI (사용자 인증 흐름) | **UI Automator** |
| Android 설정 화면 이동·확인 | **UI Automator** |
| Autofill Service (드롭다운 표시, 계정 조회 가능 여부) | **UI Automator** |
| **AutofillTestHost → KIYO Autofill (네이티브 폼 자동 입력/제출)** | **UI Automator** |
| 앱 생명주기 및 오류 상황 | **UI Automator + Instrumentation** (상태 확인은 Instrumentation) |

## 5. 참고 사항
- 실제 기기(지문/얼굴 인식 센서 보유) 사용을 권장; 에뮬레이터는 지문 시뮬레이션(`adb emu finger print <id>`) 가능하지만 오토필 서비스는 일부 제한이 있을 수 있음.
- 각 테스트 종료 후 `adb shell pm clear com.kiyo.app` 혹은 고유한 alias 사용으로 상태 초기화.
- CI에서는 Firebase Test Lab 또는 GitHub Actions에서 실제 기기 farm을 이용해 실행하도록 스크립트 작성 가능.
- **오토필 테스트는 Chrome 의존성 없이 `AutofillTestHost` 네이티브 Activity로 수행** (별도 모듈 `android/autofill-test-host/`).

---
*이 계획서는 KIYO 프로젝트의 현재 구현 범위에 맞춰 작성되었습니다. 추후 새 플러그인(예: SecuritySession)이 추가될 경우 해당 섹션을 확장하면 됩니다.*