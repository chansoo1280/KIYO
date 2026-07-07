import type { Account } from "../models/account";

const AccountDetail = ({ account }: { account: Account }) => {
  return (
    <article>
      <h2>{account.name}</h2>
      <p>Balance: ${account.balance.toFixed(2)}</p>
      <p>Account ID: {account.id}</p>
    </article>
  );
};

export default AccountDetail;
