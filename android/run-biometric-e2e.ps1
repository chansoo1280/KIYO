<#
.SYNOPSIS
    Run KIYO Biometric Unlock E2E tests (BiometricUnlockE2ETest) with fingerprint setup.

.DESCRIPTION
    This script (run-autofill-e2e.ps1과 동일한 prepare → scenario 2단 구조):
    1. Builds & installs app + test APKs (skipped with -SkipBuild)
    2. Setup: sets device PIN + enrolls a fingerprint on the emulator
       (skipped if already enrolled — reuse, plan 2026-08-26)
    3. Runs 사전준비 먼저: BiometricE2EPrepareTest.prepareEncryptedVault
       (암호화 볼트 생성 + 계정 생성; autofill toggle/sync는 시나리오 소관)
    4. Runs 시나리오: BiometricUnlockE2ETest via "adb shell am instrument"
       — logcat watcher job이 "BIOMETRIC_E2E <marker> AWAIT_FINGER" 마커를 감지하면
         `adb emu finger touch`를 주입 (호스트-기기 협력 프로토콜;
         `emu finger touch`는 호스트 adb 전용이라 기기 내 실행 불가)
    5. Cleanup: clears device PIN once (enrolled fingerprints are removed by the
       framework along with the last credential). Per-test biometric key cleanup
       is done inside each test's finally (disableBiometric).

    ⚠️ Run ONLY through this script. The tests assert isDeviceSecure in @Before
    and fail fast otherwise.

.EXAMPLE
    .\run-biometric-e2e.ps1                    # build + full run (prepareEncryptedVault -> scenarios)
    .\run-biometric-e2e.ps1 -SkipBuild         # reuse installed APKs
    .\run-biometric-e2e.ps1 -SkipPrepare       # vault already prepared by a previous run
    .\run-biometric-e2e.ps1 -TestMethod unlockWithBiometric_restoresSession -SkipBuild
    .\run-biometric-e2e.ps1 -TestClass com.kiyo.app.biometric.BiometricE2EPrepareTest -VaultName enc-debug
#>

param(
    [string]$Pin = "1234",
    [string]$TestClass = "",   # empty = full run (PrepareTest then BiometricUnlockE2ETest)
    [string]$TestMethod = "",
    [string]$VaultName = "",
    [string]$AppPackage = "com.kiyo.app",
    [string]$TestPackage = "com.kiyo.app.test",
    [string]$Runner = "androidx.test.runner.AndroidJUnitRunner",
    [int]$MarkerTimeoutSec = 30,
    [switch]$SkipBuild,
    [switch]$SkipSetup,
    [switch]$SkipPrepare,      # skip the prepareEncryptedVault instrument call
    [switch]$SkipCleanup
)

$ErrorActionPreference = "Stop"
$MarkerTag = "BIOMETRIC_E2E"
$FingerId = "1"

function Write-Log($message) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $message" -ForegroundColor Cyan }
function Write-ErrorLog($message) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ERROR: $message" -ForegroundColor Red }
function Write-Success($message) { Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $message" -ForegroundColor Green }

# Find adb
$adb = "${env:ANDROID_HOME}\platform-tools\adb.exe"
if (-not (Test-Path $adb)) { $adb = "${env:LOCALAPPDATA}\Android\Sdk\platform-tools\adb.exe" }
if (-not (Test-Path $adb)) { $adb = "adb.exe" }

Write-Log "Using adb: $adb"

# Check emulator
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
$PrepareClass = "com.kiyo.app.biometric.BiometricE2EPrepareTest"
$ScenarioClass = "com.kiyo.app.biometric.BiometricUnlockE2ETest"
$targets = @()
if ($TestClass -ne "" ) { $targets += $TestClass }
else {
    if (-not $SkipPrepare) { $targets += "$PrepareClass#prepareEncryptedVault" }
    $targets += $ScenarioClass   # full run
}

# ============ Fingerprint helpers ============

function Test-FingerprintEnrolled {
    <#
    ⚠️ settings 키(fingerprint_enrolled_user_keys)만으로는 부족함 (2026-08-27 실측):
    등록 레코드가 "깨진 껍데기" 상태(count=0, 스캔 시도 자체가 없던 이력)로 남아있어도
    키 값은 1이어서 오판 → 인증 화면에서 지문이 안 뜨고 PIN만 요구됨.
    건강한 판정은 dumpsys fingerprint의 prints JSON으로 병행한다:
    실제 스캔 횟수(count)가 0보다 큰 등록 항목이 존재해야 true.
    #>
    $out = & $adb shell "settings get secure fingerprint_enrolled_user_keys" 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $out -or ($out.ToString().Trim() -in @("null", "", "0"))) {
        return $false
    }
    # dumpsys 실측: prints JSON에 count > 0 항목 있어야 유효 등록
    $fpDump = (& $adb shell dumpsys fingerprint 2>$null | Out-String)
    if ($fpDump -match '"count":(\d+)') { return ([int]$Matches[1] -gt 0) }
    return $false
}

function Invoke-FingerprintEnrollment {
    <#
    에뮬레이터 지문 등록: 설정 앱 등록 화면(FINGERPRINT_ENROLL intent)을 운전하며
    `adb emu finger touch <fingerId>`를 반복 전송 — 각 터치가 스캔 1회로 처리된다.
    등록 완료 판정: settings 등록 키 실측.
    UI 좌표는 Pixel 에뮬레이터(1080x2424) 기준 실측값 (검증됨 2026-08-27).
    #>
    Write-Log "Enrolling fingerprint on emulator (setup UI automation)..."

    # 등록 화면 직접 호출 → PIN 재확인
    & $adb shell am start -a android.settings.FINGERPRINT_ENROLL 2>$null | Out-Null
    Start-Sleep -Seconds 4

    # PIN 재확인 화면 처리: 텍스트 입력 + Enter
    & $adb shell "input text $Pin" 2>$null | Out-Null
    & $adb shell "input keyevent KEYCODE_ENTER" 2>$null | Out-Null
    Start-Sleep -Seconds 3

    # Pixel Imprint 소개 화면: MORE → I AGREE (하단 우측 버튼 좌표)
    & $adb shell "input tap 911 2266" 2>$null | Out-Null
    Start-Sleep -Seconds 2
    & $adb shell "input tap 911 2266" 2>$null | Out-Null
    Start-Sleep -Seconds 3

    # "Touch the sensor" 화면 → 가상 HAL에 터치 반복 (enrollment 스캔)
    for ($i = 1; $i -le 8; $i++) {
        & $adb emu "finger touch $FingerId" 2>$null | Out-Null
        Start-Sleep -Milliseconds 1200
    }
    Start-Sleep -Seconds 2

    # "Fingerprint added" 완료 화면 → DONE
    & $adb shell "input tap 911 2266" 2>$null | Out-Null
    Start-Sleep -Seconds 1

    if (Test-FingerprintEnrolled) {
        Write-Success "Fingerprint enrolled"
    } else {
        Write-ErrorLog @"
Fingerprint enrollment could not be verified automatically.
Emulator UI differs per Android version — enroll manually once:
  Settings → Security & privacy → Device unlock → Fingerprint
(during enrollment screen, run: adb emu finger touch $FingerId repeatedly)
Then re-run this script (existing enrollment is reused).
"@
        & $adb shell "input keyevent KEYCODE_HOME" 2>$null | Out-Null
        exit 1
    }
}

function Start-FingerprintWatcher {
    <#
    logcat을 폴링하며 "BIOMETRIC_E2E <marker> AWAIT_FINGER" 마커를 감지하면
    adb emu finger touch를 주입하는 백그라운드 잡.
    CANCEL 포함 마커는 back 키로 프롬프트를 취소한다.

    중복 방지는 logcat -c(버퍼 클리어)가 아니라 마커 id 해셋으로 한다 (2026-08-27):
    -c는 읽기(-d)와 클리어 사이에 출력된 새 마커를 유실할 수 있다
    (실측: 활성화 AWAIT 직후 CANCEL 마커가 유실된 사례).
    마커 id는 시나리오별 고유값이므로 해셋 체크로 재처리만 막으면 되고,
    버퍼를 안 지우면 폴링 사이 로그가 절대 사라지지 않는다.
    (링 버퍼가 넘쳐 오래된 마커가 밀려나도 이미 처리된 것이라 무시하면 됨)
    #>
    $job = Start-Job -ScriptBlock {
        param($adbPath, $tag, $fingerId, $timeoutSec)
        $adb = $adbPath
        & $adb logcat -c 2>$null | Out-Null
        $processedMarkers = @{}
        while ($true) {
            $lines = (& $adb logcat -d -s "$tag`:I" 2>$null) | Out-String
            if ($lines) {
                # logcat -s 출력은 "TAG: message" 형태로 태그 뒤 콜론이 붙는다 (2026-08-27 실측 버그:
                # 콜론 미고려 정규식이라 마커가 절대 매칭되지 않아 주입이 안 일어났음)
                $matchesFound = [regex]::Matches($lines, "$tag`:?\s+(\S+)\s+(AWAIT_FINGER|CANCEL_FINGER)")
                foreach ($m in $matchesFound) {
                    $marker = $m.Groups[1].Value
                    $action = $m.Groups[2].Value
                    if ($processedMarkers.ContainsKey($marker)) { continue }
                    $processedMarkers[$marker] = $true
                    if ($action -eq "AWAIT_FINGER") {
                        Write-Output "[$marker] injecting finger touch"
                        # 화면이 꺼져 있으면 가상 HAL이 터치를 무시한다 (2026-08-27 실측) → wake 후 주입
                        & $adb shell "input keyevent KEYCODE_WAKEUP" 2>$null | Out-Null
                        Start-Sleep -Milliseconds 500
                        & $adb emu "finger touch $fingerId" 2>$null | Out-Null
                        # 실패 대비 재시도 (프롬프트 렌더링 지연)
                        Start-Sleep -Milliseconds 800
                        & $adb emu "finger touch $fingerId" 2>$null | Out-Null
                    } else {
                        Write-Output "[$marker] cancelling prompt (back key)"
                        & $adb shell "input keyevent KEYCODE_BACK" 2>$null | Out-Null
                    }
                }
            }
            Start-Sleep -Milliseconds 500
        }
    } -ArgumentList $adb, $MarkerTag, $FingerId, $MarkerTimeoutSec
    return $job
}

# ============ Setup ============

if (-not $SkipSetup) {
    # 1. 기기 PIN 설정 (지문 등록 전제). 이미 설정돼 있으면 재사용(스킵).
    $pinCheck = & $adb shell locksettings verify --old $Pin 2>$null | Out-String
    if ($pinCheck -match "verified") {
        Write-Log "Device PIN already set to test PIN (reusing)"
    } else {
        Write-Log "Setting device PIN..."
        & $adb shell "locksettings set-pin $Pin" 2>$null | Out-Null
        Start-Sleep -Seconds 1
        $verifyAgain = & $adb shell locksettings verify --old $Pin 2>$null | Out-String
        if ($verifyAgain -notmatch "verified") {
            Write-ErrorLog "Failed to set device PIN (locksettings verify failed)"
            exit 1
        }
        Write-Success "Device PIN set"
    }

    # 2. 지문 하드웨어 확인 (가상 fingerprint HAL — modality 2)
    $bioDump = & $adb shell "dumpsys biometric" 2>$null | Out-String
    if ($bioDump -notmatch "modality 2") {
        Write-ErrorLog "No fingerprint sensor on this emulator (modality 2 missing in dumpsys biometric)"
        exit 1
    }

    # 3. 지문 등록 — 이미 있으면 재사용, 없으면 등록 화면 운전 중 finger touch 반복
    if (Test-FingerprintEnrolled) {
        Write-Log "Fingerprint already enrolled - reusing"
    } else {
        Invoke-FingerprintEnrollment
    }

    Write-Log "Waking up device..."
    & $adb shell "input keyevent KEYCODE_WAKEUP"
    Start-Sleep -Milliseconds 1000
}

# ============ Build & Install ============

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

# ============ Run tests ============

try {
    # 앱 상태 초기화: 앱만 재시작 (테스트가 자체 vault/biometric 정리를 수행).
    & $adb shell am force-stop $AppPackage 2>$null | Out-Null

    # 전체 실행 시 PrepareTest와 ScenarioClass가 같은 암호화 볼트를 공유해야 하므로,
    # 미지정이어도 실행 세션당 하나의 vaultName을 생성해 모든 호출에 동일 전달한다.
    if ($VaultName -eq "") {
        $VaultName = "e2e-vault-enc"
        Write-Log "Using default vault name: $VaultName"
    }

    # 지문 주입 워처: 시나리오(BiometricUnlockE2ETest) 실행 동안만 필요.
    $watcherJob = Start-FingerprintWatcher
    Write-Log "Fingerprint injection watcher started (job $($watcherJob.Id))"

    try {
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
        Write-Success "All biometric E2E runs finished successfully"
    } finally {
        Stop-Job $watcherJob -ErrorAction SilentlyContinue
        Remove-Job $watcherJob -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-ErrorLog "E2E test failed: $_"
    throw
} finally {
    if (-not $SkipCleanup) {
        # 스크립트 생애주기 종료: clearPin 1회 — 마지막 자격증명 제거 시
        # 등록된 지문도 프레임워크에 의해 함께 소멸된다 (plan 규정).
        Write-Log "Cleanup: clearing device PIN (also removes enrolled fingerprints)..."
        & $adb shell "locksettings clear --old $Pin 0" 2>$null | Out-Null
        & $adb shell "locksettings clear --old $Pin" 2>$null | Out-Null
        Write-Success "PIN cleared"
    }
}
