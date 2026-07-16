import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { Account, FileMetadata, Template } from "../models/account";
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
  loadAccountsFromDB,
  initializeDevDatabase,
  getActiveFileInfo,
} from "./db";
import { useAccountStore } from "../store/accountStore";
import {
  FileStorageError,
  FileStorageErrorCode,
} from "../errors/FileStorageError";

export interface KiyoDataFile {
  version: 1;
  fileName: string;
  updatedAt: number;
  accounts: Account[];
  templates: Template[];
  metadata: FileMetadata[];
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
    Array.isArray(data.metadata)
  );
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
      await useSessionStore
        .getState()
        .setSession({ fileName: normalizedFileName });
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
    await useSessionStore
      .getState()
      .setSession({ fileName: normalizedFileName, cryptoKey: key, salt });
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
    metadata: [],
  };

  if (!import.meta.env.DEV) await initializeDevDatabase();
  const accounts = await loadAccountsFromDB();
  useAccountStore.getState().setAccounts(accounts);
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

export const changePinDataFile = async (
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
      await useSessionStore
        .getState()
        .setSession({ fileName: normalizedFileName });
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
// PIN 변경: 활성 데이터 파일을 새 PIN으로 재암호화
// currentPin이 빈 문자열인 경우: 암호화되지 않은 파일에 새 PIN으로 암호화 설정
export const changePin = async (newPin: string): Promise<void> => {
  const { activeFileName, cryptoKey, salt } = await useSessionStore.getState();

  if (!activeFileName) {
    throw new Error("활성 데이터 파일이 없습니다.");
  }
  const normalizedFileName = normalizeDataFileName(activeFileName);
  const fileData: KiyoDataFile = await getDatabaseSnapshot(normalizedFileName);

  // 현재 활성 파일 읽기
  // let fileData: EncryptedKiyoFile | KiyoDataFile;
  // if (!isNativeFileStorageAvailable()) {
  //   throw new Error("파일 시스템을 사용할 수 없습니다.");
  // }

  if (!cryptoKey && !!salt) {
    // 암호화 키가 없고 salt만 있는 경우 -> 비로그인 상태
    throw new Error("암호화 키 정보가 없습니다.");
  }

  // 새 PIN으로 CryptoKey 생성
  const { key: newKey, salt: newSalt } = await createCryptoKey(newPin);

  // 데이터 암호화
  const encryptedData = await encryptData(fileData, newKey, newSalt);

  // 암호화된 데이터로 파일 덮어쓰기
  await writeDataFile(encryptedData, activeFileName);

  // 세션 스토어에 cryptoKey, salt 저장
  await useSessionStore.getState().setCryptoKey(newKey, newSalt);

  // DB에도 암호화된 데이터 저장
  await saveFileDataToDB(activeFileName, encryptedData, newSalt);
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
      { operation: "writeDataFile" },
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
        operation: "writeDataFile",
      },
    );
  }
};

/**
 * Unlocks an encrypted file with the given PIN.
 * Returns the decrypted KiyoDataFile on success, null on failure (wrong PIN).
 */
export const unlockFile = async (
  fileName: string,
  pin: string,
): Promise<KiyoDataFile | null> => {
  const { salt, encrypted, fileData } = await getActiveFileInfo();

  if (!encrypted || !salt || !fileData || !isEncryptedKiyoFile(fileData)) {
    return null;
  }

  const { key } = await createCryptoKey(pin, salt);

  try {
    const decrypted = await decryptData(fileData, key);

    if (!isKiyoFile(decrypted)) {
      return null;
    }

    const normalizedFileName = normalizeDataFileName(fileName);
    await useSessionStore
      .getState()
      .setSession({ fileName: normalizedFileName, cryptoKey: key, salt });
    await replaceDatabaseData(decrypted);
    await saveFileDataToDB(normalizedFileName, fileData, salt);
    useAccountStore.getState().setAccounts(decrypted.accounts);

    return { ...decrypted, fileName: normalizedFileName };
  } catch (error) {
    return null;
  }
};
/**
 * Closes the active data file and clears the session.
 * This internalizes session management - the UI only calls this function
 * and fileStorage handles the session clearing internally.
 */
export const closeDataFile = async (): Promise<void> => {
  await useSessionStore.getState().clearSession();
};
