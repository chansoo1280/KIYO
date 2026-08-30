import PinStrengthMeter from "@/components/inputs/PinStrengthMeter";
import { MIN_PIN_LENGTH } from "@/crypto/pinStrength";

interface PinStepProps {
  fileName: string;
  pin: string;
  onPinChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  onSkip: () => void;
  isSubmitting: boolean;
  error: string | null;
}

export const PinStep = ({
  fileName,
  pin,
  onPinChange,
  onBack,
  onSubmit,
  onSkip,
  isSubmitting,
  error,
}: PinStepProps) => {
  const isPinValid = pin.length >= MIN_PIN_LENGTH;

  return (
    <section className="rounded-4xl border border-[var(--color-border)] bg-[var(--color-bg)] p-7 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
        Step 2
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text-h)]">
        PIN 설정
      </h2>

      <p
        className="mt-3 text-sm leading-6 text-[var(--color-text)]"
        data-testid="create-vault-target-name"
      >
        파일:{" "}
        <span className="font-medium text-[var(--color-text-h)]">
          {fileName}.json
        </span>
      </p>

      <div className="mt-6">
        <label
          htmlFor="pin"
          className="block text-sm font-medium text-[var(--color-text)]"
        >
          PIN 번호
        </label>
        <input
          id="pin"
          type="password"
          value={pin}
          onChange={(e) => onPinChange(e.target.value)}
          maxLength={20}
          placeholder="4~20자 PIN"
          data-testid="create-vault-pin-input"
          autoFocus
          className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-4 py-3 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
        />
        <PinStrengthMeter pin={pin} className="mt-2" />
      </div>

      {error && (
        <p
          role="alert"
          data-testid="create-vault-pin-error"
          className="mt-4 text-sm text-[var(--color-error)]"
        >
          {error}
        </p>
      )}

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={onSkip}
          disabled={isSubmitting}
          data-testid="create-vault-skip-pin"
          className="text-sm text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text)] disabled:opacity-50"
        >
          비밀번호 없이 만들기
        </button>
      </div>

      <div className="mt-4 flex justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          data-testid="create-vault-back"
          className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-3 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-code-bg)] disabled:opacity-50"
        >
          이전
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!isPinValid || isSubmitting}
          data-testid="create-vault-submit"
          className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-accent)]/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "생성 중..." : "생성"}
        </button>
      </div>
    </section>
  );
};
