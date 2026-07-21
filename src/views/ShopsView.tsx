import { api } from "../api";
import { useAsync } from "../hooks";
import { useApp } from "../state";
import type { ShopMode } from "../types";
import { Icon } from "../ui/icons";
import { Badge, SectionHeading, Skeleton, EmptyState } from "../ui/primitives";

const modeLabel: Record<ShopMode, string> = { automatic: "Automatic", approval: "Approval", manual: "Manual" };
const modeTone: Record<ShopMode, "success" | "warn" | "neutral"> = { automatic: "success", approval: "warn", manual: "neutral" };

export function ShopsView() {
  const { campaignId } = useApp();
  const { data: shops, loading } = useAsync(() => api.shops(campaignId!), [campaignId]);

  return (
    <div>
      <SectionHeading icon="shop" title="Shops" subtitle="Storefronts players can browse in Playing Fields."
        action={<button className="btn btn-primary"><Icon name="plus" size={16} /> New shop</button>} />

      {loading && <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>}
      {!loading && shops?.length === 0 && <EmptyState icon="shop" title="No shops yet" hint="Mark an NPC or object as a shop to sell items to players." />}

      <div className="space-y-5">
        {shops?.map((s) => (
          <section key={s.id} className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] p-4">
              <div>
                <h2 className="font-bold">{s.name}</h2>
                <p className="text-sm text-[var(--color-ink-muted)]">Keeper: {s.keeper}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={modeTone[s.mode]}>{modeLabel[s.mode]} checkout</Badge>
                {s.allowSelling ? <Badge tone="success">Buys from players</Badge> : <Badge>No selling</Badge>}
                {s.requiresCheck && <Badge tone="warn"><Icon name="dice" size={11} /> {s.requiresCheck}</Badge>}
              </div>
            </div>

            <div className="divide-y divide-[var(--color-line)]">
              {s.items.map((it) => (
                <div key={it.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg surface-2 text-[var(--color-ink-faint)]"><Icon name="item" size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium">
                      {it.name}
                      {it.hidden && <Badge tone="warn"><Icon name="eye-off" size={10} /> Hidden</Badge>}
                      {it.requirement && <Badge tone={it.meetsRequirement ? "success" : "danger"}>{it.requirement}</Badge>}
                    </p>
                    <p className="mono text-xs text-[var(--color-ink-faint)]">{it.stock == null ? "Unlimited stock" : `${it.stock} in stock`}</p>
                  </div>
                  <span className="mono font-semibold text-[var(--color-warn)]">{it.price} gp</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-[var(--color-line)] p-3">
              <button className="btn btn-subtle btn-sm"><Icon name="plus" size={13} /> Add item</button>
              <button className="btn btn-ghost btn-sm"><Icon name="coin" size={13} /> Discounts</button>
              <button className="btn btn-ghost btn-sm"><Icon name="player" size={13} /> Per-player stock</button>
              <button className="btn btn-ghost btn-sm"><Icon name="gear" size={13} /> Checkout mode</button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
