import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Account } from "@/models/account";
import type { FieldType } from "@/models/fieldTypes";

vi.mock("@/persistence/persistencePort", () => ({
  requestSave: vi.fn(),
}));

import { requestSave } from "@/persistence/persistencePort";
import { useAccountStore } from "@/store/accountStore";

const mockAccount: Omit<Account, "id"> = {
  templateId: "default",
  title: "Test Account",
  tags: [],
  favorite: false,
  fields: [
    { id: "f1", accountId: undefined, label: "이메일", type: "email" as FieldType, value: "test@example.com", order: 1 },
    { id: "f2", accountId: undefined, label: "비밀번호", type: "password" as FieldType, value: "secret123", order: 2 },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("accountStore - syncStatus / syncError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAccountStore.setState({
      accounts: [],
      syncStatus: "idle",
      syncError: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("초기 syncStatus는 'idle', syncError는 null", () => {
    const state = useAccountStore.getState();
    expect(state.syncStatus).toBe("idle");
    expect(state.syncError).toBe(null);
  });

  it("addAccount 성공 시 syncStatus가 'syncing' → 'synced'로 전이", async () => {
    (requestSave as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await useAccountStore.getState().addAccount(mockAccount);

    expect(useAccountStore.getState().syncStatus).toBe("synced");
    expect(useAccountStore.getState().syncError).toBe(null);
    expect(requestSave).toHaveBeenCalledTimes(1);
  });

  it("addAccount 실패 시 syncStatus가 'failed', syncError에 메시지 저장", async () => {
    const error = new Error("IndexedDB write failed");
    (requestSave as ReturnType<typeof vi.fn>).mockRejectedValue(error);

    await expect(
      useAccountStore.getState().addAccount(mockAccount)
    ).rejects.toThrow("IndexedDB write failed");

    expect(useAccountStore.getState().syncStatus).toBe("failed");
    expect(useAccountStore.getState().syncError).toBe("IndexedDB write failed");
  });

  it("updateAccount 성공 시 syncStatus가 'synced'로 전이", async () => {
    (requestSave as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    useAccountStore.getState().init([
      { ...mockAccount, id: 1 },
    ]);

    await useAccountStore.getState().updateAccount({ ...mockAccount, id: 1 });

    expect(useAccountStore.getState().syncStatus).toBe("synced");
    expect(requestSave).toHaveBeenCalledTimes(1);
  });

  it("deleteAccount 성공 시 syncStatus가 'synced'로 전이", async () => {
    (requestSave as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    useAccountStore.getState().init([
      { ...mockAccount, id: 1 },
    ]);

    await useAccountStore.getState().deleteAccount(1);

    expect(useAccountStore.getState().syncStatus).toBe("synced");
    expect(requestSave).toHaveBeenCalledTimes(1);
  });

  it("clearAccounts 성공 시 syncStatus가 'synced'로 전이", async () => {
    (requestSave as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    useAccountStore.getState().init([
      { ...mockAccount, id: 1 },
    ]);

    await useAccountStore.getState().clearAccounts();

    expect(useAccountStore.getState().syncStatus).toBe("synced");
    expect(requestSave).toHaveBeenCalledTimes(1);
  });
});
