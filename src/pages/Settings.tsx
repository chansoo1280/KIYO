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
import FileCreateDialog from "@/components/FileCreateDialog";
import FileOpenDialog from "@/components/FileOpenDialog";
import PinChangeDialog from "@/components/PinChangeDialog";
import { useSettingsStore } from "@/store/settingsStore";
import { useBiometricAuthStore } from "@/store/biometricAuthStore";
import type { FontSize } from "@/models/account";
import { AutofillSettings } from "@/components/AutofillSettings";
import { fileTable } from "@/database/fileTable";

const Settings = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showPinChangeDialog, setShowPinChangeDialog] = useState(false);
  const { activeFileName: fileName, cryptoKey } = useSessionStore(
    (state) => state,
  );
  const { theme, toggleTheme, fontSize, setFontSize } = useSettingsStore();
  const { isAvailable, biometricEnabled, setBiometricEnabled, enableBiometric, disableBiometric } =
    useBiometricAuthStore();
  const [isEncrypted] = useState(false);
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
    setMessage("백업 파일을 저장했습니다.");
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
      setMessage(`${file.name} 파일을 복원했습니다.`);
      navigate("/list", { replace: true });
    } catch (cause) {
      setMessage(
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
      setMessage("PIN이 변경되었습니다.");
    } else {
      // 암호화되지 않은 파일: 새 PIN으로 암호화 설정
      await changePin(newPin);
      setMessage("PIN이 설정되었습니다. 데이터가 암호화되었습니다.");
    }

    // PIN 변경 시 생체인증 초기화 (보안상 PIN 변경 시 생체인증 재설정 필요)
    if (biometricEnabled) {
      try {
        await disableBiometric();
        setBiometricEnabled(false);
        setMessage((prev) => `${prev} 생체인증이 초기화되었습니다.`);
      } catch (error) {
        console.error("생체인증 초기화 실패:", error);
        setMessage((prev) => `${prev} (생체인증 초기화 실패)`);
      }
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
              {isAvailable && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
                  <span>생체인증 사용</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={biometricEnabled}
                    onClick={async () => {
                      if (!biometricEnabled) {
                        // 생체인증 켜기 - cryptoKey 필요
                        if (!cryptoKey) {
                          setMessage(
                            "암호화 키가 없습니다. PIN을 입력해주세요.",
                          );
                          return;
                        }
                        try {
                          await enableBiometric({ cryptoKey });
                          setBiometricEnabled(true);
                          setMessage("생체인증이 활성화되었습니다.");
                        } catch (error) {
                          setMessage(
                            error instanceof Error
                              ? error.message
                              : "생체인증 활성화에 실패했습니다.",
                          );
                        }
                      } else {
                        // 생체인증 끄기
                        try {
                          await disableBiometric();
                          setBiometricEnabled(false);
                          setMessage("생체인증이 비활성화되었습니다.");
                        } catch (error) {
                          setMessage(
                            error instanceof Error
                              ? error.message
                              : "생체인증 비활성화에 실패했습니다.",
                          );
                        }
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 ${
                      biometricEnabled
                        ? "bg-[var(--color-accent)]"
                        : "bg-[var(--color-border)]"
                    }`}
                    aria-label={
                      biometricEnabled ? "생체인증 켜짐" : "생체인증 꺼짐"
                    }
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-[var(--color-bg)] transition-transform ${
                        biometricEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              )}
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
                <span>템플릿 관리</span>
                <button
                  type="button"
                  onClick={() => navigate("/templates")}
                  className="rounded-full bg-[var(--color-accent-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)]"
                >
                  관리
                </button>
              </div>
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

          {Capacitor.getPlatform() === "android" && (
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
