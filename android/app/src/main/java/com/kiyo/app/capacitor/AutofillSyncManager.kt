package com.kiyo.app.capacitor

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import com.kiyo.app.autofill.repository.AutofillRepository
import com.kiyo.app.security.DatabaseKeyManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Application-policy layer for React -> Native autofill account sync.
 *
 * Owns the "when / how" decisions:
 *  - security downgrade detection & reset (DatabaseKeyManager)
 *  - repository initialization guarantee
 *  - security upgrade flag surfacing
 *  - delegation to AutofillRepository.syncAccountsFromReact()
 *  - pending-sync + auth-activity retry flow on UserNotAuthenticatedException
 *
 * Deliberately free of Capacitor dependencies so it is unit-testable on the JVM.
 * OS capabilities (autofill enabled state, settings screen) belong to
 * [AutofillPlatformBridge], not here.
 */
class AutofillSyncManager(
    private val ensureRepository: suspend () -> AutofillRepository,
    private val authNavigator: SyncAuthNavigator,
) {

    /**
     * Abstraction over launching MainActivity for re-authentication, so JVM tests
     * can substitute a fake instead of a Capacitor ActivityResultLauncher.
     */
    fun interface SyncAuthNavigator {
        fun launchAuthActivity(accountsJson: String?)
    }

    data class SyncResult(
        val syncedCount: Int,
        val errorCount: Int,
        val success: Boolean,
        val securityUpgrade: Boolean,
    )

    /** Outcome when authentication interrupted the sync. */
    sealed class AuthOutcome {
        /** Auth succeeded and the sync was retried to completion. */
        data class Retried(val result: SyncResult) : AuthOutcome()

        /** Auth failed/cancelled or still required after the attempt. */
        object AuthRequired : AuthOutcome()
    }

    private val mainScope = CoroutineScope(Dispatchers.IO)

    suspend fun syncAccountsFromReact(context: Context, accountsJson: String): SyncResult {
        // 보안 다운그레이드 감지: 잠금화면 제거로 auth-required 키가 무효화된 상태.
        // 계정 원본 데이터는 React 앱(IndexedDB)에 그대로 남아 있으므로 즉시 리셋 후 재동기화한다.
        // (리셋 대상은 자동완성 전용 DB뿐 — 사용자 데이터 소실 아님)
        val currentAlias = DatabaseKeyManager.getCurrentAlias(context)
        if (DatabaseKeyManager.isSecurityDowngrade(currentAlias)) {
            Log.w(TAG, "Security downgrade detected at sync - resetting security state immediately")
            DatabaseKeyManager.resetAutofillData(context)
            Log.w(TAG, "Security state reset completed - proceeding with fresh key")
            // 리셋 후 정상 흐름으로 계속 (새 키 생성됨)
        }

        val repository = ensureRepository()

        // 보안 업그레이드 감지: 잠금화면이 새로 설정되어 기존 키가 auth-required가 아닌 경우.
        // getKey() 내부에서 DB_KEY가 auth-required 키로 자동 재래핑됨 → 사용자에게 안내.
        val securityUpgraded = DatabaseKeyManager.wasSecurityUpgraded()

        val result = repository.syncAccountsFromReact(accountsJson)
        return SyncResult(
            syncedCount = result.first,
            errorCount = result.second,
            success = result.second == 0,
            securityUpgrade = securityUpgraded,
        )
    }

    /**
     * Handle an authentication activity result for a previously stored pending sync.
     */
    fun handleAuthResult(resultCode: Int, accountsJson: String?, onSuccess: (SyncResult) -> Unit, onCancel: () -> Unit) {
        if (resultCode != android.app.Activity.RESULT_OK || accountsJson == null) {
            Log.d(TAG, "Authentication failed or cancelled - resultCode: $resultCode")
            onCancel()
            return
        }
        // Authentication succeeded - retry sync
        Log.d(TAG, "Authentication succeeded - retrying sync")
        mainScope.launch {
            try {
                val repository = ensureRepository()
                val syncResult = repository.syncAccountsFromReact(accountsJson)
                onSuccess(
                    SyncResult(syncResult.first, syncResult.second, syncResult.second == 0, securityUpgrade = false)
                )
            } catch (e: android.security.keystore.UserNotAuthenticatedException) {
                // Still needs auth (shouldn't happen right after successful auth, but handle it)
                Log.d(TAG, "Still needs auth after authentication attempt")
                onCancel()
            } catch (e: Exception) {
                Log.e(TAG, "Error retrying sync after auth", e)
                onCancel()
            }
        }
    }

    companion object {
        private const val TAG = "AutofillSyncManager"
    }
}
