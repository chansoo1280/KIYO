interface DataSectionProps {
  onBackupClick: () => void;
  onRestoreClick: () => void;
  dataMessage?: string;
}

export function DataSection({
  onBackupClick,
  onRestoreClick,
  dataMessage,
}: DataSectionProps) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text)]">
        Data
      </h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <span>백업</span>
          <button
            type="button"
            onClick={onBackupClick}
            className="rounded-full bg-[var(--color-accent-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)]"
          >
            저장
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
          <span>복원</span>
          <button
            type="button"
            onClick={onRestoreClick}
            className="rounded-full bg-[var(--color-accent-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-accent)]"
          >
            불러오기
          </button>
        </div>
      </div>
      {dataMessage && (
        <p className="text-sm font-medium text-[var(--color-accent)]">
          {dataMessage}
        </p>
      )}
    </div>
  );
}