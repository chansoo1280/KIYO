import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import AccountList from "./pages/AccountList";
import Settings from "./pages/Settings.tsx";
import Alerts from "./pages/Alerts.tsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/list" element={<AccountList />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/alerts" element={<Alerts />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
