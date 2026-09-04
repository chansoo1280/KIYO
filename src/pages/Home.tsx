import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  isKiyoFile,
  openImportedDataFile,
} from "@/database/fileStorage";
import { fileTable, type FileRecord } from "@/database/fileTable";
import { useSessionStore } from "@/store/sessionStore";
import {
  FileStorageErrorCode,
  isFileStorageError,
} from "@/database/fileStorage.error";
import { setupVaultSession } from "@/database/fileStorage";
import FileOpenDialog from "@/components/dialogs/FileOpenDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import Button from "@/components/Button";
import { PageShell } from "@/components/PageShell";
import { Trash2 } from "lucide-react";
import { activatePlaintextVault } from "@/database/fileStorage";

const Home = () => {
  const navigate = useNavigate();
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [pendingDeleteFileName, setPendingDeleteFileName] = useState<
    string | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const refreshFiles = async () => {
    const all = await fileTable.getAllFiles();
    setFiles(all);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshFiles();
  }, []);

  const handleSelectFile = async (fileName: string) => {
    const info = await fileTable.getFileInfo(fileName);
    if (!info.activeFileName) {
      throw new Error(`File not found: ${fileName}`);
    }
    await setupVaultSession({ fileName });
    if (info.encrypted) {
      // /auth로 이동하여 unlock
      navigate("/auth", { replace: true });
    } else {
      // plaintext 
      await activatePlaintextVault(fileName);
      navigate("/accounts", { replace: true });
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    setPendingDeleteFileName(fileName);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteFileName) return;
    setIsDeleting(true);
    try {
      await fileTable.deleteFileRecord(pendingDeleteFileName);
      await refreshFiles();
    } finally {
      setIsDeleting(false);
      setPendingDeleteFileName(null);
    }
  };

  const handleOpenFile = async ({ file, pin }: { file: File; pin: string }) => {
    try {
      const data = await openImportedDataFile(
        await file.text(),
        pin,
        file.name,
      );

      if (!isKiyoFile(data)) {
        throw new Error("지원하지 않는 파일 형식입니다.");
      }

      navigate("/accounts", {
        replace: true,
      });
      setShowOpenDialog(false);
    } catch (error) {
      if (isFileStorageError(error)) {
        switch (error.code) {
          case FileStorageErrorCode.INVALID_FILE_FORMAT:
            // INVALID_JSON, INVALID_FORMAT 등이 INVALID_FILE_FORMAT으로 통합됨
            // 에러 메시지로 구분 가능: "JSON 파싱 실패" vs "is not KiyoFile" vs "fileName is empty"
            if (error.message.includes("JSON")) {
              throw new Error("파일 형식이 올바르지 않습니다. (JSON 파싱 오류)", {
                cause: error,
              });
            }
            throw new Error("지원하지 않는 파일 형식입니다.", { cause: error });
          case FileStorageErrorCode.INVALID_PIN:
            throw new Error("PIN 번호가 올바르지 않습니다.", { cause: error });
          default:
            throw new Error(`파일 열기 실패: ${error.message}`, { cause: error });
        }
      }
      throw error;
    }
  };

  return (
    <PageShell maxWidth="lg">
      <header className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-linear-to-br from-[var(--color-accent)] to-[#7c3aed] text-3xl font-bold text-white shadow-sm">
            K
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-[var(--color-accent)]">
              Start
            </p>
            <h1 className="mt-1 text-4xl font-semibold text-[var(--color-text-h)]">
              KIYO
            </h1>
          </div>
        </header>

        <section className="rounded-4xl border border-[var(--color-border)] bg-[var(--color-bg)] p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-[var(--color-accent)]">
            Get started
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text-h)]">
            파일을 선택하세요
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text)]">
            새 JSON 파일을 만들거나, 기존 KIYO JSON 파일을 불러올 수 있습니다.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/create-vault"
              data-testid="create-vault-link"
              className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-accent)]/80"
            >
              파일 생성
            </Link>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowOpenDialog(true)}
              label="파일 선택"
            />
          </div>
        </section>

        {files.length > 0 && (
          <section className="rounded-4xl border border-[var(--color-border)] bg-[var(--color-bg)] p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-[var(--color-accent)]">
              Existing vaults
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text-h)]">
              기존 파일
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text)]">
              기존 볼트를 선택해 활성화하거나 삭제할 수 있습니다.
            </p>
            <ul className="mt-4 flex flex-col gap-2" data-testid="file-list">
              {files.map((file) => {
                const sessionActive = useSessionStore.getState().activeFileName;
                const isActive = file.fileName === sessionActive;
                return (
                  <li
                    key={file.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] px-4 py-3"
                    data-testid="file-list-item"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleSelectFile(file.fileName)}
                      className="!flex-1 !justify-start !text-left !text-sm !font-medium !text-[var(--color-text-h)]"
                      label={file.fileName + (isActive ? " active" : "")}
                      aria-label={`${file.fileName} 활성화`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleDeleteFile(file.fileName)}
                      className="!grid !h-9 !w-9 !place-items-center !rounded-full !text-[var(--color-text-muted)] hover:!bg-[var(--color-destructive-bg)] hover:!text-[var(--color-destructive)]"
                      label=""
                      aria-label={`${file.fileName} 삭제`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      <FileOpenDialog
        open={showOpenDialog}
        onClose={() => setShowOpenDialog(false)}
        onConfirm={handleOpenFile}
      />
      <ConfirmDialog
        open={pendingDeleteFileName !== null}
        title="파일 삭제"
        message={
          pendingDeleteFileName
            ? `"${pendingDeleteFileName}" 파일을 삭제하시겠습니까?`
            : ""
        }
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        isLoading={isDeleting}
        onClose={() => {
          if (!isDeleting) setPendingDeleteFileName(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </PageShell>
  );
};

export default Home;
