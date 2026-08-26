package com.kiyo.app.autofill.testutil

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until
import java.io.File

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

    /** 테스트 호스트 앱 실행 (도메인 힌트 전달)
     *  - 항상 FLAG_ACTIVITY_CLEAR_TASK로 기존 태스크를 통째로 제거하고
     *    새 인스턴스(onCreate부터)로 시작한다 (조건부 재시작 시 누락되던 상태 초기화 보장)
     *  - 주의: launch 내부에서 필드 값을 선제적으로 클리어하지 않는다.
     *    field.text = "" 자체가 fill request를 발화시켜 드롭다운이 먼저 뜨고,
     *    이후 triggerAutofillRequest의 클릭이 드롭다운 항목을 오클릭하는 문제가 있었음 (검증됨 2026-08)
     */
    fun launch(domainHint: String = "example.com"): UiObject2 {
        val intent = Intent().apply {
            setClassName(PACKAGE, ACTIVITY)
            // CLEAR_TASK: 기존 태스크(이전 인스턴스 + autofill 복원 상태 포함) 완전 폐기 후 새 태스크
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            putExtra(EXTRA_DOMAIN_HINT, domainHint)
        }
        context.startActivity(intent)

        // 앱 포그라운드 대기 (새 인스턴스 = 무조건 onCreate에서 새로고침된 상태)
        device.wait(Until.hasObject(By.pkg(PACKAGE).depth(0)), 10000)

        // 앱 전환 완료 대기: AutofillService가 activityComponent를 올바르게
        // 인식하려면 윈도우 포커스가 testHost에 완전히 넘어간 후 필드 클릭 필요
        Thread.sleep(2000)

        val appWindow = device.findObject(By.pkg(PACKAGE))
            ?: throw AssertionError("Autofill test host app did not launch: $PACKAGE")

        // 진입 직후 자동완성 요청 유발 (포커스 전환 3-클릭)
        triggerAutofillRequest()
        return appWindow
    }

    /** username 필드 1회 클릭으로 onFillRequest 발화 유도
     *  - CLEAR_TASK 새 인스턴스이므로 초기화 상태가 보장됨 → 포커스 순환(3-클릭) 폴백 불필요
     *  - 3-클릭은 이미 뜬 드롭다운 항목을 오클릭하는 문제가 있어 제거함 (검증됨 2026-08)
     *  - 단, 일부 상황에서 1회 클릭만으로는 fill request가 발화하지 않을 수 있으므로
     *    포커스 이동 패턴(username → password → username) 사용
     */
    private fun triggerAutofillRequest() {
        try {
            val usernameField = device.wait(
                Until.findObject(By.clazz("android.widget.EditText")
                    .hint("example@email.com")
                    .enabled(true)),
                10000
            ) ?: return
            
            val passwordField = device.wait(
                Until.findObject(By.clazz("android.widget.EditText")
                    .hint("비밀번호")
                    .enabled(true)),
                5000
            ) ?: return

            // 1) username 클릭 (포커스 진입)
            usernameField.click()
            Thread.sleep(500)

            // 2) password 클릭 (포커스 이탈)
            passwordField.click()
            Thread.sleep(500)

            // 3) username 재클릭 (재진입 → 시스템이 onFillRequest 발화)
            usernameField.click()
            Thread.sleep(1500)
            
            Log.i("AutofillTestHost", "Autofill request triggered via focus cycle (3-click)")
        } catch (e: Exception) {
            Log.w("AutofillTestHost", "triggerAutofillRequest failed: ${e.message}")
        }
    }

    /** 사용자명 필드 찾아 클릭 (자동완성 트리거)
     *  - 기존 값이 남아있으면 먼저 클리어
     *  - 포커스 전환으로 자동완성 요청 유발: username 클릭 → password 클릭 → username 재클릭
     *    (최초 포커스만으로는 onFillRequest가 발화하지 않고,
     *     필드 간 포커스 이동 시 시스템이 새 fill request를 발행함)
     */
    fun clickUsernameField(): UiObject2 {
        val field = device.wait(
            Until.findObject(By.clazz("android.widget.EditText")
                .hint("example@email.com")
                .enabled(true)),
            10000
        ) ?: throw AssertionError("Username field not found")

        // 기존 값 클리어
        if (!field.text.isNullOrEmpty()) {
            field.text = ""
            Thread.sleep(300)
        }

        // 1) username 클릭 (포커스 진입)
        field.click()
        Thread.sleep(500)

        // 2) password 클릭 (포커스 이탈)
        val passwordField = getPasswordField()
        passwordField.click()
        Thread.sleep(500)

        // 3) username 재클릭 (재진입 → 시스템이 onFillRequest 발화)
        field.click()
        Thread.sleep(1500)

        return field
    }

    /** 비밀번호 필드 찾아 반환 */
    private fun getPasswordField(): UiObject2 {
        return device.wait(
            Until.findObject(By.clazz("android.widget.EditText")
                .hint("비밀번호")
                .enabled(true)),
            5000
        ) ?: throw AssertionError("Password field not found")
    }

    /** 자동완성 드롭다운에서 특정 계정 선택 */
    fun selectAutofillSuggestion(username: String): UiObject2 {
        // 드롭다운이 나타날 때까지 대기 (인증 응답 dataset 표시 지연 대응)
        waitForAutofillDropdown(username, timeoutMs = 30_000)
        val suggestion = device.wait(
            Until.findObject(By.text(username).clazz("android.widget.TextView")),
            15000
        ) ?: throw AssertionError("Autofill dropdown not found for: $username")
        // Dump before click (디버그 덤프 — 실패해도 본 검증은 계속)
        val timestamp = System.currentTimeMillis()
        val fileName = "uiautomator_selectAutofillSuggestion_before_click_$timestamp.xml"
        val internalFile = File("/data/user/0/com.kiyo/app/cache/$fileName")
        try {
            device.dumpWindowHierarchy(internalFile)
            // optional copy to download
            val externalPath = "/storage/emulated/0/Download/kiyo_test_$fileName"
            Runtime.getRuntime().exec("cp ${internalFile.absolutePath} $externalPath").waitFor()
        } catch (e: Exception) {
            Log.w("AutofillTestHost", "Failed to dump/copy view hierarchy: ${e.message}")
        }
        Log.i("AutofillTestHost", "VIEW_HIERARCHY: $fileName dumped for step: selectAutofillSuggestion_before_click")
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

    /** 자동완성 드롭다운이 나타날 때까지 대기 (인증 응답 dataset 표시 지연 대응) */
    fun waitForAutofillDropdown(username: String, timeoutMs: Long = 30_000): Boolean {
        val appeared = device.wait(
            Until.findObject(By.text(username).clazz("android.widget.TextView")),
            timeoutMs
        ) != null
        Log.i("AutofillTestHost", "waitForAutofillDropdown('$username'): $appeared")
        return appeared
    }

    /** 비밀번호가 자동완성되었는지 검증
     *  - password 타입 EditText는 UIAutomator에서 마스킹(•)으로만 보여서 평문 비교 불가
     *  - 마스킹 길이로 간접 검증: 예상 비밀번호 길이와 마스킹 문자 수 일치
     */
    fun verifyPasswordFilled(expectedPassword: String): Boolean {
        val passwordField = getPasswordField()
        val text = passwordField.text ?: ""
        // 마스킹된 경우 (• 문자들) - 길이로 간접 검증
        if (text.contains("•")) {
            val maskCount = text.count { it == '•' }
            val matched = maskCount == expectedPassword.length
            Log.i("AutofillTestHost", "Password masked: $maskCount chars, expected length ${expectedPassword.length}, match: $matched")
            return matched
        }
        // 마스킹 안 된 경우 평문 비교
        return text == expectedPassword
    }

    // ============ 네이티브 인증 프롬프트 처리 ============

    /** 네이티브 인증 프롬프트(지문/얼굴/PIN/패턴) 대기 */
    fun waitForNativeAuthPrompt(timeoutMs: Long = 20000): Boolean {
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            if (device.hasObject(By.clazz("android.app.KeyguardHostView"))) {
                Log.i("AutofillTestHost", "Native auth prompt detected: KeyguardHostView")
                return true
            }
            if (device.hasObject(By.desc("지문")) || device.hasObject(By.desc("얼굴")) ||
                device.hasObject(By.desc("PIN")) || device.hasObject(By.desc("패턴"))) {
                Log.i("AutofillTestHost", "Native auth prompt detected: BiometricPrompt")
                return true
            }
            Thread.sleep(300)
        }
        Log.w("AutofillTestHost", "Native auth prompt not detected within ${timeoutMs}ms")
        return false
    }

    /**
     * BiometricPrompt/Keyguard 크리덴셜 화면에 PIN을 키코드로 직접 입력.
     * 이 프롬프트는 접근성 트리에 노드가 노출되지 않아(보안 정책) UIAutomator 탐지가
     * 불가능하므로, 화면 상태와 무관하게 키코드 시퀀스를 보내는 방식을 쓴다 (검증됨 2026-08).
     * 숫자 입력 후 마지막에 ENTER로 확정한다.
     */
    fun inputPinViaKeyEvents(pin: String): Boolean {
        return try {
            for (ch in pin) {
                val keycode = when (ch) {
                    '0' -> android.view.KeyEvent.KEYCODE_0
                    '1' -> android.view.KeyEvent.KEYCODE_1
                    '2' -> android.view.KeyEvent.KEYCODE_2
                    '3' -> android.view.KeyEvent.KEYCODE_3
                    '4' -> android.view.KeyEvent.KEYCODE_4
                    '5' -> android.view.KeyEvent.KEYCODE_5
                    '6' -> android.view.KeyEvent.KEYCODE_6
                    '7' -> android.view.KeyEvent.KEYCODE_7
                    '8' -> android.view.KeyEvent.KEYCODE_8
                    '9' -> android.view.KeyEvent.KEYCODE_9
                    else -> return false
                }
                device.pressKeyCode(keycode)
                Thread.sleep(300)
            }
            device.pressEnter()
            Thread.sleep(500)
            Log.i("AutofillTestHost", "PIN entered via key events")
            true
        } catch (e: Exception) {
            Log.w("AutofillTestHost", "inputPinViaKeyEvents failed: ${e.message}")
            false
        }
    }
}
