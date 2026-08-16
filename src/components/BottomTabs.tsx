import { useLocation, useNavigate } from "react-router-dom";
import { FileText, List, Settings } from "lucide-react";

const BottomTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const active = (() => {
    switch (location.pathname) {
      case "/templates":
        return "templates";
      case "/settings":
        return "settings";
      case "/accounts":
      case "/":
      default:
        return "list";
    }
  })();

  const templateTabClass = `flex-1 rounded-md px-4 py-3 text-sm font-semibold transition ${active === "templates" ? "bg-[var(--color-accent-bg)] text-[var(--color-accent)]" : "text-[var(--color-text)] hover:bg-[var(--color-code-bg)]"}`;
  const listTabClass = `flex-1 rounded-md px-4 py-3 text-sm font-semibold transition ${active === "list" ? "bg-[var(--color-accent-bg)] text-[var(--color-accent)]" : "text-[var(--color-text)] hover:bg-[var(--color-code-bg)]"}`;
  const settingsTabClass = `flex-1 rounded-md px-4 py-3 text-sm font-semibold transition ${active === "settings" ? "bg-[var(--color-accent-bg)] text-[var(--color-accent)]" : "text-[var(--color-text)] hover:bg-[var(--color-code-bg)]"}`;

  return (
    <nav
      className="fixed left-1/2 bottom-4 z-30 flex w-[min(92%,420px)] -translate-x-1/2 gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-2 shadow-sm"
      aria-label="Bottom navigation"
    >
      <button
        type="button"
        className={templateTabClass}
        aria-label="Templates"
        onClick={() => navigate("/templates")}
      >
        <FileText className="h-4 w-4" />
      </button>

      <button
        type="button"
        className={listTabClass}
        aria-label="List"
        onClick={() => navigate("/accounts")}
      >
        <List className="h-4 w-4" />
      </button>

      <button
        type="button"
        className={settingsTabClass}
        aria-label="Settings"
        onClick={() => navigate("/settings")}
      >
        <Settings className="h-4 w-4" />
      </button>
    </nav>
  );
};

export default BottomTabs;