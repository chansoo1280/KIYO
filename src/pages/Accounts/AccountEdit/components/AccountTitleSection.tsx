import { processWebsiteUrl } from "@/utils/urlUtils";
import type { WebsitePreset } from "@/models/websitePreset";
import PresetIcon from "@/components/PresetIcon";
import { Input } from "@/components/inputs";

interface AccountTitleSectionProps {
  title: string;
  onTitleChange: (title: string) => void;
  websiteUrl: string;
  onWebsiteUrlChange: (url: string) => void;
  domain: string;
  onWebsiteSelectorClick: () => void;
  selectedPreset: WebsitePreset | null;
  onClearSelection: () => void;
  tagInput: string;
  onTagInputChange: (value: string) => void;
  packageName: string;
  onPackageNameChange: (name: string) => void;
}

export function AccountTitleSection({
  title,
  onTitleChange,
  websiteUrl,
  onWebsiteUrlChange,
  domain,
  onWebsiteSelectorClick,
  selectedPreset,
  onClearSelection,
  tagInput,
  onTagInputChange,
  packageName,
  onPackageNameChange,
}: AccountTitleSectionProps) {
  return (
    <>
      <Input
        label="제목"
        id="account-title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="mt-2"
        data-field-value="true"
      />

      <Input
        label="웹사이트 URL (자동완성용)"
        id="account-website-url"
        value={websiteUrl}
        onChange={(e) => {
          const { websiteUrl: parsedUrl } = processWebsiteUrl(e.target.value);
          onWebsiteUrlChange(parsedUrl);
        }}
        placeholder="https://www.example.com/login"
        className="mt-2"
        data-field-value="true"
      />

      <Input
        label="안드로이드 패키지명 (자동완성용)"
        id="account-package-name"
        value={packageName}
        onChange={(e) => onPackageNameChange(e.target.value)}
        placeholder="com.example.app, com.example.debug"
        className="mt-2"
        helperText="쉼표(,)로 구분하여 여러 개 입력 가능"
        data-field-value="true"
      />

      {/* Website Selector Button — placed below packageName so auto-fill is visible */}
      <div className="mt-3">
        <button
          type="button"
          onClick={onWebsiteSelectorClick}
          className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-4 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors flex items-center justify-between"
        >
          <span>🌐 자주 쓰는 사이트에서 선택</span>
          <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {selectedPreset && (
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 px-3 py-2">
            <PresetIcon preset={selectedPreset} size={20} className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-h)] truncate">
                {selectedPreset.name}
              </p>
              {domain && (
                <p className="text-xs text-[var(--color-text-muted)] truncate">
                  <code className="text-[var(--color-accent)]">{domain}</code>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClearSelection}
              className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text)] transition-colors"
              aria-label="선택 취소"
              title="선택 취소"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <Input
        label="태그"
        id="account-tag"
        value={tagInput}
        onChange={(e) => onTagInputChange(e.target.value)}
        placeholder="예: work, finance"
        className="mt-2"
        data-field-value="true"
      />
    </>
  );
}