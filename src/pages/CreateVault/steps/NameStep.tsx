import Button from "@/components/Button";
import { Input } from "@/components/inputs";

interface NameStepProps {
  fileName: string;
  defaultValue: string;
  onFileNameChange: (value: string) => void;
  onNext: () => void;
}

export const NAME_MAX_LENGTH = 50;
const NAME_FORBIDDEN = /[\/\\:*?"<>|\x00]/;

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
  if (NAME_FORBIDDEN.test(trimmed)) {
    return "파일 이름에 다음 문자를 사용할 수 없습니다: / \\ : * ? \" < > |";
  }
  return null;
};

export const NameStep = ({
  fileName,
  defaultValue,
  onFileNameChange,
  onNext,
}: NameStepProps) => {
  const validation = validateName(fileName);
  const hasError = validation !== null;
  // 빈 입력이면 defaultValue로 자동 채움 → disabled 불필요
  // 단, 위험 문자 defaultValue(예: "my/accounts")는 validateName으로 걸러짐
  const effectiveValue = fileName.trim() === "" ? defaultValue : fileName;
  const effectiveValidation = validateName(effectiveValue);
  const isDisabled = effectiveValidation !== null;

  const handleNext = () => {
    if (fileName.trim() === "") {
      // 빈 입력이면 defaultValue로 채우고 진행
      onFileNameChange(defaultValue);
    }
    onNext();
  };

  return (
    <section className="rounded-4xl border border-[var(--color-border)] bg-[var(--color-bg)] p-7 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
        Step 1
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--color-text-h)]">
        새 파일 이름
      </h2>
      <p className="mt-3 text-sm leading-6 text-[var(--color-text)]">
        KIYO는 이 파일에 계정 정보를 암호화해 저장합니다. JSON 확장자는 자동으로 붙습니다.
      </p>

      <div className="mt-6">
        <label
          htmlFor="vault-name"
          className="block text-sm font-medium text-[var(--color-text)]"
        >
          파일 이름
        </label>
        <div className="mt-2 flex items-center gap-2">
          <Input
            id="vault-name"
            value={fileName}
            onChange={(e) => onFileNameChange(e.target.value)}
            placeholder={defaultValue}
            variant={hasError ? "error" : "default"}
            errorId={hasError ? "vault-name-error" : undefined}
            data-testid="create-vault-name-input"
            className="flex-1"
          />
          <span className="text-sm text-[var(--color-text)]">.json</span>
        </div>

        {validation && (
          <p
            id="vault-name-error"
            role="alert"
            data-testid="create-vault-name-error"
            className="mt-2 text-sm text-[var(--color-error)]"
          >
            {validation}
          </p>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={handleNext}
          disabled={isDisabled}
          data-testid="create-vault-next"
          className="!rounded-full !bg-[var(--color-accent)] !px-5 !py-3 !text-sm !font-semibold !text-white"
          label="다음"
        />
      </div>
    </section>
  );
};
