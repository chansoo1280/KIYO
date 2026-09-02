import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AccountList from "./index";

// PR 1: isLoading/initialized는 useSessionStore.initialized로 통합
const mockAccountStoreState = {
  accounts: [] as Array<{ id: number; title: string; tags: string[]; fields: Array<{ label: string; type: string; value: string }>; favorite: boolean; websiteUrl?: string; domain?: string }>,
  init: vi.fn(),
  getAll: vi.fn(() => []),
  addAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
  getAccountById: vi.fn(),
  clearAccounts: vi.fn(),
  syncToAutofill: vi.fn(),
  getAutofillAccounts: vi.fn(),
};

vi.mock("@/store/accountStore", () => ({
  useAccountStore: (selector: (state: typeof mockAccountStoreState) => unknown) =>
    selector(mockAccountStoreState),
}));

const mockSessionState = {
  activeFileName: "test.json",
  cryptoKey: null,
  salt: null,
  initialized: false,
};

vi.mock("@/store/sessionStore", () => ({
  useSessionStore: (selector: (state: typeof mockSessionState) => unknown) =>
    selector(mockSessionState),
}));

vi.mock("@/hooks/useClipboard", () => ({
  useClipboard: () => ({ copy: vi.fn() }),
}));

vi.mock("@/hooks/useFileAuthGuard", () => ({
  useFileAuthGuard: () => undefined,
}));

const renderList = () =>
  render(
    <MemoryRouter initialEntries={["/accounts"]}>
      <AccountList />
    </MemoryRouter>,
  );

describe("AccountList (PR 1: useSessionStore.initialized 통합)", () => {
  beforeEach(() => {
    mockAccountStoreState.accounts = [];
    mockSessionState.initialized = false;
  });

  it("① !initialized (session) → Spinner + '계정을 불러오는 중...' 표시", () => {
    mockSessionState.initialized = false;
    renderList();
    expect(screen.getByTestId("accounts-loading")).toBeInTheDocument();
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(screen.getByText("계정을 불러오는 중...")).toBeInTheDocument();
  });

  it("② initialized=true (session) + accounts 비어있음 → list 본문 (빈 결과)", () => {
    mockSessionState.initialized = true;
    mockAccountStoreState.accounts = [];
    renderList();
    expect(screen.queryByTestId("accounts-loading")).not.toBeInTheDocument();
    expect(screen.getByText("My accounts")).toBeInTheDocument();
  });

  it("③ initialized=true (session) + accounts 있음 → list 본문 렌더 (Spinner 없음)", () => {
    mockSessionState.initialized = true;
    mockAccountStoreState.accounts = [
      {
        id: 1,
        title: "Test",
        tags: [],
        fields: [],
        favorite: false,
      },
    ];
    renderList();
    expect(screen.queryByTestId("accounts-loading")).not.toBeInTheDocument();
    expect(screen.getByText("Test")).toBeInTheDocument();
  });
});