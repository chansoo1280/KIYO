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
    <section className="min-h-[100svh] bg-[linear-gradient(180deg,#f8f7ff_0%,#ffffff_100%)] pb-28 pt-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-5">
        <header className="flex items-center gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#aa3bff]">
              알림
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">
              Notifications
            </h2>
          </div>
        </header>

        <div className="grid gap-3">
          {notifications.map((n) => (
            <article
              key={n.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
            >
              <p className="text-sm text-slate-700">{n.text}</p>
            </article>
          ))}
        </div>
      </div>

      <BottomTabs
        active="alerts"
        onOpenList={onOpenList}
        onOpenSettings={onOpenSettings}
      />
    </section>
  );
};

export default Alerts;
