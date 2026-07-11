import { useNavigate } from "react-router-dom";

type HomeProps = {};

const Home = ({}: HomeProps) => {
  const navigate = useNavigate();
  const hasRecentFile = false;
  const recentFileName = "project.kiyo";

  return (
    <main className="min-h-svh bg-[linear-gradient(180deg,#f8f7ff_0%,#ffffff_100%)] px-5 py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-linear-to-br from-[#aa3bff] to-[#7c3aed] text-3xl font-bold text-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]">
            K
          </div>

          <div className="text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#aa3bff]">
              Start
            </p>
            <h1 className="mt-1 text-4xl font-semibold text-slate-900 sm:text-5xl">
              KIYO
            </h1>
          </div>
        </header>

        <section className="rounded-4xl border border-slate-200 bg-white p-7 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]">
          {hasRecentFile ? (
            <>
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#aa3bff]">
                  Recent file
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  Continue your work
                </h2>
              </div>

              <div className="mb-5 flex flex-col gap-4 rounded-2xl bg-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {recentFileName}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Last opened just now
                  </p>
                </div>

                <div className="min-w-27.5 space-y-2">
                  <label
                    className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-slate-500"
                    htmlFor="pin"
                  >
                    PIN
                  </label>
                  <input
                    id="pin"
                    type="password"
                    placeholder="••••"
                    readOnly
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#aa3bff]/40"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-full bg-[#aa3bff] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8d2bd4]"
                >
                  Open file
                </button>
                <button
                  type="button"
                  className="rounded-full bg-[#f4efff] px-5 py-3 text-sm font-semibold text-[#7c3aed] transition hover:bg-[#ede4ff]"
                >
                  Change file
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#aa3bff]">
                  Get started
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                  No recent file yet
                </h2>
              </div>

              <p className="mb-6 text-sm leading-6 text-slate-600">
                Create a new file or select one from your device to begin.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-full bg-[#aa3bff] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8d2bd4]"
                  onClick={() => navigate("/list")}
                >
                  Create file
                </button>
                <button
                  type="button"
                  className="rounded-full bg-[#f4efff] px-5 py-3 text-sm font-semibold text-[#7c3aed] transition hover:bg-[#ede4ff]"
                >
                  Select file
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
};

export default Home;
