import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import AccountList from "@/pages/Accounts";
import AccountDetail from "@/pages/Accounts/AccountDetail";
import AccountEdit from "@/pages/Accounts/AccountEdit";
import Settings from "@/pages/Settings";
import Auth from "@/pages/Auth";
import AutofillTestLogin from "@/pages/AutofillTestLogin";
import TemplateList from "@/pages/Templates";
import TemplateEdit from "@/pages/Templates/TemplateEdit";
import CreateVaultPage from "@/pages/CreateVault";
import RootRedirect from "@/pages/RootRedirect";
import { AutoLockIndicator } from "@/components/AutoLockIndicator";
import { SyncErrorBanner } from "@/components/SyncErrorBanner";
import { useAutoLock } from "./hooks/useAutoLock";
import AndroidBackButtonHandler from "./hooks/useAndroidBackButton";

function App() {
  const { remainingSeconds } = useAutoLock();

  return (
    <BrowserRouter>
      <AndroidBackButtonHandler />
      <Routes>
        {/* `/` → RootRedirect (cryptoKey 분기 + preload + /accounts 또는 /auth) */}
        <Route path="/" element={<RootRedirect />} />

        {/* 실제 Home은 /home으로 이동 */}
        <Route path="/home" element={<Home />} />

        {/* 기존 라우트 그대로 */}
        <Route path="/create-vault" element={<CreateVaultPage />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/accounts" element={<AccountList />} />
        <Route path="/accounts/new" element={<AccountEdit />} />
        <Route path="/accounts/:id" element={<AccountDetail />} />
        <Route path="/accounts/:id/edit" element={<AccountEdit />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/autofill-test" element={<AutofillTestLogin />} />
        <Route path="/templates" element={<TemplateList />} />
        <Route path="/templates/new" element={<TemplateEdit />} />
        <Route path="/templates/:id/edit" element={<TemplateEdit />} />
      </Routes>
      <AutoLockIndicator remainingSeconds={remainingSeconds} />
      <SyncErrorBanner />
    </BrowserRouter>
  );
}

export default App;