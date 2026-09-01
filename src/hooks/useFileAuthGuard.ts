import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fileTable } from "@/database/fileTable";
import { useSessionStore } from "@/store/sessionStore";

export interface FileAuthStatus {
  activeFileName: string | null;
  encrypted: boolean;
  cryptoKey: CryptoKey | null;
}

/**
 * 파일/인증 상태를 확인하고 다음 분기로 라우팅하는 가드.
 *
 * 분기:
 *   - activeFileName 없음        → / 리다이렉트
 *   - activeFileName 있고 encrypted && cryptoKey 없음 → /auth 리다이렉트
 *   - 통과 (activeFileName 있고 (plaintext || cryptoKey 있음))
 *                                 → onInitialized 콜백 호출
 *
 * onInitialized는 self-load 진입점에서 사용. store-side initialized 가드와
 * 결합하면 RootRedirect 경로(preload)와 self-load 경로가 동일 store를 공유해도
 * 중복 호출이 흡수됨.
 */
export function useFileAuthGuard(options: {
  onInitialized?: () => void;
  skipRedirect?: boolean;
} = {}) {
  const navigate = useNavigate();
  const { onInitialized, skipRedirect = false } = options;

  useEffect(() => {
    let mounted = true;

    const checkFileAndNavigate = async () => {
      try {
        const sessionActiveFileName = useSessionStore.getState().activeFileName;
        const { cryptoKey } = useSessionStore.getState();

        if (!mounted) return;

        if (!sessionActiveFileName) {
          if (!skipRedirect) {
            navigate("/", { replace: true });
          }
          return;
        }
        const { encrypted } = await fileTable.getFileInfo(sessionActiveFileName);
        if (!mounted) return; // unmount 후 결과 도착 시 navigate 방지
        if (encrypted && !cryptoKey) {
          if (!skipRedirect) {
            navigate("/auth", { replace: true });
          }
          return;
        }
        // 통과 — onInitialized 콜백 호출
        onInitialized?.();
      } catch (error) {
        console.error("useFileAuthGuard: getFileInfo failed:", error instanceof Error ? error.message : String(error), error);
        // Error is handled gracefully - don't redirect
      }
    };

    checkFileAndNavigate();

    return () => {
      mounted = false;
    };
  }, [navigate, onInitialized, skipRedirect]);
}