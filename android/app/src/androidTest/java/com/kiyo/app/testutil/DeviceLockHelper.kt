package com.kiyo.app.testutil

import android.app.KeyguardManager
import android.content.Context
import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry

/**
 * Simplified device lock state checker for tests.
 * PIN setup/clear/lock/unlock should be done via ADB from host,
 * not from within the test APK (different UID/permissions).
 * 
 * Usage:
 * ```
 * // Host (ADB):
 * adb shell locksettings set-pin 1234
 * adb shell input keyevent KEYCODE_WAKEUP && adb shell input swipe ... && adb shell input text 1234 && adb shell input keyevent KEYCODE_ENTER
 * 
 * // Test:
 * assertFalse("Device must be unlocked", DeviceLockHelper.isLocked())
 * ```
 */
object DeviceLockHelper {
    
    private const val TAG = "DeviceLockHelper"
    
    private var initialized = false
    private var context: Context? = null
    
    private fun ensureInitialized() {
        if (!initialized) {
            context = InstrumentationRegistry.getInstrumentation().targetContext
            initialized = true
        }
    }
    
    /** Check if device is currently locked (requires KeyguardManager) */
    fun isLocked(): Boolean {
        ensureInitialized()
        val km = context!!.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        return km.isDeviceLocked()
    }
    
    /** Verify device is unlocked - fail test if locked */
    fun assertUnlocked() {
        if (isLocked()) {
            throw AssertionError("Device is locked! Unlock it before running E2E tests. " +
                "Run: adb shell locksettings set-pin 1234 && adb shell input keyevent KEYCODE_WAKEUP ...")
        }
    }

    /** Verify no secure lock screen exists (isDeviceSecure=false) - fail test if PIN/pattern/password is set */
    fun assertNoLockScreen() {
        ensureInitialized()
        val km = context!!.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        if (km.isDeviceSecure) {
            throw AssertionError("Device has a secure lock screen (isDeviceSecure=true)! " +
                "1단계 테스트는 잠금화면 없는 상태가 전제입니다. " +
                "Run: adb shell locksettings clear --old <pin>")
        }
        Log.i(TAG, "No secure lock screen confirmed (isDeviceSecure=false)")
    }
    
    /** Reset state (no-op, kept for compatibility) */
    fun reset() {
        // No state to reset
    }
}