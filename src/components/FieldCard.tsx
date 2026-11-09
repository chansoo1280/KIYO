import type { ReactNode } from "react";

interface FieldCardProps {
  /**
   * 상단 label. 미지정 시 미렌더 (TemplateFieldEditor 패턴 — 본문이 자체 label input 보유).
   * 결정 사항:
   * - Q11 (brainstorm 2026-09-01-component-unification-patterns): 단일 컴포넌트 + label optional.
   *   Plan-G1 SettingsRow의 label=ReactNode 패턴과 동일 (string 흡수 + optional 자유).
   */
  label?: string;
  /**
   * "compact" (default, AccountDetail px-4 py-3) | "comfy" (TemplateFieldEditor p-4).
   *
   * 결정 사항: 두 호출처의 padding 차이(compact vs comfy)를 단일 prop으로 분리.
   */
  density?: "compact" | "comfy";
  /** data-testid for e2e selector (Plan-X: E2E Selector Hardening) */
  testId?: string;
  children: ReactNode;
}

/**
 * Plan-G5: 필드 카드 단일 컴포넌트.
 *
 * 기존 2 호출처 (AccountDetail 필드 카드 + TemplateFieldEditor 컨테이너)의 동일
 * className "rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)]" 흡수.
 *
 * density:
 * - compact (default): AccountDetail — px-4 py-3 (작은 메타 표시)
 * - comfy: TemplateFieldEditor — p-4 (여러 입력/액션 묶음)
 */
export function FieldCard({ label, density = "compact", testId, children }: FieldCardProps) {
  const paddingClass = density === "comfy" ? "p-4" : "px-4 py-3";
  return (
    <div
      data-testid={testId}
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-code-bg)] ${paddingClass}`}
    >
      {label && (
        <>
          <p className="text-xs font-semibold uppercase tracking-label text-[var(--color-text)]">
            {label}
          </p>
          <div className="mt-1">{children}</div>
        </>
      )}
      {!label && children}
    </div>
  );
}

export default FieldCard;