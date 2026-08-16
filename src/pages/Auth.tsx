import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/store/sessionStore";
import {
  unlockFile,
  closeDataFile,
} from "@/database/fileStorage";
import { fileTable } from "@/database/fileTable";

const Auth = () => {
  const navigate = useNavigate();
  const { activeFileName: fileName } = useSessionStore((state) => state);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const checkFileAndNavigate = async () => {
      const { activeFileName, encrypted } = await fileTable.getActiveFileInfo();
      if (!activeFileName || !encrypted) {
        navigate("/", { replace: true });
        return;
      }
    };
    checkFileAndNavigate();
  }, [navigate]);

  const handlePinChange = (value: string) => {
    setPin(value);
    setError("");
  };

  const handleVerifyPin = async () => {
    if (!pin.trim()) {
      setError("핀번호를 입력하세요");
      return;
    }

    if (!fileName) {
      setError("파일 정보가 없습니다.");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      // Unlock file with PIN - fileStorage handles session internally
      const decrypted = await unlockFile(fileName, pin);

      if (!decrypted) {
        setError("PIN 번호가 올바르지 않습니다.");
        setIsVerifying(false);
        return;
      }

      // Navigate to list page
      navigate("/accounts", { replace: true });
    } catch (err) {
      console.error("PIN verification failed:", err);
      setError(`PIN verification failed:${err}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBackToHome = async () => {
    await closeDataFile();
    navigate("/", { state: { selectFile: true } });
  };

  return (
    <main className="min-h-svh bg-[var(--color-bg)] px-5 py-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <header className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBackToHome}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text)] transition hover:bg-[var(--color-code-bg)] hover:text-[var(--color-text-h)]"
            aria-label="첫 화면으로 돌아가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-[var(--color-accent)] text-3xl font-bold text-white shadow-sm">
            K
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
              Security
            </p>
            <h1 className="mt-1 text-4xl font-semibold text-[var(--color-text-h)]">
              KIYO
            </h1>
          </div>
        </header>

        <section className="rounded-4xl border border-[var(--color-border)] bg-[var(--color-bg)] p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
            KIYO 잠금 해제
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text-h)]">
            {fileName}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text)]">
            PIN 번호로 파일을 잠금 해제하세요.
          </p>

          {/* File info display */}
          <div className="mt-4 p-3 rounded-lg bg-[var(--color-code-bg)] border border-[var(--color-border)]">
            <p className="text-xs font-medium text-[var(--color-text)]">
              파일 정보
            </p>
            <p className="mt-1 text-sm font-mono text-[var(--color-text-h)] truncate">
              {fileName}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text)]">
              내부 저장소 / Documents
            </p>
          </div>

          {error && (
                      <div
                        className="mt-4 p-3 rounded-lg border border-[var(--error)]/20 bg-[var(--error)]/10 text-[var(--error)] text-sm dark:border-[var(--error)]/40 dark:bg-[var(--error)]/20 dark:text-[var(--error)]"
                        role="alert"
                      >
                        {error}
                      </div>
                    )}

          <div className="mt-6 space-y-4">
            {/* PIN input */}
            <div>
              <label
                htmlFor="pin"
                className="block text-sm font-medium text-[var(--color-text)]"
              >
                PIN 번호
              </label>
              <input
                id="pin"
                type="password"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyPin()}
                className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-base text-[var(--color-text-h)] placeholder-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                placeholder="4자리 핀번호"
                maxLength={6}
                autoFocus
                disabled={isVerifying}
              />
            </div>
            <button
              type="button"
              onClick={handleVerifyPin}
              disabled={isVerifying}
              className="w-full rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-accent)]/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? "확인 중..." : "확인"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Auth;
