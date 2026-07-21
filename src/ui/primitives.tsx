// Shared presentational primitives used across every view.

import { type ReactNode, useEffect } from "react";
import { Icon, type IconName } from "./icons";

export function Avatar({
  name, color, size = 40, square = false,
}: { name: string; color: string; size?: number; square?: boolean }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{
        width: size, height: size, background: `${color}22`,
        color, borderColor: `${color}55`,
        borderRadius: square ? 12 : 999, fontSize: size * 0.36,
      }}
      className="inline-flex shrink-0 items-center justify-center border font-bold"
    >
      {initials}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "success" | "danger" | "warn" }) {
  const tones: Record<string, string> = {
    neutral: "", accent: "text-[var(--color-accent-soft)]",
    success: "text-[var(--color-success)]", danger: "text-[var(--color-danger)]",
    warn: "text-[var(--color-warn)]",
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

export function SectionHeading({
  icon, title, subtitle, action,
}: { icon?: IconName; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <span className="grid h-10 w-10 place-items-center rounded-xl surface-2 text-[var(--color-accent-soft)]">
            <Icon name={icon} size={20} />
          </span>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-[var(--color-ink-muted)]">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon, title, hint, action,
}: { icon: IconName; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card grid place-items-center gap-3 px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl surface-2 text-[var(--color-ink-faint)]">
        <Icon name={icon} size={26} />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-ink-muted)]">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="label block">{label}</span>
      {children}
      {hint && <span className="block text-xs text-[var(--color-ink-faint)]">{hint}</span>}
    </label>
  );
}

export function Modal({
  open, onClose, title, children, footer, width = 520,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="card fadein relative w-full overflow-hidden" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3.5">
          <h2 className="font-semibold">{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close dialog">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-[var(--color-line)] px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

/** A labelled bar for HP / resources. */
export function Meter({ value, max, tone = "var(--color-success)", label }: { value: number; max: number; tone?: string; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs text-[var(--color-ink-muted)]">
          <span>{label}</span><span className="mono">{value}/{max}</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: tone }} />
      </div>
    </div>
  );
}

/** "This is a placeholder" affordance so mockups are honest about being empty. */
export function PlaceholderTag({ children = "Placeholder" }: { children?: ReactNode }) {
  return (
    <span className="badge" style={{ borderStyle: "dashed" }} title="Mockup — not yet wired to real data">
      <Icon name="sparkles" size={11} /> {children}
    </span>
  );
}

export { Icon };
