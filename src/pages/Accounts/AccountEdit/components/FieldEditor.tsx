import { PasswordFieldEdit } from "./PasswordFieldEdit";
import type { AccountField, FieldType } from "@/models/account";
import { getFieldTypePlaceholder, FIELD_TYPE_OPTIONS } from "@/models/fieldTypes";

interface FieldEditorProps {
  field: AccountField;
  onUpdate: (id: string, patch: Partial<AccountField>) => void;
  onRemove: (id: string) => void;
  onGeneratePassword?: (fieldId: string) => void;
}

export function FieldEditor({
  field,
  onUpdate,
  onRemove,
  onGeneratePassword,
}: FieldEditorProps) {
  const handleTypeChange = (newType: FieldType) => {
    onUpdate(field.id, { type: newType, value: "" });
  };

  const renderFieldInput = () => {
    switch (field.type) {
      case "textarea":
        return (
          <textarea
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            placeholder={getFieldTypePlaceholder(field.type)}
            className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
            rows={4}
          />
        );

      case "password":
        return (
          <PasswordFieldEdit
            value={field.value}
            onChange={(v) => onUpdate(field.id, { value: v })}
            onGenerate={onGeneratePassword ? () => onGeneratePassword(field.id) : undefined}
          />
        );

      case "email":
        return (
          <input
            type="email"
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            placeholder={getFieldTypePlaceholder(field.type)}
            className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
          />
        );

      case "url":
        return (
          <input
            type="url"
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            placeholder={getFieldTypePlaceholder(field.type)}
            className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
          />
        );

      case "number":
        return (
          <input
            type="number"
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            placeholder={getFieldTypePlaceholder(field.type)}
            className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
          />
        );

      case "date":
        return (
          <input
            type="date"
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
          />
        );

      case "select":
        return (
          <select
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
          >
            {(field.options || []).map((opt, idx) => (
              <option key={idx} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "totp":
        return (
          <input
            type="text"
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            placeholder={getFieldTypePlaceholder(field.type)}
            className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
            maxLength={6}
            inputMode="numeric"
          />
        );

      default:
        return (
          <input
            type="text"
            value={field.value}
            onChange={(e) => onUpdate(field.id, { value: e.target.value })}
            placeholder={getFieldTypePlaceholder(field.type)}
            className="mt-2 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
          />
        );
    }
  };

  return (
    <div key={field.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] p-3">
      <div className="flex items-center justify-between gap-3">
        <input
          value={field.label}
          onChange={(e) => onUpdate(field.id, { label: e.target.value })}
          placeholder="항목 이름"
          className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
        />
        <div className="flex items-center gap-2">
          <select
            value={field.type}
            onChange={(e) => handleTypeChange(e.target.value as FieldType)}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
          >
            {FIELD_TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onRemove(field.id)}
            className="rounded-full border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--error)] hover:bg-[var(--error)]/10 dark:border-[var(--border)]/30"
          >
            삭제
          </button>
        </div>
      </div>
      {renderFieldInput()}
    </div>
  );
}