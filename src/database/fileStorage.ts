import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import {
  createCryptoKey,
  decryptData,
  encryptData,
  type EncryptedKiyoVaultData,
} from "@/crypto/encryption";
import { exportCryptoKey, fromBase64 } from "@/crypto/crypto.utils";
import { useSessionStore } from "@/store/sessionStore";
import {
  replaceDatabaseData,
  getDatabaseSnapshot,
  initializeDatabase,
  getDatabase,
} from "@/database/db";
import { fileTable, parseFileData } from "@/database/fileTable";
import { accountTable } from "@/database/accountTable";
import { useAccountStore } from "@/store/accountStore";
import { templateTable } from "@/database/templateTable";
import {
  FileStorageError,
  FileStorageErrorCode,
  isFileStorageError,
} from "@/errors/FileStorageError";
import { useSettingsStore } from "@/store/settingsStore";
import { KiyoAutofill } from "@/plugins/kiyautofill";
import { useTemplateStore } from "@/store/templateStore";
import { devAccounts } from "@/data/devAccounts";
import { BUILTIN_TEMPLATES } from "@/data/builtinTemplates";
import type { KiyoVaultData } from "@/models/vault";
import { isEncryptedKiyoVaultData } from "@/crypto/encryption";
import { exportVaultFile, isNativeFileStorageAvailable, normalizeDataFileName } from "./fileExport";

export const isKiyoFile = (value: unknown): value is KiyoVaultData => {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    data.version === 1 &&
    typeof data.fileName === "string" &&
    typeof data.updatedAt === "number" &&
    Array.isArray(data.accounts) &&
    Array.isArray(data.templates) &&
    Array.isArray(data.metadata)
  );
};

// ============================================
// Pipeline Functions (Phase 1: saveDataFile 분해)
// ============================================

/**
 * 1단계: PIN으로부터 CryptoKey 생성 후 볼트 데이터 암호화
 * @returns { encryptedVaultData, cryptoKey, salt }
 */
export const createEncryptedVault = async (
  vaultData: KiyoVaultData,
  pin: string
): Promise<{
  encryptedVaultData: EncryptedKiyoVaultData;
  cryptoKey: CryptoKey;
  salt: Uint8Array;
}> => {
  const { key, salt } = await createCryptoKey(pin);
  const encryptedVaultData = await encryptData(vaultData, key, salt);
  return { encryptedVaultData, cryptoKey: key, salt };
};

/**
 * 2단계: 볼트 데이터를 FileRecord로 변환해 DB에 저장
 */
export const persistVaultRecord = async (
  fileName: string,
  vaultData: KiyoVaultData | EncryptedKiyoVaultData
): Promise<void> => {
  await fileTable.upsertFileRecord(fileName, vaultData);
};

/**
 * 3단계: 세션 스토어에 볼트 정보 저장 (cryptoKey, salt, fileName)
 */
export const setupVaultSession = async ({
  fileName,
  cryptoKey,
  salt,
}: {
  fileName: string;
  cryptoKey?: CryptoKey;
  salt?: Uint8Array;
}): Promise<void> => {
  const sessionData: { fileName: string; cryptoKey?: CryptoKey; salt?: Uint8Array } = { fileName };
  if (cryptoKey !== undefined) sessionData.cryptoKey = cryptoKey;
  if (salt !== undefined) sessionData.salt = salt;
  await useSessionStore.getState().setSession(sessionData);
};

/**
 * 4단계: Autofill 토큰 동기화 (암호화 여부에 따라 토큰 생성)
 */
export const syncAutofillToken = async (
  isEncrypted: boolean,
  cryptoKey?: CryptoKey
): Promise<void> => {
  const autofillStatus = await KiyoAutofill.isAutofillEnabled();
  if (!autofillStatus || !autofillStatus.enabled) return;

  const expireAt = Date.now() + 30 * 60 * 1000; // 30 minutes

  if (isEncrypted && cryptoKey) {
    try {
      const exportedKey = await exportCryptoKey(cryptoKey);
      await KiyoAutofill.setAutofillToken({
        token: exportedKey,
        expireAt,
        isEncrypted: true,
      });
    } catch (autofillError) {
      console.warn("Failed to save session key to autofill:", autofillError);
    }
  } else {
    await KiyoAutofill.setAutofillToken({
      token: "unencrypted_vault_token",
      expireAt,
      isEncrypted: false,
    });
  }
};

/**
 * 5단계: 볼트 데이터를 파일 시스템에 export
 */

// ============================================
// Legacy: saveDataFile (deprecated - 단계적 제거 예정)
// TODO: replace with pipeline functions
// ============================================

// Helper function to save data (encrypted or plain) to file and update security store
// Refactored to use pipeline functions - REMOVED: use pipeline functions instead

export const createDataFile = async (
  fileName: string,
  pin?: string
): Promise<KiyoVaultData> => {
  const normalizedFileName = normalizeDataFileName(fileName);

  // Initialize DB with builtin templates FIRST
  const metadata = [await initializeDatabase()];
  if (import.meta.env.DEV && !import.meta.env.VITE_E2E) await accountTable.initializeDevData(devAccounts);
  if (pin) {
    // For PIN case, we need cryptoKey to create templates
    // Use the SAME key/salt for both template encryption and vault encryption
    const { key: cryptoKey, salt } = await createCryptoKey(pin);
    for (const builtin of BUILTIN_TEMPLATES) {
      await templateTable.create(builtin, cryptoKey);
    }

    // Setup session FIRST so initialize()/loadTemplates() can read cryptoKey from session
    await setupVaultSession({ fileName: normalizedFileName, cryptoKey, salt });
    await syncAutofillToken(true, cryptoKey);

    // Now initialize stores from DB using session's cryptoKey
    await useAccountStore.getState().initialize();
    await useTemplateStore.getState().loadTemplates();

    const accounts = useAccountStore.getState().accounts ?? [];
    const templates = useTemplateStore.getState().templates ?? [];

    // Now create vault with the initialized data using the same cryptoKey/salt
    const baseData: KiyoVaultData = {
      version: 1,
      fileName: normalizedFileName,
      updatedAt: Date.now(),
      accounts,
      templates,
      metadata,
    };

    const encryptedVaultData = await encryptData(baseData, cryptoKey, salt);
    await persistVaultRecord(normalizedFileName, encryptedVaultData);
    await exportVaultFile(normalizedFileName, encryptedVaultData);
    return { ...baseData, accounts, templates, metadata };
  } else {
    // Plaintext case
    for (const builtin of BUILTIN_TEMPLATES) {
      await templateTable.create(builtin, undefined);
    }

    // Setup session FIRST so initialize()/loadTemplates() can read from session
    await setupVaultSession({ fileName: normalizedFileName });
    await syncAutofillToken(false);

    // Now initialize stores from DB
    await useAccountStore.getState().initialize();
    await useTemplateStore.getState().loadTemplates();

    const accounts = useAccountStore.getState().accounts ?? [];
    const templates = useTemplateStore.getState().templates ?? [];

    const baseData: KiyoVaultData = {
      version: 1,
      fileName: normalizedFileName,
      updatedAt: Date.now(),
      accounts,
      templates,
      metadata,
    };

    await persistVaultRecord(normalizedFileName, baseData);
    await exportVaultFile(normalizedFileName, baseData);
    return { ...baseData, accounts, templates, metadata };
  }
};

export const backupDataFile = async (
  fileName: string,
  pin: string
): Promise<KiyoVaultData> => {
  const normalizedFileName = normalizeDataFileName(fileName);
  const cryptoKey = useSessionStore.getState().cryptoKey ?? undefined;
  const data: KiyoVaultData = await getDatabaseSnapshot(normalizedFileName, cryptoKey);

  if (pin) {
    const { encryptedVaultData } = await createEncryptedVault(data, pin);
    // Persist encrypted backup to DB files table (for verification/querying)
    await exportVaultFile(normalizedFileName, encryptedVaultData);
  } else {
    // Plaintext backup: export as-is
    await exportVaultFile(normalizedFileName, data);
  }
  return data;
};

export const openImportedDataFile = async (
  data: string,
  pin: string,
  fileName: string
): Promise<KiyoVaultData> => {
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

  if (!fileName || typeof fileName !== "string") {
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_FILE_FORMAT,
      "파일 이름이 필요합니다",
      { operation: "openImportedDataFile" },
    );
  }

  const normalizedFileName = normalizeDataFileName(fileName);

  // 기존 평문 파일 지원
  if (!isEncryptedKiyoVaultData(parsedData)) {
    if (!isKiyoFile(parsedData)) {
      throw FileStorageError.create(
        FileStorageErrorCode.INVALID_FILE_FORMAT,
        "is not KiyoFile",
        { operation: "openImportedDataFile" },
      );
    }
    // Pipeline for plaintext: persist → session → autofill → export
    try {
      await persistVaultRecord(normalizedFileName, parsedData);
      await setupVaultSession({ fileName: normalizedFileName });
      await syncAutofillToken(false);
      await exportVaultFile(normalizedFileName, parsedData);
      await replaceDatabaseData({
        data: parsedData,
        fileName: normalizedFileName,
        cryptoKey: undefined,
        encryptedFileData: undefined,
      });
    } catch (error) {
      if (isFileStorageError(error)) throw error;
      throw FileStorageError.create(
        FileStorageErrorCode.DATABASE_ERROR,
        "평문 파일 저장 실패",
        { operation: "openImportedDataFile", originalError: error instanceof Error ? error : undefined },
      );
    }
    await useAccountStore.getState().initialize();
    await useTemplateStore.getState().loadTemplates();
    return { ...parsedData, fileName: normalizedFileName };
  }

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
  let decrypted: KiyoVaultData;

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

  // Pipeline for encrypted: persist encrypted file data → session with key → autofill → export
  try {
    await persistVaultRecord(normalizedFileName, parsedData);
    await setupVaultSession({ fileName: normalizedFileName, cryptoKey: key, salt });
    await syncAutofillToken(true, key);
    await exportVaultFile(normalizedFileName, parsedData);
    // Save decrypted data to DB - 암호화된 파일 데이터(parsedData)를 그대로 전달
    await replaceDatabaseData({
      data: decrypted,
      fileName: normalizedFileName,
      cryptoKey: key,
      encryptedFileData: parsedData,
    });
  } catch (error) {
    if (isFileStorageError(error)) throw error;
    throw FileStorageError.create(
      FileStorageErrorCode.DATABASE_ERROR,
      "데이터베이스 작업 실패",
      { operation: "openImportedDataFile", originalError: error instanceof Error ? error : undefined },
    );
  }

  await useAccountStore.getState().initialize();
  await useTemplateStore.getState().loadTemplates();
  return { ...decrypted, fileName: normalizedFileName };
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
  const fileData: KiyoVaultData = await getDatabaseSnapshot(normalizedFileName);

  if (!cryptoKey && encrypted) {
    // 암호화 키가 없고 salt만 있는 경우 -> 비로그인 상태
    throw new Error("암호화 키 정보가 없습니다.");
  }

  // 새 PIN으로 CryptoKey 생성
  const { key: newKey, salt: newSalt } = await createCryptoKey(newPin);

  // 데이터 암호화
  const encryptedData = await encryptData(fileData, newKey, newSalt);

  // Pipeline: persist → session → autofill → export
  await persistVaultRecord(normalizedFileName, encryptedData);
  await setupVaultSession({ fileName: normalizedFileName, cryptoKey: newKey, salt: newSalt });
  await syncAutofillToken(true, newKey);
  await exportVaultFile(normalizedFileName, encryptedData);
};

export const exportDataFile = async (
  data: EncryptedKiyoVaultData | KiyoVaultData,
  fileName: string,
): Promise<void> => {
  if (!fileName) {
    console.error("exportDataFile: fileName is empty");
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_FORMAT,
      "fileName is empty",
      { operation: "exportDataFile" },
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
    console.error("exportDataFile: Filesystem.writeFile failed", error);
    throw FileStorageError.create(
      FileStorageErrorCode.WRITE_FAILED,
      "Failed to write file",
      {
        originalError: error instanceof Error ? error : undefined,
        fileName: normalizedFileName,
        operation: "exportDataFile",
      },
    );
  }
};

/**
 * Import file data from filesystem
 */
export const importDataFile = async (
  fileName: string
): Promise<EncryptedKiyoVaultData | KiyoVaultData> => {
  const normalizedFileName = normalizeDataFileName(fileName);

  if (!isNativeFileStorageAvailable()) {
    // 웹 환경에서는 파일 선택 다이얼로그 필요 - 여기서는 에러
    throw FileStorageError.create(
      FileStorageErrorCode.FILE_READ_FAILED,
      "웹 환경에서는 파일 직접 읽기 불가",
      { operation: "importDataFile", fileName: normalizedFileName },
    );
  }

  try {
    const result = await Filesystem.readFile({
      path: normalizedFileName,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    return parseFileData(result.data as string);
  } catch (error) {
    console.error("importDataFile: Filesystem.readFile failed", error);
    throw FileStorageError.create(
      FileStorageErrorCode.FILE_READ_FAILED,
      "Failed to read file",
      {
        originalError: error instanceof Error ? error : undefined,
        fileName: normalizedFileName,
        operation: "importDataFile",
      },
    );
  }
};

/**
 * Unlocks an encrypted file with the given PIN.
 * Returns the decrypted KiyoVaultData on success, throws FileStorageError on failure.
 */
export const unlockFile = async (
  fileName: string,
  pin: string
): Promise<KiyoVaultData> => {
  const normalizedFileName = normalizeDataFileName(fileName);
  const fileRecord = await fileTable.getActiveFileRecord();
  if (!fileRecord) {
    throw FileStorageError.create(
      FileStorageErrorCode.FILE_NOT_FOUND,
      "파일을 찾을 수 없습니다.",
      { operation: "unlockFile", fileName: normalizedFileName },
    );
  }

  let fileData: EncryptedKiyoVaultData;
  try {
    fileData = JSON.parse(fileRecord.fileData);
  } catch (error) {
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_FILE_FORMAT,
      "파일 데이터 파싱 실패",
      { operation: "unlockFile", originalError: error instanceof Error ? error : undefined },
    );
  }

  if (!isEncryptedKiyoVaultData(fileData)) {
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_FILE_FORMAT,
      "파일이 암호화되어 있지 않습니다.",
      { operation: "unlockFile" },
    );
  }

  const salt = fromBase64(fileData.salt);
  if (salt.byteLength !== 16) {
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_SALT,
      "유효하지 않은 salt",
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

    // Pipeline: session with key → autofill → export (file data already in DB)
    await setupVaultSession({ fileName: normalizedFileName, cryptoKey: key, salt });
    await syncAutofillToken(true, key);
    await exportVaultFile(normalizedFileName, fileData);
    await replaceDatabaseData({
      data: decrypted,
      fileName: normalizedFileName,
      cryptoKey: key,
      encryptedFileData: fileData,
    });

    await useAccountStore.getState().initialize();
    await useTemplateStore.getState().loadTemplates();

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
  await useTemplateStore.getState().clearTemplates();
  await KiyoAutofill.clearAutofillToken();
  await fileTable.deleteFileRecord();
  // metadata 초기화
  const db = getDatabase();
  await db.metadata.clear();
  // Reset auto-lock timeout to default (none) when file is closed
  await useSettingsStore.getState().setAutoLockTimeout("none");
};

/**
 * Locks the active data file (for auto-lock) - clears crypto key but preserves file info.
 * Unlike closeDataFile, this keeps activeFileName and salt in fileTable for recovery.
 */
export const lockDataFile = async (): Promise<void> => {
  // Clear only crypto key from session, keep activeFileName and salt
  await useSessionStore.getState().clearCryptoKey();
  // Save lock state to autofill (marks as encrypted, clears token)
  await KiyoAutofill.setAutofillToken({
    token: "locked",
    expireAt: 0,
    isEncrypted: true,
  });
  // Do NOT call fileTable.clear() - preserve file info for unlock
};