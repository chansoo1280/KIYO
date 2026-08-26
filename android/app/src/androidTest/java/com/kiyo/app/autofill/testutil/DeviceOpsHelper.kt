package com.kiyo.app.autofill.testutil

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import org.junit.Assert.assertTrue
import java.io.FileInputStream

/**
 * E2E 테스트의 기기 조작 프리미티브 (plan 2026-08-25 Proposed Changes #5).
 * AutofillE2ETest에 인라인이던 PIN set/clear, PID kill, logcat read,
 * 앱 포어그라운드 복귀를 이동했다. 타이밍/sleep 값은 원본 그대로 유지.
 */
object DeviceOpsHelper {

    private const val TAG = "DeviceOpsHelper"
    private const val APP_PACKAGE = "com.kiyo.app"

    /** adb locksettings로 기기 PIN 설정
     *  - persistent_data_block 서비스가 늦게 준비되는 에뮬레이터에서 set-pin이
     *    ServiceNotFoundException으로 실패할 수 있으므로 재시도한다 (검증됨 2026-08)
     *  - 성공 여부를 KeyguardManager.isDeviceSecure로 실제 확인 — 실패 시 fail
     */
    fun setPin(context: Context, pin: String) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val uiAutomation = instrumentation.uiAutomation
        var output = ""
        for (attempt in 1..3) {
            val stream = uiAutomation.executeShellCommand("locksettings set-pin $pin")
            output = FileInputStream(stream.fileDescriptor).bufferedReader().readText()
            stream.close()
            if (output.contains("Pin set", ignoreCase = true)) {
                Log.i(TAG, "Device PIN set (attempt $attempt): ${output.trim()}")
                break
            }
            Log.w(TAG, "set-pin attempt $attempt failed: ${output.trim()}")
            Thread.sleep(3000)
        }
        // 실제 잠금화면 설정 여부 확인 (가짜 통과 방지)
        Thread.sleep(1000)
        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        assertTrue(
            "Device PIN was not actually set (isDeviceSecure=false). locksettings output: ${output.trim()}",
            keyguardManager.isDeviceSecure
        )
        Log.i(TAG, "KeyguardManager.isDeviceSecure=true confirmed")
        // Log the lock settings after confirming the device is secure
        // val lockSettingsOutput = uiAutomation.executeShellCommand("dumpsys lock_settings")
        //     .let { pf -> FileInputStream(pf.fileDescriptor).bufferedReader().readText() }
        // Log.i(TAG, "dumpsys lock_settings after setPin and confirmation: $lockSettingsOutput")
    }

    /** adb locksettings로 기기 PIN 제거 (성공 판정: isDeviceSecure=false 실측) */
    fun clearPin(context: Context, pin: String) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val uiAutomation = instrumentation.uiAutomation
        for (attempt in 1..3) {
            val output = uiAutomation.executeShellCommand("locksettings clear --old $pin")
                .let { pf -> FileInputStream(pf.fileDescriptor).bufferedReader().readText() }
            val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            if (!keyguardManager.isDeviceSecure) {
                Log.i(TAG, "Device PIN cleared (attempt $attempt)")
                return
            }
            Log.w(TAG, "clear attempt $attempt output: ${output.trim()}")
            Thread.sleep(3000)
        }
        Log.w(TAG, "Device PIN may still be set after clear attempts")
    }

    /** KIYO 앱을 포어그라운드로 가져오기 (원본 동작: CLEAR_TASK 없이 액티비티만 재시작해 프로세스/캐시 유지) */
    fun bringAppToForeground(device: UiDevice) {
        val context = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext
        val intent = Intent().apply {
            setClassName(APP_PACKAGE, "$APP_PACKAGE.MainActivity")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        device.wait(Until.hasObject(By.pkg(APP_PACKAGE).depth(0)), 10000)
    }

    /** 자동완성 서비스 프로세스만 PID 특정 후 kill (am force-stop과 구분) */
    fun killProcess(packageName: String = APP_PACKAGE): String {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val pidOutput = instrumentation.uiAutomation.executeShellCommand("pidof $packageName")
            .let { pf -> FileInputStream(pf.fileDescriptor).bufferedReader().readText().trim() }
        assertTrue("Could not resolve $packageName pid, got: '$pidOutput'", pidOutput.isNotEmpty())
        val mainPid = pidOutput.split("\\s+".toRegex()).first()
        instrumentation.uiAutomation.executeShellCommand("kill $mainPid").close()
        Log.i(TAG, "killed $packageName pid=$mainPid")
        return mainPid
    }

    /** logcat 최근 N줄 읽기 */
    fun readLogcat(lines: Int = 500): String {
        return InstrumentationRegistry.getInstrumentation().uiAutomation
            .executeShellCommand("logcat -d -t $lines")
            .let { pf -> FileInputStream(pf.fileDescriptor).bufferedReader().readText() }
    }
}
