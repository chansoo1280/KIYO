import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import {
  createCryptoKey,
  decryptData,
  encryptData,
  type EncryptedKiyoVaultData,
} from "@/crypto/encryption";
import { fromBase64 } from "@/crypto/crypto.utils";
import { useSessionStore } from "@/store/sessionStore";
import {
  replaceDatabaseData,
  getDatabaseSnapshot,
  initializeDatabase,
  db,
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
import { useTemplateStore } from "@/store/templateStore";
import { devAccounts } from "@/data/devAccounts";
import { BUILTIN_TEMPLATES } from "@/data/builtinTemplates";
import type { KiyoVaultData } from "@/models/vault";
import { isEncryptedKiyoVaultData } from "@/crypto/encryption";
import { exportBackupFile, isNativeFileStorageAvailable, normalizeDataFileName } from "./fileExport";
import { KiyoAutofill } from "@/plugins/kiyautofill";

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
 * 1.5단계: PIN과 salt로 CryptoKey 생성 후 암호화된 볼트 데이터 복호화
 * createCryptoKey, decryptData 실패는 PIN_MISMATCH로 매핑
 * @returns { decryptedVaultData, cryptoKey }
 */
export const decryptVaultData = async (
  encryptedData: EncryptedKiyoVaultData,
  pin: string,
  salt: Uint8Array
): Promise<{
  decryptedVaultData: KiyoVaultData;
  cryptoKey: CryptoKey;
}> => {
  try {
    const { key } = await createCryptoKey(pin, salt);
    const decryptedVaultData = await decryptData(encryptedData, key);
    return { decryptedVaultData, cryptoKey: key };
  } catch (cryptoError) {
    throw FileStorageError.create(
      FileStorageErrorCode.PIN_MISMATCH,
      "PIN 불일치",
      { operation: "decryptVaultData", originalError: cryptoError instanceof Error ? cryptoError : undefined }
    );
  }
};

/**
 * 3.5단계: 세션 설정 후 Store들 초기화 (계정/템플릿 로드)
 * setupVaultSession 호출 후 사용
 *
 * 다른 vault로의 import/change 후 호출 시 store의 `initialized=true` 잔존 상태를
 * 명시적으로 reset한 뒤 다시 load한다. 그렇지 않으면 store-side guard(`if
 * (get().initialized) return;`)가 이전 vault의 데이터를 그대로 보존시켜
 * 새 vault 데이터가 화면에 반영되지 않는 회귀가 발생.
 */
export const initializeStores = async (): Promise<void> => {
  useAccountStore.setState({ initialized: false });
  useTemplateStore.setState({ initialized: false });
  await useAccountStore.getState().loadAccounts();
  await useTemplateStore.getState().loadTemplates();
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
 *
 * `loadStores: true`로 호출하면 plaintext 경로에서 store를 즉시 reload한다.
 * encrypted 경로에서는 unlock 후 caller(예: Auth)가 initializeStores()를
 * 명시적으로 호출하므로 loadStores를 켜지 않는다.
 */
/**
 * Note: Autofill 토큰 동기화는 더 이상 사용되지 않음.
 * Autofill 서비스는 순수하게 Android Keystore 기반 인증에 의존함.
 */
export const setupVaultSession = async ({
  fileName,
  cryptoKey,
  salt,
  loadStores = false,
}: {
  fileName: string;
  cryptoKey?: CryptoKey;
  salt?: Uint8Array;
  loadStores?: boolean;
}): Promise<void> => {
  await useSessionStore.getState().setSession({ fileName, cryptoKey, salt });
  if (loadStores && !cryptoKey) {
    // plaintext 경로: Home active 전환 시 store reload
    await initializeStores();
  }
  // Autofill 토큰 동기화는 제거됨 - Keystore 기반 인증 사용
};

/**
 * 5단계: 볼트 데이터를 파일 시스템에 export
 */
export const exportDataFile = async (
  data: EncryptedKiyoVaultData | KiyoVaultData,
  fileName: string,
): Promise<void> => {
  if (!fileName) {
    console.error("exportDataFile: fileName is empty");
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_FORMAT,
      "fileName is empty",
      { operation: "exportDataFile" }
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
    console.error("exportDataFile: Filesystem.writeFile failed", error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : "");
    throw FileStorageError.create(
      FileStorageErrorCode.WRITE_FAILED,
      "Failed to write file",
      {
        originalError: error instanceof Error ? error : undefined,
        fileName: normalizedFileName,
        operation: "exportDataFile",
      }
    );
  }
};

export const closeDataFile = async (): Promise<void> => {
  await useSessionStore.getState().clearSession();
  // db.files는 건드리지 않는다 — multi-vault 모델에서 모든 row 보존.
  // active 해제는 sessionStore.activeFileName = null로 표현.
  // db.accounts/templates는 useAccountStore/TemplateStore의 clearAccounts/
  // clearTemplates가 각각 accountTable.clear/templateTable.clear를 호출하여
  // 이미 처리된다. db.metadata는 별도 store가 없으므로 직접 clear.
  await db.metadata.clear();
  // Clear in-memory stores (db.accounts/templates도 함께 클리어)
  await useAccountStore.getState().clearAccounts();
  await useTemplateStore.getState().clearTemplates();
  // Clear autofill data (if autofill enabled)
  if (Capacitor.getPlatform() === "android") {
    try {
      await KiyoAutofill.clearAllAccounts();
    } catch (e) {
      // Ignore errors during cleanup
      console.warn("Failed to clear autofill data on close:", e);
    }
  }
};

export const lockDataFile = async (): Promise<void> => {
  await useSessionStore.getState().clearCryptoKey();
};

export const unlockFile = async (

  fileName: string,

  pin: string

): Promise<KiyoVaultData | null> => {
  if (!fileName) {
    throw new Error("File name is required for unlock");
  }
  const { encrypted, fileData, salt } = await fileTable.getFileInfo(fileName);
  if (!fileData) {
    throw new Error(`File not found: ${fileName}`);
  }
  let decryptedData: KiyoVaultData;
  if (encrypted) {
    if (!salt) {
      throw new Error(`Salt missing for encrypted file: ${fileName}`);
    }
        const { decryptedVaultData: decrypted, cryptoKey } = await decryptVaultData(
      fileData,
      pin,
      salt
    );
    decryptedData = decrypted;
    await useSessionStore.getState().setCryptoKey(cryptoKey, salt);
  } else {
    decryptedData = fileData;
    // No cryptoKey or salt for plaintext
  }
  // Set up session
  return decryptedData;

};


// Helper function to save data (encrypted or plain) to file and update security store
// Refactored to use pipeline functions - REMOVED: use pipeline functions instead
// Note: createDataFile은 새 파일 생성이므로 replaceDatabaseData 불필요
// - 기존 암호화 파일 데이터(encryptedFileData)가 없음
// - 내장 템플릿 생성 → 세션 설정 → 스토어 로드 → 스토어에서 데이터 읽어 볼트 구성
export const createDataFile = async (
  fileName: string,
  pin?: string
): Promise<KiyoVaultData> => {
  const normalizedFileName = normalizeDataFileName(fileName);
  // multi-vault: 중복 fileName은 (1), (2) suffix 자동 부여
  const resolvedFileName = await fileTable.resolveFileName(normalizedFileName);

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
    await setupVaultSession({ fileName: resolvedFileName, cryptoKey, salt });
    // Autofill 토큰 동기화는 제거됨 - Keystore 기반 인증 사용

    // Now initialize stores from DB using session's cryptoKey
    await initializeStores();

    const accounts = useAccountStore.getState().accounts ?? [];
    const templates = useTemplateStore.getState().templates ?? [];

    // Now create vault with the initialized data using the same cryptoKey/salt
    const baseData: KiyoVaultData = {
      version: 1,
      fileName: resolvedFileName,
      updatedAt: Date.now(),
      accounts,
      templates,
      metadata,
    };

    const encryptedVaultData = await encryptData(baseData, cryptoKey, salt);
    await persistVaultRecord(resolvedFileName, encryptedVaultData);
    return { ...baseData, accounts, templates, metadata };
  } else {
    // Plaintext case
    for (const builtin of BUILTIN_TEMPLATES) {
      await templateTable.create(builtin, undefined);
    }

    // Setup session FIRST so initialize()/loadTemplates() can read from session
    await setupVaultSession({ fileName: resolvedFileName });
    // Autofill 토큰 동기화는 제거됨 - Keystore 기반 인증 사용

    // Now initialize stores from DB
    await initializeStores();

    const accounts = useAccountStore.getState().accounts ?? [];
    const templates = useTemplateStore.getState().templates ?? [];

    const baseData: KiyoVaultData = {
      version: 1,
      fileName: resolvedFileName,
      updatedAt: Date.now(),
      accounts,
      templates,
      metadata,
    };

    await persistVaultRecord(resolvedFileName, baseData);
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

  // 백업만 수행하므로 세션/자동완성/DB 동기화 불필요
  // - 세션 상태 유지 (activeFileName, cryptoKey, salt 변경 안 함)
  // - files 테이블 upsert 안 함 (파일 시스템에만 저장)
  // - replaceDatabaseData, initializeStores 호출 안 함
  if (pin) {
    const { encryptedVaultData } = await createEncryptedVault(data, pin);
    // Save backup to user-chosen location via SAF
    await exportBackupFile(normalizedFileName, encryptedVaultData);
  } else {
    // Plaintext backup: export as-is
    await exportBackupFile(normalizedFileName, data);
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
      { operation: "openImportedDataFile", originalError: error instanceof Error ? error : undefined }
    );
  }

  if (!fileName || typeof fileName !== "string") {
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_FILE_FORMAT,
      "파일 이름이 필요합니다",
      { operation: "openImportedDataFile" }
    );
  }

  const normalizedFileName = normalizeDataFileName(fileName);
  // multi-vault: 중복 fileName은 (1), (2) suffix 자동 부여
  const resolvedFileName = await fileTable.resolveFileName(normalizedFileName);

  // 기존 평문 파일 지원
  if (!isEncryptedKiyoVaultData(parsedData)) {
    if (!isKiyoFile(parsedData)) {
      throw FileStorageError.create(
        FileStorageErrorCode.INVALID_FILE_FORMAT,
        "is not KiyoFile",
        { operation: "openImportedDataFile" }
      );
    }
    // Pipeline for plaintext: persist → session → replaceDatabaseData → initialize
    try {
      await persistVaultRecord(resolvedFileName, parsedData);
      await setupVaultSession({ fileName: resolvedFileName });
      // Autofill 토큰 동기화는 제거됨 - Keystore 기반 인증 사용
      await replaceDatabaseData({
        data: parsedData,
        fileName: resolvedFileName,
        cryptoKey: undefined,
        encryptedFileData: undefined,
      });
      await initializeStores();
    } catch (error) {
      if (isFileStorageError(error)) throw error;
      throw FileStorageError.create(
        FileStorageErrorCode.DATABASE_ERROR,
        "평문 파일 저장 실패",
        { operation: "openImportedDataFile", originalError: error instanceof Error ? error : undefined }
      );
    }
    return { ...parsedData, fileName: resolvedFileName };
  }

  // 파일의 salt로 동일한 CryptoKey 생성
  if (!parsedData.salt || typeof parsedData.salt !== "string") {
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_SALT,
      "암호화된 파일 이지만 salt가 없음",
      { operation: "openImportedDataFile" }
    );
  }

  const salt = fromBase64(parsedData.salt);
  // Validate salt length (should be 16 bytes for AES-GCM)
  if (salt.byteLength !== 16) {
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_SALT,
      "유효하지 않은 salt",
      { operation: "openImportedDataFile" }
    );
  }

  // 1.5단계 파이프라인 함수로 복호화 (PIN_MISMATCH 처리 포함)
  const { decryptedVaultData: decrypted, cryptoKey: key } = await decryptVaultData(
    parsedData,
    pin,
    salt
  );

  // isKiyoFile 검증 실패는 INVALID_DATA_FORMAT으로 별도 처리
  if (!isKiyoFile(decrypted)) {
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_DATA_FORMAT,
      "is not KiyoFile",
      { operation: "openImportedDataFile" }
    );
  }

  // Pipeline for encrypted: persist encrypted file data → session with key → replaceDatabaseData → initialize
  try {
    await persistVaultRecord(resolvedFileName, parsedData);
    await setupVaultSession({ fileName: resolvedFileName, cryptoKey: key, salt });
    // Autofill 토큰 동기화는 제거됨 - Keystore 기반 인증 사용
    // Save decrypted data to DB - 암호화된 파일 데이터(parsedData)를 그대로 전달
    await replaceDatabaseData({
      data: decrypted,
      fileName: resolvedFileName,
      cryptoKey: key,
      encryptedFileData: parsedData,
    });
    await initializeStores();
  } catch (error) {
    if (isFileStorageError(error)) throw error;
    throw FileStorageError.create(
      FileStorageErrorCode.DATABASE_ERROR,
      "데이터베이스 작업 실패",
      { operation: "openImportedDataFile", originalError: error instanceof Error ? error : undefined }
    );
  }

  return { ...decrypted, fileName: resolvedFileName };
};

// PIN 변경: 활성 데이터 파일을 새 PIN으로 재암호화
// currentPin이 빈 문자열인 경우: 암호화되지 않은 파일에 새 PIN으로 암호화 설정
export const changePin = async (fileName: string, newPin: string): Promise<void> => {
  if (!fileName) {
    throw new Error("활성 데이터 파일이 없습니다.");
  }
  const { encrypted } = await fileTable.getFileInfo(fileName);
  const { cryptoKey } = await useSessionStore.getState();

  // cryptoKey를 전달하여 암호화된 레코드 복호화 (특히 templates)
  const fileData: KiyoVaultData = await getDatabaseSnapshot(fileName, cryptoKey ?? undefined);

  if (!cryptoKey && encrypted) {
    // 암호화 키가 없고 salt만 있는 경우 -> 비로그인 상태
    throw new Error("암호화 키 정보가 없습니다.");
  }

  // 새 PIN으로 CryptoKey 생성
  const { key: newKey, salt: newSalt } = await createCryptoKey(newPin);

  // Update session with new key early to avoid transaction issues
  await setupVaultSession({ fileName, cryptoKey: newKey, salt: newSalt });

  // 데이터 암호화
  const encryptedData = await encryptData(fileData, newKey, newSalt);

  // replaceDatabaseData가 files 테이블까지 처리하므로 별도 persistVaultRecord 불필요
  await replaceDatabaseData({
    data: fileData,
    fileName,
    cryptoKey: newKey,
    encryptedFileData: encryptedData,
  });
  await initializeStores();
};