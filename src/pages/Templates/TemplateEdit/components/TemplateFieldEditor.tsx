import { useState } from "react";
import type { TemplateField } from "@/models/template";
import type { FieldType } from "@/models/fieldTypes";
import { FIELD_TYPE_OPTIONS, getFieldTypePlaceholder } from "@/models/fieldTypes";
import { Input } from "@/components/inputs";
import { FieldCard } from "@/components/FieldCard";

interface TemplateFieldEditorProps {
  field: TemplateField;
  index: number;
  onChange: (index: number, patch: Partial<TemplateField>) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDelete: (index: number) => void;
  allLabels: string[];
  /** data-testid for e2e selector (Plan-X: E2E Selector Hardening) */
  testId?: string;
}

export const TemplateFieldEditor = ({
  field,
  index,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  allLabels,
  testId,
}: TemplateFieldEditorProps) => {
  const [optionsText, setOptionsText] = useState(field.options?.join("\n") || "");
  const [showOptions, setShowOptions] = useState(field.type === "select");

  const handleTypeChange = (newType: FieldType) => {
    onChange(index, { type: newType });
    setShowOptions(newType === "select");
  };

  const handleOptionsChange = (text: string) => {
    setOptionsText(text);
    const options = text.split("\n").map((s) => s.trim()).filter(Boolean);
    onChange(index, { options });
  };

  const isDuplicateLabel = allLabels.filter((l) => l === field.label).length > 1;

  // 타입별 고정 플레이스홀더 표시용 (수정 불가)
  const fixedPlaceholder = getFieldTypePlaceholder(field.type);

  return (
    <FieldCard density="comfy" testId={testId}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1">
          <button
            type="button"
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className="p-2 rounded-xl bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-border)] disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="위로 이동"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(index)}
            className="p-2 rounded-xl bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-border)]"
            aria-label="아래로 이동"
          >
            ↓
          </button>
          <Input
            value={field.label}
            onChange={(e) => onChange(index, { label: e.target.value })}
            placeholder="항목 이름"
            className="flex-1"
            variant={isDuplicateLabel ? "error" : "default"}
            errorId={isDuplicateLabel ? `field-${index}-label-error` : undefined}
          />
        </div>
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="p-2 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)] hover:bg-[var(--color-error)]/20 dark:bg-[var(--color-error)]/20 dark:hover:bg-[var(--color-error)]/30"
          aria-label="필드 삭제"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            타입
          </label>
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
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            플레이스홀더 (자동 설정)
          </label>
          <Input
            variant="readonly"
            value={fixedPlaceholder}
            readOnly
            title="필드 타입에 따라 자동으로 설정됩니다"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            기본값
          </label>
          <Input
            value={field.defaultValue || ""}
            onChange={(e) => onChange(index, { defaultValue: e.target.value })}
            placeholder="기본값 (선택)"
          />
        </div>

        {showOptions && (
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[var(--color-text-muted)]">
                선택 옵션 (줄별로 입력)
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowOptions(false);
                  onChange(index, { options: [] });
                }}
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                옵션 제거
              </button>
            </div>
            <Input
              as="textarea"
              value={optionsText}
              onChange={(e) => handleOptionsChange(e.target.value)}
              rows={3}
              placeholder="옵션1\n옵션2\n옵션3"
              className="resize-none"
            />
          </div>
        )}

        {isDuplicateLabel && (
          <p className="text-xs text-[var(--color-error)]">중복된 항목 이름입니다</p>
        )}
      </div>
    </FieldCard>
  );
};