import type { ReactNode } from "react";

interface SettingsRowProps {
  /**
   * row 좌측 라벨. string 또는 ReactNode.
   *
   * 결정 사항:
   * - Q7 (brainstorm 2026-09-01-component-unification-patterns): `label`을 ReactNode로 받아
   *   AutofillSection의 보조 텍스트 패턴(`<span font-medium>제목</span> + <span text-xs muted>설명`)을
   *   동일 컴포넌트로 처리. 12/14 호출처는 string, 2/14 호출처는 ReactNode.
   * - disabled/오버레이는 children에 위임 (Q8 — Input `variant="disabled"` / Button `disabled` prop).
   */
  label: ReactNode;
  children: ReactNode;
}

/**
 * Plan-G1: Settings 행 wrapper.
 *
 * 기존 14 row가 동일하게 사용하던 className:
 *   flex items-center justify-between gap-3
 *   rounded-2xl border border-[var(--color-border)]
 *   bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]
 * 을 단일 컴포넌트로 흡수.
 *
 * 변경 0 영역:
 * - 토글 자체 (UISection 다크모드, AutofillSection 자동완성 사용)는 `<Button>` 부적합
 *   (Plan-B-3 노트) — Plan-G1은 wrapper만 도입, 토글은 그대로 인라인 children에 위치.
 */
export function SettingsRow({ label, children }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
      <div>{label}</div>
      {children}
    </div>
  );
}

export default SettingsRow;