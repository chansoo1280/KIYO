import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { AccountField } from "@/models/account";
import { useAccountStore } from "@/store/accountStore";
import { PasswordFieldView } from "./components/PasswordFieldView";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { useFileAuthGuard } from "@/hooks/useFileAuthGuard";

const AccountDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const accountId = Number(id);
  const storedAccount = useAccountStore((state) =>
    Number.isInteger(accountId)
      ? state.accounts.find((item) => item.id === accountId)
      : undefined,
  );
  const account = storedAccount;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { deleteAccount, updateAccount } = useAccountStore();

  // 파일/인증 상태 체크 (훅으로 분리)
  useFileAuthGuard({ skipRedirect: false });

  const renderFieldValue = (field: AccountField) => {
    if (field.type === "password") {
      return (
        <PasswordFieldView
          value={field.value}
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
      <section className="min-h-svh bg-[var(--color-bg)] px-5 py-8">
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] shadow-sm"
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
    navigate("/accounts");
    setShowDeleteConfirm(false);
  };

  const handleBack = () => {
    navigate("/accounts");
  };

  return (
    <>
      <section className="min-h-svh bg-[var(--color-bg)] px-5 py-8">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] shadow-sm"
          >
            ← 뒤로 가기
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/accounts/${account.id}/edit`)}
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-semibold text-[var(--color-text-h)] shadow-sm"
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
                    className="rounded-md bg-[var(--color-accent-bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-accent)]"
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

      <ConfirmDialog
        open={showDeleteConfirm}
        title="계정 삭제"
        message={"\"" + account.title + "\" 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        confirmLabel="삭제"
        variant="danger"
      />
    </>
  );
};

export default AccountDetail;