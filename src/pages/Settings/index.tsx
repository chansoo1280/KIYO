import { useState } from "react";
import BottomTabs from "@/components/BottomTabs";
import Button from "@/components/Button";
import { SecuritySection } from "./components/SecuritySection";
import { UISection } from "./components/UISection";
import { DataSection } from "./components/DataSection";
import { AutofillSection } from "./components/AutofillSection";
import { AppInfoDialog } from "./components/AppInfoDialog";
import { closeDataFile } from "@/database/fileStorage";
import { useNavigate } from "react-router-dom";
import { useFileAuthGuard } from "@/hooks/useFileAuthGuard";

const Settings = () => {
  const [showAppInfoDialog, setShowAppInfoDialog] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = async () => {
      await closeDataFile();
      navigate("/", { state: { selectFile: true }, replace: true });
    };

  // 파일/인증 상태 체크 및 네비게이션 (훅으로 분리)
  useFileAuthGuard({
    skipRedirect: false,
  });

  return (
    <main className="min-h-svh bg-[var(--color-bg)] px-5 py-8 pb-28">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold text-[var(--color-text-h)]">
            Settings
          </h1>
        </header>

        <section className="space-y-4">
          <SecuritySection />
          <UISection />
          <DataSection />
          <AutofillSection />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
              <span>파일변경</span>
              <Button variant="primary" onClick={handleFileChange} label="이동" />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4 text-sm text-[var(--color-text)]">
              <span>앱 정보</span>
              <Button variant="ghost" onClick={() => setShowAppInfoDialog(true)} label="보기" />
            </div>
          </div>

          <AppInfoDialog
            open={showAppInfoDialog}
            onClose={() => setShowAppInfoDialog(false)}
          />
        </section>

        <BottomTabs />
      </div>
    </main>
  );
};

export default Settings;