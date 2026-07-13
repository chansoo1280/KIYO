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
import { useSecurityStore } from "../store/securityStore";
import { replaceDatabaseData } from "./db";
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

  if (!pin) {
    useSecurityStore.getState().setActiveFileName(normalizedFileName);
    // 파일 저장
    await writeDataFile(data, normalizedFileName);

    return data;
  }

  // PIN -> CryptoKey 생성
  const { key, salt } = await createCryptoKey(pin);

  // 이후 자동 저장을 위해 메모리에 보관
  useSecurityStore.getState().setCryptoKey(key, salt);

  // 현재 파일 저장
  useSecurityStore.getState().setActiveFileName(normalizedFileName);

  // 데이터 암호화
  const encrypted = await encryptData(data, key, salt);

  // 파일 저장
  await writeDataFile(encrypted, normalizedFileName);

  return data;
};
export const backupDataFile = async (
  fileName: string,
  pin: string,
): Promise<KiyoDataFile> => {
  const normalizedFileName = normalizeDataFileName(fileName);

  const data: KiyoDataFile = {
    version: 1,
    fileName: normalizedFileName,
    updatedAt: Date.now(),
    accounts: useAccountStore.getState().accounts,
    templates: [],
    settings: [],
    metadata: [],
  };

  if (!pin) {
    // 파일 저장
    await writeDataFile(data, normalizedFileName);

    return data;
  }

  // PIN -> CryptoKey 생성
  const { key, salt } = await createCryptoKey(pin);

  // 데이터 암호화
  const encrypted = await encryptData(data, key, salt);

  // 파일 저장
  await writeDataFile(encrypted, normalizedFileName);

  return data;
};

export const openImportedDataFile = async (
  data: string,
  pin: string,
  fileName: string,
): Promise<KiyoDataFile | null> => {
  const parsedData = JSON.parse(data);
  // 기존 평문 파일 지원
  if (!isEncryptedKiyoFile(parsedData)) {
    if (!isKiyoFile(parsedData)) {
      return null;
    }
    await replaceDatabaseData(parsedData);
    useSecurityStore.getState().setActiveFileName(fileName);
    useAccountStore.getState().setAccounts(parsedData.accounts);
    return parsedData;
  }

  try {
    // 파일의 salt로 동일한 CryptoKey 생성
    const salt = fromBase64(parsedData.salt);
    const { key } = await createCryptoKey(pin, salt);

    // 이후 자동 저장을 위해 메모리에 보관
    useSecurityStore.getState().setCryptoKey(key, salt);
    useSecurityStore.getState().setActiveFileName(fileName);

    const decrypted = await decryptData(parsedData, key);

    if (!isKiyoFile(decrypted)) {
      return null;
    }
    await replaceDatabaseData(decrypted);
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
