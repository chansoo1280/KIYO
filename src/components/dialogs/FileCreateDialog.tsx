import { useState } from "react";
import { FormDialog } from "./FormDialog";
import PinStrengthMeter from "@/components/inputs/PinStrengthMeter";
import { MIN_PIN_LENGTH } from "@/crypto/pinStrength";
import { Input, Checkbox } from "@/components/inputs";

interface FileCreateDialogProps {
  open: boolean;
  title: string;
  description: string;
  defaultValue: string;
  confirmLabel: string;

  onConfirm: (options: {
    fileName: string;
    encrypted: boolean;
    pin: string;
  }) => Promise<void>;

  onClose: () => void;
}

const FileCreateDialog = ({
  open,
  title,
  description,
  defaultValue,
  confirmLabel,
  onConfirm,
  onClose,
}: FileCreateDialogProps) => {
  const [fileName, setFileName] = useState(defaultValue.replace(".json", ""));
  const [encrypted, setEncrypted] = useState(true);
  const [pin, setPin] = useState("");

  const confirmDisabled =
    !fileName.trim() || (encrypted && pin.length < MIN_PIN_LENGTH);

  const handleClose = () => {
    setFileName(defaultValue.replace(".json", ""));
    setPin("");
    setEncrypted(true);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fileName.trim()) {
      throw new Error("파일 이름을 입력해주세요.");
    }

    if (encrypted && pin.length < MIN_PIN_LENGTH) {
      throw new Error(`PIN은 ${MIN_PIN_LENGTH}자 이상 입력해주세요.`);
    }

    await onConfirm({
      fileName: `${fileName.trim()}.json`,
      encrypted,
      pin,
    });

    handleClose();
  };

  return (
    <FormDialog
      open={open}
      title={title}
      description={description}
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitLabel={confirmLabel}
      disabled={confirmDisabled}
    >
      {/* 파일 이름 */}
      <label htmlFor="vault-name-input" className="mt-5 block text-sm font-medium text-[var(--color-text)]">
        파일 이름
      </label>

      <div className="mt-2 flex items-center gap-2">
        <Input
        id="vault-name-input"
        value={fileName}
        onChange={(e) => setFileName(e.target.value)}
        className="flex-1"
      />

        <span className="text-sm text-[var(--color-text)]">.json</span>
      </div>

      {/* 암호화 여부 */}
      <label className="mt-5 flex items-center gap-3 text-sm font-medium text-[var(--color-text)]" htmlFor="encrypt-checkbox">
        <Checkbox
          label="파일 암호화 사용"
          id="encrypt-checkbox"
          checked={encrypted}
          onChange={(e) => setEncrypted(e.target.checked)}
        />
      </label>

      {/* PIN */}
      {encrypted && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-[var(--color-text)]">
            PIN 번호
          </label>

          <Input
            type="password"
            inputMode="text"
            maxLength={20}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="4~20자 PIN"
            className="mt-2"
          />
          <PinStrengthMeter pin={pin} className="mt-2" />
        </div>
      )}
    </FormDialog>
  );
};

export default FileCreateDialog;