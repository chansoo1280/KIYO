import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { Account, AccountField, FieldType } from "../models/account";
import { useAccountStore } from "../store/accountStore";

const AccountEditor = ({ account }: { account: Account }) => {
  const navigate = useNavigate();
  const isNew = !account.id;

  const updateAccount = useAccountStore((state) => state.updateAccount);
  const addAccount = useAccountStore((state) => state.addAccount);

  const [title, setTitle] = useState(account.title);
  const [tags, setTags] = useState<string[]>(account.tags);
  const favorite = account.favorite;
  const [fields, setFields] = useState<AccountField[]>(() =>
    [...account.fields].sort((a, b) => a.order - b.order),
  );

  const tagInput = useMemo(() => tags.join(", "), [tags]);

  const handleTagInput = (value: string) => {
    const parsed = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    setTags(parsed);
  };

  const updateField = (id: string, patch: Partial<AccountField>) => {
    setFields((current) =>
      current.map((field) =>
        field.id === id ? { ...field, ...patch } : field,
      ),
    );
  };

  const addField = () => {
    const newField: AccountField = {
      id: `field-${Date.now()}`,
      accountId: account.id,
      label: "",
      type: "text",
      value: "",
      order: fields.length + 1,
    };

    setFields((current) => [...current, newField]);
  };

  const removeField = (id: string) => {
    setFields((current) => current.filter((field) => field.id !== id));
  };

  const handleSave = async () => {
    const cleanedFields = fields
      .filter((field) => {
        const trimmedLabel = field.label.trim();
        return trimmedLabel.length > 0;
      })
      .map((field, index) => ({
        ...field,
        order: index + 1,
      }));

    const updatedAccount: Account = {
      ...account!,
      title,
      tags,
      favorite,
      fields: cleanedFields,
    };

    let savedAccount = updatedAccount;

    if (isNew) {
      // addAccount returns the newly created account with generated ID
      savedAccount = await addAccount(updatedAccount);
    } else {
      await updateAccount(updatedAccount);
    }

    navigate("/account", {
      state: { account: savedAccount },
    });
  };

  return (
    <section className="min-h-svh bg-[linear-gradient(180deg,#f8f7ff_0%,#ffffff_100%)] px-5 py-8">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
        >
          ← 취소
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-full bg-[#aa3bff] px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          저장
        </button>
      </div>

      <article className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700">
          제목
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#aa3bff]"
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-slate-700">
          태그
          <input
            value={tagInput}
            onChange={(event) => handleTagInput(event.target.value)}
            placeholder="예: work, finance"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#aa3bff]"
          />
        </label>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">항목</p>
          <button
            type="button"
            onClick={addField}
            className="rounded-full bg-[#f4efff] px-3 py-2 text-sm font-semibold text-[#7c3aed]"
          >
            + 항목 추가
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {fields.map((field) => (
            <div
              key={field.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <input
                  value={field.label}
                  onChange={(event) =>
                    updateField(field.id, { label: event.target.value })
                  }
                  placeholder="항목 이름"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#aa3bff]"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={field.type}
                    onChange={(event) =>
                      updateField(field.id, {
                        type: event.target.value as FieldType,
                      })
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#aa3bff]"
                  >
                    <option value="text">텍스트</option>
                    <option value="password">비밀번호</option>
                    <option value="email">이메일</option>
                    <option value="number">숫자</option>
                    <option value="textarea">긴 텍스트</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeField(field.id)}
                    className="rounded-full border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
                  >
                    삭제
                  </button>
                </div>
              </div>
              {field.type === "textarea" ? (
                <textarea
                  value={field.value}
                  onChange={(event) =>
                    updateField(field.id, { value: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#aa3bff]"
                  rows={4}
                />
              ) : field.type === "password" ? (
                <input
                  type="password"
                  value={field.value}
                  onChange={(event) =>
                    updateField(field.id, { value: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#aa3bff]"
                />
              ) : field.type === "email" ? (
                <input
                  type="email"
                  value={field.value}
                  onChange={(event) =>
                    updateField(field.id, { value: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#aa3bff]"
                />
              ) : (
                <input
                  type={field.type === "number" ? "number" : "text"}
                  value={field.value}
                  onChange={(event) =>
                    updateField(field.id, { value: event.target.value })
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#aa3bff]"
                />
              )}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
};

const AccountEdit = () => {
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

  if (!account) {
    return (
      <section className="min-h-svh bg-[linear-gradient(180deg,#f8f7ff_0%,#ffffff_100%)] px-5 py-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
        >
          ← 뒤로 가기
        </button>
        <p className="mt-4 text-slate-600">수정할 계정 정보를 찾을 수 없습니다.</p>
      </section>
    );
  }

  return <AccountEditor key={account.id} account={account} />;
};

export default AccountEdit;
