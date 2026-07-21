import type { Scene } from "../types";
import { Icon, type IconName } from "../ui/icons";
import { PlaceholderTag } from "../ui/primitives";

/** The GM's override / "play god" toolbox. Available in any scene. */
export function GMToolsPanel({ scene, onClose }: { scene: Scene | null; onClose: () => void }) {
  const godTools: { icon: IconName; label: string; desc: string }[] = [
    { icon: "player", label: "Move any token", desc: "Reposition any character or creature." },
    { icon: "heart", label: "Set HP / conditions", desc: "Adjust health, add or clear conditions." },
    { icon: "sparkles", label: "Force / cancel effect", desc: "Apply or remove any effect instantly." },
    { icon: "flag", label: "Edit initiative", desc: "Add, remove, or reorder combatants." },
    { icon: "undo", label: "Undo last action", desc: "Revert the most recent change." },
    { icon: "history", label: "Rewind battle", desc: "Restore an earlier round state." },
    { icon: "gear", label: "Ignore a rule", desc: "Override automation for one action." },
    { icon: "dice", label: "Declare outcome", desc: "Set a custom result directly." },
    { icon: "gm", label: "Control a PC", desc: "Temporarily take over a player character." },
    { icon: "eye", label: "Reveal / conceal", desc: "Show or hide any part of the map." },
  ];

  return (
    <aside className="w-80 shrink-0 border-l border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
        <h2 className="flex items-center gap-2 font-bold"><Icon name="gm" size={17} className="text-[var(--color-accent-soft)]" /> GM Tools</h2>
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close GM tools"><Icon name="close" size={16} /></button>
      </div>

      <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-3">
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="label">Override authority</p>
          <PlaceholderTag />
        </div>
        <p className="mb-3 px-1 text-xs leading-relaxed text-[var(--color-ink-muted)]">
          Automation exists to make play faster — never to overrule you. The GM always has final say.
        </p>

        <div className="space-y-1.5">
          {godTools.map((t) => (
            <button key={t.label} className="flex w-full items-start gap-3 rounded-lg surface-2 px-3 py-2.5 text-left hover:border-[var(--color-line-strong)]">
              <Icon name={t.icon} size={16} className="mt-0.5 text-[var(--color-accent-soft)]" />
              <span><span className="block text-sm font-semibold">{t.label}</span><span className="block text-xs text-[var(--color-ink-faint)]">{t.desc}</span></span>
            </button>
          ))}
        </div>

        <hr className="divider my-4" />
        <p className="mb-2 px-1 label">Secret information</p>
        <div className="space-y-1.5">
          <button className="btn btn-subtle btn-sm w-full justify-start"><Icon name="dice" size={13} /> Roll in secret</button>
          <button className="btn btn-subtle btn-sm w-full justify-start"><Icon name="note" size={13} /> Whisper a player</button>
          <button className="btn btn-subtle btn-sm w-full justify-start"><Icon name="sparkles" size={13} /> Reveal discovery</button>
        </div>

        <hr className="divider my-4" />
        <p className="mb-2 px-1 label">Scene</p>
        <div className="space-y-1.5">
          <button className="btn btn-subtle btn-sm w-full justify-start"><Icon name="template" size={13} /> Save as template</button>
          <button className="btn btn-subtle btn-sm w-full justify-start"><Icon name="scenes" size={13} /> Transition scene…</button>
          {scene?.type === "battle-field" && <button className="btn btn-subtle btn-sm w-full justify-start"><Icon name="map" size={13} /> Convert to Playing Field</button>}
          {scene?.type === "playing-field" && <button className="btn btn-subtle btn-sm w-full justify-start"><Icon name="sword" size={13} /> Convert to Battle Field</button>}
        </div>
      </div>
    </aside>
  );
}
