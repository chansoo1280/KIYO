import {
  assessPinStrength,
  STRENGTH_LABELS,
  STRENGTH_COLORS,
  MIN_PIN_LENGTH,
  type PinStrengthScore,
} from "@/crypto/pinStrength";

interface PinStrengthMeterProps {
  pin: string;
  className?: string;
  "data-testid"?: string;
}

/**
 * Plan-4: PIN 입력란 아래 표시되는 강도 표시 컴포넌트.
 *
 * 동작 정책:
 * - 어떤 입력 길이든 강도 바 + "매우 약함" 라벨 항상 표시 (빈 입력 포함, score=0)
 * - 0 ≤ pin.length < MIN_PIN_LENGTH → "PIN을 4자 이상 입력하세요" 안내를 강도 라벨 아래 추가
 * - pin.length > MAX_PIN_LENGTH → null (UI maxLength가 1차 차단, 함수 자체도 2차 차단)
 * - **표시 전용**: 어떤 인증/검증 동작도 트리거하지 않음
 * - **버튼 강제 비활성화 없음** — "매우 약함"이어도 PIN 설정/unlock 가능
 */
const PinStrengthMeter = ({
  pin,
  className = "",
  "data-testid": testId = "pin-strength",
}: PinStrengthMeterProps) => {
  // 어떤 입력이든 항상 점수 평가 (빈 입력도 score=0 = "매우 약함")
  const score = assessPinStrength(pin);

  // MAX_PIN_LENGTH 초과 = 표시 안 함 (UI maxLength가 1차 차단, 여기서 2차 차단)
  if (score === null) return null;

  // 바 너비:
  // - 빈 입력(""): 0% (아직 입력 안 함)
  // - 1~3자: 10% (입력은 시작했지만 부족)
  // - 4~20자: 20%, 40%, 60%, 80%, 100% (점수별)
  const widthPercent =
    pin.length === 0
      ? 0
      : pin.length < MIN_PIN_LENGTH
        ? 10
        : ((score + 1) / 5) * 100;
  const label = STRENGTH_LABELS[score];
  const color = STRENGTH_COLORS[score as PinStrengthScore];
  const showMinHint = pin.length < MIN_PIN_LENGTH;

  return (
    <div
      data-testid={testId}
      className={`mt-1 ${className}`}
      aria-label={`PIN 강도: ${label}`}
    >
      <div className="h-1 w-full overflow-hidden rounded-md bg-[var(--color-code-bg)]">
        <div
          className="h-full rounded-md transition-[width] duration-200"
          data-testid={`${testId}-bar`}
          data-score={score}
          style={{
            width: `${widthPercent}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <p
        className="mt-1 text-xs"
        data-testid={`${testId}-label`}
        style={{ color }}
      >
        {label}
      </p>
      {showMinHint && (
        <p
          className="mt-0.5 text-xs text-[var(--color-text)]"
          data-testid={`${testId}-hint`}
          data-pin-hint="min-length"
        >
          PIN을 {MIN_PIN_LENGTH}자 이상 입력하세요
        </p>
      )}
    </div>
  );
};

export default PinStrengthMeter;