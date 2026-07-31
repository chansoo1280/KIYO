import { useState } from "react";

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  onCopy: (value: string) => void;
  onGenerate?: () => void;
  mode?: "edit" | "view";
}

const EYE_OPEN_SVG = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EYE_CLOSED_SVG = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const GENERATE_SVG = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

export const PasswordField = ({
  value,
  onChange,
  onCopy,
  onGenerate,
  mode = "edit",
}: PasswordFieldProps) => {
  const [isVisible, setIsVisible] = useState(false);

  if (mode === "view") {
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
            onClick={() => onCopy(value)}
            className="rounded-full bg-[var(--color-accent-bg)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)]"
          >
            복사
          </button>
        </div>
      </div>
    );
  }

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

export default PasswordField;