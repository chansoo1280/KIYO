import { useState } from "react";
import { BaseDialog } from "@/components/BaseDialog";
import { useDialog } from "@/hooks/useDialog";

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

  const { close, setError, setConfirmDisabled, handleConfirm } = useDialog({
    onConfirm: async () => {
      if (!fileName.trim()) {
        setError("파일을 선택해주세요.");
        return;
      }

      if (encrypted && !pin) {
        setError("PIN 번호를 입력해주세요.");
        return;
      }
      await onConfirm({
        fileName: `${fileName.trim()}.json`,
        encrypted,
        pin,
      });

      resetState();
    },
    onClose: () => {
      resetState();
      onClose();
    },
    initialConfirmDisabled: !defaultValue.trim(),
  });

  const resetState = () => {
    setFileName(defaultValue.replace(".json", ""));
    setPin("");
    setEncrypted(true);
    setError("");
    setConfirmDisabled(!fileName.trim() || (encrypted && !pin));
  };

  const confirmDisabled = !fileName.trim() || (encrypted && !pin);

  return (
    <BaseDialog
      open={open}
      title={title}
      description={description}
      onClose={close}
      confirmLabel={confirmLabel}
      onConfirm={handleConfirm}
      confirmDisabled={confirmDisabled}
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
