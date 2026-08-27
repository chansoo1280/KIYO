# Debug Report: biometric-button-disabled-on-plain-vault

## Issue
- Trigger: `storeKey_enrollsBiometricProtection` 첫 실행 (am instrument 단독)
- Error: `java.lang.AssertionError: Biometric setup dialog did not appear` at `SettingsPage.enableBiometric`

## Investigation Evidence (추측 아님 — 에뮬레이터 실측)
- UIAutomator dump: 생체인증 버튼(`text="사용 안 함"`)이 `enabled="false"`로 렌더링 → 클릭 무효
- 활성 볼트: `e2e-vault-plain-20260826170848.json` — 이전 autofill E2E의 잔여 **비암호화** 볼트
- 코드: `SecuritySection.tsx:18` `isEncrypted = !!cryptoKey`, 버튼 `disabled={!isEncrypted}` (188행)

## Root Cause
`ensureEncryptedVault()` 빠른 경로("My accounts 보임 = 스킵")가 활성 볼트의
암호화 여부를 검사하지 않음. 언락된 plain 볼트도 My accounts를 띄우므로
plan의 "Auth 화면 = 암호화 볼트" 논리가 적용되지 않는 상태에서 스킵됨.

## Fix Direction (user approval pending)
- (a) Settings PIN 행 텍스트("설정"=plain / "변경"=encrypted, tsx:148) 실측 후 분기
- (b) 매번 force-stop + 고유 이름 암호화 볼트 신규 생성 (단순, stale 없음 — 권장)

## Handoff to ce-work
- File: `BiometricUnlockE2ETest.kt` `ensureEncryptedVault()`
- Regression: 시나리오 1~4 전체 재실행
- Security impact: NONE (테스트 인프라만 변경, 프로덕션 코드 미수정)
