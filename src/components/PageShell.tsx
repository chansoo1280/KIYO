import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  /**
   * "sm" → max-w-md, "md" → max-w-2xl, "lg" → max-w-3xl, "xl" → max-w-4xl. 명시 권장.
   *
   * 결정 사항:
   * - Q4 (brainstorm 2026-09-01-component-unification-patterns): 페이지별 prop
   *   (의도 보존). max-w-3xl/4xl의 디자인 의도가 다름 — AccountList는 4xl로 카드 가독성 확보,
   *   나머지는 3xl. 강제 통일은 의도 훼손.
   * - "sm"은 Auth처럼 단일 form만 있는 화면에서 폼 폭을 좁게 유지하는 의도 (Plan-G2 cross-check).
   */
  maxWidth?: "sm" | "md" | "lg" | "xl";
  /**
   * BottomTabs가 있는 페이지는 true (pb-28 추가).
   *
   * 결정 사항: pb-28 조건부 처리 누락 시 BottomTabs 가림 — 명시적 prop으로 강제.
   */
  withBottomTabs?: boolean;
}

const MAX_WIDTH_MAP: Record<NonNullable<PageShellProps["maxWidth"]>, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
};

/**
 * Plan-G2: 페이지 셸 wrapper.
 *
 * 기존 13 호출처가 동일하게 사용하던 className을 단일 컴포넌트로 흡수:
 *   <main|section> min-h-svh bg-[var(--color-bg)] px-5 py-8 [pb-28]
 *   <div className="mx-auto flex w-full max-w-{N} flex-col gap-6">...</div>
 *
 * 결정 사항:
 * - Q5: <main> 통일 (AccountList/Detail/Edit의 <section> → <main>)
 * - Q4: max-width 페이지별 prop (디자인 의도 보존)
 * - withBottomTabs: pb-28 명시화 (BottomTabs가 있는 페이지만)
 */
export function PageShell({ children, maxWidth, withBottomTabs }: PageShellProps) {
  const maxWidthClass = maxWidth ? MAX_WIDTH_MAP[maxWidth] : "";
  return (
    <main
      className={`min-h-svh bg-[var(--color-bg)] px-5 py-8${
        withBottomTabs ? " pb-28" : ""
      }`}
    >
      <div
        className={`mx-auto flex w-full flex-col gap-6${
          maxWidthClass ? ` ${maxWidthClass}` : ""
        }`}
      >
        {children}
      </div>
    </main>
  );
}

export default PageShell;