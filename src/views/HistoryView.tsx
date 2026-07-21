import { api } from "../api";
import { useAsync } from "../hooks";
import { useApp } from "../state";
import { Icon } from "../ui/icons";
import { Badge, SectionHeading, Skeleton, EmptyState } from "../ui/primitives";

export function HistoryView() {
  const { campaignId } = useApp();
  const { data: logs, loading } = useAsync(() => api.sessionLogs(campaignId!), [campaignId]);

  return (
    <div>
      <SectionHeading icon="history" title="Session History" subtitle="A running record of past sessions and saved state." />

      {loading && <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>}
      {!loading && logs?.length === 0 && <EmptyState icon="history" title="No sessions recorded" hint="Session summaries appear here after you play." />}

      <ol className="relative space-y-4 border-l border-[var(--color-line)] pl-6">
        {logs?.map((l) => (
          <li key={l.id} className="relative">
            <span className="absolute -left-[1.65rem] top-1.5 grid h-4 w-4 place-items-center rounded-full border-2 border-[var(--color-accent)] bg-[var(--color-canvas)]" />
            <div className="card p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold">{l.title}</h2>
                <div className="flex gap-1.5">
                  <Badge><Icon name="history" size={11} /> {l.date}</Badge>
                  <Badge>{Math.floor(l.durationMin / 60)}h {l.durationMin % 60}m</Badge>
                </div>
              </div>
              <p className="text-sm text-[var(--color-ink-muted)]">{l.summary}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="card mt-6 flex items-center gap-3 p-4">
        <Icon name="gear" size={18} className="text-[var(--color-ink-faint)]" />
        <div className="flex-1">
          <p className="font-semibold">Saved campaign state</p>
          <p className="text-sm text-[var(--color-ink-muted)]">Token positions, open doors, defeated enemies, and purchases are restored when you resume.</p>
        </div>
        <Badge tone="success"><Icon name="check" size={11} /> Auto-saved</Badge>
      </div>
    </div>
  );
}
