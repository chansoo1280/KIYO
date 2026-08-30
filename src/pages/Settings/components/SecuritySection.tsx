import { useState, useCallback } from "react";
import type { AutoLockTimeout } from "@/store/settingsStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useSessionStore } from "@/store/sessionStore";
import { fileTable } from "@/database/fileTable";
import { changePin } from "@/database/fileStorage";
import { PinChangeDialog } from "./PinChangeDialog";
import { SecureKey } from "@/plugins/kiyosecurekey";
import { exportKey } from "@/crypto/encryption";
import { toBase64 } from "@/crypto/crypto.utils";

export function SecuritySection() {
  const [securityMessage, setSecurityMessage] = useState("");
  const [showPinChangeDialog, setShowPinChangeDialog] = useState(false);
  const [showBiometricSetupDialog, setShowBiometricSetupDialog] = useState(false);
  const { cryptoKey } = useSessionStore();
  const { autoLockTimeout, setAutoLockTimeout, biometricEnabled, setBiometricEnabled } = useSettingsStore();
  const isEncrypted = !!cryptoKey;

  const handlePinChangeClick = () => {
    setSecurityMessage("");
    setShowPinChangeDialog(true);
  };

  const handleAutoLockChange = useCallback((value: string) => {
    if (!isEncrypted) {
      setSecurityMessage("암호화된 파일에서만 자동잠금을 설정할 수 있습니다. PIN을 설정해 파일을 암호화하세요.");
      return;
    }
    setAutoLockTimeout(value as AutoLockTimeout);
    setSecurityMessage(
      value === "none"
        ? "자동잠금이 비활성화되었습니다."
        : `자동잠금: ${value === "1m" ? "1분" : value === "10m" ? "10분" : "30분"}로 설정되었습니다.`,
    );
  }, [isEncrypted, setAutoLockTimeout]);

  const handlePinChange = useCallback(async (newPin: string) => {
    const activeFileName = useSessionStore.getState().activeFileName;
    if (!activeFileName) {
      throw new Error("활성 데이터 파일이 없습니다.");
    }

    const { encrypted } = await fileTable.getFileInfo(activeFileName);
    if (encrypted) {
      if (!cryptoKey) {
        throw new Error("암호화 키 정보가 없습니다.");
      }
      await changePin(activeFileName, newPin);
    } else {
      await changePin(activeFileName, newPin);
    }
    const { encrypted: newEncrypted } = await fileTable.getFileInfo(activeFileName);
    return newEncrypted;
  }, [cryptoKey]);

  const handlePinChangeConfirm = async (newPin: string) => {
    await handlePinChange(newPin);
    setSecurityMessage(isEncrypted ? "PIN이 변경되었습니다." : "PIN이 설정되었습니다. 데이터가 암호화되었습니다.");
    setShowPinChangeDialog(false);
  };

  const checkBiometryAvailability = useCallback(async () => {
    try {
      const result = await SecureKey.isBiometryAvailable();
      return result;
    } catch (err) {
      console.warn("Biometry availability check failed:", err instanceof Error ? err.message : String(err), err);
      return { available: false, type: "none" as const };
    }
  }, []);

  const handleBiometricToggle = useCallback(async (enabled: boolean) => {
    if (!isEncrypted) {
      setSecurityMessage("암호화된 파일에서만 생체인증을 사용할 수 있습니다.");
      return;
    }

    if (enabled) {
      // Check biometry availability first
      const bioResult = await checkBiometryAvailability();
      if (!bioResult.available) {
        setSecurityMessage("생체인증 하드웨어가 없거나 등록된 생체정보가 없습니다.");
        return;
      }

      // Show confirmation dialog before enabling
      setShowBiometricSetupDialog(true);
    } else {
      // Disable biometric - delete stored key
      const activeFileName = useSessionStore.getState().activeFileName;
      if (activeFileName) {
        try {
          await SecureKey.deleteKey({ vaultId: activeFileName });
          await setBiometricEnabled(false);
          setSecurityMessage("생체인증이 비활성화되었습니다. 저장된 키가 삭제되었습니다.");
        } catch (err) {
          console.error("Failed to delete biometric key:", err instanceof Error ? err.message : String(err), err);
          setSecurityMessage("생체인증 비활성화에 실패했습니다.");
        }
      }
    }
  }, [isEncrypted, checkBiometryAvailability, setBiometricEnabled]);

  const handleBiometricSetupConfirm = useCallback(async () => {
    if (!cryptoKey) {
      setSecurityMessage("암호화 키가 없습니다. PIN으로 먼저 잠금 해제하세요.");
      setShowBiometricSetupDialog(false);
      return;
    }

    const activeFileName = useSessionStore.getState().activeFileName;
    if (!activeFileName) {
      setSecurityMessage("파일 정보가 없습니다.");
      setShowBiometricSetupDialog(false);
      return;
    }

    try {
      // Export cryptoKey to base64 for storage
      const keyData = await exportKey(cryptoKey);
      const keyBase64 = toBase64(keyData);

      // Store with biometric protection
      await SecureKey.storeKey({ vaultId: activeFileName, key: keyBase64 });
      await setBiometricEnabled(true);
      setSecurityMessage("생체인증이 활성화되었습니다.");
    } catch (err) {
      console.error("Biometric setup failed:", err instanceof Error ? err.message : String(err), err);
      setSecurityMessage("생체인증 설정에 실패했습니다.");
    } finally {
      setShowBiometricSetupDialog(false);
    }
  }, [cryptoKey, setBiometricEnabled]);

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">
        Security
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <span>PIN</span>
          <button
            type="button"
            onClick={handlePinChangeClick}
            className="rounded-full bg-[var(--color-accent-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)]"
          >
            {isEncrypted ? "변경" : "설정"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <span>자동잠금</span>
          <select
            value={autoLockTimeout}
            onChange={(e) => handleAutoLockChange(e.target.value)}
            onPointerDown={(e) => {
              if (!isEncrypted) {
                e.preventDefault();
              }
            }}
            disabled={!isEncrypted}
            className={`rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent ${
              !isEncrypted
                ? "opacity-50 cursor-not-allowed text-[var(--color-text-muted)]"
                : "text-[var(--color-text)]"
            }`}
            aria-label="자동잠금 시간 선택"
          >
            <option value="none">미사용</option>
            <option value="1m">1분</option>
            <option value="10m">10분</option>
            <option value="30m">30분</option>
          </select>
        </div>
      </div>
      {securityMessage && (
        <p className="text-sm font-medium text-[var(--color-accent)]">
          {securityMessage}
        </p>
      )}

      <div className="space-y-3 mt-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <span>생체인증 로그인</span>
          <button
            type="button"
            onClick={() => handleBiometricToggle(!biometricEnabled)}
            disabled={!isEncrypted}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              biometricEnabled
                ? "bg-[var(--color-accent-bg)] text-[var(--color-accent)]"
                : "bg-[var(--color-bg)] text-[var(--color-text-muted)]"
            } ${!isEncrypted ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {biometricEnabled ? "사용 중" : "사용 안 함"}
          </button>
        </div>
      </div>

      <PinChangeDialog
        open={showPinChangeDialog}
        onClose={() => setShowPinChangeDialog(false)}
        onConfirm={handlePinChangeConfirm}
        isEncrypted={isEncrypted}
        fileName={useSessionStore.getState().activeFileName ?? ""}
      />

      {showBiometricSetupDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="biometric-setup-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-bg)] p-6 shadow-xl">
            <h3 id="biometric-setup-title" className="text-lg font-semibold text-[var(--color-text-h)]">
              생체인증 등록
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text)]">
              현재 PIN으로 잠금 해제된 상태에서 생체인증을 등록합니다.
              생체인증 프롬프트가 표시되면 지문 또는 얼굴을 인증해 주세요.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setShowBiometricSetupDialog(false)}
                className="flex-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] py-2 text-sm font-medium text-[var(--color-text)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleBiometricSetupConfirm}
                className="flex-1 rounded-full bg-[var(--color-accent)] py-2 text-sm font-semibold text-white"
              >
                등록하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}