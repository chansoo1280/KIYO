import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTemplateStore } from "@/store/templateStore";
import type { Template, TemplateField } from "@/models/template";
import IconPicker from "./components/IconPicker";
import { TemplateFieldEditor } from "./components/TemplateFieldEditor";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";

const TemplateEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { templates, loadTemplates, createTemplate, updateTemplate, deleteTemplate, getTemplate } =
    useTemplateStore();

  const [form, setForm] = useState<
    Omit<Template, "id" | "createdAt" | "updatedAt">
  >({
    name: "",
    description: "",
    icon: "📋",
    sortOrder: 0,
    fields: [],
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // 템플릿 로드 후 초기화
  useEffect(() => {
    if (!isInitialized) {
      if (isEdit && id) {
        const template = getTemplate(id);
        if (template) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setForm({
            name: template.name,
            description: template.description || "",
            icon: template.icon,
            sortOrder: template.sortOrder,
            fields: template.fields.map((f) => ({ ...f })),
          });
        }
      } else {
        // 새 템플릿 생성 시 sortOrder를 마지막에 위치하도록 설정
        setForm((prev) => ({
          ...prev,
          sortOrder: templates.length,
        }));
      }
      setIsInitialized(true);
    }
  }, [isEdit, id, templates.length, getTemplate, isInitialized]);

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!form.name.trim()) {
      newErrors.push("템플릿 이름을 입력해주세요.");
    }

    if (form.fields.length === 0) {
      newErrors.push("최소 1개 이상의 필드가 필요합니다.");
    }

    // 필드 라벨 중복 체크
    const labels = form.fields.map((f) => f.label.trim()).filter(Boolean);
    const uniqueLabels = new Set(labels);
    if (labels.length !== uniqueLabels.size) {
      newErrors.push("필드 이름이 중복되었습니다.");
    }

    // 빈 라벨 체크
    if (form.fields.some((f) => !f.label.trim())) {
      newErrors.push("모든 필드에 이름을 입력해주세요.");
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      if (isEdit && id) {
        await updateTemplate(id, form);
      } else {
        await createTemplate(form);
      }
      navigate("/templates");
    } catch (error) {
      console.error("템플릿 저장 실패:", error);
      setErrors(["템플릿 저장에 실패했습니다."]);
    }
  };

  const addField = () => {
    setForm((prev) => ({
      ...prev,
      fields: [...prev.fields, { label: "", type: "text", defaultValue: "", options: [] }],
    }));
  };

  const updateField = (index: number, patch: Partial<TemplateField>) => {
    setForm((prev) => {
      const newFields = [...prev.fields];
      newFields[index] = { ...newFields[index], ...patch };
      // 타입이 select가 아니면 options 초기화
      if (patch.type && patch.type !== "select") {
        newFields[index].options = [];
      }
      return { ...prev, fields: newFields };
    });
  };

  const moveFieldUp = (index: number) => {
    if (index === 0) return;
    setForm((prev) => {
      const newFields = [...prev.fields];
      [newFields[index], newFields[index - 1]] = [
        newFields[index - 1],
        newFields[index],
      ];
      return { ...prev, fields: newFields };
    });
  };

  const moveFieldDown = (index: number) => {
    if (index >= form.fields.length - 1) return;
    setForm((prev) => {
      const newFields = [...prev.fields];
      [newFields[index], newFields[index + 1]] = [
        newFields[index + 1],
        newFields[index],
      ];
      return { ...prev, fields: newFields };
    });
  };

  const deleteField = (index: number) => {
    if (form.fields.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index),
    }));
  };

  const handleIconSelect = (icon: string) => {
    setForm((prev) => ({ ...prev, icon }));
  };

  const handleCancel = () => {
    navigate("/templates");
  };

  const handleDelete = async () => {
    if (!isEdit || !id) return;
    await deleteTemplate(id);
    navigate("/templates");
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <main className="min-h-svh bg-gradient-to-b from-accent-bg to-[var(--color-bg)] px-5 py-8 pb-28">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <header className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-semibold text-[var(--color-text-h)]">
              {isEdit ? "템플릿 수정" : "새 템플릿"}
            </h1>
            <div className="flex items-center gap-2">
              {isEdit && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-full border border-red-200 bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/30"
                >
                  삭제
                </button>
              )}
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-border)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent)]/80"
              >
                저장
              </button>
            </div>
          </header>

          {errors.length > 0 && (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
              <ul className="space-y-1 text-sm text-red-600 dark:text-red-400">
                {errors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 기본 정보 섹션 */}
          <section className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
            <h2 className="text-lg font-semibold text-[var(--color-text-h)]">기본 정보</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  템플릿 이름
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 로그인, API 키, 신용카드"
                  className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  설명 (선택)
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="이 템플릿에 대한 설명을 입력하세요."
                  rows={2}
                  className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  아이콘
                </label>
                <IconPicker
                  value={form.icon}
                  onChange={handleIconSelect}
                />
              </div>
            </div>
          </section>

          {/* 필드 정의 섹션 */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--color-text-h)]">필드 정의</h2>
              <button
                type="button"
                onClick={addField}
                className="rounded-xl bg-[var(--color-accent-bg)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
              >
                + 필드 추가
              </button>
            </div>

            <div className="space-y-3">
              {form.fields.map((field, index) => (
                <TemplateFieldEditor
                  key={`${index}-${field.label}`}
                  field={field}
                  index={index}
                  onChange={updateField}
                  onMoveUp={moveFieldUp}
                  onMoveDown={moveFieldDown}
                  onDelete={deleteField}
                  allLabels={form.fields.map((f) => f.label)}
                />
              ))}
            </div>
          </section>
        </div>
      </main>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="템플릿 삭제"
        message={"\"" + form.name + "\" 템플릿을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        confirmLabel="삭제"
        variant="danger"
      />
    </>
  );
};

export default TemplateEdit;