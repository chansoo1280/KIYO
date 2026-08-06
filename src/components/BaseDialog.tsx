import type { ReactNode } from "react";

interface BaseDialogProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  confirmLabel?: string;
  onConfirm?: () => Promise<void>;
  confirmDisabled?: boolean;
  isLoading?: boolean;
  errorMessage?: string;
}

export const BaseDialog = ({
  open,
  title,
  description,
  children,
  onClose,
  confirmLabel = "확인",
  onConfirm,
  confirmDisabled = false,
  isLoading = false,
  errorMessage,
}: BaseDialogProps) => {
  if (!open) return null;

  const handleConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (onConfirm) {
      await onConfirm();
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] p-5"
      role="dialog"
      aria-modal="true"
    >
      <form
        className="w-full max-w-sm rounded-3xl bg-[var(--color-bg)] p-6 shadow-xl border border-[var(--color-border)]"
        onSubmit={handleConfirm}
      >
        <h2 className="text-xl font-semibold text-[var(--color-text-h)]">{title}</h2>

        {description && (
          <p className="mt-2 text-sm text-[var(--color-text)]">{description}</p>
        )}

        {children}

        {errorMessage && (
          <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">
            {errorMessage}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-code-bg)] disabled:opacity-50"
          >
            취소
          </button>

          <button
            type="submit"
            disabled={confirmDisabled || isLoading}
            className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent)]/80 disabled:opacity-50"
          >
            {isLoading ? "처리 중..." : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BaseDialog;
