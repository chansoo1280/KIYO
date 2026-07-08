import { useState } from "react";
import Home from "./pages/Home";
import AccountList from "./pages/AccountList";
import Settings from "./pages/Settings.tsx";
import Alerts from "./pages/Alerts.tsx";
import "./App.css";

function App() {
  const [view, setView] = useState<"home" | "list" | "settings" | "alerts">(
    "home",
  );

  return view === "home" ? (
    <Home onCreateFile={() => setView("list")} />
  ) : view === "list" ? (
    <AccountList
      onOpenSettings={() => setView("settings")}
      onOpenAlerts={() => setView("alerts")}
    />
  ) : view === "settings" ? (
    <Settings
      onOpenAlerts={() => setView("alerts")}
      onOpenList={() => setView("list")}
      onOpenHome={() => setView("home")}
    />
  ) : (
    <Alerts
      onOpenList={() => setView("list")}
      onOpenSettings={() => setView("settings")}
    />
  );
}

export default App;
