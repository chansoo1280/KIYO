import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { Account, FileMetadata,  } from "@/models/account";
import {
  createCryptoKey,
  decryptData,
  encryptData,
  isEncryptedKiyoFile,
  type EncryptedKiyoFile,
} from "@/crypto/encryption";
import { exportCryptoKey, fromBase64 } from "@/crypto/crypto.utils";
import { useSessionStore } from "@/store/sessionStore";
import {
  replaceDatabaseData,
  getDatabaseSnapshot,
  initializeDatabase,
} from "@/database/db";
import { fileTable } from "@/database/fileTable";
import { accountTable } from "@/database/accountTable";
import { useAccountStore } from "@/store/accountStore";
import { templateTable } from "@/database/templateTable";
import {
  FileStorageError,
  FileStorageErrorCode,
  isFileStorageError,
} from "@/errors/FileStorageError";
import { KiyoAutofill } from "@/plugins/kiyautofill";
import type { Template } from "@/models/template";
import { useTemplateStore } from "@/store/templateStore";
import { devAccounts } from "@/database/testdata";
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
export { isEncryptedKiyoFile } from "@/crypto/encryption";

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
  if(!isKiyoFile(data)) throw new Error("키요 파일이 아닙니다.");
  if (!pin) {
    if (shouldSetActiveFile) {
      await useSessionStore
        .getState()
        .setSession({ fileName: normalizedFileName });
    }
    await fileTable.saveFileDataToDB(normalizedFileName, data);
    await writeDataFile(data, normalizedFileName);
    // Autofill 세션 저장 (Autofill이 활성화된 경우만)
    const autofillStatus = await KiyoAutofill.isAutofillEnabled();
    if (autofillStatus&&autofillStatus.enabled) {
      await KiyoAutofill.saveSession({
        isLock: false,
      });
    }
    return data;
  }

  // PIN -> CryptoKey 생성
  const { key, salt } = await createCryptoKey(pin);
  // 데이터 암호화
  const encrypted = await encryptData(data, key, salt);

  // 이후 자동 저장을 위해 메모리에 보관
  if (shouldSetActiveFile) {
    await useSessionStore
      .getState()
      .setSession({ fileName: normalizedFileName, cryptoKey: key, salt });
  }

  // Export CryptoKey and save to Native Autofill Session
  try {
    const exportedKey = await exportCryptoKey(key);
    await KiyoAutofill.saveSession({
      key: exportedKey,
      isLock: true,
    });
  } catch (autofillError) {
    // Autofill session key save failure should not block unlock
    console.warn("Failed to save session key to autofill:", autofillError);
  }

  // 파일 저장
  await writeDataFile(encrypted, normalizedFileName);

  // Save encrypted data to DB
  await fileTable.saveFileDataToDB(normalizedFileName, encrypted, salt);

  return data;
};

export const createDataFile = async (
  fileName: string,
  pin?: string,
): Promise<KiyoDataFile> => {
  const normalizedFileName = normalizeDataFileName(fileName);

  await initializeDatabase();
  await accountTable.initializeDevData(devAccounts)
  const accounts = await accountTable.getAll();
  useAccountStore.getState().setAccounts(accounts);

  await templateTable.init();
  const templates = await templateTable.getAll();
  useTemplateStore.getState().loadTemplates();
  const data: KiyoDataFile = {
    version: 1,
    fileName: normalizedFileName,
    updatedAt: Date.now(),
    accounts: accounts || [],
    templates: templates || [],
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
  fileName: string,
): Promise<KiyoDataFile> => {
  let parsedData: unknown;
  try {
    parsedData = JSON.parse(data);
  } catch (error) {
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_JSON,
      "JSON 파싱 실패",
      { operation: "openImportedDataFile", originalError: error instanceof Error ? error : undefined },
    );
  }

  // 기존 평문 파일 지원
  if (!isEncryptedKiyoFile(parsedData)) {
    if (!isKiyoFile(parsedData)) {
      throw FileStorageError.create(
        FileStorageErrorCode.INVALID_FILE_FORMAT,
        "is not KiyoFile",
        { operation: "openImportedDataFile" },
      );
    }
    try {
      await replaceDatabaseData(parsedData);
      const normalizedFileName = normalizeDataFileName(fileName);
      await useSessionStore
        .getState()
        .setSession({ fileName: normalizedFileName });
      // Autofill 세션 저장 (Autofill이 활성화된 경우만)
      const autofillStatus = await KiyoAutofill.isAutofillEnabled();
      if (autofillStatus&&autofillStatus.enabled) {
        await KiyoAutofill.saveSession({
          isLock: false,
        });
      }
      // Save plain data to DB
      await fileTable.saveFileDataToDB(normalizedFileName, parsedData);
      useAccountStore.getState().setAccounts(parsedData.accounts);
      return { ...parsedData, fileName: normalizedFileName };
    } catch (error) {
      if (isFileStorageError(error)) throw error;
      throw FileStorageError.create(
        FileStorageErrorCode.DATABASE_ERROR,
        "평문 파일 저장 실패",
        { operation: "openImportedDataFile", originalError: error instanceof Error ? error : undefined },
      );
    }
  }

  try {
    // 파일의 salt로 동일한 CryptoKey 생성
    if (!parsedData.salt || typeof parsedData.salt !== "string") {
      throw FileStorageError.create(
        FileStorageErrorCode.INVALID_SALT,
        "암호화된 파일 이지만 salt가 없음",
        { operation: "openImportedDataFile" },
      );
    }

    const salt = fromBase64(parsedData.salt);
    // Validate salt length (should be 16 bytes for AES-GCM)
    if (salt.byteLength !== 16) {
      throw FileStorageError.create(
        FileStorageErrorCode.INVALID_SALT,
        "유효하지 않은 salt",
        { operation: "openImportedDataFile" },
      );
    }

    let key: CryptoKey;
    let decrypted: KiyoDataFile;

    // createCryptoKey, decryptData 실패는 PIN_MISMATCH로 매핑
    try {
      const keyResult = await createCryptoKey(pin, salt);
      key = keyResult.key;
      decrypted = await decryptData(parsedData, key);
    } catch (cryptoError) {
      throw FileStorageError.create(
        FileStorageErrorCode.PIN_MISMATCH,
        "PIN 불일치",
        { operation: "openImportedDataFile", originalError: cryptoError instanceof Error ? cryptoError : undefined },
      );
    }

    // isKiyoFile 검증 실패는 INVALID_DATA_FORMAT으로 별도 처리
    if (!isKiyoFile(decrypted)) {
      throw FileStorageError.create(
        FileStorageErrorCode.INVALID_DATA_FORMAT,
        "is not KiyoFile",
        { operation: "openImportedDataFile" },
      );
    }
    const normalizedFileName = normalizeDataFileName(fileName);
    // 이후 자동 저장을 위해 메모리에 보관
    await useSessionStore
      .getState()
      .setSession({ fileName: normalizedFileName, cryptoKey: key, salt });
    // Save decrypted data to DB
    await fileTable.saveFileDataToDB(normalizedFileName, parsedData, salt);

    // Export CryptoKey and save to Native Autofill Session (Autofill이 활성화된 경우만)
    try {
      const autofillStatus = await KiyoAutofill.isAutofillEnabled();
      if (autofillStatus&&autofillStatus.enabled) {
        const exportedKey = await exportCryptoKey(key);
        await KiyoAutofill.saveSession({
          key: exportedKey,
          isLock: true,
        });
      }
    } catch (autofillError) {
      // Autofill session key save failure should not block unlock
      console.warn("Failed to save session key to autofill:", autofillError);
    }
    await replaceDatabaseData(decrypted);
    useAccountStore.getState().setAccounts(decrypted.accounts);
    return { ...decrypted, fileName: normalizedFileName };
  } catch (error) {
    // 복호화 실패는 PIN 불일치로 간주 - 기존 동작 유지: PIN_MISMATCH 에러
    if (isFileStorageError(error)) {
      // 이미 적절한 에러 코드면 그대로 전달 (DB 에러, 검증 에러 등)
      if (
        error.code === FileStorageErrorCode.PIN_MISMATCH ||
        error.code === FileStorageErrorCode.INVALID_SALT ||
        error.code === FileStorageErrorCode.INVALID_DATA_FORMAT ||
        error.code === FileStorageErrorCode.DATABASE_ERROR
      ) {
        throw error;
      }
    }
    // 복호화 이후 단계(DB 저장, 세션 설정 등)에서 발생한 일반 에러는 DATABASE_ERROR로 래핑
    // createCryptoKey, decryptData, isKiyoFile 검증 실패만 PIN_MISMATCH로 매핑
    if (error instanceof Error) {
      // 이미 FileStorageError로 처리된 PIN_MISMATCH, INVALID_SALT, INVALID_DATA_FORMAT 외의 에러는 DATABASE_ERROR
      throw FileStorageError.create(
        FileStorageErrorCode.DATABASE_ERROR,
        "데이터베이스 작업 실패",
        { operation: "openImportedDataFile", originalError: error },
      );
    }
    throw FileStorageError.create(
      FileStorageErrorCode.PIN_MISMATCH,
      "PIN 불일치",
      { operation: "openImportedDataFile", originalError: error instanceof Error ? error : undefined },
    );
  }
};
// PIN 변경: 활성 데이터 파일을 새 PIN으로 재암호화
// currentPin이 빈 문자열인 경우: 암호화되지 않은 파일에 새 PIN으로 암호화 설정
export const changePin = async (newPin: string): Promise<void> => {
  const { activeFileName, encrypted } = await fileTable.getActiveFileInfo();
  const { cryptoKey } = await useSessionStore.getState();

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

  if (!cryptoKey && encrypted) {
    // 암호화 키가 없고 salt만 있는 경우 -> 비로그인 상태
    throw new Error("암호화 키 정보가 없습니다.");
  }

  // 새 PIN으로 CryptoKey 생성
  const { key: newKey, salt: newSalt } = await createCryptoKey(newPin);

  // 데이터 암호화
  const encryptedData = await encryptData(fileData, newKey, newSalt);

  // 암호화된 데이터로 파일 덮어쓰기
  await writeDataFile(encryptedData, normalizedFileName);

  // 세션 스토어에 cryptoKey, salt 저장
  await useSessionStore.getState().setCryptoKey(newKey, newSalt);

  // Export CryptoKey and save to Native Autofill Session (Autofill이 활성화된 경우만)
  try {
    const autofillStatus = await KiyoAutofill.isAutofillEnabled();
    if (autofillStatus&&autofillStatus.enabled) {
      const exportedKey = await exportCryptoKey(newKey);
      await KiyoAutofill.saveSession({
        key: exportedKey,
        isLock: true,
      });
    }
  } catch (autofillError) {
    // Autofill session key save failure should not block unlock
    console.warn("Failed to save session key to autofill:", autofillError);
  }

  // DB에도 암호화된 데이터 저장
  await fileTable.saveFileDataToDB(normalizedFileName, encryptedData, newSalt);
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
 * Returns the decrypted KiyoDataFile on success, throws FileStorageError on failure.
 */
export const unlockFile = async (
  fileName: string,
  pin: string,
): Promise<KiyoDataFile> => {
  const { salt, encrypted, fileData } = await fileTable.getActiveFileInfo();

  if (!encrypted || !salt) {
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_FILE_FORMAT,
      "암호화 되어 있는 파일이 아닙니다.",
      { operation: "unlockFile" },
    );
  }
  if (!fileData || !isEncryptedKiyoFile(fileData)) {
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_FILE_FORMAT,
      "파일 형식이 올바르지 않습니다.",
      { operation: "unlockFile" },
    );
  }

  try {
    const { key } = await createCryptoKey(pin, salt);
    const decrypted = await decryptData(fileData, key);
    if (!isKiyoFile(decrypted)) {
      throw FileStorageError.create(
        FileStorageErrorCode.INVALID_DATA_FORMAT,
        "파일 형식이 올바르지 않습니다.",
        { operation: "unlockFile" },
      );
    }

    const normalizedFileName = normalizeDataFileName(fileName);
    await useSessionStore
      .getState()
      .setSession({ fileName: normalizedFileName, cryptoKey: key, salt });
    await fileTable.saveFileDataToDB(normalizedFileName, fileData, salt);
    await replaceDatabaseData(decrypted);
    useAccountStore.getState().setAccounts(decrypted.accounts);

    // Export CryptoKey and save to Native Autofill Session (Autofill이 활성화된 경우만)
    try {
      const autofillStatus = await KiyoAutofill.isAutofillEnabled();
      if (autofillStatus&&autofillStatus.enabled) {
        const exportedKey = await exportCryptoKey(key);
        await KiyoAutofill.saveSession({
          key: exportedKey,
          isLock: true,
        });
      }
    } catch (autofillError) {
      // Autofill session key save failure should not block unlock
      console.warn("Failed to save session key to autofill:", autofillError);
    }

    return { ...decrypted, fileName: normalizedFileName };
  } catch (error) {
    // 복호화 실패 등을 PIN_MISMATCH로 매핑
    if (isFileStorageError(error) && error.code === FileStorageErrorCode.PIN_MISMATCH) {
      throw error;
    }
    throw FileStorageError.create(
      FileStorageErrorCode.PIN_MISMATCH,
      "PIN 불일치",
      { operation: "unlockFile", originalError: error instanceof Error ? error : undefined },
    );
  }
};
/**
 * Closes the active data file and clears the session.
 * This internalizes session management - the UI only calls this function
 * and fileStorage handles the session clearing internally.
 */
export const closeDataFile = async (): Promise<void> => {
  await useSessionStore.getState().clearSession();
  await useAccountStore.getState().clearAccounts();
  await KiyoAutofill.clearSession();
  await fileTable.clearActiveFileInfo();
};
