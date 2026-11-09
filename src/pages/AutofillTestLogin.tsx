import { useState } from "react";
import { Input } from "@/components/inputs";
import Button from "@/components/Button";
import { PageShell } from "@/components/PageShell";

const AutofillTestLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (import.meta.env.DEV) {
      console.log("Login attempt:", { email, password });
    }
    alert(`로그인 시도\n이메일: ${email}\n비밀번호: ${password}`);
  };

  return (
    <PageShell maxWidth="sm">
      <header className="flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-3xl bg-[var(--color-accent)] text-3xl font-bold text-white shadow-sm">
          K
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-[var(--color-accent)]">
            Autofill Test
          </p>
          <h1 className="mt-1 text-4xl font-semibold text-[var(--color-text-h)]">
            KIYO Autofill Test
          </h1>
        </div>
      </header>

      <section className="rounded-4xl border border-[var(--color-border)] bg-[var(--color-bg)] p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-[var(--color-accent)]">
          Autofill Service Test
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text-h)]">
          Android Autofill 테스트
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--color-text)]">
          Android AutofillService 테스트용 임시 로그인 화면입니다. 저장된 계정
          정보로 자동완성 기능을 테스트하세요.
        </p>

        <form autoComplete="on" className="mt-6 space-y-4">
          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-[var(--color-text)]"
            >
              이메일
            </label>
            <Input
              id="username"
              size="lg"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            <Input
              id="password"
              size="lg"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
            />
          </div>

          {/* Login Button — Plan-G2 단일 PR에 inline → Button 마이그레이션 동시 흡수 */}
          <Button
            type="button"
            variant="primary"
            onClick={handleLogin}
            label="로그인"
            className="!w-full"
          />
        </form>

        {/* Info Section */}
        <div className="mt-6 p-3 rounded-lg bg-[var(--color-code-bg)] border border-[var(--color-border)]">
          <p className="text-xs font-medium text-[var(--color-text)]">
            Autofill 힌트 설정
          </p>
          <ul className="mt-2 space-y-1 text-xs text-[var(--color-text)]">
            <li>
              이메일: <code>autoComplete="email"</code> (username/email 힌트)
            </li>
            <li>
              비밀번호: <code>autoComplete="current-password"</code> (password
              힌트)
            </li>
          </ul>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Android AutofillService가 이 힌트를 인식하여 저장된 계정 정보를
            제안합니다.
          </p>
        </div>
      </section>
    </PageShell>
  );
};

export default AutofillTestLogin;