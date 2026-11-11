import Button from "@/components/Button";

interface SaveButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** 버튼 라벨 (기본: "저장") */
  label?: string;
  /** 로딩 중 표시 텍스트 (기본: "저장 중...") */
  loadingLabel?: string;
}

/**
 * 저장 액션 버튼. primary variant으로 표시되며 loading 상태 지원.
 */
export function SaveButton({
  onClick,
  disabled = false,
  loading = false,
  label = "저장",
  loadingLabel = "저장 중...",
}: SaveButtonProps) {
  return (
    <Button
      type="button"
      variant="primary"
      onClick={onClick}
      disabled={disabled || loading}
      loading={loading}
      label={loading ? loadingLabel : label}
      className="min-w-[60px]"
    />
  );
}

export default SaveButton;
