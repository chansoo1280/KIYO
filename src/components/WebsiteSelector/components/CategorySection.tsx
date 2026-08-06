import { PresetItem } from "./PresetItem";

interface CategorySectionProps {
  category: string;
  presets: import("@/models/websitePreset").WebsitePreset[];
  searchQuery: string;
  selectedPreset: import("@/models/websitePreset").WebsitePreset | null;
  onSelectPreset: (preset: import("@/models/websitePreset").WebsitePreset) => void;
}

export function CategorySection({
  category,
  presets,
  searchQuery,
  selectedPreset,
  onSelectPreset,
}: CategorySectionProps) {
  const categoryLabels: Record<string, string> = {
    email: "📧 이메일",
    social: "💬 소셜",
    development: "💻 개발",
    entertainment: "🎮 엔터테인먼트",
    gaming: "🎮 게임",
    shopping: "🛒 쇼핑",
    storage: "☁️ 스토리지",
    other: "📦 기타",
  };

  // Filter presets by search query
  const filteredPresets = presets.filter((preset) => {
    if (!searchQuery.trim()) return true;
    const normalizedQuery = searchQuery.toLowerCase().trim().replace(/\s+/g, "");
    const normalizedName = preset.name.toLowerCase().replace(/\s+/g, "");
    if (normalizedName.includes(normalizedQuery)) return true;
    return preset.aliases.some((alias) =>
      alias.toLowerCase().replace(/\s+/g, "").includes(normalizedQuery)
    );
  });

  if (filteredPresets.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
        {categoryLabels[category] || category}
      </h3>
      <div className="space-y-2">
        {filteredPresets.map((preset) => (
          <PresetItem
            key={preset.id}
            preset={preset}
            isSelected={selectedPreset?.id === preset.id}
            onSelect={() => onSelectPreset(preset)}
          />
        ))}
      </div>
    </div>
  );
}