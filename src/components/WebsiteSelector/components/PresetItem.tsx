interface PresetItemProps {
  preset: import("@/models/websitePreset").WebsitePreset;
  isSelected: boolean;
  onSelect: () => void;
}

export function PresetItem({ preset, isSelected, onSelect }: PresetItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-2xl border p-3 transition-all ${
        isSelected
          ? "border-[var(--color-accent)] bg-[var(--color-accent-bg)]"
          : "border-[var(--color-border)] bg-[var(--color-code-bg)] hover:bg-[var(--color-border)]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--color-text-h)] truncate">{preset.name}</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)] truncate">{preset.domain}</p>
        </div>
        {isSelected && (
          <svg
            className="flex-shrink-0 w-5 h-5 text-[var(--color-accent)]"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
    </button>
  );
}