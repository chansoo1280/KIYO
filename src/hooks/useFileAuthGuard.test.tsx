import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { NavigateFunction } from "react-router-dom";

import { useFileAuthGuard } from "@/hooks/useFileAuthGuard";
import { fileTable } from "@/database/fileTable";
import { useSessionStore } from "@/store/sessionStore";
import type { ActiveFileInfo } from "@/database/fileTable";
import type { SessionState } from "@/store/sessionStore";

// PR 1: useFileAuthGuard는 단순 redirect 가드 (onInitialized/skipRedirect 제거됨)
// Test: session 상태 + fileTable.getFileInfo 결과에 따라 라우팅 결정 검증

vi.mock("@/database/fileTable", () => ({
  fileTable: {
    getFileInfo: vi.fn(),
  },
}));

vi.mock("@/store/sessionStore", () => ({
  useSessionStore: {
    getState: vi.fn(),
  },
}));

const mockNavigate = vi.fn<NavigateFunction>();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

const mockFileTable = vi.mocked(fileTable);
const mockUseSessionStore = vi.mocked(useSessionStore);

const createMockSessionState = (overrides: Partial<SessionState> = {}): SessionState => ({
  activeFileName: null,
  cryptoKey: null,
  salt: null,
  initialized: false,
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

describe("useFileAuthGuard - Session/Auth Boundaries (PR 1: 단순 redirect 가드)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("activeFileName 없음 → / 로 navigate", async () => {
    mockUseSessionStore.getState.mockReturnValue(createMockSessionState({ activeFileName: null }));

    renderHook(() => useFileAuthGuard());

    // microtask 대기
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("activeFileName + encrypted + cryptoKey 없음 → /auth 로 navigate", async () => {
    mockUseSessionStore.getState.mockReturnValue(
      createMockSessionState({ activeFileName: "test.json", cryptoKey: null })
    );
    mockFileTable.getFileInfo.mockResolvedValue({
      encrypted: true,
      fileData: { version: 1, encrypted: true, ciphertext: "ct", iv: "iv", salt: "salt" },
      salt: new Uint8Array(),
      activeFileName: "test.json",
    } as ActiveFileInfo);

    renderHook(() => useFileAuthGuard());

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockNavigate).toHaveBeenCalledWith("/auth", { replace: true });
  });

  it("activeFileName + encrypted + cryptoKey 있음 → navigate 없음 (통과)", async () => {
    const mockKey = { type: "secret" } as CryptoKey;
    mockUseSessionStore.getState.mockReturnValue(
      createMockSessionState({ activeFileName: "test.json", cryptoKey: mockKey })
    );
    mockFileTable.getFileInfo.mockResolvedValue({
      encrypted: true,
      fileData: { version: 1, encrypted: true, ciphertext: "ct", iv: "iv", salt: "salt" },
      salt: new Uint8Array(),
      activeFileName: "test.json",
    } as ActiveFileInfo);

    renderHook(() => useFileAuthGuard());

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("activeFileName + plaintext → navigate 없음 (통과)", async () => {
    mockUseSessionStore.getState.mockReturnValue(
      createMockSessionState({ activeFileName: "plain.json" })
    );
    mockFileTable.getFileInfo.mockResolvedValue({
      encrypted: false,
      fileData: { version: 1, fileName: "plain.json", updatedAt: 0, accounts: [], templates: [], metadata: [] },
      salt: null,
      activeFileName: "plain.json",
    } as ActiveFileInfo);

    renderHook(() => useFileAuthGuard());

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("activeFileName 있는데 getFileInfo가 null 반환 → ErrorScreen (Q-안)", async () => {
    mockUseSessionStore.getState.mockReturnValue(
      createMockSessionState({ activeFileName: "missing.json" })
    );
    mockFileTable.getFileInfo.mockResolvedValue({
      encrypted: false,
      fileData: null,
      salt: null,
      activeFileName: null, // stale
    } as ActiveFileInfo);

    renderHook(() => useFileAuthGuard());

    await new Promise((resolve) => setTimeout(resolve, 0));
    // getFileInfo가 stale (activeFileName null) 이면 production code는 navigate 안 함
    // (RootRedirect의 stale 처리는 별도 layer)
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});