import { useState, useCallback, useEffect } from "react";
import { BaseDialog } from "./BaseDialog";
import type { ReactNode } from "react";

interface FormDialogProps {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => Promise<void>;
  submitLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
  errorMessage?: string;
  className?: string;
}

export const FormDialog = ({
  open,
  title,
  description,
  children,
  onClose,
  onSubmit,
  submitLabel = "확인",
  cancelLabel = "취소",
  isLoading = false,
  disabled = false,
  errorMessage,
  className = "",
}: FormDialogProps) => {
  const [internalError, setInternalError] = useState<string>("");

  // Reset error when dialog closes
  useEffect(() => {
    if (!open) {
      setInternalError("");
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (disabled || isLoading) return;

      setInternalError("");
      try {
        await onSubmit(event);
      } catch (error) {
        setInternalError(error instanceof Error ? error.message : "오류가 발생했습니다.");
      }
    },
    [disabled, isLoading, onSubmit]
  );

  const displayError = errorMessage || internalError;

  return (
    <BaseDialog
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      className={className}
    >
      <form onSubmit={handleSubmit}>
        {children}

        {displayError && (
          <p className="mt-4 text-sm font-medium text-[var(--color-error)]">
            {displayError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-code-bg)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            type="submit"
            disabled={disabled || isLoading}
            className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent)]/80 disabled:opacity-50"
          >
            {isLoading ? "처리 중..." : submitLabel}
          </button>
        </div>
      </form>
    </BaseDialog>
  );
};

export default FormDialog;