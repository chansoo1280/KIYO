import { useCallback, useState } from "react";
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

/**
 * catch된 에러를 사용자에게 표시할 메시지로 변환.
 *
 * - CryptoUnavailableError (LAN IP / HTTP 접근) → 친절한 안내 메시지
 * - Error 인스턴스 → 메시지 그대로 (이미 한국어인 경우 많음)
 * - 기타 → fallback
 */
function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // crypto.subtle undefined / secure context 부재 — Web Crypto API 사용 불가
    if (
      error.name === "CryptoUnavailableError" ||
      /Cannot read properties of undefined.*crypto/i.test(error.message) ||
      /crypto\.subtle is undefined/i.test(error.message) ||
      /secure context/i.test(error.message) ||
      /Cannot read properties of undefined.*importKey/i.test(error.message) ||
      /Cannot read properties of undefined.*deriveKey/i.test(error.message) ||
      /Cannot read properties of undefined.*encrypt/i.test(error.message) ||
      /Cannot read properties of undefined.*decrypt/i.test(error.message) ||
      /Cannot read properties of undefined.*getRandomValues/i.test(error.message)
    ) {
      return "이 환경에서는 암호화 기능을 사용할 수 없습니다. HTTPS 또는 localhost로 접속해주세요.";
    }
    return error.message;
  }
  return "알 수 없는 오류가 발생했습니다.";
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
        const message = toErrorMessage(error);
        setInternalError(message);
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
          <button
            type="button"
            onClick={handleClose}
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