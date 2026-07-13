import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "../store/sessionStore";
import { getActiveFileInfo } from "../database/db";
import {
  createCryptoKey,
  decryptData,
  isEncryptedKiyoFile,
} from "../crypto/encryption";
import { isKiyoFile } from "../database/fileStorage";
import { useAccountStore } from "../store/accountStore";

const Auth = () => {
  const navigate = useNavigate();
  const { activeFileName } = useSessionStore((state) => state);
  const setSession = useSessionStore((state) => state.setSession);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Get fileName and isEncrypted from location state
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
      // Get active file info (includes salt and encrypted file data)
      const { salt, encrypted, fileData } = await getActiveFileInfo();

      if (!encrypted || !salt || !fileData || !isEncryptedKiyoFile(fileData)) {
        setError("암호화된 파일이 아닙니다.");
        setIsVerifying(false);
        return;
      }

      // Create crypto key from PIN and file's salt
      const { key } = await createCryptoKey(pin, salt);

      // Try to decrypt the file data
      const decrypted = await decryptData(fileData, key);

      // Verify decrypted data is valid Kiyo file
      if (!isKiyoFile(decrypted)) {
        setError("PIN 번호가 올바르지 않습니다.");
        setIsVerifying(false);
        return;
      }

      // Decryption successful - store crypto key and salt in session
      await setSession({ fileName, cryptoKey: key, salt });
      useAccountStore.getState().setAccounts(decrypted.accounts);

      // Navigate to list page
      navigate("/list", { replace: true });
    } catch (err) {
      console.error("PIN verification failed:", err);
      setError("PIN 번호가 올바르지 않습니다.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <main className="min-h-svh bg-[linear-gradient(180deg,#f8f7ff_0%,#ffffff_100%)] px-5 py-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <header className="flex items-center gap-4">
          <button
            type="button"
            onClick={async () => {
              await useSessionStore.getState().clearSession();
              useAccountStore.getState().resetToInitial();
              navigate("/", { state: { selectFile: true } });
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
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
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-linear-to-br from-[#aa3bff] to-[#7c3aed] text-3xl font-bold text-white shadow-sm">
            K
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#aa3bff]">
              Security
            </p>
            <h1 className="mt-1 text-4xl font-semibold text-slate-900">KIYO</h1>
          </div>
        </header>

        <section className="rounded-4xl border border-slate-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#aa3bff]">
            PIN Verification
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            암호화된 파일입니다
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            핀번호를 입력하여 파일을 잠금 해제하세요.
          </p>

          {/* File info display */}
          <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-xs font-medium text-slate-500">파일 정보</p>
            <p className="mt-1 text-sm font-mono text-slate-900 truncate">
              {fileName}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              내부 저장소 / Documents
            </p>
          </div>

          {error && (
            <div
              className="mt-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="pin"
                className="block text-sm font-medium text-slate-700"
              >
                PIN 번호
              </label>
              <input
                id="pin"
                type="password"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyPin()}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-[#aa3bff] focus:outline-none focus:ring-2 focus:ring-[#aa3bff]/20"
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
              className="w-full rounded-full bg-[#aa3bff] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8d2bd4] disabled:opacity-50 disabled:cursor-not-allowed"
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
