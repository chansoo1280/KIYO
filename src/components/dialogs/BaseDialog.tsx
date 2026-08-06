import type { ReactNode } from "react";

interface BaseDialogProps {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  onClose: () => void;
  className?: string;
  showCloseButton?: boolean;
}

export const BaseDialog = ({
  open,
  title,
  description,
  children,
  onClose,
  className = "",
  showCloseButton = true,
}: BaseDialogProps) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-5"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm rounded-3xl bg-[var(--color-bg)] p-6 shadow-xl border border-[var(--color-border)] ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text-h)]">{title}</h2>
            {description && (
              <p className="mt-2 text-sm text-[var(--color-text)]">{description}</p>
            )}
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-code-bg)] flex-shrink-0"
              aria-label="닫기"
            >
              ✕
            </button>
          )}
        </div>

        {children}
      </div>
    </div>
  );
};

export default BaseDialog;