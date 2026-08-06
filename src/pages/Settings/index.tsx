import { useState } from "react";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { AutofillSettings } from "./components/AutofillSettings";
import FileCreateDialog from "@/components/dialogs/FileCreateDialog";
import FileOpenDialog from "@/components/dialogs/FileOpenDialog";
import PinChangeDialog from "@/components/dialogs/PinChangeDialog";
import BottomTabs from "@/components/BottomTabs";
import { SecuritySection } from "./components/SecuritySection";
import { UISection } from "./components/UISection";
import { DataSection } from "./components/DataSection";
import { AppInfoDialog } from "./components/AppInfoDialog";
import { useSettingsActions } from "./hooks/useSettingsActions";
import { useFileAuthGuard } from "@/hooks/useFileAuthGuard";

const Settings = () => {
  const [securityMessage, setSecurityMessage] = useState("");
  const [uiMessage, setUiMessage] = useState("");
  const [dataMessage, setDataMessage] = useState("");
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showPinChangeDialog, setShowPinChangeDialog] = useState(false);
  const [showAppInfoDialog, setShowAppInfoDialog] = useState(false);
  const { activeFileName: fileName } = useSessionStore();
  const { theme, toggleTheme, fontSize, setFontSize, autoLockTimeout, setAutoLockTimeout } = useSettingsStore();
  const [isEncrypted, setIsEncrypted] = useState(false);

  const {
    handleBackup,
    handleRestore,
    handlePinChange,
    handleFileChange,
    isAndroid,
  } = useSettingsActions();

  // 파일/인증 상태 체크 및 네비게이션 (훅으로 분리)
  useFileAuthGuard({
    skipRedirect: false,
  });

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

  const handlePinChangeConfirm = async (newPin: string) => {
    const newEncrypted = await handlePinChange(newPin);
    setSecurityMessage(isEncrypted ? "PIN이 변경되었습니다." : "PIN이 설정되었습니다. 데이터가 암호화되었습니다.");
    setIsEncrypted(newEncrypted);
    setShowPinChangeDialog(false);
  };

  const handleAutoLockChange = (value: string) => {
    if (!isEncrypted) {
      setSecurityMessage("암호화된 파일에서만 자동잠금을 설정할 수 있습니다. PIN을 설정해 파일을 암호화하세요.");
      return;
    }
    setAutoLockTimeout(value as "none" | "1m" | "10m" | "30m");
    setSecurityMessage(
      value === "none"
        ? "자동잠금이 비활성화되었습니다."
        : `자동잠금: ${value === "1m" ? "1분" : value === "10m" ? "10분" : "30분"}로 설정되었습니다.`,
    );
  };

  const handleThemeToggle = () => {
    toggleTheme();
    setUiMessage(
      theme === "dark"
        ? "다크모드가 해제되었습니다."
        : "다크모드가 적용되었습니다.",
    );
  };

  const handleFontSizeChange = (size: "small" | "medium" | "large") => {
    setFontSize(size);
    setUiMessage(`글자크기: ${size === "small" ? "작게" : size === "medium" ? "보통" : "크게"}로 변경되었습니다.`);
  };

  return (
    <main className="min-h-svh bg-gradient-to-b from-accent-bg to-[var(--color-bg)] px-5 py-8 pb-28">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold text-[var(--color-text-h)]">
            Settings
          </h1>
        </header>

        <section className="space-y-4">
          <SecuritySection
            isEncrypted={isEncrypted}
            autoLockTimeout={autoLockTimeout}
            onPinChangeClick={() => setShowPinChangeDialog(true)}
            onAutoLockChange={handleAutoLockChange}
            securityMessage={securityMessage}
          />

          <UISection
            theme={theme}
            fontSize={fontSize}
            onThemeToggle={handleThemeToggle}
            onFontSizeChange={handleFontSizeChange}
            uiMessage={uiMessage}
          />

          <DataSection
            onBackupClick={() => setShowBackupDialog(true)}
            onRestoreClick={() => setShowRestoreDialog(true)}
            dataMessage={dataMessage}
          />

          {isAndroid && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">
                Autofill
              </h3>
              <AutofillSettings onMessage={setSecurityMessage} />
            </div>
          )}
        </section>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
            <span>파일변경</span>
            <button
              type="button"
              className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-accent)]/80"
              onClick={handleFileChange}
            >
              이동
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
            <span>앱 정보</span>
            <button
              type="button"
              onClick={() => setShowAppInfoDialog(true)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              보기
            </button>
          </div>
        </div>

        <AppInfoDialog
          open={showAppInfoDialog}
          onClose={() => setShowAppInfoDialog(false)}
        />
      </div>

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
      <PinChangeDialog
        open={showPinChangeDialog}
        onClose={() => setShowPinChangeDialog(false)}
        onConfirm={handlePinChangeConfirm}
        isEncrypted={isEncrypted}
      />

      <BottomTabs />
    </main>
  );
};

export default Settings;