import { useState, useCallback, useEffect } from "react";
import { BaseDialog } from "./BaseDialog";
import { useSecureClipboard } from "../hooks/useSecureClipboard";

interface PasswordGeneratorProps {
  open: boolean;
  onClose: () => void;
  onApply: (password: string) => void;
}

interface CharSetOptions {
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

const CHAR_SETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
} as const;

const generateSecurePassword = (
  length: number,
  charSets: CharSetOptions
): string => {
  const availableChars = Object.entries(CHAR_SETS)
    .filter(([key]) => charSets[key as keyof CharSetOptions])
    .flatMap(([, chars]) => chars.split(""));

  if (availableChars.length === 0) {
    return "";
  }

  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);

  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = randomValues[i] % availableChars.length;
    password += availableChars[randomIndex];
  }

  // Ensure at least one character from each selected set is included
  const selectedSets = Object.entries(charSets)
    .filter(([, enabled]) => enabled)
    .map(([key]) => CHAR_SETS[key as keyof typeof CHAR_SETS]);

  if (selectedSets.length > 0 && password.length >= selectedSets.length) {
    const passwordArray = password.split("");
    selectedSets.forEach((charSet) => {
      const randomIndex = Math.floor(Math.random() * passwordArray.length);
      const randomCharIndex = Math.floor(Math.random() * charSet.length);
      passwordArray[randomIndex] = charSet[randomCharIndex];
    });
    password = passwordArray.join("");
  }

  return password;
};

export const PasswordGenerator = ({
  open,
  onClose,
  onApply,
}: PasswordGeneratorProps) => {
  const [length, setLength] = useState(16);
  const [charSets, setCharSets] = useState<CharSetOptions>({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  });
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // 기본 클립보드 자동 초기화 시간 (30초)
  const clipboardAutoClearTimeout = 30000;

  // 보안 클립보드 훅 사용 (기본 30초 후 자동 초기화)
  const { copyToClipboard, hasCopiedText, remainingTime } = useSecureClipboard({
    timeoutMs: clipboardAutoClearTimeout,
    successMessage: `비밀번호가 클립보드에 복사되었습니다. ${Math.round(clipboardAutoClearTimeout / 1000)}초 후 자동으로 지워집니다.`,
    errorMessage: "비밀번호 복사에 실패했습니다.",
    disabled: false,
  });

  const generatePassword = useCallback(() => {
    setErrorMessage("");
    const hasAnyCharSet = Object.values(charSets).some((enabled) => enabled);
    if (!hasAnyCharSet) {
      setErrorMessage("최소 한 가지 문자 종류를 선택해주세요.");
      setGeneratedPassword("");
      return;
    }

    const password = generateSecurePassword(length, charSets);
    setGeneratedPassword(password);
  }, [length, charSets]);

  const handleCharSetChange = (key: keyof CharSetOptions) => {
    setCharSets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApply = () => {
    if (generatedPassword) {
      onApply(generatedPassword);
      onClose();
    }
  };

  const handleClose = () => {
    setGeneratedPassword("");
    setErrorMessage("");
    onClose();
  };

  // Generate password when dialog opens
  useEffect(() => {
    if (open) {
      generatePassword();
    }
  }, [open, generatePassword]);

  const charSetOptions: Array<{ key: keyof CharSetOptions; label: string }> = [
    { key: "uppercase", label: "영대문자 (A-Z)" },
    { key: "lowercase", label: "영소문자 (a-z)" },
    { key: "numbers", label: "숫자 (0-9)" },
    { key: "symbols", label: "특수문자 (!@#$%^&*)" },
  ];

  return (
    <BaseDialog
      open={open}
      title="비밀번호 생성기"
      description="강력한 비밀번호를 생성하여 계정 보안을 강화하세요."
      onClose={handleClose}
      confirmLabel="적용"
      onConfirm={handleApply}
      confirmDisabled={!generatedPassword}
    >
      <div className="space-y-4">
        {/* Length Slider */}
        <div>
          <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-[var(--color-text)]">
            길이: {length}자
          </label>
          </div>
          <input
            type="range"
            min="8"
            max="32"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="mt-2 w-full h-2 bg-[var(--color-border)] rounded-lg appearance-none accent-[var(--color-accent)]"
          />
          <div className="flex justify-between text-xs text-[var(--color-text)] mt-1">
            <span>8자</span>
            <span>32자</span>
          </div>
        </div>

        {/* Character Set Options */}
        <div>
          <p className="text-sm font-medium text-[var(--color-text)] mb-2">문자 종류</p>
          <div className="grid grid-cols-2 gap-2">
            {charSetOptions.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-code-bg)] px-3 py-2 text-sm text-[var(--color-text)] cursor-pointer hover:bg-[var(--color-border)]"
              >
                <input
                  type="checkbox"
                  checked={charSets[key]}
                  onChange={() => handleCharSetChange(key)}
                  className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <button
          type="button"
          onClick={generatePassword}
          className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent)]/80 transition-colors"
        >
          새로 생성
        </button>

        {/* Generated Password Display */}
        {generatedPassword && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-code-bg)] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[var(--color-text)]">생성된 비밀번호</span>
              <span className="text-xs text-[var(--color-text)]">{generatedPassword.length}자</span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={generatedPassword}
                readOnly
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-mono text-[var(--color-text-h)] outline-none pr-12"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(generatedPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--color-accent)]/80 transition-colors"
                disabled={hasCopiedText}
              >
                {hasCopiedText ? (
                  <>
                    복사됨 {remainingTime > 0 && `(${remainingTime}s)`}
                  </>
                ) : (
                  "복사"
                )}
              </button>
            </div>
          </div>
        )}

        {errorMessage && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400 text-center">{errorMessage}</p>
        )}

        <p className="text-xs text-[var(--color-text)] text-center">
          생성된 비밀번호는 브라우저의 암호화된 난수 생성기(crypto.getRandomValues)를 사용하여 안전하게 생성됩니다.
        </p>
      </div>
    </BaseDialog>
  );
};

export default PasswordGenerator;