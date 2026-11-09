import type { ReactNode } from "react";

interface ErrorMessageProps {
  /**
   * 단일 에러면 string, 리스트면 string[].
   * - string → <p role="alert" data-testid={testid}>{message}</p>
   * - string[] → <ul role="alert" data-testid={testid}><li>• {msg}</li>...</ul>
   * - undefined/null → null (렌더 안 함)
   */
  items: string | string[] | null | undefined;
  /**
   * 선택적 testid. AccountEdit은 "account-edit-error" 유지 (E2E 안전성).
   * TemplateEdit은 신규 testid 부여 가능 (E2E가 미사용).
   */
  testId?: string;
  className?: string;
}

/**
 * Plan-E: AccountEdit + TemplateEdit 에러 표시 통일 컴포넌트.
 *
 * 통합 결정 (2026-09-01):
 * - AccountEdit은 단일 에러(savemessage) → <p>
 * - TemplateEdit은 리스트(errors[]) → <ul>
 * - 두 패턴을 단일 컴포넌트로 흡수, items 타입(string | string[])로 분기.
 * - 색상 토큰 var(--color-error) 통일 (sed 후).
 */
export const ErrorMessage = ({
  items,
  testId,
  className = "",
}: ErrorMessageProps): ReactNode => {
  if (!items) return null;

  // 빈 배열도 null 반환 (표시 안 함)
  if (Array.isArray(items) && items.length === 0) return null;

  if (typeof items === "string") {
    return (
      <p
        role="alert"
        data-testid={testId}
        className={`mt-4 rounded-md border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 px-3 py-2 text-sm font-medium text-[var(--color-error)] ${className}`}
      >
        {items}
      </p>
    );
  }

  return (
    <div className={`rounded-2xl border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 p-4 dark:border-[var(--color-error)]/40 dark:bg-[var(--color-error)]/20 ${className}`}>
      <ul className="space-y-1 text-sm text-[var(--color-error)] dark:text-[var(--color-error)]" role="alert" data-testid={testId}>
        {items.map((err, i) => (
          <li key={i}>• {err}</li>
        ))}
      </ul>
    </div>
  );
};

export default ErrorMessage;