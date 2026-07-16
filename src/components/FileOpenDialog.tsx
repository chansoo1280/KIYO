import { useRef, useState } from "react";
import { BaseDialog } from "./BaseDialog";

interface FileOpenDialogProps {
  open: boolean;
  title?: string;
  onConfirm: (options: { file: File; pin: string }) => Promise<void>;
  onClose: () => void;
}

const FileOpenDialog = ({
  open,
  title = "파일 열기",
  onConfirm,
  onClose,
}: FileOpenDialogProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [pin, setPin] = useState("");
  const [encrypted, setEncrypted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selected = event.target.files?.[0];

    if (!selected) return;

    setFile(selected);
    setErrorMessage("");
    setPin("");

    try {
      const text = await selected.text();
      const json = JSON.parse(text);

      setEncrypted(json.encrypted === true);
    } catch {
      setEncrypted(false);
      setErrorMessage("올바른 KIYO 파일이 아닙니다.");
    }
  };

  const handleConfirm = async () => {
    if (!file) {
      setErrorMessage("파일을 선택해주세요.");
      return;
    }

    if (encrypted && !pin) {
      setErrorMessage("PIN 번호를 입력해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm({
        file,
        pin,
      });

      setFile(null);
      setPin("");
      setEncrypted(false);
      setErrorMessage("");

      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "파일을 열 수 없습니다.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPin("");
    setEncrypted(false);
    setErrorMessage("");
    onClose();
  };

  const confirmDisabled = !file;

  return (
    <BaseDialog
      open={open}
      title={title}
      onClose={handleClose}
      confirmLabel="열기"
      onConfirm={handleConfirm}
      confirmDisabled={confirmDisabled}
      isLoading={isLoading}
      errorMessage={errorMessage}
    >
      {/* 파일 선택 */}
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        hidden
        onChange={handleFileSelect}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-5 w-full rounded-2xl bg-[var(--color-code-bg)] px-4 py-3 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-border)]"
      >
        파일 선택
      </button>

      {file && (
        <div className="mt-5 rounded-2xl bg-[var(--color-code-bg)] p-4 text-sm text-[var(--color-text)]">
          <div>
            <span className="font-semibold">파일명:</span> {file.name}
          </div>

          <div className="mt-2">
            <span className="font-semibold">위치:</span> 내보낸 파일
          </div>

          <div className="mt-2">
            <span className="font-semibold">암호화:</span>{" "}
            {encrypted ? "사용" : "사용 안 함"}
          </div>
        </div>
      )}

      {encrypted && (
        <div className="mt-5">
          <label className="text-sm font-medium text-[var(--color-text)]">PIN 번호</label>

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

export default FileOpenDialog;
