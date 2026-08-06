import { useCallback } from "react";
import { backupDataFile, openImportedDataFile, changePin, closeDataFile, isKiyoFile } from "@/database/fileStorage";
import { fileTable } from "@/database/fileTable";
import { useSessionStore } from "@/store/sessionStore";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

export function useSettingsActions() {
  const navigate = useNavigate();
  const { activeFileName, cryptoKey } = useSessionStore();

  const handleBackup = useCallback(async ({
    fileName,
    encrypted,
    pin,
  }: {
    fileName: string;
    encrypted: boolean;
    pin: string;
  }) => {
    const { activeFileName: currentActiveFileName } = await fileTable.getActiveFileInfo();
    const exists = currentActiveFileName === fileName;
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
      navigate("/list", { replace: true });
    } catch (cause) {
      throw new Error(cause instanceof Error ? cause.message : "파일을 복원하지 못했습니다.", { cause });
    }
  }, [navigate]);

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

  const handleFileChange = useCallback(async () => {
    await closeDataFile();
    navigate("/", { state: { selectFile: true } });
  }, [navigate]);

  const isAndroid = Capacitor.getPlatform() === "android";

  return {
    handleBackup,
    handleRestore,
    handlePinChange,
    handleFileChange,
    isAndroid,
    activeFileName,
  };
}