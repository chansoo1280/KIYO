import { useNavigate } from "react-router-dom";
import BottomTabs from "@/components/BottomTabs";
import Button from "@/components/Button";
import { useTemplateStore } from "@/store/templateStore";
import { useFileAuthGuard } from "@/hooks/useFileAuthGuard";

const TemplateList = () => {
  const navigate = useNavigate();
  const { templates, isLoading, loadTemplates } = useTemplateStore();

  // 파일/인증 상태 체크 (훅으로 분리). 통과 시점에 self-load.
  // store-side initialized 가드가 RootRedirect 경로와 중복 호출을 흡수.
  useFileAuthGuard({
    onInitialized: () => {
      loadTemplates().catch(() => {
        // loadTemplates 실패 시 Spinner가 계속 보이도록 silent swallow.
      });
    },
  });

  const handleNewTemplate = () => {
    navigate("/templates/new");
  };

  const handleEditTemplate = (id: string) => {
    navigate(`/templates/${id}/edit`);
  };

  if (isLoading) {
    return (
      <main className="min-h-svh bg-[var(--color-bg)] px-5 py-8 pb-28">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <header className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-[var(--color-text-h)]">
              템플릿 관리
            </h1>
          </header>
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)]" />
          </div>
          <BottomTabs />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-[var(--color-bg)] px-5 py-8 pb-28">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-[var(--color-text-h)]">
            템플릿 관리
          </h1>
          <Button variant="primary" onClick={handleNewTemplate} label="+ 템플릿 생성" />
        </header>

        {templates.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-12 text-center">
            <p className="text-[var(--color-text-muted)] mb-4">
              등록된 템플릿이 없습니다.
            </p>
            <Button variant="primary" onClick={handleNewTemplate} label="첫 템플릿 만들기" />
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <div
                key={template.id}
                className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition hover:border-[var(--color-accent)]/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{template.icon}</span>
                    <div>
                      <h3 className="font-semibold text-[var(--color-text-h)]">
                        {template.name}
                      </h3>
                      {template.description && (
                        <p className="text-sm text-[var(--color-text-muted)]">
                          {template.description}
                        </p>
                      )}
                      <p className="text-xs text-[var(--color-text-muted)]">
                        필드 {template.fields.length}개
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditTemplate(template.id)}
                    label="수정"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <BottomTabs />
      </div>
    </main>
  );
};

export default TemplateList;