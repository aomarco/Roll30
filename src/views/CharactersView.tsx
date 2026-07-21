import { api } from "../api";
import { useAsync } from "../hooks";
import { useApp } from "../state";
import type { AbilityScores } from "../types";
import { Icon } from "../ui/icons";
import { Avatar, Badge, Meter, SectionHeading, Skeleton, EmptyState } from "../ui/primitives";

const mod = (score: number) => Math.floor((score - 10) / 2);
const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const ABILITIES: (keyof AbilityScores)[] = ["str", "dex", "con", "int", "wis", "cha"];

export function CharactersView() {
  const { campaignId, go } = useApp();
  const { data: chars, loading } = useAsync(() => api.characters(campaignId!), [campaignId]);

  return (
    <div>
      <SectionHeading icon="characters" title="Characters" subtitle="Player characters in this campaign."
        action={<button className="btn btn-primary"><Icon name="plus" size={16} /> New character</button>} />

      {loading && <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>}

      {chars && chars.length === 0 && <EmptyState icon="characters" title="No characters yet" hint="Create a character or invite players to join with the campaign code." />}

      <div className="grid gap-4 sm:grid-cols-2">
        {chars?.map((c) => (
          <button key={c.id} onClick={() => go({ name: "character", characterId: c.id })} className="card card-hover flex items-center gap-4 p-4 text-left">
            <Avatar name={c.name} color={c.portraitColor} size={52} square />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{c.name}</p>
              <p className="text-sm text-[var(--color-ink-muted)]">Lv {c.level} {c.ancestry} {c.className}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge><Icon name="heart" size={11} /> {c.hp.current}/{c.hp.max}</Badge>
                <Badge><Icon name="shield" size={11} /> AC {c.ac}</Badge>
                <Badge>{c.playerName}</Badge>
              </div>
            </div>
            <Icon name="chevron" size={18} className="text-[var(--color-ink-faint)]" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function CharacterSheetView({ characterId }: { characterId: string }) {
  const { go } = useApp();
  const { data: c, loading } = useAsync(() => api.character(characterId), [characterId]);

  if (loading || !c) return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;

  return (
    <div>
      <button className="btn btn-ghost btn-sm mb-4" onClick={() => go({ name: "characters" })}><Icon name="back" size={15} /> Characters</button>

      {/* Header */}
      <div className="card mb-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <Avatar name={c.name} color={c.portraitColor} size={72} square />
        <div className="flex-1">
          <h1 className="text-2xl font-black">{c.name}</h1>
          <p className="text-[var(--color-ink-muted)]">Level {c.level} {c.ancestry} {c.className} · played by {c.playerName}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[["AC", c.ac, "shield"], ["Speed", `${c.speed}ft`, "map"], ["Prof", fmt(c.proficiencyBonus), "sparkles"]].map(([label, val]) => (
            <div key={label as string} className="rounded-xl surface-2 px-4 py-2">
              <p className="text-lg font-black">{val}</p><p className="label">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4"><Meter value={c.hp.current} max={c.hp.max} label={`Hit points${c.hp.temp ? ` (+${c.hp.temp} temp)` : ""}`} /></div>

      {/* Abilities */}
      <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {ABILITIES.map((a) => (
          <div key={a} className="card p-3 text-center">
            <p className="label">{a}</p>
            <p className="text-2xl font-black">{c.abilities[a]}</p>
            <p className="mono text-sm text-[var(--color-accent-soft)]">{fmt(mod(c.abilities[a]))}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Attacks" icon="sword">
          {c.attacks.map((a) => (
            <Row key={a.id} left={a.name} right={<span className="mono text-sm">{fmt(a.bonus)} · {a.damage}</span>} sub={a.range} />
          ))}
        </Panel>

        <Panel title="Skills" icon="target">
          <div className="grid grid-cols-2 gap-x-4">
            {c.skills.map((s) => (
              <div key={s.name} className="flex items-center justify-between border-b border-[var(--color-line)] py-1.5 text-sm">
                <span className={s.proficient ? "font-medium" : "text-[var(--color-ink-muted)]"}>{s.proficient ? "● " : "○ "}{s.name}</span>
                <span className="mono text-[var(--color-accent-soft)]">{fmt(mod(c.abilities[s.ability]) + (s.proficient ? c.proficiencyBonus : 0))}</span>
              </div>
            ))}
          </div>
        </Panel>

        {c.spells.length > 0 && (
          <Panel title="Spells" icon="sparkles">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {c.spellSlots.map((s) => <Badge key={s.level} tone="accent">Lv {s.level}: {s.current}/{s.max}</Badge>)}
            </div>
            {c.spells.map((s) => <Row key={s.id} left={s.name} right={<Badge>{s.level ? `Lv ${s.level}` : "Cantrip"}</Badge>} sub={s.school} />)}
          </Panel>
        )}

        <Panel title="Features & traits" icon="wand">
          {c.features.map((f) => (
            <div key={f.id} className="border-b border-[var(--color-line)] py-2 last:border-0">
              <p className="text-sm font-semibold">{f.name} <span className="font-normal text-[var(--color-ink-faint)]">· {f.source}</span></p>
              <p className="text-sm text-[var(--color-ink-muted)]">{f.description}</p>
            </div>
          ))}
        </Panel>

        <Panel title="Inventory" icon="item">
          {c.inventory.map((i) => <Row key={i.id} left={`${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`} right={i.equipped ? <Badge tone="success">Equipped</Badge> : null} />)}
        </Panel>

        <Panel title="Currency & conditions" icon="coin">
          <div className="mb-3 flex flex-wrap gap-2">
            {Object.entries(c.currency).map(([k, v]) => <Badge key={k}>{v} {k}</Badge>)}
          </div>
          <p className="label mb-1">Conditions</p>
          {c.conditions.length ? <div className="flex flex-wrap gap-1.5">{c.conditions.map((cd) => <Badge key={cd} tone="warn">{cd}</Badge>)}</div> : <p className="text-sm text-[var(--color-ink-muted)]">None.</p>}
        </Panel>

        <Panel title="Personality" icon="note">
          {Object.entries(c.traits).map(([k, v]) => (
            <div key={k} className="border-b border-[var(--color-line)] py-1.5 last:border-0">
              <p className="label">{k}</p><p className="text-sm text-[var(--color-ink-muted)]">{v}</p>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: Parameters<typeof Icon>[0]["name"]; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="mb-2 flex items-center gap-2 font-bold"><Icon name={icon} size={16} className="text-[var(--color-ink-faint)]" /> {title}</h2>
      {children}
    </section>
  );
}

function Row({ left, right, sub }: { left: React.ReactNode; right?: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-line)] py-2 last:border-0">
      <div><p className="text-sm font-medium">{left}</p>{sub && <p className="mono text-xs text-[var(--color-ink-faint)]">{sub}</p>}</div>
      {right}
    </div>
  );
}
