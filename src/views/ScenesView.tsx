import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { useApp } from "../state";
import type { Scene } from "../types";
import { Icon } from "../ui/icons";
import { Badge, SectionHeading, Skeleton, Modal, Field, PlaceholderTag } from "../ui/primitives";

const sceneTint: Record<string, string> = {
  "aurora-amber": "#f59e0b", "aurora-teal": "#14b8a6", "aurora-rose": "#e11d48", "aurora-indigo": "#6366f1",
};

function SceneCard({ scene, onOpen }: { scene: Scene; onOpen: () => void }) {
  const tint = sceneTint[scene.thumbnailColor] ?? "#6366f1";
  const isBattle = scene.type === "battle-field";
  return (
    <div className="card card-hover overflow-hidden fadein">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="relative h-20" style={{ background: `linear-gradient(135deg, ${tint}44, ${tint}11)` }}>
          <span className="absolute left-3 top-3">
            <Badge tone={isBattle ? "danger" : "success"}>
              <Icon name={isBattle ? "sword" : "map"} size={11} /> {isBattle ? "Battle Field" : "Playing Field"}
            </Badge>
          </span>
          {scene.isTemplate && <span className="absolute right-3 top-3"><Badge><Icon name="template" size={11} /> Template</Badge></span>}
        </div>
        <div className="p-4">
          <p className="font-bold">{scene.name}</p>
          <p className="line-clamp-2 text-sm text-[var(--color-ink-muted)]">{scene.summary}</p>
        </div>
      </button>
      <div className="flex items-center justify-between border-t border-[var(--color-line)] px-4 py-2.5 text-xs text-[var(--color-ink-faint)]">
        <span className="mono">Updated {scene.updatedAt}</span>
        <div className="flex gap-1">
          <button className="btn btn-ghost btn-icon" title="Duplicate" aria-label="Duplicate scene"><Icon name="duplicate" size={14} /></button>
          <button className="btn btn-primary btn-sm" onClick={onOpen}><Icon name="build" size={13} /> Open</button>
        </div>
      </div>
    </div>
  );
}

export function ScenesView() {
  const { campaignId, go } = useApp();
  const { data: scenes, loading } = useAsync(() => api.scenes(campaignId!), [campaignId]);
  const { data: folders } = useAsync(() => api.folders(), []);
  const [filter, setFilter] = useState<"all" | "playing-field" | "battle-field">("all");
  const [showNew, setShowNew] = useState(false);
  const [newType, setNewType] = useState<"playing-field" | "battle-field">("playing-field");

  const visible = (scenes ?? []).filter((s) => filter === "all" || s.type === filter);
  const loose = visible.filter((s) => !s.folderId);

  return (
    <div>
      <SectionHeading icon="scenes" title="Scenes" subtitle="Playing Fields for roleplay, Battle Fields for combat."
        action={<button className="btn btn-primary" onClick={() => setShowNew(true)}><Icon name="plus" size={16} /> New scene</button>} />

      <div className="mb-5 inline-flex rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)] p-1">
        {([["all", "All"], ["playing-field", "Playing"], ["battle-field", "Battle"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`btn btn-sm ${filter === k ? "btn-primary" : "btn-ghost border-transparent"}`}>{label}</button>
        ))}
      </div>

      {loading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52" />)}</div>}

      {folders?.map((f) => {
        const inFolder = visible.filter((s) => s.folderId === f.id);
        if (!inFolder.length) return null;
        return (
          <section key={f.id} className="mb-7">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--color-ink-muted)]">
              <Icon name="scenes" size={15} /> {f.name}
              <span className="text-[var(--color-ink-faint)]">· {inFolder.length}</span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {inFolder.map((s) => <SceneCard key={s.id} scene={s} onOpen={() => go({ name: "scene", sceneId: s.id })} />)}
            </div>
          </section>
        );
      })}

      {loose.length > 0 && (
        <section className="mb-7">
          <h2 className="mb-3 text-sm font-bold text-[var(--color-ink-muted)]">Unfiled</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loose.map((s) => <SceneCard key={s.id} scene={s} onOpen={() => go({ name: "scene", sceneId: s.id })} />)}
          </div>
        </section>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New scene"
        footer={<><button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button><button className="btn btn-primary" onClick={() => setShowNew(false)}>Create scene</button></>}>
        <div className="space-y-4">
          <div className="flex justify-end"><PlaceholderTag /></div>
          <Field label="Scene name"><input className="input" placeholder="The Gilded Tankard" /></Field>
          <div>
            <span className="label mb-1.5 block">Scene type</span>
            <div className="grid grid-cols-2 gap-3">
              {([["playing-field", "map", "Playing Field", "Roleplay, exploration, shops"], ["battle-field", "sword", "Battle Field", "Tactical combat, hazards"]] as const).map(([t, icon, title, desc]) => (
                <button key={t} onClick={() => setNewType(t)}
                  className={`card p-3 text-left ${newType === t ? "border-[var(--color-accent)]" : ""}`}>
                  <Icon name={icon} size={18} className={newType === t ? "text-[var(--color-accent-soft)]" : "text-[var(--color-ink-faint)]"} />
                  <p className="mt-1.5 font-semibold">{title}</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
