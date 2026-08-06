import { useState, useCallback, useMemo } from "react";
import type { WebsitePreset } from "@/models/websitePreset";
import { searchPresets, getPresetsByCategory } from "@/data/websitePresets";

interface UseWebsiteSelectorOptions {
  currentTitle: string;
  currentWebsiteUrl: string;
}

interface UseWebsiteSelectorReturn {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedPreset: WebsitePreset | null;
  setSelectedPreset: (preset: WebsitePreset | null) => void;
  presetsByCategory: Record<string, WebsitePreset[]>;
  searchResults: WebsitePreset[];
  recommendation: { show: boolean; preset: WebsitePreset | null };
  handleSearchChange: (value: string) => void;
  handlePresetSelect: (preset: WebsitePreset) => void;
  handleApplyRecommendation: (onSelect: (preset: WebsitePreset) => void, onClose: () => void) => void;
  handleSelectPreset: (preset: WebsitePreset, onSelect: (preset: WebsitePreset) => void, onClose: () => void) => void;
  handleSearchResultSelect: (preset: WebsitePreset, onSelect: (preset: WebsitePreset) => void, onClose: () => void) => void;
}

export function useWebsiteSelector({ currentTitle, currentWebsiteUrl }: UseWebsiteSelectorOptions): UseWebsiteSelectorReturn {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<WebsitePreset | null>(null);

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
    setSelectedPreset(preset);
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

  const handleSelectPreset = useCallback(
    (preset: WebsitePreset, onSelect: (preset: WebsitePreset) => void, onClose: () => void) => {
      onSelect(preset);
      onClose();
    },
    [],
  );

  const handleSearchResultSelect = useCallback(
    (preset: WebsitePreset, onSelect: (preset: WebsitePreset) => void, onClose: () => void) => {
      onSelect(preset);
      onClose();
    },
    [],
  );

  return {
    searchQuery,
    setSearchQuery,
    selectedPreset,
    setSelectedPreset,
    presetsByCategory,
    searchResults,
    recommendation,
    handleSearchChange,
    handlePresetSelect,
    handleApplyRecommendation,
    handleSelectPreset,
    handleSearchResultSelect,
  };
}