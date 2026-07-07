import type { Account } from "../models/account";

const accounts: Account[] = [
  { id: "1", name: "Personal", balance: 1240.5 },
  { id: "2", name: "Savings", balance: 9800.25 },
];

const AccountList = () => {
  return (
    <section>
      <h2>Accounts</h2>
      <ul>
        {accounts.map((account) => (
          <li key={account.id}>
            {account.name} — ${account.balance.toFixed(2)}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default AccountList;
