import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { Account, AccountField } from "../models/account";
import { useAccountStore } from "../store/accountStore";

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Ignore clipboard errors in this demo flow.
  }
};

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

  const renderFieldValue = (field: AccountField) => {
    if (field.type === "password") {
      return (
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-slate-900">••••••••</span>
          <button
            type="button"
            onClick={() => void copyToClipboard(field.value)}
            className="rounded-full bg-[#f4efff] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#7c3aed]"
          >
            복사
          </button>
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <p className="whitespace-pre-wrap text-sm font-semibold text-slate-900">
          {field.value}
        </p>
      );
    }

    return (
      <span className="text-sm font-semibold text-slate-900">
        {field.value}
      </span>
    );
  };

  if (!account) {
    return (
      <section className="min-h-svh bg-[linear-gradient(180deg,#f8f7ff_0%,#ffffff_100%)] px-5 py-8">
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
          >
            ← 뒤로 가기
          </button>
        </div>
        <p className="mt-4 text-slate-600">계정 정보를 찾을 수 없습니다.</p>
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
      <section className="min-h-svh bg-[linear-gradient(180deg,#f8f7ff_0%,#ffffff_100%)] px-5 py-8">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
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
              className="rounded-full bg-[#aa3bff] px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-50"
            >
              삭제
            </button>
          </div>
        </div>

        <article className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {account.title}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {account.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#f4efff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#7c3aed]"
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
                  ? "border-[#aa3bff] bg-[#f4efff] text-[#7c3aed]"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {account.favorite ? "★ Favorite" : "☆ Favorite"}
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {sortedFields.map((field) => (
              <div
                key={field.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
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
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3
              id="delete-confirm-title"
              className="text-lg font-semibold text-slate-900 mb-2"
            >
              계정 삭제
            </h3>
            <p className="text-slate-600 mb-6">
              "{account.title}" 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수
              없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="flex-1 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
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
