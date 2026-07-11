import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Account } from "../models/account";
import { useAccountStore } from "../store/accountStore";
import BottomTabs from "../components/BottomTabs";

const AccountList = () => {
  const navigate = useNavigate();
  const accounts = useAccountStore((state) => state.accounts);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAccountClick = (account: Account) => {
    navigate("/account", { state: { account } });
  };

  const handleAddAccount = () => {
    // Create new account without ID - will be auto-generated in addAccount
    const newAccount: Account = {
      id: "",
      title: "",
      tags: [],
      favorite: false,
      fields: [
        {
          id: "",
          accountId: "",
          label: "Email",
          type: "email",
          value: "",
          order: 1,
        },
        {
          id: "",
          accountId: "",
          label: "Password",
          type: "password",
          value: "",
          order: 2,
        },
      ],
    };

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
    <section className="min-h-svh bg-[linear-gradient(180deg,#f8f7ff_0%,#ffffff_100%)] px-5 py-8 pb-28">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#aa3bff]">
              Accounts
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              My accounts
            </h2>
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
                  ? "border-[#aa3bff] bg-[#f4efff] text-[#7c3aed]"
                  : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
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
                  ? "border-[#aa3bff] bg-[#f4efff] text-[#7c3aed]"
                  : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
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
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm text-slate-900 outline-none focus:border-[#aa3bff]"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                    ? "bg-[#aa3bff] text-white"
                    : "bg-[#f4efff] text-[#7c3aed] hover:bg-[#ede4ff]"
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
              className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:shadow-md"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4efff] text-[#7c3aed] font-semibold">
                  {account.title.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {account.title}
                    </p>
                    {account.favorite && (
                      <span className="text-yellow-500 text-sm">★</span>
                    )}
                  </div>
                  <p className="truncate text-sm text-slate-600">
                    {account.fields.find(
                      (field) => field.label.toLowerCase() === "email",
                    )?.value ?? "No email"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(event) => event.stopPropagation()}
                className="rounded-full bg-[#f4efff] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7c3aed] transition hover:bg-[#ede4ff]"
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
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#aa3bff] text-white shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:bg-[#8d2bd4]"
          type="button"
          aria-label="Add account"
          onClick={handleAddAccount}
        >
          +
        </button>
        <button
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl shadow-[0_10px_24px_rgba(0,0,0,0.18)] transition hover:bg-slate-50"
          type="button"
          aria-label="Scroll to top"
          onClick={scrollToTop}
        >
          ⬆
        </button>
      </div>

      <BottomTabs />
    </section>
  );
};

export default AccountList;
