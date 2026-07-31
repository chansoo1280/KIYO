import { db } from "./db";
import type { Account } from "../models/account";
import { encryptAccountsSensitiveFields, decryptAccountsSensitiveFields, hasEncryptedFields } from "../crypto/fieldEncryption";

export const accountTable = {
  /**
   * Get all accounts, decrypting sensitive fields if cryptoKey is provided
   */
  async getAll(cryptoKey?: CryptoKey): Promise<Account[]> {
    const accounts = await db.accounts.orderBy("updatedAt").reverse().toArray();

    if (cryptoKey && accounts.length > 0) {
      const hasEncrypted = accounts.some(hasEncryptedFields);
      if (hasEncrypted) {
        try {
          return await decryptAccountsSensitiveFields(accounts, cryptoKey);
        } catch (error) {
          console.error("Failed to decrypt account fields:", error);
          return accounts;
        }
      }
    }

    return accounts;
  },

  /**
   * Get account by ID
   */
  async getById(id: number): Promise<Account | undefined> {
    return db.accounts.get(id);
  },

  /**
   * Create a new account
   * Does NOT handle encryption - caller should call saveAll after if needed
   */
  async create(account: Omit<Account, "id" | "createdAt" | "updatedAt">): Promise<Account> {
    const now = Date.now();
    const newAccount = await db.transaction("rw", db.accounts, async () => {
      const lastAccount = await db.accounts.orderBy("id").last();
      const id = (lastAccount?.id ?? 0) + 1;
      const createdAccount: Account = {
        ...account,
        id,
        createdAt: now,
        updatedAt: now,
        fields: account.fields.map((field, index) => ({
          ...field,
          id: `${id}-${index + 1}`,
          accountId: id,
        })),
      };
      await db.accounts.add(createdAccount);
      return createdAccount;
    });

    return newAccount;
  },

  /**
   * Update an account
   * Does NOT handle encryption - caller should call saveAll after if needed
   */
  async update(account: Account): Promise<void> {
    const updatedAccount = { ...account, updatedAt: Date.now() };
    await db.accounts.put(updatedAccount);
  },

  /**
   * Delete an account
   * Does NOT handle encryption - caller should call saveAll after if needed
   */
  async delete(id: number): Promise<void> {
    await db.accounts.delete(id);
  },

  /**
   * Save all accounts with optional field-level encryption
   * This is the single place where encryption happens for accounts
   */
  async saveAll(accounts: Account[], cryptoKey?: CryptoKey): Promise<void> {
    let accountsToSave = accounts;

    if (cryptoKey && accounts.length > 0) {
      try {
        accountsToSave = await encryptAccountsSensitiveFields(accounts, cryptoKey);
      } catch (error) {
        console.error("Failed to encrypt account fields:", error);
      }
    }

    await db.accounts.bulkPut(accountsToSave);
  },

  /**
   * Clear all accounts (used for logout/switch file)
   */
  async clear(): Promise<void> {
    await db.accounts.clear();
  },

  /**
   * Initialize dev seed data
   */
  async initializeDevData(devAccounts: Account[]): Promise<void> {
    const count = await db.accounts.count();
    if (count > 0) return;

    await db.transaction("rw", db.accounts, db.metadata, async () => {
      await db.accounts.bulkPut(devAccounts);
      await db.metadata.put({
        id: 1,
        version: "1.0.0",
        createdAt: Date.now(),
      });
    });

    console.log("개발용 seed 데이터가 추가되었습니다.");
  },
};