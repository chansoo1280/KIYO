package com.kiyo.app.e2e.testutil

import android.util.Log
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice

/**
 * 네이티브 인증 프롬프트(BiometricPrompt/Keyguard 크리덴셜) 처리 계약과 구현체.
 *
 * 이 프롬프트는 접근성 트리에 노출되지 않아(보안 정책) UIAutomator 탐지가 불가능하므로,
 * 화면 상태와 무관하게 키코드를 보내는 디바이스 레벨 방식을 쓴다.
 * 호스트 앱(AutofillTestHostActivity)의 화면 조작은 pageobjects.AutofillLoginPage가
 * 담당한다 — 화면 레벨 / 디바이스 레벨 관심사 분리 (2026-08-28).
 *
 * 이 프롬프트는 접근성 트리에 노출되지 않아(보안 정책) UIAutomator 탐지가
 * 불가능하므로, 화면 상태와 무관하게 키코드를 보내는 디바이스 레벨 방식을 쓴다.
 * 화면 레벨 조작(호스트 앱 launch, 필드 클릭, 드롭다운 선택)은
 * pageobjects.AutofillLoginPage가 담당한다 — 관심사 분리 (2026-08-28).
 */
interface NativeAuthPrompt {
    /** 네이티브 인증 프롬프트(지문/얼굴/PIN/패턴) 대기 */
    fun waitForNativeAuthPrompt(timeoutMs: Long = 20000): Boolean

    /**
     * BiometricPrompt/Keyguard 크리덴셜 화면에 PIN을 키코드로 직접 입력.
     * 숫자 입력 후 마지막에 ENTER로 확정한다.
     */
    fun inputPinViaKeyEvents(pin: String): Boolean
}

class NativeAuthPromptHandler(private val device: UiDevice) : NativeAuthPrompt {

    companion object {
        /** 호스트 앱 식별 정보 (AutofillLoginPage.launch가 사용) */
        const val PACKAGE = "com.kiyo.autofilltest"
        const val ACTIVITY = "com.kiyo.autofilltest.AutofillTestHostActivity"
        private const val TAG = "NativeAuthPrompt"
    }

    /** 네이티브 인증 프롬프트(지문/얼굴/PIN/패턴) 대기 */
    override fun waitForNativeAuthPrompt(timeoutMs: Long): Boolean {
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            if (device.hasObject(By.clazz("android.app.KeyguardHostView"))) {
                Log.i(TAG, "Native auth prompt detected: KeyguardHostView")
                return true
            }
            if (device.hasObject(By.desc("지문")) || device.hasObject(By.desc("얼굴")) ||
                device.hasObject(By.desc("PIN")) || device.hasObject(By.desc("패턴"))) {
                Log.i(TAG, "Native auth prompt detected: BiometricPrompt")
                return true
            }
            Thread.sleep(300)
        }
        Log.w(TAG, "Native auth prompt not detected within ${timeoutMs}ms")
        return false
    }

    /**
     * BiometricPrompt/Keyguard 크리덴셜 화면에 PIN을 키코드로 직접 입력.
     * 이 프롬프트는 접근성 트리에 노드가 노출되지 않아(보안 정책) UIAutomator 탐지가
     * 불가능하므로, 화면 상태와 무관하게 키코드 시퀀스를 보내는 방식을 쓴다 (검증됨 2026-08).
     * 숫자 입력 후 마지막에 ENTER로 확정한다.
     */
    override fun inputPinViaKeyEvents(pin: String): Boolean {
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
            Log.i(TAG, "PIN entered via key events")
            true
        } catch (e: Exception) {
            Log.w(TAG, "inputPinViaKeyEvents failed: ${e.message}")
            false
        }
    }
}
