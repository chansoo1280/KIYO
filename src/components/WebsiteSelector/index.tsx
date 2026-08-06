import { BaseDialog } from "@/components/BaseDialog";
import { SearchInput } from "./components/SearchInput";
import { RecommendationCard } from "./components/RecommendationCard";
import { CategorySection } from "./components/CategorySection";
import { PresetItem } from "./components/PresetItem";
import { EmptyState } from "./components/EmptyState";
import { useWebsiteSelector } from "./hooks/useWebsiteSelector";

interface WebsiteSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (preset: import("@/models/websitePreset").WebsitePreset) => void;
  currentTitle?: string;
  currentWebsiteUrl?: string;
}

const WebsiteSelector = ({
  open,
  onClose,
  onSelect,
  currentTitle = "",
  currentWebsiteUrl = "",
}: WebsiteSelectorProps) => {
  const {
    searchQuery,
    selectedPreset,
    presetsByCategory,
    searchResults,
    recommendation,
    handleSearchChange,
    handlePresetSelect,
    handleApplyRecommendation,
    handleSelectPreset,
    handleSearchResultSelect,
  } = useWebsiteSelector({ currentTitle, currentWebsiteUrl });

  return (
    <BaseDialog
      open={open}
      title="사이트 선택"
      description="자주 사용하는 사이트를 선택하면 URL과 도메인이 자동으로 입력됩니다."
      onClose={onClose}
      confirmLabel="선택 완료"
      onConfirm={selectedPreset ? async () => handleSelectPreset(selectedPreset, onSelect, onClose) : undefined}
      confirmDisabled={!selectedPreset && !recommendation.preset}
    >
      <div className="space-y-6 max-h-[60vh] overflow-y-auto">
        {/* Search Input */}
        <SearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="사이트 검색 (예: 구글, 네이버, github...)"
          autoFocus
        />

        {/* Title-based Recommendation */}
        {recommendation.show && recommendation.preset && (
          <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              추천 사이트
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              제목 \"{currentTitle}\"을(를) 기반으로 추천합니다.
            </p>
            <RecommendationCard
              preset={recommendation.preset}
              onApply={() => handleApplyRecommendation(onSelect, onClose)}
            />
          </div>
        )}

        {/* Search Results */}
        {searchQuery.trim() && searchResults.length > 0 && (
          <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              검색 결과 ({searchResults.length}개)
            </h3>
            <div className="space-y-2">
              {searchResults.map((preset) => (
                <PresetItem
                  key={preset.id}
                  preset={preset}
                  isSelected={false}
                  onSelect={() => handleSearchResultSelect(preset, onSelect, onClose)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Categories (when no search) */}
        {!searchQuery.trim() && (
          <div className="space-y-6">
            {Object.entries(presetsByCategory).map(([category, presets]) => (
              <CategorySection
                key={category}
                category={category}
                presets={presets}
                searchQuery={searchQuery}
                selectedPreset={selectedPreset}
                onSelectPreset={handlePresetSelect}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {searchQuery.trim() && searchResults.length === 0 && (
          <EmptyState
            message="검색 결과가 없습니다."
            subMessage="직접 URL을 입력하거나 다른 키워드로 검색해보세요."
          />
        )}

        {/* Manual URL hint */}
        {!searchQuery.trim() && (
          <div className="border-t border-[var(--color-border)] pt-4">
            <p className="text-xs text-[var(--color-text-muted)] text-center">
              원하는 사이트가 없으신가요? 아래 URL 입력란에 직접 입력하실 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </BaseDialog>
  );
};

export default WebsiteSelector;