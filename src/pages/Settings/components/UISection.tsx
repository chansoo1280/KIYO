import { useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { Input } from "@/components/inputs";

type FontSize = "small" | "medium" | "large";

export function UISection() {
  const [uiMessage, setUiMessage] = useState("");
  const { theme, toggleTheme, fontSize, setFontSize } = useSettingsStore();

  const handleThemeToggle = () => {
    toggleTheme();
    setUiMessage(
      theme === "dark"
        ? "다크모드가 해제되었습니다."
        : "다크모드가 적용되었습니다.",
    );
  };

  const handleFontSizeChange = (size: FontSize) => {
    setFontSize(size);
    setUiMessage(`글자크기: ${size === "small" ? "작게" : size === "medium" ? "보통" : "크게"}로 변경되었습니다.`);
  };

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
            onClick={handleThemeToggle}
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
          <Input
            as="select"
            size="sm"
            value={fontSize}
            onChange={(e) => handleFontSizeChange(e.target.value as FontSize)}
            aria-label="글자 크기 선택"
          >
            <option value="small">작게</option>
            <option value="medium">보통</option>
            <option value="large">크게</option>
          </Input>
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