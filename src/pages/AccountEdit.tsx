import { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { Account, AccountField, FieldType } from "@/models/account";
import { useAccountStore } from "@/store/accountStore";
import { useTemplateStore } from "@/store/templateStore";
import { PasswordGenerator } from "@/components/PasswordGenerator";
import { WebsiteSelector } from "@/components/WebsiteSelector";
import { processWebsiteUrl } from "@/utils/urlUtils";
import { PasswordField } from "@/components/PasswordField";
import { useSessionStore } from "@/store/sessionStore";
import { fileTable } from "@/database/fileTable";
import { getFieldTypePlaceholder } from "@/models/fieldTypes";
import { DEFAULT_TEMPLATE_FIELDS } from "@/models/template";

const AccountEditor = ({ account }: { account: Account }) => {
  const navigate = useNavigate();
  const isNew = !account.id;

  const updateAccount = useAccountStore((state) => state.updateAccount);
  const addAccount = useAccountStore((state) => state.addAccount);
  const templates = useTemplateStore((state) => state.templates);

  useEffect(() => {
    const checkFileAndNavigate = async () => {
      const { activeFileName, encrypted } = await fileTable.getActiveFileInfo();
      const { cryptoKey } = useSessionStore.getState();
      if (!activeFileName) {
        navigate("/", { replace: true });
        return;
      } else if (encrypted && !cryptoKey) {
        navigate("/auth", { replace: true });
        return;
      }
    };
    checkFileAndNavigate();
  }, [navigate]);

  // 템플릿에서 필드 초기화 (templateId가 있는 신규 계정인 경우)
  const [fields, setFields] = useState<AccountField[]>(() => {
    if (isNew && account.templateId) {
      // 기본 템플릿("default-template")은 DB에 저장되지 않으므로 하드코딩된 필드 사용
      if (account.templateId === "default-template") {
        return DEFAULT_TEMPLATE_FIELDS.map((field, index) => ({
          id: `default-template-${index + 1}`,
          accountId: 0,
          label: field.label,
          type: field.type,
          value: field.defaultValue || "",
          order: index + 1,
        }));
      }
      const template = templates.find((t) => t.id === String(account.templateId));
      if (template) {
        return template.fields.map((field, index) => ({
          id: `${template.id}-${index + 1}`,
          accountId: 0,
          label: field.label,
          type: field.type,
          value: field.defaultValue || "",
          order: index + 1,
          options: field.options,
        }));
      }
    }
    return [...account.fields].sort((a, b) => a.order - b.order);
  });

  const [title, setTitle] = useState(account.title);
  const [tags, setTags] = useState<string[]>(account.tags);
  const favorite = account.favorite;
  const [websiteUrl, setWebsiteUrl] = useState(account.websiteUrl ?? "");
  const [domain, setDomain] = useState(account.domain ?? "");

  const [passwordGeneratorOpen, setPasswordGeneratorOpen] = useState<string | null>(null);
  const [websiteSelectorOpen, setWebsiteSelectorOpen] = useState(false);

  // Simple clipboard copy without auto-clear
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const handleWebsiteSelect = (preset: import("../models/websitePreset").WebsitePreset) => {
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
      savedAccount = await addAccount(updatedAccount);
    } else {
      await updateAccount(updatedAccount);
    }

    navigate(`/account/${savedAccount.id}`);
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
                  placeholder={getFieldTypePlaceholder(field.type)}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
                  rows={4}
                />
              ) : field.type === "password" ? (
                <PasswordField
                  value={field.value}
                  onChange={(v) => updateField(field.id, { value: v })}
                  onCopy={() => void copyToClipboard(field.value)}
                  onGenerate={() => openPasswordGenerator(field.id)}
                  mode="edit"
                />
              ) : field.type === "email" ? (
                <input
                  type="email"
                  value={field.value}
                  onChange={(event) =>
                    updateField(field.id, { value: event.target.value })
                  }
                  placeholder={getFieldTypePlaceholder(field.type)}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
                />
              ) : field.type === "url" ? (
                <input
                  type="url"
                  value={field.value}
                  onChange={(event) =>
                    updateField(field.id, { value: event.target.value })
                  }
                  placeholder={getFieldTypePlaceholder(field.type)}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
                />
              ) : field.type === "number" ? (
                <input
                  type="number"
                  value={field.value}
                  onChange={(event) =>
                    updateField(field.id, { value: event.target.value })
                  }
                  placeholder={getFieldTypePlaceholder(field.type)}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
                />
              ) : field.type === "date" ? (
                <input
                  type="date"
                  value={field.value}
                  onChange={(event) =>
                    updateField(field.id, { value: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
                />
              ) : field.type === "select" ? (
                <select
                  value={field.value}
                  onChange={(event) =>
                    updateField(field.id, { value: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
                >
                  {(field.options || []).map((opt, idx) => (
                    <option key={idx} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.type === "totp" ? (
                <input
                  type="text"
                  value={field.value}
                  onChange={(event) =>
                    updateField(field.id, { value: event.target.value })
                  }
                  placeholder={getFieldTypePlaceholder(field.type)}
                  className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
                  maxLength={6}
                  inputMode="numeric"
                />
              ) : (
                <input
                  type="text"
                  value={field.value}
                  onChange={(event) =>
                    updateField(field.id, { value: event.target.value })
                  }
                  placeholder={getFieldTypePlaceholder(field.type)}
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
  const account = storedAccount;

  // templateId가 location.state로 넘어온 경우 (TemplatePicker에서 새로 만들기)
  const templateIdFromState = location.state?.templateId as string | undefined;

  // 템플릿 로드 (templateId가 있는 경우)
  const loadTemplates = useTemplateStore((state) => state.loadTemplates);

  useEffect(() => {
    if (templateIdFromState) {
      loadTemplates();
    }
  }, [templateIdFromState, loadTemplates]);

  if (!account && !templateIdFromState) {
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

  // templateId가 있고 account가 없는 경우 (신규 생성), 기본 Account 객체 생성
  const effectiveAccount = account ?? ({
    id: 0,
    templateId: templateIdFromState ?? "",
    title: "",
    description: "",
    tags: [],
    favorite: false,
    createdAt: 0,
    updatedAt: 0,
    fields: [],
    websiteUrl: "",
    domain: "",
    packageName: "",
  } as Account);

  return <AccountEditor key={effectiveAccount.id} account={effectiveAccount} />;
};

export default AccountEdit;