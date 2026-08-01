import { describe, it, expect, beforeEach } from "vitest";
import { createCryptoKey } from "@/crypto/encryption";
import {
  encryptRecord,
  decryptRecord,
  createEncryptedRecord,
  updateEncryptedRecord,
  isEncryptedRecord,
} from "@/crypto/recordEncryption";

describe("accountEncryption", () => {
  let key: CryptoKey;

  beforeEach(async () => {
    const result = await createCryptoKey("test-pin-1234");
    key = result.key;
  });

  describe("encryptRecord / decryptRecord", () => {
    it("should encrypt and decrypt a simple object", async () => {
      const data = { name: "test", value: 123, nested: { foo: "bar" } };
      const { encryptedData, iv } = await encryptRecord(data, key);
      const decrypted = await decryptRecord<typeof data>(encryptedData, iv, key);

      expect(decrypted).toEqual(data);
    });

    it("should encrypt and decrypt an Account-like object", async () => {
      const account = {
        id: 1,
        templateId: 1,
        title: "Naver",
        description: "Main account",
        tags: ["email", "personal"],
        favorite: true,
        fields: [
          { id: "1-1", label: "아이디", type: "text", value: "user@naver.com", order: 0 },
          { id: "1-2", label: "비밀번호", type: "password", value: "secret123", order: 1 },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        websiteUrl: "https://naver.com",
        domain: "naver.com",
        packageName: "com.nhn.android.search",
      };

      const { encryptedData, iv } = await encryptRecord(account, key);
      const decrypted = await decryptRecord<typeof account>(encryptedData, iv, key);

      expect(decrypted).toEqual(account);
    });

    it("should encrypt and decrypt a Template-like object", async () => {
      const template = {
        id: "template-1",
        name: "웹사이트 로그인",
        fields: [
          { id: "f1", label: "아이디", type: "text", value: "", order: 0, options: [] },
          { id: "f2", label: "비밀번호", type: "password", value: "", order: 1, options: [] },
        ],
        sortOrder: 0,
        updatedAt: Date.now(),
      };

      const { encryptedData, iv } = await encryptRecord(template, key);
      const decrypted = await decryptRecord<typeof template>(encryptedData, iv, key);

      expect(decrypted).toEqual(template);
    });

    it("should produce different ciphertext for same data (random IV)", async () => {
      const data = { test: "value" };
      const { encryptedData: enc1, iv: iv1 } = await encryptRecord(data, key);
      const { encryptedData: enc2, iv: iv2 } = await encryptRecord(data, key);

      expect(enc1).not.toEqual(enc2);
      expect(iv1).not.toEqual(iv2);
    });

    it("should fail to decrypt with wrong key", async () => {
      const data = { secret: "data" };
      const { encryptedData, iv } = await encryptRecord(data, key);

      const wrongKeyResult = await createCryptoKey("wrong-pin");
      await expect(decryptRecord(encryptedData, iv, wrongKeyResult.key)).rejects.toThrow();
    });

    it("should fail to decrypt with wrong IV", async () => {
      const data = { secret: "data" };
      const { encryptedData } = await encryptRecord(data, key);
      const wrongIv = crypto.getRandomValues(new Uint8Array(12));

      await expect(decryptRecord(encryptedData, wrongIv, key)).rejects.toThrow();
    });
  });

  describe("createEncryptedRecord", () => {
    it("should create record with correct structure", async () => {
      const data = { test: "value" };
      const record = await createEncryptedRecord(data, key);

      expect(record.version).toBe(1);
      expect(record.algorithm).toBe("AES-GCM");
      expect(record.encryptedData).toBeInstanceOf(Uint8Array);
      expect(record.iv).toBeInstanceOf(Uint8Array);
      expect(record.encryptedData.length).toBeGreaterThan(0);
      expect(record.iv.length).toBe(12);
      expect(typeof record.createdAt).toBe("number");
      expect(typeof record.updatedAt).toBe("number");
      expect(record.createdAt).toBe(record.updatedAt);
    });

    it("should be decryptable", async () => {
      const data = { test: "value" };
      const record = await createEncryptedRecord(data, key);
      const decrypted = await decryptRecord(record.encryptedData, record.iv, key);

      expect(decrypted).toEqual(data);
    });
  });

  describe("updateEncryptedRecord", () => {
    it("should update record with new data and preserve createdAt", async () => {
      const originalData = { value: "original" };
      const record = await createEncryptedRecord(originalData, key);
      const originalCreatedAt = record.createdAt;

      // Small delay to ensure updatedAt changes
      await new Promise((r) => setTimeout(r, 10));

      const updatedData = { value: "updated" };
      const updatedRecord = await updateEncryptedRecord(record, updatedData, key);

      expect(updatedRecord.createdAt).toBe(originalCreatedAt);
      expect(updatedRecord.updatedAt).toBeGreaterThan(originalCreatedAt);
      expect(updatedRecord.encryptedData).not.toEqual(record.encryptedData);
      expect(updatedRecord.iv).not.toEqual(record.iv);

      const decrypted = await decryptRecord(
        updatedRecord.encryptedData,
        updatedRecord.iv,
        key,
      );
      expect(decrypted).toEqual(updatedData);
    });
  });

  describe("isEncryptedRecord", () => {
    it("should return true for valid EncryptedRecord", async () => {
      const record = await createEncryptedRecord({ test: "value" }, key);
      expect(isEncryptedRecord(record)).toBe(true);
    });

    it("should return false for plain object", () => {
      expect(isEncryptedRecord({ test: "value" })).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(isEncryptedRecord(null)).toBe(false);
      expect(isEncryptedRecord(undefined)).toBe(false);
    });

    it("should return false for wrong version", async () => {
      const record = await createEncryptedRecord({ test: "value" }, key);
      const badRecord = { ...record, version: 2 };
      expect(isEncryptedRecord(badRecord)).toBe(false);
    });

    it("should return false for wrong algorithm", async () => {
      const record = await createEncryptedRecord({ test: "value" }, key);
      const badRecord = { ...record, algorithm: "AES-CBC" as const };
      expect(isEncryptedRecord(badRecord)).toBe(false);
    });

    it("should return false for missing encryptedData", async () => {
      const record = await createEncryptedRecord({ test: "value" }, key);
      const badRecord = { ...record, encryptedData: "not-uint8array" as unknown };
      expect(isEncryptedRecord(badRecord)).toBe(false);
    });
  });
});