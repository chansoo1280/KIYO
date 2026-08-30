import { assertCryptoAvailable } from "@/crypto/crypto.utils";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // fallback
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  return [...bytes]
    .map((b, i) => {
      const hex = b.toString(16).padStart(2, '0')
      return [4, 6, 8, 10].includes(i) ? `-${hex}` : hex
    })
    .join('')
}

export interface EncryptedRecord {
  version: 1;
  algorithm: "AES-GCM";
  encryptedData: Uint8Array;
  iv: Uint8Array;
  createdAt: number;
  updatedAt: number;
  encrypted: boolean;
}

/**
 * Encrypt any serializable object using AES-GCM
 * Returns encryptedData and iv as Uint8Array for direct IndexedDB storage
 */
export const encryptRecord = async <T>(
  data: T,
  key: CryptoKey,
): Promise<{ encryptedData: Uint8Array; iv: Uint8Array }> => {
  assertCryptoAvailable();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(data));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    plaintext,
  );

  return {
    encryptedData: new Uint8Array(encrypted),
    iv,
  };
};

/**
 * Decrypt an encrypted record back to the original object
 */
export const decryptRecord = async <T>(
  encryptedData: Uint8Array,
  iv: Uint8Array,
  key: CryptoKey,
): Promise<T> => {
  assertCryptoAvailable();

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    new Uint8Array(encryptedData),
  );

  return JSON.parse(decoder.decode(decrypted)) as T;
};

/**
 * Create a full EncryptedRecord object with metadata
 */
export const createEncryptedRecord = async <T>(
  data: T,
  key: CryptoKey,
): Promise<EncryptedRecord> => {
  const now = Date.now();
  const { encryptedData, iv } = await encryptRecord(data, key);

  return {
    version: 1,
    algorithm: "AES-GCM",
    encryptedData,
    iv,
    createdAt: now,
    updatedAt: now,
    encrypted: true,
  };
};

/**
 * Create a plaintext record (for unencrypted storage)
 */
export const createPlaintextRecord = async <T>(
  data: T,
): Promise<EncryptedRecord> => {
  const now = Date.now();
  const plaintextData = new TextEncoder().encode(JSON.stringify(data));

  return {
    version: 1,
    algorithm: "AES-GCM",
    encryptedData: plaintextData,
    iv: new Uint8Array(12),
    createdAt: now,
    updatedAt: now,
    encrypted: false,
  };
};

/**
 * Update an existing EncryptedRecord with new data (preserves createdAt)
 */
export const updateEncryptedRecord = async <T>(
  record: EncryptedRecord,
  data: T,
  key: CryptoKey,
): Promise<EncryptedRecord> => {
  const { encryptedData, iv } = await encryptRecord(data, key);

  return {
    ...record,
    encryptedData,
    iv,
    updatedAt: Date.now(),
  };
};

/**
 * Type guard to check if a value is an EncryptedRecord
 */
export const isEncryptedRecord = (value: unknown): value is EncryptedRecord => {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<EncryptedRecord>;
  return (
    record.version === 1 &&
    record.algorithm === "AES-GCM" &&
    record.encryptedData instanceof Uint8Array &&
    record.iv instanceof Uint8Array &&
    typeof record.createdAt === "number" &&
    typeof record.updatedAt === "number" &&
    typeof record.encrypted === "boolean"
  );
};