import Button from "@/components/Button";

interface DeleteButtonProps {
  onClick: () => void;
  disabled?: boolean;
  /** 버튼 라벨 (기본: "삭제") */
  label?: string;
  /** 접근성 라벨 (기본: label 또는 "삭제") */
  ariaLabel?: string;
}

/**
 * destructive action 버튼. 빨간색(danger variant)으로 표시.
 */
export function DeleteButton({
  onClick,
  disabled = false,
  label = "삭제",
  ariaLabel,
}: DeleteButtonProps) {
  return (
    <Button
      type="button"
      variant="danger"
      onClick={onClick}
      disabled={disabled}
      label={label}
      aria-label={ariaLabel ?? label}
      className="min-w-[60px]"
    />
  );
}

export default DeleteButton;
