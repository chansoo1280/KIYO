import BottomTabs from "../components/BottomTabs";

import { useNavigate } from "react-router-dom";

type Props = {};

const Settings = ({}: Props) => {
  const navigate = useNavigate();
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
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <span>복원</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <span>초기화</span>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
            <span>파일변경</span>
            <button
              type="button"
              className="rounded-full bg-[#aa3bff] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#8d2bd4]"
              onClick={() => navigate("/")}
            >
              이동
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
            <span>앱 정보</span>
          </div>
        </div>
      </div>

      <BottomTabs />
    </main>
  );
};

export default Settings;
