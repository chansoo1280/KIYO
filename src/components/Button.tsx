import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/80",
  secondary: "bg-[var(--color-accent-bg)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 border border-[var(--color-accent-border)]",
  ghost: "bg-transparent text-[var(--color-text-h)] hover:bg-[var(--color-code-bg)]",
  danger: "bg-[var(--color-error)] text-white hover:bg-[var(--color-error)]/80 border border-[var(--color-error)]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-3 text-base",
};

const Button = ({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2";

  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : null}
      {label}
    </button>
  );
};

export default Button;