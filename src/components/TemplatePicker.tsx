import { useTemplateStore } from "@/store/templateStore";
import type { Template } from "@/models/template";
import type { Account, AccountField } from "@/models/account";
import { useNavigate } from "react-router-dom";

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
}

const TemplatePicker = ({ open, onClose }: TemplatePickerProps) => {
  const { templates } = useTemplateStore();
  const navigate = useNavigate();

  if (!open) return null;

  const handleSelect = (template: Template) => {
      // TemplateField[]를 AccountField[]로 변환
      const accountFields: AccountField[] = template.fields.map((field, index) => ({
        id: `${template.id}-${index + 1}`,
        accountId: 0,
        label: field.label,
        type: field.type,
        value: field.defaultValue || "",
        order: index + 1,
        options: field.options,
      }));

      const newAccount: Account = {
        id: 0,
        templateId: template.id as unknown as number,
        title: "",
        description: "",
        tags: [],
        favorite: false,
        createdAt: 0,
        updatedAt: 0,
        fields: accountFields,
        websiteUrl: "",
        domain: "",
        packageName: "",
      };

      onClose();
      // AccountEdit로 이동하면서 템플릿 데이터 전달
      navigate("/account/edit", { state: { account: newAccount, templateId: template.id } });
    };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-5 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-picker-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-[var(--color-bg)] p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
              새 계정
            </p>
            <h2
              id="template-picker-title"
              className="mt-1 text-xl font-semibold text-[var(--color-text-h)]"
            >
              템플릿 선택
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text)]">
              기본 항목을 선택한 뒤 내용을 입력하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--color-text)] hover:bg-[var(--color-code-bg)]"
            aria-label="템플릿 선택 닫기"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => handleSelect(template)}
              className="rounded-2xl border border-[var(--color-border)] p-4 text-left transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-bg)]"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{template.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-[var(--color-text-h)]">
                    {template.name}
                  </p>
                  {template.description && (
                    <p className="mt-1 text-sm text-[var(--color-text)]">
                      {template.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    필드 {template.fields.length}개
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TemplatePicker;