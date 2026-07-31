import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import AccountList from "@/pages/AccountList";
import AccountDetail from "@/pages/AccountDetail";
import AccountEdit from "@/pages/AccountEdit";
import Settings from "@/pages/Settings";
import Auth from "@/pages/Auth";
import AutofillTestLogin from "@/pages/AutofillTestLogin";
import TemplateList from "@/pages/TemplateList";
import TemplateEdit from "@/pages/TemplateEdit";
import { useAccountStore } from "@/store/accountStore";
import { useSettingsStore } from "@/store/settingsStore";
import { AutoLockProvider } from "@/components/AutoLockProvider";
import { useEffect } from "react";

function App() {
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
      <AutoLockProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/list" element={<AccountList />} />
          <Route path="/account" element={<AccountDetail />} />
          <Route path="/account/:id" element={<AccountDetail />} />
          <Route path="/account/edit" element={<AccountEdit />} />
          <Route path="/account/edit/:id" element={<AccountEdit />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/autofill-test" element={<AutofillTestLogin />} />
          <Route path="/templates" element={<TemplateList />} />
          <Route path="/templates/new" element={<TemplateEdit />} />
          <Route path="/templates/:id/edit" element={<TemplateEdit />} />
        </Routes>
      </AutoLockProvider>
    </BrowserRouter>
  );
}

export default App;