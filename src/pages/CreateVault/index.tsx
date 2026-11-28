import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDataFile } from "@/persistence/vaultPersistence";
import { mapError } from "@/utils/mapError";
import { BackButton } from "@/components/BackButton";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { Stepper } from "./components/Stepper";
import { NameStep } from "./steps/NameStep";
import { validateName } from "@/constants/fileName";
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
    <PageShell maxWidth="md" data-testid="create-vault-page">
    <PageHeader
      title="새 파일 생성"
      leftActions={<BackButton onClick={() => navigate("/")} ariaLabel="홈으로" />}
    />

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
    </PageShell>
  );
};

export default CreateVaultPage;
