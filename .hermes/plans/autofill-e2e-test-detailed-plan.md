# AutofillE2ETest.kt 상세 리팩토링 계획 (수정됨)

## 현재 코드 분석

### 주요 문제점

| 문제 | 현재 코드 | 영향 |
|------|-----------|------|
| **깨지기 쉬운 선택자** | `clickWebElementByText("파일 생성")`, `typeInFirstTextInput()` | UI 텍스트 변경 시 테스트 깨짐, 첫 번째 input이 의도한 필드가 아닐 수 있음 |
| **Page Object 없음** | 모든 로직이 단일 테스트 클래스에 | 재사용 불가, 유지보수 어려움, 가독성 나쁨 |
| **WebViewTestHelper 없음** | 선택자 체인/폴백 로직 분산 | 각 헬퍼 메서드마다 try-catch 중첩, 일관성 없음 |
| **하드코딩된 슬립** | `Thread.sleep(3000)`, `Thread.sleep(5000)` 등 다수 | 실행 시간 낭비, 플래키니스 원인, 느린 환경에서 실패 |
| **테스트 데이터 하드코딩** | `testUsername = "testuser"`, `testFileName = "e2e-test-vault.json"` | 병렬 실행 시 충돌, 테스트 간 간섭 |
| **단일 테스트만 존재** | `E2E_A` 하나뿐 | 생체인증, 자동잠금, 패키지명 매칭 등 핵심 시나리오 미검증 |
| **선택자 전략 혼재** | XPath 텍스트, 플레이스홀더, aria-label, 태그명 섞여 있음 | 일관성 없음, 디버깅 어려움 |
| **백도어 테스트 키 사용** | `AutofillTestDataManager` 고정 암호화 키로 Keystore 우회 | 실제 프로덕션 플로우와 다름, 보안 검증 불가능 |

---

## 리팩토링 목표 아키텍처

```
android/app/src/androidTest/java/com/kiyo/app/autofill/
├── AutofillE2ETest.kt                 # 메인 테스트 클래스 (슬림해짐)
├── pageobjects/
│   ├── BasePage.kt                    # 공통 베이스
│   ├── HomePage.kt                    # 홈/파일 선택 화면
│   ├── VaultCreatePage.kt             # 볼트 생성 다이얼로그 (PIN 입력 포함)
│   ├── AccountsPage.kt                # 계정 리스트 화면
│   ├── AccountCreatePage.kt           # 계정 생성/편집 화면
│   ├── TemplatePickerPage.kt          # 템플릿 선택 화면
│   └── SettingsPage.kt                # 설정 화면 (자동완성 섹션)
├── testutil/
│   ├── WebViewTestHelper.kt           # 사용자 중심 선택자 체인 (핵심)
│   ├── TestDataFactory.kt             # 유니크 테스트 데이터 생성 (신규)
│   ├── AutofillTestHost.kt            # 테스트 호스트 앱 래퍼 (네이티브 인증 프롬프트 처리 포함)
│   ├── DeviceLockHelper.kt            # 기존 유지 (디바이스 언락 체크)
│   └── TestSecurityInitializer.kt     # 기존 유지 (Keystore/DB 초기화)
└── AutofillChromeE2ETest.kt           # 추후: 크롬 웹뷰 자동완성 테스트
```

---

## 핵심 원칙

### 1. 선택자 전략: 실제 사용자 시점만
- **사용 안 함**: `data-testid`, 내부 구현 의존 선택자
- **사용함**: 보이는 텍스트, ARIA 라벨, 플레이스홀더, 입력 타입, Ionic 컴포넌트 태그명
- **폴백 체인**: **ARIA 라벨 → 보이는 텍스트 → 플레이스홀더 → 입력 타입 → Ionic 태그명 → 일반 태그명**
  - ARIA 라벨 최우선 (접근성 우선, 가장 안정적)
  - Ionic 컴포넌트는 `CLASS_NAME` 대신 `TAG_NAME`/`XPATH` 사용 (Shadow DOM 내부라 CLASS_NAME 미작동)

### 2. 테스트 데이터: 팩토리 패턴으로 유니크 생성
- 타임스탬프 + 카운터 조합으로 병렬 실행 시 충돌 방지
- `AutofillTestDataManager`(고정 키 백도어) **완전 삭제**
- `TestDataFactory`만으로 순수 데이터 생성 (DB/키 조작 없음)

### 3. 두 가지 인증 플로우 완전 분리 (핵심)

이 테스트에서 다루는 **두 개의 서로 다른 인증 플로우**를 명확히 구분해야 합니다:

#### A. 볼트 잠금해제 (React `Auth.tsx` PIN 화면)
```
앱 시작 / 페이지 리로드 / 수동 잠금 후
    ↓
React `Auth.tsx` 화면 표시 (PIN 입력 / 생체인증 버튼)
    ↓
사용자 PIN 입력 → `unlockFile()` → cryptoKey 메모리 복원 → 세션 설정
    ↓
홈/계정 리스트 화면 진입
```
- **트리거**: 암호화된 볼트 열기, 앱 재시작, 수동 잠금 후 재진입
- **UI**: React 웹뷰 내 `Auth.tsx` 컴포넌트 (PIN 입력 필드, 생체인증 버튼)
- **키**: `kiyo_secure_master_key` (생체인증용 별도 Keystore 키) → React `cryptoKey` 래핑/언래핑

#### B. 자동완성 서비스 DB_KEY 접근 (네이티브 시스템 인증 프롬프트)
```
Settings "동기화" 클릭 또는 자동완성 요청 발생
    ↓
KiyoAutofillPlugin.syncAccountsFromReact() / KiyoAutofillService.onFillRequest()
    ↓
AutofillRepository.syncAccountsFromReact() → DatabaseKeyManager.getKey(context)
    ↓
Keystore 마스터 키(`kiyo_master_key`)로 DB_KEY 복호화 시도
    ↓
[사용자 30분 내 미인증 시] → UserNotAuthenticatedException 발생
    ↓
Plugin/Service가 예외 캐치 → MainActivity로 intent(`autofill_auth_required`)
    ↓
**Android 시스템이 네이티브 인증 프롬프트 표시** (지문/얼굴/PIN/패턴 - Keyguard/BiometricPrompt)
    ↓
사용자 인증 완료 → ActivityResult → handleAuthResult() → pendingSync 재시도 / FillResponse 반환
```
- **트리거**: 자동완성 서비스에서 SQLCipher DB(`kiyo_autofill.db`) 접근 필요 시
- **UI**: **Android 시스템 레벨 네이티브 다이얼로그** (React 웹뷰 밖, Keyguard/BiometricPrompt)
- **키**: `kiyo_master_key` (자동완성 전용 Keystore 키) → DB_KEY 래핑/언래핑
- **캐시**: 30분간 인증 상태 유지 (`setUserAuthenticationParameters(30*60, ...)`)

> **중요**: 이 둘은 **완전히 별개의 키, 별개의 UI, 별개의 트리거**를 가집니다. 혼동하지 마세요.

---

### 4. 명시적 대기만 사용 (Thread.sleep 최소화)
- `waitForText()`, `waitForElement()`, `waitForWebViewReady()`로 조건부 대기
- 폴링 간격 200~500ms, 타임아웃 10~30초

### 5. **테스트 범위: Android Autofill 플러그인 기능 전용**
- **React E2E 테스트(`e2e/`)와 완전히 분리** — 웹 UI 검증은 React E2E가 담당
- **이 테스트의 대상**: Android 네이티브 자동완성 서비스 + Capacitor 플러그인 브리지
  - `KiyoAutofillService` (AutofillService 구현체)
  - `KiyoAutofillPlugin` (Capacitor 플러그인: `syncAccountsFromReact`, `isAutofillEnabled`, `getAccounts` 등)
  - `AutofillRepository` + SQLCipher DB (Keystore 보호 키로 암호화)
  - `DatabaseKeyManager` / `KeystoreManager` (DB_KEY 래핑/언래핑)
  - 네이티브 테스트 호스트 앱(`com.kiyo.autofilltest`)에서의 자동완성 드롭다운 검증
- **React 웹뷰 UI 조작은 최소한만** — 볼트 생성, 계정 생성, 설정 동기화 버튼 클릭 정도만 WebView로 수행하고, 핵심 검증은 네이티브 레이어에서 수행

---

---

## 1단계: WebViewTestHelper 구축 (핵심 인프라)

### 파일: `android/app/src/androidTest/java/com/kiyo/app/autofill/testutil/WebViewTestHelper.kt`

```kotlin
package com.kiyo.app.autofill.testutil

import android.util.Log
import androidx.test.espresso.web.sugar.Web.onWebView
import androidx.test.espresso.web.webdriver.DriverAtoms.findElement
import androidx.test.espresso.web.webdriver.DriverAtoms.getText
import androidx.test.espresso.web.webdriver.DriverAtoms.webClick
import androidx.test.espresso.web.webdriver.DriverAtoms.webKeys
import androidx.test.espresso.web.webdriver.Locator
import androidx.test.espresso.web.assertion.WebViewAssertions
import org.hamcrest.CoreMatchers.allOf
import org.hamcrest.CoreMatchers.notNullValue
import java.util.concurrent.Callable

/**
 * WebView 내 요소와 상호작용하는 사용자 중심 헬퍼.
 * 실제 사용자가 보는 것(텍스트, 라벨, 플레이스홀더, 입력 타입)을 기준으로
 * 선택자 체인(폴백)을 통해 견고하게 요소를 찾음.
 * data-testid 등 테스트 전용 속성은 사용하지 않음.
 */
class WebViewTestHelper(private val tag: String = "WebViewTestHelper") {

    // ============ 클릭 계열 ============

    /** 보이는 텍스트로 버튼/요소 클릭 (XPath contains) - ARIA 라벨 최우선 폴백 */
    fun clickByText(text: String, description: String = "button"): Boolean {
        return trySelectorChain(
            { clickByAriaLabel(text, description) },  // ARIA 라벨 최우선 (접근성)
            { clickByXPath("//button[contains(text(), '$text')]", description) },
            { clickByXPath("//*[@role='button' and contains(text(), '$text')]", description) },
            { clickByXPath("//*[contains(text(), '$text')]", description) }  // 일반 텍스트 최후
        )
    }

    /** ARIA 라벨로 클릭 (Locator.ID 매핑) */
    fun clickByAriaLabel(label: String, description: String = "element"): Boolean {
        return trySelectorChain(
            { clickById(label, description) }  // Espresso-Web에서 ID = aria-label
        )
    }

    /** 플레이스홀더로 입력 필드 찾아 클릭 */
    fun clickByPlaceholder(placeholder: String, description: String = "input"): Boolean {
        return trySelectorChain(
            { clickByXPath("//input[@placeholder='$placeholder']", description) },
            { clickByXPath("//textarea[@placeholder='$placeholder']", description) },
            { clickByXPath("//ion-input[@placeholder='$placeholder']//input", description) }
        )
    }

    /** 입력 타입으로 필드 찾아 클릭 */
    fun clickByInputType(inputType: String, description: String = "input"): Boolean {
        return trySelectorChain(
            { clickByXPath("//input[@type='$inputType']", description) },
            { clickByXPath("//ion-input[@type='$inputType']//input", description) }
        )
    }

    /** Ionic 컴포넌트 태그명으로 클릭 (Shadow DOM 대응: CLASS_NAME 대신 TAG_NAME/XPATH 사용) */
    fun clickByIonicTag(tagName: String, description: String = "ionic component"): Boolean {
        return trySelectorChain(
            { clickByXPath("//$tagName", description) },
            { clickByTagName(tagName, description) }
        )
    }

    // ============ 입력 계열 ============

    /** 플레이스홀더로 입력 필드 찾아 텍스트 입력 */
    fun typeByPlaceholder(placeholder: String, text: String, description: String = "input"): Boolean {
        return trySelectorChain(
            { typeByXPath("//input[@placeholder='$placeholder']", text, description) },
            { typeByXPath("//textarea[@placeholder='$placeholder']", text, description) },
            { typeByXPath("//ion-input[@placeholder='$placeholder']//input", text, description) }
        )
    }

    /** 입력 타입으로 필드 찾아 텍스트 입력 */
    fun typeByInputType(inputType: String, text: String, description: String = "input"): Boolean {
        return trySelectorChain(
            { typeByXPath("//input[@type='$inputType']", text, description) },
            { typeByXPath("//ion-input[@type='$inputType']//input", text, description) }
        )
    }

    /** ARIA 라벨로 필드 찾아 텍스트 입력 */
    fun typeByAriaLabel(label: String, text: String, description: String = "input"): Boolean {
        return trySelectorChain(
            { typeById(label, text, description) }
        )
    }

    /** 첫 번째 텍스트 입력 필드에 입력 (최후 폴백용) */
    fun typeInFirstTextInput(text: String): Boolean {
        return trySelectorChain(
            { typeByXPath("//input[@type='text']", text, "first text input") },
            { typeByXPath("//input[not(@type) or @type='']", text, "first input") },
            { typeByXPath("//textarea", text, "textarea") }
        )
    }

    // ============ 대기/검증 계열 ============

    /** 특정 텍스트가 화면에 나타날 때까지 대기 */
    fun waitForText(text: String, timeoutMs: Long = 10000): Boolean {
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            try {
                onWebView()
                    .withElement(findElement(Locator.XPATH, "//*[contains(text(), '$text')]"))
                    .check(WebViewAssertions.webMatches(getText(), allOf(notNullValue())))
                Log.e(tag, "Found text: $text")
                return true
            } catch (e: Exception) {
                Thread.sleep(200)
            }
        }
        Log.w(tag, "Timeout waiting for text: $text")
        return false
    }

    /** 요소가 나타날 때까지 대기 (XPath) */
    fun waitForElement(xpath: String, timeoutMs: Long = 10000): Boolean {
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            try {
                onWebView()
                    .withElement(findElement(Locator.XPATH, xpath))
                    .check(WebViewAssertions.webMatches(getText(), allOf(notNullValue())))
                return true
            } catch (e: Exception) {
                Thread.sleep(200)
            }
        }
        return false
    }

    /** WebView가 로드될 때까지 대기 (ion-app 또는 body 존재) */
    fun waitForWebViewReady(timeoutMs: Long = 30000): Boolean {
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            try {
                onWebView()
                    .withElement(findElement(Locator.TAG_NAME, "ion-app"))
                    .check(WebViewAssertions.webMatches(getText(), allOf(notNullValue())))
                Log.e(tag, "WebView ready (ion-app found)")
                Thread.sleep(1000) // 추가 렌더링 대기
                return true
            } catch (e: Exception) {
                try {
                    onWebView()
                        .withElement(findElement(Locator.TAG_NAME, "body"))
                        .check(WebViewAssertions.webMatches(getText(), allOf(notNullValue())))
                    Log.e(tag, "WebView ready (body found)")
                    Thread.sleep(1000)
                    return true
                } catch (e2: Exception) {
                    Thread.sleep(500)
                }
            }
        }
        throw AssertionError("WebView failed to load after ${timeoutMs}ms")
    }

    // ============ 내부 헬퍼 ============

    private fun clickByXPath(xpath: String, description: String): Boolean {
        try {
            onWebView()
                .withElement(findElement(Locator.XPATH, xpath))
                .perform(webClick())
            Log.e(tag, "Clicked $description (XPath: $xpath)")
            return true
        } catch (e: Exception) {
            Log.w(tag, "Click failed for $description (XPath: $xpath): ${e.message}")
            return false
        }
    }

    private fun clickById(id: String, description: String): Boolean {
        try {
            onWebView()
                .withElement(findElement(Locator.ID, id))
                .perform(webClick())
            Log.e(tag, "Clicked $description (aria-label/ID: $id)")
            return true
        } catch (e: Exception) {
            Log.w(tag, "Click by ID failed for $description: ${e.message}")
            return false
        }
    }

    private fun clickByTagName(tagName: String, description: String): Boolean {
        try {
            onWebView()
                .withElement(findElement(Locator.TAG_NAME, tagName))
                .perform(webClick())
            Log.e(tag, "Clicked $description (tag: $tagName)")
            return true
        } catch (e: Exception) {
            Log.w(tag, "Click by tag failed for $description: ${e.message}")
            return false
        }
    }

    private fun typeByXPath(xpath: String, text: String, description: String): Boolean {
        try {
            onWebView()
                .withElement(findElement(Locator.XPATH, xpath))
                .perform(webKeys(text))
            Log.e(tag, "Typed in $description (XPath: $xpath): $text")
            return true
        } catch (e: Exception) {
            Log.w(tag, "Type failed for $description (XPath: $xpath): ${e.message}")
            return false
        }
    }

    private fun typeById(id: String, text: String, description: String): Boolean {
        try {
            onWebView()
                .withElement(findElement(Locator.ID, id))
                .perform(webKeys(text))
            Log.e(tag, "Typed in $description (aria-label/ID: $id): $text")
            return true
        } catch (e: Exception) {
            Log.w(tag, "Type by ID failed for $description: ${e.message}")
            return false
        }
    }

    /** 선택자 체인 실행: 순서대로 시도, 성공 시 true 반환 */
    @SafeVarargs
    private final fun trySelectorChain(vararg actions: () -> Boolean): Boolean {
        for (action in actions) {
            if (action()) return true
        }
        return false
    }

    /** 디버깅용: 현재 페이지 제목 가져오기 */
    fun getPageTitle(): String? {
        try {
            var title: String? = null
            onWebView()
                .withElement(findElement(Locator.TAG_NAME, "title"))
                .check(WebViewAssertions.webMatches(getText(), allOf(notNullValue()))) {
                    title = it
                }
            return title
        } catch (e: Exception) {
            return null
        }
    }
}
```

---

## 2단계: TestDataFactory 신규 생성 (AutofillTestDataManager 대체)

### 파일: `android/app/src/androidTest/java/com/kiyo/app/autofill/testutil/TestDataFactory.kt`

```kotlin
package com.kiyo.app.autofill.testutil

import java.util.concurrent.atomic.AtomicLong

/**
 * 테스트별 유니크한 데이터 생성을 위한 팩토리.
 * 타임스탬프 + 카운터 조합으로 병렬 실행 시에도 충돌 방지.
 * 
 * 핵심: 자동완성 테스트 호스트 앱(`com.kiyo.autofilltest`)과 매칭되도록
 * 기본 `packageName`을 `com.kiyo.autofilltest`로 설정.
 * 
 * DB 조작, 키 생성, 암호화 등은 하지 않음 - 순수 데이터만 생성.
 */
object TestDataFactory {

    private val counter = AtomicLong(0)

    private fun nextId(): Long = System.currentTimeMillis() * 1000 + counter.incrementAndGet()

    data class VaultInfo(
        val fileName: String,
        val pin: String? = null
    )

    data class AccountInfo(
        val title: String,
        val websiteUrl: String,
        val domain: String,
        val packageName: String,  // 자동완성 매칭용 패키지명 (필수)
        val username: String,
        val password: String,
        val memo: String? = null
    )

    /** 유니크한 볼트 파일명 생성 (암호화/비암호화 구분 가능) */
    fun uniqueVaultName(encrypted: Boolean = true): String {
        val prefix = if (encrypted) "e2e-vault-enc" else "e2e-vault-plain"
        return "$prefix-${nextId()}.json"
    }

    /** 유니크한 계정 정보 생성
     *  - 기본 packageName: "com.kiyo.autofilltest" (테스트 호스트 앱 패키지)
     *  - 이 패키지명으로 계정을 생성해야 테스트 호스트에서 자동완성 드롭다운에 나타남
     */
    fun uniqueAccount(
        domain: String = "example.com",
        packageName: String = "com.kiyo.autofilltest"  // 테스트 호스트 앱과 매칭
    ): AccountInfo {
        val id = nextId()
        return AccountInfo(
            title = "Test Account $id",
            websiteUrl = "https://$domain",
            domain = domain,
            packageName = packageName,
            username = "user$id",
            password = "pass$id",
            memo = "Test memo $id"
        )
    }

    /** 특정 도메인/패키지명으로 계정 생성 */
    fun accountForDomain(
        domain: String,
        packageName: String = "com.kiyo.autofilltest"
    ): AccountInfo {
        return uniqueAccount(domain, packageName)
    }

    /** 다중 계정 생성 (동일 도메인, 동일 패키지명) */
    fun multipleAccountsForDomain(
        count: Int,
        domain: String,
        packageName: String = "com.kiyo.autofilltest"
    ): List<AccountInfo> {
        return (1..count).map { i ->
            val id = nextId()
            AccountInfo(
                title = "Test Account $id-$i",
                websiteUrl = "https://$domain",
                domain = domain,
                packageName = packageName,
                username = "user$id-$i",
                password = "pass$id-$i"
            )
        }
    }

    /** PIN 생성 (4자리) */
    fun randomPin(): String = String.format("%04d", (1000..9999).random())

    /** 테스트용 고정 PIN (디버깅용) */
    const val TEST_PIN = "1234"
}
```

> **Note**: `AutofillTestDataManager.kt`는 **삭제**함. 고정 테스트 키로 Keystore를 우회하는 방식은 실제 사용자 플로우와 다르고 보안 검증이 불가능하므로 E2E 테스트에서 사용하지 않음.

---

## 3단계: AutofillTestHost 래퍼 (네이티브 인증 프롬프트 처리 포함)

### 파일: `android/app/src/androidTest/java/com/kiyo/app/autofill/testutil/AutofillTestHost.kt`

```kotlin
package com.kiyo.app.autofill.testutil

import android.content.Context
import android.content.Intent
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until

/**
 * 자동완성 테스트 호스트 앱(AutofillTestHostActivity) 제어 래퍼.
 * 네이티브 시스템 인증 프롬프트(지문/얼굴/PIN/패턴) 감지/처리 포함.
 */
class AutofillTestHost(private val device: UiDevice) {

    companion object {
        const val PACKAGE = "com.kiyo.autofilltest"
        const val ACTIVITY = "com.kiyo.autofilltest.AutofillTestHostActivity"
        const val EXTRA_DOMAIN_HINT = "domain_hint"
    }

    private val context: Context = InstrumentationRegistry.getInstrumentation().targetContext

    /** 테스트 호스트 앱 실행 (도메인 힌트 전달) */
    fun launch(domainHint: String = "example.com"): UiObject2 {
        val intent = Intent().apply {
            setClassName(PACKAGE, ACTIVITY)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            putExtra(EXTRA_DOMAIN_HINT, domainHint)
        }
        context.startActivity(intent)

        // 앱 포그라운드 대기
        device.wait(Until.hasObject(By.pkg(PACKAGE).depth(0)), 10000)
        Thread.sleep(1000)

        return device.wait(Until.hasObject(By.pkg(PACKAGE)), 5000)
    }

    /** 사용자명 필드 찾아 클릭 (자동완성 트리거) */
    fun clickUsernameField(): UiObject2 {
        val field = device.wait(
            Until.findObject(By.clazz("android.widget.EditText")
                .hint("example@email.com")
                .enabled(true)),
            10000
        ) ?: throw AssertionError("Username field not found")
        field.click()
        return field
    }

    /** 비밀번호 필드 찾아 반환 */
    fun getPasswordField(): UiObject2 {
        return device.wait(
            Until.findObject(By.clazz("android.widget.EditText")
                .hint("비밀번호")
                .enabled(true)),
            5000
        ) ?: throw AssertionError("Password field not found")
    }

    /** 자동완성 드롭다운에서 특정 계정 선택 */
    fun selectAutofillSuggestion(username: String): UiObject2 {
        val suggestion = device.wait(
            Until.findObject(By.text(username).clazz("android.widget.TextView")),
            15000
        ) ?: throw AssertionError("Autofill dropdown not found for: $username")
        suggestion.click()
        Thread.sleep(500)
        return suggestion
    }

    /** 자동완성 드롭다운 표시 여부 확인 */
    fun isAutofillDropdownVisible(username: String): Boolean {
        return device.wait(
            Until.findObject(By.text(username).clazz("android.widget.TextView")),
            5000
        ) != null
    }

    /** 비밀번호가 자동완성되었는지 검증 */
    fun verifyPasswordFilled(expectedPassword: String): Boolean {
        val passwordField = getPasswordField()
        return passwordField.text.toString() == expectedPassword
    }

    // ============ 네이티브 인증 프롬프트 처리 ============

    /** 네이티브 인증 프롬프트(지문/얼굴/PIN/패턴) 대기
     *  - Keyguard 시스템 다이얼로그
     *  - BiometricPrompt 다이얼로그
     *  - 시스템 UI 오버레이
     */
    fun waitForNativeAuthPrompt(timeoutMs: Long = 20000): Boolean {
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            // Keyguard 호스트 뷰 (PIN/패턴 입력 화면)
            if (device.hasObject(By.clazz("android.app.KeyguardHostView"))) {
                Log.e("AutofillTestHost", "Native auth prompt detected: KeyguardHostView")
                return true
            }
            // 시스템 UI 인증 다이얼로그 (생체인증 등) - descContains 대신 desc 체이닝 사용
            if (device.hasObject(By.pkg("com.android.systemui")
                .clazz("android.widget.FrameLayout")
                .desc("지문").or(By.desc("얼굴")).or(By.desc("PIN")).or(By.desc("패턴")))) {
                Log.e("AutofillTestHost", "Native auth prompt detected: SystemUI biometric")
                return true
            }
            // BiometricPrompt 다이얼로그 일반적 패턴
            if (device.hasObject(By.desc("지문").or(By.desc("얼굴")).or(By.desc("PIN")).or(By.desc("패턴")))) {
                Log.e("AutofillTestHost", "Native auth prompt detected: BiometricPrompt")
                return true
            }
            Thread.sleep(300)
        }
        Log.w("AutofillTestHost", "Native auth prompt not detected within ${timeoutMs}ms")
        return false
    }

    /** 네이티브 인증 프롬프트에서 PIN 입력 (에뮬레이터/테스트용)
     *  - 실제 디바이스에서는 생체인증 권장
     *  - 에뮬레이터: adb -e emu finger touch 1 로 생체인증 시뮬레이션 가능
     */
    fun inputPinInNativeAuthPrompt(pin: String): Boolean {
        try {
            // PIN 입력 필드 찾기 (Keyguard)
            val pinField = device.wait(
                Until.findObject(By.clazz("android.widget.EditText")
                    .hint("PIN").or(By.desc("PIN"))),
                5000
            )
            pinField?.setText(pin)
            Thread.sleep(500)

            // 확인/엔터 버튼 클릭
            val confirmBtn = device.findObject(By.text("확인").clazz("android.widget.Button"))
                ?: device.findObject(By.desc("확인").clazz("android.widget.Button"))
                ?: device.findObject(By.clazz("android.widget.Button").clickable(true))
            confirmBtn?.click()
            Thread.sleep(1000)
            return true
        } catch (e: Exception) {
            Log.w("AutofillTestHost", "Failed to input PIN in native auth prompt: ${e.message}")
            return false
        }
    }

    /** 네이티브 인증 프롬프트 취소/닫기 (테스트 시나리오용) */
    fun dismissNativeAuthPrompt(): Boolean {
        try {
            val cancelBtn = device.findObject(By.text("취소").clazz("android.widget.Button"))
                ?: device.findObject(By.desc("취소").clazz("android.widget.Button"))
                ?: device.findObject(By.text("Cancel").clazz("android.widget.Button"))
            cancelBtn?.click()
            Thread.sleep(500)
            return true
        } catch (e: Exception) {
            Log.w("AutofillTestHost", "Failed to dismiss native auth prompt: ${e.message}")
            return false
        }
    }

    /** 생체인증 시뮬레이션 (에뮬레이터 전용)
     *  사전 조건: adb -e emu finger touch 1
     */
    fun simulateBiometricAuth(): Boolean {
        try {
            // 에뮬레이터에서 지문 인증 시뮬레이션 버튼 클릭 시도
            val fingerBtn = device.findObject(By.desc("지문").clazz("android.widget.Button"))
                ?: device.findObject(By.text("지문").clazz("android.widget.Button"))
            fingerBtn?.click()
            Thread.sleep(1000)
            return true
        } catch (e: Exception) {
            Log.w("AutofillTestHost", "Biometric simulation not available: ${e.message}")
            return false
        }
    }
}
```

---

## 4단계: Page Object 클래스들

### 4-1. BasePage.kt
```kotlin
package com.kiyo.app.autofill.pageobjects

import com.kiyo.app.autofill.testutil.WebViewTestHelper

abstract class BasePage(protected val helper: WebViewTestHelper) {
    protected fun log(action: String) {
        Log.e(javaClass.simpleName, action)
    }
}
```

### 4-2. HomePage.kt (파일 선택/생성 화면)
```kotlin
package com.kiyo.app.autofill.pageobjects

import com.kiyo.app.autofill.testutil.WebViewTestHelper

class HomePage(helper: WebViewTestHelper) : BasePage(helper) {

    /** "파일 생성" 버튼 클릭 -> 볼트 생성 다이얼로그 열기 */
    fun clickCreateVaultButton(): VaultCreatePage {
        log("Clicking '파일 생성' button")
        helper.clickByText("파일 생성", "create vault button")
            .also { if (!it) helper.clickByAriaLabel("파일 생성", "create vault button") }
            .also { if (!it) helper.clickByIonicTag("ion-fab-button", "FAB") }
            ?: throw AssertionError("Could not find '파일 생성' button")
        return VaultCreatePage(helper)
    }

    /** 기존 볼트 파일 클릭하여 열기 (파일명 기준) */
    fun openVault(fileName: String): AccountsPage {
        log("Opening vault: $fileName")
        helper.clickByText(fileName, "vault file")
            ?: throw AssertionError("Vault file not found: $fileName")
        return AccountsPage(helper)
    }

    /** 홈 화면 로드 대기 */
    fun waitForLoad(): HomePage {
        helper.waitForWebViewReady()
        helper.waitForText("파일 생성") // "파일 생성" 버튼이 보이면 로드 완료
        return this
    }
}
```

### 4-3. VaultCreatePage.kt (볼트 생성 다이얼로그 - PIN 입력 포함)
```kotlin
package com.kiyo.app.autofill.pageobjects

import com.kiyo.app.autofill.testutil.WebViewTestHelper

class VaultCreatePage(helper: WebViewTestHelper) : BasePage(helper) {

    /** 비암호화 볼트 생성: 파일명 입력, 암호화 체크 해제, 생성 버튼 클릭 */
    @DiscardableResult
    fun createVault(fileName: String, encrypted: Boolean = true): AccountsPage {
        log("Creating vault: $fileName (encrypted=$encrypted)")

        // 다이얼로그 열림 대기
        helper.waitForText("파일명") // 플레이스홀더 또는 라벨

        // 파일명 입력 (플레이스홀더 기준)
        helper.typeByPlaceholder("파일명", fileName, "vault name input")
            ?: throw AssertionError("Could not find vault name input")

        // 암호화 체크박스 처리
        if (!encrypted) {
            // 체크박스 라벨 클릭으로 토글 (실제 사용자 방식)
            helper.clickByText("파일 암호화 사용", "encrypt checkbox label")
                ?: helper.clickByXPath("//input[@type='checkbox']", "encrypt checkbox")
                ?: throw AssertionError("Could not find encrypt checkbox")
        } else {
            // 암호화 시 PIN 입력 필드 나타남 - PIN 입력
            // FileCreateDialog.tsx: type="password", inputMode="numeric", maxLength=6, placeholder="6자리 PIN"
            helper.typeByPlaceholder("6자리 PIN", TestDataFactory.TEST_PIN, "PIN input")
                ?: helper.typeByInputType("password", TestDataFactory.TEST_PIN, "PIN input (type=password)")
                ?: throw AssertionError("Could not find PIN input for encrypted vault")
        }

        // "생성" 버튼 클릭
        helper.clickByText("생성", "confirm create button")
            ?: throw AssertionError("Could not find '생성' button")

        // 계정 리스트 페이지로 전환 대기
        return AccountsPage(helper).waitForLoad()
    }

    /** 암호화 볼트 생성 편의 메서드 */
    fun createEncryptedVault(fileName: String, pin: String = TestDataFactory.TEST_PIN): AccountsPage {
        log("Creating encrypted vault: $fileName with PIN")
        helper.waitForText("파일명")
        helper.typeByPlaceholder("파일명", fileName, "vault name input")
            ?: throw AssertionError("Could not find vault name input")
        helper.typeByPlaceholder("6자리 PIN", pin, "PIN input")
            ?: helper.typeByInputType("password", pin, "PIN input")
            ?: throw AssertionError("Could not find PIN input")
        helper.clickByText("생성", "confirm create button")
            ?: throw AssertionError("Could not find '생성' button")
        return AccountsPage(helper).waitForLoad()
    }

    /** 취소 버튼 클릭 */
    fun cancel(): HomePage {
        log("Cancelling vault creation")
        helper.clickByText("취소", "cancel button")
            ?: throw AssertionError("Could not find cancel button")
        return HomePage(helper)
    }
}
```

### 4-4. AccountsPage.kt (계정 리스트 화면)
```kotlin
package com.kiyo.app.autofill.pageobjects

import com.kiyo.app.autofill.testutil.WebViewTestHelper

class AccountsPage(helper: WebViewTestHelper) : BasePage(helper) {

    /** 페이지 로드 대기 (FAB 또는 계정 리스트 표시) */
    fun waitForLoad(): AccountsPage {
        helper.waitForWebViewReady()
        // FAB 버튼(aria-label="Add account" 또는 "+") 또는 "내 계정" 텍스트 대기
        val loaded = helper.waitForElement("//button[@aria-label='Add account']", 10000)
            || helper.waitForElement("//button[contains(text(), '+')]", 5000)
            || helper.waitForText("내 계정", 5000)
            || helper.waitForText("계정", 5000)
        if (!loaded) {
            throw AssertionError("Accounts page did not load - no FAB or account list found")
        }
        log("Accounts page loaded")
        return this
    }

    /** "+" FAB 클릭 -> 계정 생성 화면 */
    fun clickAddAccount(): AccountCreatePage {
        log("Clicking add account FAB")
        helper.clickByAriaLabel("Add account", "add account FAB")
            ?: helper.clickByText("+", "add account FAB")
            ?: helper.clickByIonicTag("ion-fab-button", "FAB")
            ?: throw AssertionError("Could not find add account FAB")
        return AccountCreatePage(helper)
    }

    /** 특정 계정 항목 클릭 (제목 기준) */
    fun clickAccount(title: String): AccountDetailPage {
        log("Clicking account: $title")
        helper.clickByText(title, "account item")
            ?: throw AssertionError("Account not found: $title")
        return AccountDetailPage(helper)
    }

    /** 계정 존재 여부 확인 */
    fun hasAccount(title: String): Boolean {
        return helper.waitForText(title, 3000)
    }
}
```

### 4-5. AccountCreatePage.kt (계정 생성/편집 화면)
```kotlin
package com.kiyo.app.autofill.pageobjects

import com.kiyo.app.autofill.testutil.WebViewTestHelper
import com.kiyo.app.autofill.testutil.TestDataFactory

class AccountCreatePage(helper: WebViewTestHelper) : BasePage(helper) {

    data class AccountData(
        val title: String = "Test Account",
        val websiteUrl: String = "https://example.com",
        val username: String = "testuser",
        val password: String = "testpass123",
        val memo: String? = null,
        // packageName은 웹 UI에서 입력하지 않음 (React 계정 생성 화면에 없음)
        // 자동완성 동기화 시 repository 레벨에서 설정됨
    )

    /** 템플릿 선택 (기본 템플릿) */
    fun selectDefaultTemplate(): AccountCreatePage {
        log("Selecting default template")
        helper.clickByText("기본 템플릿", "default template")
            ?: helper.clickByText("Default Template", "default template (EN)")
            ?: helper.clickByText("새 계정", "new account")
            ?: throw AssertionError("Could not find default template option")
        return this
    }

    /** 계정 폼 작성 (웹 UI에 표시되는 필드만) */
    fun fillAccount(data: AccountData): AccountCreatePage {
        log("Filling account form: ${data.title}")

        // 제목 (플레이스홀더: "제목" 또는 "Title")
        helper.typeByPlaceholder("제목", data.title, "title input")
            ?: helper.typeByPlaceholder("Title", data.title, "title input (EN)")
            ?: throw AssertionError("Could not find title input")

        // 웹사이트 URL (플레이스홀더: "웹사이트" 또는 "Website")
        helper.typeByPlaceholder("웹사이트", data.websiteUrl, "website input")
            ?: helper.typeByPlaceholder("Website", data.websiteUrl, "website input (EN)")
            ?: throw AssertionError("Could not find website input")

        // 사용자명/이메일 (여러 플레이스홀더 시도)
        val usernameEntered = helper.typeByPlaceholder("이메일", data.username, "username input")
            ?: helper.typeByPlaceholder("Email", data.username, "username input (EN)")
            ?: helper.typeByPlaceholder("사용자", data.username, "username input (alt)")
            ?: helper.typeByInputType("email", data.username, "email input")
            ?: throw AssertionError("Could not find username/email input")

        // 비밀번호 (플레이스홀더: "비밀번호" 또는 "Password", 타입: password)
        val passwordEntered = helper.typeByPlaceholder("비밀번호", data.password, "password input")
            ?: helper.typeByPlaceholder("Password", data.password, "password input (EN)")
            ?: helper.typeByInputType("password", data.password, "password input")
            ?: throw AssertionError("Could not find password input")

        // 메모 (선택사항)
        data.memo?.let { memo ->
            helper.typeByPlaceholder("메모", memo, "memo input")
                ?: helper.typeByPlaceholder("Memo", memo, "memo input (EN)")
        }

        return this
    }

    /** "저장" 버튼 클릭 -> 계정 리스트로 복귀 */
    @DiscardableResult
    fun save(): AccountsPage {
        log("Saving account")
        helper.clickByText("저장", "save button")
            ?: helper.clickByText("Save", "save button (EN)")
            ?: throw AssertionError("Could not find save button")
        return AccountsPage(helper).waitForLoad()
    }

    /** 취소 */
    fun cancel(): AccountsPage {
        log("Cancelling account creation")
        helper.clickByText("취소", "cancel button")
            ?: helper.clickByText("Cancel", "cancel button (EN)")
            ?: throw AssertionError("Could not find cancel button")
        return AccountsPage(helper).waitForLoad()
    }
}
```

### 4-6. TemplatePickerPage.kt (템플릿 선택 화면)
```kotlin
package com.kiyo.app.autofill.pageobjects

import com.kiyo.app.autofill.testutil.WebViewTestHelper

class TemplatePickerPage(helper: WebViewTestHelper) : BasePage(helper) {

    fun selectTemplate(templateName: String): AccountCreatePage {
        log("Selecting template: $templateName")
        helper.clickByText(templateName, "template option")
            ?: throw AssertionError("Template not found: $templateName")
        return AccountCreatePage(helper)
    }

    fun selectDefaultTemplate(): AccountCreatePage = selectTemplate("기본 템플릿")
}
```

### 4-7. SettingsPage.kt (설정 화면 - 자동완성 섹션)
```kotlin
package com.kiyo.app.autofill.pageobjects

import com.kiyo.app.autofill.testutil.WebViewTestHelper
import com.kiyo.app.autofill.testutil.AutofillTestHost

class SettingsPage(helper: WebViewTestHelper, private val testHost: AutofillTestHost) : BasePage(helper) {

    /** 설정 화면으로 네비게이션 (하단 탭에서 설정 탭 클릭) */
    fun navigateToSettings(): SettingsPage {
        log("Navigating to Settings tab")
        // 하단 탭의 설정 아이콘/라벨 클릭
        helper.clickByAriaLabel("설정", "settings tab")
            ?: helper.clickByText("설정", "settings tab")
            ?: helper.clickByText("Settings", "settings tab (EN)")
            ?: throw AssertionError("Could not find Settings tab")
        helper.waitForText("자동완성") // 자동완성 섹션 헤더 대기
        return this
    }

    /** 자동완성 섹션의 "동기화" 버튼 클릭
     *  - 최초 실행 시 네이티브 인증 프롬프트 발생 (Keystore 30분 캐시 만료 시)
     *  - 인증 완료 후 동기화 진행
     */
    @DiscardableResult
    fun clickSyncAccounts(): SettingsPage {
        log("Clicking sync accounts button")
        // "동기화" 버튼 (비활성화 상태일 수 있음 - syncing 중이면)
        helper.clickByText("동기화", "sync accounts button")
            ?: helper.clickByText("동기화 중...", "sync accounts button (loading)")
            ?: helper.clickByText("Sync", "sync accounts button (EN)")
            ?: throw AssertionError("Could not find sync accounts button")

        // 동기화 완료 대기 (네이티브 인증 프롬프트 처리 포함 최대 60초)
        waitForSyncCompleteWithNativeAuth()
        return this
    }

    /** 동기화 완료 대기 (네이티브 인증 프롬프트 처리 포함) */
    fun waitForSyncCompleteWithNativeAuth(timeoutMs: Long = 60000): Boolean {
        log("Waiting for sync to complete (with native auth handling)...")
        val startTime = System.currentTimeMillis()

        while (System.currentTimeMillis() - startTime < timeoutMs) {
            // 1. 동기화 완료 메시지 확인 (토스트 또는 스낵바)
            if (helper.waitForText("동기화 완료", 500)) {
                log("Sync completed successfully")
                return true
            }
            if (helper.waitForText("자동완성 계정", 500) && helper.waitForText("개 동기화 완료", 500)) {
                log("Sync completed with count message")
                return true
            }

            // 2. 네이티브 인증 프롬프트 감지 및 처리
            if (testHost.waitForNativeAuthPrompt(2000)) {
                log("Native auth prompt detected - waiting for user auth")
                // 실제 테스트에서는: 테스트 환경에 따라 PIN 입력 또는 생체인증 시뮬레이션
                // 예: testHost.inputPinInNativeAuthPrompt(TestDataFactory.TEST_PIN)
                // 또는: testHost.simulateBiometricAuth() (에뮬레이터에서 adb -e emu finger touch 1 필요)
                // 여기서는 대기만 하고 실제 입력은 테스트 케이스에서 수행
                Thread.sleep(2000)
                continue
            }

            // 3. 기타 에러 확인
            if (helper.waitForText("동기화 실패", 500) || helper.waitForText("인증이 취소", 500)) {
                log("Sync failed or auth cancelled")
                return false
            }

            // 4. 동기화 중 상태면 계속 대기
            if (helper.waitForText("동기화 중", 500)) {
                Thread.sleep(1000)
                continue
            }

            Thread.sleep(500)
        }

        log("Timeout waiting for sync completion")
        return false
    }

    /** 자동완성 활성화 토글 상태 확인 */
    fun isAutofillEnabled(): Boolean {
        // 토글 스위치 상태 확인 (role="switch", aria-checked)
        // 구현 필요시 추가
        return true
    }

    /** 자동완성 서비스 상태 텍스트 확인 */
    fun getAutofillServiceStatus(): String? {
        // "KIYO 자동완성 활성화됨" 또는 "다른 자동완성 서비스 사용 중" 등
        return null // 구현 필요시 추가
    }

    /** 저장된 계정 수 확인 (KIYO 앱 / 자동완성 DB) */
    fun getAccountCounts(): Pair<Int, Int> {
        // "KIYO 앱: X개 / 자동완성 DB: Y개" 파싱
        return Pair(0, 0) // 구현 필요시 추가
    }

    /** 마지막 동기화 시간 확인 */
    fun getLastSyncTime(): String? {
        // "마지막 동기화" 행의 시간 텍스트
        return null // 구현 필요시 추가
    }
}
```

---

## 5단계: 리팩토링된 AutofillE2ETest.kt

```kotlin
package com.kiyo.app.autofill

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.util.Log
import android.view.autofill.AutofillManager
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.kiyo.app.autofill.pageobjects.AccountsPage
import com.kiyo.app.autofill.pageobjects.HomePage
import com.kiyo.app.autofill.repository.AutofillRepository
import com.kiyo.app.autofill.testutil.AutofillTestHost
import com.kiyo.app.autofill.testutil.TestDataFactory
import com.kiyo.app.autofill.testutil.WebViewTestHelper
import com.kiyo.app.testutil.DeviceLockHelper
import com.kiyo.app.testutil.TestSecurityInitializer
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AutofillE2ETest {

    private lateinit var device: UiDevice
    private lateinit var context: Context
    private lateinit var autofillManager: AutofillManager
    private lateinit var helper: WebViewTestHelper
    private lateinit var homePage: HomePage
    private lateinit var accountsPage: AccountsPage
    private lateinit var settingsPage: SettingsPage
    private lateinit var testHost: AutofillTestHost

    // 테스트 데이터 (팩토리에서 생성)
    private lateinit var vaultName: String
    private lateinit var account: TestDataFactory.AccountInfo
    private val testPin = TestDataFactory.TEST_PIN

    @Before
    fun setup() {
        Log.e("AUTOFILL_E2E", "SETUP START")
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        context = ApplicationProvider.getApplicationContext<Context>()
        autofillManager = context.getSystemService(AutofillManager::class.java)
        helper = WebViewTestHelper("AutofillE2ETest")
        testHost = AutofillTestHost(device)

        // 테스트 데이터 생성
        vaultName = TestDataFactory.uniqueVaultName(encrypted = false) // 비암호화로 단순화
        account = TestDataFactory.accountForDomain("example.com")

        // 디바이스 언락 확인
        DeviceLockHelper.assertUnlocked()

        // 보안 환경 초기화 (Keystore 키 유지 - 디바이스가 언락되어 있으므로)
        TestSecurityInitializer.initializeCleanEnvironment(context, recreateKeystoreKeys = false)
        TestSecurityInitializer.logEnvironmentState(context)

        // 자동완성 서비스 활성화 확인
        val targetContext = InstrumentationRegistry.getInstrumentation().targetContext
        val currentService = Settings.Secure.getString(targetContext.contentResolver, "autofill_service")
        Log.e("AUTOFILL_E2E", "currentService: $currentService")
        val expectedService = "com.kiyo.app/com.kiyo.app.autofill.service.KiyoAutofillService"
        assertEquals("KIYO autofill service must be enabled via ADB", expectedService, currentService)

        // 메인 액티비티 실행
        val intent = Intent().apply {
            setClassName("com.kiyo.app", "com.kiyo.app.MainActivity")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        context.startActivity(intent)

        device.wait(Until.hasObject(By.pkg("com.kiyo.app").depth(0)), 15000)
        Thread.sleep(3000) // 초기 로드 대기

        // 페이지 오브젝트 초기화
        homePage = HomePage(helper).waitForLoad()
        accountsPage = AccountsPage(helper)
        settingsPage = SettingsPage(helper, testHost)

        Log.e("AUTOFILL_E2E", "SETUP END - Ready")
    }

    /**
     * Test A: 비암호화 볼트 생성 -> 계정 생성 -> 동기화 -> 자동완성 검증
     * (Keystore 30분 캐시 내라면 인증 프롬프트 없이 통과)
     */
    @Test
    fun `E2E_A_CreateVaultCreateAccountSyncAndVerifyAutofill`() {
        // Step 1: 볼트 생성 (비암호화)
        Log.e("AUTOFILL_E2E", "Step 1: Create vault via WebView")
        accountsPage = homePage.clickCreateVaultButton()
            .createVault(vaultName, encrypted = false)

        // Step 2: 계정 생성
        Log.e("AUTOFILL_E2E", "Step 2: Create test account via WebView")
        accountsPage = accountsPage.clickAddAccount()
            .selectDefaultTemplate()
            .fillAccount(TestDataFactory.AccountInfo(
                title = "Test Account",
                websiteUrl = account.websiteUrl,
                username = account.username,
                password = account.password
            ))
            .save()

        // Step 3: 자동완성 서비스에 계정 동기화
        Log.e("AUTOFILL_E2E", "Step 3: Sync accounts to autofill service")
        syncAccountsToAutofillService()

        // Step 4: 테스트 호스트에서 자동완성 검증
        Log.e("AUTOFILL_E2E", "Step 4: Launch test host and verify autofill")
        verifyAutofillInTestHost()

        Log.e("AUTOFILL_E2E", "E2E Test A completed successfully")
    }

    /**
     * Test B: 암호화 볼트 + PIN 잠금해제 -> 자동완성 (추후 추가)
     */
    // @Test
    // fun `E2E_B_EncryptedVaultPinUnlockAndAutofill`() { ... }

    /**
     * Test C: 생체인증 볼트 잠금해제 -> 자동완성 (추후 추가)
     */
    // @Test
    // fun `E2E_C_BiometricVaultUnlockAndAutofill`() { ... }

    /**
     * Test D: 자동잠금 트리거 -> 자동완성 차단 확인 (추후 추가)
     */
    // @Test
    // fun `E2E_D_AutoLockBlocksAutofillUntilUnlock`() { ... }

    /**
     * Test F: 패키지명 매칭 검증 (앱 자동완성) - packageNames 기능 검증
     */
    // @Test
    // fun `E2E_F_PackageNameMatchingForAppAutofill`() { ... }

    private fun syncAccountsToAutofillService() = runBlocking {
        val dbKey = com.kiyo.app.security.DatabaseKeyManager.getKey(context).encoded
        val repository = AutofillRepository.create(context, dbKey)

        val accountsJson = """
            [{
                "id": 1,
                "title": "${account.title}",
                "websiteUrl": "${account.websiteUrl}",
                "domain": "${account.domain}",
                "packageName": "${account.packageName}",
                "packageNames": ["${account.packageName}"],
                "fields": [
                    {"id": "1", "label": "Username", "type": "email", "value": "${account.username}", "order": 0},
                    {"id": "2", "label": "Password", "type": "password", "value": "${account.password}", "order": 1}
                ],
                "favorite": false,
                "createdAt": ${System.currentTimeMillis()},
                "updatedAt": ${System.currentTimeMillis()}
            }]
        """.trimIndent()

        val result = repository.syncAccountsFromReact(accountsJson)
        val synced = result.first
        val errors = result.second
        Log.e("AUTOFILL_E2E", "Synced $synced accounts, errors: $errors")
        assertTrue("Should sync 1 account", synced == 1)
        repository.close()
    }

    private fun verifyAutofillInTestHost() {
        testHost.launch(account.domain)

        // 사용자명 필드 클릭하여 자동완성 트리거
        testHost.clickUsernameField()

        // 자동완성 드롭다운에서 계정 선택
        testHost.selectAutofillSuggestion(account.username)

        // 비밀번호 자동완성 검증
        assertTrue("Password should be autofilled", testHost.verifyPasswordFilled(account.password))
        Log.e("AUTOFILL_E2E", "Autofill verified: username and password filled correctly")
    }
}
```

---

## 6단계: 추가 테스트 케이스 구현 계획

### E2E_B: 암호화 볼트 + PIN 잠금해제
```kotlin
@Test
fun `E2E_B_EncryptedVaultPinUnlockAndAutofill`() {
    // 1. 암호화 볼트 생성 (PIN 입력)
    val vaultName = TestDataFactory.uniqueVaultName(encrypted = true)
    val pin = TestDataFactory.randomPin()
    accountsPage = homePage.clickCreateVaultButton()
        .createEncryptedVault(vaultName, pin)

    // 2. 앱 재시작 시뮬레이션 (프로세스 킬 후 재실행)
    // 3. 네이티브 시스템 인증 프롬프트(Keyguard)에서 PIN 입력으로 잠금해제
    // 4. 계정 생성 및 자동완성 검증
}
```

### E2E_C: 생체인증 볼트 잠금해제
```kotlin
@Test
fun `E2E_C_BiometricVaultUnlockAndAutofill`() {
    // 1. 생체인증으로 볼트 잠금해제 플로우
    // 2. BiometricPrompt 처리 (에뮬레이터: adb -e emu finger touch 1)
    // 3. 자동완성 검증
}
```

### E2E_D: 자동잠금 차단 확인
```kotlin
@Test
fun `E2E_D_AutoLockBlocksAutofillUntilUnlock`() {
    // 1. 자동잠금 설정 (1분)
    // 2. 계정 생성 및 동기화
    // 3. 자동잠금 트리거 (시간 경과 시뮬레이션 또는 백그라운드 이동)
    // 4. 자동완성 요청 시 차단됨 확인
    // 5. 재잠금해제 후 자동완성 동작 확인
}
```

### E2E_F: 패키지명 매칭 검증 (앱 자동완성)
```kotlin
@Test
fun `E2E_F_PackageNameMatchingForAppAutofill`() {
    // 목적: packageName="com.kiyo.autofilltest"인 계정이
    //       테스트 호스트 앱(동일 패키지)에서 자동완성되는지 검증

    // 1. 볼트 생성 및 계정 생성 (packageName = "com.kiyo.autofilltest")
    val vaultName = TestDataFactory.uniqueVaultName(encrypted = false)
    val account = TestDataFactory.accountForDomain("example.com")  // packageName 자동 설정됨

    accountsPage = homePage.clickCreateVaultButton()
        .createVault(vaultName, encrypted = false)

    accountsPage = accountsPage.clickAddAccount()
        .selectDefaultTemplate()
        .fillAccount(TestDataFactory.AccountData(
            title = account.title,
            websiteUrl = account.websiteUrl,
            username = account.username,
            password = account.password
        ))
        .save()

    // 2. 자동완성 서비스에 동기화 (packageName 포함)
    syncAccountsToAutofillService()  // JSON에 account.packageNames 포함

    // 3. 테스트 호스트 앱(동일 패키지)에서 자동완성 검증
    testHost.launch("example.com")
    testHost.clickUsernameField()
    testHost.selectAutofillSuggestion(account.username)
    assertTrue("Password should be autofilled for matching package",
               testHost.verifyPasswordFilled(account.password))

    // 4. 추가 검증: 다른 패키지명의 앱에서는 자동완성 안 됨 (선택사항)
    //    별도 테스트 앱 필요시 구현
}
```

### E2E_G: 도메인 매칭 변형 검증
```kotlin
@Test
fun `E2E_G_DomainMatchingVariants`() {
    // 서브도메인, 경로 변형 등 도메인 매칭 로직 검증
    // DomainMatcher 단위 테스트와 연계
}
```

### E2E_H: 미매칭 계정 - 드롭다운 없음
```kotlin
@Test
fun `E2E_H_NoMatchingAccountNoDropdown`() {
    // packageName이 다른 계정 생성 -> 테스트 호스트에서 드롭다운 안 나타남 확인
}
```

---

## 작업 순서 및 우선순위

| 순서 | 작업 | 파일 | 예상 소요 |
|------|------|------|-----------|
| 1 | `AutofillTestDataManager.kt` 삭제 | `testutil/AutofillTestDataManager.kt` | 0.1일 |
| 2 | `TestDataFactory` 생성 | `testutil/TestDataFactory.kt` | 0.25일 |
| 3 | `WebViewTestHelper` 생성 | `testutil/WebViewTestHelper.kt` | 0.5일 |
| 4 | `AutofillTestHost` 래퍼 생성 (네이티브 인증 처리 포함) | `testutil/AutofillTestHost.kt` | 0.5일 |
| 5 | Page Object 클래스들 생성 | `pageobjects/*.kt` (6개) | 1일 |
| 6 | `AutofillE2ETest` 리팩토링 | `AutofillE2ETest.kt` | 0.5일 |
| 7 | 로컬 실행 검증 및 디버깅 | - | 1일 |
| **합계** | | | **~3.85일** |

---

## 검증 체크리스트

### 리팩토링 후 확인 사항
- [ ] `E2E_A` 테스트가 기존과 동일하게 통과
- [ ] `Thread.sleep()` 호출이 최소화됨 (명시적 대기로 대체)
- [ ] 선택자 실패 시 로그에 어떤 선택자가 시도됐는지 명확히 출력
- [ ] 테스트 데이터가 매 실행마다 유니크함 (병렬 실행 가능)
- [ ] 페이지 오브젝트 메서드가 체이닝 가능 (가독성)
- [ ] 한국어/영어 UI 모두에서 동작 (선택자 체인에 둘 다 포함)
- [ ] `data-testid` 등 테스트 전용 속성 미사용 확인
- [ ] `AutofillTestDataManager` 삭제 확인 (백도어 키 방식 제거)
- [ ] 네이티브 인증 프롬프트 처리 로직 동작 확인

### 향후 확장성
- [ ] 새 테스트 추가 시 `TestDataFactory`만 호출하면 됨
- [ ] 새 화면 추가 시 Page Object만 추가하면 됨
- [ ] 선택자 전략 변경 시 `WebViewTestHelper`만 수정하면 됨

---

## 롤백 전략

리팩토링 중 기존 테스트가 깨질 경우:
1. `git stash`로 변경사항 임시 보관
2. 원본 `AutofillE2ETest.kt`로 복구하여 기존 테스트 통과 확인
3. 단계별로 적용하며 검증 (Helper → Page Objects → Test 리팩토링)

---

## 다음 액션

**1단계부터 시작: `AutofillTestDataManager.kt` 삭제 → `TestDataFactory.kt` 생성 → `WebViewTestHelper.kt` 생성**

이게 완료되면 Page Object와 테스트 리팩토링이 훨씬 수월해집니다. 바로 구현에 들어가시겠습니까?