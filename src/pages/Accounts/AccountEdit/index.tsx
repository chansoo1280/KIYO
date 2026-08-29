import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import type { Account, AccountField } from "@/models/account";
import { useAccountStore } from "@/store/accountStore";
import { useTemplateStore } from "@/store/templateStore";
import { DEFAULT_TEMPLATE_FIELDS } from "@/models/template";
import { useFileAuthGuard } from "@/hooks/useFileAuthGuard";
import { AccountTitleSection } from "./components/AccountTitleSection";
import { AccountFieldsSection } from "./components/AccountFieldsSection";
import WebsiteSelector from "./components/WebsiteSelector";
import { PasswordGenerator } from "./components/PasswordGenerator";

const AccountEdit = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const accountId = Number(id);
  const updateAccount = useAccountStore((state) => state.updateAccount);
  const addAccount = useAccountStore((state) => state.addAccount);
  const templates = useTemplateStore((state) => state.templates);
  const loadTemplates = useTemplateStore((state) => state.loadTemplates);

  const templateIdFromState = location.state?.templateId as string | undefined;
  const isNew = !accountId;

  // 파일/인증 상태 체크 (훅으로 분리)
  useFileAuthGuard({ skipRedirect: false });

  // Load templates when templateId comes from state
  useEffect(() => {
    if (templateIdFromState) {
      loadTemplates();
    }
  }, [templateIdFromState, loadTemplates]);

  // Get stored account
  const storedAccount = useAccountStore((state) =>
    Number.isInteger(accountId)
      ? state.accounts.find((item) => item.id === accountId)
      : undefined,
  );

  const account = storedAccount;

  // Effective account (for new accounts with templateId)
  const effectiveAccount = useMemo(
    () =>
      account ?? ({
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
      } as Account),
    [account, templateIdFromState],
  );

  // Initialize fields from template or existing account
  const [fields, setFields] = useState<AccountField[]>(() => {
    if (isNew && effectiveAccount.templateId) {
      if (effectiveAccount.templateId === "default-template") {
        return DEFAULT_TEMPLATE_FIELDS.map((field, index) => ({
          id: `default-template-${index + 1}`,
          accountId: 0,
          label: field.label,
          type: field.type,
          value: field.defaultValue || "",
          order: index + 1,
        }));
      }
      const template = templates.find(
        (t) => t.id === String(effectiveAccount.templateId),
      );
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
    return [...(effectiveAccount.fields || [])].sort(
      (a, b) => a.order - b.order,
    );
  });

  const [title, setTitle] = useState(effectiveAccount.title);
  const [tags, setTags] = useState<string[]>(effectiveAccount.tags);
  const [websiteUrl, setWebsiteUrl] = useState(effectiveAccount.websiteUrl ?? "");
  const [domain, setDomain] = useState(effectiveAccount.domain ?? "");
  const [packageName, setPackageName] = useState(
    effectiveAccount.packageNames?.join(", ") ?? effectiveAccount.packageName ?? ""
  );
  const [passwordGeneratorOpen, setPasswordGeneratorOpen] = useState<
    string | null
  >(null);
  const [websiteSelectorOpen, setWebsiteSelectorOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<
    import("@/models/websitePreset").WebsitePreset | null
  >(null);

  const tagInput = useMemo(() => tags.join(", "), [tags]);

  const handleWebsiteSelect = useCallback(
    (preset: import("@/models/websitePreset").WebsitePreset) => {
      // Always overwrite with preset values (URL, domain, packageNames)
      setWebsiteUrl(preset.websiteUrl);
      setDomain(preset.domain);
      if (preset.packageNames && preset.packageNames.length > 0) {
        setPackageName(preset.packageNames.join(", "));
      } else {
        setPackageName("");
      }
      setSelectedPreset(preset);
    },
    [],
  );

  const handleClearSelection = useCallback(() => {
    setWebsiteUrl("");
    setDomain("");
    setPackageName("");
    setSelectedPreset(null);
  }, []);

  const handleTagInput = useCallback((value: string) => {
    const parsed = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    setTags(parsed);
  }, []);

  const updateField = useCallback((id: string, patch: Partial<AccountField>) => {
    setFields((current) =>
      current.map((field) => (field.id === id ? { ...field, ...patch } : field)),
    );
  }, []);

  const addField = useCallback(() => {
    const newField: AccountField = {
      id: `field-${Date.now()}`,
      accountId: effectiveAccount.id,
      label: "",
      type: "text",
      value: "",
      order: fields.length + 1,
    };
    setFields((current) => [...current, newField]);
  }, [effectiveAccount.id, fields.length]);

  const removeField = useCallback((id: string) => {
    setFields((current) => current.filter((field) => field.id !== id));
  }, []);

  const openPasswordGenerator = useCallback((fieldId: string) => {
    setPasswordGeneratorOpen(fieldId);
  }, []);

  const handlePasswordGenerated = useCallback((password: string) => {
    if (passwordGeneratorOpen) {
      updateField(passwordGeneratorOpen, { value: password });
      setPasswordGeneratorOpen(null);
    }
  }, [passwordGeneratorOpen, updateField]);

  const handleSave = useCallback(async () => {
    const cleanedFields = fields
      .filter((field) => {
        const trimmedLabel = field.label.trim();
        return trimmedLabel.length > 0;
      })
      .map((field, index) => ({
        ...field,
        order: index + 1,
      }));

    const packageNames = packageName
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const updatedAccount: Account = {
      ...effectiveAccount,
      title,
      tags,
      favorite: effectiveAccount.favorite,
      fields: cleanedFields,
      websiteUrl: websiteUrl || undefined,
      domain: domain || undefined,
      packageName: packageNames[0] || undefined,
      packageNames: packageNames.length > 0 ? packageNames : undefined,
    };

    let savedAccount = updatedAccount;

    if (isNew) {
      savedAccount = await addAccount(updatedAccount);
    } else {
      await updateAccount(updatedAccount);
    }

    navigate(`/accounts/${savedAccount.id}`);
  }, [
    fields,
    title,
    tags,
    effectiveAccount,
    websiteUrl,
    domain,
    packageName,
    isNew,
    addAccount,
    updateAccount,
    navigate,
  ]);

  return (
    <section className="min-h-svh bg-[var(--color-bg)] px-5 py-8">
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
        <AccountTitleSection
          title={title}
          onTitleChange={setTitle}
          websiteUrl={websiteUrl}
          onWebsiteUrlChange={setWebsiteUrl}
          domain={domain}
          onWebsiteSelectorClick={() => setWebsiteSelectorOpen(true)}
          selectedPreset={selectedPreset}
          onClearSelection={handleClearSelection}
          tagInput={tagInput}
          onTagInputChange={handleTagInput}
          packageName={packageName}
          onPackageNameChange={setPackageName}
        />

        <WebsiteSelector
          open={websiteSelectorOpen}
          onClose={() => setWebsiteSelectorOpen(false)}
          onSelect={handleWebsiteSelect}
          onClear={handleClearSelection}
          currentPreset={selectedPreset}
          currentTitle={title}
          currentWebsiteUrl={websiteUrl}
        />

        <AccountFieldsSection
          fields={fields}
          onUpdateField={updateField}
          onAddField={addField}
          onRemoveField={removeField}
          onOpenPasswordGenerator={openPasswordGenerator}
        />
      </article>

      <PasswordGenerator
        open={passwordGeneratorOpen !== null}
        onClose={() => setPasswordGeneratorOpen(null)}
        onApply={handlePasswordGenerated}
      />
    </section>
  );
};

export default AccountEdit;