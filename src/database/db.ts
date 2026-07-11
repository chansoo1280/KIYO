import type { Account } from "../models/account";

export const initialAccounts: Account[] = [
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

const accounts: Account[] = [...initialAccounts];

export const getAccounts = () => accounts;
export const getAccountById = (id: string) =>
  accounts.find((account) => account.id === id);

export const addAccount = (account: Omit<Account, "id"> & { id?: string }) => {
  // Generate new ID: find max existing ID and increment
  const maxId = accounts.reduce((max, acc) => {
    const idNum = parseInt(acc.id, 10);
    return !isNaN(idNum) && idNum > max ? idNum : max;
  }, 0);

  const newId = account.id || (maxId + 1).toString();

  // Create new account with generated ID
  const newAccount: Account = {
    ...account,
    id: newId,
    fields: account.fields.map((field, index) => ({
      ...field,
      id: `${newId}-${index + 1}`,
      accountId: newId,
    })),
  };

  accounts.push(newAccount);

  return newAccount;
};

export const deleteAccount = (id: string) => {
  const index = accounts.findIndex((account) => account.id === id);
  if (index !== -1) {
    accounts.splice(index, 1);
    return true;
  }
  return false;
};
