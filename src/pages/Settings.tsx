import BottomTabs from "../components/BottomTabs";

type Props = {
  onOpenAlerts?: () => void;
  onOpenList?: () => void;
  onOpenHome?: () => void;
};

const Settings = ({ onOpenAlerts, onOpenList, onOpenHome }: Props) => {
  return (
    <main className="settings-screen">
      <div className="settings-shell">
        <header className="settings-header">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <h1>Settings</h1>
          </div>
        </header>

        <section>
          <h3>Security</h3>
          <div className="settings-item">
            <span>PIN</span>
          </div>
          <div className="settings-item">
            <span>자동잠금</span>
          </div>

          <h3>UI</h3>
          <div className="settings-item">
            <span>다크모드</span>
          </div>
          <div className="settings-item">
            <span>글자크기</span>
          </div>

          <h3>Data</h3>
          <div className="settings-item">
            <span>백업</span>
          </div>
          <div className="settings-item">
            <span>복원</span>
          </div>
          <div className="settings-item">
            <span>초기화</span>
          </div>
        </section>

        <div className="settings-item">
          <span>파일변경</span>
          <button type="button" onClick={() => onOpenHome && onOpenHome()}>
            이동
          </button>
        </div>

        <div className="settings-item">
          <span>앱 정보</span>
        </div>
      </div>

      <BottomTabs
        active="settings"
        onOpenAlerts={onOpenAlerts}
        onOpenList={onOpenList}
        onOpenSettings={() => {}}
      />
    </main>
  );
};

export default Settings;
