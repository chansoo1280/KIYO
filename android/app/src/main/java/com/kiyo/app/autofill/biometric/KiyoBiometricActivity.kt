package com.kiyo.app.autofill.biometric

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricPrompt
import androidx.biometric.BiometricManager
import androidx.core.content.ContextCompat
import android.content.Intent
import android.content.Context
import android.os.Build
import android.widget.Toast
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import java.util.concurrent.Executor

/**
 * 생체 인증(지문, 얼굴 인식 등)을 수행하는 Activity
 * Autofill 서비스에서 생체 인증이 필요할 때 호출됩니다.
 */
class KiyoBiometricActivity : AppCompatActivity() {

    private var biometricPrompt: BiometricPrompt? = null
    private var executor: Executor = ContextCompat.getMainExecutor(this)
    private var authenticationCallback: BiometricPrompt.AuthenticationCallback? = null
    private var isAuthenticating = false
    private var promptInfo: BiometricPrompt.PromptInfo? = null

    companion object {
        const val EXTRA_AUTH_REASON = "auth_reason"
        const val EXTRA_PACKAGE_NAME = "package_name"
        const val RESULT_AUTH_SUCCESS = "auth_success"
        const val RESULT_AUTH_FAILED = "auth_failed"
        const val RESULT_AUTH_ERROR = "auth_error"
        const val RESULT_AUTH_CANCELLED = "auth_cancelled"
        const val EXTRA_ERROR_MESSAGE = "error_message"
        
        const val REQUEST_CODE_BIOMETRIC = 1001
        
        // Broadcast action and extras for biometric result
        const val ACTION_BIOMETRIC_RESULT = "com.kiyo.app.autofill.BIOMETRIC_RESULT"
        const val EXTRA_AUTH_SUCCESS = "auth_success"
        
        /**
         * 생체 인증 Activity를 시작하는 헬퍼 메서드
         */
        @JvmStatic
        @JvmOverloads
        fun startBiometricAuth(
            context: Context,
            packageName: String,
            authReason: String,
            requestCode: Int = REQUEST_CODE_BIOMETRIC
        ): Boolean {
            // 생체 인증 하드웨어 확인
            val biometricManager = BiometricManager.from(context)
            val authResult = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            } else {
                @Suppress("DEPRECATION")
                biometricManager.canAuthenticate()
            }
            
            when (authResult) {
                BiometricManager.BIOMETRIC_SUCCESS -> {
                    // 생체 인증 가능
                }
                BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE -> {
                    Toast.makeText(context, "생체 인증 하드웨어가 없습니다.", Toast.LENGTH_SHORT).show()
                    return false
                }
                BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE -> {
                    Toast.makeText(context, "생체 인증 하드웨어를 사용할 수 없습니다.", Toast.LENGTH_SHORT).show()
                    return false
                }
                BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED -> {
                    Toast.makeText(context, "등록된 생체 정보가 없습니다.", Toast.LENGTH_SHORT).show()
                    return false
                }
                else -> {
                    Toast.makeText(context, "생체 인증을 사용할 수 없습니다.", Toast.LENGTH_SHORT).show()
                    return false
                }
            }
            
            val intent = Intent(context, KiyoBiometricActivity::class.java).apply {
                putExtra(EXTRA_PACKAGE_NAME, packageName)
                putExtra(EXTRA_AUTH_REASON, authReason)
            }
            context.startActivity(intent)
            return true
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 인텐트에서 데이터 추출
        val packageName = intent.getStringExtra(EXTRA_PACKAGE_NAME) ?: ""
        val authReason = intent.getStringExtra(EXTRA_AUTH_REASON) ?: "자동완성을 위해 생체 인증이 필요합니다."
        
        // BiometricPrompt 초기화
        setupBiometricPrompt(authReason)
        
        // 생체 인증 시작
        startBiometricAuthentication()
    }
    
    private fun setupBiometricPrompt(authReason: String) {
        executor = ContextCompat.getMainExecutor(this)
        
        authenticationCallback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                if (!isAuthenticating) return
                isAuthenticating = false
                android.util.Log.e("KiyoBiometricActivity", "인증 오류: errorCode=$errorCode, errorMessage=$errString")
                finishWithError(errString.toString())
            }
            
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                if (!isAuthenticating) return
                isAuthenticating = false
                android.util.Log.d("KiyoBiometricActivity", "생체 인증 성공")
                finishWithSuccess()
            }
            
            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                // 인증 실패했지만 다시 시도 가능
                android.util.Log.w("KiyoBiometricActivity", "생체 인증 실패 - 재시도 가능")
            }
        }
        
        promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("KIYO 잠금 해제")
            .setSubtitle("자동완성을 위해 인증해주세요.")
            .setDescription("지문 또는 얼굴 인식을 사용하여 인증하세요.")
            .setNegativeButtonText("취소")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build()
        
        biometricPrompt = BiometricPrompt(this, executor, authenticationCallback!!)
    }
    
    private fun startBiometricAuthentication() {
        isAuthenticating = true
        biometricPrompt?.authenticate(promptInfo!!)
    }
    
    private fun finishWithSuccess() {
        val packageName = intent.getStringExtra(EXTRA_PACKAGE_NAME) ?: ""
        val resultIntent = Intent().apply {
            putExtra(RESULT_AUTH_SUCCESS, true)
            putExtra(EXTRA_PACKAGE_NAME, packageName)
        }
        setResult(RESULT_OK, resultIntent)
        
        // Send broadcast for autofill service
        val broadcastIntent = Intent(ACTION_BIOMETRIC_RESULT).apply {
            putExtra(EXTRA_AUTH_SUCCESS, true)
            putExtra(EXTRA_PACKAGE_NAME, packageName)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(broadcastIntent)
        
        finish()
    }
    
    private fun finishWithError(errorMessage: String) {
        val packageName = intent.getStringExtra(EXTRA_PACKAGE_NAME) ?: ""
        val resultIntent = Intent().apply {
            putExtra(RESULT_AUTH_ERROR, true)
            putExtra(EXTRA_ERROR_MESSAGE, errorMessage)
        }
        setResult(RESULT_CANCELED, resultIntent)
        
        // Send broadcast for autofill service
        val broadcastIntent = Intent(ACTION_BIOMETRIC_RESULT).apply {
            putExtra(EXTRA_AUTH_SUCCESS, false)
            putExtra(EXTRA_PACKAGE_NAME, packageName)
            putExtra(EXTRA_ERROR_MESSAGE, errorMessage)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(broadcastIntent)
        
        finish()
    }
    
    private fun finishWithCancelled() {
        val packageName = intent.getStringExtra(EXTRA_PACKAGE_NAME) ?: ""
        val resultIntent = Intent().apply {
            putExtra(RESULT_AUTH_CANCELLED, true)
        }
        setResult(RESULT_CANCELED, resultIntent)
        
        // Send broadcast for autofill service
        val broadcastIntent = Intent(ACTION_BIOMETRIC_RESULT).apply {
            putExtra(EXTRA_AUTH_SUCCESS, false)
            putExtra(EXTRA_PACKAGE_NAME, packageName)
            putExtra(EXTRA_ERROR_MESSAGE, "User cancelled")
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(broadcastIntent)
        
        finish()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        isAuthenticating = false
    }
    
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_CODE_BIOMETRIC) {
            // 생체 인증 설정 화면에서 돌아온 경우
            if (resultCode == RESULT_OK) {
                // 다시 인증 시도
                startBiometricAuthentication()
            } else {
                finishWithCancelled()
            }
        }
    }
}