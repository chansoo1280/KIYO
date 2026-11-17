import { describe, it, expect, vi, beforeEach } from "vitest";
import type { KiyoVaultData } from "@/models/vault";
import type { ActiveFileInfo } from "@/database/fileTable";
import { fileTable } from "@/database/fileTable";
import {
  saveVault,
  loadVault,
  lockVault,
  unlockVault,
} from "@/persistence/vaultPersistence";

vi.mock("@/database/fileTable", () => ({
  fileTable: {
    getFileInfo: vi.fn(),
    upsertFileRecord: vi.fn(),
  },
}));

vi.mock("@/database/fileStorage", () => ({
  decryptVaultData: vi.fn(),
  createEncryptedVault: vi.fn(),
  isKiyoFile: vi.fn(),
}));

vi.mock("@/store/sessionStore", () => ({
  useSessionStore: vi.fn(),
}));

vi.mock("@/store/accountStore", () => ({
  useAccountStore: vi.fn(),
}));

vi.mock("@/store/templateStore", () => ({
  useTemplateStore: vi.fn(),
}));

vi.mock("@/store/metadataStore", () => ({
  useMetadataStore: vi.fn(),
}));

import { decryptVaultData } from "@/database/fileStorage";
import { useSessionStore } from "@/store/sessionStore";
import { useAccountStore } from "@/store/accountStore";
import { useTemplateStore } from "@/store/templateStore";
import { useMetadataStore } from "@/store/metadataStore";
import type { AccountState } from "@/store/accountStore";
import type { MetadataState } from "@/store/metadataStore";
import type { SessionState } from "@/store/sessionStore";
import type { TemplateState } from "@/store/templateStore";

const mockFileTable = vi.mocked(fileTable);
const mockDecryptVaultData = vi.mocked(decryptVaultData);
const mockUseSessionStore = vi.mocked(useSessionStore);
const mockUseAccountStore = vi.mocked(useAccountStore);
const mockUseTemplateStore = vi.mocked(useTemplateStore);
const mockUseMetadataStore = vi.mocked(useMetadataStore);

function createMockSessionState(): SessionState {
  return {
    activeFileName: null,
    cryptoKey: null,
    salt: null,
    initialized: false,
    setSession: vi.fn(),
    clearCryptoKey: vi.fn(),
    setCryptoKey: vi.fn(),
    setCryptoKeyFromBase64: vi.fn(),
    setSyncError: vi.fn(),
    clearSyncError: vi.fn(),
    setLastSyncTime: vi.fn(),
    setLastSyncedAutofillCount: vi.fn(),
    lastSyncError: null,
    lastSyncErrorTime: null,
    lastSyncTime: null,
    lastSyncedAutofillCount: null,
  } as unknown as SessionState;
}

function createMockAccountState(): AccountState {
  return {
    accounts: [],
    init: vi.fn(),
    getAll: vi.fn(() => []),
    addAccount: vi.fn(),
    updateAccount: vi.fn(),
    deleteAccount: vi.fn(),
    getAccountById: vi.fn(() => undefined),
    clearAccounts: vi.fn(),
    syncToAutofill: vi.fn(),
    getAutofillAccounts: vi.fn(() => Promise.resolve([])),
  } as unknown as AccountState;
}

function createMockTemplateState(): TemplateState {
  return {
    templates: [],
    init: vi.fn(),
    getAll: vi.fn(() => []),
    addTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    clearTemplates: vi.fn(),
  } as unknown as TemplateState;
}

function createMockMetadataState(): MetadataState {
  return {
    metadata: [],
    init: vi.fn(),
    getAll: vi.fn(() => []),
    clearMetadata: vi.fn(),
  } as unknown as MetadataState;
}

describe("vaultPersistence (Persistence Coordinator)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const sessionState = createMockSessionState();
    const accountState = createMockAccountState();
    const templateState = createMockTemplateState();
    const metadataState = createMockMetadataState();

    mockUseSessionStore.getState = vi.fn(() => sessionState);
    mockUseSessionStore.setState = vi.fn((partial) => {
      Object.assign(sessionState, partial);
    });
    mockUseSessionStore.mockImplementation((selector) =>
      selector(sessionState as unknown as SessionState)
    );

    mockUseAccountStore.getState = vi.fn(() => accountState);
    mockUseAccountStore.mockImplementation((selector) =>
      selector(accountState as unknown as AccountState)
    );

    mockUseTemplateStore.getState = vi.fn(() => templateState);
    mockUseTemplateStore.mockImplementation((selector) =>
      selector(templateState as unknown as TemplateState)
    );

    mockUseMetadataStore.getState = vi.fn(() => metadataState);
    mockUseMetadataStore.mockImplementation((selector) =>
      selector(metadataState as unknown as MetadataState)
    );
  });

  it("should export saveVault, loadVault, lockVault, unlockVault", () => {
    expect(typeof saveVault).toBe("function");
    expect(typeof loadVault).toBe("function");
    expect(typeof lockVault).toBe("function");
    expect(typeof unlockVault).toBe("function");
  });

  it("saveVault should accept fileName and KiyoVaultData snapshot", async () => {
    const snapshot: KiyoVaultData = {
      version: 1,
      fileName: "test-vault",
      updatedAt: Date.now(),
      accounts: [],
      templates: [],
      metadata: [],
    };
    await expect(saveVault("test-vault", snapshot)).resolves.toBeUndefined();
  });

  it("saveVault should call fileTable.upsertFileRecord with plaintext when no cryptoKey", async () => {
    const snapshot: KiyoVaultData = {
      version: 1,
      fileName: "plaintext.json",
      updatedAt: Date.now(),
      accounts: [],
      templates: [],
      metadata: [],
    };
    await saveVault("plaintext.json", snapshot);
    expect(mockFileTable.upsertFileRecord).toHaveBeenCalledWith(
      "plaintext.json",
      snapshot
    );
  });

  it("loadVault should return null when file not found", async () => {
    mockFileTable.getFileInfo.mockResolvedValue({
      activeFileName: null,
      salt: null,
      encrypted: false,
      fileData: null,
    } as unknown as ActiveFileInfo);
    await expect(loadVault("nonexistent")).resolves.toBeNull();
  });

  it("loadVault should return null when file is encrypted", async () => {
    mockFileTable.getFileInfo.mockResolvedValue({
      activeFileName: "encrypted.json",
      salt: "c2FsdA==",
      encrypted: true,
      fileData: { encrypted: true, salt: "c2FsdA==", iv: "", ciphertext: "", version: 1 },
    } as unknown as ActiveFileInfo);
    await expect(loadVault("encrypted.json")).resolves.toBeNull();
  });

  it("loadVault should return fileData when file is plaintext", async () => {
    const plaintext: KiyoVaultData = {
      version: 1,
      fileName: "plaintext.json",
      updatedAt: Date.now(),
      accounts: [],
      templates: [],
      metadata: [],
    };
    mockFileTable.getFileInfo.mockResolvedValue({
      activeFileName: "plaintext.json",
      salt: null,
      encrypted: false,
      fileData: plaintext,
    } as unknown as ActiveFileInfo);
    await expect(loadVault("plaintext.json")).resolves.toBe(plaintext);
  });

  it("lockVault should call clearCryptoKey", async () => {
    await expect(lockVault()).resolves.toBeUndefined();
    const sessionStore = mockUseSessionStore.getState();
    expect(sessionStore.clearCryptoKey).toHaveBeenCalled();
  });

  it("unlockVault should throw when file not found", async () => {
    mockFileTable.getFileInfo.mockResolvedValue({
      activeFileName: null,
      salt: null,
      encrypted: false,
      fileData: null,
    } as unknown as ActiveFileInfo);
    await expect(unlockVault("nonexistent", "wrong-pin")).rejects.toThrow(
      "File not found: nonexistent"
    );
  });

  it("unlockVault should throw when salt missing for encrypted file", async () => {
    mockFileTable.getFileInfo.mockResolvedValue({
      activeFileName: "encrypted.json",
      salt: null,
      encrypted: true,
      fileData: { encrypted: true, salt: "", iv: "", ciphertext: "", version: 1 },
    } as unknown as ActiveFileInfo);
    await expect(unlockVault("encrypted.json", "1234")).rejects.toThrow(
      "Salt missing for encrypted file: encrypted.json"
    );
  });

  it("unlockVault should decrypt and load vault to stores on correct PIN", async () => {
    const decrypted: KiyoVaultData = {
      version: 1,
      fileName: "encrypted.json",
      updatedAt: Date.now(),
      accounts: [],
      templates: [],
      metadata: [],
    };

    mockFileTable.getFileInfo.mockResolvedValue({
      activeFileName: "encrypted.json",
      salt: "c2FsdA==",
      encrypted: true,
      fileData: { encrypted: true, salt: "c2FsdA==", iv: "", ciphertext: "", version: 1 },
    } as unknown as ActiveFileInfo);

    mockDecryptVaultData.mockResolvedValue({
      decryptedVaultData: decrypted,
      cryptoKey: {} as CryptoKey,
    });

    await expect(unlockVault("encrypted.json", "1234")).resolves.toBe(decrypted);

    expect(mockUseSessionStore.getState().setSession).toHaveBeenCalled();

    expect(mockUseAccountStore.getState().init).toHaveBeenCalledWith([]);
    expect(mockUseTemplateStore.getState().init).toHaveBeenCalledWith([]);
    expect(mockUseMetadataStore.getState().init).toHaveBeenCalledWith([]);
    expect(mockUseSessionStore.getState().initialized).toBe(true);
  });

  it("unlockVault should throw on wrong PIN", async () => {
    mockFileTable.getFileInfo.mockResolvedValue({
      activeFileName: "encrypted.json",
      salt: "c2FsdA==",
      encrypted: true,
      fileData: { encrypted: true, salt: "c2FsdA==", iv: "", ciphertext: "", version: 1 },
    } as unknown as ActiveFileInfo);

    mockDecryptVaultData.mockRejectedValue(new Error("PIN 불일치"));

    await expect(unlockVault("encrypted.json", "wrong-pin")).rejects.toThrow(
      "PIN 불일치"
    );
  });
});
