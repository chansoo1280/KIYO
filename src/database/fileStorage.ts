import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { Account, Metadata, Setting, Template } from "../models/account";
import {
  createCryptoKey,
  decryptData,
  encryptData,
  isEncryptedKiyoFile,
  type EncryptedKiyoFile,
} from "../crypto/encryption";
import { fromBase64 } from "../crypto/crypto.utils";
import { useSessionStore } from "../store/sessionStore";
import {
  replaceDatabaseData,
  getDatabaseSnapshot,
  saveFileDataToDB,
} from "./db";
import { useAccountStore } from "../store/accountStore";
import { FileStorageError, FileStorageErrorCode } from "../errors/FileStorageError";

export interface KiyoDataFile {
  version: 1;
  fileName: string;
  updatedAt: number;
  accounts: Account[];
  templates: Template[];
  settings: Setting[];
  metadata: Metadata[];
}

export const isNativeFileStorageAvailable = () => Capacitor.isNativePlatform();

// Re-export isEncryptedKiyoFile for use in other modules
export { isEncryptedKiyoFile } from "../crypto/encryption";

export const normalizeDataFileName = (fileName: string) => {
  const trimmedName = fileName.trim() || "kiyo-data";
  return trimmedName.endsWith(".json") ? trimmedName : `${trimmedName}.json`;
};

export const isKiyoFile = (value: unknown): value is KiyoDataFile => {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<KiyoDataFile>;
  return (
    data.version === 1 &&
    (data.fileName === undefined || typeof data.fileName === "string") &&
    Array.isArray(data.accounts) &&
    Array.isArray(data.templates) &&
    Array.isArray(data.settings) &&
    Array.isArray(data.metadata)
  );
};
export const fileExists = async (fileName: string): Promise<boolean> => {
  if (!isNativeFileStorageAvailable()) return false;
  const { data } = await Filesystem.readFile({
    path: fileName,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
  });
  return !!data;
};

// Helper function to save data (encrypted or plain) to file and update security store
const saveDataFile = async (
  data: KiyoDataFile,
  normalizedFileName: string,
  pin?: string,
  shouldSetActiveFile: boolean = true,
): Promise<KiyoDataFile> => {
  if (!pin) {
    if (shouldSetActiveFile) {
      await useSessionStore.getState().setSession({
        fileName: normalizedFileName,
      });
    }
    await writeDataFile(data, normalizedFileName);
    // Save plain data to DB
    await saveFileDataToDB(normalizedFileName, data);
    return data;
  }

  // PIN -> CryptoKey 생성
  const { key, salt } = await createCryptoKey(pin);

  // 이후 자동 저장을 위해 메모리에 보관
  if (shouldSetActiveFile) {
    await useSessionStore.getState().setSession({
      fileName: normalizedFileName,
      cryptoKey: key,
      salt,
    });
  }

  // 데이터 암호화
  const encrypted = await encryptData(data, key, salt);

  // 파일 저장
  await writeDataFile(encrypted, normalizedFileName);

  // Save encrypted data to DB
  await saveFileDataToDB(normalizedFileName, encrypted, salt);

  return data;
};

export const createDataFile = async (
  fileName: string,
  pin?: string,
): Promise<KiyoDataFile> => {
  const normalizedFileName = normalizeDataFileName(fileName);

  const data: KiyoDataFile = {
    version: 1,
    fileName: normalizedFileName,
    updatedAt: Date.now(),
    accounts: [],
    templates: [],
    settings: [],
    metadata: [],
  };

  return saveDataFile(data, normalizedFileName, pin, true);
};

export const backupDataFile = async (
  fileName: string,
  pin: string,
): Promise<KiyoDataFile> => {
  const normalizedFileName = normalizeDataFileName(fileName);

  const data: KiyoDataFile = await getDatabaseSnapshot(normalizedFileName);

  return saveDataFile(data, normalizedFileName, pin, false);
};

export const openImportedDataFile = async (
  data: string,
  pin: string,
): Promise<KiyoDataFile | null> => {
  let parsedData: unknown;
  try {
    parsedData = JSON.parse(data);
  } catch (error) {
    // JSON 파싱 실패 시 null 반환 (기존 동작 유지 - 암호화/평문 파일 모두)
    return null;
  }

  // 기존 평문 파일 지원
  if (!isEncryptedKiyoFile(parsedData)) {
    if (!isKiyoFile(parsedData)) {
      return null;
    }
    try {
      await replaceDatabaseData(parsedData);
      const normalizedFileName = normalizeDataFileName(parsedData.fileName);
      await useSessionStore.getState().setSession({
        fileName: normalizedFileName,
      });
      // Save plain data to DB
      await saveFileDataToDB(normalizedFileName, parsedData);
      useAccountStore.getState().setAccounts(parsedData.accounts);
      return { ...parsedData, fileName: normalizedFileName };
    } catch (error) {
      return null;
    }
  }

  try {
    // 파일의 salt로 동일한 CryptoKey 생성
    if (!parsedData.salt || typeof parsedData.salt !== "string") {
      return null;
    }

    const salt = fromBase64(parsedData.salt);
    // Validate salt length (should be 16 bytes for AES-GCM)
    if (salt.byteLength !== 16) {
      return null;
    }

    const { key } = await createCryptoKey(pin, salt);

    // 이후 자동 저장을 위해 메모리에 보관

    const decrypted = await decryptData(parsedData, key);
    const normalizedFileName = normalizeDataFileName(decrypted.fileName);
    await useSessionStore
      .getState()
      .setSession({ fileName: normalizedFileName, cryptoKey: key, salt });

    if (!isKiyoFile(decrypted)) {
      return null;
    }
    await replaceDatabaseData(decrypted);
    // Save decrypted data to DB
    await saveFileDataToDB(normalizedFileName, parsedData, salt);
    useAccountStore.getState().setAccounts(decrypted.accounts);
    return { ...decrypted, fileName: normalizedFileName };
  } catch (error) {
    // 복호화 실패는 PIN 불일치로 간주 - 기존 동작 유지: null 반환
    return null;
  }
};
export const writeDataFile = async (
  data: EncryptedKiyoFile | KiyoDataFile,
  fileName: string,
): Promise<void> => {
  if (!fileName) {
    console.error("writeDataFile: fileName is empty");
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_FORMAT,
      "fileName is empty",
      { operation: "writeDataFile" }
    );
  }
  const normalizedFileName = normalizeDataFileName(fileName);
  if (!isNativeFileStorageAvailable()) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = normalizedFileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  try {
    await Filesystem.writeFile({
      path: normalizedFileName,
      data: JSON.stringify(data, null, 2),
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  } catch (error) {
    console.error("writeDataFile: Filesystem.writeFile failed", error);
    throw FileStorageError.create(
      FileStorageErrorCode.WRITE_FAILED,
      "Failed to write file",
      {
        originalError: error instanceof Error ? error : undefined,
        fileName: normalizedFileName,
        operation: "writeDataFile"
      }
    );
  }
};
