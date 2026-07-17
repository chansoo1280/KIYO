import BottomTabs from "../components/BottomTabs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import {
  backupDataFile,
  isKiyoFile,
  openImportedDataFile,
  changePin,
  closeDataFile,
} from "../database/fileStorage";
import { useSessionStore } from "../store/sessionStore";
import FileCreateDialog from "../components/FileCreateDialog";
import FileOpenDialog from "../components/FileOpenDialog";
import PinChangeDialog from "../components/PinChangeDialog";
import { useAccountStore } from "../store/accountStore";
import { useSettingsStore } from "../store/settingsStore";
import type { FontSize } from "../models/account";
import { useAutofill } from "../hooks/useAutofill";
import { AutofillSettings } from "../components/AutofillSettings";

const CLIPBOARD_TIMEOUT_OPTIONS = [
  { value: 0, label: "끄기" },
  { value: 15000, label: "15초" },
  { value: 30000, label: "30초" },
  { value: 60000, label: "60초" },
] as const;

const Settings = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showPinChangeDialog, setShowPinChangeDialog] = useState(false);
  const { activeFileName, cryptoKey, salt } = useSessionStore((state) => state);
  const {
    theme,
    toggleTheme,
    fontSize,
    setFontSize,
    clipboardAutoClearTimeout,
    setClipboardAutoClearTimeout,
  } = useSettingsStore();
  const defaultBackupFileName = (() => {
    const fileName = activeFileName?.replace(/\.json$/, "") ?? "kiyo";
    const isBackup = /-backup$/i.test(fileName);
    return `${fileName}${isBackup ? "" : "-backup"}.json`;
  })();
  const checkFileAndNavigate = async () => {
    if (!activeFileName) {
      navigate("/", {
        replace: true,
      });
      return;
    } else if (!!salt && !cryptoKey) {
      navigate("/auth", {
        replace: true,
      });
      return;
    }
  };
  useEffect(() => {
    checkFileAndNavigate();
  }, []);
  const handleBackup = async ({
    fileName,
    encrypted,
    pin,
  }: {
    fileName: string;
    encrypted: boolean;
    pin: string;
  }) => {
    const exists = activeFileName === fileName;
    if (exists) {
      const overwrite = window.confirm(
        `${fileName} 파일이 이미 존재합니다. 덮어쓰시겠습니까?`,
      );

      if (!overwrite) {
        return;
      }
    }
    if (encrypted && !pin) {
      throw new Error("핀번호를 입력하세요");
    }
    await backupDataFile(fileName, pin);
    setMessage("백업 파일을 저장했습니다.");
    setShowBackupDialog(false);
  };

  const handleRestore = async ({ file, pin }: { file: File; pin: string }) => {
    const data = await openImportedDataFile(await file.text(), pin);
    if (!data) {
      throw new Error("PIN 번호가 올바르지 않습니다.");
    }

    if (!isKiyoFile(data)) {
      throw new Error("지원하지 않는 파일 형식입니다.");
    }
    try {
      setMessage(`${file.name} 파일을 복원했습니다.`);
      navigate("/list", { replace: true });
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "파일을 복원하지 못했습니다.",
      );
    }
  };

  const isEncrypted = !!salt;
  useAutofill();

  const handlePinChange = async (newPin: string) => {
    if (!activeFileName) {
      throw new Error("활성 데이터 파일이 없습니다.");
    }

    if (isEncrypted) {
      // 암호화된 파일: 현재 PIN 검증 후 변경
      if (!cryptoKey) {
        throw new Error("암호화 키 정보가 없습니다.");
      }
      await changePin(newPin);
      setMessage("PIN이 변경되었습니다.");
    } else {
      // 암호화되지 않은 파일: 새 PIN으로 암호화 설정
      await changePin(newPin);
      setMessage("PIN이 설정되었습니다. 데이터가 암호화되었습니다.");
    }
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
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">
              Security
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
                <span>PIN</span>
                <button
                  type="button"
                  onClick={() => setShowPinChangeDialog(true)}
                  className="rounded-full bg-[var(--color-accent-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)]"
                >
                  {isEncrypted ? "변경" : "설정"}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
                <span>자동잠금</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
                <span>클립보드 자동 초기화</span>
                <select
                  value={clipboardAutoClearTimeout}
                  onChange={(e) =>
                    setClipboardAutoClearTimeout(Number(e.target.value))
                  }
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                  aria-label="클립보드 자동 초기화 시간 선택"
                >
                  {CLIPBOARD_TIMEOUT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">
              UI
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
                <span>다크모드</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={theme === "dark"}
                  onClick={toggleTheme}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 ${
                    theme === "dark"
                      ? "bg-[var(--color-accent)]"
                      : "bg-[var(--color-border)]"
                  }`}
                  aria-label={
                    theme === "dark" ? "다크모드 켜짐" : "다크모드 꺼짐"
                  }
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-bg)] transition-transform ${
                      theme === "dark" ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
                <span>글자크기</span>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value as FontSize)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                  aria-label="글자 크기 선택"
                >
                  <option value="small">작게</option>
                  <option value="medium">보통</option>
                  <option value="large">크게</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">
              Data
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
                <span>백업</span>
                <button
                  type="button"
                  onClick={() => setShowBackupDialog(true)}
                  className="rounded-full bg-[var(--color-accent-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)]"
                >
                  저장
                </button>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
                <span>복원</span>
                <button
                  type="button"
                  onClick={() => setShowRestoreDialog(true)}
                  className="rounded-full bg-[var(--color-accent-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)]"
                >
                  불러오기
                </button>
              </div>
              {/* <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
                <span>초기화</span>
              </div> */}
            </div>
          </div>

          {Capacitor.getPlatform() === 'android' && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">
                Autofill
              </h3>
              <AutofillSettings onMessage={setMessage} />
            </div>
          )}

          {message && (
            <p className="text-sm font-medium text-[var(--color-text)]">
              {message}
            </p>
          )}
        </section>

        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
            <span>파일변경</span>
            <button
              type="button"
              className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-accent)]/80"
              onClick={async () => {
                await closeDataFile();
                useAccountStore.getState().resetToInitial();
                navigate("/", { state: { selectFile: true } });
              }}
            >
              이동
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
            <span>앱 정보</span>
          </div>
        </div>
      </div>

      <FileCreateDialog
        open={showBackupDialog}
        title="백업 파일 저장"
        description="백업 JSON 파일의 이름을 입력하세요."
        defaultValue={defaultBackupFileName}
        confirmLabel="저장"
        onClose={() => setShowBackupDialog(false)}
        onConfirm={handleBackup}
      />
      <FileOpenDialog
        open={showRestoreDialog}
        onClose={() => setShowRestoreDialog(false)}
        onConfirm={handleRestore}
      />
      <PinChangeDialog
        open={showPinChangeDialog}
        onClose={() => setShowPinChangeDialog(false)}
        onConfirm={handlePinChange}
        isEncrypted={isEncrypted}
      />

      <BottomTabs />
    </main>
  );
};

export default Settings;
