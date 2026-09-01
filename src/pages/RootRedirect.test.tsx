import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, screen, act } from "@testing-library/react";
import type { NavigateFunction } from "react-router-dom";
import { RootRedirect } from "@/pages/RootRedirect";
import { fileTable } from "@/database/fileTable";
import { useSessionStore } from "@/store/sessionStore";
import type { ActiveFileInfo } from "@/database/fileTable";
import type { EncryptedKiyoVaultData } from "@/models/vault";
import type { AccountState } from "@/store/accountStore";
import type { TemplateState } from "@/store/templateStore";

// Mock dependencies BEFORE importing the component
vi.mock("@/database/fileTable", () => ({
  fileTable: {
    getFileInfo: vi.fn(),
  },
}));

const mockLoadAccounts = vi.fn();
const mockLoadTemplates = vi.fn();

/**
 * RootRedirect는 `getState()`로 isLoading/initialized만 읽는다.
 * 테스트는 해당 필드만 제어하므로 AccountState/TemplateState를 만족하는 fake를 만들어
 * 그 두 필드만 in-place로 변경한다 — typecheck가 보장된 상태에서 런타임 동작도 정확.
 */
function makeAccountStateFake(): AccountState {
  const state = {
    accounts: [],
    initialized: true,
    isLoading: false,
    loadAccounts: mockLoadAccounts,
    addAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
    getAccountById: vi.fn(),
    clearAccounts: vi.fn(),
    syncToAutofill: vi.fn(),
    _persistAccounts: vi.fn(),
    getAutofillAccounts: vi.fn(),
  };
  return state as unknown as AccountState;
}

function makeTemplateStateFake(): TemplateState {
  const state = {
    templates: [],
    isLoading: false,
    initialized: true,
    loadTemplates: mockLoadTemplates,
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    clearTemplates: vi.fn(),
    getTemplate: vi.fn(),
  };
  return state as unknown as TemplateState;
}

let accountStateFake: AccountState;
let templateStateFake: TemplateState;

/**
 * vi.mock factory는 top-level hoist되므로 factory 내부에서 mock을 만들어야 한다.
 * `vi.hoisted`로 감싸 top-level에서도 접근 가능하게 한다.
 */
const hoisted = vi.hoisted(() => {
  const mockAccountGetState = vi.fn<() => unknown>();
  const mockTemplateGetState = vi.fn<() => unknown>();
  return { mockAccountGetState, mockTemplateGetState };
});

vi.mock("@/store/accountStore", () => ({
  useAccountStore: Object.assign(
    (selector: (s: { loadAccounts: () => Promise<void> }) => unknown) =>
      selector({ loadAccounts: mockLoadAccounts }),
    {
      getState: hoisted.mockAccountGetState,
      setState: vi.fn(),
    },
  ),
}));

vi.mock("@/store/templateStore", () => ({
  useTemplateStore: Object.assign(
    (selector: (s: { loadTemplates: () => Promise<void> }) => unknown) =>
      selector({ loadTemplates: mockLoadTemplates }),
    {
      getState: hoisted.mockTemplateGetState,
      setState: vi.fn(),
    },
  ),
}));

const mockNavigate = vi.fn<NavigateFunction>();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockFileTable = vi.mocked(fileTable);

// Helper: encrypted ActiveFileInfo (activeFileName set)
const createEncryptedInfo = (
  activeFileName = "vault.json",
): ActiveFileInfo => ({
  encrypted: true,
  activeFileName,
  fileData: {} as EncryptedKiyoVaultData,
  salt: new Uint8Array([1, 2, 3, 4]),
});

// Helper: plain ActiveFileInfo with real data (activeFileName set + fileData set)
const createPlainInfo = (activeFileName = "plain.json"): ActiveFileInfo => ({
  encrypted: false,
  activeFileName,
  fileData: { accounts: [], templates: [] } as never,
  salt: null,
});

// Helper: stale scenario (DB에 row 없음) — getFileInfo가 반환하는 형태
const createStaleInfo = (): ActiveFileInfo => ({
  encrypted: false,
  activeFileName: null,
  fileData: null,
  salt: null,
});

const setSessionState = (activeFileName: string | null, cryptoKey: CryptoKey | null) => {
  (useSessionStore as unknown as { setState: (s: object) => void }).setState({
    activeFileName,
    cryptoKey,
  });
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockLoadAccounts.mockReset();
  mockLoadTemplates.mockReset();
  mockFileTable.getFileInfo.mockReset();
  mockLoadAccounts.mockResolvedValue(undefined);
  mockLoadTemplates.mockResolvedValue(undefined);
  accountStateFake = makeAccountStateFake();
  templateStateFake = makeTemplateStateFake();
  // 기본값: 정상 상태 반환
  hoisted.mockAccountGetState.mockImplementation(() => accountStateFake);
  hoisted.mockTemplateGetState.mockImplementation(() => templateStateFake);
  setSessionState(null, null);
});

describe("RootRedirect (Plan-D PR 1)", () => {
  it("① activeFileName=null → /home navigate (replace)", async () => {
    render(<RootRedirect />);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/home", { replace: true });
    });
  });

  it("② activeFileName=set + getFileInfo null 반환 (DB 없음) → ErrorScreen variant='stale' + 누락된 파일명 표시", async () => {
    const fileName = "missing.json";
    setSessionState(fileName, null);
    mockFileTable.getFileInfo.mockResolvedValue(createStaleInfo());
    render(<RootRedirect />);
    await waitFor(() => {
      expect(screen.getByText("활성 파일을 찾을 수 없습니다")).toBeInTheDocument();
    });
    expect(screen.getByText(fileName)).toBeInTheDocument();
  });

  it("③ activeFileName=set + encrypted=true + cryptoKey=null → /auth navigate (replace)", async () => {
    setSessionState("vault.json", null);
    mockFileTable.getFileInfo.mockResolvedValue(createEncryptedInfo("vault.json"));
    render(<RootRedirect />);
    await waitFor(() => {
      expect(mockFileTable.getFileInfo).toHaveBeenCalledWith("vault.json");
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/auth", { replace: true });
    });
    // preload은 발화하지 않아야 함 (encrypted + cryptoKey=null → /auth)
    expect(mockLoadAccounts).not.toHaveBeenCalled();
    expect(mockLoadTemplates).not.toHaveBeenCalled();
  });

  it("④ activeFileName=set + encrypted=true + cryptoKey=set + loadAccounts 성공 → /accounts navigate (replace)", async () => {
    const cryptoKey = {} as CryptoKey;
    setSessionState("vault.json", cryptoKey);
    mockFileTable.getFileInfo.mockResolvedValue(createEncryptedInfo("vault.json"));
    render(<RootRedirect />);
    await waitFor(() => {
      expect(mockLoadAccounts).toHaveBeenCalled();
      expect(mockLoadTemplates).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/accounts", { replace: true });
    });
  });

  it("⑤ activeFileName=set + encrypted=true + cryptoKey=set + loadAccounts throw → ErrorScreen variant='generic' 표시", { timeout: 15_000 }, async () => {
    const cryptoKey = {} as CryptoKey;
    setSessionState("vault.json", cryptoKey);
    mockFileTable.getFileInfo.mockResolvedValue(createEncryptedInfo("vault.json"));
    mockLoadAccounts.mockRejectedValue(new Error("load failed"));
    mockLoadTemplates.mockRejectedValue(new Error("templates load failed"));
    render(<RootRedirect />);
    await waitFor(
      () => {
        expect(screen.getByText("데이터를 불러올 수 없습니다")).toBeInTheDocument();
      },
      { timeout: 10_000 },
    );
    expect(screen.getByText("load failed")).toBeInTheDocument();
  });

  it("⑥ activeFileName=set + encrypted=false → preload 발화", async () => {
    setSessionState("plain.json", null);
    mockFileTable.getFileInfo.mockResolvedValue(createPlainInfo("plain.json"));
    render(<RootRedirect />);
    await waitFor(() => {
      expect(mockLoadAccounts).toHaveBeenCalled();
      expect(mockLoadTemplates).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/accounts", { replace: true });
    });
  });

  it("⑦ unmount 시 cancelled 플래그로 setState 회피", async () => {
    setSessionState("vault.json", null);
    let resolveGetFileInfo: (info: ActiveFileInfo) => void = () => {};
    mockFileTable.getFileInfo.mockReturnValueOnce(
      new Promise<ActiveFileInfo>((resolve) => {
        resolveGetFileInfo = resolve;
      }),
    );
    const { unmount } = render(<RootRedirect />);
    unmount();
    resolveGetFileInfo(createEncryptedInfo("vault.json"));
    await new Promise((r) => setTimeout(r, 10));
    // 어떤 setState도 unmount 후 호출 안 됨 (cancelled 보호) — DOM이 정상 상태
    expect(mockLoadAccounts).not.toHaveBeenCalled();
    expect(mockLoadTemplates).not.toHaveBeenCalled();
  });

  it("⑧ fileTable.getFileInfo throw 시 ErrorScreen variant='generic'", async () => {
    setSessionState("vault.json", null);
    mockFileTable.getFileInfo.mockRejectedValueOnce(new Error("db corruption"));
    render(<RootRedirect />);
    await waitFor(() => {
      expect(screen.getByText("데이터를 불러올 수 없습니다")).toBeInTheDocument();
    });
    expect(screen.getByText("db corruption")).toBeInTheDocument();
  });

  it("⑨ activeFileName 변경 시 getFileInfo 재호출", async () => {
    setSessionState("vault.json", null);
    mockFileTable.getFileInfo.mockResolvedValue(createEncryptedInfo("vault.json"));
    const { rerender } = render(<RootRedirect />);
    await waitFor(() => {
      expect(mockFileTable.getFileInfo).toHaveBeenCalledWith("vault.json");
    });
    setSessionState("vault2.json", null);
    mockFileTable.getFileInfo.mockResolvedValueOnce(createEncryptedInfo("vault2.json"));
    await act(async () => {
      rerender(<RootRedirect />);
    });
    await waitFor(() => {
      expect(mockFileTable.getFileInfo).toHaveBeenCalledWith("vault2.json");
    });
  });

  it("⑩ preload timeout → 1회 재시도 → 성공 시 /accounts navigate (Plan-D PR 1 회귀 수정)", { timeout: 15_000 }, async () => {
    setSessionState("plain.json", null);
    mockFileTable.getFileInfo.mockResolvedValue(createPlainInfo("plain.json"));
    // 첫 번째 호출: 영원히 pending (Dexie close race 시뮬레이션)
    mockLoadAccounts.mockImplementationOnce(
      () => new Promise(() => {}),
    );
    // 두 번째 호출(재시도): 정상 resolve
    mockLoadAccounts.mockResolvedValueOnce(undefined);

    render(<RootRedirect />);
    await waitFor(
      () => {
        expect(mockLoadAccounts).toHaveBeenCalledTimes(2);
      },
      { timeout: 10_000 },
    );
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/accounts", { replace: true });
      },
      { timeout: 5_000 },
    );
  });

  it("⑪ preload timeout + 재시도도 timeout → ErrorScreen variant='generic' 표시", { timeout: 15_000 }, async () => {
    setSessionState("plain.json", null);
    mockFileTable.getFileInfo.mockResolvedValue(createPlainInfo("plain.json"));
    // 두 호출 모두 영원히 pending
    mockLoadAccounts.mockImplementation(
      () => new Promise(() => {}),
    );
    mockLoadTemplates.mockResolvedValue(undefined);

    render(<RootRedirect />);
    await waitFor(
      () => {
        expect(screen.getByText("데이터를 불러올 수 없습니다")).toBeInTheDocument();
      },
      { timeout: 10_000 },
    );
    expect(screen.getByText("preload timeout")).toBeInTheDocument();
  });

  it("⑫ loadAccounts resolve했지만 store isLoading=true → retry → 정상 /accounts navigate", { timeout: 15_000 }, async () => {
    setSessionState("plain.json", null);
    mockFileTable.getFileInfo.mockResolvedValue(createPlainInfo("plain.json"));
    // 첫 호출은 정상 resolve
    mockLoadAccounts.mockResolvedValue(undefined);
    mockLoadTemplates.mockResolvedValue(undefined);

    // 첫 시도: store-not-ready (Dexie race 시뮬레이션) — fake의 두 필드를 in-place 변경.
    // 두 번째 시도: 정상 상태 복원.
    let getStateCallCount = 0;
    const fakeRef = accountStateFake; // close-over reference for sanity assertion
    hoisted.mockAccountGetState.mockImplementation(() => {
      getStateCallCount++;
      if (getStateCallCount <= 2) {
        fakeRef.isLoading = getStateCallCount === 1;
        fakeRef.initialized = getStateCallCount !== 1;
      } else {
        fakeRef.isLoading = false;
        fakeRef.initialized = true;
      }
      return fakeRef;
    });

    render(<RootRedirect />);
    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith("/accounts", { replace: true });
      },
      { timeout: 10_000 },
    );

    // sanity: fake 자체는 close-over fakeRef와 동일해야 함
    expect(hoisted.mockAccountGetState()).toBe(fakeRef);
  });
});