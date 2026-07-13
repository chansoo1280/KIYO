import { useRef, useState } from "react";

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

  const handleOpen = async () => {
    if (!file) {
      setErrorMessage("파일을 선택해주세요.");
      return;
    }

    if (encrypted && !pin) {
      setErrorMessage("PIN 번호를 입력해주세요.");
      return;
    }

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
    }
  };

  const handleClose = () => {
    setFile(null);
    setPin("");
    setEncrypted(false);
    setErrorMessage("");

    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-5"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>

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
          className="mt-5 w-full rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
        >
          파일 선택
        </button>

        {file && (
          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm">
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
            <label className="text-sm font-medium text-slate-700">
              PIN 번호
            </label>

            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="6자리 PIN"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            />
          </div>
        )}

        {errorMessage && (
          <p className="mt-4 text-sm font-medium text-red-600">
            {errorMessage}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            취소
          </button>

          <button
            type="button"
            onClick={handleOpen}
            className="rounded-full bg-[#aa3bff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8d2bd4]"
          >
            열기
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileOpenDialog;
