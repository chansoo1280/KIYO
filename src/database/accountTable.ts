import { db } from "@/database/db";
import type { Account } from "@/models/account";
import {
  createEncryptedRecord,
  createPlaintextRecord,
  decryptRecord,
  type EncryptedRecord,
} from "@/crypto/recordEncryption";

export interface AccountRecord extends EncryptedRecord {
  id: number;
}

export const accountTable = {
  /**
   * Get all accounts, decrypting encrypted records if cryptoKey provided
   */
  async getAll(cryptoKey?: CryptoKey): Promise<Account[]> {
    const records = await db.accounts.orderBy("updatedAt").reverse().toArray();

    if (records.length === 0) return [];

    return Promise.all(
      records.map(async (record) => {
        if (record.encrypted) {
          if (!cryptoKey) {
            // Encrypted record but no key - return minimal
            return { 
              id: record.id, 
              templateId: "",
              title: "",
              tags: [],
              favorite: false,
              fields: [], 
              createdAt: record.createdAt, 
              updatedAt: record.updatedAt 
            } as Account;
          }
          try {
            return await decryptRecord<Account>(record.encryptedData, record.iv, cryptoKey);
          } catch (error) {
            console.error("Failed to decrypt account record:", error);
            return { 
              id: record.id, 
              templateId: "",
              title: "",
              tags: [],
              favorite: false,
              fields: [], 
              createdAt: record.createdAt, 
              updatedAt: record.updatedAt 
            } as Account;
          }
        }
        // Plaintext record
        try {
          const decoded = new TextDecoder().decode(record.encryptedData);
          return JSON.parse(decoded) as Account;
        } catch {
          return { 
            id: record.id, 
            templateId: "",
            title: "",
            tags: [],
            favorite: false,
            fields: [], 
            createdAt: record.createdAt, 
            updatedAt: record.updatedAt 
          } as Account;
        }
      })
    );
  },

  /**
   * Get account by ID
   */
  async getById(id: number, cryptoKey?: CryptoKey): Promise<Account | undefined> {
    const record = await db.accounts.get(id);

    if (!record) return undefined;

    if (record.encrypted) {
      if (!cryptoKey) return undefined;
      try {
        return await decryptRecord<Account>(record.encryptedData, record.iv, cryptoKey);
      } catch (error) {
        console.error("Failed to decrypt account record:", error);
        return undefined;
      }
    }

    // Plaintext record
    try {
      const decoded = new TextDecoder().decode(record.encryptedData);
      return JSON.parse(decoded) as Account;
    } catch (error) {
      console.error("Failed to parse plaintext account record:", error);
      return undefined;
    }
  },

  /**
   * Create a new account (encrypts if cryptoKey provided)
   */
  async create(
    account: Omit<Account, "id" | "createdAt" | "updatedAt">,
    cryptoKey?: CryptoKey,
  ): Promise<Account> {
    const now = Date.now();

    const newAccount = {
      ...account,
      createdAt: now,
      updatedAt: now,
    };

    if (cryptoKey) {
      const encryptedRecord = await createEncryptedRecord(newAccount, cryptoKey);

      const id = await db.accounts.add(encryptedRecord);

      return {
        ...newAccount,
        id,
      };
    } else {
      // Plaintext record
      const plaintextRecord = await createPlaintextRecord(newAccount);
      const id = await db.accounts.add(plaintextRecord);
      return {
        ...newAccount,
        id,
      };
    }
  },

  /**
   * Update an account (encrypts if cryptoKey provided)
   */
  async update(account: Account, cryptoKey?: CryptoKey): Promise<void> {
    const updatedAccount = { ...account, updatedAt: Date.now() };

    if (cryptoKey) {
      const existingRecord = await db.accounts.get(account.id);
      if (existingRecord) {
        const encryptedRecord = await createEncryptedRecord(updatedAccount, cryptoKey);
        const record: AccountRecord = {
          id: account.id,
          ...encryptedRecord,
          createdAt: existingRecord.createdAt, // Preserve createdAt
        };
        await db.accounts.put(record);
      }
    } else {
      const plaintextRecord = await createPlaintextRecord(updatedAccount);
      const record: AccountRecord = {
        id: updatedAccount.id,
        ...plaintextRecord,
        createdAt: updatedAccount.createdAt,
      };
      await db.accounts.put(record);
    }
  },

  /**
   * Delete an account
   */
  async delete(id: number): Promise<void> {
    await db.accounts.delete(id);
  },

  /**
   * Clear all accounts (used for logout/switch file)
   */
  async clear(): Promise<void> {
    await db.accounts.clear();
  },

  /**
   * Restore an account with specific ID (for backup/restore operations)
   * Uses the provided account ID and field IDs instead of auto-generating
   */
  async restore(
    account: Account,
    cryptoKey?: CryptoKey,
  ): Promise<Account> {
    const now = Date.now();
    const accountToStore: Account = {
      ...account,
      updatedAt: now,
    };

    if (cryptoKey) {
      // Encrypt and store with the provided ID
      const encryptedRecord = await createEncryptedRecord(accountToStore, cryptoKey);
      const record: AccountRecord = {
        id: account.id,
        ...encryptedRecord,
        createdAt: account.createdAt,
        updatedAt: now,
      };
      await db.accounts.put(record);
    } else {
      // Plaintext record
      const plaintextRecord = await createPlaintextRecord(accountToStore);
      const record: AccountRecord = {
        id: account.id,
        ...plaintextRecord,
        createdAt: account.createdAt,
        updatedAt: now,
      };
      await db.accounts.put(record);
    }

    return accountToStore;
  },

  /**
   * Restore multiple accounts with specific IDs (for backup/restore operations)
   * Uses the provided account IDs and field IDs instead of auto-generating
   */
  async bulkRestore(
    accounts: Account[],
    cryptoKey?: CryptoKey,
  ): Promise<void> {
    const now = Date.now();

    if (cryptoKey) {
      // Encrypt all accounts first, then bulkPut
      const records = await Promise.all(
        accounts.map(async (account) => {
          const accountToStore = { ...account, updatedAt: now };
          const encryptedRecord = await createEncryptedRecord(accountToStore, cryptoKey);
          return {
            id: account.id,
            ...encryptedRecord,
            createdAt: account.createdAt,
            updatedAt: now,
          };
        })
      );
      await db.accounts.bulkPut(records as AccountRecord[]);
    } else {
      // Plaintext records
      const records = await Promise.all(
        accounts.map(async (account) => {
          const accountToStore = { ...account, updatedAt: now };
          const plaintextRecord = await createPlaintextRecord(accountToStore);
          return {
            id: account.id,
            ...plaintextRecord,
            createdAt: account.createdAt,
            updatedAt: now,
          };
        })
      );
      await db.accounts.bulkPut(records as AccountRecord[]);
    }
  },

  /**
   * Initialize dev seed data
   * @param cryptoKey - Optional encryption key. If not provided, stores as plaintext.
   */
  async initializeDevData(devAccounts: Account[], cryptoKey?: CryptoKey): Promise<void> {
    const count = await db.accounts.count();
    if (count > 0) return;

    await db.transaction("rw", db.accounts, db.metadata, async () => {
      const records = await Promise.all(
        devAccounts.map(async (a) => {
          if (cryptoKey) {
            const encryptedRecord = await createEncryptedRecord(a, cryptoKey);
            return {
              id: a.id,
              ...encryptedRecord,
              createdAt: a.createdAt,
              updatedAt: a.updatedAt,
            };
          } else {
            // Plaintext record
            const plaintextRecord = await createPlaintextRecord(a);
            return {
              id: a.id,
              ...plaintextRecord,
              createdAt: a.createdAt,
              updatedAt: a.updatedAt,
            };
          }
        })
      );

      await db.accounts.bulkPut(records as AccountRecord[]);
    });

    console.log("개발용 seed 데이터가 추가되었습니다.");
  },
};