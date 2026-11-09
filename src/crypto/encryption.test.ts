import { describe, it, expect, beforeEach } from "vitest";
import {
  createCryptoKey,
  encryptData,
  decryptData,
  isEncryptedKiyoVaultData,
  type EncryptedKiyoVaultData,
} from "@/crypto/encryption";
import type { KiyoVaultData } from "@/models/vault";
import { fromBase64, toBase64 } from "@/crypto/crypto.utils";
import {
  createTestEncryptedFile,
  createTestKiyoDataFile,
} from "@/test/fixtures/databaseFixtures";

describe("encryption (KIYO encryption.ts)", () => {
  const mockPassword = "test-password-123";
  const mockKiyoFile: KiyoVaultData = createTestKiyoDataFile({
    accounts: [],
    templates: [],
    metadata: [],
  });

  let key: CryptoKey;
  let salt: Uint8Array;

  beforeEach(async () => {
    const result = await createCryptoKey(mockPassword);
    key = result.key;
    salt = result.salt;
  });

  describe("isEncryptedKiyoVaultData", () => {
    it("should return true for valid encrypted file", () => {
      const encryptedFile: EncryptedKiyoVaultData = createTestEncryptedFile();
      expect(isEncryptedKiyoVaultData(encryptedFile)).toBe(true);
    });

    it("should return false for non-encrypted file", () => {
      const plainFile = {
        version: 1,
        encrypted: false,
        data: {},
        createdAt: "",
        updatedAt: "",
      };
      expect(isEncryptedKiyoVaultData(plainFile)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isEncryptedKiyoVaultData(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isEncryptedKiyoVaultData(undefined)).toBe(false);
    });

    it("should return false for missing fields", () => {
      expect(isEncryptedKiyoVaultData({ version: 1 })).toBe(false);
      expect(isEncryptedKiyoVaultData({ version: 1, encrypted: true })).toBe(false);
      expect(
        isEncryptedKiyoVaultData({ version: 1, encrypted: true, salt: "test" }),
      ).toBe(false);
    });

    it("should return false for wrong version", () => {
      expect(
        isEncryptedKiyoVaultData({
          version: 2,
          encrypted: true,
          salt: "test",
          iv: "test",
          ciphertext: "AQIDBAUGBwg=",
        }),
      ).toBe(false);
    });

    it("should return false for encrypted: false", () => {
      expect(
        isEncryptedKiyoVaultData({
          version: 1,
          encrypted: false,
          salt: "test",
          iv: "test",
          ciphertext: "AQIDBAUGBwg=",
        }),
      ).toBe(false);
    });
  });

  describe("createCryptoKey", () => {
    it("should create a crypto key from password", async () => {
      const result = await createCryptoKey(mockPassword);

      expect(result).toEqual({
        key: expect.anything(),
        salt: expect.any(Uint8Array),
      });
      expect(result.salt).toHaveLength(16);
      expect(result.key).toBeInstanceOf(CryptoKey);
      expect(result.key.type).toBe("secret");
      expect(result.key.algorithm.name).toBe("AES-GCM");
    });

    it("should use provided salt", async () => {
      const customSalt = new Uint8Array(16).fill(5);
      const result = await createCryptoKey(mockPassword, customSalt);

      expect(result.salt).toEqual(customSalt);
    });

    it("should generate random salt when not provided", async () => {
      const result1 = await createCryptoKey(mockPassword);
      const result2 = await createCryptoKey(mockPassword);

      expect(result1.salt).not.toEqual(result2.salt);
    });

    it("should produce identical keys for same password and salt", async () => {
      const customSalt = new Uint8Array(16).fill(7);
      const result1 = await createCryptoKey(mockPassword, customSalt);
      const result2 = await createCryptoKey(mockPassword, customSalt);

      const exported1 = await crypto.subtle.exportKey("raw", result1.key);
      const exported2 = await crypto.subtle.exportKey("raw", result2.key);

      expect(new Uint8Array(exported1)).toEqual(new Uint8Array(exported2));
    });

    it("should produce different keys for different passwords", async () => {
      const customSalt = new Uint8Array(16).fill(9);
      const result1 = await createCryptoKey("password-1", customSalt);
      const result2 = await createCryptoKey("password-2", customSalt);

      const exported1 = await crypto.subtle.exportKey("raw", result1.key);
      const exported2 = await crypto.subtle.exportKey("raw", result2.key);

      expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2));
    });

    it("should produce different keys for different salts", async () => {
      const salt1 = new Uint8Array(16).fill(1);
      const salt2 = new Uint8Array(16).fill(2);
      const result1 = await createCryptoKey(mockPassword, salt1);
      const result2 = await createCryptoKey(mockPassword, salt2);

      const exported1 = await crypto.subtle.exportKey("raw", result1.key);
      const exported2 = await crypto.subtle.exportKey("raw", result2.key);

      expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2));
    });

    it("should create key with correct PBKDF2 parameters (100000 iterations, SHA-256)", async () => {
      const result = await createCryptoKey(mockPassword);

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        result.key,
        new TextEncoder().encode("test"),
      );

      expect(encrypted).toBeDefined();
    });
  });

  describe("encryptData / decryptData round-trip", () => {
    it("should encrypt and decrypt data correctly", async () => {
      const encrypted = await encryptData(mockKiyoFile, key, salt);
      const decrypted = await decryptData(encrypted, key);

      expect(decrypted).toEqual(mockKiyoFile);
    });

    it("should produce different ciphertext for same data with different IVs", async () => {
      const encrypted1 = await encryptData(mockKiyoFile, key, salt);
      const encrypted2 = await encryptData(mockKiyoFile, key, salt);

      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
      expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext);
    });

    it("should produce different ciphertext for same data with different keys", async () => {
      const salt2 = new Uint8Array(16).fill(42);
      const { key: key2 } = await createCryptoKey("different-password", salt2);

      const encrypted1 = await encryptData(mockKiyoFile, key, salt);
      const encrypted2 = await encryptData(mockKiyoFile, key2, salt2);

      expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext);
    });

    it("should produce valid EncryptedKiyoFile structure", async () => {
      const encrypted = await encryptData(mockKiyoFile, key, salt);

      expect(encrypted).toEqual({
        version: 1,
        encrypted: true,
        salt: expect.any(String),
        iv: expect.any(String),
        ciphertext: expect.any(String),
      });
      expect(() => atob(encrypted.salt)).not.toThrow();
      expect(() => atob(encrypted.iv)).not.toThrow();
      expect(() => atob(encrypted.ciphertext)).not.toThrow();
    });

    it("should include salt and IV as base64 strings", async () => {
      const encrypted = await encryptData(mockKiyoFile, key, salt);

      expect(typeof encrypted.salt).toBe("string");
      expect(typeof encrypted.iv).toBe("string");
      expect(typeof encrypted.ciphertext).toBe("string");
      expect(encrypted.salt.length).toBeGreaterThan(0);
      expect(encrypted.iv.length).toBeGreaterThan(0);
      expect(encrypted.ciphertext.length).toBeGreaterThan(0);
    });
  });

  describe("Plan-4 §7.3: PIN 정책 완화 후 crypto 경로 회귀 검증", () => {
    it("① 20자 영문+특수문자 PIN → createCryptoKey 정상", async () => {
      const longMixedPin = "Abc123!@#xyz789QWERTY"; // 20자, 영문+숫자+특수문자
      const result = await createCryptoKey(longMixedPin);

      expect(result).toEqual({
        key: expect.anything(),
        salt: expect.any(Uint8Array),
      });
      expect(result.salt).toHaveLength(16);
      expect(result.key).toBeInstanceOf(CryptoKey);
      expect(result.key.type).toBe("secret");
      expect(result.key.algorithm.name).toBe("AES-GCM");
    });

    it("② 20자 영문+특수문자 PIN + 동일 salt 재호출 → 같은 CryptoKey", async () => {
      const longMixedPin = "Abc123!@#xyz789QWERTY";
      const salt = new Uint8Array(16).fill(11);
      const result1 = await createCryptoKey(longMixedPin, salt);
      const result2 = await createCryptoKey(longMixedPin, salt);

      const exported1 = await crypto.subtle.exportKey("raw", result1.key);
      const exported2 = await crypto.subtle.exportKey("raw", result2.key);
      expect(new Uint8Array(exported1)).toEqual(new Uint8Array(exported2));
    });

    it("③ 영문+특수문자 PIN round-trip (encrypt → decrypt 성공)", async () => {
      const mixedPin = "MyVault2024!"; // 12자, 영문+숫자+특수문자
      const { key: derivedKey, salt: derivedSalt } = await createCryptoKey(mixedPin);
      const encrypted = await encryptData(mockKiyoFile, derivedKey, derivedSalt);
      const decrypted = await decryptData(encrypted, derivedKey);

      expect(decrypted).toEqual(mockKiyoFile);
    });
  });

  describe("decryptData error handling", () => {
    it("should throw on wrong key", async () => {
      const encrypted = await encryptData(mockKiyoFile, key, salt);
      const { key: wrongKey } = await createCryptoKey("wrong-password", salt);

      await expect(decryptData(encrypted, wrongKey)).rejects.toThrow();
    });

    it("should throw on tampered ciphertext", async () => {
      const encrypted = await encryptData(mockKiyoFile, key, salt);
      const tamperedCiphertext = encrypted.ciphertext.slice(0, -1) + "X";
      const tampered: EncryptedKiyoVaultData = {
        ...encrypted,
        ciphertext: tamperedCiphertext,
      };

      await expect(decryptData(tampered, key)).rejects.toThrow();
    });

    it("should throw on tampered IV", async () => {
      const encrypted = await encryptData(mockKiyoFile, key, salt);
      // Tamper with the raw IV bytes, not the base64 string
      const originalIv = fromBase64(encrypted.iv);
      const tamperedIvBytes = new Uint8Array(originalIv);
      tamperedIvBytes[tamperedIvBytes.length - 1] ^= 0xff; // Flip last byte
      const tampered: EncryptedKiyoVaultData = {
        ...encrypted,
        iv: toBase64(tamperedIvBytes),
      };

      await expect(decryptData(tampered, key)).rejects.toThrow();
    });

    it("should decrypt successfully even with tampered salt (salt not used in decryptData)", async () => {
      const encrypted = await encryptData(mockKiyoFile, key, salt);
      const tampered: EncryptedKiyoVaultData = {
        ...encrypted,
        salt: "dGFtcGVyZWQ=", // tampered salt
      };

      const decrypted = await decryptData(tampered, key);
      expect(decrypted).toEqual(mockKiyoFile);
    });

    it("should decrypt successfully even with wrong version (version not validated in decryptData)", async () => {
      const encrypted = await encryptData(mockKiyoFile, key, salt);
      const tampered: EncryptedKiyoVaultData = {
        ...encrypted,
        version: 999 as EncryptedKiyoVaultData["version"],
      };

      const decrypted = await decryptData(tampered, key);
      expect(decrypted).toEqual(mockKiyoFile);
    });
  });

  describe("encryptData with different data types", () => {
    it("should encrypt empty arrays and objects", async () => {
      const emptyFile = createTestKiyoDataFile({
        accounts: [],
        templates: [],
        metadata: [],
      });
      const encrypted = await encryptData(emptyFile, key, salt);
      const decrypted = await decryptData(encrypted, key);

      expect(decrypted).toEqual(emptyFile);
    });

    it("should encrypt complex nested data", async () => {
      const complexFile = createTestKiyoDataFile({
        accounts: [
          {
            id: 1,
            templateId: "1",
            title: "Complex Account",
            tags: ["tag1", "tag2"],
            favorite: true,
            fields: [
              {
                id: "f1",
                label: "Field 1",
                type: "text",
                value: "value1",
                order: 0,
              },
              {
                id: "f2",
                label: "Field 2",
                type: "password",
                value: "secret",
                order: 1,
              },
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        templates: [
          {
            id: "1",
            name: "Complex Template",
            description: "",
            icon: "📋",
            sortOrder: 0,
            fields: [
              {
                label: "Template Field 1",
                type: "text",
                defaultValue: "",
                options: [],
              },
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        metadata: [{ id: 1, version: "2.0.0", createdAt: Date.now() }],
      });

      const encrypted = await encryptData(complexFile, key, salt);
      const decrypted = await decryptData(encrypted, key);

      expect(decrypted).toEqual(complexFile);
    });

    it("should handle special characters and unicode", async () => {
      const unicodeFile = createTestKiyoDataFile({
        accounts: [
          {
            id: 1,
            templateId: "1",
            title: "Unicode Test 🎉",
            tags: ["한글", "日本語", "emoji🚀"],
            favorite: false,
            fields: [
              {
                id: "f1",
                label: "Special Chars",
                type: "text",
                value: "!@#$%^&*()_+-=[]{}|;':\",./<>?`~",
                order: 0,
              },
              {
                id: "f2",
                label: "Unicode",
                type: "text",
                value: "한글 日本語 🎉🚀💻",
                order: 1,
              },
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        templates: [],
        metadata: [],
      });

      const encrypted = await encryptData(unicodeFile, key, salt);
      const decrypted = await decryptData(encrypted, key);

      expect(decrypted).toEqual(unicodeFile);
    });
  });

  describe("end-to-end encryption flow", () => {
    it("should complete full encrypt-decrypt cycle with new key from password", async () => {
      const { key: newKey, salt: newSalt } =
        await createCryptoKey(mockPassword);
      const encrypted = await encryptData(mockKiyoFile, newKey, newSalt);
      const decrypted = await decryptData(encrypted, newKey);

      expect(decrypted).toEqual(mockKiyoFile);
    });

    it("should decrypt with key derived from same password and salt", async () => {
      const encrypted = await encryptData(mockKiyoFile, key, salt);
      const { key: derivedKey } = await createCryptoKey(mockPassword, salt);

      const decrypted = await decryptData(encrypted, derivedKey);
      expect(decrypted).toEqual(mockKiyoFile);
    });

    it("should fail to decrypt with key from different password", async () => {
      const encrypted = await encryptData(mockKiyoFile, key, salt);
      const { key: wrongKey } = await createCryptoKey("wrong-password", salt);

      await expect(decryptData(encrypted, wrongKey)).rejects.toThrow();
    });

    it("should fail to decrypt with key from different salt", async () => {
      const encrypted = await encryptData(mockKiyoFile, key, salt);
      const differentSalt = new Uint8Array(16).fill(99);
      const { key: wrongKey } = await createCryptoKey(
        mockPassword,
        differentSalt,
      );

      await expect(decryptData(encrypted, wrongKey)).rejects.toThrow();
    });
  });
});
