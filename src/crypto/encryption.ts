import type { KiyoVaultData } from "@/models/vault";
import { fromBase64, toBase64 } from "@/crypto/crypto.utils";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface EncryptedKiyoVaultData {
  version: 1;
  encrypted: true;
  salt: string;
  iv: string;
  ciphertext: string;
}

export const isEncryptedKiyoVaultData = (
  value: unknown,
): value is EncryptedKiyoVaultData => {
  if (!value || typeof value !== "object") return false;

  const file = value as Partial<EncryptedKiyoVaultData>;
  console.log(JSON.stringify(file));

  return (
    file.version === 1 &&
    file.encrypted === true &&
    typeof file.salt === "string" &&
    typeof file.iv === "string" &&
    typeof file.ciphertext === "string"
  );
};

// PIN → CryptoKey 생성
export async function createCryptoKey(pin: string, salt?: Uint8Array) {
  const keySalt = salt ?? crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(keySalt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  );

  return {
    key,
    salt: keySalt,
  };
}

// 데이터 암호화
export const encryptData = async (
  data: KiyoVaultData,
  key: CryptoKey,
  salt: Uint8Array,
): Promise<EncryptedKiyoVaultData> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encoder.encode(JSON.stringify(data)),
  );

  return {
    version: 1,
    encrypted: true,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
};

// 데이터 복호화
export const decryptData = async (
  encrypted: EncryptedKiyoVaultData,
  key: CryptoKey,
): Promise<KiyoVaultData> => {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromBase64(encrypted.iv),
    },
    key,
    fromBase64(encrypted.ciphertext),
  );

  return JSON.parse(decoder.decode(decrypted)) as KiyoVaultData;
};

export const verifyPin = async (
  data: KiyoVaultData | EncryptedKiyoVaultData,
  pin: string,
): Promise<boolean> => {
  // 데이터가 암호화되어 있지 않다면 에러 발생
  if (!isEncryptedKiyoVaultData(data)) {
    throw new Error("데이터가 암호화되어 있지 않습니다.");
  }

  try {
    // PIN으로 CryptoKey 생성 (저장된 salt 사용)
    const { key } = await createCryptoKey(pin, fromBase64(data.salt));

    // 복호화 시도
    await decryptData(data, key);

    // 복호화 성공 시 true 반환
    return true;
  } catch {
    // 복호화 실패 시 false 반환 (PIN이 틀린 경우)
    return false;
  }
};
