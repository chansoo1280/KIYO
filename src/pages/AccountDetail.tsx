import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { Account, AccountField } from "@/models/account";
import { useAccountStore } from "@/store/accountStore";
import { useSecureClipboard } from "@/hooks/useSecureClipboard";

const AccountDetail = () => {
  // 기본 클립보드 자동 초기화 시간 (30초)
  const clipboardAutoClearTimeout = 30000;

  // 보안 클립보드 훅 사용 (기본 30초 후 자동 초기화)
  const { copyToClipboard } = useSecureClipboard({
    timeoutMs: clipboardAutoClearTimeout,
    successMessage: `비밀번호가 클립보드에 복사되었습니다. ${Math.round(clipboardAutoClearTimeout / 1000)}초 후 자동으로 지워집니다.`,
    errorMessage: "비밀번호 복사에 실패했습니다.",
    disabled: false,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const accountId = Number(id);
  const storedAccount = useAccountStore((state) =>
    Number.isInteger(accountId)
      ? state.accounts.find((item) => item.id === accountId)
      : undefined,
  );
  const account = storedAccount ?? (location.state?.account as Account | undefined);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { deleteAccount, updateAccount } = useAccountStore();
  const [visiblePasswordFields, setVisiblePasswordFields] = useState<Set<string>>(new Set());

  const togglePasswordVisibility = (fieldId: string) => {
    setVisiblePasswordFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  };

  const renderFieldValue = (field: AccountField) => {
    if (field.type === "password") {
      const isVisible = visiblePasswordFields.has(field.id);
      return (
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-[var(--color-text-h)] flex-1">
            {isVisible ? field.value : "••••••••"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => togglePasswordVisibility(field.id)}
              className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
              aria-label={isVisible ? "비밀번호 숨기기" : "비밀번호 보이기"}
            >
              {isVisible ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => void copyToClipboard(field.value)}
              className="rounded-full bg-[var(--color-accent-bg)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)]"
            >
              복사
            </button>
          </div>
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <p className="whitespace-pre-wrap text-sm font-semibold text-[var(--color-text-h)]">
          {field.value}
        </p>
      );
    }

    return (
      <span className="text-sm font-semibold text-[var(--color-text-h)]">
        {field.value}
      </span>
    );
  };

  if (!account) {
    return (
      <section className="min-h-svh bg-gradient-to-b from-[var(--color-accent-bg)] to-[var(--color-bg)] px-5 py-8">
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] shadow-sm"
          >
            ← 뒤로 가기
          </button>
        </div>
        <p className="mt-4 text-[var(--color-text)]">계정 정보를 찾을 수 없습니다.</p>
      </section>
    );
  }

  const sortedFields = [...account.fields].sort(
    (a, b) => a.order - b.order,
  );

  const handleDelete = async () => {
    await deleteAccount(account.id);
    navigate("/list");
    setShowDeleteConfirm(false);
  };

  const handleBack = () => {
    navigate("/list", { state: { account } });
  };

  return (
    <>
      <section className="min-h-svh bg-gradient-to-b from-[var(--color-accent-bg)] to-[var(--color-bg)] px-5 py-8">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] shadow-sm"
          >
            ← 뒤로 가기
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                navigate(`/account/edit/${account.id}`, {
                  state: { account },
                })
              }
              className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-full border border-red-200 bg-[var(--color-bg)] px-4 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              삭제
            </button>
          </div>
        </div>

        <article className="mt-6 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--color-text-h)]">
                {account.title}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {account.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[var(--color-accent-bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void updateAccount({ ...account, favorite: !account.favorite })}
              className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                account.favorite
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-bg)] text-[var(--color-accent)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
              }`}
            >
              {account.favorite ? "★ Favorite" : "☆ Favorite"}
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {sortedFields.map((field) => (
              <div
                key={field.id}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-4 py-3"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text)]">
                  {field.label}
                </p>
                <div className="mt-1">{renderFieldValue(field)}</div>
              </div>
            ))}
          </div>
        </article>
      </section>

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div className="bg-[var(--color-bg)] rounded-3xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3
              id="delete-confirm-title"
              className="text-lg font-semibold text-[var(--color-text-h)] mb-2"
            >
              계정 삭제
            </h3>
            <p className="text-[var(--color-text)] mb-6">
              "{account.title}" 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수
              없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] shadow-sm"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="flex-1 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AccountDetail;
