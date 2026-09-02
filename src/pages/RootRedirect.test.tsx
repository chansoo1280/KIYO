import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, screen, act } from "@testing-library/react";
import type { NavigateFunction } from "react-router-dom";
import { RootRedirect } from "@/pages/RootRedirect";
import { fileTable } from "@/database/fileTable";
import type { ActiveFileInfo } from "@/database/fileTable";
import type { EncryptedKiyoVaultData } from "@/models/vault";
import type { KiyoVaultData } from "@/models/vault";

// PR 1: RootRedirect는 loadVaultToStores(info.fileData)를 직접 호출
// loadAccounts/loadTemplates는 더 이상 RootRedirect에서 호출하지 않음

vi.mock("@/database/fileTable", () => ({
  fileTable: {
    getFileInfo: vi.fn(),
  },
}));

const hoisted = vi.hoisted(() => {
  const mockLoadVaultToStores = vi.fn();
  const mockActivatePlaintextVault = vi.fn();
  return { mockLoadVaultToStores, mockActivatePlaintextVault };
});

vi.mock("@/database/fileStorage", async () => {
  const actual = await vi.importActual<typeof import("@/database/fileStorage")>("@/database/fileStorage");
  return {
    ...actual,
    loadVaultToStores: hoisted.mockLoadVaultToStores,
    activatePlaintextVault: hoisted.mockActivatePlaintextVault,
  };
});

const mockLoadVaultToStores = hoisted.mockLoadVaultToStores;
const mockActivatePlaintextVault = hoisted.mockActivatePlaintextVault;

const mockNavigate = vi.fn<NavigateFunction>();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockFileTable = vi.mocked(fileTable);

// ActiveFileInfo helpers
const createEncryptedInfo = (activeFileName = "vault.json"): ActiveFileInfo => ({
  encrypted: true,
  activeFileName,
  fileData: {} as EncryptedKiyoVaultData,
  salt: new Uint8Array([1, 2, 3, 4]),
});

const createPlainInfo = (activeFileName = "plain.json"): ActiveFileInfo => ({
  encrypted: false,
  activeFileName,
  fileData: {
    version: 1,
    fileName: activeFileName,
    updatedAt: 0,
    accounts: [],
    templates: [],
    metadata: [],
  } as KiyoVaultData,
  salt: null,
});

const createStaleInfo = (): ActiveFileInfo => ({
  encrypted: false,
  activeFileName: null,
  fileData: null,
  salt: null,
});

// Session state helper (via real zustand setState)
import { useSessionStore } from "@/store/sessionStore";
const setSessionState = (activeFileName: string | null, cryptoKey: CryptoKey | null) => {
  useSessionStore.setState({ activeFileName, cryptoKey });
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockLoadVaultToStores.mockReset();
  mockActivatePlaintextVault.mockReset();
  mockFileTable.getFileInfo.mockReset();
  mockLoadVaultToStores.mockResolvedValue(undefined);
  mockActivatePlaintextVault.mockResolvedValue(undefined);
  setSessionState(null, null);
  useSessionStore.setState({ initialized: false });
});

describe("RootRedirect (PR 1: loadVaultToStores 진입점)", () => {
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
    // preload 발화 안 함
    expect(mockLoadVaultToStores).not.toHaveBeenCalled();
  });

  it("④ activeFileName=set + encrypted=true + cryptoKey=set → loadVaultToStores → /accounts navigate (replace)", async () => {
    const cryptoKey = {} as CryptoKey;
    setSessionState("vault.json", cryptoKey);
    mockFileTable.getFileInfo.mockResolvedValue(createEncryptedInfo("vault.json"));
    render(<RootRedirect />);
    await waitFor(() => {
      expect(mockLoadVaultToStores).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/accounts", { replace: true });
    });
  });

  it("⑤ loadVaultToStores throw → ErrorScreen variant='generic' 표시", { timeout: 15_000 }, async () => {
    const cryptoKey = {} as CryptoKey;
    setSessionState("vault.json", cryptoKey);
    mockFileTable.getFileInfo.mockResolvedValue(createEncryptedInfo("vault.json"));
    mockLoadVaultToStores.mockRejectedValue(new Error("load failed"));
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
      expect(mockLoadVaultToStores).toHaveBeenCalled();
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
    // unmount 후 setState 없음
    expect(mockLoadVaultToStores).not.toHaveBeenCalled();
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

  it("⑩ preload timeout → 1회 재시도 → 성공 시 /accounts navigate (PR 1 회귀 수정)", { timeout: 15_000 }, async () => {
    setSessionState("plain.json", null);
    mockFileTable.getFileInfo.mockResolvedValue(createPlainInfo("plain.json"));
    // 첫 호출: 영원히 pending
    mockLoadVaultToStores.mockImplementationOnce(
      () => new Promise(() => {}),
    );
    // 재시도: 정상 resolve
    mockLoadVaultToStores.mockResolvedValueOnce(undefined);

    render(<RootRedirect />);
    await waitFor(
      () => {
        expect(mockLoadVaultToStores).toHaveBeenCalledTimes(2);
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
    mockLoadVaultToStores.mockImplementation(() => new Promise(() => {}));

    render(<RootRedirect />);
    await waitFor(
      () => {
        expect(screen.getByText("데이터를 불러올 수 없습니다")).toBeInTheDocument();
      },
      { timeout: 10_000 },
    );
    expect(screen.getByText("preload timeout")).toBeInTheDocument();
  });
});