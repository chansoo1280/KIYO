interface RecommendationCardProps {
  preset: import("@/models/websitePreset").WebsitePreset;
  onApply: () => void;
}

export function RecommendationCard({ preset, onApply }: RecommendationCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--color-text-h)] truncate">{preset.name}</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)] truncate">{preset.domain}</p>
        </div>
        <button
          type="button"
          onClick={onApply}
          className="flex-shrink-0 rounded-full bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-accent)]/80 transition-colors"
        >
          적용
        </button>
      </div>
    </div>
  );
}