import { useState } from "react";
import { BaseDialog } from "@/components/BaseDialog";
import { fileTable } from "@/database/fileTable";
import { verifyPin } from "@/crypto/encryption";
import { useDialog } from "@/hooks/useDialog";

interface PinChangeDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (newPin: string) => Promise<void>;
  isEncrypted?: boolean;
}

export const PinChangeDialog = ({
  open,
  onClose,
  onConfirm,
  isEncrypted = true,
}: PinChangeDialogProps) => {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const { close, setError, setLoading, handleConfirm, isLoading, errorMessage } = useDialog({
    onConfirm: async () => {
      // 암호화된 파일인 경우 현재 PIN 검증 필요
      if (isEncrypted && !currentPin) {
        setError("현재 PIN을 입력하세요.");
        return;
      }

      if (!newPin) {
        setError("새 PIN을 입력하세요.");
        return;
      }

      if (newPin.length < 4 || newPin.length > 6) {
        setError("PIN은 4~6자리 숫자여야 합니다.");
        return;
      }

      if (!/^\d+$/.test(newPin)) {
        setError("PIN은 숫자만 입력 가능합니다.");
        return;
      }

      if (newPin !== confirmPin) {
        setError("새 PIN이 일치하지 않습니다.");
        return;
      }

      // 암호화된 파일인 경우 현재 PIN과 새 PIN이 같은지 확인
      if (isEncrypted && currentPin === newPin) {
        setError("현재 PIN과 다른 PIN을 입력하세요.");
        return;
      }

      const { fileData } = await fileTable.getActiveFileInfo();
      if (!fileData) {
        setError("활성 데이터 파일이 없습니다.");
        return;
      }
      if (isEncrypted && !(await verifyPin(fileData, currentPin))) {
        setError("현재 PIN이 올바르지 않습니다.");
        return;
      }

      setLoading(true);
      try {
        await onConfirm(newPin);
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
        setError("");
        close();
      } catch (error) {
        setError(error instanceof Error ? error.message : "PIN 변경에 실패했습니다.");
      } finally {
        setLoading(false);
      }
    },
    onClose: () => {
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setError("");
      onClose();
    },
  });

  return (
    <BaseDialog
      open={open}
      title={isEncrypted ? "PIN 변경" : "PIN 설정"}
      description={
        isEncrypted
          ? "현재 PIN을 확인하고 새 PIN을 설정하세요."
          : "새 PIN을 설정하여 암호화를 활성화하세요."
      }
      onClose={close}
      onConfirm={handleConfirm}
      confirmLabel={isEncrypted ? "변경" : "설정"}
      isLoading={isLoading}
      errorMessage={errorMessage}
    >
      <div className="space-y-4">
        {isEncrypted && (
          <div>
            <label
              htmlFor="currentPin"
              className="block text-sm font-medium text-[var(--color-text)]"
            >
              현재 PIN
            </label>
            <input
              id="currentPin"
              type="password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
              placeholder="현재 PIN 입력"
              autoFocus
              disabled={isLoading}
            />
          </div>
        )}

        <div>
          <label
            htmlFor="newPin"
            className="block text-sm font-medium text-[var(--color-text)]"
          >
            {isEncrypted ? "새 PIN" : "PIN"}
          </label>
          <input
            id="newPin"
            type="password"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
            placeholder={
              isEncrypted
                ? "새 PIN 입력 (4~6자리 숫자)"
                : "PIN 입력 (4~6자리 숫자)"
            }
            disabled={isLoading}
            maxLength={6}
            autoFocus={!isEncrypted}
          />
        </div>

        <div>
          <label
            htmlFor="confirmPin"
            className="block text-sm font-medium text-[var(--color-text)]"
          >
            PIN 확인
          </label>
          <input
            id="confirmPin"
            type="password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
            placeholder={isEncrypted ? "새 PIN 재입력" : "PIN 재입력"}
            disabled={isLoading}
            maxLength={6}
          />
        </div>
      </div>
    </BaseDialog>
  );
};

export default PinChangeDialog;