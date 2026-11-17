import { Capacitor } from "@capacitor/core";
import {
  createCryptoKey,
  encryptData,
  type EncryptedKiyoVaultData,
  isEncryptedKiyoVaultData,
} from "@/crypto/encryption";
import { fromBase64 } from "@/crypto/crypto.utils";
import { registerSaveHandler } from "@/persistence/persistencePort";
import { decryptVaultData, createEncryptedVault, isKiyoFile } from "@/database/fileStorage";
import { fileTable } from "@/database/fileTable";
import {
  exportBackupFile,
  normalizeDataFileName,
  writeBackupToUri,
} from "@/database/fileExport";
import {
  FileStorageError,
  FileStorageErrorCode,
} from "@/database/fileStorage.error";
import { useAccountStore } from "@/store/accountStore";
import { useTemplateStore } from "@/store/templateStore";
import { useMetadataStore } from "@/store/metadataStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import type { KiyoVaultData, FileMetadata } from "@/models/vault";
import { APP_VERSION } from "@/constants/appVersion";
import { devAccounts } from "@/constants/devAccounts";
import { BUILTIN_TEMPLATES } from "@/constants/builtinTemplates";
import { KiyoAutofill } from "@/plugins/kiyautofill";
import { SecureKey } from "@/plugins/kiyosecurekey";

/**
 * Vault Persistence Coordinator (실제 구현)
 * Store 계층과 FileStorage 계층 사이를 중재하는 조정 계층.
 *
 * 헌법 제약:
 * - Store는 FileStorage를 직접 import하거나 호출하지 않음 (persistencePort만 의존)
 * - FileStorage는 Store를 직접 import하거나 호출하지 않음
 * - Store와 FileStorage 간의 모든 상호작용은 이 Coordinator를 통해 수행
 * - 암호화 키(cryptoKey)는 메모리(SecuritySession)에만 보관, 디스크 persist 금지
 * - 볼트 데이터는 KiyoVaultData 전체 객체를 하나의 AES-GCM 블록으로 암호화
 */

/**
 * 각 스토어의 현재 상태를 KiyoVaultData 스냅샷으로 구성한다.
 * 순수 함수: 부작용 없음.
 */
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

/**
 * 볼트 스냅샷을 Dexie IndexedDB에 암호화하여 저장한다.
 * sessionStore의 cryptoKey/salt가 있으면 AES-GCM로 암호화하고,
 * 없으면 평문으로 저장한다.
 * autoBackup이 켜져 있고 SAF URI가 있으면 외부 백업 파일에도 미러링한다.
 */
export async function saveVault(
  fileName: string,
  snapshot: KiyoVaultData
): Promise<void> {
  const session = useSessionStore.getState();
  const settings = useSettingsStore.getState();

  let encrypted: EncryptedKiyoVaultData | KiyoVaultData;
  if (session.cryptoKey && session.salt) {
    encrypted = await encryptData(snapshot, session.cryptoKey, session.salt);
    await fileTable.upsertFileRecord(fileName, encrypted);
  } else {
    encrypted = snapshot;
    await fileTable.upsertFileRecord(fileName, snapshot);
  }

  // 자동백업: 암호화 볼트 + 사용자 선택 SAF URI가 있을 때만 미러링
  if (
    settings.autoBackupEnabled &&
    settings.autoBackupUri &&
    session.cryptoKey &&
    session.salt &&
    Capacitor.isNativePlatform()
  ) {
    try {
      await writeBackupToUri(
        settings.autoBackupUri,
        encrypted,
        fileName ?? undefined
      );
    } catch (error) {
      console.warn(
        "[autoBackup] writeBackupToUri failed:",
        error instanceof Error ? error.message : String(error)
      );
      if (
        error instanceof Error &&
        (error as { errorCode?: string }).errorCode === "PERMISSION_REVOKED"
      ) {
        await settings.setAutoBackupEnabled(false);
      }
    }
  }
}

/**
 * Dexie IndexedDB에서 볼트 데이터를 읽어온다.
 * 파일이 없으면 null을 반환한다.
 */
export async function loadVault(
  fileName: string
): Promise<KiyoVaultData | null> {
  const { encrypted, fileData } = await fileTable.getFileInfo(fileName);
  if (!fileData) {
    return null;
  }

  if (encrypted) {
    // 암호화된 파일은 PIN 기반 복호화가 필요하므로 unlockVault를 사용해야 함
    return null;
  }

  return fileData as KiyoVaultData;
}

/**
 * 현재 볼트의 잠금을 설정한다. 암호화 키를 메모리에서 제거한다.
 */
export async function lockVault(): Promise<void> {
  await useSessionStore.getState().clearCryptoKey();
}

/**
 * 3단계: 세션 스토어에 볼트 정보 저장 (cryptoKey, salt, fileName)
 */
export async function setupVaultSession({
  fileName,
  cryptoKey,
  salt,
}: {
  fileName: string;
  cryptoKey?: CryptoKey;
  salt?: Uint8Array;
}): Promise<void> {
  await useSessionStore.getState().setSession({ fileName, cryptoKey, salt });
}

// db.files → 스토어 (read only, vault 활성화 시점)
export async function loadVaultToStores(decrypted: KiyoVaultData): Promise<void> {
  useAccountStore.getState().init(decrypted.accounts);
  useTemplateStore.getState().init(decrypted.templates);
  useMetadataStore.getState().init(decrypted.metadata);
  useSessionStore.setState({ initialized: true });
}

// 평문 vault 활성화 wrapper (Home plaintext 진입점)
export async function activatePlaintextVault(fileName: string): Promise<void> {
  const info = await fileTable.getFileInfo(fileName);
  if (!info.activeFileName) throw new Error(`File not found: ${fileName}`);
  if (info.encrypted)
    throw new Error("activatePlaintextVault: vault is encrypted, use unlockVault");
  await useSessionStore.getState().setSession({ fileName });
  await loadVaultToStores(info.fileData);
}

// 스토어 → db.files (write only, mutation 발생 시)
export async function saveStoresToFile(): Promise<void> {
  const session = useSessionStore.getState();
  if (!session.activeFileName) return; // no-op
  const data = buildSnapshotFromStores(session.activeFileName);
  await saveVault(session.activeFileName, data);
}

export const closeDataFile = async (): Promise<void> => {
  await useSessionStore.getState().clearSession();
  useAccountStore.getState().clearAccounts();
  useTemplateStore.getState().clearTemplates();
  useMetadataStore.getState().clearMetadata();
  if (Capacitor.getPlatform() === "android") {
    try { await KiyoAutofill.clearAllAccounts(); } catch { /* ignore */ }
    try { await SecureKey.deleteKey(); } catch { /* ignore */ }
  }
};


export async function unlockVault(
  fileName: string,
  pin: string
): Promise<KiyoVaultData | null> {
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
  const resolvedFileName = await fileTable.resolveFileName(normalizedFileName);
  const builtinTemplates = BUILTIN_TEMPLATES.map(
    (t, i) => ({ ...t, id: String(i + 1), createdAt: Date.now(), updatedAt: Date.now() })
  );
  const initialAccounts =
    import.meta.env.DEV && !import.meta.env.VITE_E2E
      ? devAccounts
      : [];
  const initialMetadata: FileMetadata[] = [
    { id: 1, version: APP_VERSION, createdAt: Date.now() },
  ];
  useTemplateStore.getState().init(builtinTemplates);
  useAccountStore.getState().init(initialAccounts);
  useMetadataStore.getState().init(initialMetadata);
  useSessionStore.setState({ initialized: true });
  if (pin) {
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
    await saveStoresToFile();
    return baseData;
  } else {
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
  const data = buildSnapshotFromStores(fileName);
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
  const resolvedFileName = await fileTable.resolveFileName(normalizedFileName);

  if (!isEncryptedKiyoVaultData(parsedData)) {
    if (!isKiyoFile(parsedData)) {
      throw FileStorageError.create(
        FileStorageErrorCode.INVALID_FILE_FORMAT,
        "is not KiyoFile",
        { operation: "openImportedDataFile" }
      );
    }
    await setupVaultSession({ fileName: resolvedFileName });
    await loadVaultToStores(parsedData);
    await fileTable.upsertFileRecord(resolvedFileName, parsedData);
    return { ...parsedData, fileName: resolvedFileName };
  }

  if (!parsedData.salt || typeof parsedData.salt !== "string") {
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_SALT,
      "암호화된 파일 이지만 salt가 없음",
      { operation: "openImportedDataFile" }
    );
  }

  const salt = fromBase64(parsedData.salt);
  if (salt.byteLength !== 16) {
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_SALT,
      "유효하지 않은 salt",
      { operation: "openImportedDataFile" }
    );
  }

  const { decryptedVaultData: decrypted, cryptoKey: key } = await decryptVaultData(
    parsedData,
    pin,
    salt
  );

  if (!isKiyoFile(decrypted)) {
    throw FileStorageError.create(
      FileStorageErrorCode.INVALID_FILE_FORMAT,
      "is not KiyoFile",
      { operation: "openImportedDataFile" }
    );
  }

  await setupVaultSession({ fileName: resolvedFileName, cryptoKey: key, salt });
  await loadVaultToStores(decrypted);
  await fileTable.upsertFileRecord(resolvedFileName, parsedData);
  await saveStoresToFile();
  return { ...decrypted, fileName: resolvedFileName };
};

export const changePin = async (
  fileName: string,
  newPin: string
): Promise<void> => {
  if (!fileName) {
    throw new Error("활성 데이터 파일이 없습니다.");
  }
  const { key: newKey, salt: newSalt } = await createCryptoKey(newPin);
  await setupVaultSession({ fileName, cryptoKey: newKey, salt: newSalt });
  await saveStoresToFile();
};

/**
 * Store의 모든 CRUD 변경 후 자동 저장을 수행하는 핸들러.
 * 각 스토어의 현재 상태를 스냅샷으로 구성해 saveVault로 저장한다.
 */
async function handleSave(): Promise<void> {
  const session = useSessionStore.getState();
  if (!session.activeFileName) return; // no-op

  const snapshot = buildSnapshotFromStores(session.activeFileName);
  await saveVault(session.activeFileName, snapshot);
}

// 모듈 로드 시 저장 핸들러를 persistencePort에 등록한다.
// Store는 persistencePort.requestSave()로만 저장 요청을 보낼 수 있다.
registerSaveHandler(handleSave);
