import { db } from "@/database/db";
import type { Account } from "@/models/account";
import { createEncryptedRecord, decryptRecord, type EncryptedRecord } from "@/crypto/recordEncryption";

interface AccountRecord extends EncryptedRecord {
  id: number;
}

export const accountTable = {
  /**
   * Get all accounts, decrypting if cryptoKey is provided
   * Falls back to plaintext parsing when no cryptoKey (for unencrypted files)
   */
  async getAll(cryptoKey?: CryptoKey): Promise<Account[]> {
    const records = await db.accounts.orderBy("updatedAt").reverse().toArray();

    if (cryptoKey && records.length > 0) {
      try {
        return await Promise.all(
          records.map((record) => decryptRecord<Account>(record.encryptedData, record.iv, cryptoKey)),
        );
      } catch (error) {
        console.error("Failed to decrypt account records:", error);
        return [];
      }
    }

    // Fallback: return plaintext accounts when no cryptoKey (for plaintext files)
    if (records.length > 0) {
      try {
        return records
          .map((record) => {
            try {
              const decoded = new TextDecoder().decode(record.encryptedData);
              return JSON.parse(decoded) as Account;
            } catch {
              // If parsing fails, return a minimal account
              return { id: record.id, name: "", fields: [], createdAt: record.createdAt, updatedAt: record.updatedAt };
            }
          })
          .filter((account): account is Account => account !== null);
      } catch (error) {
        console.error("Failed to parse plaintext account records:", error);
        return [];
      }
    }

    return [];
  },

  /**
   * Get account by ID
   * Falls back to plaintext parsing when no cryptoKey (for unencrypted files)
   */
  async getById(id: number, cryptoKey?: CryptoKey): Promise<Account | undefined> {
    const record = await db.accounts.get(id);

    if (!record) return undefined;

    if (cryptoKey) {
      try {
        return await decryptRecord<Account>(record.encryptedData, record.iv, cryptoKey);
      } catch (error) {
        console.error("Failed to decrypt account record:", error);
        return undefined;
      }
    }

    // Fallback: return plaintext account when no cryptoKey
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
  console.log("create cryptoKey:", cryptoKey);
  console.log("truthy:", Boolean(cryptoKey));
  const now = Date.now();

  const newAccount = {
    ...account,
    createdAt: now,
    updatedAt: now,
  };
 if (cryptoKey) {
    const encryptedRecord = await createEncryptedRecord(
      newAccount,
      cryptoKey,
    );

    const id = await db.accounts.add(encryptedRecord);

    return {
      ...newAccount,
      id,
    };
  } else {
    // Fallback for non-encrypted (should not happen in production)
    const plaintextData = new TextEncoder().encode(JSON.stringify(newAccount));
    const id = await db.accounts.add({
      version: 1,
      algorithm: "AES-GCM",
      encryptedData: plaintextData,
      iv: new Uint8Array(12),
      createdAt: now,
      updatedAt: now,
    });
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
      await db.accounts.put({
        id: updatedAccount.id,
        version: 1,
        algorithm: "AES-GCM",
        encryptedData: new TextEncoder().encode(JSON.stringify(updatedAccount)),
        iv: new Uint8Array(12),
        createdAt: updatedAccount.createdAt,
        updatedAt: updatedAccount.updatedAt,
      });
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
      // Fallback for non-encrypted
      await db.accounts.put({
        id: account.id,
        version: 1,
        algorithm: "AES-GCM" as const,
        encryptedData: new TextEncoder().encode(JSON.stringify(accountToStore)),
        iv: new Uint8Array(12),
        createdAt: account.createdAt,
        updatedAt: now,
      });
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
      // Fallback for non-encrypted
      const records = accounts.map((account) => {
        const accountToStore = { ...account, updatedAt: now };
        return {
          id: account.id,
          version: 1 as const,
          algorithm: "AES-GCM" as const,
          encryptedData: new TextEncoder().encode(JSON.stringify(accountToStore)),
          iv: new Uint8Array(12),
          createdAt: account.createdAt,
          updatedAt: now,
        };
      });
      await db.accounts.bulkPut(records as AccountRecord[]);
    }
  },

  /**
   * Initialize dev seed data
   */
  async initializeDevData(devAccounts: Account[]): Promise<void> {
    const count = await db.accounts.count();
    if (count > 0) return;

    await db.transaction("rw", db.accounts, db.metadata, async () => {
      await db.accounts.bulkPut(
        devAccounts.map((a) => ({
          id: a.id,
          version: 1,
          algorithm: "AES-GCM" as const,
          encryptedData: new TextEncoder().encode(JSON.stringify(a)),
          iv: new Uint8Array(12),
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        })),
      );
    });

    console.log("개발용 seed 데이터가 추가되었습니다.");
  },
};