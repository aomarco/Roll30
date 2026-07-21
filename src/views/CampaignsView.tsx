import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { useApp } from "../state";
import { Icon } from "../ui/icons";
import { RoleSwitch } from "../ui/RoleSwitch";
import { Badge, Modal, Field, PlaceholderTag, Skeleton } from "../ui/primitives";

const gradients: Record<string, string> = {
  "aurora-indigo": "linear-gradient(135deg,#4338ca,#6366f1 55%,#0ea5e9)",
  "aurora-teal": "linear-gradient(135deg,#0f766e,#14b8a6 55%,#22d3ee)",
  "aurora-rose": "linear-gradient(135deg,#9d174d,#e11d48 55%,#f59e0b)",
};

export function CampaignsView() {
  const { openCampaign, role } = useApp();
  const { data: campaigns, loading } = useAsync(() => api.campaigns(), []);
  const [showNew, setShowNew] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--color-accent)] text-white font-black">R</span>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Roll30</h1>
            <p className="text-sm text-[var(--color-ink-muted)]">Prepare, run, and play your campaigns.</p>
          </div>
        </div>
        <RoleSwitch />
      </header>

      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold">{role === "gm" ? "Your campaigns" : "Campaigns you're in"}</h2>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => setShowJoin(true)}>
            <Icon name="link" size={16} /> Join with code
          </button>
          {role === "gm" && (
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>
              <Icon name="plus" size={16} /> New campaign
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52" />)}

        {campaigns?.map((c) => (
          <button
            key={c.id}
            onClick={() => openCampaign(c.id)}
            className="card card-hover fadein overflow-hidden text-left"
          >
            <div className="h-24 w-full" style={{ background: gradients[c.coverColor] ?? gradients["aurora-indigo"] }} />
            <div className="space-y-3 p-4">
              <div>
                <h3 className="font-bold">{c.name}</h3>
                <p className="line-clamp-2 text-sm text-[var(--color-ink-muted)]">{c.tagline}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-faint)]">
                <Badge>{c.system}</Badge>
                <Badge><Icon name="history" size={11} /> {c.sessionCount} sessions</Badge>
                <Badge><Icon name="player" size={11} /> {c.playerIds.length} players</Badge>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-3">
                <span className="mono text-xs text-[var(--color-ink-faint)]">{c.code}</span>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-accent-soft)]">
                  Open <Icon name="chevron" size={14} />
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Modal
        open={showNew} onClose={() => setShowNew(false)} title="Create campaign"
        footer={<><button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button><button className="btn btn-primary" onClick={() => setShowNew(false)}>Create</button></>}
      >
        <div className="space-y-4">
          <div className="flex justify-end"><PlaceholderTag>Not yet saved</PlaceholderTag></div>
          <Field label="Campaign name"><input className="input" placeholder="The Hollow Crown" /></Field>
          <Field label="Tagline"><input className="input" placeholder="A kingdom rots from the throne outward." /></Field>
          <Field label="System"><input className="input" defaultValue="D&D 5e" /></Field>
        </div>
      </Modal>

      <Modal
        open={showJoin} onClose={() => setShowJoin(false)} title="Join a campaign"
        footer={<><button className="btn btn-ghost" onClick={() => setShowJoin(false)}>Cancel</button><button className="btn btn-primary" onClick={() => setShowJoin(false)}>Join</button></>}
      >
        <div className="space-y-4">
          <div className="flex justify-end"><PlaceholderTag /></div>
          <Field label="Campaign code" hint="Ask your Game Master for the join code."><input className="input mono" placeholder="HOLLOW-4471" /></Field>
        </div>
      </Modal>
    </div>
  );
}
