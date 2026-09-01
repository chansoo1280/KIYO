import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDataFile } from "@/database/fileStorage";
import { mapError } from "@/utils/mapError";
import Button from "@/components/Button";
import { Stepper } from "./components/Stepper";
import { NameStep, validateName } from "./steps/NameStep";
import { PinStep } from "./steps/PinStep";

const DEFAULT_FILE_NAME = "my-accounts";

const CreateVaultPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [fileName, setFileName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Q16-a: 입력 변경 시 에러 자동 클리어
  const handleFileNameChange = (value: string) => {
    setFileName(value);
    if (error) setError(null);
  };

  const handlePinChange = (value: string) => {
    setPin(value);
    if (error) setError(null);
  };

  // Q15-b: 명시적 validateName() 후 통과 시 setStep(2)
  const handleNext = () => {
    const validation = validateName(fileName);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setStep(2);
  };

  // Q17-b: Step 2 → Step 1 "이전" 시 PIN 클리어 (보안)
  const handleBack = () => {
    setPin("");
    setError(null);
    setStep(1);
  };

  // 비암호화 볼트 생성 (PIN 건너뛰기)
  const handleSkip = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await createDataFile(`${fileName.trim()}.json`); // PIN 없이 호출 → 평문
      navigate("/accounts", { replace: true });
    } catch (err) {
      setError(mapError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Q3-c: mapError 통일 (Plan-A1 정식 도입)
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await createDataFile(`${fileName.trim()}.json`, pin);
      navigate("/accounts", { replace: true });
      // 성공 시 state는 unmount로 자동 GC
    } catch (err) {
      setError(mapError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="min-h-svh bg-[var(--color-bg)] px-5 py-8"
      data-testid="create-vault-page"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/")}
            className="!h-10 !w-10 !rounded-full !p-0 !text-[var(--color-text-muted)] hover:!bg-[var(--color-code-bg)] hover:!text-[var(--color-text)]"
            label="←"
            aria-label="홈으로"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
              New vault
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-[var(--color-text-h)]">
              새 파일 생성
            </h1>
          </div>
        </header>

        <section className="rounded-4xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-sm">
          <Stepper step={step} />
        </section>

        {step === 1 ? (
          <NameStep
            fileName={fileName}
            defaultValue={DEFAULT_FILE_NAME}
            onFileNameChange={handleFileNameChange}
            onNext={handleNext}
          />
        ) : (
          <PinStep
            fileName={fileName}
            pin={pin}
            onPinChange={handlePinChange}
            onBack={handleBack}
            onSubmit={handleSubmit}
            onSkip={handleSkip}
            isSubmitting={isSubmitting}
            error={error}
          />
        )}
      </div>
    </main>
  );
};

export default CreateVaultPage;
