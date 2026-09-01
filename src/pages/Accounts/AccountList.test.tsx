import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AccountList from "./index";

// Store mock — isLoading/initialized 제어
const mockAccountStoreState = {
  accounts: [] as Array<{ id: number; title: string; tags: string[]; fields: Array<{ label: string; type: string; value: string }>; favorite: boolean; websiteUrl?: string; domain?: string }>,
  isLoading: false,
  initialized: false,
  loadAccounts: vi.fn(),
  addAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
  getAccountById: vi.fn(),
  clearAccounts: vi.fn(),
  syncToAutofill: vi.fn(),
  _persistAccounts: vi.fn(),
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

describe("AccountList (Plan-A2)", () => {
  beforeEach(() => {
    mockAccountStoreState.accounts = [];
    mockAccountStoreState.isLoading = false;
    mockAccountStoreState.initialized = false;
  });

  it("① !initialized && isLoading=true → Spinner + '계정을 불러오는 중...' 표시", () => {
    mockAccountStoreState.initialized = false;
    mockAccountStoreState.isLoading = true;
    renderList();
    expect(screen.getByTestId("accounts-loading")).toBeInTheDocument();
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(screen.getByText("계정을 불러오는 중...")).toBeInTheDocument();
  });

  it("② initialized=true && isLoading=false + accounts 비어있음 → list 본문 (빈 결과)", () => {
    mockAccountStoreState.initialized = true;
    mockAccountStoreState.isLoading = false;
    mockAccountStoreState.accounts = [];
    renderList();
    expect(screen.queryByTestId("accounts-loading")).not.toBeInTheDocument();
    expect(screen.getByText("My accounts")).toBeInTheDocument();
  });

  it("③ initialized=true && accounts 있음 → list 본문 렌더 (Spinner 없음)", () => {
    mockAccountStoreState.initialized = true;
    mockAccountStoreState.isLoading = false;
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

  it("④ initialized=false && isLoading=false (초기 마운트 직전) → Spinner 표시", () => {
    mockAccountStoreState.initialized = false;
    mockAccountStoreState.isLoading = false;
    renderList();
    // 첫 마운트 시 !initialized면 Spinner (loadAccounts 호출 전)
    expect(screen.getByTestId("accounts-loading")).toBeInTheDocument();
  });
});
