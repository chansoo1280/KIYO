package com.kiyo.autofilltest

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowInsets
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Button
import android.widget.Toast
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * Android Autofill Framework 테스트용 네이티브 로그인 화면.
 * Chrome/WebView 의존성 없이 순수 Android Autofill을 테스트할 수 있습니다.
 *
 * 이 Activity는 테스트 APK에만 포함됩니다 (androidTest가 아닌 별도 모듈).
 *
 * Intent Extras:
 * - EXTRA_DOMAIN_HINT: 테스트할 도메인 (예: "example.com", "nomatch.example.com")
 *   없을 경우 기본값 "example.com" 사용
 */
class AutofillTestHostActivity : Activity() {

    companion object {
        const val EXTRA_DOMAIN_HINT = "domain_hint"
        const val DEFAULT_DOMAIN = "example.com"
    }

    private lateinit var currentDomain: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Get domain hint from intent
        currentDomain = intent.getStringExtra(EXTRA_DOMAIN_HINT) ?: DEFAULT_DOMAIN

        // Edge-to-edge 대응 (API 30+)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val insetsController = WindowInsetsControllerCompat(window, window.decorView)
        insetsController.isAppearanceLightStatusBars = false
        insetsController.isAppearanceLightNavigationBars = false
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#1A1A2E"))
        }

        // Insets 처리 (API 30+)
        root.setOnApplyWindowInsetsListener { view, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(
                32 + systemBars.left,
                32 + systemBars.top,
                32 + systemBars.right,
                32 + systemBars.bottom
            )
            insets
        }

        // 제목
        val title = TextView(this).apply {
            text = "KIYO Autofill Test"
            textSize = 24f
            setTextColor(Color.WHITE)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 8 }
        }

        val subtitle = TextView(this).apply {
            text = "Domain: $currentDomain"
            textSize = 14f
            setTextColor(Color.parseColor("#B0B0B0"))
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 32 }
        }

        // Username 필드 - 도메인 힌트 적용
        val usernameLabel = createLabel("Username")
        val usernameField = createEditText(
            hint = "example@email.com",
            // 도메인에 따라 autofill 힌트 다르게 설정
            autofillHints = buildAutofillHintsForUsername(),
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS,
            imeOptions = EditorInfo.IME_ACTION_NEXT
        )

        // Password 필드
        val passwordLabel = createLabel("Password")
        val passwordField = createEditText(
            hint = "비밀번호",
            autofillHints = arrayOf(View.AUTOFILL_HINT_PASSWORD),
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD,
            imeOptions = EditorInfo.IME_ACTION_DONE
        )

        // Login 버튼
        val loginButton = Button(this).apply {
            text = "Login"
            textSize = 16f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#6C5CE7"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                120
            ).apply { topMargin = 24 }
            setOnClickListener {
                val username = usernameField.text.toString()
                val password = passwordField.text.toString()
                Toast.makeText(
                    this@AutofillTestHostActivity,
                    "Login: $username / $password",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }

        // 정보 텍스트
        val infoText = TextView(this).apply {
            text = buildInfoText()
            textSize = 12f
            setTextColor(Color.parseColor("#888888"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 24 }
        }

        root.addView(title)
        root.addView(subtitle)
        root.addView(usernameLabel)
        root.addView(usernameField)
        root.addView(passwordLabel)
        root.addView(passwordField)
        root.addView(loginButton)
        root.addView(infoText)

        setContentView(root)
    }

    /**
     * Username 필드용 autofill 힌트 구성.
     * 매칭되는 계정이 없는 도메인(nomatch.*)의 경우 USERNAME 힌트만 주고
     * EMAIL_ADDRESS는 주지 않아서 autofill 매칭을 어렵게 만듦.
     */
    private fun buildAutofillHintsForUsername(): Array<String> {
        return if (currentDomain.startsWith("nomatch.")) {
            // 매칭 안 되는 도메인 - USERNAME만 제공 (EMAIL_ADDRESS 제외)
            arrayOf(View.AUTOFILL_HINT_USERNAME)
        } else {
            // 정상 도메인 - USERNAME + EMAIL_ADDRESS 모두 제공
            arrayOf(View.AUTOFILL_HINT_USERNAME, View.AUTOFILL_HINT_EMAIL_ADDRESS)
        }
    }

    private fun buildInfoText(): String {
        val hints = if (currentDomain.startsWith("nomatch.")) {
            "AUTOFILL_HINT_USERNAME only (no EMAIL_ADDRESS)"
        } else {
            "AUTOFILL_HINT_USERNAME, EMAIL_ADDRESS"
        }
        return "Autofill Hints:\n• Username: $hints\n• Password: AUTOFILL_HINT_PASSWORD\n\nDomain: $currentDomain"
    }

    private fun createLabel(text: String): TextView {
        return TextView(this).apply {
            this.text = text
            textSize = 14f
            setTextColor(Color.parseColor("#CCCCCC"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 16; bottomMargin = 8 }
        }
    }

    private fun createEditText(
        hint: String,
        autofillHints: Array<String>,
        inputType: Int,
        imeOptions: Int
    ): EditText {
        return EditText(this).apply {
            this.hint = hint
            this.inputType = inputType
            this.imeOptions = imeOptions
            setAutofillHints(*autofillHints)
            importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_YES
            setBackgroundResource(android.R.drawable.edit_text)
            setPadding(16, 16, 16, 16)
            setTextColor(Color.WHITE)
            setHintTextColor(Color.parseColor("#888888"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            setMinHeight(56)
        }
    }
}