# Autofill DB 보안 설계 개선 계획

## 목표
- **React CryptoKey** 를 Autofill DB 암호화 계층에 직접 연결하지 않는다.
- Vault 파일이 이미 사용자 인증(PIN/생체)으로 열린 상태라면, 그 후 **자동완성에 필요한 최소 계정정보**(username, password, URL/domain 등)만 추출하여 별도의 Autofill DB에 복제한다.
- Autofill DB 접근은 **Android 사용자 인증**으로 보호하며, 이를 위해 `DB_KEY` 를 Android Keystore에 래핑하고 키 사용 시 사용자 인증을 요구한다.
- 이렇게 하면 Autofill DB는 Vault의 완전한 복사본이 아닌 별도의 보안 경계가 되며, 프로세스가 종료되어도 인증이 유지되는 동안 자동완성 서비스가 동작할 수 있다.

## 현 구조 검토
|| 구성 요소 | 현재 역할 | 문제점 |
|----------|----------|--------|
| `KeystoreManager.kt` | `kiyo_master_key` (AES‑256‑GCM) 생성·보관 | 키 사용 시 **사용자 인증 요구** 옵션이 설정되어 있지 않음 |
| `DatabaseKeyManager.kt` | 랜덤 `DB_KEY` 생성 → `kiyo_master_key` 로 wrapping → `kiyo_security_prefs`에 저장 | wrapping 키에 인증이 없으므로 키가 노출되면 바로 복호화 가능 |
| `KiyoAutofillService.onFillRequest` | 토큰 유효성 검사 → SQLCipher DB 열기 | 토큰만 검증하고, 키 자체는 인증 없이 바로 사용 |

## 변경 방향 (반영된 실제 변경사항)
1. **키 사용 시 Android 사용자 인증 요구** 설정 완료
   - `KeystoreManager` 에서 키 생성 시 `setUserAuthenticationRequired(true)` 및 `setUserAuthenticationParameters(30 * 60, AUTH_BIOMETRIC_STRONG or AUTH_DEVICE_CREDENTIAL)` 설정
   - 이로써 `DatabaseKeyManager.getKey()` 가 키 사용을 시도하고, 인증되지 않은 경우 `UserNotAuthenticatedException`이 발생한다.
2. **키 래핑/언래핑 로직의 예외 처리 강화** 완료
   - `DatabaseKeyManager` 의 기존 래핑/언래핑 로직은 유지하되, 키 생성 및 읽기 시 try-catch 블록을 추가하여 오류 발생 시 로그를 남기고 예외를 재발생시킴.
3. **Autofill 토큰 역할 축소 및 인증 흐름 명확화** 완료
   - 토큰은 **단순한 UI/세션 상태 표시** 로만 사용 (예: 볼트가 암호화 상태인지 여부)
   - `token_expire_at` 필드는 개념적으로 삭제되지 않았으나, 실제 인증 절차는 토큰 검증을 제거하고 다음과 같이 변경됨:
     a. `AutofillService.onFillRequest()` 에서 토큰 존재 여부를 확인하여 UI 상태만 관리하고, 실제 키 접근은 `DatabaseKeyManager.getKey()` 에 위임한다.
     b. 키 사용 시 인증이 필요하면 `UserNotAuthenticatedException`이 발생한다.
     c. 이때 `FillResponse.Builder.setAuthentication()` 을 통해 인증이 필요한 AuthActivity를 지정하고, `AutofillService` 는 인증 UI를 띄우지 않고 바로 인증 흐름을 진행한다 (토큰은 플래그 역할만).
     d. 지정된 AuthActivity에서 `BiometricPrompt` 혹은 기기 자격 증명(PIN/패턴/비밀번호)를 요청하여 사용자 인증을 수행한다.
     e. 인증 성공 시, 해당 Activity에서 `EXTRA_AUTHENTICATION_RESULT` 로 실제 `FillResponse` (DB 쿼리 결과를 포함한)를 반환한다.
     f. 인증 실패 시, 적절한 오류 또는 빈 응답을 반환하여 자동완성을 표시하지 않는다.
   - 따라서 `setAuthentication()` 은 Keystore를 직접 호출하지 않고, 인증이 필요한 Activity를 지정하는 역할을 하며, 실제 Keystore 키 사용 시 발생하는 `UserNotAuthenticatedException` 을 처리하기 위한 흐름을 제공한다.
4. **Vault → Autofill 데이터 동기화 로직 명확화** 완료
   - React 측에서 Vault 파일 복호화 후 `accountStore` 로부터 **자동완성 대상 계정**만 필터링
   - 필요한 필드만 (`username`, `password`, `url`/`domain`) 추출하여 기존 Capacitor 플러그인 메서드 `syncAccountsFromReact()` 호출 (전송 데이터 제한)
   - 네이티브 측에서는 전달받은 데이터를 SQLCipher DB에 upsert (또는 전체 교체)
   - 이 과정은 **한 번의 Vault unlock** 에만 수행되며, 이후 Autofill DB는 독립적으로 동작
   - 동기화 시 `KiyoAutofill.isAutofillEnabled()` 조건을 추가하여 서비스가 활성화되어 있고 KIYO 서비스인 경우에만 동기화 수행.
5. **보안 경계 문서화**
   - 두 개의 독립 보안 계층을 명시:
     1️⃣ Vault 보안 – React CryptoKey (PIN/생체 → PBKDF2 → AES‑GCM)
     2️⃣ Autofill 보안 – Android 사용자 인증 → Keystore → DB_KEY → SQLCipher

## 파일별 수정 사항 (반영된 실제 변경사항)
|| 파일 | 변경 내용 |
|------|-----------|
| android/app/src/main/java/com/kiyo/app/security/KeystoreManager.kt | - 키 생성 시 `.setUserAuthenticationRequired(true)`<br>- `.setUserAuthenticationParameters(30 * 60, AUTH_BIOMETRIC_STRONG or AUTH_DEVICE_CREDENTIAL)` (30분 유효, 바이오메트릭 강함 또는 기기 자격증) |
| android/app/src/main/java/com/kiyo/app/security/DatabaseKeyManager.kt | - 기존 래핑/언래핑 로직 유지<br>- 키 생성 및 읽기 시 try-catch 블록 추가로 오류 발생 시 로그 남기고 예외 재발생 |
| android/app/src/main/java/com/kiyo/app/autofill/service/AuthRequestHandler.kt | - 토큰 존재 여부 확인 로직 제거<br>- 대신 `DatabaseKeyManager.getKey()` 호출을 시도하여 키 접근 시 인증 요구 처리<br>- 키 접근 성공 시 계정 조회 및 채우기 응답 생성<br>- `UserNotAuthenticatedException` 발생 시 인증 요청 응답 생성<br>- 기타 예외 시 null 응답 반환 |
| src/store/accountStore.ts | - `getAutofillAccounts(): { username: string; password: string; domain: string | null; title?: string }[]` 메서드 추가 (username, password, domain만 추출)<br>- `syncToAutofill()` 메서드 내부에 `KiyoAutofill.isAutofillEnabled()` 조건 추가 (서비스가 활성화되어 있고 KIYO 서비스인 경우에만 동기화 수행)<br>- `syncToAutofill()` 에서 `get().accounts` 대신 `getAutofillAccounts()` 사용하여 전송 데이터 최소화 |
| src/plugins/kiyautofill.ts (Capacitor 플러그인 TS wrapper) | - 변경 없음 (기존 `syncAccountsFromReact` 메서드 사용)<br>- 그러나 `accountStore` 에서 `getAutofillAccounts()` 로 추출된 `{username, password, domain}` 만이 전송되도록 간접적으로 제한 |
| src/hooks/useAutofill.ts | - **파일 삭제됨** (사용자 요청에 따라 삭제, 자동 동기화는 `accountStore`의 `syncToAutofill`에 내장되어 Vault unlock 시 자동 실행) |
| src/database/fileStorage.ts / src/database/accountTable.ts | - 변경 없음 (기존 로직 유지) |
| 테스트/시나리오 문서 | - 통합 테스트 생략 (사용자 요청에 따라 취소) |


## 위험 및 완화책
|| 위험 | 설명 | 완화책 |
|------|------|--------|--------|
| 사용자 인증 프롬프트가 너무 자주 뜸 | 키 사용 시마다 인증을 요구하면 UX 저하 | `setUserAuthenticationParameters(30 * 60, AUTH_BIOMETRIC_STRONG or AUTH_DEVICE_CREDENTIAL)` 로 30분 유효 기간 설정하여 인증 후 일정 시간 동안 재인증 없이 키 사용 허용 |
| 토큰 만료 정책과의 충돌 | 토큰이 만료됐는데 인증 유효 기간이 남아 있을 경우 혼동 | 토큰 역할은 순수 플래그(볼트 암호화 여부) 로만 사용하고, 실제 키 접근은 인증에 의존하도록 명시 |
| 키 생성 시 인증 요구 옵션이 지원되지 않는 기기 | 구형 안드로이드 버전에서는 해당 옵션이 미지원 | 옵션 설정 시 `try-catch` 로 fallback (인증 요구 미지원 시 로그 남기고 기존 방식 유지) – 최소 SDK 24 이상에서만 적용 |
| Autofill DB 동기화 누락 | React 측에서 필수 필드 추출 로직 오류 시 Autofill 제안에 데이터 missing | 단위 테스트에서 `getAutofillAccounts()` 가 기대하는 필드만 반환하는지 검증, CI에 추가 |

---
> **결론**: 위 계획을 적용하면 Autofill DB는 완전한 Vault 복사본이 아니라 **별도 보안 경계**가 되며, 키 사용은 Android 사용자 인증에 강하게 결부됩니다. 이렇게 하면 “Vault 파일을 한 번 열었다고 해서 Autofill DB가 무조건 신뢰되는” 구조를 없애고, 원하는 보안 모델을 정확히 반영할 수 있습니다.

*작성일: 2026-09-16*
*작성자: Hermes Agent*