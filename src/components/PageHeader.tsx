import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  /**
   * 우측 actions 슬롯 (0~3 buttons 자유).
   *
   * 결정 사항:
   * - Q2 (brainstorm 2026-09-01-component-unification-patterns): eyebrow 슬롯 없음.
   *   Home의 KIYO 로고+eyebrow 패턴은 예외로 흡수 안 함.
   * - Q3: actions 자유 슬롯 (TemplateEdit 3 buttons, AccountEdit 2 buttons, Templates 1 button,
   *   Settings 0 buttons 모두 흡수).
   */
  actions?: ReactNode;
}

/**
 * Plan-G2: 페이지 헤더 wrapper.
 *
 * 기존 5 호출처가 동일하게 사용하던 className:
 *   <header className="flex items-center justify-between gap-3">
 *     <h1 className="text-3xl font-semibold text-[var(--color-text-h)]">{title}</h1>
 *     {actions}
 *   </header>
 *
 * Home.tsx는 Plan-G2 범위 밖 (eyebrow/h1 인라인 유지). Settings/Templates/TemplateEdit/AccountEdit 4 호출처만 마이그레이션.
 */
export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <h1 className="text-3xl font-semibold text-[var(--color-text-h)]">{title}</h1>
      {actions}
    </header>
  );
}

export default PageHeader;