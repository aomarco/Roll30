import { api } from "../api";
import { useAsync } from "../hooks";
import { useApp, type View } from "../state";
import { Icon, type IconName } from "../ui/icons";
import { Avatar, Badge, SectionHeading } from "../ui/primitives";

export function DashboardView() {
  const { campaignId, go } = useApp();
  const { data: campaign } = useAsync(() => api.campaign(campaignId!), [campaignId]);
  const { data: scenes } = useAsync(() => api.scenes(campaignId!), [campaignId]);
  const { data: chars } = useAsync(() => api.characters(campaignId!), [campaignId]);
  const { data: logs } = useAsync(() => api.sessionLogs(campaignId!), [campaignId]);

  const activeScene = scenes?.find((s) => s.id === campaign?.activeSceneId);

  const stats: { label: string; value: number; icon: IconName; view: View["name"] }[] = [
    { label: "Scenes", value: scenes?.length ?? 0, icon: "scenes", view: "scenes" },
    { label: "Characters", value: chars?.length ?? 0, icon: "characters", view: "characters" },
    { label: "Sessions", value: campaign?.sessionCount ?? 0, icon: "history", view: "history" },
  ];

  return (
    <div>
      <SectionHeading title={campaign?.name ?? "Campaign"} subtitle={campaign?.tagline} icon="dashboard"
        action={<Badge tone="accent"><Icon name="link" size={11} /> {campaign?.code}</Badge>} />

      {/* Resume / launch */}
      <div className="card mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl text-2xl"
            style={{ background: `${activeScene?.thumbnailColor ? "#6366f1" : "#333"}22`, color: "#818cf8" }}>
            <Icon name="play" size={26} />
          </span>
          <div>
            <p className="label">Continue session</p>
            <p className="text-lg font-bold">{activeScene?.name ?? "No active scene"}</p>
            <p className="text-sm text-[var(--color-ink-muted)]">{activeScene?.summary ?? "Pick a scene to begin."}</p>
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => activeScene ? go({ name: "scene", sceneId: activeScene.id }) : go({ name: "scenes" })}
        >
          <Icon name="play" size={16} /> {activeScene ? "Resume" : "Choose scene"}
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <button key={s.label} onClick={() => go({ name: s.view } as View)} className="card card-hover p-4 text-left">
            <Icon name={s.icon} size={18} className="text-[var(--color-ink-faint)]" />
            <p className="mt-2 text-2xl font-black">{s.value}</p>
            <p className="text-sm text-[var(--color-ink-muted)]">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Party */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">The Party</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => go({ name: "characters" })}>View all</button>
          </div>
          <div className="card divide-y divide-[var(--color-line)]">
            {chars?.map((c) => (
              <button key={c.id} onClick={() => go({ name: "character", characterId: c.id })}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-surface-2)]">
                <Avatar name={c.name} color={c.portraitColor} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">Lv {c.level} {c.ancestry} {c.className} · {c.playerName}</p>
                </div>
                <Icon name="chevron" size={16} className="text-[var(--color-ink-faint)]" />
              </button>
            ))}
          </div>
        </section>

        {/* Recent sessions */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Recent sessions</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => go({ name: "history" })}>View all</button>
          </div>
          <div className="card divide-y divide-[var(--color-line)]">
            {logs?.map((l) => (
              <div key={l.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{l.title}</p>
                  <span className="mono text-xs text-[var(--color-ink-faint)]">{l.date}</span>
                </div>
                <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">{l.summary}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
