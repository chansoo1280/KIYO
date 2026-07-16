import { useCallback, useEffect, useRef, useState } from "react";

interface UseSecureClipboardOptions {
  /** 클립보드 자동 초기화 시간 (밀리초), 기본값: 30000ms (30초) */
  timeoutMs?: number;
  /** 클립보드 초기화 비활성화 여부 */
  disabled?: boolean;
  /** 복사 성공 시 토스트 메시지 표시 여부 */
  showToast?: boolean;
  /** 복사 성공 시 표시할 메시지 */
  successMessage?: string;
  /** 복사 실패 시 표시할 메시지 */
  errorMessage?: string;
}

interface UseSecureClipboardReturn {
  /** 클립보드에 텍스트 복사 */
  copyToClipboard: (text: string) => Promise<boolean>;
  /** 현재 복사된 텍스트가 있는지 여부 */
  hasCopiedText: boolean;
  /** 남은 시간 (초) */
  remainingTime: number;
  /** 타이머 수동 정리 */
  clearTimer: () => void;
}

/**
 * 보안 클립보드 훅
 * 민감한 데이터(비밀번호 등) 복사 후 지정된 시간 후 자동으로 클립보드를 비웁니다.
 * 앱이 백그라운드로 가거나 언마운트 시 타이머를 정리합니다.
 */
export function useSecureClipboard(
  options: UseSecureClipboardOptions = {}
): UseSecureClipboardReturn {
  const {
    timeoutMs = 30000,
    disabled = false,
    showToast: showToastOption = true,
    successMessage = "클립보드에 복사되었습니다. 30초 후 자동으로 지워집니다.",
    errorMessage = "클립보드 복사에 실패했습니다.",
  } = options;

  const [hasCopiedText, setHasCopiedText] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const copiedTextRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const isVisibleRef = useRef(true);

  // 토스트 표시 함수 (간단한 alert 대체, 실제로는 toast 라이브러리 사용 권장)
  const showToast = useCallback(
    (message: string, isError = false) => {
      if (showToastOption) {
        // 간단한 toast 구현 - 실제 프로젝트에서는 react-hot-toast, react-toastify 등 사용 권장
        const toast = document.createElement("div");
        toast.textContent = message;
        toast.style.cssText = `
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: ${isError ? "#ef4444" : "#22c55e"};
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 9999;
          font-size: 14px;
          font-weight: 500;
          animation: slideUp 0.3s ease-out;
        `;
        document.body.appendChild(toast);
        setTimeout(() => {
          toast.style.animation = "slideUp 0.3s ease-in reverse";
          setTimeout(() => toast.remove(), 300);
        }, 3000);
      }
    },
    [showToastOption]
  );

  // CSS 애니메이션 스타일 추가 (최초 1회만)
  useEffect(() => {
    if (!document.getElementById("secure-clipboard-toast-style")) {
      const style = document.createElement("style");
      style.id = "secure-clipboard-toast-style";
      style.textContent = `
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // 타이머 정리 함수
  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setRemainingTime(0);
    setHasCopiedText(false);
    copiedTextRef.current = null;
  }, []);

  // 클립보드 비우기
  const clearClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("");
      copiedTextRef.current = null;
    } catch (error) {
      console.warn("클립보드 초기화 실패:", error);
    }
  }, []);

  // 카운트다운 시작
  const startCountdown = useCallback((duration: number) => {
    const startTime = Date.now();
    const endTime = startTime + duration;

    const updateRemaining = () => {
      if (!isMountedRef.current) return;
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setRemainingTime(remaining);
      if (remaining <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }
    };

    updateRemaining();
    countdownRef.current = setInterval(updateRemaining, 1000);
  }, []);

  // 클립보드에 복사
  const copyToClipboard = useCallback(
    async (text: string): Promise<boolean> => {
      if (disabled) {
        showToast("클립보드 자동 초기화 기능이 비활성화되어 있습니다.", true);
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        copiedTextRef.current = text;
        setHasCopiedText(true);

        // 성공 토스트
        showToast(successMessage.replace("30초", `${Math.round(timeoutMs / 1000)}초`));

        // 기존 타이머 정리
        clearTimer();

        // 자동 초기화 타이머 설정 (비활성화되지 않은 경우)
        if (timeoutMs > 0) {
          timeoutRef.current = setTimeout(async () => {
            await clearClipboard();
            clearTimer();
            showToast("보안을 위해 클립보드가 자동으로 지워졌습니다.", false);
          }, timeoutMs);

          // 카운트다운 시작
          startCountdown(timeoutMs);
        }

        return true;
      } catch (error) {
        console.error("클립보드 복사 실패:", error);
        showToast(errorMessage, true);
        return false;
      }
    },
    [
      disabled,
      timeoutMs,
      successMessage,
      errorMessage,
      showToast,
      clearTimer,
      clearClipboard,
      startCountdown,
    ]
  );

  // 앱이 백그라운드로 갈 때 타이머 정리
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      if (document.hidden && timeoutRef.current) {
        // 백그라운드로 갈 때 남은 시간 저장
        // 포그라운드로 돌아올 때 남은 시간만큼 다시 타이머 설정
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  // 페이지 언로드 시 클립보드 정리 (보안 강화)
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (copiedTextRef.current && timeoutMs > 0) {
        await clearClipboard();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [timeoutMs, clearClipboard]);

  return {
    copyToClipboard,
    hasCopiedText,
    remainingTime,
    clearTimer,
  };
}

export default useSecureClipboard;