import { api } from "../api";
import { useAsync } from "../hooks";
import { useApp } from "../state";
import { Icon } from "../ui/icons";
import { Badge, SectionHeading, Skeleton, EmptyState } from "../ui/primitives";

export function TemplatesView() {
  const { campaignId } = useApp();
  const { data: scenes, loading } = useAsync(() => api.scenes(campaignId!), [campaignId]);
  const templates = (scenes ?? []).filter((s) => s.isTemplate);

  return (
    <div>
      <SectionHeading icon="template" title="Templates" subtitle="Reusable scenes you can drop into any campaign."
        action={<button className="btn btn-primary"><Icon name="plus" size={16} /> New template</button>} />

      {loading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>}
      {!loading && templates.length === 0 && <EmptyState icon="template" title="No templates saved" hint="Save any scene as a template from its GM Tools panel to reuse it later." />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <div key={t.id} className="card card-hover p-4">
            <div className="mb-2 flex items-center justify-between">
              <Badge tone={t.type === "battle-field" ? "danger" : "success"}>
                <Icon name={t.type === "battle-field" ? "sword" : "map"} size={11} /> {t.type === "battle-field" ? "Battle" : "Playing"}
              </Badge>
              <Badge><Icon name="template" size={11} /> Template</Badge>
            </div>
            <p className="font-bold">{t.name}</p>
            <p className="line-clamp-2 text-sm text-[var(--color-ink-muted)]">{t.summary}</p>
            <div className="mt-3 flex gap-2">
              <button className="btn btn-primary btn-sm flex-1"><Icon name="plus" size={13} /> Use</button>
              <button className="btn btn-ghost btn-icon" aria-label="Duplicate"><Icon name="duplicate" size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
