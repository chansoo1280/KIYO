export const NAME_MAX_LENGTH = 50;
// 파일 이름에 사용할 수 없는 문자: / \ : * ? " < > | 및 null 문자
// no-control-regex 규칙을 피하기 위해 제어 문자 체크는 별도 함수로 분리
export const NAME_FORBIDDEN = new RegExp("[/\\\\:*?\"<>|]");

// 제어 문자(null 등) 포함 여부 확인 (정규식 리터럴에 제어 문자를 직접 넣지 않음)
export const hasControlChar = (s: string): boolean =>
  s.split("").some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);

/**
 * Validate the file name input. Returns null for empty input (silent disabled)
 * or a localized error message.
 */
export const validateName = (name: string): string | null => {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (trimmed.length > NAME_MAX_LENGTH) {
    return `파일 이름은 ${NAME_MAX_LENGTH}자 이하로 입력해주세요.`;
  }
  if (NAME_FORBIDDEN.test(trimmed) || hasControlChar(trimmed)) {
    return "파일 이름에 다음 문자를 사용할 수 없습니다: / \\ : * ? \" < > |";
  }
  return null;
};
