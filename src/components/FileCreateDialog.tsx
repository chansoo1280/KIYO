import { useState } from "react";
import { BaseDialog } from "@/components/BaseDialog";

interface FileCreateDialogProps {
  open: boolean;
  title: string;
  description: string;
  defaultValue: string;
  confirmLabel: string;

  onConfirm: (options: {
    fileName: string;
    encrypted: boolean;
    pin: string;
  }) => Promise<void>;

  onClose: () => void;
}

const FileCreateDialog = ({
  open,
  title,
  description,
  defaultValue,
  confirmLabel,
  onConfirm,
  onClose,
}: FileCreateDialogProps) => {
  const [fileName, setFileName] = useState(defaultValue.replace(".json", ""));

  const [encrypted, setEncrypted] = useState(true);

  const [pin, setPin] = useState("");

  const [isModify, setIsModify] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const resetState = () => {
    setFileName(defaultValue.replace(".json", ""));
    setPin("");
    setEncrypted(true);
    setIsModify(false);
    setErrorMessage("");
  };

  const handleConfirm = async () => {
    if (!fileName.trim()) {
      setErrorMessage("파일을 선택해주세요.");
      return;
    }

    if (encrypted && !pin) {
      setErrorMessage("PIN 번호를 입력해주세요.");
      return;
    }
    try {
      await onConfirm({
        fileName: `${fileName.trim()}.json`,
        encrypted,
        pin,
      });

      resetState();
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "파일을 생성할 수 없습니다.",
      );
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const confirmDisabled = !fileName.trim() || (encrypted && !pin);

  return (
    <BaseDialog
      open={open}
      title={title}
      description={description}
      onClose={handleClose}
      confirmLabel={confirmLabel}
      onConfirm={handleConfirm}
      confirmDisabled={confirmDisabled}
      errorMessage={errorMessage && !isModify ? errorMessage : undefined}
    >
      {/* 파일 이름 */}
      <label className="mt-5 block text-sm font-medium text-[var(--color-text)]">
        파일 이름
      </label>

      <div className="mt-2 flex items-center gap-2">
        <input
          value={fileName}
          onChange={(e) => {
            setFileName(e.target.value);
            setIsModify(true);
          }}
          className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-4 py-3 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
        />

        <span className="text-sm text-[var(--color-text)]">.json</span>
      </div>

      {/* 암호화 여부 */}
      <label className="mt-5 flex items-center gap-3 text-sm font-medium text-[var(--color-text)]">
        <input
          type="checkbox"
          checked={encrypted}
          onChange={(e) => setEncrypted(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
        파일 암호화 사용
      </label>

      {/* PIN */}
      {encrypted && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-[var(--color-text)]">
            PIN 번호
          </label>

          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="6자리 PIN"
            className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-4 py-3 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
          />
        </div>
      )}
    </BaseDialog>
  );
};

export default FileCreateDialog;
