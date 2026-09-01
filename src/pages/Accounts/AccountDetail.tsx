import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { AccountField } from "@/models/account";
import { useAccountStore } from "@/store/accountStore";
import { PasswordField } from "@/components/PasswordField";
import { FieldCard } from "@/components/FieldCard";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { useFileAuthGuard } from "@/hooks/useFileAuthGuard";
import { mapError } from "@/utils/mapError";
import Button from "@/components/Button";
import { PageShell } from "@/components/PageShell";

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
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { deleteAccount, updateAccount } = useAccountStore();

  // 파일/인증 상태 체크 (훅으로 분리)
  useFileAuthGuard({ skipRedirect: false });

  const renderFieldValue = (field: AccountField) => {
    if (field.type === "password") {
      return (
        <PasswordField
          mode="view"
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
      <PageShell>
        <div className="flex justify-start">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(-1)}
            label="← 뒤로 가기"
          />
        </div>
        <p className="mt-4 text-[var(--color-text)]">계정 정보를 찾을 수 없습니다.</p>
      </PageShell>
    );
  }

  const sortedFields = [...account.fields].sort(
    (a, b) => a.order - b.order,
  );

  const handleDelete = async () => {
    try {
      await deleteAccount(account.id);
      setDeleteError(null);
      setShowDeleteConfirm(false);
      navigate("/accounts");
    } catch (err) {
      // 모달을 닫지 않고 에러만 표시 (Plan-A1 결정)
      setDeleteError(mapError(err));
    }
  };

  const handleDeleteDialogClose = () => {
    setDeleteError(null);
    setShowDeleteConfirm(false);
  };

  const handleBack = () => {
    navigate("/accounts");
  };

  return (
    <>
      <PageShell>
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            label="← 뒤로 가기"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => navigate(`/accounts/${account.id}/edit`)}
              label="수정"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              label="삭제"
            />
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
                    className="rounded-md bg-[var(--color-accent-bg)] px-3 py-1 text-xs font-semibold uppercase tracking-chip text-[var(--color-accent)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void updateAccount({ ...account, favorite: !account.favorite })}
              className={
                account.favorite
                  ? "!rounded-full !border !border-[var(--color-accent)] !bg-[var(--color-accent-bg)] !px-3 !py-1 !text-sm !text-[var(--color-accent)]"
                  : "!rounded-full !border !border-[var(--color-border)] !bg-[var(--color-bg)] !px-3 !py-1 !text-sm !text-[var(--color-text-h)]"
              }
              label={account.favorite ? "★ Favorite" : "☆ Favorite"}
            />
          </div>

          <div className="mt-6 space-y-3">
            {sortedFields.map((field) => (
              <FieldCard key={field.id} label={field.label}>
                {renderFieldValue(field)}
              </FieldCard>
            ))}
          </div>
        </article>
      </PageShell>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="계정 삭제"
        message={"\"" + account.title + "\" 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."}
        onClose={handleDeleteDialogClose}
        onConfirm={handleDelete}
        confirmLabel="삭제"
        variant="danger"
        error={deleteError}
      />
    </>
  );
};

export default AccountDetail;