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
        const { activeFileName, encrypted } = await fileTable.getActiveFileInfo();
        const { cryptoKey } = useSessionStore.getState();

        if (!mounted) return;

        if (!activeFileName) {
          onNoFile?.();
          if (!skipRedirect) {
            navigate("/", { replace: true });
          }
          return;
        } else if (encrypted && !cryptoKey) {
          onLocked?.();
          if (!skipRedirect) {
            navigate("/auth", { replace: true });
          }
          return;
        }
      } catch (error) {
        console.error("useFileAuthGuard: getActiveFileInfo failed:", error);
        // Error is handled gracefully - don't redirect
      }
    };

    checkFileAndNavigate();

    return () => {
      mounted = false;
    };
  }, [navigate, onNoFile, onLocked, skipRedirect]);
}