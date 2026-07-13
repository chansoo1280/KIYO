import type { ReactNode } from "react";

interface BaseDialogProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  confirmLabel?: string;
  onConfirm?: () => Promise<void> | void;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-5"
      role="dialog"
      aria-modal="true"
    >
      <form
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
        onSubmit={handleConfirm}
      >
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>

        {description && (
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        )}

        {children}

        {errorMessage && (
          <p className="mt-4 text-sm font-medium text-red-600">
            {errorMessage}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            취소
          </button>

          <button
            type="submit"
            disabled={confirmDisabled || isLoading}
            className="rounded-full bg-[#aa3bff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8d2bd4] disabled:opacity-50"
          >
            {isLoading ? "처리 중..." : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BaseDialog;
