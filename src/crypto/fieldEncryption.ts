import { fromBase64, toBase64 } from "./crypto.utils";
import { isEncryptedType } from "../types/fieldTypes";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Encrypted field structure for individual field encryption
 */
export interface EncryptedField {
  encrypted: true;
  iv: string;
  ciphertext: string;
}

/**
 * Type guard to check if a value is an encrypted field
 */
export const isEncryptedField = (value: unknown): value is EncryptedField => {
  if (!value || typeof value !== "object") return false;
  const field = value as Partial<EncryptedField>;
  return (
    field.encrypted === true &&
    typeof field.iv === "string" &&
    typeof field.ciphertext === "string"
  );
};

/**
 * Encrypt a single field value using AES-GCM
 */
export const encryptField = async (
  value: string,
  key: CryptoKey,
): Promise<EncryptedField> => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encoder.encode(value),
  );

  return {
    encrypted: true,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
};

/**
 * Decrypt a single field value using AES-GCM
 */
export const decryptField = async (
  encrypted: EncryptedField,
  key: CryptoKey,
): Promise<string> => {
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: fromBase64(encrypted.iv),
    },
    key,
    fromBase64(encrypted.ciphertext),
  );

  return decoder.decode(decrypted);
};

/**
 * Encrypt sensitive fields in an Account object
 * Sensitive fields are determined by field type: password, totp, secureText, secureTextarea
 */
export const encryptAccountSensitiveFields = async (
  account: import("../models/account").Account,
  key: CryptoKey,
): Promise<import("../models/account").Account> => {
  const encryptedFields = await Promise.all(
    account.fields.map(async (field) => {
      const isSensitive = isEncryptedType(field.type);

      if (isSensitive && field.value) {
        const encryptedValue = await encryptField(field.value, key);
        return {
          ...field,
          value: JSON.stringify(encryptedValue), // Store encrypted field as JSON string
        };
      }
      return field;
    }),
  );

  return {
    ...account,
    fields: encryptedFields,
  };
};

/**
 * Decrypt sensitive fields in an Account object
 */
export const decryptAccountSensitiveFields = async (
  account: import("../models/account").Account,
  key: CryptoKey,
): Promise<import("../models/account").Account> => {
  const decryptedFields = await Promise.all(
    account.fields.map(async (field) => {
      try {
        // Try to parse as encrypted field
        const parsed = JSON.parse(field.value);
        if (isEncryptedField(parsed)) {
          const decryptedValue = await decryptField(parsed, key);
          return {
            ...field,
            value: decryptedValue,
          };
        }
      } catch {
        // Not an encrypted field, keep as is
      }
      return field;
    }),
  );

  return {
    ...account,
    fields: decryptedFields,
  };
};

/**
 * Encrypt sensitive fields for multiple accounts
 */
export const encryptAccountsSensitiveFields = async (
  accounts: import("../models/account").Account[],
  key: CryptoKey,
): Promise<import("../models/account").Account[]> => {
  return Promise.all(accounts.map((account) => encryptAccountSensitiveFields(account, key)));
};

/**
 * Decrypt sensitive fields for multiple accounts
 */
export const decryptAccountsSensitiveFields = async (
  accounts: import("../models/account").Account[],
  key: CryptoKey,
): Promise<import("../models/account").Account[]> => {
  return Promise.all(accounts.map((account) => decryptAccountSensitiveFields(account, key)));
};

/**
 * Check if an account has encrypted fields
 */
export const hasEncryptedFields = (account: import("../models/account").Account): boolean => {
  return account.fields.some((field) => {
    try {
      const parsed = JSON.parse(field.value);
      return isEncryptedField(parsed);
    } catch {
      return false;
    }
  });
};

/**
 * Migrate plaintext account fields to encrypted format
 * This is used for migrating existing plaintext data
 */
export const migrateAccountToEncrypted = async (
  account: import("../models/account").Account,
  key: CryptoKey,
): Promise<import("../models/account").Account> => {
  // Check if already encrypted
  if (hasEncryptedFields(account)) {
    return account;
  }
  return encryptAccountSensitiveFields(account, key);
};

/**
 * Migrate multiple accounts to encrypted format
 */
export const migrateAccountsToEncrypted = async (
  accounts: import("../models/account").Account[],
  key: CryptoKey,
): Promise<import("../models/account").Account[]> => {
  return Promise.all(accounts.map((account) => migrateAccountToEncrypted(account, key)));
};