import { PasswordField } from "@/components/PasswordField";
import type { AccountField, FieldType } from "@/models/account";
import { getFieldTypePlaceholder, FIELD_TYPE_OPTIONS } from "@/models/fieldTypes";
import { Input } from "@/components/inputs";

interface FieldEditorProps {
  field: AccountField;
  onUpdate: (id: string, patch: Partial<AccountField>) => void;
  onRemove: (id: string) => void;
  onGeneratePassword?: (fieldId: string) => void;
  /** data-testid for e2e selector (Plan-X: E2E Selector Hardening) */
  testId?: string;
}

export function FieldEditor({
  field,
  onUpdate,
  onRemove,
  onGeneratePassword,
  testId,
}: FieldEditorProps) {
  const handleTypeChange = (newType: FieldType) => {
    onUpdate(field.id, { type: newType, value: "" });
  };

  const renderFieldInput = () => {
    switch (field.type) {
      case "textarea":
        return (
          <Input
            as="textarea"
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            placeholder={getFieldTypePlaceholder(field.type)}
            className="mt-2"
            rows={4}
            data-field-value="true"
          />
        );

      case "password":
        return (
          <PasswordField
            mode="edit"
            value={field.value}
            onChange={(v) => onUpdate(field.id, { value: v })}
            onGenerate={onGeneratePassword ? () => onGeneratePassword(field.id) : undefined}
          />
        );

      case "email":
        return (
          <Input
            type="email"
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            placeholder={getFieldTypePlaceholder(field.type)}
            className="mt-2"
            data-field-value="true"
          />
        );

      case "url":
        return (
          <Input
            type="url"
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            placeholder={getFieldTypePlaceholder(field.type)}
            className="mt-2"
            data-field-value="true"
          />
        );

      case "number":
        return (
          <Input
            type="number"
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            placeholder={getFieldTypePlaceholder(field.type)}
            className="mt-2"
            data-field-value="true"
          />
        );

      case "date":
        return (
          <Input
            type="date"
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            className="mt-2"
            data-field-value="true"
          />
        );

      case "select":
        return (
          <Input
            as="select"
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            className="mt-2"
            data-field-value="true"
          >
            {(field.options || []).map((opt, idx) => (
              <option key={idx} value={opt}>
                {opt}
              </option>
            ))}
          </Input>
        );

      case "totp":
        return (
          <Input
            type="text"
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            placeholder={getFieldTypePlaceholder(field.type)}
            className="mt-2"
            maxLength={6}
            inputMode="numeric"
            data-field-value="true"
          />
        );

      default:
        return (
          <Input
            type="text"
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            placeholder={getFieldTypePlaceholder(field.type)}
            className="mt-2"
            data-field-value="true"
          />
        );
    }
  };

  return (
    <div key={field.id} data-testid={testId} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] p-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          value={field.label}
          onChange={(e) => onUpdate(field.id, { label: e.target.value })}
          placeholder="항목 이름"
        />
        <div className="flex items-center gap-2">
          <Input
            as="select"
            value={field.type}
            onChange={(e) => handleTypeChange(e.target.value as FieldType)}
          >
            {FIELD_TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Input>
          <button
            type="button"
            onClick={() => onRemove(field.id)}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--color-error)] hover:bg-[var(--color-error)]/10 dark:border-[var(--border)]/30"
          >
            삭제
          </button>
        </div>
      </div>
      {renderFieldInput()}
    </div>
  );
}