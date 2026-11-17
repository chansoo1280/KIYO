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

const mockFileTable = vi.mocked(fileTable);

describe("vaultPersistence (Persistence Coordinator)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("loadVault should accept fileName and return KiyoVaultData | null", async () => {
    mockFileTable.getFileInfo.mockResolvedValue({
      activeFileName: null,
      salt: null,
      encrypted: false,
      fileData: null,
    } as unknown as ActiveFileInfo);
    await expect(loadVault("nonexistent")).resolves.toBeNull();
  });

  it("lockVault should return void", async () => {
    await expect(lockVault()).resolves.toBeUndefined();
  });

  it("unlockVault should accept fileName and pin, return KiyoVaultData | null", async () => {
    mockFileTable.getFileInfo.mockResolvedValue({
      activeFileName: "nonexistent",
      salt: null,
      encrypted: false,
      fileData: null,
    } as unknown as ActiveFileInfo);
    await expect(unlockVault("nonexistent", "wrong-pin")).rejects.toThrow();
  });
});
