import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Account } from "@/models/account";
import { useAccountStore } from "@/store/accountStore";
import BottomTabs from "@/components/BottomTabs";
import { useSessionStore } from "@/store/sessionStore";
import TemplatePicker from "./components/TemplatePicker";
import { useClipboard } from "@/hooks/useClipboard";
import { useFileAuthGuard } from "@/hooks/useFileAuthGuard";
import { Spinner } from "@/components/feedback/Spinner";
import Button from "@/components/Button";

const AccountList = () => {
  const navigate = useNavigate();
  const accounts = useAccountStore((state) => state.accounts);
  const isLoading = useAccountStore((state) => state.isLoading);
  const initialized = useAccountStore((state) => state.initialized);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const { activeFileName: fileName } = useSessionStore((state) => state);

  // 파일/인증 상태 체크 (훅으로 분리)
  useFileAuthGuard({ skipRedirect: false });

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAccountClick = (account: Account) => {
    navigate(`/accounts/${account.id}`);
  };

  // Get available tags based on filtered accounts (for AND search)
  const availableTags = useMemo(() => {
    // First, filter accounts by selected tags (AND logic)
    const filteredByTags =
      selectedTags.length === 0
        ? accounts
        : accounts.filter((account) =>
            selectedTags.every((tag) => account.tags.includes(tag)),
          );

    // Then, get unique tags from filtered accounts
    const tagSet = new Set<string>();
    filteredByTags.forEach((account) => {
      account.tags.forEach((tag) => tagSet.add(tag));
    });

    // Sort: selected tags first, then unselected tags
    const tags = Array.from(tagSet);
    return tags.sort((a, b) => {
      const aSelected = selectedTags.includes(a);
      const bSelected = selectedTags.includes(b);

      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return a.localeCompare(b);
    });
  }, [accounts, selectedTags]);

  // Toggle tag selection
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  // Filter and sort accounts (AND logic for tags)
  const filteredAccounts = useMemo(() => {
    // Filter by selected tags (AND logic) and search query
    const filtered = accounts.filter((account) => {
      // Tag filter (AND logic)
      const tagMatch =
        selectedTags.length === 0 ||
        selectedTags.every((tag) => account.tags.includes(tag));

      // Search filter (title or email)
      const searchMatch =
        !searchQuery.trim() ||
        account.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.fields
          .find(
            (f) =>
              f.label.toLowerCase() === "email" ||
              f.label.toLowerCase() === "이메일",
          )
          ?.value.toLowerCase()
          .includes(searchQuery.toLowerCase());

      return tagMatch && searchMatch;
    });

    // Sort: favorites first, then by title
    return filtered.sort((a, b) => {
      // First sort by favorite status
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;

      // Then sort by title (based on sortOrder)
      if (sortOrder === "asc") {
        return a.title.localeCompare(b.title);
      } else if (sortOrder === "desc") {
        return b.title.localeCompare(a.title);
      }

      return 0;
    });
  }, [accounts, selectedTags, searchQuery, sortOrder]);

  const { copy } = useClipboard();

  if (!initialized || isLoading) {
    return (
      <section className="min-h-svh bg-[var(--color-bg)] px-5 py-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
                Accounts
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--color-text-h)]">
                My accounts
              </h2>
              {fileName && (
                <p className="mt-1 text-sm text-[var(--color-text)]">
                  {fileName}
                </p>
              )}
            </div>
          </div>
          <div
            className="flex flex-col items-center justify-center gap-3 py-16"
            data-testid="accounts-loading"
          >
            <Spinner size="lg" label="계정을 불러오는 중..." />
            <p className="text-sm text-[var(--color-text-muted)]">
              계정을 불러오는 중...
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-svh bg-[var(--color-bg)] px-5 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
              Accounts
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--color-text-h)]">
              My accounts
            </h2>
            {fileName && (
              <p className="mt-1 text-sm text-[var(--color-text)]">
                {fileName}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant={showSearch ? "secondary" : "ghost"}
              onClick={() => {
                if (showSearch) {
                  setSearchQuery("");
                }
                setShowSearch(!showSearch);
              }}
              className="!h-11 !w-11 !rounded-2xl !p-0 !text-lg"
              label="🔍"
              aria-label="Search"
            />
            <Button
              type="button"
              size="sm"
              variant={sortOrder ? "secondary" : "ghost"}
              onClick={() => {
                setSortOrder((prev) => {
                  if (prev === null) return "asc";
                  if (prev === "asc") return "desc";
                  return null;
                });
              }}
              className="!h-11 !w-11 !rounded-2xl !p-0 !text-lg"
              label={sortOrder === "asc" ? "↑" : sortOrder === "desc" ? "↓" : "↕"}
              aria-label="Sort"
            />
          </div>
        </div>

        {/* Search input */}
        {showSearch && (
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목이나 이메일로 검색..."
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-4 py-3 pr-10 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
              autoFocus
            />
            {searchQuery && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSearchQuery("")}
                className="!absolute !right-3 !top-1/2 !-translate-y-1/2 !text-[var(--color-text)] hover:!text-[var(--color-text-h)]"
                label="✕"
                aria-label="Clear search"
              />
            )}
          </div>
        )}

        {/* Tag filter buttons - only show available tags */}
        {availableTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                  selectedTags.includes(tag)
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-accent-bg)] text-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]/80"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-3">
          {filteredAccounts.map((account) => (
            <article
              key={account.id}
              role="button"
              tabIndex={0}
              onClick={() => handleAccountClick(account)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleAccountClick(account);
                }
              }}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 shadow-sm transition hover:shadow-md"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-accent-bg)] text-[var(--color-accent)] font-semibold">
                  {account.title.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-sm font-semibold text-[var(--color-text-h)]">
                      {account.title}
                    </p>
                    {account.favorite && (
                      <span className="text-[var(--color-warning)] text-sm">★</span>
                    )}
                  </div>
                  <p className="truncate text-sm text-[var(--color-text)]">
                    {account.fields.find(
                      (field) => {
                        const label = field.label.toLowerCase();
                        return label === "email" || 
                               label === "이메일" ||
                               label === "아이디/이메일";
                      }
                    )?.value ?? "No email"}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  const passwordField = account.fields.find(
                    (field) => field.type === "password",
                  );
                  if (passwordField) {
                    copy(passwordField.value);
                  }
                }}
                className="!rounded-full !bg-[var(--color-accent-bg)] !px-3 !py-2 !text-[11px] !uppercase !tracking-[0.08em] !text-[var(--color-accent)] hover:!bg-[var(--color-accent-bg)]/80"
                label="복사"
                aria-label="Copy password"
              />
            </article>
          ))}
        </div>
      </div>

      <div className="fixed right-5 bottom-28 z-20 flex flex-col gap-3">
        <Button
          type="button"
          variant="primary"
          onClick={() => setShowTemplatePicker(true)}
          className="!h-14 !w-14 !rounded-full !bg-[var(--color-accent)] !text-white !shadow-[0_10px_24px_rgba(0,0,0,0.18)] hover:!bg-[var(--color-accent)]/80"
          label="+"
          aria-label="Add account"
        />
        <Button
          type="button"
          variant="ghost"
          onClick={scrollToTop}
          className="!h-14 !w-14 !rounded-full !bg-[var(--color-bg)] !text-xl !shadow-[0_10px_24px_rgba(0,0,0,0.18)] hover:!bg-[var(--color-code-bg)]"
          label="⬆"
          aria-label="Scroll to top"
        />
      </div>

      {showTemplatePicker && (
        <TemplatePicker
          open={showTemplatePicker}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}

      <BottomTabs />
    </section>
  );
};

export default AccountList;