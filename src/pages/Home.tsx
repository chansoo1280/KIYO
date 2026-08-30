import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  isKiyoFile,
  openImportedDataFile,
} from "@/database/fileStorage";
import { fileTable } from "@/database/fileTable";
import { useSessionStore } from "@/store/sessionStore";
import {
  FileStorageErrorCode,
  isFileStorageError,
} from "@/errors/FileStorageError";
import { setupVaultSession } from "@/database/fileStorage";
import FileOpenDialog from "@/components/dialogs/FileOpenDialog";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import type { FileRecord } from "@/database/db";
import { Trash2 } from "lucide-react";

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
    const checkFileAndNavigate = async () => {
      const sessionActiveFileName = useSessionStore.getState().activeFileName;
      if (sessionActiveFileName) {
        const { activeFileName, encrypted } = await fileTable.getFileInfo(sessionActiveFileName);
        const { cryptoKey } = useSessionStore.getState();
        if (activeFileName && encrypted && !cryptoKey) {
          navigate("/auth", { replace: true });
          return;
        }
        if (activeFileName) {
          navigate("/accounts", { replace: true });
          return;
        }
      }
      // active 없음 — Home에 머무르며 파일 리스트 표시
      await refreshFiles();
    };
    checkFileAndNavigate();
  }, [navigate]);

  const handleSelectFile = async (fileName: string) => {
    await useSessionStore.getState().clearSession();
    const info = await fileTable.getFileInfo(fileName);
    if (!info.activeFileName) {
      throw new Error(`File not found: ${fileName}`);
    }
    if (info.encrypted) {
      // cryptoKey 없이 active만 설정 → /auth로 이동하여 unlock
      await setupVaultSession({ fileName });
      navigate("/auth", { replace: true });
    } else {
      // plaintext — active 설정 + store reload
      await setupVaultSession({ fileName, loadStores: true });
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
          case FileStorageErrorCode.INVALID_JSON:
            throw new Error("파일 형식이 올바르지 않습니다. (JSON 파싱 오류)", {
              cause: error,
            });
          case FileStorageErrorCode.INVALID_FORMAT:
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
    <main className="min-h-svh bg-[var(--color-bg)] px-5 py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-linear-to-br from-[var(--color-accent)] to-[#7c3aed] text-3xl font-bold text-white shadow-sm">
            K
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
              Start
            </p>
            <h1 className="mt-1 text-4xl font-semibold text-[var(--color-text-h)]">
              KIYO
            </h1>
          </div>
        </header>

        <section className="rounded-4xl border border-[var(--color-border)] bg-[var(--color-bg)] p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
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
            <button
              type="button"
              onClick={() => setShowOpenDialog(true)}
              className="rounded-full border-2 border-[var(--color-accent)] bg-[var(--color-bg)] px-5 py-3 text-sm font-semibold text-[var(--color-accent)] shadow-sm transition hover:bg-[var(--color-accent-bg)] hover:border-[var(--color-accent)]/80"
            >
              파일 선택
            </button>
          </div>
        </section>

        {files.length > 0 && (
          <section className="rounded-4xl border border-[var(--color-border)] bg-[var(--color-bg)] p-7 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
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
                    <button
                      type="button"
                      onClick={() => handleSelectFile(file.fileName)}
                      className="flex-1 text-left text-sm font-medium text-[var(--color-text-h)]"
                      aria-label={`${file.fileName} 활성화`}
                    >
                      {file.fileName}
                      {isActive && (
                        <span className="ml-2 rounded-full bg-[var(--color-accent-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-accent)]">
                          active
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(file.fileName)}
                      className="grid h-9 w-9 place-items-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-destructive-bg)] hover:text-[var(--color-destructive)]"
                      aria-label={`${file.fileName} 삭제`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
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
    </main>
  );
};

export default Home;
