import {
  createCryptoKey,
  decryptData,
  encryptData,
  type EncryptedKiyoVaultData,
} from "@/crypto/encryption";
import type { KiyoVaultData } from "@/models/vault";
import {
  FileStorageError,
  FileStorageErrorCode,
} from "./fileStorage.error";

/**
 * 헌법 제약에 따라 Store 계층을 직접 import하거나 호출하지 않는
 * 순수 데이터 입출력 함수만 포함한다.
 * 스냅샷 구성, 세션 관리, 스토어 분배 등 Store 의존 로직은
 * Vault Persistence Coordinator(vaultPersistence.ts)에서 담당한다.
 */

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
