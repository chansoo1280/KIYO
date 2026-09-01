import { useSessionStore } from "@/store/sessionStore";

export function SyncErrorBanner() {
  const lastSyncError = useSessionStore((s) => s.lastSyncError);
  const clearSyncError = useSessionStore((s) => s.clearSyncError);

  if (!lastSyncError) return null;

  return (
    <div
      role="alert"
      data-testid="sync-error-banner"
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 bg-[var(--color-error)] px-4 py-3 text-sm font-medium text-white shadow-md"
    >
      <span className="flex-1">{lastSyncError}</span>
      <button
        type="button"
        onClick={clearSyncError}
        aria-label="에러 배너 닫기"
        data-testid="sync-error-banner-close"
        className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
      >
        ×
      </button>
    </div>
  );
}

export default SyncErrorBanner;
