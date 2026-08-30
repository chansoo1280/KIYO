interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  /**
   * a11y label. 기본 "로딩 중".
   * `aria-hidden="true"`이면 label 무시 (button 내부 등 장식용).
   */
  label?: string;
  /**
   * true이면 aria-hidden="true" 적용 — button 등 부모의 accessible name에
   * 영향을 주지 않음. 기본 false.
   */
  "aria-hidden"?: boolean;
}

const sizeStyles: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export const Spinner = ({
  size = "md",
  className = "",
  label = "로딩 중",
  "aria-hidden": ariaHidden = false,
}: SpinnerProps) => {
  if (ariaHidden) {
    // 장식용: 부모 name에 영향 없도록
    return (
      <div
        aria-hidden="true"
        className={`inline-block ${sizeStyles[size]} ${className}`}
        data-testid="spinner"
      >
        <svg
          className="animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={label}
      className={`inline-block ${sizeStyles[size]} ${className}`}
      data-testid="spinner"
    >
      <svg
        className="animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
};

export default Spinner;
