interface WebsiteSelectorTriggerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (preset: import("@/models/websitePreset").WebsitePreset) => void;
  currentTitle: string;
  currentWebsiteUrl: string;
}

export function WebsiteSelectorTrigger({
  isOpen,
  onClose,
  onSelect,
  currentTitle,
  currentWebsiteUrl,
}: WebsiteSelectorTriggerProps) {
  return (
    <WebsiteSelector
      open={isOpen}
      onClose={onClose}
      onSelect={onSelect}
      currentTitle={currentTitle}
      currentWebsiteUrl={currentWebsiteUrl}
    />
  );
}

import WebsiteSelector from "@/components/WebsiteSelector";