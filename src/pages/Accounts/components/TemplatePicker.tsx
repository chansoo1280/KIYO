import { useTemplateStore } from "@/store/templateStore";
import type { Template } from "@/models/template";
import { DEFAULT_TEMPLATE_FIELDS } from "@/models/template";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
}

// 빈 상태일 때 표시할 디폴트 템플릿 (데이터로 저장하지 않음)
const DEFAULT_TEMPLATE: Template = {
  id: "default-template",
  name: "기본 템플릿",
  description: "간단한 입력 항목만 있는 기본 템플릿",
  icon: "📝",
  sortOrder: -1,
  fields: DEFAULT_TEMPLATE_FIELDS,
  createdAt: 0,
  updatedAt: 0,
};

const TemplatePicker = ({ open, onClose }: TemplatePickerProps) => {
  const { templates, loadTemplates } = useTemplateStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  if (!open) return null;

  // 빈 템플릿(name이 없는 것) 제외, 디폴트 템플릿을 항상 첫 번째에 표시
  const validTemplates = templates.filter((t) => t.name?.trim());
  const displayTemplates = [DEFAULT_TEMPLATE, ...validTemplates];

  const handleSelect = (template: Template) => {
      onClose();
      // templateId만 전달하고 AccountEdit에서 템플릿 로드 및 필드 생성 처리
      navigate("/accounts/new", { state: { templateId: template.id } });
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

        <div className="mt-5 grid gap-3 max-h-[50vh] overflow-y-auto">
          {displayTemplates.map((template) => (
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