import BottomTabs from "../components/BottomTabs";

const Alerts = ({
  onOpenList,
  onOpenSettings,
}: {
  onOpenList?: () => void;
  onOpenSettings?: () => void;
}) => {
  const notifications = [
    { id: "1", text: "보안 업데이트가 필요합니다." },
    { id: "2", text: "새로운 로그인 기기 감지" },
    { id: "3", text: "백업이 권장됩니다." },
  ];

  return (
    <section className="account-list-screen">
      <div className="account-list-shell">
        <header className="account-list-header">
          <div>
            <p className="eyebrow">알림</p>
            <h2>Notifications</h2>
          </div>
        </header>

        <div className="account-list-content">
          {notifications.map((n) => (
            <article key={n.id} className="account-card compact-row">
              <div className="account-main compact-main">
                <p className="account-meta compact-meta">{n.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* use shared BottomTabs component */}
      <BottomTabs
        active="alerts"
        onOpenList={onOpenList}
        onOpenSettings={onOpenSettings}
      />
    </section>
  );
};

export default Alerts;
