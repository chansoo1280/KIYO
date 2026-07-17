import { useState } from "react";

const AutofillTestLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    console.log("Login attempt:", { email, password });
    alert(`로그인 시도\n이메일: ${email}\n비밀번호: ${password}`);
  };

  return (
    <main className="min-h-svh bg-gradient-to-b from-[var(--color-accent-bg)] to-[var(--color-bg)] px-5 py-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <header className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-linear-to-br from-[var(--color-accent)] to-[#7c3aed] text-3xl font-bold text-white shadow-sm">
            K
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
              Autofill Test
            </p>
            <h1 className="mt-1 text-4xl font-semibold text-[var(--color-text-h)]">
              KIYO Autofill Test
            </h1>
          </div>
        </header>

        <section className="rounded-4xl border border-[var(--color-border)] bg-[var(--color-bg)] p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
            Autofill Service Test
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text-h)]">
            Android Autofill 테스트
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text)]">
            Android AutofillService 테스트용 임시 로그인 화면입니다.
            저장된 계정 정보로 자동완성 기능을 테스트하세요.
          </p>

          <div className="mt-6 space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[var(--color-text)]"
              >
                이메일
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-base text-[var(--color-text-h)] placeholder-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                placeholder="example@email.com"
                autoFocus
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--color-text)]"
              >
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-base text-[var(--color-text-h)] placeholder-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                placeholder="비밀번호"
              />
            </div>

            {/* Login Button */}
            <button
              type="button"
              onClick={handleLogin}
              className="w-full rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-accent)]/80"
            >
              로그인
            </button>
          </div>

          {/* Info Section */}
          <div className="mt-6 p-3 rounded-lg bg-[var(--color-code-bg)] border border-[var(--color-border)]">
            <p className="text-xs font-medium text-[var(--color-text)]">
              Autofill 힌트 설정
            </p>
            <ul className="mt-2 space-y-1 text-xs text-[var(--color-text)] font-mono">
              <li>이메일: <code>autoComplete="email"</code> (username/email 힌트)</li>
              <li>비밀번호: <code>autoComplete="current-password"</code> (password 힌트)</li>
            </ul>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Android AutofillService가 이 힌트를 인식하여 저장된 계정 정보를 제안합니다.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};

export default AutofillTestLogin;