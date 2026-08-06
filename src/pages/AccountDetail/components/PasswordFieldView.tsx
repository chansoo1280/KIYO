import { useState } from "react";
import { useClipboard } from "@/hooks/useClipboard";
import { EYE_OPEN_SVG, EYE_CLOSED_SVG } from "@/components/icons";

interface PasswordFieldViewProps {
  value: string;
}

export const PasswordFieldView = ({ value }: PasswordFieldViewProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const { copy } = useClipboard();

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-semibold text-[var(--color-text-h)] flex-1">
        {isVisible ? value : "••••••••"}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
          aria-label={isVisible ? "비밀번호 숨기기" : "비밀번호 보이기"}
        >
          {isVisible ? EYE_CLOSED_SVG : EYE_OPEN_SVG}
        </button>
        <button
          type="button"
          onClick={() => copy(value)}
          className="rounded-full bg-[var(--color-accent-bg)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)]"
        >
          복사
        </button>
      </div>
    </div>
  );
};

export default PasswordFieldView;