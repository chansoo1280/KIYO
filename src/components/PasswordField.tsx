import { useState } from "react";
import { useClipboard } from "@/hooks/useClipboard";
import { EYE_OPEN_SVG, EYE_CLOSED_SVG, GENERATE_SVG } from "@/components/icons";

interface PasswordFieldProps {
  /**
   * "view" → AccountDetail의 read-only 표시 (값 + 복사)
   * "edit" → AccountEdit의 input + 생성 액션
   *
   * 결정 사항:
   * - Q10 (brainstorm 2026-09-01-component-unification-patterns): 단일 컴포넌트 + mode prop
   *   (Plan-G1 SettingsRow의 label=ReactNode 패턴과 동일 — 두 변종 단일 컴포넌트 흡수)
   */
  mode: "view" | "edit";
  value: string;
  /** mode="edit" 필수. 미지정 시 호출되지 않음 (silent). */
  onChange?: (value: string) => void;
  /** mode="edit" optional. 미지정 시 생성 버튼 미렌더. */
  onGenerate?: () => void;
  /** mode="view" optional. 미지정 시 useClipboard 기본. */
  onCopy?: (value: string) => void;
}

/**
 * Plan-G4: PasswordField 단일 컴포넌트 (View/Edit 통합).
 *
 * 기존 PasswordFieldView + PasswordFieldEdit 2 컴포넌트의 중복 패턴을 흡수:
 * - useState(isVisible) + Eye 토글 로직 공유
 * - EYE_OPEN/CLOSED_SVG import 공유
 * - button className/aria-label 일관
 *
 * 차이점만 mode로 분기:
 * - view: 값 표시 (`••••••••` or 실제 값) + 복사 버튼
 * - edit: `<input>` + 생성 버튼 (onGenerate 있으면)
 */
export function PasswordField({
  mode,
  value,
  onChange,
  onGenerate,
  onCopy,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { copy } = useClipboard();
  const handleCopy = onCopy ?? ((v: string) => copy(v));

  if (mode === "view") {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-[var(--color-text-h)] flex-1">
          {isVisible ? value : "••••••••"}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsVisible(!isVisible)}
            className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
            aria-label={isVisible ? "비밀번호 숨기기" : "비밀번호 보이기"}
          >
            {isVisible ? EYE_CLOSED_SVG : EYE_OPEN_SVG}
          </button>
          <button
            type="button"
            onClick={() => handleCopy(value)}
            className="rounded-md bg-[var(--color-accent-bg)] px-3 py-1.5 text-xs font-semibold uppercase tracking-chip text-[var(--color-accent)]"
          >
            복사
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 relative">
      <input
        type={isVisible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 pr-12 text-sm text-[var(--color-text-h)] outline-none focus:border-[var(--color-accent)]"
        data-field-value="true"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
          aria-label={isVisible ? "비밀번호 숨기기" : "비밀번호 보이기"}
        >
          {isVisible ? EYE_CLOSED_SVG : EYE_OPEN_SVG}
        </button>
        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            className="text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors"
            aria-label="비밀번호 생성"
          >
            {GENERATE_SVG}
          </button>
        )}
      </div>
    </div>
  );
}

export default PasswordField;