interface StepperProps {
  step: 1 | 2;
}

const STEPS: Array<{ key: 1 | 2; label: string }> = [
  { key: 1, label: "이름" },
  { key: 2, label: "PIN" },
];

export const Stepper = ({ step }: StepperProps) => {
  return (
    <ol
      aria-label="파일 생성 단계"
      className="flex items-center gap-3 px-2 py-4"
      data-testid="create-vault-stepper"
    >
      {STEPS.map((s, idx) => {
        const isCurrent = step === s.key;
        const isLast = idx === STEPS.length - 1;
        const isDone = step > s.key;
        return (
          <li key={s.key} className={`flex-1 flex items-center gap-3 px-2
            ${isLast ? "flex-none" : ""}
          `}>
            <span
              aria-current={isCurrent ? "step" : undefined}
              data-state={isDone ? "done" : isCurrent ? "current" : "pending"}
              className="flex items-center gap-2"
            >
              <span
                aria-hidden="true"
                className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                  isDone || isCurrent
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-code-bg)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                }`}
              >
                {isDone ? "✓" : s.key}
              </span>
              <span
                className={`text-sm ${
                  isCurrent
                    ? "font-semibold text-[var(--color-text-h)]"
                    : isDone
                      ? "text-[var(--color-text)]"
                      : "text-[var(--color-text-muted)]"
                }`}
              >
                {s.label}
              </span>
            </span>
            {!isLast && (
              <span
                aria-hidden="true"
                className={`flex-1 border-t border-dashed ${
                  isDone
                    ? "border-[var(--color-accent)]"
                    : "border-[var(--color-border)]"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
};
