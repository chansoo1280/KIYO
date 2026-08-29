import { useState, useCallback } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useNavigate } from "react-router-dom";
import { backupDataFile, openImportedDataFile, isKiyoFile } from "@/database/fileStorage";
import { fileTable } from "@/database/fileTable";
import { pickBackupFolder } from "@/database/fileExport";
import FileCreateDialog from "@/components/dialogs/FileCreateDialog";
import FileOpenDialog from "@/components/dialogs/FileOpenDialog";
import { isNativeFileStorageAvailable } from "@/database/fileExport";

export function DataSection() {
  const [dataMessage, setDataMessage] = useState("");
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showAutoBackupFolderDialog, setShowAutoBackupFolderDialog] = useState(false);
  const { activeFileName: fileName, cryptoKey } = useSessionStore();
  const { autoBackupEnabled, autoBackupUri, setAutoBackupEnabled, setAutoBackupUri } = useSettingsStore();
  const navigate = useNavigate();

  const nativeAvailable = isNativeFileStorageAvailable();
  
  // 자동 백업은 암호화된 볼트에서만 가능 (cryptoKey가 있을 때만)
  const isEncryptedVault = !!cryptoKey;

  const handleBackup = useCallback(async ({
    fileName: backupFileName,
    encrypted,
    pin,
  }: {
    fileName: string;
    encrypted: boolean;
    pin: string;
  }) => {
    const { activeFileName: currentActiveFileName } = await fileTable.getActiveFileInfo();
    const exists = currentActiveFileName === backupFileName;
    if (exists) {
      const overwrite = window.confirm(
        `${backupFileName} 파일이 이미 존재합니다. 덮어쓰시겠습니까?`,
      );

      if (!overwrite) {
        return;
      }
    }
    if (encrypted && !pin) {
      throw new Error("핀번호를 입력하세요");
    }
    await backupDataFile(backupFileName, pin);
  }, []);

  const handleRestore = useCallback(async ({ file, pin }: { file: File; pin: string }) => {
    const data = await openImportedDataFile(await file.text(), pin, file.name);
    if (!data) {
      throw new Error("PIN 번호가 올바르지 않습니다.");
    }

    if (!isKiyoFile(data)) {
      throw new Error("지원하지 않는 파일 형식입니다.");
    }
    try {
      navigate("/accounts", { replace: true });
    } catch (cause) {
      throw new Error(cause instanceof Error ? cause.message : "파일을 복원하지 못했습니다.", { cause });
    }
  }, [navigate]);

  const handleBackupClick = () => {
    setDataMessage("");
    setShowBackupDialog(true);
  };

  const handleRestoreClick = () => {
    setDataMessage("");
    setShowRestoreDialog(true);
  };

  const handleAutoBackupToggle = async (enabled: boolean) => {
    if (enabled && !autoBackupUri) {
      // 폴더 선택 다이얼로그 표시
      setShowAutoBackupFolderDialog(true);
    } else if (!enabled) {
      // 해제 시 URI도 함께 비움
      await setAutoBackupUri(null);
      await setAutoBackupEnabled(false);
    } else {
      await setAutoBackupEnabled(enabled);
    }
  };

  const handlePickFolderConfirm = async () => {
    const result = await pickBackupFolder();
    if (result.success && result.uri) {
      await setAutoBackupUri(result.uri);
      await setAutoBackupEnabled(true);
      setDataMessage("자동 백업 위치가 설정되었습니다.");
      // 즉시 첫 백업 수행
      try {
        const { persistVaultSnapshot } = await import("@/database/db");
        const { useSessionStore } = await import("@/store/sessionStore");
        const { activeFileName, cryptoKey, salt } = useSessionStore.getState();
        if (activeFileName && cryptoKey && salt) {
          await persistVaultSnapshot({ activeFileName, cryptoKey, salt });
          setDataMessage("자동 백업 위치가 설정되고 첫 백업이 완료되었습니다.");
        }
      } catch (e) {
        console.warn("Initial auto-backup failed:", e);
      }
    } else {
      // 사용자 취소 시 토글도 false로
      await setAutoBackupEnabled(false);
    }
    setShowAutoBackupFolderDialog(false);
  };

  const handleBackupConfirm = async (options: { fileName: string; encrypted: boolean; pin: string }) => {
    await handleBackup(options);
    setDataMessage("백업 파일을 저장했습니다.");
    setShowBackupDialog(false);
  };

  const handleRestoreConfirm = async (options: { file: File; pin: string }) => {
    await handleRestore(options);
    setDataMessage(`${options.file.name} 파일을 복원했습니다.`);
    setShowRestoreDialog(false);
  };

  // 자동 백업 상태 텍스트
  const getAutoBackupStatus = () => {
    if (!nativeAvailable) {
      return "자동 백업: 지원 안 함 (웹)";
    } else if (!isEncryptedVault) {
      return "자동 백업: 암호화된 볼트에서만 가능";
    } else if (autoBackupEnabled && autoBackupUri) {
      // URI 표시 (너무 길면 앞뒤만)
      const displayUri = autoBackupUri.length > 50
        ? autoBackupUri.substring(0, 30) + "..." + autoBackupUri.substring(autoBackupUri.length - 15)
        : autoBackupUri;
      return `자동 백업: 켜짐 (${displayUri})`;
    } else if (autoBackupEnabled && !autoBackupUri) {
      return "자동 백업: 위치 미설정";
    } else {
      return "자동 백업: 꺼짐";
    }
  };

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">
        Data
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <span>백업</span>
          <button
            type="button"
            onClick={handleBackupClick}
            className="rounded-full bg-[var(--color-accent-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)]"
          >
            저장
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <span>복원</span>
          <button
            type="button"
            onClick={handleRestoreClick}
            className="rounded-full bg-[var(--color-accent-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)]"
          >
            불러오기
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <span>{getAutoBackupStatus()}</span>
          <button
            type="button"
            onClick={() => handleAutoBackupToggle(!autoBackupEnabled)}
            disabled={!nativeAvailable || !isEncryptedVault}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              autoBackupEnabled
                ? "bg-[var(--color-destructive-bg)] text-[var(--color-destructive)]"
                : "bg-[var(--color-muted)] text-[var(--color-text-muted)]"
            } ${!nativeAvailable || !isEncryptedVault ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {autoBackupEnabled ? "해제" : "켜기"}
          </button>
        </div>
      </div>
      {dataMessage && (
        <p className="text-sm font-medium text-[var(--color-accent)]">
          {dataMessage}
        </p>
      )}

      <FileCreateDialog
        open={showBackupDialog}
        title="백업 파일 저장"
        description="백업 JSON 파일의 이름을 입력하세요."
        defaultValue={`${(fileName ?? "kiyo").replace(/\.json$/, "")}-backup.json`}
        confirmLabel="저장"
        onClose={() => setShowBackupDialog(false)}
        onConfirm={handleBackupConfirm}
      />
      <FileOpenDialog
        open={showRestoreDialog}
        onClose={() => setShowRestoreDialog(false)}
        onConfirm={handleRestoreConfirm}
      />
      {showAutoBackupFolderDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--color-bg)] rounded-2xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-2">자동 백업 폴더 선택</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              자동 백업이 저장될 폴더를 선택하세요. 한 번 선택하면 이후 자동으로 백업됩니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowAutoBackupFolderDialog(false)}
                className="rounded-full bg-[var(--color-muted)] px-4 py-2 text-sm font-semibold text-[var(--color-text)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handlePickFolderConfirm}
                className="rounded-full bg-[var(--color-accent-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)]"
              >
                폴더 선택
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}