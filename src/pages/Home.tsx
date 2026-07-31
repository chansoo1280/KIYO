import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createDataFile,
  isKiyoFile,
  openImportedDataFile,
} from "@/database/fileStorage";
import { fileTable } from "@/database/fileTable";
import FileCreateDialog from "@/components/FileCreateDialog";
import FileOpenDialog from "@/components/FileOpenDialog";
import {
  FileStorageErrorCode,
  isFileStorageError,
} from "@/errors/FileStorageError";
import { useSessionStore } from "@/store/sessionStore";

const Home = () => {
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const { activeFileName } = useSessionStore((state) => state);

  useEffect(() => {
    const checkFileAndNavigate = async () => {
      const { fileData, encrypted } = await fileTable.getActiveFileInfo();
      if (!activeFileName) return;
      if (encrypted) {
        navigate("/auth", {
          replace: true,
        });
        return;
      } else if (isKiyoFile(fileData)) {
        navigate("/list", { replace: true });
      }
    };
    checkFileAndNavigate();
  }, [navigate, activeFileName]);

  const handleCreateFile = async ({
    fileName,
    encrypted,
    pin,
  }: {
    fileName: string;
    encrypted: boolean;
    pin: string;
  }) => {
    if (encrypted && !pin) {
      throw new Error("핀번호를 입력하세요");
    }
    await createDataFile(fileName, pin);
    navigate("/list", { replace: true });
    setShowCreateDialog(false);
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

      navigate("/list", {
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
    <main className="min-h-svh bg-gradient-to-b from-[var(--color-accent-bg)] to-[var(--color-bg)] px-5 py-8">
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
            <button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-accent)]/80"
            >
              파일 생성
            </button>
            <button
              type="button"
              onClick={() => setShowOpenDialog(true)}
              className="rounded-full border-2 border-[var(--color-accent)] bg-[var(--color-bg)] px-5 py-3 text-sm font-semibold text-[var(--color-accent)] shadow-sm transition hover:bg-[var(--color-accent-bg)] hover:border-[var(--color-accent)]/80"
            >
              파일 선택
            </button>
          </div>
        </section>
      </div>
      <FileCreateDialog
        open={showCreateDialog}
        title="새 파일 생성"
        description="새 JSON 파일의 이름을 입력하세요."
        defaultValue="my-accounts.json"
        confirmLabel="생성"
        onClose={() => setShowCreateDialog(false)}
        onConfirm={handleCreateFile}
      />
      <FileOpenDialog
        open={showOpenDialog}
        onClose={() => setShowOpenDialog(false)}
        onConfirm={handleOpenFile}
      />
    </main>
  );
};

export default Home;
