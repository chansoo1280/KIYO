<# 
.SYNOPSIS
    Run KIYO Autofill E2E tests with proper device setup.
    
.DESCRIPTION
    This script:
    1. Builds & installs app + test APKs (skipped with -SkipBuild)
    2. Sets up PIN on the emulator
    3. Unlocks the device
    4. Runs the E2E test via "adb shell am instrument"
    5. Cleans up (clears PIN)
    
    Uses adb am instrument directly instead of ./gradlew connectedAndroidTest,
    so repeated runs skip the Gradle configuration/build overhead.
    
.PREREQUISITES
    - Android emulator running (adb devices shows it)
    
.EXAMPLE
    .\run-autofill-e2e.ps1
    .\run-autofill-e2e.ps1 -TestClass com.kiyo.app.autofill.AutofillE2ETest -TestMethod DEBUG_2_AccountCreationOnly
    .\run-autofill-e2e.ps1 -SkipBuild   # reuse already-installed APKs (fastest loop)
#>

param(
    [string]$Pin = "1234",
    [string]$TestClass = "com.kiyo.app.autofill.AutofillE2ETest",
    [string]$TestMethod = "",
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
# Note: "-notmatch" against an array filters non-matching elements (always truthy),
# so we must test whether ANY line matches instead.
$deviceLine = $devices | Where-Object { $_.Trim() -match "emulator-\d+\s+device" }
if (-not $deviceLine) {
    Write-ErrorLog "No emulator device found. Run emulator first."
    exit 1
}
Write-Log "Device found: $deviceLine"

if (-not $SkipSetup) {
    # Clear any existing PIN (1단계 테스트는 잠금화면 없는 상태가 전제.
    # PIN 설정은 하지 않음 — 2단계 테스트가 테스트 코드 내부에서 setDevicePin()으로 직접 설정)
    Write-Log "Clearing existing PIN..."
    & $adb shell "locksettings clear --old $Pin 0" 2>$null

    # Wake up device (no PIN setup/unlock here)
    Write-Log "Waking up device..."
    & $adb shell "input keyevent KEYCODE_WAKEUP"
    Start-Sleep -Milliseconds 1000

    # Swipe up to dismiss lock screen (if any)
    Write-Log "Swiping up..."
    & $adb shell "input swipe 300 1000 300 500"
    Start-Sleep -Milliseconds 500
}

# Build & install APKs (unless skipped)
$androidDir = Join-Path $PSScriptRoot "android"
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

# Build the "am instrument" class argument
$ClassArg = $TestClass
if ($TestMethod -ne "") {
    $ClassArg = "$TestClass#$TestMethod"
}

# Run the test via adb am instrument (bypasses Gradle overhead on repeat runs)
Write-Log "Running E2E test: $ClassArg"
Write-Log "Command: adb shell am instrument -w -e class $ClassArg $TestPackage/$Runner"

try {
    & $adb shell am instrument -w `
        -e class $ClassArg `
        "$TestPackage/$Runner"
    if ($LASTEXITCODE -ne 0) {
        throw "am instrument exited with code $LASTEXITCODE"
    }
    Write-Success "E2E test completed successfully"
} catch {
    Write-ErrorLog "E2E test failed"
    throw
} finally {
    if (-not $SkipCleanup) {
        Write-Log "Cleaning up PIN..."
        & $adb shell "locksettings clear --old $Pin 0" 2>$null
        Write-Success "PIN cleared"
    }
}