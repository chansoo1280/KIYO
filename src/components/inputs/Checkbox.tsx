import type { InputHTMLAttributes, ReactNode } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /**
   * required — Checkbox는 `<label>글자<input type="checkbox"/></label>` wrapping 구조라
   * Input의 `as` prop 패턴에 안 맞음. 별도 컴포넌트로 분리 (Q6 결정 `b`).
   */
  label: ReactNode;
  checked: boolean;
  errorId?: string;
}

export const Checkbox = ({ label, errorId, className = "", ...props }: CheckboxProps) => {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        className={`h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 ${className}`}
        // Note: Checkbox는 h-4 w-4 작은 사이즈로 `rounded` (4px) 유지 — Input의 `rounded-lg` (8px)와 의도적 분리 (시각적으로 차이 거의 없음)
        aria-describedby={errorId}
        {...props}
      />
      <span className="text-sm text-[var(--color-text)]">{label}</span>
    </label>
  );
};