import { useState } from "react";
import BottomTabs from "@/components/BottomTabs";
import Button from "@/components/Button";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";
import { SettingsRow } from "@/components/SettingsRow";
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
    <PageShell maxWidth="lg" withBottomTabs>
      <PageHeader title="Settings" />

      <section className="space-y-4">
        <SecuritySection />
        <UISection />
        <DataSection />
        <AutofillSection />

        <div className="flex flex-col gap-3">
          <SettingsRow label="파일변경">
            <Button variant="primary" onClick={handleFileChange} label="이동" />
          </SettingsRow>
          <SettingsRow label="앱 정보">
            <Button variant="ghost" onClick={() => setShowAppInfoDialog(true)} label="보기" />
          </SettingsRow>
        </div>

        <AppInfoDialog
          open={showAppInfoDialog}
          onClose={() => setShowAppInfoDialog(false)}
        />
      </section>

      <BottomTabs />
    </PageShell>
  );
};

export default Settings;