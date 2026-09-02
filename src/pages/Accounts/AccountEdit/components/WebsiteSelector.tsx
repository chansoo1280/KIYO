import { useState, useCallback, useMemo, useEffect } from "react";
import { FormDialog } from "@/components/dialogs/FormDialog";
import PresetIcon from "@/components/PresetIcon";
import type { WebsitePreset } from "@/models/websitePreset";
import { searchPresets, getPresetsByCategory } from "@/constants/websitePresets";

interface WebsiteSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (preset: WebsitePreset) => void;
  onClear: () => void; // Called when user closes dialog without selecting a preset (or toggles off the current one)
  currentPreset?: WebsitePreset | null; // Currently selected preset (for toggle-off behavior)
  currentTitle?: string;
  currentWebsiteUrl?: string;
}

const WebsiteSelector = ({
  open,
  onClose,
  onSelect,
  onClear,
  currentPreset = null,
  currentTitle = "",
  currentWebsiteUrl = "",
}: WebsiteSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  // Initialize from currentPreset so editing an existing account shows the right selection
  const [selectedPreset, setSelectedPreset] = useState<WebsitePreset | null>(currentPreset);

  // Sync internal state when currentPreset changes (e.g., parent clears selection)
  useEffect(() => {
    setSelectedPreset(currentPreset);
  }, [currentPreset]);

  const presetsByCategory = useMemo(() => getPresetsByCategory(), []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchPresets(searchQuery);
  }, [searchQuery]);

  const recommendation = useMemo(() => {
    if (!currentTitle.trim() || currentWebsiteUrl) {
      return { show: false, preset: null as WebsitePreset | null };
    }

    const results = searchPresets(currentTitle);
    if (results.length > 0) {
      return { show: true, preset: results[0] };
    }
    return { show: false, preset: null as WebsitePreset | null };
  }, [currentTitle, currentWebsiteUrl]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setSelectedPreset(null);
  }, []);

  const handlePresetSelect = useCallback((preset: WebsitePreset) => {
    // Toggle: clicking the already-selected preset deselects it
    setSelectedPreset((current) => (current?.id === preset.id ? null : preset));
  }, []);

  const handleApplyRecommendation = useCallback(
    (onSelect: (preset: WebsitePreset) => void, onClose: () => void) => {
      if (recommendation.preset) {
        onSelect(recommendation.preset);
        onClose();
      }
    },
    [recommendation.preset],
  );

  const handleSearchResultSelect = useCallback(
    (preset: WebsitePreset, onSelect: (preset: WebsitePreset) => void, onClose: () => void) => {
      onSelect(preset);
      onClose();
    },
    [],
  );

  // Close without selecting — propagate the clear intent so the parent can wipe fields
  const handleCloseWithoutSelect = useCallback(() => {
    // If user had a selection in this session (or a pre-existing currentPreset) but didn't confirm,
    // treat close as a clear so the parent doesn't keep stale URL/domain/packageNames.
    if (currentPreset) {
      onClear();
    }
  }, [currentPreset, onClear]);

  const handleConfirm = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedPreset) {
      await onSelect(selectedPreset);
      onClose();
    } else {
      // No selection → clear pre-existing fields
      onClear();
      onClose();
    }
  }, [selectedPreset, onSelect, onClear, onClose]);

  // Category labels
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

  return (
    <FormDialog
      open={open}
      title="사이트 선택"
      description="자주 사용하는 사이트를 선택하면 URL과 도메인이 자동으로 입력됩니다."
      onClose={() => {
        handleCloseWithoutSelect();
        onClose();
      }}
      onSubmit={handleConfirm}
      submitLabel="선택 완료"
      // Always allow submit so the user can press "선택 완료" to clear the selection
      disabled={false}
    >
      <div className="space-y-6 max-h-[60vh] overflow-y-auto">
        {/* Search Input */}
        <div>
          <label className="sr-only">사이트 검색</label>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="사이트 검색 (예: 구글, 네이버, github...)"
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] pl-10 pr-4 py-3 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
              autoFocus
            />
          </div>
        </div>

        {/* Title-based Recommendation */}
        {recommendation.show && recommendation.preset && (
          <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">
              추천 사이트
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              제목 "{currentTitle}"을(를) 기반으로 추천합니다.
            </p>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <PresetIcon preset={recommendation.preset} size={32} className="flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--color-text-h)] truncate">{recommendation.preset.name}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)] truncate">{recommendation.preset.domain}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleApplyRecommendation(onSelect, onClose)}
                  className="flex-shrink-0 rounded-full bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-accent)]/80 transition-colors"
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search Results */}
        {searchQuery.trim() && searchResults.length > 0 && (
          <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">
              검색 결과 ({searchResults.length}개)
            </h3>
            <div className="space-y-2">
              {searchResults.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSearchResultSelect(preset, onSelect, onClose)}
                  className="w-full text-left rounded-2xl border p-3 transition-all border-[var(--color-border)] bg-[var(--color-code-bg)] hover:bg-[var(--color-border)]"
                >
                  <div className="flex items-center gap-3">
                    <PresetIcon preset={preset} size={28} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--color-text-h)] truncate">{preset.name}</p>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)] truncate">{preset.domain}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All Categories (when no search) */}
        {!searchQuery.trim() && (
          <div className="space-y-6">
            {Object.entries(presetsByCategory).map(([category, presets]) => {
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
                <div key={category} className="space-y-3">
                  <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">
                    {categoryLabels[category] || category}
                  </h3>
                  <div className="space-y-2">
                    {filteredPresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handlePresetSelect(preset)}
                        className={`w-full text-left rounded-2xl border p-3 transition-all ${
                          selectedPreset?.id === preset.id
                            ? "border-[var(--color-accent)] bg-[var(--color-accent-bg)]"
                            : "border-[var(--color-border)] bg-[var(--color-code-bg)] hover:bg-[var(--color-border)]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <PresetIcon preset={preset} size={28} className="flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[var(--color-text-h)] truncate">{preset.name}</p>
                            <p className="mt-1 text-sm text-[var(--color-text-muted)] truncate">{preset.domain}</p>
                          </div>
                          {selectedPreset?.id === preset.id && (
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
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {searchQuery.trim() && searchResults.length === 0 && (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <svg
              className="mx-auto mb-2 w-12 h-12 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm">검색 결과가 없습니다.</p>
            <p className="text-xs mt-1">직접 URL을 입력하거나 다른 키워드로 검색해보세요.</p>
          </div>
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
    </FormDialog>
  );
};

export default WebsiteSelector;