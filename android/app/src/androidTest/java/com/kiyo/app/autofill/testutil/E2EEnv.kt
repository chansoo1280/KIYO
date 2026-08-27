package com.kiyo.app.autofill.testutil

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.kiyo.app.autofill.pageobjects.AccountsPage
import com.kiyo.app.autofill.pageobjects.HomePage
import com.kiyo.app.autofill.pageobjects.SettingsPage
import com.kiyo.app.testutil.DeviceLockHelper
import com.kiyo.app.testutil.TestSecurityInitializer

/**
 * E2E 테스트 공유 환경 가드 (plan 2026-08-25 Proposed Changes #3/#8/#9).
 * AutofillE2ETest / AutofillE2EPrepareTest 두 클래스가 함께 사용한다.
 *
 * 설계 원칙 (핵심 규칙):
 *  - prepared/pinSet 판별은 화면/KeyguardManager 실측 — static 플래그 불사용
 *  - rewrapped 플래그는 전체 실행(같은 instrumentation 프로세스)에서 중복 방지 힌트일 뿐,
 *    단독 실행 시에는 판단 없이 항상 멱등 수행 (ensureRewrapped)
 *  - prepareVault은 sync를 하지 않는다. sync는 각 검증 시나리오의 소관 (ensureSynced)
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
        val settingsPage: SettingsPage,
        val testHost: AutofillTestHost,
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
     * 볼트 파일명에서 계정을 결정적으로 도출 (plan 디버깅 워크플로우).
     * 세션 간 sharedAccount 불일치 제거 — 같은 vaultName이면 같은 username.
     */
    fun accountForVault(vaultName: String): TestDataFactory.AccountInfo {
        val seed = vaultName.hashCode().toLong().let { if (it == Long.MIN_VALUE) 0 else Math.abs(it) }
        val id = "v$seed"
        return TestDataFactory.AccountInfo(
            title = "Test Account $id",
            websiteUrl = "https://example.com",
            domain = "example.com",
            packageName = "com.kiyo.autofilltest",
            username = "user$id",
            password = "pass$id",
            memo = "Test memo $id"
        )
    }

    /** 기동 목적지 화면 */
    enum class Target { FILES, LIST }

    /** page object 재바인딩 (화면 이동 없이 현재 상태로 반환) */
    private fun bind(env: BaseEnv): BaseEnv = env.copy(
        accountsPage = AccountsPage(env.helper),
        settingsPage = SettingsPage(env.helper, env.testHost),
    )

    /**
     * 앱을 기동하고 목적 화면까지 도달시킨 뒤 page object를 바인딩한다.
     * - FILES: 파일 선택 화면 (prepareVault — 새 볼트 생성에 필요)
     * - LIST: 계정 리스트 (검증 시나리오 — 볼트 활성 상태에서 시작).
     *   LIST 미발견 시에만 홈(파일 탭) 경유 재시도한다 (볼트 비활성 폴백).
     */
    fun launchAppAndBind(env: BaseEnv, target: Target, encrypted: Boolean = false): BaseEnv {
        with(env) {
            DeviceLockHelper.assertUnlocked()
            val intent = Intent().apply {
                setClassName(APP_PACKAGE, "$APP_PACKAGE.MainActivity")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                data = Uri.parse("kiyo://files")
            }
            context.startActivity(intent)
            device.wait(Until.hasObject(By.pkg(APP_PACKAGE).depth(0)), 15000)
            Thread.sleep(3000) // 초기 로드 대기 (원본 유지)

            when (target) {
                Target.FILES -> {
                    // FILES는 "기동 후 화면 실측"까지만 책임진다 — 어떤 화면이든 통과.
                    // 활성 상태 판별/파일 선택 화면 도달은 ensureBaseEnvironment가
                    // detectActiveState + navigateToFileSelection으로 수행한다.
                    // (이전: Auth 화면에서 ensureHomeScreen이 실패하는 문제, 검증됨 2026-08-27)
                    helper.waitForWebViewReady()
                    Thread.sleep(2000)
                }
                Target.LIST -> ensureAccountsList(env, encrypted)
            }
            return bind(env)
        }
    }

    /** 계정 리스트 도달 보장.
     * "My accounts" 실측, 없으면:
     *  - encrypted=true: 활성 암호화 볼트가 잠겨 Auth 화면에 머무는 상태이므로 PIN으로 언락
     *    (암호화 볼트 재기동 시 cryptoKey 메모리 소실 → Home.tsx가 /auth로 보냄 — 정상 동작)
     *  - encrypted=false: 홈 경유 폴백 후 List 탭 클릭
     */
    private fun ensureAccountsList(env: BaseEnv, encrypted: Boolean = false) {
        with(env) {
            if (helper.waitForText("My accounts", 10000)) {
                Log.i(TAG, "Accounts list already active")
                return
            }
            if (encrypted && helper.waitForText("KIYO 잠금 해제", 5000)) {
                // 암호화 볼트 잠김 상태 → PIN 언락 (Auth.tsx handleVerifyPin)
                unlockLockedEnv(env)
                return
            }
            // 볼트 비활성(파일 선택 화면 등) → 홈 경유 후 List 탭으로
            homePage.ensureHomeScreen()
            if (!helper.waitForText("My accounts", 3000)) {
                if (!helper.clickByAriaLabel("List", "list tab")) {
                    throw AssertionError("Could not reach accounts list (no vault active and List tab not found)")
                }
                if (!helper.waitForText("My accounts", 10000)) {
                    helper.dumpViewHierarchy("accounts_list_not_loaded")
                    helper.captureScreen("accounts_list_not_loaded")
                    throw AssertionError("Accounts list did not load after navigation")
                }
            }
        }
    }

    /**
     * WebView 캐시 등 앱 로컬 캐시 정리 (볼트 데이터가 아닌 webview 캐시만).
     */
    fun clearWebViewCaches(context: Context) {
        Log.i(TAG, "Clearing app webview caches...")
        try {
            val appContext = context.createPackageContext(APP_PACKAGE, Context.CONTEXT_IGNORE_SECURITY)
            appContext.deleteDatabase("webview.db")
            appContext.deleteDatabase("webviewCache.db")
            appContext.cacheDir.deleteRecursively()
            appContext.getDir("webview", Context.MODE_PRIVATE).deleteRecursively()
        } catch (e: Exception) {
            Log.w(TAG, "clearWebViewCaches failed: ${e.message}")
        }
    }

    fun freshContext(): Context = ApplicationProvider.getApplicationContext()

    /**
     * 잠금화면 확보 — isDeviceSecure 실측 후 없으면 setPin (규칙 4).
     * 호출자는 finally에서 releaseDeviceSecure()를 반드시 호출할 것.
     */
    fun ensureDeviceSecure(context: Context): Boolean {
        val km = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        return km.isDeviceSecure
    }

    fun releaseDeviceSecure(context: Context, pin: String) {
        val km = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        if (km.isDeviceSecure) {
            DeviceOpsHelper.clearPin(context, pin)
        }
    }

    /**
     * 기본 환경 확보: 앱 기동 상태를 화면 실측으로 구분해 처리.
     *
     * 앱 기동 시 3가지 상태 (HomePage.ActiveState):
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
        testHost: AutofillTestHost,
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
            settingsPage = SettingsPage(helper, testHost),
            testHost = testHost,
        )

        // 1. 기동 + 활성 상태 실측
        val bound = launchAppAndBind(env, Target.FILES)
        val state = AppScreenState.detect(bound.helper)
        val activeVaultName = bound.homePage.getActiveVaultFileName()
        Log.i(TAG, "App started: state=$state activeVault=$activeVaultName target=$vaultName encrypted=$encrypted")

        // 2. 목표 볼트가 이미 활성이면 생성 생략
        if (activeVaultName == vaultName) {
            when (state) {
                AppScreenState.State.PLAIN_ACTIVE -> {
                    Log.i(TAG, "Target vault '$vaultName' already active (plain), skipping creation")
                    return bind(bound)
                }
                AppScreenState.State.ENCRYPTED_LOCKED -> {
                    if (encrypted) {
                        Log.i(TAG, "Target vault '$vaultName' already active (encrypted, locked) — unlocking with PIN")
                        unlockLockedEnv(bound)
                        return bind(bound)
                    }
                    Log.i(TAG, "Target vault '$vaultName' active but plain requested — replacing via file selection")
                }
                AppScreenState.State.NONE -> {
                    // 이름은 같지만 파일 선택 화면 = 실제 활성 아님 (목록 표시误读 등) → 생성 진행
                    Log.i(TAG, "Vault name matched on file list but no active vault — proceeding to create")
                }
            }
        }

        // 3. 파일 선택 화면까지 이동 (상태별 탈출 경로)
        navigateToFileSelection(bound, state, activeVaultName)

        // 4. 신규 볼트 생성 + 계정 생성
        Log.i(TAG, "Creating vault '$vaultName' (encrypted=$encrypted)...")
        val accounts = bound.homePage.clickCreateVaultButton()
            .createVault(vaultName, encrypted = encrypted)
        val accountEditPage = accounts.clickAddAccount()
            .selectDefaultTemplate()
            .fillAccount(
                com.kiyo.app.autofill.pageobjects.AccountEditPage.AccountData(
                    title = bound.account.title,
                    websiteUrl = bound.account.websiteUrl,
                    username = bound.account.username,
                    password = bound.account.password,
                    packageName = bound.account.packageName,
                )
            )
        accountEditPage.save()

        // 계정 저장 확인
        if (!helper.waitForText("My accounts", 10000)) {
            helper.dumpViewHierarchy("account_list_not_loaded")
            helper.captureScreen("account_list_not_loaded")
            throw AssertionError("Account list did not load after saving account")
        }
        if (!helper.waitForText(bound.account.title, 10000)) {
            helper.dumpViewHierarchy("account_not_saved")
            helper.captureScreen("account_not_saved")
            throw AssertionError("Account title '${bound.account.title}' not found in accounts list after save")
        }

        // 자동완성 사용 토글 ON + 서비스 활성화
        val settings = SettingsPage(helper, testHost).navigateToSettings()
        settings.enableAutofillToggle()
        settings.activateAutofillService()

        // 5. LIST 화면으로 이동해 반환 (sync는 호출자가)
        // encrypted=true: 재기동 시 암호화 볼트가 잠겨 Auth로 가므로 PIN 언락 경로가 필요함을 전달
        return launchAppAndBind(env, Target.LIST, encrypted)
    }

    /** 잠긴 암호화 볼트를 PIN으로 언락해 계정 리스트까지 도달 (ENCRYPTED_LOCKED 전제). */
    private fun unlockLockedEnv(env: BaseEnv) {
        with(env) {
            val typed = helper.typeByXPath("//input[@id='pin']", TestDataFactory.TEST_PIN, "auth pin input") ||
                helper.typeByInputType("password", TestDataFactory.TEST_PIN, "auth pin input fallback")
            if (!typed) {
                helper.dumpViewHierarchy("auth_pin_input_missing")
                helper.captureScreen("auth_pin_input_missing")
                throw AssertionError("Auth screen shown but PIN input not found")
            }
            Thread.sleep(500)
            if (!helper.clickByText("확인", "auth confirm button")) {
                throw AssertionError("Could not tap auth confirm button")
            }
            if (!helper.waitForText("My accounts", 15000)) {
                helper.dumpViewHierarchy("pin_unlock_no_accounts")
                helper.captureScreen("pin_unlock_no_accounts")
                throw AssertionError("Accounts list did not load after PIN unlock")
            }
            Log.i(TAG, "Encrypted vault unlocked with PIN")
        }
    }

    /** 활성 상태에 맞는 탈출 경로로 파일 선택 화면까지 이동.
     *  PLAIN_ACTIVE → Settings > 파일변경 "이동" / ENCRYPTED_LOCKED → Auth 뒤로가기 / NONE → 그대로. */
    internal fun navigateToFileSelectionForPrepare(
        env: BaseEnv,
        state: AppScreenState.State,
    ) {
        navigateToFileSelection(env, state, env.homePage.getActiveVaultFileName())
    }

    /** 활성 상태에 맞는 탈출 경로로 파일 선택 화면까지 이동.
     *  PLAIN_ACTIVE → Settings > 파일변경 "이동" / ENCRYPTED_LOCKED → Auth 뒤로가기 / NONE → 그대로. */
    private fun navigateToFileSelection(
        env: BaseEnv,
        state: AppScreenState.State,
        activeVaultName: String?,
    ) {
        if (state == AppScreenState.State.NONE) {
            Log.i(TAG, "Already on file selection screen")
            return
        }
        Log.i(TAG, "Navigating to file selection from state=$state (active=$activeVaultName)")
        val reached = when (state) {
            AppScreenState.State.PLAIN_ACTIVE -> AppScreenState.navigateToFileSelectionViaSettings(env.helper)
            AppScreenState.State.ENCRYPTED_LOCKED -> AppScreenState.escapeAuthToFileSelection(env.helper)
            AppScreenState.State.NONE -> true
        }
        if (!reached) {
            env.helper.dumpViewHierarchy("file_selection_unreachable")
            env.helper.captureScreen("file_selection_unreachable")
            throw AssertionError(
                "Could not reach file selection screen from state=$state (active='$activeVaultName')"
            )
        }
    }
}
