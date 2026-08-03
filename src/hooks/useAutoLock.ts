import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "@/store/settingsStore";
import { useSessionStore } from "@/store/sessionStore";
import { lockDataFile } from "@/database/fileStorage";
import type { AutoLockTimeout } from "@/store/settingsStore";

const TIMEOUT_MAP: Record<AutoLockTimeout, number> = {
  none: 0,
  "1m": 60,
  "10m": 600,
  "30m": 1800,
};

export function useAutoLock() {
  const navigate = useNavigate();
  const autoLockTimeout = useSettingsStore((state) => state.autoLockTimeout);
  const cryptoKey = useSessionStore((state) => state.cryptoKey);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<number>(0);
  const isActiveRef = useRef(false);
  const startedRef = useRef(false);
  const lockedRef = useRef(false);

  // interval callback
  const tick = useCallback(() => {
    timeoutRef.current -= 1;
    
    if (timeoutRef.current <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      isActiveRef.current = false;
      startedRef.current = false;
      lockedRef.current = true;
      setRemainingSeconds(0);
      lockDataFile().then(() => {
        navigate("/", { replace: true });
      });
      return;
    }
    
    setRemainingSeconds(timeoutRef.current);
  }, [navigate]);

  // 타이머 시작/재시작
  const startTimer = useCallback(() => {
    if (lockedRef.current) return;
    
    // 이미 실행 중인 타이머가 있으면 중복 방지
    if (startedRef.current && timerRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    const timeout = TIMEOUT_MAP[autoLockTimeout];
    timeoutRef.current = timeout;

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

  // 설정/세션 변경 시 타이머 재시작 (직접 값 감지)
  useEffect(() => {
    // 잠금 상태면 무시
    if (lockedRef.current) return;
    
    // 설정 변경 시 이전 타이머 정리하고 새로 시작
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startedRef.current = false; // 재시작 허용
    startTimer();
  }, [autoLockTimeout, cryptoKey]);

  // 활동 감지 리셋
  useEffect(() => {
    if (!isActiveRef.current || autoLockTimeout === "none" || !cryptoKey) return;

    const handleActivity = () => {
      if (isActiveRef.current && timeoutRef.current > 0) {
        timeoutRef.current = TIMEOUT_MAP[autoLockTimeout];
        setRemainingSeconds(timeoutRef.current);
      }
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

  // 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return { remainingSeconds, startTimer, stopTimer: () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    isActiveRef.current = false;
    startedRef.current = false;
    setRemainingSeconds(0);
  }};
}