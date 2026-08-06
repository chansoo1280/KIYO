interface AppInfoDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AppInfoDialog({ open, onClose }: AppInfoDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 transition-opacity"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-info-title"
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl bg-[var(--color-bg)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="app-info-title" className="text-xl font-semibold text-[var(--color-text-h)] mb-4">
          앱 정보
        </h2>
        <div className="space-y-3 text-sm text-[var(--color-text)]">
          <div className="flex justify-between">
            <span className="text-[var(--color-text-muted)]">버전</span>
            <span>0.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-muted)]">개발자</span>
            <span>chansoo1280</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent)]/80"
        >
          닫기
        </button>
      </div>
    </div>
  );
}