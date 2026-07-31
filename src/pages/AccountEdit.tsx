import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { Account, AccountField, FieldType } from "@/models/account";
import { useAccountStore } from "@/store/accountStore";
import { PasswordGenerator } from "@/components/PasswordGenerator";
import { WebsiteSelector } from "@/components/WebsiteSelector";
import { processWebsiteUrl } from "@/utils/urlUtils";

const AccountEditor = ({ account }: { account: Account }) => {
  const navigate = useNavigate();
  const isNew = !account.id;

  const updateAccount = useAccountStore((state) => state.updateAccount);
  const addAccount = useAccountStore((state) => state.addAccount);

  const [title, setTitle] = useState(account.title);
  const [tags, setTags] = useState<string[]>(account.tags);
  const favorite = account.favorite;
  const [fields, setFields] = useState<AccountField[]>(() =>
    [...account.fields].sort((a, b) => a.order - b.order),
  );
  const [websiteUrl, setWebsiteUrl] = useState(account.websiteUrl ?? "");
  const [domain, setDomain] = useState(account.domain ?? "");

  const [passwordGeneratorOpen, setPasswordGeneratorOpen] = useState<string | null>(null);
  const [websiteSelectorOpen, setWebsiteSelectorOpen] = useState(false);
  const [visiblePasswordFields, setVisiblePasswordFields] = useState<Set<string>>(new Set());

  const handleWebsiteSelect = (preset: import("../models/websitePreset").WebsitePreset) => {
    // Overwrite with selected preset values
    setWebsiteUrl(preset.websiteUrl);
    setDomain(preset.domain);
  };

  const tagInput = useMemo(() => tags.join(", "), [tags]);

  const openPasswordGenerator = (fieldId: string) => {
    setPasswordGeneratorOpen(fieldId);
  };

  const handlePasswordGenerated = (password: string) => {
    if (passwordGeneratorOpen) {
      updateField(passwordGeneratorOpen, { value: password });
      setPasswordGeneratorOpen(null);
    }
  };

  const handleTagInput = (value: string) => {
    const parsed = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    setTags(parsed);
  };

  const togglePasswordVisibility = (fieldId: string) => {
    setVisiblePasswordFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  };

  const updateField = (id: string, patch: Partial<AccountField>) => {
    setFields((current) =>
      current.map((field) =>
        field.id === id ? { ...field, ...patch } : field,
      ),
    );
  };

  const addField = () => {
    const newField: AccountField = {
      id: `field-${Date.now()}`,
      accountId: account.id,
      label: "",
      type: "text",
      value: "",
      order: fields.length + 1,
    };

    setFields((current) => [...current, newField]);
  };

  const removeField = (id: string) => {
    setFields((current) => current.filter((field) => field.id !== id));
  };

  const handleSave = async () => {
    const cleanedFields = fields
      .filter((field) => {
        const trimmedLabel = field.label.trim();
        return trimmedLabel.length > 0;
      })
      .map((field, index) => ({
        ...field,
        order: index + 1,
      }));

    const updatedAccount: Account = {
      ...account!,
      title,
      tags,
      favorite,
      fields: cleanedFields,
      websiteUrl: websiteUrl || undefined,
      domain: domain || undefined,
    };

    let savedAccount = updatedAccount;

    if (isNew) {
      // addAccount returns the newly created account with generated ID
      savedAccount = await addAccount(updatedAccount);
    } else {
      await updateAccount(updatedAccount);
    }

    navigate("/account", {
      state: { account: savedAccount },
    });
  };

  return (
    <section className="min-h-svh bg-gradient-to-b from-[var(--color-accent-bg)] to-[var(--color-bg)] px-5 py-8">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] shadow-sm"
        >
          ← 취소
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          저장
        </button>
      </div>

      <article className="mt-6 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-sm">
        <label className="block text-sm font-semibold text-[var(--color-text)]">
          제목
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-[var(--color-text)]">
          웹사이트 URL (자동완성용)
          <input
            value={websiteUrl}
            onChange={(event) => {
              const { websiteUrl, domain } = processWebsiteUrl(event.target.value);
              setWebsiteUrl(websiteUrl);
              setDomain(domain ?? "");
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
            onClick={() => setWebsiteSelectorOpen(true)}
            className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-4 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors flex items-center justify-between"
          >
            <span>🌐 자주 쓰는 사이트에서 선택</span>
            <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <WebsiteSelector
          open={websiteSelectorOpen}
          onClose={() => setWebsiteSelectorOpen(false)}
          onSelect={handleWebsiteSelect}
          currentTitle={title}
          currentWebsiteUrl={websiteUrl}
        />

        <label className="mt-4 block text-sm font-semibold text-[var(--color-text)]">
          태그
          <input
            value={tagInput}
            onChange={(event) => handleTagInput(event.target.value)}
            placeholder="예: work, finance"
            className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
          />
        </label>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--color-text)]">항목</p>
          <button
            type="button"
            onClick={addField}
            className="rounded-full bg-[var(--color-accent-bg)] px-3 py-2 text-sm font-semibold text-[var(--color-accent)]"
          >
            + 항목 추가
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {fields.map((field) => (
            <div
              key={field.id}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <input
                  value={field.label}
                  onChange={(event) =>
                    updateField(field.id, { label: event.target.value })
                  }
                  placeholder="항목 이름"
                  className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
                />
                <div className="flex items-center gap-2">
                                  <select
                                    value={field.type}
                                    onChange={(event) =>
                                      updateField(field.id, {
                                        type: event.target.value as FieldType,
                                      })
                                    }
                                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
                                  >
                                    <option value="text">텍스트</option>
                                    <option value="password">비밀번호</option>
                                    <option value="email">이메일</option>
                                    <option value="url">URL</option>
                                    <option value="number">숫자</option>
                                    <option value="textarea">긴 텍스트</option>
                                    <option value="totp">TOTP (2FA)</option>
                                    <option value="select">선택</option>
                                    <option value="date">날짜</option>
                                    <option value="secureText">암호화 텍스트</option>
                                    <option value="secureTextarea">암호화 긴 텍스트</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => removeField(field.id)}
                                    className="rounded-full border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 dark:border-red-900 dark:text-red-400"
                                  >
                                    삭제
                                  </button>
                                </div>
              </div>
              {field.type === "textarea" ? (
                <textarea
                  value={field.value}
                  onChange={(event) =>
                    updateField(field.id, { value: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
                  rows={4}
                />
              ) : field.type === "password" ? (
                <div className="mt-2 relative">
                  <input
                    type={visiblePasswordFields.has(field.id) ? "text" : "password"}
                    value={field.value}
                    onChange={(event) =>
                      updateField(field.id, { value: event.target.value })
                    }
                    className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 pr-12 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(field.id)}
                      className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
                      aria-label={visiblePasswordFields.has(field.id) ? "비밀번호 숨기기" : "비밀번호 보이기"}
                    >
                      {visiblePasswordFields.has(field.id) ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => openPasswordGenerator(field.id)}
                      className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
                      aria-label="비밀번호 생성"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : field.type === "email" ? (
                <input
                  type="email"
                  value={field.value}
                  onChange={(event) =>
                    updateField(field.id, { value: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
                />
              ) : (
                <input
                  type={field.type === "number" ? "number" : "text"}
                  value={field.value}
                  onChange={(event) =>
                    updateField(field.id, { value: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
                />
              )}
            </div>
          ))}
        </div>
      </article>

      <PasswordGenerator
        open={passwordGeneratorOpen !== null}
        onClose={() => setPasswordGeneratorOpen(null)}
        onApply={handlePasswordGenerated}
      />
    </section>
  );
};

const AccountEdit = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const accountId = Number(id);
  const storedAccount = useAccountStore((state) =>
    Number.isInteger(accountId)
      ? state.accounts.find((item) => item.id === accountId)
      : undefined,
  );
  const account = storedAccount ?? (location.state?.account as Account | undefined);

  if (!account) {
    return (
      <section className="min-h-svh bg-gradient-to-b from-[var(--color-accent-bg)] to-[var(--color-bg)] px-5 py-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] shadow-sm"
        >
          ← 뒤로 가기
        </button>
        <p className="mt-4 text-[var(--color-text)]">수정할 계정 정보를 찾을 수 없습니다.</p>
      </section>
    );
  }

  return <AccountEditor key={account.id} account={account} />;
};

export default AccountEdit;
