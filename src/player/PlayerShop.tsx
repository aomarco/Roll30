import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { Icon } from "../ui/icons";
import { Badge, Modal, Skeleton } from "../ui/primitives";

/** The simplified storefront a player sees. Shows only items available to
 *  them, honours hidden/requirement flags, and reflects the shop's checkout
 *  mode (automatic / approval / manual). */
export function PlayerShop({ onClose }: { onClose: () => void }) {
  const { data: shop, loading } = useAsync(() => api.shop("shop_1"), []);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);

  const purse = 85; // player's gold — from their sheet in a real build
  const total = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = shop?.items.find((i) => i.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const add = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const remove = (id: string) => setCart((c) => {
    const n = (c[id] ?? 0) - 1;
    const next = { ...c }; if (n <= 0) delete next[id]; else next[id] = n; return next;
  });

  const visibleItems = (shop?.items ?? []).filter((i) => !i.hidden);

  return (
    <Modal open onClose={onClose} title={shop?.name ?? "Shop"} width={560}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-sm text-[var(--color-ink-muted)]">Purse: <span className="mono text-[var(--color-warn)]">{purse - total} gp</span></span>
          <div className="flex items-center gap-2">
            <span className="mono text-sm">Total: {total} gp</span>
            <button className="btn btn-primary" disabled={total === 0 || total > purse} onClick={() => setDone(true)}>
              <Icon name="coin" size={15} /> {shop?.mode === "approval" ? "Request purchase" : "Buy"}
            </button>
          </div>
        </div>
      }>
      {loading && <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>}

      {done ? (
        <div className="grid place-items-center gap-2 py-10 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-success)]/15 text-[var(--color-success)]"><Icon name="check" size={26} /></span>
          <p className="font-semibold">{shop?.mode === "approval" ? "Request sent to the GM" : "Purchase complete"}</p>
          <p className="text-sm text-[var(--color-ink-muted)]">{shop?.mode === "approval" ? "The GM will approve or decline your order." : "Items added to your inventory."}</p>
          <button className="btn btn-subtle mt-2" onClick={onClose}>Close</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge>Keeper: {shop?.keeper}</Badge>
            {shop && <Badge tone={shop.mode === "automatic" ? "success" : "warn"}>{shop.mode} checkout</Badge>}
            {shop?.requiresCheck && <Badge tone="warn"><Icon name="dice" size={11} /> {shop.requiresCheck}</Badge>}
          </div>

          <div className="space-y-2">
            {visibleItems.map((it) => {
              const qty = cart[it.id] ?? 0;
              const affordable = it.meetsRequirement;
              return (
                <div key={it.id} className="flex items-center gap-3 rounded-xl border border-[var(--color-line)] surface-2 p-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--color-surface-3)] text-[var(--color-ink-faint)]"><Icon name="item" size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium">{it.name}{it.requirement && <Badge tone={affordable ? "success" : "danger"}>{it.requirement}</Badge>}</p>
                    <p className="mono text-xs text-[var(--color-warn)]">{it.price} gp{it.stock != null && ` · ${it.stock} left`}</p>
                  </div>
                  {qty > 0 ? (
                    <div className="flex items-center gap-2">
                      <button className="btn btn-ghost btn-icon" onClick={() => remove(it.id)} aria-label="Remove one"><Icon name="close" size={14} /></button>
                      <span className="mono w-5 text-center">{qty}</span>
                      <button className="btn btn-subtle btn-icon" onClick={() => add(it.id)} disabled={!affordable} aria-label="Add one"><Icon name="plus" size={14} /></button>
                    </div>
                  ) : (
                    <button className="btn btn-subtle btn-sm" onClick={() => add(it.id)} disabled={!affordable}><Icon name="plus" size={13} /> Add</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
