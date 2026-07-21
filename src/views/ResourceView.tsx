import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { useApp } from "../state";
import type { Enemy, Item, Media, NPC } from "../types";
import { Icon, type IconName } from "../ui/icons";
import { Avatar, Badge, SectionHeading, Skeleton, EmptyState, Modal, Field, PlaceholderTag } from "../ui/primitives";

type Kind = "npcs" | "enemies" | "items" | "media";

const meta: Record<Kind, { icon: IconName; title: string; subtitle: string; noun: string }> = {
  npcs: { icon: "npc", title: "NPCs", subtitle: "Non-player characters and shopkeepers.", noun: "NPC" },
  enemies: { icon: "enemy", title: "Enemies", subtitle: "Monsters and hostile creatures.", noun: "enemy" },
  items: { icon: "item", title: "Items", subtitle: "Equipment, treasure, and consumables.", noun: "item" },
  media: { icon: "media", title: "Media", subtitle: "Images, music, and sound effects.", noun: "media" },
};

const rarityTone: Record<string, "neutral" | "success" | "accent" | "warn"> = {
  common: "neutral", uncommon: "success", rare: "accent", "very-rare": "accent", legendary: "warn",
};

export function ResourceView({ kind }: { kind: Kind }) {
  const { campaignId } = useApp();
  const m = meta[kind];
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);

  const { data, loading } = useAsync<(NPC | Enemy | Item | Media)[]>(() => {
    if (kind === "npcs") return api.npcs(campaignId!);
    if (kind === "enemies") return api.enemies(campaignId!);
    if (kind === "items") return api.items(campaignId!);
    return api.media(campaignId!);
  }, [campaignId, kind]);

  const rows = (data ?? []).filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <SectionHeading icon={m.icon} title={m.title} subtitle={m.subtitle}
        action={<button className="btn btn-primary" onClick={() => setShowNew(true)}><Icon name="plus" size={16} /> New {m.noun}</button>} />

      <div className="mb-5 flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-canvas)] px-3">
        <Icon name="search" size={16} className="text-[var(--color-ink-faint)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${m.title.toLowerCase()}…`} className="w-full bg-transparent py-2.5 text-sm outline-none" />
      </div>

      {loading && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>}
      {!loading && rows.length === 0 && <EmptyState icon={m.icon} title={`No ${m.title.toLowerCase()} found`} hint={q ? "Try a different search." : `Create your first ${m.noun}.`} />}

      <div className={`grid gap-3 ${kind === "media" ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {kind === "npcs" && (rows as unknown as NPC[]).map((n) => (
          <div key={n.id} className="card card-hover p-4">
            <div className="flex items-center gap-3">
              <Avatar name={n.name} color={n.portraitColor} />
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{n.name}</p><p className="text-xs text-[var(--color-ink-muted)]">{n.role}</p></div>
              {n.isShop && <Badge tone="accent"><Icon name="shop" size={11} /> Shop</Badge>}
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-[var(--color-ink-muted)]">{n.notes}</p>
            <div className="mt-2"><Badge tone={n.disposition === "hostile" ? "danger" : n.disposition === "friendly" ? "success" : "neutral"}>{n.disposition}</Badge></div>
          </div>
        ))}

        {kind === "enemies" && (rows as unknown as Enemy[]).map((e) => (
          <div key={e.id} className="card card-hover p-4">
            <div className="flex items-center gap-3">
              <Avatar name={e.name} color={e.portraitColor} square />
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{e.name}</p><p className="text-xs text-[var(--color-ink-muted)]">{e.type} · CR {e.cr}</p></div>
            </div>
            <div className="mt-2 flex gap-1.5"><Badge><Icon name="heart" size={11} /> {e.hp}</Badge><Badge><Icon name="shield" size={11} /> {e.ac}</Badge><Badge><Icon name="sword" size={11} /> {e.attacks.length}</Badge></div>
            <p className="mt-2 line-clamp-2 text-sm text-[var(--color-ink-muted)]">{e.notes}</p>
          </div>
        ))}

        {kind === "items" && (rows as unknown as Item[]).map((it) => (
          <div key={it.id} className="card card-hover p-4">
            <div className="flex items-start justify-between"><p className="font-semibold">{it.name}</p><Badge tone={rarityTone[it.rarity]}>{it.rarity}</Badge></div>
            <p className="text-xs text-[var(--color-ink-muted)]">{it.category}</p>
            <p className="mt-2 line-clamp-2 text-sm text-[var(--color-ink-muted)]">{it.description}</p>
            <div className="mt-2 flex gap-1.5"><Badge><Icon name="coin" size={11} /> {it.value} gp</Badge><Badge>{it.weight} lb</Badge></div>
          </div>
        ))}

        {kind === "media" && (rows as unknown as Media[]).map((md) => (
          <div key={md.id} className="card card-hover overflow-hidden">
            <div className="grid h-20 place-items-center" style={{ background: `linear-gradient(135deg, ${md.color}55, ${md.color}11)` }}>
              <Icon name={md.kind === "music" ? "music" : md.kind === "sfx" ? "bolt" : "image"} size={26} className="text-white/80" />
            </div>
            <div className="p-3">
              <p className="truncate font-semibold">{md.name}</p>
              <div className="mt-1 flex items-center gap-1.5"><Badge>{md.kind}</Badge><Badge>{md.tag}</Badge>{md.durationSec != null && <span className="mono text-xs text-[var(--color-ink-faint)]">{Math.floor(md.durationSec / 60)}:{String(md.durationSec % 60).padStart(2, "0")}</span>}</div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title={`New ${m.noun}`}
        footer={<><button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button><button className="btn btn-primary" onClick={() => setShowNew(false)}>Create</button></>}>
        <div className="space-y-4">
          <div className="flex justify-end"><PlaceholderTag /></div>
          <Field label="Name"><input className="input" placeholder={`${m.noun} name`} /></Field>
          <Field label="Notes"><textarea className="input" rows={3} placeholder="Description…" /></Field>
        </div>
      </Modal>
    </div>
  );
}
