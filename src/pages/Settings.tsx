import BottomTabs from "@/components/BottomTabs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import {
  backupDataFile,
  isKiyoFile,
  openImportedDataFile,
  changePin,
  closeDataFile,
} from "@/database/fileStorage";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore, type AutoLockTimeout } from "@/store/settingsStore";
import type { FontSize } from "@/models/account";
import { AutofillSettings } from "@/components/AutofillSettings";
import { fileTable } from "@/database/fileTable";
import FileCreateDialog from "@/components/FileCreateDialog";
import FileOpenDialog from "@/components/FileOpenDialog";
import PinChangeDialog from "@/components/PinChangeDialog";

const Settings = () => {
  const navigate = useNavigate();
  const [securityMessage, setSecurityMessage] = useState("");
  const [uiMessage, setUiMessage] = useState("");
  const [dataMessage, setDataMessage] = useState("");
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showPinChangeDialog, setShowPinChangeDialog] = useState(false);
  const [showAppInfoDialog, setShowAppInfoDialog] = useState(false);
  const { activeFileName: fileName, cryptoKey } = useSessionStore();
  const { theme, toggleTheme, fontSize, setFontSize, autoLockTimeout, setAutoLockTimeout } = useSettingsStore();
  const [isEncrypted, setIsEncrypted] = useState(false);

  useEffect(() => {
    const checkEncryption = async () => {
      const { encrypted } = await fileTable.getActiveFileInfo();
      setIsEncrypted(encrypted);
    };
    checkEncryption();
  }, [fileName, cryptoKey]);

  const defaultBackupFileName = (() => {
    const isBackup = /-backup$/i.test(
      fileName?.replace(/\.json$/, "") ?? "kiyo",
    );
    return `${fileName}${isBackup ? "" : "-backup"}.json`;
  })();

  const checkFileAndNavigate = async () => {
    // const { activeFileName, encrypted } = await fileTable.getActiveFileInfo();
    // setIsEncrypted(encrypted);
    // if (!activeFileName) {
    //   navigate("/", {
    //     replace: true,
    //   });
    //   return;
    // } else if (encrypted) {
    //   navigate("/auth", {
    //     replace: true,
    //   });
    //   return;
    // }
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
    const { activeFileName } = await fileTable.getActiveFileInfo();
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
    setDataMessage("백업 파일을 저장했습니다.");
    setShowBackupDialog(false);
  };

  const handleRestore = async ({ file, pin }: { file: File; pin: string }) => {
    const data = await openImportedDataFile(await file.text(), pin, file.name);
    if (!data) {
      throw new Error("PIN 번호가 올바르지 않습니다.");
    }

    if (!isKiyoFile(data)) {
      throw new Error("지원하지 않는 파일 형식입니다.");
    }
    try {
      setDataMessage(`${file.name} 파일을 복원했습니다.`);
      navigate("/list", { replace: true });
    } catch (cause) {
      setDataMessage(
        cause instanceof Error ? cause.message : "파일을 복원하지 못했습니다.",
      );
    }
  };

  const handlePinChange = async (newPin: string) => {
    const { activeFileName, encrypted } = await fileTable.getActiveFileInfo();
    if (!activeFileName) {
      throw new Error("활성 데이터 파일이 없습니다.");
    }

    if (encrypted) {
      // 암호화된 파일: 현재 PIN 검증 후 변경
      if (!cryptoKey) {
        throw new Error("암호화 키 정보가 없습니다.");
      }
      await changePin(newPin);
      setSecurityMessage("PIN이 변경되었습니다.");
    } else {
      // 암호화되지 않은 파일: 새 PIN으로 암호화 설정
      await changePin(newPin);
      setSecurityMessage("PIN이 설정되었습니다. 데이터가 암호화되었습니다.");
    }
    // PIN 변경 후 암호화 상태 다시 확인
    const { encrypted: newEncrypted } = await fileTable.getActiveFileInfo();
    setIsEncrypted(newEncrypted);
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
                <select
                  value={autoLockTimeout}
                  onChange={(e) => {
                    setAutoLockTimeout(e.target.value as AutoLockTimeout);
                    setSecurityMessage(
                      e.target.value === "none"
                        ? "자동잠금이 비활성화되었습니다."
                        : `자동잠금: ${e.target.value === "1m" ? "1분" : e.target.value === "10m" ? "10분" : "30분"}로 설정되었습니다.`,
                    );
                  }}
                  onPointerDown={(e) => {
                    if (!isEncrypted) {
                      e.preventDefault();
                      setSecurityMessage("암호화된 파일에서만 자동잠금을 설정할 수 있습니다. PIN을 설정해 파일을 암호화하세요.");
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
                  onClick={() => {
                    toggleTheme();
                    setUiMessage(
                      theme === "dark"
                        ? "다크모드가 해제되었습니다."
                        : "다크모드가 적용되었습니다.",
                    );
                  }}
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
                  onChange={(e) => {
                    setFontSize(e.target.value as FontSize);
                    setUiMessage(
                      `글자크기: ${e.target.value === "small" ? "작게" : e.target.value === "medium" ? "보통" : "크게"}로 변경되었습니다.`,
                    );
                  }}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent"
                  aria-label="글자 크기 선택"
                >
                  <option value="small">작게</option>
                  <option value="medium">보통</option>
                  <option value="large">크게</option>
                </select>
              </div>
            </div>
            {uiMessage && (
              <p className="text-sm font-medium text-[var(--color-accent)]">
                {uiMessage}
              </p>
            )}
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
            {dataMessage && (
              <p className="text-sm font-medium text-[var(--color-accent)]">
                {dataMessage}
              </p>
            )}
          </div>

          {Capacitor.getPlatform() === "android" && (
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
              onClick={async () => {
                await closeDataFile();
                navigate("/", { state: { selectFile: true } });
              }}
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

      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity ${
          showAppInfoDialog ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setShowAppInfoDialog(false)}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-info-title"
      >
        <div
          className="relative w-full max-w-md mx-4 rounded-2xl bg-[var(--color-bg)] p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="app-info-title" className="text-xl font-semibold text-[var(--color-text-h)] mb-4">
            앱 정보
          </h2>
          <div className="space-y-3 text-sm text-[var(--color-text)]">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">버전</span>
              <span>0.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">개발자</span>
              <span>chansoo1280</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAppInfoDialog(false)}
            className="mt-6 w-full rounded-full bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent)]/80"
          >
            닫기
          </button>
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