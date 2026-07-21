import { useState } from "react";
import type { BattleField, Token } from "../types";
import { useApp } from "../state";
import { Icon, type IconName } from "../ui/icons";
import { Badge, Meter, PlaceholderTag } from "../ui/primitives";

export function BattleFieldScene({ scene }: { scene: BattleField }) {
  const { mode } = useApp();
  const [selectedTok, setSelectedTok] = useState<string | null>(scene.tokens[0]?.id ?? null);
  const active = scene.tokens.find((t) => t.id === selectedTok) ?? null;
  const build = mode === "build";

  return (
    <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
      {/* Map */}
      <div className="min-w-0 p-4">
        <TacticalMap scene={scene} selected={selectedTok} onSelect={setSelectedTok} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="accent"><Icon name="flag" size={11} /> Round {scene.round}</Badge>
          <Badge>{scene.grid.cols}×{scene.grid.rows} grid</Badge>
          <Badge tone={scene.visionEnabled ? "success" : "neutral"}>
            <Icon name={scene.visionEnabled ? "eye" : "eye-off"} size={11} /> Vision {scene.visionEnabled ? "on" : "off"}
          </Badge>
          <div className="ml-auto"><PlaceholderTag>Static mockup map</PlaceholderTag></div>
        </div>
      </div>

      {/* Right rail */}
      <aside className="border-l border-[var(--color-line)] p-4">
        <InitiativeTracker scene={scene} selected={selectedTok} onSelect={setSelectedTok} />
        <hr className="divider my-4" />
        {build ? <InteractivesPanel scene={scene} /> : <ActionPanel token={active} />}
      </aside>
    </div>
  );
}

function TacticalMap({ scene, selected, onSelect }: { scene: BattleField; selected: string | null; onSelect: (id: string) => void }) {
  const { cols, rows } = scene.grid;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-line)]"
      style={{ background: "radial-gradient(120% 100% at 50% 0%, #182031, #0b0e14)", aspectRatio: `${cols}/${rows}` }}>
      <div className="tabletop-grid absolute inset-0 opacity-40"
        style={{ backgroundSize: `${100 / cols}% ${100 / rows}%` }} />

      {/* Interactive objects */}
      {scene.interactives.map((o) => (
        <button key={o.id} title={`${o.name} — ${o.state}`}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--color-line-strong)] bg-black/50 px-1.5 py-1 text-lg leading-none hover:border-[var(--color-accent)]"
          style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%` }} aria-label={o.name}>
          {o.icon}
        </button>
      ))}

      {/* Tokens on grid cells */}
      {scene.tokens.map((t) => (
        <button key={t.id} onClick={() => onSelect(t.id)}
          className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 font-bold transition ${selected === t.id ? "z-10 ring-2 ring-[var(--color-accent-soft)]" : ""} ${t.hidden ? "opacity-50" : ""}`}
          style={{
            left: `${((t.x + 0.5) / cols) * 100}%`, top: `${((t.y + 0.5) / rows) * 100}%`,
            width: `${(100 / cols) * 0.86}%`, aspectRatio: "1",
            background: `${t.color}44`, borderColor: t.color, color: "#fff",
          }}
          aria-label={`${t.name}${t.hidden ? " (hidden)" : ""}`}>
          <span style={{ fontSize: "0.7vw" }} className="drop-shadow">{t.name[0]}</span>
          {t.hidden && <span className="absolute -right-1 -top-1"><Icon name="eye-off" size={11} className="text-[var(--color-warn)]" /></span>}
        </button>
      ))}
    </div>
  );
}

function InitiativeTracker({ scene, selected, onSelect }: { scene: BattleField; selected: string | null; onSelect: (id: string) => void }) {
  const { mode } = useApp();
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Icon name="flag" size={15} className="text-[var(--color-ink-faint)]" /> Initiative</h3>
        {mode === "session" && <button className="btn btn-primary btn-sm"><Icon name="chevron" size={13} /> Next</button>}
      </div>
      {scene.initiative.length === 0 && <p className="text-sm text-[var(--color-ink-muted)]">Roll initiative to begin combat.</p>}
      <ol className="space-y-1.5">
        {scene.initiative.map((e) => {
          const tok = scene.tokens.find((t) => t.id === e.tokenId);
          return (
            <li key={e.id}>
              <button onClick={() => tok && onSelect(tok.id)}
                className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                  e.isActive ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10" : "border-[var(--color-line)] surface-2"
                } ${selected === tok?.id ? "ring-1 ring-[var(--color-accent-soft)]" : ""}`}>
                <span className="mono w-6 text-center text-sm font-bold" style={{ color: e.kind === "enemy" ? "var(--color-danger)" : "var(--color-accent-soft)" }}>{e.initiative}</span>
                <span className="flex-1 truncate text-sm font-medium">{e.name}</span>
                {tok?.hp && <span className="mono text-xs text-[var(--color-ink-faint)]">{tok.hp.current}/{tok.hp.max}</span>}
                {e.isActive && <Icon name="play" size={12} className="text-[var(--color-accent-soft)]" />}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Player-facing action panel — context-sensitive actions from the sheet. */
function ActionPanel({ token }: { token: Token | null }) {
  const acts: { icon: IconName; label: string; sub: string }[] = [
    { icon: "sword", label: "Rapier", sub: "+7 · 1d8+4 · 5 ft" },
    { icon: "target", label: "Shortbow", sub: "+7 · 1d6+4 · 80 ft" },
    { icon: "sparkles", label: "Sneak Attack", sub: "+3d6 when eligible" },
    { icon: "bolt", label: "Cunning Action", sub: "Dash / Disengage / Hide" },
  ];
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Icon name="target" size={15} className="text-[var(--color-ink-faint)]" /> Actions{token && <span className="text-[var(--color-ink-faint)]">· {token.name}</span>}</h3>
      {token?.hp && <div className="mb-3"><Meter value={token.hp.current} max={token.hp.max} label="Hit points" tone="var(--color-success)" /></div>}
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        <button className="btn btn-subtle btn-sm flex-col gap-1 py-2.5"><Icon name="map" size={15} /> Move</button>
        <button className="btn btn-subtle btn-sm flex-col gap-1 py-2.5"><Icon name="dice" size={15} /> Roll</button>
        <button className="btn btn-subtle btn-sm flex-col gap-1 py-2.5"><Icon name="flag" size={15} /> End</button>
      </div>
      <div className="space-y-1.5">
        {acts.map((a) => (
          <button key={a.label} className="flex w-full items-center gap-3 rounded-lg surface-2 px-3 py-2 text-left hover:border-[var(--color-line-strong)]">
            <Icon name={a.icon} size={16} className="text-[var(--color-accent-soft)]" />
            <span className="flex-1"><span className="block text-sm font-semibold">{a.label}</span><span className="mono block text-xs text-[var(--color-ink-faint)]">{a.sub}</span></span>
          </button>
        ))}
      </div>
      <button className="btn btn-ghost btn-sm mt-3 w-full"><Icon name="npc" size={13} /> Ask the GM…</button>
    </section>
  );
}

function InteractivesPanel({ scene }: { scene: BattleField }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Icon name="gear" size={15} className="text-[var(--color-ink-faint)]" /> Interactive objects</h3>
        <button className="btn btn-ghost btn-icon" aria-label="Add object"><Icon name="plus" size={14} /></button>
      </div>
      <div className="space-y-1.5">
        {scene.interactives.map((o) => (
          <div key={o.id} className="rounded-lg surface-2 px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="text-lg leading-none">{o.icon}</span>
              <span className="flex-1 text-sm font-medium">{o.name}</span>
              <Badge>{o.state}</Badge>
            </div>
            {(o.requires || o.note) && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{o.requires ? `Requires: ${o.requires}. ` : ""}{o.note}</p>}
          </div>
        ))}
      </div>

      <h3 className="mb-2 mt-5 flex items-center gap-2 text-sm font-bold"><Icon name="link" size={15} className="text-[var(--color-ink-faint)]" /> Triggers</h3>
      <div className="space-y-2">
        {scene.triggers.map((t) => (
          <div key={t.id} className="rounded-lg border border-[var(--color-line)] surface-2 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{t.name}</span>
              <Badge tone={t.enabled ? "success" : "neutral"}>{t.enabled ? "on" : "off"}</Badge>
            </div>
            <div className="mt-2 space-y-1 text-xs">
              <p className="flex items-center gap-1.5 text-[var(--color-ink-muted)]"><span className="badge">WHEN</span> {t.when}</p>
              {t.conditions.map((c, i) => <p key={i} className="flex items-center gap-1.5 text-[var(--color-ink-muted)]"><span className="badge">IF</span> {c}</p>)}
              {t.effects.map((e) => (
                <p key={e.id} className="flex items-center gap-1.5 text-[var(--color-ink-muted)]">
                  <span className="badge" style={{ color: "var(--color-accent-soft)" }}>THEN</span> {e.action}{e.delayRounds ? ` (after ${e.delayRounds} rounds)` : ""}
                </p>
              ))}
            </div>
          </div>
        ))}
        <button className="btn btn-ghost btn-sm w-full"><Icon name="plus" size={13} /> New trigger</button>
      </div>
    </section>
  );
}
