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

  const resetTimer = useCallback(() => {
    const timeout = TIMEOUT_MAP[autoLockTimeout];
    timeoutRef.current = timeout;

    if (timeout === 0 || !cryptoKey) {
      setRemainingSeconds(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      isActiveRef.current = false;
      return;
    }

    setRemainingSeconds(timeout);
    isActiveRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      timeoutRef.current -= 1;
      setRemainingSeconds(timeoutRef.current);

      if (timeoutRef.current <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        isActiveRef.current = false;
        // Trigger auto-lock
        lockDataFile().then(() => {
          navigate("/", { replace: true });
        });
      }
    }, 1000);
  }, [autoLockTimeout, cryptoKey, navigate]);

  // Reset timer when settings change or session becomes active/inactive
  useEffect(() => {
    resetTimer();
  }, [resetTimer]);

  // Activity listeners
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return { remainingSeconds, resetTimer };
}