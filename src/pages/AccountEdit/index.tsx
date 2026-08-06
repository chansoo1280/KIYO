import { useAccountEdit } from "./hooks/useAccountEdit";
import { AccountTitleSection } from "./components/AccountTitleSection";
import { AccountFieldsSection } from "./components/AccountFieldsSection";
import { WebsiteSelectorTrigger } from "./components/WebsiteSelectorTrigger";
import { PasswordGenerator } from "@/components/PasswordGenerator";
import { useNavigate } from "react-router-dom";

const AccountEdit = () => {
  const navigate = useNavigate();

  const {
    // State
    fields,
    title,
    setTitle,
    websiteUrl,
    setWebsiteUrl,
    domain,
    passwordGeneratorOpen,
    websiteSelectorOpen,
    setWebsiteSelectorOpen,
    tagInput,
    // Handlers
    handleWebsiteSelect,
    handleTagInput,
    updateField,
    addField,
    removeField,
    openPasswordGenerator,
    handlePasswordGenerated,
    handleSave,
    setPasswordGeneratorOpen,
  } = useAccountEdit();

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
        <AccountTitleSection
          title={title}
          onTitleChange={setTitle}
          websiteUrl={websiteUrl}
          onWebsiteUrlChange={setWebsiteUrl}
          domain={domain}
          onWebsiteSelectorClick={() => setWebsiteSelectorOpen(true)}
          tagInput={tagInput}
          onTagInputChange={handleTagInput}
        />

        <WebsiteSelectorTrigger
          isOpen={websiteSelectorOpen}
          onClose={() => setWebsiteSelectorOpen(false)}
          onSelect={handleWebsiteSelect}
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