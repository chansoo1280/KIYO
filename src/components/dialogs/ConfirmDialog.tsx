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
}: ConfirmDialogProps) => {
  const confirmClassName = variant === "danger"
    ? "rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
    : "rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-accent)]/80";

  return (
    <BaseDialog
      open={open}
      title={title}
      onClose={onClose}
      showCloseButton={false}
    >
      <p className="mt-4 text-[var(--color-text)]">{message}</p>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] shadow-sm disabled:opacity-50"
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