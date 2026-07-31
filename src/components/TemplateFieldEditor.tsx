import { useState } from "react";
import type { TemplateField } from "../models/template";
import type { FieldType } from "../models/fieldTypes";

interface TemplateFieldEditorProps {
  field: TemplateField;
  index: number;
  onChange: (index: number, patch: Partial<TemplateField>) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDelete: (index: number) => void;
  isEncrypted: boolean;
  allLabels: string[];
}

const FIELD_TYPES: { value: FieldType; label: string; encrypted: boolean }[] = [
  { value: "text", label: "텍스트", encrypted: false },
  { value: "password", label: "비밀번호", encrypted: true },
  { value: "email", label: "이메일", encrypted: false },
  { value: "url", label: "URL", encrypted: false },
  { value: "number", label: "숫자", encrypted: false },
  { value: "textarea", label: "긴 텍스트", encrypted: false },
  { value: "totp", label: "TOTP 시크릿", encrypted: true },
  { value: "select", label: "선택(드롭다운)", encrypted: false },
  { value: "date", label: "날짜", encrypted: false },
  { value: "secureText", label: "암호화 텍스트", encrypted: true },
  { value: "secureTextarea", label: "암호화 긴 텍스트", encrypted: true },
];

export const TemplateFieldEditor = ({
  field,
  index,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  isEncrypted,
  allLabels,
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

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] p-4">
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
          <input
            value={field.label}
            onChange={(e) => onChange(index, { label: e.target.value })}
            placeholder="항목 이름"
            className={`flex-1 rounded-2xl border px-3 py-2 text-sm text-[var(--color-text-h)] bg-[var(--color-bg)] outline-none focus:border-[var(--color-accent)] ${
              isDuplicateLabel ? "border-red-500" : "border-[var(--color-border)]"
            }`}
          />
          <span className="text-xs text-[var(--color-text-muted)]">
            {field.type}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="p-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
          aria-label="필드 삭제"
        >
          ✕
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            타입
          </label>
          <select
            value={field.type}
            onChange={(e) => handleTypeChange(e.target.value as FieldType)}
            className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} {t.encrypted ? "🔒" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            플레이스홀더
          </label>
          <input
            value={field.placeholder || ""}
            onChange={(e) => onChange(index, { placeholder: e.target.value })}
            placeholder="예: https://example.com"
            className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">
            기본값
          </label>
          <input
            value={field.defaultValue || ""}
            onChange={(e) => onChange(index, { defaultValue: e.target.value })}
            placeholder="기본값 (선택)"
            className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
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
            <textarea
              value={optionsText}
              onChange={(e) => handleOptionsChange(e.target.value)}
              rows={3}
              placeholder="옵션1\n옵션2\n옵션3"
              className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)] resize-none"
            />
          </div>
        )}

        {isDuplicateLabel && (
          <p className="text-xs text-red-500">중복된 항목 이름입니다</p>
        )}

        {isEncrypted && (
          <p className="text-xs text-[var(--color-accent)] flex items-center gap-1">
            🔒 이 타입은 저장 시 자동 암호화됩니다
          </p>
        )}
      </div>
    </div>
  );
};