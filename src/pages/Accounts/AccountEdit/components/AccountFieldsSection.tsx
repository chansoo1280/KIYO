import { FieldEditor } from "./FieldEditor";
import type { AccountField } from "@/models/account";

interface AccountFieldsSectionProps {
  fields: AccountField[];
  onUpdateField: (id: string, patch: Partial<AccountField>) => void;
  onAddField: () => void;
  onRemoveField: (id: string) => void;
  onOpenPasswordGenerator: (fieldId: string) => void;
}

export function AccountFieldsSection({
  fields,
  onUpdateField,
  onAddField,
  onRemoveField,
  onOpenPasswordGenerator,
}: AccountFieldsSectionProps) {
  return (
    <>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--color-text)]">항목</p>
        <button
          type="button"
          onClick={onAddField}
          className="rounded-md bg-[var(--color-accent-bg)] px-3 py-2 text-sm font-semibold text-[var(--color-accent)]"
        >
          + 항목 추가
        </button>
      </div>

      <div className="mt-3 space-y-3" data-testid="account-field-editor-list">
        {fields.map((field) => (
          <FieldEditor
            key={field.id}
            testId="account-field-editor"
            field={field}
            onUpdate={onUpdateField}
            onRemove={onRemoveField}
            onGeneratePassword={onOpenPasswordGenerator}
          />
        ))}
      </div>
    </>
  );
}