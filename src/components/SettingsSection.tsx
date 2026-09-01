import type { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

/**
 * Plan-G1: Settings 섹션 wrapper.
 *
 * 기존 4개 Settings 섹션(Security/UI/Data/Autofill)이 동일하게 사용하던
 *   <h3 className="mb-3 text-sm font-semibold uppercase tracking-section text-[var(--color-text)]">
 *   ...
 *   <div className="space-y-3">{rows}</div>
 * 패턴을 단일 컴포넌트로 흡수.
 *
 * 결정 사항:
 * - Q6 (brainstorm 2026-09-01-component-unification-patterns): `<h3>` → `<h2>`로
 *   위계 정정. TemplateEdit의 `<h1> + <h2> + <h2>` 패턴과 일관.
 *   Settings/index.tsx가 `<h1>Settings</h1>` 단일 보유이므로 섹션은 `<h2>`.
 * - 헤더 className은 인라인 4곳과 정확히 동일한 토큰 보존.
 */
export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-section text-[var(--color-text)]">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export default SettingsSection;