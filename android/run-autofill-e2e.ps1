<#
.SYNOPSIS
    Run KIYO Autofill E2E tests with proper device setup.

.DESCRIPTION
    This script:
    1. Builds & installs app + test APKs (skipped with -SkipBuild)
    2. Wakes/unlocks the device
    3. Runs the E2E tests via "adb shell am instrument"
    4. Cleans up (clears PIN as a safety net)

    PIN set/clear is now handled INSIDE each test (자기완결 — plan 2026-08-25).
    The script only clears leftover PIN before/after as a safety net.

    Test classes:
      - com.kiyo.app.autofill.AutofillE2EPrepareTest  : prepareVault (사전준비, sync 미포함)
      - com.kiyo.app.autofill.AutofillE2ETest         : noAuthFill / authResync / downgradeReset
    Full run invokes PrepareTest first, then AutofillE2ETest (2 am-instrument calls),
    because am instrument runs one class per invocation.

    Vault name: pass -VaultName <name> to reuse a fixed vault across runs
    (deterministic account derived from the vault name). Omitted → the script
    auto-generates ONE vault name per invocation session and passes it to both
    classes, so prepareVault and scenario runs share the same vault.

.processDeathFill REMOVED (2026-08-26):
    "명시적 인증 없는 재래핑 후 프로세스 kill 생존"은 현 Keystore 설계에서
    성립하지 않음(프로세스 사망 시 인증 캐시 소멸 — 실험 검증됨).
    해당 검증은 authResync의 마지막 단계(kill → auth dataset → PIN → fill)로 통합됨.

.EXAMPLE
    .\run-autofill-e2e.ps1                                   # full run (prepare -> scenarios)
    .\run-autofill-e2e.ps1 -SkipBuild                        # reuse installed APKs
    .\run-autofill-e2e.ps1 -TestMethod authResync -VaultName debug-vault
    .\run-autofill-e2e.ps1 -TestClass com.kiyo.app.autofill.AutofillE2EPrepareTest -VaultName debug-vault
#>

param(
    [string]$Pin = "1234",
    [string]$TestClass = "",   # empty = full run (PrepareTest then AutofillE2ETest)
    [string]$TestMethod = "",
    [string]$VaultName = "",
    [string]$AppPackage = "com.kiyo.app",
    [string]$TestPackage = "com.kiyo.app.test",
    [string]$Runner = "androidx.test.runner.AndroidJUnitRunner",
    [switch]$SkipBuild,
    [switch]$SkipSetup,
    [switch]$SkipCleanup
)

$ErrorActionPreference = "Stop"

function Write-Log($message) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $message" -ForegroundColor Cyan
}

function Write-ErrorLog($message) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: $message" -ForegroundColor Red
}

function Write-Success($message) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $message" -ForegroundColor Green
}

# Find adb
$adb = "${env:ANDROID_HOME}\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
    $adb = "${env:LOCALAPPDATA}\Android\Sdk\platform-tools\adb.exe"
}
if (-not (Test-Path $adb)) {
    $adb = "adb.exe"  # Assume in PATH
}

Write-Log "Using adb: $adb"

# Check device
$devices = & $adb devices
$deviceLine = $devices | Where-Object { $_.Trim() -match "emulator-\d+\s+device" }
if (-not $deviceLine) {
    Write-ErrorLog "No emulator device found. Run emulator first."
    exit 1
}
Write-Log "Device found: $deviceLine"

# Determine which class(es) to run.
# NOTE: am instrument supports a single "class[#method]" target per invocation,
#       so multi-method/multi-class runs require multiple calls.
$PrepareClass = "com.kiyo.app.autofill.AutofillE2EPrepareTest"
$ScenarioClass = "com.kiyo.app.autofill.AutofillE2ETest"
$targets = @()
if ($TestClass -ne "" ) { $targets += $TestClass }
else { $targets += $PrepareClass; $targets += $ScenarioClass }   # full run

if (-not $SkipSetup) {
    # Safety net: clear any existing PIN (tests manage PIN themselves now)
    Write-Log "Clearing existing PIN (safety net; tests manage their own PIN)..."
    & $adb shell "locksettings clear --old $Pin 0" 2>$null

    Write-Log "Waking up device..."
    & $adb shell "input keyevent KEYCODE_WAKEUP"
    Start-Sleep -Milliseconds 1000

    Write-Log "Swiping up..."
    & $adb shell "input swipe 300 1000 300 500"
    Start-Sleep -Milliseconds 500
}

# Build & install APKs (unless skipped)
$androidDir = $PSScriptRoot
if (-not $SkipBuild) {
    Write-Log "Building and installing app + test APKs..."
    Push-Location $androidDir
    try {
        & ./gradlew.bat :app:installDebug :app:installDebugAndroidTest --console=plain
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorLog "Build/install failed"
            exit 1
        }
    } finally {
        Pop-Location
    }
    Write-Success "APKs installed"
} else {
    Write-Log "Skipping build (-SkipBuild) - using already-installed APKs"
}

# Run each target via adb am instrument
try {
    # 전체 실행 시 PrepareTest와 ScenarioClass가 같은 볼트를 공유해야 하므로,
    # 미지정이어도 실행 세션당 하나의 vaultName을 생성해 모든 호출에 동일 전달한다.
    if ($VaultName -eq "") {
        $VaultName = "e2e-vault-plain-{0}" -f (Get-Date -Format 'yyyyMMddHHmmss')
        Write-Log "Auto-generated session vault name: $VaultName"
    }
    foreach ($target in $targets) {
            $classArg = $target
            if ($TestMethod -ne "") {
                $classArg = "$target#$TestMethod"
            }

            $extraArgs = @()
            if ($VaultName -ne "") {
                # 테스터가 지정한 고정 볼트 파일명 → 결정적 계정 도출과 함께 재사용 가능
                $extraArgs += "-e", "vaultName", $VaultName
            }

            Write-Log "Running E2E: $classArg $($extraArgs -join ' ')"
            & $adb shell am instrument -w @extraArgs `
                -e class $classArg `
                "$TestPackage/$Runner"
            if ($LASTEXITCODE -ne 0) {
                throw "am instrument exited with code $LASTEXITCODE ($classArg)"
            }
            Write-Success "E2E completed: $classArg"
        }
    Write-Success "All E2E runs finished successfully"
} catch {
    Write-ErrorLog "E2E test failed"
    throw
} finally {
    if (-not $SkipCleanup) {
        Write-Log "Cleaning up PIN (safety net)..."
        & $adb shell "locksettings clear --old $Pin 0" 2>$null
        Write-Success "PIN cleared"
    }
}
