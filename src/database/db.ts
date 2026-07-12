import Dexie, { type Table } from "dexie";
import type {
  Account,
  AccountField,
  Metadata,
  Setting,
  Template,
} from "../models/account";
import {
  getActiveDataFileName,
  readDataFile,
  setActiveDataFileName,
  writeBackupFile,
  writeDataFile,
  type KiyoDataFile,
} from "./fileStorage";

const seedAccounts = [
  {
    id: "1",
    title: "Personal",
    tags: ["personal", "finance"],
    favorite: true,
    fields: [
      {
        id: "1-1",
        accountId: "1",
        label: "Email",
        type: "email",
        value: "user01@example.com",
        order: 1,
      },
      {
        id: "1-2",
        accountId: "1",
        label: "Password",
        type: "password",
        value: "pass1234",
        order: 2,
      },
      {
        id: "1-3",
        accountId: "1",
        label: "Notes",
        type: "textarea",
        value: "Main personal account.",
        order: 3,
      },
    ],
  },
  {
    id: "2",
    title: "Savings",
    tags: ["bank", "savings"],
    favorite: false,
    fields: [
      {
        id: "2-1",
        accountId: "2",
        label: "Email",
        type: "email",
        value: "user02@example.com",
        order: 1,
      },
      {
        id: "2-2",
        accountId: "2",
        label: "Password",
        type: "password",
        value: "secure456",
        order: 2,
      },
    ],
  },
  {
    id: "3",
    title: "Travel",
    tags: ["travel"],
    favorite: true,
    fields: [
      {
        id: "3-1",
        accountId: "3",
        label: "Email",
        type: "email",
        value: "travel@example.com",
        order: 1,
      },
      {
        id: "3-2",
        accountId: "3",
        label: "Password",
        type: "password",
        value: "trip789",
        order: 2,
      },
    ],
  },
  {
    id: "4",
    title: "Work",
    tags: ["work"],
    favorite: false,
    fields: [
      {
        id: "4-1",
        accountId: "4",
        label: "Email",
        type: "email",
        value: "workteam@example.com",
        order: 1,
      },
      {
        id: "4-2",
        accountId: "4",
        label: "Password",
        type: "password",
        value: "work2024",
        order: 2,
      },
    ],
  },
  {
    id: "5",
    title: "Family",
    tags: ["family"],
    favorite: true,
    fields: [
      {
        id: "5-1",
        accountId: "5",
        label: "Email",
        type: "email",
        value: "family@example.com",
        order: 1,
      },
      {
        id: "5-2",
        accountId: "5",
        label: "Password",
        type: "password",
        value: "fam123",
        order: 2,
      },
    ],
  },
  {
    id: "6",
    title: "Study",
    tags: ["study"],
    favorite: false,
    fields: [
      {
        id: "6-1",
        accountId: "6",
        label: "Email",
        type: "email",
        value: "study@example.com",
        order: 1,
      },
      {
        id: "6-2",
        accountId: "6",
        label: "Password",
        type: "password",
        value: "learn321",
        order: 2,
      },
    ],
  },
  {
    id: "7",
    title: "Study",
    tags: ["study"],
    favorite: false,
    fields: [
      {
        id: "7-1",
        accountId: "7",
        label: "Email",
        type: "email",
        value: "study@example.com",
        order: 1,
      },
      {
        id: "7-2",
        accountId: "7",
        label: "Password",
        type: "password",
        value: "learn321",
        order: 2,
      },
    ],
  },
  {
    id: "8",
    title: "Study",
    tags: ["study"],
    favorite: false,
    fields: [
      {
        id: "8-1",
        accountId: "8",
        label: "Email",
        type: "email",
        value: "study@example.com",
        order: 1,
      },
      {
        id: "8-2",
        accountId: "8",
        label: "Password",
        type: "password",
        value: "learn321",
        order: 2,
      },
    ],
  },
];

const seedTimestamp = Date.now();

export const initialAccounts: Account[] = seedAccounts.map((account, index) => {
  const id = Number(account.id);

  return {
    ...account,
    id,
    templateId: 1,
    fields: account.fields.map((field): AccountField => ({
      ...field,
      accountId: id,
      type: field.type as AccountField["type"],
    })),
    createdAt: seedTimestamp + index,
    updatedAt: seedTimestamp + index,
  };
});

export const fixedTemplates: Template[] = [
  {
    id: 1,
    name: "기본",
    fields: [
      { id: "email", accountId: 0, label: "이메일", type: "email", value: "", order: 1 },
      { id: "password", accountId: 0, label: "비밀번호", type: "password", value: "", order: 2 },
    ],
  },
  {
    id: 2,
    name: "은행",
    fields: [
      { id: "email", accountId: 0, label: "이메일", type: "email", value: "", order: 1 },
      { id: "password", accountId: 0, label: "비밀번호", type: "password", value: "", order: 2 },
      { id: "memo", accountId: 0, label: "메모", type: "textarea", value: "", order: 3 },
    ],
  },
  {
    id: 3,
    name: "카드",
    fields: [
      { id: "card-number", accountId: 0, label: "카드번호", type: "text", value: "", order: 1 },
      { id: "password", accountId: 0, label: "비밀번호", type: "password", value: "", order: 2 },
      { id: "expiry-date", accountId: 0, label: "유효기간", type: "text", value: "", order: 3 },
    ],
  },
];

export class KiyoDatabase extends Dexie {
  accounts!: Table<Account, number>;
  templates!: Table<Template, number>;
  settings!: Table<Setting, number>;
  metadata!: Table<Metadata, number>;

  constructor() {
    super("kiyo-db");
    this.version(3).stores({
      accounts: "id, templateId, title, *tags, favorite, createdAt, updatedAt",
      templates: "id, name",
      settings: "++id, theme, lockEnabled",
      metadata: "id, version, createdAt",
    }).upgrade((transaction) =>
      transaction.table("accounts").toCollection().modify({ templateId: 1 }),
    );
  }
}

export const db = new KiyoDatabase();

let initializationPromise: Promise<void> | undefined;

export const getDatabaseSnapshot = async (): Promise<KiyoDataFile> => ({
  version: 1,
  fileName: getActiveDataFileName() ?? "kiyo-data.json",
  updatedAt: Date.now(),
  accounts: await db.accounts.toArray(),
  templates: await db.templates.toArray(),
  settings: await db.settings.toArray(),
  metadata: await db.metadata.toArray(),
});

export const syncDatabaseToFile = async (): Promise<void> => {
  await writeDataFile(await getDatabaseSnapshot());
};

const replaceDatabaseData = async (data: KiyoDataFile): Promise<void> => {
  await db.transaction(
    "rw",
    db.accounts,
    db.templates,
    db.settings,
    db.metadata,
    async () => {
      await db.accounts.clear();
      await db.templates.clear();
      await db.settings.clear();
      await db.metadata.clear();
      await db.accounts.bulkPut(data.accounts);
      await db.templates.bulkPut(data.templates);
      await db.settings.bulkPut(data.settings);
      await db.metadata.bulkPut(data.metadata);
    },
  );
};

export const createDataFile = async (fileName: string): Promise<Account[]> => {
  const data: KiyoDataFile = {
    version: 1,
    fileName,
    updatedAt: Date.now(),
    accounts: [],
    templates: fixedTemplates,
    settings: [],
    metadata: [],
  };
  setActiveDataFileName(fileName);
  await replaceDatabaseData(data);
  await syncDatabaseToFile();
  return data.accounts;
};

export const restoreDataFile = async (
  data: KiyoDataFile,
  fileName: string,
): Promise<Account[]> => {
  setActiveDataFileName(fileName);
  await replaceDatabaseData(data);
  await syncDatabaseToFile();
  return data.accounts;
};

export const backupDataFile = async (fileName: string): Promise<void> => {
  await writeBackupFile(await getDatabaseSnapshot(), fileName);
};

export const initializeDataStorage = (): Promise<void> => {
  initializationPromise ??= (async () => {
    const fileData = await readDataFile();

    if (fileData) {
      await replaceDatabaseData(fileData);
      return;
    }

    if (!getActiveDataFileName() && (await db.templates.count()) === 0) {
      await db.templates.bulkAdd(fixedTemplates);
    }
  })();

  return initializationPromise;
};

export const loadAccounts = async (): Promise<Account[]> => {
  await initializeDataStorage();
  return db.accounts.orderBy("updatedAt").reverse().toArray();
};
