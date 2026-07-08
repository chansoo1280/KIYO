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
    <nav className="bottom-tabs" aria-label="Bottom navigation">
      <button
        type="button"
        className={`tab-btn ${active === "alerts" ? "active" : ""}`}
        aria-label="Alerts"
        onClick={() => onOpenAlerts && onOpenAlerts()}
      >
        🔔
      </button>

      <button
        type="button"
        className={`tab-btn ${active === "list" ? "active" : ""}`}
        aria-label="List"
        onClick={() => onOpenList && onOpenList()}
      >
        📋
      </button>

      <button
        type="button"
        className={`tab-btn ${active === "settings" ? "active" : ""}`}
        aria-label="Settings"
        onClick={() => onOpenSettings && onOpenSettings()}
      >
        ⚙️
      </button>
    </nav>
  );
};

export default BottomTabs;
