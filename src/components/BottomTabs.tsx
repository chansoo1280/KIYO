type Props = {
  active?: "alerts" | "list" | "settings";
  onOpenAlerts?: () => void;
  onOpenList?: () => void;
  onOpenSettings?: () => void;
};

const BottomTabs = ({
  active = "list",
  onOpenAlerts,
  onOpenList,
  onOpenSettings,
}: Props) => {
  return (
    <nav
      className="fixed left-1/2 bottom-4 z-30 flex w-[min(92%,420px)] -translate-x-1/2 gap-2 rounded-full border border-slate-200 bg-white p-2 shadow-xl"
      aria-label="Bottom navigation"
    >
      <button
        type="button"
        className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
          active === "alerts"
            ? "bg-[#f4efff] text-[#7c3aed]"
            : "text-slate-600 hover:bg-slate-100"
        }`}
        aria-label="Alerts"
        onClick={() => onOpenAlerts && onOpenAlerts()}
      >
        🔔
      </button>

      <button
        type="button"
        className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
          active === "list"
            ? "bg-[#f4efff] text-[#7c3aed]"
            : "text-slate-600 hover:bg-slate-100"
        }`}
        aria-label="List"
        onClick={() => onOpenList && onOpenList()}
      >
        📋
      </button>

      <button
        type="button"
        className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition ${
          active === "settings"
            ? "bg-[#f4efff] text-[#7c3aed]"
            : "text-slate-600 hover:bg-slate-100"
        }`}
        aria-label="Settings"
        onClick={() => onOpenSettings && onOpenSettings()}
      >
        ⚙️
      </button>
    </nav>
  );
};

export default BottomTabs;
