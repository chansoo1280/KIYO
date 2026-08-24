import { useState } from "react";
import { FormDialog } from "./FormDialog";

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

  const confirmDisabled = !fileName.trim() || (encrypted && !pin);

  const handleClose = () => {
    setFileName(defaultValue.replace(".json", ""));
    setPin("");
    setEncrypted(true);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fileName.trim()) {
      throw new Error("파일 이름을 입력해주세요.");
    }

    if (encrypted && !pin) {
      throw new Error("PIN 번호를 입력해주세요.");
    }

    await onConfirm({
      fileName: `${fileName.trim()}.json`,
      encrypted,
      pin,
    });

    handleClose();
  };

  return (
    <FormDialog
      open={open}
      title={title}
      description={description}
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitLabel={confirmLabel}
      disabled={confirmDisabled}
    >
      {/* 파일 이름 */}
      <label htmlFor="vault-name-input" className="mt-5 block text-sm font-medium text-[var(--color-text)]">
        파일 이름
      </label>

      <div className="mt-2 flex items-center gap-2">
        <input
          id="vault-name-input"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-4 py-3 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
        />

        <span className="text-sm text-[var(--color-text)]">.json</span>
      </div>

      {/* 암호화 여부 */}
      <label className="mt-5 flex items-center gap-3 text-sm font-medium text-[var(--color-text)]" htmlFor="encrypt-checkbox">
        <input
          type="checkbox"
          id="encrypt-checkbox"
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
    </FormDialog>
  );
};

export default FileCreateDialog;