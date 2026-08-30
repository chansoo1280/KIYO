import type { ReactNode } from "react";
import { BaseDialog } from "./BaseDialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  isLoading?: boolean;
  error?: string | null;
}

export const ConfirmDialog = ({
  open,
  title,
  message,
  onClose,
  onConfirm,
  confirmLabel = "삭제",
  cancelLabel = "취소",
  variant = "danger",
  isLoading = false,
  error = null,
}: ConfirmDialogProps) => {
  const confirmClassName = variant === "danger"
    ? "rounded-md border border-[var(--color-accent)] bg-[var(--color-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)] shadow-sm hover:bg-[var(--color-accent)]/10 dark:border-[var(--color-accent)] dark:bg-[var(--color-bg)]/80 dark:text-[var(--color-accent)] dark:hover:bg-[var(--color-accent)]/20"
    : "rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-accent)]/80 dark:bg-[var(--color-accent)]/80";

  return (
    <BaseDialog
      open={open}
      title={title}
      onClose={onClose}
      showCloseButton={false}
    >
      <p className="mt-4 text-[var(--color-text)]">{message}</p>

      {error && (
        <p
          className="mt-4 rounded-md border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 px-3 py-2 text-sm font-medium text-[var(--color-error)]"
          role="alert"
          data-testid="confirm-dialog-error"
        >
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] shadow-sm disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className={`${confirmClassName} disabled:opacity-50`}
        >
          {isLoading ? "처리 중..." : confirmLabel}
        </button>
      </div>
    </BaseDialog>
  );
};

export default ConfirmDialog;