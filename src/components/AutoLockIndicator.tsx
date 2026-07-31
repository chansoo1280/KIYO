import { useAutoLock } from "@/hooks/useAutoLock";

export function AutoLockIndicator() {
  const { remainingSeconds } = useAutoLock();

  if (remainingSeconds <= 0) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeString = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const isWarning = remainingSeconds <= 10;

  return (
    <div
      className={`fixed bottom-20 right-4 z-40 rounded-full border px-3 py-1 text-xs transition-colors ${
        isWarning
          ? "bg-[var(--color-code-bg)] border-[var(--color-accent)] text-[var(--color-accent)]"
          : "bg-[var(--color-code-bg)] border-[var(--color-border)] text-[var(--color-text)]"
      }`}
      role="status"
      aria-live="polite"
      aria-label={`자동잠금까지 ${timeString} 남음`}
    >
      자동잠금: {timeString}
    </div>
  );
}