# E2E 테스트 실패 시 Dumpfile 생성

## 개요

E2E 테스트(autofill, biometric) 실패 시, Android UI Automator를 통해:
- **Window hierarchy XML** (`uiautomator_FAILURE_<testName>_*.xml`)
- **Screenshot PNG** (`screen_FAILURE_<testName>_*.png`)
- **Text 요약** (`<testName>_summary.txt`)

를 생성하여 root cause 분석을 지원합니다.

## 구현 위치

- `android/app/src/androidTest/java/com/kiyo/app/e2e/testutil/WebViewTestHelper.kt`
- `android/app/src/androidTest/java/com/kiyo/app/autofill/AutofillE2ETest.kt` (TestWatcher)
- `android/app/src/androidTest/java/com/kiyo/app/biometric/BiometricUnlockE2ETest.kt` (TestWatcher)

## 저장 위치

**정확한 경로**: `/data/user/0/com.kiyo.app/cache/`

### 왜 `targetContext.cacheDir`인가?

| 위치 | 작동 여부 | 이유 |
|------|---------|------|
| `/data/user/0/com.kiyo.app.test/cache/` | ❌ | `instrumentation` 프로세스의 SELinux context가 `app_data_file` → `test` 패키지 cache 접근 불가 |
| `/data/user/0/com.kiyo.app/cache/` | ✅ | `targetContext` = `com.kiyo.app`의 context. shell이 `run-as com.kiyo.app`으로 read 가능 |
| `/data/local/tmp/kiyo_e2e/` | ❌ | `shell` user(`u0_a100017`) 소유. `instrumentation` 프로세스의 SELinux context가 `shell_data`에서 `app_data_file`로 매핑 안 됨 → EACCES |

### 확인 방법

```bash
# dump file 확인
adb shell run-as com.kiyo.app ls -la cache/uiautomator_FAILURE_*.xml

# screenshot 확인
adb shell run-as com.kiyo.app ls -la cache/screen_FAILURE_*.png

# 파일 추출 (host에서)
adb exec-out run-as com.kiyo.app cat cache/uiautomator_FAILURE_noAuthFill_*.xml > failure.xml
adb exec-out run-as com.kiyo.app cat cache/uiautomator_FAILURE_noAuthFill_*.png > failure.png
```

## 동작 흐름

```
Test 실행 → AssertionError
         ↓
TestWatcher.failed() 호출
         ↓
WebViewTestHelper.dumpViewHierarchy(testName)
         ↓
1. context = targetContext.cacheDir
2. internalFile = File(context, "uiautomator_<test>_<ts>.xml")
3. FileOutputStream(internalFile).use { out ->
       device.dumpWindowHierarchy(out)  // stream API 사용
   }
4. Text 요약 생성 (package, text 노드 추출)

         ↓
WebViewTestHelper.captureScreen(testName)
         ↓
1. internalFile = File(context, "screen_<test>_<ts>.png")
2. device.takeScreenshot(internalFile)  // File API (1회 호출)

         ↓
host에서 adb exec-out 로 추출 → root cause 분석
```

## 주요 파일

### 1. ViewHierarchyDump

`dumpViewHierarchy()` → `OutputStream` API 사용.

```kotlin
fun dumpViewHierarchy(step: String): String {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val internalFile = File(context.cacheDir, fileName)

    // WebViewTestHelper.kt:332
    FileOutputStream(internalFile).use { output ->
        device.dumpWindowHierarchy(output)
    }
    
    // 요약 생성: packages, text 노드만 추출
    val summary = buildString { ... }
}
```

### 2. ScreenshotCapture

`captureScreen()` → `File` API 사용.

```kotlin
fun captureScreen(step: String): String {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    val internalFile = File(context.cacheDir, fileName)
    device.takeScreenshot(internalFile)
}
```

### 3. TestWatcher

`failureWatcher` → `System.err`로 디버그 로깅.

```kotlin
override fun failed(e: Throwable, description: Description) {
    System.err.println(">>> FAILURE WATCHER ENTERED: $testName")
    System.err.flush()

    helper.dumpViewHierarchy("FAILURE_$testName")  // try/catch 분리
    helper.captureScreen("FAILURE_$testName")
}
```

## 참고: SELinux 문제 분석

### 문제 상황

약간의 시간(1~2분) 후 테스트를 다시 실행하면:
- `/data/local/tmp/`에 파일 생성: ✅ (shell이 `mkdir`만 함)
- 파일 쓰기: ❌ (`FileOutputStream` EACCES)
- 이유: instrumentation 프로세스의 SELinux context가 `app_data_file` → shell의 `shell_data`에 해당하는 디렉터리 쓰기 허용 안 됨

### 해결

- **`/data/user/0/com.kiyo.app/cache/`** 사용 (targetContext)
- shell에서는 `run-as com.kiyo.app`으로 접근 → SELinux context 매칭됨

## 사용 예시

```bash
# 테스트 실행 후 실패 확인
./gradlew :app:connectedAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.kiyo.app.autofill.AutofillE2ETest#noAuthFill

# dump file 추출
adb exec-out run-as com.kiyo.app cat cache/uiautomator_FAILURE_noAuthFill_*.xml > /tmp/noAuthFill.xml

# XML 분석: dropdown이 실제로 생성되었는가?
grep -E "(autofill|dropdown|Userv)" /tmp/noAuthFill.xml
```

## 관련 파일

- `android/app/src/androidTest/java/com/kiyo/app/e2e/testutil/WebViewTestHelper.kt`
  - `dumpViewHierarchy()` (line ~300-360)
  - `captureScreen()` (line ~362-380)
- `android/app/src/androidTest/java/com/kiyo/app/e2e/rules/FailureCaptureRule.kt` (향후 리팩터링 목표)