import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import type { NavigateFunction } from "react-router-dom";

import { useFileAuthGuard } from "@/hooks/useFileAuthGuard";
import { fileTable } from "@/database/fileTable";
import { useSessionStore } from "@/store/sessionStore";
import type { ActiveFileInfo } from "@/database/fileTable";
import type { SessionState } from "@/store/sessionStore";
import type { EncryptedKiyoVaultData } from "@/models/vault";

// Mock dependencies BEFORE importing the hook
vi.mock("@/database/fileTable", () => ({
  fileTable: {
    getFileInfo: vi.fn(),
  },
}));

// Mock Zustand store with getState
vi.mock("@/store/sessionStore", () => ({
  useSessionStore: {
    getState: vi.fn(),
  },
}));

// Properly typed mock for useNavigate
const mockNavigate = vi.fn<NavigateFunction>();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

const mockFileTable = vi.mocked(fileTable);
const mockUseSessionStore = vi.mocked(useSessionStore);

// Helper to create a complete SessionState mock
const createMockSessionState = (overrides: Partial<SessionState> = {}): SessionState => ({
  activeFileName: null,
  cryptoKey: null,
  salt: null,
  lastSyncError: null,
  lastSyncErrorTime: null,
  lastSyncTime: null,
  lastAutofillAccountCount: null,
  setSession: vi.fn(),
  setCryptoKey: vi.fn(),
  setCryptoKeyFromBase64: vi.fn(),
  clearCryptoKey: vi.fn(),
  clearSession: vi.fn(),
  setSyncError: vi.fn(),
  clearSyncError: vi.fn(),
  setLastSyncTime: vi.fn(),
  setLastAutofillAccountCount: vi.fn(),
  ...overrides,
});

// Helper to create a complete ActiveFileInfo mock
// fileName은 fileTable.getFileInfo(fileName) 인자로 전달되므로
// mockResolvedValue 시 caller가 어떤 fileName을 넘기든 같은 결과 반환
const createMockActiveFileInfo = (overrides: Partial<ActiveFileInfo>): ActiveFileInfo => {
  if (overrides.encrypted === true) {
    return {
      encrypted: true,
      fileData: {
        encrypted: true,
        ciphertext: "ciphertext",
        iv: "iv",
        salt: "salt",
        algorithm: "AES-GCM",
        version: 1,
      } as EncryptedKiyoVaultData,
      salt: new Uint8Array(),
      activeFileName: "test.json",
      ...overrides,
    } as ActiveFileInfo;
  }
  return {
    encrypted: false,
    fileData: null,
    salt: null,
    activeFileName: null,
    ...overrides,
  } as ActiveFileInfo;
};

describe("useFileAuthGuard - Session/Auth Boundaries (v14 multi-row)", () => {
  let mockOnInitialized: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockOnInitialized = vi.fn<() => void>();

    // Reset the mock store state — activeFileName null (no active vault)
    mockUseSessionStore.getState.mockReturnValue(createMockSessionState());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("sessionStore에 active가 없으면 홈으로 리다이렉트하고 onInitialized는 호출 안 됨", async () => {
    mockUseSessionStore.getState.mockReturnValue(createMockSessionState({ activeFileName: null }));
    // getFileInfo는 호출되지 않음 (activeFileName null이면 early return)

    renderHook(() =>
      useFileAuthGuard({
        onInitialized: mockOnInitialized,
        skipRedirect: false,
      }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnInitialized).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("sessionStore에 active가 없는데 skipRedirect=true면 리다이렉트 안 함", async () => {
    mockUseSessionStore.getState.mockReturnValue(createMockSessionState({ activeFileName: null }));

    renderHook(() =>
      useFileAuthGuard({
        onInitialized: mockOnInitialized,
        skipRedirect: true,
      }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnInitialized).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("active가 encrypted이지만 cryptoKey가 없으면 /auth로 리다이렉트하고 onInitialized는 호출 안 됨", async () => {
    mockUseSessionStore.getState.mockReturnValue(
      createMockSessionState({ cryptoKey: null, activeFileName: "test.json" }),
    );
    mockFileTable.getFileInfo.mockResolvedValue(
      createMockActiveFileInfo({ activeFileName: "test.json", encrypted: true }),
    );

    renderHook(() =>
      useFileAuthGuard({
        onInitialized: mockOnInitialized,
        skipRedirect: false,
      }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnInitialized).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/auth", { replace: true });
    expect(mockFileTable.getFileInfo).toHaveBeenCalledWith("test.json");
  });

  it("locked 상태에서 skipRedirect=true면 리다이렉트 안 하고 onInitialized 호출 안 함", async () => {
    mockUseSessionStore.getState.mockReturnValue(
      createMockSessionState({ cryptoKey: null, activeFileName: "test.json" }),
    );
    mockFileTable.getFileInfo.mockResolvedValue(
      createMockActiveFileInfo({ activeFileName: "test.json", encrypted: true }),
    );

    renderHook(() =>
      useFileAuthGuard({
        onInitialized: mockOnInitialized,
        skipRedirect: true,
      }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnInitialized).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("plaintext이고 cryptoKey가 없어도 통과 — onInitialized 호출, 리다이렉트 없음", async () => {
    mockUseSessionStore.getState.mockReturnValue(
      createMockSessionState({ cryptoKey: null, activeFileName: "plain.json" }),
    );
    mockFileTable.getFileInfo.mockResolvedValue(
      createMockActiveFileInfo({ activeFileName: "plain.json", encrypted: false }),
    );

    renderHook(() =>
      useFileAuthGuard({
        onInitialized: mockOnInitialized,
        skipRedirect: false,
      }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnInitialized).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("encrypted이고 cryptoKey가 있으면 통과 — onInitialized 호출, 리다이렉트 없음", async () => {
    const mockCryptoKey = {} as CryptoKey;

    mockUseSessionStore.getState.mockReturnValue(
      createMockSessionState({ cryptoKey: mockCryptoKey, activeFileName: "encrypted.json" }),
    );
    mockFileTable.getFileInfo.mockResolvedValue(
      createMockActiveFileInfo({ activeFileName: "encrypted.json", encrypted: true }),
    );

    renderHook(() =>
      useFileAuthGuard({
        onInitialized: mockOnInitialized,
        skipRedirect: false,
      }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnInitialized).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("언마운트 시 mounted 플래그로 정리됨 — onInitialized 호출 안 됨", async () => {
    mockUseSessionStore.getState.mockReturnValue(
      createMockSessionState({ cryptoKey: null, activeFileName: "test.json" }),
    );
    mockFileTable.getFileInfo.mockResolvedValue(
      createMockActiveFileInfo({ activeFileName: "test.json", encrypted: true }),
    );

    const { unmount } = renderHook(() =>
      useFileAuthGuard({
        onInitialized: mockOnInitialized,
        skipRedirect: false,
      }),
    );

    unmount();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnInitialized).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("getFileInfo 에러 시에도 에러 던지지 않고 onInitialized 호출 안 됨", async () => {
    mockUseSessionStore.getState.mockReturnValue(
      createMockSessionState({ activeFileName: "test.json" }),
    );
    mockFileTable.getFileInfo.mockRejectedValue(new Error("DB Error"));

    renderHook(() =>
      useFileAuthGuard({
        onInitialized: mockOnInitialized,
        skipRedirect: false,
      }),
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnInitialized).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("옵션 없이 기본값으로 동작 (skipRedirect=false)", async () => {
    mockUseSessionStore.getState.mockReturnValue(createMockSessionState({ activeFileName: null }));

    renderHook(() => useFileAuthGuard({}));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("sessionStore의 cryptoKey getter가 getState()로 직접 접근함", async () => {
    const getStateMock = vi.fn().mockReturnValue(
      createMockSessionState({ cryptoKey: {} as CryptoKey, activeFileName: "test.json" }),
    );

    mockUseSessionStore.getState = getStateMock;
    mockFileTable.getFileInfo.mockResolvedValue(
      createMockActiveFileInfo({ activeFileName: "test.json", encrypted: true }),
    );

    renderHook(() => useFileAuthGuard({ skipRedirect: false }));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(getStateMock).toHaveBeenCalled();
  });
});