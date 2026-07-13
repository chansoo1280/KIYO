import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createDataFile,
  fileExists,
  isKiyoFile,
  openImportedDataFile,
} from "../database/fileStorage";
import FileCreateDialog from "../components/FileCreateDialog";
import { useSecurityStore } from "../store/securityStore";
import { initializeDatabase } from "../database/db";
import FileOpenDialog from "../components/FileOpenDialog";

const Home = () => {
  const navigate = useNavigate();
  const { activeFileName } = useSecurityStore((state) => state);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showOpenDialog, setShowOpenDialog] = useState(false);

  useEffect(() => {
    if (activeFileName) {
      navigate("/auth", { replace: true });
      return;
    }
  }, []);

  const handleCreateFile = async ({
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
      throw new Error(`${fileName} 파일이 이미 존재합니다.`);
    }
    if (encrypted && !pin) {
      throw new Error("핀번호를 입력하세요");
    }

    await createDataFile(fileName, pin);
    await initializeDatabase();
    navigate("/list", { replace: true });
    setShowCreateDialog(false);
  };

  const handleOpenFile = async ({ file, pin }: { file: File; pin: string }) => {
    const data = await openImportedDataFile(await file.text(), pin, file.name);

    if (!data) {
      throw new Error("PIN 번호가 올바르지 않습니다.");
    }

    if (!isKiyoFile(data)) {
      throw new Error("지원하지 않는 파일 형식입니다.");
    }

    navigate("/list", {
      replace: true,
    });
    setShowOpenDialog(false);
  };

  return (
    <main className="min-h-svh bg-[linear-gradient(180deg,#f8f7ff_0%,#ffffff_100%)] px-5 py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-linear-to-br from-[#aa3bff] to-[#7c3aed] text-3xl font-bold text-white shadow-sm">
            K
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#aa3bff]">
              Start
            </p>
            <h1 className="mt-1 text-4xl font-semibold text-slate-900">KIYO</h1>
          </div>
        </header>

        <section className="rounded-4xl border border-slate-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#aa3bff]">
            Get started
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            파일을 선택하세요
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            새 JSON 파일을 만들거나, 기존 KIYO JSON 파일을 불러올 수 있습니다.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="rounded-full bg-[#aa3bff] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8d2bd4]"
            >
              파일 생성
            </button>
            <button
              type="button"
              onClick={() => setShowOpenDialog(true)}
              className="rounded-full bg-[#867e98] px-5 py-3 text-sm font-semibold text-[#7c3aed] transition hover:bg-[#ede4ff]"
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
