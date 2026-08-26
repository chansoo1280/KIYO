import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import {
  KiyoAutofill,
  type AutofillStatus,
  type SyncAccountsResult,
  type ClearAccountsResult,
} from "@/plugins/kiyautofill";
import { useAccountStore } from "@/store/accountStore";
import { useSessionStore } from "@/store/sessionStore";
import { useSettingsStore } from "@/store/settingsStore";

export const AutofillSection: React.FC = () => {
  const [status, setStatus] = useState<AutofillStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const { accounts } = useAccountStore();
  const {
    lastSyncTime: sessionLastSyncTime,
    setLastSyncTime: setSessionLastSyncTime,
    lastAutofillAccountCount,
    setLastAutofillAccountCount,
  } = useSessionStore();
  const { autofillEnabled, setAutofillEnabled } = useSettingsStore();

  // Use session store values directly
  const lastSyncTime = sessionLastSyncTime;
  const accountCount = lastAutofillAccountCount ?? 0;

  const showMessage = useCallback((text: string) => {
    setMessage(text);
  }, []);

  const checkStatus = useCallback(async () => {
    if (Capacitor.getPlatform() !== "android") return;

    setLoading(true);
    setError(null);
    try {
      const statusResult = await KiyoAutofill.isAutofillEnabled();
      setStatus(statusResult);
      
      // Don't fetch account count on initial status check to avoid Keystore auth prompt
      // Account count is stored from last successful sync
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
      await setAutofillEnabled(true);
      await checkStatus();
      showMessage("자동완성 설정 화면이 열렸습니다. KIYO 자동완성을 활성화해주세요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "자동완성 활성화 실패");
    } finally {
      setLoading(false);
    }
  }, [checkStatus, showMessage, setAutofillEnabled]);

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

      // Native side now handles auth automatically and retries sync
      // We only get here when sync is complete (success or error)
      if (result.success) {
        const now = Date.now();
        setSessionLastSyncTime(now); // Also save to session store
        setLastAutofillAccountCount(result.syncedCount); // Store autofill DB account count
        showMessage(`자동완성 계정 ${result.syncedCount}개 동기화 완료`);
      } else if (result.securityDowngrade) {
        // 기기 잠금화면 제거로 보안 키 무효화 - 사용자의 재클릭으로 초기화 후 재동기화됨
        setError(result.message || "기기 잠금 화면 변경이 감지되었습니다.");
        showMessage("동기화 버튼을 한 번 더 눌러 자동완성 데이터를 초기화하고 다시 동기화해주세요.");
      } else if (result.authRequired) {
        // Auth was cancelled or failed after native retry
        setError(result.message || "인증이 취소되거나 실패했습니다.");
        showMessage("인증이 필요합니다. 다시 시도해주세요.");
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
    setLastAutofillAccountCount,
  ]);

  const openAutofillSettings = useCallback(async () => {
    if (Capacitor.getPlatform() !== "android") return;
    await KiyoAutofill.requestAutofillEnable();
    await checkStatus();
  }, [checkStatus]);

  const handleAutofillToggle = useCallback(async () => {
    if (Capacitor.getPlatform() !== "android") return;

    const newValue = !autofillEnabled;
    await setAutofillEnabled(newValue);

    // If disabling autofill, also clear the autofill database
    if (!newValue) {
      setError(null);
      try {
        const result: ClearAccountsResult = await KiyoAutofill.clearAllAccounts();
        if (result.authRequired) {
          setError(result.message || "인증이 필요합니다.");
          await KiyoAutofill.openAppForAuth();
          showMessage("KIYO 앱에서 인증 후 자동완성 데이터가 삭제됩니다.");
        } else if (result.success) {
          showMessage(`자동완성 데이터 ${result.deletedCount}개 삭제 완료`);
          // Also clear last sync time and stored autofill account count
          setSessionLastSyncTime(null);
          setLastAutofillAccountCount(null);
        } else {
          showMessage("자동완성 데이터 삭제 실패");
        }
        await checkStatus();
      } catch (err) {
        setError(err instanceof Error ? err.message : "데이터 삭제 실패");
        showMessage("데이터 삭제 실패");
      }
    } else {
      // Enabling autofill - just update status
      await checkStatus();
    }
  }, [autofillEnabled, setAutofillEnabled, showMessage, checkStatus, setSessionLastSyncTime, setLastAutofillAccountCount]);

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

  // Show autofill toggle only on Android
  const showAutofillToggle = Capacitor.getPlatform() === "android";

  return (
    <div className="space-y-3">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">
        Autofill
      </h3>
      {/* App-level Autofill Toggle */}
      {showAutofillToggle && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <div className="flex flex-col gap-1">
            <span className="font-medium">자동완성 사용</span>
            <span className="text-xs text-[var(--color-text-muted)]">
              앱에서 자동완성 기능 사용 여부
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autofillEnabled}
            aria-label={autofillEnabled ? "자동완성 사용 켜짐" : "자동완성 사용 꺼짐"}
            onClick={handleAutofillToggle}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              autofillEnabled
                ? "bg-[var(--color-accent)]"
                : "bg-[var(--color-border)]"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 transition-transform duration-200 ${
                autofillEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            >
              <span className="block w-5 h-5 rounded-full bg-white shadow" />
            </span>
          </button>
        </div>
      )}
      {/* Autofill settings - only show when autofillEnabled is true */}
      {autofillEnabled && (
        <>
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
                className={`w-2 h-2 rounded-full ${isEnabled ? "bg-[var(--color-success)]" : isOurService ? "bg-[var(--color-warning)]" : "bg-[var(--color-border)]"}`}
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
        </>
      )}

      {error && (
        <div className="rounded-xl border border-[var(--error)]/20 bg-[var(--error)]/10 px-4 py-3 text-sm text-[var(--error)] dark:border-[var(--error)]/40 dark:bg-[var(--error)]/20 dark:text-[var(--error)]">
          {error}
        </div>
      )}

      {message && (
        <p className="text-sm font-medium text-[var(--color-accent)]">{message}</p>
      )}
    </div>
  );
};

export default AutofillSection;