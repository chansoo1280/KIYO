type FontSize = "small" | "medium" | "large";
type Theme = "light" | "dark";

interface UISectionProps {
  theme: Theme;
  fontSize: FontSize;
  onThemeToggle: () => void;
  onFontSizeChange: (size: FontSize) => void;
  uiMessage?: string;
}

export function UISection({
  theme,
  fontSize,
  onThemeToggle,
  onFontSizeChange,
  uiMessage,
}: UISectionProps) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">
        UI
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <span>다크모드</span>
          <button
            type="button"
            role="switch"
            aria-checked={theme === "dark"}
            onClick={onThemeToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 ${
              theme === "dark"
                ? "bg-[var(--color-accent)]"
                : "bg-[var(--color-border)]"
            }`}
            aria-label={theme === "dark" ? "다크모드 켜짐" : "다크모드 꺼짐"}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-bg)] transition-transform ${
                theme === "dark" ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <span>글자크기</span>
          <select
            value={fontSize}
            onChange={(e) => onFontSizeChange(e.target.value as FontSize)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
            aria-label="글자 크기 선택"
          >
            <option value="small">작게</option>
            <option value="medium">보통</option>
            <option value="large">크게</option>
          </select>
        </div>
      </div>
      {uiMessage && (
        <p className="text-sm font-medium text-[var(--color-accent)]">
          {uiMessage}
        </p>
      )}
    </div>
  );
}