import { useState } from "react";
import type { PlayingField } from "../types";
import { useApp } from "../state";
import { Icon, type IconName } from "../ui/icons";
import { Badge, PlaceholderTag } from "../ui/primitives";

const timeIcon: Record<string, IconName> = { dawn: "sun", day: "sun", dusk: "moon", night: "moon" };

export function PlayingFieldScene({ scene }: { scene: PlayingField }) {
  const { mode } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const build = mode === "build";

  return (
    <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
      {/* Stage */}
      <div className="relative">
        <div
          className="relative m-4 aspect-[16/10] overflow-hidden rounded-2xl border border-[var(--color-line)]"
          style={{ background: "radial-gradient(120% 90% at 50% 10%, #1c2331, #0d1017)" }}
          role="group" aria-label="Scene stage"
        >
          {/* ambience wash */}
          <div className="pointer-events-none absolute inset-0"
            style={{ background: scene.ambience.timeOfDay === "night" ? "linear-gradient(#0b1030aa,#05070f)" : "linear-gradient(#f59e0b0f,transparent)" }} />

          {/* Tokens positioned relatively (0..1) */}
          {scene.tokens.map((t) => (
            <button key={t.id} onClick={() => setSelected(t.id)}
              className={`group absolute -translate-x-1/2 -translate-y-1/2 transition ${selected === t.id ? "z-10 scale-110" : ""}`}
              style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%` }}
              aria-label={t.name}>
              <span className="grid h-12 w-12 place-items-center rounded-full border-2 font-bold shadow-lg"
                style={{ background: `${t.color}33`, borderColor: t.color, color: "#fff" }}>
                {t.name[0]}
              </span>
              <span className="mt-1 block rounded bg-black/60 px-1.5 py-0.5 text-center text-[10px] font-medium">{t.name}</span>
              {t.hidden && <span className="absolute -right-1 -top-1"><Icon name="eye-off" size={13} className="text-[var(--color-warn)]" /></span>}
            </button>
          ))}

          {/* Empty-stage hint */}
          {scene.tokens.length === 0 && (
            <div className="absolute inset-0 grid place-items-center text-sm text-[var(--color-ink-faint)]">
              Add characters and NPCs to the stage.
            </div>
          )}

          {/* Ambience bar */}
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 bg-black/40 px-3 py-2 backdrop-blur">
            <Badge><Icon name={timeIcon[scene.ambience.timeOfDay]} size={11} /> {scene.ambience.timeOfDay}</Badge>
            <Badge>☁ {scene.ambience.weather}</Badge>
            <button className="badge hover:text-[var(--color-ink)]"><Icon name="music" size={11} /> {scene.ambience.music ? "Tavern Warmth" : "No music"}</button>
            <div className="ml-auto"><PlaceholderTag>Static mockup stage</PlaceholderTag></div>
          </div>
        </div>
      </div>

      {/* Right rail: GM controls (build) or run controls (session) */}
      <aside className="border-l border-[var(--color-line)] p-4">
        {build ? <BuildRail scene={scene} /> : <SessionRail scene={scene} />}
      </aside>
    </div>
  );
}

function RailSection({ icon, title, children, action }: { icon: IconName; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Icon name={icon} size={15} className="text-[var(--color-ink-faint)]" /> {title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function BuildRail({ scene }: { scene: PlayingField }) {
  return (
    <div>
      <p className="label mb-3">Build Mode — prepare this scene</p>

      <RailSection icon="characters" title="Cast on stage" action={<button className="btn btn-ghost btn-icon" aria-label="Add token"><Icon name="plus" size={14} /></button>}>
        <div className="space-y-1.5">
          {scene.tokens.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg surface-2 px-2.5 py-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
              <span className="flex-1 text-sm">{t.name}</span>
              <button className="btn btn-ghost btn-icon" aria-label="Toggle hidden"><Icon name={t.hidden ? "eye-off" : "eye"} size={13} /></button>
            </div>
          ))}
        </div>
      </RailSection>

      <RailSection icon="shop" title="Shops in scene">
        {scene.shopIds.length ? scene.shopIds.map((id) => (
          <div key={id} className="flex items-center gap-2 rounded-lg surface-2 px-2.5 py-2 text-sm"><Icon name="shop" size={14} /> Gilded Tankard — Supplies</div>
        )) : <p className="text-sm text-[var(--color-ink-muted)]">No shop attached.</p>}
      </RailSection>

      <RailSection icon="target" title="Prompts" action={<button className="btn btn-ghost btn-icon" aria-label="Add prompt"><Icon name="plus" size={14} /></button>}>
        <div className="space-y-1.5">
          {scene.prompts.map((p) => (
            <div key={p.id} className="rounded-lg surface-2 px-2.5 py-2 text-sm">{p.label}</div>
          ))}
          {!scene.prompts.length && <p className="text-sm text-[var(--color-ink-muted)]">No prompts yet.</p>}
        </div>
      </RailSection>

      <RailSection icon="gear" title="Ambience">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <button className="btn btn-subtle btn-sm justify-start"><Icon name="sun" size={13} /> Time</button>
          <button className="btn btn-subtle btn-sm justify-start">☁ Weather</button>
          <button className="btn btn-subtle btn-sm justify-start"><Icon name="music" size={13} /> Music</button>
          <button className="btn btn-subtle btn-sm justify-start"><Icon name="image" size={13} /> Backdrop</button>
        </div>
      </RailSection>
    </div>
  );
}

function SessionRail({ scene }: { scene: PlayingField }) {
  return (
    <div>
      <p className="label mb-3">Session Mode — run the scene</p>

      <RailSection icon="player" title="Move a character">
        <p className="mb-2 text-xs text-[var(--color-ink-muted)]">Movement is GM-controlled in Playing Fields.</p>
        <div className="grid grid-cols-3 gap-1.5">
          {scene.tokens.map((t) => (
            <button key={t.id} className="btn btn-subtle btn-sm truncate">{t.name}</button>
          ))}
        </div>
      </RailSection>

      <RailSection icon="target" title="Reveal a prompt">
        {scene.prompts.map((p) => (
          <button key={p.id} className="mb-1.5 flex w-full items-center justify-between rounded-lg surface-2 px-2.5 py-2 text-left text-sm hover:border-[var(--color-line-strong)]">
            {p.label} <Icon name="eye" size={14} className="text-[var(--color-ink-faint)]" />
          </button>
        ))}
      </RailSection>

      <RailSection icon="music" title="Ambience">
        <button className="btn btn-primary btn-sm w-full"><Icon name="play" size={13} /> Play “Tavern Warmth”</button>
      </RailSection>

      <RailSection icon="shop" title="Open shop for players">
        <button className="btn btn-subtle btn-sm w-full"><Icon name="shop" size={13} /> Gilded Tankard — Supplies</button>
      </RailSection>
    </div>
  );
}
