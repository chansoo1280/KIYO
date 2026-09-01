import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { forwardRef, createElement } from "react";

export type InputSize = "sm" | "md" | "lg";
export type InputVariant = "default" | "readonly" | "error" | "disabled";

interface BaseProps {
  as?: "input" | "select" | "textarea";
  size?: InputSize;
  variant?: InputVariant;
  label?: string;
  /**
   * 호출처가 별도 <p id={errorId}> error 메시지를 렌더링할 때 사용.
   * Input은 자동으로 <p>를 만들지 않음 (호출처가 메시지 스타일을 자유롭게 제어).
   * 예: NameStep.tsx:78-98 — `<input aria-describedby="vault-name-error" />` + `<p id="vault-name-error">`
   */
  errorId?: string;
  helperText?: string;
}

const sizeStyles: Record<InputSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-3 py-2 text-sm",  // default
  lg: "px-4 py-3 text-base",
};

const variantStyles: Record<InputVariant, string> = {
  default: "bg-[var(--color-bg)] text-[var(--color-text-h)] border-[var(--color-border)]",
  readonly: "bg-[var(--color-code-bg)] text-[var(--color-text-muted)] border-[var(--color-border)] cursor-default",
  error: "bg-[var(--color-bg)] text-[var(--color-text-h)] border-[var(--color-error)]",
  disabled: "bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-border)] opacity-50 cursor-not-allowed",
};

const baseStyles =
  "w-full rounded-lg border outline-none transition focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * 단순 union — input/select/textarea의 HTML props를 모두 union으로 결합.
 * 호출처에서 `as="select"` 호출 시 `type="email"` 같은 input-only prop을 전달해도
 * typecheck는 통과 (HTML 표준상 select/textarea는 무시). Discriminated union으로 좁히면
 * 호출처 25곳 모두 `as` 명시 강제되어 노이즈 ↑, 단순 union으로 호출자 부담 최소화.
 * runtime 안전성: `createElement(as, ...)`가 as 값에 따라 element를 만듦.
 */
type InputProps =
  & BaseProps
  & Omit<InputHTMLAttributes<HTMLInputElement>, "size">
  & Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">
  & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size">;

export const Input = forwardRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, InputProps>(
  ({ as = "input", size = "md", variant = "default", label, errorId, helperText, className = "", ...rest }, ref) => {
    const cn = `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`;

    const ariaProps: Record<string, unknown> = {};
    if (variant === "error") {
      ariaProps["aria-invalid"] = true;
      if (errorId) ariaProps["aria-describedby"] = errorId;
    }
    if (variant === "readonly") ariaProps["aria-readonly"] = true;
    if (variant === "disabled") ariaProps["aria-disabled"] = true;

    // `as` 값에 따라 element 타입 결정. ref 타입은 union이지만 실제 element 타입은
    // `as`가 결정 (select 호출 시 HTMLSelectElement, etc.) — runtime 안전.
    const inputEl = createElement(as, {
      ref: ref as React.Ref<HTMLInputElement>,
      className: cn,
      disabled: variant === "disabled" || (rest as { disabled?: boolean }).disabled,
      readOnly: variant === "readonly" || (rest as { readOnly?: boolean }).readOnly,
      ...ariaProps,
      ...rest,
    });

    if (!label && !helperText) return inputEl;

    // Q9/B안: label prop + id prop 호출처 명시 → <label htmlFor={id}> 자동 연결
    const inputId = (rest as { id?: string }).id;
    return (
      <div>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--color-text)] mb-1">
            {label}
          </label>
        )}
        {inputEl}
        {helperText && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{helperText}</p>}
      </div>
    );
  },
);