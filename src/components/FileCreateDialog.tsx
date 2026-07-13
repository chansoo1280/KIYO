import { useEffect, useState } from "react";

interface FileCreateDialogProps {
  open: boolean;
  title: string;
  description: string;
  defaultValue: string;
  confirmLabel: string;

  onConfirm: (options: {
    fileName: string;
    location: string;
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

  const [location, setLocation] = useState("Documents");

  const [encrypted, setEncrypted] = useState(true);

  const [pin, setPin] = useState("");

  const [isModify, setIsModify] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (open) {
      setFileName(defaultValue.replace(".json", ""));
      setPin("");
      setEncrypted(true);
      setLocation("Documents");
      setIsModify(false);
    }
  }, [open, defaultValue]);

  const handleCreate = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
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
        location,
        encrypted,
        pin,
      });

      setFileName("");
      setPin("");
      setEncrypted(false);
      setErrorMessage("");

      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "파일을 생성할 수 없습니다.",
      );
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-5"
      role="dialog"
      aria-modal="true"
    >
      <form
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
        onSubmit={handleCreate}
      >
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>

        <p className="mt-2 text-sm text-slate-600">{description}</p>

        {/* 파일 이름 */}
        <label className="mt-5 block text-sm font-medium text-slate-700">
          파일 이름
        </label>

        <div className="mt-2 flex items-center gap-2">
          <input
            value={fileName}
            onChange={(e) => {
              setFileName(e.target.value);
              setIsModify(true);
            }}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
          />

          <span className="text-sm text-slate-500">.json</span>
        </div>

        {/* 저장 위치 */}
        {/* <label className="mt-5 block text-sm font-medium text-slate-700">
          저장 위치
        </label>

        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
        >
          <option value="Documents">Documents</option>
          <option value="Downloads">Downloads</option>
        </select> */}

        {/* 암호화 여부 */}
        <label className="mt-5 flex items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={encrypted}
            onChange={(e) => setEncrypted(e.target.checked)}
            className="h-4 w-4"
          />
          파일 암호화 사용
        </label>

        {/* PIN */}
        {encrypted && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">
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

        {errorMessage && !isModify && (
          <p className="mt-2 text-sm font-medium text-red-600">
            {errorMessage}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            취소
          </button>

          <button
            type="submit"
            className="rounded-full bg-[#aa3bff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8d2bd4]"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FileCreateDialog;
