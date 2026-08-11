import { useState, useCallback } from "react";
import type { AutoLockTimeout } from "@/store/settingsStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useSessionStore } from "@/store/sessionStore";
import { fileTable } from "@/database/fileTable";
import { changePin } from "@/database/fileStorage";
import { PinChangeDialog } from "./PinChangeDialog";

export function SecuritySection() {
  const [securityMessage, setSecurityMessage] = useState("");
  const [showPinChangeDialog, setShowPinChangeDialog] = useState(false);
  const { cryptoKey } = useSessionStore();
  const { autoLockTimeout, setAutoLockTimeout } = useSettingsStore();
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
    const { activeFileName, encrypted } = await fileTable.getActiveFileInfo();
    if (!activeFileName) {
      throw new Error("활성 데이터 파일이 없습니다.");
    }

    if (encrypted) {
      if (!cryptoKey) {
        throw new Error("암호화 키 정보가 없습니다.");
      }
      await changePin(newPin);
    } else {
      await changePin(newPin);
    }
    const { encrypted: newEncrypted } = await fileTable.getActiveFileInfo();
    return newEncrypted;
  }, [cryptoKey]);

  const handlePinChangeConfirm = async (newPin: string) => {
    await handlePinChange(newPin);
    setSecurityMessage(isEncrypted ? "PIN이 변경되었습니다." : "PIN이 설정되었습니다. 데이터가 암호화되었습니다.");
    setShowPinChangeDialog(false);
  };

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

      <PinChangeDialog
        open={showPinChangeDialog}
        onClose={() => setShowPinChangeDialog(false)}
        onConfirm={handlePinChangeConfirm}
        isEncrypted={isEncrypted}
      />
    </div>
  );
}