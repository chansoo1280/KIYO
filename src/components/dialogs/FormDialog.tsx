import { useCallback, useState } from "react";
import { BaseDialog } from "./BaseDialog";
import type { ReactNode } from "react";
import { mapError } from "@/utils/mapError";
import Button from "@/components/Button";

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
  // 내부 에러 state: onSubmit에서 throw된 에러를 표시용으로 보관
  const [internalError, setInternalError] = useState<string | null>(null);

  const handleClose = () => {
    setInternalError(null);
    onClose();
  };

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (disabled || isLoading) return;

      try {
        await onSubmit(event);
        // 성공 시 이전 에러 클림
        setInternalError(null);
      } catch (error) {
        setInternalError(mapError(error));
        console.error("FormDialog submit error:", error);
      }
    },
    [disabled, isLoading, onSubmit]
  );

  // 외부 prop 우선, 없으면 내부 catch된 에러 사용
  const displayError = errorMessage ?? internalError;

  return (
    <BaseDialog
      open={open}
      title={title}
      description={description}
      onClose={handleClose}
      className={className}
    >
      <form onSubmit={handleSubmit}>
        {children}

        {displayError && (
          <p
            className="mt-4 text-sm font-medium text-[var(--color-error)]"
            data-testid="form-dialog-error"
            role="alert"
          >
            {displayError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isLoading}
            label={cancelLabel}
          />

          <Button
            type="submit"
            variant="primary"
            loading={isLoading}
            disabled={disabled || isLoading}
            label={isLoading ? "처리 중..." : submitLabel}
          />
        </div>
      </form>
    </BaseDialog>
  );
};

export default FormDialog;