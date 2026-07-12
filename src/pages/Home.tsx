import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fileExists,
  getActiveDataFileName,
  isKiyoDataFile,
} from "../database/fileStorage";
import { useAccountStore } from "../store/accountStore";
import FileNameDialog from "../components/FileNameDialog";

const Home = () => {
  const navigate = useNavigate();
  const createFile = useAccountStore((state) => state.createFile);
  const restoreFile = useAccountStore((state) => state.restoreFile);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFileName] = useState(() => getActiveDataFileName());
  const [error, setError] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [errorMessageCreateDialog, setErrorMessageCreateDialog] = useState("");

  useEffect(() => {
    if (activeFileName) {
      navigate("/list", { replace: true });
      return;
    }
  }, [activeFileName]);

  const handleCreate = async (fileName: string) => {
    const exists = await fileExists(fileName);
    if (exists) {
      setErrorMessageCreateDialog(`${fileName} 파일이 이미 존재합니다.`);
      return;
    } else {
      setErrorMessageCreateDialog("");
    }
    await createFile(fileName);
    navigate("/list", { replace: true });
    setShowCreateDialog(false);
  };

  const handleSelectedFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const data = JSON.parse(await file.text()) as unknown;
      if (!isKiyoDataFile(data)) {
        throw new Error("지원하지 않는 파일 형식입니다.");
      }
      await restoreFile(data, file.name);
      navigate("/list", { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "파일을 불러오지 못했습니다.",
      );
    }
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

          {error && (
            <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
          )}

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
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full bg-[#f4efff] px-5 py-3 text-sm font-semibold text-[#7c3aed] transition hover:bg-[#ede4ff]"
            >
              파일 선택
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void handleSelectedFile(event)}
          />
        </section>
      </div>
      <FileNameDialog
        open={showCreateDialog}
        title="새 파일 생성"
        description="새 JSON 파일의 이름을 입력하세요."
        defaultValue="my-accounts.json"
        confirmLabel="생성"
        errorMessage={errorMessageCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onConfirm={(fileName) => void handleCreate(fileName)}
      />
    </main>
  );
};

export default Home;
