import BottomTabs from "../components/BottomTabs";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  backupDataFile,
  fileExists,
  isKiyoFile,
  openImportedDataFile,
} from "../database/fileStorage";
import { useSecurityStore } from "../store/securityStore";
import FileCreateDialog from "../components/FileCreateDialog";
import FileOpenDialog from "../components/FileOpenDialog";
import { useAccountStore } from "../store/accountStore";

const Settings = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const { activeFileName, setActiveFileName } = useSecurityStore(
    (state) => state,
  );
  const defaultBackupFileName = (() => {
    const fileName = activeFileName?.replace(/\.json$/, "") ?? "kiyo";
    const isBackup = /-backup$/i.test(fileName);
    return `${fileName}${isBackup ? "" : "-backup"}.json`;
  })();

  const handleBackup = async ({
    fileName,
    encrypted,
    pin,
  }: {
    fileName: string;
    location: string;
    encrypted: boolean;
    pin: string;
  }) => {
    const exists = await fileExists(fileName);
    if (exists) {
      const overwrite = window.confirm(
        `${fileName} 파일이 이미 존재합니다. 덮어쓰시겠습니까?`,
      );

      if (!overwrite) {
        return;
      }
    }
    if (encrypted && !pin) {
      throw new Error("핀번호를 입력하세요");
    }
    await backupDataFile(fileName, pin);
    setMessage("백업 파일을 저장했습니다.");
    setShowBackupDialog(false);
  };

  const handleRestore = async ({ file, pin }: { file: File; pin: string }) => {
    const data = await openImportedDataFile(await file.text(), pin, file.name);
    if (!data) {
      throw new Error("PIN 번호가 올바르지 않습니다.");
    }

    if (!isKiyoFile(data)) {
      throw new Error("지원하지 않는 파일 형식입니다.");
    }
    try {
      setMessage(`${file.name} 파일을 복원했습니다.`);
      navigate("/list", { replace: true });
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "파일을 복원하지 못했습니다.",
      );
    }
  };
  return (
    <main className="min-h-svh bg-[linear-gradient(180deg,#f8f7ff_0%,#ffffff_100%)] px-5 py-8 pb-28">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold text-slate-900">Settings</h1>
        </header>

        <section className="space-y-4">
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Security
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <span>PIN</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <span>자동잠금</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              UI
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <span>다크모드</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <span>글자크기</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Data
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <span>백업</span>
                <button
                  type="button"
                  onClick={() => setShowBackupDialog(true)}
                  className="rounded-full bg-[#f4efff] px-4 py-2 text-sm font-semibold text-[#7c3aed]"
                >
                  저장
                </button>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <span>복원</span>
                <button
                  type="button"
                  onClick={() => setShowRestoreDialog(true)}
                  className="rounded-full bg-[#f4efff] px-4 py-2 text-sm font-semibold text-[#7c3aed]"
                >
                  불러오기
                </button>
              </div>
              {/* <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <span>초기화</span>
              </div> */}
            </div>
          </div>
          {message && (
            <p className="text-sm font-medium text-slate-600">{message}</p>
          )}
        </section>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
            <span>파일변경</span>
            <button
              type="button"
              className="rounded-full bg-[#aa3bff] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#8d2bd4]"
              onClick={() => {
                setActiveFileName("");
                useAccountStore.getState().resetToInitial();
                navigate("/", { state: { selectFile: true } });
              }}
            >
              이동
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
            <span>앱 정보</span>
          </div>
        </div>
      </div>

      <FileCreateDialog
        open={showBackupDialog}
        title="백업 파일 저장"
        description="백업 JSON 파일의 이름을 입력하세요."
        defaultValue={defaultBackupFileName}
        confirmLabel="저장"
        onClose={() => setShowBackupDialog(false)}
        onConfirm={handleBackup}
      />
      <FileOpenDialog
        open={showRestoreDialog}
        onClose={() => setShowRestoreDialog(false)}
        onConfirm={handleRestore}
      />

      <BottomTabs />
    </main>
  );
};

export default Settings;
