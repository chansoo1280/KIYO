import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  syncStatus: "idle" as "idle" | "syncing" | "synced" | "failed",
  syncError: null as string | null,
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

const mockSettingsState = { autoBackupEnabled: false };

vi.mock("@/store/settingsStore", () => ({
  useSettingsStore: (selector: (state: typeof mockSettingsState) => unknown) =>
    selector(mockSettingsState),
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
    mockSettingsState.autoBackupEnabled = false;
    mockAccountStoreState.syncStatus = "idle";
    mockAccountStoreState.syncError = null;
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

  it("④ initialized=true + accounts 비어있음 + 검색 없음 → '계정이 없습니다' + '계정 추가' 버튼 표시", () => {
    mockSessionState.initialized = true;
    mockAccountStoreState.accounts = [];
    renderList();
    expect(screen.getByText("계정이 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /계정 추가/ })).toBeInTheDocument();
  });

  it("⑤ initialized=true + accounts 비어있음 + 검색 결과 없음 → '검색 결과가 없습니다' 표시", async () => {
    mockSessionState.initialized = true;
    mockAccountStoreState.accounts = [];
    renderList();
    const user = userEvent.setup();
    // 검색 입력은 검색 버튼 클릭 후 나타나므로 먼저 버튼 클릭
    await user.click(screen.getByRole("button", { name: /Search/ }));
    const searchInput = screen.getByPlaceholderText(/제목이나 이메일로 검색/);
    await user.type(searchInput, "존재하지않는사이트");
    expect(screen.getByText("검색 결과가 없습니다.")).toBeInTheDocument();
  });

  it("⑥ autoBackupEnabled=false + syncStatus='synced' → 인라인 메시지 미표시", () => {
    mockSessionState.initialized = true;
    mockAccountStoreState.accounts = [];
    mockAccountStoreState.syncStatus = "synced";
    renderList();
    expect(screen.queryByText("동기화됨")).not.toBeInTheDocument();
  });

  it("⑦ autoBackupEnabled=true + syncStatus='syncing' → '동기화중…' 인라인 메시지 표시", () => {
    mockSessionState.initialized = true;
    mockAccountStoreState.accounts = [];
    mockAccountStoreState.syncStatus = "syncing";
    mockSettingsState.autoBackupEnabled = true;
    renderList();
    expect(screen.getByText("동기화중…")).toBeInTheDocument();
  });

  it("⑧ autoBackupEnabled=true + syncStatus='synced' → '동기화됨' 인라인 메시지 표시", () => {
    mockSessionState.initialized = true;
    mockAccountStoreState.accounts = [];
    mockAccountStoreState.syncStatus = "synced";
    mockSettingsState.autoBackupEnabled = true;
    renderList();
    expect(screen.getByText("동기화됨")).toBeInTheDocument();
  });

  it("⑨ autoBackupEnabled=true + syncStatus='failed' → '동기화 실패' + '다시 시도' 버튼 표시", () => {
    mockSessionState.initialized = true;
    mockAccountStoreState.accounts = [];
    mockAccountStoreState.syncStatus = "failed";
    mockAccountStoreState.syncError = "저장에 실패했습니다.";
    mockSettingsState.autoBackupEnabled = true;
    renderList();
    expect(screen.getByText("동기화 실패: 저장에 실패했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /다시 시도/ })).toBeInTheDocument();
  });
});
