package com.kiyo.app.e2e.testutil

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.kiyo.app.e2e.pageobjects.AccountsPage
import com.kiyo.app.e2e.pageobjects.AuthPage
import com.kiyo.app.e2e.pageobjects.AutofillLoginPage
import com.kiyo.app.e2e.pageobjects.HomePage
import com.kiyo.app.e2e.pageobjects.SettingsPage
import com.kiyo.app.e2e.testutil.TestSecurityInitializer

/**
 * E2E 테스트 공유 환경 가드 (plan 2026-08-25 Proposed Changes #3/#8/#9).
 * AutofillE2ETest / BiometricUnlockE2ETest 두 시나리오 클래스가 함께 사용한다.
 *
 * 설계 원칙 (핵심 규칙):
 *  - prepared/pinSet 판별은 화면/KeyguardManager 실측 — static 플래그 불사용
 *  - rewrapped 플래그는 전체 실행(같은 instrumentation 프로세스)에서 중복 방지 힌트일 뿐,
 *    단독 실행 시에는 판단 없이 항상 멱등 수행 (ensureRewrapped)
 *  - ensureBaseEnvironment은 sync를 하지 않는다. sync는 각 검증 시나리오의 소관
 *  - 화면 판별은 페이지 객체의 isCurrent에 위임, UI 운전도 각 페이지가 담당 (2026-08-28)
 */
object E2EEnv {

    private const val TAG = "E2EEnv"
    private const val APP_PACKAGE = "com.kiyo.app"

    /** 재래핑 완료 힌트 (같은 프로세스 내 중복 방지용 — 단독 실행 판단 근거 아님, 규칙 5) */
    @Volatile
    var rewrapped = false
        private set

    fun markRewrapped() {
        rewrapped = true
    }

    data class BaseEnv(
        val vaultName: String,
        val account: TestDataFactory.AccountInfo,
        val device: UiDevice,
        val context: Context,
        val helper: WebViewTestHelper,
        val homePage: HomePage,
        val accountsPage: AccountsPage,
        val authPage: AuthPage,
        val settingsPage: SettingsPage,
        val autofillLogin: AutofillLoginPage,
        /** 네이티브 인증 프롬프트 처리 (디바이스 레벨 — 호스트 앱 화면 조작은 autofillLogin) */
        val nativeAuth: NativeAuthPromptHandler,
    )

    /**
     * instrumentation extra(-e vaultName <이름>)로 지정된 볼트 이름. 미지정이면 null.
     * (Instrumentation.arguments는 테스트 APK 매니페스트의 <meta-data>와 am -e 키를 모두 포함)
     */
    fun requestedVaultName(): String? {
        val args = InstrumentationRegistry.getArguments()
        return args?.getString("vaultName")?.takeIf { it.isNotBlank() }
    }

    /**
     * -e freshVault true 지정 시, instrumentation 프로세스에서 "최초 1회만" 참.
     * 같은 이름의 볼트가 이미 활성 상태여도 세션 첫 ensureBaseEnvironment 호출만
     * 무조건 새로 생성하고, 이후 호출(같은 클래스의 나머지 @Test)부터는 기존 볼트를 재사용한다
     * (스크립트의 -Fresh 플래그가 전달).
     */
    @Volatile
    private var freshVaultConsumed = false

    fun consumeFreshVaultIfRequested(): Boolean {
        if (freshVaultConsumed) return false
        synchronized(this) {
            if (freshVaultConsumed) return false
            val args = InstrumentationRegistry.getArguments()
            val requested = args?.getString("freshVault")?.equals("true", ignoreCase = true) == true
            freshVaultConsumed = true   // 요청 여부와 무관하게 1회만 판정
            return requested
        }
    }

    /**
     * 현재 화면에 표시된 모든 볼트 파일명 stem 목록 반환 (중복 제거).
     * 홈/계정 리스트/화면에 여러 파일이 나열될 수 있으므로 첫 번째만 보지 않고
     * 전체를 순회해 대상 볼트와 일치 여부를 판단한다.
     *
     * 예: "vault-one.json" → "vault-one", "vault-one(1).json" → "vault-one"
     */
    fun readActiveVaultFileNames(env: BaseEnv): List<String> {
        val device = env.device
        val onAuth = env.authPage.isCurrent()
        val onAccounts = env.accountsPage.isCurrent()
        val onNone = env.homePage.isCurrent()
        Log.i(TAG, "readActiveVaultFileNames: onAuth=$onAuth onAccounts=$onAccounts onNone=$onNone")
        if (!onAuth && !onAccounts && !onNone) {
            Log.i(TAG, "readActiveVaultFileNames: not on auth/accounts/home screen — no active vault")
            return emptyList()
        }
        val nodes = device.findObjects(By.textContains(".json"))
        Log.i(TAG, "readActiveVaultFileNames: findObjects(.json) found ${nodes.size} nodes")
        nodes.forEachIndexed { index, node ->
            Log.i(TAG, "readActiveVaultFileNames: node[$index] text='${node.text}'")
        }
        val stems = nodes.mapNotNull { node ->
            node.text?.trim()?.takeIf { it.isNotBlank() }
        }.map { fileName ->
            val stem = fileName.removeSuffix(".json")
                .replace(" (1)", "")
                .replace(" (2)", "")
                .trim()
            Log.i(TAG, "readActiveVaultFileNames: fileName='$fileName' -> stem='$stem'")
            stem
        }.filter { it.isNotBlank() }.distinct()
        Log.i(TAG, "Active vault file names observed (${if (onAuth) "auth" else if (onAccounts) "accounts" else "home"}): $stems")
        return stems
    }

    /** page object 재바인딩 (화면 이동 없이 현재 상태로 반환) */
    private fun bind(env: BaseEnv): BaseEnv = env.copy(
        accountsPage = AccountsPage(env.helper),
        authPage = AuthPage(env.helper),
        settingsPage = SettingsPage(env.helper, env.nativeAuth),
        autofillLogin = AutofillLoginPage(env.device),
    )

    /**
     * 앱을 기동하고 page object를 바인딩한다 (어떤 화면에 도착하든 통과).
     */
    fun launchAppAndBind(env: BaseEnv): BaseEnv {
        with(env) {
            DeviceOpsHelper.assertUnlocked()
            val intent = Intent().apply {
                setClassName(APP_PACKAGE, "$APP_PACKAGE.MainActivity")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                data = Uri.parse("kiyo://files")
            }
            context.startActivity(intent)
            device.wait(Until.hasObject(By.pkg(APP_PACKAGE).depth(0)), 15000)
            Thread.sleep(3000) // 초기 로드 대기 (원본 유지)

            return bind(env)
        }
    }

    /** 앱 기동 시 화면 상태 (BasePage.isCurrent 조합으로 판별) */
    enum class ScreenState {
        /** 파일 선택 화면 (활성 파일 없음) */
        NONE,
        /** 계정 리스트 화면 (비암호화 파일 활성, 또는 암호화 볼트 언락 상태) */
        PLAIN_ACTIVE,
        /** Auth 잠금 화면 (암호화 파일 활성, cryptoKey 메모리 소실 → 잠김) */
        ENCRYPTED_LOCKED,
    }

    private const val DETECT_POLL_INTERVAL_MS = 300L
    private const val DETECT_TIMEOUT_MS = 10000L

    /**
     * 현재 화면 상태 판별 (네비게이션 없음). 교차 폴링 — 세 페이지의 마커를
     * 짧은 주기로 모두 1회씩 실측해 어느 것이든 먼저 나타나는 즉시 반환한다.
     * (구 AppScreenState.detect — 단일 호출자인 이곳으로 통합, 2026-08-28)
     */
    private fun detectScreen(homePage: HomePage, authPage: AuthPage, accountsPage: AccountsPage): ScreenState {
        val startTime = System.currentTimeMillis()
        while (true) {
            if (homePage.isCurrent()) return ScreenState.NONE
            if (authPage.isCurrent()) return ScreenState.ENCRYPTED_LOCKED
            if (accountsPage.isCurrent()) return ScreenState.PLAIN_ACTIVE
            if (System.currentTimeMillis() - startTime >= DETECT_TIMEOUT_MS) break
            runCatching { Thread.sleep(DETECT_POLL_INTERVAL_MS) }
        }
        Log.i(TAG, "Screen state: UNKNOWN — falling back to NONE")
        return ScreenState.NONE
    }

    /**
     * 기본 환경 확보: 앱 기동 상태를 화면 실측으로 구분해 처리.
     *
     * 앱 기동 시 3가지 상태 (ScreenState):
     *  1. NONE             — 파일 선택 화면 (활성 파일 없음)
     *  2. PLAIN_ACTIVE     — 계정 리스트 (비암호화 파일 활성)
     *  3. ENCRYPTED_LOCKED — Auth 잠금 화면 (암호화 파일 활성, cryptoKey 메모리 소실)
     *
     * - 목표 볼트가 이미 활성이면(PLAIN_ACTIVE 또는 PIN 언락 가능한 ENCRYPTED_LOCKED) 생성 생략
     * - 아니면 파일 선택 화면까지 이동(상태별 탈출 경로) 후 신규 생성
     * - 생성 시: 볼트 생성 → 계정 생성 → autofill toggle ON + 서비스 활성화
     * - sync는 호출자가 수행 (준비에 포함하지 않음)
     * @param encrypted true면 암호화 볼트 생성, false면 비암호화 볼트 생성 (기본값: false)
     */
    fun ensureBaseEnvironment(
        vaultName: String,
        account: TestDataFactory.AccountInfo,
        device: UiDevice,
        context: Context,
        helper: WebViewTestHelper,
        nativeAuth: NativeAuthPromptHandler,
        encrypted: Boolean = false
    ): BaseEnv {
        val env = BaseEnv(
            vaultName = vaultName,
            account = account,
            device = device,
            context = context,
            helper = helper,
            homePage = HomePage(helper),
            accountsPage = AccountsPage(helper),
            authPage = AuthPage(helper),
            settingsPage = SettingsPage(helper, nativeAuth),
            autofillLogin = AutofillLoginPage(device),
            nativeAuth = nativeAuth,
        )

        // 1. 기동 + 활성 상태 실측 (판별은 각 페이지 객체의 isCurrent에 위임)
        val bound = launchAppAndBind(env)
        val state = detectScreen(bound.homePage, bound.authPage, bound.accountsPage)

        // targetStem은 화면 상태에 관계없이 먼저 계산 (홈 화면에서도 사용)
        val targetStem = vaultName.removeSuffix(".json").replace(" (1)", "").replace(" (2)", "").trim()

        // 홈 화면(NONE)은 UIAutomator.findObjects가 WebView 내부 요소를 읽지 못하므로
        // Espresso-Web 기반 helper.isTextPresent로 특정 볼트 파일명 존재 여부를 직접 확인
        val activeVaultNames: List<String> = when (state) {
            ScreenState.NONE -> {
                val found = helper.isTextPresent(targetStem + ".json")
                Log.i(TAG, "readActiveVaultFileNames (home via Espresso-Web): targetFile='$targetStem.json' found=$found")
                if (found) listOf(targetStem) else emptyList()
            }
            else -> readActiveVaultFileNames(bound)
        }
        Log.i(TAG, "App started: state=$state activeVaults=$activeVaultNames target=$vaultName encrypted=$encrypted")

        // 2. 목표 볼트가 이미 활성이면 생성 생략 (freshVault 런은 재사용하지 않고 항상 새로 생성)
        // 양쪽 stem 비교 — activeVaultNames는 readActiveVaultFileNames에서 (N) suffix 제거됨.
        // vaultName도 같은 정책으로 정규화해 사용자 입력 `vault-one(1)` 같은 경우도 매칭.
        val freshConsumed = consumeFreshVaultIfRequested()
        val reuseActive = activeVaultNames.contains(targetStem) && !freshConsumed
        Log.i(TAG, "reuseActive check: targetStem='$targetStem' activeVaultNames=$activeVaultNames contains=${activeVaultNames.contains(targetStem)} freshConsumed=$freshConsumed reuseActive=$reuseActive state=$state")
        if (reuseActive && state == ScreenState.PLAIN_ACTIVE) {
            Log.i(TAG, "Target vault '$vaultName' already active (plain), skipping creation")
            return bind(bound)
        }
        if (reuseActive && state == ScreenState.ENCRYPTED_LOCKED && encrypted) {
            Log.i(TAG, "Target vault '$vaultName' already active (encrypted, locked) — unlocking with PIN")
            bound.authPage.unlockWithPin(TestDataFactory.TEST_PIN)
            return bind(bound)
        }
        if (reuseActive && state == ScreenState.NONE) {
            // 이미 홈 화면에 있고 대상 볼트가 있으면 기존 볼트 파일 클릭 후 재사용
            Log.i(TAG, "Target vault '$vaultName' already active on home screen, reusing")
            val opened = bound.homePage.openExistingVault("$vaultName.json")
            if (!opened) {
                throw AssertionError("Could not open existing vault '$vaultName.json' on home screen")
            }
            // 암호화 볼트인 경우 Auth 잠금 화면으로 이동했을 수 있으므로 상태 재확인 후 언락
            val stateAfterOpen = detectScreen(bound.homePage, bound.authPage, bound.accountsPage)
            if (stateAfterOpen == ScreenState.ENCRYPTED_LOCKED && encrypted) {
                Log.i(TAG, "Target vault '$vaultName' opened to auth screen — unlocking with PIN")
                bound.authPage.unlockWithPin(TestDataFactory.TEST_PIN)
            }
            return bind(bound)
        }

        // 3. 활성 볼트가 있으면(요청과 무관하게) 파일 선택 화면까지 탈출 후 신규 생성.
        Log.i(TAG, "Not reusing — proceeding to new vault creation path")
        when (state) {
            ScreenState.NONE -> Log.i(TAG, "Already on file selection screen")
            else -> {
                Log.i(TAG, "Navigating to file selection from state=$state")
                val reached = when (state) {
                    ScreenState.PLAIN_ACTIVE -> bound.settingsPage.navigateToFileSelection()
                    ScreenState.ENCRYPTED_LOCKED -> bound.authPage.escapeToFileSelection()
                    ScreenState.NONE -> true
                }
                if (!reached) {
                    throw AssertionError("Could not reach file selection screen from state=$state")
                }
            }
        }

        // 4. 신규 볼트 생성 + 계정 생성
        Log.i(TAG, "Creating vault '$vaultName' (encrypted=$encrypted)...")
        val accounts = bound.homePage.clickCreateVaultButton()
            .createVault(vaultName, encrypted = encrypted)
        val accountEditPage = accounts.clickAddAccount()
            .selectDefaultTemplate()
            .fillAccount(
                com.kiyo.app.e2e.pageobjects.AccountEditPage.AccountData(
                    title = bound.account.title,
                    websiteUrl = bound.account.websiteUrl,
                    username = bound.account.username,
                    password = bound.account.password,
                    packageName = bound.account.packageName,
                )
            )
        accountEditPage.save()

        // 계정 저장 확인
        if (!helper.waitForText(AccountsPage.MARKER_TEXT, 10000)) {
            throw AssertionError("Account list did not load after saving account")
        }
        if (!helper.waitForText(bound.account.title, 10000)) {
            throw AssertionError("Account title '${bound.account.title}' not found in accounts list after save")
        }

        // 자동완성 사용 토글 ON + 서비스 활성화
        val settings = SettingsPage(helper, nativeAuth).navigateToSettings()
        settings.enableAutofillToggle()
        settings.activateAutofillService()

        // 5. 계정 저장 직후 이미 계정 리스트 화면이므로 현재 상태 그대로 반환한다.
        //    (재기동 시 암호화 볼트는 잠기므로, 재시작이 필요한 시나리오는 각자 수행)
        return bind(bound)
    }

}
