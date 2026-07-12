import { useState } from "react";

interface FileNameDialogProps {
  open: boolean;
  title: string;
  description: string;
  defaultValue: string;
  confirmLabel: string;
  errorMessage?: string;
  onConfirm: (fileName: string) => void;
  onClose: () => void;
}

const FileNameDialog = ({
  open,
  title,
  description,
  defaultValue,
  confirmLabel,
  errorMessage,
  onConfirm,
  onClose,
}: FileNameDialogProps) => {
  const [fileName, setFileName] = useState(defaultValue.replace(".json", ""));
  const [isModify, setIsModify] = useState(false);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFileName(event.target.value);
    setIsModify(true);
  };
  const handleClose = () => {
    onClose();
    setFileName(defaultValue);
    setIsModify(true);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-name-dialog-title"
    >
      <form
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (fileName.trim()) onConfirm(fileName + ".json");
          setIsModify(false);
        }}
      >
        <h2
          id="file-name-dialog-title"
          className="text-xl font-semibold text-slate-900"
        >
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        <input
          value={fileName}
          onChange={handleInputChange}
          autoFocus
          className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#aa3bff]"
          aria-label="파일 이름"
        />
        .json
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

export default FileNameDialog;
