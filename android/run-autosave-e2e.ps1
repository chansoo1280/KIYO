<#
.SYNOPSIS
    Run KIYO Auto-save (자동 백업) E2E tests (simplified — no host watcher).

.DESCRIPTION
    최소화된 호스트 스크립트. SAF picker 자동화는 **비활성화**되어 있으며,
    picker에서 "Use this folder" 또는 "이 폴더 사용"을 직접 눌러야 한다.
    (이전 버전의 Start-Job 기반 watcher는 instrumentation process의
     UiAutomationService 등록과 충돌하는 것으로 보임 — BiometricUnlockE2ETest
     도 같은 setup 패턴인데도, 본 테스트에서만 죽는 원인으로 지목됨.
     2026-08-29 실측.)

    동작:
    1. Builds & installs app + test APKs (-SkipBuild 옵션 가능)
    2. Wakes/unlocks the device
    3. am instrument로 시나리오 실행 (SAF picker가 뜨면 사용자가 직접 운전)
    4. (선택) -RunPickerManually: 60초 동안 picker를 사용자가 운전할 시간을 줌
       (스크립트가 안내만 출력, sleep만 함)

    사용 예:
      .\run-autosave-e2e.ps1                                  # full run
      .\run-autosave-e2e.ps1 -SkipBuild                      # reuse installed APKs
      .\run-autosave-e2e.ps1 -TestMethod enableAutoBackup_persistsState -SkipBuild
      .\run-autosave-e2e.ps1 -SkipBuild -WaitForPickerSec 60 # 60초 대기
#>
param(
    [string]$Pin = "1234",
    [switch]$Fresh,
    [string]$TestClass = "",
    [string]$TestMethod = "",
    [string]$VaultName = "",
    [string]$AppPackage = "com.kiyo.app",
    [string]$TestPackage = "com.kiyo.app.test",
    [string]$Runner = "androidx.test.runner.AndroidJUnitRunner",
    [int]$WaitForPickerSec = 0,
    [switch]$SkipBuild,
    [switch]$SkipSetup,
    [switch]$SkipCleanup
)

$ErrorActionPreference = "Stop"

function Write-Log($message) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $message" -ForegroundColor Cyan }
function Write-ErrorLog($message) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: $message" -ForegroundColor Red }
function Write-Success($message) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $message" -ForegroundColor Green }

$adb = "${env:ANDROID_HOME}\platform-tools\adb.exe"
if (-not (Test-Path $adb)) { $adb = "${env:LOCALAPPDATA}\Android\Sdk\platform-tools\adb.exe" }
if (-not (Test-Path $adb)) { $adb = "adb.exe" }
Write-Log "Using adb: $adb"

$devices = & $adb devices
$deviceLine = $devices | Where-Object { $_.Trim() -match "emulator-\d+\s+device" }
if (-not $deviceLine) {
    Write-ErrorLog "No emulator device found. Run emulator first."
    exit 1
}
Write-Log "Device found: $deviceLine"

$ScenarioClass = "com.kiyo.app.autosave.AutosaveE2ETest"
$targets = @()
if ($TestClass -ne "") { $targets += $TestClass }
elseif ($TestMethod -ne "") { $targets += "$ScenarioClass#$TestMethod" }
else { $targets += $ScenarioClass }

if (-not $SkipSetup) {
    Write-Log "Waking up device..."
    & $adb shell "input keyevent KEYCODE_WAKEUP" 2>$null | Out-Null
    Start-Sleep -Milliseconds 1000
    & $adb shell "input swipe 300 1000 300 500" 2>$null | Out-Null
    Start-Sleep -Milliseconds 500
}

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

try {
    & $adb shell am force-stop $AppPackage 2>$null | Out-Null

    if ($VaultName -eq "") {
        $VaultName = "e2e-vault-autosave"
        Write-Log "Auto-generated session vault name: $VaultName"
    }

    foreach ($target in $targets) {
        $classArg = $target

        $extraArgs = @()
        if ($Fresh) { $extraArgs += "-e", "freshVault", "true" }
        if ($VaultName -ne "") { $extraArgs += "-e", "vaultName", $VaultName }

        Write-Log "Running E2E: $classArg $($extraArgs -join ' ')"
        # Start-Job 없이 직접 실행. 사용자가 picker에서 직접 운전할 수 있도록
        # -eDebug 옵션으로 background instrumentation을 시작하지 않음.
        & $adb shell am instrument -w @extraArgs `
            -e class $classArg `
            "$TestPackage/$Runner"
        if ($LASTEXITCODE -ne 0) {
            throw "am instrument exited with code $LASTEXITCODE ($classArg)"
        }
        Write-Success "E2E completed: $classArg"
    }

    if ($WaitForPickerSec -gt 0) {
        Write-Log "Sleeping $WaitForPickerSec seconds for manual picker interaction (no-op now)"
        Start-Sleep -Seconds $WaitForPickerSec
    }

    Write-Success "All autosave E2E runs finished successfully"
} catch {
    Write-ErrorLog "E2E test failed: $_"
    throw
} finally {
    if (-not $SkipCleanup) {
        Write-Log "Cleanup: no-op (autosave state preserved in settings for next run)"
    }
}
