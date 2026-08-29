import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, "localStorage", { value: mockLocalStorage, writable: true });

describe("settingsStore - autoBackup fields", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockLocalStorage.clear();
    // Reset store by re-importing (zustand persist will reload from localStorage)
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("autoBackupEnabled와 autoBackupUri 초기값이 false/null", async () => {
    const { useSettingsStore: store } = await import("@/store/settingsStore");
    const state = store.getState();

    expect(state.autoBackupEnabled).toBe(false);
    expect(state.autoBackupUri).toBe(null);
  });

  it("setAutoBackupEnabled가 상태를 변경하고 persist함", async () => {
    const { useSettingsStore: store } = await import("@/store/settingsStore");
    
    await act(async () => {
      await store.getState().setAutoBackupEnabled(true);
    });

    const state = store.getState();
    expect(state.autoBackupEnabled).toBe(true);
    
    // localStorage에 저장되었는지 확인
    const stored = JSON.parse(mockLocalStorage.getItem("kiyo-settings") || "{}");
    expect(stored.state.autoBackupEnabled).toBe(true);
  });

  it("setAutoBackupUri가 상태를 변경하고 persist함", async () => {
    const { useSettingsStore: store } = await import("@/store/settingsStore");
    const testUri = "content://com.android.externalstorage.documents/tree/test%3Abackup";

    await act(async () => {
      await store.getState().setAutoBackupUri(testUri);
    });

    const state = store.getState();
    expect(state.autoBackupUri).toBe(testUri);
    
    const stored = JSON.parse(mockLocalStorage.getItem("kiyo-settings") || "{}");
    expect(stored.state.autoBackupUri).toBe(testUri);
  });

  it("autoBackup 필드들이 partialize에 포함됨", async () => {
    const { useSettingsStore: store } = await import("@/store/settingsStore");
    
    await act(async () => {
      await store.getState().setAutoBackupEnabled(true);
      await store.getState().setAutoBackupUri("content://test/uri");
    });

    const stored = JSON.parse(mockLocalStorage.getItem("kiyo-settings") || "{}");
    expect(stored.state.autoBackupEnabled).toBe(true);
    expect(stored.state.autoBackupUri).toBe("content://test/uri");
  });

  it("initializeAutoBackup이 에러 없이 실행됨", async () => {
    const { useSettingsStore: store } = await import("@/store/settingsStore");
    
    await act(async () => {
      await store.getState().initializeAutoBackup();
    });

    // 에러 없이 완료되면 성공
    expect(true).toBe(true);
  });

  it("autoBackupEnabled false 설정 시 autoBackupUri 유지됨", async () => {
    const { useSettingsStore: store } = await import("@/store/settingsStore");
    
    await act(async () => {
      await store.getState().setAutoBackupUri("content://test/uri");
      await store.getState().setAutoBackupEnabled(true);
      await store.getState().setAutoBackupEnabled(false);
    });

    const state = store.getState();
    expect(state.autoBackupEnabled).toBe(false);
    expect(state.autoBackupUri).toBe("content://test/uri"); // URI는 유지
  });
});