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
import { useAccountStore } from "@/store/accountStore";
import { useSettingsStore } from "@/store/settingsStore";
import { AutoLockIndicator } from "@/components/AutoLockIndicator";
import { useEffect } from "react";
import { useAutoLock } from "./hooks/useAutoLock";

function App() {
  const { remainingSeconds } = useAutoLock();
  const initialize = useAccountStore((state) => state.initialize);
  const initializeTheme = useSettingsStore((state) => state.initializeTheme);
  const initializeFontSize = useSettingsStore(
    (state) => state.initializeFontSize,
  );
  const initializeAutoLockTimeout = useSettingsStore(
    (state) => state.initializeAutoLockTimeout,
  );

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  useEffect(() => {
    initializeFontSize();
  }, [initializeFontSize]);

  useEffect(() => {
    initializeAutoLockTimeout();
  }, [initializeAutoLockTimeout]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
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
    </BrowserRouter>
  );
}

export default App;