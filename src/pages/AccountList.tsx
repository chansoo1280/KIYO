import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Account, Template } from "../models/account";
import { useAccountStore } from "../store/accountStore";
import BottomTabs from "../components/BottomTabs";
import { useSessionStore } from "../store/sessionStore";
import { useSettingsStore } from "../store/settingsStore";
import { useSecureClipboard } from "../hooks/useSecureClipboard";
import { fixedTemplates } from "../database/testdata";

const AccountList = () => {
  const navigate = useNavigate();
  const accounts = useAccountStore((state) => state.accounts);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const { activeFileName, salt, cryptoKey } = useSessionStore((state) => state);

  const checkFileAndNavigate = async () => {
    if (!activeFileName) {
      navigate("/", {
        replace: true,
      });
      return;
    } else if (!!salt && !cryptoKey) {
      navigate("/auth", {
        replace: true,
      });
      return;
    }
  };
  useEffect(() => {
    checkFileAndNavigate();
  }, []);
  // 설정에서 클립보드 자동 초기화 시간 가져오기
  const clipboardAutoClearTimeout = useSettingsStore(
    (state) => state.clipboardAutoClearTimeout,
  );

  // 보안 클립보드 훅 사용
  const { copyToClipboard } = useSecureClipboard({
    timeoutMs: clipboardAutoClearTimeout,
    successMessage: `비밀번호가 클립보드에 복사되었습니다. ${Math.round(clipboardAutoClearTimeout / 1000)}초 후 자동으로 지워집니다.`,
    errorMessage: "비밀번호 복사에 실패했습니다.",
    disabled: clipboardAutoClearTimeout === 0,
  });

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAccountClick = (account: Account) => {
    navigate(`/account/${account.id}`, { state: { account } });
  };

  const handleSelectTemplate = (template: Template) => {
    const newAccount: Account = {
      id: 0,
      templateId: template.id,
      title: "",
      tags: [],
      favorite: false,
      createdAt: 0,
      updatedAt: 0,
      fields: template.fields.map((field, index) => ({
        ...field,
        id: `template-${template.id}-${index + 1}`,
        accountId: 0,
        value: "",
        order: index + 1,
      })),
    };

    setShowTemplatePicker(false);
    navigate("/account/edit", { state: { account: newAccount } });
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
  const filteredAccounts = (() => {
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
          .find((f) => f.label.toLowerCase() === "email")
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
  })();

  return (
    <section className="min-h-svh bg-gradient-to-b from-[var(--color-accent-bg)] to-[var(--color-bg)] px-5 py-8 pb-28">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
              Accounts
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--color-text-h)]">
              My accounts
            </h2>
            {activeFileName && (
              <p className="mt-1 text-sm text-[var(--color-text)]">
                {activeFileName}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (showSearch) {
                  // Closing search - clear search query
                  setSearchQuery("");
                }
                setShowSearch(!showSearch);
              }}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border text-lg shadow-sm transition ${
                showSearch
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-bg)] text-[var(--color-accent)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-h)] hover:bg-[var(--color-code-bg)]"
              }`}
              aria-label="Search"
            >
              🔍
            </button>
            <button
              type="button"
              onClick={() => {
                setSortOrder((prev) => {
                  if (prev === null) return "asc";
                  if (prev === "asc") return "desc";
                  return null;
                });
              }}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border text-lg shadow-sm transition ${
                sortOrder
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-bg)] text-[var(--color-accent)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-h)] hover:bg-[var(--color-code-bg)]"
              }`}
              aria-label="Sort"
            >
              {sortOrder === "asc" ? "↑" : sortOrder === "desc" ? "↓" : "↕"}
            </button>
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
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text)] hover:text-[var(--color-text-h)]"
                aria-label="Clear search"
              >
                ✕
              </button>
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
                      <span className="text-yellow-500 text-sm">★</span>
                    )}
                  </div>
                  <p className="truncate text-sm text-[var(--color-text)]">
                    {account.fields.find(
                      (field) => field.label.toLowerCase() === "email",
                    )?.value ?? "No email"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  const passwordField = account.fields.find(
                    (field) => field.type === "password",
                  );
                  if (passwordField) {
                    copyToClipboard(passwordField.value);
                  }
                }}
                className="rounded-full bg-[var(--color-accent-bg)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)] transition hover:bg-[var(--color-accent-bg)]/80"
                aria-label="Copy password"
              >
                복사
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="fixed right-5 bottom-28 z-20 flex flex-col gap-3">
        <button
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:bg-[var(--color-accent)]/80"
          type="button"
          aria-label="Add account"
          onClick={() => setShowTemplatePicker(true)}
        >
          +
        </button>
        <button
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-bg)] text-xl shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:bg-[var(--color-code-bg)]"
          type="button"
          aria-label="Scroll to top"
          onClick={scrollToTop}
        >
          ⬆
        </button>
      </div>

      {showTemplatePicker && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-5 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-picker-title"
          onClick={() => setShowTemplatePicker(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-[var(--color-bg)] p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
                  새 계정
                </p>
                <h2
                  id="template-picker-title"
                  className="mt-1 text-xl font-semibold text-[var(--color-text-h)]"
                >
                  템플릿 선택
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text)]">
                  기본 항목을 선택한 뒤 내용을 입력하세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplatePicker(false)}
                className="rounded-full p-2 text-[var(--color-text)] hover:bg-[var(--color-code-bg)]"
                aria-label="템플릿 선택 닫기"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {fixedTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelectTemplate(template)}
                  className="rounded-2xl border border-[var(--color-border)] p-4 text-left transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]"
                >
                  <p className="font-semibold text-[var(--color-text-h)]">
                    {template.name}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text)]">
                    {template.fields.map((field) => field.label).join(", ")}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <BottomTabs />
    </section>
  );
};

export default AccountList;
