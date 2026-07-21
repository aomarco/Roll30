import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { useApp } from "../state";
import type { Note } from "../types";
import { Icon, type IconName } from "../ui/icons";
import { Badge, SectionHeading, Skeleton, EmptyState } from "../ui/primitives";

const catIcon: Record<Note["category"], IconName> = {
  lore: "note", handout: "image", rule: "gear", session: "history", idea: "sparkles",
};

export function NotesView() {
  const { campaignId } = useApp();
  const { data: notes, loading } = useAsync(() => api.notes(campaignId!), [campaignId]);
  const [cat, setCat] = useState<"all" | Note["category"]>("all");

  const cats: ("all" | Note["category"])[] = ["all", "lore", "handout", "rule", "session", "idea"];
  const rows = (notes ?? []).filter((n) => cat === "all" || n.category === cat);

  return (
    <div>
      <SectionHeading icon="note" title="Notes & Lore" subtitle="Lore, handouts, house rules, and secrets."
        action={<button className="btn btn-primary"><Icon name="plus" size={16} /> New note</button>} />

      <div className="mb-5 flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`btn btn-sm capitalize ${cat === c ? "btn-primary" : "btn-ghost"}`}>{c}</button>
        ))}
      </div>

      {loading && <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>}
      {!loading && rows.length === 0 && <EmptyState icon="note" title="No notes here" hint="Write lore, prep handouts, or jot a house rule." />}

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((n) => (
          <article key={n.id} className="card card-hover p-4">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name={catIcon[n.category]} size={15} className="text-[var(--color-ink-faint)]" />
                <h2 className="font-semibold">{n.title}</h2>
              </div>
              {n.secret && <Badge tone="warn"><Icon name="lock" size={10} /> GM only</Badge>}
            </div>
            <p className="line-clamp-3 text-sm text-[var(--color-ink-muted)]">{n.body}</p>
            <div className="mt-2 flex items-center justify-between">
              <Badge>{n.category}</Badge>
              <span className="mono text-xs text-[var(--color-ink-faint)]">{n.updatedAt}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
