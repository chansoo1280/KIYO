import { useState, useCallback } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { useNavigate } from "react-router-dom";
import { backupDataFile, openImportedDataFile, isKiyoFile } from "@/database/fileStorage";
import { fileTable } from "@/database/fileTable";
import FileCreateDialog from "@/components/dialogs/FileCreateDialog";
import FileOpenDialog from "@/components/dialogs/FileOpenDialog";

export function DataSection() {
  const [dataMessage, setDataMessage] = useState("");
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const { activeFileName: fileName } = useSessionStore();
  const navigate = useNavigate();

  const handleBackup = useCallback(async ({
    fileName: backupFileName,
    encrypted,
    pin,
  }: {
    fileName: string;
    encrypted: boolean;
    pin: string;
  }) => {
    const { activeFileName: currentActiveFileName } = await fileTable.getActiveFileInfo();
    const exists = currentActiveFileName === backupFileName;
    if (exists) {
      const overwrite = window.confirm(
        `${backupFileName} 파일이 이미 존재합니다. 덮어쓰시겠습니까?`,
      );

      if (!overwrite) {
        return;
      }
    }
    if (encrypted && !pin) {
      throw new Error("핀번호를 입력하세요");
    }
    await backupDataFile(backupFileName, pin);
  }, []);

  const handleRestore = useCallback(async ({ file, pin }: { file: File; pin: string }) => {
    const data = await openImportedDataFile(await file.text(), pin, file.name);
    if (!data) {
      throw new Error("PIN 번호가 올바르지 않습니다.");
    }

    if (!isKiyoFile(data)) {
      throw new Error("지원하지 않는 파일 형식입니다.");
    }
    try {
      navigate("/list", { replace: true });
    } catch (cause) {
      throw new Error(cause instanceof Error ? cause.message : "파일을 복원하지 못했습니다.", { cause });
    }
  }, [navigate]);

  const handleBackupClick = () => {
    setDataMessage("");
    setShowBackupDialog(true);
  };

  const handleRestoreClick = () => {
    setDataMessage("");
    setShowRestoreDialog(true);
  };

  const handleBackupConfirm = async (options: { fileName: string; encrypted: boolean; pin: string }) => {
    await handleBackup(options);
    setDataMessage("백업 파일을 저장했습니다.");
    setShowBackupDialog(false);
  };

  const handleRestoreConfirm = async (options: { file: File; pin: string }) => {
    await handleRestore(options);
    setDataMessage(`${options.file.name} 파일을 복원했습니다.`);
    setShowRestoreDialog(false);
  };

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">
        Data
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <span>백업</span>
          <button
            type="button"
            onClick={handleBackupClick}
            className="rounded-full bg-[var(--color-accent-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)]"
          >
            저장
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <span>복원</span>
          <button
            type="button"
            onClick={handleRestoreClick}
            className="rounded-full bg-[var(--color-accent-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)]"
          >
            불러오기
          </button>
        </div>
      </div>
      {dataMessage && (
        <p className="text-sm font-medium text-[var(--color-accent)]">
          {dataMessage}
        </p>
      )}

      <FileCreateDialog
        open={showBackupDialog}
        title="백업 파일 저장"
        description="백업 JSON 파일의 이름을 입력하세요."
        defaultValue={`${(fileName ?? "kiyo").replace(/\.json$/, "")}-backup.json`}
        confirmLabel="저장"
        onClose={() => setShowBackupDialog(false)}
        onConfirm={handleBackupConfirm}
      />
      <FileOpenDialog
        open={showRestoreDialog}
        onClose={() => setShowRestoreDialog(false)}
        onConfirm={handleRestoreConfirm}
      />
    </div>
  );
}