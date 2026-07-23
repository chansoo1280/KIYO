import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "../store/sessionStore";
import { useBiometricAuth } from "../hooks/useBiometricAuth";
import {
  unlockFile,
  closeDataFile,
  isEncryptedKiyoFile,
  isKiyoFile,
  normalizeDataFileName,
} from "../database/fileStorage";
import { decryptData } from "../crypto/encryption";
import { useAccountStore } from "../store/accountStore";
import {
  getDatabaseSnapshot,
  migrateAccountsToEncryptedFormat,
} from "../database/db";
import { replaceDatabaseData, saveFileDataToDB } from "../database/db";
import useBiometricAuthStore from "../store/biometricAuthStore";

const Auth = () => {
  const navigate = useNavigate();
  const { activeFileName, salt } = useSessionStore((state) => state);
  const { biometricEnabled, initializeBiometricAuthStore } =
    useBiometricAuthStore((state) => state);
  const { authenticate } = useBiometricAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPinInput, setShowPinInput] = useState(!biometricEnabled);

  // Get fileName from session store
  const fileName = activeFileName;

  useEffect(() => {
    if (!fileName) {
      navigate("/", { replace: true });
      return;
    }
  }, [fileName, navigate]);

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
      navigate("/list", { replace: true });
    } catch (err) {
      console.error("PIN verification failed:", err);
      setError("PIN 번호가 올바르지 않습니다.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBiometricAuth = async () => {
    // Check availability using the hook
    const availability = await initializeBiometricAuthStore();
    if (!availability.isAvailable) {
      setError(
        availability.error ||
          "생체 인증을 사용할 수 없습니다. PIN 번호를 입력해주세요.",
      );
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const result = await authenticate();
      if (result === null) {
        setIsVerifying(false);
        return;
      }
      if (result.success && result.cryptoKey) {
        // Use the cryptoKey from biometric authentication to unlock the file
        if (!fileName || !salt) {
          setError("세션 정보가 없습니다. 다시 시도해주세요.");
          setIsVerifying(false);
          return;
        }

        const normalizedFileName = fileName;
        const fileData = await getDatabaseSnapshot(normalizedFileName);

        if (!fileData || !isEncryptedKiyoFile(fileData)) {
          setError("파일 정보를 찾을 수 없습니다.");
          setIsVerifying(false);
          return;
        }

        try {
          const decrypted = await decryptData(fileData, result.cryptoKey);

          if (!isKiyoFile(decrypted)) {
            setError("파일 데이터가 올바르지 않습니다.");
            setIsVerifying(false);
            return;
          }

          const normalizedFileName = normalizeDataFileName(decrypted.fileName);
          await useSessionStore.getState().setSession({
            fileName: normalizedFileName,
            cryptoKey: result.cryptoKey,
            salt,
          });
          await replaceDatabaseData(decrypted);
          await saveFileDataToDB(normalizedFileName, fileData, salt);
          useAccountStore.getState().setAccounts(decrypted.accounts);

          // Migrate existing plaintext accounts to encrypted format
          await migrateAccountsToEncryptedFormat(result.cryptoKey);

          navigate("/list", { replace: true });
        } catch (decryptError) {
          console.error("Biometric decryption failed:", decryptError);
          setError("생체 인증 복호화에 실패했습니다. PIN 번호를 입력해주세요.");
          setIsVerifying(false);
        }
      }
    } catch (err) {
      console.error("Biometric authentication failed:", err);
      setError("생체 인증에 실패했습니다. PIN 번호를 입력해주세요.");
      setIsVerifying(false);
    }
  };

  const handleShowPinInput = () => {
    setShowPinInput(true);
    setError("");
  };

  const handleBackToHome = async () => {
    await closeDataFile();
    navigate("/", { state: { selectFile: true } });
  };

  return (
    <main className="min-h-svh bg-gradient-to-b from-[var(--color-accent-bg)] to-[var(--color-bg)] px-5 py-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <header className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBackToHome}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text)] transition hover:bg-[var(--color-code-bg)] hover:text-[var(--color-text-h)]"
            aria-label="첫 화면으로 돌아가기"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
          </button>
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-linear-to-br from-[var(--color-accent)] to-[#7c3aed] text-3xl font-bold text-white shadow-sm">
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
          {biometricEnabled ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
                KIYO 잠금 해제
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text-h)]">
                {fileName}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text)]">
                생체 인증 또는 PIN 번호로 파일을 잠금 해제하세요.
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
                  className="mt-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm dark:bg-red-900/30 dark:text-red-400"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="mt-6 space-y-4">
                {/* Biometric authentication button */}
                <button
                  type="button"
                  onClick={handleBiometricAuth}
                  disabled={isVerifying}
                  className="w-full rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-accent)]/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  지문으로 열기
                </button>

                {/* Divider */}
                <div className="relative flex items-center">
                  <div className="flex-grow border-t border-[var(--color-border)]" />
                  <span className="px-4 text-xs text-[var(--color-text)] uppercase tracking-[0.24em]">
                    또는
                  </span>
                </div>

                {/* PIN input button */}
                <button
                  type="button"
                  onClick={handleShowPinInput}
                  disabled={isVerifying}
                  className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-3 text-sm font-semibold text-[var(--color-text-h)] shadow-sm transition hover:bg-[var(--color-code-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  PIN 번호 입력
                </button>
              </div>

              {/* PIN Input Form - shown when showPinInput is true */}
              {showPinInput && (
                <div className="mt-6 space-y-4 animate-fade-in">
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
              )}
            </>
          ) : (
            // Biometric disabled - show PIN input directly
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
                PIN Verification
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text-h)]">
                암호화된 파일입니다
              </h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text)]">
                핀번호를 입력하여 파일을 잠금 해제하세요.
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
                  className="mt-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm dark:bg-red-900/30 dark:text-red-400"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="mt-6 space-y-4">
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
            </>
          )}
        </section>
      </div>
    </main>
  );
};

export default Auth;
