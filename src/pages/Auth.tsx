import { useEffect, useState } from "react";
import { ArrowLeft, Fingerprint } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "@/store/sessionStore";
import {
  unlockFile,
  closeDataFile,
  initializeStores,
} from "@/database/fileStorage";
import { fileTable } from "@/database/fileTable";
import { SecureKey } from "@/plugins/kiyosecurekey";
import { MIN_PIN_LENGTH } from "@/crypto/pinStrength";
import { mapError } from "@/utils/mapError";
import Button from "@/components/Button";
import { Input } from "@/components/inputs";
import { PageShell } from "@/components/PageShell";

const Auth = () => {
  const navigate = useNavigate();
  const { activeFileName: fileName } = useSessionStore((state) => state);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [biometryAvailable, setBiometryAvailable] = useState<{ available: boolean; type: string }>({ available: false, type: "none" });
  const [showBiometricButton, setShowBiometricButton] = useState(false);

  useEffect(() => {
    const checkFileAndNavigate = async () => {
      const activeFileName = useSessionStore.getState().activeFileName;
      if (!activeFileName) {
        navigate("/", { replace: true });
        return;
      }
      const { encrypted } = await fileTable.getFileInfo(activeFileName);
      if (!encrypted) {
        navigate("/", { replace: true });
        return;
      }

      // Check if biometric key exists and biometry is available
      if (encrypted) {
        try {
          const hasKeyResult = await SecureKey.hasKey({ vaultId: activeFileName });
          if (hasKeyResult.exists) {
            const bioResult = await SecureKey.isBiometryAvailable();
            if (bioResult.available) {
              setBiometryAvailable(bioResult);
              setShowBiometricButton(true);
            }
          }
        } catch (err) {
          console.warn("Biometric check failed:", err);
        }
      }
    };
    checkFileAndNavigate();
  }, [navigate]);

  const handlePinChange = (value: string) => {
    setPin(value);
    setError("");
  };

  const handleVerifyPin = async () => {
    if (pin.length < MIN_PIN_LENGTH) {
      setError(`PIN은 ${MIN_PIN_LENGTH}자 이상 입력해주세요.`);
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

      // 언락으로 cryptoKey가 생겼으므로 암호화 레코드를 복호화해 스토어를 다시 로드한다
      // (App 마운트 시점엔 키가 없어 레코드가 빈 스텁으로 로드됨)
      await initializeStores();

      // Navigate to list page
      navigate("/accounts", { replace: true });
    } catch (err) {
      console.error("PIN verification failed:", err instanceof Error ? err.message : String(err), err);
      setError(mapError(err));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!fileName) {
      setError("파일 정보가 없습니다.");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const result = await SecureKey.unlockKeyWithBiometric({ vaultId: fileName });
      const cryptoKeyBase64 = result.key;

      // Get the salt from the file
      const { salt } = await fileTable.getFileInfo(useSessionStore.getState().activeFileName!);
      if (!salt) {
        throw new Error("Salt not found for encrypted file");
      }

      // Import the cryptoKey from base64 and set up session
      await useSessionStore.getState().setCryptoKeyFromBase64(cryptoKeyBase64, salt);

      // 언락으로 cryptoKey가 생겼으므로 암호화 레코드를 복호화해 스토어를 다시 로드한다
      // (App 마운트 시점엔 키가 없어 레코드가 빈 스텁으로 로드됨)
      await initializeStores();

      navigate("/accounts", { replace: true });
    } catch (err) {
      console.error("Biometric login failed:", err instanceof Error ? err.message : String(err), err);
      // 저장된 키 데이터 손상(GCM 태그 불일치 등) → 재등록 안내. 나머지(취소 포함)는 PIN 폴백 통일.
      const anyErr = err as { message?: string; data?: { keyCorrupted?: boolean } };
      if (anyErr?.data?.keyCorrupted) {
        setError("저장된 생체인증 키가 손상되었습니다. PIN으로 로그인한 뒤 설정에서 생체인증을 다시 등록해 주세요.");
      } else {
        // 취소(에러 코드 5 포함)와 실패 모두 PIN 폴백 안내로 통일 — SecureKeyPlugin이
        // biometricError 플래그를 주지만 message 대소문자가 버전별로 달라 문자열 매칭은 불안정.
        setError("생체인증에 실패했습니다. PIN으로 로그인해 주세요.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBackToHome = async () => {
    await closeDataFile();
    navigate("/", { state: { selectFile: true } });
  };

  return (
    <PageShell maxWidth="sm">
      <header className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBackToHome}
            className="!h-10 !w-10 !rounded-xl !p-0 !text-[var(--color-text)] hover:!bg-[var(--color-code-bg)] hover:!text-[var(--color-text-h)]"
            label=""
            aria-label="첫 화면으로 돌아가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-[var(--color-accent)] text-3xl font-bold text-white shadow-sm">
            K
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-[var(--color-accent)]">
              Security
            </p>
            <h1 className="mt-1 text-4xl font-semibold text-[var(--color-text-h)]">
              KIYO
            </h1>
          </div>
        </header>

        <section className="rounded-4xl border border-[var(--color-border)] bg-[var(--color-bg)] p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-[var(--color-accent)]">
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
                        className="mt-4 p-3 rounded-lg border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 text-[var(--color-error)] text-sm dark:border-[var(--color-error)]/40 dark:bg-[var(--color-error)]/20 dark:text-[var(--color-error)]"
                        role="alert"
                      >
                        {error}
                      </div>
                    )}

          <div className="mt-6 space-y-4">
            {/* Biometric login button */}
            {showBiometricButton && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleBiometricLogin}
                disabled={isVerifying}
                className="!w-full !flex !items-center !justify-center !gap-2 !rounded-full !border !border-[var(--color-border)] !bg-[var(--color-bg)] !px-5 !py-3 !text-sm !font-medium !text-[var(--color-text)] hover:!bg-[var(--color-code-bg)]"
                label={
                  <span className="flex items-center gap-2">
                    <Fingerprint className="h-4 w-4" />
                    {biometryAvailable.type === "face"
                      ? "Face ID로 로그인"
                      : "지문으로 로그인"}
                  </span>
                }
              />
            )}

            {/* PIN input */}
            <div>
              <label
                htmlFor="pin"
                className="block text-sm font-medium text-[var(--color-text)]"
              >
                PIN 번호
              </label>
              <Input
                id="pin"
                size="lg"
                type="password"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyPin()}
                placeholder="4~20자 PIN"
                maxLength={20}
                autoFocus
                // Q5-1 결정: isVerifying 동안 input은 평소 상태 유지. spinner는 Button에만.
              />
              {/* PIN 강도 표시는 의도적으로 생략 — 이 화면은 기존 PIN 인증용이며
                  강도 평가는 신규/변경 PIN 입력에서만 의미 있음 (CreateVaultPage, PinChangeDialog). */}
            </div>
            <Button
              type="button"
              variant="primary"
              onClick={handleVerifyPin}
              loading={isVerifying}
              className="!w-full !rounded-full !bg-[var(--color-accent)] !px-5 !py-3 !text-sm !font-semibold !text-white"
              label={isVerifying ? "확인 중..." : "확인"}
            />
          </div>
        </section>
    </PageShell>
  );
};

export default Auth;
