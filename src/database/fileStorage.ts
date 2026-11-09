import { Capacitor } from "@capacitor/core";
import {
  createCryptoKey,
  decryptData,
  encryptData,
  type EncryptedKiyoVaultData,
} from "@/crypto/encryption";
import { fromBase64 } from "@/crypto/crypto.utils";
import { useSessionStore } from "@/store/sessionStore";
import { fileTable } from "@/database/fileTable";
import { useAccountStore } from "@/store/accountStore";
import { useMetadataStore } from "@/store/metadataStore";
import { useTemplateStore } from "@/store/templateStore";
import {
  FileStorageError,
  FileStorageErrorCode,
  isFileStorageError,
} from "./fileStorage.error";
import { devAccounts } from "@/constants/devAccounts";
import { BUILTIN_TEMPLATES } from "@/constants/builtinTemplates";
import type { KiyoVaultData, FileMetadata } from "@/models/vault";
import { isEncryptedKiyoVaultData } from "@/crypto/encryption";
import { exportBackupFile, normalizeDataFileName } from "./fileExport";
import { KiyoAutofill } from "@/plugins/kiyautofill";
import { SecureKey } from "@/plugins/kiyosecurekey";
import { APP_VERSION } from "@/constants/appVersion";


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
 * 3단계: 세션 스토어에 볼트 정보 저장 (cryptoKey, salt, fileName)
 */
/**
 * Note: Autofill 토큰 동기화는 더 이상 사용되지 않음.
 * Autofill 서비스는 순수하게 Android Keystore 기반 인증에 의존함.
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
  await useSessionStore.getState().setSession({ fileName, cryptoKey, salt });
  // Autofill 토큰 동기화는 제거됨 - Keystore 기반 인증 사용
};

// db.files → 스토어 (read only, vault 활성화 시점)
// decrypted는 caller가 미리 확보한 KiyoVaultData. 함수 내부에서 getFileInfo/decryptData 호출 0.
// 모든 store에 init()을 호출해 명시적으로 데이터 분배 (각 store는 자기 source를 모름).
export async function loadVaultToStores(decrypted: KiyoVaultData): Promise<void> {
  useAccountStore.getState().init(decrypted.accounts);
  useTemplateStore.getState().init(decrypted.templates);
  useMetadataStore.getState().init(decrypted.metadata);
  // Q16: initialized는 sessionStore로 통합 — loadVaultToStores 완료 시 true set
  useSessionStore.setState({ initialized: true });
}

// 평문 vault 활성화 wrapper (Home plaintext 진입점)
export async function activatePlaintextVault(fileName: string): Promise<void> {
  const info = await fileTable.getFileInfo(fileName);
  if (!info.activeFileName) throw new Error(`File not found: ${fileName}`);
  if (info.encrypted) throw new Error("activatePlaintextVault: vault is encrypted, use unlockFile");
  await useSessionStore.getState().setSession({ fileName });
  await loadVaultToStores(info.fileData);
}

// 스토어 → KiyoVaultData JSON 구성 (read-only snapshot builder)
// Q18: saveStoresToFile + backupDataFile 공용 helper. fileName은 caller 책임 (session 또는 인자).
// 각 store의 getAll()로 snapshot 구성. store는 source를 모르고 caller만 orchestration.
export function buildSnapshotFromStores(fileName: string): KiyoVaultData {
  return {
    version: 1,
    fileName,
    updatedAt: Date.now(),
    accounts: useAccountStore.getState().getAll(),
    templates: useTemplateStore.getState().getAll(),
    metadata: useMetadataStore.getState().getAll(),
  };
}

// 스토어 → db.files (write only, mutation 발생 시)
// 각 store의 getAll()로 snapshot 구성. store는 source를 모르고 caller만 orchestration.
export async function saveStoresToFile(): Promise<void> {
  const session = useSessionStore.getState();
  if (!session.activeFileName) return; // no-op
  const data = buildSnapshotFromStores(session.activeFileName);
  if (session.cryptoKey && session.salt) {
    const encrypted = await encryptData(data, session.cryptoKey, session.salt);
    await fileTable.upsertFileRecord(session.activeFileName, encrypted);
  } else {
    await fileTable.upsertFileRecord(session.activeFileName, data);
  }
}

export const closeDataFile = async (): Promise<void> => {
  await useSessionStore.getState().clearSession();  // session 전부 clear — initialized:false 포함 (Q16)
  useAccountStore.getState().clearAccounts();  // accounts:[]
  useTemplateStore.getState().clearTemplates();
  useMetadataStore.getState().clearMetadata();
  if (Capacitor.getPlatform() === "android") {
    try { await KiyoAutofill.clearAllAccounts(); } catch { /* ignore */ }
    try { await SecureKey.deleteKey(); } catch { /* ignore */ }
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
  if (encrypted) {
    if (!salt) {
      throw new Error(`Salt missing for encrypted file: ${fileName}`);
    }
    const { decryptedVaultData: decrypted, cryptoKey } = await decryptVaultData(
      fileData,
      pin,
      salt
    );
    await setupVaultSession({ fileName, cryptoKey, salt });
    await loadVaultToStores(decrypted);
    return decrypted;
  } else {
    // No cryptoKey or salt for plaintext
    await setupVaultSession({ fileName });
    await loadVaultToStores(fileData);
    return fileData;
  }
};

export const createDataFile = async (
  fileName: string,
  pin?: string
): Promise<KiyoVaultData> => {
  const normalizedFileName = normalizeDataFileName(fileName);
  // multi-vault: 중복 fileName은 (1), (2) suffix 자동 부여
  const resolvedFileName = await fileTable.resolveFileName(normalizedFileName);
  const builtinTemplates = BUILTIN_TEMPLATES.map((t, i) => ({ ...t, id: String(i+1), createdAt: Date.now(), updatedAt: Date.now() }));
  // dev seed: accountStore.init(devAccounts) if DEV && !VITE_E2E
  const initialAccounts = (import.meta.env.DEV && !import.meta.env.VITE_E2E) ? devAccounts : [];
  const initialMetadata: FileMetadata[] = [{ id: 1, version: APP_VERSION, createdAt: Date.now() }];
  useTemplateStore.getState().init(builtinTemplates);
  useAccountStore.getState().init(initialAccounts);
  useMetadataStore.getState().init(initialMetadata);
  useSessionStore.setState({ initialized: true });
  if (pin) {
    // For PIN case, we need cryptoKey to create templates
    // Use the SAME key/salt for both template encryption and vault encryption
    const { key: cryptoKey, salt } = await createCryptoKey(pin);

    await setupVaultSession({ fileName: resolvedFileName, cryptoKey, salt });

    const baseData: KiyoVaultData = {
      version: 1,
      fileName: resolvedFileName,
      updatedAt: Date.now(),
      accounts: initialAccounts,
      templates: builtinTemplates,
      metadata: initialMetadata,
    };
    const encryptedVaultData = await encryptData(baseData, cryptoKey, salt);
    await fileTable.upsertFileRecord(resolvedFileName, encryptedVaultData);
    return baseData;
  } else {
    // Plaintext case
    await setupVaultSession({ fileName: resolvedFileName });

    const baseData: KiyoVaultData = {
      version: 1,
      fileName: resolvedFileName,
      updatedAt: Date.now(),
      accounts: initialAccounts,
      templates: builtinTemplates,
      metadata: initialMetadata,
    };

    await fileTable.upsertFileRecord(resolvedFileName, baseData);
    return baseData;
  }
};

export const backupDataFile = async (
  fileName: string,
  pin?: string
): Promise<KiyoVaultData> => {
  const session = useSessionStore.getState();
  if (!session.activeFileName) throw new Error("활성 데이터 파일이 없습니다.");

  const data = buildSnapshotFromStores(fileName);  // Q18 helper

  if (pin) {
    const { encryptedVaultData } = await createEncryptedVault(data, pin);
    await exportBackupFile(fileName, encryptedVaultData);
  } else {
    await exportBackupFile(fileName, data);
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
      FileStorageErrorCode.INVALID_FILE_FORMAT,
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
    // Pipeline for plaintext: persist → session → loadVaultToStores
    try {
      await setupVaultSession({ fileName: resolvedFileName });
      // Autofill 토큰 동기화는 제거됨 - Keystore 기반 인증 사용
      await loadVaultToStores(parsedData);
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

  // isKiyoFile 검증 실패는 INVALID_FILE_FORMAT으로 별도 처리
  if (!isKiyoFile(decrypted)) {
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_FILE_FORMAT,
      "is not KiyoFile",
      { operation: "openImportedDataFile" }
    );
  }

  // Pipeline for encrypted: persist encrypted file data → session with key → loadVaultToStores
  try {
    await setupVaultSession({ fileName: resolvedFileName, cryptoKey: key, salt });
    // Autofill 토큰 동기화는 제거됨 - Keystore 기반 인증 사용
    await loadVaultToStores(decrypted);
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

  // 현재 메모리 상태를 새 키로 재암호화
  const { key: newKey, salt: newSalt } = await createCryptoKey(newPin);
  await setupVaultSession({ fileName, cryptoKey: newKey, salt: newSalt });
  await saveStoresToFile();
};

