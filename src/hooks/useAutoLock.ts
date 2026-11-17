import { useEffect, useRef, useState, useCallback } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { useSessionStore } from "@/store/sessionStore";
import { lockDataFile } from "@/persistence/vaultPersistence";
import type { AutoLockTimeout } from "@/store/settingsStore";

const TIMEOUT_MAP: Record<AutoLockTimeout, number> = {
  none: 0,
  "1m": 60,
  "10m": 600,
  "30m": 1800,
};

export function useAutoLock() {
  const autoLockTimeout = useSettingsStore((state) => state.autoLockTimeout);
  const cryptoKey = useSessionStore((state) => state.cryptoKey);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityTime = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const startedRef = useRef(false);
  const lockedRef = useRef(false);

  // 절대 시간 비교: 마지막 액션 이후 경과 시간이 타임아웃을 넘으면 잠금
  const tick = useCallback(() => {
    if (lockedRef.current) return;

    const lastActivity = lastActivityTime.current;
    if (lastActivity === null) return;

    const timeoutSeconds = TIMEOUT_MAP[autoLockTimeout];
    const timeoutMs = timeoutSeconds * 1000;
    const elapsedMs = Date.now() - lastActivity;

    const remainingSeconds = Math.max(
      0,
      Math.ceil(timeoutSeconds - elapsedMs / 1000)
    );

    setRemainingSeconds(remainingSeconds);

    if (elapsedMs >= timeoutMs) {
      lockedRef.current = true;
      Promise.resolve(lockDataFile()).catch(() => {
        lockedRef.current = false;
      });
    }
  }, [autoLockTimeout]);

  // 타이머 시작/재시작
  const startTimer = useCallback(() => {
    if (lockedRef.current) return;

    if (startedRef.current && timerRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    const timeout = TIMEOUT_MAP[autoLockTimeout];

    if (timeout === 0 || !cryptoKey) {
      setRemainingSeconds(0);
      isActiveRef.current = false;
      startedRef.current = false;
      return;
    }

    setRemainingSeconds(timeout);
    isActiveRef.current = true;
    startedRef.current = true;

    timerRef.current = setInterval(tick, 1000);
  }, [autoLockTimeout, cryptoKey, tick]);

  // 설정/세션 변경 시 타이머 재시작
  useEffect(() => {
    if (lockedRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startedRef.current = false;
    startTimer();
  }, [autoLockTimeout, cryptoKey, startTimer]);

  // 사용자 활동 감지 시 마지막 액션 시간 갱신
  useEffect(() => {
    if (!isActiveRef.current || autoLockTimeout === "none" || !cryptoKey) return;

    const handleActivity = () => {
      if (lockedRef.current) return;
      lastActivityTime.current = Date.now();
    };

    const events = ["click", "keydown", "touchstart", "scroll"];
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [autoLockTimeout, cryptoKey]);

  // 잠금 해제(복원) 시 마지막 액션 시간 초기화 및 잠금 플래그 리셋
  useEffect(() => {
    if (cryptoKey) {
      lastActivityTime.current = Date.now();
      lockedRef.current = false;
    }
  }, [cryptoKey]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return {
    remainingSeconds,
    startTimer,
    stopTimer: () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      isActiveRef.current = false;
      startedRef.current = false;
      setRemainingSeconds(0);
    },
  };
}
