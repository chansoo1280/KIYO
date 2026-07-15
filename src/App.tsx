import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import AccountList from "./pages/AccountList";
import AccountDetail from "./pages/AccountDetail";
import AccountEdit from "./pages/AccountEdit";
import Settings from "./pages/Settings.tsx";
import Alerts from "./pages/Alerts.tsx";
import Auth from "./pages/Auth";
import { useAccountStore } from "./store/accountStore.ts";
import { useEffect } from "react";

function App() {
  const initialize = useAccountStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/list" element={<AccountList />} />
        <Route path="/account" element={<AccountDetail />} />
        <Route path="/account/:id" element={<AccountDetail />} />
        <Route path="/account/edit" element={<AccountEdit />} />
        <Route path="/account/edit/:id" element={<AccountEdit />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/alerts" element={<Alerts />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
