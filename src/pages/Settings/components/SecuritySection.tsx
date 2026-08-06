import type { AutoLockTimeout } from "@/store/settingsStore";

interface SecuritySectionProps {
  isEncrypted: boolean;
  autoLockTimeout: AutoLockTimeout;
  onPinChangeClick: () => void;
  onAutoLockChange: (value: string) => void;
  securityMessage?: string;
}

export function SecuritySection({
  isEncrypted,
  autoLockTimeout,
  onPinChangeClick,
  onAutoLockChange,
  securityMessage,
}: SecuritySectionProps) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">
        Security
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <span>PIN</span>
          <button
            type="button"
            onClick={onPinChangeClick}
            className="rounded-full bg-[var(--color-accent-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)]"
          >
            {isEncrypted ? "변경" : "설정"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <span>자동잠금</span>
          <select
            value={autoLockTimeout}
            onChange={(e) => onAutoLockChange(e.target.value)}
            onPointerDown={(e) => {
              if (!isEncrypted) {
                e.preventDefault();
              }
            }}
            disabled={!isEncrypted}
            className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent ${
              !isEncrypted
                ? "opacity-50 cursor-not-allowed text-[var(--color-text-muted)]"
                : "text-[var(--color-text)]"
            }`}
            aria-label="자동잠금 시간 선택"
          >
            <option value="none">미사용</option>
            <option value="1m">1분</option>
            <option value="10m">10분</option>
            <option value="30m">30분</option>
          </select>
        </div>
      </div>
      {securityMessage && (
        <p className="text-sm font-medium text-[var(--color-accent)]">
          {securityMessage}
        </p>
      )}
    </div>
  );
}