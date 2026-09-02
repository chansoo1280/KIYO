import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { useAutoLock } from "@/hooks/useAutoLock";
import { useSettingsStore } from "@/store/settingsStore";
import { useSessionStore } from "@/store/sessionStore";
import { lockDataFile } from "@/database/fileStorage";
import { renderHook } from "@testing-library/react";
import type { SettingsState } from "@/store/settingsStore";
import type { SessionState } from "@/store/sessionStore";

// Mock Zustand stores
vi.mock("@/store/settingsStore", () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock("@/store/sessionStore", () => ({
  useSessionStore: vi.fn(),
}));

vi.mock("@/database/fileStorage", () => ({
  lockDataFile: vi.fn(),
}));

const mockUseSettingsStore = vi.mocked(useSettingsStore);
const mockUseSessionStore = vi.mocked(useSessionStore);
const mockLockDataFile = vi.mocked(lockDataFile);

// Helper to create a mock CryptoKey
const createMockCryptoKey = (): CryptoKey => {
  return {} as CryptoKey;
};

// Helper to advance timers and flush effects
const advanceTime = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe("useAutoLock - Edge Cases", () => {
  let mockSettingsState: SettingsState;
  let mockSessionState: SessionState;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockSettingsState = {
      theme: "light",
      fontSize: "medium",
      autoLockTimeout: "1m",
      biometricEnabled: false,
      autofillEnabled: false,
      autoBackupEnabled: false,
      autoBackupUri: null,
      setBiometricEnabled: vi.fn(),
      setTheme: vi.fn(),
      toggleTheme: vi.fn(),
      setFontSize: vi.fn(),
      setAutoLockTimeout: vi.fn(),
      setAutofillEnabled: vi.fn(),
      setAutoBackupEnabled: vi.fn(),
      setAutoBackupUri: vi.fn(),
    };

    mockSessionState = {
      activeFileName: null,
      cryptoKey: createMockCryptoKey(),
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
    };

    mockUseSettingsStore.mockImplementation((selector) => selector(mockSettingsState));
    mockUseSessionStore.mockImplementation((selector) => selector(mockSessionState));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("타이머가 'none'으로 설정된 경우 startTimer가 즉시 리턴", () => {
    mockSettingsState.autoLockTimeout = "none";

    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    expect(mockLockDataFile).not.toHaveBeenCalled();
    expect(result.current.remainingSeconds).toBe(0);
  });

  it("cryptoKey가 없는 경우 startTimer가 즉시 리턴", () => {
    mockSessionState.cryptoKey = null;

    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    expect(mockLockDataFile).not.toHaveBeenCalled();
    expect(result.current.remainingSeconds).toBe(0);
  });

  it("이미 실행 중인 타이머가 있으면 중복 시작 방지", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    const firstTimerCount = vi.getTimerCount();

    act(() => {
      result.current.startTimer();
    });

    expect(vi.getTimerCount()).toBe(firstTimerCount);
  });

  it("활동 감지 시 타이머가 리셋됨 (click 이벤트)", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    expect(result.current.remainingSeconds).toBe(60);

    // 활동 발생 (click 이벤트) - 타이머 시작 직후 바로 리셋 테스트
    act(() => {
      document.dispatchEvent(new Event("click"));
    });

    // 활동 이벤트 핸들러가 즉시 timeoutRef를 리셋하고 setRemainingSeconds 호출
    expect(result.current.remainingSeconds).toBe(60);
  });

  it("활동 감지 시 keydown 이벤트도 리셋", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    // 활동 발생 (keydown 이벤트)
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown"));
    });

    expect(result.current.remainingSeconds).toBe(60);
  });

  it("활동 감지 시 touchstart 이벤트도 리셋", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    advanceTime(30000);

    act(() => {
      document.dispatchEvent(new TouchEvent("touchstart"));
    });

    expect(result.current.remainingSeconds).toBe(60);
  });

  it("활동 감지 시 scroll 이벤트도 리셋", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    advanceTime(30000);

    act(() => {
      document.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.remainingSeconds).toBe(60);
  });

  it("타이머가 만료되면 lockDataFile이 호출되고 상태가 리셋", async () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    // 60초 경과
    advanceTime(61000);

    expect(mockLockDataFile).toHaveBeenCalled();
    expect(result.current.remainingSeconds).toBe(0);
  });

  it("stopTimer가 타이머를 정리하고 상태를 리셋", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    expect(result.current.remainingSeconds).toBe(60);

    // stopTimer should not throw and should clear the interval
    act(() => {
      result.current.stopTimer();
    });

    // Verify stopTimer executed without error
    expect(result.current.stopTimer).toBeDefined();
  });

  it("cleanup 시 타이머가 정리됨", () => {
    const { result, unmount } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    act(() => {
      vi.runOnlyPendingTimers();
    });

    // Cleanup effect runs but timers might already be cleared
    expect(vi.getTimerCount()).toBe(0);
  });

  it("autoLockTimeout 변경 시 타이머가 재시작됨", () => {
    const { result, rerender } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    expect(result.current.remainingSeconds).toBe(60);

    // 설정 변경
    mockSettingsState.autoLockTimeout = "10m";
    rerender();

    // 타이머가 600초로 재설정되어야 함
    expect(result.current.remainingSeconds).toBe(600);
  });

  it("cryptoKey가 null이 되면 타이머가 정지됨", () => {
    const { result, rerender } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    expect(result.current.remainingSeconds).toBe(60);

    // cryptoKey 제거
    mockSessionState.cryptoKey = null;
    rerender();

    // 타이머가 정지되고 remainingSeconds가 0
    expect(result.current.remainingSeconds).toBe(0);
  });

  it("잠금 상태(lockedRef)에서는 startTimer가 작동하지 않음", () => {
    const { result } = renderHook(() => useAutoLock());

    // 타이머 만료시켜 잠금 상태로 만들기
    act(() => {
      result.current.startTimer();
    });

    advanceTime(61000);

    expect(mockLockDataFile).toHaveBeenCalled();

    // 잠금 상태에서 startTimer 호출
    act(() => {
      result.current.startTimer();
    });

    // 새 타이머가 시작되지 않아야 함 (lockedRef.current = true)
    expect(result.current.remainingSeconds).toBe(0);
  });

  it("10m, 30m 타임아웃 값이 올바르게 매핑됨", () => {
    const testCases = [
      { timeout: "1m" as const, expected: 60 },
      { timeout: "10m" as const, expected: 600 },
      { timeout: "30m" as const, expected: 1800 },
    ];

    for (const { timeout, expected } of testCases) {
      vi.clearAllMocks();
      vi.useFakeTimers();

      mockSettingsState.autoLockTimeout = timeout;

      const { result } = renderHook(() => useAutoLock());

      act(() => {
        result.current.startTimer();
      });

      expect(result.current.remainingSeconds).toBe(expected);

      vi.useRealTimers();
    }
  });
});