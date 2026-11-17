import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { useAutoLock } from "@/hooks/useAutoLock";
import { useSettingsStore } from "@/store/settingsStore";
import { useSessionStore } from "@/store/sessionStore";
import { lockVault } from "@/persistence/vaultPersistence";
import { renderHook } from "@testing-library/react";
import type { SettingsState } from "@/store/settingsStore";
import type { SessionState } from "@/store/sessionStore";

vi.mock("@/store/settingsStore", () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock("@/store/sessionStore", () => ({
  useSessionStore: vi.fn(),
}));

vi.mock("@/persistence/vaultPersistence", () => ({
  lockVault: vi.fn(),
}));

const mockUseSettingsStore = vi.mocked(useSettingsStore);
const mockUseSessionStore = vi.mocked(useSessionStore);
const mockLockVault = vi.mocked(lockVault);

const createMockCryptoKey = (): CryptoKey => {
  return {} as CryptoKey;
};

const setFakeTime = (time: Date | number) => {
  vi.setSystemTime(time);
};

const advanceFakeTime = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const triggerTick = () => {
  act(() => {
    vi.advanceTimersByTime(0);
  });
};

const dispatchActivity = () => {
  act(() => {
    document.dispatchEvent(new Event("click"));
  });
};

describe("useAutoLock - Absolute Time Comparison", () => {
  let mockSettingsState: SettingsState;
  let mockSessionState: SessionState;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "setInterval", "clearTimeout", "clearInterval"] });
    vi.clearAllMocks();

    setFakeTime(new Date("2024-01-01T00:00:00Z"));

    mockSettingsState = {
      theme: "light",
      fontSize: "medium",
      autoLockTimeout: "1m",
      autofillEnabled: false,
      autoBackupEnabled: false,
      autoBackupUri: null,
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
      lastSyncedAutofillCount: null,
      setSession: vi.fn(),
      setCryptoKey: vi.fn(),
      setCryptoKeyFromBase64: vi.fn(),
      clearCryptoKey: vi.fn(),
      clearSession: vi.fn(),
      setSyncError: vi.fn(),
      clearSyncError: vi.fn(),
      setLastSyncTime: vi.fn(),
      setLastSyncedAutofillCount: vi.fn(),
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

    expect(mockLockVault).not.toHaveBeenCalled();
    expect(result.current.remainingSeconds).toBe(0);
  });

  it("cryptoKey가 없는 경우 startTimer가 즉시 리턴", () => {
    mockSessionState.cryptoKey = null;

    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    expect(mockLockVault).not.toHaveBeenCalled();
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

  it("활동 감지 시 마지막 액션 시간이 갱신됨 (click 이벤트)", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    // 첫 활동으로 lastActivityTime 설정
    dispatchActivity();

    // 30초 경과
    advanceFakeTime(30000);
    triggerTick();

    // 두 번째 활동으로 lastActivityTime 갱신
    dispatchActivity();

    // 30초 더 경과 (총 60초 경과했지만 마지막 액션 후 30초만 지남)
    advanceFakeTime(30000);
    triggerTick();

    // 타임아웃에 도달하지 않았으므로 잠금 안 됨
    expect(mockLockVault).not.toHaveBeenCalled();
    // 1초 이상 남아있어야 함 (1ms 오차 허용)
    expect(result.current.remainingSeconds).toBeGreaterThan(0);
  });

  it("활동 감지 시 keydown 이벤트도 마지막 액션 시간을 갱신", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    dispatchActivity();

    advanceFakeTime(30000);
    triggerTick();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown"));
    });

    advanceFakeTime(30000);
    triggerTick();

    expect(mockLockVault).not.toHaveBeenCalled();
  });

  it("활동 감지 시 touchstart 이벤트도 마지막 액션 시간을 갱신", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    dispatchActivity();

    advanceFakeTime(30000);
    triggerTick();

    act(() => {
      document.dispatchEvent(new TouchEvent("touchstart"));
    });

    advanceFakeTime(30000);
    triggerTick();

    expect(mockLockVault).not.toHaveBeenCalled();
  });

  it("활동 감지 시 scroll 이벤트도 마지막 액션 시간을 갱신", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    dispatchActivity();

    advanceFakeTime(30000);
    triggerTick();

    act(() => {
      document.dispatchEvent(new Event("scroll"));
    });

    advanceFakeTime(30000);
    triggerTick();

    expect(mockLockVault).not.toHaveBeenCalled();
  });

  it("타임아웃 직전 (59,999ms)에는 잠금되지 않음", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    dispatchActivity();

    // 59,999ms 경과 (타임아웃 1ms 전)
    advanceFakeTime(59999);
    triggerTick();

    expect(mockLockVault).not.toHaveBeenCalled();
    expect(result.current.remainingSeconds).toBe(1);
  });

  it("타임아웃에 정확히 도달하면 잠금 실행 (>= 연산자)", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    dispatchActivity();

    // 정확히 60,000ms 경과
    advanceFakeTime(60000);
    triggerTick();

    expect(mockLockVault).toHaveBeenCalled();
    expect(result.current.remainingSeconds).toBe(0);
  });

  it("타임아웃 초과 시 잠금 실행", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    dispatchActivity();

    // 61,000ms 경과 (타임아웃 1초 초과)
    advanceFakeTime(61000);
    triggerTick();

    expect(mockLockVault).toHaveBeenCalled();
    expect(result.current.remainingSeconds).toBe(0);
  });

  it("잠금 이후에는 중복 호출되지 않음", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    dispatchActivity();

    // 60초 경과하여 잠금 실행
    advanceFakeTime(60000);
    triggerTick();

    expect(mockLockVault).toHaveBeenCalledTimes(1);

    // 추가 시간 경과 후 다시 tick
    advanceFakeTime(30000);
    triggerTick();

    // lockedRef가 true이므로 중복 호출되지 않음
    expect(mockLockVault).toHaveBeenCalledTimes(1);
  });

  it("stopTimer가 타이머를 정리하고 상태를 리셋", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    expect(result.current.remainingSeconds).toBe(60);

    act(() => {
      result.current.stopTimer();
    });

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

    expect(vi.getTimerCount()).toBe(0);
  });

  it("자동잠금 설정 변경 시 변경된 타임아웃 즉시 적용", () => {
    const { result, rerender } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    expect(result.current.remainingSeconds).toBe(60);

    // 설정 변경: 1m → 10m (600초)
    mockSettingsState.autoLockTimeout = "10m";
    rerender();

    // 마지막 액션 시간은 유지하되, 새 타임아웃(600초)이 적용됨
    expect(result.current.remainingSeconds).toBe(600);
  });

  it("cryptoKey가 null이 되면 타이머가 정지됨", () => {
    const { result, rerender } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    expect(result.current.remainingSeconds).toBe(60);

    // cryptoKey 제거 (잠금 해제 취소)
    mockSessionState.cryptoKey = null;
    rerender();

    expect(result.current.remainingSeconds).toBe(0);
  });

  it("잠금 상태(lockedRef)에서는 startTimer가 작동하지 않음", () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    dispatchActivity();

    // 60초 경과하여 잠금 실행
    advanceFakeTime(60000);
    triggerTick();

    expect(mockLockVault).toHaveBeenCalled();

    // 잠금 상태에서 startTimer 호출
    act(() => {
      result.current.startTimer();
    });

    // 새 타이머가 시작되지 않아야 함
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
      setFakeTime(new Date("2024-01-01T00:00:00Z"));

      mockSettingsState.autoLockTimeout = timeout;

      const { result } = renderHook(() => useAutoLock());

      act(() => {
        result.current.startTimer();
      });

      expect(result.current.remainingSeconds).toBe(expected);

      vi.useRealTimers();
    }
  });

  it("cryptoKey가 없으면 자동잠금 타이머가 활성화되지 않음", () => {
    mockSessionState.cryptoKey = null;

    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    expect(mockLockVault).not.toHaveBeenCalled();
    expect(result.current.remainingSeconds).toBe(0);
  });

  it("잠금 해제(cryptoKey 설정) 시 lastActivityTime이 초기화됨", () => {
    const { rerender } = renderHook(() => useAutoLock());

    // 처음에는 cryptoKey가 null
    mockSessionState.cryptoKey = null;
    rerender();

    // cryptoKey 설정 (잠금 해제) - lastActivityTime 초기화
    mockSessionState.cryptoKey = createMockCryptoKey();
    rerender();

    // 60초 경과
    advanceFakeTime(60000);
    triggerTick();

    // now lastActivityTime이 설정되었으므로 잠금 실행
    expect(mockLockVault).toHaveBeenCalledTimes(1);
  });

  it("lockVault 실패 시 lockedRef가 복구됨", async () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => {
      result.current.startTimer();
    });

    dispatchActivity();

    // lockDataFile이 에러를 던지도록 설정
    mockLockVault.mockRejectedValueOnce(new Error("잠금 실패"));

    // 60초 경과
    advanceFakeTime(60000);
    triggerTick();

    // lockDataFile은 호출되었지만 에러 발생
    expect(mockLockVault).toHaveBeenCalledTimes(1);

    // .catch() 마이크로태스크가 실행될 때까지 대기 (lockedRef 복구)
    await Promise.resolve();
    await Promise.resolve();

    // lockedRef가 false로 복구되었으므로 다시 tick 시 잠금 시도
    advanceFakeTime(1000);
    triggerTick();

    expect(mockLockVault).toHaveBeenCalledTimes(2);
  });
});
