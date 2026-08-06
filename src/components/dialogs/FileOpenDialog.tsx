import { useRef, useState } from "react";
import { FormDialog } from "./FormDialog";

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

  const confirmDisabled = !file;

  const handleClose = () => {
    setFile(null);
    setPin("");
    setEncrypted(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      throw new Error("파일을 선택해주세요.");
    }

    if (encrypted && !pin) {
      throw new Error("PIN 번호를 입력해주세요.");
    }

    await onConfirm({
      file,
      pin,
    });

    handleClose();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];

    if (!selected) return;

    setFile(selected);
    setPin("");

    try {
      const text = await selected.text();
      const json = JSON.parse(text);

      setEncrypted(json.encrypted === true);
    } catch {
      setEncrypted(false);
      throw new Error("올바른 KIYO 파일이 아닙니다.");
    }
  };

  return (
    <FormDialog
      open={open}
      title={title}
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitLabel="열기"
      disabled={confirmDisabled}
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
    </FormDialog>
  );
};

export default FileOpenDialog;