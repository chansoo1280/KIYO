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
    await useSessionStore.getState().setCryptoKey(key, salt);
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
  fileName: string,
): Promise<KiyoDataFile | null> => {
  let parsedData: unknown;
  try {
    parsedData = JSON.parse(data);
  } catch (error) {
    console.error("Invalid JSON data:", error);
    return null;
  }

  // 기존 평문 파일 지원
  if (!isEncryptedKiyoFile(parsedData)) {
    if (!isKiyoFile(parsedData)) {
      return null;
    }
    try {
      await replaceDatabaseData(parsedData);
      await useSessionStore.getState().setSession({
        fileName,
      });
      // Save plain data to DB
      await saveFileDataToDB(fileName, parsedData);
      useAccountStore.getState().setAccounts(parsedData.accounts);
      return parsedData;
    } catch (error) {
      console.error("Failed to load plain data file:", error);
      return null;
    }
  }

  try {
    // 파일의 salt로 동일한 CryptoKey 생성
    if (!parsedData.salt || typeof parsedData.salt !== "string") {
      console.error("Invalid salt in encrypted file");
      return null;
    }

    const salt = fromBase64(parsedData.salt);
    // Validate salt length (should be 16 bytes for AES-GCM)
    if (salt.byteLength !== 16) {
      console.error("Invalid salt length");
      return null;
    }

    const { key } = await createCryptoKey(pin, salt);

    // 이후 자동 저장을 위해 메모리에 보관
    await useSessionStore
      .getState()
      .setSession({ fileName, cryptoKey: key, salt });

    const decrypted = await decryptData(parsedData, key);

    if (!isKiyoFile(decrypted)) {
      return null;
    }
    await replaceDatabaseData(decrypted);
    // Save decrypted data to DB
    await saveFileDataToDB(fileName, parsedData, salt);
    useAccountStore.getState().setAccounts(decrypted.accounts);
    return decrypted;
  } catch (error) {
    console.error("PIN 또는 파일이 올바르지 않습니다.", error);
    return null;
  }
};
export const writeDataFile = async (
  data: EncryptedKiyoFile | KiyoDataFile,
  fileName: string,
): Promise<void> => {
  if (!fileName) return;
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
  await Filesystem.writeFile({
    path: normalizedFileName,
    data: JSON.stringify(data, null, 2),
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
};

export interface ReadDataFileResult {
  type: "not-found" | "encrypted" | "plain" | "invalid";
  data?: KiyoDataFile;
}

export const readDataFile = async (
  fileName: string,
  pin?: string,
): Promise<ReadDataFileResult> => {
  const normalizedFileName = normalizeDataFileName(fileName);

  if (!isNativeFileStorageAvailable()) {
    // On web platform, we can't read from filesystem directly
    // This should be handled via file input in the UI
    return { type: "not-found" };
  }

  try {
    // Read file from filesystem (native platform only)
    const { data } = await Filesystem.readFile({
      path: normalizedFileName,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });

    const fileContent = data as string;
    const parsedData = JSON.parse(fileContent);

    // Check if it's an encrypted KIYO file
    if (isEncryptedKiyoFile(parsedData)) {
      // If no PIN provided, just return that it's encrypted
      if (!pin || !pin.trim()) {
        return { type: "encrypted" };
      }

      // Try to decrypt with PIN
      try {
        const salt = fromBase64(parsedData.salt);
        const { key } = await createCryptoKey(pin, salt);

        // Store crypto key for auto-save
        await useSessionStore
          .getState()
          .setSession({ fileName: normalizedFileName, cryptoKey: key, salt });

        const decrypted = await decryptData(parsedData, key);

        if (!isKiyoFile(decrypted)) {
          return { type: "invalid" };
        }

        await replaceDatabaseData(decrypted);
        useAccountStore.getState().setAccounts(decrypted.accounts);
        return { type: "plain", data: decrypted };
      } catch {
        // PIN is wrong or decryption failed
        return { type: "encrypted" };
      }
    }

    // Check if it's a plain KIYO file
    if (!isKiyoFile(parsedData)) {
      return { type: "invalid" };
    }

    // Plain text KIYO file - load directly
    await replaceDatabaseData(parsedData);
    await useSessionStore.getState().setSession({
      fileName: normalizedFileName,
    });
    useAccountStore.getState().setAccounts(parsedData.accounts);
    return { type: "plain", data: parsedData };
  } catch (error) {
    await useSessionStore.getState().clearSession();
    // File not found or read error
    if (error instanceof Error && error.message.includes("File not found")) {
      return { type: "not-found" };
    }
    console.error("File read error:", error);
    return { type: "not-found" };
  }
};
