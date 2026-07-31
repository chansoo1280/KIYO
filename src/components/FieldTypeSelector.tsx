import type { FieldType } from "@/models/fieldTypes";
import { FIELD_TYPE_OPTIONS } from "@/models/fieldTypes";

interface FieldTypeSelectorProps {
  value: FieldType;
  onChange: (type: FieldType) => void;
  className?: string;
}

const FieldTypeSelector = ({
  value,
  onChange,
  className = "",
}: FieldTypeSelectorProps) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as FieldType)}
      className={`w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)] ${className}`}
    >
      {FIELD_TYPE_OPTIONS.map((t) => (
        <option key={t.value} value={t.value}>
          {t.label} {t.encrypted ? "🔒" : ""}
        </option>
      ))}
    </select>
  );
};

export default FieldTypeSelector;