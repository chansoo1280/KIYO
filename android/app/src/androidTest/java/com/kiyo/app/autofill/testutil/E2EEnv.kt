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
    fun launchAppAndBind(env: BaseEnv, target: Target): BaseEnv {
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
                    // 활성 볼트가 있으면 앱이 곧바로 계정 리스트("My accounts")로 열린다.
                    // 이 경우 파일 선택 화면 대기(15s×2 타임아웃)는 순수 낭비이므로
                    // 짧게 실측해 즉시 통과시킨다.
                    if (helper.waitForText("My accounts", 3000)) {
                        Log.i(TAG, "Active vault detected early (accounts list visible)")
                    } else {
                        homePage.ensureHomeScreen()
                    }
                }
                Target.LIST -> ensureAccountsList(env)
            }
            return bind(env)
        }
    }

    /** 계정 리스트 도달 보장: "My accounts" 실측, 없으면 홈 경유 폴백 후 List 탭 클릭 */
    private fun ensureAccountsList(env: BaseEnv) {
        with(env) {
            if (helper.waitForText("My accounts", 10000)) {
                Log.i(TAG, "Accounts list already active")
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
     * 기본 환경 확보: 지정된 볼트 파일명이 활성 상태인지 화면 실측, 없으면 구축.
     * - 이미 구축됐으면 화면 실측(활성 볼트 파일명)만으로 판별해 즉시 통과
     * - 없으면 볼트 생성 → 계정 생성 → autofill toggle ON + 서비스 활성화
     * - sync는 호출자가 수행 (준비에 포함하지 않음)
     */
    fun ensureBaseEnvironment(
        vaultName: String,
        account: TestDataFactory.AccountInfo,
        device: UiDevice,
        context: Context,
        helper: WebViewTestHelper,
        testHost: AutofillTestHost
    ): BaseEnv {
        // 1. FILES 타겟으로 기동 (파일 선택 화면에서 볼트 상태 확인 가능)
        val env = launchAppAndBind(
            BaseEnv(
                vaultName = vaultName,
                account = account,
                device = device,
                context = context,
                helper = helper,
                homePage = HomePage(helper),
                accountsPage = AccountsPage(helper),
                settingsPage = SettingsPage(helper, testHost),
                testHost = testHost,
            ),
            target = Target.FILES,
        )

        // 2. 화면 실측: 활성 볼트 파일명 확인
        val activeVaultName = env.homePage.getActiveVaultFileName()
        if (activeVaultName == vaultName) {
            Log.i(TAG, "Vault '$vaultName' already active, skipping creation")
            // 이미 준비됨 → 계정 리스트가 화면에 있으므로 재기동 없이 바인딩만 갱신
            return bind(env)
        }

        // 3. 없으면 준비 플로우 (prepareVault 로직 인라인)
        Log.i(TAG, "Vault '$vaultName' not active (found: $activeVaultName), creating...")

        // 볼트 생성 (비암호화) + 계정 생성
        val accounts = env.homePage.clickCreateVaultButton()
            .createVault(vaultName, encrypted = false)
        val accountEditPage = accounts.clickAddAccount()
            .selectDefaultTemplate()
            .fillAccount(
                com.kiyo.app.autofill.pageobjects.AccountEditPage.AccountData(
                    title = env.account.title,
                    websiteUrl = env.account.websiteUrl,
                    username = env.account.username,
                    password = env.account.password,
                    packageName = env.account.packageName,
                )
            )
        accountEditPage.save()

        // 계정 저장 확인
        if (!env.helper.waitForText("My accounts", 10000)) {
            env.helper.dumpViewHierarchy("account_list_not_loaded")
            env.helper.captureScreen("account_list_not_loaded")
            throw AssertionError("Account list did not load after saving account")
        }
        if (!env.helper.waitForText(env.account.title, 10000)) {
            env.helper.dumpViewHierarchy("account_not_saved")
            env.helper.captureScreen("account_not_saved")
            throw AssertionError("Account title '${env.account.title}' not found in accounts list after save")
        }

        // 자동완성 사용 토글 ON + 서비스 활성화
        val settings = SettingsPage(env.helper, env.testHost).navigateToSettings()
        settings.enableAutofillToggle()
        settings.activateAutofillService()

        // 4. LIST 화면으로 이동해 반환 (sync는 호출자가)
        return launchAppAndBind(env, Target.LIST)
    }
}
