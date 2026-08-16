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
    getActiveFileInfo: vi.fn(),
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
  setSession: vi.fn(),
  setCryptoKey: vi.fn(),
  setCryptoKeyFromBase64: vi.fn(),
  clearCryptoKey: vi.fn(),
  clearSession: vi.fn(),
  setSyncError: vi.fn(),
  clearSyncError: vi.fn(),
  setLastSyncTime: vi.fn(),
  ...overrides,
});

// Helper to create a complete ActiveFileInfo mock
const createMockActiveFileInfo = (overrides: Partial<ActiveFileInfo>): ActiveFileInfo => {
  if (overrides.encrypted === true) {
    // For encrypted, we need all required fields
    return {
      encrypted: true,
      fileData: { 
        encrypted: true, 
        ciphertext: "ciphertext", 
        iv: "iv", 
        salt: "salt", 
        algorithm: "AES-GCM", 
        version: 1 
      } as EncryptedKiyoVaultData,
      salt: new Uint8Array(),
      activeFileName: "test.json",
      ...overrides,
    } as ActiveFileInfo;
  }
  // For non-encrypted
  return {
    encrypted: false,
    fileData: null,
    salt: null,
    activeFileName: null,
    ...overrides,
  } as ActiveFileInfo;
};

describe("useFileAuthGuard - Session/Auth Boundaries", () => {
  let mockOnNoFile: () => void;
  let mockOnLocked: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockOnNoFile = vi.fn<() => void>();
    mockOnLocked = vi.fn<() => void>();

    // Reset the mock store state with complete SessionState
    mockUseSessionStore.getState.mockReturnValue(createMockSessionState());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("활성 파일이 없으면 onNoFile 콜백 호출 및 홈으로 리다이렉트", async () => {
    mockFileTable.getActiveFileInfo.mockResolvedValue(
      createMockActiveFileInfo({ activeFileName: null, encrypted: false })
    );

    renderHook(() =>
      useFileAuthGuard({
        onNoFile: mockOnNoFile,
        skipRedirect: false,
      })
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnNoFile).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("활성 파일이 없는데 skipRedirect=true면 리다이렉트 안 함", async () => {
    mockFileTable.getActiveFileInfo.mockResolvedValue(
      createMockActiveFileInfo({ activeFileName: null, encrypted: false })
    );

    renderHook(() =>
      useFileAuthGuard({
        onNoFile: mockOnNoFile,
        skipRedirect: true,
      })
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnNoFile).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("암호화된 파일이지만 cryptoKey가 없으면 onLocked 콜백 호출 및 /auth로 리다이렉트", async () => {
    mockFileTable.getActiveFileInfo.mockResolvedValue(
      createMockActiveFileInfo({ activeFileName: "test.json", encrypted: true })
    );

    mockUseSessionStore.getState.mockReturnValue(
      createMockSessionState({ cryptoKey: null, activeFileName: "test.json" })
    );

    renderHook(() =>
      useFileAuthGuard({
        onLocked: mockOnLocked,
        skipRedirect: false,
      })
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnLocked).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/auth", { replace: true });
  });

  it("암호화된 파일이지만 cryptoKey가 없는데 skipRedirect=true면 리다이렉트 안 함", async () => {
    mockFileTable.getActiveFileInfo.mockResolvedValue(
      createMockActiveFileInfo({ activeFileName: "test.json", encrypted: true })
    );

    mockUseSessionStore.getState.mockReturnValue(
      createMockSessionState({ cryptoKey: null, activeFileName: "test.json" })
    );

    renderHook(() =>
      useFileAuthGuard({
        onLocked: mockOnLocked,
        skipRedirect: true,
      })
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnLocked).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("암호화되지 않은 파일이고 cryptoKey가 없어도 통과 (리다이렉트 없음)", async () => {
    mockFileTable.getActiveFileInfo.mockResolvedValue(
      createMockActiveFileInfo({ activeFileName: "plain.json", encrypted: false })
    );

    mockUseSessionStore.getState.mockReturnValue(
      createMockSessionState({ cryptoKey: null, activeFileName: "plain.json" })
    );

    renderHook(() =>
      useFileAuthGuard({
        onLocked: mockOnLocked,
        onNoFile: mockOnNoFile,
        skipRedirect: false,
      })
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnLocked).not.toHaveBeenCalled();
    expect(mockOnNoFile).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("암호화된 파일에 유효한 cryptoKey가 있으면 통과", async () => {
    const mockCryptoKey = {} as CryptoKey;

    mockFileTable.getActiveFileInfo.mockResolvedValue(
      createMockActiveFileInfo({ activeFileName: "encrypted.json", encrypted: true })
    );

    mockUseSessionStore.getState.mockReturnValue(
      createMockSessionState({ cryptoKey: mockCryptoKey, activeFileName: "encrypted.json" })
    );

    renderHook(() =>
      useFileAuthGuard({
        onLocked: mockOnLocked,
        onNoFile: mockOnNoFile,
        skipRedirect: false,
      })
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnLocked).not.toHaveBeenCalled();
    expect(mockOnNoFile).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("언마운트 시 mounted 플래그로 정리됨", async () => {
    mockFileTable.getActiveFileInfo.mockResolvedValue(
      createMockActiveFileInfo({ activeFileName: "test.json", encrypted: true })
    );

    mockUseSessionStore.getState.mockReturnValue(
      createMockSessionState({ cryptoKey: null, activeFileName: "test.json" })
    );

    const { unmount } = renderHook(() =>
      useFileAuthGuard({
        onLocked: mockOnLocked,
        skipRedirect: false,
      })
    );

    unmount();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOnLocked).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("getActiveFileInfo 에러 시에도 에러 던지지 않음", async () => {
    mockFileTable.getActiveFileInfo.mockRejectedValue(new Error("DB Error"));

    mockUseSessionStore.getState.mockReturnValue(createMockSessionState());

    renderHook(() =>
      useFileAuthGuard({
        onNoFile: mockOnNoFile,
        skipRedirect: false,
      })
    );

    // The effect will throw but we handle it gracefully
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("옵션 없이 기본값으로 동작 (skipRedirect=false)", async () => {
    mockFileTable.getActiveFileInfo.mockResolvedValue(
      createMockActiveFileInfo({ activeFileName: null, encrypted: false })
    );

    renderHook(() => useFileAuthGuard({}));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("sessionStore의 cryptoKey getter가 getState()로 직접 접근함", async () => {
    const getStateMock = vi.fn().mockReturnValue(
      createMockSessionState({ cryptoKey: {} as CryptoKey, activeFileName: "test.json" })
    );

    mockUseSessionStore.getState = getStateMock;

    mockFileTable.getActiveFileInfo.mockResolvedValue(
      createMockActiveFileInfo({ activeFileName: "test.json", encrypted: true })
    );

    renderHook(() =>
      useFileAuthGuard({ skipRedirect: false })
    );

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(getStateMock).toHaveBeenCalled();
  });
});