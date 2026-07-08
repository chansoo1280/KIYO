import React from "react";
import type { Account } from "../models/account";
import BottomTabs from "../components/BottomTabs";

type AccountListProps = {
  onOpenSettings?: () => void;
  onOpenAlerts?: () => void;
};

const accounts: Account[] = [
  {
    id: "1",
    name: "Personal",
    username: "user01@example.com",
    password: "pass1234",
    icon: "P",
    balance: 1240.5,
  },
  {
    id: "2",
    name: "Savings",
    username: "user02@example.com",
    password: "secure456",
    icon: "S",
    balance: 9800.25,
  },
  {
    id: "3",
    name: "Travel",
    username: "travel@example.com",
    password: "trip789",
    icon: "T",
    balance: 540.75,
  },
  {
    id: "4",
    name: "Work",
    username: "workteam@example.com",
    password: "work2024",
    icon: "W",
    balance: 320.1,
  },
  {
    id: "5",
    name: "Family",
    username: "family@example.com",
    password: "fam123",
    icon: "F",
    balance: 880.4,
  },
  {
    id: "6",
    name: "Study",
    username: "study@example.com",
    password: "learn321",
    icon: "L",
    balance: 120.0,
  },
  {
    id: "7",
    name: "Study",
    username: "study@example.com",
    password: "learn321",
    icon: "L",
    balance: 120.0,
  },
  {
    id: "8",
    name: "Study",
    username: "study@example.com",
    password: "learn321",
    icon: "L",
    balance: 120.0,
  },
];

const AccountList = ({ onOpenSettings, onOpenAlerts }: AccountListProps) => {
  return (
    <section className="account-list-screen">
      <div className="account-list-shell">
        <header className="account-list-header">
          <div>
            <p className="eyebrow">Accounts</p>
            <h2>My accounts</h2>
          </div>

          <div className="header-actions">
            <button type="button" className="icon-btn" aria-label="Search">
              🔍
            </button>
            <button type="button" className="icon-btn" aria-label="Sort">
              ↕
            </button>
          </div>
        </header>

        <div className="account-list-content">
          {accounts.map((account) => (
            <article key={account.id} className="account-card compact-row">
              <div className="account-main compact-main">
                <div className="account-icon">{account.icon}</div>
                <p className="account-meta compact-meta">{account.username}</p>

                <div className="account-actions">
                  <button
                    type="button"
                    className="copy-btn"
                    aria-label="Copy password"
                  >
                    복사
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <button
        className="scroll-top-btn"
        type="button"
        aria-label="Scroll to top"
        // onClick={scrollToTop}
      >
        ⬆
      </button>

      <BottomTabs
        active="list"
        onOpenAlerts={onOpenAlerts}
        onOpenSettings={onOpenSettings}
      />
    </section>
  );
};

export default AccountList;
