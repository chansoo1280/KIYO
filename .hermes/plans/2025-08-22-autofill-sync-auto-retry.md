# 자동완성 동기화 버튼 - 인증 후 자동 재시도 플로우 변경

## 작업 개요
설정 화면에서 자동완성 동기화 버튼을 눌렀을 때, 사용자 인증이 필요하면 인증 후 **자동으로 동기화 재시도**하도록 변경.

### 현재 플로우 (변경 전)
1. 사용자: 동기화 버튼 클릭
2. Native: `UserNotAuthenticatedException` 발생 → `authRequired: true` 반환
3. React: 에러 메시지 표시 + `openAppForAuth()` 호출 → 앱에서 PIN/생체인증
4. 사용자: 인증 완료 후 **다시 동기화 버튼 수동 클릭 필요**

### 목표 플로우 (변경 후)
1. 사용자: 동기화 버튼 클릭
2. Native: `UserNotAuthenticatedException` 발생 → 인증 액티비티 자동 실행 + `pendingSyncCall` 저장
3. 사용자: PIN/생체인증 완료
4. Native: `ActivityResultLauncher`로 결과 수신 → 인증 성공 시 **자동으로 동기화 재시도** → 결과 반환
5. React: 성공/실패 결과만 수신하여 UI 업데이트

---

## 변경 대상 파일

### 1. Native (Kotlin)
| 파일 | 변경 내용 |
|------|-----------|
| `android/app/src/main/java/com/kiyo/app/capacitor/KiyoAutofillPlugin.kt` | `ActivityResultLauncher` 추가, `pendingSyncCall`/`pendingSyncAccountsJson` 필드 추가, `syncAccountsFromReact`에서 예외 발생 시 인증 실행 및 재시도 로직 구현, `handleAuthResult` 메서드 추가 |

### 2. Web (React/TypeScript)
| 파일 | 변경 내용 |
|------|-----------|
| `src/pages/Settings/components/AutofillSection.tsx` | `syncAccounts` 콜백 단순화: `authRequired` 분기 제거, 네이티브가 자동 재시도 후 최종 결과만 처리 |

---

## 아키텍처 고려사항

### 보안 영향도
- **Keystore 인증 캐시(30분) 동작 변경 없음**: `AutofillAuthActivity`가 기존과 동일하게 `BiometricPrompt` 사용, 인증 성공 시 Keystore 캐시 활성화됨
- **별도 마스터 키 유지**: `kiyo_master_key`(autofill용)와 `kiyo_secure_master_key`(biometric vault용) 완전 분리 유지
- **데이터 흐름**: React → Native(계정 JSON) → Keystore 복호화 → SQLCipher DB 동기화

### 프로세스/라이프사이클
- `KiyoAutofillPlugin.load()`에서 `FragmentActivity` 기준으로 `ActivityResultLauncher` 등록
- `MainActivity.onNewIntent` → `AutofillAuthActivity.startAuthForSync` → `BiometricPrompt` → `Activity.RESULT_OK` → `handleAuthResult` → 재시도
- Capacitor 플러그인 인스턴스는 앱 프로세스 생존 동안 유지되므로 `pendingSyncCall` 안전하게 보관 가능

---

## 구현 단계

1. **Native: KiyoAutofillPlugin.kt 수정**
   - Import 추가: `Activity`, `ActivityResultLauncher`, `ActivityResultContracts`, `FragmentActivity`
   - 필드 추가: `pendingSyncCall`, `pendingSyncAccountsJson`, `authActivityLauncher`
   - `load()`에서 `authActivityLauncher` 등록
   - `openAppForAuth`: `context.startActivity` → `authActivityLauncher.launch` 변경
   - `syncAccountsFromReact`: `UserNotAuthenticatedException` catch 블록에서 `pendingSyncCall` 저장 후 인증 실행
   - `handleAuthResult` 구현: 성공 시 `ensureRepositoryInitialized()` → `syncAccountsFromReact` 재실행 → `call.resolve`, 실패 시 `authRequired` 응답

2. **Web: AutofillSection.tsx 수정**
   - `syncAccounts`에서 `authRequired` 분기 제거
   - 성공/실패/`authRequired(취소/실패)` 케이스만 처리

3. **빌드 및 테스트**
   - `npm run build` (웹 빌드)
   - `npm run test` (단위/통합 테스트)
   - `npm run android:build` (안드로이드 디버그 빌드)

---

## 테스트 계획

| 테스트 | 예상 결과 |
|--------|-----------|
| 동기화 버튼 클릭 (인증 불필요 상태) | 즉시 동기화 성공, 계정 수/시간 갱신 |
| 동기화 버튼 클릭 (인증 필요 상태) | 생체인증/PIN 프롬프트 표시 → 인증 성공 시 자동 동기화 완료 메시지 |
| 인증 프롬프트에서 취소/실패 | `authRequired: true` 응답, 에러 메시지 표시 |
| 연속 동기화 요청 (인증 캐시 유효 중) | 즉시 동기화 성공 (재인증 불필요) |

---

## 리스크 및 롤백 전략

| 리스크 | 완화 방안 |
|--------|-----------|
| `pendingSyncCall` 메모리 누수 (액티비티 재생성 시) | `load()`에서 런처 재등록, `pendingSyncCall`은 단일 호출용이므로 누수 위험 낮음. 필요시 `onDestroy`에서 정리 추가 |
| 인증 후 재시도 시 또 `UserNotAuthenticatedException` | catch 블록에서 `authRequired` 응답으로 폴백 (구현됨) |
| Capacitor 플러그인 인스턴스 소멸로 콜백 유실 | Capacitor 플러그인은 앱 프로세스 생존 동안 싱글톤 유지. `MainActivity` 재생성 시에도 플러그인 인스턴스 유지됨 |

**롤백**: `git revert`로 양쪽 파일 원복 후 `npm run android:build`

---

## 완료 기준

- [x] Native 빌드 성공 (`npm run android:build`)
- [x] 웹 빌드 성공 (`npm run build`)
- [x] 전체 테스트 통과 (`npm run test`: 270 tests passed)
- [x] TypeScript 타입 체크 통과
- [ ] 실기기/에뮬레이터에서 플로우 수동 검증 (별도 수행 필요)

---

## 참고: 관련 기존 패턴

`KiyoFilePlugin.kt`가 이미 `ActivityResultContracts.CreateDocument()` / `OpenDocument()`로 `ActivityResultLauncher` 패턴 사용 중. 이번 변경으로 일관성 확보.