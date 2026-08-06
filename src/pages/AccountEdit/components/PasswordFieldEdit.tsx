import { useState } from "react";
import { EYE_OPEN_SVG, EYE_CLOSED_SVG, GENERATE_SVG } from "@/components/icons";

interface PasswordFieldEditProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate?: () => void;
}

export const PasswordFieldEdit = ({ value, onChange, onGenerate }: PasswordFieldEditProps) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="mt-2 relative">
      <input
        type={isVisible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 pr-12 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
          aria-label={isVisible ? "비밀번호 숨기기" : "비밀번호 보이기"}
        >
          {isVisible ? EYE_CLOSED_SVG : EYE_OPEN_SVG}
        </button>
        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
            aria-label="비밀번호 생성"
          >
            {GENERATE_SVG}
          </button>
        )}
      </div>
    </div>
  );
};

export default PasswordFieldEdit;