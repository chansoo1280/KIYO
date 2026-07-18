import { describe, it, expect, beforeEach } from "vitest";
import {
  encryptField,
  decryptField,
  encryptAccountSensitiveFields,
  decryptAccountSensitiveFields,
  encryptAccountsSensitiveFields,
  decryptAccountsSensitiveFields,
  hasEncryptedFields,
  migrateAccountToEncrypted,
  migrateAccountsToEncrypted,
  isEncryptedField,
  type EncryptedField,
} from "./fieldEncryption";
import type { Account } from "../models/account";
import { createCryptoKey } from "./encryption";

describe("fieldEncryption", () => {
  let testKey: CryptoKey;
  let testAccount: Account;

  beforeEach(async () => {
    // Create a test crypto key
    const { key } = await createCryptoKey("test-pin-1234");
    testKey = key;

    // Create a test account with various field types
    testAccount = {
      id: 1,
      templateId: 1,
      title: "Test Account",
      description: "Test Description",
      tags: ["test", "work"],
      favorite: false,
      fields: [
        {
          id: "1-1",
          accountId: 1,
          label: "Username",
          type: "text",
          value: "testuser",
          order: 0,
        },
        {
          id: "1-2",
          accountId: 1,
          label: "Password",
          type: "password",
          value: "secretpassword123",
          order: 1,
        },
        {
          id: "1-3",
          accountId: 1,
          label: "Email",
          type: "email",
          value: "test@example.com",
          order: 2,
        },
        {
          id: "1-4",
          accountId: 1,
          label: "Notes",
          type: "textarea",
          value: "Some notes here",
          order: 3,
        },
        {
          id: "1-5",
          accountId: 1,
          label: "Phone",
          type: "number",
          value: "1234567890",
          order: 4,
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      websiteUrl: "https://example.com",
      domain: "example.com",
      packageName: "com.example.app",
    };
  });

  describe("encryptField / decryptField", () => {
    it("should encrypt and decrypt a field value", async () => {
      const value = "secret-value";
      const encrypted = await encryptField(value, testKey);
      
      expect(isEncryptedField(encrypted)).toBe(true);
      expect(encrypted.encrypted).toBe(true);
      expect(typeof encrypted.iv).toBe("string");
      expect(typeof encrypted.ciphertext).toBe("string");
      expect(encrypted.iv.length).toBeGreaterThan(0);
      expect(encrypted.ciphertext.length).toBeGreaterThan(0);

      const decrypted = await decryptField(encrypted, testKey);
      expect(decrypted).toBe(value);
    });

    it("should produce different ciphertext for same value (different IV)", async () => {
      const value = "same-value";
      const encrypted1 = await encryptField(value, testKey);
      const encrypted2 = await encryptField(value, testKey);
      
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      
      // But both should decrypt to the same value
      const decrypted1 = await decryptField(encrypted1, testKey);
      const decrypted2 = await decryptField(encrypted2, testKey);
      expect(decrypted1).toBe(value);
      expect(decrypted2).toBe(value);
    });

    it("should fail to decrypt with wrong key", async () => {
      const value = "secret-value";
      const encrypted = await encryptField(value, testKey);
      
      // Create a different key
      const { key: wrongKey } = await createCryptoKey("wrong-pin");
      
      await expect(decryptField(encrypted, wrongKey)).rejects.toThrow();
    });
  });

  describe("isEncryptedField", () => {
    it("should return true for valid encrypted field", () => {
      const encrypted: EncryptedField = {
        encrypted: true,
        iv: "dGVzdA==",
        ciphertext: "dGVzdA==",
      };
      expect(isEncryptedField(encrypted)).toBe(true);
    });

    it("should return false for plain object", () => {
      expect(isEncryptedField({ value: "plain" })).toBe(false);
    });

    it("should return false for null/undefined", () => {
      expect(isEncryptedField(null)).toBe(false);
      expect(isEncryptedField(undefined)).toBe(false);
    });

    it("should return false for missing properties", () => {
      expect(isEncryptedField({ encrypted: true })).toBe(false);
      expect(isEncryptedField({ iv: "test" })).toBe(false);
      expect(isEncryptedField({ ciphertext: "test" })).toBe(false);
    });

    it("should return false for encrypted: false", () => {
      expect(isEncryptedField({ encrypted: false, iv: "test", ciphertext: "test" })).toBe(false);
    });
  });

  describe("encryptAccountSensitiveFields / decryptAccountSensitiveFields", () => {
    it("should encrypt sensitive fields (password, email, textarea)", async () => {
      const encryptedAccount = await encryptAccountSensitiveFields(testAccount, testKey);
      
      // Check that sensitive fields are encrypted
      const passwordField = encryptedAccount.fields.find(f => f.label === "Password");
      const emailField = encryptedAccount.fields.find(f => f.label === "Email");
      const notesField = encryptedAccount.fields.find(f => f.label === "Notes");
      
      expect(passwordField).toBeDefined();
      expect(emailField).toBeDefined();
      expect(notesField).toBeDefined();
      
      // These should be encrypted (JSON string of EncryptedField)
      expect(() => JSON.parse(passwordField!.value)).not.toThrow();
      expect(() => JSON.parse(emailField!.value)).not.toThrow();
      expect(() => JSON.parse(notesField!.value)).not.toThrow();
      
      const parsedPassword = JSON.parse(passwordField!.value);
      const parsedEmail = JSON.parse(emailField!.value);
      const parsedNotes = JSON.parse(notesField!.value);
      
      expect(isEncryptedField(parsedPassword)).toBe(true);
      expect(isEncryptedField(parsedEmail)).toBe(true);
      expect(isEncryptedField(parsedNotes)).toBe(true);
    });

    it("should NOT encrypt non-sensitive fields (text, number)", async () => {
      const encryptedAccount = await encryptAccountSensitiveFields(testAccount, testKey);
      
      const usernameField = encryptedAccount.fields.find(f => f.label === "Username");
      const phoneField = encryptedAccount.fields.find(f => f.label === "Phone");
      
      expect(usernameField).toBeDefined();
      expect(phoneField).toBeDefined();
      
      // These should remain as plaintext
      expect(usernameField!.value).toBe("testuser");
      expect(phoneField!.value).toBe("1234567890");
    });

    it("should preserve non-field account properties", async () => {
      const encryptedAccount = await encryptAccountSensitiveFields(testAccount, testKey);
      
      expect(encryptedAccount.id).toBe(testAccount.id);
      expect(encryptedAccount.title).toBe(testAccount.title);
      expect(encryptedAccount.description).toBe(testAccount.description);
      expect(encryptedAccount.tags).toEqual(testAccount.tags);
      expect(encryptedAccount.favorite).toBe(testAccount.favorite);
      expect(encryptedAccount.websiteUrl).toBe(testAccount.websiteUrl);
      expect(encryptedAccount.domain).toBe(testAccount.domain);
      expect(encryptedAccount.packageName).toBe(testAccount.packageName);
      expect(encryptedAccount.createdAt).toBe(testAccount.createdAt);
      expect(encryptedAccount.updatedAt).toBe(testAccount.updatedAt);
    });

    it("should decrypt encrypted fields back to original values", async () => {
      const encryptedAccount = await encryptAccountSensitiveFields(testAccount, testKey);
      const decryptedAccount = await decryptAccountSensitiveFields(encryptedAccount, testKey);
      
      // All fields should match original
      expect(decryptedAccount.fields).toHaveLength(testAccount.fields.length);
      
      for (const originalField of testAccount.fields) {
        const decryptedField = decryptedAccount.fields.find(f => f.id === originalField.id);
        expect(decryptedField).toBeDefined();
        expect(decryptedField!.value).toBe(originalField.value);
        expect(decryptedField!.label).toBe(originalField.label);
        expect(decryptedField!.type).toBe(originalField.type);
        expect(decryptedField!.order).toBe(originalField.order);
      }
    });

    it("should handle empty field values", async () => {
      const accountWithEmptyFields: Account = {
        ...testAccount,
        fields: [
          {
            id: "1-1",
            accountId: 1,
            label: "Empty Password",
            type: "password",
            value: "",
            order: 0,
          },
        ],
      };
      
      const encryptedAccount = await encryptAccountSensitiveFields(accountWithEmptyFields, testKey);
      const passwordField = encryptedAccount.fields.find(f => f.label === "Empty Password");
      
      // Empty values should not be encrypted (or should be handled gracefully)
      expect(passwordField).toBeDefined();
      // Empty string should remain as is or be encrypted - let's check behavior
      if (passwordField!.value) {
        const parsed = JSON.parse(passwordField!.value);
        expect(isEncryptedField(parsed)).toBe(true);
      }
    });
  });

  describe("encryptAccountsSensitiveFields / decryptAccountsSensitiveFields", () => {
    it("should encrypt multiple accounts", async () => {
      const accounts = [testAccount, { ...testAccount, id: 2, title: "Account 2" }];
      const encryptedAccounts = await encryptAccountsSensitiveFields(accounts, testKey);
      
      expect(encryptedAccounts).toHaveLength(2);
      expect(encryptedAccounts[0].title).toBe("Test Account");
      expect(encryptedAccounts[1].title).toBe("Account 2");
      
      // Both should have encrypted sensitive fields
      for (const acc of encryptedAccounts) {
        const passwordField = acc.fields.find(f => f.type === "password");
        expect(passwordField).toBeDefined();
        const parsed = JSON.parse(passwordField!.value);
        expect(isEncryptedField(parsed)).toBe(true);
      }
    });

    it("should decrypt multiple accounts", async () => {
      const accounts = [testAccount, { ...testAccount, id: 2, title: "Account 2" }];
      const encryptedAccounts = await encryptAccountsSensitiveFields(accounts, testKey);
      const decryptedAccounts = await decryptAccountsSensitiveFields(encryptedAccounts, testKey);
      
      expect(decryptedAccounts).toHaveLength(2);
      for (let i = 0; i < accounts.length; i++) {
        for (const field of accounts[i].fields) {
          const decryptedField = decryptedAccounts[i].fields.find(f => f.id === field.id);
          expect(decryptedField!.value).toBe(field.value);
        }
      }
    });
  });

  describe("hasEncryptedFields", () => {
    it("should return true for account with encrypted fields", async () => {
      const encryptedAccount = await encryptAccountSensitiveFields(testAccount, testKey);
      expect(hasEncryptedFields(encryptedAccount)).toBe(true);
    });

    it("should return false for account without encrypted fields", () => {
      expect(hasEncryptedFields(testAccount)).toBe(false);
    });
  });

  describe("migrateAccountToEncrypted / migrateAccountsToEncrypted", () => {
    it("should migrate plaintext account to encrypted format", async () => {
      const migratedAccount = await migrateAccountToEncrypted(testAccount, testKey);
      
      expect(hasEncryptedFields(migratedAccount)).toBe(true);
      
      // Verify it can be decrypted back
      const decryptedAccount = await decryptAccountSensitiveFields(migratedAccount, testKey);
      for (const field of testAccount.fields) {
        const decryptedField = decryptedAccount.fields.find(f => f.id === field.id);
        expect(decryptedField!.value).toBe(field.value);
      }
    });

    it("should not re-encrypt already encrypted account", async () => {
      const encryptedAccount = await encryptAccountSensitiveFields(testAccount, testKey);
      const migratedAccount = await migrateAccountToEncrypted(encryptedAccount, testKey);
      
      // Should return the same account (or equivalent)
      expect(migratedAccount).toEqual(encryptedAccount);
    });

    it("should migrate multiple accounts", async () => {
      const accounts = [testAccount, { ...testAccount, id: 2, title: "Account 2" }];
      const migratedAccounts = await migrateAccountsToEncrypted(accounts, testKey);
      
      expect(migratedAccounts).toHaveLength(2);
      for (const acc of migratedAccounts) {
        expect(hasEncryptedFields(acc)).toBe(true);
      }
    });
  });
});