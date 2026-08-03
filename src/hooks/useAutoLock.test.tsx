import { renderHook, act } from '@testing-library/react';
import { useAutoLock } from '@/hooks/useAutoLock';
import { lockDataFile } from '@/database/fileStorage';

import { vi, describe, test, beforeEach, afterEach, expect } from 'vitest';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/database/fileStorage', () => ({
  lockDataFile: vi.fn().mockResolvedValue(undefined),
}));

type AutoLockTimeout = '1m' | '10m' | '30m' | 'none';

interface MockSettingsStore {
  autoLockTimeout: AutoLockTimeout;
  setAutoLockTimeout: ReturnType<typeof vi.fn>;
}

interface MockSessionStore {
  cryptoKey: CryptoKey | null;
  clearSession: ReturnType<typeof vi.fn>;
}

const mockSettingsStore = vi.hoisted(() => ({
  autoLockTimeout: '1m' as AutoLockTimeout,
  setAutoLockTimeout: vi.fn(),
}));

const mockSessionStore = vi.hoisted(() => ({
  cryptoKey: {} as CryptoKey | null,
  clearSession: vi.fn(),
}));

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: (selector: (state: MockSettingsStore) => unknown) => selector(mockSettingsStore),
}));

vi.mock('@/store/sessionStore', () => ({
  useSessionStore: (selector: (state: MockSessionStore) => unknown) => selector(mockSessionStore),
}));

describe('useAutoLock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockSettingsStore.autoLockTimeout = '1m';
    mockSessionStore.cryptoKey = {} as CryptoKey;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('마운트 시 타이머 자동 시작 및 카운트다운', () => {
    mockSettingsStore.autoLockTimeout = '1m';
    const { result } = renderHook(() => useAutoLock());

    expect(result.current.remainingSeconds).toBe(60);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.remainingSeconds).toBe(59);

    act(() => vi.advanceTimersByTime(29_000));
    expect(result.current.remainingSeconds).toBe(30);

    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.remainingSeconds).toBe(0);
    expect(lockDataFile).toHaveBeenCalledTimes(1);
  });

  test('none 설정 시 타이머 비활성화', () => {
    mockSettingsStore.autoLockTimeout = 'none';
    const { result } = renderHook(() => useAutoLock());

    expect(result.current.remainingSeconds).toBe(0);

    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.remainingSeconds).toBe(0);
  });

  test('활동 감지 시 타이머 리셋', () => {
    const { result } = renderHook(() => useAutoLock());

    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.remainingSeconds).toBe(30);

    act(() => {
      document.dispatchEvent(new Event('click'));
    });
    expect(result.current.remainingSeconds).toBe(60);
  });

  test('타임아웃 변경 시 재시작', () => {
    const { result, rerender } = renderHook(
      ({ timeout }) => {
        mockSettingsStore.autoLockTimeout = timeout;
        return useAutoLock();
      },
      { initialProps: { timeout: '1m' as AutoLockTimeout } }
    );

    expect(result.current.remainingSeconds).toBe(60);

    rerender({ timeout: '10m' as AutoLockTimeout });
    expect(result.current.remainingSeconds).toBe(600);
  });

  test('cryptoKey 상실 시 정지', () => {
    const { result, rerender } = renderHook(
      ({ key }) => {
        mockSessionStore.cryptoKey = key;
        return useAutoLock();
      },
      { initialProps: { key: {} as CryptoKey | null } }
    );

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.remainingSeconds).toBe(59);

    mockSessionStore.cryptoKey = null;
    rerender({ key: null });
    expect(result.current.remainingSeconds).toBe(0);
  });

  test('언마운트 시 정리', () => {
    const { unmount } = renderHook(() => useAutoLock());
    unmount();
    act(() => vi.advanceTimersByTime(10_000));
  });
});