import { ArrowLeft } from "lucide-react";
import Button from "@/components/Button";

interface BackButtonProps {
  onClick: () => void;
  disabled?: boolean;
  /** 버튼 접근성 라벨 (기본: "뒤로 가기") */
  ariaLabel?: string;
  /** 아이콘 크기 (기본: 16) */
  iconSize?: number;
}

/**
 * 페이지 제목 왼쪽에 표시하는 뒤로 가기 버튼.
 * ArrowLeft 아이콘만 표시하며 aria-label로 접근성 확보.
 */
export function BackButton({
  onClick,
  disabled = false,
  ariaLabel = "뒤로 가기",
  iconSize = 16,
}: BackButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      label={<ArrowLeft size={iconSize} strokeWidth={2.5} />}
      aria-label={ariaLabel}
    />
  );
}

export default BackButton;
