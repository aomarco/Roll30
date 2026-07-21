import type { AbilityScores, Character } from "../types";
import { Icon } from "../ui/icons";
import { Avatar, Badge, Meter, Modal } from "../ui/primitives";

const mod = (s: number) => Math.floor((s - 10) / 2);
const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const ABILITIES: (keyof AbilityScores)[] = ["str", "dex", "con", "int", "wis", "cha"];

/** The player's compact character sheet — everything they need, nothing they
 *  don't. Same data as the GM sheet, presented for quick in-play reference. */
export function PlayerSheet({ character: c, onClose }: { character: Character; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={c.name} width={560}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={c.name} color={c.portraitColor} size={56} square />
          <div className="flex-1">
            <p className="text-sm text-[var(--color-ink-muted)]">Lv {c.level} {c.ancestry} {c.className}</p>
            <div className="mt-1 flex gap-1.5">
              <Badge><Icon name="shield" size={11} /> AC {c.ac}</Badge>
              <Badge><Icon name="map" size={11} /> {c.speed} ft</Badge>
              <Badge>Prof {fmt(c.proficiencyBonus)}</Badge>
            </div>
          </div>
        </div>

        <Meter value={c.hp.current} max={c.hp.max} label={`Hit points${c.hp.temp ? ` (+${c.hp.temp} temp)` : ""}`} />

        <div className="grid grid-cols-6 gap-2">
          {ABILITIES.map((a) => (
            <div key={a} className="rounded-lg surface-2 py-2 text-center">
              <p className="label">{a}</p>
              <p className="text-lg font-black">{c.abilities[a]}</p>
              <p className="mono text-xs text-[var(--color-accent-soft)]">{fmt(mod(c.abilities[a]))}</p>
            </div>
          ))}
        </div>

        <Section title="Attacks" icon="sword">
          {c.attacks.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b border-[var(--color-line)] py-1.5 text-sm last:border-0">
              <span className="font-medium">{a.name}</span>
              <span className="mono text-[var(--color-ink-muted)]">{fmt(a.bonus)} · {a.damage}</span>
            </div>
          ))}
        </Section>

        {c.spells.length > 0 && (
          <Section title="Spells" icon="sparkles">
            <div className="mb-2 flex flex-wrap gap-1.5">{c.spellSlots.map((s) => <Badge key={s.level} tone="accent">Lv {s.level}: {s.current}/{s.max}</Badge>)}</div>
            <div className="flex flex-wrap gap-1.5">{c.spells.map((s) => <Badge key={s.id}>{s.name}</Badge>)}</div>
          </Section>
        )}

        <Section title="Inventory & coin" icon="item">
          <div className="mb-2 flex flex-wrap gap-1.5">{Object.entries(c.currency).map(([k, v]) => <Badge key={k}>{v} {k}</Badge>)}</div>
          <div className="flex flex-wrap gap-1.5">{c.inventory.map((i) => <Badge key={i.id}>{i.name}{i.qty > 1 ? ` ×${i.qty}` : ""}</Badge>)}</div>
        </Section>

        {c.conditions.length > 0 && (
          <Section title="Conditions" icon="warning">
            <div className="flex flex-wrap gap-1.5">{c.conditions.map((cd) => <Badge key={cd} tone="warn">{cd}</Badge>)}</div>
          </Section>
        )}
      </div>
    </Modal>
  );
}

function Section({ title, icon, children }: { title: string; icon: Parameters<typeof Icon>[0]["name"]; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-line)] p-3">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Icon name={icon} size={14} className="text-[var(--color-ink-faint)]" /> {title}</h3>
      {children}
    </section>
  );
}
