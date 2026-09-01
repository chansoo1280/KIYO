import type { ReactNode } from "react";
import { BaseDialog } from "./BaseDialog";
import Button from "@/components/Button";

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
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isLoading}
          label={cancelLabel}
        />
        <Button
          type="button"
          variant={variant}
          loading={isLoading}
          onClick={onConfirm}
          disabled={isLoading}
          label={isLoading ? "처리 중..." : confirmLabel}
        />
      </div>
    </BaseDialog>
  );
};

export default ConfirmDialog;