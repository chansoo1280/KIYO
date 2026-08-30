import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fileTable } from "@/database/fileTable";
import { useSessionStore } from "@/store/sessionStore";

export interface FileAuthStatus {
  activeFileName: string | null;
  encrypted: boolean;
  cryptoKey: CryptoKey | null;
}

export function useFileAuthGuard(options: {
  onNoFile?: () => void;
  onLocked?: () => void;
  skipRedirect?: boolean;
} = {}) {
  const navigate = useNavigate();
  const { onNoFile, onLocked, skipRedirect = false } = options;

  useEffect(() => {
    let mounted = true;

    const checkFileAndNavigate = async () => {
      try {
        const sessionActiveFileName = useSessionStore.getState().activeFileName;
        const { cryptoKey } = useSessionStore.getState();

        if (!mounted) return;

        if (!sessionActiveFileName) {
          onNoFile?.();
          if (!skipRedirect) {
            navigate("/", { replace: true });
          }
          return;
        }
        const { encrypted } = await fileTable.getFileInfo(sessionActiveFileName);
        if (!mounted) return; // unmount 후 결과 도착 시 onLocked/onNavigate 방지
        if (encrypted && !cryptoKey) {
          onLocked?.();
          if (!skipRedirect) {
            navigate("/auth", { replace: true });
          }
          return;
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
  }, [navigate, onNoFile, onLocked, skipRedirect]);
}