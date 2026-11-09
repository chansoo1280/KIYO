import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fileTable } from "@/database/fileTable";
import { useSessionStore } from "@/store/sessionStore";
import { activatePlaintextVault } from "@/database/fileStorage";

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
 */
export function useFileAuthGuard() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const checkFileAndNavigate = async () => {
      try {
        const sessionActiveFileName = useSessionStore.getState().activeFileName;
        const { cryptoKey } = useSessionStore.getState();

        if (!mounted) return;

        if (!sessionActiveFileName) {
          navigate("/", { replace: true });
          return;
        }
        const { encrypted } = await fileTable.getFileInfo(sessionActiveFileName);
        if (!mounted) return; // unmount 후 결과 도착 시 navigate 방지
        if (encrypted) {
          if(!cryptoKey) {
            navigate("/auth", { replace: true });
            return;
          }
        } else {
          await activatePlaintextVault(sessionActiveFileName);
        }
          
      } catch (error) {
        console.error("useFileAuthGuard: getFileInfo failed:", error instanceof Error ? error.message : String(error), error);
        // Error is handled gracefully - don't redirect
      }
    };

    checkFileAndNavigate();

    return () => {
      mounted = false;
    };
  }, [navigate]);
}