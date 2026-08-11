import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import {
  KiyoAutofill,
  type AutofillStatus,
  type SyncAccountsResult,
} from "@/plugins/kiyautofill";
import { useAccountStore } from "@/store/accountStore";
import { useSessionStore } from "@/store/sessionStore";

export const AutofillSection: React.FC = () => {
  const [status, setStatus] = useState<AutofillStatus | null>(null);
  const [accountCount, setAccountCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const { accounts } = useAccountStore();
  const {
    lastSyncTime: sessionLastSyncTime,
    setLastSyncTime: setSessionLastSyncTime,
  } = useSessionStore();

  // Use session store value directly instead of syncing to local state
  const lastSyncTime = sessionLastSyncTime;

  const showMessage = useCallback(
    (_message: string) => {
      // Message handled internally via state if needed
      void _message;
      setTimeout(() => {}, 3000);
    },
    [],
  );

  const checkStatus = useCallback(async () => {
    if (Capacitor.getPlatform() !== "android") return;

    setLoading(true);
    setError(null);
    try {
      const [statusResult, countResult] = await Promise.all([
        KiyoAutofill.isAutofillEnabled(),
        KiyoAutofill.getAccountCount(),
      ]);
      setStatus(statusResult);
      setAccountCount(countResult.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "상태 확인 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  const requestEnable = useCallback(async () => {
    if (Capacitor.getPlatform() !== "android") return;

    setLoading(true);
    setError(null);
    try {
      await KiyoAutofill.requestAutofillEnable();
      await checkStatus();
      showMessage("자동완성 설정 화면이 열렸습니다. KIYO 자동완성을 활성화해주세요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "자동완성 활성화 실패");
    } finally {
      setLoading(false);
    }
  }, [checkStatus, showMessage]);

  const syncAccounts = useCallback(async () => {
    if (Capacitor.getPlatform() !== "android") return;

    setSyncing(true);
    setError(null);
    try {
      const accountsJson = JSON.stringify(accounts);
      const result: SyncAccountsResult =
        await KiyoAutofill.syncAccountsFromReact({
          accountsJson,
        });

      if (result.success) {
        const now = Date.now();
        setSessionLastSyncTime(now); // Also save to session store
        showMessage(`자동완성 계정 ${result.syncedCount}개 동기화 완료`);
      } else {
        showMessage(`동기화 완료 (${result.errorCount}개 오류)`);
      }
      await checkStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "동기화 실패");
      showMessage("동기화 실패");
    } finally {
      setSyncing(false);
    }
  }, [
    accounts,
    checkStatus,
    showMessage,
    setSessionLastSyncTime,
  ]);

  const openAutofillSettings = useCallback(async () => {
    if (Capacitor.getPlatform() !== "android") return;
    await KiyoAutofill.requestAutofillEnable();
    await checkStatus();
  }, [checkStatus]);

  // Initial load - intentional side effect on mount to check autofill status
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkStatus();
  }, [checkStatus]);

  if (Capacitor.getPlatform() !== "android") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <span>자동완성 서비스</span>
          <span className="text-xs text-[var(--color-text-muted)]">
            Android에서만 사용 가능
          </span>
        </div>
      </div>
    );
  }

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return "동기화된 적 없음";
    const date = new Date(timestamp);
    return date
      .toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(/\. /g, ". ")
      .replace(/\.$/, "");
  };

  const isEnabled = status?.enabled;
  const isOurService = status?.isOurService;

  return (
    <div className="space-y-3">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">
        Autofill
      </h3>
      {/* Autofill Service Status */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
        <div className="flex flex-col gap-1">
          <span className="font-medium">자동완성 서비스</span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {isOurService
              ? "KIYO 자동완성 활성화됨"
              : isEnabled
                ? "다른 자동완성 서비스 사용 중"
                : "자동완성이 비활성화되어 있습니다."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${isEnabled ? "bg-green-500" : isOurService ? "bg-yellow-500" : "bg-gray-400"}`}
          />
          {isEnabled ? (
            <button
              type="button"
              onClick={openAutofillSettings}
              disabled={loading}
              className="rounded-full bg-[var(--color-accent-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)]"
            >
              설정
            </button>
          ) : (
            <button
              type="button"
              onClick={requestEnable}
              disabled={loading}
              className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-accent)]/80 disabled:opacity-50"
            >
              {loading ? "확인 중..." : "활성화"}
            </button>
          )}
        </div>
      </div>

      {/* Account Count */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
        <div className="flex flex-col gap-1">
          <span className="font-medium">저장된 계정 수</span>
          <span className="text-xs text-[var(--color-text-muted)]">
            KIYO 앱: {accounts.length}개 / 자동완성 DB: {accountCount}개
          </span>
        </div>
        <span className="text-lg font-bold text-[var(--color-accent)]">
          {accountCount}
        </span>
      </div>

      {/* Last Sync Time */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
        <div className="flex flex-col gap-1">
          <span className="font-medium">마지막 동기화</span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {formatTime(lastSyncTime)}
          </span>
        </div>
        <button
          type="button"
          onClick={syncAccounts}
          disabled={syncing || loading}
          className="rounded-full bg-[var(--color-accent-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)] disabled:opacity-50"
        >
          {syncing ? "동기화 중..." : "동기화"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
};

export default AutofillSection;