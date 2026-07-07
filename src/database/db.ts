import type { Account } from "../models/account";

const accounts: Account[] = [
  { id: "1", name: "Personal", balance: 1240.5 },
  { id: "2", name: "Savings", balance: 9800.25 },
];

export const getAccounts = () => accounts;
export const getAccountById = (id: string) =>
  accounts.find((account) => account.id === id);
