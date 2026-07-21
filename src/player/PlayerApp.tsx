import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { useApp } from "../state";
import type { Character } from "../types";
import { Icon } from "../ui/icons";
import { RoleSwitch } from "../ui/RoleSwitch";
import { Avatar, Badge, Meter } from "../ui/primitives";
import { PlayerSheet } from "./PlayerSheet";
import { PlayerShop } from "./PlayerShop";

/**
 * The player's world. It shows ONLY what matters right now: the current
 * scene, their character, and the actions currently available — never GM
 * controls. Which surface appears depends on the active scene type.
 */
export function PlayerApp() {
  const { campaignId, leaveCampaign, seatCharacterId, setSeatCharacterId } = useApp();
  const { data: campaign } = useAsync(() => api.campaign(campaignId!), [campaignId]);
  const { data: chars } = useAsync(() => api.characters(campaignId!), [campaignId]);
  const { data: scene } = useAsync(
    () => (campaign?.activeSceneId ? api.scene(campaign.activeSceneId) : Promise.resolve(null)),
    [campaign?.activeSceneId]
  );
  const me = chars?.find((c) => c.id === seatCharacterId) ?? chars?.[0] ?? null;

  const [overlay, setOverlay] = useState<"none" | "sheet" | "shop">("none");

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      {/* Top bar — minimal */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-canvas)]/90 px-4 py-3 backdrop-blur">
        <button className="btn btn-ghost btn-icon" onClick={leaveCampaign} aria-label="Leave"><Icon name="back" size={17} /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{campaign?.name}</p>
          <p className="truncate text-xs text-[var(--color-ink-muted)]">{scene?.name ?? "Waiting for the GM…"}</p>
        </div>
        <RoleSwitch compact />
      </header>

      {/* Seat selector (demo aid — normally you are just one character) */}
      {chars && chars.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto border-b border-[var(--color-line)] px-4 py-2">
          {chars.map((c) => (
            <button key={c.id} onClick={() => setSeatCharacterId(c.id)}
              className={`btn btn-sm shrink-0 ${me?.id === c.id ? "btn-primary" : "btn-ghost"}`}>
              <span className="h-2 w-2 rounded-full" style={{ background: c.portraitColor }} /> {c.name.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      <main className="flex-1 p-4">
        {!scene && <WaitingCard />}
        {scene?.type === "playing-field" && <PlayerPlayingField sceneName={scene.name} summary={scene.summary} onShop={() => setOverlay("shop")} />}
        {scene?.type === "battle-field" && <PlayerBattle me={me} />}
      </main>

      {/* Persistent bottom action bar — the player's own character */}
      {me && (
        <footer className="sticky bottom-0 border-t border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
          <div className="flex items-center gap-3">
            <Avatar name={me.name} color={me.portraitColor} size={44} square />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{me.name}</p>
              <Meter value={me.hp.current} max={me.hp.max} tone="var(--color-success)" />
            </div>
            <button className="btn btn-primary" onClick={() => setOverlay("sheet")}><Icon name="characters" size={15} /> Sheet</button>
          </div>
        </footer>
      )}

      {overlay === "sheet" && me && <PlayerSheet character={me} onClose={() => setOverlay("none")} />}
      {overlay === "shop" && <PlayerShop onClose={() => setOverlay("none")} />}
    </div>
  );
}

function WaitingCard() {
  return (
    <div className="card grid place-items-center gap-3 px-6 py-16 text-center">
      <span className="grid h-14 w-14 animate-pulse place-items-center rounded-2xl surface-2 text-[var(--color-ink-faint)]"><Icon name="play" size={26} /></span>
      <p className="font-semibold">Waiting for the Game Master</p>
      <p className="max-w-xs text-sm text-[var(--color-ink-muted)]">Your screen will update the moment a scene begins.</p>
    </div>
  );
}

function PlayerPlayingField({ sceneName, summary, onShop }: { sceneName: string; summary: string; onShop: () => void }) {
  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="grid h-40 place-items-center" style={{ background: "radial-gradient(120% 90% at 50% 10%, #2a2013, #0d1017)" }}>
          <Badge><Icon name="map" size={11} /> Playing Field</Badge>
        </div>
        <div className="p-4">
          <h2 className="font-bold">{sceneName}</h2>
          <p className="text-sm text-[var(--color-ink-muted)]">{summary}</p>
        </div>
      </div>

      {/* Only the actions that matter right now */}
      <section>
        <p className="label mb-2">Available now</p>
        <div className="space-y-2">
          <button onClick={onShop} className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-line)] surface-2 px-4 py-3 text-left hover:border-[var(--color-line-strong)]">
            <Icon name="shop" size={18} className="text-[var(--color-accent-soft)]" />
            <span className="flex-1"><span className="block font-semibold">Visit the shop</span><span className="block text-xs text-[var(--color-ink-muted)]">Old Hettie has supplies for sale.</span></span>
            <Icon name="chevron" size={16} className="text-[var(--color-ink-faint)]" />
          </button>
          <button className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-line)] surface-2 px-4 py-3 text-left hover:border-[var(--color-line-strong)]">
            <Icon name="target" size={18} className="text-[var(--color-accent-soft)]" />
            <span className="flex-1"><span className="block font-semibold">Inspect the notice board</span><span className="block text-xs text-[var(--color-ink-muted)]">The GM offered this action.</span></span>
            <Icon name="chevron" size={16} className="text-[var(--color-ink-faint)]" />
          </button>
          <button className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-line)] surface-2 px-4 py-3 text-left hover:border-[var(--color-line-strong)]">
            <Icon name="dice" size={18} className="text-[var(--color-accent-soft)]" />
            <span className="flex-1"><span className="block font-semibold">Roll a check</span><span className="block text-xs text-[var(--color-ink-muted)]">Persuasion, Insight, Perception…</span></span>
            <Icon name="chevron" size={16} className="text-[var(--color-ink-faint)]" />
          </button>
        </div>
      </section>
    </div>
  );
}

function PlayerBattle({ me }: { me: Character | null }) {
  const yourTurn = true;
  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="tabletop-grid grid h-44 place-items-center" style={{ background: "radial-gradient(120% 100% at 50% 0%, #182031, #0b0e14)", backgroundSize: "8% 12%" }}>
          <Badge tone="danger"><Icon name="sword" size={11} /> Battle Field</Badge>
        </div>
      </div>

      <div className={`card p-4 ${yourTurn ? "border-[var(--color-accent)]" : ""}`}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-bold">{yourTurn ? "Your turn" : "Waiting…"}</p>
          {yourTurn && <Badge tone="accent"><Icon name="play" size={11} /> Act now</Badge>}
        </div>
        <div className="mb-3 grid grid-cols-3 gap-2">
          <button className="btn btn-subtle flex-col gap-1 py-3"><Icon name="map" size={18} /> Move</button>
          <button className="btn btn-subtle flex-col gap-1 py-3"><Icon name="target" size={18} /> Target</button>
          <button className="btn btn-subtle flex-col gap-1 py-3"><Icon name="flag" size={18} /> End turn</button>
        </div>
        <p className="label mb-2">Your actions</p>
        <div className="space-y-1.5">
          {(me?.attacks ?? []).map((a) => (
            <button key={a.id} className="flex w-full items-center gap-3 rounded-lg surface-2 px-3 py-2 text-left hover:border-[var(--color-line-strong)]">
              <Icon name="sword" size={16} className="text-[var(--color-accent-soft)]" />
              <span className="flex-1"><span className="block text-sm font-semibold">{a.name}</span><span className="mono block text-xs text-[var(--color-ink-faint)]">+{a.bonus} · {a.damage} · {a.range}</span></span>
              <Icon name="chevron" size={14} className="text-[var(--color-ink-faint)]" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
