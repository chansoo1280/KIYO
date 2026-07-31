import { useLocation, useNavigate } from "react-router-dom";

const BottomTabs = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const active = (() => {
    switch (location.pathname) {
      case "/templates":
        return "templates";
      case "/settings":
        return "settings";
      case "/list":
      case "/":
      default:
        return "list";
    }
  })();

  return (
    <nav
      className="fixed left-1/2 bottom-4 z-30 flex w-[min(92%,420px)] -translate-x-1/2 gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] p-2 shadow-xl"
      aria-label="Bottom navigation"
    >
      <button
        type="button"
        className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
          active === "templates"
            ? "bg-[var(--color-accent-bg)] text-[var(--color-accent)]"
            : "text-[var(--color-text)] hover:bg-[var(--color-code-bg)]"
        }`}
        aria-label="Templates"
        onClick={() => navigate("/templates")}
      >
        📄
      </button>

      <button
        type="button"
        className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
          active === "list"
            ? "bg-[var(--color-accent-bg)] text-[var(--color-accent)]"
            : "text-[var(--color-text)] hover:bg-[var(--color-code-bg)]"
        }`}
        aria-label="List"
        onClick={() => navigate("/list")}
      >
        📋
      </button>

      <button
        type="button"
        className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
          active === "settings"
            ? "bg-[var(--color-accent-bg)] text-[var(--color-accent)]"
            : "text-[var(--color-text)] hover:bg-[var(--color-code-bg)]"
        }`}
        aria-label="Settings"
        onClick={() => navigate("/settings")}
      >
        ⚙️
      </button>
    </nav>
  );
};

export default BottomTabs;
