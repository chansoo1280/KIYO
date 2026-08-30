import { ZxcvbnFactory } from "@zxcvbn-ts/core";

/**
 * Plan-4: PIN 정책 완화 (4~20자, 문자/특수문자 허용) + 강도 표시
 * - zxcvbn 기반 강도 평가 (표시 전용, 인증 게이트 아님)
 * - v4 API: ZxcvbnFactory 인스턴스화 후 .check() 호출
 * - 모듈 레벨에서 1회 인스턴스화 (4~20자라 ms 단위, debounce 불필요)
 */
const zxcvbn = new ZxcvbnFactory();

export type PinStrengthScore = 0 | 1 | 2 | 3 | 4;
export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 20;

/**
 * PIN 강도를 평가하여 0~4 점수로 반환.
 *
 * @param pin 평가할 PIN 문자열
 * @returns 점수 (0=매우 약함 ~ 4=매우 강함), 길이가 정책 범위 밖이면 null
 *
 * 표시 전용 함수 — 어떤 인증/검증 동작도 트리거하지 않음.
 */
export function assessPinStrength(pin: string): PinStrengthScore | null {
  // 어떤 길이든 평가: 빈 입력/짧은 입력도 score=0 ("매우 약함") 반환
  // UI가 강도 바 + 라벨을 항상 표시하므로 null 반환은 MAX 초과 케이스만
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