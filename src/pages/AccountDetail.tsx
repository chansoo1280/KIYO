import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { Account, AccountField } from "@/models/account";
import { useAccountStore } from "@/store/accountStore";
import { PasswordField } from "@/components/PasswordField";
import { useSessionStore } from "@/store/sessionStore";
import { fileTable } from "@/database/fileTable";

const AccountDetail = () => {
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

  useEffect(() => {
    const checkFileAndNavigate = async () => {
      const { activeFileName, encrypted } = await fileTable.getActiveFileInfo();
      const { cryptoKey } = useSessionStore.getState();
      if (!activeFileName) {
        navigate("/", { replace: true });
        return;
      } else if (encrypted && !cryptoKey) {
        navigate("/auth", { replace: true });
        return;
      }
    };
    checkFileAndNavigate();
  }, [navigate]);

  // Simple clipboard copy without auto-clear
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const renderFieldValue = (field: AccountField) => {
    if (field.type === "password") {
      return (
        <PasswordField
          value={field.value}
          onChange={() => {}}
          onCopy={() => copyToClipboard(field.value)}
          mode="view"
        />
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
