# Plan-4: PIN 정책 완화 (4~20자, 문자/특수문자 허용) + 강도 표시

**Date:** 2026-08-30
**Worktree:** `feat/vault-integrity` (base `origin/dev`)
**Status:** ✅ **완료** (구현 + 검증 완료, commit 대기)
**Brainstorm Source:** `docs/brainstorms/2026-08-29-vault-file-integrity.md` — §7 옵션 C, §8 권장 분할, §9 Q2=(c) Plan-4는 가장 마지막/별도 트랙
**커밋 이력 (작업 세션):** Plan 검토 → ce-work (구현) → 사용자 피드백 3회 (강도 표시 UX, crypto 에러 안내, 버튼 disabled) → E2E 회귀 → 마무리

---

## 1. Goal

KIYO PIN 정책을 **숫자 4~6자리 → 4~20자 (문자/특수문자 포함 가능)** 으로 완화하고, 입력란 아래에 **zxcvbn 기반 강도 표시**를 추가한다.

**완료 시점의 참:**
1. 사용자는 **숫자 + 영문 + 특수문자 자유 조합**으로 4~20자 PIN을 설정할 수 있다.
2. PIN 입력란 아래에 **강도 표시(매우 약함/약함/보통/강함/매우 강함)**가 실시간으로 나타난다.
3. 강도 표시는 **PIN 자체를 막지 않는다** (점수가 낮아도 PIN 설정/unlock 가능). 정보 제공 목적.
4. 기존 PIN 사용자의 기존 파일은 **그대로 unlock 가능** — format 변경 0, crypto 변경 0.
5. KDF iterations/Autofill/Keystore/SecureKey 경로 **전부 변경 없음**.

---

## 2. 범위 명확화

| 항목 | 상태 |
|---|---|
| **PIN 길이: 4 → 4~20자** | ✅ **Plan-4 변경** |
| **PIN 문자 종류: 숫자만 → 자유 (문자/특수문자 가능)** | ✅ **Plan-4 변경** |
| 기존 다이얼로그 4개 (FileCreate/FileOpen/PinChange/Auth) | **그대로 유지** (input 속성만 조정) |
| crypto 경로 (`createCryptoKey`, `encryptData`, `decryptData`) | **변경 없음** (이미 `encoder.encode(pin)` 사용) |
| `EncryptedKiyoVaultData` 포맷 | **변경 없음** |
| KDF iterations 100k | **변경 없음** |
| 마이그레이션 | **불필요** (format 동일) |
| 텍스트 패스프레이즈 옵션 (PIN 외 별도 입력 모델) | **범위 밖** |
| **PIN 입력란 아래 zxcvbn 강도 표시** | ✅ **Plan-4 변경** |

---

## 3. Current State (인스펙션)

### 3.1 PIN 입력 속성 (변경 필요)

| 파일 | 라인 | 현재 | 변경 |
|---|---|---|---|
| `src/pages/Auth.tsx` | 228 | `maxLength={6}` | `maxLength={20}` |
| `src/components/dialogs/FileCreateDialog.tsx` | 108-109 | `inputMode="numeric" maxLength={6}` | `inputMode="text" maxLength={20}` (`type="password"` 유지) |
| `src/components/dialogs/FileOpenDialog.tsx` | 121-122 | 동일 | 동일 |
| `src/pages/Settings/components/PinChangeDialog.tsx` | 123, 142 | `maxLength={6}` | `maxLength={20}` |
| `src/pages/Settings/components/PinChangeDialog.tsx` | 42-48 | `length < 4 \|\| length > 6` + `^\d+$` | `length < 4 \|\| length > 20` (정규식 제거) |

### 3.2 검증 메시지/placeholder (변경 필요)

| 위치 | 현재 | 변경 |
|---|---|---|
| `PinChangeDialog.tsx:43` | `"PIN은 4~6자리 숫자여야 합니다."` | `"PIN은 4~20자로 입력해 주세요."` |
| `PinChangeDialog.tsx:47` | `"PIN은 숫자만 입력 가능합니다."` | **삭제** (제약 제거) |
| `PinChangeDialog.tsx:120-121` | `"새 PIN 입력 (4~6자리 숫자)"` | `"새 PIN 입력 (4~20자)"` |
| `Auth.tsx:227` | `placeholder="4자리 핀번호"` | `placeholder="4~20자 PIN"` |
| `FileCreateDialog.tsx:112` | `placeholder="6자리 PIN"` | `placeholder="4~20자 PIN"` |
| `FileOpenDialog.tsx:125` | `placeholder="6자리 PIN"` | `placeholder="4~20자 PIN"` |

### 3.3 crypto 경로 (변경 없음)

- `src/crypto/encryption.ts:36-67` `createCryptoKey(pin, salt)` — `encoder.encode(pin)` 후 PBKDF2 100k
- **변경 없음** — 4~6자리든 4~20자든 동일 경로 통과
- zxcvbn은 UI 표시용 (인증 게이트 아님)

### 3.4 강도 표시 위치 (신규 추가)

| 파일 | 위치 |
|---|---|
| `FileCreateDialog.tsx` | PIN input div 아래 |
| `FileOpenDialog.tsx` | PIN input div 아래 |
| `PinChangeDialog.tsx` | **newPin input 아래만** (currentPin/confirmPin 제외) |
| `Auth.tsx` | PIN input div 아래 |

---

## 4. Relevant Files

### 4.1 신규

| 파일 | 역할 |
|---|---|
| `src/crypto/pinStrength.ts` | zxcvbn 래퍼, `assessPinStrength()`, `STRENGTH_LABELS` |
| `src/crypto/pinStrength.test.ts` | 단위 테스트 (시나리오 6+) |
| `src/components/inputs/PinStrengthMeter.tsx` | 강도 바/라벨 UI 컴포넌트 |
| `src/components/inputs/PinStrengthMeter.test.tsx` | UI 테스트 (시나리오 3+) |

### 4.2 변경 (최소)

| 파일 | 변경 |
|---|---|
| `src/components/dialogs/FileCreateDialog.tsx` | inputMode="text", maxLength=20, placeholder 수정, 강도 컴포넌트 추가 |
| `src/components/dialogs/FileOpenDialog.tsx` | 동일 |
| `src/pages/Settings/components/PinChangeDialog.tsx` | maxLength=20×2, 검증 로직 완화, 에러 메시지 수정, placeholder 수정, 강도 컴포넌트 추가 (newPin만) |
| `src/pages/Auth.tsx` | maxLength=20, placeholder 수정, 강도 컴포넌트 추가 |

### 4.3 의존성

- `@zxcvbn-ts/core` — **신규** (Q1=(a) 확정)

---

## 5. Architecture

### 5.1 데이터 흐름

```
[User types in PIN input]
   │  // 4~20자, 문자/특수문자 가능
   ▼
[setPin(value)] (기존 useState)
   │
   ├──► (기존) onSubmit → createCryptoKey(pin, salt) → ... (변경 없음)
   │
   └──► [NEW] <PinStrengthMeter pin={pin}>
                │
                ▼
            assessPinStrength(pin) ← pinStrength.ts
                │  // zxcvbn(pin).score (0~4)
                │  // 또는 pin.length < 4 → null
                ▼
            <StrengthBar score={score} />
```

**핵심:**
- 강도 평가는 **표시 전용** — `setPin`/`onSubmit`/`createCryptoKey` 어느 것도 변경하지 않음
- 입력 검증은 **길이만** (`4 ≤ length ≤ 20`), 문자 종류 제약 0
- crypto 경로 변경 0

### 5.2 PinStrengthMeter 컴포넌트

```typescript
// src/components/inputs/PinStrengthMeter.tsx (개념)
interface PinStrengthMeterProps {
  pin: string;
  className?: string;
  "data-testid"?: string;
}

// 1. pin.length < 4 → null (아무것도 안 그림)
// 2. pin.length >= 4 → <StrengthBar score={...} label={...} />
// 3. score → 라벨/색 매핑:
//    0: "매우 약함" (var(--color-error))
//    1: "약함" (var(--color-warning))
//    2: "보통" (var(--color-warning))  // --color-caution 미정의 → warning 재사용
//    3: "강함" (var(--color-accent))
//    4: "매우 강함" (var(--color-success))
```

### 5.3 강도 평가 함수 (zxcvbn 기반)

```typescript
// src/crypto/pinStrength.ts (개념) — @zxcvbn-ts/core v4 API
import { ZxcvbnFactory } from "@zxcvbn-ts/core";

// 모듈 레벨에서 1회 인스턴스화 (Plan §5.1: 입력마다 호출되지만 ms 단위)
const zxcvbn = new ZxcvbnFactory();

export type PinStrengthScore = 0 | 1 | 2 | 3 | 4;
export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 20;

export function assessPinStrength(pin: string): PinStrengthScore | null {
  if (pin.length < MIN_PIN_LENGTH) return null;
  // MAX_PIN_LENGTH 초과는 호출하지 않음: UI의 maxLength가 1차 게이트이지만,
  // 함수 자체도 명시적으로 차단 (방어적, 회귀 방지).
  if (pin.length > MAX_PIN_LENGTH) return null;
  return zxcvbn.check(pin).score as PinStrengthScore;
}

export const STRENGTH_LABELS: Record<PinStrengthScore, string> = {
  0: "매우 약함",
  1: "약함",
  2: "보통",
  3: "강함",
  4: "매우 강함",
};
```

### 5.4 Key Ownership & Boundaries

| 요소 | 소유자 | 비고 |
|---|---|---|
| `pin` (state) | 컴포넌트 useState (메모리 only) | 변경 없음, 절대 persist 안 함 |
| `cryptoKey` | `sessionStore` 메모리 only | 변경 없음 |
| `salt` | `sessionStore` partialize | 변경 없음 |
| KDF iterations 100k | `encryption.ts:51` | 변경 없음 |
| `EncryptedKiyoVaultData` 포맷 | 변경 없음 | |
| Autofill/Keystore/SecureKey | **Plan-4 무관** | 격리 확인됨 |
| zxcvbn 점수 | 컴포넌트 메모리 (계산 후 표시만) | persist 안 함 |
| PIN 길이/문자 정책 | UI 검증 + 컴포넌트 maxLength | **신규 정책: 4~20자, 문자/특수문자 자유** |

> **보안 경계:** 강도 평가는 표시 전용. zxcvbn은 클라이언트 사이드 (네트워크 0). 기존 `setCryptoKey`/`SecureKey` 경로 완전 격리.

---

## 6. Proposed Changes

### 6.1 신규: `src/crypto/pinStrength.ts`

```typescript
import { ZxcvbnFactory } from "@zxcvbn-ts/core";

// 모듈 레벨에서 1회 인스턴스화 (language pack 없이 core만 — Plan §8 트리쉐이킹 일관)
const zxcvbn = new ZxcvbnFactory();

export type PinStrengthScore = 0 | 1 | 2 | 3 | 4;
export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 20;

export function assessPinStrength(pin: string): PinStrengthScore | null {
  if (pin.length < MIN_PIN_LENGTH) return null;
  // MAX_PIN_LENGTH 초과는 호출하지 않음: UI의 maxLength가 1차 게이트이지만,
  // 함수 자체도 명시적으로 차단 (방어적, 회귀 방지).
  if (pin.length > MAX_PIN_LENGTH) return null;
  return zxcvbn.check(pin).score as PinStrengthScore;
}

export const STRENGTH_LABELS: Record<PinStrengthScore, string> = {
  0: "매우 약함",
  1: "약함",
  2: "보통",
  3: "강함",
  4: "매우 강함",
};

export const STRENGTH_COLORS: Record<PinStrengthScore, string> = {
  0: "var(--color-error)",
  1: "var(--color-warning)",
  2: "var(--color-warning)", // --color-caution 미정의 → warning 재사용
  3: "var(--color-accent)",
  4: "var(--color-success)",
};
```

### 6.2 신규: `src/components/inputs/PinStrengthMeter.tsx`

```typescript
import { assessPinStrength, STRENGTH_LABELS, STRENGTH_COLORS, MIN_PIN_LENGTH } from "@/crypto/pinStrength";

interface PinStrengthMeterProps {
  pin: string;
  className?: string;
  "data-testid"?: string;
}

// 1. pin.length < MIN_PIN_LENGTH → null 반환
// 2. score 계산
// 3. 렌더: 바 + 라벨 (색/너비 매핑)
```

### 6.3 변경: 4개 다이얼로그/페이지

**공통 input 속성 변경:**
```tsx
// 기존
<input type="password" inputMode="numeric" maxLength={6} ... />

// 신규
<input type="password" inputMode="text" maxLength={20} ... />
```

**FileCreateDialog.tsx:**
- 라인 108-109: `inputMode="numeric" maxLength={6}` → `inputMode="text" maxLength={20}`
- 라인 112: `placeholder="6자리 PIN"` → `placeholder="4~20자 PIN"`
- PIN input div 마지막에 `<PinStrengthMeter pin={pin} data-testid="pin-strength" />` 추가

**FileOpenDialog.tsx:**
- 라인 121-122: 동일 변경
- 라인 125: placeholder 변경
- PIN input div 마지막에 컴포넌트 추가

**PinChangeDialog.tsx:**
- 라인 42-48 (검증):
  ```typescript
  // 기존
  if (newPin.length < 4 || newPin.length > 6) {
    throw new Error("PIN은 4~6자리 숫자여야 합니다.");
  }
  if (!/^\d+$/.test(newPin)) {
    throw new Error("PIN은 숫자만 입력 가능합니다.");
  }

  // 신규
  if (newPin.length < 4 || newPin.length > 20) {
    throw new Error("PIN은 4~20자로 입력해 주세요.");
  }
  // 정규식 검증 제거
  ```
- 라인 120-121: placeholder 변경
- 라인 123, 142: `maxLength={6}` → `maxLength={20}`
- **newPin input div에만** 강도 컴포넌트 추가 (currentPin/confirmPin 제외)

**Auth.tsx:**
- 라인 227: `placeholder="4자리 핀번호"` → `placeholder="4~20자 PIN"`
- 라인 228: `maxLength={6}` → `maxLength={20}`
- PIN input div 다음 형제로 `<PinStrengthMeter pin={pin} data-testid="pin-strength" />`

### 6.4 신규 의존성

```json
// package.json dependencies에 추가
"@zxcvbn-ts/core": "^4.2.0"
```

> v3 → v4 API 변경: `import { zxcvbn }` 함수형 → `import { ZxcvbnFactory }` 인스턴스 + `zxcvbn.check()` 호출. v4.2.0은 language pack 없이도 core만 동작 (default dictionary 내장).

### 6.5 i18n

- **하드코딩 한국어** (Q2=(a)). `STRENGTH_LABELS` 1곳에 집중, 후속 i18n 도입 시 일괄 이관.
- 에러 메시지/placeholder는 `PinChangeDialog.tsx` 1곳, `FileCreateDialog.tsx` 1곳, `FileOpenDialog.tsx` 1곳, `Auth.tsx` 1곳 (총 4곳, 모두 한국어 하드코딩 유지).

---

## 7. Tests

### 7.1 Unit Tests (Vitest) — 신규

| 파일 | 시나리오 |
|---|---|
| `src/crypto/pinStrength.test.ts` | ① 빈 문자열 → null ② 3자리 → null ③ `"1234"` → score=0 (단조 시퀀스) ④ `"0000"` → score=0 ⑤ `"9271"` → score=1 (랜덤 4자리, v4 결과) ⑥ `"abcd"` → score=0 (단조 시퀀스, v4 결과) ⑦ `"Abc123!@#"` → score=3 (혼합, v4 결과) ⑧ 21자 (`"x".repeat(21)`) → null (MAX_PIN_LENGTH 초과 명시 차단) ⑨ `STRENGTH_LABELS` 매핑 |
| `src/components/inputs/PinStrengthMeter.test.tsx` | ① `pin="12"` → null 렌더링 ② `pin="1234"` → 라벨 표시 ③ score별 색상/너비 변경 ④ onChange 재호출 시 라벨 업데이트 |

### 7.2 회귀 테스트 (변경 없음, 회귀 검증만)

- `src/crypto/encryption.test.ts` — `createCryptoKey` 동작 그대로 (회귀 0)
- `src/database/fileStorage.changePin.integration.test.ts` — 기존 7+ 시나리오 (회귀 0)
- `src/database/fileStorage.encryption.integration.test.ts` — 기존 5+ 시나리오 (회귀 0)

### 7.3 신규 통합 테스트 (Vitest)

| 파일 | 시나리오 |
|---|---|
| `src/crypto/encryption.test.ts` (확장) | ① 20자 PIN (`Abc123!@#xyz789QWERTY`) → `createCryptoKey` 정상 ② 같은 PIN+salt → 같은 CryptoKey (재호출) ③ 영문+특수문자 PIN → unlock 성공 |
| `src/database/fileStorage.changePin.integration.test.ts` (확장) | ① 숫자 PIN(4자리) → 영문+특수문자 PIN(12자) changePin → 새 PIN으로 unlock ② 영문+특수문자 PIN(12자) → 숫자 PIN(6자리) changePin → 새 PIN으로 unlock |

### 7.4 수동 검증 (체크리스트)

- [ ] `FileCreateDialog`: 6자리 숫자 PIN ("123456") 입력 → 강도 표시, 정상 생성
- [ ] `FileCreateDialog`: 12자 영문+숫자 ("MyVault2024!") 입력 → 강도 "보통" 이상, 정상 생성
- [ ] `FileCreateDialog`: 20자 다양한 문자 ("Abc!@#123XYZxyz987$%") 입력 → 강도 "강함" 이상
- [ ] `FileCreateDialog`: 특수문자만 ("!@#$%") 4자 → "약함" 표시, 정상 생성 (강제 0)
- [ ] `FileCreateDialog`: 3자 PIN ("123") → submit 시 "4~20자" 에러, 강도 표시 안 됨
- [ ] `FileCreateDialog`: 21자 PIN 입력 시도 → maxLength로 차단됨
- [ ] `FileOpenDialog`: 다양한 PIN으로 unlock 동작
- [ ] `PinChangeDialog`: newPin에 영문+특수문자 입력 → 강도 표시, currentPin/confirmPin은 표시 없음
- [ ] `PinChangeDialog`: 검증 에러 메시지 "PIN은 4~20자로 입력해 주세요." 확인
- [ ] `Auth.tsx`: 잠금 해제 시 다양한 PIN으로 unlock 동작
- [ ] **버튼 강제 비활성화 없음** — "매우 약함"이어도 submit 가능
- [ ] 기존 PIN vault (Plan-4 이전 생성, 4~6자리 숫자 PIN 잠금) → Plan-4 적용 후 같은 PIN으로 unlock 동작 (회귀 검증)
- [ ] Autofill/Keystore/SecureKey 경로 회귀 없음 (변경 0이지만 한 번 더 확인)

### 7.5 Android E2E (사용자 직접 실행)

- **Plan-4 범위 밖** (사용자 E2E 실행 규약 유지). UI 입력 속성 + 검증 메시지 변경이므로 E2E 회귀 위험 낮음. 필요 시 사용자가 `PassphraseUnlockTest.kt` 추가.

---

## 8. Risks

| 위험 | 완화 |
|---|---|
| **버튼 강제 비활성화처럼 오해** | 라벨/색이 버튼을 막지 않음. 강도 표시는 정보 제공 목적 (체크리스트 명시) |
| **번들 크기** — `@zxcvbn-ts/core` ~30KB | core만 import, 트리쉐이킹 확인. 향후 패스프레이즈 확장 시 재사용 |
| **PIN 입력마다 zxcvbn 호출** | 4~20자라 ms 단위 이하. debounce 불필요 |
| **zxcvbn의 4자리 숫자 정확도** | zxcvbn은 순열/반복/연속 패턴 모두 평가. 정확도 충분. 4자리 숫자 사이 구분 가능 ("1234" vs "9271") |
| **zxcvbn의 한국어/특수문자 분간력** | `@zxcvbn-ts/core`는 영어 위주 코퍼스. `"한글PIN123!"` 같은 입력은 영어 자판 패턴만 부분 평가되어 score가 다소 부풀려질 수 있음. **정보 제공 목적이므로 허용**, 사용자 오해 방지를 위해 "매우 강함" 단독으로 unlock을 권장하지 않도록 별도 안내 없음 (강도 표시가 강제 차단 안 함과 일관) |
| **기존 사용자 인식 차이** — "PIN인데 왜 영문?" | 다이얼로그 라벨/placeholder 변경 ("PIN" → 그대로, 메시지에만 "4~20자" 명시). 첫 화면 release note로 안내 |
| **i18n 부채** — 하드코딩 한국어 | `STRENGTH_LABELS` 1곳 + 에러 메시지 4곳. 후속 일괄 이관 |
| **Autofill/Keystore 회귀** | crypto 경로 변경 0. 사실상 0. 단 한 번 회귀 테스트 |
| **기존 PIN vault 호환성** | format 변경 0, 기존 PIN(4~6자리 숫자) 그대로 unlock. 100% 호환 |

---

## 9. Rollback

| 단계 | 롤백 방법 |
|---|---|
| 1. 4개 파일의 input 속성/검증/placeholder 원복 | `git revert` 또는 수동 patch (라인 표 §3.1/3.2 참조) |
| 2. 4개 파일의 `<PinStrengthMeter>` 라인 제거 | 단순 삭제 |
| 3. 신규 컴포넌트 파일 삭제 | `pinStrength.ts`, `PinStrengthMeter.tsx` (사용처 0) |
| 4. zxcvbn 의존성 제거 | `npm uninstall @zxcvbn-ts/core` |

> **데이터 마이그레이션 불필요**, **crypto 변경 0**, **format 변경 0**. 가장 안전한 롤백.

---

## 10. Open Questions (Plan-4 진행 중 결정 필요)

| # | 질문 | 선택지 | **권장안** |
|---|---|---|---|
| **Q1** | 강도 평가 엔진 | (a) zxcvbn (`@zxcvbn-ts/core`) / (b) 자체 휴리스틱 | ✅ **(a) 확정** |
| **Q2** | i18n | (a) 하드코딩 한국어 / (b) i18n 시스템 도입 | ✅ **(a) 확정** — 기존 KIYO 전체 텍스트가 하드코딩 상태이므로 일관성 유지. `STRENGTH_LABELS` 1곳 + 에러/placeholder 4곳 집중, 후속 i18n 트랙에서 일괄 이관 |
| **Q3** | 표시 위치 (UI) | (a) input 바로 아래 한 줄 / (b) input 옆 인라인 바 | ✅ **(a) 확정** — 모바일 키보드와 충돌 없음 |
| **Q4** | 강도 라벨 문구 | (a) "매우 약함/약함/보통/강함/매우 강함" / (b) 영어/숫자만 | ✅ **(a) 확정** — Plan-4 권장 |

> Q1~Q4 모두 사용자 확정. 구현 진행 가능.

---

## 11. Implementation Order

| 순서 | 작업 | 산출물 |
|---|---|---|
| 1 | **zxcvbn 의존성 추가** | `package.json` + `npm install` |
| 2 | **pinStrength.ts** + test | `src/crypto/pinStrength.ts` + `pinStrength.test.ts` |
| 3 | **PinStrengthMeter.tsx** + test | `src/components/inputs/PinStrengthMeter.tsx` + `PinStrengthMeter.test.tsx` |
| 4 | **Auth.tsx 적용** | maxLength 20, placeholder, 강도 컴포넌트 |
| 5 | **FileCreateDialog 적용** | inputMode, maxLength, placeholder, 강도 컴포넌트 |
| 6 | **FileOpenDialog 적용** | 동일 |
| 7 | **PinChangeDialog 적용** | 검증 로직 완화, maxLength×2, placeholder, 강도 컴포넌트 (newPin만) |
| 8 | **encryption.test.ts 확장** | 20자 영문+특수문자 round-trip |
| 9 | **changePin.integration.test.ts 확장** | 양방향 changePin (숫자↔영문+특수문자) |
| 10 | **수동 검증 체크리스트** | 12개 항목 |
| 11 | (사용자) **Android E2E** | 선택, 사용자 직접 실행 |

---

## 12. Verification Criteria (Plan Complete When)

- [x] `npm run test` 통과 (21 files / **326 tests passed**)
  - 신규: pinStrength 11건, PinStrengthMeter 8건, crypto.utils 가드 3건, FormDialog 에러 표시 7건, FileDialogs PIN 가드 2건 = **31건**
  - 기존 회귀: encryption26 + changePin 7 + encryption integration 5 + FormDialog 단독 4 등 = **295건** 모두 통과
- [x] `npm run typecheck` 통과
- [x] `npm run lint` 통과 — **Plan-4 기여 0 errors** (기존 10 errors는 Plan-4 무관, 사전 존재)
- [x] Android `compileDebugKotlin` 통과 — BUILD SUCCESSFUL (Kotlin 변경 0, 회귀 확인)
- [x] Android `testDebugUnitTest` 통과 — BUILD SUCCESSFUL
- [x] React E2E (Playwright) — **39/39 passed (28.7s)** — `e2e/02-unlock.spec.ts:94` 메시지 정합 (`"핀번호를 입력하세요"` → `"PIN은 4자 이상 입력해주세요."`)
- [ ] 수동 검증 체크리스트 12개 항목 — **사용자 직접 검증 필요** (강도 표시 UX, 다양한 PIN 입력)
- [ ] 기존 PIN vault (Plan-4 이전 생성, 4~6자리 숫자 PIN 잠금) → Plan-4 적용 후 같은 PIN으로 unlock 동작 — **사용자 수동 검증 필요**
- [ ] Android E2E — Plan §7.5 명시: 사용자 직접 실행 (Plan-4 범위 밖)

> **자동화 검증은 모두 통과**. 사용자 직접 확인 항목 (수동 체크리스트 + 기존 vault + Android E2E)만 남음.

---

## 13. Implementation Order (실제 진행 순서)

| 순서 | 작업 | 산출물 | 비고 |
|---|---|---|---|
| 1 | **zxcvbn 의존성 추가** | `package.json` + `npm install` | ⚠️ **v3.0.4 → v4.2.0** (latest, API 변경) |
| 2 | **pinStrength.ts** + test | `src/crypto/pinStrength.ts` + `pinStrength.test.ts` (11건) | ⚠️ v4 API 사용 (`ZxcvbnFactory`) |
| 3 | **PinStrengthMeter.tsx** + test | `src/components/inputs/PinStrengthMeter.tsx` + `PinStrengthMeter.test.tsx` (8건) | ⚠️ 빈/1~3자 = "매우 약함" + 바 0/10% + "PIN을 4자 이상 입력하세요" 안내 (사용자 피드백 후) |
| 4 | **Auth.tsx 적용** | maxLength 20, placeholder, 강도 컴포넌트 | ⚠️ submit 핸들러에 길이 가드 + 메시지 정정 |
| 5 | **FileCreateDialog 적용** | inputMode, maxLength, placeholder, 강도 컴포넌트 | ⚠️ confirmDisabled에 길이 가드 + submit 가드 메시지 정정 |
| 6 | **FileOpenDialog 적용** | 동일 패턴 | ⚠️ 동일 가드 추가 |
| 7 | **PinChangeDialog 적용** | 검증 로직 완화, maxLength×2, placeholder, 강도 컴포넌트 (newPin만) | ⚠️ 검증 에러 메시지 "4~20자로 입력해 주세요"로 정정 |
| 8 | **encryption.test.ts 확장** | 20자 영문+특수문자 round-trip (3건) | |
| 9 | **changePin.integration.test.ts 확장** | 양방향 changePin (숫자↔영문+특수문자) (2건) | |
| 10 | **crypto.utils 가드 추가** | `isCryptoAvailable()`, `assertCryptoAvailable()`, `CryptoUnavailableError` | 🔧 **사용자 피드백**: LAN IP/HTTP 환경에서 crypto.subtle undefined → 명시적 에러 |
| 11 | **encryption.ts / recordEncryption.ts 가드** | `createCryptoKey`, `encryptData`, `decryptData`, `encryptRecord`, `decryptRecord`, `importKey`, `exportKey` 진입부에 `assertCryptoAvailable()` | 🔧 사용자 피드백 |
| 12 | **FormDialog 에러 표시 통합** | 내부 에러 state + `toErrorMessage()` 변환 + cancel 시 클림 | 🔧 사용자 피드백: 기존에 `console.error`만 하고 UI 표시 안 함 |
| 13 | **수동 검증 체크리스트** | 12개 항목 (자동화 불가) | 사용자 직접 |
| 14 | (사용자) **Android E2E** | 선택 | 사용자 직접 |

> ⚠️ = 사용자 피드백으로 작업 중 변경, 🔧 = 작업 중 추가된 항목 (Plan 원안 외)

---

## 14. Implementation Diff vs Plan (작업 중 변경 사항)

Plan 검토/구현 중 발견·반영된 사항들. **다음 ce-plan 작성 시 참고할 lessons learned**.

### 14.1 라이브러리/API 변경

| Plan 원안 | 실제 적용 | 이유 |
|---|---|---|
| `@zxcvbn-ts/core` `^3.0.4` + `import { zxcvbn }` | `^4.2.0` + `import { ZxcvbnFactory }` + `new ZxcvbnFactory()` | v3 → v4 API 변경: v4는 latest (2026-08), v3 함수형 API는 v4에서 제거됨. language pack 없이 core만으로 동작 |
| 시나리오 ⑤⑥⑦ score 범위 "1~2", "1~2", "3~4" | "1", "0", "3" | v4 실제 결과로 정정 (v4가 "abcd"를 단조 시퀀스로 분류해 score=0) |
| `Math.min(zxcvbn(pin).score, 4)` | `zxcvbn.check(pin).score` (이미 0~4이므로 Math.min 불필요) | v4 `Score` 타입 = `0 \| 1 \| 2 \| 3 \| 4` |

### 14.2 색상 토큰 prefix

| Plan 원안 | 실제 적용 | 이유 |
|---|---|---|
| `var(--error)` | `var(--color-error)` | `src/index.css` 컨벤션에 `--color-` prefix 필수 |
| `var(--warning)` | `var(--color-warning)` | 동일 |
| `var(--caution)` | `var(--color-warning)` | ⚠️ `--color-caution` **정의 없음** — `index.css`에 error/warning/success만 존재, score=2 ("보통")에 warning 재사용 |
| `var(--accent)` | `var(--color-accent)` | 동일 |
| `var(--success)` | `var(--color-success)` | 동일 |

### 14.3 강도 표시 UX (사용자 피드백 3회 반영)

Plan §5.1은 "표시 전용, MIN_PIN_LENGTH 미만은 null 반환"이었음. 사용자 피드백으로 3번 변경:

| 버전 | 빈 입력 | 1~3자 | 4자+ |
|---|---|---|---|
| **Plan 원안** | null (안내도 안 함) | null | 강도 바 + 라벨 |
| **v1 (사용자 1차 피드백)** | null | "N자 더 입력하세요 (최소 4자)" 안내 | 강도 바 + 라벨 |
| **v2 (사용자 2차 피드백)** | "매우 약함" + 바 20% | "매우 약함" + 바 20% | 강도 바 + 라벨 |
| **v3 (사용자 3차 피드백)** | "매우 약함" + 바 **0%** | "매우 약함" + 바 **10%** + "PIN을 4자 이상 입력하세요" | 강도 바 + 라벨 |

**최종 동작 (v3)**:
- `pin.length === 0` → "매우 약함" + 바 **0%** + "PIN을 4자 이상 입력하세요"
- `0 < pin.length < 4` → "매우 약함" + 바 **10%** + "PIN을 4자 이상 입력하세요"
- `4 ≤ pin.length ≤ 20` → 점수별 (20%/40%/60%/80%/100%) + 라벨만

**Lessons learned**: Plan 단계에서 "정확한 UI 동작"을 다 결정하기 어려움. ce-plan에 "Plan-4a (정책 완화) + Plan-4b (강도 표시) 분리"를 권장했으나 사용자가 "그대로 진행" 선택 → 작업 중 UX 변경 3회 발생. 다음번 Plan은 더 작은 단위로 분리 권장.

### 14.4 폼 에러 표시 (Plan-4 원안 외 추가)

| Plan 원안 | 실제 적용 | 이유 |
|---|---|---|
| FormDialog: catch → `console.error`만, 부모가 `errorMessage` prop으로 관리 | FormDialog: 내부 에러 state + `toErrorMessage()` 자동 변환 + cancel 시 클림 | 사용자 발견 결함: 부모 다이얼로그들이 `errorMessage` prop을 안 쓰고 있어 에러가 사용자에게 안 보였음. FormDialog 자체에서 catch + 표시하도록 변경 |
| 에러 메시지 원본 그대로 표시 | `CryptoUnavailableError` + `crypto.subtle` undefined 패턴 감지 → "이 환경에서는 암호화 기능을 사용할 수 없습니다. HTTPS 또는 localhost로 접속해주세요." | LAN IP/HTTP 접근 시 사용자에게 친절한 안내 |
| crypto.ts: `crypto.subtle` 직접 호출 | `assertCryptoAvailable()` 가드 우선 호출 (모든 crypto 진입점 6곳) | secure context 부재 시 정확한 에러 위치·메시지 |

### 14.5 버튼 disabled 정책 변경

| Plan 원안 | 실제 적용 | 이유 |
|---|---|---|
| "버튼 강제 비활성화 없음" (Plan §1 참3, §12) | **암호화 ON + PIN < 4자일 때 submit 버튼 disabled** | 사용자 4차 피드백: "3자면 버튼이 사용불가능이어야해" — 강도 표시가 정보 제공 목적이지만 **submit 가능 자체는 차단의 1차 게이트**여야 함 |
| Auth.tsx: `!pin.trim()` 체크 + "핀번호를 입력하세요" | `pin.length < MIN_PIN_LENGTH` 체크 + "PIN은 4자 이상 입력해주세요." | 동일. Auth는 자체 버튼이라 disabled 안 함, 에러 메시지만 정정 |

**Lessons learned**: Plan §1의 "강제 비활성화 없음"은 **너무 강한 표현**. "강도 점수가 낮아도 = OK, 길이가 정책 미만이면 = NO"로 구분 필요. 다음 Plan은 정책 한 줄에 양/단 케이스 모두 명시.

### 14.6 작업 중 추가 파일 (Plan 원안 외)

| 파일 | 이유 |
|---|---|
| `src/components/dialogs/FormDialog.test.tsx` | 사용자 발견 결함 수정 회귀 검증 (7건) |
| `src/crypto/crypto.utils.ts` 확장 | secure context 가드 추가 |

### 14.7 다음 Plan 작성 시 권장

1. **ce-plan 단계에서 외부 라이브러리 코드는 `npm view`로 latest + readme 확인**: v3 → v4 API 변경처럼 Plan 작성 시점에 검증 가능
2. **`src/index.css` grep으로 색상 토큰 목록 확인**: `--color-` prefix + 정의된 토큰만 사용
3. **UI 동작은 작은 단위로 분리**: PIN 정책 완화(Plan-4a) / 강도 표시(Plan-4b) / 버튼 disabled(Plan-4c) / 에러 표시(Plan-4d) — 각각 별도 Plan으로 검토/사용자 피드백 가능
4. **FormDialog처럼 catch 후 `console.error`만 하는 코드 발견 시**: Plan 단계에서 "UI 표시 책임" 명시

---

## 15. References

- Brainstorm: `docs/brainstorms/2026-08-29-vault-file-integrity.md` — §7 옵션 C, §8 권장 분할, §9 Q2=(c) Plan-4는 가장 마지막
- STRATEGY.md §2 (볼트 파일 안정성)
- 기존 crypto: `src/crypto/encryption.ts` (Plan 원안: 변경 없음 — **실제로는 crypto 진입부에 secure context 가드만 추가**, PIN/문자유형 무관)
- 기존 Plan 패턴: `docs/plans/2026-08-30-saf-persistent-uri-auto-backup.md` (Status, Verification, Implementation Order 형식)
- zxcvbn: `@zxcvbn-ts/core@^4.2.0` (language pack 없이 core만)
- 작업 중 추가:
  - `src/crypto/crypto.utils.ts`: `assertCryptoAvailable()`, `CryptoUnavailableError`
  - `src/components/dialogs/FormDialog.tsx`: 내부 에러 state + 메시지 변환
- 후속 (Plan-4 범위 밖): 텍스트 패스프라이즈 입력 옵션, Plan-7 다단계 페이지화, i18n 일괄 이관
