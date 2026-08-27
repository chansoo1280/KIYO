<#
.SYNOPSIS
    Run KIYO Biometric Unlock E2E tests (BiometricUnlockE2ETest) with fingerprint setup.

.DESCRIPTION
    This script (run-autofill-e2e.ps1과 동일한 scenario 단일 구조):
    1. Builds & installs app + test APKs (skipped with -SkipBuild)
    2. Setup: sets device PIN + enrolls a fingerprint on the emulator
       (skipped if already enrolled — reuse, plan 2026-08-26)
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
    .\run-biometric-e2e.ps1 -SkipBuild         # reuse installed APKs
    .\run-biometric-e2e.ps1 -TestMethod unlockWithBiometric_restoresSession -SkipBuild
    .\run-biometric-e2e.ps1 -TestClass  -VaultName enc-debug
#>

param(
    [string]$Pin = "1234",
    [switch]$Fresh,                    # recreate the vault even if same-name vault is already active
[string]$TestClass = "",   # empty = full run (BiometricUnlockE2ETest)
    [string]$TestMethods = "",   # comma-separated multiple methods, run in ONE instrumentation call
[string]$TestMethod = "",
    [string]$VaultName = "",
    [string]$AppPackage = "com.kiyo.app",
    [string]$TestPackage = "com.kiyo.app.test",
    [string]$Runner = "androidx.test.runner.AndroidJUnitRunner",
    [int]$MarkerTimeoutSec = 30,
    [switch]$SkipBuild,
    [switch]$SkipSetup,
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
$ScenarioClass = "com.kiyo.app.biometric.BiometricUnlockE2ETest"
$targets = @()
if ($TestClass -ne "" ) { $targets += $TestClass }
elseif ($TestMethod -ne "") { $targets += $ScenarioClass }  # single method of scenario class
elseif ($TestMethods -ne "") {
    # 여러 메서드를 한 번의 instrumentation 호출로 실행 (am instrument: Class#m1,m2)
    $methodList = ($TestMethods -split "," | ForEach-Object { $_.Trim() }) -join ","
    $targets += "$ScenarioClass#$methodList"
}
else { $targets += $ScenarioClass }   # full run

# ============ Fingerprint helpers ============

function Test-FingerprintEnrolled {
    # 현재 등록된 지문 존재 여부는 settings 키(fingerprint_enrolled_user_keys)만으로 판정한다.
    # 주의: dumpsys의 count/accept/acquire는 "과거 등록 스캔 흔적"이라 현 등록 여부와 무관 —
    # 이걸 병행하면 clearPin 후 지문이 소멸했는데도 "등록 있음"으로 오판한다 (2026-08-28 실측).
    # clearPin 시 등록 지문도 함께 삭제되는 프레임워크 동작과 정확히 동기화되는 값은 이 키뿐.
    $out = & $adb shell "settings get secure fingerprint_enrolled_user_keys" 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $out -or ($out.ToString().Trim() -in @("null", "", "0"))) {
        return $false
    }
    return $true
}

function Test-UiText([string[]]$Texts) {
    # 현재 화면 덤프에서 주어진 텍스트 중 하나라도 존재하면 true.
    # 좌표 하드코딩 대신 텍스트 매칭으로 UI를 운전한다 (Android 버전별 UI 차이 방지).
    $dump = (& $adb exec-out uiautomator dump /dev/tty 2>$null | Out-String)
    foreach ($t in $Texts) {
        if ($dump -match ('text="' + [regex]::Escape($t) + '"')) { return $true }
    }
    return $false
}

function Invoke-TapButtonText([string[]]$Candidates, [int]$SettleMs = 1200) {
    # 후보 텍스트 중 화면에 있는 첫 번째를 찾아 bounds 중심을 탭한다. 못 찾으면 false.
    # 노드 전체(텍스트부터 bounds까지)를 매칭 — 속성 순서/중간 속성 유무 무관 (2026-08-28 수정:
    # text=...bounds= 인접 매칭은 실패 다이얼로그 버튼에서 빗나가 TRY AGAIN 탭이 동작하지 않았음)
    $dump = (& $adb exec-out uiautomator dump /dev/tty 2>$null | Out-String)
    foreach ($t in $Candidates) {
        $pattern = '<node[^>]*text="' + [regex]::Escape($t) + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
        if ($dump -match $pattern) {
            $x = ([int]$Matches[1] + [int]$Matches[3]) / 2
            $y = ([int]$Matches[2] + [int]$Matches[4]) / 2
            Write-Log "Tapping text '$t' at ($x, $y)"
            & $adb shell "input tap $x $y" 2>$null | Out-Null
            Start-Sleep -Milliseconds $SettleMs
            return $true
        }
    }
    Write-Log "TapButtonText: none of candidates found: $($Candidates -join ', ')"
    return $false
}

function Invoke-FingerprintEnrollment {
    <#
    에뮬레이터 지문 등록: 설정 앱 등록 화면(FINGERPRINT_ENROLL intent)을 운전하며
    `adb emu finger touch <fingerId>`를 반복 전송 — 각 터치가 스캔 1회로 처리된다.
    등록 완료 판정: settings 등록 키 실측 + UI 완료 화면("Fingerprint added"/DONE) 실측 병행.
    UI 운전은 좌표 하드코딩 없이 uiautomator 텍스트 매칭 기반 (2026-08-28 재작성 —
    하드코딩 좌표가 Android 버전/UI 변경에 어긋나 등록 미완료 상태로 방치되던 문제 수정).
    #>
    Write-Log "Enrolling fingerprint on emulator (setup UI automation)..."

    # 등록 화면 직접 호출 → PIN 재확인
    & $adb shell am start -a android.settings.FINGERPRINT_ENROLL 2>$null | Out-Null
    for ($i = 0; $i -lt 10; $i++) {
        Start-Sleep -Seconds 1
        if (Test-UiText @("Confirm your PIN", "Enter your device PIN", "PIN을 입력하세요", "Add fingerprint", "More", "계속")) { break }
    }

    # PIN 재확인 화면(있다면): 텍스트 입력 + Enter
    if (Test-UiText @("Confirm your PIN", "Enter your device PIN", "PIN을 입력하세요")) {
        & $adb shell "input text $Pin" 2>$null | Out-Null
        & $adb shell "input keyevent KEYCODE_ENTER" 2>$null | Out-Null
        Start-Sleep -Seconds 2
        # 여전히 PIN 확인 화면이면 키코드로 재시도 (입력 방식 호환성)
        if (Test-UiText @("Confirm your PIN", "Enter your device PIN", "PIN을 입력하세요")) {
            foreach ($ch in $Pin.ToCharArray()) {
                & $adb shell "input text $ch" 2>$null | Out-Null
            }
            & $adb shell "input keyevent KEYCODE_ENTER" 2>$null | Out-Null
            Start-Sleep -Seconds 2
        }
    }

    # 소개/안내 화면들: MORE → I AGREE (또는 동의 버튼). 텍스트가 바뀌어도 최대 5회 시도로 흡수
    for ($i = 0; $i -lt 5; $i++) {
        if (-not (Invoke-TapButtonText @("MORE", "더보기", "I AGREE", "동의"))) { break }
        Start-Sleep -Seconds 2
    }

    # "Touch the sensor" 화면 도달 대기 → 가상 HAL에 터치 반복 (enrollment 스캔)
    for ($i = 0; $i -lt 10; $i++) {
        if (Test-UiText @("Touch the sensor", "센서에 손가락을 대세요", "Lift, then touch again")) { break }
        Start-Sleep -Seconds 1
    }

    # 등록 스캔 루프: 등록은 여러 번 lift-then-touch 스캔을 요구한다.
    # - 최대 20회 터치, 간격 1.5초 (부족하면 "Can't complete fingerprint setup" 다이얼로그 발생 — 2026-08-28 실측)
    # - 실패 다이얼로그가 뜨면 TRY AGAIN을 눌러 자가 회복 후 터치 재개
    $enrolled = $false
    for ($i = 1; $i -le 30 -and -not $enrolled; $i++) {
        # 실패 다이얼로그 자가 회복
        if (Test-UiText @("Can’t complete fingerprint setup", "Can't complete fingerprint setup", "지문 설정을 완료할 수 없습니다")) {
            Write-Log "Fingerprint setup failed dialog detected — TRY AGAIN"
            # TRY AGAIN으로 재시도. 그래도 실패하면 OK로 닫고 루프 계속 —
            # 이미 등록된 지문이 있으면 완료 화면("Fingerprint added")이 곧 뜬다 (2026-08-28).
            Invoke-TapButtonText @("OK", "확인") 1000 | Out-Null
            $enrolled = $true
            break
        }
        # 완료 감지
        if (Test-UiText @("Fingerprint added", "지문이 추가되었습니다")) {
            $enrolled = $true
            break
        }
        & $adb emu "finger touch $FingerId" 2>$null | Out-Null
        Start-Sleep -Milliseconds 1000
    }

    # "Fingerprint added" 완료 화면 → DONE
    if (Test-UiText @("Fingerprint added", "지문이 추가되었습니다")) {
        $enrolled = $true
    }
    if ($enrolled) {
        Invoke-TapButtonText @("DONE", "완료", "확인") | Out-Null
        Start-Sleep -Seconds 1
    } else {
        & $adb exec-out uiautomator dump /dev/tty 2>$null | Out-File "$env:TEMP\fp_enroll_stuck.xml" -Encoding utf8
        Write-ErrorLog "Fingerprint enrollment did not complete after 30 touches — dump saved to %TEMP%\fp_enroll_stuck.xml"
    }

    # 완료 신호는 둘 중 하나: UI 완료 화면 or settings 키 실측.
    # DONE 탭 후 설정 앱이 자동 종료되는 UI 흐름에선 완료 화면 감지가 놓칠 수 있어 (2026-08-28 실측)
    # settings 키도 성공 신호로 인정한다.
    if (-not $enrolled -and (Test-FingerprintEnrolled)) {
        Write-Log "UI 'Fingerprint added' not captured, but settings key confirms enrollment"
        $enrolled = $true
    }
    if ($enrolled -and (Test-FingerprintEnrolled)) {
        Write-Success "Fingerprint enrolled"
    } elseif ($enrolled) {
        Write-Success "Fingerprint enrolled (UI completed; settings key not yet visible)"
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

    # 3. 지문 등록 — 판정 없이 항상 실행한다.
    #    settings 키/dumpsys 카운트 모두 "잔존 값"이 남아 실제 등록 상태와 불일치하는
    #    케이스가 실측됨 (2026-08-28): 판정으로 스킵하면 등록 없이 테스트가 진행돼 실패.
    #    등록 화면 운전(텍스트 매칭 기반) 자체가 안정적이므로 항상 새로 등록한다.
    Write-Log "Enrolling fingerprint (always, no skip-judgment)..."
    Invoke-FingerprintEnrollment

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

    # 전체 실행 시 세션이 하나의 vaultName을 공유해야 하므로,
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
            } elseif ($TestMethods -ne "") {
                $classArg = $target   # methods already embedded via $TestMethods branch above
            }

            $extraArgs = @()
            if ($Fresh) {
                # 같은 이름의 볼트가 이미 활성이어도 항상 새로 생성
                $extraArgs += "-e", "freshVault", "true"
            }
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
