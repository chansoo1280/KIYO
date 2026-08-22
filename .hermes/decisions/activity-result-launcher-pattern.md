# Capacitor 플러그인에서 ActivityResultLauncher 패턴 사용 가이드

## 배경
KIYO 프로젝트에서 Capacitor 플러그인이 Android 액티비티를 실행하고 결과를 받아야 할 때, `ActivityResultLauncher` 패턴을 사용하면 안전하고 일관된 방식으로 처리할 수 있다.

## 적용 사례

### 1. KiyoFilePlugin (기존)
- `CreateDocument` / `OpenDocument` 계약으로 파일 저장/열기
- `load()`에서 `registerForActivityResult`로 런처 등록
- 결과 핸들러에서 `pendingSaveCall` / `pendingOpenCall` 콜백 처리

### 2. KiyoAutofillPlugin (신규 - 2025-08-22)
- `StartActivityForResult` 계약으로 인증 액티비티 실행
- `syncAccountsFromReact`에서 `UserNotAuthenticatedException` 발생 시 인증 실행 + 재시도
- `handleAuthResult`에서 인증 성공 시 자동 재시도, 실패 시 에러 응답

---

## 핵심 패턴

```kotlin
@CapacitorPlugin(name = "MyPlugin")
class MyPlugin : Plugin() {
    private var pendingCall: PluginCall? = null
    private lateinit var activityLauncher: ActivityResultLauncher<Intent>
    
    override fun load() {
        super.load()
        val activity = getActivity() ?: return
        val fragmentActivity = activity as FragmentActivity
        
        activityLauncher = fragmentActivity.registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result -> handleResult(result) }
    }
    
    @PluginMethod
    fun doSomething(call: PluginCall) {
        pendingCall = call
        val intent = Intent(context, TargetActivity::class.java)
        activityLauncher.launch(intent)
        // call.resolve()는 여기서 하지 않고 handleResult에서 처리
    }
    
    private fun handleResult(result: ActivityResult) {
        val call = pendingCall ?: return
        pendingCall = null
        
        if (result.resultCode == Activity.RESULT_OK) {
            // 성공 처리 + call.resolve()
        } else {
            // 실패/취소 처리 + call.resolve() 또는 call.reject()
        }
    }
}
```

---

## 주의사항

| 이슈 | 대처 |
|------|------|
| **플러그인 인스턴스 생존** | Capacitor 플러그인은 앱 프로세스 동안 싱글톤 유지. `MainActivity` 재생성되어도 플러그인 인스턴스는 유지됨 |
| **`load()` 중복 호출** | Capacitor가 플러그인 로드시 한 번만 호출. 액티비티 재생성 시 `load()` 다시 호출되지 않음 |
| **`pendingCall` 경합** | 동시 호출 방지 필요시 플래그/큐 사용. 현재 KIYO는 단일 동기화 호출만 해당하므로 단순 변수 사용 |
| **메모리 누수** | `pendingCall`은 결과 수신 시 즉시 null 처리. 액티비티 종료 시 자동 정리 |

---

## 보안 고려사항 (KIYO 특화)

- **Keystore 인증 캐시(30분)**: `BiometricPrompt` 인증 성공 시 자동 활성화. 재시도 시 캐시 유효하면 `UserNotAuthenticatedException` 발생 안 함
- **별도 마스터 키**: `kiyo_master_key`(autofill DB) vs `kiyo_secure_master_key`(biometric vault) 완전 분리
- **프로세스 간 상태 공유 안 함**: AutofillService는 별도 프로세스. 플러그인은 메인 앱 프로세스에서 동작

---

## 향후 적용 가능 영역

- 파일 접근 권한 요청 후 콜백
- 생체인증 키 저장/언락 (`SecureKeyPlugin` 확장 시)
- 시스템 설정 화면 이동 후 결과 확인
- 기타 `startActivityForResult`가 필요한 네이티브 기능