package com.kiyo.app.capacitor

import android.content.ComponentName
import android.content.Intent

/**
 * Platform abstraction for OS-dependent autofill capabilities.
 *
 * Boundary rule: this interface exposes ONLY platform capabilities ("what can be done").
 * Application policy (DB key handling, security downgrade/upgrade decisions, sync ordering,
 * auth-retry flow) belongs to [AutofillSyncManager] and must NOT appear here.
 *
 * A future iOS implementation would back these methods with the Password AutoFill APIs
 * while the policy layer is reused unchanged.
 */
interface AutofillPlatformBridge {

    /** Status of the platform autofill setting (enabled service, our service, etc.). */
    data class AutofillStatus(
        val enabled: Boolean,
        val hasService: Boolean,
        val servicePackageName: String?,
        val isOurService: Boolean,
        val serviceClassName: String?,
    )

    /** Query whether autofill is enabled and which service is active. */
    fun isAutofillEnabled(): AutofillStatus

    /** Open the OS screen where the user can enable KIYO as the autofill provider. */
    fun openAutofillSettings()

    /**
     * Pure data hand-off of accounts JSON to the platform autofill mechanism.
     * No policy: callers decide when/whether delivery should happen.
     */
    fun deliverAccountsForAutofill(accountsJson: String)
}

/**
 * Android implementation delegating to system APIs (AutofillManager / Settings.Secure / Intent).
 */
class AndroidAutofillPlatformBridge(private val context: android.content.Context) : AutofillPlatformBridge {

    companion object {
        private const val KIYO_PACKAGE_NAME = "com.kiyo.app"
        private const val ANDROID_AUTOFILL_SETTING = "autofill_service"
    }

    private fun activeServiceComponent(): ComponentName? {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            context.getSystemService(android.view.autofill.AutofillManager::class.java)
                ?.autofillServiceComponentName
        } else {
            val serviceString = android.provider.Settings.Secure.getString(
                context.contentResolver,
                ANDROID_AUTOFILL_SETTING
            )
            serviceString?.takeIf { it.isNotEmpty() }
                ?.let { ComponentName.unflattenFromString(it) }
        }
    }

    override fun isAutofillEnabled(): AutofillPlatformBridge.AutofillStatus {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.O) {
            return AutofillPlatformBridge.AutofillStatus(false, false, null, false, null)
        }
        val manager = context.getSystemService(android.view.autofill.AutofillManager::class.java)
        val isEnabled = manager?.isEnabled() == true
        val hasEnabledServices = manager?.hasEnabledAutofillServices() == true
        val service = activeServiceComponent()
        val isOurService = service?.packageName == KIYO_PACKAGE_NAME
        return AutofillPlatformBridge.AutofillStatus(
            enabled = isOurService && isEnabled,
            hasService = hasEnabledServices,
            servicePackageName = service?.packageName,
            isOurService = isOurService,
            serviceClassName = service?.className,
        )
    }

    override fun openAutofillSettings() {
        try {
            val intent = Intent("android.settings.REQUEST_SET_AUTOFILL_SERVICE").apply {
                data = android.net.Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: android.content.ActivityNotFoundException) {
            // Fallback to generic autofill settings screen
            val fallback = Intent("android.settings.AUTOFILL_SETTINGS").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(fallback)
        }
    }

    override fun deliverAccountsForAutofill(accountsJson: String) {
        // Android delivers accounts through the encrypted SQLCipher DB consumed by
        // KiyoAutofillService (sync path), not via direct IPC. Delivery is therefore a no-op
        // placeholder at the bridge level; the policy layer routes data through
        // AutofillRepository.syncAccountsFromReact().
    }
}
