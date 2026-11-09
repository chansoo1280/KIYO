import Dexie, { type Table } from "dexie";

export interface FileRecord {
  id: string; // PK = fileName (v14)
  fileName: string;
  fileData: string; // JSON string of KiyoVaultData (encrypted or plain)
  encrypted: boolean;
  salt?: string;
  createdAt: number;
  updatedAt: number;
}

export class KiyoDatabase extends Dexie {
  files!: Table<FileRecord, string>;

  constructor() {
    super("kiyo-db");
    // v15: PK = fileName, removed accounts/templates/metadata/settings tables
    this.version(15)
      .stores({
        files: "id, fileName, createdAt, updatedAt",
      })
      .upgrade(async (transaction) => {
        // Drop all old tables - data loss is 0: vault snapshot lives in files table
        await transaction.table("accounts").clear();
        await transaction.table("templates").clear();
        await transaction.table("metadata").clear();
        await transaction.table("settings").clear();
      });
  }
}

export const db = new KiyoDatabase();

// Get database instance
export const getDatabase = () => db;