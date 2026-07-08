import type { Account } from "../models/account";
import BottomTabs from "../components/BottomTabs";

const accounts: Account[] = [
  {
    id: "1",
    name: "Personal",
    username: "user01@example.com",
    password: "pass1234",
    icon: "P",
    balance: 1240.5,
  },
  {
    id: "2",
    name: "Savings",
    username: "user02@example.com",
    password: "secure456",
    icon: "S",
    balance: 9800.25,
  },
  {
    id: "3",
    name: "Travel",
    username: "travel@example.com",
    password: "trip789",
    icon: "T",
    balance: 540.75,
  },
  {
    id: "4",
    name: "Work",
    username: "workteam@example.com",
    password: "work2024",
    icon: "W",
    balance: 320.1,
  },
  {
    id: "5",
    name: "Family",
    username: "family@example.com",
    password: "fam123",
    icon: "F",
    balance: 880.4,
  },
  {
    id: "6",
    name: "Study",
    username: "study@example.com",
    password: "learn321",
    icon: "L",
    balance: 120.0,
  },
  {
    id: "7",
    name: "Study",
    username: "study@example.com",
    password: "learn321",
    icon: "L",
    balance: 120.0,
  },
  {
    id: "8",
    name: "Study",
    username: "study@example.com",
    password: "learn321",
    icon: "L",
    balance: 120.0,
  },
];

const AccountList = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="min-h-[100svh] bg-[linear-gradient(180deg,#f8f7ff_0%,#ffffff_100%)] pb-28 pt-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#aa3bff]">
              Accounts
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              My accounts
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg shadow-sm transition hover:bg-slate-50"
              aria-label="Search"
            >
              🔍
            </button>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg shadow-sm transition hover:bg-slate-50"
              aria-label="Sort"
            >
              ↕
            </button>
          </div>
        </header>

        <div className="grid gap-3">
          {accounts.map((account) => (
            <article
              key={account.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4efff] text-[#7c3aed] font-semibold">
                  {account.icon}
                </div>
                <p className="truncate text-sm text-slate-600">{account.username}</p>
              </div>

              <button
                type="button"
                className="rounded-full bg-[#f4efff] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7c3aed] transition hover:bg-[#ede4ff]"
                aria-label="Copy password"
              >
                복사
              </button>
            </article>
          ))}
        </div>
      </div>

      <button
        className="fixed right-5 bottom-28 z-20 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#aa3bff] text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:bg-[#8d2bd4]"
        type="button"
        aria-label="Scroll to top"
        onClick={scrollToTop}
      >
        ⬆
      </button>

      <BottomTabs />
    </section>
  );
};

export default AccountList;
