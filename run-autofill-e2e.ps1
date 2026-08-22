<# 
.SYNOPSIS
    Run KIYO Autofill E2E tests with proper device setup.
    
.DESCRIPTION
    This script:
    1. Sets up PIN on the emulator
    2. Unlocks the device
    3. Runs the E2E test
    4. Cleans up (clears PIN)
    
.PREREQUISITES
    - Android emulator running (adb devices shows it)
    - Gradle built test APKs (./gradlew assembleDebugAndroidTest)
    
.EXAMPLE
    .\run-autofill-e2e.ps1
#>

param(
    [string]$Pin = "1234",
    [string]$TestClass = "com.kiyo.app.autofill.AutofillChromeE2ETest",
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
if ($devices -notmatch "emulator-\d+\s+device") {
    Write-ErrorLog "No emulator device found. Run emulator first."
    exit 1
}
Write-Log "Device found: $($devices -split "`n" | Where-Object { $_ -match "emulator-\d+" })"

if (-not $SkipSetup) {
    # Clear any existing PIN first
    Write-Log "Clearing existing PIN..."
    & $adb shell "locksettings clear --old $Pin 0" 2>$null
    
    # Set new PIN
    Write-Log "Setting PIN to $Pin..."
    $result = & $adb shell "locksettings set-pin $Pin 0"
    if ($LASTEXITCODE -ne 0 -or $result -notlike "*set to*") {
        Write-ErrorLog "Failed to set PIN: $result"
        exit 1
    }
    Write-Success "PIN set successfully"
    
    # Wake up device
    Write-Log "Waking up device..."
    & $adb shell "input keyevent KEYCODE_WAKEUP"
    Start-Sleep -Milliseconds 1000
    
    # Swipe up to dismiss lock screen
    Write-Log "Swiping up..."
    & $adb shell "input swipe 300 1000 300 500"
    Start-Sleep -Milliseconds 500
    
    # Enter PIN
    Write-Log "Entering PIN..."
    & $adb shell "input text $Pin"
    Start-Sleep -Milliseconds 300
    
    # Press Enter
    Write-Log "Pressing Enter..."
    & $adb shell "input keyevent KEYCODE_ENTER"
    Start-Sleep -Milliseconds 1000
    
    # Verify unlocked
    Write-Log "Verifying device is unlocked..."
    $policy = & $adb shell "dumpsys window policy | Select-String 'trusted=true'"
    if ($policy -notmatch "trusted=true") {
        Write-ErrorLog "Device may not be fully unlocked. Policy: $policy"
        # Continue anyway, test will verify
    } else {
        Write-Success "Device unlocked (trusted=true)"
    }
}

# Run the test
Write-Log "Running E2E test: $TestClass"
Write-Log "Command: ./gradlew connectedAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=$TestClass"

try {
    & ./gradlew connectedAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=$TestClass --console=plain
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