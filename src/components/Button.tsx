import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "@/components/feedback/Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/80",
  secondary:
    "bg-[var(--color-accent-bg)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 border border-[var(--color-accent-border)]",
  ghost:
    "bg-transparent text-[var(--color-text-h)] hover:bg-[var(--color-code-bg)]",
  danger:
    "bg-[var(--color-error)] text-white hover:bg-[var(--color-error)]/80 border border-[var(--color-error)]",
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
  type = "button",
  className = "",
  ...props
}: ButtonProps) => {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2";

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      data-testid="button"
      data-loading={loading || undefined}
      {...props}
    >
      {loading && <Spinner size="sm" aria-hidden className="text-current" />}
      {label}
    </button>
  );
};

export default Button;
