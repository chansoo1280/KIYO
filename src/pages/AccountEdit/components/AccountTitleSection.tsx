import { processWebsiteUrl } from "@/utils/urlUtils";

interface AccountTitleSectionProps {
  title: string;
  onTitleChange: (title: string) => void;
  websiteUrl: string;
  onWebsiteUrlChange: (url: string) => void;
  domain: string;
  onWebsiteSelectorClick: () => void;
  tagInput: string;
  onTagInputChange: (value: string) => void;
}

export function AccountTitleSection({
  title,
  onTitleChange,
  websiteUrl,
  onWebsiteUrlChange,
  domain,
  onWebsiteSelectorClick,
  tagInput,
  onTagInputChange,
}: AccountTitleSectionProps) {
  return (
    <>
      <label className="block text-sm font-semibold text-[var(--color-text)]">
        제목
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
        />
      </label>

      <label className="mt-4 block text-sm font-semibold text-[var(--color-text)]">
        웹사이트 URL (자동완성용)
        <input
          value={websiteUrl}
          onChange={(e) => {
            const { websiteUrl: parsedUrl } = processWebsiteUrl(e.target.value);
            onWebsiteUrlChange(parsedUrl);
          }}
          placeholder="https://www.example.com/login"
          className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
        />
        {domain && (
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            자동완성 도메인: <code className="text-[var(--color-accent)]">{domain}</code>
          </p>
        )}
      </label>

      {/* Website Selector Button */}
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
      </div>

      <label className="mt-4 block text-sm font-semibold text-[var(--color-text)]">
        태그
        <input
          value={tagInput}
          onChange={(e) => onTagInputChange(e.target.value)}
          placeholder="예: work, finance"
          className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
        />
      </label>
    </>
  );
}